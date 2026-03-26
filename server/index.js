import express from 'express';
import cors from 'cors';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import sharp from 'sharp';
import pdfParse from 'pdf-parse';

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
Bạn là một AI chuyên trích xuất thông tin sản phẩm quảng cáo ngoài trời (OOH - Out of Home) từ tài liệu PDF tiếng Việt.

**CẤU TRÚC TÀI LIỆU:**
- Trang 1: Logo/Thương hiệu của NHÀ CUNG CẤP (provider) - đây là công ty sở hữu/quản lý các bảng quảng cáo
- Các trang tiếp theo: Thông tin chi tiết từng sản phẩm (có thể có NHIỀU sản phẩm trong 1 file PDF)

**YÊU CẦU QUAN TRỌNG:**
1. Tìm tên NHÀ CUNG CẤP từ trang đầu (logo, header, footer, thương hiệu)
2. Trích xuất TẤT CẢ sản phẩm có trong file PDF (có thể có 1 hoặc nhiều sản phẩm)

**CÁC TRƯỜNG THÔNG TIN CẦN TÌM CHO MỖI SẢN PHẨM:**
- Mã vị trí / Mã sản phẩm / Code → product_code
- Tên vị trí / Tên bảng / Vị trí → product_name  
- Loại hình / Loại bảng / Hình thức → type (billboard/led/digital/banner/poster/transit)
- ĐỊA CHỈ CẦN TÁCH RÕ RÀNG (CHỈ 2 CẤP):
  + Số nhà → location.street_number (ví dụ: "123", "45A", "12/3")
  + Tên đường → location.street_name (ví dụ: "Nguyễn Văn Linh", "Lê Lợi")
  + Phường/Xã → location.ward (ví dụ: "Phường Bến Nghé", "Xã An Phú")
  + Tỉnh/Thành phố → location.city_province (ví dụ: "TP. Hồ Chí Minh", "Hà Nội")
- GPS nếu có → location.gps_coordinates (format: "lat,lng", ví dụ: "10.762622,106.660172")
- Thuế địa phương nếu có → location.local_tax (phần trăm, ví dụ: 10)
- Đơn vị tiền tệ → location.currency (VND/USD)
- Kích thước / Size (rộng x cao) → attributes.width, attributes.height (đơn vị: mét)
- Độ phân giải / Resolution → attributes.pixel_width x attributes.pixel_height
- Thời lượng spot / Video duration → attributes.video_duration (giây)
- Thời gian hoạt động / Operating time → attributes.opera_time_from, attributes.opera_time_to
- Tần suất / Frequency → attributes.frequency
- Số mặt / Sides → attributes.add_side
- Chiếu sáng / Lighting → attributes.lighting (1=có, 0=không)
- Lưu lượng / Traffic → traffic
- Đơn giá / Giá thuê / Price → cost (chỉ lấy số, bỏ ký tự)
- Đơn vị tiền / Currency → currency (VND/USD)
- Thời hạn thuê / Duration → booking_duration
- Chi phí thi công / Production cost → production_cost
- Ghi chú / Note → attributes.note hoặc description
- Khu vực / Area → areas (mảng)

**ĐỊNH DẠNG OUTPUT (JSON):**
{
  "provider_name": "Tên nhà cung cấp (từ logo/header trang 1)",
  "products": [
    {
      "product_code": "Mã sản phẩm nếu có",
      "product_name": "Tên đầy đủ của vị trí/sản phẩm",
      "type": "billboard | digital | led | transit | poster | banner | other",
      "areas": ["Khu vực 1", "Khu vực 2"],
      "cost": 0,
      "currency": "VND",
      "traffic": "Lưu lượng giao thông",
      "booking_duration": "1 tháng",
      "production_cost": "Chi phí sản xuất",
      "description": "Mô tả tổng hợp từ các thông tin trong PDF",
      "location": {
        "name": "Tên vị trí ngắn gọn",
        "address": "Địa chỉ đầy đủ (để tương thích ngược)",
        "street_number": "Số nhà (nếu có)",
        "street_name": "Tên đường",
        "ward": "Phường/Xã",
        "city_province": "Tỉnh/Thành phố",
        "landmark": "Điểm mốc/Hướng nhìn nếu có",
        "gps_coordinates": "lat,lng (nếu có)",
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
        "note": "Ghi chú từ PDF",
        "add_side": 1,
        "quantity_of_ad": 1,
        "lighting": 1
      }
    }
  ],
  "detected_items": [
    {
      "name": "Tên item phát hiện được",
      "description": "Mô tả ngắn",
      "value": "Giá trị/giá"
    }
  ]
}

**QUY TẮC QUAN TRỌNG:**
1. provider_name: Tìm tên công ty/thương hiệu từ logo, header, hoặc footer trang đầu
2. products: Mảng chứa TẤT CẢ sản phẩm tìm được (ít nhất 1)
3. Kích thước: chuyển về đơn vị MÉT (nếu ghi cm thì chia 100, mm thì chia 1000)
4. Giá (cost): CHỈ lấy số, loại bỏ dấu chấm ngăn cách hàng nghìn, dấu phẩy, ký tự tiền tệ
5. Thời gian hoạt động: format HH:mm (ví dụ: 06:00, 22:00)
6. Nếu có "Hướng nhìn" hoặc "View" → đưa vào landmark
7. Nếu không tìm thấy thông tin → để giá trị mặc định
8. type phải là 1 trong: billboard, digital, led, transit, poster, banner, other
9. ĐỊA CHỈ: PHẢI tách rõ ràng thành street_number, street_name, ward, city_province
10. GPS: Nếu tìm thấy tọa độ GPS → ghi vào gps_coordinates với format "lat,lng"
11. detected_items: Liệt kê các mục/dịch vụ chính đọc được từ tài liệu (tên, mô tả, giá)
12. Trả về ĐÚNG định dạng JSON, KHÔNG có text thừa
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Claude Proxy Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📤 Extract endpoint: POST http://localhost:${PORT}/api/extract`);
});
