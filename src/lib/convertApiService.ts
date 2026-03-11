import { supabase } from './supabase'

const CONVERT_API_SECRET = import.meta.env.VITE_CONVERT_API_SECRET || ''

export interface ConvertedImage {
  pageNumber: number
  url: string
  fileSize: number
}

/**
 * Convert PDF to images using ConvertAPI
 * @param file PDF file to convert
 * @param startPage Start page (1-indexed), default 1
 * @param endPage End page, default -1 (all pages)
 */
export async function convertPdfToImages(
  file: File,
  startPage: number = 1,
  endPage: number = -1
): Promise<ConvertedImage[]> {
  if (!CONVERT_API_SECRET) {
    throw new Error('ConvertAPI secret chưa được cấu hình. Vui lòng thêm VITE_CONVERT_API_SECRET vào file .env')
  }

  try {
    // Create FormData
    const formData = new FormData()
    formData.append('File', file)
    formData.append('StoreFile', 'true')
    formData.append('ImageResolution', '300') // High quality
    formData.append('ImageQuality', '90')
    
    if (startPage > 1) {
      formData.append('PageRange', endPage > 0 ? `${startPage}-${endPage}` : `${startPage}-`)
    }

    // Call ConvertAPI
    const response = await fetch(
      `https://v2.convertapi.com/convert/pdf/to/jpg?Secret=${CONVERT_API_SECRET}`,
      {
        method: 'POST',
        body: formData,
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ConvertAPI error:', errorText)
      throw new Error(`ConvertAPI error: ${response.status}`)
    }

    const result = await response.json()
    
    if (!result.Files || result.Files.length === 0) {
      throw new Error('ConvertAPI không trả về file nào')
    }

    // Map result to our format
    const images: ConvertedImage[] = result.Files.map((file: { Url: string; FileSize: number }, index: number) => ({
      pageNumber: startPage + index,
      url: file.Url,
      fileSize: file.FileSize,
    }))

    console.log(`ConvertAPI: Converted ${images.length} pages`)
    return images
  } catch (error) {
    console.error('ConvertAPI conversion error:', error)
    throw error
  }
}

/**
 * Download images from ConvertAPI URLs and upload to Supabase Storage
 * @param images Converted images from ConvertAPI
 * @param productCode Product code for folder naming
 */
export async function uploadConvertedImages(
  images: ConvertedImage[],
  productCode: string
): Promise<string[]> {
  const uploadedUrls: string[] = []
  
  // Sanitize product code for folder name
  const folderName = `products/${productCode.replace(/[^a-zA-Z0-9-_]/g, '_')}`
  const timestamp = Date.now()

  for (const image of images) {
    try {
      // Download image from ConvertAPI URL
      const response = await fetch(image.url)
      if (!response.ok) {
        console.error(`Failed to download page ${image.pageNumber}`)
        continue
      }
      
      const blob = await response.blob()
      const fileName = `${folderName}/${timestamp}_page_${image.pageNumber}.jpg`

      // Upload to Supabase Storage bucket 'g2b'
      const { error } = await supabase.storage
        .from('g2b')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: true,
        })

      if (error) {
        console.error(`Failed to upload page ${image.pageNumber}:`, error)
        continue
      }

      // Get public URL from 'g2b' bucket
      const { data: urlData } = supabase.storage
        .from('g2b')
        .getPublicUrl(fileName)

      if (urlData?.publicUrl) {
        uploadedUrls.push(urlData.publicUrl)
        console.log(`Uploaded page ${image.pageNumber}: ${urlData.publicUrl}`)
      }
    } catch (error) {
      console.error(`Error processing page ${image.pageNumber}:`, error)
    }
  }

  return uploadedUrls
}

/**
 * Convert PDF to images and upload to Supabase Storage
 * Combined function for convenience
 * @param file PDF file
 * @param productCode Product code for folder naming
 * @param startPage Start page (skip first page which is usually provider info)
 */
export async function convertAndUploadPdfImages(
  file: File,
  productCode: string,
  startPage: number = 2
): Promise<string[]> {
  // Step 1: Convert PDF to images using ConvertAPI
  const convertedImages = await convertPdfToImages(file, startPage)
  
  if (convertedImages.length === 0) {
    console.log('No images converted from PDF')
    return []
  }

  // Step 2: Upload to Supabase Storage
  const urls = await uploadConvertedImages(convertedImages, productCode)
  
  return urls
}
