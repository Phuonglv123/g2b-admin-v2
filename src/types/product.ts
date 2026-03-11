// Product types - based on MongoDB productSchema
export interface ProductAttributes {
  width: number
  height: number
  video_duration: number
  pixel_width: number
  pixel_height: number
  opera_time_from: string
  opera_time_to: string
  frequency: string
  shape: string
  note: string
  add_side: number
  quantity_of_ad?: number
  lighting?: number
}

export type ProductType = 'billboard' | 'digital' | 'led' | 'transit' | 'poster' | 'banner' | 'other'
export type ProductStatus = 0 | 1 | 2 // 0: inactive, 1: active, 2: maintenance

export interface Product {
  id: string
  user_id: string
  product_code: string
  product_name: string
  type: ProductType
  areas: string[]
  status: ProductStatus
  images: string[]
  cost: number
  production_cost: string | null
  currency: string
  traffic: string
  booking_duration: string
  provider_id: string
  location_id: string
  attributes: ProductAttributes
  description: string | null
  created_at: string
  updated_at: string
}

// Extended product with joined relations
export interface ProductWithRelations extends Product {
  location_name: string | null
  location_address: string | null
  location_city: string | null
  provider_name: string | null
  provider_phone: string | null
  user_name: string | null
}

export interface CreateProductParams {
  user_id: string
  product_code: string
  product_name: string
  type: ProductType
  areas?: string[]
  status?: ProductStatus
  images?: string[]
  cost: number
  production_cost?: string
  currency?: string
  traffic: string
  booking_duration: string
  provider_id: string
  location_id: string
  attributes: ProductAttributes
  description?: string
}

export interface UpdateProductParams extends Partial<Omit<CreateProductParams, 'user_id'>> {
  id: string
}

// Location types
export interface Location {
  id: string
  name: string
  address: string
  district: string | null
  city: string
  province: string | null
  country: string
  latitude: number | null
  longitude: number | null
  description: string | null
  landmark: string | null
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

export interface CreateLocationParams {
  name: string
  address: string
  district?: string
  city: string
  province?: string
  country?: string
  latitude?: number
  longitude?: number
  description?: string
  landmark?: string
  status?: 'active' | 'inactive'
}

export interface UpdateLocationParams extends Partial<CreateLocationParams> {
  id: string
}

// Filter & Search params
export interface ProductFilters {
  search?: string
  type?: ProductType | 'all'
  status?: ProductStatus | 'all'
  location_city?: string | 'all'
  provider_id?: string | 'all'
  min_cost?: number
  max_cost?: number
}

// Stats interface
export interface ProductStats {
  total: number
  active: number
  inactive: number
  maintenance: number
  totalRevenue: number
  byType: Record<ProductType, number>
}
