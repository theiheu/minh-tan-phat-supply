export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          created_at: string | null
          id: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_knowledge_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string | null
          document_id: string
          embedding: string | null
          id: string
          metadata: Json | null
          tsv: unknown
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string | null
          document_id: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          tsv?: unknown
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string | null
          document_id?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          tsv?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "ai_knowledge_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "ai_knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_knowledge_documents: {
        Row: {
          category: string
          content_hash: string
          created_at: string | null
          id: string
          metadata: Json | null
          source_key: string
          title: string
          updated_at: string | null
        }
        Insert: {
          category: string
          content_hash: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          source_key: string
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          content_hash?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          source_key?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          role: string
          tool_calls: Json | null
          tool_results: Json | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          role: string
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          role?: string
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_quick_prompts: {
        Row: {
          created_at: string | null
          display_order: number
          icon: string
          id: string
          is_active: boolean
          label: string
          prompt: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          icon?: string
          id?: string
          is_active?: boolean
          label: string
          prompt: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number
          icon?: string
          id?: string
          is_active?: boolean
          label?: string
          prompt?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_system_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      attribute_definitions: {
        Row: {
          allow_custom_value: boolean
          code: string
          created_at: string
          data_type: string
          default_unit_id: string | null
          id: string
          is_active: boolean
          measurement_dimension: string | null
          name: string
          updated_at: string
        }
        Insert: {
          allow_custom_value?: boolean
          code: string
          created_at?: string
          data_type: string
          default_unit_id?: string | null
          id?: string
          is_active?: boolean
          measurement_dimension?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          allow_custom_value?: boolean
          code?: string
          created_at?: string
          data_type?: string
          default_unit_id?: string | null
          id?: string
          is_active?: boolean
          measurement_dimension?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attribute_definitions_default_unit_id_fkey"
            columns: ["default_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      attribute_option_values: {
        Row: {
          attribute_definition_id: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          label: string
        }
        Insert: {
          attribute_definition_id: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
        }
        Update: {
          attribute_definition_id?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "attribute_option_values_attribute_definition_id_fkey"
            columns: ["attribute_definition_id"]
            isOneToOne: false
            referencedRelation: "attribute_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      barcode_registry: {
        Row: {
          barcode: string
          created_at: string
          id: string
          is_active: boolean
          sku_id: string | null
          transaction_unit_id: string | null
        }
        Insert: {
          barcode: string
          created_at?: string
          id?: string
          is_active?: boolean
          sku_id?: string | null
          transaction_unit_id?: string | null
        }
        Update: {
          barcode?: string
          created_at?: string
          id?: string
          is_active?: boolean
          sku_id?: string | null
          transaction_unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barcode_registry_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "barcode_registry_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "sku_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "barcode_registry_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barcode_registry_transaction_unit_id_fkey"
            columns: ["transaction_unit_id"]
            isOneToOne: false
            referencedRelation: "sku_transaction_units"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_headers: {
        Row: {
          active_version_id: string | null
          created_at: string
          id: string
          inventory_policy: string
          sku_id: string
          updated_at: string
        }
        Insert: {
          active_version_id?: string | null
          created_at?: string
          id?: string
          inventory_policy: string
          sku_id: string
          updated_at?: string
        }
        Update: {
          active_version_id?: string | null
          created_at?: string
          id?: string
          inventory_policy?: string
          sku_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_headers_active_version_fkey"
            columns: ["active_version_id"]
            isOneToOne: false
            referencedRelation: "bom_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_headers_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "location_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "bom_headers_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "sku_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "bom_headers_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: true
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_items: {
        Row: {
          base_quantity: number
          bom_version_id: string
          component_sku_id: string
          created_at: string
          id: string
          wastage_percent: number
        }
        Insert: {
          base_quantity: number
          bom_version_id: string
          component_sku_id: string
          created_at?: string
          id?: string
          wastage_percent?: number
        }
        Update: {
          base_quantity?: number
          bom_version_id?: string
          component_sku_id?: string
          created_at?: string
          id?: string
          wastage_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "bom_items_bom_version_id_fkey"
            columns: ["bom_version_id"]
            isOneToOne: false
            referencedRelation: "bom_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_items_component_sku_id_fkey"
            columns: ["component_sku_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "bom_items_component_sku_id_fkey"
            columns: ["component_sku_id"]
            isOneToOne: false
            referencedRelation: "sku_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "bom_items_component_sku_id_fkey"
            columns: ["component_sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_versions: {
        Row: {
          bom_header_id: string
          change_reason: string | null
          created_at: string
          created_by: string | null
          effective_period: unknown
          id: string
          status: string
          version_number: number
        }
        Insert: {
          bom_header_id: string
          change_reason?: string | null
          created_at?: string
          created_by?: string | null
          effective_period: unknown
          id?: string
          status: string
          version_number: number
        }
        Update: {
          bom_header_id?: string
          change_reason?: string | null
          created_at?: string
          created_by?: string | null
          effective_period?: unknown
          id?: string
          status?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "bom_versions_bom_header_id_fkey"
            columns: ["bom_header_id"]
            isOneToOne: false
            referencedRelation: "bom_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_drafts: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          payload: Json
          product_id: string | null
          revision: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          payload?: Json
          product_id?: string | null
          revision?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          payload?: Json
          product_id?: string | null
          revision?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_drafts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_drafts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_migration_issues: {
        Row: {
          created_at: string
          details: Json
          id: string
          issue_type: string
          resolved_at: string | null
          source_id: string | null
          source_table: string
          status: string
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          issue_type: string
          resolved_at?: string | null
          source_id?: string | null
          source_table: string
          status?: string
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          issue_type?: string
          resolved_at?: string | null
          source_id?: string | null
          source_table?: string
          status?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          deleted_at: string | null
          display_order: number
          icon: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      defect_note_items: {
        Row: {
          conversion_factor_snapshot: number | null
          created_at: string
          damage_detail: string | null
          damage_type: Database["public"]["Enums"]["damage_type"] | null
          defect_note_id: string
          entered_quantity: number | null
          id: string
          images: string[]
          note: string | null
          quantity: number
          resolution: Database["public"]["Enums"]["defect_resolution"] | null
          severity: Database["public"]["Enums"]["severity_level"] | null
          sku_id: string
          snapshot_quality: string
          transaction_unit_id: string | null
          unit_cost: number | null
        }
        Insert: {
          conversion_factor_snapshot?: number | null
          created_at?: string
          damage_detail?: string | null
          damage_type?: Database["public"]["Enums"]["damage_type"] | null
          defect_note_id: string
          entered_quantity?: number | null
          id?: string
          images?: string[]
          note?: string | null
          quantity?: number
          resolution?: Database["public"]["Enums"]["defect_resolution"] | null
          severity?: Database["public"]["Enums"]["severity_level"] | null
          sku_id: string
          snapshot_quality?: string
          transaction_unit_id?: string | null
          unit_cost?: number | null
        }
        Update: {
          conversion_factor_snapshot?: number | null
          created_at?: string
          damage_detail?: string | null
          damage_type?: Database["public"]["Enums"]["damage_type"] | null
          defect_note_id?: string
          entered_quantity?: number | null
          id?: string
          images?: string[]
          note?: string | null
          quantity?: number
          resolution?: Database["public"]["Enums"]["defect_resolution"] | null
          severity?: Database["public"]["Enums"]["severity_level"] | null
          sku_id?: string
          snapshot_quality?: string
          transaction_unit_id?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "defect_note_items_defect_note_id_fkey"
            columns: ["defect_note_id"]
            isOneToOne: false
            referencedRelation: "defect_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defect_note_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "defect_note_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "sku_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "defect_note_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defect_note_items_transaction_unit_id_fkey"
            columns: ["transaction_unit_id"]
            isOneToOne: false
            referencedRelation: "sku_transaction_units"
            referencedColumns: ["id"]
          },
        ]
      }
      email_delivery_attempts: {
        Row: {
          created_at: string
          error_message: string | null
          event_key: string
          id: string
          idempotency_key: string
          recipient_email: string
          recipient_id: string | null
          status: "pending" | "sent" | "failed" | "skipped"
          subject_id: string
          subject_type: string
          template_kind: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_key: string
          id?: string
          idempotency_key: string
          recipient_email: string
          recipient_id?: string | null
          status: "pending" | "sent" | "failed" | "skipped"
          subject_id: string
          subject_type: string
          template_kind: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_key?: string
          id?: string
          idempotency_key?: string
          recipient_email?: string
          recipient_id?: string | null
          status?: "pending" | "sent" | "failed" | "skipped"
          subject_id?: string
          subject_type?: string
          template_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_delivery_attempts_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_reminder_claims: {
        Row: {
          borrowing_id: string
          claimed_at: string
          id: string
          reminder_type: "due_soon" | "overdue"
        }
        Insert: {
          borrowing_id: string
          claimed_at?: string
          id?: string
          reminder_type: "due_soon" | "overdue"
        }
        Update: {
          borrowing_id?: string
          claimed_at?: string
          id?: string
          reminder_type?: "due_soon" | "overdue"
        }
        Relationships: [
          {
            foreignKeyName: "tool_reminder_claims_borrowing_id_fkey"
            columns: ["borrowing_id"]
            isOneToOne: false
            referencedRelation: "tool_borrowings"
            referencedColumns: ["id"]
          },
        ]
      }
      defect_notes: {
        Row: {
          code: string
          collected_at: string | null
          collected_by: string | null
          created_at: string
          id: string
          notes: string | null
          repair_requested_at: string | null
          repair_requested_by: string | null
          reported_by: string | null
          source_location_id: string | null
          status: Database["public"]["Enums"]["defect_status"]
          updated_at: string
        }
        Insert: {
          code: string
          collected_at?: string | null
          collected_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          repair_requested_at?: string | null
          repair_requested_by?: string | null
          reported_by?: string | null
          source_location_id?: string | null
          status?: Database["public"]["Enums"]["defect_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          collected_at?: string | null
          collected_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          repair_requested_at?: string | null
          repair_requested_by?: string | null
          reported_by?: string | null
          source_location_id?: string | null
          status?: Database["public"]["Enums"]["defect_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "defect_notes_collected_by_fkey"
            columns: ["collected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defect_notes_repair_requested_by_fkey"
            columns: ["repair_requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defect_notes_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defect_notes_source_location_id_fkey"
            columns: ["source_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_note_items: {
        Row: {
          conversion_factor_snapshot: number | null
          entered_quantity: number | null
          exchange_note_id: string
          id: string
          quantity: number
          sku_id: string
          snapshot_quality: string
          transaction_unit_id: string | null
        }
        Insert: {
          conversion_factor_snapshot?: number | null
          entered_quantity?: number | null
          exchange_note_id: string
          id?: string
          quantity: number
          sku_id: string
          snapshot_quality?: string
          transaction_unit_id?: string | null
        }
        Update: {
          conversion_factor_snapshot?: number | null
          entered_quantity?: number | null
          exchange_note_id?: string
          id?: string
          quantity?: number
          sku_id?: string
          snapshot_quality?: string
          transaction_unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exchange_note_items_exchange_note_id_fkey"
            columns: ["exchange_note_id"]
            isOneToOne: false
            referencedRelation: "exchange_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_note_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "exchange_note_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "sku_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "exchange_note_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_note_items_transaction_unit_id_fkey"
            columns: ["transaction_unit_id"]
            isOneToOne: false
            referencedRelation: "sku_transaction_units"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_notes: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          cancelled_at: string | null
          code: string
          created_at: string
          created_by: string | null
          id: string
          issued_at: string | null
          issued_by: string | null
          linked_defect_id: string
          received_at: string | null
          received_by: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["exchange_status"]
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cancelled_at?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          linked_defect_id: string
          received_at?: string | null
          received_by?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["exchange_status"]
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cancelled_at?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          linked_defect_id?: string
          received_at?: string | null
          received_by?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["exchange_status"]
        }
        Relationships: [
          {
            foreignKeyName: "exchange_notes_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_notes_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_notes_linked_defect_id_fkey"
            columns: ["linked_defect_id"]
            isOneToOne: false
            referencedRelation: "defect_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_notes_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_notes_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_dispenses: {
        Row: {
          code: string
          consumption_rate: number | null
          created_at: string
          current_odo: number | null
          dispenser_id: string
          driver_id: string | null
          driver_name: string | null
          fuel_type_id: string
          id: string
          meter_images: string[]
          notes: string | null
          previous_odo: number | null
          quantity: number
          status: string
          sub_zone_id: string | null
          updated_at: string
          usage_diff: number | null
          vehicle_id: string | null
          zone_id: string | null
        }
        Insert: {
          code: string
          consumption_rate?: number | null
          created_at?: string
          current_odo?: number | null
          dispenser_id: string
          driver_id?: string | null
          driver_name?: string | null
          fuel_type_id: string
          id?: string
          meter_images?: string[]
          notes?: string | null
          previous_odo?: number | null
          quantity: number
          status?: string
          sub_zone_id?: string | null
          updated_at?: string
          usage_diff?: number | null
          vehicle_id?: string | null
          zone_id?: string | null
        }
        Update: {
          code?: string
          consumption_rate?: number | null
          created_at?: string
          current_odo?: number | null
          dispenser_id?: string
          driver_id?: string | null
          driver_name?: string | null
          fuel_type_id?: string
          id?: string
          meter_images?: string[]
          notes?: string | null
          previous_odo?: number | null
          quantity?: number
          status?: string
          sub_zone_id?: string | null
          updated_at?: string
          usage_diff?: number | null
          vehicle_id?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_dispenses_dispenser_id_fkey"
            columns: ["dispenser_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_dispenses_fuel_type_id_fkey"
            columns: ["fuel_type_id"]
            isOneToOne: false
            referencedRelation: "fuel_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_dispenses_sub_zone_id_fkey"
            columns: ["sub_zone_id"]
            isOneToOne: false
            referencedRelation: "sub_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_dispenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_dispenses_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_movements: {
        Row: {
          balance_after: number
          created_at: string
          created_by: string | null
          fuel_type_id: string
          id: string
          movement_type: Database["public"]["Enums"]["fuel_movement_type"]
          notes: string | null
          quantity: number
          ref_id: string
          ref_type: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          created_by?: string | null
          fuel_type_id: string
          id?: string
          movement_type: Database["public"]["Enums"]["fuel_movement_type"]
          notes?: string | null
          quantity: number
          ref_id: string
          ref_type: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          created_by?: string | null
          fuel_type_id?: string
          id?: string
          movement_type?: Database["public"]["Enums"]["fuel_movement_type"]
          notes?: string | null
          quantity?: number
          ref_id?: string
          ref_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_movements_fuel_type_id_fkey"
            columns: ["fuel_type_id"]
            isOneToOne: false
            referencedRelation: "fuel_types"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_receipts: {
        Row: {
          code: string
          created_at: string
          fuel_type_id: string
          id: string
          invoice_images: string[]
          invoice_number: string | null
          notes: string | null
          quantity: number
          received_by: string
          status: string
          supplier_id: string | null
          total_amount: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          fuel_type_id: string
          id?: string
          invoice_images?: string[]
          invoice_number?: string | null
          notes?: string | null
          quantity: number
          received_by: string
          status?: string
          supplier_id?: string | null
          total_amount?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          fuel_type_id?: string
          id?: string
          invoice_images?: string[]
          invoice_number?: string | null
          notes?: string | null
          quantity?: number
          received_by?: string
          status?: string
          supplier_id?: string | null
          total_amount?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_receipts_fuel_type_id_fkey"
            columns: ["fuel_type_id"]
            isOneToOne: false
            referencedRelation: "fuel_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_receipts_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_types: {
        Row: {
          code: string
          created_at: string
          current_stock: number
          description: string | null
          id: string
          is_active: boolean
          min_stock: number
          name: string
          unit: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          current_stock?: number
          description?: string | null
          id?: string
          is_active?: boolean
          min_stock?: number
          name: string
          unit?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          current_stock?: number
          description?: string | null
          id?: string
          is_active?: boolean
          min_stock?: number
          name?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_lots: {
        Row: {
          created_at: string
          expiry_date: string | null
          id: string
          lot_number: string
          migration_status: string
          sku_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          lot_number: string
          migration_status?: string
          sku_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          lot_number?: string
          migration_status?: string
          sku_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_lots_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "inventory_lots_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "sku_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "inventory_lots_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_posting_command_movements: {
        Row: {
          command_id: string
          movement_id: string
          sequence_no: number
        }
        Insert: {
          command_id: string
          movement_id: string
          sequence_no: number
        }
        Update: {
          command_id?: string
          movement_id?: string
          sequence_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_posting_command_movements_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "inventory_posting_commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_posting_command_movements_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: true
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_posting_commands: {
        Row: {
          actor_id: string | null
          command_hash: string
          command_payload: Json
          command_type: string
          completed_at: string | null
          created_at: string
          first_movement_id: string | null
          id: string
          idempotency_key: string
          status: string
        }
        Insert: {
          actor_id?: string | null
          command_hash: string
          command_payload: Json
          command_type: string
          completed_at?: string | null
          created_at?: string
          first_movement_id?: string | null
          id?: string
          idempotency_key: string
          status?: string
        }
        Update: {
          actor_id?: string | null
          command_hash?: string
          command_payload?: Json
          command_type?: string
          completed_at?: string | null
          created_at?: string
          first_movement_id?: string | null
          id?: string
          idempotency_key?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_posting_commands_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_posting_commands_first_movement_id_fkey"
            columns: ["first_movement_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_items: {
        Row: {
          conversion_factor_snapshot: number | null
          created_at: string
          entered_quantity: number | null
          id: string
          issue_id: string
          quantity: number
          sku_id: string
          sku_name_snapshot: string | null
          snapshot_quality: string
          transaction_unit_id: string | null
          unit_price: number | null
          uom_name_snapshot: string | null
        }
        Insert: {
          conversion_factor_snapshot?: number | null
          created_at?: string
          entered_quantity?: number | null
          id?: string
          issue_id: string
          quantity: number
          sku_id: string
          sku_name_snapshot?: string | null
          snapshot_quality?: string
          transaction_unit_id?: string | null
          unit_price?: number | null
          uom_name_snapshot?: string | null
        }
        Update: {
          conversion_factor_snapshot?: number | null
          created_at?: string
          entered_quantity?: number | null
          id?: string
          issue_id?: string
          quantity?: number
          sku_id?: string
          sku_name_snapshot?: string | null
          snapshot_quality?: string
          transaction_unit_id?: string | null
          unit_price?: number | null
          uom_name_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "issue_items_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "issue_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "sku_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "issue_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_items_transaction_unit_id_fkey"
            columns: ["transaction_unit_id"]
            isOneToOne: false
            referencedRelation: "sku_transaction_units"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          code: string
          created_at: string
          creator_id: string
          customer_id: string | null
          destination_type: string
          driver_name: string | null
          id: string
          invoice_images: string[]
          notes: string | null
          status: string
          sub_zone_id: string | null
          updated_at: string
          vehicle_plate: string | null
          zone_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          creator_id: string
          customer_id?: string | null
          destination_type: string
          driver_name?: string | null
          id?: string
          invoice_images?: string[]
          notes?: string | null
          status?: string
          sub_zone_id?: string | null
          updated_at?: string
          vehicle_plate?: string | null
          zone_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          creator_id?: string
          customer_id?: string | null
          destination_type?: string
          driver_name?: string | null
          id?: string
          invoice_images?: string[]
          notes?: string | null
          status?: string
          sub_zone_id?: string | null
          updated_at?: string
          vehicle_plate?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "issues_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_sub_zone_id_fkey"
            columns: ["sub_zone_id"]
            isOneToOne: false
            referencedRelation: "sub_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      liquidation_items: {
        Row: {
          conversion_factor_snapshot: number | null
          created_at: string
          entered_quantity: number | null
          id: string
          liquidation_note_id: string
          method: Database["public"]["Enums"]["liquidation_method"]
          notes: string | null
          proceeds: number
          quantity: number
          sku_id: string
          snapshot_quality: string
          source_item_id: string | null
          transaction_unit_id: string | null
          unit_value: number | null
        }
        Insert: {
          conversion_factor_snapshot?: number | null
          created_at?: string
          entered_quantity?: number | null
          id?: string
          liquidation_note_id: string
          method?: Database["public"]["Enums"]["liquidation_method"]
          notes?: string | null
          proceeds?: number
          quantity?: number
          sku_id: string
          snapshot_quality?: string
          source_item_id?: string | null
          transaction_unit_id?: string | null
          unit_value?: number | null
        }
        Update: {
          conversion_factor_snapshot?: number | null
          created_at?: string
          entered_quantity?: number | null
          id?: string
          liquidation_note_id?: string
          method?: Database["public"]["Enums"]["liquidation_method"]
          notes?: string | null
          proceeds?: number
          quantity?: number
          sku_id?: string
          snapshot_quality?: string
          source_item_id?: string | null
          transaction_unit_id?: string | null
          unit_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "liquidation_items_liquidation_note_id_fkey"
            columns: ["liquidation_note_id"]
            isOneToOne: false
            referencedRelation: "liquidation_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liquidation_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "liquidation_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "sku_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "liquidation_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liquidation_items_transaction_unit_id_fkey"
            columns: ["transaction_unit_id"]
            isOneToOne: false
            referencedRelation: "sku_transaction_units"
            referencedColumns: ["id"]
          },
        ]
      }
      liquidation_notes: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          code: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          reason: string | null
          status: Database["public"]["Enums"]["liquidation_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          code: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["liquidation_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          code?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["liquidation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "liquidation_notes_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liquidation_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lot_stock_balances: {
        Row: {
          id: string
          location_id: string
          lot_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          id?: string
          location_id: string
          lot_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          id?: string
          location_id?: string
          lot_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lot_stock_balances_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lot_stock_balances_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_attribute_definitions: {
        Row: {
          attribute_definition_id: string
          created_at: string
          display_order: number
          is_required: boolean
          is_variant_axis: boolean
          product_id: string
        }
        Insert: {
          attribute_definition_id: string
          created_at?: string
          display_order: number
          is_required?: boolean
          is_variant_axis?: boolean
          product_id: string
        }
        Update: {
          attribute_definition_id?: string
          created_at?: string
          display_order?: number
          is_required?: boolean
          is_variant_axis?: boolean
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_attribute_definitions_attribute_definition_id_fkey"
            columns: ["attribute_definition_id"]
            isOneToOne: false
            referencedRelation: "attribute_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_attribute_definitions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          catalog_status: string
          category_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          images: string[]
          internal_notes: string | null
          name: string
          search_keywords: string[]
          updated_at: string
        }
        Insert: {
          catalog_status?: string
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          images?: string[]
          internal_notes?: string | null
          name: string
          search_keywords?: string[]
          updated_at?: string
        }
        Update: {
          catalog_status?: string
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          images?: string[]
          internal_notes?: string | null
          name?: string
          search_keywords?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          is_protected: boolean
          name: string
          role: string
          sub_zone_id: string | null
          updated_at: string
          username: string
          zone_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          is_active?: boolean
          is_protected?: boolean
          name: string
          role: string
          sub_zone_id?: string | null
          updated_at?: string
          username: string
          zone_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_protected?: boolean
          name?: string
          role?: string
          sub_zone_id?: string | null
          updated_at?: string
          username?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_sub_zone_id_fkey"
            columns: ["sub_zone_id"]
            isOneToOne: false
            referencedRelation: "sub_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_items: {
        Row: {
          batch_no: string | null
          conversion_factor_snapshot: number | null
          created_at: string
          entered_quantity: number | null
          expiry_date: string | null
          id: string
          quantity: number
          receipt_id: string
          sku_id: string
          sku_name_snapshot: string | null
          snapshot_quality: string
          transaction_unit_id: string | null
          unit_cost: number | null
          uom_name_snapshot: string | null
        }
        Insert: {
          batch_no?: string | null
          conversion_factor_snapshot?: number | null
          created_at?: string
          entered_quantity?: number | null
          expiry_date?: string | null
          id?: string
          quantity: number
          receipt_id: string
          sku_id: string
          sku_name_snapshot?: string | null
          snapshot_quality?: string
          transaction_unit_id?: string | null
          unit_cost?: number | null
          uom_name_snapshot?: string | null
        }
        Update: {
          batch_no?: string | null
          conversion_factor_snapshot?: number | null
          created_at?: string
          entered_quantity?: number | null
          expiry_date?: string | null
          id?: string
          quantity?: number
          receipt_id?: string
          sku_id?: string
          sku_name_snapshot?: string | null
          snapshot_quality?: string
          transaction_unit_id?: string | null
          unit_cost?: number | null
          uom_name_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "receipt_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "sku_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "receipt_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_items_transaction_unit_id_fkey"
            columns: ["transaction_unit_id"]
            isOneToOne: false
            referencedRelation: "sku_transaction_units"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          code: string
          created_at: string
          created_by: string | null
          id: string
          invoice_images: string[]
          linked_requisition_ids: string[]
          notes: string | null
          status: Database["public"]["Enums"]["receipt_status"]
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_images?: string[]
          linked_requisition_ids?: string[]
          notes?: string | null
          status?: Database["public"]["Enums"]["receipt_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_images?: string[]
          linked_requisition_ids?: string[]
          notes?: string | null
          status?: Database["public"]["Enums"]["receipt_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_order_items: {
        Row: {
          conversion_factor_snapshot: number | null
          cost: number | null
          created_at: string
          defect_item_id: string | null
          entered_quantity: number | null
          id: string
          outcome: Database["public"]["Enums"]["repair_outcome"] | null
          quantity: number
          repair_detail: string | null
          repair_order_id: string
          sku_id: string
          snapshot_quality: string
          transaction_unit_id: string | null
        }
        Insert: {
          conversion_factor_snapshot?: number | null
          cost?: number | null
          created_at?: string
          defect_item_id?: string | null
          entered_quantity?: number | null
          id?: string
          outcome?: Database["public"]["Enums"]["repair_outcome"] | null
          quantity?: number
          repair_detail?: string | null
          repair_order_id: string
          sku_id: string
          snapshot_quality?: string
          transaction_unit_id?: string | null
        }
        Update: {
          conversion_factor_snapshot?: number | null
          cost?: number | null
          created_at?: string
          defect_item_id?: string | null
          entered_quantity?: number | null
          id?: string
          outcome?: Database["public"]["Enums"]["repair_outcome"] | null
          quantity?: number
          repair_detail?: string | null
          repair_order_id?: string
          sku_id?: string
          snapshot_quality?: string
          transaction_unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_order_items_defect_item_id_fkey"
            columns: ["defect_item_id"]
            isOneToOne: false
            referencedRelation: "defect_note_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_order_items_repair_order_id_fkey"
            columns: ["repair_order_id"]
            isOneToOne: false
            referencedRelation: "repair_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_order_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "repair_order_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "sku_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "repair_order_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_order_items_transaction_unit_id_fkey"
            columns: ["transaction_unit_id"]
            isOneToOne: false
            referencedRelation: "sku_transaction_units"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_orders: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expected_return_at: string | null
          id: string
          notes: string | null
          returned_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["repair_status"]
          total_cost: number | null
          updated_at: string
          vendor: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expected_return_at?: string | null
          id?: string
          notes?: string | null
          returned_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["repair_status"]
          total_cost?: number | null
          updated_at?: string
          vendor: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expected_return_at?: string | null
          id?: string
          notes?: string | null
          returned_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["repair_status"]
          total_cost?: number | null
          updated_at?: string
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      requisition_items: {
        Row: {
          conversion_factor_snapshot: number | null
          created_at: string
          entered_quantity: number | null
          id: string
          quantity: number
          requisition_id: string
          sku_id: string
          sku_name_snapshot: string | null
          snapshot_quality: string
          transaction_unit_id: string | null
          uom_name_snapshot: string | null
        }
        Insert: {
          conversion_factor_snapshot?: number | null
          created_at?: string
          entered_quantity?: number | null
          id?: string
          quantity: number
          requisition_id: string
          sku_id: string
          sku_name_snapshot?: string | null
          snapshot_quality?: string
          transaction_unit_id?: string | null
          uom_name_snapshot?: string | null
        }
        Update: {
          conversion_factor_snapshot?: number | null
          created_at?: string
          entered_quantity?: number | null
          id?: string
          quantity?: number
          requisition_id?: string
          sku_id?: string
          sku_name_snapshot?: string | null
          snapshot_quality?: string
          transaction_unit_id?: string | null
          uom_name_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requisition_items_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "requisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisition_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "requisition_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "sku_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "requisition_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisition_items_transaction_unit_id_fkey"
            columns: ["transaction_unit_id"]
            isOneToOne: false
            referencedRelation: "sku_transaction_units"
            referencedColumns: ["id"]
          },
        ]
      }
      requisition_return_items: {
        Row: {
          conversion_factor_snapshot: number | null
          entered_quantity: number | null
          id: string
          quantity: number
          return_id: string
          sku_id: string
          snapshot_quality: string
          transaction_unit_id: string | null
        }
        Insert: {
          conversion_factor_snapshot?: number | null
          entered_quantity?: number | null
          id?: string
          quantity: number
          return_id: string
          sku_id: string
          snapshot_quality?: string
          transaction_unit_id?: string | null
        }
        Update: {
          conversion_factor_snapshot?: number | null
          entered_quantity?: number | null
          id?: string
          quantity?: number
          return_id?: string
          sku_id?: string
          snapshot_quality?: string
          transaction_unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requisition_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "requisition_returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisition_return_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "requisition_return_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "sku_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "requisition_return_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisition_return_items_transaction_unit_id_fkey"
            columns: ["transaction_unit_id"]
            isOneToOne: false
            referencedRelation: "sku_transaction_units"
            referencedColumns: ["id"]
          },
        ]
      }
      requisition_returns: {
        Row: {
          created_at: string
          id: string
          requisition_id: string
          returned_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          requisition_id: string
          returned_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          requisition_id?: string
          returned_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requisition_returns_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "requisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisition_returns_returned_by_fkey"
            columns: ["returned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      requisitions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          code: string
          created_at: string
          fulfilled_at: string | null
          fulfilled_by: string | null
          fulfillment_notes: string | null
          id: string
          linked_defect_id: string | null
          purpose: string
          received_at: string | null
          received_by: string | null
          invoice_images: string[]
          rejection_reason: string | null
          requester_id: string
          requisition_type: Database["public"]["Enums"]["requisition_type"]
          status: Database["public"]["Enums"]["requisition_status"]
          sub_zone_id: string | null
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          code: string
          created_at?: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          fulfillment_notes?: string | null
          id?: string
          invoice_images?: string[]
          linked_defect_id?: string | null
          purpose: string
          received_at?: string | null
          received_by?: string | null
          rejection_reason?: string | null
          requester_id: string
          requisition_type?: Database["public"]["Enums"]["requisition_type"]
          status?: Database["public"]["Enums"]["requisition_status"]
          sub_zone_id?: string | null
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          code?: string
          created_at?: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          fulfillment_notes?: string | null
          id?: string
          invoice_images?: string[]
          linked_defect_id?: string | null
          purpose?: string
          received_at?: string | null
          received_by?: string | null
          rejection_reason?: string | null
          requester_id?: string
          requisition_type?: Database["public"]["Enums"]["requisition_type"]
          status?: Database["public"]["Enums"]["requisition_status"]
          sub_zone_id?: string | null
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requisitions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisitions_fulfilled_by_fkey"
            columns: ["fulfilled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisitions_linked_defect_id_fkey"
            columns: ["linked_defect_id"]
            isOneToOne: false
            referencedRelation: "defect_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisitions_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisitions_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisitions_sub_zone_id_fkey"
            columns: ["sub_zone_id"]
            isOneToOne: false
            referencedRelation: "sub_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requisitions_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      serial_items: {
        Row: {
          created_at: string
          id: string
          location_id: string | null
          lot_id: string | null
          serial_code: string
          sku_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id?: string | null
          lot_id?: string | null
          serial_code: string
          sku_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string | null
          lot_id?: string | null
          serial_code?: string
          sku_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "serial_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serial_items_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serial_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "serial_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "sku_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "serial_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      sku_attribute_values: {
        Row: {
          attribute_definition_id: string
          boolean_value: boolean | null
          created_at: string
          legacy_text_value: string | null
          numeric_value: number | null
          option_value_id: string | null
          sku_id: string
          text_value: string | null
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          attribute_definition_id: string
          boolean_value?: boolean | null
          created_at?: string
          legacy_text_value?: string | null
          numeric_value?: number | null
          option_value_id?: string | null
          sku_id: string
          text_value?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          attribute_definition_id?: string
          boolean_value?: boolean | null
          created_at?: string
          legacy_text_value?: string | null
          numeric_value?: number | null
          option_value_id?: string | null
          sku_id?: string
          text_value?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sku_attribute_values_attribute_definition_id_fkey"
            columns: ["attribute_definition_id"]
            isOneToOne: false
            referencedRelation: "attribute_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_attribute_values_option_value_id_attribute_definition__fkey"
            columns: ["option_value_id", "attribute_definition_id"]
            isOneToOne: false
            referencedRelation: "attribute_option_values"
            referencedColumns: ["id", "attribute_definition_id"]
          },
          {
            foreignKeyName: "sku_attribute_values_option_value_id_fkey"
            columns: ["option_value_id"]
            isOneToOne: false
            referencedRelation: "attribute_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_attribute_values_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_attribute_values_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "sku_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_attribute_values_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_attribute_values_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      sku_prices: {
        Row: {
          amount: number
          base_unit_amount: number | null
          created_at: string
          currency: string
          effective_period: unknown
          id: string
          price_basis: string
          price_type: string
          sku_id: string
          source: string | null
          transaction_unit_id: string | null
        }
        Insert: {
          amount: number
          base_unit_amount?: number | null
          created_at?: string
          currency?: string
          effective_period?: unknown
          id?: string
          price_basis: string
          price_type: string
          sku_id: string
          source?: string | null
          transaction_unit_id?: string | null
        }
        Update: {
          amount?: number
          base_unit_amount?: number | null
          created_at?: string
          currency?: string
          effective_period?: unknown
          id?: string
          price_basis?: string
          price_type?: string
          sku_id?: string
          source?: string | null
          transaction_unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sku_prices_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_prices_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "sku_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_prices_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_prices_transaction_unit_id_fkey"
            columns: ["transaction_unit_id"]
            isOneToOne: false
            referencedRelation: "sku_transaction_units"
            referencedColumns: ["id"]
          },
        ]
      }
      sku_transaction_units: {
        Row: {
          allow_fraction: boolean
          allow_issue: boolean
          allow_receipt: boolean
          code: string
          created_at: string
          display_name: string
          factor_to_base: number
          id: string
          is_active: boolean
          is_base: boolean
          legacy_parent_sku_id: string | null
          sku_id: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          allow_fraction?: boolean
          allow_issue?: boolean
          allow_receipt?: boolean
          code: string
          created_at?: string
          display_name: string
          factor_to_base: number
          id?: string
          is_active?: boolean
          is_base?: boolean
          legacy_parent_sku_id?: string | null
          sku_id: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          allow_fraction?: boolean
          allow_issue?: boolean
          allow_receipt?: boolean
          code?: string
          created_at?: string
          display_name?: string
          factor_to_base?: number
          id?: string
          is_active?: boolean
          is_base?: boolean
          legacy_parent_sku_id?: string | null
          sku_id?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sku_transaction_units_legacy_parent_sku_id_fkey"
            columns: ["legacy_parent_sku_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_transaction_units_legacy_parent_sku_id_fkey"
            columns: ["legacy_parent_sku_id"]
            isOneToOne: false
            referencedRelation: "sku_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_transaction_units_legacy_parent_sku_id_fkey"
            columns: ["legacy_parent_sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_transaction_units_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_transaction_units_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "sku_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_transaction_units_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_transaction_units_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      skus: {
        Row: {
          allow_fraction: boolean
          base_unit_id: string | null
          created_at: string
          id: string
          images: string[]
          inventory_policy: string
          is_default: boolean
          min_stock: number
          price: number | null
          product_id: string
          sku_code: string | null
          sku_status: string
          tracking_policy: string
          updated_at: string
        }
        Insert: {
          allow_fraction?: boolean
          base_unit_id?: string | null
          created_at?: string
          id?: string
          images?: string[]
          inventory_policy?: string
          is_default?: boolean
          min_stock?: number
          price?: number | null
          product_id: string
          sku_code?: string | null
          sku_status?: string
          tracking_policy?: string
          updated_at?: string
        }
        Update: {
          allow_fraction?: boolean
          base_unit_id?: string | null
          created_at?: string
          id?: string
          images?: string[]
          inventory_policy?: string
          is_default?: boolean
          min_stock?: number
          price?: number | null
          product_id?: string
          sku_code?: string | null
          sku_status?: string
          tracking_policy?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skus_base_unit_id_fkey"
            columns: ["base_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_balances: {
        Row: {
          base_unit_id: string | null
          id: string
          location_id: string
          quantity: number
          reserved_quantity: number
          sku_id: string
          updated_at: string
        }
        Insert: {
          base_unit_id?: string | null
          id?: string
          location_id: string
          quantity?: number
          reserved_quantity?: number
          sku_id: string
          updated_at?: string
        }
        Update: {
          base_unit_id?: string | null
          id?: string
          location_id?: string
          quantity?: number
          reserved_quantity?: number
          sku_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_balances_base_unit_id_fkey"
            columns: ["base_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_balances_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_balances_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "stock_balances_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "sku_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "stock_balances_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_locations: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          type: Database["public"]["Enums"]["location_type"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          type?: Database["public"]["Enums"]["location_type"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          type?: Database["public"]["Enums"]["location_type"]
          updated_at?: string
        }
        Relationships: []
      }
      stock_movement_allocations: {
        Row: {
          base_quantity: number
          created_at: string
          id: string
          lot_id: string | null
          movement_id: string
          serial_id: string | null
        }
        Insert: {
          base_quantity: number
          created_at?: string
          id?: string
          lot_id?: string | null
          movement_id: string
          serial_id?: string | null
        }
        Update: {
          base_quantity?: number
          created_at?: string
          id?: string
          lot_id?: string | null
          movement_id?: string
          serial_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movement_allocations_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movement_allocations_movement_id_fkey"
            columns: ["movement_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movement_allocations_serial_id_fkey"
            columns: ["serial_id"]
            isOneToOne: false
            referencedRelation: "serial_items"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          base_quantity: number | null
          base_unit_id: string | null
          bom_version_id: string | null
          conversion_factor_snapshot: number | null
          created_at: string
          created_by: string | null
          entered_quantity: number | null
          from_location_id: string | null
          id: string
          idempotency_key: string | null
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes: string | null
          quantity: number
          ref_id: string | null
          ref_type: string | null
          reversal_of_movement_id: string | null
          sku_id: string
          sku_name_snapshot: string | null
          snapshot_quality: string
          to_location_id: string | null
          transaction_unit_id: string | null
          unit_cost: number | null
          uom_name_snapshot: string | null
        }
        Insert: {
          base_quantity?: number | null
          base_unit_id?: string | null
          bom_version_id?: string | null
          conversion_factor_snapshot?: number | null
          created_at?: string
          created_by?: string | null
          entered_quantity?: number | null
          from_location_id?: string | null
          id?: string
          idempotency_key?: string | null
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          quantity: number
          ref_id?: string | null
          ref_type?: string | null
          reversal_of_movement_id?: string | null
          sku_id: string
          sku_name_snapshot?: string | null
          snapshot_quality?: string
          to_location_id?: string | null
          transaction_unit_id?: string | null
          unit_cost?: number | null
          uom_name_snapshot?: string | null
        }
        Update: {
          base_quantity?: number | null
          base_unit_id?: string | null
          bom_version_id?: string | null
          conversion_factor_snapshot?: number | null
          created_at?: string
          created_by?: string | null
          entered_quantity?: number | null
          from_location_id?: string | null
          id?: string
          idempotency_key?: string | null
          movement_type?: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          quantity?: number
          ref_id?: string | null
          ref_type?: string | null
          reversal_of_movement_id?: string | null
          sku_id?: string
          sku_name_snapshot?: string | null
          snapshot_quality?: string
          to_location_id?: string | null
          transaction_unit_id?: string | null
          unit_cost?: number | null
          uom_name_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_base_unit_id_fkey"
            columns: ["base_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_bom_version_id_fkey"
            columns: ["bom_version_id"]
            isOneToOne: false
            referencedRelation: "bom_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_reversal_of_movement_id_fkey"
            columns: ["reversal_of_movement_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "stock_movements_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "sku_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "stock_movements_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_transaction_unit_id_fkey"
            columns: ["transaction_unit_id"]
            isOneToOne: false
            referencedRelation: "sku_transaction_units"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_reservation_allocations: {
        Row: {
          consumed_quantity: number
          created_at: string
          id: string
          lot_id: string | null
          reservation_id: string
          reserved_quantity: number
          serial_id: string | null
          updated_at: string
        }
        Insert: {
          consumed_quantity?: number
          created_at?: string
          id?: string
          lot_id?: string | null
          reservation_id: string
          reserved_quantity: number
          serial_id?: string | null
          updated_at?: string
        }
        Update: {
          consumed_quantity?: number
          created_at?: string
          id?: string
          lot_id?: string | null
          reservation_id?: string
          reserved_quantity?: number
          serial_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_reservation_allocations_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "inventory_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservation_allocations_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "stock_reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservation_allocations_serial_id_fkey"
            columns: ["serial_id"]
            isOneToOne: false
            referencedRelation: "serial_items"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_reservations: {
        Row: {
          base_unit_id: string | null
          bom_version_id: string | null
          command_hash: string | null
          consumed_quantity: number
          created_at: string
          id: string
          idempotency_key: string | null
          location_id: string
          reserved_quantity: number
          sku_id: string
          source_document_id: string
          source_document_line_id: string | null
          source_document_type: string
          status: string
          updated_at: string
        }
        Insert: {
          base_unit_id?: string | null
          bom_version_id?: string | null
          command_hash?: string | null
          consumed_quantity?: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          location_id: string
          reserved_quantity: number
          sku_id: string
          source_document_id: string
          source_document_line_id?: string | null
          source_document_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          base_unit_id?: string | null
          bom_version_id?: string | null
          command_hash?: string | null
          consumed_quantity?: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          location_id?: string
          reserved_quantity?: number
          sku_id?: string
          source_document_id?: string
          source_document_line_id?: string | null
          source_document_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_reservations_base_unit_id_fkey"
            columns: ["base_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_bom_version_id_fkey"
            columns: ["bom_version_id"]
            isOneToOne: false
            referencedRelation: "bom_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "stock_reservations_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "sku_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "stock_reservations_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      stocktake_items: {
        Row: {
          actual_qty: number
          checked: boolean
          conversion_factor_snapshot: number | null
          created_at: string
          entered_quantity: number | null
          id: string
          notes: string
          session_id: string
          sku_id: string
          snapshot_quality: string
          system_qty: number
          transaction_unit_id: string | null
        }
        Insert: {
          actual_qty?: number
          checked?: boolean
          conversion_factor_snapshot?: number | null
          created_at?: string
          entered_quantity?: number | null
          id?: string
          notes?: string
          session_id: string
          sku_id: string
          snapshot_quality?: string
          system_qty?: number
          transaction_unit_id?: string | null
        }
        Update: {
          actual_qty?: number
          checked?: boolean
          conversion_factor_snapshot?: number | null
          created_at?: string
          entered_quantity?: number | null
          id?: string
          notes?: string
          session_id?: string
          sku_id?: string
          snapshot_quality?: string
          system_qty?: number
          transaction_unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stocktake_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "stocktake_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stocktake_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "stocktake_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "sku_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "stocktake_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stocktake_items_transaction_unit_id_fkey"
            columns: ["transaction_unit_id"]
            isOneToOne: false
            referencedRelation: "sku_transaction_units"
            referencedColumns: ["id"]
          },
        ]
      }
      stocktake_sessions: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          location_id: string
          name: string | null
          notes: string | null
          posted_at: string | null
          status: Database["public"]["Enums"]["stocktake_status"]
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          location_id: string
          name?: string | null
          notes?: string | null
          posted_at?: string | null
          status?: Database["public"]["Enums"]["stocktake_status"]
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string
          name?: string | null
          notes?: string | null
          posted_at?: string | null
          status?: Database["public"]["Enums"]["stocktake_status"]
        }
        Relationships: [
          {
            foreignKeyName: "stocktake_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stocktake_sessions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_zones: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          display_order: number
          id: string
          name: string
          updated_at: string
          zone_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          display_order?: number
          id?: string
          name: string
          updated_at?: string
          zone_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          updated_at?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_zones_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tool_borrowing_items: {
        Row: {
          borrowing_id: string
          conversion_factor_snapshot: number | null
          entered_quantity: number | null
          id: string
          notes: string | null
          quantity: number
          returned_quantity: number
          sku_id: string
          snapshot_quality: string
          transaction_unit_id: string | null
        }
        Insert: {
          borrowing_id: string
          conversion_factor_snapshot?: number | null
          entered_quantity?: number | null
          id?: string
          notes?: string | null
          quantity: number
          returned_quantity?: number
          sku_id: string
          snapshot_quality?: string
          transaction_unit_id?: string | null
        }
        Update: {
          borrowing_id?: string
          conversion_factor_snapshot?: number | null
          entered_quantity?: number | null
          id?: string
          notes?: string | null
          quantity?: number
          returned_quantity?: number
          sku_id?: string
          snapshot_quality?: string
          transaction_unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tool_borrowing_items_borrowing_id_fkey"
            columns: ["borrowing_id"]
            isOneToOne: false
            referencedRelation: "tool_borrowings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_borrowing_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "tool_borrowing_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "sku_stock"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "tool_borrowing_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_borrowing_items_transaction_unit_id_fkey"
            columns: ["transaction_unit_id"]
            isOneToOne: false
            referencedRelation: "sku_transaction_units"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_borrowings: {
        Row: {
          borrowed_at: string
          borrower_id: string
          code: string
          created_at: string
          expected_return_date: string | null
          id: string
          issued_by: string | null
          notes: string | null
          purpose: string
          received_back_by: string | null
          returned_at: string | null
          status: Database["public"]["Enums"]["tool_borrowing_status"]
          sub_zone_id: string | null
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          borrowed_at?: string
          borrower_id: string
          code: string
          created_at?: string
          expected_return_date?: string | null
          id?: string
          issued_by?: string | null
          notes?: string | null
          purpose: string
          received_back_by?: string | null
          returned_at?: string | null
          status?: Database["public"]["Enums"]["tool_borrowing_status"]
          sub_zone_id?: string | null
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          borrowed_at?: string
          borrower_id?: string
          code?: string
          created_at?: string
          expected_return_date?: string | null
          id?: string
          issued_by?: string | null
          notes?: string | null
          purpose?: string
          received_back_by?: string | null
          returned_at?: string | null
          status?: Database["public"]["Enums"]["tool_borrowing_status"]
          sub_zone_id?: string | null
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tool_borrowings_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_borrowings_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_borrowings_received_back_by_fkey"
            columns: ["received_back_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_borrowings_sub_zone_id_fkey"
            columns: ["sub_zone_id"]
            isOneToOne: false
            referencedRelation: "sub_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tool_borrowings_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          code: string
          created_at: string
          decimal_scale: number
          dimension: string
          factor_to_reference: number
          id: string
          is_active: boolean
          name: string
          symbol: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          decimal_scale?: number
          dimension: string
          factor_to_reference?: number
          id?: string
          is_active?: boolean
          name: string
          symbol: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          decimal_scale?: number
          dimension?: string
          factor_to_reference?: number
          id?: string
          is_active?: boolean
          name?: string
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          code: string
          created_at: string
          current_odo: number
          default_driver: string | null
          document_images: string[]
          fuel_norm: number | null
          fuel_type_id: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          odo_unit: Database["public"]["Enums"]["fuel_calc_unit"]
          qr_token: string
          sub_zone_id: string | null
          type: Database["public"]["Enums"]["vehicle_type"]
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          current_odo?: number
          default_driver?: string | null
          document_images?: string[]
          fuel_norm?: number | null
          fuel_type_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          odo_unit?: Database["public"]["Enums"]["fuel_calc_unit"]
          qr_token: string
          sub_zone_id?: string | null
          type?: Database["public"]["Enums"]["vehicle_type"]
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          current_odo?: number
          default_driver?: string | null
          document_images?: string[]
          fuel_norm?: number | null
          fuel_type_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          odo_unit?: Database["public"]["Enums"]["fuel_calc_unit"]
          qr_token?: string
          sub_zone_id?: string | null
          type?: Database["public"]["Enums"]["vehicle_type"]
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_fuel_type_id_fkey"
            columns: ["fuel_type_id"]
            isOneToOne: false
            referencedRelation: "fuel_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_sub_zone_id_fkey"
            columns: ["sub_zone_id"]
            isOneToOne: false
            referencedRelation: "sub_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      location_stock: {
        Row: {
          location_id: string | null
          product_id: string | null
          quantity: number | null
          sku_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_balances_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      sku_stock: {
        Row: {
          min_stock: number | null
          product_id: string | null
          quantity: number | null
          sku_id: string | null
          unit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _move_stock: {
        Args: {
          p_by: string
          p_from: string
          p_mtype: Database["public"]["Enums"]["movement_type"]
          p_notes?: string
          p_qty: number
          p_ref_id: string
          p_ref_type: string
          p_sku: string
          p_to: string
        }
        Returns: undefined
      }
      _post_inventory_movement: { Args: { p_command: Json }; Returns: string }
      _posting_actor_has_role: {
        Args: { p_actor: string; p_roles: string[] }
        Returns: boolean
      }
      _posting_lock_balance: {
        Args: {
          p_base_unit_id: string
          p_location_id: string
          p_sku_id: string
        }
        Returns: number
      }
      _posting_pick_lots: {
        Args: { p_location_id: string; p_needed: number; p_sku_id: string }
        Returns: {
          lot_id: string
          take: number
        }[]
      }
      _posting_resolve_unit: {
        Args: {
          p_entered: number
          p_sku_id: string
          p_transaction_unit_id: string
        }
        Returns: {
          allow_fraction: boolean
          base_quantity: number
          base_scale: number
          entered_quantity: number
          factor: number
          tracking_policy: string
          unit_id: string
        }[]
      }
      _posting_round_base: {
        Args: { p_scale: number; p_value: number }
        Returns: number
      }
      _posting_validate_operation_shape: {
        Args: { p_lines: Json; p_type: string }
        Returns: undefined
      }
      _rebuild_defect_notes: {
        Args: { p_mode: string; p_repair_id: string }
        Returns: undefined
      }
      _receipt_has_active_linked: { Args: { p_id: string }; Returns: boolean }
      _revert_movements: {
        Args: { p_by: string; p_ref_id: string; p_ref_type: string }
        Returns: undefined
      }
      adjust_stock: {
        Args: {
          p_by: string
          p_delta: number
          p_location_id: string
          p_reason: string
          p_sku_id: string
        }
        Returns: undefined
      }
      admin_purge_user_data: { Args: { p_user_id: string }; Returns: undefined }
      admin_update_profile:
        | {
            Args: {
              p_is_active: boolean
              p_name: string
              p_role: string
              p_user_id: string
              p_zone_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_is_active: boolean
              p_name: string
              p_role: string
              p_sub_zone_id?: string
              p_user_id: string
              p_zone_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_email?: string
              p_is_active: boolean
              p_name: string
              p_role: string
              p_sub_zone_id?: string
              p_user_id: string
              p_zone_id: string
            }
            Returns: undefined
          }
      admin_update_username: {
        Args: { p_user_id: string; p_username: string }
        Returns: undefined
      }
      ai_get_fuel_summary: {
        Args: {
          p_end_date?: string
          p_limit?: number
          p_start_date?: string
          p_vehicle_id?: string
        }
        Returns: {
          dispense_code: string
          dispense_date: string
          dispense_id: string
          driver_name: string
          fuel_type_name: string
          notes: string
          quantity: number
          vehicle_code: string
          vehicle_name: string
        }[]
      }
      ai_get_stock_summary: {
        Args: { p_limit?: number; p_location_id?: string; p_query?: string }
        Returns: {
          attributes: Json
          category_name: string
          location_details: string
          min_stock: number
          price: number
          product_id: string
          product_name: string
          sku_id: string
          total_stock: number
          unit: string
        }[]
      }
      approve_exchange: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      approve_liquidation: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      approve_receipt: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      approve_requisition: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      can_activate_bom: { Args: never; Returns: boolean }
      can_approve_stocktake_adjustment: { Args: never; Returns: boolean }
      can_edit_bom: { Args: never; Returns: boolean }
      can_post_inventory: { Args: never; Returns: boolean }
      can_post_technician_inventory: { Args: never; Returns: boolean }
      cancel_defect: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      cancel_exchange: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      cancel_fuel_dispense: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      cancel_fuel_receipt: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      cancel_issue: { Args: { p_by: string; p_id: string }; Returns: undefined }
      cancel_liquidation: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      cancel_receipt: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      cancel_repair: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      cancel_repair_request: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      cancel_requisition: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      cancel_tool_borrowing: {
        Args: { p_borrowing_id: string; p_by: string }
        Returns: undefined
      }
      claim_tool_reminders: {
        Args: { p_now?: string }
        Returns: {
          borrower_id: string
          borrowing_id: string
          code: string
          expected_return_date: string
          overdue_days: number
          reminder_type: "due_soon" | "overdue"
          tool_names: string
        }[]
      }
      complete_liquidation: {
        Args: { p_by: string; p_id: string; p_items_outcome: Json }
        Returns: undefined
      }
      complete_repair: {
        Args: { p_by: string; p_outcomes: Json; p_repair_id: string }
        Returns: undefined
      }
      consume_reservation: {
        Args: { p_actor: string; p_quantity: number; p_reservation_id: string }
        Returns: undefined
      }
      create_exchange: {
        Args: { p_by: string; p_defect_id: string }
        Returns: string
      }
      create_fuel_dispense:
        | {
            Args: {
              p_by: string
              p_current_odo: number
              p_driver_name: string
              p_fuel_type_id: string
              p_meter_images: string[]
              p_notes: string
              p_quantity: number
              p_vehicle_id: string
              p_zone_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_by: string
              p_current_odo: number
              p_driver_name: string
              p_fuel_type_id: string
              p_meter_images: string[]
              p_notes: string
              p_quantity: number
              p_sub_zone_id?: string
              p_vehicle_id: string
              p_zone_id: string
            }
            Returns: string
          }
      create_fuel_receipt: {
        Args: {
          p_by: string
          p_fuel_type_id: string
          p_invoice_images: string[]
          p_invoice_number: string
          p_notes: string
          p_quantity: number
          p_supplier_id: string
          p_unit_price: number
        }
        Returns: string
      }
      create_issue: {
        Args: {
          p_by: string
          p_customer_id: string
          p_destination_type: string
          p_driver_name: string
          p_items: Json
          p_notes: string
          p_sub_zone_id?: string
          p_vehicle_plate: string
          p_zone_id: string
        }
        Returns: string
      }
      create_liquidation: {
        Args: { p_by: string; p_items: Json; p_reason: string }
        Returns: string
      }
      create_notification: {
        Args: {
          p_body?: string
          p_link?: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      create_receipt: {
        Args: {
          p_by: string
          p_invoice_images?: string[]
          p_items: Json
          p_notes?: string
          p_supplier_id: string
        }
        Returns: string
      }
      create_requisition: {
        Args: {
          p_items: Json
          p_linked_defect_id: string
          p_purpose: string
          p_requester_id: string
          p_sub_zone_id?: string
          p_type: Database["public"]["Enums"]["requisition_type"]
          p_zone_id: string
        }
        Returns: string
      }
      create_stocktake:
        | { Args: { p_by: string; p_location_id: string }; Returns: string }
        | {
            Args: { p_by: string; p_location_id: string; p_name: string }
            Returns: string
          }
      create_tool_borrowing:
        | {
            Args: {
              p_borrower_id: string
              p_expected_return_date: string
              p_items: Json
              p_purpose: string
              p_zone_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_borrower_id: string
              p_expected_return_date: string
              p_items: Json
              p_purpose: string
              p_sub_zone_id?: string
              p_zone_id: string
            }
            Returns: string
          }
      delete_defect: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      delete_issue: { Args: { p_by: string; p_id: string }; Returns: undefined }
      delete_liquidation: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      delete_receipt: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      delete_repair: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      delete_requisition: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      delete_stocktake: {
        Args: { p_by: string; p_session_id: string }
        Returns: undefined
      }
      fulfill_requisition: {
        Args: { p_by: string; p_id: string; p_notes: string }
        Returns: undefined
      }
      get_login_email: { Args: { p_username: string }; Returns: string }
      get_vehicle_by_qr: { Args: { p_qr_text: string }; Returns: Json }
      is_accountant: { Args: never; Returns: boolean }
      is_manager: { Args: never; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      is_superuser: { Args: never; Returns: boolean }
      is_technician: { Args: never; Returns: boolean }
      is_warehouse: { Args: never; Returns: boolean }
      issue_exchange: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      liquidate_defects: {
        Args: { p_by: string; p_id: string; p_items_outcome: Json }
        Returns: undefined
      }
      list_requester_accounts: {
        Args: never
        Returns: {
          email: string
          id: string
          name: string
          sub_zone_id: string
          username: string
          zone_id: string
        }[]
      }
      mark_defect_collected: {
        Args: { p_by: string; p_collected: boolean; p_id: string }
        Returns: undefined
      }
      next_code: { Args: { prefix: string; seq: unknown }; Returns: string }
      next_sku_code: { Args: never; Returns: string }
      post_assembly: {
        Args: {
          p_actor: string
          p_bom_version_id: string
          p_component_location_id: string
          p_document_id: string
          p_finished_location_id: string
          p_idempotency_key: string
          p_kit_sku_id: string
          p_quantity: number
        }
        Returns: string
      }
      post_defect_command: { Args: { p_command: Json }; Returns: string }
      post_direct_issue_command: { Args: { p_command: Json }; Returns: string }
      post_disassembly: {
        Args: {
          p_actor: string
          p_bom_version_id: string
          p_document_id: string
          p_from_location_id: string
          p_idempotency_key: string
          p_items: Json
          p_kit_sku_id: string
          p_quantity: number
        }
        Returns: string
      }
      post_inventory_movement: { Args: { p_command: Json }; Returns: string }
      post_issue: { Args: { p_by: string; p_id: string }; Returns: undefined }
      post_liquidation_command: { Args: { p_command: Json }; Returns: string }
      post_receipt: { Args: { p_by: string; p_id: string }; Returns: Json }
      post_receipt_command: { Args: { p_command: Json }; Returns: string }
      post_repair_command: { Args: { p_command: Json }; Returns: string }
      post_reserved_issue: {
        Args: {
          p_actor: string
          p_allocations: Json
          p_document_id: string
          p_idempotency_key: string
          p_quantity: number
          p_reservation_id: string
        }
        Returns: string
      }
      post_return_command: { Args: { p_command: Json }; Returns: string }
      post_stocktake: {
        Args: { p_by: string; p_session_id: string }
        Returns: undefined
      }
      post_stocktake_adjustment_command: {
        Args: { p_command: Json }
        Returns: string
      }
      post_transfer_command: { Args: { p_command: Json }; Returns: string }
      post_virtual_kit_issue: {
        Args: {
          p_actor: string
          p_bom_version_id: string
          p_document_id: string
          p_idempotency_key: string
          p_kit_quantity: number
          p_kit_sku_id: string
          p_location_id: string
        }
        Returns: string
      }
      receive_exchange: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      receive_requisition: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      record_defect: {
        Args: { p_by: string; p_items: Json; p_source_loc: string }
        Returns: string
      }
      reject_exchange: {
        Args: { p_by: string; p_id: string; p_reason: string }
        Returns: undefined
      }
      reject_liquidation: {
        Args: { p_by: string; p_id: string; p_reason: string }
        Returns: undefined
      }
      reject_requisition: {
        Args: { p_by: string; p_id: string; p_reason: string }
        Returns: undefined
      }
      release_reservation: {
        Args: { p_actor: string; p_reservation_id: string }
        Returns: undefined
      }
      request_repair: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      reserve_stock: { Args: { p_command: Json }; Returns: string }
      return_requisition_items: {
        Args: { p_by: string; p_items: Json; p_requisition_id: string }
        Returns: undefined
      }
      return_tool_borrowing: {
        Args: {
          p_borrowing_id: string
          p_by: string
          p_items: Json
          p_notes: string
        }
        Returns: undefined
      }
      reverse_inventory_command:
        | {
            Args: { p_idempotency_key: string; p_reason?: string }
            Returns: string[]
          }
        | {
            Args: {
              p_actor: string
              p_idempotency_key: string
              p_reason: string
            }
            Returns: string[]
          }
      reverse_inventory_movement: {
        Args: { p_actor: string; p_movement_id: string; p_reason: string }
        Returns: string
      }
      revert_issue: { Args: { p_by: string; p_id: string }; Returns: undefined }
      revert_liquidation: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      revert_receipt: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      revert_repair: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      revert_requisition: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      revert_stocktake: {
        Args: { p_by: string; p_session_id: string }
        Returns: undefined
      }
      search_ai_knowledge: {
        Args: { p_category?: string; p_limit?: number; p_query: string }
        Returns: {
          category: string
          chunk_id: string
          content: string
          document_id: string
          rank: number
          title: string
        }[]
      }
      search_catalog: {
        Args: { p_query: string }
        Returns: {
          id: string
        }[]
      }
      search_skus: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          product_id: string
          sku_id: string
        }[]
      }
      send_to_repair: {
        Args: {
          p_by: string
          p_defect_item_ids: string[]
          p_expected_return_at: string
          p_sent_at: string
          p_vendor: string
        }
        Returns: string
      }
      submit_requisition: { Args: { p_id: string }; Returns: undefined }
      transfer_stock: {
        Args: {
          p_by: string
          p_from_loc: string
          p_items: Json
          p_to_loc: string
        }
        Returns: undefined
      }
      unaccent_text: { Args: { p_text: string }; Returns: string }
      update_defect_item_images: {
        Args: { p_by: string; p_images: string[]; p_item_id: string }
        Returns: undefined
      }
      update_issue_invoice_images: {
        Args: { p_by: string; p_id: string; p_invoice_images: string[] }
        Returns: undefined
      }
      update_receipt: {
        Args: {
          p_by: string
          p_id: string
          p_invoice_images?: string[]
          p_items: Json
          p_notes?: string
          p_supplier_id: string
        }
        Returns: undefined
      }
      update_receipt_invoice_images: {
        Args: { p_by: string; p_id: string; p_invoice_images: string[] }
        Returns: undefined
      }
      complete_requisition_direct: {
        Args: { p_by: string; p_id: string; p_notes?: string }
        Returns: undefined
      }
      update_requisition_invoice_images: {
        Args: { p_by: string; p_id: string; p_invoice_images: string[] }
        Returns: undefined
      }
      admin_inspect_document_dependencies: {
        Args: { p_kind: string; p_id: string }
        Returns: Json
      }
      admin_delete_document: {
        Args: {
          p_kind: string
          p_id: string
          p_cascade?: boolean
          p_reason?: string
          p_by?: string
        }
        Returns: undefined
      }
      admin_reopen_document: {
        Args: {
          p_kind: string
          p_id: string
          p_reason?: string
          p_by?: string
        }
        Returns: undefined
      }
      admin_override_document_meta: {
        Args: {
          p_kind: string
          p_id: string
          p_created_at?: string | null
          p_actor_id?: string | null
          p_notes?: string | null
          p_reason?: string
          p_by?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      damage_type:
        | "cracked"
        | "chipped"
        | "broken"
        | "worn"
        | "electrical"
        | "chemical"
        | "other"
      defect_resolution: "repaired" | "liquidated"
      defect_status:
        | "staging"
        | "in_repair"
        | "returned"
        | "liquidated"
        | "cancelled"
      exchange_status:
        | "pending"
        | "approved"
        | "issued"
        | "received"
        | "rejected"
        | "cancelled"
      fuel_calc_unit: "km" | "hours"
      fuel_movement_type:
        | "receipt_in"
        | "dispense_out"
        | "adjustment_in"
        | "adjustment_out"
        | "cancel_revert"
      liquidation_method: "sale" | "dispose"
      liquidation_status:
        | "pending"
        | "approved"
        | "completed"
        | "rejected"
        | "cancelled"
      location_type: "main" | "defect" | "repair" | "other"
      movement_type:
        | "receipt_in"
        | "requisition_out"
        | "return_in"
        | "defect_out"
        | "repair_out"
        | "repair_return_in"
        | "liquidation_out"
        | "adjustment_in"
        | "adjustment_out"
        | "transfer"
        | "issue_out"
        | "exchange_out"
        | "defect_collect_in"
        | "tool_borrow_out"
        | "tool_return_in"
      receipt_status: "draft" | "approved" | "posted" | "cancelled"
      repair_outcome: "returned_to_stock" | "liquidation"
      repair_status: "in_repair" | "returned" | "cancelled"
      requisition_status:
        | "draft"
        | "pending"
        | "approved"
        | "issued"
        | "received"
        | "rejected"
        | "cancelled"
      requisition_type: "new_supply" | "replacement"
      severity_level: "light" | "medium" | "severe"
      stocktake_status: "draft" | "posted" | "cancelled"
      tool_borrowing_status: "borrowed" | "returned" | "cancelled"
      vehicle_type:
        | "truck"
        | "excavator"
        | "generator"
        | "car"
        | "forklift"
        | "tractor"
        | "other"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      damage_type: [
        "cracked",
        "chipped",
        "broken",
        "worn",
        "electrical",
        "chemical",
        "other",
      ],
      defect_resolution: ["repaired", "liquidated"],
      defect_status: [
        "staging",
        "in_repair",
        "returned",
        "liquidated",
        "cancelled",
      ],
      exchange_status: [
        "pending",
        "approved",
        "issued",
        "received",
        "rejected",
        "cancelled",
      ],
      fuel_calc_unit: ["km", "hours"],
      fuel_movement_type: [
        "receipt_in",
        "dispense_out",
        "adjustment_in",
        "adjustment_out",
        "cancel_revert",
      ],
      liquidation_method: ["sale", "dispose"],
      liquidation_status: [
        "pending",
        "approved",
        "completed",
        "rejected",
        "cancelled",
      ],
      location_type: ["main", "defect", "repair", "other"],
      movement_type: [
        "receipt_in",
        "requisition_out",
        "return_in",
        "defect_out",
        "repair_out",
        "repair_return_in",
        "liquidation_out",
        "adjustment_in",
        "adjustment_out",
        "transfer",
        "issue_out",
        "exchange_out",
        "defect_collect_in",
        "tool_borrow_out",
        "tool_return_in",
      ],
      receipt_status: ["draft", "approved", "posted", "cancelled"],
      repair_outcome: ["returned_to_stock", "liquidation"],
      repair_status: ["in_repair", "returned", "cancelled"],
      requisition_status: [
        "draft",
        "pending",
        "approved",
        "issued",
        "received",
        "rejected",
        "cancelled",
      ],
      requisition_type: ["new_supply", "replacement"],
      severity_level: ["light", "medium", "severe"],
      stocktake_status: ["draft", "posted", "cancelled"],
      tool_borrowing_status: ["borrowed", "returned", "cancelled"],
      vehicle_type: [
        "truck",
        "excavator",
        "generator",
        "car",
        "forklift",
        "tractor",
        "other",
      ],
    },
  },
} as const

