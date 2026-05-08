import { supabase } from './supabase'
import type {
  Product,
  ProductWithRelations,
  CreateProductParams,
  UpdateProductParams,
  ProductStats,
  ProductFilters
} from '@/types/product'

// =============================================
// PRODUCT CRUD OPERATIONS
// =============================================

/**
 * Get all products with relations
 */
export async function getProducts(filters?: ProductFilters): Promise<ProductWithRelations[]> {
  let query = supabase
    .from('products_view')
    .select('*')
    .order('created_at', { ascending: false })

  // Apply filters
  if (filters) {
    if (filters.search) {
      query = query.or(`product_name.ilike.%${filters.search}%,product_code.ilike.%${filters.search}%,location_name.ilike.%${filters.search}%,location_address.ilike.%${filters.search}%`)
    }
    if (filters.type && filters.type !== 'all') {
      query = query.eq('type', filters.type)
    }
    if (filters.status !== undefined && filters.status !== 'all') {
      query = query.eq('status', filters.status)
    }
    // Filter by city/province (location embedded in products)
    if (filters.city_province && filters.city_province !== 'all') {
      query = query.eq('city_province', filters.city_province)
    }
    // Filter by ward
    if (filters.ward && filters.ward !== 'all') {
      query = query.eq('ward', filters.ward)
    }
    if (filters.provider_id && filters.provider_id !== 'all') {
      query = query.eq('provider_id', filters.provider_id)
    }
    if (filters.min_cost !== undefined) {
      query = query.gte('cost', filters.min_cost)
    }
    if (filters.max_cost !== undefined) {
      query = query.lte('cost', filters.max_cost)
    }
  }

  const { data, error } = await query

  if (error) throw error
  return data as ProductWithRelations[]
}

/**
export async function getProductById(id: string): Promise<ProductWithRelations> {
  const { data, error } = await supabase
    .from('products_view')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as ProductWithRelations
}

/**
 * Get raw product by ID (without relations)
 */
export async function getRawProductById(id: string): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Product
}

/**
 * Create a new product with embedded location
 */
export async function createProduct(params: CreateProductParams): Promise<Product> {
  // Build location_address from components if not provided
  let location_address = params.location_address
  if (!location_address && (params.street_number || params.street_name || params.ward || params.city_province)) {
    const parts: string[] = []
    if (params.street_number) parts.push(params.street_number)
    if (params.street_name) {
      if (parts.length > 0) {
        parts[parts.length - 1] += ' ' + params.street_name
      } else {
        parts.push(params.street_name)
      }
    }
    if (params.ward) parts.push(params.ward)
    if (params.city_province) parts.push(params.city_province)
    location_address = parts.join(', ')
  }

  // Enforce product_code format: type_timestamp
  // Example: billboard_1715067123456
  const product_code = await generateProductCode(params.type)

  const { data, error } = await supabase
    .from('products')
    .insert([{
      ...params,
      product_code,
      location_address,
    }])
    .select()
    .single()

  if (error) throw error
  return data as Product
}

/**
 * Update a product
 */
export async function updateProduct({ id, ...params }: UpdateProductParams): Promise<Product> {
  // Rebuild location_address if location components changed
  let location_address = params.location_address
  if (params.street_number !== undefined || params.street_name !== undefined || params.ward !== undefined || params.city_province !== undefined) {
    const parts: string[] = []
    if (params.street_number) parts.push(params.street_number)
    if (params.street_name) {
      if (parts.length > 0) {
        parts[parts.length - 1] += ' ' + params.street_name
      } else {
        parts.push(params.street_name)
      }
    }
    if (params.ward) parts.push(params.ward)
    if (params.city_province) parts.push(params.city_province)
    if (parts.length > 0) {
      location_address = parts.join(', ')
    }
  }

  // Build clean update payload with only valid product columns
  // Exclude product_code (UNIQUE, should not change) and undefined values
  const updatePayload: Record<string, unknown> = {}
  const allowedFields = [
    'product_name', 'type', 'areas', 'status', 'images',
    'cost', 'production_cost', 'currency', 'traffic', 'booking_duration',
    'provider_id', 'location_name', 'location_address',
    'street_number', 'street_name', 'ward', 'city_province',
    'province_code', 'ward_code', 'latitude', 'longitude',
    'gps_coordinates', 'landmark', 'local_tax',
    'attributes', 'description',
  ]

  for (const key of allowedFields) {
    const value = (params as Record<string, unknown>)[key]
    if (value !== undefined) {
      updatePayload[key] = value
    }
  }

  // Override location_address if rebuilt
  if (location_address) {
    updatePayload.location_address = location_address
  }

  const { data, error } = await supabase
    .from('products')
    .update(updatePayload)
    .eq('id', id)
    .select()

  if (error) throw error

  if (!data || data.length === 0) {
    throw new Error(
      'Không thể cập nhật sản phẩm. Có thể bạn không có quyền chỉnh sửa sản phẩm này (chỉ chủ sở hữu mới được phép cập nhật).'
    )
  }

  return data[0] as Product
}

/**
 * Delete a product
 */
export async function deleteProduct(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)

  if (error) throw error
  return true
}

/**
 * Get product statistics
 */
export async function getProductStats(): Promise<ProductStats> {
  const { data, error } = await supabase
    .from('products')
    .select('status, type, cost')

  if (error) throw error

  const products = (data || []) as Array<{ status: number; type: string; cost: number }>
  
  const stats: ProductStats = {
    total: products.length,
    active: products.filter((p) => p.status === 1).length,
    inactive: products.filter((p) => p.status === 0).length,
    maintenance: products.filter((p) => p.status === 2).length,
    totalRevenue: products.reduce((sum: number, p) => sum + (Number(p.cost) || 0), 0),
    byType: {
      billboard: products.filter((p) => p.type === 'billboard').length,
      digital: products.filter((p) => p.type === 'digital').length,
      led: products.filter((p) => p.type === 'led').length,
      transit: products.filter((p) => p.type === 'transit').length,
      poster: products.filter((p) => p.type === 'poster').length,
      banner: products.filter((p) => p.type === 'banner').length,
      other: products.filter((p) => p.type === 'other').length,
    }
  }

  return stats
}

function normalizeTypeForCode(type: string): string {
  return type
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '') || 'other'
}

/**
 * Generate unique product code
 * Format: type_timestamp
 * Examples: billboard_1715067123456, led_1715067125872
 */
export async function generateProductCode(type: string): Promise<string> {
  const normalizedType = normalizeTypeForCode(type)

  // Retry a few times in the unlikely case of same-millisecond collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = Date.now() + attempt
    const proposedCode = `${normalizedType}_${suffix}`

    const { data: existingProduct, error } = await supabase
      .from('products')
      .select('id')
      .eq('product_code', proposedCode)
      .maybeSingle()

    if (error) throw error
    if (!existingProduct) return proposedCode
  }

  // Final fallback
  return `${normalizedType}_${Date.now()}${Math.floor(Math.random() * 1000)}`
}

/**
 * Get normalized type used for product_code
 */
export function getProductCodePrefix(type: string): string {
  return normalizeTypeForCode(type)
}

// =============================================
// LOCATION FILTER HELPERS
// =============================================

/**
 * Get unique cities/provinces from products
 */
export async function getProductCities(): Promise<string[]> {
  const { data, error } = await supabase
    .from('products')
    .select('city_province')
    .not('city_province', 'is', null)
    .order('city_province', { ascending: true })

  if (error) throw error
  
  const cities = [...new Set((data || []).map((p: { city_province: string }) => p.city_province))] as string[]
  return cities
}

/**
 * Get unique wards from products (optionally filtered by city)
 */
export async function getProductWards(cityProvince?: string): Promise<string[]> {
  let query = supabase
    .from('products')
    .select('ward')
    .not('ward', 'is', null)
    .order('ward', { ascending: true })

  if (cityProvince) {
    query = query.eq('city_province', cityProvince)
  }

  const { data, error } = await query

  if (error) throw error
  
  const wards = [...new Set((data || []).map((p: { ward: string }) => p.ward))] as string[]
  return wards
}

/**
 * Search products by location text
 */
export async function searchProductsByLocation(searchText: string): Promise<ProductWithRelations[]> {
  const { data, error } = await supabase
    .from('products_view')
    .select('*')
    .or(`location_name.ilike.%${searchText}%,location_address.ilike.%${searchText}%,ward.ilike.%${searchText}%,city_province.ilike.%${searchText}%,street_name.ilike.%${searchText}%,landmark.ilike.%${searchText}%`)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as ProductWithRelations[]
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Format currency
 */
export function formatCurrency(amount: number, currency: string = 'VND'): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 0
  }).format(amount)
}

/**
 * Get status label
 */
export function getProductStatusLabel(status: number): string {
  const labels: Record<number, string> = {
    0: 'Inactive',
    1: 'Active',
    2: 'Maintenance'
  }
  return labels[status] || 'Unknown'
}

/**
 * Get type label
 */
export function getProductTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    billboard: 'Billboard',
    digital: 'Digital Screen',
    led: 'LED Screen',
    transit: 'Transit Advertising',
    poster: 'Poster',
    banner: 'Banner',
    other: 'Other'
  }
  return labels[type] || type
}

/**
 * Get default product attributes
 */
export function getDefaultAttributes() {
  return {
    width: 0,
    height: 0,
    video_duration: 0,
    pixel_width: 0,
    pixel_height: 0,
    opera_time_from: '06:00',
    opera_time_to: '22:00',
    frequency: '',
    shape: 'rectangle',
    note: '',
    add_side: 1,
    quantity_of_ad: 1,
    lighting: '',
    material: '',
    illumination_time_from: '',
    illumination_time_to: '',
  }
}

/**
 * Build full location address from components
 */
export function buildLocationAddress(
  streetNumber?: string | null,
  streetName?: string | null,
  ward?: string | null,
  cityProvince?: string | null
): string {
  const parts: string[] = []
  
  if (streetNumber) parts.push(streetNumber)
  if (streetName) {
    if (parts.length > 0) {
      parts[parts.length - 1] += ' ' + streetName
    } else {
      parts.push(streetName)
    }
  }
  if (ward) parts.push(ward)
  if (cityProvince) parts.push(cityProvince)
  
  return parts.join(', ')
}
