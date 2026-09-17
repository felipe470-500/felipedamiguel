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
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          changes: Json
          correlation_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          organization_id: string
          store_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          changes?: Json
          correlation_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          organization_id: string
          store_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          changes?: Json
          correlation_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          organization_id?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_credentials: {
        Row: {
          created_at: string
          encrypted_payload: string
          expires_at: string | null
          id: string
          key_version: number
          masked_identifier: string | null
          store_integration_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          encrypted_payload: string
          expires_at?: string | null
          id?: string
          key_version?: number
          masked_identifier?: string | null
          store_integration_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          encrypted_payload?: string
          expires_at?: string | null
          id?: string
          key_version?: number
          masked_identifier?: string | null
          store_integration_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_credentials_store_integration_id_fkey"
            columns: ["store_integration_id"]
            isOneToOne: true
            referencedRelation: "store_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_user_id: string | null
          created_at: string
          desired_car: string | null
          external_id: string | null
          id: string
          name: string
          payment_type: string
          payment_value: string | null
          platform_id: string | null
          source: string
          status: string
          store_id: string
          updated_at: string
          vehicle_id: string | null
          whatsapp: string
        }
        Insert: {
          assigned_user_id?: string | null
          created_at?: string
          desired_car?: string | null
          external_id?: string | null
          id?: string
          name: string
          payment_type: string
          payment_value?: string | null
          platform_id?: string | null
          source?: string
          status?: string
          store_id: string
          updated_at?: string
          vehicle_id?: string | null
          whatsapp: string
        }
        Update: {
          assigned_user_id?: string | null
          created_at?: string
          desired_car?: string | null
          external_id?: string | null
          id?: string
          name?: string
          payment_type?: string
          payment_value?: string | null
          platform_id?: string | null
          source?: string
          status?: string
          store_id?: string
          updated_at?: string
          vehicle_id?: string | null
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      media_integrations: {
        Row: {
          external_id: string | null
          external_url: string | null
          id: string
          last_error: string | null
          store_integration_id: string
          sync_status: Database["public"]["Enums"]["sync_status"]
          updated_at: string
          vehicle_media_id: string
        }
        Insert: {
          external_id?: string | null
          external_url?: string | null
          id?: string
          last_error?: string | null
          store_integration_id: string
          sync_status?: Database["public"]["Enums"]["sync_status"]
          updated_at?: string
          vehicle_media_id: string
        }
        Update: {
          external_id?: string | null
          external_url?: string | null
          id?: string
          last_error?: string | null
          store_integration_id?: string
          sync_status?: Database["public"]["Enums"]["sync_status"]
          updated_at?: string
          vehicle_media_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_integrations_store_integration_id_fkey"
            columns: ["store_integration_id"]
            isOneToOne: false
            referencedRelation: "store_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_integrations_vehicle_media_id_fkey"
            columns: ["vehicle_media_id"]
            isOneToOne: false
            referencedRelation: "vehicle_media"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      platforms: {
        Row: {
          active: boolean
          capabilities: Json
          connector_version: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          capabilities?: Json
          connector_version?: string
          created_at?: string
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          capabilities?: Json
          connector_version?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          email: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          email?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      seller_profiles: {
        Row: {
          avatar_url: string | null
          seller_id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          seller_id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          seller_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          created_at: string
          id: string
          lead_gate_enabled: boolean
          singleton: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_gate_enabled?: boolean
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_gate_enabled?: boolean
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      store_integrations: {
        Row: {
          capabilities: Json
          created_at: string
          external_store_id: string | null
          id: string
          last_error: string | null
          last_health_check_at: string | null
          platform_id: string
          status: Database["public"]["Enums"]["integration_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          capabilities?: Json
          created_at?: string
          external_store_id?: string | null
          id?: string
          last_error?: string | null
          last_health_check_at?: string | null
          platform_id: string
          status?: Database["public"]["Enums"]["integration_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          capabilities?: Json
          created_at?: string
          external_store_id?: string | null
          id?: string
          last_error?: string | null
          last_health_check_at?: string | null
          platform_id?: string
          status?: Database["public"]["Enums"]["integration_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_integrations_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_integrations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          active: boolean
          address: Json
          code: string
          created_at: string
          id: string
          name: string
          organization_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: Json
          code: string
          created_at?: string
          id?: string
          name: string
          organization_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: Json
          code?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_jobs: {
        Row: {
          attempt_count: number
          created_at: string
          id: string
          idempotency_key: string
          last_error_code: string | null
          last_error_message: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          next_attempt_at: string
          operation: string
          payload: Json
          priority: number
          status: Database["public"]["Enums"]["sync_status"]
          store_id: string
          store_integration_id: string
          updated_at: string
          vehicle_id: string | null
          vehicle_version: number | null
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          id?: string
          idempotency_key: string
          last_error_code?: string | null
          last_error_message?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          next_attempt_at?: string
          operation: string
          payload?: Json
          priority?: number
          status?: Database["public"]["Enums"]["sync_status"]
          store_id: string
          store_integration_id: string
          updated_at?: string
          vehicle_id?: string | null
          vehicle_version?: number | null
        }
        Update: {
          attempt_count?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          last_error_code?: string | null
          last_error_message?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          next_attempt_at?: string
          operation?: string
          payload?: Json
          priority?: number
          status?: Database["public"]["Enums"]["sync_status"]
          store_id?: string
          store_integration_id?: string
          updated_at?: string
          vehicle_id?: string | null
          vehicle_version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_jobs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_jobs_store_integration_id_fkey"
            columns: ["store_integration_id"]
            isOneToOne: false
            referencedRelation: "store_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_jobs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          attempt: number
          correlation_id: string
          created_at: string
          duration_ms: number | null
          error_category: string | null
          error_code: string | null
          http_status: number | null
          id: string
          message: string | null
          operation: string
          outcome: string
          response_summary: Json
          store_id: string
          store_integration_id: string | null
          sync_job_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          attempt?: number
          correlation_id?: string
          created_at?: string
          duration_ms?: number | null
          error_category?: string | null
          error_code?: string | null
          http_status?: number | null
          id?: string
          message?: string | null
          operation: string
          outcome: string
          response_summary?: Json
          store_id: string
          store_integration_id?: string | null
          sync_job_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          attempt?: number
          correlation_id?: string
          created_at?: string
          duration_ms?: number | null
          error_category?: string | null
          error_code?: string | null
          http_status?: number | null
          id?: string
          message?: string | null
          operation?: string
          outcome?: string
          response_summary?: Json
          store_id?: string
          store_integration_id?: string | null
          sync_job_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_logs_store_integration_id_fkey"
            columns: ["store_integration_id"]
            isOneToOne: false
            referencedRelation: "store_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_logs_sync_job_id_fkey"
            columns: ["sync_job_id"]
            isOneToOne: false
            referencedRelation: "sync_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          store_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          store_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          store_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_features: {
        Row: {
          created_at: string
          feature_key: string
          id: string
          label: string
          value: Json
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          feature_key: string
          id?: string
          label: string
          value?: Json
          vehicle_id: string
        }
        Update: {
          created_at?: string
          feature_key?: string
          id?: string
          label?: string
          value?: Json
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_features_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_integrations: {
        Row: {
          created_at: string
          external_id: string | null
          external_status: string | null
          id: string
          last_error_code: string | null
          last_error_message: string | null
          last_http_status: number | null
          last_payload_hash: string | null
          last_synced_at: string | null
          store_integration_id: string
          sync_status: Database["public"]["Enums"]["sync_status"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          external_status?: string | null
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          last_http_status?: number | null
          last_payload_hash?: string | null
          last_synced_at?: string | null
          store_integration_id: string
          sync_status?: Database["public"]["Enums"]["sync_status"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          external_id?: string | null
          external_status?: string | null
          id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          last_http_status?: number | null
          last_payload_hash?: string | null
          last_synced_at?: string | null
          store_integration_id?: string
          sync_status?: Database["public"]["Enums"]["sync_status"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_integrations_store_integration_id_fkey"
            columns: ["store_integration_id"]
            isOneToOne: false
            referencedRelation: "store_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_integrations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_media: {
        Row: {
          checksum: string | null
          created_at: string
          duration_ms: number | null
          height: number | null
          id: string
          media_type: string
          processing_status: string
          sort_order: number
          storage_path: string
          updated_at: string
          vehicle_id: string
          width: number | null
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          duration_ms?: number | null
          height?: number | null
          id?: string
          media_type: string
          processing_status?: string
          sort_order?: number
          storage_path: string
          updated_at?: string
          vehicle_id: string
          width?: number | null
        }
        Update: {
          checksum?: string | null
          created_at?: string
          duration_ms?: number | null
          height?: number | null
          id?: string
          media_type?: string
          processing_status?: string
          sort_order?: number
          storage_path?: string
          updated_at?: string
          vehicle_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_media_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["vehicle_status"] | null
          id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["vehicle_status"]
          vehicle_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["vehicle_status"] | null
          id?: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["vehicle_status"]
          vehicle_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["vehicle_status"] | null
          id?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["vehicle_status"]
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_status_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          brand: string | null
          color: string | null
          created_at: string
          description: string | null
          doors: number | null
          fuel: string | null
          id: string
          images: string[]
          internal_code: number | null
          km: string
          location: Json
          manufacture_year: number | null
          mileage_km: number | null
          model: string | null
          model_year: number | null
          name: string
          plate: string | null
          position: number
          price: string
          price_cents: number | null
          record_version: number
          seller_id: string | null
          status: Database["public"]["Enums"]["vehicle_status"]
          store_id: string
          tag: string | null
          transmission: string | null
          updated_at: string
          version: string | null
          vin: string | null
          year: string
        }
        Insert: {
          brand?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          doors?: number | null
          fuel?: string | null
          id?: string
          images?: string[]
          internal_code?: number | null
          km?: string
          location?: Json
          manufacture_year?: number | null
          mileage_km?: number | null
          model?: string | null
          model_year?: number | null
          name: string
          plate?: string | null
          position?: number
          price?: string
          price_cents?: number | null
          record_version?: number
          seller_id?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          store_id: string
          tag?: string | null
          transmission?: string | null
          updated_at?: string
          version?: string | null
          vin?: string | null
          year?: string
        }
        Update: {
          brand?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          doors?: number | null
          fuel?: string | null
          id?: string
          images?: string[]
          internal_code?: number | null
          km?: string
          location?: Json
          manufacture_year?: number | null
          mileage_km?: number | null
          model?: string | null
          model_year?: number | null
          name?: string
          plate?: string | null
          position?: number
          price?: string
          price_cents?: number | null
          record_version?: number
          seller_id?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          store_id?: string
          tag?: string | null
          transmission?: string | null
          updated_at?: string
          version?: string | null
          vin?: string | null
          year?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          external_event_id: string | null
          id: string
          payload: Json
          platform_id: string
          processed_at: string | null
          signature_valid: boolean
          status: string
          store_integration_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          external_event_id?: string | null
          id?: string
          payload: Json
          platform_id: string
          processed_at?: string | null
          signature_valid?: boolean
          status?: string
          store_integration_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          external_event_id?: string | null
          id?: string
          payload?: Json
          platform_id?: string
          processed_at?: string | null
          signature_valid?: boolean
          status?: string
          store_integration_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_store_integration_id_fkey"
            columns: ["store_integration_id"]
            isOneToOne: false
            referencedRelation: "store_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_store_role: {
        Args: {
          _roles?: Database["public"]["Enums"]["app_role"][]
          _store_id: string
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "seller" | "integration_operator"
      integration_status: "NOT_CONNECTED" | "CONNECTED" | "DEGRADED" | "BLOCKED"
      sync_status:
        | "PENDING"
        | "PROCESSING"
        | "RETRY"
        | "SUCCEEDED"
        | "FAILED"
        | "DEAD_LETTER"
        | "UNSUPPORTED"
      vehicle_status: "DRAFT" | "AVAILABLE" | "RESERVED" | "SOLD" | "ARCHIVED"
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
      app_role: ["admin", "manager", "seller", "integration_operator"],
      integration_status: ["NOT_CONNECTED", "CONNECTED", "DEGRADED", "BLOCKED"],
      sync_status: [
        "PENDING",
        "PROCESSING",
        "RETRY",
        "SUCCEEDED",
        "FAILED",
        "DEAD_LETTER",
        "UNSUPPORTED",
      ],
      vehicle_status: ["DRAFT", "AVAILABLE", "RESERVED", "SOLD", "ARCHIVED"],
    },
  },
} as const
