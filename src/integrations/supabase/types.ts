export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      additional_items: {
        Row: {
          active: boolean
          created_at: string
          default_qty: number
          id: string
          name: string
          owner_id: string
          position: number
          product_id: string | null
          tenant_id: string
          unit: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_qty?: number
          id?: string
          name: string
          owner_id: string
          position?: number
          product_id?: string | null
          tenant_id: string
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          default_qty?: number
          id?: string
          name?: string
          owner_id?: string
          position?: number
          product_id?: string | null
          tenant_id?: string
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "additional_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "additional_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      buffet_settings: {
        Row: {
          address: string | null
          bank_account: string | null
          bank_agency: string | null
          bank_holder: string | null
          bank_name: string | null
          business_name: string | null
          cnpj: string | null
          contract_template: string | null
          created_at: string
          google_place_id: string | null
          installments_default_count: number
          installments_due_day: number | null
          logo_url: string | null
          owner_id: string
          phone: string | null
          pix_holder: string | null
          pix_key: string | null
          tenant_id: string | null
          updated_at: string
          wa_installment_template: string | null
          wa_pix_template: string | null
          wa_quote_template: string | null
          wa_reminder_template: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_holder?: string | null
          bank_name?: string | null
          business_name?: string | null
          cnpj?: string | null
          contract_template?: string | null
          created_at?: string
          google_place_id?: string | null
          installments_default_count?: number
          installments_due_day?: number | null
          logo_url?: string | null
          owner_id: string
          phone?: string | null
          pix_holder?: string | null
          pix_key?: string | null
          tenant_id?: string | null
          updated_at?: string
          wa_installment_template?: string | null
          wa_pix_template?: string | null
          wa_quote_template?: string | null
          wa_reminder_template?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_holder?: string | null
          bank_name?: string | null
          business_name?: string | null
          cnpj?: string | null
          contract_template?: string | null
          created_at?: string
          google_place_id?: string | null
          installments_default_count?: number
          installments_due_day?: number | null
          logo_url?: string | null
          owner_id?: string
          phone?: string | null
          pix_holder?: string | null
          pix_key?: string | null
          tenant_id?: string | null
          updated_at?: string
          wa_installment_template?: string | null
          wa_pix_template?: string | null
          wa_quote_template?: string | null
          wa_reminder_template?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buffet_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          city: string | null
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          origem: string
          owner_id: string
          phone: string | null
          status: string
          tenant_id: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          origem?: string
          owner_id: string
          phone?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          origem?: string
          owner_id?: string
          phone?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          client_id: string | null
          content: string
          created_at: string
          event_id: string | null
          id: string
          owner_id: string
          signed_at: string | null
          status: Database["public"]["Enums"]["contract_status"]
          tenant_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          content?: string
          created_at?: string
          event_id?: string | null
          id?: string
          owner_id: string
          signed_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          tenant_id?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          content?: string
          created_at?: string
          event_id?: string | null
          id?: string
          owner_id?: string
          signed_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          tenant_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          created_at: string
          daily_rate: number
          id: string
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
          pix: string | null
          role: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          daily_rate?: number
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          pix?: string | null
          role?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          daily_rate?: number
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          pix?: string | null
          role?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_checklist: {
        Row: {
          created_at: string
          done: boolean
          event_id: string
          id: string
          label: string
          owner_id: string
          position: number
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          event_id: string
          id?: string
          label: string
          owner_id: string
          position?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          done?: boolean
          event_id?: string
          id?: string
          label?: string
          owner_id?: string
          position?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_checklist_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checklist_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_staff: {
        Row: {
          amount: number
          created_at: string
          employee_id: string
          event_id: string
          id: string
          owner_id: string
          paid: boolean
          role: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          employee_id: string
          event_id: string
          id?: string
          owner_id: string
          paid?: boolean
          role?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          employee_id?: string
          event_id?: string
          id?: string
          owner_id?: string
          paid?: boolean
          role?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_staff_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_staff_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_staff_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_stock_allocations: {
        Row: {
          consumed_qty: number
          event_id: string
          product_id: string
          reserved_qty: number
          updated_at: string
        }
        Insert: {
          consumed_qty?: number
          event_id: string
          product_id: string
          reserved_qty?: number
          updated_at?: string
        }
        Update: {
          consumed_qty?: number
          event_id?: string
          product_id?: string
          reserved_qty?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_stock_allocations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_stock_allocations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_products"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          client_id: string | null
          created_at: string
          event_address: string | null
          event_date: string
          event_time: string | null
          guest_count: number | null
          id: string
          notes: string | null
          owner_id: string
          package_id: string | null
          quote_id: string | null
          status: Database["public"]["Enums"]["event_status"]
          tenant_id: string | null
          total_value: number
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          event_address?: string | null
          event_date: string
          event_time?: string | null
          guest_count?: number | null
          id?: string
          notes?: string | null
          owner_id: string
          package_id?: string | null
          quote_id?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          tenant_id?: string | null
          total_value?: number
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          event_address?: string | null
          event_date?: string
          event_time?: string | null
          guest_count?: number | null
          id?: string
          notes?: string | null
          owner_id?: string
          package_id?: string | null
          quote_id?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          tenant_id?: string | null
          total_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      feedbacks: {
        Row: {
          client_name: string
          comments: string | null
          created_at: string
          event_id: string | null
          id: string
          improvements: string | null
          nps_score: number
          rating_drinks: number | null
          rating_food: number | null
          rating_punctuality: number | null
          rating_staff: number | null
          tenant_id: string
        }
        Insert: {
          client_name: string
          comments?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          improvements?: string | null
          nps_score: number
          rating_drinks?: number | null
          rating_food?: number | null
          rating_punctuality?: number | null
          rating_staff?: number | null
          tenant_id: string
        }
        Update: {
          client_name?: string
          comments?: string | null
          created_at?: string
          event_id?: string | null
          id?: string
          improvements?: string | null
          nps_score?: number
          rating_drinks?: number | null
          rating_food?: number | null
          rating_punctuality?: number | null
          rating_staff?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedbacks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_settings: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_district: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          aliquota_iss: number | null
          api_key: string | null
          cnpj: string | null
          codigo_servico: string | null
          created_at: string
          environment: string
          fiscal_email: string | null
          fiscal_phone: string | null
          has_api_key: boolean | null
          id: string
          inscricao_municipal: string | null
          invoice_logo_url: string | null
          owner_id: string
          provider: string
          razao_social: string | null
          regime_tributario: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          aliquota_iss?: number | null
          api_key?: string | null
          cnpj?: string | null
          codigo_servico?: string | null
          created_at?: string
          environment?: string
          fiscal_email?: string | null
          fiscal_phone?: string | null
          has_api_key?: boolean | null
          id?: string
          inscricao_municipal?: string | null
          invoice_logo_url?: string | null
          owner_id?: string
          provider?: string
          razao_social?: string | null
          regime_tributario?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          aliquota_iss?: number | null
          api_key?: string | null
          cnpj?: string | null
          codigo_servico?: string | null
          created_at?: string
          environment?: string
          fiscal_email?: string | null
          fiscal_phone?: string | null
          has_api_key?: boolean | null
          id?: string
          inscricao_municipal?: string | null
          invoice_logo_url?: string | null
          owner_id?: string
          provider?: string
          razao_social?: string | null
          regime_tributario?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          cancel_reason: string | null
          cancelled_at: string | null
          client_id: string | null
          created_at: string
          description: string
          email_sent_at: string | null
          environment: string
          error_message: string | null
          event_id: string | null
          id: string
          issued_at: string | null
          number: string | null
          owner_id: string
          payment_method: string | null
          pdf_url: string | null
          provider: string
          provider_ref: string | null
          recipient_doc: string | null
          recipient_email: string | null
          recipient_name: string | null
          series: string | null
          service_date: string | null
          status: string
          tenant_id: string | null
          updated_at: string
          xml_url: string | null
        }
        Insert: {
          amount?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          client_id?: string | null
          created_at?: string
          description: string
          email_sent_at?: string | null
          environment?: string
          error_message?: string | null
          event_id?: string | null
          id?: string
          issued_at?: string | null
          number?: string | null
          owner_id?: string
          payment_method?: string | null
          pdf_url?: string | null
          provider?: string
          provider_ref?: string | null
          recipient_doc?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          series?: string | null
          service_date?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          xml_url?: string | null
        }
        Update: {
          amount?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          client_id?: string | null
          created_at?: string
          description?: string
          email_sent_at?: string | null
          environment?: string
          error_message?: string | null
          event_id?: string | null
          id?: string
          issued_at?: string | null
          number?: string | null
          owner_id?: string
          payment_method?: string | null
          pdf_url?: string | null
          provider?: string
          provider_ref?: string | null
          recipient_doc?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          series?: string | null
          service_date?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          city: string | null
          converted_quote_id: string | null
          cpf: string | null
          created_at: string
          email: string | null
          event_address: string | null
          event_date: string | null
          event_time: string | null
          event_type: string | null
          guest_count: number | null
          id: string
          name: string
          notes: string | null
          package_desired: string | null
          package_id: string | null
          phone: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          tenant_id: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          city?: string | null
          converted_quote_id?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          event_address?: string | null
          event_date?: string | null
          event_time?: string | null
          event_type?: string | null
          guest_count?: number | null
          id?: string
          name: string
          notes?: string | null
          package_desired?: string | null
          package_id?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tenant_id: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          city?: string | null
          converted_quote_id?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          event_address?: string | null
          event_date?: string | null
          event_time?: string | null
          event_type?: string | null
          guest_count?: number | null
          id?: string
          name?: string
          notes?: string | null
          package_desired?: string | null
          package_id?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tenant_id?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      package_price_tiers: {
        Row: {
          created_at: string
          id: string
          max_guests: number
          min_guests: number
          owner_id: string
          package_id: string
          position: number
          price_fixed: number | null
          price_per_person: number
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_guests?: number
          min_guests?: number
          owner_id: string
          package_id: string
          position?: number
          price_fixed?: number | null
          price_per_person?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_guests?: number
          min_guests?: number
          owner_id?: string
          package_id?: string
          position?: number
          price_fixed?: number | null
          price_per_person?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_price_tiers_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_price_tiers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      package_products: {
        Row: {
          created_at: string
          id: string
          package_id: string
          product_id: string
          qty_fixed: number
          qty_per_person: number
        }
        Insert: {
          created_at?: string
          id?: string
          package_id: string
          product_id: string
          qty_fixed?: number
          qty_per_person?: number
        }
        Update: {
          created_at?: string
          id?: string
          package_id?: string
          product_id?: string
          qty_fixed?: number
          qty_per_person?: number
        }
        Relationships: [
          {
            foreignKeyName: "package_products_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_products"
            referencedColumns: ["id"]
          },
        ]
      }
      package_unit_items: {
        Row: {
          created_at: string
          default_qty: number
          id: string
          name: string
          package_id: string
          position: number
          product_id: string | null
          unit: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_qty?: number
          id?: string
          name: string
          package_id: string
          position?: number
          product_id?: string | null
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_qty?: number
          id?: string
          name?: string
          package_id?: string
          position?: number
          product_id?: string | null
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "package_unit_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_unit_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_products"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          included_items: string[] | null
          max_people: number | null
          min_people: number | null
          name: string
          owner_id: string
          price_per_person: number
          pricing_type: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          included_items?: string[] | null
          max_people?: number | null
          min_people?: number | null
          name: string
          owner_id: string
          price_per_person?: number
          pricing_type?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          included_items?: string[] | null
          max_people?: number | null
          min_people?: number | null
          name?: string
          owner_id?: string
          price_per_person?: number
          pricing_type?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_installments: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          due_date: string | null
          event_id: string | null
          id: string
          label: string | null
          number: number
          owner_id: string
          paid_at: string | null
          payer_note: string | null
          quote_id: string | null
          receipt_path: string | null
          receipt_uploaded_at: string | null
          status: string
          tenant_id: string
          token: string
          total_count: number
          updated_at: string
        }
        Insert: {
          amount?: number
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          event_id?: string | null
          id?: string
          label?: string | null
          number?: number
          owner_id: string
          paid_at?: string | null
          payer_note?: string | null
          quote_id?: string | null
          receipt_path?: string | null
          receipt_uploaded_at?: string | null
          status?: string
          tenant_id: string
          token?: string
          total_count?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          event_id?: string | null
          id?: string
          label?: string | null
          number?: number
          owner_id?: string
          paid_at?: string | null
          payer_note?: string | null
          quote_id?: string | null
          receipt_path?: string | null
          receipt_uploaded_at?: string | null
          status?: string
          tenant_id?: string
          token?: string
          total_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_installments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_installments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_installments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_installments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          business_name: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          business_name?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          business_name?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_invoices: {
        Row: {
          access_key: string | null
          created_at: string
          created_by: string | null
          id: string
          issue_date: string | null
          items: Json
          nf_number: string | null
          nf_series: string | null
          owner_id: string
          supplier_cnpj: string | null
          supplier_name: string | null
          tenant_id: string
          total_value: number
          updated_at: string
        }
        Insert: {
          access_key?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          issue_date?: string | null
          items?: Json
          nf_number?: string | null
          nf_series?: string | null
          owner_id: string
          supplier_cnpj?: string | null
          supplier_name?: string | null
          tenant_id: string
          total_value?: number
          updated_at?: string
        }
        Update: {
          access_key?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          issue_date?: string | null
          items?: Json
          nf_number?: string | null
          nf_series?: string | null
          owner_id?: string
          supplier_cnpj?: string | null
          supplier_name?: string | null
          tenant_id?: string
          total_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          adults: number
          balance_value: number
          children_0_6: number
          children_7_10: number
          client_id: string | null
          created_at: string
          entry_value: number
          event_address: string | null
          event_date: string
          event_time: string | null
          event_type: string | null
          extras: Json
          has_freezer: boolean | null
          has_grill: boolean | null
          id: string
          notes: string | null
          owner_id: string
          package_id: string | null
          paid: boolean
          payment_method: string
          status: Database["public"]["Enums"]["quote_status"]
          tenant_id: string | null
          total_value: number
          unit_items_consumed_at: string | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          adults?: number
          balance_value?: number
          children_0_6?: number
          children_7_10?: number
          client_id?: string | null
          created_at?: string
          entry_value?: number
          event_address?: string | null
          event_date: string
          event_time?: string | null
          event_type?: string | null
          extras?: Json
          has_freezer?: boolean | null
          has_grill?: boolean | null
          id?: string
          notes?: string | null
          owner_id: string
          package_id?: string | null
          paid?: boolean
          payment_method?: string
          status?: Database["public"]["Enums"]["quote_status"]
          tenant_id?: string | null
          total_value?: number
          unit_items_consumed_at?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          adults?: number
          balance_value?: number
          children_0_6?: number
          children_7_10?: number
          client_id?: string | null
          created_at?: string
          entry_value?: number
          event_address?: string | null
          event_date?: string
          event_time?: string | null
          event_type?: string | null
          extras?: Json
          has_freezer?: boolean | null
          has_grill?: boolean | null
          id?: string
          notes?: string | null
          owner_id?: string
          package_id?: string | null
          paid?: boolean
          payment_method?: string
          status?: Database["public"]["Enums"]["quote_status"]
          tenant_id?: string | null
          total_value?: number
          unit_items_consumed_at?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string | null
          id: string
          invoice_id: string | null
          kind: string
          notes: string | null
          product_id: string
          quantity: number
          source: string | null
          tenant_id: string
          total_price: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          invoice_id?: string | null
          kind: string
          notes?: string | null
          product_id: string
          quantity: number
          source?: string | null
          tenant_id: string
          total_price?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          invoice_id?: string | null
          kind?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          source?: string | null
          tenant_id?: string
          total_price?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "stock_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_products: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          id: string
          min_qty: number
          name: string
          notes: string | null
          owner_id: string
          physical_qty: number
          reserved_qty: number
          tenant_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          id?: string
          min_qty?: number
          name: string
          notes?: string | null
          owner_id: string
          physical_qty?: number
          reserved_qty?: number
          tenant_id: string
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          id?: string
          min_qty?: number
          name?: string
          notes?: string | null
          owner_id?: string
          physical_qty?: number
          reserved_qty?: number
          tenant_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "stock_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_logins: {
        Row: {
          created_at: string
          device: string
          last_login_at: string
          login_count: number
          tenant_id: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device?: string
          last_login_at?: string
          login_count?: number
          tenant_id?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device?: string
          last_login_at?: string
          login_count?: number
          tenant_id?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_logins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          city: string | null
          contact_phone: string | null
          created_at: string
          id: string
          last_seen_at: string | null
          name: string
          owner_id: string
          plan: string
          rejection_reason: string | null
          responsible_name: string | null
          slug: string
          status: Database["public"]["Enums"]["tenant_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          city?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          last_seen_at?: string | null
          name: string
          owner_id: string
          plan?: string
          rejection_reason?: string | null
          responsible_name?: string | null
          slug: string
          status?: Database["public"]["Enums"]["tenant_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          city?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          last_seen_at?: string | null
          name?: string
          owner_id?: string
          plan?: string
          rejection_reason?: string | null
          responsible_name?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["tenant_status"]
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: string | null
          client_id: string | null
          created_at: string
          description: string
          due_date: string | null
          event_id: string | null
          id: string
          method: Database["public"]["Enums"]["tx_method"]
          notes: string | null
          owner_id: string
          paid_date: string | null
          status: Database["public"]["Enums"]["tx_status"]
          tenant_id: string | null
          type: Database["public"]["Enums"]["tx_type"]
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string | null
          client_id?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          event_id?: string | null
          id?: string
          method?: Database["public"]["Enums"]["tx_method"]
          notes?: string | null
          owner_id: string
          paid_date?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          tenant_id?: string | null
          type: Database["public"]["Enums"]["tx_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          client_id?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          event_id?: string | null
          id?: string
          method?: Database["public"]["Enums"]["tx_method"]
          notes?: string | null
          owner_id?: string
          paid_date?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          tenant_id?: string | null
          type?: Database["public"]["Enums"]["tx_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_tenant_id: { Args: never; Returns: string }
      generate_unique_slug: { Args: { base: string }; Returns: string }
      get_public_installment: { Args: { p_token: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      resolve_package_price: {
        Args: { p_guests: number; p_package_id: string }
        Returns: number
      }
      return_event_stock: { Args: { _event_id: string }; Returns: undefined }
      slugify: { Args: { txt: string }; Returns: string }
      submit_public_feedback: {
        Args: {
          p_client_name: string
          p_comments: string
          p_improvements: string
          p_nps_score: number
          p_rating_drinks: number
          p_rating_food: number
          p_rating_punctuality: number
          p_rating_staff: number
          p_slug: string
        }
        Returns: string
      }
      submit_public_quote: {
        Args: {
          p_city: string
          p_cpf: string
          p_email: string
          p_event_address: string
          p_event_date: string
          p_event_time: string
          p_event_type: string
          p_guest_count: number
          p_name: string
          p_notes: string
          p_package_id: string
          p_slug: string
          p_whatsapp: string
        }
        Returns: string
      }
      submit_public_quote_v2: {
        Args: {
          p_city: string
          p_cpf: string
          p_email: string
          p_event_address: string
          p_event_date: string
          p_event_time: string
          p_event_type: string
          p_guest_count: number
          p_name: string
          p_notes: string
          p_package_id: string
          p_package_ids?: string[]
          p_slug: string
          p_unit_items?: Json
          p_whatsapp: string
        }
        Returns: string
      }
      sync_event_stock: { Args: { _event_id: string }; Returns: undefined }
      unaccent_string: { Args: { txt: string }; Returns: string }
    }
    Enums: {
      app_role:
        | "proprietario"
        | "gerente"
        | "atendente"
        | "super_admin"
        | "buffet"
      contract_status: "rascunho" | "enviado" | "assinado" | "cancelado"
      event_status:
        | "agendado"
        | "pagamento_parcial"
        | "pago"
        | "em_andamento"
        | "concluido"
        | "cancelado"
        | "realizado"
      lead_status:
        | "novo"
        | "contatado"
        | "convertido"
        | "descartado"
        | "em_andamento"
      quote_status:
        | "novo"
        | "em_analise"
        | "enviado"
        | "aprovado"
        | "recusado"
        | "cancelado"
        | "primeiro_contato"
        | "visitado"
        | "negociacao"
        | "aguardando"
        | "fechado"
        | "em_andamento"
      tenant_status: "pendente" | "ativo" | "rejeitado" | "suspenso"
      tx_method:
        | "pix"
        | "dinheiro"
        | "cartao"
        | "boleto"
        | "transferencia"
        | "outro"
      tx_status: "pendente" | "pago" | "atrasado" | "cancelado"
      tx_type: "entrada" | "saida"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "proprietario",
        "gerente",
        "atendente",
        "super_admin",
        "buffet",
      ],
      contract_status: ["rascunho", "enviado", "assinado", "cancelado"],
      event_status: [
        "agendado",
        "pagamento_parcial",
        "pago",
        "em_andamento",
        "concluido",
        "cancelado",
        "realizado",
      ],
      lead_status: [
        "novo",
        "contatado",
        "convertido",
        "descartado",
        "em_andamento",
      ],
      quote_status: [
        "novo",
        "em_analise",
        "enviado",
        "aprovado",
        "recusado",
        "cancelado",
        "primeiro_contato",
        "visitado",
        "negociacao",
        "aguardando",
        "fechado",
        "em_andamento",
      ],
      tenant_status: ["pendente", "ativo", "rejeitado", "suspenso"],
      tx_method: [
        "pix",
        "dinheiro",
        "cartao",
        "boleto",
        "transferencia",
        "outro",
      ],
      tx_status: ["pendente", "pago", "atrasado", "cancelado"],
      tx_type: ["entrada", "saida"],
    },
  },
} as const
