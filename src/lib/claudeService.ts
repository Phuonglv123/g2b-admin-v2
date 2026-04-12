import type { CreateProductParams, ProductAttributes, ProductType } from '@/types/product'
import type { ProductWithRelations } from '@/types/product'
import { 
  geocodeAddress, 
  buildFullAddress as buildGeoAddress,
  formatGPSCoordinates,
  isValidVietnamCoordinates 
} from './geocodingService'

// Claude Proxy Server URL
const CLAUDE_PROXY_URL = import.meta.env.VITE_CLAUDE_PROXY_URL || 'http://localhost:3001'

// =============================================
// AI SEARCH TYPES AND FUNCTIONS
// =============================================

export interface AISearchQueryAnalysis {
  product_type: string | null
  location_keywords: string[]
  area_district: string | null
  additional_requirements: string | null
}

export interface AISearchRecommendation {
  product_id: string
  product_name: string
  product_code: string
  match_score: number
  match_reason: string
  location_match: boolean
  type_match: boolean
}

export interface AISearchResult {
  query_analysis: AISearchQueryAnalysis
  recommendations: AISearchRecommendation[]
  search_summary: string
}

export interface AISearchResponse {
  success: boolean
  data?: AISearchResult
  error?: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

/**
 * AI-powered product search using Claude
 * @param query - Natural language search query (Vietnamese)
 * @param products - List of products to search from
 */
export async function aiSearchProducts(
  query: string, 
  products: ProductWithRelations[]
): Promise<AISearchResponse> {
  try {
    if (!query.trim()) {
      return {
        success: false,
        error: 'Vui lòng nhập từ khóa tìm kiếm'
      }
    }

    if (products.length === 0) {
      return {
        success: false,
        error: 'Không có sản phẩm nào để tìm kiếm'
      }
    }

    // Prepare products data for API (only essential fields)
    const productsData = products.map(p => ({
      id: p.id,
      product_name: p.product_name,
      product_code: p.product_code,
      type: p.type,
      location_address: p.location_address,
      ward: p.ward,
      city_province: p.city_province,
      landmark: p.landmark,
      cost: p.cost,
      currency: p.currency
    }))

    const response = await fetch(`${CLAUDE_PROXY_URL}/api/ai-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        products: productsData
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: errorData.error || `Server error: ${response.status}`
      }
    }

    const result = await response.json()
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'AI search failed'
      }
    }

    return {
      success: true,
      data: result.data,
      usage: result.usage
    }
  } catch (error) {
    console.error('AI Search error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Lỗi không xác định khi tìm kiếm'
    }
  }
}

// =============================================
// PRODUCT EXTRACTION TYPES
// =============================================

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

// New interface for detected items from documents (like invoice items)
export interface DetectedItem {
  name: string
  description?: string
  value: string
}

// New interface for multi-product extraction
export interface ExtractedPDFData {
  provider_name: string
  products: ExtractedProductData[]
  detected_items?: DetectedItem[]
}

export interface ExtractionResult {
  success: boolean
  data?: ExtractedPDFData
  error?: string
  rawResponse?: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

/**
 * Extract product data from PDF/Image using Claude AI via proxy server
 */
export async function extractProductFromFile(file: File): Promise<ExtractionResult> {
  try {
    // Validate file type
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']
    
    if (!validTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Định dạng file không hỗ trợ. Vui lòng sử dụng PDF hoặc hình ảnh (PNG, JPG, WebP, GIF)'
      }
    }

    // Create FormData and send to proxy server
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${CLAUDE_PROXY_URL}/api/extract`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: errorData.error || `Server error: ${response.status}`
      }
    }

    const result = await response.json()

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Extraction failed',
        rawResponse: result.rawResponse
      }
    }

    // Normalize the extracted data
    const normalizedData = normalizeExtractedPDFData(result.data)

    return {
      success: true,
      data: normalizedData,
      rawResponse: result.rawResponse,
      usage: result.usage
    }
  } catch (error) {
    console.error('Claude extraction error:', error)
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
  const cityProvince = rawLocation?.city_province || (rawLocation as Record<string, unknown>)?.city as string || 'Ho Chi Minh'

  return {
    product_code: data.product_code || '',
    product_name: (data.product_name || 'Sản phẩm chưa đặt tên').slice(0, 40),
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
      lighting: typeof data.attributes?.lighting === 'string'
        ? data.attributes.lighting
        : (data.attributes?.lighting === 1 || data.attributes?.lighting === true) ? 'Có' : '',
      material: data.attributes?.material || '',
      illumination_time_from: normalizeTime(data.attributes?.illumination_time_from) || '',
      illumination_time_to: normalizeTime(data.attributes?.illumination_time_to) || '',
    }
  }
}

/**
 * Normalize and validate extracted PDF data (provider + multiple products)
 */
function normalizeExtractedPDFData(rawData: Record<string, unknown>): ExtractedPDFData {
  const providerName = (rawData.provider_name as string) || 'Unknown Provider'
  
  let products: ExtractedProductData[] = []
  
  if (Array.isArray(rawData.products) && rawData.products.length > 0) {
    products = rawData.products.map((p: Partial<ExtractedProductData>) => normalizeProductData(p))
  } else if (rawData.product_name) {
    products = [normalizeProductData(rawData as unknown as Partial<ExtractedProductData>)]
  }

  // Extract detected items
  const detectedItems: DetectedItem[] = Array.isArray(rawData.detected_items) 
    ? rawData.detected_items.map((item: Record<string, unknown>) => ({
        name: String(item.name || ''),
        description: item.description ? String(item.description) : undefined,
        value: String(item.value || '')
      }))
    : []
  
  return {
    provider_name: providerName,
    products: products.length > 0 ? products : [{
      ...normalizeProductData({}),
      product_name: 'Sản phẩm không xác định'
    }],
    detected_items: detectedItems
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
 * Match image to products using Claude AI via proxy server
 */
export interface ImageMatchResult {
  imageUrl: string
  pageNumber: number
  matchedProductName: string | null
  matchedProductCode: string | null
  confidence: number
}

export async function matchImageToProduct(
  imageBlob: Blob,
  pageNumber: number,
  products: ExtractedProductData[]
): Promise<ImageMatchResult> {
  const defaultResult: ImageMatchResult = {
    imageUrl: '',
    pageNumber,
    matchedProductName: null,
    matchedProductCode: null,
    confidence: 0
  }

  try {
    const formData = new FormData()
    formData.append('image', imageBlob, `page-${pageNumber}.jpg`)
    formData.append('products', JSON.stringify(products))

    const response = await fetch(`${CLAUDE_PROXY_URL}/api/match-image`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      console.warn('Image matching request failed')
      return defaultResult
    }

    const result = await response.json()
    
    return {
      imageUrl: '',
      pageNumber,
      matchedProductName: result.matched_product_name || null,
      matchedProductCode: result.matched_product_code || null,
      confidence: result.confidence || 0
    }
  } catch (error) {
    console.error('Error matching image to product:', error)
    return defaultResult
  }
}

/**
 * Match images to products by page position (no AI, based on document structure)
 */
export function matchImagesByPagePosition(
  imageUrls: string[],
  products: ExtractedProductData[],
  imagesPerProduct: number = 3
): Map<string, string[]> {
  const productImageMap = new Map<string, string[]>()
  
  products.forEach(p => {
    productImageMap.set(p.product_name, [])
  })

  console.log(`📍 Matching ${imageUrls.length} images to ${products.length} products by page position...`)

  const pagesPerProduct = 1 + imagesPerProduct

  for (let productIndex = 0; productIndex < products.length; productIndex++) {
    const product = products[productIndex]
    const productImages: string[] = []
    
    const startImageIndex = 1 + productIndex * pagesPerProduct + 1
    
    console.log(`📦 Product ${productIndex + 1}: "${product.product_name}"`)
    console.log(`   Looking for images at page indexes: ${startImageIndex} to ${startImageIndex + imagesPerProduct - 1}`)
    
    for (let i = 0; i < imagesPerProduct; i++) {
      const imageIndex = startImageIndex + i
      if (imageIndex < imageUrls.length) {
        productImages.push(imageUrls[imageIndex])
        console.log(`   ✅ Added image from page ${imageIndex + 1} (index ${imageIndex})`)
      }
    }
    
    productImageMap.set(product.product_name, productImages)
  }

  return productImageMap
}

/**
 * Convert extracted data to CreateProductParams format
 */
export function convertToProductParams(
  data: ExtractedProductData,
  userId: string,
  providerId: string,
  productCode: string
): CreateProductParams {
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

  if (gps_coordinates) {
    const [lat, lng] = gps_coordinates.split(',').map(s => parseFloat(s.trim()))
    if (!isNaN(lat) && !isNaN(lng) && isValidVietnamCoordinates(lat, lng)) {
      latitude = lat
      longitude = lng
      console.log(`✅ Using provided GPS: ${lat}, ${lng}`)
    } else {
      console.warn(`⚠️ GPS not in lat,lng format, preserving raw text: ${gps_coordinates}`)
      // Keep raw GPS text (Plus Code, address, etc.) — don't clear it
    }
  }

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
          // Only set gps_coordinates from geocoding if we don't already have raw GPS text
          if (!gps_coordinates) {
            gps_coordinates = formatGPSCoordinates(latitude, longitude)
          }
          console.log(`✅ Geocoded successfully (${geocodeResult.provider}): ${latitude}, ${longitude}`)
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
