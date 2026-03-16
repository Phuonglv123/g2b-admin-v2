import { useState, useEffect, useCallback } from 'react'
import { MapPin, Navigation, Loader2, Search } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  getProvinces,
  getDistrictsByProvince,
  getWardsByDistrict,
  formatVietnamAddress,
} from '@/lib/vietnamAddressService'
import { geocodeAddress, formatGPSCoordinates, isValidVietnamCoordinates } from '@/lib/geocodingService'
import type { VietnamProvince, VietnamWard, VietnamAddress } from '@/types/product'

interface VietnamAddressSelectorProps {
  value?: VietnamAddress
  onChange: (address: VietnamAddress) => void
  showGPS?: boolean
  showCurrency?: boolean
  showLocalTax?: boolean
  gpsCoordinates?: string
  currency?: string
  localTax?: number
  onGPSChange?: (gps: string) => void
  onCurrencyChange?: (currency: string) => void
  onLocalTaxChange?: (tax: number) => void
  disabled?: boolean
  className?: string
}

// Flatten all wards from all districts for a province
const flattenWardsFromProvince = async (provinceCode: number): Promise<VietnamWard[]> => {
  const districts = await getDistrictsByProvince(provinceCode)
  const allWards: VietnamWard[] = []
  
  for (const district of districts) {
    const wards = await getWardsByDistrict(district.code)
    allWards.push(...wards)
  }
  
  return allWards.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
}

export const VietnamAddressSelector: React.FC<VietnamAddressSelectorProps> = ({
  value,
  onChange,
  showGPS = true,
  showCurrency = true,
  showLocalTax = true,
  gpsCoordinates = '',
  currency = 'VND',
  localTax,
  onGPSChange,
  onCurrencyChange,
  onLocalTaxChange,
  disabled = false,
  className = '',
}) => {
  // Data states
  const [provinces, setProvinces] = useState<VietnamProvince[]>([])
  const [wards, setWards] = useState<VietnamWard[]>([])
  
  // Loading states
  const [loadingProvinces, setLoadingProvinces] = useState(false)
  const [loadingWards, setLoadingWards] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [geocodeError, setGeocodeError] = useState<string | null>(null)
  
  // Local form state
  const [localAddress, setLocalAddress] = useState<VietnamAddress>(value || {})
  
  // Load provinces on mount
  useEffect(() => {
    const loadProvinces = async () => {
      setLoadingProvinces(true)
      try {
        const data = await getProvinces()
        setProvinces(data)
      } catch (error) {
        console.error('Error loading provinces:', error)
      } finally {
        setLoadingProvinces(false)
      }
    }
    loadProvinces()
  }, [])
  
  // Load all wards when province changes (flattened from all districts)
  useEffect(() => {
    if (localAddress.province_code) {
      const loadWards = async () => {
        setLoadingWards(true)
        try {
          const data = await flattenWardsFromProvince(localAddress.province_code!)
          setWards(data)
        } catch (error) {
          console.error('Error loading wards:', error)
        } finally {
          setLoadingWards(false)
        }
      }
      loadWards()
    } else {
      setWards([])
    }
  }, [localAddress.province_code])
  
  // Sync external value changes
  useEffect(() => {
    if (value) {
      setLocalAddress(value)
    }
  }, [value])
  
  // Update parent with formatted address
  const updateAddress = useCallback((updates: Partial<VietnamAddress>) => {
    const newAddress = { ...localAddress, ...updates }
    
    // Generate full address string (2 levels: ward, province)
    newAddress.full_address = formatVietnamAddress(
      newAddress.street_number,
      newAddress.street_name,
      newAddress.ward,
      newAddress.city_province
    )
    
    setLocalAddress(newAddress)
    onChange(newAddress)
  }, [localAddress, onChange])
  
  // Handle province change
  const handleProvinceChange = (provinceCode: string) => {
    const code = parseInt(provinceCode, 10)
    const province = provinces.find(p => p.code === code)
    
    updateAddress({
      province_code: code || undefined,
      city_province: province?.name || '',
      // Reset ward field
      ward_code: undefined,
      ward: '',
    })
    
    // Clear wards
    setWards([])
  }
  
  // Handle ward change
  const handleWardChange = (wardCode: string) => {
    const code = parseInt(wardCode, 10)
    const ward = wards.find(w => w.code === code)
    
    updateAddress({
      ward_code: code || undefined,
      ward: ward?.name || '',
    })
  }
  
  // Get current GPS location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser')
      return
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        const gps = `${latitude.toFixed(6)},${longitude.toFixed(6)}`
        onGPSChange?.(gps)
      },
      (error) => {
        console.error('Error getting location:', error)
        alert('Unable to get your location. Please check your browser permissions.')
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    )
  }

  // Auto-detect GPS from address using geocoding service
  const handleAutoDetectGPS = async () => {
    const fullAddress = formatVietnamAddress(
      localAddress.street_number,
      localAddress.street_name,
      localAddress.ward,
      localAddress.city_province
    )

    if (!fullAddress || fullAddress.length < 5) {
      setGeocodeError('Vui lòng nhập địa chỉ trước khi detect GPS')
      return
    }

    setIsGeocoding(true)
    setGeocodeError(null)

    try {
      console.log(`🔍 Geocoding: ${fullAddress}`)
      const result = await geocodeAddress(fullAddress)

      if (result && isValidVietnamCoordinates(result.latitude, result.longitude)) {
        const gps = formatGPSCoordinates(result.latitude, result.longitude)
        onGPSChange?.(gps)
        setGeocodeError(null)
        console.log(`✅ GPS detected (${result.provider}): ${gps}`)
      } else {
        setGeocodeError('Không thể tìm thấy tọa độ. Thử nhập địa chỉ chi tiết hơn.')
      }
    } catch (error) {
      console.error('Geocoding error:', error)
      setGeocodeError('Lỗi khi detect GPS. Vui lòng thử lại.')
    } finally {
      setIsGeocoding(false)
    }
  }
  
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary" />
        <Label className="font-medium">Vietnam Address</Label>
      </div>
      
      {/* Province - Ward Row (2 levels only) */}
      <div className="grid grid-cols-2 gap-3">
        {/* Province */}
        <div>
          <Label htmlFor="province" className="text-sm text-muted-foreground">
            Tỉnh/Thành phố *
          </Label>
          <Select
            id="province"
            value={localAddress.province_code?.toString() || ''}
            onChange={(e) => handleProvinceChange(e.target.value)}
            disabled={disabled || loadingProvinces}
            className="mt-1"
          >
            <option value="">
              {loadingProvinces ? 'Loading...' : 'Chọn Tỉnh/Thành phố'}
            </option>
            {provinces.map((province) => (
              <option key={province.code} value={province.code}>
                {province.name}
              </option>
            ))}
          </Select>
        </div>
        
        {/* Ward */}
        <div>
          <Label htmlFor="ward" className="text-sm text-muted-foreground">
            Phường/Xã *
          </Label>
          <Select
            id="ward"
            value={localAddress.ward_code?.toString() || ''}
            onChange={(e) => handleWardChange(e.target.value)}
            disabled={disabled || loadingWards || !localAddress.province_code}
            className="mt-1"
          >
            <option value="">
              {loadingWards ? 'Đang tải...' : 'Chọn Phường/Xã'}
            </option>
            {wards.map((ward) => (
              <option key={ward.code} value={ward.code}>
                {ward.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      
      {/* Street Address Row */}
      <div className="grid grid-cols-4 gap-3">
        {/* Street Number */}
        <div>
          <Label htmlFor="street_number" className="text-sm text-muted-foreground">
            Số nhà
          </Label>
          <Input
            id="street_number"
            value={localAddress.street_number || ''}
            onChange={(e) => updateAddress({ street_number: e.target.value })}
            placeholder="e.g. 123"
            disabled={disabled}
            className="mt-1"
          />
        </div>
        
        {/* Street Name */}
        <div className="col-span-3">
          <Label htmlFor="street_name" className="text-sm text-muted-foreground">
            Tên đường
          </Label>
          <Input
            id="street_name"
            value={localAddress.street_name || ''}
            onChange={(e) => updateAddress({ street_name: e.target.value })}
            placeholder="e.g. Nguyễn Văn Linh"
            disabled={disabled}
            className="mt-1"
          />
        </div>
      </div>
      
      {/* Full Address Preview */}
      <div>
        <Label className="text-sm text-muted-foreground">Địa chỉ đầy đủ</Label>
        <div className="mt-1 p-2 rounded-md bg-muted/50 text-sm min-h-[40px]">
          {localAddress.full_address || 
            formatVietnamAddress(
              localAddress.street_number,
              localAddress.street_name,
              localAddress.ward,
              localAddress.city_province
            ) || 
            <span className="text-muted-foreground italic">Địa chỉ sẽ hiển thị ở đây...</span>
          }
        </div>
      </div>
      
      {/* GPS, Currency, Local Tax Row */}
      {(showGPS || showCurrency || showLocalTax) && (
        <div className="grid grid-cols-3 gap-3">
          {/* GPS Coordinates */}
          {showGPS && (
            <div>
              <Label htmlFor="gps" className="text-sm text-muted-foreground">
                GPS Coordinates
              </Label>
              <div className="flex gap-1 mt-1">
                <Input
                  id="gps"
                  value={gpsCoordinates}
                  onChange={(e) => onGPSChange?.(e.target.value)}
                  placeholder="lat,lng"
                  disabled={disabled || isGeocoding}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAutoDetectGPS}
                  disabled={disabled || isGeocoding}
                  title="Auto-detect GPS from address"
                >
                  {isGeocoding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={getCurrentLocation}
                  disabled={disabled || isGeocoding}
                  title="Get current location"
                >
                  <Navigation className="h-4 w-4" />
                </Button>
              </div>
              {geocodeError && (
                <p className="text-xs text-red-500 mt-1">{geocodeError}</p>
              )}
            </div>
          )}
          
          {/* Currency */}
          {showCurrency && (
            <div>
              <Label htmlFor="address_currency" className="text-sm text-muted-foreground">
                Currency
              </Label>
              <Select
                id="address_currency"
                value={currency}
                onChange={(e) => onCurrencyChange?.(e.target.value)}
                disabled={disabled}
                className="mt-1"
              >
                <option value="VND">VND - Vietnamese Dong</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="JPY">JPY - Japanese Yen</option>
                <option value="KRW">KRW - Korean Won</option>
                <option value="CNY">CNY - Chinese Yuan</option>
              </Select>
            </div>
          )}
          
          {/* Local Tax */}
          {showLocalTax && (
            <div>
              <Label htmlFor="local_tax" className="text-sm text-muted-foreground">
                Local Tax (%)
              </Label>
              <Input
                id="local_tax"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={localTax ?? ''}
                onChange={(e) => onLocalTaxChange?.(parseFloat(e.target.value) || 0)}
                placeholder="e.g. 10"
                disabled={disabled}
                className="mt-1"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default VietnamAddressSelector
