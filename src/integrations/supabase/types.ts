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
      buffet_settings: {
        Row: {
          address: string | null
          business_name: string | null
          contract_template: string | null
          created_at: string
          owner_id: string
          phone: string | null
          pix_holder: string | null
          pix_key: string | null
          tenant_id: string | null
          updated_at: string
          wa_pix_template: string | null
          wa_quote_template: string | null
          wa_reminder_template: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          business_name?: string | null
          contract_template?: string | null
          created_at?: string
          owner_id: string
          phone?: string | null
          pix_holder?: string | null
          pix_key?: string | null
          tenant_id?: string | null
          updated_at?: string
          wa_pix_template?: string | null
          wa_quote_template?: string | null
          wa_reminder_template?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string | null
          contract_template?: string | null
          created_at?: string
          owner_id?: string
          phone?: string | null
          pix_holder?: string | null
          pix_key?: string | null
          tenant_id?: string | null
          updated_at?: string
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
          owner_id: string
          phone: string | null
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
          owner_id: string
          phone?: string | null
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
          owner_id?: string
          phone?: string | null
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
      leads: {
        Row: {
          city: string | null
          converted_quote_id: string | null
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
          status: Database["public"]["Enums"]["quote_status"]
          tenant_id: string | null
          total_value: number
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
          status?: Database["public"]["Enums"]["quote_status"]
          tenant_id?: string | null
          total_value?: number
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
          status?: Database["public"]["Enums"]["quote_status"]
          tenant_id?: string | null
          total_value?: number
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      slugify: { Args: { txt: string }; Returns: string }
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
      lead_status: "novo" | "contatado" | "convertido" | "descartado"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      ],
      lead_status: ["novo", "contatado", "convertido", "descartado"],
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
