import express from 'express';
import cors from 'cors';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import sharp from 'sharp';
import pdfParse from 'pdf-parse';
import { exportProductToSlides, exportMultipleProductsToSlides, downloadPresentationAsPptx, inspectTemplate } from './slidesExporter.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Product extraction prompt - optimized for Vietnamese advertising product PDFs
const EXTRACTION_PROMPT = `
Bạn là AI chuyên trích xuất thông tin sản phẩm quảng cáo ngoài trời (OOH - Out of Home) từ tài liệu PDF tiếng Việt.
Hãy phân tích kỹ toàn bộ nội dung và trích xuất chính xác từng trường thông tin.

**CẤU TRÚC TÀI LIỆU THƯỜNG GẶP:**
- Trang 1: Logo/Thương hiệu của NHÀ CUNG CẤP (provider) - công ty sở hữu/quản lý bảng quảng cáo
- Các trang tiếp theo: Thông tin chi tiết từng sản phẩm (có thể có NHIỀU sản phẩm trong 1 file PDF)
- Mỗi sản phẩm thường gồm: 1 trang thông tin + 1-3 trang hình ảnh minh hoạ

**YÊU CẦU:**
1. Tìm tên NHÀ CUNG CẤP từ trang đầu (logo, header, footer, thương hiệu)
2. Trích xuất TẤT CẢ sản phẩm có trong file PDF

**=== BẢNG MAPPING TRƯỜNG THÔNG TIN ===**

| Thông tin trong PDF | Field JSON | Ghi chú |
|---|---|---|
| Mã vị trí / Mã sản phẩm / Code / Location Code | product_code | Giữ nguyên mã gốc nếu có |
| Tên vị trí / Tên bảng / Vị trí / Location | product_name | Tên ngắn gọn, TỐI ĐA 40 KÝ TỰ (tính cả dấu cách). Nếu tên gốc dài hơn 40 ký tự, hãy rút gọn nhưng giữ thông tin quan trọng (tên đường, quận/phường) |
| Loại hình / Loại bảng / Hình thức / Format | type | billboard/led/digital/banner/poster/transit/other |
| Số nhà | location.street_number | Ví dụ: "123", "45A" |
| Tên đường | location.street_name | Ví dụ: "Nguyễn Văn Linh" |
| Phường/Xã | location.ward | Ví dụ: "Phường Bến Nghé" |
| Tỉnh/Thành phố | location.city_province | Ví dụ: "TP. Hồ Chí Minh" |
| GPS / Toạ độ | location.gps_coordinates | Format: "lat,lng" |
| Hướng nhìn / View / Facing | location.landmark | Mô tả hướng/điểm mốc |
| Kích thước / Size (rộng x cao) | attributes.width, attributes.height | Đơn vị: MÉT |
| Độ phân giải / Resolution | attributes.pixel_width, attributes.pixel_height | Pixel |
| Thời lượng spot / Duration | attributes.video_duration | Giây |
| Thời gian hoạt động / Operating hours | attributes.opera_time_from, attributes.opera_time_to | HH:mm |
| Tần suất / Frequency / Spots/day | attributes.frequency | Giữ nguyên text |
| Số mặt / Sides | attributes.add_side | Số |
| Chiếu sáng / Lighting / Backlit | attributes.lighting | 1=có, 0=không |

**=== PHÂN BIỆT TRAFFIC VÀ GIÁ (CỰC KỲ QUAN TRỌNG) ===**

⚠️ TRAFFIC (lưu lượng giao thông) → field "traffic" (giữ nguyên text gốc):
- Từ khoá nhận biết: "traffic", "lưu lượng", "OTC", "VAC", "lượt/ngày", "xe/ngày", "người/ngày", "vehicles", "pedestrian"
- OTC = Ô tô con (passenger cars)
- VAC = Vận tải các loại (commercial vehicles / trucks)
- Ví dụ ĐÚNG:
  + "OTC/VAC: 120.000" → traffic: "OTC/VAC: 120.000"
  + "Traffic: 50.000 OTC/ngày" → traffic: "50.000 OTC/ngày"
  + "Lưu lượng: 80.000 lượt/ngày" → traffic: "80.000 lượt/ngày"
  + "45,000 vehicles/day" → traffic: "45,000 vehicles/day"
  + Dòng ghi "OTC: 30.000 - VAC: 15.000" → traffic: "OTC: 30.000 - VAC: 15.000"
- ❌ SAI: Đưa số OTC/VAC vào cost

💰 GIÁ (chi phí thuê) → field "cost" (CHỈ lấy số, bỏ ký tự):
- Từ khoá nhận biết: "đơn giá", "giá thuê", "giá", "price", "rate", "rental", "chi phí thuê", "VND/tháng", "USD/tháng", "VNĐ", "vnđ"
- Thường đi kèm đơn vị tiền tệ (VND, USD, đ, $) và chu kỳ (/tháng, /năm, /month)
- Ví dụ: "Giá thuê: 120.000.000 VND/tháng" → cost: 120000000
- ❌ SAI: Đưa số traffic/OTC/VAC vào cost

💡 QUY TẮC: Nếu dòng nào có chứa "OTC", "VAC", "traffic", "lưu lượng" → LUÔN LUÔN đưa vào "traffic", KHÔNG BAO GIỜ vào "cost"

**=== CÁC TRƯỜNG KHÁC ===**
| Thông tin | Field | Ghi chú |
|---|---|---|
| Đơn vị tiền | currency | "VND" hoặc "USD" |
| Thời hạn thuê | booking_duration | Ví dụ: "1 tháng", "6 tháng" |
| Chi phí thi công / Production | production_cost | Giữ nguyên text |
| Thuế địa phương | location.local_tax | Phần trăm (10, 15...) |
| Khu vực / Area | areas | Mảng string |
| Ghi chú | attributes.note hoặc description | Thông tin bổ sung |

**ĐỊNH DẠNG OUTPUT (JSON):**
{
  "provider_name": "Tên nhà cung cấp",
  "products": [
    {
      "product_code": "Mã sản phẩm (giữ nguyên từ PDF nếu có, hoặc để trống)",
      "product_name": "Tên vị trí/sản phẩm (TỐI ĐA 40 ký tự, tính cả dấu cách)",
      "type": "billboard | digital | led | transit | poster | banner | other",
      "areas": ["Khu vực"],
      "cost": 0,
      "currency": "VND",
      "traffic": "Giữ nguyên text lưu lượng giao thông từ PDF",
      "booking_duration": "1 tháng",
      "production_cost": "",
      "description": "Mô tả tổng hợp",
      "location": {
        "name": "Tên vị trí ngắn gọn",
        "address": "Địa chỉ đầy đủ",
        "street_number": "",
        "street_name": "",
        "ward": "",
        "city_province": "",
        "landmark": "Hướng nhìn/Điểm mốc",
        "gps_coordinates": "lat,lng",
        "currency": "VND",
        "local_tax": null
      },
      "attributes": {
        "width": 0,
        "height": 0,
        "video_duration": 0,
        "pixel_width": 0,
        "pixel_height": 0,
        "opera_time_from": "06:00",
        "opera_time_to": "22:00",
        "frequency": "",
        "shape": "rectangle",
        "note": "",
        "add_side": 1,
        "quantity_of_ad": 1,
        "lighting": 1
      }
    }
  ],
  "detected_items": [
    {
      "name": "Tên item phát hiện",
      "description": "Mô tả ngắn",
      "value": "Giá trị"
    }
  ]
}

**QUY TẮC XỬ LÝ:**
1. provider_name: Tên công ty/thương hiệu từ logo, header, footer trang đầu
2. products: TẤT CẢ sản phẩm tìm được (ít nhất 1)
3. Kích thước: chuyển về MÉT (cm÷100, mm÷1000)
4. cost: CHỈ số, bỏ dấu chấm/phẩy ngăn hàng nghìn, bỏ ký tự tiền tệ
5. Thời gian: format HH:mm
6. "Hướng nhìn" / "View" / "Facing" → landmark
7. Không tìm thấy → giá trị mặc định
8. type: billboard | digital | led | transit | poster | banner | other
9. Địa chỉ: TÁCH rõ street_number, street_name, ward, city_province
10. GPS: format "lat,lng"
11. detected_items: Liệt kê các mục/dịch vụ đọc được
12. product_code: Giữ nguyên mã từ PDF nếu có; nếu không có thì để trống
13. ⚠️ NHẮC LẠI: OTC/VAC/traffic/lưu lượng → field "traffic", KHÔNG PHẢI "cost"
14. Trả về ĐÚNG JSON, KHÔNG có text thừa trước hoặc sau JSON
15. product_name: TỐI ĐA 40 ký tự (tính cả dấu cách). Nếu tên gốc dài hơn, rút gọn thông minh: giữ tên đường + quận/phường, bỏ bớt từ thừa. VD: "Bảng LED Nguyễn Văn Linh, Q.7, TP.HCM"
`;

// AI Search prompt for product recommendations
const AI_SEARCH_PROMPT = `
Bạn là AI trợ lý tìm kiếm sản phẩm quảng cáo ngoài trời (OOH). Nhiệm vụ của bạn là phân tích yêu cầu tìm kiếm của người dùng và xác định các tiêu chí tìm kiếm.

**YÊU CẦU TÌM KIẾM CỦA NGƯỜI DÙNG:**
{USER_QUERY}

**DANH SÁCH SẢN PHẨM CÓ SẴN:**
{PRODUCTS_LIST}

**NHIỆM VỤ:**
1. Phân tích yêu cầu tìm kiếm để hiểu:
   - Loại bảng quảng cáo (billboard, led, digital, etc.)
   - Khu vực/vị trí mong muốn (quận, phường, đường, địa danh)
   - Các yêu cầu khác (kích thước, giá, etc.)

2. Tìm và xếp hạng các sản phẩm PHÙ HỢP NHẤT từ danh sách:
   - Ưu tiên sản phẩm khớp với địa điểm/khu vực được đề cập
   - Xét đến landmark, địa chỉ, phường, quận
   - Cân nhắc loại hình sản phẩm nếu được chỉ định

**TRẢ VỀ JSON:**
{
  "query_analysis": {
    "product_type": "loại sản phẩm yêu cầu (nếu có)",
    "location_keywords": ["từ khóa vị trí 1", "từ khóa 2"],
    "area_district": "quận/huyện (nếu xác định được)",
    "additional_requirements": "yêu cầu khác (nếu có)"
  },
  "recommendations": [
    {
      "product_id": "id sản phẩm",
      "product_name": "tên sản phẩm", 
      "product_code": "mã sản phẩm",
      "match_score": 0.0-1.0,
      "match_reason": "lý do phù hợp ngắn gọn",
      "location_match": true/false,
      "type_match": true/false
    }
  ],
  "search_summary": "Tóm tắt kết quả tìm kiếm bằng tiếng Việt tự nhiên"
}

**LƯU Ý:**
- Trả về tối đa 10 sản phẩm phù hợp nhất
- Xếp hạng theo match_score giảm dần
- Nếu không tìm thấy sản phẩm phù hợp, trả về mảng recommendations rỗng
- search_summary nên mô tả kết quả một cách tự nhiên, dễ hiểu
`;

/**
 * Convert image to base64 with optimization
 */
async function processImage(buffer, mimeType) {
  try {
    // Resize image if too large (max 1568px for Claude - recommended)
    const image = sharp(buffer);
    const metadata = await image.metadata();
    
    let processedBuffer = buffer;
    
    // Claude recommends max 1568px on longest side for best performance
    const MAX_DIMENSION = 1568;
    
    if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
      processedBuffer = await image
        .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      mimeType = 'image/jpeg';
    }
    
    // If still larger than 1MB, compress more aggressively
    if (processedBuffer.length > 1 * 1024 * 1024) {
      processedBuffer = await sharp(processedBuffer)
        .jpeg({ quality: 50 })
        .toBuffer();
      mimeType = 'image/jpeg';
    }
    
    console.log(`Image processed: ${metadata.width}x${metadata.height} -> ${processedBuffer.length} bytes`);
    
    return {
      data: processedBuffer.toString('base64'),
      mimeType: mimeType
    };
  } catch (error) {
    console.error('Error processing image:', error);
    return {
      data: buffer.toString('base64'),
      mimeType: mimeType
    };
  }
}

/**
 * Extract text and images from PDF
 */
async function processPDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return {
      text: data.text,
      numPages: data.numpages,
      info: data.info
    };
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw error;
  }
}

/**
 * Extract product data using Claude API
 */
app.post('/api/extract', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded' 
      });
    }

    const { buffer, mimetype, originalname } = req.file;
    
    console.log(`Processing file: ${originalname}, type: ${mimetype}, size: ${buffer.length} bytes`);

    let content = [];
    
    // Max file size for Claude API (roughly 20MB base64 = ~15MB raw)
    const MAX_PDF_SIZE = 15 * 1024 * 1024; // 15MB

    if (mimetype === 'application/pdf') {
      // Check if PDF is too large
      if (buffer.length > MAX_PDF_SIZE) {
        console.log(`PDF too large (${(buffer.length / 1024 / 1024).toFixed(2)}MB), extracting text instead...`);
        
        // Extract text from PDF and send as text
        try {
          const pdfData = await processPDF(buffer);
          console.log(`Extracted ${pdfData.text.length} chars from ${pdfData.numPages} pages`);
          
          content = [
            {
              type: 'text',
              text: `[PDF Document - ${pdfData.numPages} pages]\n\nExtracted text:\n${pdfData.text.substring(0, 50000)}\n\n${EXTRACTION_PROMPT}`
            }
          ];
        } catch (pdfError) {
          return res.status(400).json({
            success: false,
            error: `PDF quá lớn (${(buffer.length / 1024 / 1024).toFixed(1)}MB) và không thể đọc text. Vui lòng sử dụng file nhỏ hơn 15MB.`
          });
        }
      } else {
        // PDF size is OK, send as document
        const base64Data = buffer.toString('base64');
        content = [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Data
            }
          },
          {
            type: 'text',
            text: EXTRACTION_PROMPT
          }
        ];
      }
    } else if (mimetype.startsWith('image/')) {
      // Process image
      const processed = await processImage(buffer, mimetype);
      content = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: processed.mimeType,
            data: processed.data
          }
        },
        {
          type: 'text',
          text: EXTRACTION_PROMPT
        }
      ];
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Unsupported file type. Please upload PDF or image files.' 
      });
    }

    // Call Claude API with retry logic
    let message;
    let lastError;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 seconds
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`Claude API call attempt ${attempt}/${MAX_RETRIES}...`);
        
        message = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8192,
          messages: [
            {
              role: 'user',
              content: content
            }
          ]
        });
        
        // Success - break out of retry loop
        break;
      } catch (apiError) {
        lastError = apiError;
        console.error(`Attempt ${attempt} failed:`, apiError.message);
        
        // Check if it's an overloaded error (529) or rate limit (429)
        const isRetryable = apiError.status === 529 || apiError.status === 429 || 
                           apiError.message?.includes('overloaded') ||
                           apiError.message?.includes('rate');
        
        if (isRetryable && attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY * attempt; // Exponential backoff
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else if (!isRetryable) {
          // Non-retryable error, throw immediately
          throw apiError;
        }
      }
    }
    
    if (!message) {
      return res.status(503).json({
        success: false,
        error: `Claude API đang quá tải. Vui lòng thử lại sau vài giây. (${lastError?.message || 'Unknown error'})`
      });
    }

    // Extract text response
    const responseText = message.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({
        success: false,
        error: 'Could not extract JSON from AI response',
        rawResponse: responseText
      });
    }

    const extractedData = JSON.parse(jsonMatch[0]);

    res.json({
      success: true,
      data: extractedData,
      rawResponse: responseText,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens
      }
    });

  } catch (error) {
    console.error('Extraction error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error during extraction'
    });
  }
});

/**
 * Match image to products using Claude API
 */
app.post('/api/match-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No image uploaded' 
      });
    }

    const { products } = req.body;
    if (!products) {
      return res.status(400).json({ 
        success: false, 
        error: 'Products list is required' 
      });
    }

    const { buffer, mimetype } = req.file;
    const processed = await processImage(buffer, mimetype);
    
    const productList = JSON.parse(products);
    const productListStr = productList.map((p, i) => 
      `${i + 1}. Tên: "${p.product_name}", Mã: ${p.product_code || 'N/A'}, Địa chỉ: ${p.location?.address || 'N/A'}`
    ).join('\n');

    const matchPrompt = `
Đọc TEXT/CHỮ hiển thị trên hình ảnh này và tìm sản phẩm PHÙ HỢP trong danh sách.

**DANH SÁCH SẢN PHẨM:**
${productListStr}

**TRẢ VỀ JSON:**
{
  "detected_title": "Text tiêu đề đọc được từ hình",
  "matched_product_name": "Tên sản phẩm phù hợp nhất (hoặc null nếu không match)",
  "matched_product_code": "Mã sản phẩm phù hợp (hoặc null)",
  "confidence": 0.0-1.0,
  "reason": "Lý do match"
}
`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: processed.mimeType,
                data: processed.data
              }
            },
            {
              type: 'text',
              text: matchPrompt
            }
          ]
        }
      ]
    });

    const responseText = message.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const matchResult = JSON.parse(jsonMatch[0]);
      res.json({
        success: true,
        ...matchResult
      });
    } else {
      res.json({
        success: false,
        error: 'Could not parse match result'
      });
    }

  } catch (error) {
    console.error('Image matching error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error during image matching'
    });
  }
});

/**
 * Export single product to Google Slides
 */
app.post('/api/export-slides', express.json(), async (req, res) => {
  try {
    const { product } = req.body;
    
    if (!product) {
      return res.status(400).json({
        success: false,
        error: 'Product data is required'
      });
    }

    console.log(`📊 Exporting product to Google Slides: ${product.product_name}`);
    
    const result = await exportProductToSlides(product);
    
    console.log(`✅ Export complete: ${result.slideUrl}`);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error during export'
    });
  }
});

/**
 * Export multiple products to Google Slides
 */
app.post('/api/export-slides-batch', express.json(), async (req, res) => {
  try {
    const { products } = req.body;
    
    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Products array is required'
      });
    }

    console.log(`📊 Batch exporting ${products.length} products to Google Slides`);
    
    const result = await exportMultipleProductsToSlides(products);
    
    console.log(`✅ Batch export complete: ${result.slideUrl}`);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Batch export error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error during batch export'
    });
  }
});

/**
 * Download exported presentation as PPTX file
 */
app.get('/api/export-slides/download/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      return res.status(400).json({ success: false, error: 'Invalid presentation ID' });
    }

    console.log(`📥 Downloading PPTX: ${id}`);

    const { stream, fileName } = await downloadPresentationAsPptx(id);
    const safeName = fileName.replace(/[^a-zA-Z0-9_\-. ]/g, '_');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pptx"`);

    stream.pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Download failed',
    });
  }
});

// Debug: Inspect template slide elements
app.get('/api/inspect-template', async (req, res) => {
  try {
    const elements = await inspectTemplate();
    const images = elements.filter(e => e.type === 'IMAGE');
    res.json({
      success: true,
      totalElements: elements.length,
      imageCount: images.length,
      images,
      allElements: elements,
    });
  } catch (error) {
    console.error('Inspect template error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Claude Proxy Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📤 Extract endpoint: POST http://localhost:${PORT}/api/extract`);
  console.log(`🔍 AI Search endpoint: POST http://localhost:${PORT}/api/ai-search`);
  console.log(`📊 Export Slides: POST http://localhost:${PORT}/api/export-slides`);
  console.log(`📊 Batch Export: POST http://localhost:${PORT}/api/export-slides-batch`);
  console.log(`🔧 Inspect Template: GET http://localhost:${PORT}/api/inspect-template`);
});

/**
 * AI-powered product search/recommendation
 */
app.post('/api/ai-search', express.json(), async (req, res) => {
  try {
    const { query, products } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Products list is required'
      });
    }

    console.log(`🔍 AI Search request: "${query}" among ${products.length} products`);

    // Format products for the prompt
    const productsListStr = products.map((p, i) => {
      return `${i + 1}. ID: ${p.id}
   Tên: ${p.product_name}
   Mã: ${p.product_code}
   Loại: ${p.type}
   Địa chỉ: ${p.location_address || 'N/A'}
   Phường: ${p.ward || 'N/A'}
   Quận/TP: ${p.city_province || 'N/A'}
   Landmark: ${p.landmark || 'N/A'}
   Giá: ${p.cost} ${p.currency}`;
    }).join('\n\n');

    // Build prompt
    const searchPrompt = AI_SEARCH_PROMPT
      .replace('{USER_QUERY}', query)
      .replace('{PRODUCTS_LIST}', productsListStr);

    // Call Claude API
    let message;
    let lastError;
    const MAX_RETRIES = 2;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`Claude AI Search attempt ${attempt}/${MAX_RETRIES}...`);
        
        message = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: searchPrompt
            }
          ]
        });
        break;
      } catch (apiError) {
        lastError = apiError;
        console.error(`AI Search attempt ${attempt} failed:`, apiError.message);
        
        if (apiError.status === 529 || apiError.status === 429) {
          if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
          }
        } else {
          throw apiError;
        }
      }
    }

    if (!message) {
      return res.status(503).json({
        success: false,
        error: `Claude API đang quá tải. Vui lòng thử lại sau. (${lastError?.message || 'Unknown error'})`
      });
    }

    // Extract response
    const responseText = message.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    // Parse JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({
        success: false,
        error: 'Could not parse AI response',
        rawResponse: responseText
      });
    }

    const searchResult = JSON.parse(jsonMatch[0]);
    
    console.log(`✅ AI Search completed: ${searchResult.recommendations?.length || 0} recommendations`);

    res.json({
      success: true,
      data: searchResult,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens
      }
    });

  } catch (error) {
    console.error('AI Search error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error during AI search'
    });
  }
});
