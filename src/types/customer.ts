// Customer types
export interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  address: string | null
  city: string | null
  country: string
  tax_code: string | null
  contact_person: string | null
  contact_phone: string | null
  status: 'active' | 'inactive' | 'potential'
  customer_type: 'individual' | 'company' | 'agency'
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CreateCustomerParams {
  name: string
  email?: string
  phone?: string
  company?: string
  address?: string
  city?: string
  country?: string
  tax_code?: string
  contact_person?: string
  contact_phone?: string
  status?: 'active' | 'inactive' | 'potential'
  customer_type?: 'individual' | 'company' | 'agency'
  notes?: string
}

export interface UpdateCustomerParams extends Partial<CreateCustomerParams> {
  id: string
}

// Provider types - matching existing database schema
export interface Provider {
  id: string
  code: string
  name: string
  tax: string | null
  address: string | null
  phone: string | null
  response: string | null
  major: string[] | null
  type: string[] | null
  priority: number | null
  user_id: string
  status: number
  responses: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface CreateProviderParams {
  code: string
  name: string
  tax?: string
  address?: string
  phone?: string
  response?: string
  major?: string[]
  type?: string[]
  priority?: number
  user_id: string
  status?: number
  responses?: Record<string, unknown>
}

export interface UpdateProviderParams extends Partial<Omit<CreateProviderParams, 'user_id'>> {
  id: string
}
