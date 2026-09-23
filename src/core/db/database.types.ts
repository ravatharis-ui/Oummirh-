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
      direct_replacements: {
        Row: {
          boutique_id: string
          break_end: string | null
          break_start: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          date: string
          employee_id: string
          end_time: string
          id: string
          note: string | null
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          boutique_id: string
          break_end?: string | null
          break_start?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          employee_id: string
          end_time: string
          id?: string
          note?: string | null
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          boutique_id?: string
          break_end?: string | null
          break_start?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          employee_id?: string
          end_time?: string
          id?: string
          note?: string | null
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_replacements_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_replacements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          created_at: string
          employee_id: string
          first_viewed_at: string | null
          id: string
          period_month: string | null
          size_bytes: number
          storage_path: string
          title: string
          uploaded_by: string | null
        }
        Insert: {
          category: string
          created_at?: string
          employee_id: string
          first_viewed_at?: string | null
          id?: string
          period_month?: string | null
          size_bytes: number
          storage_path: string
          title: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          employee_id?: string
          first_viewed_at?: string | null
          id?: string
          period_month?: string | null
          size_bytes?: number
          storage_path?: string
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
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
      hours_ledger: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          kind: string
          local_date: string
          minutes: number
          note: string | null
          source_ref: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          kind: string
          local_date: string
          minutes: number
          note?: string | null
          source_ref?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          kind?: string
          local_date?: string
          minutes?: number
          note?: string | null
          source_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hours_ledger_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_ledger: {
        Row: {
          created_at: string
          created_by: string | null
          days: number
          employee_id: string
          id: string
          kind: string
          note: string | null
          occurred_on: string
          period_start: string
          source_ref: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          days: number
          employee_id: string
          id?: string
          kind: string
          note?: string | null
          occurred_on: string
          period_start: string
          source_ref?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          days?: number
          employee_id?: string
          id?: string
          kind?: string
          note?: string | null
          occurred_on?: string
          period_start?: string
          source_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_ledger_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          admin_comment: string | null
          created_at: string
          days: number
          decided_at: string | null
          decided_by: string | null
          employee_id: string
          end_date: string
          end_half: string | null
          id: string
          justification_path: string | null
          reason: string | null
          start_date: string
          start_half: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_comment?: string | null
          created_at?: string
          days: number
          decided_at?: string | null
          decided_by?: string | null
          employee_id: string
          end_date: string
          end_half?: string | null
          id?: string
          justification_path?: string | null
          reason?: string | null
          start_date: string
          start_half?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_comment?: string | null
          created_at?: string
          days?: number
          decided_at?: string | null
          decided_by?: string | null
          employee_id?: string
          end_date?: string
          end_half?: string | null
          id?: string
          justification_path?: string | null
          reason?: string | null
          start_date?: string
          start_half?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
      planning_entries: {
        Row: {
          boutique_id: string
          break_end: string | null
          break_start: string | null
          created_at: string
          date: string
          employee_id: string
          end_time: string | null
          id: string
          note: string | null
          source: string
          source_ref: string | null
          start_time: string | null
          status: string
          updated_at: string
        }
        Insert: {
          boutique_id: string
          break_end?: string | null
          break_start?: string | null
          created_at?: string
          date: string
          employee_id: string
          end_time?: string | null
          id?: string
          note?: string | null
          source?: string
          source_ref?: string | null
          start_time?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          boutique_id?: string
          break_end?: string | null
          break_start?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          end_time?: string | null
          id?: string
          note?: string | null
          source?: string
          source_ref?: string | null
          start_time?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_entries_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_snapshots: {
        Row: {
          created_at: string
          date: string
          employee_id: string
          entry: Json | null
          source: string
          source_ref: string
        }
        Insert: {
          created_at?: string
          date: string
          employee_id: string
          entry?: Json | null
          source: string
          source_ref: string
        }
        Update: {
          created_at?: string
          date?: string
          employee_id?: string
          entry?: Json | null
          source?: string
          source_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_snapshots_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_templates: {
        Row: {
          break_end: string | null
          break_start: string | null
          created_at: string
          employee_id: string
          end_time: string | null
          id: string
          start_time: string | null
          status: string
          updated_at: string
          weekday: number
        }
        Insert: {
          break_end?: string | null
          break_start?: string | null
          created_at?: string
          employee_id: string
          end_time?: string | null
          id?: string
          start_time?: string | null
          status: string
          updated_at?: string
          weekday: number
        }
        Update: {
          break_end?: string | null
          break_start?: string | null
          created_at?: string
          employee_id?: string
          end_time?: string | null
          id?: string
          start_time?: string | null
          status?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "planning_templates_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      pointage_alerts: {
        Row: {
          created_at: string
          employee_id: string
          kind: string
          local_date: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          kind: string
          local_date: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          kind?: string
          local_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "pointage_alerts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
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
      recovery_requests: {
        Row: {
          admin_comment: string | null
          created_at: string
          date: string
          decided_at: string | null
          decided_by: string | null
          employee_id: string
          id: string
          minutes: number
          mode: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_comment?: string | null
          created_at?: string
          date: string
          decided_at?: string | null
          decided_by?: string | null
          employee_id: string
          id?: string
          minutes: number
          mode: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_comment?: string | null
          created_at?: string
          date?: string
          decided_at?: string | null
          decided_by?: string | null
          employee_id?: string
          id?: string
          minutes?: number
          mode?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recovery_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
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
      shift_swaps: {
        Row: {
          admin_comment: string | null
          admin_decided_at: string | null
          created_at: string
          decided_by: string | null
          id: string
          message: string | null
          partner_date: string
          partner_decided_at: string | null
          partner_id: string
          requester_date: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_comment?: string | null
          admin_decided_at?: string | null
          created_at?: string
          decided_by?: string | null
          id?: string
          message?: string | null
          partner_date: string
          partner_decided_at?: string | null
          partner_id: string
          requester_date: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_comment?: string | null
          admin_decided_at?: string | null
          created_at?: string
          decided_by?: string | null
          id?: string
          message?: string | null
          partner_date?: string
          partner_decided_at?: string | null
          partner_id?: string
          requester_date?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_swaps_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swaps_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      time_clocks: {
        Row: {
          boutique_id: string
          corrected_by: string | null
          correction_reason: string | null
          created_at: string
          delta_minutes: number | null
          employee_id: string
          event_type: string
          id: string
          is_correction: boolean
          local_date: string
          occurred_at: string
          photo_path: string | null
          planned_time: string | null
        }
        Insert: {
          boutique_id: string
          corrected_by?: string | null
          correction_reason?: string | null
          created_at?: string
          delta_minutes?: number | null
          employee_id: string
          event_type: string
          id?: string
          is_correction?: boolean
          local_date: string
          occurred_at?: string
          photo_path?: string | null
          planned_time?: string | null
        }
        Update: {
          boutique_id?: string
          corrected_by?: string | null
          correction_reason?: string | null
          created_at?: string
          delta_minutes?: number | null
          employee_id?: string
          event_type?: string
          id?: string
          is_correction?: boolean
          local_date?: string
          occurred_at?: string
          photo_path?: string | null
          planned_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_clocks_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_clocks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
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
      daily_worked_time: {
        Row: {
          arrival_delta_minutes: number | null
          boutique_id: string | null
          break_end_at: string | null
          break_start_at: string | null
          clock_in_at: string | null
          clock_out_at: string | null
          employee_id: string | null
          is_open: boolean | null
          local_date: string | null
          worked_minutes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "time_clocks_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_clocks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      effective_time_clocks: {
        Row: {
          boutique_id: string | null
          correction_reason: string | null
          delta_minutes: number | null
          employee_id: string | null
          event_type: string | null
          id: string | null
          is_correction: boolean | null
          local_date: string | null
          occurred_at: string | null
          photo_path: string | null
          planned_time: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_clocks_boutique_id_fkey"
            columns: ["boutique_id"]
            isOneToOne: false
            referencedRelation: "boutiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_clocks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accrue_monthly_leave: { Args: { p_at?: string }; Returns: number }
      admin_add_document: {
        Args: {
          p_category: string
          p_employee_id: string
          p_period_month?: string
          p_size_bytes: number
          p_storage_path: string
          p_title: string
        }
        Returns: string
      }
      admin_adjust_hours: {
        Args: { p_employee_id: string; p_minutes: number; p_note: string }
        Returns: string
      }
      admin_adjust_leave: {
        Args: { p_days: number; p_employee_id: string; p_note: string }
        Returns: string
      }
      admin_apply_planning_template: {
        Args: {
          p_employee_id: string
          p_overwrite?: boolean
          p_week_start: string
        }
        Returns: number
      }
      admin_cancel_replacement: { Args: { p_id: string }; Returns: undefined }
      admin_clear_planning_template: {
        Args: { p_employee_id: string; p_weekday: number }
        Returns: boolean
      }
      admin_correct_time_clock: {
        Args: {
          p_employee_id: string
          p_event_type: string
          p_local_date: string
          p_occurred_at: string
          p_reason: string
        }
        Returns: string
      }
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
      admin_create_replacement: {
        Args: {
          p_boutique_id: string
          p_break_end?: string
          p_break_start?: string
          p_date: string
          p_employee_id: string
          p_end_time: string
          p_note?: string
          p_start_time: string
        }
        Returns: string
      }
      admin_decide_leave: {
        Args: { p_approve: boolean; p_comment?: string; p_request_id: string }
        Returns: undefined
      }
      admin_decide_recovery: {
        Args: { p_approve: boolean; p_comment?: string; p_request_id: string }
        Returns: undefined
      }
      admin_decide_swap: {
        Args: { p_approve: boolean; p_comment?: string; p_swap_id: string }
        Returns: undefined
      }
      admin_delete_planning_entry: {
        Args: { p_date: string; p_employee_id: string }
        Returns: boolean
      }
      admin_duplicate_planning_week: {
        Args: {
          p_employee_ids?: string[]
          p_source_monday: string
          p_target_monday: string
        }
        Returns: number
      }
      admin_leave_overlaps: {
        Args: { p_employee_id: string; p_from: string; p_to: string }
        Returns: {
          display_name: string
          employee_id: string
          end_date: string
          start_date: string
        }[]
      }
      admin_remove_document: {
        Args: { p_document_id: string }
        Returns: string
      }
      admin_remove_public_holiday: {
        Args: { p_date: string }
        Returns: boolean
      }
      admin_replacement_candidates: {
        Args: { p_boutique_id?: string; p_date: string }
        Returns: {
          availability: string
          display_name: string
          employee_id: string
          home_boutique: string
          planned_end: string
          planned_shop: string
          planned_start: string
          planned_status: string
        }[]
      }
      admin_set_boutique_active: {
        Args: { p_active: boolean; p_id: string }
        Returns: undefined
      }
      admin_set_planning_template: {
        Args: {
          p_break_end?: string
          p_break_start?: string
          p_employee_id: string
          p_end_time?: string
          p_start_time?: string
          p_status: string
          p_weekday: number
        }
        Returns: string
      }
      admin_set_public_holiday: {
        Args: { p_date: string; p_label: string }
        Returns: undefined
      }
      admin_set_setting: {
        Args: { p_key: string; p_value: Json }
        Returns: undefined
      }
      admin_upsert_boutique: {
        Args: {
          p_address?: string
          p_code: string
          p_id?: string
          p_kind?: string
          p_name: string
          p_sort_order?: number
        }
        Returns: string
      }
      admin_upsert_contract_type: {
        Args: {
          p_code: string
          p_id?: string
          p_is_apprenticeship?: boolean
          p_label: string
          p_sort_order?: number
        }
        Returns: string
      }
      admin_upsert_planning_entry: {
        Args: {
          p_boutique_id?: string
          p_break_end?: string
          p_break_start?: string
          p_date: string
          p_employee_id: string
          p_end_time?: string
          p_note?: string
          p_start_time?: string
          p_status: string
        }
        Returns: string
      }
      apply_planning_from_event: {
        Args: {
          p_boutique_id?: string
          p_break_end?: string
          p_break_start?: string
          p_employee_id: string
          p_end_time?: string
          p_from: string
          p_source: string
          p_source_ref: string
          p_start_time?: string
          p_status: string
          p_to: string
        }
        Returns: number
      }
      apply_planning_leave: {
        Args: {
          p_employee_id: string
          p_end_half?: string
          p_from: string
          p_request_id: string
          p_start_half?: string
          p_to: string
        }
        Returns: number
      }
      apply_planning_recovery: {
        Args: {
          p_date: string
          p_employee_id: string
          p_minutes: number
          p_mode: string
          p_source_ref: string
        }
        Returns: boolean
      }
      apply_planning_swap: {
        Args: {
          p_partner_date: string
          p_partner_id: string
          p_requester_date: string
          p_requester_id: string
          p_swap_id: string
        }
        Returns: boolean
      }
      cancel_leave_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      cancel_swap: { Args: { p_swap_id: string }; Returns: undefined }
      claim_domain_events: {
        Args: { p_limit?: number; p_max_attempts?: number }
        Returns: {
          actor_id: string | null
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          payload: Json
          processed_at: string | null
          type: string
        }[]
        SetofOptions: {
          from: "*"
          to: "domain_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      clear_planning_from_event: {
        Args: { p_source: string; p_source_ref: string }
        Returns: number
      }
      clock_event: {
        Args: { p_event_type: string; p_photo_path?: string }
        Returns: {
          boutique_id: string
          corrected_by: string | null
          correction_reason: string | null
          created_at: string
          delta_minutes: number | null
          employee_id: string
          event_type: string
          id: string
          is_correction: boolean
          local_date: string
          occurred_at: string
          photo_path: string | null
          planned_time: string | null
        }
        SetofOptions: {
          from: "*"
          to: "time_clocks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_leave_period: { Args: { p_at?: string }; Returns: number }
      compute_daily_hours: { Args: { p_date?: string }; Returns: number }
      count_leave_days: {
        Args: {
          p_employee_id: string
          p_end_half?: string
          p_from: string
          p_start_half?: string
          p_to: string
        }
        Returns: number
      }
      current_employee_id: { Args: never; Returns: string }
      emit_event: {
        Args: { p_actor_id?: string; p_payload?: Json; p_type: string }
        Returns: string
      }
      free_swapped_day: {
        Args: { p_date: string; p_employee_id: string; p_swap_id: string }
        Returns: undefined
      }
      has_role: {
        Args: { p_boutique_id?: string; p_role: string }
        Returns: boolean
      }
      hours_balance: { Args: { p_employee_id?: string }; Returns: number }
      is_acceptable_pin: { Args: { p_pin: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      leave_balance: {
        Args: { p_employee_id?: string; p_period_start?: string }
        Returns: number
      }
      leave_period_start: { Args: { p_date?: string }; Returns: string }
      leave_rules: { Args: never; Returns: Json }
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
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_document_viewed: {
        Args: { p_document_id: string }
        Returns: undefined
      }
      mark_event_failed: {
        Args: { p_error: string; p_id: string }
        Returns: undefined
      }
      mark_event_processed: { Args: { p_id: string }; Returns: undefined }
      mark_notification_emailed: { Args: { p_id: string }; Returns: undefined }
      mark_selfies_purged: { Args: { p_paths: string[] }; Returns: number }
      midday_boundary: {
        Args: never
        Returns: {
          afternoon_start: string
          morning_end: string
        }[]
      }
      my_boutique_presence: {
        Args: { p_date: string }
        Returns: {
          display_name: string
          employee_id: string
          end_time: string
          start_time: string
        }[]
      }
      notify_user: {
        Args: {
          p_body: string
          p_href?: string
          p_payload?: Json
          p_recipient_user_id: string
          p_title: string
          p_type: string
        }
        Returns: string
      }
      partner_decide_swap: {
        Args: { p_accept: boolean; p_swap_id: string }
        Returns: undefined
      }
      place_swapped_day: {
        Args: {
          p_date: string
          p_employee_id: string
          p_entry: Database["public"]["Tables"]["planning_entries"]["Row"]
          p_swap_id: string
        }
        Returns: undefined
      }
      planning_announce: {
        Args: { p_dates: string[]; p_employee_id: string }
        Returns: undefined
      }
      planning_protected_sources: { Args: never; Returns: string[] }
      pointage_run_checks: { Args: { p_at?: string }; Returns: Json }
      request_leave: {
        Args: {
          p_end_date: string
          p_end_half?: string
          p_justification_path?: string
          p_reason?: string
          p_start_date: string
          p_start_half?: string
        }
        Returns: string
      }
      request_recovery: {
        Args: { p_date: string; p_minutes: number; p_mode: string }
        Returns: string
      }
      request_swap: {
        Args: {
          p_message?: string
          p_partner_date: string
          p_partner_id: string
          p_requester_date: string
        }
        Returns: string
      }
      reset_employee_pin: {
        Args: { p_employee_id: string; p_new_pin: string }
        Returns: undefined
      }
      reunion_today: { Args: never; Returns: string }
      revoke_anon_table_privileges: { Args: never; Returns: undefined }
      selfies_to_purge: {
        Args: { p_limit?: number }
        Returns: {
          photo_path: string
        }[]
      }
      swap_colleagues: {
        Args: never
        Returns: {
          boutique_name: string
          display_name: string
          employee_id: string
          same_boutique: boolean
        }[]
      }
      swappable_days: {
        Args: { p_employee_id: string; p_from?: string; p_to?: string }
        Returns: {
          date: string
          end_time: string
          start_time: string
          status: string
        }[]
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
