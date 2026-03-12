import { supabase } from './supabase'
import type { 
  Product, 
  ProductWithRelations,
  CreateProductParams, 
  UpdateProductParams,
  Location,
  CreateLocationParams,
  UpdateLocationParams,
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
      query = query.or(`product_name.ilike.%${filters.search}%,product_code.ilike.%${filters.search}%`)
    }
    if (filters.type && filters.type !== 'all') {
      query = query.eq('type', filters.type)
    }
    if (filters.status !== undefined && filters.status !== 'all') {
      query = query.eq('status', filters.status)
    }
    if (filters.location_city && filters.location_city !== 'all') {
      query = query.eq('location_city', filters.location_city)
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
 * Create a new product
 */
export async function createProduct(params: CreateProductParams): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert([params])
    .select()
    .single()

  if (error) throw error
  return data as Product
}

/**
 * Update a product
 */
export async function updateProduct({ id, ...params }: UpdateProductParams): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update(params)
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
// LOCATION CRUD OPERATIONS
// =============================================

/**
 * Get all locations
 */
export async function getLocations(): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('city', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error
  return data as Location[]
}

/**
 * Get location by ID
 */
export async function getLocationById(id: string): Promise<Location> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Location
}

/**
 * Create a new location
 */
export async function createLocation(params: CreateLocationParams): Promise<Location> {
  // Insert without select first to avoid URL encoding issues
  const { data, error } = await supabase
    .from('locations')
    .insert(params)
    .select('*')
    .single()

  if (error) {
    console.error('Create location error:', error)
    throw error
  }
  return data as Location
}

/**
 * Update a location
 */
export async function updateLocation({ id, ...params }: UpdateLocationParams): Promise<Location> {
  const { data, error } = await supabase
    .from('locations')
    .update(params)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Location
}

/**
 * Delete a location
 */
export async function deleteLocation(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('locations')
    .delete()
    .eq('id', id)

  if (error) throw error
  return true
}

/**
 * Get unique cities from locations
 */
export async function getLocationCities(): Promise<string[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('city')
    .order('city', { ascending: true })

  if (error) throw error
  
  const cities = [...new Set((data || []).map((l: { city: string }) => l.city))] as string[]
  return cities
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
