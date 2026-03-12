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
    console.warn('⚠️ ConvertAPI secret chưa được cấu hình. Vui lòng thêm VITE_CONVERT_API_SECRET vào file .env')
    throw new Error('ConvertAPI secret chưa được cấu hình. Vui lòng thêm VITE_CONVERT_API_SECRET vào file .env')
  }

  console.log(`🔄 ConvertAPI: Converting PDF "${file.name}" (${(file.size / 1024).toFixed(1)} KB) from page ${startPage}...`)

  try {
    // Create FormData
    const formData = new FormData()
    formData.append('File', file)
    formData.append('StoreFile', 'true')
    formData.append('ImageResolution', '300') // High quality
    formData.append('ImageQuality', '90')
    
    // Only set PageRange if we want to skip pages AND we have a valid range
    // PageRange format: "2-" means from page 2 to end, but only valid if PDF has >= 2 pages
    // We'll let ConvertAPI convert all pages first, then filter on our side
    // This avoids the "PageRange set incorrectly" error when PDF has fewer pages than startPage

    console.log(`🌐 ConvertAPI: Calling API (converting all pages, will filter from page ${startPage})...`)

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
      console.error('❌ ConvertAPI error response:', response.status, errorText)
      throw new Error(`ConvertAPI error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    console.log('✅ ConvertAPI response:', result)
    
    if (!result.Files || result.Files.length === 0) {
      console.warn('⚠️ ConvertAPI: No files returned')
      throw new Error('ConvertAPI không trả về file nào')
    }

    // Map result to our format - ConvertAPI returns pages in order (1, 2, 3, ...)
    const allImages: ConvertedImage[] = result.Files.map((file: { Url: string; FileSize: number }, index: number) => ({
      pageNumber: index + 1, // Pages are 1-indexed
      url: file.Url,
      fileSize: file.FileSize,
    }))

    // Filter to only include pages from startPage onwards
    const filteredImages = allImages.filter(img => img.pageNumber >= startPage)
    
    // If endPage is specified, also filter by endPage
    const finalImages = endPage > 0 
      ? filteredImages.filter(img => img.pageNumber <= endPage)
      : filteredImages

    console.log(`✅ ConvertAPI: Converted ${allImages.length} total pages, using ${finalImages.length} pages (from page ${startPage})`)
    return finalImages
  } catch (error) {
    console.error('❌ ConvertAPI conversion error:', error)
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

  console.log(`📤 Uploading ${images.length} images to Supabase bucket 'g2b/${folderName}'...`)

  for (const image of images) {
    try {
      console.log(`📥 Downloading page ${image.pageNumber} from ConvertAPI...`)
      
      // Download image from ConvertAPI URL
      const response = await fetch(image.url)
      if (!response.ok) {
        console.error(`❌ Failed to download page ${image.pageNumber}: ${response.status}`)
        continue
      }
      
      const blob = await response.blob()
      const fileName = `${folderName}/${timestamp}_page_${image.pageNumber}.jpg`

      console.log(`📤 Uploading page ${image.pageNumber} (${(blob.size / 1024).toFixed(1)} KB) to ${fileName}...`)

      // Upload to Supabase Storage bucket 'g2b'
      const { data, error } = await supabase.storage
        .from('g2b')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: true,
        })

      if (error) {
        console.error(`❌ Failed to upload page ${image.pageNumber}:`, error)
        console.error('  Error details:', JSON.stringify(error, null, 2))
        continue
      }

      console.log(`✅ Upload success:`, data)

      // Get public URL from 'g2b' bucket
      const { data: urlData } = supabase.storage
        .from('g2b')
        .getPublicUrl(fileName)

      if (urlData?.publicUrl) {
        uploadedUrls.push(urlData.publicUrl)
        console.log(`✅ Uploaded page ${image.pageNumber}: ${urlData.publicUrl}`)
      } else {
        console.warn(`⚠️ Could not get public URL for page ${image.pageNumber}`)
      }
    } catch (error) {
      console.error(`❌ Error processing page ${image.pageNumber}:`, error)
    }
  }

  console.log(`✅ Total uploaded: ${uploadedUrls.length}/${images.length} images`)
  return uploadedUrls
}

export interface UploadResult {
  pdfUrl: string | null
  imageUrls: string[]
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
): Promise<UploadResult> {
  const result: UploadResult = {
    pdfUrl: null,
    imageUrls: []
  }

  // Step 1: Convert PDF to images using ConvertAPI
  const convertedImages = await convertPdfToImages(file, startPage)
  
  if (convertedImages.length === 0) {
    console.log('No images converted from PDF')
    return result
  }

  // Step 2: Upload images to Supabase Storage
  result.imageUrls = await uploadConvertedImages(convertedImages, productCode)
  
  return result
}
