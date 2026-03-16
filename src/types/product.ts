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

// Vietnam Administrative Unit Types
export interface VietnamProvince {
  code: number
  name: string
  codename: string
  division_type: string
  phone_code: number
  districts?: VietnamDistrict[]
}

export interface VietnamDistrict {
  code: number
  name: string
  codename: string
  division_type: string
  province_code: number
  wards?: VietnamWard[]
}

export interface VietnamWard {
  code: number
  name: string
  codename: string
  division_type: string
  district_code: number
}

// Structured Vietnam Address (2 levels: ward, province)
export interface VietnamAddress {
  street_number?: string        // Số nhà
  street_name?: string          // Tên đường
  ward?: string                 // Phường/Xã
  ward_code?: number            // Mã phường/xã
  city_province?: string        // Tỉnh/Thành phố
  province_code?: number        // Mã tỉnh/thành phố
  full_address?: string         // Địa chỉ đầy đủ
}

// Embedded location fields in Product
export interface ProductLocation {
  location_name: string | null
  location_address: string | null
  street_number: string | null
  street_name: string | null
  ward: string | null
  city_province: string
  province_code: number | null
  ward_code: number | null
  latitude: number | null
  longitude: number | null
  gps_coordinates: string | null
  landmark: string | null
  local_tax: number | null
}

export interface Product extends ProductLocation {
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
  location_id: string | null  // Deprecated, kept for backward compatibility
  attributes: ProductAttributes
  description: string | null
  created_at: string
  updated_at: string
}

// Extended product with provider/user relations (location is now embedded)
export interface ProductWithRelations extends Product {
  provider_name: string | null
  provider_phone: string | null
  user_name: string | null
}

// Location input for creating/updating products
export interface ProductLocationInput {
  location_name?: string
  location_address?: string
  street_number?: string
  street_name?: string
  ward?: string
  city_province: string
  province_code?: number
  ward_code?: number
  latitude?: number
  longitude?: number
  gps_coordinates?: string
  landmark?: string
  local_tax?: number
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
  // Embedded location fields
  location_name?: string
  location_address?: string
  street_number?: string
  street_name?: string
  ward?: string
  city_province: string
  province_code?: number
  ward_code?: number
  latitude?: number
  longitude?: number
  gps_coordinates?: string
  landmark?: string
  local_tax?: number
  // Product attributes
  attributes: ProductAttributes
  description?: string
}

export interface UpdateProductParams extends Partial<Omit<CreateProductParams, 'user_id'>> {
  id: string
}

// Filter & Search params
export interface ProductFilters {
  search?: string
  type?: ProductType | 'all'
  status?: ProductStatus | 'all'
  city_province?: string | 'all'  // Renamed from location_city
  ward?: string | 'all'
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

// =============================================
// DEPRECATED - Kept for backward compatibility
// =============================================

/** @deprecated Use ProductLocationInput instead */
export interface Location {
  id: string
  name: string
  address: string
  street_number: string | null
  street_name: string | null
  ward: string | null
  ward_code: number | null
  district: string | null
  district_code: number | null
  city_province: string
  province_code: number | null
  province_name: string | null
  country: string
  latitude: number | null
  longitude: number | null
  gps_coordinates: string | null
  currency: string
  local_tax: number | null
  description: string | null
  landmark: string | null
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

/** @deprecated Use ProductLocationInput instead */
export interface CreateLocationParams {
  name: string
  address: string
  street_number?: string
  street_name?: string
  ward?: string
  ward_code?: number
  district?: string
  district_code?: number
  city_province: string
  province_code?: number
  province_name?: string
  country?: string
  latitude?: number
  longitude?: number
  gps_coordinates?: string
  currency?: string
  local_tax?: number
  description?: string
  landmark?: string
  status?: 'active' | 'inactive'
}

/** @deprecated Use UpdateProductParams instead */
export interface UpdateLocationParams extends Partial<CreateLocationParams> {
  id: string
}
