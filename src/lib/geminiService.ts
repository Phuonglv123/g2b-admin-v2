import { GoogleGenerativeAI } from '@google/generative-ai'
import type { CreateProductParams, ProductAttributes, ProductType } from '@/types/product'
import { 
  geocodeAddress, 
  buildFullAddress as buildGeoAddress,
  formatGPSCoordinates,
  isValidVietnamCoordinates 
} from './geocodingService'

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
9. ĐỊA CHỈ: PHẢI tách rõ ràng thành street_number, street_name, ward, city_province (CHỈ 2 CẤP - KHÔNG CẦN district)
   - Ví dụ: "123 Nguyễn Văn Linh, Phường Tân Phú, TP.HCM" 
   - street_number: "123"
   - street_name: "Nguyễn Văn Linh"  
   - ward: "Phường Tân Phú"
   - city_province: "TP. Hồ Chí Minh"
10. GPS: Nếu tìm thấy tọa độ GPS → ghi vào gps_coordinates với format "lat,lng"
11. Trả về ĐÚNG định dạng JSON, KHÔNG có text thừa

**PHÂN TÍCH TÀI LIỆU SAU:**
`

// Extended location interface for AI extraction
export interface ExtractedLocationData {
  name: string
  address: string              // Full address for backward compatibility
  street_number?: string       // Số nhà
  street_name?: string         // Tên đường
  ward?: string                // Phường/Xã
  city_province: string        // Tỉnh/Thành phố
  landmark?: string
  gps_coordinates?: string     // Format: "lat,lng"
  currency?: string            // Default: VND
  local_tax?: number           // Tax percentage
}

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
  location: ExtractedLocationData
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

    // Initialize model - using Gemini 2.0 Flash
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

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

  // Build full address from components if not provided
  const buildFullAddress = (loc: Partial<ExtractedLocationData> | undefined): string => {
    if (loc?.address) return loc.address
    
    const parts: string[] = []
    if (loc?.street_number) parts.push(loc.street_number)
    if (loc?.street_name) {
      if (parts.length > 0) {
        parts[parts.length - 1] += ' ' + loc.street_name
      } else {
        parts.push(loc.street_name)
      }
    }
    if (loc?.ward) parts.push(loc.ward)
    if (loc?.city_province) parts.push(loc.city_province)
    
    return parts.join(', ')
  }

  // Normalize location data with new structured fields
  const rawLocation = data.location as Partial<ExtractedLocationData> | undefined
  // Handle both old 'city' field and new 'city_province' field
  const cityProvince = rawLocation?.city_province || (rawLocation as Record<string, unknown>)?.city as string || 'Ho Chi Minh'

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
      name: rawLocation?.name || data.product_name || '',
      address: buildFullAddress(rawLocation),
      street_number: rawLocation?.street_number || '',
      street_name: rawLocation?.street_name || '',
      ward: rawLocation?.ward || '',
      city_province: cityProvince,
      landmark: rawLocation?.landmark || '',
      gps_coordinates: rawLocation?.gps_coordinates || '',
      currency: rawLocation?.currency || data.currency || 'VND',
      local_tax: rawLocation?.local_tax ?? undefined,
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
 * Match images to products using Gemini AI
 * Analyzes each image and determines which product it belongs to
 */
export interface ImageMatchResult {
  imageUrl: string
  pageNumber: number
  matchedProductName: string | null
  matchedProductCode: string | null
  confidence: number
}

export interface ImageMatchingResult {
  success: boolean
  matches: ImageMatchResult[]
  error?: string
}

const IMAGE_MATCHING_PROMPT = `
Bạn là AI chuyên phân tích hình ảnh quảng cáo ngoài trời (OOH - Out of Home).

**NHIỆM VỤ:**
Đọc TEXT/CHỮ hiển thị trên hình ảnh này (thường ở phần header/title) và tìm sản phẩm PHÙ HỢP trong danh sách.

**DANH SÁCH SẢN PHẨM:**
{PRODUCT_LIST}

**CÁCH MATCH:**
1. Đọc dòng chữ TIÊU ĐỀ ở trên cùng của hình ảnh (ví dụ: "LED SCREEN 02 NGUYEN TRAI – BEN THANH, HCMC")
2. So sánh với tên sản phẩm trong danh sách
3. Match nếu chứa các từ khóa giống nhau (tên đường, quận, loại bảng...)

**VÍ DỤ:**
- Hình có title "LED SCREEN 02 NGUYEN TRAI" → match với product có tên chứa "Nguyễn Trãi" hoặc "LED"
- Hình có title "BILLBOARD Q1 HCMC" → match với product ở Quận 1, HCMC

**TRẢ VỀ JSON:**
{
  "detected_title": "Text tiêu đề đọc được từ hình",
  "matched_product_name": "Tên sản phẩm phù hợp nhất (hoặc null nếu không match)",
  "matched_product_code": "Mã sản phẩm phù hợp (hoặc null)",
  "confidence": 0.0-1.0,
  "reason": "Lý do match"
}

**LƯU Ý:**
- Nếu hình ảnh KHÔNG CÓ tiêu đề/title text → trả về null
- Nếu hình ảnh chỉ là logo công ty → trả về null
- Confidence > 0.7 = text match rõ ràng
- Confidence < 0.4 = không chắc chắn

**PHÂN TÍCH HÌNH ẢNH:**
`

/**
 * Match a single image to a list of products using Gemini AI
 * Analyzes the title/header text in the image and matches to product names
 */
export async function matchImageToProduct(
  imageUrl: string,
  pageNumber: number,
  products: ExtractedProductData[]
): Promise<ImageMatchResult> {
  const defaultResult: ImageMatchResult = {
    imageUrl,
    pageNumber,
    matchedProductName: null,
    matchedProductCode: null,
    confidence: 0
  }

  try {
    if (!import.meta.env.VITE_GEMINI_API_KEY) {
      console.warn('Gemini API key not configured')
      return defaultResult
    }

    // Create product list string for the prompt - focus on names for matching
    const productListStr = products.map((p, i) => 
      `${i + 1}. Tên: "${p.product_name}", Mã: ${p.product_code || 'N/A'}, Địa chỉ: ${p.location.address}`
    ).join('\n')

    const prompt = IMAGE_MATCHING_PROMPT.replace('{PRODUCT_LIST}', productListStr)

    // Fetch image and convert to base64
    const response = await fetch(imageUrl)
    if (!response.ok) {
      console.error(`Failed to fetch image: ${imageUrl}`)
      return defaultResult
    }
    
    const blob = await response.blob()
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        resolve(result.split(',')[1])
      }
      reader.readAsDataURL(blob)
    })

    // Initialize model - use gemini-2.0-flash
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    // Prepare image part
    const imagePart = {
      inlineData: {
        data: base64,
        mimeType: 'image/jpeg',
      },
    }

    // Generate content
    const result = await model.generateContent([prompt, imagePart])
    const text = result.response.text()

    console.log(`🔍 Image page ${pageNumber} analysis:`, text.substring(0, 200))

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.warn('No JSON found in image matching response')
      return defaultResult
    }

    const parsed = JSON.parse(jsonMatch[0])
    
    return {
      imageUrl,
      pageNumber,
      matchedProductName: parsed.matched_product_name || null,
      matchedProductCode: parsed.matched_product_code || null,
      confidence: parsed.confidence || 0
    }
  } catch (error) {
    console.error('Error matching image to product:', error)
    return defaultResult
  }
}

/**
 * Match multiple images to products using AI (legacy method)
 * Returns a map of product_name -> image_urls[]
 */
export async function matchImagesToProducts(
  imageUrls: string[],
  products: ExtractedProductData[]
): Promise<Map<string, string[]>> {
  const productImageMap = new Map<string, string[]>()
  
  // Initialize map with empty arrays for each product
  products.forEach(p => {
    productImageMap.set(p.product_name, [])
  })

  console.log(`🔍 Matching ${imageUrls.length} images to ${products.length} products using AI...`)

  // Process images in parallel (but limit concurrency)
  const BATCH_SIZE = 3
  for (let i = 0; i < imageUrls.length; i += BATCH_SIZE) {
    const batch = imageUrls.slice(i, i + BATCH_SIZE)
    const batchPromises = batch.map((url, idx) => 
      matchImageToProduct(url, i + idx + 1, products)
    )
    
    const results = await Promise.all(batchPromises)
    
    for (const result of results) {
      if (result.matchedProductName && result.confidence >= 0.4) {
        const existing = productImageMap.get(result.matchedProductName) || []
        existing.push(result.imageUrl)
        productImageMap.set(result.matchedProductName, existing)
        console.log(`✅ Image page ${result.pageNumber} matched to "${result.matchedProductName}" (confidence: ${(result.confidence * 100).toFixed(0)}%)`)
      } else {
        console.log(`⚠️ Image page ${result.pageNumber} could not be matched (confidence: ${(result.confidence * 100).toFixed(0)}%)`)
      }
    }
  }

  return productImageMap
}

/**
 * Match images to products by page position
 * 
 * PDF Structure:
 * - Page 1: Provider info (skip)
 * - Page 2: Product 1 info
 * - Page 3, 4, 5: Product 1 images (3 images)
 * - Page 6: Product 2 info
 * - Page 7, 8, 9: Product 2 images (3 images)
 * - ... and so on
 * 
 * Each product takes 4 pages: 1 info page + 3 image pages
 * Images start from page 2 (index 1 in array, since page 1 is provider)
 * 
 * @param imageUrls - Array of image URLs from converted PDF pages (page 1 = index 0)
 * @param products - Array of extracted products
 * @param imagesPerProduct - Number of images per product (default: 3)
 * @returns Map of product_name -> image_urls[]
 */
export function matchImagesByPagePosition(
  imageUrls: string[],
  products: ExtractedProductData[],
  imagesPerProduct: number = 3
): Map<string, string[]> {
  const productImageMap = new Map<string, string[]>()
  
  // Initialize map with empty arrays for each product
  products.forEach(p => {
    productImageMap.set(p.product_name, [])
  })

  console.log(`📍 Matching ${imageUrls.length} images to ${products.length} products by page position...`)
  console.log(`📍 Structure: Page 1 = Provider, then each product = 1 info page + ${imagesPerProduct} image pages`)

  // Skip page 1 (provider info) - index 0
  // For each product:
  // - Product N info is at page: 1 + (N-1) * 4 + 1 = 2, 6, 10, ... (but we don't need info pages)
  // - Product N images are at pages: 2 + (N-1) * 4 + 1 to 2 + (N-1) * 4 + 3
  //   = pages 3,4,5 for product 1 (index 2,3,4)
  //   = pages 7,8,9 for product 2 (index 6,7,8)
  //   etc.

  // Simplified: 
  // - Page index 0 = provider (skip)
  // - Pages per product = 1 (info) + imagesPerProduct (images) = 4 total
  // - Product 1 images: index 2, 3, 4
  // - Product 2 images: index 6, 7, 8
  // - Product N images: index (N-1)*4 + 2 to (N-1)*4 + 4

  const pagesPerProduct = 1 + imagesPerProduct // 1 info + 3 images = 4

  for (let productIndex = 0; productIndex < products.length; productIndex++) {
    const product = products[productIndex]
    const productImages: string[] = []
    
    // Calculate starting image index for this product
    // Skip provider page (1), then for each previous product skip their pages (4 each)
    // Then skip current product's info page (1)
    // = 1 + productIndex * 4 + 1 = 2 + productIndex * 4
    const startImageIndex = 1 + productIndex * pagesPerProduct + 1 // 1 (provider) + productIndex * 4 + 1 (info page)
    
    console.log(`📦 Product ${productIndex + 1}: "${product.product_name}"`)
    console.log(`   Looking for images at page indexes: ${startImageIndex} to ${startImageIndex + imagesPerProduct - 1}`)
    
    for (let i = 0; i < imagesPerProduct; i++) {
      const imageIndex = startImageIndex + i
      if (imageIndex < imageUrls.length) {
        productImages.push(imageUrls[imageIndex])
        console.log(`   ✅ Added image from page ${imageIndex + 1} (index ${imageIndex})`)
      } else {
        console.log(`   ⚠️ Page ${imageIndex + 1} not found (total pages: ${imageUrls.length})`)
      }
    }
    
    productImageMap.set(product.product_name, productImages)
    console.log(`   📷 Total images for this product: ${productImages.length}`)
  }

  return productImageMap
}

/**
 * Convert extracted data to CreateProductParams format
 * Location is now embedded directly in the product (no separate location_id)
 */
export function convertToProductParams(
  data: ExtractedProductData,
  userId: string,
  providerId: string,
  productCode: string
): CreateProductParams {
  // Parse GPS coordinates to lat/lng
  let latitude: number | undefined
  let longitude: number | undefined
  if (data.location.gps_coordinates) {
    const [lat, lng] = data.location.gps_coordinates.split(',').map(s => parseFloat(s.trim()))
    if (!isNaN(lat) && !isNaN(lng)) {
      latitude = lat
      longitude = lng
    }
  }

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
    // Embedded location fields
    location_name: data.location.name,
    location_address: data.location.address,
    street_number: data.location.street_number,
    street_name: data.location.street_name,
    ward: data.location.ward,
    city_province: data.location.city_province,
    landmark: data.location.landmark,
    gps_coordinates: data.location.gps_coordinates,
    latitude,
    longitude,
    local_tax: data.location.local_tax,
    attributes: data.attributes,
    description: data.description,
  }
}

/**
 * Convert extracted data to CreateProductParams with automatic GPS geocoding
 * This async version will attempt to geocode the address if GPS is not provided
 */
export async function convertToProductParamsWithGeocoding(
  data: ExtractedProductData,
  userId: string,
  providerId: string,
  productCode: string
): Promise<CreateProductParams> {
  let latitude: number | undefined
  let longitude: number | undefined
  let gps_coordinates = data.location.gps_coordinates

  // If GPS coordinates already provided, parse them
  if (gps_coordinates) {
    const [lat, lng] = gps_coordinates.split(',').map(s => parseFloat(s.trim()))
    if (!isNaN(lat) && !isNaN(lng) && isValidVietnamCoordinates(lat, lng)) {
      latitude = lat
      longitude = lng
      console.log(`✅ Using provided GPS: ${lat}, ${lng}`)
    } else {
      console.warn(`⚠️ Invalid GPS coordinates provided: ${gps_coordinates}`)
      gps_coordinates = undefined
    }
  }

  // If no valid GPS, try to geocode from address
  if (!latitude || !longitude) {
    const fullAddress = buildGeoAddress(
      data.location.street_number,
      data.location.street_name,
      data.location.ward,
      data.location.city_province
    )

    if (fullAddress && fullAddress.length > 5) {
      console.log(`🔍 Geocoding address: ${fullAddress}`)
      
      try {
        const geocodeResult = await geocodeAddress(fullAddress)
        
        if (geocodeResult && isValidVietnamCoordinates(geocodeResult.latitude, geocodeResult.longitude)) {
          latitude = geocodeResult.latitude
          longitude = geocodeResult.longitude
          gps_coordinates = formatGPSCoordinates(latitude, longitude)
          console.log(`✅ Geocoded successfully (${geocodeResult.provider}): ${latitude}, ${longitude}`)
        } else {
          console.warn(`⚠️ Geocoding failed or returned invalid coordinates`)
        }
      } catch (error) {
        console.error(`❌ Geocoding error:`, error)
      }
    }
  }

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
    // Embedded location fields with geocoded coordinates
    location_name: data.location.name,
    location_address: data.location.address || buildGeoAddress(
      data.location.street_number,
      data.location.street_name,
      data.location.ward,
      data.location.city_province
    ),
    street_number: data.location.street_number,
    street_name: data.location.street_name,
    ward: data.location.ward,
    city_province: data.location.city_province,
    landmark: data.location.landmark,
    gps_coordinates,
    latitude,
    longitude,
    local_tax: data.location.local_tax,
    attributes: data.attributes,
    description: data.description,
  }
}
