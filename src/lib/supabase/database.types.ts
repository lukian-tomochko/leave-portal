// Типи схеми бази. Оновлюйте разом із міграцією: готовий файл — у Summary прогону job db-check у CI
// (supabase gen types typescript --local на одноразовій базі); або npm run db:types після npx supabase link на ваш проєкт.
// Ця версія написана вручну за міграціями 20261012000000_profiles_and_roles.sql і 20261021031910_leave_foundation.sql;
// якщо CI покаже відмінність від згенерованих типів — замініть вміст готовим файлом із Summary.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          role: string;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          role?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          role?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      positions: {
        Row: {
          id: string;
          employee_id: string;
          kind: string;
          division: string;
          job_title: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          kind: string;
          division: string;
          job_title: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          kind?: string;
          division?: string;
          job_title?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "positions_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      position_managers: {
        Row: {
          position_id: string;
          manager_id: string;
        };
        Insert: {
          position_id: string;
          manager_id: string;
        };
        Update: {
          position_id?: string;
          manager_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "position_managers_position_id_fkey";
            columns: ["position_id"];
            isOneToOne: false;
            referencedRelation: "positions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "position_managers_manager_id_fkey";
            columns: ["manager_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      schedule_blocks: {
        Row: {
          id: string;
          position_id: string;
          weekday: number;
          starts_at: string;
          ends_at: string;
        };
        Insert: {
          id?: string;
          position_id: string;
          weekday: number;
          starts_at: string;
          ends_at: string;
        };
        Update: {
          id?: string;
          position_id?: string;
          weekday?: number;
          starts_at?: string;
          ends_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "schedule_blocks_position_id_fkey";
            columns: ["position_id"];
            isOneToOne: false;
            referencedRelation: "positions";
            referencedColumns: ["id"];
          },
        ];
      };
      leave_requests: {
        Row: {
          id: string;
          employee_id: string;
          leave_type: string;
          relationship: string | null;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          leave_type: string;
          relationship?: string | null;
          comment?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          leave_type?: string;
          relationship?: string | null;
          comment?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      leave_records: {
        Row: {
          id: string;
          request_id: string;
          employee_id: string;
          position_id: string;
          leave_date: string;
          starts_at: string;
          ends_at: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          employee_id: string;
          position_id: string;
          leave_date: string;
          starts_at: string;
          ends_at: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          employee_id?: string;
          position_id?: string;
          leave_date?: string;
          starts_at?: string;
          ends_at?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leave_records_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "leave_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leave_records_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leave_records_position_id_fkey";
            columns: ["position_id"];
            isOneToOne: false;
            referencedRelation: "positions";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_leave_request: {
        Args: {
          p_leave_type: string;
          p_records: Json;
          p_relationship?: string;
          p_comment?: string;
        };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
