/**
 * Geocoding Service - Convert addresses to GPS coordinates
 * Uses multiple providers: Nominatim (free), Google (requires API key)
 */

export interface GeocodingResult {
  latitude: number
  longitude: number
  formatted_address?: string
  confidence?: number
  provider: 'nominatim' | 'google' | 'goong'
}

// =============================================
// NOMINATIM (OpenStreetMap) - FREE
// =============================================

/**
 * Geocode address using Nominatim (OpenStreetMap)
 * Free, no API key required, but rate limited (1 req/sec)
 */
export async function geocodeWithNominatim(address: string): Promise<GeocodingResult | null> {
  try {
    // Add "Vietnam" to improve accuracy
    const searchQuery = address.toLowerCase().includes('vietnam') || address.toLowerCase().includes('việt nam')
      ? address
      : `${address}, Vietnam`

    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', searchQuery)
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', '1')
    url.searchParams.set('countrycodes', 'vn')
    url.searchParams.set('addressdetails', '1')

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'G2B-Admin-App/1.0 (contact@g2b.com)',
        'Accept-Language': 'vi,en',
      },
    })

    if (!response.ok) {
      console.warn('Nominatim geocoding failed:', response.status)
      return null
    }

    const data = await response.json()
    
    if (!data || data.length === 0) {
      console.warn('No geocoding results for:', address)
      return null
    }

    const result = data[0]
    return {
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      formatted_address: result.display_name,
      confidence: parseFloat(result.importance) || 0.5,
      provider: 'nominatim',
    }
  } catch (error) {
    console.error('Nominatim geocoding error:', error)
    return null
  }
}

// =============================================
// GOONG.IO - Vietnamese Maps API (có free tier)
// =============================================

const GOONG_API_KEY = import.meta.env.VITE_GOONG_API_KEY || ''

/**
 * Geocode address using Goong.io (Vietnamese maps, more accurate for VN)
 * Free tier: 25,000 requests/month
 */
export async function geocodeWithGoong(address: string): Promise<GeocodingResult | null> {
  if (!GOONG_API_KEY) {
    console.warn('Goong API key not configured')
    return null
  }

  try {
    const url = new URL('https://rsapi.goong.io/geocode')
    url.searchParams.set('address', address)
    url.searchParams.set('api_key', GOONG_API_KEY)

    const response = await fetch(url.toString())

    if (!response.ok) {
      console.warn('Goong geocoding failed:', response.status)
      return null
    }

    const data = await response.json()
    
    if (!data.results || data.results.length === 0) {
      return null
    }

    const result = data.results[0]
    return {
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      formatted_address: result.formatted_address,
      confidence: 0.9, // Goong is usually accurate for VN
      provider: 'goong',
    }
  } catch (error) {
    console.error('Goong geocoding error:', error)
    return null
  }
}

// =============================================
// GOOGLE GEOCODING API
// =============================================

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

/**
 * Geocode address using Google Maps API
 * Most accurate but requires API key and has usage costs
 */
export async function geocodeWithGoogle(address: string): Promise<GeocodingResult | null> {
  if (!GOOGLE_API_KEY) {
    console.warn('Google Maps API key not configured')
    return null
  }

  try {
    const searchQuery = address.toLowerCase().includes('vietnam') || address.toLowerCase().includes('việt nam')
      ? address
      : `${address}, Vietnam`

    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    url.searchParams.set('address', searchQuery)
    url.searchParams.set('key', GOOGLE_API_KEY)
    url.searchParams.set('language', 'vi')
    url.searchParams.set('region', 'vn')

    const response = await fetch(url.toString())

    if (!response.ok) {
      console.warn('Google geocoding failed:', response.status)
      return null
    }

    const data = await response.json()
    
    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.warn('Google geocoding no results:', data.status)
      return null
    }

    const result = data.results[0]
    return {
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      formatted_address: result.formatted_address,
      confidence: 0.95,
      provider: 'google',
    }
  } catch (error) {
    console.error('Google geocoding error:', error)
    return null
  }
}

// =============================================
// MAIN GEOCODING FUNCTION (tries multiple providers)
// =============================================

export type GeocodingProvider = 'auto' | 'nominatim' | 'goong' | 'google'

/**
 * Geocode an address to GPS coordinates
 * Tries providers in order: Goong (VN) > Google > Nominatim
 * 
 * @param address - Full address string
 * @param provider - Specific provider or 'auto' to try all
 */
export async function geocodeAddress(
  address: string,
  provider: GeocodingProvider = 'auto'
): Promise<GeocodingResult | null> {
  if (!address || address.trim().length < 5) {
    console.warn('Address too short for geocoding:', address)
    return null
  }

  // Normalize address
  const normalizedAddress = normalizeVietnameseAddress(address)

  // Specific provider
  if (provider === 'goong') {
    return geocodeWithGoong(normalizedAddress)
  }
  if (provider === 'google') {
    return geocodeWithGoogle(normalizedAddress)
  }
  if (provider === 'nominatim') {
    return geocodeWithNominatim(normalizedAddress)
  }

  // Auto mode: try providers in order of accuracy for Vietnam
  
  // 1. Try Goong first (best for Vietnam)
  if (GOONG_API_KEY) {
    const goongResult = await geocodeWithGoong(normalizedAddress)
    if (goongResult && goongResult.confidence && goongResult.confidence > 0.7) {
      return goongResult
    }
  }

  // 2. Try Google (if available)
  if (GOOGLE_API_KEY) {
    const googleResult = await geocodeWithGoogle(normalizedAddress)
    if (googleResult) {
      return googleResult
    }
  }

  // 3. Fallback to Nominatim (free)
  const nominatimResult = await geocodeWithNominatim(normalizedAddress)
  return nominatimResult
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Normalize Vietnamese address for better geocoding results
 */
export function normalizeVietnameseAddress(address: string): string {
  let normalized = address.trim()

  // Expand common abbreviations
  const abbreviations: Record<string, string> = {
    'P.': 'Phường ',
    'Q.': 'Quận ',
    'TX.': 'Thị xã ',
    'TT.': 'Thị trấn ',
    'H.': 'Huyện ',
    'TP.': 'Thành phố ',
    'TP ': 'Thành phố ',
    'Tp.': 'Thành phố ',
    'HCM': 'Hồ Chí Minh',
    'TPHCM': 'Thành phố Hồ Chí Minh',
    'TP.HCM': 'Thành phố Hồ Chí Minh',
    'Hà Nội': 'Thành phố Hà Nội',
    'HN': 'Hà Nội',
    'Đà Nẵng': 'Thành phố Đà Nẵng',
    'ĐN': 'Đà Nẵng',
  }

  for (const [abbr, full] of Object.entries(abbreviations)) {
    normalized = normalized.replace(new RegExp(abbr.replace('.', '\\.'), 'gi'), full)
  }

  return normalized
}

/**
 * Build full address from components
 */
export function buildFullAddress(
  streetNumber?: string,
  streetName?: string,
  ward?: string,
  cityProvince?: string
): string {
  const parts: string[] = []

  if (streetNumber && streetName) {
    parts.push(`${streetNumber} ${streetName}`)
  } else if (streetName) {
    parts.push(streetName)
  } else if (streetNumber) {
    parts.push(streetNumber)
  }

  if (ward) parts.push(ward)
  if (cityProvince) parts.push(cityProvince)

  return parts.join(', ')
}

/**
 * Format GPS coordinates as string
 */
export function formatGPSCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(8)},${lng.toFixed(8)}`
}

/**
 * Parse GPS coordinates string to lat/lng
 */
export function parseGPSCoordinates(gps: string): { latitude: number; longitude: number } | null {
  if (!gps) return null
  
  const parts = gps.split(',').map(s => parseFloat(s.trim()))
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
    return null
  }

  return {
    latitude: parts[0],
    longitude: parts[1],
  }
}

/**
 * Validate if coordinates are within Vietnam bounds
 */
export function isValidVietnamCoordinates(lat: number, lng: number): boolean {
  // Vietnam bounds approximately
  const bounds = {
    minLat: 8.0,   // Southernmost point (Ca Mau)
    maxLat: 23.5,  // Northernmost point (Ha Giang)
    minLng: 102.0, // Westernmost point
    maxLng: 110.0, // Easternmost point
  }

  return (
    lat >= bounds.minLat &&
    lat <= bounds.maxLat &&
    lng >= bounds.minLng &&
    lng <= bounds.maxLng
  )
}
