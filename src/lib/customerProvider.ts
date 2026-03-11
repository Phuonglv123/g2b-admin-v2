import { supabase } from './supabase'
import type { 
  Customer, 
  CreateCustomerParams, 
  UpdateCustomerParams,
  Provider,
  CreateProviderParams,
  UpdateProviderParams
} from '@/types/customer'

// =============================================
// CUSTOMER CRUD OPERATIONS
// =============================================

/**
 * Get all customers
 */
export async function getCustomers() {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Customer[]
}

/**
 * Get customer by ID
 */
export async function getCustomerById(id: string) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Customer
}

/**
 * Create a new customer
 */
export async function createCustomer(params: CreateCustomerParams) {
  const { data, error } = await supabase
    .from('customers')
    .insert([params])
    .select()
    .single()

  if (error) throw error
  return data as Customer
}

/**
 * Update a customer
 */
export async function updateCustomer({ id, ...params }: UpdateCustomerParams) {
  const { data, error } = await supabase
    .from('customers')
    .update(params)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Customer
}

/**
 * Delete a customer
 */
export async function deleteCustomer(id: string) {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)

  if (error) throw error
  return true
}

// =============================================
// PROVIDER CRUD OPERATIONS
// =============================================

/**
 * Get all providers
 */
export async function getProviders() {
  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Provider[]
}

/**
 * Get provider by ID
 */
export async function getProviderById(id: string) {
  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Provider
}

/**
 * Create a new provider
 */
export async function createProvider(params: CreateProviderParams) {
  const { data, error } = await supabase
    .from('providers')
    .insert([params])
    .select()
    .single()

  if (error) throw error
  return data as Provider
}

/**
 * Update a provider
 */
export async function updateProvider({ id, ...params }: UpdateProviderParams) {
  const { data, error } = await supabase
    .from('providers')
    .update(params)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Provider
}

/**
 * Delete a provider
 */
export async function deleteProvider(id: string) {
  const { error } = await supabase
    .from('providers')
    .delete()
    .eq('id', id)

  if (error) throw error
  return true
}

/**
 * Generate next provider code
 */
export async function generateProviderCode(): Promise<string> {
  const { data, error } = await supabase
    .from('providers')
    .select('code')
    .order('code', { ascending: false })
    .limit(1)

  if (error) throw error
  
  if (!data || data.length === 0) {
    return 'NCC001'
  }

  const lastCode = data[0].code
  const numPart = parseInt(lastCode.replace('NCC', ''), 10)
  const nextNum = numPart + 1
  return `NCC${nextNum.toString().padStart(3, '0')}`
}

/**
 * Find provider by name (case-insensitive search)
 */
export async function findProviderByName(name: string): Promise<Provider | null> {
  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .ilike('name', `%${name}%`)
    .limit(1)
    .single()

  if (error) {
    // No match found is not an error
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as Provider
}

/**
 * Find or create provider by name
 * Returns existing provider if found, or creates a new one
 */
export async function findOrCreateProvider(
  name: string, 
  userId: string
): Promise<Provider> {
  // First try to find existing provider
  const existing = await findProviderByName(name)
  if (existing) {
    return existing
  }

  // Create new provider
  const code = await generateProviderCode()
  const newProvider = await createProvider({
    code,
    name,
    user_id: userId,
    status: 1,
  })

  return newProvider
}
