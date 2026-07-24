// src/lib/types.ts
export type IntegrationProvider = {
  id: string
  name: string
  slug: string
  category: 'fiscal' | 'payment' | 'calendar' | 'whatsapp' | 'email' | 'automation'
  auth_type: 'api_key' | 'oauth' | 'token' | 'custom'
  logo_url?: string
  description?: string
  website?: string
  enabled: boolean
  config_schema: Record<string, any>
  created_at: string
}

export type CompanyIntegration = {
  id: string
  company_id: string
  provider_id: string
  credentials: Record<string, any>
  status: 'disconnected' | 'connected' | 'error'
  last_sync_at?: string
  error_message?: string
  connected_at?: string
  updated_at: string
  config: Record<string, any>
  provider?: IntegrationProvider
}

export type IntegrationCategory = {
  id: string
  name: string
  icon: string
  providers: IntegrationProvider[]
}

export type IntegrationFormField = {
  type: 'string' | 'select' | 'password'
  label: string
  required: boolean
  options?: string[]
}

export type IntegrationTestResult = {
  success: boolean
  message: string
  data?: any
}
