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
      auth_events: {
        Row: {
          created_at: string
          email: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      brainstorm_config: {
        Row: {
          growth_monthly_credits: number
          id: number
          session_price_amount: number
          session_price_currency: string
          starter_monthly_credits: number
          trial_brainstorm_credits: number
          trial_days: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          growth_monthly_credits?: number
          id?: number
          session_price_amount?: number
          session_price_currency?: string
          starter_monthly_credits?: number
          trial_brainstorm_credits?: number
          trial_days?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          growth_monthly_credits?: number
          id?: number
          session_price_amount?: number
          session_price_currency?: string
          starter_monthly_credits?: number
          trial_brainstorm_credits?: number
          trial_days?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      brainstorm_credit_transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          invoice_id: string | null
          session_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          invoice_id?: string | null
          session_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          invoice_id?: string | null
          session_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brainstorm_credit_transactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "brainstorm_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      brainstorm_credits: {
        Row: {
          balance: number
          id: string
          last_refill_at: string | null
          last_refill_plan_code: string | null
          lifetime_used: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number
          id?: string
          last_refill_at?: string | null
          last_refill_plan_code?: string | null
          lifetime_used?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number
          id?: string
          last_refill_at?: string | null
          last_refill_plan_code?: string | null
          lifetime_used?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      brainstorm_messages: {
        Row: {
          agent_id: string | null
          content: string
          created_at: string
          id: string
          is_streaming: boolean
          mentioned_agent_id: string | null
          role: string
          round_number: number
          session_id: string
          turn_index: number
        }
        Insert: {
          agent_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_streaming?: boolean
          mentioned_agent_id?: string | null
          role: string
          round_number?: number
          session_id: string
          turn_index?: number
        }
        Update: {
          agent_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_streaming?: boolean
          mentioned_agent_id?: string | null
          role?: string
          round_number?: number
          session_id?: string
          turn_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "brainstorm_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "brainstorm_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      brainstorm_reports: {
        Row: {
          content: string
          generated_at: string
          id: string
          next_actions: Json
          session_id: string
          summary: string
          top_ideas: Json
        }
        Insert: {
          content?: string
          generated_at?: string
          id?: string
          next_actions?: Json
          session_id: string
          summary?: string
          top_ideas?: Json
        }
        Update: {
          content?: string
          generated_at?: string
          id?: string
          next_actions?: Json
          session_id?: string
          summary?: string
          top_ideas?: Json
        }
        Relationships: [
          {
            foreignKeyName: "brainstorm_reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "brainstorm_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      brainstorm_sessions: {
        Row: {
          active_agents: string[]
          completed_at: string | null
          constraint_text: string | null
          created_at: string
          current_agent_index: number
          current_phase: string
          current_round: number
          id: string
          language: string
          session_type: string
          status: string
          topic: string
          total_rounds: number
          turn_state: Json | null
          user_id: string
          user_turn_mode: string
        }
        Insert: {
          active_agents?: string[]
          completed_at?: string | null
          constraint_text?: string | null
          created_at?: string
          current_agent_index?: number
          current_phase?: string
          current_round?: number
          id?: string
          language?: string
          session_type?: string
          status?: string
          topic: string
          total_rounds?: number
          turn_state?: Json | null
          user_id: string
          user_turn_mode?: string
        }
        Update: {
          active_agents?: string[]
          completed_at?: string | null
          constraint_text?: string | null
          created_at?: string
          current_agent_index?: number
          current_phase?: string
          current_round?: number
          id?: string
          language?: string
          session_type?: string
          status?: string
          topic?: string
          total_rounds?: number
          turn_state?: Json | null
          user_id?: string
          user_turn_mode?: string
        }
        Relationships: []
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
      digest_items: {
        Row: {
          category: string
          created_at: string
          id: string
          importance_score: number
          original_title: string | null
          published_at: string | null
          session_id: string
          source_name: string
          source_url: string
          summary_mn: string
          title_mn: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          importance_score?: number
          original_title?: string | null
          published_at?: string | null
          session_id: string
          source_name: string
          source_url: string
          summary_mn: string
          title_mn: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          importance_score?: number
          original_title?: string | null
          published_at?: string | null
          session_id?: string
          source_name?: string
          source_url?: string
          summary_mn?: string
          title_mn?: string
        }
        Relationships: [
          {
            foreignKeyName: "digest_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "digest_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      digest_sessions: {
        Row: {
          created_at: string
          digest_date: string
          error_message: string | null
          id: string
          item_count: number
          status: string
          summary_mn: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          digest_date: string
          error_message?: string | null
          id?: string
          item_count?: number
          status?: string
          summary_mn?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          digest_date?: string
          error_message?: string | null
          id?: string
          item_count?: number
          status?: string
          summary_mn?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      digest_sources: {
        Row: {
          category: string
          created_at: string
          feed_url: string
          home_url: string | null
          id: string
          is_active: boolean
          language: string
          name: string
        }
        Insert: {
          category: string
          created_at?: string
          feed_url: string
          home_url?: string | null
          id?: string
          is_active?: boolean
          language?: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          feed_url?: string
          home_url?: string | null
          id?: string
          is_active?: boolean
          language?: string
          name?: string
        }
        Relationships: []
      }
      fb_comments: {
        Row: {
          comment_id: string
          comment_type: string | null
          commenter_id: string | null
          commenter_name: string | null
          connection_id: string | null
          created_at_facebook: string | null
          id: string
          language: string | null
          message: string
          org_id: string | null
          parent_comment_id: string | null
          post_id: string
          received_at: string | null
          sentiment: string | null
          status: string | null
        }
        Insert: {
          comment_id: string
          comment_type?: string | null
          commenter_id?: string | null
          commenter_name?: string | null
          connection_id?: string | null
          created_at_facebook?: string | null
          id?: string
          language?: string | null
          message: string
          org_id?: string | null
          parent_comment_id?: string | null
          post_id: string
          received_at?: string | null
          sentiment?: string | null
          status?: string | null
        }
        Update: {
          comment_id?: string
          comment_type?: string | null
          commenter_id?: string | null
          commenter_name?: string | null
          connection_id?: string | null
          created_at_facebook?: string | null
          id?: string
          language?: string | null
          message?: string
          org_id?: string | null
          parent_comment_id?: string | null
          post_id?: string
          received_at?: string | null
          sentiment?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fb_comments_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "meta_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fb_comments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fb_knowledge_base: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          is_active: boolean | null
          org_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          is_active?: boolean | null
          org_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          is_active?: boolean | null
          org_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fb_knowledge_base_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fb_replies: {
        Row: {
          comment_id: string | null
          confidence_score: number | null
          created_at: string | null
          draft_message: string
          facebook_reply_id: string | null
          final_message: string | null
          id: string
          model_used: string | null
          org_id: string | null
          posted_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          tokens_used: number | null
        }
        Insert: {
          comment_id?: string | null
          confidence_score?: number | null
          created_at?: string | null
          draft_message: string
          facebook_reply_id?: string | null
          final_message?: string | null
          id?: string
          model_used?: string | null
          org_id?: string | null
          posted_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          tokens_used?: number | null
        }
        Update: {
          comment_id?: string | null
          confidence_score?: number | null
          created_at?: string | null
          draft_message?: string
          facebook_reply_id?: string | null
          final_message?: string | null
          id?: string
          model_used?: string | null
          org_id?: string | null
          posted_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fb_replies_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "fb_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fb_replies_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fb_replies_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fb_reply_settings: {
        Row: {
          auto_reply: boolean | null
          connection_id: string | null
          created_at: string | null
          custom_system_prompt: string | null
          fallback_message: string | null
          id: string
          max_replies_per_day: number | null
          reply_delay_seconds: number | null
          reply_language: string | null
          reply_tone: string | null
          updated_at: string | null
          working_days: number[] | null
          working_hours_end: string | null
          working_hours_start: string | null
        }
        Insert: {
          auto_reply?: boolean | null
          connection_id?: string | null
          created_at?: string | null
          custom_system_prompt?: string | null
          fallback_message?: string | null
          id?: string
          max_replies_per_day?: number | null
          reply_delay_seconds?: number | null
          reply_language?: string | null
          reply_tone?: string | null
          updated_at?: string | null
          working_days?: number[] | null
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Update: {
          auto_reply?: boolean | null
          connection_id?: string | null
          created_at?: string | null
          custom_system_prompt?: string | null
          fallback_message?: string | null
          id?: string
          max_replies_per_day?: number | null
          reply_delay_seconds?: number | null
          reply_language?: string | null
          reply_tone?: string | null
          updated_at?: string | null
          working_days?: number[] | null
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fb_reply_settings_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "meta_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      fb_reply_usage: {
        Row: {
          id: string
          month: string
          org_id: string | null
          replies_limit: number | null
          replies_used: number | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          month: string
          org_id?: string | null
          replies_limit?: number | null
          replies_used?: number | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          month?: string
          org_id?: string | null
          replies_limit?: number | null
          replies_used?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fb_reply_usage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          description: string | null
          enabled: boolean
          key: string
          label: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          key: string
          label: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          enabled?: boolean
          key?: string
          label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      generated_posts: {
        Row: {
          additional_context: string | null
          alternative_versions: Json | null
          content_type: string | null
          created_at: string | null
          facebook_post_id: string | null
          generated_content: string
          id: string
          meta_page_id: string | null
          model_used: string | null
          org_id: string | null
          performance_prediction: Json | null
          published_at: string | null
          scheduled_at: string | null
          source_post_ids: string[] | null
          status: string | null
          tokens_used: number | null
          tone: string | null
          topic: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          additional_context?: string | null
          alternative_versions?: Json | null
          content_type?: string | null
          created_at?: string | null
          facebook_post_id?: string | null
          generated_content: string
          id?: string
          meta_page_id?: string | null
          model_used?: string | null
          org_id?: string | null
          performance_prediction?: Json | null
          published_at?: string | null
          scheduled_at?: string | null
          source_post_ids?: string[] | null
          status?: string | null
          tokens_used?: number | null
          tone?: string | null
          topic: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          additional_context?: string | null
          alternative_versions?: Json | null
          content_type?: string | null
          created_at?: string | null
          facebook_post_id?: string | null
          generated_content?: string
          id?: string
          meta_page_id?: string | null
          model_used?: string | null
          org_id?: string | null
          performance_prediction?: Json | null
          published_at?: string | null
          scheduled_at?: string | null
          source_post_ids?: string[] | null
          status?: string | null
          tokens_used?: number | null
          tone?: string | null
          topic?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_posts_meta_page_id_fkey"
            columns: ["meta_page_id"]
            isOneToOne: false
            referencedRelation: "meta_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_posts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          comment_ai_enabled: boolean | null
          comment_ai_settings: Json | null
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
          posts_indexed_count: number | null
          posts_last_indexed_at: string | null
          smart_generator_enabled: boolean | null
          status: string
          updated_at: string
          webhook_subscribed_at: string | null
        }
        Insert: {
          category?: string | null
          comment_ai_enabled?: boolean | null
          comment_ai_settings?: Json | null
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
          posts_indexed_count?: number | null
          posts_last_indexed_at?: string | null
          smart_generator_enabled?: boolean | null
          status?: string
          updated_at?: string
          webhook_subscribed_at?: string | null
        }
        Update: {
          category?: string | null
          comment_ai_enabled?: boolean | null
          comment_ai_settings?: Json | null
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
          posts_indexed_count?: number | null
          posts_last_indexed_at?: string | null
          smart_generator_enabled?: boolean | null
          status?: string
          updated_at?: string
          webhook_subscribed_at?: string | null
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
      organization_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role: string
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
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
            isOneToOne: false
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
      phyllo_creator_searches: {
        Row: {
          created_at: string | null
          follower_max: number | null
          follower_min: number | null
          id: string
          keywords: string | null
          organization_id: string
          result_count: number | null
          sort_field: string
          sort_order: string
          status: string
          work_platform_id: string
        }
        Insert: {
          created_at?: string | null
          follower_max?: number | null
          follower_min?: number | null
          id?: string
          keywords?: string | null
          organization_id: string
          result_count?: number | null
          sort_field?: string
          sort_order?: string
          status?: string
          work_platform_id: string
        }
        Update: {
          created_at?: string | null
          follower_max?: number | null
          follower_min?: number | null
          id?: string
          keywords?: string | null
          organization_id?: string
          result_count?: number | null
          sort_field?: string
          sort_order?: string
          status?: string
          work_platform_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phyllo_creator_searches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      phyllo_creators: {
        Row: {
          average_comments: number | null
          average_likes: number | null
          average_views: number | null
          created_at: string | null
          external_id: string | null
          follower_count: number | null
          full_name: string | null
          id: string
          is_verified: boolean | null
          organization_id: string
          platform_username: string | null
          profile_pic_url: string | null
          raw_data: Json | null
          search_id: string
          url: string | null
          work_platform_id: string
        }
        Insert: {
          average_comments?: number | null
          average_likes?: number | null
          average_views?: number | null
          created_at?: string | null
          external_id?: string | null
          follower_count?: number | null
          full_name?: string | null
          id?: string
          is_verified?: boolean | null
          organization_id: string
          platform_username?: string | null
          profile_pic_url?: string | null
          raw_data?: Json | null
          search_id: string
          url?: string | null
          work_platform_id: string
        }
        Update: {
          average_comments?: number | null
          average_likes?: number | null
          average_views?: number | null
          created_at?: string | null
          external_id?: string | null
          follower_count?: number | null
          full_name?: string | null
          id?: string
          is_verified?: boolean | null
          organization_id?: string
          platform_username?: string | null
          profile_pic_url?: string | null
          raw_data?: Json | null
          search_id?: string
          url?: string | null
          work_platform_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phyllo_creators_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phyllo_creators_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "phyllo_creator_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      phyllo_hashtag_trends: {
        Row: {
          avg_engagement_rate: number | null
          created_at: string
          hashtag: string
          id: string
          organization_id: string
          platform: string
          post_count: number | null
          snapshot_at: string
          top_content: Json | null
          total_engagement: number | null
        }
        Insert: {
          avg_engagement_rate?: number | null
          created_at?: string
          hashtag: string
          id?: string
          organization_id: string
          platform: string
          post_count?: number | null
          snapshot_at?: string
          top_content?: Json | null
          total_engagement?: number | null
        }
        Update: {
          avg_engagement_rate?: number | null
          created_at?: string
          hashtag?: string
          id?: string
          organization_id?: string
          platform?: string
          post_count?: number | null
          snapshot_at?: string
          top_content?: Json | null
          total_engagement?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "phyllo_hashtag_trends_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      phyllo_saved_creators: {
        Row: {
          created_at: string | null
          creator_id: string
          id: string
          note: string | null
          organization_id: string
        }
        Insert: {
          created_at?: string | null
          creator_id: string
          id?: string
          note?: string | null
          organization_id: string
        }
        Update: {
          created_at?: string | null
          creator_id?: string
          id?: string
          note?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phyllo_saved_creators_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "phyllo_creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phyllo_saved_creators_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      phyllo_search_results: {
        Row: {
          comment_count: number | null
          content_id: string | null
          created_at: string
          creator_followers: number | null
          creator_handle: string | null
          creator_name: string | null
          description: string | null
          engagement_rate: number | null
          id: string
          like_count: number | null
          platform: string
          published_at: string | null
          raw_data: Json | null
          search_id: string
          share_count: number | null
          thumbnail_url: string | null
          title: string | null
          url: string | null
          view_count: number | null
        }
        Insert: {
          comment_count?: number | null
          content_id?: string | null
          created_at?: string
          creator_followers?: number | null
          creator_handle?: string | null
          creator_name?: string | null
          description?: string | null
          engagement_rate?: number | null
          id?: string
          like_count?: number | null
          platform: string
          published_at?: string | null
          raw_data?: Json | null
          search_id: string
          share_count?: number | null
          thumbnail_url?: string | null
          title?: string | null
          url?: string | null
          view_count?: number | null
        }
        Update: {
          comment_count?: number | null
          content_id?: string | null
          created_at?: string
          creator_followers?: number | null
          creator_handle?: string | null
          creator_name?: string | null
          description?: string | null
          engagement_rate?: number | null
          id?: string
          like_count?: number | null
          platform?: string
          published_at?: string | null
          raw_data?: Json | null
          search_id?: string
          share_count?: number | null
          thumbnail_url?: string | null
          title?: string | null
          url?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "phyllo_search_results_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "phyllo_social_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      phyllo_social_searches: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          organization_id: string
          phyllo_search_id: string | null
          query: string
          result_count: number | null
          search_type: string
          status: string
          updated_at: string
          work_platform_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          organization_id: string
          phyllo_search_id?: string | null
          query: string
          result_count?: number | null
          search_type: string
          status?: string
          updated_at?: string
          work_platform_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          organization_id?: string
          phyllo_search_id?: string | null
          query?: string
          result_count?: number | null
          search_type?: string
          status?: string
          updated_at?: string
          work_platform_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phyllo_social_searches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          brainstorm_credits_monthly: number
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
          brainstorm_credits_monthly?: number
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
          brainstorm_credits_monthly?: number
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
      post_embeddings: {
        Row: {
          comments: number | null
          content: string
          content_type: string | null
          created_at: string | null
          embedding: string | null
          engagement_rate: number | null
          engagement_score: number | null
          id: string
          language: string | null
          likes: number | null
          meta_page_id: string | null
          org_id: string | null
          post_id: string
          posted_at: string | null
          reach: number | null
          shares: number | null
        }
        Insert: {
          comments?: number | null
          content: string
          content_type?: string | null
          created_at?: string | null
          embedding?: string | null
          engagement_rate?: number | null
          engagement_score?: number | null
          id?: string
          language?: string | null
          likes?: number | null
          meta_page_id?: string | null
          org_id?: string | null
          post_id: string
          posted_at?: string | null
          reach?: number | null
          shares?: number | null
        }
        Update: {
          comments?: number | null
          content?: string
          content_type?: string | null
          created_at?: string | null
          embedding?: string | null
          engagement_rate?: number | null
          engagement_score?: number | null
          id?: string
          language?: string | null
          likes?: number | null
          meta_page_id?: string | null
          org_id?: string | null
          post_id?: string
          posted_at?: string | null
          reach?: number | null
          shares?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_embeddings_meta_page_id_fkey"
            columns: ["meta_page_id"]
            isOneToOne: false
            referencedRelation: "meta_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_embeddings_org_id_fkey"
            columns: ["org_id"]
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
          id: string
          tos_accepted_at: string | null
          tos_accepted_ip: string | null
          tos_version: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          tos_accepted_at?: string | null
          tos_accepted_ip?: string | null
          tos_version?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          tos_accepted_at?: string | null
          tos_accepted_ip?: string | null
          tos_version?: string | null
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
      user_passkeys: {
        Row: {
          backed_up: boolean
          counter: number
          created_at: string
          credential_id: string
          device_type: string | null
          friendly_name: string | null
          id: string
          last_used_at: string | null
          public_key: string
          transports: string[] | null
          user_id: string
        }
        Insert: {
          backed_up?: boolean
          counter?: number
          created_at?: string
          credential_id: string
          device_type?: string | null
          friendly_name?: string | null
          id?: string
          last_used_at?: string | null
          public_key: string
          transports?: string[] | null
          user_id: string
        }
        Update: {
          backed_up?: boolean
          counter?: number
          created_at?: string
          credential_id?: string
          device_type?: string | null
          friendly_name?: string | null
          id?: string
          last_used_at?: string | null
          public_key?: string
          transports?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_passkeys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      webauthn_challenges: {
        Row: {
          challenge: string
          created_at: string
          email: string | null
          expires_at: string
          id: string
          purpose: string
          user_id: string | null
        }
        Insert: {
          challenge: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          purpose: string
          user_id?: string | null
        }
        Update: {
          challenge?: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          purpose?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webauthn_challenges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_organization_invitation: {
        Args: { p_token: string }
        Returns: {
          organization_id: string
          organization_name: string
        }[]
      }
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
      list_my_sessions: {
        Args: never
        Returns: {
          created_at: string
          factor_id: string
          id: string
          ip: string
          not_after: string
          refreshed_at: string
          updated_at: string
          user_agent: string
        }[]
      }
      recalculate_brand_manager_score: {
        Args: { p_brand_manager_id: string }
        Returns: undefined
      }
      release_quota: {
        Args: {
          p_metric_key: string
          p_organization_id: string
          p_period_key: string
        }
        Returns: undefined
      }
      reserve_quota: {
        Args: {
          p_limit: number
          p_metric_key: string
          p_organization_id: string
          p_period_key: string
        }
        Returns: boolean
      }
      revoke_my_session: { Args: { p_session_id: string }; Returns: boolean }
      search_similar_posts: {
        Args: {
          p_embedding: string
          p_limit?: number
          p_min_engagement?: number
          p_org_id: string
        }
        Returns: {
          comments: number
          content: string
          content_type: string
          engagement_rate: number
          engagement_score: number
          id: string
          likes: number
          post_id: string
          posted_at: string
          reach: number
          shares: number
          similarity: number
        }[]
      }
      set_meta_page_selected: {
        Args: {
          target_meta_page_id: string
          target_org_id: string
          target_selected: boolean
        }
        Returns: boolean
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
