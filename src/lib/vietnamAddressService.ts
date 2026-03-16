/**
 * Vietnam Provinces API Service
 * API: https://provinces.open-api.vn/
 * 
 * Provides functions to fetch provinces, districts, and wards from Vietnam
 */

import type { VietnamProvince, VietnamDistrict, VietnamWard } from '@/types/product'

const API_BASE_URL = 'https://provinces.open-api.vn/api'

// Cache for API responses to reduce network calls
const cache: {
  provinces: VietnamProvince[] | null
  districts: Map<number, VietnamDistrict[]>
  wards: Map<number, VietnamWard[]>
} = {
  provinces: null,
  districts: new Map(),
  wards: new Map(),
}

/**
 * Fetch all provinces
 */
export async function getProvinces(): Promise<VietnamProvince[]> {
  if (cache.provinces) {
    return cache.provinces
  }

  try {
    const response = await fetch(`${API_BASE_URL}/p/`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    cache.provinces = data
    return data
  } catch (error) {
    console.error('Error fetching provinces:', error)
    return []
  }
}

/**
 * Fetch a specific province by code with districts
 */
export async function getProvinceWithDistricts(provinceCode: number): Promise<VietnamProvince | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/p/${provinceCode}?depth=2`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    
    // Cache districts
    if (data.districts) {
      cache.districts.set(provinceCode, data.districts)
    }
    
    return data
  } catch (error) {
    console.error('Error fetching province:', error)
    return null
  }
}

/**
 * Fetch districts by province code
 */
export async function getDistrictsByProvince(provinceCode: number): Promise<VietnamDistrict[]> {
  // Check cache first
  if (cache.districts.has(provinceCode)) {
    return cache.districts.get(provinceCode)!
  }

  try {
    const response = await fetch(`${API_BASE_URL}/p/${provinceCode}?depth=2`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    const districts = data.districts || []
    
    // Cache the districts
    cache.districts.set(provinceCode, districts)
    
    return districts
  } catch (error) {
    console.error('Error fetching districts:', error)
    return []
  }
}

/**
 * Fetch a specific district by code with wards
 */
export async function getDistrictWithWards(districtCode: number): Promise<VietnamDistrict | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/d/${districtCode}?depth=2`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    
    // Cache wards
    if (data.wards) {
      cache.wards.set(districtCode, data.wards)
    }
    
    return data
  } catch (error) {
    console.error('Error fetching district:', error)
    return null
  }
}

/**
 * Fetch wards by district code
 */
export async function getWardsByDistrict(districtCode: number): Promise<VietnamWard[]> {
  // Check cache first
  if (cache.wards.has(districtCode)) {
    return cache.wards.get(districtCode)!
  }

  try {
    const response = await fetch(`${API_BASE_URL}/d/${districtCode}?depth=2`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    const wards = data.wards || []
    
    // Cache the wards
    cache.wards.set(districtCode, wards)
    
    return wards
  } catch (error) {
    console.error('Error fetching wards:', error)
    return []
  }
}

/**
 * Search provinces by name
 */
export async function searchProvinces(query: string): Promise<VietnamProvince[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/p/search/?q=${encodeURIComponent(query)}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Error searching provinces:', error)
    return []
  }
}

/**
 * Search districts by name
 */
export async function searchDistricts(query: string): Promise<VietnamDistrict[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/d/search/?q=${encodeURIComponent(query)}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Error searching districts:', error)
    return []
  }
}

/**
 * Search wards by name
 */
export async function searchWards(query: string): Promise<VietnamWard[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/w/search/?q=${encodeURIComponent(query)}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Error searching wards:', error)
    return []
  }
}

/**
 * Format full address from components (2 levels: ward, province)
 */
export function formatVietnamAddress(
  streetNumber?: string | null,
  streetName?: string | null,
  ward?: string | null,
  cityProvince?: string | null
): string {
  const parts: string[] = []
  
  if (streetNumber) {
    parts.push(streetNumber)
  }
  
  if (streetName) {
    if (streetNumber) {
      parts[parts.length - 1] += ' ' + streetName
    } else {
      parts.push(streetName)
    }
  }
  
  if (ward) parts.push(ward)
  if (cityProvince) parts.push(cityProvince)
  
  return parts.join(', ')
}

/**
 * Parse address string to extract components
 * This is a best-effort parser for Vietnamese addresses
 */
export function parseVietnamAddress(address: string): {
  streetNumber?: string
  streetName?: string
  ward?: string
  district?: string
  cityProvince?: string
} {
  const result: {
    streetNumber?: string
    streetName?: string
    ward?: string
    district?: string
    cityProvince?: string
  } = {}

  if (!address) return result

  // Split by comma
  const parts = address.split(',').map(p => p.trim()).filter(Boolean)
  
  if (parts.length === 0) return result

  // Common patterns for Vietnamese addresses
  const provincePatterns = [
    /^(Thành phố|TP\.?|Tỉnh)\s+(.+)$/i,
    /^(Hà Nội|HCM|HCMC|Ho Chi Minh|Hồ Chí Minh|Đà Nẵng|Da Nang|Cần Thơ|Hải Phòng)$/i,
  ]
  
  const districtPatterns = [
    /^(Quận|Huyện|Thị xã|Thành phố)\s+(.+)$/i,
    /^(Q\.|H\.)\s*(.+)$/i,
  ]
  
  const wardPatterns = [
    /^(Phường|Xã|Thị trấn)\s+(.+)$/i,
    /^(P\.|X\.)\s*(.+)$/i,
  ]
  
  // Street number pattern (at the beginning)
  const streetNumberPattern = /^(\d+[A-Za-z]?(?:\/\d+)?)\s+(.+)$/

  // Process from end to beginning (province -> district -> ward -> street)
  let remainingParts = [...parts]
  
  // Try to identify province (usually last)
  if (remainingParts.length > 0) {
    const lastPart = remainingParts[remainingParts.length - 1]
    for (const pattern of provincePatterns) {
      if (pattern.test(lastPart)) {
        result.cityProvince = lastPart
        remainingParts.pop()
        break
      }
    }
    // If no pattern matched but it looks like a major city
    if (!result.cityProvince && /^(Hà Nội|HCM|HCMC|Ho Chi Minh|Hồ Chí Minh|Đà Nẵng|Da Nang|Cần Thơ|Hải Phòng)/i.test(lastPart)) {
      result.cityProvince = lastPart
      remainingParts.pop()
    }
  }
  
  // Try to identify district
  if (remainingParts.length > 0) {
    const lastPart = remainingParts[remainingParts.length - 1]
    for (const pattern of districtPatterns) {
      if (pattern.test(lastPart)) {
        result.district = lastPart
        remainingParts.pop()
        break
      }
    }
  }
  
  // Try to identify ward
  if (remainingParts.length > 0) {
    const lastPart = remainingParts[remainingParts.length - 1]
    for (const pattern of wardPatterns) {
      if (pattern.test(lastPart)) {
        result.ward = lastPart
        remainingParts.pop()
        break
      }
    }
  }
  
  // Remaining parts are street address
  if (remainingParts.length > 0) {
    const streetAddress = remainingParts.join(', ')
    const numberMatch = streetAddress.match(streetNumberPattern)
    
    if (numberMatch) {
      result.streetNumber = numberMatch[1]
      result.streetName = numberMatch[2]
    } else {
      result.streetName = streetAddress
    }
  }
  
  return result
}

/**
 * Find province by name (fuzzy match)
 */
export async function findProvinceByName(name: string): Promise<VietnamProvince | null> {
  const provinces = await getProvinces()
  const normalizedName = name.toLowerCase().trim()
  
  // Common aliases
  const aliases: Record<string, string[]> = {
    'thanh_pho_ha_noi': ['ha noi', 'hà nội', 'hanoi'],
    'thanh_pho_ho_chi_minh': ['ho chi minh', 'hồ chí minh', 'hcm', 'hcmc', 'sài gòn', 'saigon'],
    'thanh_pho_da_nang': ['da nang', 'đà nẵng', 'danang'],
    'thanh_pho_can_tho': ['can tho', 'cần thơ'],
    'thanh_pho_hai_phong': ['hai phong', 'hải phòng'],
  }
  
  for (const province of provinces) {
    // Direct name match
    if (province.name.toLowerCase().includes(normalizedName) || 
        normalizedName.includes(province.name.toLowerCase())) {
      return province
    }
    
    // Check aliases
    const provinceAliases = aliases[province.codename]
    if (provinceAliases) {
      for (const alias of provinceAliases) {
        if (normalizedName.includes(alias) || alias.includes(normalizedName)) {
          return province
        }
      }
    }
  }
  
  return null
}

/**
 * Find district by name within a province
 */
export async function findDistrictByName(
  name: string, 
  provinceCode: number
): Promise<VietnamDistrict | null> {
  const districts = await getDistrictsByProvince(provinceCode)
  const normalizedName = name.toLowerCase().trim()
    .replace(/^(quận|huyện|thị xã|thành phố|q\.|h\.)\s*/i, '')
  
  for (const district of districts) {
    const districtName = district.name.toLowerCase()
      .replace(/^(quận|huyện|thị xã|thành phố)\s*/i, '')
    
    if (districtName.includes(normalizedName) || normalizedName.includes(districtName)) {
      return district
    }
  }
  
  return null
}

/**
 * Find ward by name within a district
 */
export async function findWardByName(
  name: string, 
  districtCode: number
): Promise<VietnamWard | null> {
  const wards = await getWardsByDistrict(districtCode)
  const normalizedName = name.toLowerCase().trim()
    .replace(/^(phường|xã|thị trấn|p\.|x\.)\s*/i, '')
  
  for (const ward of wards) {
    const wardName = ward.name.toLowerCase()
      .replace(/^(phường|xã|thị trấn)\s*/i, '')
    
    if (wardName.includes(normalizedName) || normalizedName.includes(wardName)) {
      return ward
    }
  }
  
  return null
}

/**
 * Clear the cache (useful when switching contexts)
 */
export function clearVietnamAddressCache(): void {
  cache.provinces = null
  cache.districts.clear()
  cache.wards.clear()
}
