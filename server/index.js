import express from 'express';
import cors from 'cors';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import sharp from 'sharp';
import pdfParse from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';
import { exportProductToSlides, exportMultipleProductsToSlides, downloadPresentationAsPptx, downloadPresentationAsPdf, inspectTemplate } from './slidesExporter.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3009;

// Initialize Supabase client for feedback storage
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
  console.log('Supabase client initialized for feedback storage');
} else {
  console.warn('Supabase credentials not found - feedback storage disabled');
}

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

// RAG/Embedding config
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

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
// Moved to system message for prompt caching support
const EXTRACTION_SYSTEM_PROMPT = `
Bạn là AI chuyên trích xuất thông tin sản phẩm quảng cáo ngoài trời (OOH - Out of Home) từ tài liệu PDF tiếng Việt.
Hãy phân tích kỹ toàn bộ nội dung và trích xuất chính xác từng trường thông tin.

**CẤU TRÚC TÀI LIỆU THƯỜNG GẶP:**
- Trang 1: Logo/Thương hiệu của NHÀ CUNG CẤP (provider) - công ty sở hữu/quản lý bảng quảng cáo
- Các trang tiếp theo: Thông tin chi tiết từng sản phẩm (có thể có NHIỀU sản phẩm trong 1 file PDF)
- Mỗi sản phẩm thường gồm: 1 trang thông tin + 1-3 trang hình ảnh minh hoạ

**YÊU CẦU:**
1. Tìm tên NHÀ CUNG CẤP từ trang đầu (logo, header, footer, thương hiệu)
2. Trích xuất TẤT CẢ sản phẩm có trong file PDF

**=== CÁC NHÓM THÔNG TIN CẦN TRÍCH XUẤT ===**

📋 **VENDOR (Nhà cung cấp)**
→ provider_name: Tên công ty/thương hiệu từ logo, header, footer trang đầu

📍 **LOCATION OVERVIEW (Tổng quan vị trí)**
| Thông tin | Field JSON | Ghi chú |
|---|---|---|
| Site Name / Tên vị trí | product_name | TỐI ĐA 40 KÝ TỰ |
| Exact Location / Địa chỉ chi tiết | location.address + street components | Tách: street_number, street_name, ward, city_province |
| Google Maps Pin | location.gps_coordinates | Giữ nguyên text GPS từ PDF (Plus Code, lat/lng, địa chỉ...) |
| Location Highlights / Điểm sáng vị trí | location.landmark | Hướng nhìn, gần ngã tư, trung tâm mua sắm, Unobstructed view... |
| Mã vị trí / Location Code | product_code | Giữ nguyên mã gốc nếu có |

🔧 **TECHNICAL SPECIFICATIONS (Thông số kỹ thuật)**
| Thông tin | Field JSON | Ghi chú |
|---|---|---|
| Media Type / Loại hình | type | billboard/led/digital/banner/poster/transit/other |
| Dimensions (W x H) / Kích thước | attributes.width, attributes.height | Đơn vị: MÉT |
| Number of Faces / Số mặt | attributes.add_side | Số |
| Resolution / Độ phân giải | attributes.pixel_width, attributes.pixel_height | Pixel (cho LED/LCD) |
| Lighting System / Hệ thống chiếu sáng | attributes.lighting | Text mô tả, VD: "8 đèn LED pha", "Backlit", "Không" |
| Material / Vật liệu | attributes.material | VD: "Hiflex (Bạt)", "Backlit Film", "LED Module" |
| Illumination Time / Thời gian chiếu sáng | attributes.illumination_time_from, attributes.illumination_time_to | VD: "18:00" - "22:00" (dành cho billboard) |
| Operating Hours / Thời gian hoạt động | attributes.opera_time_from, attributes.opera_time_to | VD: "06:00" - "23:00" (dành cho LED/digital) |
| Shape / Hình dạng | attributes.shape | rectangle/square/vertical/horizontal/circular/other |

📊 **ADVERTISING PERFORMANCE (Chỉ số hiệu quả)**
| Thông tin | Field JSON | Ghi chú |
|---|---|---|
| Traffic Volume / Impressions (OTS/VAC) | traffic | Giữ nguyên text gốc |
| Spot Duration / Thời lượng spot | attributes.video_duration | Giây |
| Frequency/Loop / Tần suất | attributes.frequency | Giữ nguyên text |
| Ad Slots / Số vị trí quảng cáo | attributes.quantity_of_ad | Số |

💰 **COMMERCIAL TERMS (Điều khoản thương mại)**
| Thông tin | Field JSON | Ghi chú |
|---|---|---|
| Campaign Duration / Thời hạn thuê | booking_duration | VD: "1 tháng", "6 tháng", "1 năm" |
| Investment / Media Rate / Đơn giá thuê | cost | CHỈ số, bỏ ký tự tiền tệ |
| Currency / Đơn vị tiền | currency | "VND" hoặc "USD" |
| Production Fee / Phí sản xuất | production_cost | Giữ nguyên text |
| Local Tax / Thuế địa phương | location.local_tax | Phần trăm (10, 15...) |

**=== PHÂN BIỆT TRAFFIC VÀ GIÁ (CỰC KỲ QUAN TRỌNG) ===**

⚠️ TRAFFIC (lưu lượng giao thông) → field "traffic" (giữ nguyên text gốc):
- Từ khoá nhận biết: "traffic", "lưu lượng", "OTC", "OTS", "VAC", "lượt/ngày", "xe/ngày", "người/ngày", "vehicles", "pedestrian", "impressions"
- OTC = Ô tô con (passenger cars)
- VAC = Vận tải các loại (commercial vehicles / trucks)
- OTS = Opportunity To See
- Ví dụ ĐÚNG:
  + "OTC/VAC: 120.000" → traffic: "OTC/VAC: 120.000"
  + "Traffic: 50.000 OTC/ngày" → traffic: "50.000 OTC/ngày"
  + "Lưu lượng: 80.000 lượt/ngày" → traffic: "80.000 lượt/ngày"
- ❌ SAI: Đưa số OTC/VAC vào cost

💰 GIÁ (chi phí thuê) → field "cost" (CHỈ lấy số, bỏ ký tự):
- Từ khoá nhận biết: "đơn giá", "giá thuê", "giá", "price", "rate", "rental", "chi phí thuê", "investment", "media rate"
- Thường đi kèm đơn vị tiền tệ (VND, USD, đ, $) và chu kỳ (/tháng, /năm, /month)
- ❌ SAI: Đưa số traffic/OTC/VAC vào cost

💡 QUY TẮC: Nếu dòng nào có chứa "OTC", "VAC", "OTS", "traffic", "lưu lượng", "impressions" → LUÔN LUÔN đưa vào "traffic", KHÔNG BAO GIỜ vào "cost"

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
        "landmark": "Hướng nhìn / Điểm sáng vị trí (Location Highlights)",
        "gps_coordinates": "Giữ nguyên text GPS từ PDF",
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
        "lighting": "Mô tả hệ thống chiếu sáng (VD: 8 đèn LED pha, Backlit, Không)",
        "material": "Vật liệu (VD: Hiflex, Backlit Film, LED Module)",
        "illumination_time_from": "18:00",
        "illumination_time_to": "22:00"
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
6. "Hướng nhìn" / "View" / "Facing" / "Location Highlights" → landmark
7. Không tìm thấy → giá trị mặc định
8. type: billboard (bảng tĩnh) | digital (màn hình digital) | led (LED) | transit (phương tiện di động) | poster | banner | other
9. Địa chỉ: TÁCH rõ street_number, street_name, ward, city_province
10. GPS: Giữ nguyên TOÀN BỘ text GPS từ PDF (bao gồm Plus Code, địa chỉ, tọa độ - KHÔNG cắt bớt)
11. detected_items: Liệt kê các mục/dịch vụ đọc được
12. product_code: Giữ nguyên mã từ PDF nếu có; nếu không có thì để trống
13. ⚠️ NHẮC LẠI: OTC/VAC/OTS/traffic/lưu lượng/impressions → field "traffic", KHÔNG PHẢI "cost"
14. Trả về ĐÚNG JSON, KHÔNG có text thừa trước hoặc sau JSON
15. product_name: TỐI ĐA 40 ký tự (tính cả dấu cách)
16. lighting: Mô tả dạng TEXT (VD: "8 đèn LED pha", "Backlit", "Frontlit", "Không"). KHÔNG dùng số 0/1
17. material: Vật liệu bảng (VD: "Hiflex (Bạt)", "Backlit Film", "LED Module", "PP"). Để trống nếu không có
18. illumination_time: Thời gian chiếu sáng riêng (thường 18:00-22:00 cho billboard). Khác với Operating Hours
`;

// User-facing extraction instruction (sent with the document)
const EXTRACTION_USER_INSTRUCTION = `Hãy phân tích tài liệu này và trích xuất TẤT CẢ sản phẩm OOH theo đúng schema đã định nghĩa trong system prompt. Sử dụng tool save_extracted_products để trả về kết quả.`;

// =============================================
// TOOL USE SCHEMA - Structured Output
// =============================================
const EXTRACTION_TOOL = {
  name: 'save_extracted_products',
  description: 'Save extracted product data from a Vietnamese OOH advertising PDF/image document. Call this tool with the structured data you extracted.',
  input_schema: {
    type: 'object',
    properties: {
      provider_name: {
        type: 'string',
        description: 'Tên nhà cung cấp/công ty từ logo, header, footer'
      },
      products: {
        type: 'array',
        description: 'Danh sách sản phẩm trích xuất được',
        items: {
          type: 'object',
          properties: {
            product_code: { type: 'string', description: 'Mã sản phẩm từ PDF (giữ nguyên)' },
            product_name: { type: 'string', description: 'Tên vị trí/sản phẩm, tối đa 40 ký tự', maxLength: 40 },
            type: { type: 'string', enum: ['billboard', 'digital', 'led', 'transit', 'poster', 'banner', 'other'] },
            areas: { type: 'array', items: { type: 'string' } },
            cost: { type: 'number', description: 'Chi phí thuê (CHỈ số, không ký tự tiền tệ). KHÔNG nhầm với traffic/OTC/VAC' },
            currency: { type: 'string', enum: ['VND', 'USD'], default: 'VND' },
            traffic: { type: 'string', description: 'Lưu lượng giao thông (giữ nguyên text). OTC/VAC/OTS/impressions luôn vào đây' },
            booking_duration: { type: 'string', description: 'Thời hạn thuê, VD: 1 tháng, 6 tháng' },
            production_cost: { type: 'string', description: 'Phí sản xuất (text)' },
            description: { type: 'string', description: 'Mô tả tổng hợp' },
            confidence: {
              type: 'object',
              description: 'Confidence score (0.0-1.0) cho từng nhóm field',
              properties: {
                location: { type: 'number', minimum: 0, maximum: 1 },
                pricing: { type: 'number', minimum: 0, maximum: 1 },
                specifications: { type: 'number', minimum: 0, maximum: 1 },
                overall: { type: 'number', minimum: 0, maximum: 1 }
              },
              required: ['overall']
            },
            location: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                address: { type: 'string', description: 'Địa chỉ đầy đủ' },
                street_number: { type: 'string' },
                street_name: { type: 'string' },
                ward: { type: 'string' },
                city_province: { type: 'string' },
                landmark: { type: 'string', description: 'Hướng nhìn / Location Highlights' },
                gps_coordinates: { type: 'string', description: 'Giữ nguyên text GPS từ PDF' },
                currency: { type: 'string', enum: ['VND', 'USD'] },
                local_tax: { type: ['number', 'null'] }
              },
              required: ['name', 'address', 'city_province']
            },
            attributes: {
              type: 'object',
              properties: {
                width: { type: 'number', description: 'Chiều rộng (mét)' },
                height: { type: 'number', description: 'Chiều cao (mét)' },
                video_duration: { type: 'number', description: 'Thời lượng spot (giây)' },
                pixel_width: { type: 'number' },
                pixel_height: { type: 'number' },
                opera_time_from: { type: 'string', description: 'HH:mm' },
                opera_time_to: { type: 'string', description: 'HH:mm' },
                frequency: { type: 'string' },
                shape: { type: 'string', enum: ['rectangle', 'square', 'vertical', 'horizontal', 'circular', 'other'] },
                note: { type: 'string' },
                add_side: { type: 'number', description: 'Số mặt' },
                quantity_of_ad: { type: 'number' },
                lighting: { type: 'string', description: 'Mô tả chiếu sáng (text, VD: "8 đèn LED pha")' },
                material: { type: 'string', description: 'Vật liệu (VD: "Hiflex", "LED Module")' },
                illumination_time_from: { type: 'string', description: 'HH:mm' },
                illumination_time_to: { type: 'string', description: 'HH:mm' }
              }
            }
          },
          required: ['product_name', 'type', 'cost', 'location']
        }
      },
      detected_items: {
        type: 'array',
        description: 'Các mục/dịch vụ phát hiện được từ PDF',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            value: { type: 'string' }
          },
          required: ['name', 'value']
        }
      }
    },
    required: ['provider_name', 'products']
  }
};

// =============================================
// FEEDBACK & LEARNING HELPERS
// =============================================

/**
 * Lookup few-shot examples for a provider from feedback history
 */
async function getFewShotExamples(providerHint, limit = 2) {
  if (!supabase) return [];
  
  try {
    let query = supabase
      .from('extraction_feedback')
      .select('original_extraction, corrected_data, provider_name, file_name')
      .eq('was_corrected', true)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    // If we have a provider hint, prioritize that provider's examples
    if (providerHint) {
      query = supabase
        .from('extraction_feedback')
        .select('original_extraction, corrected_data, provider_name, file_name')
        .eq('was_corrected', true)
        .ilike('provider_name', `%${providerHint}%`)
        .order('created_at', { ascending: false })
        .limit(limit);
    }
    
    const { data, error } = await query;
    if (error) {
      console.error('Error fetching few-shot examples:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Few-shot lookup failed:', err);
    return [];
  }
}

/**
 * Lookup provider template if exists
 */
async function getProviderTemplate(providerName) {
  if (!supabase || !providerName) return null;
  
  try {
    const { data, error } = await supabase
      .from('provider_templates')
      .select('*')
      .ilike('provider_name', `%${providerName}%`)
      .limit(1)
      .single();
    
    if (error || !data) return null;
    return data;
  } catch (err) {
    return null;
  }
}

/**
 * Build enhanced prompt with few-shot examples and provider template
 * Returns { systemPrompt, userInstruction } for proper system/user separation
 */
function buildEnhancedPrompt(baseSystemPrompt, fewShotExamples, providerTemplate) {
  let systemPrompt = baseSystemPrompt;
  
  // Add provider-specific hints to system prompt
  if (providerTemplate) {
    systemPrompt += `\n\n**=== PROVIDER TEMPLATE (${providerTemplate.provider_name}) ===**\n`;
    systemPrompt += `Layout: ${providerTemplate.layout_hints}\n`;
    if (providerTemplate.field_mapping) {
      systemPrompt += `Field Mapping: ${JSON.stringify(providerTemplate.field_mapping)}\n`;
    }
    if (providerTemplate.extraction_notes) {
      systemPrompt += `Notes: ${providerTemplate.extraction_notes}\n`;
    }
  }
  
  // Add few-shot examples to system prompt
  if (fewShotExamples.length > 0) {
    systemPrompt += `\n\n**=== VÍ DỤ THAM KHẢO (từ các lần extract trước đã được verify) ===**\n`;
    systemPrompt += `Hãy tham khảo format và cách mapping field từ các ví dụ đã verify sau:\n\n`;
    
    fewShotExamples.forEach((ex, i) => {
      systemPrompt += `--- Ví dụ ${i + 1} (Provider: ${ex.provider_name || 'Unknown'}, File: ${ex.file_name || 'N/A'}) ---\n`;
      systemPrompt += `AI trích xuất ban đầu:\n${JSON.stringify(ex.original_extraction, null, 2).substring(0, 1500)}\n\n`;
      systemPrompt += `Sau khi user verify & sửa:\n${JSON.stringify(ex.corrected_data, null, 2).substring(0, 1500)}\n\n`;
    });
    
    systemPrompt += `Hãy học từ các correction pattern trên để extract chính xác hơn.\n`;
  }
  
  return { systemPrompt, userInstruction: EXTRACTION_USER_INSTRUCTION };
}

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

const RAG_SYSTEM_PROMPT = `
Bạn là AI trợ lý tìm kiếm sản phẩm quảng cáo ngoài trời (OOH).
Bạn được cung cấp:
1) Query người dùng
2) Danh sách sản phẩm ứng viên đã được truy hồi từ knowledge base (RAG)
3) Context chunks (trích đoạn nội dung nguồn)

Nhiệm vụ:
- Ưu tiên sản phẩm ứng viên theo mức độ phù hợp thực tế với query.
- Dựa vào context chunks để giải thích ngắn gọn vì sao phù hợp.
- Không bịa dữ liệu ngoài context và danh sách sản phẩm.

Trả về JSON đúng schema:
{
  "query_analysis": {
    "product_type": "...",
    "location_keywords": ["..."],
    "area_district": "...",
    "additional_requirements": "..."
  },
  "recommendations": [
    {
      "product_id": "...",
      "product_name": "...",
      "product_code": "...",
      "match_score": 0.0,
      "match_reason": "...",
      "location_match": true,
      "type_match": true
    }
  ],
  "search_summary": "..."
}
`;

function isRagEnabled() {
  return Boolean(supabase && OPENAI_API_KEY);
}

function detectProductTypeFromQuery(query = '') {
  const q = query.toLowerCase();
  if (q.includes('billboard') || q.includes('biển tĩnh')) return 'billboard';
  if (q.includes('led')) return 'led';
  if (q.includes('digital') || q.includes('màn hình')) return 'digital';
  if (q.includes('transit') || q.includes('xe buýt') || q.includes('taxi')) return 'transit';
  if (q.includes('poster')) return 'poster';
  if (q.includes('banner')) return 'banner';
  return null;
}

function detectLocationKeywordFromQuery(query = '') {
  // Basic heuristic: capture known district/city-like phrases
  // Example: "quận 1", "phú nhuận", "tân bình", "hà nội"
  const q = query.toLowerCase();
  const districtMatch = q.match(/quận\s*\d+/i);
  if (districtMatch) return districtMatch[0];

  const commonPlaces = [
    'phú nhuận', 'tân bình', 'quận 1', 'quận 3', 'quận 7', 'thủ đức',
    'bình thạnh', 'gò vấp', 'ho chi minh', 'hồ chí minh', 'hcm', 'hà nội', 'đà nẵng'
  ];

  for (const place of commonPlaces) {
    if (q.includes(place)) return place;
  }

  return null;
}

function buildRagChunksFromProduct(product) {
  const safe = (v) => (v ?? '').toString().trim();
  const dims = `${safe(product?.attributes?.width)}m x ${safe(product?.attributes?.height)}m`;

  const overview = [
    `Tên sản phẩm: ${safe(product.product_name)}`,
    `Mã sản phẩm: ${safe(product.product_code)}`,
    `Loại: ${safe(product.type)}`,
    `Nhà cung cấp: ${safe(product.provider_name)}`,
    `Địa chỉ: ${safe(product.location_address)}`,
    `Phường: ${safe(product.ward)}`,
    `Thành phố/Tỉnh: ${safe(product.city_province)}`,
    `Landmark: ${safe(product.landmark)}`,
  ].join('\n');

  const pricing = [
    `Tên sản phẩm: ${safe(product.product_name)}`,
    `Giá thuê: ${safe(product.cost)} ${safe(product.currency)}`,
    `Thời hạn thuê: ${safe(product.booking_duration)}`,
    `Phí sản xuất: ${safe(product.production_cost)}`,
    `Traffic: ${safe(product.traffic)}`,
    `Local tax: ${safe(product.local_tax)}`,
  ].join('\n');

  const specs = [
    `Tên sản phẩm: ${safe(product.product_name)}`,
    `Kích thước: ${dims}`,
    `Resolution: ${safe(product?.attributes?.pixel_width)} x ${safe(product?.attributes?.pixel_height)}`,
    `Operating hours: ${safe(product?.attributes?.opera_time_from)} - ${safe(product?.attributes?.opera_time_to)}`,
    `Lighting: ${safe(product?.attributes?.lighting)}`,
    `Material: ${safe(product?.attributes?.material)}`,
    `Mô tả: ${safe(product.description)}`,
  ].join('\n');

  const location = [
    `Tên sản phẩm: ${safe(product.product_name)}`,
    `Địa điểm hiển thị: ${safe(product.location_name)}`,
    `Số nhà: ${safe(product.street_number)}`,
    `Tên đường: ${safe(product.street_name)}`,
    `Phường/Xã: ${safe(product.ward)}`,
    `Thành phố/Tỉnh: ${safe(product.city_province)}`,
    `GPS: ${safe(product.gps_coordinates)}`,
    `Landmark: ${safe(product.landmark)}`,
  ].join('\n');

  return [
    { chunk_type: 'overview', content: overview },
    { chunk_type: 'pricing', content: pricing },
    { chunk_type: 'spec', content: specs },
    { chunk_type: 'location', content: location },
  ];
}

async function getTextEmbedding(text) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Embedding API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const embedding = data?.data?.[0]?.embedding;

  if (!Array.isArray(embedding)) {
    throw new Error('Embedding API returned invalid embedding payload');
  }

  return embedding;
}

async function indexProductsToRag(products = []) {
  if (!isRagEnabled()) {
    return { indexedChunks: 0, skipped: true, reason: 'RAG not configured' };
  }

  const validProducts = products.filter((p) => p?.id);
  if (validProducts.length === 0) {
    return { indexedChunks: 0, skipped: true, reason: 'No products to index' };
  }

  const productIds = [...new Set(validProducts.map((p) => p.id))];

  const { error: deleteError } = await supabase
    .from('rag_document_chunks')
    .delete()
    .in('product_id', productIds);

  if (deleteError) {
    throw new Error(`Failed to clear existing chunks: ${deleteError.message}`);
  }

  const rows = [];

  for (const product of validProducts) {
    const chunks = buildRagChunksFromProduct(product);

    for (const chunk of chunks) {
      const embedding = await getTextEmbedding(chunk.content.slice(0, 8000));
      rows.push({
        product_id: product.id,
        provider_id: product.provider_id || null,
        provider_name: product.provider_name || null,
        product_name: product.product_name || null,
        product_code: product.product_code || null,
        city_province: product.city_province || null,
        ward: product.ward || null,
        type: product.type || null,
        chunk_type: chunk.chunk_type,
        content: chunk.content,
        metadata: {
          currency: product.currency || null,
          booking_duration: product.booking_duration || null,
        },
        embedding,
      });
    }
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from('rag_document_chunks')
      .insert(rows);

    if (insertError) {
      throw new Error(`Failed to insert chunks: ${insertError.message}`);
    }
  }

  return { indexedChunks: rows.length, skipped: false };
}

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
 * Compress PDF by re-encoding embedded images at lower quality.
 * Uses sharp to process the raw buffer - attempts to reduce oversized PDFs.
 * Returns { compressed: true, buffer } or { compressed: false } if not possible.
 */
async function tryCompressPDF(buffer, targetSizeMB = 25) {
  // If already under target, no compression needed
  if (buffer.length <= targetSizeMB * 1024 * 1024) {
    return { compressed: false };
  }
  
  // For PDFs significantly over limit, compression won't help enough
  // (PDF internal images can't be easily recompressed without a full PDF library)
  // Return false to fall back to text extraction
  console.log(`PDF (${(buffer.length / 1024 / 1024).toFixed(1)}MB) exceeds ${targetSizeMB}MB - text fallback will be used`);
  return { compressed: false };
}

/**
 * Convert PDF pages to individual image content blocks for Claude.
 * This provides visual page-level analysis when native PDF document type is unavailable.
 * Uses sharp's PDF support (requires libvips with poppler on the system).
 */
async function pdfPagesToImages(buffer, maxPages = 20) {
  const imageBlocks = [];
  
  try {
    // Try sharp-based PDF rendering (requires poppler)
    const metadata = await sharp(buffer).metadata();
    const pageCount = metadata.pages || 1;
    const pagesToProcess = Math.min(pageCount, maxPages);
    
    console.log(`📄 Converting ${pagesToProcess}/${pageCount} PDF pages to images...`);
    
    for (let page = 0; page < pagesToProcess; page++) {
      try {
        const pageBuffer = await sharp(buffer, { page })
          .resize(1568, 1568, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toBuffer();
        
        imageBlocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: pageBuffer.toString('base64')
          }
        });
      } catch {
        // Skip unrenderable pages
        console.warn(`Could not render page ${page + 1}`);
      }
    }
    
    if (imageBlocks.length > 0) {
      console.log(`✅ Converted ${imageBlocks.length} pages to images`);
    }
  } catch (err) {
    // sharp PDF rendering not available (missing poppler) - this is expected on many systems
    console.log('ℹ️ PDF-to-image conversion not available (sharp/poppler), using text fallback');
  }
  
  return imageBlocks;
}

/**
 * Upload a file to Anthropic Files API (beta) for reuse across multiple API calls.
 * Returns file_id on success, null on failure (callers should fall back to base64).
 */
async function uploadToFilesAPI(buffer, filename, mimetype) {
  try {
    const file = new File([buffer], filename, { type: mimetype });
    const result = await anthropic.beta.files.upload({ file });
    console.log(`📤 Files API: Uploaded "${filename}" → ${result.id} (${(result.size_bytes / 1024 / 1024).toFixed(1)}MB)`);
    return result.id;
  } catch (err) {
    console.warn(`⚠️ Files API upload failed: ${err.message}`);
    return null;
  }
}

/**
 * Delete a file from Anthropic Files API. Best-effort cleanup.
 */
async function deleteFromFilesAPI(fileId) {
  try {
    await anthropic.beta.files.delete(fileId);
    console.log(`🗑️ Files API: Deleted ${fileId}`);
  } catch (err) {
    console.warn(`⚠️ Files API delete failed for ${fileId}: ${err.message}`);
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
    // Files API disabled — using base64 for all uploads
    
    // Max file size for Claude API document type (~25MB raw → ~33MB base64, under 32MB request limit with overhead)
    const MAX_PDF_SIZE = 25 * 1024 * 1024; // 25MB (increased from 15MB)
    // Files API supports up to 500MB - use it for larger files
    const MAX_FILES_API_SIZE = 500 * 1024 * 1024;

    if (mimetype === 'application/pdf') {
      // Use base64 for PDFs under the size limit, fallback strategies for larger files
      if (buffer.length <= MAX_PDF_SIZE) {
        const base64Data = buffer.toString('base64');
        content = [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Data
            }
          }
        ];
      } else if (buffer.length > MAX_PDF_SIZE) {
        // Files API failed and PDF is too large for base64 - try alternatives
        console.log(`PDF too large (${(buffer.length / 1024 / 1024).toFixed(2)}MB), trying alternatives...`);
        
        // Strategy 1: Try converting pages to individual images (visual + layout preserved)
        const pageImages = await pdfPagesToImages(buffer);
        
        if (pageImages.length > 0) {
          // Successfully converted to images - send as individual page images
          console.log(`📸 Using page-by-page image mode (${pageImages.length} pages)`);
          content = [...pageImages];
        } else {
          // Strategy 2: Fall back to text extraction with page structure
          try {
            const pdfData = await processPDF(buffer);
            console.log(`Extracted ${pdfData.text.length} chars from ${pdfData.numPages} pages`);
            
            content = [
              {
                type: 'text',
                text: `[PDF Document - ${pdfData.numPages} pages - Text extraction mode]\n\nExtracted text:\n${pdfData.text.substring(0, 50000)}`
              }
            ];
          } catch (pdfError) {
            return res.status(400).json({
              success: false,
              error: `PDF quá lớn (${(buffer.length / 1024 / 1024).toFixed(1)}MB) và không thể đọc. Vui lòng sử dụng file nhỏ hơn 25MB.`
            });
          }
        }
      }
    } else if (mimetype.startsWith('image/')) {
      // For images: use base64 directly
      const processed = await processImage(buffer, mimetype);
      content = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: processed.mimeType,
            data: processed.data
          }
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
    
    // Phase 3: Try to detect provider from filename or early text for few-shot lookup
    let providerHint = originalname.replace(/\.[^/.]+$/, '').substring(0, 50);
    
    // Fetch few-shot examples and provider template in parallel
    const [fewShotExamples, providerTemplate] = await Promise.all([
      getFewShotExamples(providerHint),
      getProviderTemplate(providerHint)
    ]);
    
    // Build enhanced system prompt + user instruction with learning data
    const { systemPrompt, userInstruction } = buildEnhancedPrompt(EXTRACTION_SYSTEM_PROMPT, fewShotExamples, providerTemplate);
    
    if (fewShotExamples.length > 0) {
      console.log(`📚 Injected ${fewShotExamples.length} few-shot examples for provider hint: "${providerHint}"`);
    }
    if (providerTemplate) {
      console.log(`📋 Using provider template: ${providerTemplate.provider_name}`);
    }
    
    // Add user instruction as the last text block in content
    content.push({
      type: 'text',
      text: userInstruction
    });
    
    // Build system message array with prompt caching
    const systemMessages = [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' }  // Cache for 5 minutes
      }
    ];
    
    // === PASS 1: Initial extraction with Tool Use + Extended Thinking ===
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`Claude API PASS 1 attempt ${attempt}/${MAX_RETRIES}...`);
        
        message = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 16000,
          system: systemMessages,
          thinking: {
            type: 'enabled',
            budget_tokens: 10000,
            display: 'omitted'
          },
          tools: [EXTRACTION_TOOL],
          tool_choice: { type: 'auto' },
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

    // Extract data from tool_use response (Phase 1: structured output)
    let extractedData;
    const toolUseBlock = message.content.find(block => block.type === 'tool_use');
    
    if (toolUseBlock && toolUseBlock.input) {
      extractedData = toolUseBlock.input;
      console.log('✅ PASS 1: Extracted via Tool Use (structured output)');
    } else {
      // Fallback to text parsing if tool_use not returned
      const responseText = message.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.status(500).json({
          success: false,
          error: 'Could not extract structured data from AI response',
          rawResponse: responseText
        });
      }
      extractedData = JSON.parse(jsonMatch[0]);
      console.log('⚠️ PASS 1: Fell back to text JSON parsing');
    }

    // === PASS 2: Validation & Self-correction (Phase 4) ===
    let pass2Message;
    try {
      console.log('🔍 PASS 2: Validation pass starting...');
      
      const validationPrompt = `
Bạn vừa trích xuất dữ liệu sản phẩm OOH từ tài liệu. Hãy KIỂM TRA LẠI kết quả và SỬA nếu cần.

**KẾT QUẢ PASS 1:**
${JSON.stringify(extractedData, null, 2)}

**CHECKLIST KIỂM TRA (sửa nếu sai):**
1. ⚠️ cost vs traffic: Có nhầm số OTC/VAC/OTS/lưu lượng vào cost không? 
   - Nếu cost chứa giá trị giống traffic (OTC/VAC/impressions) → chuyển sang traffic
   - cost phải là giá tiền thuê thực tế
2. 📐 Kích thước: width/height có đúng đơn vị MÉT không? (không phải cm hoặc mm)
3. 📍 GPS: gps_coordinates có giữ nguyên toàn bộ text từ PDF không?
4. 🏢 provider_name: Có đúng tên công ty không? (không nhầm với tên sản phẩm)
5. 📝 product_name: Có <= 40 ký tự không?
6. 🏷️ type: billboard/led/digital có phân loại đúng không?
7. 📍 Địa chỉ: street_number, street_name, ward, city_province có tách đúng không?
8. 💡 lighting: Có mô tả dạng text không? (KHÔNG dùng số 0/1)
9. 🔢 Confidence scores: Đánh giá lại confidence dựa trên chất lượng thông tin thực tế

Nếu tất cả đều đúng, trả về kết quả GIỐNG HỆT. Nếu có sai, SỬA và trả về bản đã sửa.
Thêm confidence scores nếu chưa có.`;

      // Filter thinking/redacted_thinking blocks for multi-turn continuity
      const pass1AssistantContent = message.content.filter(
        block => block.type === 'thinking' || block.type === 'redacted_thinking' || block.type === 'tool_use' || block.type === 'text'
      );

      pass2Message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        system: systemMessages,
        thinking: {
          type: 'enabled',
          budget_tokens: 8000,
          display: 'omitted'
        },
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: 'auto' },
        messages: [
          {
            role: 'user',
            content: content
          },
          {
            role: 'assistant',
            content: pass1AssistantContent
          },
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: toolUseBlock?.id || 'pass1_extraction',
                content: JSON.stringify({ status: 'received', data: extractedData })
              },
              {
                type: 'text',
                text: validationPrompt
              }
            ]
          }
        ]
      });
      
      const pass2ToolUse = pass2Message.content.find(block => block.type === 'tool_use');
      if (pass2ToolUse && pass2ToolUse.input) {
        const pass1Str = JSON.stringify(extractedData);
        const pass2Str = JSON.stringify(pass2ToolUse.input);
        
        if (pass1Str !== pass2Str) {
          console.log('🔧 PASS 2: Corrections applied');
          extractedData = pass2ToolUse.input;
          extractedData._pass2_corrected = true;
        } else {
          console.log('✅ PASS 2: No corrections needed');
          extractedData._pass2_corrected = false;
        }
      }
    } catch (pass2Error) {
      console.warn('⚠️ PASS 2 failed, using PASS 1 result:', pass2Error.message);
      // Pass 2 is optional - if it fails, we still have Pass 1 data
    }

    // === PASS 3 (optional): Citation-based source verification for PDF documents ===
    // Citations tell us which page each piece of data came from
    // Only run for PDFs sent as document type (not text fallback or images)
    let citations = null;
    const isPDFDocument = content.some(block => 
      block.type === 'document' && (block.source?.media_type === 'application/pdf' || block.source?.type === 'file')
    );
    
    if (isPDFDocument && extractedData.products?.length > 0) {
      try {
        console.log('📑 PASS 3: Citation verification starting...');
        
        // Build citation document block from the base64 PDF content
        const pdfBlock = content.find(block => block.type === 'document');
        const citationDocBlock = {
          ...pdfBlock,
          citations: { enabled: true }
        };
        
        const citationPrompt = `Hãy xác nhận từng sản phẩm sau được trích xuất từ TRANG nào trong PDF. 
Với mỗi sản phẩm, trích dẫn đoạn text gốc trong PDF chứa thông tin chính (tên, địa chỉ, giá).

Danh sách sản phẩm đã trích xuất:
${extractedData.products.map((p, i) => `${i + 1}. "${p.product_name}" - ${p.location?.address || 'N/A'} - cost: ${p.cost}`).join('\n')}

Trả lời ngắn gọn, chỉ cần nêu: Sản phẩm X → Trang Y, kèm trích dẫn ngắn.`;

        const citationMessage = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: [
                citationDocBlock,
                {
                  type: 'text',
                  text: citationPrompt
                }
              ]
            }
          ]
        });

        // Parse citation response - extract page references
        const citationBlocks = citationMessage.content.filter(block => 
          block.type === 'text' && block.citations?.length > 0
        );
        
        if (citationBlocks.length > 0) {
          citations = {
            sources: citationBlocks.flatMap(block => 
              block.citations.map(c => ({
                cited_text: c.cited_text,
                page: c.start_page_number || null,
                end_page: c.end_page_number || null,
                type: c.type
              }))
            ),
            summary: citationMessage.content
              .filter(block => block.type === 'text')
              .map(block => block.text)
              .join('')
          };
          console.log(`✅ PASS 3: Found ${citations.sources.length} citation sources`);
        }
        
        // Add citation usage to totals
        if (citationMessage.usage) {
          pass2Message = pass2Message || {};
          pass2Message.usage = pass2Message.usage || {};
          // Track citation tokens separately
          extractedData._citation_tokens = {
            input: citationMessage.usage.input_tokens || 0,
            output: citationMessage.usage.output_tokens || 0
          };
        }
      } catch (citationError) {
        console.warn('⚠️ PASS 3 (Citations) failed, skipping:', citationError.message);
        // Citations are optional - extraction data is already complete
      }
    }

    // Calculate total usage across passes (including cache stats)
    const totalUsage = {
      inputTokens: (message.usage?.input_tokens || 0) + (pass2Message?.usage?.input_tokens || 0) + (extractedData._citation_tokens?.input || 0),
      outputTokens: (message.usage?.output_tokens || 0) + (pass2Message?.usage?.output_tokens || 0) + (extractedData._citation_tokens?.output || 0),
      cacheReadTokens: (message.usage?.cache_read_input_tokens || 0) + (pass2Message?.usage?.cache_read_input_tokens || 0),
      cacheWriteTokens: (message.usage?.cache_creation_input_tokens || 0) + (pass2Message?.usage?.cache_creation_input_tokens || 0)
    };
    
    // Clean up internal fields before sending response
    delete extractedData._citation_tokens;

    if (totalUsage.cacheReadTokens > 0) {
      console.log(`💾 Cache hit: ${totalUsage.cacheReadTokens} tokens read from cache`);
    }

    res.json({
      success: true,
      data: extractedData,
      rawResponse: JSON.stringify(extractedData, null, 2),
      usage: totalUsage,
      citations: citations,
      meta: {
        fewShotCount: fewShotExamples.length,
        hasProviderTemplate: !!providerTemplate,
        pass2Corrected: extractedData._pass2_corrected || false,
        hasCitations: !!citations,
        usedFilesAPI: false
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
      model: 'claude-sonnet-4-6',
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

// =============================================
// EXPORT AND UPLOAD TO SUPABASE STORAGE
// =============================================

/**
 * Generate PPT + PDF from products, upload to Supabase Storage
 * Returns public URLs for the uploaded files
 */
app.post('/api/export-and-upload', express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { products, providerName } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Products array is required'
      });
    }

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: 'Supabase not configured - cannot upload files'
      });
    }

    const sanitizedProvider = (providerName || 'unknown')
      .replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF -]/g, '_')
      .substring(0, 50);
    const timestamp = Date.now();
    const folderPath = `exports/${sanitizedProvider}/${timestamp}`;

    console.log(`📦 Export & Upload: ${products.length} products → ${folderPath}`);

    const result = { pptxUrl: null, pdfUrl: null, slideUrl: null, errors: [] };

    // Step 1: Generate Google Slides presentation
    let presentationId = null;
    try {
      console.log('📊 Generating Google Slides presentation...');
      const slidesResult = products.length === 1
        ? await exportProductToSlides(products[0])
        : await exportMultipleProductsToSlides(products);

      presentationId = slidesResult.presentationId;
      result.slideUrl = slidesResult.slideUrl;
      console.log(`✅ Slides created: ${presentationId}`);
    } catch (slidesError) {
      console.error('❌ Slides generation failed:', slidesError.message);
      result.errors.push(`Slides: ${slidesError.message}`);
    }

    // Step 2: Download PPTX and upload to Supabase
    if (presentationId) {
      // Wait a bit for Google to finish processing images
      await new Promise(resolve => setTimeout(resolve, 3000));

      try {
        console.log('📥 Downloading PPTX...');
        const { stream: pptxStream, fileName } = await downloadPresentationAsPptx(presentationId);

        // Buffer the stream
        const chunks = [];
        for await (const chunk of pptxStream) {
          chunks.push(chunk);
        }
        const pptxBuffer = Buffer.concat(chunks);

        // Upload to Supabase
        const pptxPath = `${folderPath}/${fileName}.pptx`;
        const { error: pptxUploadError } = await supabase.storage
          .from('g2b')
          .upload(pptxPath, pptxBuffer, {
            contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            cacheControl: '3600',
            upsert: true,
          });

        if (pptxUploadError) {
          throw pptxUploadError;
        }

        const { data: pptxUrlData } = supabase.storage
          .from('g2b')
          .getPublicUrl(pptxPath);
        result.pptxUrl = pptxUrlData?.publicUrl || null;
        console.log(`✅ PPTX uploaded: ${result.pptxUrl}`);
      } catch (pptxError) {
        console.error('❌ PPTX download/upload failed:', pptxError.message);
        result.errors.push(`PPTX: ${pptxError.message}`);
      }

      // Step 3: Download PDF and upload to Supabase
      try {
        console.log('📥 Downloading PDF...');
        const { stream: pdfStream, fileName } = await downloadPresentationAsPdf(presentationId);

        const chunks = [];
        for await (const chunk of pdfStream) {
          chunks.push(chunk);
        }
        const pdfBuffer = Buffer.concat(chunks);

        const pdfPath = `${folderPath}/${fileName}.pdf`;
        const { error: pdfUploadError } = await supabase.storage
          .from('g2b')
          .upload(pdfPath, pdfBuffer, {
            contentType: 'application/pdf',
            cacheControl: '3600',
            upsert: true,
          });

        if (pdfUploadError) {
          throw pdfUploadError;
        }

        const { data: pdfUrlData } = supabase.storage
          .from('g2b')
          .getPublicUrl(pdfPath);
        result.pdfUrl = pdfUrlData?.publicUrl || null;
        console.log(`✅ PDF uploaded: ${result.pdfUrl}`);
      } catch (pdfError) {
        console.error('❌ PDF download/upload failed:', pdfError.message);
        result.errors.push(`PDF: ${pdfError.message}`);
      }
    }

    const hasAnyFile = result.pptxUrl || result.pdfUrl;

    res.json({
      success: hasAnyFile,
      data: result,
    });

  } catch (error) {
    console.error('Export & Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error during export and upload',
    });
  }
});

/**
 * Index products to RAG vector store
 */
app.post('/api/rag-index-products', express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { products } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Products array is required'
      });
    }

    const result = await indexProductsToRag(products);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('RAG index error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to index RAG chunks',
    });
  }
});

/**
 * Delete products from RAG vector store
 */
app.post('/api/rag-delete-products', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: 'Supabase not configured',
      });
    }

    const { productIds } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'productIds array is required',
      });
    }

    const { error } = await supabase
      .from('rag_document_chunks')
      .delete()
      .in('product_id', productIds);

    if (error) {
      throw new Error(error.message);
    }

    return res.json({
      success: true,
      data: { deletedProductIds: productIds.length },
    });
  } catch (error) {
    console.error('RAG delete error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete RAG chunks',
    });
  }
});

// =============================================
// FEEDBACK & LEARNING ENDPOINTS
// =============================================

/**
 * Submit extraction feedback (original vs corrected)
 */
app.post('/api/extraction-feedback', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: 'Feedback storage not configured (missing Supabase credentials)'
      });
    }

    const {
      user_id,
      file_name,
      file_type,
      file_size,
      provider_name,
      original_extraction,
      corrected_data,
      was_corrected,
      corrections_summary,
      ai_confidence,
      input_tokens,
      output_tokens,
      pass2_corrected,
      few_shot_count
    } = req.body;

    if (!original_extraction || !corrected_data) {
      return res.status(400).json({
        success: false,
        error: 'original_extraction and corrected_data are required'
      });
    }

    const { data, error } = await supabase
      .from('extraction_feedback')
      .insert({
        user_id: user_id || null,
        file_name,
        file_type,
        file_size,
        provider_name: provider_name || corrected_data.provider_name || 'Unknown',
        original_extraction,
        corrected_data,
        was_corrected: was_corrected ?? false,
        corrections_summary: corrections_summary || null,
        ai_confidence: ai_confidence || null,
        input_tokens: input_tokens || null,
        output_tokens: output_tokens || null,
        pass2_corrected: pass2_corrected || false,
        few_shot_count: few_shot_count || 0
      })
      .select()
      .single();

    if (error) {
      console.error('Feedback save error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to save feedback: ' + error.message
      });
    }

    console.log(`📝 Feedback saved: ${file_name} (corrected: ${was_corrected})`);

    res.json({
      success: true,
      data: { id: data.id }
    });
  } catch (error) {
    console.error('Feedback endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error'
    });
  }
});

/**
 * Get provider templates list
 */
app.get('/api/provider-templates', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ success: true, data: [] });
    }

    const { data, error } = await supabase
      .from('provider_templates')
      .select('*')
      .order('total_extractions', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, data: data || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update a provider template with custom hints
 */
app.put('/api/provider-templates/:id', express.json(), async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase not configured' });
    }

    const { id } = req.params;
    const { layout_hints, field_mapping, extraction_notes, example_json } = req.body;

    const { data, error } = await supabase
      .from('provider_templates')
      .update({
        layout_hints,
        field_mapping,
        extraction_notes,
        example_json,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get extraction feedback stats
 */
app.get('/api/extraction-stats', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ success: true, data: { total: 0, corrected: 0, providers: [] } });
    }

    const [totalResult, correctedResult, providersResult] = await Promise.all([
      supabase.from('extraction_feedback').select('id', { count: 'exact', head: true }),
      supabase.from('extraction_feedback').select('id', { count: 'exact', head: true }).eq('was_corrected', true),
      supabase.from('provider_templates').select('provider_name, total_extractions, correction_rate, avg_confidence').order('total_extractions', { ascending: false }).limit(20)
    ]);

    res.json({
      success: true,
      data: {
        total: totalResult.count || 0,
        corrected: correctedResult.count || 0,
        accuracy_rate: totalResult.count > 0 
          ? ((1 - (correctedResult.count / totalResult.count)) * 100).toFixed(1) + '%'
          : 'N/A',
        providers: providersResult.data || []
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Claude Proxy Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📤 Extract endpoint: POST http://localhost:${PORT}/api/extract`);
  console.log(`🔍 AI Search endpoint: POST http://localhost:${PORT}/api/ai-search`);
  console.log(`🧠 RAG index endpoint: POST http://localhost:${PORT}/api/rag-index-products`);
  console.log(`🧹 RAG delete endpoint: POST http://localhost:${PORT}/api/rag-delete-products`);
  console.log(`📊 Export Slides: POST http://localhost:${PORT}/api/export-slides`);
  console.log(`📊 Batch Export: POST http://localhost:${PORT}/api/export-slides-batch`);
  console.log(`🔧 Inspect Template: GET http://localhost:${PORT}/api/inspect-template`);
  console.log(`📝 Feedback: POST http://localhost:${PORT}/api/extraction-feedback`);
  console.log(`📈 Stats: GET http://localhost:${PORT}/api/extraction-stats`);
  console.log(`🧠 RAG status: ${isRagEnabled() ? 'enabled' : 'disabled (missing OPENAI_API_KEY or Supabase service role)'}`);
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

    let ragCandidates = null;
    let ragChunks = [];

    if (isRagEnabled()) {
      try {
        const queryEmbedding = await getTextEmbedding(query);
        const inferredType = detectProductTypeFromQuery(query);
        const inferredLocation = detectLocationKeywordFromQuery(query);

        const { data: chunkMatches, error: ragError } = await supabase.rpc('match_rag_chunks', {
          query_embedding: queryEmbedding,
          keyword_query: query,
          match_count: 30,
          min_similarity: 0.58,
          filter_city: inferredLocation ? `%${inferredLocation}%` : null,
          filter_type: inferredType,
          filter_provider: null,
        });

        if (ragError) {
          throw new Error(ragError.message);
        }

        if (Array.isArray(chunkMatches) && chunkMatches.length > 0) {
          ragChunks = chunkMatches;

          const scoreByProduct = new Map();
          for (const row of chunkMatches) {
            const current = scoreByProduct.get(row.product_id) || 0;
            scoreByProduct.set(row.product_id, Math.max(current, row.hybrid_score || row.similarity || 0));
          }

          const sortedProductIds = [...scoreByProduct.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([productId]) => productId)
            .slice(0, 15);

          ragCandidates = products.filter((p) => sortedProductIds.includes(p.id));
          ragCandidates.sort((a, b) => sortedProductIds.indexOf(a.id) - sortedProductIds.indexOf(b.id));

          console.log(`🧠 RAG retrieved ${ragChunks.length} chunks, ${ragCandidates.length} candidate products`);
        }
      } catch (ragError) {
        console.warn(`⚠️ RAG retrieval failed, fallback to classic search: ${ragError.message}`);
      }
    }

    const productsForPrompt = Array.isArray(ragCandidates) && ragCandidates.length > 0
      ? ragCandidates
      : products;

    // Format products for the prompt
    const productsListStr = productsForPrompt.map((p, i) => {
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

    const contextChunkText = ragChunks
      .slice(0, 20)
      .map((c, i) => {
        return `#${i + 1} [${c.chunk_type}] product_id=${c.product_id} similarity=${Number(c.similarity || 0).toFixed(3)}\n${c.content}`;
      })
      .join('\n\n');

    // Build prompt (RAG-first, fallback-safe)
    const searchPrompt = (ragChunks.length > 0
      ? [
          `Query người dùng:\n${query}`,
          `\nDanh sách sản phẩm ứng viên (đã retrieve):\n${productsListStr}`,
          `\nContext chunks (RAG):\n${contextChunkText}`,
          `\nHãy trả về JSON đúng schema yêu cầu.`
        ].join('\n')
      : AI_SEARCH_PROMPT
          .replace('{USER_QUERY}', query)
          .replace('{PRODUCTS_LIST}', productsListStr)
    );

    // Call Claude API
    let message;
    let lastError;
    const MAX_RETRIES = 2;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`Claude AI Search attempt ${attempt}/${MAX_RETRIES}...`);
        
        message = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          ...(ragChunks.length > 0 ? { system: RAG_SYSTEM_PROMPT } : {}),
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
      },
      meta: {
        ragUsed: ragChunks.length > 0,
        candidateCount: productsForPrompt.length,
        chunkCount: ragChunks.length,
      },
    });

  } catch (error) {
    console.error('AI Search error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error during AI search'
    });
  }
});
