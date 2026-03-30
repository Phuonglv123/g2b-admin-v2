import type { ProductWithRelations } from '@/types/product'

const PROXY_URL = import.meta.env.VITE_CLAUDE_PROXY_URL || 'http://localhost:3001'

export interface SlideExportResult {
  presentationId: string
  slideUrl: string
  exportUrl: string
  downloadUrl: string
  fileName: string
  productCount?: number
}

/**
 * Export a single product to Google Slides
 */
export async function exportProductToSlides(product: ProductWithRelations): Promise<SlideExportResult> {
  const response = await fetch(`${PROXY_URL}/api/export-slides`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Export failed' }))
    throw new Error(err.error || `Export failed with status ${response.status}`)
  }

  const result = await response.json()
  if (!result.success) {
    throw new Error(result.error || 'Export failed')
  }

  const data = result.data as SlideExportResult
  data.downloadUrl = `${PROXY_URL}/api/export-slides/download/${data.presentationId}`
  return data
}

/**
 * Export multiple products to Google Slides (batch)
 */
export async function exportMultipleProductsToSlides(products: ProductWithRelations[]): Promise<SlideExportResult> {
  const response = await fetch(`${PROXY_URL}/api/export-slides-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ products }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Export failed' }))
    throw new Error(err.error || `Export failed with status ${response.status}`)
  }

  const result = await response.json()
  if (!result.success) {
    throw new Error(result.error || 'Export failed')
  }

  const data = result.data as SlideExportResult
  data.downloadUrl = `${PROXY_URL}/api/export-slides/download/${data.presentationId}`
  return data
}
