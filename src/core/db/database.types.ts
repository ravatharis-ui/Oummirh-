/**
 * Database types.
 *
 * PROVISIONAL: hand-written from supabase/migrations to keep the project type-safe
 * before the schema exists anywhere. Replace it with the real thing by running
 * `npm run db:types` once the migrations are applied — that command overwrites this
 * file, and any difference is a real drift between the code and the database.
 *
 * Helper aliases live in ./types.ts so regeneration never loses them.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          after: Json | null;
          before: Json | null;
          created_at: string;
          entity: string;
          entity_id: string | null;
          id: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          entity: string;
          entity_id?: string | null;
          id?: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          entity?: string;
          entity_id?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      boutiques: {
        Row: {
          address: string | null;
          code: string;
          created_at: string;
          id: string;
          is_active: boolean;
          kind: string;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          code: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          kind: string;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          code?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          kind?: string;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      contract_types: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          is_apprenticeship: boolean;
          label: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          is_apprenticeship?: boolean;
          label: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          is_apprenticeship?: boolean;
          label?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      domain_events: {
        Row: {
          actor_id: string | null;
          attempts: number;
          created_at: string;
          id: string;
          last_error: string | null;
          payload: Json;
          processed_at: string | null;
          type: string;
        };
        Insert: {
          actor_id?: string | null;
          attempts?: number;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          payload?: Json;
          processed_at?: string | null;
          type: string;
        };
        Update: {
          actor_id?: string | null;
          attempts?: number;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          payload?: Json;
          processed_at?: string | null;
          type?: string;
        };
        Relationships: [];
      };
      login_attempts: {
        Row: {
          created_at: string;
          employee_id: string | null;
          id: string;
          ip: string | null;
          success: boolean;
        };
        Insert: {
          created_at?: string;
          employee_id?: string | null;
          id?: string;
          ip?: string | null;
          success: boolean;
        };
        Update: {
          created_at?: string;
          employee_id?: string | null;
          id?: string;
          ip?: string | null;
          success?: boolean;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string;
          created_at: string;
          emailed_at: string | null;
          href: string | null;
          id: string;
          payload: Json;
          read_at: string | null;
          recipient_user_id: string;
          title: string;
          type: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          emailed_at?: string | null;
          href?: string | null;
          id?: string;
          payload?: Json;
          read_at?: string | null;
          recipient_user_id: string;
          title: string;
          type: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          emailed_at?: string | null;
          href?: string | null;
          id?: string;
          payload?: Json;
          read_at?: string | null;
          recipient_user_id?: string;
          title?: string;
          type?: string;
        };
        Relationships: [];
      };
      public_holidays: {
        Row: { created_at: string; date: string; label: string; region: string };
        Insert: { created_at?: string; date: string; label: string; region?: string };
        Update: { created_at?: string; date?: string; label?: string; region?: string };
        Relationships: [];
      };
      settings: {
        Row: { key: string; updated_at: string; updated_by: string | null; value: Json };
        Insert: { key: string; updated_at?: string; updated_by?: string | null; value: Json };
        Update: { key?: string; updated_at?: string; updated_by?: string | null; value?: Json };
        Relationships: [];
      };
      user_roles: {
        Row: { boutique_id: string | null; created_at: string; role: string; user_id: string };
        Insert: { boutique_id?: string | null; created_at?: string; role: string; user_id: string };
        Update: { boutique_id?: string | null; created_at?: string; role?: string; user_id?: string };
        Relationships: [
          {
            foreignKeyName: "user_roles_boutique_id_fkey";
            columns: ["boutique_id"];
            isOneToOne: false;
            referencedRelation: "boutiques";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      has_role: {
        Args: { p_role: string; p_boutique_id?: string | null };
        Returns: boolean;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
