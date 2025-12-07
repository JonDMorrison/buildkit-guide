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
            foreignKeyName: "ai_queries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          project_id: string
          safety_form_id: string | null
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
          project_id: string
          safety_form_id?: string | null
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
          project_id?: string
          safety_form_id?: string | null
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
            foreignKeyName: "attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
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
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role: Database["public"]["Enums"]["app_role"]
          trade_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role: Database["public"]["Enums"]["app_role"]
          trade_id?: string | null
          user_id: string
        }
        Update: {
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
      projects: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          id: string
          is_deleted: boolean
          job_number: string | null
          location: string
          name: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_deleted?: boolean
          job_number?: string | null
          location: string
          name: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_deleted?: boolean
          job_number?: string | null
          location?: string
          name?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          amount: number | null
          category: Database["public"]["Enums"]["receipt_category"]
          created_at: string
          currency: string
          file_path: string
          id: string
          notes: string | null
          notified_accounting_at: string | null
          processed_data_json: Json | null
          project_id: string
          task_id: string | null
          updated_at: string
          uploaded_at: string
          uploaded_by: string
          vendor: string | null
        }
        Insert: {
          amount?: number | null
          category?: Database["public"]["Enums"]["receipt_category"]
          created_at?: string
          currency?: string
          file_path: string
          id?: string
          notes?: string | null
          notified_accounting_at?: string | null
          processed_data_json?: Json | null
          project_id: string
          task_id?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by: string
          vendor?: string | null
        }
        Update: {
          amount?: number | null
          category?: Database["public"]["Enums"]["receipt_category"]
          created_at?: string
          currency?: string
          file_path?: string
          id?: string
          notes?: string | null
          notified_accounting_at?: string | null
          processed_data_json?: Json | null
          project_id?: string
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
      safety_forms: {
        Row: {
          created_at: string
          created_by: string
          form_type: string
          id: string
          inspection_date: string | null
          is_deleted: boolean
          project_id: string
          status: Database["public"]["Enums"]["safety_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          form_type: string
          id?: string
          inspection_date?: string | null
          is_deleted?: boolean
          project_id: string
          status?: Database["public"]["Enums"]["safety_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          form_type?: string
          id?: string
          inspection_date?: string | null
          is_deleted?: boolean
          project_id?: string
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
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          end_date: string | null
          estimated_hours: number | null
          id: string
          is_deleted: boolean
          location: string | null
          priority: number
          project_id: string
          review_requested_at: string | null
          review_requested_by: string | null
          sort_order: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_trade_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          end_date?: string | null
          estimated_hours?: number | null
          id?: string
          is_deleted?: boolean
          location?: string | null
          priority?: number
          project_id: string
          review_requested_at?: string | null
          review_requested_by?: string | null
          sort_order?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_trade_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          end_date?: string | null
          estimated_hours?: number | null
          id?: string
          is_deleted?: boolean
          location?: string | null
          priority?: number
          project_id?: string
          review_requested_at?: string | null
          review_requested_by?: string | null
          sort_order?: number | null
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
            foreignKeyName: "tasks_review_requested_by_fkey"
            columns: ["review_requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          trade_type?: string
          updated_at?: string
        }
        Relationships: []
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
            foreignKeyName: "voice_transcriptions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      get_task_project_id: { Args: { _task_id: string }; Returns: string }
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
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
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
      receipt_category:
        | "fuel"
        | "materials"
        | "tools"
        | "meals"
        | "lodging"
        | "other"
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
      ],
      receipt_category: [
        "fuel",
        "materials",
        "tools",
        "meals",
        "lodging",
        "other",
      ],
      safety_status: ["draft", "submitted", "reviewed"],
      task_status: ["not_started", "in_progress", "blocked", "done"],
    },
  },
} as const
