import * as pdfjsLib from 'pdfjs-dist'
import { supabase } from './supabase'

// Use local worker from node_modules — Vite resolves this via import.meta.url
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export interface ExtractedImage {
  pageNumber: number
  dataUrl: string
  blob: Blob
}

export interface UploadedImage {
  pageNumber: number
  url: string
}

/**
 * Extract images from PDF pages (converts each page to an image)
 * @param file PDF file
 * @param startPage Start page (1-indexed), default 2 (skip first page which is usually provider info)
 * @param scale Image quality scale, default 2 for good quality
 */
export async function extractImagesFromPDF(
  file: File,
  startPage: number = 2,
  scale: number = 2
): Promise<ExtractedImage[]> {
  const images: ExtractedImage[] = []
  
  try {
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    
    // Load PDF
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const numPages = pdf.numPages
    
    console.log(`PDF has ${numPages} pages, extracting from page ${startPage}`)
    
    // Extract each page starting from startPage
    for (let pageNum = startPage; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale })
      
      // Create canvas
      const canvas = document.createElement('canvas')
      
      canvas.width = viewport.width
      canvas.height = viewport.height
      
      // Render page to canvas (pdfjs v5: use `canvas` param)
      await page.render({
        canvas,
        viewport,
      }).promise
      
      // Convert to data URL and blob
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9)
      })
      
      images.push({
        pageNumber: pageNum,
        dataUrl,
        blob,
      })
      
      console.log(`Extracted page ${pageNum}`)
    }
    
    return images
  } catch (error) {
    console.error('Error extracting images from PDF:', error)
    throw error
  }
}

/**
 * Upload extracted images to Supabase Storage
 * @param images Extracted images from PDF
 * @param productCode Product code for folder naming
 */
export async function uploadImagesToStorage(
  images: ExtractedImage[],
  productCode: string
): Promise<string[]> {
  const uploadedUrls: string[] = []
  
  // Sanitize product code for folder name
  const folderName = productCode.replace(/[^a-zA-Z0-9-_]/g, '_')
  const timestamp = Date.now()
  
  for (const image of images) {
    try {
      const fileName = `${folderName}/${timestamp}_page_${image.pageNumber}.jpg`
      
      // Upload to Supabase Storage (bucket: g2b, folder: products)
      const { error } = await supabase.storage
        .from('g2b')
        .upload(`products/${fileName}`, image.blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: true,
        })
      
      if (error) {
        console.error(`Failed to upload page ${image.pageNumber}:`, error)
        continue
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('g2b')
        .getPublicUrl(`products/${fileName}`)
      
      if (urlData?.publicUrl) {
        uploadedUrls.push(urlData.publicUrl)
        console.log(`Uploaded page ${image.pageNumber}: ${urlData.publicUrl}`)
      }
    } catch (error) {
      console.error(`Error uploading page ${image.pageNumber}:`, error)
    }
  }
  
  return uploadedUrls
}

/**
 * Extract images from PDF and upload to storage
 * Combined function for convenience
 */
export async function extractAndUploadPDFImages(
  file: File,
  productCode: string,
  startPage: number = 2
): Promise<string[]> {
  // Extract images
  const images = await extractImagesFromPDF(file, startPage)
  
  if (images.length === 0) {
    console.log('No images extracted from PDF')
    return []
  }
  
  // Upload to storage
  const urls = await uploadImagesToStorage(images, productCode)
  
  return urls
}
