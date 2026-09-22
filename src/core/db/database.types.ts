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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      boutiques: {
        Row: {
          address: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          kind: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      contract_types: {
        Row: {
          code: string
          created_at: string
          id: string
          is_apprenticeship: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_apprenticeship?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_apprenticeship?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      domain_events: {
        Row: {
          actor_id: string | null
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          payload: Json
          processed_at: string | null
          type: string
        }
        Insert: {
          actor_id?: string | null
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          type: string
        }
        Update: {
          actor_id?: string | null
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          payload?: Json
          processed_at?: string | null
          type?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          auth_user_id: string | null
          avatar_path: string | null
          boutique_id: string
          contract_type_id: string
          created_at: string
          default_break_end: string | null
          default_break_start: string | null
          default_end: string
          default_start: string
          display_name: string
          email: string | null
          end_date: string | null
          first_name: string
          hire_date: string | null
          id: string
          is_active: boolean
          last_name: string
          phone: string | null
          pin_hash: string
          updated_at: string
          weekly_contract_hours: number | null
          work_days: number[]
        }
        Insert: {
          auth_user_id?: string | null
          avatar_path?: string | null
          boutique_id: string
          contract_type_id: string
          created_at?: string
          default_break_end?: string | null
          default_break_start?: string | null
          default_end?: string
          default_start?: string
          display_name: string
          email?: string | null
          end_date?: string | null
          first_name: string
          hire_date?: string | null
          id?: string
          is_active?: boolean
          last_name: string
          phone?: string | null
          pin_hash: string
          updated_at?: string
          weekly_contract_hours?: number | null
          work_days?: number[]
        }
        Update: {
          auth_user_id?: string | null
          avatar_path?: string | null
          boutique_id?: string
          contract_type_id?: string
          created_at?: string
          default_break_end?: string | null
          default_break_start?: string | null
          default_end?: string
          default_start?: string
          display_name?: string
          email?: string | null
          end_date?: string | null
          first_name?: string
          hire_date?: string | null
          id?: string
          is_active?: boolean
          last_name?: string
          phone?: string | null
          pin_hash?: string
          updated_at?: string
          weekly_contract_hours?: number | null
          work_days?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "employees_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_contract_type_id_fkey"
            columns: ["contract_type_id"]
            isOneToOne: false
            referencedRelation: "contract_types"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          created_at: string
          employee_id: string | null
          id: string
          ip: unknown
          success: boolean
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          id?: string
          ip?: unknown
          success: boolean
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          id?: string
          ip?: unknown
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "login_attempts_employee_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          emailed_at: string | null
          href: string | null
          id: string
          payload: Json
          read_at: string | null
          recipient_user_id: string
          title: string
          type: string
        }
        Insert: {
          body: string
          created_at?: string
          emailed_at?: string | null
          href?: string | null
          id?: string
          payload?: Json
          read_at?: string | null
          recipient_user_id: string
          title: string
          type: string
        }
        Update: {
          body?: string
          created_at?: string
          emailed_at?: string | null
          href?: string | null
          id?: string
          payload?: Json
          read_at?: string | null
          recipient_user_id?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      public_holidays: {
        Row: {
          created_at: string
          date: string
          label: string
          region: string
        }
        Insert: {
          created_at?: string
          date: string
          label: string
          region?: string
        }
        Update: {
          created_at?: string
          date?: string
          label?: string
          region?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          boutique_id: string | null
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          boutique_id?: string | null
          created_at?: string
          role: string
          user_id: string
        }
        Update: {
          boutique_id?: string | null
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_employee: {
        Args: {
          p_auth_user_id: string
          p_boutique_id: string
          p_contract_type_id: string
          p_default_break_end?: string
          p_default_break_start?: string
          p_default_end?: string
          p_default_start?: string
          p_display_name: string
          p_email?: string
          p_first_name: string
          p_hire_date?: string
          p_last_name: string
          p_phone?: string
          p_pin: string
          p_weekly_contract_hours?: number
          p_work_days?: number[]
        }
        Returns: string
      }
      current_employee_id: { Args: never; Returns: string }
      has_role: {
        Args: { p_boutique_id?: string; p_role: string }
        Returns: boolean
      }
      is_acceptable_pin: { Args: { p_pin: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      login_boutiques: {
        Args: never
        Returns: {
          code: string
          id: string
          name: string
        }[]
      }
      login_employee: {
        Args: { p_employee_id: string }
        Returns: {
          avatar_path: string
          boutique_id: string
          display_name: string
          id: string
        }[]
      }
      login_employees: {
        Args: { p_boutique_id: string }
        Returns: {
          avatar_path: string
          display_name: string
          id: string
        }[]
      }
      reset_employee_pin: {
        Args: { p_employee_id: string; p_new_pin: string }
        Returns: undefined
      }
      verify_employee_pin: {
        Args: { p_employee_id: string; p_ip?: unknown; p_pin: string }
        Returns: {
          attempts_left: number
          auth_email: string
          auth_user_id: string
          locked_until: string
          status: string
        }[]
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
    Enums: {},
  },
} as const
