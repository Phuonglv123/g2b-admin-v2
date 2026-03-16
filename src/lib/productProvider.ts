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
 * Get product by ID with relations
 */
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

  const { data, error } = await supabase
    .from('products')
    .insert([{
      ...params,
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

  const { data, error } = await supabase
    .from('products')
    .update({
      ...params,
      ...(location_address && { location_address }),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Product
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

/**
 * Generate unique product code
 */
export async function generateProductCode(type: string): Promise<string> {
  const prefix = type.toUpperCase().substring(0, 3)
  const timestamp = Date.now().toString().slice(-6)
  const random = Math.random().toString(36).substring(2, 5).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
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
    lighting: 1
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
