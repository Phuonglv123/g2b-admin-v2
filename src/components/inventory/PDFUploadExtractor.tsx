import { useState, useRef, useCallback } from 'react'
import {
  Upload,
  FileText,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
  File,
  Image as ImageIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { extractProductFromFile, type ExtractedPDFData, type ExtractionResult } from '@/lib/claudeService'

interface PDFUploadExtractorProps {
  onExtracted: (data: ExtractedPDFData, file: File) => void
  onError?: (error: string) => void
  disabled?: boolean
}

type UploadStatus = 'idle' | 'uploading' | 'extracting' | 'success' | 'error'

interface FileStatus {
  file: File
  status: UploadStatus
  result?: ExtractionResult
}

export const PDFUploadExtractor = ({
  onExtracted,
  onError,
  disabled = false,
}: PDFUploadExtractorProps) => {
  const [files, setFiles] = useState<FileStatus[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle file selection
  const handleFileSelect = useCallback((selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return

    const newFiles: FileStatus[] = Array.from(selectedFiles).map((file) => ({
      file,
      status: 'idle' as UploadStatus,
    }))

    setFiles((prev) => [...prev, ...newFiles])
  }, [])

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

  // Remove file from list
  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // Extract data from a single file
  const extractFile = useCallback(
    async (index: number) => {
      const fileStatus = files[index]
      if (!fileStatus || fileStatus.status === 'extracting') return

      // Update status to extracting
      setFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, status: 'extracting' as UploadStatus } : f))
      )

      try {
        const result = await extractProductFromFile(fileStatus.file)

        setFiles((prev) =>
          prev.map((f, i) =>
            i === index
              ? {
                  ...f,
                  status: result.success ? ('success' as UploadStatus) : ('error' as UploadStatus),
                  result,
                }
              : f
          )
        )

        if (result.success && result.data) {
          onExtracted(result.data, fileStatus.file)
        } else if (result.error) {
          onError?.(result.error)
        }
      } catch (error) {
        setFiles((prev) =>
          prev.map((f, i) =>
            i === index
              ? {
                  ...f,
                  status: 'error' as UploadStatus,
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
    },
    [files, onExtracted, onError]
  )

  // Extract all pending files
  const extractAll = useCallback(async () => {
    for (let i = 0; i < files.length; i++) {
      if (files[i].status === 'idle') {
        await extractFile(i)
      }
    }
  }, [files, extractFile])

  // Get file icon based on type
  const getFileIcon = (file: File) => {
    if (file.type === 'application/pdf') {
      return <FileText className="h-5 w-5 text-red-500" />
    }
    if (file.type.startsWith('image/')) {
      return <ImageIcon className="h-5 w-5 text-blue-500" />
    }
    return <File className="h-5 w-5 text-gray-500" />
  }

  // Get status icon
  const getStatusIcon = (status: UploadStatus) => {
    switch (status) {
      case 'extracting':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const hasIdleFiles = files.some((f) => f.status === 'idle')
  const isProcessing = files.some((f) => f.status === 'extracting')

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 cursor-pointer
          ${isDragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
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

        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-full bg-primary/10 p-4">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="font-medium">Drag and drop PDF or image files here</p>
            <p className="text-sm text-muted-foreground mt-1">
              Or click to select files • Supports PDF, PNG, JPG, WebP
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-4 w-4 text-yellow-500" />
            <span>Using Claude AI for automatic extraction</span>
          </div>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Selected files ({files.length})</p>
            {hasIdleFiles && (
              <Button
                size="sm"
                onClick={extractAll}
                disabled={isProcessing || disabled}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Extract all
                  </>
                )}
              </Button>
            )}
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {files.map((fileStatus, index) => (
              <div
                key={`${fileStatus.file.name}-${index}`}
                className={`
                  flex items-center gap-3 p-3 rounded-lg border transition-colors
                  ${fileStatus.status === 'success' ? 'bg-green-500/5 border-green-500/30' : ''}
                  ${fileStatus.status === 'error' ? 'bg-red-500/5 border-red-500/30' : ''}
                  ${fileStatus.status === 'idle' ? 'bg-card border-border' : ''}
                  ${fileStatus.status === 'extracting' ? 'bg-primary/5 border-primary/30' : ''}
                `}
              >
                {getFileIcon(fileStatus.file)}
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{fileStatus.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(fileStatus.file.size)}
                    {fileStatus.status === 'error' && fileStatus.result?.error && (
                      <span className="text-red-500 ml-2">• {fileStatus.result.error}</span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {getStatusIcon(fileStatus.status)}
                  
                  {fileStatus.status === 'idle' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        extractFile(index)
                      }}
                      disabled={disabled}
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFile(index)
                    }}
                    disabled={fileStatus.status === 'extracting'}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="rounded-lg bg-muted/50 p-4">
        <h4 className="font-medium text-sm mb-2">💡 Tips for best results:</h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• PDF files should have clear text, not blurry scans</li>
          <li>• Images should be high resolution, not blurry</li>
          <li>• Size and price information should be clearly stated in the document</li>
          <li>• AI will automatically fill in missing fields with default values</li>
        </ul>
      </div>
    </div>
  )
}

export default PDFUploadExtractor
