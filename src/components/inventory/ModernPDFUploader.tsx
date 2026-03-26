import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Upload,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Save,
  Zap,
  FileText,
  Calendar,
  DollarSign,
  Tag,
  Building2,
  MapPin,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { extractProductFromFile, type ExtractedPDFData, type ExtractionResult, type DetectedItem } from '@/lib/claudeService'

interface FileCardProps {
  onExtracted: (data: ExtractedPDFData, file: File) => void
  onError?: (error: string) => void
  disabled?: boolean
}

type AnalysisStatus = 'idle' | 'analyzing' | 'success' | 'error'

interface FileData {
  file: File
  preview: string
  status: AnalysisStatus
  result?: ExtractionResult
  extractedData?: ExtractedPDFData
}

// Form data interface for extracted/editable fields
interface FormData {
  name: string
  merchant: string
  description: string
  total: string
  currency: string
  type: string
  issuedAt: string
  category: string
  project: string
  vatAmount: string
}

export const ModernPDFUploader = ({
  onExtracted,
  onError,
  disabled = false,
}: FileCardProps) => {
  const [files, setFiles] = useState<FileData[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isDragOver, setIsDragOver] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    name: '',
    merchant: '',
    description: '',
    total: '',
    currency: 'VND',
    type: 'Expense',
    issuedAt: new Date().toISOString().split('T')[0],
    category: '',
    project: '',
    vatAmount: '',
  })
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([])
  const [showAllItems, setShowAllItems] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentFile = files[currentIndex]

  // Generate preview URL for file
  const createPreview = useCallback((file: File): string => {
    if (file.type.startsWith('image/')) {
      return URL.createObjectURL(file)
    }
    // For PDF, we'll use a placeholder or first page thumbnail
    return '/pdf-preview.png'
  }, [])

  // Handle file selection
  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return

    const newFiles: FileData[] = Array.from(selectedFiles).map((file) => ({
      file,
      preview: createPreview(file),
      status: 'idle' as AnalysisStatus,
    }))

    setFiles((prev) => [...prev, ...newFiles])
  }, [createPreview])

  // Cleanup preview URLs
  useEffect(() => {
    return () => {
      files.forEach(f => {
        if (f.preview && f.preview.startsWith('blob:')) {
          URL.revokeObjectURL(f.preview)
        }
      })
    }
  }, [files])

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      handleFileSelect(e.dataTransfer.files)
    },
    [handleFileSelect]
  )

  // Remove file
  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const newFiles = prev.filter((_, i) => i !== index)
      if (currentIndex >= newFiles.length && newFiles.length > 0) {
        setCurrentIndex(newFiles.length - 1)
      }
      return newFiles
    })
  }, [currentIndex])

  // Analyze file
  const analyzeFile = useCallback(async (index: number) => {
    const fileData = files[index]
    if (!fileData || fileData.status === 'analyzing') return

    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, status: 'analyzing' as AnalysisStatus } : f))
    )

    try {
      const result = await extractProductFromFile(fileData.file)

      setFiles((prev) =>
        prev.map((f, i) =>
          i === index
            ? {
                ...f,
                status: result.success ? 'success' : 'error',
                result,
                extractedData: result.data,
              }
            : f
        )
      )

      if (result.success && result.data) {
        // Populate form with extracted data
        const firstProduct = result.data.products[0]
        setFormData({
          name: firstProduct?.product_name || '',
          merchant: result.data.provider_name || '',
          description: firstProduct?.description || '',
          total: firstProduct?.cost?.toString() || '',
          currency: firstProduct?.currency || 'VND',
          type: 'Expense',
          issuedAt: new Date().toISOString().split('T')[0],
          category: firstProduct?.type || '',
          project: firstProduct?.areas?.[0] || '',
          vatAmount: '',
        })
        setDetectedItems(result.data.detected_items || [])
      } else if (result.error) {
        onError?.(result.error)
      }
    } catch (error) {
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index
            ? {
                ...f,
                status: 'error',
                result: {
                  success: false,
                  error: error instanceof Error ? error.message : 'Unknown error',
                },
              }
            : f
        )
      )
      onError?.(error instanceof Error ? error.message : 'Unknown error')
    }
  }, [files, onError])

  // Analyze all files
  const analyzeAll = useCallback(async () => {
    for (let i = 0; i < files.length; i++) {
      if (files[i].status === 'idle') {
        await analyzeFile(i)
      }
    }
  }, [files, analyzeFile])

  // Save current file data
  const saveFile = useCallback(() => {
    if (currentFile?.extractedData) {
      onExtracted(currentFile.extractedData, currentFile.file)
    }
  }, [currentFile, onExtracted])

  // Save all files
  const saveAll = useCallback(() => {
    files.forEach(f => {
      if (f.status === 'success' && f.extractedData) {
        onExtracted(f.extractedData, f.file)
      }
    })
  }, [files, onExtracted])

  const hasIdleFiles = files.some((f) => f.status === 'idle')
  const isAnalyzing = files.some((f) => f.status === 'analyzing')
  const hasSuccessFiles = files.some((f) => f.status === 'success')

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  if (files.length === 0) {
    // Empty state - show drop zone
    return (
      <div
        className={`
          relative border-2 border-dashed rounded-2xl p-12 transition-all duration-300 cursor-pointer
          ${isDragOver 
            ? 'border-primary bg-primary/5 scale-[1.02]' 
            : 'border-border/50 hover:border-primary/50 hover:bg-muted/30'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
          disabled={disabled}
        />

        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-full bg-gradient-to-br from-primary/20 to-primary/5 p-6">
            <Upload className="h-10 w-10 text-primary" />
          </div>
          <div>
            <p className="text-lg font-semibold">Drop files here or click to upload</p>
            <p className="text-sm text-muted-foreground mt-1">
              Supports PDF, PNG, JPG, WebP • Multiple files allowed
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-4 py-2 rounded-full">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Powered by Claude AI for intelligent extraction</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            You have <span className="font-semibold text-foreground">{files.length} unsorted files</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasSuccessFiles && (
            <Button
              variant="outline"
              size="sm"
              onClick={saveAll}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              Save all
            </Button>
          )}
          {hasIdleFiles && (
            <Button
              size="sm"
              onClick={analyzeAll}
              disabled={isAnalyzing || disabled}
              className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
            >
              <Zap className="h-4 w-4" />
              Analyze all
            </Button>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left side - File preview */}
        <div className="space-y-4">
          {/* File thumbnail with scanning effect */}
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 border border-border/50 shadow-xl">
            {currentFile?.file.type.startsWith('image/') ? (
              <img
                src={currentFile.preview}
                alt={currentFile.file.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <FileText className="h-24 w-24 text-slate-600" />
              </div>
            )}
            
            {/* Scanning animation overlay */}
            {currentFile?.status === 'analyzing' && (
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-scan" />
                <div className="absolute inset-0 bg-emerald-500/5" />
              </div>
            )}

            {/* Status badge */}
            {currentFile && (
              <div className="absolute top-3 right-3">
                {currentFile.status === 'analyzing' && (
                  <div className="flex items-center gap-2 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-xs text-white">Analyzing...</span>
                  </div>
                )}
                {currentFile.status === 'success' && (
                  <div className="flex items-center gap-2 bg-emerald-500/90 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    <CheckCircle className="h-4 w-4 text-white" />
                    <span className="text-xs text-white">Completed</span>
                  </div>
                )}
                {currentFile.status === 'error' && (
                  <div className="flex items-center gap-2 bg-red-500/90 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    <AlertCircle className="h-4 w-4 text-white" />
                    <span className="text-xs text-white">Error</span>
                  </div>
                )}
              </div>
            )}

            {/* Remove button */}
            <button
              onClick={() => removeFile(currentIndex)}
              className="absolute top-3 left-3 p-1.5 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full transition-colors"
            >
              <X className="h-4 w-4 text-white" />
            </button>

            {/* Green scan line effect */}
            {currentFile?.status === 'analyzing' && (
              <div className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_5px_rgba(52,211,153,0.4)] animate-scanline" />
            )}
          </div>

          {/* File info */}
          {currentFile && (
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
              <FileText className="h-5 w-5 text-red-500" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{currentFile.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  Type: {currentFile.file.type || 'Unknown'} • Size: {formatFileSize(currentFile.file.size)}
                </p>
              </div>
              {currentFile.status === 'idle' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => analyzeFile(currentIndex)}
                  disabled={disabled}
                  className="gap-1"
                >
                  <Sparkles className="h-4 w-4" />
                  Analyze
                </Button>
              )}
            </div>
          )}

          {/* File thumbnails */}
          {files.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {files.map((f, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`
                    relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all
                    ${idx === currentIndex 
                      ? 'border-primary ring-2 ring-primary/20' 
                      : 'border-border/50 hover:border-primary/50'}
                  `}
                >
                  {f.file.type.startsWith('image/') ? (
                    <img src={f.preview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  {f.status === 'success' && (
                    <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                    </div>
                  )}
                  {f.status === 'analyzing' && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    </div>
                  )}
                </button>
              ))}
              {/* Add more button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-shrink-0 w-16 h-16 rounded-lg border-2 border-dashed border-border/50 hover:border-primary/50 flex items-center justify-center transition-all"
              >
                <Upload className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>

        {/* Right side - Extracted data form */}
        <div className="space-y-4">
          {/* Analyzing indicator */}
          {currentFile?.status === 'analyzing' && (
            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-violet-500/10 to-indigo-500/10 rounded-xl border border-violet-500/20">
              <div className="relative">
                <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                <div className="absolute inset-0 animate-ping">
                  <Loader2 className="h-6 w-6 text-violet-500/30" />
                </div>
              </div>
              <div>
                <p className="font-medium text-sm">Analyzing document...</p>
                <p className="text-xs text-muted-foreground">Claude AI is extracting data from your file</p>
              </div>
            </div>
          )}

          {/* Form fields */}
          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                Name
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Document name"
                className="bg-primary/5 border-primary/20 focus:border-primary"
              />
            </div>

            {/* Merchant */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Merchant
              </label>
              <Input
                value={formData.merchant}
                onChange={(e) => setFormData(prev => ({ ...prev, merchant: e.target.value }))}
                placeholder="Company/Provider name"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Description
              </label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description"
              />
            </div>

            {/* Total, Currency, Type row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  Total
                </label>
                <Input
                  value={formData.total}
                  onChange={(e) => setFormData(prev => ({ ...prev, total: e.target.value }))}
                  placeholder="0.00"
                  type="text"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Currency</label>
                <div className="relative">
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm appearance-none cursor-pointer"
                  >
                    <option value="VND">🇻🇳 VND</option>
                    <option value="USD">🇺🇸 USD</option>
                    <option value="EUR">🇪🇺 EUR</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <div className="relative">
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm appearance-none cursor-pointer"
                  >
                    <option value="Expense">⬇️ Expense</option>
                    <option value="Income">⬆️ Income</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Issued At */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Issued At
              </label>
              <Input
                type="date"
                value={formData.issuedAt}
                onChange={(e) => setFormData(prev => ({ ...prev, issuedAt: e.target.value }))}
              />
            </div>

            {/* Category & Project row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="e.g., Billboard, LED"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Project</label>
                <Input
                  value={formData.project}
                  onChange={(e) => setFormData(prev => ({ ...prev, project: e.target.value }))}
                  placeholder="Project name"
                />
              </div>
            </div>

            {/* VAT Amount */}
            <div className="space-y-2">
              <label className="text-sm font-medium">VAT Amount</label>
              <Input
                value={formData.vatAmount}
                onChange={(e) => setFormData(prev => ({ ...prev, vatAmount: e.target.value }))}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Detected Items */}
          {detectedItems.length > 0 && (
            <div className="space-y-3">
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowAllItems(!showAllItems)}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-semibold text-amber-600">Detected items</span>
                </div>
                {showAllItems ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              
              <div className="space-y-2 p-3 bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-violet-950/30 dark:to-fuchsia-950/30 rounded-xl border border-violet-200/50 dark:border-violet-800/30">
                {(showAllItems ? detectedItems : detectedItems.slice(0, 3)).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-violet-100 dark:border-violet-800/30 last:border-0">
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">
                      {item.value}
                    </span>
                  </div>
                ))}
                {!showAllItems && detectedItems.length > 3 && (
                  <p className="text-xs text-center text-muted-foreground pt-1">
                    +{detectedItems.length - 3} more items
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Save button */}
          {currentFile?.status === 'success' && (
            <Button
              onClick={saveFile}
              className="w-full gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
            >
              <Save className="h-4 w-4" />
              Save Document
            </Button>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
        disabled={disabled}
      />

      {/* Scanning animation styles */}
      <style>{`
        @keyframes scanline {
          0% {
            top: 0%;
          }
          100% {
            top: 100%;
          }
        }
        .animate-scanline {
          animation: scanline 2s linear infinite;
        }
        @keyframes scan {
          0%, 100% {
            transform: translateY(-100%);
          }
          50% {
            transform: translateY(100vh);
          }
        }
        .animate-scan {
          animation: scan 2s linear infinite;
        }
      `}</style>
    </div>
  )
}

export default ModernPDFUploader
