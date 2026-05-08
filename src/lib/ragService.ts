import type { ProductWithRelations } from '@/types/product'

const CLAUDE_PROXY_URL = import.meta.env.VITE_CLAUDE_PROXY_URL || 'http://localhost:3001'

export interface RagSyncResult {
  success: boolean
  error?: string
  indexedChunks?: number
  deletedProductIds?: number
}

function toRagPayloadProduct(product: ProductWithRelations) {
  return {
    id: product.id,
    provider_id: product.provider_id,
    provider_name: product.provider_name,
    product_name: product.product_name,
    product_code: product.product_code,
    city_province: product.city_province,
    ward: product.ward,
    type: product.type,
    location_name: product.location_name,
    location_address: product.location_address,
    street_number: product.street_number,
    street_name: product.street_name,
    landmark: product.landmark,
    gps_coordinates: product.gps_coordinates,
    cost: product.cost,
    currency: product.currency,
    traffic: product.traffic,
    booking_duration: product.booking_duration,
    production_cost: product.production_cost,
    local_tax: product.local_tax,
    description: product.description,
    attributes: product.attributes,
  }
}

export async function ragIndexProducts(products: ProductWithRelations[]): Promise<RagSyncResult> {
  try {
    if (products.length === 0) {
      return { success: true, indexedChunks: 0 }
    }

    const response = await fetch(`${CLAUDE_PROXY_URL}/api/rag-index-products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        products: products.map(toRagPayloadProduct),
      }),
    })

    const result = await response.json().catch(() => null)

    if (!response.ok || !result?.success) {
      return {
        success: false,
        error: result?.error || `RAG index failed (${response.status})`,
      }
    }

    return {
      success: true,
      indexedChunks: result?.data?.indexedChunks ?? 0,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown RAG index error',
    }
  }
}

export async function ragDeleteProducts(productIds: string[]): Promise<RagSyncResult> {
  try {
    if (productIds.length === 0) {
      return { success: true, deletedProductIds: 0 }
    }

    const response = await fetch(`${CLAUDE_PROXY_URL}/api/rag-delete-products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productIds }),
    })

    const result = await response.json().catch(() => null)

    if (!response.ok || !result?.success) {
      return {
        success: false,
        error: result?.error || `RAG delete failed (${response.status})`,
      }
    }

    return {
      success: true,
      deletedProductIds: result?.data?.deletedProductIds ?? productIds.length,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown RAG delete error',
    }
  }
}
