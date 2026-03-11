import { useState, useEffect, useMemo } from 'react'
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
  getLocations,
  createLocation,
  generateProductCode,
  formatCurrency,
  getProductStatusLabel,
  getProductTypeLabel,
  getDefaultAttributes,
} from '@/lib/productProvider'
import { getProviders, findOrCreateProvider } from '@/lib/customerProvider'
import { useAuth } from '@/contexts/AuthContext'
import { PDFUploadExtractor } from '@/components/inventory'
import { convertAndUploadPdfImages } from '@/lib/convertApiService'
import type { ExtractedPDFData, ExtractedProductData } from '@/lib/geminiService'
import type {
  ProductWithRelations,
  CreateProductParams,
  ProductType,
  ProductStatus,
  ProductStats,
  ProductAttributes,
  Location,
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
  const [products, setProducts] = useState<ProductWithRelations[]>([])
  const [locations, setLocations] = useState<Location[]>([])
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
    location_id: '',
    attributes: getDefaultAttributes(),
    description: '',
  })

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true)
      const [productsData, locationsData, providersData, statsData] = await Promise.all([
        getProducts(),
        getLocations(),
        getProviders(),
        getProductStats(),
      ])
      setProducts(productsData)
      setLocations(locationsData)
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
        product.product_code.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = filterType === 'all' || product.type === filterType
      const matchesStatus = filterStatus === 'all' || product.status === Number(filterStatus)
      const matchesCity = filterCity === 'all' || product.location_city === filterCity

      return matchesSearch && matchesType && matchesStatus && matchesCity
    })
  }, [products, searchTerm, filterType, filterStatus, filterCity])

  // Paginated products
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredProducts, currentPage])

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)

  // Get unique cities
  const cities = useMemo(() => {
    return [...new Set(locations.map((l) => l.city))]
  }, [locations])

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
      location_id: '',
      attributes: getDefaultAttributes(),
      description: '',
    })
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
      location_id: product.location_id,
      attributes: product.attributes,
      description: product.description || '',
    })
    setIsEditOpen(true)
  }

  // Handle create
  const handleCreate = async () => {
    if (!user) return
    try {
      setIsSubmitting(true)
      await createProduct({
        ...formData,
        user_id: user.id,
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
      await updateProduct({
        id: selectedProduct.id,
        ...formData,
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

      // 1. Find or create provider from the PDF
      const provider = await findOrCreateProvider(data.provider_name, user.id)
      
      // Refresh providers list
      const updatedProviders = await getProviders()
      setProviders(updatedProviders)

      // 2. Extract images from PDF using ConvertAPI (skip first page which is provider info)
      let extractedImageUrls: string[] = []
      if (file.type === 'application/pdf') {
        try {
          console.log('Converting PDF to images using ConvertAPI...')
          // Use first product code for folder naming
          const firstProductCode = data.products[0]?.product_code || await generateProductCode(data.products[0]?.type || 'billboard')
          extractedImageUrls = await convertAndUploadPdfImages(file, firstProductCode, 2)
          console.log(`Converted and uploaded ${extractedImageUrls.length} images`)
        } catch (imgError) {
          console.error('Error converting PDF images:', imgError)
          // Continue without images
        }
      }

      // 3. Process each product with shared images
      for (const productData of data.products) {
        await processExtractedProduct(productData, provider.id, extractedImageUrls)
      }

      // 4. Refresh products list
      await fetchData()

      // 5. Close dialog and show success
      setIsAIUploadOpen(false)
      
      // Show result message
      const productCount = data.products.length
      const message = `Đã nhập ${productCount} sản phẩm từ nhà cung cấp "${data.provider_name}" với ${extractedImageUrls.length} hình ảnh`
      console.log(message)
      // You could add a toast notification here
      
    } catch (error) {
      console.error('Error processing AI extraction:', error)
      setAiError(error instanceof Error ? error.message : 'Lỗi không xác định')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Process a single extracted product
  const processExtractedProduct = async (data: ExtractedProductData, providerId: string, images: string[] = []) => {
    if (!user) return

    // Use product_code from AI if available, otherwise generate new one
    const code = data.product_code || await generateProductCode(data.type)
    
    // Check if we need to create a new location
    let locationId = ''
    if (data.location.name || data.location.address) {
      // Try to find existing location by name or address
      const existingLocation = locations.find(
        (l) => 
          (data.location.name && l.name.toLowerCase().includes(data.location.name.toLowerCase())) || 
          (data.location.address && l.address.toLowerCase().includes(data.location.address.toLowerCase()))
      )
      
      if (existingLocation) {
        locationId = existingLocation.id
      } else if (data.location.address) {
        // Create new location if we have at least an address
        try {
          const newLocation = await createLocation({
            name: data.location.name || data.product_name,
            address: data.location.address,
            district: data.location.district,
            city: data.location.city || 'Ho Chi Minh',
            landmark: data.location.landmark,
          })
          locationId = newLocation.id
          // Refresh locations
          const updatedLocations = await getLocations()
          setLocations(updatedLocations)
        } catch (error) {
          console.error('Error creating location:', error)
        }
      }
    }

    // Build description from extracted data if not provided
    let description = data.description || ''
    if (!description && data.location.landmark) {
      description = `Hướng nhìn: ${data.location.landmark}`
    }

    // Create product with extracted images
    await createProduct({
      user_id: user.id,
      product_code: code,
      product_name: data.product_name,
      type: data.type,
      areas: data.areas,
      status: 1,
      images: images, // Use extracted images from PDF
      cost: data.cost,
      production_cost: data.production_cost,
      currency: data.currency,
      traffic: data.traffic,
      booking_duration: data.booking_duration,
      provider_id: providerId,
      location_id: locationId || '',
      attributes: data.attributes,
      description: description,
    })
  }

  // Handle AI extraction error
  const handleAIError = (error: string) => {
    setAiError(error)
  }

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
          <h1 className="text-2xl font-bold">Quản lý sản phẩm</h1>
          <p className="text-muted-foreground">Quản lý tất cả các vị trí quảng cáo</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsAIUploadOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Nhập bằng AI
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Thêm sản phẩm
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
              <p className="text-sm text-muted-foreground">Tổng sản phẩm</p>
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
              <p className="text-sm text-muted-foreground">Đang hoạt động</p>
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
              <p className="text-sm text-muted-foreground">Bảo trì</p>
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
              <p className="text-sm text-muted-foreground">Không hoạt động</p>
              <p className="text-2xl font-bold">{stats?.inactive || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên, mã sản phẩm..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="w-[150px]"
        >
          <option value="all">Tất cả loại</option>
          <option value="billboard">Biển QC</option>
          <option value="digital">Màn hình số</option>
          <option value="led">LED</option>
          <option value="transit">Di động</option>
          <option value="poster">Poster</option>
          <option value="banner">Banner</option>
          <option value="other">Khác</option>
        </Select>
        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-[150px]"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="1">Đang hoạt động</option>
          <option value="0">Không hoạt động</option>
          <option value="2">Bảo trì</option>
        </Select>
        <Select
          value={filterCity}
          onChange={(e) => setFilterCity(e.target.value)}
          className="w-[150px]"
        >
          <option value="all">Tất cả thành phố</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </Select>
      </div>

      {/* Products Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Sản phẩm</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Vị trí</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Loại</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Kích thước</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Giá</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Nhà cung cấp</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Trạng thái</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedProducts.map((product) => {
                const TypeIcon = typeIcons[product.type] || Package
                return (
                  <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <TypeIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{product.product_name}</p>
                          <p className="text-xs text-muted-foreground">{product.product_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p>{product.location_name}</p>
                          <p className="text-xs text-muted-foreground">{product.location_city}</p>
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
        {filteredProducts.length === 0 && (
          <div className="py-12 text-center">
            <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">Không tìm thấy sản phẩm nào</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Hiển thị {(currentPage - 1) * itemsPerPage + 1} -{' '}
              {Math.min(currentPage * itemsPerPage, filteredProducts.length)} của{' '}
              {filteredProducts.length} sản phẩm
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
                Trang {currentPage} / {totalPages}
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
            <DialogTitle>Chi tiết sản phẩm</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Mã sản phẩm</Label>
                  <p className="font-medium">{selectedProduct.product_code}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Tên sản phẩm</Label>
                  <p className="font-medium">{selectedProduct.product_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Loại</Label>
                  <p className="font-medium">{getProductTypeLabel(selectedProduct.type)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Trạng thái</Label>
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
                    <Label className="font-medium">Vị trí</Label>
                  </div>
                  <p>{selectedProduct.location_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedProduct.location_address}</p>
                  <p className="text-sm text-muted-foreground">{selectedProduct.location_city}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <Label className="font-medium">Nhà cung cấp</Label>
                  </div>
                  <p>{selectedProduct.provider_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedProduct.provider_phone}</p>
                </div>
              </div>

              {/* Pricing */}
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <Label className="font-medium">Giá & Thời hạn</Label>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-sm">Giá thuê</Label>
                    <p className="font-bold text-lg">
                      {formatCurrency(selectedProduct.cost, selectedProduct.currency)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Thời hạn thuê</Label>
                    <p className="font-medium">{selectedProduct.booking_duration}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Lưu lượng</Label>
                    <p className="font-medium">{selectedProduct.traffic}</p>
                  </div>
                </div>
              </div>

              {/* Attributes */}
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Maximize2 className="h-4 w-4 text-primary" />
                  <Label className="font-medium">Thông số kỹ thuật</Label>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Kích thước</Label>
                    <p>
                      {selectedProduct.attributes.width}m x {selectedProduct.attributes.height}m
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Độ phân giải</Label>
                    <p>
                      {selectedProduct.attributes.pixel_width} x{' '}
                      {selectedProduct.attributes.pixel_height} px
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Thời lượng video</Label>
                    <p>{selectedProduct.attributes.video_duration}s</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Thời gian hoạt động</Label>
                    <p>
                      {selectedProduct.attributes.opera_time_from} -{' '}
                      {selectedProduct.attributes.opera_time_to}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Tần suất</Label>
                    <p>{selectedProduct.attributes.frequency}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Hình dạng</Label>
                    <p>{selectedProduct.attributes.shape}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Số mặt</Label>
                    <p>{selectedProduct.attributes.add_side}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Số lượng QC</Label>
                    <p>{selectedProduct.attributes.quantity_of_ad || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Chiếu sáng</Label>
                    <p>{selectedProduct.attributes.lighting === 1 ? 'Có' : 'Không'}</p>
                  </div>
                </div>
                {selectedProduct.attributes.note && (
                  <div className="mt-3">
                    <Label className="text-muted-foreground">Ghi chú</Label>
                    <p className="text-sm">{selectedProduct.attributes.note}</p>
                  </div>
                )}
              </div>

              {/* Description */}
              {selectedProduct.description && (
                <div>
                  <Label className="text-muted-foreground">Mô tả</Label>
                  <p className="mt-1">{selectedProduct.description}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewOpen(false)}>
              Đóng
            </Button>
            <Button
              onClick={() => {
                setIsViewOpen(false)
                if (selectedProduct) openEditDialog(selectedProduct)
              }}
            >
              <Edit className="mr-2 h-4 w-4" />
              Chỉnh sửa
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
            <DialogTitle>{isEditOpen ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Thông tin cơ bản
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="product_code">Mã sản phẩm *</Label>
                  <Input
                    id="product_code"
                    value={formData.product_code}
                    onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                    className="mt-1"
                    disabled={isEditOpen}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="product_name">Tên sản phẩm *</Label>
                  <Input
                    id="product_name"
                    value={formData.product_name}
                    onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                    placeholder="Nhập tên sản phẩm"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="type">Loại sản phẩm *</Label>
                  <Select
                    id="type"
                    value={formData.type}
                    onChange={(e) => handleTypeChange(e.target.value as ProductType)}
                    className="mt-1"
                  >
                    <option value="billboard">Biển quảng cáo</option>
                    <option value="digital">Màn hình kỹ thuật số</option>
                    <option value="led">Màn hình LED</option>
                    <option value="transit">Quảng cáo di động</option>
                    <option value="poster">Poster</option>
                    <option value="banner">Banner</option>
                    <option value="other">Khác</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Trạng thái *</Label>
                  <Select
                    id="status"
                    value={String(formData.status)}
                    onChange={(e) =>
                      setFormData({ ...formData, status: Number(e.target.value) as ProductStatus })
                    }
                    className="mt-1"
                  >
                    <option value="1">Đang hoạt động</option>
                    <option value="0">Không hoạt động</option>
                    <option value="2">Bảo trì</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="areas">Khu vực</Label>
                  <Input
                    id="areas"
                    value={formData.areas?.join(', ')}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        areas: e.target.value.split(',').map((s) => s.trim()),
                      })
                    }
                    placeholder="Nhập khu vực, cách nhau bằng dấu phẩy"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Location & Provider */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Vị trí & Nhà cung cấp
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="location_id">Vị trí *</Label>
                  <Select
                    id="location_id"
                    value={formData.location_id}
                    onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                    className="mt-1"
                  >
                    <option value="">Chọn vị trí</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} - {loc.city}
                      </option>
                    ))}
                  </Select>
                </div>
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
            </div>

            {/* Pricing */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Giá & Thời hạn
              </h3>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="cost">Giá thuê *</Label>
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
                  <Label htmlFor="currency">Tiền tệ</Label>
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
                  <Label htmlFor="booking_duration">Thời hạn thuê *</Label>
                  <Input
                    id="booking_duration"
                    value={formData.booking_duration}
                    onChange={(e) => setFormData({ ...formData, booking_duration: e.target.value })}
                    placeholder="1 tháng, 3 tháng..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="traffic">Lưu lượng *</Label>
                  <Input
                    id="traffic"
                    value={formData.traffic}
                    onChange={(e) => setFormData({ ...formData, traffic: e.target.value })}
                    placeholder="10,000 lượt/ngày"
                    className="mt-1"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="production_cost">Chi phí sản xuất</Label>
                  <Input
                    id="production_cost"
                    value={formData.production_cost}
                    onChange={(e) => setFormData({ ...formData, production_cost: e.target.value })}
                    placeholder="Mô tả chi phí sản xuất"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Attributes */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" />
                Thông số kỹ thuật
              </h3>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="width">Chiều rộng (m) *</Label>
                  <Input
                    id="width"
                    type="number"
                    value={formData.attributes?.width}
                    onChange={(e) => updateAttributes('width', Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="height">Chiều cao (m) *</Label>
                  <Input
                    id="height"
                    type="number"
                    value={formData.attributes?.height}
                    onChange={(e) => updateAttributes('height', Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="pixel_width">Pixel rộng</Label>
                  <Input
                    id="pixel_width"
                    type="number"
                    value={formData.attributes?.pixel_width}
                    onChange={(e) => updateAttributes('pixel_width', Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="pixel_height">Pixel cao</Label>
                  <Input
                    id="pixel_height"
                    type="number"
                    value={formData.attributes?.pixel_height}
                    onChange={(e) => updateAttributes('pixel_height', Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="video_duration">Thời lượng video (s)</Label>
                  <Input
                    id="video_duration"
                    type="number"
                    value={formData.attributes?.video_duration}
                    onChange={(e) => updateAttributes('video_duration', Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="opera_time_from">Từ giờ *</Label>
                  <Input
                    id="opera_time_from"
                    type="time"
                    value={formData.attributes?.opera_time_from}
                    onChange={(e) => updateAttributes('opera_time_from', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="opera_time_to">Đến giờ *</Label>
                  <Input
                    id="opera_time_to"
                    type="time"
                    value={formData.attributes?.opera_time_to}
                    onChange={(e) => updateAttributes('opera_time_to', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="frequency">Tần suất *</Label>
                  <Input
                    id="frequency"
                    value={formData.attributes?.frequency}
                    onChange={(e) => updateAttributes('frequency', e.target.value)}
                    placeholder="10 lần/giờ"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="shape">Hình dạng *</Label>
                  <Select
                    id="shape"
                    value={formData.attributes?.shape}
                    onChange={(e) => updateAttributes('shape', e.target.value)}
                    className="mt-1"
                  >
                    <option value="rectangle">Hình chữ nhật</option>
                    <option value="square">Hình vuông</option>
                    <option value="vertical">Dọc</option>
                    <option value="horizontal">Ngang</option>
                    <option value="circular">Tròn</option>
                    <option value="other">Khác</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="add_side">Số mặt *</Label>
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
                  <Label htmlFor="quantity_of_ad">Số lượng QC</Label>
                  <Input
                    id="quantity_of_ad"
                    type="number"
                    value={formData.attributes?.quantity_of_ad}
                    onChange={(e) => updateAttributes('quantity_of_ad', Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="lighting">Chiếu sáng</Label>
                  <Select
                    id="lighting"
                    value={String(formData.attributes?.lighting)}
                    onChange={(e) => updateAttributes('lighting', Number(e.target.value))}
                    className="mt-1"
                  >
                    <option value="1">Có</option>
                    <option value="0">Không</option>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="attr_note">Ghi chú kỹ thuật</Label>
                <Textarea
                  id="attr_note"
                  value={formData.attributes?.note}
                  onChange={(e) => updateAttributes('note', e.target.value)}
                  placeholder="Ghi chú về thông số kỹ thuật..."
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Mô tả sản phẩm</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Mô tả chi tiết về sản phẩm..."
                className="mt-1"
                rows={3}
              />
            </div>
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
              Hủy
            </Button>
            <Button
              onClick={isEditOpen ? handleUpdate : handleCreate}
              disabled={
                !formData.product_name ||
                !formData.location_id ||
                !formData.provider_id ||
                !formData.traffic ||
                !formData.booking_duration ||
                isSubmitting
              }
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditOpen ? 'Cập nhật' : 'Tạo mới'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent onClose={() => setIsDeleteOpen(false)}>
          <DialogHeader>
            <DialogTitle>Xác nhận xóa</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Bạn có chắc chắn muốn xóa sản phẩm{' '}
            <strong>{selectedProduct?.product_name}</strong>? Hành động này không thể hoàn
            tác.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Upload Dialog */}
      <Dialog open={isAIUploadOpen} onOpenChange={setIsAIUploadOpen}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          onClose={() => {
            setIsAIUploadOpen(false)
            setAiError(null)
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              Nhập sản phẩm bằng AI
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Upload file PDF hoặc hình ảnh chứa thông tin sản phẩm. Gemini AI sẽ tự động
              trích xuất và điền vào form.
            </p>

            {aiError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
                {aiError}
              </div>
            )}

            <PDFUploadExtractor
              onExtracted={handleAIExtracted}
              onError={handleAIError}
              disabled={isSubmitting}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAIUploadOpen(false)
                setAiError(null)
              }}
            >
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default InventoryPage
