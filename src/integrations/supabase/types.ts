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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_insight_validation_log: {
        Row: {
          created_at: string
          evidence_values: Json
          id: string
          insight_type: string
          mismatched_numbers: Json
          narrative_numbers: Json
          organization_id: string
          project_id: string | null
          raw_content: Json | null
          snapshot_date: string
          validation_result: string
        }
        Insert: {
          created_at?: string
          evidence_values?: Json
          id?: string
          insight_type?: string
          mismatched_numbers?: Json
          narrative_numbers?: Json
          organization_id: string
          project_id?: string | null
          raw_content?: Json | null
          snapshot_date: string
          validation_result: string
        }
        Update: {
          created_at?: string
          evidence_values?: Json
          id?: string
          insight_type?: string
          mismatched_numbers?: Json
          narrative_numbers?: Json
          organization_id?: string
          project_id?: string | null
          raw_content?: Json | null
          snapshot_date?: string
          validation_result?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insight_validation_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_insight_validation_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_insight_validation_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "ai_insight_validation_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_insights: {
        Row: {
          content: Json
          created_at: string
          id: string
          input_hash: string
          insight_type: string
          organization_id: string
          project_id: string | null
          snapshot_date: string
        }
        Insert: {
          content: Json
          created_at?: string
          id?: string
          input_hash: string
          insight_type?: string
          organization_id: string
          project_id?: string | null
          snapshot_date: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          input_hash?: string
          insight_type?: string
          organization_id?: string
          project_id?: string | null
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_insights_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_insights_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "ai_insights_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_queries: {
        Row: {
          context_data: Json | null
          created_at: string
          id: string
          project_id: string | null
          query_text: string
          response_text: string | null
          user_id: string
        }
        Insert: {
          context_data?: Json | null
          created_at?: string
          id?: string
          project_id?: string | null
          query_text: string
          response_text?: string | null
          user_id: string
        }
        Update: {
          context_data?: Json | null
          created_at?: string
          id?: string
          project_id?: string | null
          query_text?: string
          response_text?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_queries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_queries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "ai_queries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_queries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_idempotency_keys: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          idempotency_key: string
          organization_id: string
          request_hash: string
          response: Json
          route: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key: string
          organization_id: string
          request_hash: string
          response: Json
          route: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          organization_id?: string
          request_hash?: string
          response?: Json
          route?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_idempotency_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string
          deficiency_id: string | null
          description: string | null
          document_type: string | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          previous_revision_id: string | null
          project_id: string
          revision_date: string | null
          revision_number: string | null
          safety_form_id: string | null
          sheet_number: string | null
          task_id: string | null
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          deficiency_id?: string | null
          description?: string | null
          document_type?: string | null
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          previous_revision_id?: string | null
          project_id: string
          revision_date?: string | null
          revision_number?: string | null
          safety_form_id?: string | null
          sheet_number?: string | null
          task_id?: string | null
          uploaded_by: string
        }
        Update: {
          created_at?: string
          deficiency_id?: string | null
          description?: string | null
          document_type?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          previous_revision_id?: string | null
          project_id?: string
          revision_date?: string | null
          revision_number?: string | null
          safety_form_id?: string | null
          sheet_number?: string | null
          task_id?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_deficiency_id_fkey"
            columns: ["deficiency_id"]
            isOneToOne: false
            referencedRelation: "deficiencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_previous_revision_id_fkey"
            columns: ["previous_revision_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_safety_form_id_fkey"
            columns: ["safety_form_id"]
            isOneToOne: false
            referencedRelation: "safety_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          project_id: string | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          project_id?: string | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          project_id?: string | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "audit_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_run_history: {
        Row: {
          created_at: string
          fail_count: number
          id: string
          json_result: Json
          manual_count: number
          organization_id: string
          p0_blockers: number
          pass_count: number
          run_id: string
        }
        Insert: {
          created_at?: string
          fail_count?: number
          id?: string
          json_result?: Json
          manual_count?: number
          organization_id: string
          p0_blockers?: number
          pass_count?: number
          run_id?: string
        }
        Update: {
          created_at?: string
          fail_count?: number
          id?: string
          json_result?: Json
          manual_count?: number
          organization_id?: string
          p0_blockers?: number
          pass_count?: number
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_run_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      blockers: {
        Row: {
          blocking_trade_id: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_resolved: boolean
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          task_id: string
          updated_at: string
        }
        Insert: {
          blocking_trade_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_resolved?: boolean
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          task_id: string
          updated_at?: string
        }
        Update: {
          blocking_trade_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_resolved?: boolean
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blockers_blocking_trade_id_fkey"
            columns: ["blocking_trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blockers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blockers_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blockers_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      change_order_line_items: {
        Row: {
          amount: number
          change_order_id: string
          created_at: string
          description: string
          id: string
          name: string
          quantity: number
          rate: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          amount?: number
          change_order_id: string
          created_at?: string
          description?: string
          id?: string
          name: string
          quantity?: number
          rate?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          change_order_id?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          quantity?: number
          rate?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_order_line_items_change_order_id_fkey"
            columns: ["change_order_id"]
            isOneToOne: false
            referencedRelation: "change_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      change_orders: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          currency: string
          estimate_id: string | null
          id: string
          organization_id: string
          project_id: string
          reason: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by: string
          currency?: string
          estimate_id?: string | null
          id?: string
          organization_id: string
          project_id: string
          reason?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          currency?: string
          estimate_id?: string | null
          id?: string
          organization_id?: string
          project_id?: string
          reason?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_orders_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "change_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          ap_contact_name: string | null
          ap_email: string | null
          ap_phone: string | null
          billing_address: string | null
          city: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          gst_number: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          organization_id: string
          parent_client_id: string | null
          phone: string | null
          pm_contact_name: string | null
          pm_email: string | null
          pm_phone: string | null
          postal_code: string | null
          province: string | null
          site_contact_email: string | null
          site_contact_name: string | null
          site_contact_phone: string | null
          updated_at: string
          zones: number
        }
        Insert: {
          ap_contact_name?: string | null
          ap_email?: string | null
          ap_phone?: string | null
          billing_address?: string | null
          city?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          organization_id: string
          parent_client_id?: string | null
          phone?: string | null
          pm_contact_name?: string | null
          pm_email?: string | null
          pm_phone?: string | null
          postal_code?: string | null
          province?: string | null
          site_contact_email?: string | null
          site_contact_name?: string | null
          site_contact_phone?: string | null
          updated_at?: string
          zones?: number
        }
        Update: {
          ap_contact_name?: string | null
          ap_email?: string | null
          ap_phone?: string | null
          billing_address?: string | null
          city?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          organization_id?: string
          parent_client_id?: string | null
          phone?: string | null
          pm_contact_name?: string | null
          pm_email?: string | null
          pm_phone?: string | null
          postal_code?: string | null
          province?: string | null
          site_contact_email?: string | null
          site_contact_name?: string | null
          site_contact_phone?: string | null
          updated_at?: string
          zones?: number
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_parent_client_id_fkey"
            columns: ["parent_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          deficiency_id: string | null
          id: string
          mentions: string[] | null
          task_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deficiency_id?: string | null
          id?: string
          mentions?: string[] | null
          task_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deficiency_id?: string | null
          id?: string
          mentions?: string[] | null
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_deficiency_id_fkey"
            columns: ["deficiency_id"]
            isOneToOne: false
            referencedRelation: "deficiencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_secrets: {
        Row: {
          created_at: string | null
          name: string
          secret: string
        }
        Insert: {
          created_at?: string | null
          name: string
          secret: string
        }
        Update: {
          created_at?: string | null
          name?: string
          secret?: string
        }
        Relationships: []
      }
      daily_logs: {
        Row: {
          created_at: string
          created_by: string
          crew_count: number | null
          id: string
          issues: string | null
          log_date: string
          next_day_plan: string | null
          project_id: string
          safety_notes: string | null
          temperature: string | null
          updated_at: string
          weather: string | null
          work_performed: string
        }
        Insert: {
          created_at?: string
          created_by: string
          crew_count?: number | null
          id?: string
          issues?: string | null
          log_date: string
          next_day_plan?: string | null
          project_id: string
          safety_notes?: string | null
          temperature?: string | null
          updated_at?: string
          weather?: string | null
          work_performed: string
        }
        Update: {
          created_at?: string
          created_by?: string
          crew_count?: number | null
          id?: string
          issues?: string | null
          log_date?: string
          next_day_plan?: string | null
          project_id?: string
          safety_notes?: string | null
          temperature?: string | null
          updated_at?: string
          weather?: string | null
          work_performed?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "daily_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_layouts: {
        Row: {
          created_at: string
          hidden_widgets: string[] | null
          id: string
          layout: Json
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hidden_widgets?: string[] | null
          id?: string
          layout?: Json
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hidden_widgets?: string[] | null
          id?: string
          layout?: Json
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deficiencies: {
        Row: {
          assigned_trade_id: string | null
          created_at: string
          created_by: string
          description: string
          due_date: string | null
          id: string
          is_deleted: boolean
          location: string | null
          priority: number
          project_id: string
          status: Database["public"]["Enums"]["deficiency_status"]
          task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_trade_id?: string | null
          created_at?: string
          created_by: string
          description: string
          due_date?: string | null
          id?: string
          is_deleted?: boolean
          location?: string | null
          priority?: number
          project_id: string
          status?: Database["public"]["Enums"]["deficiency_status"]
          task_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_trade_id?: string | null
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string | null
          id?: string
          is_deleted?: boolean
          location?: string | null
          priority?: number
          project_id?: string
          status?: Database["public"]["Enums"]["deficiency_status"]
          task_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deficiencies_assigned_trade_id_fkey"
            columns: ["assigned_trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deficiencies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deficiencies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deficiencies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "deficiencies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deficiencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      document_texts: {
        Row: {
          attachment_id: string | null
          created_at: string
          id: string
          project_id: string
          raw_text: string
          search_vector: unknown
          title: string
          updated_at: string
        }
        Insert: {
          attachment_id?: string | null
          created_at?: string
          id?: string
          project_id: string
          raw_text: string
          search_vector?: unknown
          title: string
          updated_at?: string
        }
        Update: {
          attachment_id?: string | null
          created_at?: string
          id?: string
          project_id?: string
          raw_text?: string
          search_vector?: unknown
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_texts_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_texts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_texts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "document_texts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_line_items: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          estimate_id: string
          id: string
          item_type: string
          name: string
          organization_id: string
          quantity: number
          rate: number
          sales_tax_amount: number
          sales_tax_rate: number
          scope_item_id: string | null
          sort_order: number
          task_id: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          estimate_id: string
          id?: string
          item_type?: string
          name: string
          organization_id: string
          quantity?: number
          rate?: number
          sales_tax_amount?: number
          sales_tax_rate?: number
          scope_item_id?: string | null
          sort_order?: number
          task_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          estimate_id?: string
          id?: string
          item_type?: string
          name?: string
          organization_id?: string
          quantity?: number
          rate?: number
          sales_tax_amount?: number
          sales_tax_rate?: number
          scope_item_id?: string | null
          sort_order?: number
          task_id?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_line_items_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_line_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_line_items_scope_item_id_fkey"
            columns: ["scope_item_id"]
            isOneToOne: false
            referencedRelation: "project_scope_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_line_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_task_links: {
        Row: {
          created_at: string
          estimate_line_item_id: string
          id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          estimate_line_item_id: string
          id?: string
          task_id: string
        }
        Update: {
          created_at?: string
          estimate_line_item_id?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_task_links_estimate_line_item_id_fkey"
            columns: ["estimate_line_item_id"]
            isOneToOne: false
            referencedRelation: "estimate_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_task_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          approved_at: string | null
          bill_to_address: string | null
          bill_to_ap_email: string | null
          bill_to_name: string | null
          client_id: string | null
          contract_value: number
          created_at: string
          created_by: string
          currency: string
          customer_pm_email: string | null
          customer_pm_name: string | null
          customer_pm_phone: string | null
          customer_po_number: string | null
          estimate_number: string
          gst_total: number | null
          id: string
          internal_notes: string | null
          labor_cost_rate: number | null
          memo_on_statement: string | null
          note_for_customer: string | null
          organization_id: string
          parent_client_id: string | null
          planned_labor_bill_amount: number
          planned_labor_bill_rate: number
          planned_labor_hours: number
          planned_machine_cost: number
          planned_margin_percent: number
          planned_material_cost: number
          planned_other_cost: number
          planned_profit: number
          planned_total_cost: number
          project_id: string
          pst_total: number | null
          ship_to_address: string | null
          ship_to_name: string | null
          status: string
          subtotal: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          bill_to_address?: string | null
          bill_to_ap_email?: string | null
          bill_to_name?: string | null
          client_id?: string | null
          contract_value?: number
          created_at?: string
          created_by: string
          currency?: string
          customer_pm_email?: string | null
          customer_pm_name?: string | null
          customer_pm_phone?: string | null
          customer_po_number?: string | null
          estimate_number: string
          gst_total?: number | null
          id?: string
          internal_notes?: string | null
          labor_cost_rate?: number | null
          memo_on_statement?: string | null
          note_for_customer?: string | null
          organization_id: string
          parent_client_id?: string | null
          planned_labor_bill_amount?: number
          planned_labor_bill_rate?: number
          planned_labor_hours?: number
          planned_machine_cost?: number
          planned_margin_percent?: number
          planned_material_cost?: number
          planned_other_cost?: number
          planned_profit?: number
          planned_total_cost?: number
          project_id: string
          pst_total?: number | null
          ship_to_address?: string | null
          ship_to_name?: string | null
          status?: string
          subtotal?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          bill_to_address?: string | null
          bill_to_ap_email?: string | null
          bill_to_name?: string | null
          client_id?: string | null
          contract_value?: number
          created_at?: string
          created_by?: string
          currency?: string
          customer_pm_email?: string | null
          customer_pm_name?: string | null
          customer_pm_phone?: string | null
          customer_po_number?: string | null
          estimate_number?: string
          gst_total?: number | null
          id?: string
          internal_notes?: string | null
          labor_cost_rate?: number | null
          memo_on_statement?: string | null
          note_for_customer?: string | null
          organization_id?: string
          parent_client_id?: string | null
          planned_labor_bill_amount?: number
          planned_labor_bill_rate?: number
          planned_labor_hours?: number
          planned_machine_cost?: number
          planned_margin_percent?: number
          planned_material_cost?: number
          planned_other_cost?: number
          planned_profit?: number
          planned_total_cost?: number
          project_id?: string
          pst_total?: number | null
          ship_to_address?: string | null
          ship_to_name?: string | null
          status?: string
          subtotal?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_parent_client_id_fkey"
            columns: ["parent_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "estimates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      event_dedupe: {
        Row: {
          dedupe_key: string
          event_type: string
          id: string
          last_occurred_at: string
          metadata: Json | null
        }
        Insert: {
          dedupe_key: string
          event_type: string
          id?: string
          last_occurred_at?: string
          metadata?: Json | null
        }
        Update: {
          dedupe_key?: string
          event_type?: string
          id?: string
          last_occurred_at?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      financial_integrity_overrides: {
        Row: {
          blockers: Json
          checkpoint: string
          created_at: string
          id: string
          integrity_score: number
          integrity_status: string
          organization_id: string
          override_reason: string
          project_id: string
          triggered_at: string
          triggered_by: string
        }
        Insert: {
          blockers?: Json
          checkpoint: string
          created_at?: string
          id?: string
          integrity_score: number
          integrity_status: string
          organization_id: string
          override_reason: string
          project_id: string
          triggered_at?: string
          triggered_by: string
        }
        Update: {
          blockers?: Json
          checkpoint?: string
          created_at?: string
          id?: string
          integrity_score?: number
          integrity_status?: string
          organization_id?: string
          override_reason?: string
          project_id?: string
          triggered_at?: string
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_integrity_overrides_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_integrity_overrides_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_integrity_overrides_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "financial_integrity_overrides_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      gc_column_mappings: {
        Row: {
          created_at: string
          id: string
          mapping: Json
          project_id: string
          source_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mapping: Json
          project_id: string
          source_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mapping?: Json
          project_id?: string
          source_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gc_column_mappings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gc_column_mappings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "gc_column_mappings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      gc_deficiency_imports: {
        Row: {
          created_at: string
          error_message: string | null
          file_path: string
          horizon_rows: number | null
          id: string
          imported_rows: number | null
          project_id: string
          source_name: string
          status: string
          total_rows: number | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          file_path: string
          horizon_rows?: number | null
          id?: string
          imported_rows?: number | null
          project_id: string
          source_name: string
          status?: string
          total_rows?: number | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          file_path?: string
          horizon_rows?: number | null
          id?: string
          imported_rows?: number | null
          project_id?: string
          source_name?: string
          status?: string
          total_rows?: number | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "gc_deficiency_imports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gc_deficiency_imports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "gc_deficiency_imports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gc_deficiency_imports_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gc_deficiency_items: {
        Row: {
          belongs_confidence: number | null
          belongs_to_horizon: boolean | null
          created_at: string
          error_message: string | null
          id: string
          import_id: string
          is_error: boolean | null
          mapped_deficiency_id: string | null
          parsed_description: string | null
          parsed_due_date: string | null
          parsed_gc_trade: string | null
          parsed_location: string | null
          parsed_priority: string | null
          raw_row_json: Json
          row_index: number
          suggested_internal_scope: string | null
        }
        Insert: {
          belongs_confidence?: number | null
          belongs_to_horizon?: boolean | null
          created_at?: string
          error_message?: string | null
          id?: string
          import_id: string
          is_error?: boolean | null
          mapped_deficiency_id?: string | null
          parsed_description?: string | null
          parsed_due_date?: string | null
          parsed_gc_trade?: string | null
          parsed_location?: string | null
          parsed_priority?: string | null
          raw_row_json: Json
          row_index: number
          suggested_internal_scope?: string | null
        }
        Update: {
          belongs_confidence?: number | null
          belongs_to_horizon?: boolean | null
          created_at?: string
          error_message?: string | null
          id?: string
          import_id?: string
          is_error?: boolean | null
          mapped_deficiency_id?: string | null
          parsed_description?: string | null
          parsed_due_date?: string | null
          parsed_gc_trade?: string | null
          parsed_location?: string | null
          parsed_priority?: string | null
          raw_row_json?: Json
          row_index?: number
          suggested_internal_scope?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gc_deficiency_items_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "gc_deficiency_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gc_deficiency_items_mapped_deficiency_id_fkey"
            columns: ["mapped_deficiency_id"]
            isOneToOne: false
            referencedRelation: "deficiencies"
            referencedColumns: ["id"]
          },
        ]
      }
      gc_import_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          import_id: string
          items_imported: number | null
          items_skipped: number | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          import_id: string
          items_imported?: number | null
          items_skipped?: number | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          import_id?: string
          items_imported?: number | null
          items_skipped?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gc_import_logs_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "gc_deficiency_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gc_import_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          full_name: string | null
          id: string
          invited_by: string
          organization_id: string | null
          project_id: string | null
          role: string | null
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by: string
          organization_id?: string | null
          project_id?: string | null
          role?: string | null
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by?: string
          organization_id?: string | null
          project_id?: string | null
          role?: string | null
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_activity_log: {
        Row: {
          action: string
          created_at: string
          details: string | null
          id: string
          invoice_id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          id?: string
          invoice_id: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          id?: string
          invoice_id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_activity_log_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          amount: number
          category: string | null
          description: string
          id: string
          invoice_id: string
          quantity: number
          sort_order: number
          unit_price: number
        }
        Insert: {
          amount?: number
          category?: string | null
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          sort_order?: number
          unit_price?: number
        }
        Update: {
          amount?: number
          category?: string | null
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          sort_order?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string
          payment_method: string | null
          reference_number: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          reference_number?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_receipt_links: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invoice_id: string
          receipt_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          invoice_id: string
          receipt_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invoice_id?: string
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_receipt_links_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_settings: {
        Row: {
          company_address: string | null
          company_name: string | null
          created_at: string
          currency: string | null
          default_payment_terms: string | null
          default_retainage_percent: number | null
          from_email: string | null
          invoice_prefix: string | null
          logo_url: string | null
          next_invoice_number: number
          notes_template: string | null
          organization_id: string
          payment_instructions: string | null
          reminder_days: number[] | null
          reminder_enabled: boolean | null
          require_approval: boolean | null
          tax_label: string | null
          tax_rate: number | null
          tax2_label: string | null
          tax2_rate: number | null
          updated_at: string
        }
        Insert: {
          company_address?: string | null
          company_name?: string | null
          created_at?: string
          currency?: string | null
          default_payment_terms?: string | null
          default_retainage_percent?: number | null
          from_email?: string | null
          invoice_prefix?: string | null
          logo_url?: string | null
          next_invoice_number?: number
          notes_template?: string | null
          organization_id: string
          payment_instructions?: string | null
          reminder_days?: number[] | null
          reminder_enabled?: boolean | null
          require_approval?: boolean | null
          tax_label?: string | null
          tax_rate?: number | null
          tax2_label?: string | null
          tax2_rate?: number | null
          updated_at?: string
        }
        Update: {
          company_address?: string | null
          company_name?: string | null
          created_at?: string
          currency?: string | null
          default_payment_terms?: string | null
          default_retainage_percent?: number | null
          from_email?: string | null
          invoice_prefix?: string | null
          logo_url?: string | null
          next_invoice_number?: number
          notes_template?: string | null
          organization_id?: string
          payment_instructions?: string | null
          reminder_days?: number[] | null
          reminder_enabled?: boolean | null
          require_approval?: boolean | null
          tax_label?: string | null
          tax_rate?: number | null
          tax2_label?: string | null
          tax2_rate?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_tax_lines: {
        Row: {
          id: string
          invoice_id: string
          sort_order: number
          tax_amount: number
          tax_name: string
          tax_rate: number
        }
        Insert: {
          id?: string
          invoice_id: string
          sort_order?: number
          tax_amount?: number
          tax_name?: string
          tax_rate?: number
        }
        Update: {
          id?: string
          invoice_id?: string
          sort_order?: number
          tax_amount?: number
          tax_name?: string
          tax_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_tax_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          bill_to_address: string | null
          bill_to_client_id: string | null
          bill_to_name: string | null
          client_id: string | null
          contract_total: number | null
          created_at: string
          created_by: string
          credit_note_for: string | null
          currency: string
          deposit_applied_to: string | null
          due_date: string | null
          id: string
          invoice_number: string
          invoice_type: string
          issue_date: string
          last_reminder_sent_at: string | null
          notes: string | null
          organization_id: string
          paid_at: string | null
          po_number: string | null
          progress_percent: number | null
          project_id: string | null
          rejection_reason: string | null
          reminder_count: number | null
          retainage_amount: number | null
          retainage_percent: number | null
          retainage_released: boolean | null
          retainage_released_at: string | null
          send_to_emails: string | null
          sent_at: string | null
          ship_to_address: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bill_to_address?: string | null
          bill_to_client_id?: string | null
          bill_to_name?: string | null
          client_id?: string | null
          contract_total?: number | null
          created_at?: string
          created_by: string
          credit_note_for?: string | null
          currency?: string
          deposit_applied_to?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          invoice_type?: string
          issue_date?: string
          last_reminder_sent_at?: string | null
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          po_number?: string | null
          progress_percent?: number | null
          project_id?: string | null
          rejection_reason?: string | null
          reminder_count?: number | null
          retainage_amount?: number | null
          retainage_percent?: number | null
          retainage_released?: boolean | null
          retainage_released_at?: string | null
          send_to_emails?: string | null
          sent_at?: string | null
          ship_to_address?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bill_to_address?: string | null
          bill_to_client_id?: string | null
          bill_to_name?: string | null
          client_id?: string | null
          contract_total?: number | null
          created_at?: string
          created_by?: string
          credit_note_for?: string | null
          currency?: string
          deposit_applied_to?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          invoice_type?: string
          issue_date?: string
          last_reminder_sent_at?: string | null
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          po_number?: string | null
          progress_percent?: number | null
          project_id?: string | null
          rejection_reason?: string | null
          reminder_count?: number | null
          retainage_amount?: number | null
          retainage_percent?: number | null
          retainage_released?: boolean | null
          retainage_released_at?: string | null
          send_to_emails?: string | null
          sent_at?: string | null
          ship_to_address?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_bill_to_client_id_fkey"
            columns: ["bill_to_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_credit_note_for_fkey"
            columns: ["credit_note_for"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_deposit_applied_to_fkey"
            columns: ["deposit_applied_to"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      job_sites: {
        Row: {
          address: string | null
          created_at: string
          geofence_radius_meters: number
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          normalized_address: string | null
          organization_id: string
          project_id: string
          timezone_override: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          geofence_radius_meters?: number
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          normalized_address?: string | null
          organization_id: string
          project_id: string
          timezone_override?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          geofence_radius_meters?: number
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          normalized_address?: string | null
          organization_id?: string
          project_id?: string
          timezone_override?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_sites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "job_sites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      manpower_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          duration_days: number | null
          id: string
          is_deleted: boolean
          project_id: string
          reason: string
          requested_count: number
          required_date: string
          status: string
          task_id: string | null
          trade_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by: string
          duration_days?: number | null
          id?: string
          is_deleted?: boolean
          project_id: string
          reason: string
          requested_count: number
          required_date: string
          status?: string
          task_id?: string | null
          trade_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          duration_days?: number | null
          id?: string
          is_deleted?: boolean
          project_id?: string
          reason?: string
          requested_count?: number
          required_date?: string
          status?: string
          task_id?: string | null
          trade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manpower_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manpower_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manpower_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manpower_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "manpower_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manpower_requests_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manpower_requests_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_dedupe: {
        Row: {
          id: string
          last_sent_at: string
          metadata: Json | null
          notification_type: string
          organization_id: string
          user_id: string
        }
        Insert: {
          id?: string
          last_sent_at?: string
          metadata?: Json | null
          notification_type: string
          organization_id: string
          user_id: string
        }
        Update: {
          id?: string
          last_sent_at?: string
          metadata?: Json | null
          notification_type?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_dedupe_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          blocker_added: boolean
          blocker_cleared: boolean
          created_at: string
          deficiency_created: boolean
          document_uploaded: boolean
          general: boolean
          id: string
          incident_report: boolean
          manpower_approved: boolean
          manpower_denied: boolean
          manpower_request: boolean
          safety_alert: boolean
          task_assigned: boolean
          updated_at: string
          user_id: string
          weekly_digest: boolean
        }
        Insert: {
          blocker_added?: boolean
          blocker_cleared?: boolean
          created_at?: string
          deficiency_created?: boolean
          document_uploaded?: boolean
          general?: boolean
          id?: string
          incident_report?: boolean
          manpower_approved?: boolean
          manpower_denied?: boolean
          manpower_request?: boolean
          safety_alert?: boolean
          task_assigned?: boolean
          updated_at?: string
          user_id: string
          weekly_digest?: boolean
        }
        Update: {
          blocker_added?: boolean
          blocker_cleared?: boolean
          created_at?: string
          deficiency_created?: boolean
          document_uploaded?: boolean
          general?: boolean
          id?: string
          incident_report?: boolean
          manpower_approved?: boolean
          manpower_denied?: boolean
          manpower_request?: boolean
          safety_alert?: boolean
          task_assigned?: boolean
          updated_at?: string
          user_id?: string
          weekly_digest?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link_url: string | null
          message: string
          project_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link_url?: string | null
          message: string
          project_id?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link_url?: string | null
          message?: string
          project_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_financial_snapshots: {
        Row: {
          captured_at: string | null
          created_at: string
          id: string
          organization_id: string
          projects_count: number
          projects_missing_budget_count: number
          projects_over_budget_count: number
          projects_with_budget_count: number
          snapshot_date: string
          snapshot_period: string
          total_actual_cost: number
          total_contract_value: number
          total_invoiced_strict: number
          total_planned_cost: number
          total_profit_actual: number
          weighted_margin_pct_actual: number
        }
        Insert: {
          captured_at?: string | null
          created_at?: string
          id?: string
          organization_id: string
          projects_count?: number
          projects_missing_budget_count?: number
          projects_over_budget_count?: number
          projects_with_budget_count?: number
          snapshot_date: string
          snapshot_period?: string
          total_actual_cost?: number
          total_contract_value?: number
          total_invoiced_strict?: number
          total_planned_cost?: number
          total_profit_actual?: number
          weighted_margin_pct_actual?: number
        }
        Update: {
          captured_at?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          projects_count?: number
          projects_missing_budget_count?: number
          projects_over_budget_count?: number
          projects_with_budget_count?: number
          snapshot_date?: string
          snapshot_period?: string
          total_actual_cost?: number
          total_contract_value?: number
          total_invoiced_strict?: number
          total_planned_cost?: number
          total_profit_actual?: number
          weighted_margin_pct_actual?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_financial_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_guardrails: {
        Row: {
          created_at: string
          id: string
          key: string
          mode: string
          organization_id: string
          threshold_numeric: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          mode?: string
          organization_id: string
          threshold_numeric?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          mode?: string
          organization_id?: string
          threshold_numeric?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_guardrails_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_intelligence_profile: {
        Row: {
          ai_style: string
          allow_currency_mismatch: boolean
          base_currency: string
          created_at: string
          invoice_permission_model: string
          labor_cost_model: string
          labor_rate_source: string
          organization_id: string
          profile: Json
          quote_required_before_tasks: boolean
          region: string | null
          require_quote_approved: boolean
          tax_model: string
          updated_at: string
          workflow_mode_default: string
        }
        Insert: {
          ai_style?: string
          allow_currency_mismatch?: boolean
          base_currency?: string
          created_at?: string
          invoice_permission_model?: string
          labor_cost_model?: string
          labor_rate_source?: string
          organization_id: string
          profile?: Json
          quote_required_before_tasks?: boolean
          region?: string | null
          require_quote_approved?: boolean
          tax_model?: string
          updated_at?: string
          workflow_mode_default?: string
        }
        Update: {
          ai_style?: string
          allow_currency_mismatch?: boolean
          base_currency?: string
          created_at?: string
          invoice_permission_model?: string
          labor_cost_model?: string
          labor_rate_source?: string
          organization_id?: string
          profile?: Json
          quote_required_before_tasks?: boolean
          region?: string | null
          require_quote_approved?: boolean
          tax_model?: string
          updated_at?: string
          workflow_mode_default?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_intelligence_profile_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          hourly_bill_rate: number | null
          hourly_cost_rate: number | null
          id: string
          is_active: boolean
          organization_id: string
          rates_currency: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hourly_bill_rate?: number | null
          hourly_cost_rate?: number | null
          id?: string
          is_active?: boolean
          organization_id: string
          rates_currency?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hourly_bill_rate?: number | null
          hourly_cost_rate?: number | null
          id?: string
          is_active?: boolean
          organization_id?: string
          rates_currency?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_operational_profile: {
        Row: {
          ai_auto_change_orders: boolean | null
          ai_flag_profit_risk: boolean | null
          ai_recommend_pricing: boolean | null
          ai_risk_mode: string | null
          base_currency: string
          certification_tier: string
          certification_updated_at: string | null
          created_at: string
          id: string
          invoice_approver: string | null
          invoice_permission_model: string
          labor_cost_model: string
          organization_id: string
          over_estimate_action: string | null
          profit_leakage_source: string | null
          quote_standardization: string | null
          rate_source: string
          require_safety_before_work: boolean | null
          score_snapshot: Json | null
          tasks_before_quote: boolean | null
          tax_model: string
          time_audit_frequency: string | null
          track_variance_per_trade: boolean | null
          updated_at: string
          wizard_completed_at: string | null
          wizard_phase_completed: number
          workflow_mode_default: string
        }
        Insert: {
          ai_auto_change_orders?: boolean | null
          ai_flag_profit_risk?: boolean | null
          ai_recommend_pricing?: boolean | null
          ai_risk_mode?: string | null
          base_currency?: string
          certification_tier?: string
          certification_updated_at?: string | null
          created_at?: string
          id?: string
          invoice_approver?: string | null
          invoice_permission_model?: string
          labor_cost_model?: string
          organization_id: string
          over_estimate_action?: string | null
          profit_leakage_source?: string | null
          quote_standardization?: string | null
          rate_source?: string
          require_safety_before_work?: boolean | null
          score_snapshot?: Json | null
          tasks_before_quote?: boolean | null
          tax_model?: string
          time_audit_frequency?: string | null
          track_variance_per_trade?: boolean | null
          updated_at?: string
          wizard_completed_at?: string | null
          wizard_phase_completed?: number
          workflow_mode_default?: string
        }
        Update: {
          ai_auto_change_orders?: boolean | null
          ai_flag_profit_risk?: boolean | null
          ai_recommend_pricing?: boolean | null
          ai_risk_mode?: string | null
          base_currency?: string
          certification_tier?: string
          certification_updated_at?: string | null
          created_at?: string
          id?: string
          invoice_approver?: string | null
          invoice_permission_model?: string
          labor_cost_model?: string
          organization_id?: string
          over_estimate_action?: string | null
          profit_leakage_source?: string | null
          quote_standardization?: string | null
          rate_source?: string
          require_safety_before_work?: boolean | null
          score_snapshot?: Json | null
          tasks_before_quote?: boolean | null
          tax_model?: string
          time_audit_frequency?: string | null
          track_variance_per_trade?: boolean | null
          updated_at?: string
          wizard_completed_at?: string | null
          wizard_phase_completed?: number
          workflow_mode_default?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_operational_profile_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          created_at: string
          default_timezone: string
          invoice_send_approver_roles: string[]
          invoice_send_blocked_message: string
          invoice_send_requires_approval: boolean
          invoice_send_roles: string[]
          jurisdiction_code: string | null
          organization_id: string
          time_auto_close_enabled: boolean | null
          time_auto_close_hours: number | null
          time_end_of_day_reminder_enabled: boolean | null
          time_end_of_day_reminder_time_local: string | null
          time_gps_accuracy_warn_meters: number | null
          time_reminder_after_minutes: number | null
          time_reminders_enabled: boolean | null
          time_tracking_enabled: boolean
          timesheet_escalation_after_hours: number | null
          timesheet_escalation_enabled: boolean | null
          timesheet_submission_day: number | null
          timesheet_submission_time_local: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_timezone?: string
          invoice_send_approver_roles?: string[]
          invoice_send_blocked_message?: string
          invoice_send_requires_approval?: boolean
          invoice_send_roles?: string[]
          jurisdiction_code?: string | null
          organization_id: string
          time_auto_close_enabled?: boolean | null
          time_auto_close_hours?: number | null
          time_end_of_day_reminder_enabled?: boolean | null
          time_end_of_day_reminder_time_local?: string | null
          time_gps_accuracy_warn_meters?: number | null
          time_reminder_after_minutes?: number | null
          time_reminders_enabled?: boolean | null
          time_tracking_enabled?: boolean
          timesheet_escalation_after_hours?: number | null
          timesheet_escalation_enabled?: boolean | null
          timesheet_submission_day?: number | null
          timesheet_submission_time_local?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_timezone?: string
          invoice_send_approver_roles?: string[]
          invoice_send_blocked_message?: string
          invoice_send_requires_approval?: boolean
          invoice_send_roles?: string[]
          jurisdiction_code?: string | null
          organization_id?: string
          time_auto_close_enabled?: boolean | null
          time_auto_close_hours?: number | null
          time_end_of_day_reminder_enabled?: boolean | null
          time_end_of_day_reminder_time_local?: string | null
          time_gps_accuracy_warn_meters?: number | null
          time_reminder_after_minutes?: number | null
          time_reminders_enabled?: boolean | null
          time_tracking_enabled?: boolean
          timesheet_escalation_after_hours?: number | null
          timesheet_escalation_enabled?: boolean | null
          timesheet_submission_day?: number | null
          timesheet_submission_time_local?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          base_currency: string
          created_at: string
          financial_enforcement_level: string
          id: string
          is_sandbox: boolean
          name: string
          sandbox_label: string | null
          slug: string | null
        }
        Insert: {
          base_currency?: string
          created_at?: string
          financial_enforcement_level?: string
          id?: string
          is_sandbox?: boolean
          name: string
          sandbox_label?: string | null
          slug?: string | null
        }
        Update: {
          base_currency?: string
          created_at?: string
          financial_enforcement_level?: string
          id?: string
          is_sandbox?: boolean
          name?: string
          sandbox_label?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      payroll_exports: {
        Row: {
          created_at: string
          date_from: string
          date_to: string
          entry_count: number
          export_type: string
          file_path: string | null
          file_url: string | null
          flagged_count: number
          generated_by: string
          id: string
          organization_id: string
          storage_bucket: string
        }
        Insert: {
          created_at?: string
          date_from: string
          date_to: string
          entry_count?: number
          export_type: string
          file_path?: string | null
          file_url?: string | null
          flagged_count?: number
          generated_by: string
          id?: string
          organization_id: string
          storage_bucket?: string
        }
        Update: {
          created_at?: string
          date_from?: string
          date_to?: string
          entry_count?: number
          export_type?: string
          file_path?: string | null
          file_url?: string | null
          flagged_count?: number
          generated_by?: string
          id?: string
          organization_id?: string
          storage_bucket?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_exports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_phases: {
        Row: {
          description: string
          id: string
          name: string
          playbook_id: string
          sequence_order: number
        }
        Insert: {
          description?: string
          id?: string
          name: string
          playbook_id: string
          sequence_order?: number
        }
        Update: {
          description?: string
          id?: string
          name?: string
          playbook_id?: string
          sequence_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "playbook_phases_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_tasks: {
        Row: {
          allow_skip: boolean
          density_weight: number
          description: string
          expected_hours_high: number
          expected_hours_low: number
          id: string
          playbook_phase_id: string
          required_flag: boolean
          role_type: string
          sequence_order: number
          title: string
        }
        Insert: {
          allow_skip?: boolean
          density_weight?: number
          description?: string
          expected_hours_high?: number
          expected_hours_low?: number
          id?: string
          playbook_phase_id: string
          required_flag?: boolean
          role_type?: string
          sequence_order?: number
          title: string
        }
        Update: {
          allow_skip?: boolean
          density_weight?: number
          description?: string
          expected_hours_high?: number
          expected_hours_low?: number
          id?: string
          playbook_phase_id?: string
          required_flag?: boolean
          role_type?: string
          sequence_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "playbook_tasks_playbook_phase_id_fkey"
            columns: ["playbook_phase_id"]
            isOneToOne: false
            referencedRelation: "playbook_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_versions: {
        Row: {
          created_at: string
          created_by: string
          id: string
          playbook_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          playbook_id: string
          snapshot: Json
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          playbook_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "playbook_versions_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      playbooks: {
        Row: {
          created_at: string
          created_by: string
          description: string
          id: string
          is_archived: boolean
          is_default: boolean
          job_type: string
          name: string
          organization_id: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string
          id?: string
          is_archived?: boolean
          is_default?: boolean
          job_type?: string
          name: string
          organization_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          is_archived?: boolean
          is_default?: boolean
          job_type?: string
          name?: string
          organization_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "playbooks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          has_onboarded: boolean
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          has_onboarded?: boolean
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          has_onboarded?: boolean
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_archetypes: {
        Row: {
          created_at: string
          id: string
          key: string
          label: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          label: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          label?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_archetypes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_budgets: {
        Row: {
          client_id: string | null
          contract_value: number
          created_at: string
          currency: string
          id: string
          organization_id: string
          planned_billable_amount: number
          planned_labor_cost: number
          planned_labor_hours: number
          planned_machine_cost: number
          planned_material_cost: number
          planned_other_cost: number
          project_id: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          contract_value?: number
          created_at?: string
          currency?: string
          id?: string
          organization_id: string
          planned_billable_amount?: number
          planned_labor_cost?: number
          planned_labor_hours?: number
          planned_machine_cost?: number
          planned_material_cost?: number
          planned_other_cost?: number
          project_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          contract_value?: number
          created_at?: string
          currency?: string
          id?: string
          organization_id?: string
          planned_billable_amount?: number
          planned_labor_cost?: number
          planned_labor_hours?: number
          planned_machine_cost?: number
          planned_material_cost?: number
          planned_other_cost?: number
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_budgets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_budgets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      project_financial_snapshots: {
        Row: {
          actual_labor_cost: number
          actual_labor_hours: number
          actual_machine_cost: number
          actual_margin_pct: number
          actual_material_cost: number
          actual_other_cost: number
          actual_profit: number
          actual_total_cost: number
          actual_unclassified_cost: number
          billed_percentage_relaxed: number
          billed_percentage_strict: number
          captured_at: string | null
          contract_value: number
          created_at: string
          created_by: string | null
          has_budget: boolean
          id: string
          invoiced_amount_relaxed: number
          invoiced_amount_strict: number
          labor_entry_count_missing_cost_rate: number
          labor_entry_count_missing_membership: number
          labor_hours_missing_cost_rate: number
          labor_hours_missing_membership: number
          organization_id: string
          planned_labor_cost: number
          planned_labor_hours: number
          planned_machine_cost: number
          planned_margin_pct: number
          planned_material_cost: number
          planned_other_cost: number
          planned_profit: number
          planned_total_cost: number
          project_id: string
          remainder_to_invoice_relaxed: number
          remainder_to_invoice_strict: number
          snapshot_date: string
          snapshot_period: string
          status: string | null
          unclassified_receipt_count: number
        }
        Insert: {
          actual_labor_cost?: number
          actual_labor_hours?: number
          actual_machine_cost?: number
          actual_margin_pct?: number
          actual_material_cost?: number
          actual_other_cost?: number
          actual_profit?: number
          actual_total_cost?: number
          actual_unclassified_cost?: number
          billed_percentage_relaxed?: number
          billed_percentage_strict?: number
          captured_at?: string | null
          contract_value?: number
          created_at?: string
          created_by?: string | null
          has_budget?: boolean
          id?: string
          invoiced_amount_relaxed?: number
          invoiced_amount_strict?: number
          labor_entry_count_missing_cost_rate?: number
          labor_entry_count_missing_membership?: number
          labor_hours_missing_cost_rate?: number
          labor_hours_missing_membership?: number
          organization_id: string
          planned_labor_cost?: number
          planned_labor_hours?: number
          planned_machine_cost?: number
          planned_margin_pct?: number
          planned_material_cost?: number
          planned_other_cost?: number
          planned_profit?: number
          planned_total_cost?: number
          project_id: string
          remainder_to_invoice_relaxed?: number
          remainder_to_invoice_strict?: number
          snapshot_date: string
          snapshot_period?: string
          status?: string | null
          unclassified_receipt_count?: number
        }
        Update: {
          actual_labor_cost?: number
          actual_labor_hours?: number
          actual_machine_cost?: number
          actual_margin_pct?: number
          actual_material_cost?: number
          actual_other_cost?: number
          actual_profit?: number
          actual_total_cost?: number
          actual_unclassified_cost?: number
          billed_percentage_relaxed?: number
          billed_percentage_strict?: number
          captured_at?: string | null
          contract_value?: number
          created_at?: string
          created_by?: string | null
          has_budget?: boolean
          id?: string
          invoiced_amount_relaxed?: number
          invoiced_amount_strict?: number
          labor_entry_count_missing_cost_rate?: number
          labor_entry_count_missing_membership?: number
          labor_hours_missing_cost_rate?: number
          labor_hours_missing_membership?: number
          organization_id?: string
          planned_labor_cost?: number
          planned_labor_hours?: number
          planned_machine_cost?: number
          planned_margin_pct?: number
          planned_material_cost?: number
          planned_other_cost?: number
          planned_profit?: number
          planned_total_cost?: number
          project_id?: string
          remainder_to_invoice_relaxed?: number
          remainder_to_invoice_strict?: number
          snapshot_date?: string
          snapshot_period?: string
          status?: string | null
          unclassified_receipt_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_financial_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_financial_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_financial_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_financial_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      project_invoice_permissions: {
        Row: {
          created_at: string
          granted_by: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_invoice_permissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_invoice_permissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_invoice_permissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          bill_rate: number | null
          cost_rate: number
          created_at: string
          id: string
          project_id: string
          role: Database["public"]["Enums"]["app_role"]
          trade_id: string | null
          user_id: string
        }
        Insert: {
          bill_rate?: number | null
          cost_rate?: number
          created_at?: string
          id?: string
          project_id: string
          role: Database["public"]["Enums"]["app_role"]
          trade_id?: string | null
          user_id: string
        }
        Update: {
          bill_rate?: number | null
          cost_rate?: number
          created_at?: string
          id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          trade_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_scope_items: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          estimate_line_item_id: string | null
          id: string
          is_archived: boolean
          item_type: string
          name: string
          organization_id: string
          planned_cost_rate: number
          planned_hours: number
          planned_machine_cost: number
          planned_material_cost: number
          planned_total: number
          planned_unit_rate: number
          project_id: string
          quantity: number
          sort_order: number
          source_id: string | null
          source_type: string
          tax1_rate: number
          tax2_rate: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          estimate_line_item_id?: string | null
          id?: string
          is_archived?: boolean
          item_type?: string
          name: string
          organization_id: string
          planned_cost_rate?: number
          planned_hours?: number
          planned_machine_cost?: number
          planned_material_cost?: number
          planned_total?: number
          planned_unit_rate?: number
          project_id: string
          quantity?: number
          sort_order?: number
          source_id?: string | null
          source_type?: string
          tax1_rate?: number
          tax2_rate?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          estimate_line_item_id?: string | null
          id?: string
          is_archived?: boolean
          item_type?: string
          name?: string
          organization_id?: string
          planned_cost_rate?: number
          planned_hours?: number
          planned_machine_cost?: number
          planned_material_cost?: number
          planned_total?: number
          planned_unit_rate?: number
          project_id?: string
          quantity?: number
          sort_order?: number
          source_id?: string | null
          source_type?: string
          tax1_rate?: number
          tax2_rate?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_scope_items_estimate_line_item_id_fkey"
            columns: ["estimate_line_item_id"]
            isOneToOne: false
            referencedRelation: "estimate_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_scope_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_scope_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_scope_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_scope_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      project_workflow_steps: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          phase_key: string
          project_id: string
          requested_at: string | null
          requested_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          phase_key: string
          project_id: string
          requested_at?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          phase_key?: string
          project_id?: string
          requested_at?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_workflow_steps_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_workflow_steps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_workflow_steps_phase_key_fkey"
            columns: ["phase_key"]
            isOneToOne: false
            referencedRelation: "workflow_phases"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "project_workflow_steps_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_workflow_steps_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_workflow_steps_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_workflow_steps_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_workflows: {
        Row: {
          created_at: string
          current_phase: string
          flow_mode: string
          id: string
          organization_id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_phase?: string
          flow_mode?: string
          id?: string
          organization_id: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_phase?: string
          flow_mode?: string
          id?: string
          organization_id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_workflows_current_phase_fkey"
            columns: ["current_phase"]
            isOneToOne: false
            referencedRelation: "workflow_phases"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "project_workflows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_workflows_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_workflows_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_workflows_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          applied_playbook_id: string | null
          applied_playbook_version: number | null
          archetype_id: string | null
          billing_address: string | null
          client_id: string | null
          created_at: string
          created_by: string
          currency: string
          description: string | null
          end_date: string | null
          id: string
          is_deleted: boolean
          job_number: string | null
          job_type: string | null
          location: string
          name: string
          organization_id: string
          playbook_applied_at: string | null
          playbook_applied_by: string | null
          pm_contact_name: string | null
          pm_email: string | null
          pm_phone: string | null
          start_date: string | null
          status: string
          total_expected_hours_high: number | null
          total_expected_hours_low: number | null
          updated_at: string
        }
        Insert: {
          applied_playbook_id?: string | null
          applied_playbook_version?: number | null
          archetype_id?: string | null
          billing_address?: string | null
          client_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_deleted?: boolean
          job_number?: string | null
          job_type?: string | null
          location: string
          name: string
          organization_id: string
          playbook_applied_at?: string | null
          playbook_applied_by?: string | null
          pm_contact_name?: string | null
          pm_email?: string | null
          pm_phone?: string | null
          start_date?: string | null
          status?: string
          total_expected_hours_high?: number | null
          total_expected_hours_low?: number | null
          updated_at?: string
        }
        Update: {
          applied_playbook_id?: string | null
          applied_playbook_version?: number | null
          archetype_id?: string | null
          billing_address?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_deleted?: boolean
          job_number?: string | null
          job_type?: string | null
          location?: string
          name?: string
          organization_id?: string
          playbook_applied_at?: string | null
          playbook_applied_by?: string | null
          pm_contact_name?: string | null
          pm_email?: string | null
          pm_phone?: string | null
          start_date?: string | null
          status?: string
          total_expected_hours_high?: number | null
          total_expected_hours_low?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_applied_playbook_id_fkey"
            columns: ["applied_playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_archetype_id_fkey"
            columns: ["archetype_id"]
            isOneToOne: false
            referencedRelation: "project_archetypes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_events: {
        Row: {
          actor_user_id: string
          created_at: string
          event_type: string
          id: string
          message: string | null
          proposal_id: string
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          event_type: string
          id?: string
          message?: string | null
          proposal_id: string
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          event_type?: string
          id?: string
          message?: string | null
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_sections: {
        Row: {
          content: string
          id: string
          proposal_id: string
          section_type: string
          sort_order: number
        }
        Insert: {
          content?: string
          id?: string
          proposal_id: string
          section_type?: string
          sort_order?: number
        }
        Update: {
          content?: string
          id?: string
          proposal_id?: string
          section_type?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_sections_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assumptions: string
          created_at: string
          created_by: string
          customer_po_or_contract_number: string | null
          estimate_id: string | null
          exclusions: string
          id: string
          organization_id: string
          project_id: string
          rejected_reason: string | null
          status: Database["public"]["Enums"]["proposal_status"]
          submitted_at: string | null
          summary: string
          timeline_text: string
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assumptions?: string
          created_at?: string
          created_by: string
          customer_po_or_contract_number?: string | null
          estimate_id?: string | null
          exclusions?: string
          id?: string
          organization_id: string
          project_id: string
          rejected_reason?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          submitted_at?: string | null
          summary?: string
          timeline_text?: string
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assumptions?: string
          created_at?: string
          created_by?: string
          customer_po_or_contract_number?: string | null
          estimate_id?: string | null
          exclusions?: string
          id?: string
          organization_id?: string
          project_id?: string
          rejected_reason?: string | null
          status?: Database["public"]["Enums"]["proposal_status"]
          submitted_at?: string | null
          summary?: string
          timeline_text?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_conversions: {
        Row: {
          converted_at: string
          converted_by: string
          id: string
          invoice_id: string
          organization_id: string
          quote_id: string
        }
        Insert: {
          converted_at?: string
          converted_by: string
          id?: string
          invoice_id: string
          organization_id: string
          quote_id: string
        }
        Update: {
          converted_at?: string
          converted_by?: string
          id?: string
          invoice_id?: string
          organization_id?: string
          quote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_conversions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_conversions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_conversions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_events: {
        Row: {
          actor_user_id: string
          created_at: string
          event_type: string
          id: string
          message: string | null
          metadata: Json | null
          organization_id: string | null
          quote_id: string
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          event_type: string
          id?: string
          message?: string | null
          metadata?: Json | null
          organization_id?: string | null
          quote_id: string
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          event_type?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          organization_id?: string | null
          quote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_events_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_line_items: {
        Row: {
          amount: number
          description: string | null
          id: string
          organization_id: string
          product_or_service: string
          quantity: number
          quote_id: string
          rate: number
          sales_tax_amount: number
          sales_tax_rate: number
          sort_order: number
        }
        Insert: {
          amount?: number
          description?: string | null
          id?: string
          organization_id: string
          product_or_service: string
          quantity?: number
          quote_id: string
          rate?: number
          sales_tax_amount?: number
          sales_tax_rate?: number
          sort_order?: number
        }
        Update: {
          amount?: number
          description?: string | null
          id?: string
          organization_id?: string
          product_or_service?: string
          quantity?: number
          quote_id?: string
          rate?: number
          sales_tax_amount?: number
          sales_tax_rate?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_line_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          approved_at: string | null
          bill_to_address: string | null
          bill_to_ap_email: string | null
          bill_to_name: string | null
          client_id: string | null
          converted_invoice_id: string | null
          converted_proposal_id: string | null
          created_at: string
          created_by: string
          currency: string
          customer_pm_email: string | null
          customer_pm_name: string | null
          customer_pm_phone: string | null
          customer_po_number: string | null
          gst: number
          id: string
          internal_notes: string | null
          memo_on_statement: string | null
          note_for_customer: string | null
          organization_id: string
          parent_client_id: string | null
          project_id: string | null
          pst: number
          quote_number: string
          ship_to_address: string | null
          ship_to_name: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          bill_to_address?: string | null
          bill_to_ap_email?: string | null
          bill_to_name?: string | null
          client_id?: string | null
          converted_invoice_id?: string | null
          converted_proposal_id?: string | null
          created_at?: string
          created_by: string
          currency?: string
          customer_pm_email?: string | null
          customer_pm_name?: string | null
          customer_pm_phone?: string | null
          customer_po_number?: string | null
          gst?: number
          id?: string
          internal_notes?: string | null
          memo_on_statement?: string | null
          note_for_customer?: string | null
          organization_id: string
          parent_client_id?: string | null
          project_id?: string | null
          pst?: number
          quote_number: string
          ship_to_address?: string | null
          ship_to_name?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          bill_to_address?: string | null
          bill_to_ap_email?: string | null
          bill_to_name?: string | null
          client_id?: string | null
          converted_invoice_id?: string | null
          converted_proposal_id?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          customer_pm_email?: string | null
          customer_pm_name?: string | null
          customer_pm_phone?: string | null
          customer_po_number?: string | null
          gst?: number
          id?: string
          internal_notes?: string | null
          memo_on_statement?: string | null
          note_for_customer?: string | null
          organization_id?: string
          parent_client_id?: string | null
          project_id?: string | null
          pst?: number
          quote_number?: string
          ship_to_address?: string | null
          ship_to_name?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
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
            foreignKeyName: "quotes_converted_invoice_id_fkey"
            columns: ["converted_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_converted_proposal_id_fkey"
            columns: ["converted_proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_parent_client_id_fkey"
            columns: ["parent_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          amount: number | null
          category: Database["public"]["Enums"]["receipt_category"]
          cost_type: string
          created_at: string
          currency: string
          file_path: string
          id: string
          notes: string | null
          notified_accounting_at: string | null
          processed_data_json: Json | null
          project_id: string
          review_status: Database["public"]["Enums"]["receipt_review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          task_id: string | null
          updated_at: string
          uploaded_at: string
          uploaded_by: string
          vendor: string | null
        }
        Insert: {
          amount?: number | null
          category?: Database["public"]["Enums"]["receipt_category"]
          cost_type?: string
          created_at?: string
          currency?: string
          file_path: string
          id?: string
          notes?: string | null
          notified_accounting_at?: string | null
          processed_data_json?: Json | null
          project_id: string
          review_status?: Database["public"]["Enums"]["receipt_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          task_id?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by: string
          vendor?: string | null
        }
        Update: {
          amount?: number | null
          category?: Database["public"]["Enums"]["receipt_category"]
          cost_type?: string
          created_at?: string
          currency?: string
          file_path?: string
          id?: string
          notes?: string | null
          notified_accounting_at?: string | null
          processed_data_json?: Json | null
          project_id?: string
          review_status?: Database["public"]["Enums"]["receipt_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          task_id?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "receipts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_invoice_templates: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string
          frequency: string
          id: string
          is_active: boolean
          line_items: Json
          next_issue_date: string
          notes: string | null
          organization_id: string
          project_id: string | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by: string
          frequency?: string
          id?: string
          is_active?: boolean
          line_items?: Json
          next_issue_date: string
          notes?: string | null
          organization_id: string
          project_id?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string
          frequency?: string
          id?: string
          is_active?: boolean
          line_items?: Json
          next_issue_date?: string
          notes?: string | null
          organization_id?: string
          project_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_invoice_templates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_invoice_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_invoice_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_invoice_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "recurring_invoice_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      release_manual_checks: {
        Row: {
          check_key: string
          checked_at: string | null
          checked_by: string | null
          created_at: string
          id: string
          is_checked: boolean
          label: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          check_key: string
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          id?: string
          is_checked?: boolean
          label: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          check_key?: string
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          id?: string
          is_checked?: boolean
          label?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "release_manual_checks_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "release_manual_checks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_entries: {
        Row: {
          created_at: string
          field_name: string
          field_value: string | null
          id: string
          notes: string | null
          safety_form_id: string
        }
        Insert: {
          created_at?: string
          field_name: string
          field_value?: string | null
          id?: string
          notes?: string | null
          safety_form_id: string
        }
        Update: {
          created_at?: string
          field_name?: string
          field_value?: string | null
          id?: string
          notes?: string | null
          safety_form_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_entries_safety_form_id_fkey"
            columns: ["safety_form_id"]
            isOneToOne: false
            referencedRelation: "safety_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_form_acknowledgments: {
        Row: {
          acknowledged_at: string
          attestation_text: string | null
          created_at: string | null
          id: string
          initiated_by_user_id: string | null
          initiation_method: string | null
          safety_form_id: string
          signature_url: string | null
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          attestation_text?: string | null
          created_at?: string | null
          id?: string
          initiated_by_user_id?: string | null
          initiation_method?: string | null
          safety_form_id: string
          signature_url?: string | null
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          attestation_text?: string | null
          created_at?: string | null
          id?: string
          initiated_by_user_id?: string | null
          initiation_method?: string | null
          safety_form_id?: string
          signature_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_form_acknowledgments_initiated_by_user_id_fkey"
            columns: ["initiated_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_form_acknowledgments_safety_form_id_fkey"
            columns: ["safety_form_id"]
            isOneToOne: false
            referencedRelation: "safety_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_form_acknowledgments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_form_amendments: {
        Row: {
          approved_record_hash: string | null
          approved_snapshot: Json | null
          created_at: string | null
          id: string
          original_snapshot: Json
          previous_record_hash: string | null
          proposed_changes: Json
          reason: string
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          safety_form_id: string
          status: string | null
        }
        Insert: {
          approved_record_hash?: string | null
          approved_snapshot?: Json | null
          created_at?: string | null
          id?: string
          original_snapshot: Json
          previous_record_hash?: string | null
          proposed_changes: Json
          reason: string
          requested_by: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          safety_form_id: string
          status?: string | null
        }
        Update: {
          approved_record_hash?: string | null
          approved_snapshot?: Json | null
          created_at?: string | null
          id?: string
          original_snapshot?: Json
          previous_record_hash?: string | null
          proposed_changes?: Json
          reason?: string
          requested_by?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          safety_form_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_form_amendments_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_form_amendments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_form_amendments_safety_form_id_fkey"
            columns: ["safety_form_id"]
            isOneToOne: false
            referencedRelation: "safety_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_form_attendees: {
        Row: {
          created_at: string | null
          id: string
          is_foreman: boolean | null
          safety_form_id: string
          signature_url: string | null
          signed_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_foreman?: boolean | null
          safety_form_id: string
          signature_url?: string | null
          signed_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_foreman?: boolean | null
          safety_form_id?: string
          signature_url?: string | null
          signed_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_form_attendees_safety_form_id_fkey"
            columns: ["safety_form_id"]
            isOneToOne: false
            referencedRelation: "safety_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_form_attendees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_forms: {
        Row: {
          created_at: string
          created_by: string
          device_info: Json | null
          form_type: string
          id: string
          inspection_date: string | null
          is_deleted: boolean
          project_id: string
          record_hash: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["safety_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          device_info?: Json | null
          form_type: string
          id?: string
          inspection_date?: string | null
          is_deleted?: boolean
          project_id: string
          record_hash?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["safety_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          device_info?: Json | null
          form_type?: string
          id?: string
          inspection_date?: string | null
          is_deleted?: boolean
          project_id?: string
          record_hash?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["safety_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_forms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_forms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_forms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "safety_forms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_forms_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scope_items: {
        Row: {
          budgeted_hours: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          phase: string | null
          project_id: string
          sort_order: number | null
          trade_id: string | null
          updated_at: string
        }
        Insert: {
          budgeted_hours?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phase?: string | null
          project_id: string
          sort_order?: number | null
          trade_id?: string | null
          updated_at?: string
        }
        Update: {
          budgeted_hours?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phase?: string | null
          project_id?: string
          sort_order?: number | null
          trade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scope_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "scope_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_items_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
        ]
      }
      setup_checklist_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          dismissed_at: string | null
          id: string
          organization_id: string
          step_first_drawing: boolean | null
          step_first_invite: boolean | null
          step_first_job_site: boolean | null
          step_first_project: boolean | null
          step_first_safety_form: boolean | null
          step_hazard_library: boolean | null
          step_invoice_permissions: boolean
          step_labor_rates: boolean
          step_org_created: boolean | null
          step_ppe_reviewed: boolean | null
          step_time_tracking_configured: boolean | null
          step_time_tracking_enabled: boolean | null
          step_timezone_set: boolean | null
          step_trades_configured: boolean | null
          step_users_assigned: boolean | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          organization_id: string
          step_first_drawing?: boolean | null
          step_first_invite?: boolean | null
          step_first_job_site?: boolean | null
          step_first_project?: boolean | null
          step_first_safety_form?: boolean | null
          step_hazard_library?: boolean | null
          step_invoice_permissions?: boolean
          step_labor_rates?: boolean
          step_org_created?: boolean | null
          step_ppe_reviewed?: boolean | null
          step_time_tracking_configured?: boolean | null
          step_time_tracking_enabled?: boolean | null
          step_timezone_set?: boolean | null
          step_trades_configured?: boolean | null
          step_users_assigned?: boolean | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          organization_id?: string
          step_first_drawing?: boolean | null
          step_first_invite?: boolean | null
          step_first_job_site?: boolean | null
          step_first_project?: boolean | null
          step_first_safety_form?: boolean | null
          step_hazard_library?: boolean | null
          step_invoice_permissions?: boolean
          step_labor_rates?: boolean
          step_org_created?: boolean | null
          step_ppe_reviewed?: boolean | null
          step_time_tracking_configured?: boolean | null
          step_time_tracking_enabled?: boolean | null
          step_timezone_set?: boolean | null
          step_trades_configured?: boolean | null
          step_users_assigned?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "setup_checklist_progress_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      snapshots_run_log: {
        Row: {
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          organization_id: string
          projects_count: number
          run_at: string
          snapshot_date: string
          started_at: string | null
          success: boolean
        }
        Insert: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          organization_id: string
          projects_count?: number
          run_at?: string
          snapshot_date: string
          started_at?: string | null
          success?: boolean
        }
        Update: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          organization_id?: string
          projects_count?: number
          run_at?: string
          snapshot_date?: string
          started_at?: string | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "snapshots_run_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_issues: {
        Row: {
          browser_info: Json | null
          category: string
          created_at: string
          current_route: string | null
          description: string
          id: string
          organization_id: string | null
          priority: string
          project_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          screenshot_url: string | null
          status: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          browser_info?: Json | null
          category?: string
          created_at?: string
          current_route?: string | null
          description: string
          id?: string
          organization_id?: string | null
          priority?: string
          project_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          screenshot_url?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          browser_info?: Json | null
          category?: string
          created_at?: string
          current_route?: string | null
          description?: string
          id?: string
          organization_id?: string | null
          priority?: string
          project_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          screenshot_url?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_issues_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "support_issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignments: {
        Row: {
          assigned_at: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_checklist_items: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          is_completed: boolean
          sort_order: number
          task_id: string
          title: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          sort_order?: number
          task_id: string
          title: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          sort_order?: number
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklist_items_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_checklist_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_dependencies: {
        Row: {
          created_at: string
          depends_on_task_id: string
          id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          depends_on_task_id: string
          id?: string
          task_id: string
        }
        Update: {
          created_at?: string
          depends_on_task_id?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_trade_id: string | null
          baseline_density_weight: number | null
          baseline_high_hours: number | null
          baseline_low_hours: number | null
          baseline_role_type: string | null
          budgeted_hours: number | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          end_date: string | null
          estimated_hours: number | null
          id: string
          is_deleted: boolean
          is_generated: boolean
          location: string | null
          planned_hours: number | null
          playbook_collapsed: boolean
          playbook_required: boolean | null
          priority: number
          project_id: string
          review_requested_at: string | null
          review_requested_by: string | null
          scope_item_id: string | null
          sort_order: number | null
          source_playbook_id: string | null
          source_playbook_version: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_trade_id?: string | null
          baseline_density_weight?: number | null
          baseline_high_hours?: number | null
          baseline_low_hours?: number | null
          baseline_role_type?: string | null
          budgeted_hours?: number | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          end_date?: string | null
          estimated_hours?: number | null
          id?: string
          is_deleted?: boolean
          is_generated?: boolean
          location?: string | null
          planned_hours?: number | null
          playbook_collapsed?: boolean
          playbook_required?: boolean | null
          priority?: number
          project_id: string
          review_requested_at?: string | null
          review_requested_by?: string | null
          scope_item_id?: string | null
          sort_order?: number | null
          source_playbook_id?: string | null
          source_playbook_version?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_trade_id?: string | null
          baseline_density_weight?: number | null
          baseline_high_hours?: number | null
          baseline_low_hours?: number | null
          baseline_role_type?: string | null
          budgeted_hours?: number | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          end_date?: string | null
          estimated_hours?: number | null
          id?: string
          is_deleted?: boolean
          is_generated?: boolean
          location?: string | null
          planned_hours?: number | null
          playbook_collapsed?: boolean
          playbook_required?: boolean | null
          priority?: number
          project_id?: string
          review_requested_at?: string | null
          review_requested_by?: string | null
          scope_item_id?: string | null
          sort_order?: number | null
          source_playbook_id?: string | null
          source_playbook_version?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_trade_id_fkey"
            columns: ["assigned_trade_id"]
            isOneToOne: false
            referencedRelation: "trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_review_requested_by_fkey"
            columns: ["review_requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_scope_item_id_fkey"
            columns: ["scope_item_id"]
            isOneToOne: false
            referencedRelation: "project_scope_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_source_playbook_id_fkey"
            columns: ["source_playbook_id"]
            isOneToOne: false
            referencedRelation: "playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      time_adjustment_requests: {
        Row: {
          created_at: string
          id: string
          job_site_id: string | null
          organization_id: string
          project_id: string
          proposed_check_in_at: string | null
          proposed_check_out_at: string | null
          proposed_job_site_id: string | null
          proposed_notes: string | null
          reason: string
          request_type: string
          requester_user_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_user_id: string
          time_entry_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          job_site_id?: string | null
          organization_id: string
          project_id: string
          proposed_check_in_at?: string | null
          proposed_check_out_at?: string | null
          proposed_job_site_id?: string | null
          proposed_notes?: string | null
          reason: string
          request_type: string
          requester_user_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_user_id: string
          time_entry_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          job_site_id?: string | null
          organization_id?: string
          project_id?: string
          proposed_check_in_at?: string | null
          proposed_check_out_at?: string | null
          proposed_job_site_id?: string | null
          proposed_notes?: string | null
          reason?: string
          request_type?: string
          requester_user_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_user_id?: string
          time_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_adjustment_requests_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_adjustment_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_adjustment_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_adjustment_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "time_adjustment_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_adjustment_requests_proposed_job_site_id_fkey"
            columns: ["proposed_job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_adjustment_requests_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_adjustment_requests_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "v_time_entries_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_adjustment_requests_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "v_time_entries_status"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          check_in_at: string
          check_in_latitude: number | null
          check_in_longitude: number | null
          check_out_at: string | null
          check_out_latitude: number | null
          check_out_longitude: number | null
          closed_by: string | null
          closed_method: string
          created_at: string
          duration_hours: number | null
          duration_minutes: number | null
          flag_reason: string | null
          id: string
          is_flagged: boolean
          job_site_id: string | null
          notes: string | null
          organization_id: string
          project_id: string
          project_timezone: string
          scope_item_id: string | null
          source: string
          status: string
          task_id: string | null
          user_id: string
        }
        Insert: {
          check_in_at: string
          check_in_latitude?: number | null
          check_in_longitude?: number | null
          check_out_at?: string | null
          check_out_latitude?: number | null
          check_out_longitude?: number | null
          closed_by?: string | null
          closed_method?: string
          created_at?: string
          duration_hours?: number | null
          duration_minutes?: number | null
          flag_reason?: string | null
          id?: string
          is_flagged?: boolean
          job_site_id?: string | null
          notes?: string | null
          organization_id: string
          project_id: string
          project_timezone: string
          scope_item_id?: string | null
          source?: string
          status?: string
          task_id?: string | null
          user_id: string
        }
        Update: {
          check_in_at?: string
          check_in_latitude?: number | null
          check_in_longitude?: number | null
          check_out_at?: string | null
          check_out_latitude?: number | null
          check_out_longitude?: number | null
          closed_by?: string | null
          closed_method?: string
          created_at?: string
          duration_hours?: number | null
          duration_minutes?: number | null
          flag_reason?: string | null
          id?: string
          is_flagged?: boolean
          job_site_id?: string | null
          notes?: string | null
          organization_id?: string
          project_id?: string
          project_timezone?: string
          scope_item_id?: string | null
          source?: string
          status?: string
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_scope_item_id_fkey"
            columns: ["scope_item_id"]
            isOneToOne: false
            referencedRelation: "scope_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entry_adjustments: {
        Row: {
          adjusted_by: string
          adjustment_type: string
          affects_pay: boolean
          created_at: string
          id: string
          new_values: Json
          organization_id: string
          previous_values: Json
          reason: string
          time_entry_id: string
        }
        Insert: {
          adjusted_by: string
          adjustment_type: string
          affects_pay?: boolean
          created_at?: string
          id?: string
          new_values: Json
          organization_id: string
          previous_values: Json
          reason: string
          time_entry_id: string
        }
        Update: {
          adjusted_by?: string
          adjustment_type?: string
          affects_pay?: boolean
          created_at?: string
          id?: string
          new_values?: Json
          organization_id?: string
          previous_values?: Json
          reason?: string
          time_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entry_adjustments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_adjustments_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_adjustments_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "v_time_entries_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_adjustments_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "v_time_entries_status"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entry_flags: {
        Row: {
          created_at: string
          created_by: string | null
          created_source: string
          flag_code: string
          id: string
          metadata: Json
          organization_id: string
          project_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          time_entry_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_source?: string
          flag_code: string
          id?: string
          metadata?: Json
          organization_id: string
          project_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          time_entry_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_source?: string
          flag_code?: string
          id?: string
          metadata?: Json
          organization_id?: string
          project_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          time_entry_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entry_flags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_flags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_flags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "time_entry_flags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_flags_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_flags_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "v_time_entries_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_flags_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "v_time_entries_status"
            referencedColumns: ["id"]
          },
        ]
      }
      time_events: {
        Row: {
          actor_id: string
          created_at: string
          event_type: string
          id: string
          job_site_id: string | null
          latitude: number | null
          longitude: number | null
          metadata: Json
          occurred_at: string
          organization_id: string
          project_id: string
          source: string
          user_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          event_type: string
          id?: string
          job_site_id?: string | null
          latitude?: number | null
          longitude?: number | null
          metadata?: Json
          occurred_at?: string
          organization_id: string
          project_id: string
          source: string
          user_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          event_type?: string
          id?: string
          job_site_id?: string | null
          latitude?: number | null
          longitude?: number | null
          metadata?: Json
          occurred_at?: string
          organization_id?: string
          project_id?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_events_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "time_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      time_flag_codes: {
        Row: {
          code: string
          created_at: string
          description: string
          is_active: boolean
          severity: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          is_active?: boolean
          severity: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          is_active?: boolean
          severity?: string
        }
        Relationships: []
      }
      timesheet_periods: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          attestation_text: string | null
          created_at: string
          id: string
          locked_at: string | null
          locked_by: string | null
          notes: string | null
          organization_id: string
          period_end: string
          period_start: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          attestation_text?: string | null
          created_at?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          organization_id: string
          period_end: string
          period_start: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          attestation_text?: string | null
          created_at?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          organization_id?: string
          period_end?: string
          period_start?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_periods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_ppe_requirements: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_mandatory: boolean
          ppe_item: string
          trade_type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_mandatory?: boolean
          ppe_item: string
          trade_type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_mandatory?: boolean
          ppe_item?: string
          trade_type?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          company_name: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string | null
          trade_type: string
          updated_at: string
        }
        Insert: {
          company_name: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id?: string | null
          trade_type: string
          updated_at?: string
        }
        Update: {
          company_name?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string | null
          trade_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_transcriptions: {
        Row: {
          audio_url: string | null
          created_at: string
          id: string
          project_id: string
          task_id: string | null
          transcription_text: string
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          id?: string
          project_id: string
          task_id?: string | null
          transcription_text: string
          user_id: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          id?: string
          project_id?: string
          task_id?: string | null
          transcription_text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_transcriptions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_transcriptions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "voice_transcriptions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_transcriptions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_phase_requirements: {
        Row: {
          id: string
          meta: Json
          phase_key: string
          requirement_label: string
          requirement_type: string
        }
        Insert: {
          id?: string
          meta?: Json
          phase_key: string
          requirement_label: string
          requirement_type: string
        }
        Update: {
          id?: string
          meta?: Json
          phase_key?: string
          requirement_label?: string
          requirement_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_phase_requirements_phase_key_fkey"
            columns: ["phase_key"]
            isOneToOne: false
            referencedRelation: "workflow_phases"
            referencedColumns: ["key"]
          },
        ]
      }
      workflow_phases: {
        Row: {
          allowed_approver_roles: string[]
          allowed_requester_roles: string[]
          description: string | null
          is_approval_required: boolean
          key: string
          label: string
          sort_order: number
        }
        Insert: {
          allowed_approver_roles?: string[]
          allowed_requester_roles?: string[]
          description?: string | null
          is_approval_required?: boolean
          key: string
          label: string
          sort_order: number
        }
        Update: {
          allowed_approver_roles?: string[]
          allowed_requester_roles?: string[]
          description?: string | null
          is_approval_required?: boolean
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
    }
    Views: {
      v_project_economic_snapshot: {
        Row: {
          actual_cost: number | null
          actual_labor_cost: number | null
          actual_material_cost: number | null
          cost_to_revenue_ratio: number | null
          org_id: string | null
          project_id: string | null
          projected_revenue: number | null
          realized_margin_ratio: number | null
          revenue_delta_from_estimate: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_project_progress: {
        Row: {
          blocked_tasks: number | null
          completed_tasks: number | null
          id: string | null
          location: string | null
          name: string | null
          organization_id: string | null
          status: string | null
          total_tasks: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_rpc_metadata: {
        Row: {
          arguments: string | null
          function_name: unknown
          return_type: string | null
          security_definer: boolean | null
        }
        Relationships: []
      }
      v_time_entries_enriched: {
        Row: {
          check_in_at: string | null
          check_in_latitude: number | null
          check_in_longitude: number | null
          check_out_at: string | null
          check_out_latitude: number | null
          check_out_longitude: number | null
          closed_by: string | null
          closed_by_display_name: string | null
          closed_method: string | null
          created_at: string | null
          duration_hours: number | null
          duration_minutes: number | null
          flag_reason: string | null
          id: string | null
          is_flagged: boolean | null
          job_site_address: string | null
          job_site_id: string | null
          job_site_name: string | null
          notes: string | null
          organization_id: string | null
          project_id: string | null
          project_job_number: string | null
          project_name: string | null
          project_timezone: string | null
          source: string | null
          status: string | null
          user_display_name: string | null
          user_email: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
        ]
      }
      v_time_entries_status: {
        Row: {
          check_in_at: string | null
          check_in_latitude: number | null
          check_in_longitude: number | null
          check_out_at: string | null
          check_out_latitude: number | null
          check_out_longitude: number | null
          closed_by: string | null
          closed_method: string | null
          created_at: string | null
          duration_hours: number | null
          duration_minutes: number | null
          flag_reason: string | null
          flags: string[] | null
          has_auto_closed: boolean | null
          has_edited_after_submission: boolean | null
          has_gps_low: boolean | null
          has_location_unverified: boolean | null
          has_long_shift: boolean | null
          has_manual: boolean | null
          has_missing_job_site: boolean | null
          has_offline: boolean | null
          id: string | null
          is_flagged: boolean | null
          is_stale: boolean | null
          job_site_id: string | null
          max_severity: string | null
          max_severity_level: number | null
          notes: string | null
          organization_id: string | null
          project_id: string | null
          project_timezone: string | null
          source: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          check_in_at?: string | null
          check_in_latitude?: number | null
          check_in_longitude?: number | null
          check_out_at?: string | null
          check_out_latitude?: number | null
          check_out_longitude?: number | null
          closed_by?: string | null
          closed_method?: string | null
          created_at?: string | null
          duration_hours?: number | null
          duration_minutes?: number | null
          flag_reason?: string | null
          flags?: never
          has_auto_closed?: never
          has_edited_after_submission?: never
          has_gps_low?: never
          has_location_unverified?: never
          has_long_shift?: never
          has_manual?: never
          has_missing_job_site?: never
          has_offline?: never
          id?: string | null
          is_flagged?: boolean | null
          is_stale?: never
          job_site_id?: string | null
          max_severity?: never
          max_severity_level?: never
          notes?: string | null
          organization_id?: string | null
          project_id?: string | null
          project_timezone?: string | null
          source?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          check_in_at?: string | null
          check_in_latitude?: number | null
          check_in_longitude?: number | null
          check_out_at?: string | null
          check_out_latitude?: number | null
          check_out_longitude?: number | null
          closed_by?: string | null
          closed_method?: string | null
          created_at?: string | null
          duration_hours?: number | null
          duration_minutes?: number | null
          flag_reason?: string | null
          flags?: never
          has_auto_closed?: never
          has_edited_after_submission?: never
          has_gps_low?: never
          has_location_unverified?: never
          has_long_shift?: never
          has_manual?: never
          has_missing_job_site?: never
          has_offline?: never
          id?: string | null
          is_flagged?: boolean | null
          is_stale?: never
          job_site_id?: string | null
          max_severity?: never
          max_severity_level?: never
          notes?: string | null
          organization_id?: string | null
          project_id?: string | null
          project_timezone?: string | null
          source?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_job_site_id_fkey"
            columns: ["job_site_id"]
            isOneToOne: false
            referencedRelation: "job_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_economic_snapshot"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _audit_change_orders_hardened: { Args: never; Returns: Json }
      _audit_playbook_checks: { Args: { p_project_id?: string }; Returns: Json }
      _check_function_exists: {
        Args: { p_function_name: string }
        Returns: Json
      }
      _playbook_snapshot: { Args: { p_playbook_id: string }; Returns: Json }
      assign_time_entry_task: {
        Args: { p_task_id: string; p_time_entry_id: string }
        Returns: boolean
      }
      backfill_weekly_snapshots: {
        Args: { p_org_id: string; p_weeks?: number }
        Returns: Json
      }
      can_manage_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      check_rls_status: { Args: { p_tables: string[] }; Returns: Json }
      cleanup_expired_idempotency_keys: { Args: never; Returns: number }
      convert_quote_to_invoice: {
        Args: { p_actor_id: string; p_quote_id: string }
        Returns: string
      }
      estimate_variance_summary: {
        Args: { p_project_id: string }
        Returns: Json
      }
      generate_org_financial_snapshot: {
        Args: { p_org_id: string; p_period?: string; p_snapshot_date: string }
        Returns: string
      }
      generate_project_financial_snapshot: {
        Args: {
          p_period?: string
          p_project_id: string
          p_snapshot_date: string
        }
        Returns: string
      }
      generate_tasks_from_scope: {
        Args: { p_mode: string; p_project_id: string }
        Returns: Json
      }
      generate_weekly_snapshots_for_org: {
        Args: { p_org_id: string; p_snapshot_date?: string }
        Returns: Json
      }
      get_next_estimate_number: { Args: { p_org_id: string }; Returns: string }
      get_next_invoice_number: { Args: { org_id: string }; Returns: string }
      get_next_quote_number: { Args: { p_org_id: string }; Returns: string }
      get_operational_patterns: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      get_playbook_baseline: { Args: { p_project_id: string }; Returns: Json }
      get_task_project_id: { Args: { _task_id: string }; Returns: string }
      get_time_cron_secret: { Args: never; Returns: string }
      get_user_organizations: { Args: { _user_id: string }; Returns: string[] }
      get_user_project_role: {
        Args: { _project_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_any_project_role: {
        Args: {
          _project_id: string
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_org_membership: { Args: { _org_id: string }; Returns: boolean }
      has_org_membership_for_user: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      has_project_access: {
        Args: { p_org_roles?: string[]; p_project_id: string }
        Returns: boolean
      }
      has_project_membership: {
        Args: { _project_id: string }
        Returns: boolean
      }
      has_project_role: {
        Args: {
          _project_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_assigned_to_task: {
        Args: { _task_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_scoped_project_member: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: boolean
      }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_valid_time_entry: {
        Args: { te: Database["public"]["Tables"]["time_entries"]["Row"] }
        Returns: boolean
      }
      org_role: { Args: { _org_id: string }; Returns: string }
      org_role_for_user: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: string
      }
      org_scope_accuracy: {
        Args: { p_org_id: string; p_weeks?: number }
        Returns: {
          avg_delta_pct: number
          normalized_name: string
          project_count: number
          total_actual_hours: number
          total_planned_hours: number
          worst_delta_pct: number
          worst_project_name: string
        }[]
      }
      preview_tasks_from_scope: {
        Args: { p_mode: string; p_project_id: string }
        Returns: {
          action: string
          scope_item_id: string
          scope_item_name: string
        }[]
      }
      project_actual_costs: {
        Args: { p_project_id: string }
        Returns: {
          actual_labor_cost: number
          actual_labor_hours: number
          actual_machine_cost: number
          actual_material_cost: number
          actual_other_cost: number
          actual_total_cost: number
          actual_unclassified_cost: number
          labor_entry_count_currency_mismatch: number
          labor_entry_count_missing_cost_rate: number
          labor_entry_count_missing_membership: number
          labor_hours_currency_mismatch: number
          labor_hours_missing_cost_rate: number
          labor_hours_missing_membership: number
          project_currency: string
          unclassified_receipt_count: number
        }[]
      }
      project_invoicing_summary: {
        Args: {
          p_include_drafts?: boolean
          p_include_scheduled?: boolean
          p_project_id: string
        }
        Returns: {
          billed_pct_relaxed: number
          billed_pct_strict: number
          contract_value: number
          invoice_count_relaxed: number
          invoice_count_strict: number
          invoiced_amount_relaxed: number
          invoiced_amount_strict: number
          remainder_relaxed: number
          remainder_strict: number
        }[]
      }
      project_portfolio_report: {
        Args: {
          p_end_date?: string
          p_limit?: number
          p_offset?: number
          p_org_id: string
          p_start_date?: string
          p_status_filter?: string
        }
        Returns: {
          actual_labor_hours: number
          actual_margin_percent: number
          actual_profit: number
          actual_total_cost: number
          actual_unclassified_cost: number
          billed_percentage: number
          contract_value: number
          current_percent_to_bill: number
          customer_name: string
          invoiced_amount: number
          invoiced_amount_relaxed: number
          invoiced_amount_strict: number
          job_number: string
          labor_hours_delta: number
          labor_hours_missing_cost_rate: number
          labor_hours_missing_membership: number
          planned_labor_hours: number
          planned_margin_percent: number
          planned_profit: number
          planned_total_cost: number
          project_id: string
          project_name: string
          remainder_to_invoice: number
          status: string
          total_cost_delta: number
        }[]
      }
      project_scope_accuracy: {
        Args: {
          p_end_date?: string
          p_project_id: string
          p_start_date?: string
        }
        Returns: {
          actual_hours: number
          delta_hours: number
          delta_pct: number
          item_type: string
          planned_hours: number
          scope_item_id: string
          scope_item_name: string
          task_count: number
          trade_breakdown: Json
        }[]
      }
      project_task_actual_hours: {
        Args: { p_project_id: string }
        Returns: {
          actual_hours: number
          task_id: string
        }[]
      }
      project_variance_summary: {
        Args: { p_project_id: string }
        Returns: {
          actual_labor_cost: number
          actual_labor_hours: number
          actual_machine_cost: number
          actual_margin_percent: number
          actual_material_cost: number
          actual_other_cost: number
          actual_profit: number
          actual_total_cost: number
          actual_unclassified_cost: number
          contract_value: number
          labor_cost_delta: number
          labor_hours_delta: number
          labor_hours_missing_cost_rate: number
          labor_hours_missing_membership: number
          machine_cost_delta: number
          material_cost_delta: number
          other_cost_delta: number
          planned_labor_cost: number
          planned_labor_hours: number
          planned_machine_cost: number
          planned_margin_percent: number
          planned_material_cost: number
          planned_other_cost: number
          planned_profit: number
          planned_total_cost: number
          total_cost_delta: number
        }[]
      }
      rpc_add_change_order_line_item: {
        Args: {
          p_change_order_id: string
          p_description?: string
          p_name: string
          p_quantity?: number
          p_rate?: number
          p_sort_order?: number
        }
        Returns: Json
      }
      rpc_apply_playbook_to_project:
        | {
            Args: { p_playbook_id: string; p_project_id: string }
            Returns: Json
          }
        | {
            Args: {
              p_force_reapply?: boolean
              p_playbook_id: string
              p_project_id: string
            }
            Returns: Json
          }
      rpc_approve_change_order: {
        Args: { p_approved?: boolean; p_change_order_id: string }
        Returns: Json
      }
      rpc_approve_estimate: { Args: { p_estimate_id: string }; Returns: Json }
      rpc_approve_phase: {
        Args: {
          p_approve: boolean
          p_message?: string
          p_phase_key: string
          p_project_id: string
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          phase_key: string
          project_id: string
          requested_at: string | null
          requested_by: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "project_workflow_steps"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_approve_timesheet_period: {
        Args: { p_actor_id: string; p_period_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          attestation_text: string | null
          created_at: string
          id: string
          locked_at: string | null
          locked_by: string | null
          notes: string | null
          organization_id: string
          period_end: string
          period_start: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "timesheet_periods"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_archive_playbook: { Args: { p_playbook_id: string }; Returns: Json }
      rpc_calculate_certification_tier: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      rpc_calculate_operational_profile_score: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      rpc_cancel_time_adjustment_request: {
        Args: { p_actor_id: string; p_request_id: string }
        Returns: {
          created_at: string
          id: string
          job_site_id: string | null
          organization_id: string
          project_id: string
          proposed_check_in_at: string | null
          proposed_check_out_at: string | null
          proposed_job_site_id: string | null
          proposed_notes: string | null
          reason: string
          request_type: string
          requester_user_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_user_id: string
          time_entry_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "time_adjustment_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_check_workflow_write_deny: { Args: never; Returns: Json }
      rpc_convert_proposal_to_quote: {
        Args: { p_include_estimate_lines?: boolean; p_proposal_id: string }
        Returns: string
      }
      rpc_convert_quote_to_invoice: {
        Args: { p_quote_id: string }
        Returns: Json
      }
      rpc_create_change_order: {
        Args: { p_payload_json: Json; p_project_id: string }
        Returns: Json
      }
      rpc_create_conversion_test_fixture: {
        Args: { p_org_id: string }
        Returns: Json
      }
      rpc_create_estimate: { Args: { p_project_id: string }; Returns: Json }
      rpc_create_playbook: {
        Args: {
          p_description?: string
          p_is_default?: boolean
          p_job_type?: string
          p_name: string
          p_organization_id: string
          p_phases?: Json
        }
        Returns: Json
      }
      rpc_delete_change_order_line_item: {
        Args: { p_line_item_id: string }
        Returns: Json
      }
      rpc_delete_estimate: {
        Args: { p_estimate_id: string }
        Returns: undefined
      }
      rpc_delete_estimate_line_item: {
        Args: { p_line_item_id: string }
        Returns: undefined
      }
      rpc_duplicate_estimate: { Args: { p_estimate_id: string }; Returns: Json }
      rpc_duplicate_playbook: {
        Args: { p_new_name?: string; p_playbook_id: string }
        Returns: Json
      }
      rpc_ensure_release_checks: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      rpc_ensure_timesheet_period: {
        Args: {
          p_period_end: string
          p_period_start: string
          p_user_id: string
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          attestation_text: string | null
          created_at: string
          id: string
          locked_at: string | null
          locked_by: string | null
          notes: string | null
          organization_id: string
          period_end: string
          period_start: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "timesheet_periods"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_generate_org_operational_summary: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      rpc_generate_tasks_from_estimate: {
        Args: { p_estimate_id: string }
        Returns: Json
      }
      rpc_get_archetype_margin_stats: {
        Args: { p_archetype_id: string }
        Returns: Json
      }
      rpc_get_guardrails: { Args: never; Returns: Json }
      rpc_get_org_costing_setup_status: {
        Args: { p_org_id: string }
        Returns: Json
      }
      rpc_get_playbook_performance: {
        Args: { p_playbook_id: string }
        Returns: Json
      }
      rpc_get_pricing_suggestions: {
        Args: { p_min_projects?: number }
        Returns: Json
      }
      rpc_get_project_cost_rollup: {
        Args: { p_project_id: string }
        Returns: Json
      }
      rpc_get_project_profit_risk: {
        Args: { p_project_id: string }
        Returns: Json
      }
      rpc_get_project_workflow: {
        Args: { p_project_id: string }
        Returns: Json
      }
      rpc_get_system_integrity_issues: {
        Args: { p_project_id: string }
        Returns: Json
      }
      rpc_get_unrated_labor_summary: {
        Args: { p_project_id?: string }
        Returns: Json
      }
      rpc_list_playbooks_by_org: {
        Args: { p_include_archived?: boolean; p_organization_id: string }
        Returns: Json
      }
      rpc_lock_timesheet_period: {
        Args: { p_actor_id: string; p_period_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          attestation_text: string | null
          created_at: string
          id: string
          locked_at: string | null
          locked_by: string | null
          notes: string | null
          organization_id: string
          period_end: string
          period_start: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "timesheet_periods"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_log_financial_override: {
        Args: {
          p_checkpoint: string
          p_override_reason: string
          p_project_id: string
        }
        Returns: boolean
      }
      rpc_log_quote_event:
        | {
            Args: {
              p_event_type: string
              p_message?: string
              p_metadata?: Json
              p_quote_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_event_type: string
              p_metadata?: Json
              p_quote_id: string
            }
            Returns: undefined
          }
      rpc_recalculate_change_order_totals: {
        Args: { p_change_order_id: string }
        Returns: undefined
      }
      rpc_recalculate_estimate_totals: {
        Args: { p_estimate_id: string }
        Returns: undefined
      }
      rpc_request_invoice_approval: {
        Args: { p_invoice_id: string }
        Returns: Json
      }
      rpc_request_phase_advance: {
        Args: { p_notes?: string; p_phase_key: string; p_project_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          phase_key: string
          project_id: string
          requested_at: string | null
          requested_by: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "project_workflow_steps"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_review_time_adjustment_request: {
        Args: {
          p_actor_id: string
          p_decision: string
          p_request_id: string
          p_review_note: string
        }
        Returns: Json
      }
      rpc_run_audit_suite: { Args: { p_project_id?: string }; Returns: Json }
      rpc_run_org_onboarding_wizard: {
        Args: { p_answers: Json; p_organization_id: string }
        Returns: Json
      }
      rpc_run_project_stress_test: {
        Args: { p_project_id: string }
        Returns: Json
      }
      rpc_send_change_order: {
        Args: { p_change_order_id: string }
        Returns: Json
      }
      rpc_send_invoice: { Args: { p_invoice_id: string }; Returns: undefined }
      rpc_set_guardrail: {
        Args: { p_key: string; p_mode: string; p_threshold?: number }
        Returns: Json
      }
      rpc_set_org_sandbox_mode: {
        Args: { p_is_sandbox: boolean; p_org_id: string }
        Returns: boolean
      }
      rpc_set_project_flow_mode: {
        Args: { p_flow_mode: string; p_project_id: string }
        Returns: {
          created_at: string
          current_phase: string
          flow_mode: string
          id: string
          organization_id: string
          project_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "project_workflows"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_submit_timesheet_period: {
        Args: {
          p_actor_id: string
          p_attestation_text: string
          p_period_id: string
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          attestation_text: string | null
          created_at: string
          id: string
          locked_at: string | null
          locked_by: string | null
          notes: string | null
          organization_id: string
          period_end: string
          period_start: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "timesheet_periods"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rpc_suggest_change_order_from_risk: {
        Args: { p_project_id: string }
        Returns: Json
      }
      rpc_suggest_playbook_adjustments: {
        Args: { p_playbook_id: string }
        Returns: Json
      }
      rpc_time_diagnostics_rls_probe: {
        Args: { p_org_id: string }
        Returns: Json
      }
      rpc_time_diagnostics_summary: {
        Args: { p_org_id: string }
        Returns: Json
      }
      rpc_update_change_order: {
        Args: { p_change_order_id: string; p_payload_json: Json }
        Returns: Json
      }
      rpc_update_change_order_line_item: {
        Args: { p_line_item_id: string; p_payload_json: Json }
        Returns: Json
      }
      rpc_update_estimate_header: {
        Args: { p_estimate_id: string; p_patch: Json }
        Returns: Json
      }
      rpc_update_org_base_currency: {
        Args: { p_currency: string; p_org_id: string }
        Returns: undefined
      }
      rpc_update_org_intelligence_profile: {
        Args: { p_organization_id: string; p_patch: Json }
        Returns: Json
      }
      rpc_update_playbook: {
        Args: {
          p_description?: string
          p_is_default?: boolean
          p_job_type?: string
          p_name?: string
          p_phases?: Json
          p_playbook_id: string
        }
        Returns: Json
      }
      rpc_update_project_currency: {
        Args: { p_currency: string; p_project_id: string }
        Returns: undefined
      }
      rpc_update_project_status: {
        Args: { p_project_id: string; p_status: string }
        Returns: undefined
      }
      rpc_upsert_estimate_line_item: {
        Args: {
          p_estimate_id: string
          p_line_item_id?: string
          p_payload?: Json
        }
        Returns: Json
      }
      rpc_upsert_operational_profile: {
        Args: { p_data: Json; p_organization_id: string }
        Returns: Json
      }
      shares_any_project: {
        Args: { p_actor_id: string; p_org_id: string; p_target_id: string }
        Returns: boolean
      }
      upsert_cron_job: {
        Args: { p_command: string; p_job_name: string; p_schedule: string }
        Returns: undefined
      }
      user_wants_notification: {
        Args: { _notification_type: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "project_manager"
        | "foreman"
        | "internal_worker"
        | "external_trade"
        | "accounting"
      deficiency_status: "open" | "in_progress" | "fixed" | "verified"
      invoice_status: "draft" | "sent" | "paid" | "overdue" | "void"
      notification_type:
        | "task_assigned"
        | "blocker_added"
        | "safety_alert"
        | "manpower_request"
        | "general"
        | "blocker_cleared"
        | "manpower_approved"
        | "manpower_denied"
        | "deficiency_created"
        | "document_uploaded"
        | "incident_report"
        | "guardrail_warning"
      proposal_status:
        | "draft"
        | "submitted"
        | "approved"
        | "rejected"
        | "archived"
      receipt_category:
        | "fuel"
        | "materials"
        | "tools"
        | "meals"
        | "lodging"
        | "other"
      receipt_review_status: "pending" | "reviewed" | "processed"
      safety_status: "draft" | "submitted" | "reviewed"
      task_status: "not_started" | "in_progress" | "blocked" | "done"
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
        "admin",
        "project_manager",
        "foreman",
        "internal_worker",
        "external_trade",
        "accounting",
      ],
      deficiency_status: ["open", "in_progress", "fixed", "verified"],
      invoice_status: ["draft", "sent", "paid", "overdue", "void"],
      notification_type: [
        "task_assigned",
        "blocker_added",
        "safety_alert",
        "manpower_request",
        "general",
        "blocker_cleared",
        "manpower_approved",
        "manpower_denied",
        "deficiency_created",
        "document_uploaded",
        "incident_report",
        "guardrail_warning",
      ],
      proposal_status: [
        "draft",
        "submitted",
        "approved",
        "rejected",
        "archived",
      ],
      receipt_category: [
        "fuel",
        "materials",
        "tools",
        "meals",
        "lodging",
        "other",
      ],
      receipt_review_status: ["pending", "reviewed", "processed"],
      safety_status: ["draft", "submitted", "reviewed"],
      task_status: ["not_started", "in_progress", "blocked", "done"],
    },
  },
} as const
