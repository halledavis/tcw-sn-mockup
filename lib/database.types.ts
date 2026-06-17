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
      app_user: {
        Row: {
          created_at: string
          department_access: Json | null
          email: string
          entity_id: string
          first_name: string
          id: string
          last_name: string
          location_access: Json | null
          role: Database["public"]["Enums"]["app_user_role"]
          status: Database["public"]["Enums"]["app_user_status"]
        }
        Insert: {
          created_at?: string
          department_access?: Json | null
          email: string
          entity_id: string
          first_name: string
          id?: string
          last_name: string
          location_access?: Json | null
          role: Database["public"]["Enums"]["app_user_role"]
          status?: Database["public"]["Enums"]["app_user_status"]
        }
        Update: {
          created_at?: string
          department_access?: Json | null
          email?: string
          entity_id?: string
          first_name?: string
          id?: string
          last_name?: string
          location_access?: Json | null
          role?: Database["public"]["Enums"]["app_user_role"]
          status?: Database["public"]["Enums"]["app_user_status"]
        }
        Relationships: [
          {
            foreignKeyName: "app_user_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_card: {
        Row: {
          created_at: string
          entity_id: string
          id: string
          markup_pct: number | null
          risk_tier_id: string | null
          service_type: Database["public"]["Enums"]["bill_card_service_type"]
          states: Json
          status: Database["public"]["Enums"]["bill_card_status"]
        }
        Insert: {
          created_at?: string
          entity_id: string
          id?: string
          markup_pct?: number | null
          risk_tier_id?: string | null
          service_type: Database["public"]["Enums"]["bill_card_service_type"]
          states?: Json
          status?: Database["public"]["Enums"]["bill_card_status"]
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          markup_pct?: number | null
          risk_tier_id?: string | null
          service_type?: Database["public"]["Enums"]["bill_card_service_type"]
          states?: Json
          status?: Database["public"]["Enums"]["bill_card_status"]
        }
        Relationships: [
          {
            foreignKeyName: "bill_card_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_card_risk_tier_id_fkey"
            columns: ["risk_tier_id"]
            isOneToOne: false
            referencedRelation: "risk_tier"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_rate_rule: {
        Row: {
          bill_rate: number | null
          billing_model: Database["public"]["Enums"]["billing_model"]
          created_at: string
          entity_id: string | null
          id: string
          markup_pct: number | null
          priority: number
          scope_level: Database["public"]["Enums"]["scope_level"]
          scope_ref: string | null
          when_conditions: Json | null
        }
        Insert: {
          bill_rate?: number | null
          billing_model: Database["public"]["Enums"]["billing_model"]
          created_at?: string
          entity_id?: string | null
          id?: string
          markup_pct?: number | null
          priority?: number
          scope_level: Database["public"]["Enums"]["scope_level"]
          scope_ref?: string | null
          when_conditions?: Json | null
        }
        Update: {
          bill_rate?: number | null
          billing_model?: Database["public"]["Enums"]["billing_model"]
          created_at?: string
          entity_id?: string | null
          id?: string
          markup_pct?: number | null
          priority?: number
          scope_level?: Database["public"]["Enums"]["scope_level"]
          scope_ref?: string | null
          when_conditions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_rate_rule_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
        ]
      }
      client_country_scope: {
        Row: {
          addendum_ref: string | null
          addendum_status: Database["public"]["Enums"]["addendum_status"]
          country_code: string
          created_at: string
          entity_id: string
          id: string
        }
        Insert: {
          addendum_ref?: string | null
          addendum_status?: Database["public"]["Enums"]["addendum_status"]
          country_code: string
          created_at?: string
          entity_id: string
          id?: string
        }
        Update: {
          addendum_ref?: string | null
          addendum_status?: Database["public"]["Enums"]["addendum_status"]
          country_code?: string
          created_at?: string
          entity_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_country_scope_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
        ]
      }
      client_job_title: {
        Row: {
          ai_rationale: string | null
          blurb: string | null
          clarifications: Json
          created_at: string
          entity_id: string
          id: string
          needs_review: boolean
          risk_tier_id: string | null
          status: Database["public"]["Enums"]["job_title_status"]
          title: string
        }
        Insert: {
          ai_rationale?: string | null
          blurb?: string | null
          clarifications?: Json
          created_at?: string
          entity_id: string
          id?: string
          needs_review?: boolean
          risk_tier_id?: string | null
          status?: Database["public"]["Enums"]["job_title_status"]
          title: string
        }
        Update: {
          ai_rationale?: string | null
          blurb?: string | null
          clarifications?: Json
          created_at?: string
          entity_id?: string
          id?: string
          needs_review?: boolean
          risk_tier_id?: string | null
          status?: Database["public"]["Enums"]["job_title_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_job_title_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_job_title_risk_tier_id_fkey"
            columns: ["risk_tier_id"]
            isOneToOne: false
            referencedRelation: "risk_tier"
            referencedColumns: ["id"]
          },
        ]
      }
      client_subdivision_scope: {
        Row: {
          country_code: string
          created_at: string
          entity_id: string
          id: string
          subdivision_code: string
          subdivision_type: Database["public"]["Enums"]["subdivision_type"]
        }
        Insert: {
          country_code: string
          created_at?: string
          entity_id: string
          id?: string
          subdivision_code: string
          subdivision_type: Database["public"]["Enums"]["subdivision_type"]
        }
        Update: {
          country_code?: string
          created_at?: string
          entity_id?: string
          id?: string
          subdivision_code?: string
          subdivision_type?: Database["public"]["Enums"]["subdivision_type"]
        }
        Relationships: [
          {
            foreignKeyName: "client_subdivision_scope_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
        ]
      }
      department: {
        Row: {
          created_at: string
          entity_id: string
          id: string
          internal_id: string | null
          name: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          id?: string
          internal_id?: string | null
          name: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          internal_id?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
        ]
      }
      entity: {
        Row: {
          address: Json | null
          created_at: string
          dba_name: string | null
          default_currency: string | null
          default_eor_id: string | null
          description: string | null
          duns: string | null
          fein: string | null
          id: string
          is_billable_entity: boolean
          is_billing_entity: boolean
          is_default_eor: boolean
          kind: Database["public"]["Enums"]["entity_kind"]
          legal_name: string
          logo_url: string | null
          parent_id: string | null
          status: Database["public"]["Enums"]["entity_status"]
          website: string | null
        }
        Insert: {
          address?: Json | null
          created_at?: string
          dba_name?: string | null
          default_currency?: string | null
          default_eor_id?: string | null
          description?: string | null
          duns?: string | null
          fein?: string | null
          id?: string
          is_billable_entity?: boolean
          is_billing_entity?: boolean
          is_default_eor?: boolean
          kind: Database["public"]["Enums"]["entity_kind"]
          legal_name: string
          logo_url?: string | null
          parent_id?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          website?: string | null
        }
        Update: {
          address?: Json | null
          created_at?: string
          dba_name?: string | null
          default_currency?: string | null
          default_eor_id?: string | null
          description?: string | null
          duns?: string | null
          fein?: string | null
          id?: string
          is_billable_entity?: boolean
          is_billing_entity?: boolean
          is_default_eor?: boolean
          kind?: Database["public"]["Enums"]["entity_kind"]
          legal_name?: string
          logo_url?: string | null
          parent_id?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_default_eor_id_fkey"
            columns: ["default_eor_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_config_status: {
        Row: {
          config_key: string
          entity_id: string
          id: string
          status: Database["public"]["Enums"]["config_status"]
          updated_at: string
        }
        Insert: {
          config_key: string
          entity_id: string
          id?: string
          status?: Database["public"]["Enums"]["config_status"]
          updated_at?: string
        }
        Update: {
          config_key?: string
          entity_id?: string
          id?: string
          status?: Database["public"]["Enums"]["config_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_config_status_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_contact: {
        Row: {
          created_at: string
          email: string
          entity_id: string
          first_name: string
          id: string
          kind: Database["public"]["Enums"]["contact_kind"]
          last_name: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          email: string
          entity_id: string
          first_name: string
          id?: string
          kind: Database["public"]["Enums"]["contact_kind"]
          last_name: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          entity_id?: string
          first_name?: string
          id?: string
          kind?: Database["public"]["Enums"]["contact_kind"]
          last_name?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_contact_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_module: {
        Row: {
          created_at: string
          enabled: boolean
          entity_id: string
          id: string
          module_id: string
          source: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          entity_id: string
          id?: string
          module_id: string
          source?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          entity_id?: string
          id?: string
          module_id?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_module_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_module_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "module"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_service: {
        Row: {
          created_at: string
          entity_id: string
          id: string
          service_id: string
          source: Database["public"]["Enums"]["entity_service_source"]
          status: Database["public"]["Enums"]["entity_service_status"]
        }
        Insert: {
          created_at?: string
          entity_id: string
          id?: string
          service_id: string
          source?: Database["public"]["Enums"]["entity_service_source"]
          status?: Database["public"]["Enums"]["entity_service_status"]
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          service_id?: string
          source?: Database["public"]["Enums"]["entity_service_source"]
          status?: Database["public"]["Enums"]["entity_service_status"]
        }
        Relationships: [
          {
            foreignKeyName: "entity_service_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_service_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_session: {
        Row: {
          brief: string | null
          created_at: string
          entity_id: string | null
          id: string
          inferred_signals: Json | null
          persona: Database["public"]["Enums"]["intake_persona"]
          status: Database["public"]["Enums"]["intake_status"]
          transcript: Json | null
        }
        Insert: {
          brief?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          inferred_signals?: Json | null
          persona: Database["public"]["Enums"]["intake_persona"]
          status?: Database["public"]["Enums"]["intake_status"]
          transcript?: Json | null
        }
        Update: {
          brief?: string | null
          created_at?: string
          entity_id?: string | null
          id?: string
          inferred_signals?: Json | null
          persona?: Database["public"]["Enums"]["intake_persona"]
          status?: Database["public"]["Enums"]["intake_status"]
          transcript?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "intake_session_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
        ]
      }
      jd: {
        Row: {
          created_at: string
          entity_id: string
          id: string
          job_category: string | null
          overview: string | null
          parent_jd_id: string | null
          pay_rate: number | null
          pay_rate_max: number | null
          pay_rate_min: number | null
          pay_type: Database["public"]["Enums"]["pay_type"]
          requirements: string | null
          responsibilities: string | null
          risk_tier_id: string | null
          risk_tier_status: Database["public"]["Enums"]["jd_risk_status"] | null
          soc_code: string | null
          status: Database["public"]["Enums"]["jd_status"]
          title: string
          version: number
        }
        Insert: {
          created_at?: string
          entity_id: string
          id?: string
          job_category?: string | null
          overview?: string | null
          parent_jd_id?: string | null
          pay_rate?: number | null
          pay_rate_max?: number | null
          pay_rate_min?: number | null
          pay_type: Database["public"]["Enums"]["pay_type"]
          requirements?: string | null
          responsibilities?: string | null
          risk_tier_id?: string | null
          risk_tier_status?:
            | Database["public"]["Enums"]["jd_risk_status"]
            | null
          soc_code?: string | null
          status?: Database["public"]["Enums"]["jd_status"]
          title: string
          version?: number
        }
        Update: {
          created_at?: string
          entity_id?: string
          id?: string
          job_category?: string | null
          overview?: string | null
          parent_jd_id?: string | null
          pay_rate?: number | null
          pay_rate_max?: number | null
          pay_rate_min?: number | null
          pay_type?: Database["public"]["Enums"]["pay_type"]
          requirements?: string | null
          responsibilities?: string | null
          risk_tier_id?: string | null
          risk_tier_status?:
            | Database["public"]["Enums"]["jd_risk_status"]
            | null
          soc_code?: string | null
          status?: Database["public"]["Enums"]["jd_status"]
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "jd_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jd_parent_jd_id_fkey"
            columns: ["parent_jd_id"]
            isOneToOne: false
            referencedRelation: "jd"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jd_risk_tier_id_fkey"
            columns: ["risk_tier_id"]
            isOneToOne: false
            referencedRelation: "risk_tier"
            referencedColumns: ["id"]
          },
        ]
      }
      job: {
        Row: {
          bill_rate: number | null
          billing_entity_id: string | null
          created_at: string
          end_date: string | null
          id: string
          jd_version_id: string | null
          job_order_id: string
          pay_rate: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["job_status"]
          worker_user_id: string
        }
        Insert: {
          bill_rate?: number | null
          billing_entity_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          jd_version_id?: string | null
          job_order_id: string
          pay_rate?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          worker_user_id: string
        }
        Update: {
          bill_rate?: number | null
          billing_entity_id?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          jd_version_id?: string | null
          job_order_id?: string
          pay_rate?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          worker_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_billing_entity_id_fkey"
            columns: ["billing_entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_jd_version_id_fkey"
            columns: ["jd_version_id"]
            isOneToOne: false
            referencedRelation: "jd"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_job_order_id_fkey"
            columns: ["job_order_id"]
            isOneToOne: false
            referencedRelation: "job_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_worker_user_id_fkey"
            columns: ["worker_user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      job_order: {
        Row: {
          bill_rate: number | null
          billing_entity_id: string | null
          billing_model: Database["public"]["Enums"]["billing_model"] | null
          candidate_known: boolean | null
          client_job_title_id: string | null
          created_at: string
          department_id: string | null
          duration_unit: Database["public"]["Enums"]["duration_unit"] | null
          duration_value: number | null
          end_date: string | null
          entity_id: string
          fill_source: Database["public"]["Enums"]["fill_source"] | null
          flow_type: Database["public"]["Enums"]["flow_type"]
          fulfillment_type:
            | Database["public"]["Enums"]["fulfillment_type"]
            | null
          hours_type: Database["public"]["Enums"]["hours_type"] | null
          id: string
          jd_id: string | null
          location: string | null
          markup_pct: number | null
          num_workers: number
          reporting_location_id: string | null
          source_type: Database["public"]["Enums"]["source_type"]
          sow_ref: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["job_order_status"]
          sub_entity_id: string | null
          submitted_by: string | null
          weekly_hours: number | null
          work_arrangement:
            | Database["public"]["Enums"]["work_arrangement"]
            | null
        }
        Insert: {
          bill_rate?: number | null
          billing_entity_id?: string | null
          billing_model?: Database["public"]["Enums"]["billing_model"] | null
          candidate_known?: boolean | null
          client_job_title_id?: string | null
          created_at?: string
          department_id?: string | null
          duration_unit?: Database["public"]["Enums"]["duration_unit"] | null
          duration_value?: number | null
          end_date?: string | null
          entity_id: string
          fill_source?: Database["public"]["Enums"]["fill_source"] | null
          flow_type: Database["public"]["Enums"]["flow_type"]
          fulfillment_type?:
            | Database["public"]["Enums"]["fulfillment_type"]
            | null
          hours_type?: Database["public"]["Enums"]["hours_type"] | null
          id?: string
          jd_id?: string | null
          location?: string | null
          markup_pct?: number | null
          num_workers?: number
          reporting_location_id?: string | null
          source_type: Database["public"]["Enums"]["source_type"]
          sow_ref?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["job_order_status"]
          sub_entity_id?: string | null
          submitted_by?: string | null
          weekly_hours?: number | null
          work_arrangement?:
            | Database["public"]["Enums"]["work_arrangement"]
            | null
        }
        Update: {
          bill_rate?: number | null
          billing_entity_id?: string | null
          billing_model?: Database["public"]["Enums"]["billing_model"] | null
          candidate_known?: boolean | null
          client_job_title_id?: string | null
          created_at?: string
          department_id?: string | null
          duration_unit?: Database["public"]["Enums"]["duration_unit"] | null
          duration_value?: number | null
          end_date?: string | null
          entity_id?: string
          fill_source?: Database["public"]["Enums"]["fill_source"] | null
          flow_type?: Database["public"]["Enums"]["flow_type"]
          fulfillment_type?:
            | Database["public"]["Enums"]["fulfillment_type"]
            | null
          hours_type?: Database["public"]["Enums"]["hours_type"] | null
          id?: string
          jd_id?: string | null
          location?: string | null
          markup_pct?: number | null
          num_workers?: number
          reporting_location_id?: string | null
          source_type?: Database["public"]["Enums"]["source_type"]
          sow_ref?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["job_order_status"]
          sub_entity_id?: string | null
          submitted_by?: string | null
          weekly_hours?: number | null
          work_arrangement?:
            | Database["public"]["Enums"]["work_arrangement"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "job_order_billing_entity_id_fkey"
            columns: ["billing_entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_order_client_job_title_id_fkey"
            columns: ["client_job_title_id"]
            isOneToOne: false
            referencedRelation: "client_job_title"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_order_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_order_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_order_jd_id_fkey"
            columns: ["jd_id"]
            isOneToOne: false
            referencedRelation: "jd"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_order_reporting_location_id_fkey"
            columns: ["reporting_location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_order_sub_entity_id_fkey"
            columns: ["sub_entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_order_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      location: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          entity_id: string
          id: string
          internal_id: string | null
          is_primary: boolean
          name: string | null
          postal: string | null
          state: string | null
          street: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          entity_id: string
          id?: string
          internal_id?: string | null
          is_primary?: boolean
          name?: string | null
          postal?: string | null
          state?: string | null
          street?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          entity_id?: string
          id?: string
          internal_id?: string | null
          is_primary?: boolean
          name?: string | null
          postal?: string | null
          state?: string | null
          street?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
        ]
      }
      module: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      pay_rate_rule: {
        Row: {
          created_at: string
          entity_id: string | null
          id: string
          pay_rate: number
          pay_type: Database["public"]["Enums"]["pay_type"]
          priority: number
          scope_level: Database["public"]["Enums"]["scope_level"]
          scope_ref: string | null
          when_conditions: Json | null
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          id?: string
          pay_rate: number
          pay_type: Database["public"]["Enums"]["pay_type"]
          priority?: number
          scope_level: Database["public"]["Enums"]["scope_level"]
          scope_ref?: string | null
          when_conditions?: Json | null
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          id?: string
          pay_rate?: number
          pay_type?: Database["public"]["Enums"]["pay_type"]
          priority?: number
          scope_level?: Database["public"]["Enums"]["scope_level"]
          scope_ref?: string | null
          when_conditions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "pay_rate_rule_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entity"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_tier: {
        Row: {
          code: string
          created_at: string
          default_markup_pct: number | null
          description: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          default_markup_pct?: number | null
          description?: string | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          default_markup_pct?: number | null
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      service: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      service_module: {
        Row: {
          created_at: string
          id: string
          module_id: string
          service_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          module_id: string
          service_id: string
        }
        Update: {
          created_at?: string
          id?: string
          module_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_module_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "module"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_module_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_client_from_intake: {
        Args: {
          p_address: Json
          p_brief: string
          p_contacts: Json
          p_currency: string
          p_dba: string
          p_description: string
          p_duns: string
          p_fein: string
          p_inferred_signals: Json
          p_legal_name: string
          p_logo_url: string
          p_persona: Database["public"]["Enums"]["intake_persona"]
          p_service_codes: string[]
          p_sources: Json
          p_transcript: Json
          p_website: string
        }
        Returns: string
      }
      create_prospect_from_intake: {
        Args: {
          p_brief: string
          p_inferred_signals: Json
          p_legal_name: string
          p_persona: Database["public"]["Enums"]["intake_persona"]
          p_service_codes: string[]
          p_sources: Json
          p_transcript: Json
        }
        Returns: string
      }
      derive_bill_cards: {
        Args: {
          p_entity_id: string
          p_service_type: Database["public"]["Enums"]["bill_card_service_type"]
        }
        Returns: {
          created_at: string
          entity_id: string
          id: string
          markup_pct: number | null
          risk_tier_id: string | null
          service_type: Database["public"]["Enums"]["bill_card_service_type"]
          states: Json
          status: Database["public"]["Enums"]["bill_card_status"]
        }[]
        SetofOptions: {
          from: "*"
          to: "bill_card"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      enable_globalized_compliance: {
        Args: { p_entity_id: string }
        Returns: undefined
      }
      save_job_titles: {
        Args: { p_entity_id: string; p_titles: Json }
        Returns: {
          ai_rationale: string | null
          blurb: string | null
          clarifications: Json
          created_at: string
          entity_id: string
          id: string
          needs_review: boolean
          risk_tier_id: string | null
          status: Database["public"]["Enums"]["job_title_status"]
          title: string
        }[]
        SetofOptions: {
          from: "*"
          to: "client_job_title"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      save_scope_and_org: {
        Args: {
          p_countries: Json
          p_departments: Json
          p_entity_id: string
          p_locations: Json
          p_subdivisions: Json
        }
        Returns: Json
      }
    }
    Enums: {
      addendum_status:
        | "not_applicable"
        | "pending"
        | "draft"
        | "sent"
        | "signed"
      app_user_role:
        | "admin"
        | "hiring_manager"
        | "recruiter"
        | "supplier_admin"
        | "eor_admin"
        | "worker"
      app_user_status: "active" | "inactive" | "invited"
      bill_card_service_type: "eor" | "staffing" | "vms"
      bill_card_status: "draft" | "active"
      billing_model: "markup" | "bill_rate"
      config_status: "not_started" | "completed" | "skipped"
      contact_kind: "signatory" | "primary"
      duration_unit: "days" | "weeks" | "months" | "years"
      entity_kind: "client" | "tcw" | "eor" | "agency" | "vendor" | "msp"
      entity_service_source: "ai" | "manual"
      entity_service_status: "recommended" | "selected" | "active"
      entity_status: "active" | "inactive" | "prospect"
      fill_source:
        | "self_pending"
        | "self_known"
        | "staffing_outside"
        | "staffing_kickoff"
      flow_type: "worker" | "supplier"
      fulfillment_type: "agent" | "worker" | "project"
      hours_type: "fixed" | "variable"
      intake_persona: "cra" | "prospect"
      intake_status: "in_progress" | "completed" | "confirmed"
      jd_risk_status: "ai_estimated" | "confirmed" | "needs_review"
      jd_status: "draft" | "pending" | "approved"
      job_order_status:
        | "open"
        | "partially_filled"
        | "filled"
        | "closed"
        | "cancelled"
        | "draft"
      job_status: "offered" | "active" | "ended"
      job_title_status: "ai_suggested" | "confirmed" | "needs_review"
      pay_type: "hourly" | "salary"
      scope_level:
        | "system"
        | "operator"
        | "client"
        | "location_dept"
        | "jd"
        | "order"
      source_type: "self_sourced" | "externally_sourced" | "outside_sn"
      subdivision_type: "state" | "province"
      work_arrangement: "onsite" | "remote" | "hybrid" | "open"
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
      addendum_status: ["not_applicable", "pending", "draft", "sent", "signed"],
      app_user_role: [
        "admin",
        "hiring_manager",
        "recruiter",
        "supplier_admin",
        "eor_admin",
        "worker",
      ],
      app_user_status: ["active", "inactive", "invited"],
      bill_card_service_type: ["eor", "staffing", "vms"],
      bill_card_status: ["draft", "active"],
      billing_model: ["markup", "bill_rate"],
      config_status: ["not_started", "completed", "skipped"],
      contact_kind: ["signatory", "primary"],
      duration_unit: ["days", "weeks", "months", "years"],
      entity_kind: ["client", "tcw", "eor", "agency", "vendor", "msp"],
      entity_service_source: ["ai", "manual"],
      entity_service_status: ["recommended", "selected", "active"],
      entity_status: ["active", "inactive", "prospect"],
      fill_source: [
        "self_pending",
        "self_known",
        "staffing_outside",
        "staffing_kickoff",
      ],
      flow_type: ["worker", "supplier"],
      fulfillment_type: ["agent", "worker", "project"],
      hours_type: ["fixed", "variable"],
      intake_persona: ["cra", "prospect"],
      intake_status: ["in_progress", "completed", "confirmed"],
      jd_risk_status: ["ai_estimated", "confirmed", "needs_review"],
      jd_status: ["draft", "pending", "approved"],
      job_order_status: [
        "open",
        "partially_filled",
        "filled",
        "closed",
        "cancelled",
        "draft",
      ],
      job_status: ["offered", "active", "ended"],
      job_title_status: ["ai_suggested", "confirmed", "needs_review"],
      pay_type: ["hourly", "salary"],
      scope_level: [
        "system",
        "operator",
        "client",
        "location_dept",
        "jd",
        "order",
      ],
      source_type: ["self_sourced", "externally_sourced", "outside_sn"],
      subdivision_type: ["state", "province"],
      work_arrangement: ["onsite", "remote", "hybrid", "open"],
    },
  },
} as const
