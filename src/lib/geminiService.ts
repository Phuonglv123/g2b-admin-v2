import { GoogleGenerativeAI } from '@google/generative-ai'
import type { CreateProductParams, ProductAttributes, ProductType } from '@/types/product'

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '')

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
- Địa chỉ / Vị trí đặt → location.address
- Quận/Huyện → location.district
- Tỉnh/Thành phố → location.city
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
        "address": "Địa chỉ đầy đủ",
        "district": "Quận/Huyện",
        "city": "Thành phố",
        "landmark": "Điểm mốc/Hướng nhìn nếu có"
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
9. Trả về ĐÚNG định dạng JSON, KHÔNG có text thừa

**PHÂN TÍCH TÀI LIỆU SAU:**
`

export interface ExtractedProductData {
  product_code?: string
  product_name: string
  type: ProductType
  areas: string[]
  cost: number
  currency: string
  traffic: string
  booking_duration: string
  production_cost: string
  description: string
  location: {
    name: string
    address: string
    district: string
    city: string
    landmark: string
  }
  attributes: ProductAttributes
}

// New interface for multi-product extraction
export interface ExtractedPDFData {
  provider_name: string
  products: ExtractedProductData[]
}

export interface ExtractionResult {
  success: boolean
  data?: ExtractedPDFData
  error?: string
  rawResponse?: string
}

/**
 * Convert file to base64
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      const base64 = reader.result as string
      // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
      const base64Data = base64.split(',')[1]
      resolve(base64Data)
    }
    reader.onerror = (error) => reject(error)
  })
}

/**
 * Get MIME type from file
 */
function getMimeType(file: File): string {
  const mimeTypes: Record<string, string> = {
    'pdf': 'application/pdf',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp',
    'gif': 'image/gif',
  }
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  return mimeTypes[extension] || file.type
}

/**
 * Extract product data from PDF/Image using Gemini AI
 */
export async function extractProductFromFile(file: File): Promise<ExtractionResult> {
  try {
    // Validate API key
    if (!import.meta.env.VITE_GEMINI_API_KEY) {
      return {
        success: false,
        error: 'Gemini API key chưa được cấu hình. Vui lòng thêm VITE_GEMINI_API_KEY vào file .env'
      }
    }

    // Validate file type
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']
    const mimeType = getMimeType(file)
    
    if (!validTypes.includes(mimeType)) {
      return {
        success: false,
        error: 'Định dạng file không hỗ trợ. Vui lòng sử dụng PDF hoặc hình ảnh (PNG, JPG, WebP, GIF)'
      }
    }

    // Convert file to base64
    const base64Data = await fileToBase64(file)

    // Initialize model - using Gemini 3.1 Pro Preview (mạnh nhất)
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview' })

    // Prepare the file part for Gemini
    const filePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    }

    // Generate content with the file
    const result = await model.generateContent([
      EXTRACTION_PROMPT,
      filePart,
    ])

    const response = await result.response
    const text = response.text()

    // Parse JSON from response
    // Extract JSON from the response (handle cases where there's extra text)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return {
        success: false,
        error: 'Không thể trích xuất dữ liệu JSON từ phản hồi AI',
        rawResponse: text
      }
    }

    const rawExtracted = JSON.parse(jsonMatch[0])

    // Normalize the extracted data
    const normalizedData = normalizeExtractedPDFData(rawExtracted)

    return {
      success: true,
      data: normalizedData,
      rawResponse: text
    }
  } catch (error) {
    console.error('Gemini extraction error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Lỗi không xác định khi xử lý file'
    }
  }
}

/**
 * Normalize and validate a single product data
 */
function normalizeProductData(data: Partial<ExtractedProductData>): ExtractedProductData {
  const validTypes: ProductType[] = ['billboard', 'digital', 'led', 'transit', 'poster', 'banner', 'other']
  
  // Parse cost - remove all non-numeric characters except decimal point
  let parsedCost = 0
  if (data.cost !== undefined && data.cost !== null) {
    if (typeof data.cost === 'number') {
      parsedCost = data.cost
    } else if (typeof data.cost === 'string') {
      // Remove dots (thousand separators), commas, and currency symbols
      const cleanedCost = (data.cost as string).replace(/[.,\s]/g, '').replace(/[^\d]/g, '')
      parsedCost = parseInt(cleanedCost, 10) || 0
    }
  }

  // Parse dimensions - handle different formats
  const parseNumber = (val: unknown): number => {
    if (typeof val === 'number') return val
    if (typeof val === 'string') {
      const cleaned = val.replace(/[^\d.]/g, '')
      return parseFloat(cleaned) || 0
    }
    return 0
  }

  // Normalize time format
  const normalizeTime = (time: string | undefined): string => {
    if (!time) return '06:00'
    // Handle formats like "6h", "6:00", "06:00", "6h00"
    const match = time.match(/(\d{1,2})[h:]?(\d{0,2})/)
    if (match) {
      const hours = match[1].padStart(2, '0')
      const minutes = (match[2] || '00').padStart(2, '0')
      return `${hours}:${minutes}`
    }
    return time
  }

  return {
    product_code: data.product_code || '',
    product_name: data.product_name || 'Sản phẩm chưa đặt tên',
    type: validTypes.includes(data.type as ProductType) ? (data.type as ProductType) : 'billboard',
    areas: Array.isArray(data.areas) ? data.areas : [],
    cost: parsedCost,
    currency: data.currency === 'USD' ? 'USD' : 'VND',
    traffic: data.traffic || '',
    booking_duration: data.booking_duration || '1 tháng',
    production_cost: data.production_cost || '',
    description: data.description || '',
    location: {
      name: data.location?.name || data.product_name || '',
      address: data.location?.address || '',
      district: data.location?.district || '',
      city: data.location?.city || 'Ho Chi Minh',
      landmark: data.location?.landmark || '',
    },
    attributes: {
      width: parseNumber(data.attributes?.width),
      height: parseNumber(data.attributes?.height),
      video_duration: parseNumber(data.attributes?.video_duration),
      pixel_width: parseNumber(data.attributes?.pixel_width),
      pixel_height: parseNumber(data.attributes?.pixel_height),
      opera_time_from: normalizeTime(data.attributes?.opera_time_from),
      opera_time_to: normalizeTime(data.attributes?.opera_time_to),
      frequency: data.attributes?.frequency || '',
      shape: data.attributes?.shape || 'rectangle',
      note: data.attributes?.note || '',
      add_side: parseNumber(data.attributes?.add_side) || 1,
      quantity_of_ad: parseNumber(data.attributes?.quantity_of_ad) || 1,
      lighting: data.attributes?.lighting ?? 1,
    }
  }
}

/**
 * Normalize and validate extracted PDF data (provider + multiple products)
 */
function normalizeExtractedPDFData(rawData: Record<string, unknown>): ExtractedPDFData {
  const providerName = (rawData.provider_name as string) || 'Unknown Provider'
  
  // Handle both array of products and single product (backward compatibility)
  let products: ExtractedProductData[] = []
  
  if (Array.isArray(rawData.products) && rawData.products.length > 0) {
    // New format: { provider_name, products: [...] }
    products = rawData.products.map((p: Partial<ExtractedProductData>) => normalizeProductData(p))
  } else if (rawData.product_name) {
    // Old format: single product object - convert to array
    products = [normalizeProductData(rawData as unknown as Partial<ExtractedProductData>)]
  }
  
  return {
    provider_name: providerName,
    products: products.length > 0 ? products : [{
      ...normalizeProductData({}),
      product_name: 'Sản phẩm không xác định'
    }]
  }
}

/**
 * Extract multiple products from multiple files
 */
export async function extractProductsFromFiles(files: File[]): Promise<ExtractionResult[]> {
  const results: ExtractionResult[] = []
  
  for (const file of files) {
    const result = await extractProductFromFile(file)
    results.push(result)
  }
  
  return results
}

/**
 * Convert extracted data to CreateProductParams format
 */
export function convertToProductParams(
  data: ExtractedProductData,
  userId: string,
  providerId: string,
  locationId: string,
  productCode: string
): CreateProductParams {
  return {
    user_id: userId,
    product_code: productCode,
    product_name: data.product_name,
    type: data.type,
    areas: data.areas,
    status: 1,
    images: [],
    cost: data.cost,
    production_cost: data.production_cost,
    currency: data.currency,
    traffic: data.traffic,
    booking_duration: data.booking_duration,
    provider_id: providerId,
    location_id: locationId,
    attributes: data.attributes,
    description: data.description,
  }
}
