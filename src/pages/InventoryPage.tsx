import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  MapPin,
  Monitor,
  Tv,
  Bus,
  Image as ImageIcon,
  Loader2,
  Package,
  Eye,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Building2,
  DollarSign,
  Maximize2,
  Sparkles,
  Calendar,
  Brain,
  X,
  Star,
  FileDown,
  ExternalLink,
  FileSpreadsheet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductStats,
  getProductCities,
  generateProductCode,
  formatCurrency,
  getProductStatusLabel,
  getProductTypeLabel,
  getDefaultAttributes,
  buildLocationAddress,
} from '@/lib/productProvider'
import { getProviders, findOrCreateProvider } from '@/lib/customerProvider'
import { useAuth } from '@/contexts/AuthContext'
import { ModernPDFUploader, ImageEditor } from '@/components/inventory'
import { VietnamAddressSelector } from '@/components/location'
import { convertAndUploadPdfImages } from '@/lib/convertApiService'
import { supabase } from '@/lib/supabase'
import { matchImagesByPagePosition, aiSearchProducts } from '@/lib/claudeService'
import { exportProductToSlides, type SlideExportResult } from '@/lib/slidesExportService'
import { exportProductsToExcel } from '@/lib/excelExportService'
import type { ExtractedPDFData, ExtractedProductData, AISearchRecommendation } from '@/lib/claudeService'
import type {
  ProductWithRelations,
  CreateProductParams,
  ProductType,
  ProductStatus,
  ProductStats,
  ProductAttributes,
  VietnamAddress,
} from '@/types/product'
import type { Provider } from '@/types/customer'

// Type icons mapping
const typeIcons: Record<ProductType, typeof Monitor> = {
  billboard: Tv,
  digital: Monitor,
  led: Monitor,
  transit: Bus,
  poster: ImageIcon,
  banner: ImageIcon,
  other: Package,
}

// Status badge styles
const statusStyles: Record<ProductStatus, string> = {
  0: 'bg-red-500/20 text-red-400',
  1: 'bg-green-500/20 text-green-400',
  2: 'bg-yellow-500/20 text-yellow-400',
}

const InventoryPage = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [products, setProducts] = useState<ProductWithRelations[]>([])
  const [cities, setCities] = useState<string[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [stats, setStats] = useState<ProductStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterCity, setFilterCity] = useState<string>('all')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [isAIUploadOpen, setIsAIUploadOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductWithRelations | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // AI Import progress state
  const [importProgress, setImportProgress] = useState<{
    isImporting: boolean
    step: string
    current: number
    total: number
    productName?: string
  }>({ isImporting: false, step: '', current: 0, total: 0 })

  // AI Search states
  const [isAISearchMode, setIsAISearchMode] = useState(false)
  const [aiSearchQuery, setAiSearchQuery] = useState('')
  const [isAISearching, setIsAISearching] = useState(false)
  const [aiSearchResults, setAiSearchResults] = useState<AISearchRecommendation[]>([])
  const [aiSearchSummary, setAiSearchSummary] = useState('')
  const [aiSearchError, setAiSearchError] = useState<string | null>(null)

  // Export states
  const [isExporting, setIsExporting] = useState(false)
  const [exportResult, setExportResult] = useState<SlideExportResult | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  // Export to Google Slides handler
  const handleExportToSlides = async (product: ProductWithRelations) => {
    setIsExporting(true)
    setExportError(null)
    setExportResult(null)
    try {
      const result = await exportProductToSlides(product)
      setExportResult(result)
      // Open in new tab
      window.open(result.slideUrl, '_blank')
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  // Location form state (embedded in product)
  const [locationData, setLocationData] = useState<VietnamAddress>({})
  const [gpsCoordinates, setGpsCoordinates] = useState('')
  const [localTax, setLocalTax] = useState<number | undefined>(undefined)
  const [landmark, setLandmark] = useState('')

  // Form state
  const [formData, setFormData] = useState<Partial<CreateProductParams>>({
    product_code: '',
    product_name: '',
    type: 'billboard',
    areas: [],
    status: 1,
    images: [],
    cost: 0,
    production_cost: '',
    currency: 'VND',
    traffic: '',
    booking_duration: '',
    provider_id: '',
    city_province: 'Ho Chi Minh',
    attributes: getDefaultAttributes(),
    description: '',
  })

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true)
      const [productsData, citiesData, providersData, statsData] = await Promise.all([
        getProducts(),
        getProductCities(),
        getProviders(),
        getProductStats(),
      ])
      setProducts(productsData)
      setCities(citiesData)
      setProviders(providersData)
      setStats(statsData)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.product_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.location_name && product.location_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (product.location_address && product.location_address.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesType = filterType === 'all' || product.type === filterType
      const matchesStatus = filterStatus === 'all' || product.status === Number(filterStatus)
      const matchesCity = filterCity === 'all' || product.city_province === filterCity

      return matchesSearch && matchesType && matchesStatus && matchesCity
    })
  }, [products, searchTerm, filterType, filterStatus, filterCity])

  // Paginated products
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredProducts, currentPage])

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)

  // Reset form
  const resetForm = async () => {
    const code = await generateProductCode('BIL')
    setFormData({
      product_code: code,
      product_name: '',
      type: 'billboard',
      areas: [],
      status: 1,
      images: [],
      cost: 0,
      production_cost: '',
      currency: 'VND',
      traffic: '',
      booking_duration: '',
      provider_id: '',
      city_province: 'Ho Chi Minh',
      attributes: getDefaultAttributes(),
      description: '',
    })
    // Reset location fields
    setLocationData({})
    setGpsCoordinates('')
    setLocalTax(undefined)
    setLandmark('')
    setSelectedProduct(null)
  }

  // Open create dialog
  const openCreateDialog = async () => {
    await resetForm()
    setIsCreateOpen(true)
  }

  // Open edit dialog
  const openEditDialog = (product: ProductWithRelations) => {
    setSelectedProduct(product)
    setFormData({
      product_code: product.product_code,
      product_name: product.product_name,
      type: product.type,
      areas: product.areas,
      status: product.status,
      images: product.images,
      cost: product.cost,
      production_cost: product.production_cost || '',
      currency: product.currency,
      traffic: product.traffic,
      booking_duration: product.booking_duration,
      provider_id: product.provider_id,
      // Embedded location fields
      location_name: product.location_name || '',
      location_address: product.location_address || '',
      street_number: product.street_number || '',
      street_name: product.street_name || '',
      ward: product.ward || '',
      city_province: product.city_province || 'Ho Chi Minh',
      province_code: product.province_code || undefined,
      ward_code: product.ward_code || undefined,
      attributes: product.attributes,
      description: product.description || '',
    })
    // Set location state
    setLocationData({
      street_number: product.street_number || undefined,
      street_name: product.street_name || undefined,
      ward: product.ward || undefined,
      ward_code: product.ward_code || undefined,
      city_province: product.city_province || undefined,
      province_code: product.province_code || undefined,
    })
    setGpsCoordinates(product.gps_coordinates || '')
    setLocalTax(product.local_tax || undefined)
    setLandmark(product.landmark || '')
    setIsEditOpen(true)
  }

  // Handle create
  const handleCreate = async () => {
    if (!user) return
    try {
      setIsSubmitting(true)
      // Build location address from form
      const locationAddress = buildLocationAddress(
        locationData.street_number,
        locationData.street_name,
        locationData.ward,
        locationData.city_province
      )
      
      // Parse GPS coordinates
      let latitude: number | undefined
      let longitude: number | undefined
      if (gpsCoordinates) {
        const [lat, lng] = gpsCoordinates.split(',').map(s => parseFloat(s.trim()))
        if (!isNaN(lat) && !isNaN(lng)) {
          latitude = lat
          longitude = lng
        }
      }

      await createProduct({
        ...formData,
        user_id: user.id,
        location_name: formData.product_name, // Use product name as location name
        location_address: locationAddress,
        street_number: locationData.street_number,
        street_name: locationData.street_name,
        ward: locationData.ward,
        ward_code: locationData.ward_code,
        city_province: locationData.city_province || 'Ho Chi Minh',
        province_code: locationData.province_code,
        latitude,
        longitude,
        gps_coordinates: gpsCoordinates || undefined,
        landmark: landmark || undefined,
        local_tax: localTax,
      } as CreateProductParams)
      await fetchData()
      setIsCreateOpen(false)
      await resetForm()
    } catch (error) {
      console.error('Error creating product:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle update
  const handleUpdate = async () => {
    if (!selectedProduct) return
    try {
      setIsSubmitting(true)
      // Build location address from form
      const locationAddress = buildLocationAddress(
        locationData.street_number,
        locationData.street_name,
        locationData.ward,
        locationData.city_province
      )
      
      // Parse GPS coordinates
      let latitude: number | undefined
      let longitude: number | undefined
      if (gpsCoordinates) {
        const [lat, lng] = gpsCoordinates.split(',').map(s => parseFloat(s.trim()))
        if (!isNaN(lat) && !isNaN(lng)) {
          latitude = lat
          longitude = lng
        }
      }

      await updateProduct({
        id: selectedProduct.id,
        ...formData,
        location_address: locationAddress,
        street_number: locationData.street_number,
        street_name: locationData.street_name,
        ward: locationData.ward,
        ward_code: locationData.ward_code,
        city_province: locationData.city_province,
        province_code: locationData.province_code,
        latitude,
        longitude,
        gps_coordinates: gpsCoordinates || undefined,
        landmark: landmark || undefined,
        local_tax: localTax,
      })
      await fetchData()
      setIsEditOpen(false)
      await resetForm()
    } catch (error) {
      console.error('Error updating product:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (!selectedProduct) return
    try {
      setIsSubmitting(true)
      await deleteProduct(selectedProduct.id)
      await fetchData()
      setIsDeleteOpen(false)
      setSelectedProduct(null)
    } catch (error) {
      console.error('Error deleting product:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Update attributes
  const updateAttributes = (key: keyof ProductAttributes, value: string | number) => {
    setFormData({
      ...formData,
      attributes: {
        ...formData.attributes!,
        [key]: value,
      },
    })
  }

  // Generate new code when type changes
  const handleTypeChange = async (type: ProductType) => {
    const code = await generateProductCode(type)
    setFormData({ ...formData, type, product_code: code })
  }

  // Handle AI extracted data (supports multiple products from single PDF)
  const handleAIExtracted = async (data: ExtractedPDFData, file: File) => {
    if (!user) return

    try {
      setIsSubmitting(true)
      setAiError(null)
      setImportProgress({ isImporting: true, step: 'Initializing...', current: 0, total: data.products.length })

      console.log('🚀 Starting AI extraction process...')
      console.log('📄 File:', file.name, file.type, `(${(file.size / 1024).toFixed(1)} KB)`)
      console.log('📦 Provider:', data.provider_name)
      console.log('📦 Products found:', data.products.length)

      // 1. Find or create provider from the PDF
      setImportProgress(p => ({ ...p, step: 'Setting up provider...' }))
      const provider = await findOrCreateProvider(data.provider_name, user.id)
      console.log('✅ Provider ready:', provider.name, provider.id)
      
      // Refresh providers list
      const updatedProviders = await getProviders()
      setProviders(updatedProviders)

      // 2. Extract images from PDF using ConvertAPI
      setImportProgress(p => ({ ...p, step: 'Extracting images from PDF...' }))
      let imageUrls: string[] = []
      if (file.type === 'application/pdf') {
        try {
          console.log('🖼️ Converting PDF to images...')
          // Use first product code for folder naming
          const firstProductCode = data.products[0]?.product_code || await generateProductCode(data.products[0]?.type || 'billboard')
          const uploadResult = await convertAndUploadPdfImages(file, firstProductCode, 1) // Start from page 1 to get all images
          imageUrls = uploadResult.imageUrls
          console.log(`✅ Converted and uploaded ${imageUrls.length} images`)
        } catch (imgError) {
          console.error('❌ Error converting PDF images:', imgError)
          setAiError(`Note: Could not extract images from PDF. ${imgError instanceof Error ? imgError.message : ''}`)
        }
      } else if (file.type.startsWith('image/')) {
        // If it's an image file, upload it directly
        console.log('🖼️ Uploading image file directly...')
        try {
          const firstProductCode = data.products[0]?.product_code || await generateProductCode(data.products[0]?.type || 'billboard')
          const folderName = `products/${firstProductCode.replace(/[^a-zA-Z0-9-_]/g, '_')}`
          const timestamp = Date.now()
          const fileName = `${folderName}/${timestamp}_original.${file.name.split('.').pop()}`
          
          const { error } = await supabase.storage
            .from('g2b')
            .upload(fileName, file, {
              contentType: file.type,
              cacheControl: '3600',
              upsert: true,
            })
          
          if (!error) {
            const { data: urlData } = supabase.storage
              .from('g2b')
              .getPublicUrl(fileName)
            
            if (urlData?.publicUrl) {
              imageUrls = [urlData.publicUrl]
              console.log('✅ Image uploaded:', urlData.publicUrl)
            }
          } else {
            console.error('❌ Failed to upload image:', error)
          }
        } catch (imgError) {
          console.error('❌ Error uploading image:', imgError)
        }
      }

      // 3. Match images to products by page position
      // PDF Structure: Page 1 = Provider, then each product = 1 info page + 3 image pages
      let productImageMap: Map<string, string[]> = new Map()
      
      if (imageUrls.length > 0 && data.products.length >= 1) {
        // Use page position-based matching (not AI)
        // Page 1 = Provider info (index 0)
        // Page 2 = Product 1 info (index 1)
        // Page 3, 4, 5 = Product 1 images (index 2, 3, 4)
        // Page 6 = Product 2 info (index 5)
        // Page 7, 8, 9 = Product 2 images (index 6, 7, 8)
        // etc.
        console.log('📍 Matching images by page position...')
        productImageMap = matchImagesByPagePosition(imageUrls, data.products, 3)
        console.log('✅ Image matching by position complete')
      }

      // 4. Process each product with matched images
      console.log(`📝 Processing ${data.products.length} products...`)
      for (let i = 0; i < data.products.length; i++) {
        const productData = data.products[i]
        const productImages = productImageMap.get(productData.product_name) || []
        setImportProgress({
          isImporting: true,
          step: 'Saving products to database...',
          current: i + 1,
          total: data.products.length,
          productName: productData.product_name
        })
        console.log(`📝 Processing product ${i + 1}/${data.products.length}: ${productData.product_name} (${productImages.length} images)`)
        await processExtractedProduct(productData, provider.id, productImages)
      }

      // 5. Refresh products list
      await fetchData()

      // 6. Close dialog and show success
      setIsAIUploadOpen(false)
      
      // Show result message
      const productCount = data.products.length
      const totalImages = Array.from(productImageMap.values()).reduce((sum, imgs) => sum + imgs.length, 0)
      const message = `✅ Imported ${productCount} products from provider "${data.provider_name}" with ${totalImages} images matched`
      console.log(message)
      // Clear any warning error after success
      if (imageUrls.length > 0) {
        setAiError(null)
      }
      
    } catch (error) {
      console.error('❌ Error processing AI extraction:', error)
      setAiError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setIsSubmitting(false)
      setImportProgress({ isImporting: false, step: '', current: 0, total: 0 })
    }
  }

  // Process a single extracted product (location embedded directly)
  const processExtractedProduct = async (
    data: ExtractedProductData, 
    providerId: string, 
    images: string[] = []
  ) => {
    if (!user) return

    // Use product_code from AI if available, otherwise generate new one
    const code = data.product_code || await generateProductCode(data.type)
    
    // Build location address from components
    const locationAddress = buildLocationAddress(
      data.location.street_number,
      data.location.street_name,
      data.location.ward,
      data.location.city_province
    )

    // Parse GPS coordinates if available
    let latitude: number | undefined
    let longitude: number | undefined
    if (data.location.gps_coordinates) {
      const [lat, lng] = data.location.gps_coordinates.split(',').map(s => parseFloat(s.trim()))
      if (!isNaN(lat) && !isNaN(lng)) {
        latitude = lat
        longitude = lng
      }
    }

    // Build description from extracted data if not provided
    let description = data.description || ''
    if (!description && data.location.landmark) {
      description = `View: ${data.location.landmark}`
    }

    // Create product with embedded location
    await createProduct({
      user_id: user.id,
      product_code: code,
      product_name: data.product_name,
      type: data.type,
      areas: data.areas,
      status: 1,
      images: images,
      cost: data.cost,
      production_cost: data.production_cost,
      currency: data.currency,
      traffic: data.traffic,
      booking_duration: data.booking_duration,
      provider_id: providerId,
      // Embedded location fields
      location_name: data.location.name || data.product_name,
      location_address: locationAddress || data.location.address,
      street_number: data.location.street_number,
      street_name: data.location.street_name,
      ward: data.location.ward,
      city_province: data.location.city_province || 'Ho Chi Minh',
      latitude,
      longitude,
      gps_coordinates: data.location.gps_coordinates,
      landmark: data.location.landmark,
      local_tax: data.location.local_tax,
      attributes: data.attributes,
      description: description,
    })
  }

  // Handle AI extraction error
  const handleAIError = (error: string) => {
    setAiError(error)
  }

  // Handle AI Search
  const handleAISearch = async () => {
    if (!aiSearchQuery.trim()) {
      setAiSearchError('Vui lòng nhập mô tả tìm kiếm')
      return
    }

    try {
      setIsAISearching(true)
      setAiSearchError(null)
      setAiSearchResults([])
      setAiSearchSummary('')

      console.log('🔍 Starting AI search:', aiSearchQuery)
      
      const result = await aiSearchProducts(aiSearchQuery, products)
      
      if (!result.success) {
        setAiSearchError(result.error || 'Không thể tìm kiếm')
        return
      }

      if (result.data) {
        setAiSearchResults(result.data.recommendations || [])
        setAiSearchSummary(result.data.search_summary || '')
        setIsAISearchMode(true)
        console.log('✅ AI Search completed:', result.data.recommendations?.length, 'results')
      }
    } catch (error) {
      console.error('AI Search error:', error)
      setAiSearchError(error instanceof Error ? error.message : 'Lỗi không xác định')
    } finally {
      setIsAISearching(false)
    }
  }

  // Clear AI Search
  const clearAISearch = () => {
    setIsAISearchMode(false)
    setAiSearchQuery('')
    setAiSearchResults([])
    setAiSearchSummary('')
    setAiSearchError(null)
  }

  // Get AI filtered products (products matching AI recommendations)
  const aiFilteredProducts = useMemo(() => {
    if (!isAISearchMode || aiSearchResults.length === 0) {
      return null
    }
    
    // Get product IDs from AI recommendations and their order
    const recommendedIds = new Map(aiSearchResults.map((r, idx) => [r.product_id, idx]))
    
    // Filter and sort products based on AI recommendations
    return products
      .filter(p => recommendedIds.has(p.id))
      .sort((a, b) => (recommendedIds.get(a.id) ?? 0) - (recommendedIds.get(b.id) ?? 0))
  }, [isAISearchMode, aiSearchResults, products])

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Product Management</h1>
          <p className="text-muted-foreground">Manage all advertising locations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportProductsToExcel(filteredProducts)}>
            <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
            Export Excel
          </Button>
          <Button variant="outline" onClick={() => navigate('/import')}>
            <Sparkles className="mr-2 h-4 w-4" />
            Import with AI
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Products</p>
              <p className="text-2xl font-bold">{stats?.total || 0}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-500/10 p-2">
              <Package className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold">{stats?.active || 0}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-yellow-500/10 p-2">
              <Package className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Maintenance</p>
              <p className="text-2xl font-bold">{stats?.maintenance || 0}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-500/10 p-2">
              <Package className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Inactive</p>
              <p className="text-2xl font-bold">{stats?.inactive || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        {/* AI Search */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="h-5 w-5 text-primary" />
            <span className="font-medium text-primary">Tìm kiếm thông minh bằng AI</span>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="VD: Tìm bảng LED khu vực vòng xoay Lăng Cha Cả, Phú Nhuận..."
                value={aiSearchQuery}
                onChange={(e) => setAiSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAISearch()}
                className="pr-10"
                disabled={isAISearching}
              />
              {aiSearchQuery && !isAISearching && (
                <button
                  onClick={() => setAiSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button 
              onClick={handleAISearch} 
              disabled={isAISearching || !aiSearchQuery.trim()}
              className="min-w-[120px]"
            >
              {isAISearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang tìm...
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-4 w-4" />
                  Tìm với AI
                </>
              )}
            </Button>
            {isAISearchMode && (
              <Button variant="outline" onClick={clearAISearch}>
                <X className="mr-2 h-4 w-4" />
                Xóa bộ lọc AI
              </Button>
            )}
          </div>
          {aiSearchError && (
            <p className="mt-2 text-sm text-red-500">{aiSearchError}</p>
          )}
          {isAISearchMode && aiSearchSummary && (
            <div className="mt-3 p-3 rounded-lg bg-background border border-border">
              <p className="text-sm">{aiSearchSummary}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Tìm thấy {aiSearchResults.length} sản phẩm phù hợp
              </p>
            </div>
          )}
        </div>

        {/* Regular Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, product code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              disabled={isAISearchMode}
            />
          </div>
          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-[150px]"
            disabled={isAISearchMode}
          >
            <option value="all">All Types</option>
            <option value="billboard">Billboard</option>
            <option value="digital">Digital Screen</option>
            <option value="led">LED</option>
            <option value="transit">Transit</option>
            <option value="poster">Poster</option>
            <option value="banner">Banner</option>
            <option value="other">Other</option>
          </Select>
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-[150px]"
            disabled={isAISearchMode}
          >
            <option value="all">All Status</option>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
            <option value="2">Maintenance</option>
          </Select>
          <Select
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            className="w-[150px]"
            disabled={isAISearchMode}
          >
            <option value="all">All Cities</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Products Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* AI Search Mode Header */}
        {isAISearchMode && (
          <div className="px-4 py-2 bg-primary/10 border-b border-primary/30 flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <span className="text-sm text-primary font-medium">
              Kết quả tìm kiếm AI - Đã sắp xếp theo độ phù hợp
            </span>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                {isAISearchMode && (
                  <th className="px-4 py-3 text-left text-sm font-medium w-16">Match</th>
                )}
                <th className="px-4 py-3 text-left text-sm font-medium">Product</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Code</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Location</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Size</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Price</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Provider</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Created</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(isAISearchMode && aiFilteredProducts ? aiFilteredProducts : paginatedProducts).map((product) => {
                const TypeIcon = typeIcons[product.type] || Package
                const hasImages = product.images && product.images.length > 0
                // Get AI match info if in AI mode
                const aiMatch = isAISearchMode 
                  ? aiSearchResults.find(r => r.product_id === product.id) 
                  : null
                return (
                  <tr key={product.id} className={`hover:bg-muted/30 transition-colors ${aiMatch && aiMatch.match_score >= 0.8 ? 'bg-green-500/5' : ''}`}>
                    {isAISearchMode && (
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star 
                                key={i} 
                                className={`h-3 w-3 ${
                                  i < Math.round((aiMatch?.match_score || 0) * 5)
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-muted-foreground/30'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {Math.round((aiMatch?.match_score || 0) * 100)}%
                          </span>
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {/* Product Image or Icon */}
                        {hasImages ? (
                          <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                            <img
                              src={product.images[0]}
                              alt={product.product_name}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                // Fallback to icon if image fails to load
                                e.currentTarget.style.display = 'none'
                                e.currentTarget.parentElement!.innerHTML = `<div class="h-full w-full flex items-center justify-center bg-primary/10"><svg class="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>`
                              }}
                            />
                          </div>
                        ) : (
                          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <TypeIcon className="h-5 w-5 text-primary" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{product.product_name}</p>
                          {aiMatch?.match_reason && (
                            <p className="text-xs text-primary/80 italic">{aiMatch.match_reason}</p>
                          )}
                          {hasImages && !aiMatch?.match_reason && (
                            <p className="text-xs text-muted-foreground">
                              <ImageIcon className="inline h-3 w-3 mr-1" />
                              {product.images.length} images
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                        {product.product_code}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p>{product.location_name || product.product_name}</p>
                          <p className="text-xs text-muted-foreground">{product.city_province}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{getProductTypeLabel(product.type)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {product.attributes.width}m x {product.attributes.height}m
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{formatCurrency(product.cost, product.currency)}</p>
                      <p className="text-xs text-muted-foreground">/{product.booking_duration}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">{product.provider_name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          {product.created_at
                            ? new Date(product.created_at).toLocaleDateString('vi-VN', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })
                            : '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[product.status]}`}
                      >
                        {getProductStatusLabel(product.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedProduct(product)
                            setIsViewOpen(true)
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(product)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExportToSlides(product)}
                          disabled={isExporting}
                          title="Export to Google Slides"
                        >
                          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4 text-blue-500" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedProduct(product)
                            setIsDeleteOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {(isAISearchMode ? (aiFilteredProducts?.length || 0) === 0 : filteredProducts.length === 0) && (
          <div className="py-12 text-center">
            {isAISearchMode ? (
              <>
                <Brain className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">Không tìm thấy sản phẩm phù hợp với mô tả của bạn</p>
                <Button variant="outline" className="mt-4" onClick={clearAISearch}>
                  Xóa bộ lọc AI
                </Button>
              </>
            ) : (
              <>
                <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">No products found</p>
              </>
            )}
          </div>
        )}

        {/* Pagination - only show when not in AI search mode */}
        {!isAISearchMode && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * itemsPerPage + 1} -{' '}
              {Math.min(currentPage * itemsPerPage, filteredProducts.length)} of{' '}
              {filteredProducts.length} products
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Page {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* View Product Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent
          className="max-w-3xl max-h-[90vh] overflow-y-auto"
          onClose={() => setIsViewOpen(false)}
        >
          <DialogHeader>
            <DialogTitle>Product Details</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Product Code</Label>
                  <p className="font-medium">{selectedProduct.product_code}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Product Name</Label>
                  <p className="font-medium">{selectedProduct.product_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <p className="font-medium">{getProductTypeLabel(selectedProduct.type)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge
                    variant={
                      selectedProduct.status === 1
                        ? 'success'
                        : selectedProduct.status === 2
                        ? 'warning'
                        : 'destructive'
                    }
                  >
                    {getProductStatusLabel(selectedProduct.status)}
                  </Badge>
                </div>
              </div>

              {/* Location & Provider */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <Label className="font-medium">Location</Label>
                  </div>
                  <p className="font-medium">{selectedProduct.location_name || selectedProduct.product_name}</p>
                  <div className="text-sm text-muted-foreground space-y-1 mt-2">
                    {selectedProduct.location_address && (
                      <p>{selectedProduct.location_address}</p>
                    )}
                    {(selectedProduct.ward || selectedProduct.city_province) && (
                      <p>
                        {[
                          selectedProduct.ward,
                          selectedProduct.city_province
                        ].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {selectedProduct.gps_coordinates && (
                      <p className="text-xs">
                        <span className="text-muted-foreground">GPS:</span> {selectedProduct.gps_coordinates}
                      </p>
                    )}
                    {selectedProduct.local_tax && (
                      <p className="text-xs">
                        <span className="text-muted-foreground">Local Tax:</span> {selectedProduct.local_tax}%
                      </p>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <Label className="font-medium">Provider</Label>
                  </div>
                  <p>{selectedProduct.provider_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedProduct.provider_phone}</p>
                </div>
              </div>

              {/* Pricing */}
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <Label className="font-medium">Pricing & Duration</Label>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-sm">Rental Price</Label>
                    <p className="font-bold text-lg">
                      {formatCurrency(selectedProduct.cost, selectedProduct.currency)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Rental Duration</Label>
                    <p className="font-medium">{selectedProduct.booking_duration}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Traffic</Label>
                    <p className="font-medium">{selectedProduct.traffic}</p>
                  </div>
                </div>
              </div>

              {/* Attributes */}
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Maximize2 className="h-4 w-4 text-primary" />
                  <Label className="font-medium">Technical Specifications</Label>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Size</Label>
                    <p>
                      {selectedProduct.attributes.width}m x {selectedProduct.attributes.height}m
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Resolution</Label>
                    <p>
                      {selectedProduct.attributes.pixel_width} x{' '}
                      {selectedProduct.attributes.pixel_height} px
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Video Duration</Label>
                    <p>{selectedProduct.attributes.video_duration}s</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Operating Hours</Label>
                    <p>
                      {selectedProduct.attributes.opera_time_from} -{' '}
                      {selectedProduct.attributes.opera_time_to}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Frequency</Label>
                    <p>{selectedProduct.attributes.frequency}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Shape</Label>
                    <p>{selectedProduct.attributes.shape}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Sides</Label>
                    <p>{selectedProduct.attributes.add_side}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Ad Slots</Label>
                    <p>{selectedProduct.attributes.quantity_of_ad || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Lighting</Label>
                    <p>{selectedProduct.attributes.lighting === 1 ? 'Yes' : 'No'}</p>
                  </div>
                </div>
                {selectedProduct.attributes.note && (
                  <div className="mt-3">
                    <Label className="text-muted-foreground">Notes</Label>
                    <p className="text-sm">{selectedProduct.attributes.note}</p>
                  </div>
                )}
              </div>

              {/* Description */}
              {selectedProduct.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="mt-1">{selectedProduct.description}</p>
                </div>
              )}

              {/* Product Images */}
              {selectedProduct.images && selectedProduct.images.length > 0 && (
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    <Label className="font-medium">Product Images ({selectedProduct.images.length})</Label>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {selectedProduct.images.map((imageUrl, index) => (
                      <div 
                        key={index} 
                        className="relative aspect-video rounded-lg overflow-hidden bg-muted group cursor-pointer"
                        onClick={() => window.open(imageUrl, '_blank')}
                      >
                        <img
                          src={imageUrl}
                          alt={`${selectedProduct.product_name} - Image ${index + 1}`}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          onError={(e) => {
                            e.currentTarget.src = ''
                            e.currentTarget.parentElement!.innerHTML = `
                              <div class="h-full w-full flex flex-col items-center justify-center text-muted-foreground">
                                <svg class="h-8 w-8 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                                  <circle cx="8.5" cy="8.5" r="1.5"/>
                                  <path d="m21 15-5-5L5 21"/>
                                </svg>
                                <span class="text-xs">Failed to load image</span>
                              </div>
                            `
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-2 py-0.5 rounded">
                          {index + 1}/{selectedProduct.images.length}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Export status messages */}
          {exportError && (
            <div className="mx-6 mb-2 rounded-md bg-red-50 p-3 text-sm text-red-600">
              Export failed: {exportError}
            </div>
          )}
          {exportResult && (
            <div className="mx-6 mb-2 rounded-md bg-green-50 p-3 text-sm text-green-700 flex items-center justify-between">
              <span>Exported successfully!</span>
              <a href={exportResult.slideUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-medium text-blue-600 hover:underline">
                Open Slides <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>
              Close
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (selectedProduct) handleExportToSlides(selectedProduct)
              }}
              disabled={isExporting}
            >
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
              Export PPT
            </Button>
            <Button
              onClick={() => {
                setIsViewOpen(false)
                if (selectedProduct) openEditDialog(selectedProduct)
              }}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Product Dialog */}
      <Dialog
        open={isCreateOpen || isEditOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false)
            setIsEditOpen(false)
            resetForm()
          }
        }}
      >
        <DialogContent
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
          onClose={() => {
            setIsCreateOpen(false)
            setIsEditOpen(false)
            resetForm()
          }}
        >
          <DialogHeader>
            <DialogTitle>{isEditOpen ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Basic Information
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="product_code">Product Code *</Label>
                  <Input
                    id="product_code"
                    value={formData.product_code}
                    onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                    className="mt-1"
                    disabled={isEditOpen}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="product_name">Product Name *</Label>
                  <Input
                    id="product_name"
                    value={formData.product_name}
                    onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                    placeholder="Enter product name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="type">Product Type *</Label>
                  <Select
                    id="type"
                    value={formData.type}
                    onChange={(e) => handleTypeChange(e.target.value as ProductType)}
                    className="mt-1"
                  >
                    <option value="billboard">Billboard</option>
                    <option value="digital">Digital Screen</option>
                    <option value="led">LED Screen</option>
                    <option value="transit">Transit Advertising</option>
                    <option value="poster">Poster</option>
                    <option value="banner">Banner</option>
                    <option value="other">Other</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Status *</Label>
                  <Select
                    id="status"
                    value={String(formData.status)}
                    onChange={(e) =>
                      setFormData({ ...formData, status: Number(e.target.value) as ProductStatus })
                    }
                    className="mt-1"
                  >
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                    <option value="2">Maintenance</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="areas">Areas</Label>
                  <Input
                    id="areas"
                    value={formData.areas?.join(', ')}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        areas: e.target.value.split(',').map((s) => s.trim()),
                      })
                    }
                    placeholder="Enter areas, separated by comma"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Location (embedded in product) */}
            <VietnamAddressSelector
              value={locationData}
              onChange={setLocationData}
              showGPS={true}
              showCurrency={false}
              showLocalTax={true}
              gpsCoordinates={gpsCoordinates}
              localTax={localTax}
              onGPSChange={setGpsCoordinates}
              onLocalTaxChange={setLocalTax}
            />
            
            {/* Landmark */}
            <div>
              <Label htmlFor="landmark">Điểm mốc / Hướng nhìn</Label>
              <Input
                id="landmark"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="VD: Gần sân bay Tân Sơn Nhất, Hướng về trung tâm..."
                className="mt-1"
              />
            </div>

            {/* Provider */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Provider
              </h3>
              <div>
                <Label htmlFor="provider_id">Nhà cung cấp *</Label>
                <Select
                  id="provider_id"
                  value={formData.provider_id}
                  onChange={(e) => setFormData({ ...formData, provider_id: e.target.value })}
                  className="mt-1"
                >
                  <option value="">Chọn nhà cung cấp</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Pricing & Duration
              </h3>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="cost">Rental Price *</Label>
                  <Input
                    id="cost"
                    type="number"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                    placeholder="0"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    id="currency"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="mt-1"
                  >
                    <option value="VND">VND</option>
                    <option value="USD">USD</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="booking_duration">Rental Duration *</Label>
                  <Input
                    id="booking_duration"
                    value={formData.booking_duration}
                    onChange={(e) => setFormData({ ...formData, booking_duration: e.target.value })}
                    placeholder="1 month, 3 months..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="traffic">Traffic *</Label>
                  <Input
                    id="traffic"
                    value={formData.traffic}
                    onChange={(e) => setFormData({ ...formData, traffic: e.target.value })}
                    placeholder="10,000 views/day"
                    className="mt-1"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="production_cost">Production Cost</Label>
                  <Input
                    id="production_cost"
                    value={formData.production_cost}
                    onChange={(e) => setFormData({ ...formData, production_cost: e.target.value })}
                    placeholder="Production cost description"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Attributes */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" />
                Technical Specifications
              </h3>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="width">Width (m) *</Label>
                  <Input
                    id="width"
                    type="number"
                    value={formData.attributes?.width}
                    onChange={(e) => updateAttributes('width', Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="height">Height (m) *</Label>
                  <Input
                    id="height"
                    type="number"
                    value={formData.attributes?.height}
                    onChange={(e) => updateAttributes('height', Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="pixel_width">Pixel Width</Label>
                  <Input
                    id="pixel_width"
                    type="number"
                    value={formData.attributes?.pixel_width}
                    onChange={(e) => updateAttributes('pixel_width', Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="pixel_height">Pixel Height</Label>
                  <Input
                    id="pixel_height"
                    type="number"
                    value={formData.attributes?.pixel_height}
                    onChange={(e) => updateAttributes('pixel_height', Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="video_duration">Video Duration (s)</Label>
                  <Input
                    id="video_duration"
                    type="number"
                    value={formData.attributes?.video_duration}
                    onChange={(e) => updateAttributes('video_duration', Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="opera_time_from">From *</Label>
                  <Input
                    id="opera_time_from"
                    type="time"
                    value={formData.attributes?.opera_time_from}
                    onChange={(e) => updateAttributes('opera_time_from', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="opera_time_to">To *</Label>
                  <Input
                    id="opera_time_to"
                    type="time"
                    value={formData.attributes?.opera_time_to}
                    onChange={(e) => updateAttributes('opera_time_to', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="frequency">Frequency *</Label>
                  <Input
                    id="frequency"
                    value={formData.attributes?.frequency}
                    onChange={(e) => updateAttributes('frequency', e.target.value)}
                    placeholder="10 times/hour"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="shape">Shape *</Label>
                  <Select
                    id="shape"
                    value={formData.attributes?.shape}
                    onChange={(e) => updateAttributes('shape', e.target.value)}
                    className="mt-1"
                  >
                    <option value="rectangle">Rectangle</option>
                    <option value="square">Square</option>
                    <option value="vertical">Vertical</option>
                    <option value="horizontal">Horizontal</option>
                    <option value="circular">Circular</option>
                    <option value="other">Other</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="add_side">Sides *</Label>
                  <Input
                    id="add_side"
                    type="number"
                    value={formData.attributes?.add_side}
                    onChange={(e) => updateAttributes('add_side', Number(e.target.value))}
                    className="mt-1"
                    min={1}
                  />
                </div>
                <div>
                  <Label htmlFor="quantity_of_ad">Ad Slots</Label>
                  <Input
                    id="quantity_of_ad"
                    type="number"
                    value={formData.attributes?.quantity_of_ad}
                    onChange={(e) => updateAttributes('quantity_of_ad', Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="lighting">Lighting</Label>
                  <Select
                    id="lighting"
                    value={String(formData.attributes?.lighting)}
                    onChange={(e) => updateAttributes('lighting', Number(e.target.value))}
                    className="mt-1"
                  >
                    <option value="1">Yes</option>
                    <option value="0">No</option>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="attr_note">Technical Notes</Label>
                <Textarea
                  id="attr_note"
                  value={formData.attributes?.note}
                  onChange={(e) => updateAttributes('note', e.target.value)}
                  placeholder="Notes about technical specifications..."
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Product Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed product description..."
                className="mt-1"
                rows={3}
              />
            </div>

            {/* Product Images */}
            <ImageEditor
              images={formData.images || []}
              onChange={(images) => setFormData({ ...formData, images })}
              productCode={formData.product_code || 'new-product'}
              maxImages={10}
              disabled={isSubmitting}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false)
                setIsEditOpen(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={isEditOpen ? handleUpdate : handleCreate}
              disabled={
                !formData.product_name ||
                !locationData.city_province ||
                !formData.provider_id ||
                !formData.traffic ||
                !formData.booking_duration ||
                isSubmitting
              }
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditOpen ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to delete product{' '}
            <strong>{selectedProduct?.product_name}</strong>? This action cannot be
            undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Upload Dialog */}
      <Dialog open={isAIUploadOpen} onOpenChange={(open) => {
        if (!importProgress.isImporting) {
          setIsAIUploadOpen(open)
          if (!open) setAiError(null)
        }
      }}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          onClose={() => {
            if (!importProgress.isImporting) {
              setIsAIUploadOpen(false)
              setAiError(null)
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              Import Products with AI
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {/* Import Progress Overlay */}
            {importProgress.isImporting && (
              <div className="mb-4 p-4 rounded-lg bg-primary/10 border border-primary/30">
                <div className="flex items-center gap-3 mb-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="font-medium text-primary">Importing Products...</span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{importProgress.step}</p>
                {importProgress.total > 0 && (
                  <>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Progress: {importProgress.current} / {importProgress.total}</span>
                      <span>{Math.round((importProgress.current / importProgress.total) * 100)}%</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                      />
                    </div>
                    {importProgress.productName && (
                      <p className="text-xs text-muted-foreground mt-2 truncate">
                        Current: {importProgress.productName}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {!importProgress.isImporting && (
              <p className="text-sm text-muted-foreground mb-4">
                Upload a PDF or image file containing product information. Claude AI will automatically
                extract and fill in the form.
              </p>
            )}

            {aiError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
                {aiError}
              </div>
            )}

            <ModernPDFUploader
              onExtracted={handleAIExtracted}
              onError={handleAIError}
              disabled={isSubmitting || importProgress.isImporting}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (!importProgress.isImporting) {
                  setIsAIUploadOpen(false)
                  setAiError(null)
                }
              }}
              disabled={importProgress.isImporting}
            >
              {importProgress.isImporting ? 'Please wait...' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}

export default InventoryPage
