import { useState, useRef } from 'react'
import { Plus, Upload, Trash2, GripVertical, Image as ImageIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

interface ImageEditorProps {
  images: string[]
  onChange: (images: string[]) => void
  productCode?: string
  maxImages?: number
  disabled?: boolean
  className?: string
}

export const ImageEditor: React.FC<ImageEditorProps> = ({
  images = [],
  onChange,
  productCode = 'product',
  maxImages = 10,
  disabled = false,
  className = '',
}) => {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Upload image to Supabase Storage
  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const timestamp = Date.now()
      const fileName = `${productCode}/${timestamp}.${fileExt}`

      const { data, error } = await supabase.storage
        .from('g2b')
        .upload(`products/${fileName}`, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (error) {
        console.error('Upload error:', error)
        throw error
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('g2b')
        .getPublicUrl(data.path)

      return urlData.publicUrl
    } catch (error) {
      console.error('Error uploading image:', error)
      return null
    }
  }

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const remainingSlots = maxImages - images.length
    if (remainingSlots <= 0) {
      setUploadError(`Maximum ${maxImages} images allowed`)
      return
    }

    setIsUploading(true)
    setUploadError(null)

    const filesToUpload = Array.from(files).slice(0, remainingSlots)
    const uploadedUrls: string[] = []

    for (const file of filesToUpload) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        continue
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setUploadError('Each image must be less than 5MB')
        continue
      }

      const url = await uploadImage(file)
      if (url) {
        uploadedUrls.push(url)
      }
    }

    if (uploadedUrls.length > 0) {
      onChange([...images, ...uploadedUrls])
    }

    setIsUploading(false)
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Add image by URL
  const handleAddUrl = () => {
    if (!urlInput.trim()) return

    // Validate URL
    try {
      new URL(urlInput)
    } catch {
      setUploadError('Invalid URL format')
      return
    }

    if (images.length >= maxImages) {
      setUploadError(`Maximum ${maxImages} images allowed`)
      return
    }

    onChange([...images, urlInput.trim()])
    setUrlInput('')
    setUploadError(null)
  }

  // Remove image
  const handleRemove = (index: number) => {
    const newImages = images.filter((_, i) => i !== index)
    onChange(newImages)
  }

  // Drag and drop handlers for reordering
  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newImages = [...images]
    const draggedItem = newImages[draggedIndex]
    newImages.splice(draggedIndex, 1)
    newImages.splice(index, 0, draggedItem)
    
    onChange(newImages)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  // Set as primary (move to first position)
  const handleSetPrimary = (index: number) => {
    if (index === 0) return
    const newImages = [...images]
    const [item] = newImages.splice(index, 1)
    newImages.unshift(item)
    onChange(newImages)
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          Product Images ({images.length}/{maxImages})
        </Label>
      </div>

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((url, index) => (
            <div
              key={`${url}-${index}`}
              draggable={!disabled}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`relative group aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-move
                ${index === 0 ? 'border-primary ring-2 ring-primary/20' : 'border-border'}
                ${draggedIndex === index ? 'opacity-50 scale-95' : ''}
                ${disabled ? 'cursor-default' : ''}
              `}
            >
              {/* Image */}
              <img
                src={url}
                alt={`Product image ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23374151" width="100" height="100"/><text fill="%239CA3AF" x="50" y="55" text-anchor="middle" font-size="12">Error</text></svg>'
                }}
              />

              {/* Primary Badge */}
              {index === 0 && (
                <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-primary text-primary-foreground text-xs rounded">
                  Primary
                </div>
              )}

              {/* Overlay Actions */}
              {!disabled && (
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  <GripVertical className="h-4 w-4 text-white/70 absolute top-1 left-1" />
                  
                  {index !== 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetPrimary(index)}
                      className="h-7 px-2 text-xs text-white hover:bg-white/20"
                    >
                      Set Primary
                    </Button>
                  )}
                  
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(index)}
                    className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {images.length === 0 && (
        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
          <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No images yet</p>
          <p className="text-xs text-muted-foreground mt-1">Upload or add by URL</p>
        </div>
      )}

      {/* Upload Controls */}
      {!disabled && images.length < maxImages && (
        <div className="space-y-2">
          {/* File Upload */}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              disabled={disabled || isUploading}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading}
              className="flex-1"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Images
                </>
              )}
            </Button>
          </div>

          {/* URL Input */}
          <div className="flex gap-2">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Or paste image URL..."
              disabled={disabled || isUploading}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddUrl())}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleAddUrl}
              disabled={disabled || isUploading || !urlInput.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {uploadError && (
        <p className="text-sm text-red-500">{uploadError}</p>
      )}

      {/* Help Text */}
      <p className="text-xs text-muted-foreground">
        Drag to reorder. First image is primary. Max 5MB per image.
      </p>
    </div>
  )
}

export default ImageEditor
