import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
  FileText,
  ChevronRight,
  ChevronLeft,
  Save,
  ArrowLeft,
  Eye,
  Package,
  MapPin,
  Ruler,
  Clock,
  Building2,
  Zap,
  Check,
  XCircle,
  Image as ImageIcon,
  Plus,
  Trash2,
  Edit3,
  ImageDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { extractProductFromFile, type ExtractedPDFData, type ExtractedProductData } from '@/lib/claudeService'
import { convertPdfToImages, type ConvertedImage } from '@/lib/convertApiService'
import { createProduct } from '@/lib/productProvider'
import { findOrCreateProvider } from '@/lib/customerProvider'
import { useAuth } from '@/contexts/AuthContext'
import type { CreateProductParams } from '@/types/product'

type ScanStatus = 'idle' | 'uploading' | 'scanning' | 'extracting_images' | 'success' | 'error'

interface ProductImage {
  id: string
  url: string
  file?: File
  isNew?: boolean
}

interface EditableProduct extends ExtractedProductData {
  images: ProductImage[]
  isEditing?: boolean
}

interface ScannedFile {
  file: File
  preview: string
  status: ScanStatus
  progress: number
  data?: ExtractedPDFData
  editableProducts?: EditableProduct[]
  error?: string
}

export default function ImportPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [scannedFile, setScannedFile] = useState<ScannedFile | null>(null)
  const [selectedProductIndex, setSelectedProductIndex] = useState<number | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [scanLinePosition, setScanLinePosition] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<EditableProduct | null>(null)
  const [importingProducts, setImportingProducts] = useState<Set<number>>(new Set())
  const [importedProducts, setImportedProducts] = useState<Set<number>>(new Set())
  const [importError, setImportError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const scanIntervalRef = useRef<number | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current)
      }
      if (scannedFile?.preview) {
        URL.revokeObjectURL(scannedFile.preview)
      }
    }
  }, [scannedFile])

  // Animate scan line
  useEffect(() => {
    if (scannedFile?.status === 'scanning' || scannedFile?.status === 'extracting_images') {
      scanIntervalRef.current = window.setInterval(() => {
        setScanLinePosition(prev => {
          if (prev >= 100) return 0
          return prev + 0.5
        })
      }, 20)
    } else {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current)
        scanIntervalRef.current = null
      }
      setScanLinePosition(0)
    }

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current)
      }
    }
  }, [scannedFile?.status])

  // Create preview URL for file
  const createPreview = useCallback((file: File): string => {
    if (file.type.startsWith('image/')) {
      return URL.createObjectURL(file)
    }
    return ''
  }, [])

  // Convert extracted products to editable products with images
  const convertToEditableProducts = useCallback((
    products: ExtractedProductData[], 
    extractedImages?: ConvertedImage[]
  ): EditableProduct[] => {
    // Pattern: Page 1 = Provider info (already skipped), remaining pages are for products
    // We distribute images evenly among products
    const productCount = products.length
    const imageCount = extractedImages?.length || 0
    
    // Calculate images per product
    const imagesPerProduct = productCount > 0 ? Math.floor(imageCount / productCount) : 0
    
    console.log(`📷 Distributing ${imageCount} product images to ${productCount} products (${imagesPerProduct} per product)`)

    return products.map((product, index) => {
      // Assign images to this product
      const startIdx = index * imagesPerProduct
      const endIdx = startIdx + imagesPerProduct
      const productImages = extractedImages?.slice(startIdx, endIdx) || []
      
      const images: ProductImage[] = productImages.map((img, imgIndex) => ({
        id: `extracted-${index}-${imgIndex}-${Date.now()}`,
        url: img.url,
        isNew: false,
      }))

      console.log(`  Product ${index + 1} (${product.product_name}): ${images.length} images`)

      return {
        ...product,
        images,
        isEditing: false,
      }
    })
  }, [])

  // Extract images from PDF using ConvertAPI
  const extractImagesFromPdf = useCallback(async (file: File): Promise<ConvertedImage[]> => {
    if (file.type !== 'application/pdf') {
      console.log('📷 File is not PDF, skipping image extraction')
      return []
    }

    try {
      console.log('📷 Extracting images from PDF using ConvertAPI...')
      // Start from page 2 to skip the first page (provider info)
      const images = await convertPdfToImages(file, 2)
      console.log(`📷 Extracted ${images.length} product images from PDF (skipped page 1 - provider info)`)
      return images
    } catch (error) {
      console.error('📷 Failed to extract images from PDF:', error)
      return []
    }
  }, [])

  // Handle file selection
  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const file = files[0]
    const preview = createPreview(file)

    if (scannedFile?.preview) {
      URL.revokeObjectURL(scannedFile.preview)
    }

    const newScannedFile: ScannedFile = {
      file,
      preview,
      status: 'scanning',
      progress: 0,
    }

    setScannedFile(newScannedFile)
    setSelectedProductIndex(null)
    setIsEditing(false)
    setEditForm(null)

    try {
      // Step 1: Extract product data using Claude AI
      const result = await extractProductFromFile(file)

      if (result.success && result.data) {
        // Step 2: Update status to extracting images
        setScannedFile(prev => prev ? {
          ...prev,
          status: 'extracting_images',
          progress: 50,
        } : null)

        // Step 3: Extract images from PDF using ConvertAPI
        const extractedImages = await extractImagesFromPdf(file)

        // Step 4: Convert products with images
        const editableProducts = convertToEditableProducts(result.data.products, extractedImages)
        
        setScannedFile(prev => prev ? {
          ...prev,
          status: 'success',
          progress: 100,
          data: result.data,
          editableProducts,
        } : null)
      } else {
        setScannedFile(prev => prev ? {
          ...prev,
          status: 'error',
          error: result.error || 'Extraction failed',
        } : null)
      }
    } catch (error) {
      setScannedFile(prev => prev ? {
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      } : null)
    }
  }, [createPreview, scannedFile, convertToEditableProducts])

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    handleFileSelect(e.dataTransfer.files)
  }, [handleFileSelect])

  // Reset
  const handleReset = useCallback(() => {
    if (scannedFile?.preview) {
      URL.revokeObjectURL(scannedFile.preview)
    }
    setScannedFile(null)
    setSelectedProductIndex(null)
    setIsEditing(false)
    setEditForm(null)
  }, [scannedFile])

  // Start editing
  const startEditing = useCallback(() => {
    if (selectedProductIndex !== null && scannedFile?.editableProducts) {
      setEditForm({ ...scannedFile.editableProducts[selectedProductIndex] })
      setIsEditing(true)
    }
  }, [selectedProductIndex, scannedFile])

  // Save edit
  const saveEdit = useCallback(() => {
    if (editForm && selectedProductIndex !== null && scannedFile?.editableProducts) {
      const updatedProducts = [...scannedFile.editableProducts]
      updatedProducts[selectedProductIndex] = editForm
      setScannedFile(prev => prev ? {
        ...prev,
        editableProducts: updatedProducts,
      } : null)
      setIsEditing(false)
      setEditForm(null)
    }
  }, [editForm, selectedProductIndex, scannedFile])

  // Cancel editing
  const cancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditForm(null)
  }, [])

  // Add images
  const handleAddImages = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || !editForm) return

    const newImages: ProductImage[] = Array.from(files).map(file => ({
      id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url: URL.createObjectURL(file),
      file,
      isNew: true,
    }))

    setEditForm(prev => prev ? {
      ...prev,
      images: [...prev.images, ...newImages],
    } : null)

    e.target.value = ''
  }, [editForm])

  // Remove image
  const removeImage = useCallback((imageId: string) => {
    if (!editForm) return

    const imageToRemove = editForm.images.find(img => img.id === imageId)
    if (imageToRemove?.isNew && imageToRemove.url) {
      URL.revokeObjectURL(imageToRemove.url)
    }

    setEditForm(prev => prev ? {
      ...prev,
      images: prev.images.filter(img => img.id !== imageId),
    } : null)
  }, [editForm])

  // Update form field
  const updateField = useCallback((field: string, value: unknown) => {
    setEditForm(prev => {
      if (!prev) return null
      
      if (field.includes('.')) {
        const [parent, child] = field.split('.')
        const parentValue = prev[parent as keyof EditableProduct]
        // Only spread if it's an object (not array or primitive)
        if (parentValue && typeof parentValue === 'object' && !Array.isArray(parentValue)) {
          return {
            ...prev,
            [parent]: {
              ...(parentValue as unknown as Record<string, unknown>),
              [child]: value,
            },
          }
        }
        return prev
      }
      
      return {
        ...prev,
        [field]: value,
      }
    })
  }, [])

  // Format currency
  const formatCurrency = (amount: number, currency: string = 'VND') => {
    if (currency === 'VND') {
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  // Get type badge color
  const getTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      billboard: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      led: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      digital: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
      banner: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      poster: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
      transit: 'bg-green-500/10 text-green-500 border-green-500/20',
    }
    return colors[type] || 'bg-gray-500/10 text-gray-500 border-gray-500/20'
  }

  // Convert EditableProduct to CreateProductParams
  const convertToCreateParams = useCallback((product: EditableProduct, providerId: string): CreateProductParams => {
    return {
      user_id: user?.id || '',
      product_code: product.product_code || `PRD-${Date.now()}`,
      product_name: product.product_name,
      type: product.type,
      areas: product.areas || [],
      images: product.images.map(img => img.url),
      cost: product.cost,
      currency: product.currency || 'VND',
      traffic: product.traffic || '',
      booking_duration: product.booking_duration || '',
      production_cost: product.production_cost || '',
      provider_id: providerId,
      // Location fields
      location_name: product.location.name || product.product_name,
      location_address: product.location.address || '',
      street_number: product.location.street_number || '',
      street_name: product.location.street_name || '',
      ward: product.location.ward || '',
      city_province: product.location.city_province || '',
      gps_coordinates: product.location.gps_coordinates || '',
      landmark: product.location.landmark || '',
      local_tax: product.location.local_tax || 0,
      // Attributes
      attributes: product.attributes || {
        width: 0,
        height: 0,
        opera_time_from: '',
        opera_time_to: '',
      },
      description: product.description || '',
    }
  }, [user])

  // Import a single product
  const handleImportProduct = useCallback(async (productIndex: number) => {
    if (!scannedFile?.editableProducts || !scannedFile.data || !user) {
      setImportError('Không thể import: Thiếu thông tin sản phẩm hoặc chưa đăng nhập')
      return
    }

    const product = scannedFile.editableProducts[productIndex]
    const providerName = scannedFile.data.provider_name
    
    // Mark as importing
    setImportingProducts(prev => new Set(prev).add(productIndex))
    setImportError(null)

    try {
      // Find or create provider based on provider_name from PDF
      console.log(`🏢 Finding or creating provider: ${providerName}`)
      const provider = await findOrCreateProvider(providerName, user.id)
      console.log(`✅ Provider ready: ${provider.name} (${provider.id})`)
      
      const params = convertToCreateParams(product, provider.id)
      await createProduct(params)

      // Mark as imported
      setImportedProducts(prev => new Set(prev).add(productIndex))
      setImportingProducts(prev => {
        const newSet = new Set(prev)
        newSet.delete(productIndex)
        return newSet
      })

      console.log(`✅ Imported product: ${product.product_name}`)
    } catch (error) {
      console.error('❌ Failed to import product:', error)
      setImportError(error instanceof Error ? error.message : 'Import thất bại')
      setImportingProducts(prev => {
        const newSet = new Set(prev)
        newSet.delete(productIndex)
        return newSet
      })
    }
  }, [scannedFile, user, convertToCreateParams])

  // Import all products
  const handleImportAll = useCallback(async () => {
    if (!scannedFile?.editableProducts) return

    setImportError(null)
    
    for (let i = 0; i < scannedFile.editableProducts.length; i++) {
      if (!importedProducts.has(i)) {
        await handleImportProduct(i)
      }
    }

    // Navigate to inventory after all imports
    if (importedProducts.size === scannedFile.editableProducts.length) {
      navigate('/inventory')
    }
  }, [scannedFile, importedProducts, handleImportProduct, navigate])

  // Skip product (move to next)
  const handleSkipProduct = useCallback(() => {
    if (selectedProductIndex !== null && scannedFile?.editableProducts) {
      const nextIndex = selectedProductIndex + 1
      if (nextIndex < scannedFile.editableProducts.length) {
        setSelectedProductIndex(nextIndex)
      } else {
        setSelectedProductIndex(null)
      }
    }
  }, [selectedProductIndex, scannedFile])

  const selectedProduct = selectedProductIndex !== null && scannedFile?.editableProducts
    ? scannedFile.editableProducts[selectedProductIndex]
    : null

  const currentProduct = isEditing ? editForm : selectedProduct

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/inventory')}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Inventory
            </Button>
            <div className="h-6 w-px bg-white/20" />
            <h1 className="text-xl font-semibold text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-400" />
              AI Document Scanner
            </h1>
          </div>
          
          {scannedFile?.status === 'success' && scannedFile.editableProducts && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/60">
                {scannedFile.editableProducts.length} products detected
                {importedProducts.size > 0 && (
                  <span className="text-emerald-400 ml-2">
                    ({importedProducts.size} imported)
                  </span>
                )}
              </span>
              <Button 
                size="sm" 
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleImportAll}
                disabled={importingProducts.size > 0 || importedProducts.size === scannedFile.editableProducts.length}
              >
                {importingProducts.size > 0 ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : importedProducts.size === scannedFile.editableProducts.length ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    All Imported
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Import All
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Import Error Alert */}
      {importError && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
            <p className="text-red-400 text-sm">{importError}</p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setImportError(null)}
              className="ml-auto text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-6">
        {!scannedFile ? (
          /* Upload Zone */
          <div
            className={`
              relative border-2 border-dashed rounded-3xl p-16 transition-all duration-300 cursor-pointer
              ${isDragOver 
                ? 'border-emerald-400 bg-emerald-400/5 scale-[1.01]' 
                : 'border-white/20 hover:border-white/40 hover:bg-white/5'}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />

            <div className="flex flex-col items-center gap-6 text-center">
              <div className="relative">
                <div className="rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 p-8">
                  <Upload className="h-16 w-16 text-emerald-400" />
                </div>
                <div className="absolute -bottom-2 -right-2 rounded-full bg-amber-500 p-2">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
              </div>
              
              <div>
                <p className="text-2xl font-semibold text-white mb-2">Drop your document here</p>
                <p className="text-white/60">or click to browse • Supports PDF and images</p>
              </div>

              <div className="flex items-center gap-6 text-sm text-white/40">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />PDF Documents
                </span>
                <span className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />Images (PNG, JPG)
                </span>
              </div>

              <div className="mt-4 px-6 py-3 rounded-full bg-gradient-to-r from-violet-600/20 to-fuchsia-600/20 border border-violet-500/30">
                <span className="text-sm text-violet-300 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Powered by Claude AI - Extract product data automatically
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Scanner View */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-160px)]">
            {/* Left Panel - Document Preview or Product Images */}
            <div className="relative rounded-2xl overflow-hidden bg-black/40 border border-white/10 flex flex-col">
              {selectedProduct && currentProduct ? (
                <div className="flex-1 flex flex-col">
                  {/* Images Header */}
                  <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-white flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-emerald-400" />
                      Product Images
                      <Badge variant="secondary" className="ml-1 bg-white/10 text-white/60">
                        {currentProduct.images.length}
                      </Badge>
                    </h3>
                    {isEditing && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => imageInputRef.current?.click()}
                        className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Images
                      </Button>
                    )}
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleAddImages}
                    />
                  </div>

                  {/* Images Grid */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {currentProduct.images.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center">
                        <div className="rounded-full bg-white/5 p-6 mb-4">
                          <ImageIcon className="h-12 w-12 text-white/30" />
                        </div>
                        <p className="text-white/40 mb-2">No images yet</p>
                        {isEditing && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => imageInputRef.current?.click()}
                            className="border-white/20 text-white hover:bg-white/10"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Images
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {currentProduct.images.map((image, index) => (
                          <div
                            key={image.id}
                            className="relative group aspect-video rounded-lg overflow-hidden bg-black/40 border border-white/10"
                          >
                            <img
                              src={image.url}
                              alt={`Product image ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            {isEditing && (
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeImage(image.id)}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                            {image.isNew && (
                              <div className="absolute top-2 left-2">
                                <Badge className="bg-emerald-500 text-white text-xs">New</Badge>
                              </div>
                            )}
                          </div>
                        ))}
                        
                        {isEditing && (
                          <button
                            onClick={() => imageInputRef.current?.click()}
                            className="aspect-video rounded-lg border-2 border-dashed border-white/20 hover:border-emerald-400/50 hover:bg-emerald-400/5 transition-all flex flex-col items-center justify-center gap-2"
                          >
                            <Plus className="h-8 w-8 text-white/30" />
                            <span className="text-xs text-white/40">Add more</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="absolute inset-0 flex items-center justify-center p-8">
                    {scannedFile.file.type.startsWith('image/') && scannedFile.preview ? (
                      <img
                        src={scannedFile.preview}
                        alt="Document preview"
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg">
                        <FileText className="h-32 w-32 text-red-400/50 mb-4" />
                        <p className="text-white/60 text-lg">{scannedFile.file.name}</p>
                        <p className="text-white/40 text-sm mt-1">
                          {(scannedFile.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    )}
                  </div>

                  {(scannedFile.status === 'scanning' || scannedFile.status === 'extracting_images') && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div
                        className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent"
                        style={{
                          top: `${scanLinePosition}%`,
                          boxShadow: '0 0 20px 10px rgba(52, 211, 153, 0.3)',
                        }}
                      />
                      <div className="absolute top-4 left-4 w-12 h-12 border-l-2 border-t-2 border-emerald-400" />
                      <div className="absolute top-4 right-4 w-12 h-12 border-r-2 border-t-2 border-emerald-400" />
                      <div className="absolute bottom-4 left-4 w-12 h-12 border-l-2 border-b-2 border-emerald-400" />
                      <div className="absolute bottom-4 right-4 w-12 h-12 border-r-2 border-b-2 border-emerald-400" />
                      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
                        <div className="flex items-center gap-3 bg-black/70 backdrop-blur-sm px-6 py-3 rounded-full">
                          {scannedFile.status === 'scanning' ? (
                            <>
                              <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                              <span className="text-emerald-400 font-medium">Đang quét tài liệu...</span>
                            </>
                          ) : (
                            <>
                              <ImageDown className="h-5 w-5 animate-pulse text-blue-400" />
                              <span className="text-blue-400 font-medium">Đang trích xuất hình ảnh...</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {scannedFile.status === 'success' && (
                    <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 bg-emerald-500/20 backdrop-blur-sm px-4 py-2 rounded-full border border-emerald-500/30">
                        <CheckCircle className="h-5 w-5 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">Quét hoàn tất</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleReset}
                        className="text-white/60 hover:text-white hover:bg-white/10"
                      >
                        <X className="h-4 w-4 mr-1" />Xóa
                      </Button>
                    </div>
                  )}

                  {scannedFile.status === 'error' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                      <div className="text-center p-8">
                        <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
                        <p className="text-red-400 font-medium mb-2">Quét thất bại</p>
                        <p className="text-white/60 text-sm mb-4 max-w-xs">{scannedFile.error}</p>
                        <Button onClick={handleReset} variant="outline" className="border-white/20 text-white">
                          Thử lại
                        </Button>
                      </div>
                    </div>
                  )}

                  {scannedFile.status === 'success' && scannedFile.data?.provider_name && (
                    <div className="absolute bottom-4 left-4">
                      <div className="flex items-center gap-2 bg-violet-500/20 backdrop-blur-sm px-4 py-2 rounded-full border border-violet-500/30">
                        <Building2 className="h-4 w-4 text-violet-400" />
                        <span className="text-violet-300 text-sm font-medium">{scannedFile.data.provider_name}</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Right Panel */}
            <div className="flex flex-col h-full overflow-hidden rounded-2xl bg-black/20 border border-white/10">
              {scannedFile.status === 'scanning' && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="relative inline-block">
                      <div className="w-24 h-24 rounded-full border-4 border-emerald-500/30 border-t-emerald-500 animate-spin" />
                      <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-emerald-400" />
                    </div>
                    <p className="text-white/60 mt-6">Đang phân tích tài liệu với AI...</p>
                    <p className="text-white/40 text-sm mt-2">Quá trình này có thể mất vài giây</p>
                  </div>
                </div>
              )}

              {scannedFile.status === 'extracting_images' && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="relative inline-block">
                      <div className="w-24 h-24 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin" />
                      <ImageDown className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-blue-400" />
                    </div>
                    <p className="text-white/60 mt-6">Đang trích xuất hình ảnh từ PDF...</p>
                    <p className="text-white/40 text-sm mt-2">Đang chuyển đổi các trang PDF thành hình ảnh</p>
                  </div>
                </div>
              )}

              {scannedFile.status === 'success' && scannedFile.editableProducts && !selectedProduct && (
                <div className="flex-1 overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-white/10">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Package className="h-5 w-5 text-emerald-400" />
                      Sản phẩm đã phát hiện
                      <Badge variant="secondary" className="ml-2 bg-emerald-500/20 text-emerald-400">
                        {scannedFile.editableProducts.length}
                      </Badge>
                    </h2>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {scannedFile.editableProducts.map((product, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedProductIndex(index)}
                        className={`w-full text-left p-4 rounded-xl border transition-all group ${
                          importedProducts.has(index)
                            ? 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              {importedProducts.has(index) && (
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                  <CheckCircle className="h-3 w-3 mr-1" />Imported
                                </Badge>
                              )}
                              {importingProducts.has(index) && (
                                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />Importing
                                </Badge>
                              )}
                              <Badge className={`${getTypeBadgeColor(product.type)} border`}>
                                {product.type.toUpperCase()}
                              </Badge>
                              {product.product_code && (
                                <span className="text-xs text-white/40 font-mono">{product.product_code}</span>
                              )}
                              {product.images.length > 0 && (
                                <Badge variant="secondary" className="bg-white/10 text-white/50 text-xs">
                                  <ImageIcon className="h-3 w-3 mr-1" />{product.images.length}
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-medium text-white truncate group-hover:text-emerald-400 transition-colors">
                              {product.product_name}
                            </h3>
                            <p className="text-sm text-white/50 mt-1 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {product.location.address || product.location.city_province}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg font-semibold text-emerald-400">
                              {formatCurrency(product.cost, product.currency)}
                            </p>
                            <p className="text-xs text-white/40">{product.booking_duration}</p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-white/30 group-hover:text-white/60 transition-colors shrink-0 mt-2" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {scannedFile.status === 'success' && currentProduct && (
                <div className="flex-1 overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedProductIndex(null)
                          setIsEditing(false)
                          setEditForm(null)
                        }}
                        className="text-white/60 hover:text-white hover:bg-white/10 -ml-2"
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />Back
                      </Button>
                      <div className="h-4 w-px bg-white/20" />
                      <Badge className={`${getTypeBadgeColor(currentProduct.type)} border`}>
                        {currentProduct.type.toUpperCase()}
                      </Badge>
                    </div>
                    
                    {!isEditing ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={startEditing}
                        className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                      >
                        <Edit3 className="h-4 w-4 mr-1" />Edit
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelEdit}
                          className="text-white/60 hover:text-white hover:bg-white/10"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={saveEdit}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Check className="h-4 w-4 mr-1" />Save
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {isEditing && editForm ? (
                      <>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-white/60">Product Name</Label>
                            <Input
                              value={editForm.product_name}
                              onChange={(e) => updateField('product_name', e.target.value)}
                              className="bg-white/5 border-white/20 text-white placeholder:text-white/30"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-white/60">Product Code</Label>
                              <Input
                                value={editForm.product_code || ''}
                                onChange={(e) => updateField('product_code', e.target.value)}
                                className="bg-white/5 border-white/20 text-white placeholder:text-white/30"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-white/60">Type</Label>
                              <select
                                value={editForm.type}
                                onChange={(e) => updateField('type', e.target.value)}
                                className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/20 text-white"
                              >
                                <option value="billboard">Billboard</option>
                                <option value="led">LED</option>
                                <option value="digital">Digital</option>
                                <option value="banner">Banner</option>
                                <option value="poster">Poster</option>
                                <option value="transit">Transit</option>
                                <option value="other">Other</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-sm font-medium text-white/60">Pricing</h3>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label className="text-white/60">Cost</Label>
                              <Input
                                type="number"
                                value={editForm.cost}
                                onChange={(e) => updateField('cost', parseFloat(e.target.value) || 0)}
                                className="bg-white/5 border-white/20 text-white"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-white/60">Currency</Label>
                              <select
                                value={editForm.currency}
                                onChange={(e) => updateField('currency', e.target.value)}
                                className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/20 text-white"
                              >
                                <option value="VND">VND</option>
                                <option value="USD">USD</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-white/60">Duration</Label>
                              <Input
                                value={editForm.booking_duration}
                                onChange={(e) => updateField('booking_duration', e.target.value)}
                                className="bg-white/5 border-white/20 text-white"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-sm font-medium text-white/60 flex items-center gap-2">
                            <MapPin className="h-4 w-4" />Location
                          </h3>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-white/60">Full Address</Label>
                              <Input
                                value={editForm.location.address}
                                onChange={(e) => updateField('location.address', e.target.value)}
                                className="bg-white/5 border-white/20 text-white"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-white/60">Street Number</Label>
                                <Input
                                  value={editForm.location.street_number || ''}
                                  onChange={(e) => updateField('location.street_number', e.target.value)}
                                  className="bg-white/5 border-white/20 text-white"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-white/60">Street Name</Label>
                                <Input
                                  value={editForm.location.street_name || ''}
                                  onChange={(e) => updateField('location.street_name', e.target.value)}
                                  className="bg-white/5 border-white/20 text-white"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-white/60">Ward</Label>
                                <Input
                                  value={editForm.location.ward || ''}
                                  onChange={(e) => updateField('location.ward', e.target.value)}
                                  className="bg-white/5 border-white/20 text-white"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-white/60">City/Province</Label>
                                <Input
                                  value={editForm.location.city_province}
                                  onChange={(e) => updateField('location.city_province', e.target.value)}
                                  className="bg-white/5 border-white/20 text-white"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-white/60">GPS Coordinates</Label>
                              <Input
                                value={editForm.location.gps_coordinates || ''}
                                onChange={(e) => updateField('location.gps_coordinates', e.target.value)}
                                placeholder="lat,lng"
                                className="bg-white/5 border-white/20 text-white placeholder:text-white/30"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-sm font-medium text-white/60 flex items-center gap-2">
                            <Ruler className="h-4 w-4" />Dimensions
                          </h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-white/60">Width (m)</Label>
                              <Input
                                type="number"
                                step="0.1"
                                value={editForm.attributes.width}
                                onChange={(e) => setEditForm(prev => prev ? {
                                  ...prev,
                                  attributes: { ...prev.attributes, width: parseFloat(e.target.value) || 0 }
                                } : null)}
                                className="bg-white/5 border-white/20 text-white"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-white/60">Height (m)</Label>
                              <Input
                                type="number"
                                step="0.1"
                                value={editForm.attributes.height}
                                onChange={(e) => setEditForm(prev => prev ? {
                                  ...prev,
                                  attributes: { ...prev.attributes, height: parseFloat(e.target.value) || 0 }
                                } : null)}
                                className="bg-white/5 border-white/20 text-white"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="text-sm font-medium text-white/60 flex items-center gap-2">
                            <Clock className="h-4 w-4" />Operating Hours
                          </h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-white/60">From</Label>
                              <Input
                                type="time"
                                value={editForm.attributes.opera_time_from}
                                onChange={(e) => setEditForm(prev => prev ? {
                                  ...prev,
                                  attributes: { ...prev.attributes, opera_time_from: e.target.value }
                                } : null)}
                                className="bg-white/5 border-white/20 text-white"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-white/60">To</Label>
                              <Input
                                type="time"
                                value={editForm.attributes.opera_time_to}
                                onChange={(e) => setEditForm(prev => prev ? {
                                  ...prev,
                                  attributes: { ...prev.attributes, opera_time_to: e.target.value }
                                } : null)}
                                className="bg-white/5 border-white/20 text-white"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-white/60">Description</Label>
                          <Textarea
                            value={editForm.description}
                            onChange={(e) => updateField('description', e.target.value)}
                            rows={4}
                            className="bg-white/5 border-white/20 text-white placeholder:text-white/30 resize-none"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <h2 className="text-xl font-semibold text-white mb-2">{currentProduct.product_name}</h2>
                          {currentProduct.product_code && (
                            <p className="text-sm text-white/40 font-mono">Code: {currentProduct.product_code}</p>
                          )}
                        </div>

                        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-white/60">Price</p>
                              <p className="text-2xl font-bold text-emerald-400">
                                {formatCurrency(currentProduct.cost, currentProduct.currency)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-white/60">Duration</p>
                              <p className="text-white font-medium">{currentProduct.booking_duration}</p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h3 className="text-sm font-medium text-white/60 flex items-center gap-2">
                            <MapPin className="h-4 w-4" />Location
                          </h3>
                          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                            {currentProduct.location.address && (
                              <p className="text-white">{currentProduct.location.address}</p>
                            )}
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              {currentProduct.location.street_name && (
                                <div>
                                  <span className="text-white/40">Street:</span>
                                  <span className="text-white ml-2">
                                    {currentProduct.location.street_number} {currentProduct.location.street_name}
                                  </span>
                                </div>
                              )}
                              {currentProduct.location.ward && (
                                <div>
                                  <span className="text-white/40">Ward:</span>
                                  <span className="text-white ml-2">{currentProduct.location.ward}</span>
                                </div>
                              )}
                              {currentProduct.location.city_province && (
                                <div>
                                  <span className="text-white/40">City:</span>
                                  <span className="text-white ml-2">{currentProduct.location.city_province}</span>
                                </div>
                              )}
                              {currentProduct.location.gps_coordinates && (
                                <div>
                                  <span className="text-white/40">GPS:</span>
                                  <span className="text-white ml-2 font-mono text-xs">
                                    {currentProduct.location.gps_coordinates}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {(currentProduct.attributes.width > 0 || currentProduct.attributes.height > 0) && (
                          <div className="space-y-3">
                            <h3 className="text-sm font-medium text-white/60 flex items-center gap-2">
                              <Ruler className="h-4 w-4" />Dimensions
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                                <p className="text-2xl font-bold text-white">{currentProduct.attributes.width}</p>
                                <p className="text-xs text-white/40">Width (m)</p>
                              </div>
                              <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                                <p className="text-2xl font-bold text-white">{currentProduct.attributes.height}</p>
                                <p className="text-xs text-white/40">Height (m)</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {(currentProduct.attributes.opera_time_from || currentProduct.attributes.opera_time_to) && (
                          <div className="space-y-3">
                            <h3 className="text-sm font-medium text-white/60 flex items-center gap-2">
                              <Clock className="h-4 w-4" />Operating Hours
                            </h3>
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                              <p className="text-white">
                                {currentProduct.attributes.opera_time_from} - {currentProduct.attributes.opera_time_to}
                              </p>
                            </div>
                          </div>
                        )}

                        {currentProduct.description && (
                          <div className="space-y-3">
                            <h3 className="text-sm font-medium text-white/60">Description</h3>
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                              <p className="text-white/80 text-sm leading-relaxed">{currentProduct.description}</p>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-3 pt-4">
                          {selectedProductIndex !== null && importedProducts.has(selectedProductIndex) ? (
                            <Button className="flex-1 bg-emerald-600/50 text-white cursor-not-allowed" disabled>
                              <CheckCircle className="h-4 w-4 mr-2" />Already Imported
                            </Button>
                          ) : (
                            <Button 
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => selectedProductIndex !== null && handleImportProduct(selectedProductIndex)}
                              disabled={selectedProductIndex !== null && importingProducts.has(selectedProductIndex)}
                            >
                              {selectedProductIndex !== null && importingProducts.has(selectedProductIndex) ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing...
                                </>
                              ) : (
                                <>
                                  <Check className="h-4 w-4 mr-2" />Import Product
                                </>
                              )}
                            </Button>
                          )}
                          <Button 
                            variant="outline" 
                            className="border-white/20 text-white hover:bg-white/10"
                            onClick={handleSkipProduct}
                          >
                            <XCircle className="h-4 w-4 mr-2" />Skip
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {scannedFile.status === 'error' && (
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="text-center">
                    <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
                    <p className="text-red-400 font-medium mb-2">Failed to analyze document</p>
                    <p className="text-white/60 text-sm max-w-xs mx-auto">{scannedFile.error}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
