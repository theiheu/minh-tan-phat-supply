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
          created_at: string
          damage_detail: string | null
          damage_type: Database["public"]["Enums"]["damage_type"] | null
          defect_note_id: string
          id: string
          images: string[]
          quantity: number
          resolution: Database["public"]["Enums"]["defect_resolution"] | null
          severity: Database["public"]["Enums"]["severity_level"] | null
          unit_cost: number | null
          variant_id: string
        }
        Insert: {
          created_at?: string
          damage_detail?: string | null
          damage_type?: Database["public"]["Enums"]["damage_type"] | null
          defect_note_id: string
          id?: string
          images?: string[]
          quantity?: number
          resolution?: Database["public"]["Enums"]["defect_resolution"] | null
          severity?: Database["public"]["Enums"]["severity_level"] | null
          unit_cost?: number | null
          variant_id: string
        }
        Update: {
          created_at?: string
          damage_detail?: string | null
          damage_type?: Database["public"]["Enums"]["damage_type"] | null
          defect_note_id?: string
          id?: string
          images?: string[]
          quantity?: number
          resolution?: Database["public"]["Enums"]["defect_resolution"] | null
          severity?: Database["public"]["Enums"]["severity_level"] | null
          unit_cost?: number | null
          variant_id?: string
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
            foreignKeyName: "defect_note_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "defect_note_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variant_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "defect_note_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      defect_notes: {
        Row: {
          code: string
          created_at: string
          id: string
          notes: string | null
          reported_by: string | null
          source_location_id: string | null
          status: Database["public"]["Enums"]["defect_status"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          notes?: string | null
          reported_by?: string | null
          source_location_id?: string | null
          status?: Database["public"]["Enums"]["defect_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          notes?: string | null
          reported_by?: string | null
          source_location_id?: string | null
          status?: Database["public"]["Enums"]["defect_status"]
          updated_at?: string
        }
        Relationships: [
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
      issue_items: {
        Row: {
          created_at: string
          id: string
          issue_id: string
          quantity: number
          unit_price: number | null
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          issue_id: string
          quantity: number
          unit_price?: number | null
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          issue_id?: string
          quantity?: number
          unit_price?: number | null
          variant_id?: string
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
            foreignKeyName: "issue_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "issue_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variant_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "issue_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
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
          notes: string | null
          status: string
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
          notes?: string | null
          status?: string
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
          notes?: string | null
          status?: string
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
          created_at: string
          id: string
          liquidation_note_id: string
          method: Database["public"]["Enums"]["liquidation_method"]
          notes: string | null
          proceeds: number
          quantity: number
          source_item_id: string | null
          unit_value: number | null
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          liquidation_note_id: string
          method?: Database["public"]["Enums"]["liquidation_method"]
          notes?: string | null
          proceeds?: number
          quantity?: number
          source_item_id?: string | null
          unit_value?: number | null
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          liquidation_note_id?: string
          method?: Database["public"]["Enums"]["liquidation_method"]
          notes?: string | null
          proceeds?: number
          quantity?: number
          source_item_id?: string | null
          unit_value?: number | null
          variant_id?: string
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
            foreignKeyName: "liquidation_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "liquidation_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variant_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "liquidation_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
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
      products: {
        Row: {
          category_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          images: string[]
          name: string
          options: string[]
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          images?: string[]
          name: string
          options?: string[]
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          images?: string[]
          name?: string
          options?: string[]
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
          id: string
          is_active: boolean
          is_protected: boolean
          name: string
          role: string
          updated_at: string
          username: string
          zone_id: string | null
        }
        Insert: {
          created_at?: string
          id: string
          is_active?: boolean
          is_protected?: boolean
          name: string
          role: string
          updated_at?: string
          username: string
          zone_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_protected?: boolean
          name?: string
          role?: string
          updated_at?: string
          username?: string
          zone_id?: string | null
        }
        Relationships: [
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
          created_at: string
          expiry_date: string | null
          id: string
          quantity: number
          receipt_id: string
          unit_cost: number | null
          variant_id: string
        }
        Insert: {
          batch_no?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          quantity: number
          receipt_id: string
          unit_cost?: number | null
          variant_id: string
        }
        Update: {
          batch_no?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          quantity?: number
          receipt_id?: string
          unit_cost?: number | null
          variant_id?: string
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
            foreignKeyName: "receipt_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "receipt_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variant_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "receipt_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          linked_requisition_ids: string[]
          notes: string | null
          status: Database["public"]["Enums"]["receipt_status"]
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          linked_requisition_ids?: string[]
          notes?: string | null
          status?: Database["public"]["Enums"]["receipt_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          linked_requisition_ids?: string[]
          notes?: string | null
          status?: Database["public"]["Enums"]["receipt_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
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
          cost: number | null
          created_at: string
          defect_item_id: string | null
          id: string
          outcome: Database["public"]["Enums"]["repair_outcome"] | null
          quantity: number
          repair_detail: string | null
          repair_order_id: string
          variant_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          defect_item_id?: string | null
          id?: string
          outcome?: Database["public"]["Enums"]["repair_outcome"] | null
          quantity?: number
          repair_detail?: string | null
          repair_order_id: string
          variant_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          defect_item_id?: string | null
          id?: string
          outcome?: Database["public"]["Enums"]["repair_outcome"] | null
          quantity?: number
          repair_detail?: string | null
          repair_order_id?: string
          variant_id?: string
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
            foreignKeyName: "repair_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "repair_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variant_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "repair_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
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
          created_at: string
          id: string
          quantity: number
          requisition_id: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          quantity: number
          requisition_id: string
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          quantity?: number
          requisition_id?: string
          variant_id?: string
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
            foreignKeyName: "requisition_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "requisition_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variant_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "requisition_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      requisition_return_items: {
        Row: {
          id: string
          quantity: number
          return_id: string
          variant_id: string
        }
        Insert: {
          id?: string
          quantity: number
          return_id: string
          variant_id: string
        }
        Update: {
          id?: string
          quantity?: number
          return_id?: string
          variant_id?: string
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
            foreignKeyName: "requisition_return_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "requisition_return_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variant_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "requisition_return_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
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
          rejection_reason: string | null
          requester_id: string
          requisition_type: Database["public"]["Enums"]["requisition_type"]
          status: Database["public"]["Enums"]["requisition_status"]
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
          linked_defect_id?: string | null
          purpose: string
          received_at?: string | null
          received_by?: string | null
          rejection_reason?: string | null
          requester_id: string
          requisition_type?: Database["public"]["Enums"]["requisition_type"]
          status?: Database["public"]["Enums"]["requisition_status"]
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
          linked_defect_id?: string | null
          purpose?: string
          received_at?: string | null
          received_by?: string | null
          rejection_reason?: string | null
          requester_id?: string
          requisition_type?: Database["public"]["Enums"]["requisition_type"]
          status?: Database["public"]["Enums"]["requisition_status"]
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
            foreignKeyName: "requisitions_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_balances: {
        Row: {
          id: string
          location_id: string
          quantity: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          id?: string
          location_id: string
          quantity?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          id?: string
          location_id?: string
          quantity?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_balances_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_balances_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "stock_balances_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variant_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "stock_balances_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
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
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          from_location_id: string | null
          id: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes: string | null
          quantity: number
          ref_id: string | null
          ref_type: string | null
          to_location_id: string | null
          variant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_location_id?: string | null
          id?: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          quantity: number
          ref_id?: string | null
          ref_type?: string | null
          to_location_id?: string | null
          variant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_location_id?: string | null
          id?: string
          movement_type?: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          quantity?: number
          ref_id?: string | null
          ref_type?: string | null
          to_location_id?: string | null
          variant_id?: string
        }
        Relationships: [
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
            foreignKeyName: "stock_movements_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variant_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      stocktake_items: {
        Row: {
          actual_qty: number
          created_at: string
          id: string
          session_id: string
          system_qty: number
          variant_id: string
        }
        Insert: {
          actual_qty?: number
          created_at?: string
          id?: string
          session_id: string
          system_qty?: number
          variant_id: string
        }
        Update: {
          actual_qty?: number
          created_at?: string
          id?: string
          session_id?: string
          system_qty?: number
          variant_id?: string
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
            foreignKeyName: "stocktake_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "stocktake_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variant_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "stocktake_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
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
      variant_components: {
        Row: {
          child_variant_id: string
          created_at: string
          id: string
          parent_variant_id: string
          quantity: number
        }
        Insert: {
          child_variant_id: string
          created_at?: string
          id?: string
          parent_variant_id: string
          quantity?: number
        }
        Update: {
          child_variant_id?: string
          created_at?: string
          id?: string
          parent_variant_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "variant_components_child_variant_id_fkey"
            columns: ["child_variant_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "variant_components_child_variant_id_fkey"
            columns: ["child_variant_id"]
            isOneToOne: false
            referencedRelation: "variant_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "variant_components_child_variant_id_fkey"
            columns: ["child_variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_components_parent_variant_id_fkey"
            columns: ["parent_variant_id"]
            isOneToOne: false
            referencedRelation: "location_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "variant_components_parent_variant_id_fkey"
            columns: ["parent_variant_id"]
            isOneToOne: false
            referencedRelation: "variant_stock"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "variant_components_parent_variant_id_fkey"
            columns: ["parent_variant_id"]
            isOneToOne: false
            referencedRelation: "variants"
            referencedColumns: ["id"]
          },
        ]
      }
      variants: {
        Row: {
          attributes: Json
          created_at: string
          id: string
          images: string[]
          is_default: boolean
          is_trackable_lot: boolean
          min_stock: number
          price: number | null
          product_id: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          attributes?: Json
          created_at?: string
          id?: string
          images?: string[]
          is_default?: boolean
          is_trackable_lot?: boolean
          min_stock?: number
          price?: number | null
          product_id: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          attributes?: Json
          created_at?: string
          id?: string
          images?: string[]
          is_default?: boolean
          is_trackable_lot?: boolean
          min_stock?: number
          price?: number | null
          product_id?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
          variant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_balances_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      variant_stock: {
        Row: {
          min_stock: number | null
          product_id: string | null
          quantity: number | null
          unit: string | null
          variant_id: string | null
        }
        Insert: {
          min_stock?: number | null
          product_id?: string | null
          quantity?: never
          unit?: string | null
          variant_id?: string | null
        }
        Update: {
          min_stock?: number | null
          product_id?: string | null
          quantity?: never
          unit?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _effective_demand: {
        Args: { p_requisition: string }
        Returns: {
          quantity: number
          variant_id: string
        }[]
      }
      _move_stock: {
        Args: {
          p_by: string
          p_from: string
          p_mtype: Database["public"]["Enums"]["movement_type"]
          p_notes?: string
          p_qty: number
          p_ref_id: string
          p_ref_type: string
          p_to: string
          p_variant: string
        }
        Returns: undefined
      }
      adjust_stock: {
        Args: {
          p_by: string
          p_delta: number
          p_location_id: string
          p_reason: string
          p_variant_id: string
        }
        Returns: undefined
      }
      admin_update_profile: {
        Args: {
          p_is_active: boolean
          p_name: string
          p_role: string
          p_user_id: string
          p_zone_id: string
        }
        Returns: undefined
      }
      admin_update_username: {
        Args: { p_user_id: string; p_username: string }
        Returns: undefined
      }
      approve_liquidation: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      approve_requisition: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      cancel_defect: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
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
      cancel_requisition: {
        Args: { p_by: string; p_id: string }
        Returns: undefined
      }
      complete_liquidation: {
        Args: { p_by: string; p_id: string; p_items_outcome: Json }
        Returns: undefined
      }
      complete_repair: {
        Args: { p_by: string; p_outcomes: Json; p_repair_id: string }
        Returns: undefined
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
          p_type: Database["public"]["Enums"]["requisition_type"]
          p_zone_id: string
        }
        Returns: string
      }
      create_stocktake: {
        Args: { p_by: string; p_location_id: string }
        Returns: string
      }
      fulfill_requisition: {
        Args: { p_by: string; p_id: string; p_notes: string }
        Returns: undefined
      }
      get_login_email: { Args: { p_username: string }; Returns: string }
      is_manager: { Args: never; Returns: boolean }
      is_superuser: { Args: never; Returns: boolean }
      list_requester_accounts: {
        Args: never
        Returns: {
          id: string
          name: string
          username: string
          zone_id: string
        }[]
      }
      next_code: { Args: { prefix: string; seq: unknown }; Returns: string }
      post_receipt: { Args: { p_by: string; p_id: string }; Returns: string[] }
      post_stocktake: {
        Args: { p_by: string; p_session_id: string }
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
      reject_liquidation: {
        Args: { p_by: string; p_id: string; p_reason: string }
        Returns: undefined
      }
      reject_requisition: {
        Args: { p_by: string; p_id: string; p_reason: string }
        Returns: undefined
      }
      return_requisition_items: {
        Args: { p_by: string; p_items: Json; p_requisition_id: string }
        Returns: undefined
      }
      search_catalog: {
        Args: { p_query: string }
        Returns: {
          id: string
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
      receipt_status: "draft" | "posted" | "cancelled"
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
      ],
      receipt_status: ["draft", "posted", "cancelled"],
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
    },
  },
} as const

