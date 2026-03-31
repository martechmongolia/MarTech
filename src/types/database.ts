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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      analysis_jobs: {
        Row: {
          attempt_count: number
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          idempotency_key: string
          meta_page_id: string
          organization_id: string
          payload: Json
          scheduled_at: string
          source_sync_job_id: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key: string
          meta_page_id: string
          organization_id: string
          payload?: Json
          scheduled_at?: string
          source_sync_job_id?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string
          meta_page_id?: string
          organization_id?: string
          payload?: Json
          scheduled_at?: string
          source_sync_job_id?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_jobs_meta_page_id_fkey"
            columns: ["meta_page_id"]
            isOneToOne: false
            referencedRelation: "meta_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_jobs_source_sync_job_id_fkey"
            columns: ["source_sync_job_id"]
            isOneToOne: false
            referencedRelation: "meta_sync_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_reports: {
        Row: {
          analysis_job_id: string | null
          created_at: string
          findings_json: Json
          id: string
          meta_page_id: string
          model_name: string | null
          organization_id: string
          recommendations_json: Json
          report_type: string
          status: string
          summary: string
        }
        Insert: {
          analysis_job_id?: string | null
          created_at?: string
          findings_json?: Json
          id?: string
          meta_page_id: string
          model_name?: string | null
          organization_id: string
          recommendations_json?: Json
          report_type: string
          status?: string
          summary?: string
        }
        Update: {
          analysis_job_id?: string | null
          created_at?: string
          findings_json?: Json
          id?: string
          meta_page_id?: string
          model_name?: string | null
          organization_id?: string
          recommendations_json?: Json
          report_type?: string
          status?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_reports_analysis_job_id_fkey"
            columns: ["analysis_job_id"]
            isOneToOne: false
            referencedRelation: "analysis_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_reports_meta_page_id_fkey"
            columns: ["meta_page_id"]
            isOneToOne: false
            referencedRelation: "meta_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          invoice_id: string | null
          organization_id: string | null
          payload: Json
          processed_at: string | null
          processing_error: string | null
          provider_event_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          invoice_id?: string | null
          organization_id?: string | null
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          provider_event_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          invoice_id?: string | null
          organization_id?: string | null
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          provider_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_design_tokens: {
        Row: {
          animation_style: string | null
          border_radius: string
          brand_manager_id: string
          colors: Json
          created_at: string
          fonts: Json
          id: string
          logo_clear_space: string | null
          logo_dont_rules: string[]
          logo_min_size_px: number | null
          spacing_unit: number
          updated_at: string
          visual_keywords: string[]
          visual_style: string | null
        }
        Insert: {
          animation_style?: string | null
          border_radius?: string
          brand_manager_id: string
          colors?: Json
          created_at?: string
          fonts?: Json
          id?: string
          logo_clear_space?: string | null
          logo_dont_rules?: string[]
          logo_min_size_px?: number | null
          spacing_unit?: number
          updated_at?: string
          visual_keywords?: string[]
          visual_style?: string | null
        }
        Update: {
          animation_style?: string | null
          border_radius?: string
          brand_manager_id?: string
          colors?: Json
          created_at?: string
          fonts?: Json
          id?: string
          logo_clear_space?: string | null
          logo_dont_rules?: string[]
          logo_min_size_px?: number | null
          spacing_unit?: number
          updated_at?: string
          visual_keywords?: string[]
          visual_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_design_tokens_brand_manager_id_fkey"
            columns: ["brand_manager_id"]
            isOneToOne: true
            referencedRelation: "brand_managers"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_knowledge_sections: {
        Row: {
          brand_manager_id: string
          completeness_score: number
          content: Json
          created_at: string
          id: string
          is_complete: boolean
          last_trained_at: string | null
          section_type: string
          updated_at: string
        }
        Insert: {
          brand_manager_id: string
          completeness_score?: number
          content?: Json
          created_at?: string
          id?: string
          is_complete?: boolean
          last_trained_at?: string | null
          section_type: string
          updated_at?: string
        }
        Update: {
          brand_manager_id?: string
          completeness_score?: number
          content?: Json
          created_at?: string
          id?: string
          is_complete?: boolean
          last_trained_at?: string | null
          section_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_knowledge_sections_brand_manager_id_fkey"
            columns: ["brand_manager_id"]
            isOneToOne: false
            referencedRelation: "brand_managers"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_managers: {
        Row: {
          avatar_color: string
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          overall_score: number
          status: string
          updated_at: string
        }
        Insert: {
          avatar_color?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          overall_score?: number
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_color?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          overall_score?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_managers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_training_sessions: {
        Row: {
          brand_manager_id: string
          created_at: string
          current_section: string
          id: string
          messages: Json
          organization_id: string
          status: string
          updated_at: string
        }
        Insert: {
          brand_manager_id: string
          created_at?: string
          current_section?: string
          id?: string
          messages?: Json
          organization_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          brand_manager_id?: string
          created_at?: string
          current_section?: string
          id?: string
          messages?: Json
          organization_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_training_sessions_brand_manager_id_fkey"
            columns: ["brand_manager_id"]
            isOneToOne: false
            referencedRelation: "brand_managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_training_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_visual_assets: {
        Row: {
          ai_audit_notes: string | null
          ai_audit_score: number | null
          ai_audited_at: string | null
          asset_tag: string | null
          asset_type: string
          brand_manager_id: string
          created_at: string
          description: string | null
          extracted_colors: string[] | null
          file_name: string
          file_path: string
          file_size: number
          height_px: number | null
          id: string
          is_primary: boolean
          mime_type: string
          organization_id: string
          sort_order: number
          updated_at: string
          usage_context: string | null
          usage_rules: string | null
          width_px: number | null
        }
        Insert: {
          ai_audit_notes?: string | null
          ai_audit_score?: number | null
          ai_audited_at?: string | null
          asset_tag?: string | null
          asset_type: string
          brand_manager_id: string
          created_at?: string
          description?: string | null
          extracted_colors?: string[] | null
          file_name: string
          file_path: string
          file_size?: number
          height_px?: number | null
          id?: string
          is_primary?: boolean
          mime_type: string
          organization_id: string
          sort_order?: number
          updated_at?: string
          usage_context?: string | null
          usage_rules?: string | null
          width_px?: number | null
        }
        Update: {
          ai_audit_notes?: string | null
          ai_audit_score?: number | null
          ai_audited_at?: string | null
          asset_tag?: string | null
          asset_type?: string
          brand_manager_id?: string
          created_at?: string
          description?: string | null
          extracted_colors?: string[] | null
          file_name?: string
          file_path?: string
          file_size?: number
          height_px?: number | null
          id?: string
          is_primary?: boolean
          mime_type?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string
          usage_context?: string | null
          usage_rules?: string | null
          width_px?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_visual_assets_brand_manager_id_fkey"
            columns: ["brand_manager_id"]
            isOneToOne: false
            referencedRelation: "brand_managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_visual_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          currency: string
          due_at: string
          id: string
          idempotency_key: string | null
          issued_at: string
          last_verification_at: string | null
          last_verification_outcome: string | null
          metadata: Json
          organization_id: string
          paid_at: string | null
          provider: string
          provider_invoice_id: string | null
          provider_last_error: string | null
          provider_payment_url: string | null
          qpay_sender_invoice_no: string
          status: string
          subscription_id: string
          target_plan_id: string
          updated_at: string
          verification_attempt_count: number
          webhook_verify_token: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          due_at: string
          id?: string
          idempotency_key?: string | null
          issued_at?: string
          last_verification_at?: string | null
          last_verification_outcome?: string | null
          metadata?: Json
          organization_id: string
          paid_at?: string | null
          provider?: string
          provider_invoice_id?: string | null
          provider_last_error?: string | null
          provider_payment_url?: string | null
          qpay_sender_invoice_no: string
          status: string
          subscription_id: string
          target_plan_id: string
          updated_at?: string
          verification_attempt_count?: number
          webhook_verify_token: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          due_at?: string
          id?: string
          idempotency_key?: string | null
          issued_at?: string
          last_verification_at?: string | null
          last_verification_outcome?: string | null
          metadata?: Json
          organization_id?: string
          paid_at?: string | null
          provider?: string
          provider_invoice_id?: string | null
          provider_last_error?: string | null
          provider_payment_url?: string | null
          qpay_sender_invoice_no?: string
          status?: string
          subscription_id?: string
          target_plan_id?: string
          updated_at?: string
          verification_attempt_count?: number
          webhook_verify_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_target_plan_id_fkey"
            columns: ["target_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_connections: {
        Row: {
          access_token_encrypted: string | null
          created_at: string
          granted_scopes: string[]
          id: string
          last_error: string | null
          last_validated_at: string | null
          meta_user_id: string | null
          organization_id: string
          refresh_token_encrypted: string | null
          status: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token_encrypted?: string | null
          created_at?: string
          granted_scopes?: string[]
          id?: string
          last_error?: string | null
          last_validated_at?: string | null
          meta_user_id?: string | null
          organization_id: string
          refresh_token_encrypted?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token_encrypted?: string | null
          created_at?: string
          granted_scopes?: string[]
          id?: string
          last_error?: string | null
          last_validated_at?: string | null
          meta_user_id?: string | null
          organization_id?: string
          refresh_token_encrypted?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_pages: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_selectable: boolean
          is_selected: boolean
          last_synced_at: string | null
          meta_connection_id: string
          meta_page_id: string
          name: string
          organization_id: string
          page_access_token_encrypted: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_selectable?: boolean
          is_selected?: boolean
          last_synced_at?: string | null
          meta_connection_id: string
          meta_page_id: string
          name: string
          organization_id: string
          page_access_token_encrypted?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_selectable?: boolean
          is_selected?: boolean
          last_synced_at?: string | null
          meta_connection_id?: string
          meta_page_id?: string
          name?: string
          organization_id?: string
          page_access_token_encrypted?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_pages_meta_connection_id_fkey"
            columns: ["meta_connection_id"]
            isOneToOne: false
            referencedRelation: "meta_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_pages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_sync_jobs: {
        Row: {
          attempt_count: number
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          idempotency_key: string
          job_type: string
          meta_page_id: string
          organization_id: string
          payload: Json
          scheduled_at: string
          started_at: string | null
          status: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key: string
          job_type: string
          meta_page_id: string
          organization_id: string
          payload?: Json
          scheduled_at?: string
          started_at?: string | null
          status?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string
          job_type?: string
          meta_page_id?: string
          organization_id?: string
          payload?: Json
          scheduled_at?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_sync_jobs_meta_page_id_fkey"
            columns: ["meta_page_id"]
            isOneToOne: false
            referencedRelation: "meta_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_sync_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_audit_events: {
        Row: {
          action_type: string
          actor_email: string
          created_at: string
          id: string
          metadata: Json
          organization_id: string | null
          resource_id: string
          resource_type: string
        }
        Insert: {
          action_type: string
          actor_email: string
          created_at?: string
          id?: string
          metadata?: Json
          organization_id?: string | null
          resource_id: string
          resource_type: string
        }
        Update: {
          action_type?: string
          actor_email?: string
          created_at?: string
          id?: string
          metadata?: Json
          organization_id?: string | null
          resource_id?: string
          resource_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
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
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      page_daily_metrics: {
        Row: {
          created_at: string
          engaged_users: number | null
          engagement_rate: number | null
          follower_delta: number | null
          followers_count: number | null
          id: string
          impressions: number | null
          meta_page_id: string
          metric_date: string
          organization_id: string
          post_count: number | null
          raw_metrics: Json
          reach: number | null
        }
        Insert: {
          created_at?: string
          engaged_users?: number | null
          engagement_rate?: number | null
          follower_delta?: number | null
          followers_count?: number | null
          id?: string
          impressions?: number | null
          meta_page_id: string
          metric_date: string
          organization_id: string
          post_count?: number | null
          raw_metrics?: Json
          reach?: number | null
        }
        Update: {
          created_at?: string
          engaged_users?: number | null
          engagement_rate?: number | null
          follower_delta?: number | null
          followers_count?: number | null
          id?: string
          impressions?: number | null
          meta_page_id?: string
          metric_date?: string
          organization_id?: string
          post_count?: number | null
          raw_metrics?: Json
          reach?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "page_daily_metrics_meta_page_id_fkey"
            columns: ["meta_page_id"]
            isOneToOne: false
            referencedRelation: "meta_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_daily_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      page_post_metrics: {
        Row: {
          clicks: number | null
          comments: number | null
          created_at: string
          engagements: number | null
          id: string
          impressions: number | null
          message_excerpt: string | null
          meta_page_id: string
          meta_post_id: string
          organization_id: string
          post_created_at: string
          post_type: string | null
          raw_metrics: Json
          reach: number | null
          reactions: number | null
          shares: number | null
          updated_at: string
        }
        Insert: {
          clicks?: number | null
          comments?: number | null
          created_at?: string
          engagements?: number | null
          id?: string
          impressions?: number | null
          message_excerpt?: string | null
          meta_page_id: string
          meta_post_id: string
          organization_id: string
          post_created_at: string
          post_type?: string | null
          raw_metrics?: Json
          reach?: number | null
          reactions?: number | null
          shares?: number | null
          updated_at?: string
        }
        Update: {
          clicks?: number | null
          comments?: number | null
          created_at?: string
          engagements?: number | null
          id?: string
          impressions?: number | null
          message_excerpt?: string | null
          meta_page_id?: string
          meta_post_id?: string
          organization_id?: string
          post_created_at?: string
          post_type?: string | null
          raw_metrics?: Json
          reach?: number | null
          reactions?: number | null
          shares?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_post_metrics_meta_page_id_fkey"
            columns: ["meta_page_id"]
            isOneToOne: false
            referencedRelation: "meta_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_post_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          invoice_id: string
          last_verification_error: string | null
          organization_id: string
          processed_at: string | null
          provider: string
          provider_txn_id: string | null
          raw_payload: Json
          status: string
          updated_at: string
          verification_payload: Json
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          id?: string
          invoice_id: string
          last_verification_error?: string | null
          organization_id: string
          processed_at?: string | null
          provider?: string
          provider_txn_id?: string | null
          raw_payload?: Json
          status: string
          updated_at?: string
          verification_payload?: Json
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string
          last_verification_error?: string | null
          organization_id?: string
          processed_at?: string | null
          provider?: string
          provider_txn_id?: string | null
          raw_payload?: Json
          status?: string
          updated_at?: string
          verification_payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          code: string
          created_at: string
          currency: string
          id: string
          is_active: boolean
          max_pages: number
          monthly_ai_reports: number
          name: string
          price_monthly: number
          report_retention_days: number
          syncs_per_day: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          currency: string
          id?: string
          is_active?: boolean
          max_pages: number
          monthly_ai_reports: number
          name: string
          price_monthly: number
          report_retention_days: number
          syncs_per_day: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          max_pages?: number
          monthly_ai_reports?: number
          name?: string
          price_monthly?: number
          report_retention_days?: number
          syncs_per_day?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          action_items: Json
          analysis_report_id: string
          category: string
          created_at: string
          description: string
          id: string
          meta_page_id: string
          organization_id: string
          priority: string
          title: string
        }
        Insert: {
          action_items?: Json
          analysis_report_id: string
          category: string
          created_at?: string
          description: string
          id?: string
          meta_page_id: string
          organization_id: string
          priority: string
          title: string
        }
        Update: {
          action_items?: Json
          analysis_report_id?: string
          category?: string
          created_at?: string
          description?: string
          id?: string
          meta_page_id?: string
          organization_id?: string
          priority?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_analysis_report_id_fkey"
            columns: ["analysis_report_id"]
            isOneToOne: false
            referencedRelation: "analysis_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_meta_page_id_fkey"
            columns: ["meta_page_id"]
            isOneToOne: false
            referencedRelation: "meta_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string
          id: string
          last_billed_at: string | null
          organization_id: string
          plan_id: string
          status: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          last_billed_at?: string | null
          organization_id: string
          plan_id: string
          status: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          last_billed_at?: string | null
          organization_id?: string
          plan_id?: string
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      system_admins: {
        Row: {
          created_at: string
          email: string
          granted_by: string | null
          id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          granted_by?: string | null
          id?: string
          role: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          granted_by?: string | null
          id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_counters: {
        Row: {
          created_at: string
          id: string
          metric_key: string
          organization_id: string
          period_key: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          metric_key: string
          organization_id: string
          period_key: string
          updated_at?: string
          value?: number
        }
        Update: {
          created_at?: string
          id?: string
          metric_key?: string
          organization_id?: string
          period_key?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "usage_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_organization_subscription: {
        Args: { target_org_id: string; target_plan_code?: string }
        Returns: string
      }
      create_organization_with_starter: {
        Args: { target_name: string; target_slug: string }
        Returns: {
          organization_id: string
          organization_member_id: string
          subscription_id: string
        }[]
      }
      get_plan_max_pages: { Args: { target_org_id: string }; Returns: number }
      is_org_member: { Args: { target_org_id: string }; Returns: boolean }
      is_org_owner: { Args: { target_org_id: string }; Returns: boolean }
      recalculate_brand_manager_score: {
        Args: { p_brand_manager_id: string }
        Returns: undefined
      }
      set_meta_page_selected: {
        Args: {
          target_meta_page_id: string
          target_org_id: string
          target_selected: boolean
        }
        Returns: boolean
      }
      reserve_quota: {
        Args: {
          p_organization_id: string
          p_metric_key: string
          p_period_key: string
          p_limit: number
        }
        Returns: boolean
      }
      release_quota: {
        Args: {
          p_organization_id: string
          p_metric_key: string
          p_period_key: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
