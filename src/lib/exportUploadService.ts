import { supabase } from './supabase'
import { generateExcelBuffer } from './excelExportService'
import type { ProductWithRelations } from '@/types/product'

const PROXY_URL = import.meta.env.VITE_CLAUDE_PROXY_URL || 'http://localhost:3001'

export interface AutoExportResult {
  excelUrl: string | null
  pptxUrl: string | null
  pdfUrl: string | null
  slideUrl: string | null
  errors: string[]
}

interface ExportMetaData {
  brand?: string
  agency?: string
  market?: string
  duration?: string
  sender?: string
  phoneNumber?: string
  email?: string
  sendingDate?: string
}

/**
 * Auto-generate Excel, PPT, and PDF files from products,
 * upload to Supabase Storage, and return download URLs.
 *
 * - Excel: generated client-side with ExcelJS, uploaded directly
 * - PPT + PDF: generated server-side via Google Slides API, uploaded by server
 */
export async function autoExportAndUpload(
  products: ProductWithRelations[],
  providerName: string,
  meta?: ExportMetaData,
  onProgress?: (step: string) => void,
): Promise<AutoExportResult> {
  const result: AutoExportResult = {
    excelUrl: null,
    pptxUrl: null,
    pdfUrl: null,
    slideUrl: null,
    errors: [],
  }

  if (!products.length) {
    result.errors.push('No products to export')
    return result
  }

  const sanitizedProvider = providerName
    .replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF -]/g, '_')
    .substring(0, 50)
  const timestamp = Date.now()
  const folderPath = `exports/${sanitizedProvider}/${timestamp}`

  // Step 1: Generate and upload Excel (client-side)
  onProgress?.('Generating Excel quotation...')
  try {
    const excelBuffer = await generateExcelBuffer(products, meta)
    const firstType = products[0]?.type || 'products'
    const excelFileName = `Quotation_${firstType}_${new Date().getFullYear()}.xlsx`
    const excelPath = `${folderPath}/${excelFileName}`

    const { error: uploadError } = await supabase.storage
      .from('g2b')
      .upload(excelPath, new Blob([excelBuffer]), {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        cacheControl: '3600',
        upsert: true,
      })

    if (uploadError) {
      throw uploadError
    }

    const { data: urlData } = supabase.storage
      .from('g2b')
      .getPublicUrl(excelPath)
    result.excelUrl = urlData?.publicUrl || null
    console.log(`✅ Excel uploaded: ${result.excelUrl}`)
  } catch (excelError) {
    const msg = excelError instanceof Error ? excelError.message : 'Excel export failed'
    console.error('❌ Excel export/upload failed:', msg)
    result.errors.push(`Excel: ${msg}`)
  }

  // Step 2: Generate PPT + PDF via server and upload (server-side)
  onProgress?.('Generating PPT & PDF presentation...')
  try {
    const response = await fetch(`${PROXY_URL}/api/export-and-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products, providerName }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Server export failed' }))
      throw new Error(err.error || `Export failed with status ${response.status}`)
    }

    const serverResult = await response.json()
    if (serverResult.success && serverResult.data) {
      result.pptxUrl = serverResult.data.pptxUrl || null
      result.pdfUrl = serverResult.data.pdfUrl || null
      result.slideUrl = serverResult.data.slideUrl || null

      if (serverResult.data.errors?.length) {
        result.errors.push(...serverResult.data.errors)
      }

      console.log(`✅ PPT/PDF export complete`, {
        pptx: result.pptxUrl,
        pdf: result.pdfUrl,
      })
    } else {
      throw new Error(serverResult.error || 'Server export returned no data')
    }
  } catch (serverError) {
    const msg = serverError instanceof Error ? serverError.message : 'PPT/PDF export failed'
    console.error('❌ PPT/PDF export failed:', msg)
    result.errors.push(`PPT/PDF: ${msg}`)
  }

  return result
}
