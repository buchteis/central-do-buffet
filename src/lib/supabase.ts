// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// Tipos gerados (opcional)
export type Database = {
  public: {
    Tables: {
      integration_providers: {
        Row: {
          id: string
          name: string
          slug: string
          category: string
          auth_type: string
          logo_url: string | null
          description: string | null
          website: string | null
          enabled: boolean
          config_schema: Record<string, any>
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          category: string
          auth_type: string
          logo_url?: string | null
          description?: string | null
          website?: string | null
          enabled?: boolean
          config_schema?: Record<string, any>
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          category?: string
          auth_type?: string
          logo_url?: string | null
          description?: string | null
          website?: string | null
          enabled?: boolean
          config_schema?: Record<string, any>
          created_at?: string
        }
      }
      company_integrations: {
        Row: {
          id: string
          company_id: string
          provider_id: string
          credentials: Record<string, any>
          status: 'disconnected' | 'connected' | 'error'
          last_sync_at: string | null
          error_message: string | null
          connected_at: string | null
          updated_at: string
          config: Record<string, any>
        }
        Insert: {
          id?: string
          company_id: string
          provider_id: string
          credentials?: Record<string, any>
          status?: 'disconnected' | 'connected' | 'error'
          last_sync_at?: string | null
          error_message?: string | null
          connected_at?: string | null
          updated_at?: string
          config?: Record<string, any>
        }
        Update: {
          id?: string
          company_id?: string
          provider_id?: string
          credentials?: Record<string, any>
          status?: 'disconnected' | 'connected' | 'error'
          last_sync_at?: string | null
          error_message?: string | null
          connected_at?: string | null
          updated_at?: string
          config?: Record<string, any>
        }
      }
    }
  }
}
