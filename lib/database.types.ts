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
      entity: {
        Row: {
          address: Json | null
          created_at: string
          dba_name: string | null
          default_eor_id: string | null
          id: string
          is_billable_entity: boolean
          is_billing_entity: boolean
          is_default_eor: boolean
          kind: Database["public"]["Enums"]["entity_kind"]
          legal_name: string
          parent_id: string | null
          status: Database["public"]["Enums"]["entity_status"]
        }
        Insert: {
          address?: Json | null
          created_at?: string
          dba_name?: string | null
          default_eor_id?: string | null
          id?: string
          is_billable_entity?: boolean
          is_billing_entity?: boolean
          is_default_eor?: boolean
          kind: Database["public"]["Enums"]["entity_kind"]
          legal_name: string
          parent_id?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
        }
        Update: {
          address?: Json | null
          created_at?: string
          dba_name?: string | null
          default_eor_id?: string | null
          id?: string
          is_billable_entity?: boolean
          is_billing_entity?: boolean
          is_default_eor?: boolean
          kind?: Database["public"]["Enums"]["entity_kind"]
          legal_name?: string
          parent_id?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
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
          created_at: string
          end_date: string | null
          entity_id: string
          flow_type: Database["public"]["Enums"]["flow_type"]
          id: string
          jd_id: string | null
          location: string | null
          markup_pct: number | null
          num_workers: number
          source_type: Database["public"]["Enums"]["source_type"]
          sow_ref: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["job_order_status"]
          sub_entity_id: string | null
          submitted_by: string | null
        }
        Insert: {
          bill_rate?: number | null
          billing_entity_id?: string | null
          billing_model?: Database["public"]["Enums"]["billing_model"] | null
          created_at?: string
          end_date?: string | null
          entity_id: string
          flow_type: Database["public"]["Enums"]["flow_type"]
          id?: string
          jd_id?: string | null
          location?: string | null
          markup_pct?: number | null
          num_workers?: number
          source_type: Database["public"]["Enums"]["source_type"]
          sow_ref?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["job_order_status"]
          sub_entity_id?: string | null
          submitted_by?: string | null
        }
        Update: {
          bill_rate?: number | null
          billing_entity_id?: string | null
          billing_model?: Database["public"]["Enums"]["billing_model"] | null
          created_at?: string
          end_date?: string | null
          entity_id?: string
          flow_type?: Database["public"]["Enums"]["flow_type"]
          id?: string
          jd_id?: string | null
          location?: string | null
          markup_pct?: number | null
          num_workers?: number
          source_type?: Database["public"]["Enums"]["source_type"]
          sow_ref?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["job_order_status"]
          sub_entity_id?: string | null
          submitted_by?: string | null
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
    }
    Enums: {
      app_user_role:
        | "admin"
        | "hiring_manager"
        | "recruiter"
        | "supplier_admin"
        | "eor_admin"
        | "worker"
      app_user_status: "active" | "inactive" | "invited"
      billing_model: "markup" | "bill_rate"
      entity_kind: "client" | "tcw" | "eor" | "agency" | "vendor" | "msp"
      entity_service_source: "ai" | "manual"
      entity_service_status: "recommended" | "selected" | "active"
      entity_status: "active" | "inactive" | "prospect"
      flow_type: "worker" | "supplier"
      intake_persona: "cra" | "prospect"
      intake_status: "in_progress" | "completed" | "confirmed"
      jd_status: "draft" | "pending" | "approved"
      job_order_status:
        | "open"
        | "partially_filled"
        | "filled"
        | "closed"
        | "cancelled"
      job_status: "offered" | "active" | "ended"
      pay_type: "hourly" | "salary"
      scope_level:
        | "system"
        | "operator"
        | "client"
        | "location_dept"
        | "jd"
        | "order"
      source_type: "self_sourced" | "externally_sourced" | "outside_sn"
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
      app_user_role: [
        "admin",
        "hiring_manager",
        "recruiter",
        "supplier_admin",
        "eor_admin",
        "worker",
      ],
      app_user_status: ["active", "inactive", "invited"],
      billing_model: ["markup", "bill_rate"],
      entity_kind: ["client", "tcw", "eor", "agency", "vendor", "msp"],
      entity_service_source: ["ai", "manual"],
      entity_service_status: ["recommended", "selected", "active"],
      entity_status: ["active", "inactive", "prospect"],
      flow_type: ["worker", "supplier"],
      intake_persona: ["cra", "prospect"],
      intake_status: ["in_progress", "completed", "confirmed"],
      jd_status: ["draft", "pending", "approved"],
      job_order_status: [
        "open",
        "partially_filled",
        "filled",
        "closed",
        "cancelled",
      ],
      job_status: ["offered", "active", "ended"],
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
    },
  },
} as const
