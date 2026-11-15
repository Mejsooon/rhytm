// Ręcznie utrzymane typy w kształcie `Database` z supabase-js
// (odpowiednik `supabase gen types typescript`). Aktualizować razem z migracjami.

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
          user_id: string;
          weight_kg: number | null;
          height_cm: number | null;
          birth_date: string | null;
          sex: string | null;
          timezone: string;
          sleep_goal_min: number;
        };
        Insert: {
          user_id?: string;
          weight_kg?: number | null;
          height_cm?: number | null;
          birth_date?: string | null;
          sex?: string | null;
          timezone?: string;
          sleep_goal_min?: number;
        };
        Update: {
          user_id?: string;
          weight_kg?: number | null;
          height_cm?: number | null;
          birth_date?: string | null;
          sex?: string | null;
          timezone?: string;
          sleep_goal_min?: number;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          position: number;
          visible: boolean;
          is_system: boolean;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          color: string;
          position?: number;
          visible?: boolean;
          is_system?: boolean;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string;
          position?: number;
          visible?: boolean;
          is_system?: boolean;
          created_at?: string | null;
        };
        Relationships: [];
      };
      blocks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          category_id: string;
          note: string | null;
          start_local: string;
          duration_min: number;
          timezone: string;
          recurrence: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title: string;
          category_id: string;
          note?: string | null;
          start_local: string;
          duration_min: number;
          timezone: string;
          recurrence?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          category_id?: string;
          note?: string | null;
          start_local?: string;
          duration_min?: number;
          timezone?: string;
          recurrence?: Json | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      block_exceptions: {
        Row: {
          block_id: string;
          occurrence_date: string;
          cancelled: boolean;
          start_local: string | null;
          duration_min: number | null;
          title: string | null;
          category_id: string | null;
          note: string | null;
        };
        Insert: {
          block_id: string;
          occurrence_date: string;
          cancelled?: boolean;
          start_local?: string | null;
          duration_min?: number | null;
          title?: string | null;
          category_id?: string | null;
          note?: string | null;
        };
        Update: {
          block_id?: string;
          occurrence_date?: string;
          cancelled?: boolean;
          start_local?: string | null;
          duration_min?: number | null;
          title?: string | null;
          category_id?: string | null;
          note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "block_exceptions_block_id_fkey";
            columns: ["block_id"];
            isOneToOne: false;
            referencedRelation: "blocks";
            referencedColumns: ["id"];
          },
        ];
      };
      block_tasks: {
        Row: {
          id: string;
          block_id: string;
          occurrence_date: string;
          title: string;
          done: boolean;
          position: number;
        };
        Insert: {
          id?: string;
          block_id: string;
          occurrence_date: string;
          title: string;
          done?: boolean;
          position?: number;
        };
        Update: {
          id?: string;
          block_id?: string;
          occurrence_date?: string;
          title?: string;
          done?: boolean;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "block_tasks_block_id_fkey";
            columns: ["block_id"];
            isOneToOne: false;
            referencedRelation: "blocks";
            referencedColumns: ["id"];
          },
        ];
      };
      habits: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          position: number;
          archived_at: string | null;
          created_at: string | null;
          remind_at: string | null;
          last_reminded_on: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          position?: number;
          archived_at?: string | null;
          created_at?: string | null;
          remind_at?: string | null;
          last_reminded_on?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          position?: number;
          archived_at?: string | null;
          created_at?: string | null;
          remind_at?: string | null;
          last_reminded_on?: string | null;
        };
        Relationships: [];
      };
      habit_schedules: {
        Row: {
          habit_id: string;
          valid_from: string;
          schedule_type: "daily" | "days" | "weekly" | "none";
          weekdays: number[] | null;
          times_per_week: number | null;
        };
        Insert: {
          habit_id: string;
          valid_from: string;
          schedule_type: "daily" | "days" | "weekly" | "none";
          weekdays?: number[] | null;
          times_per_week?: number | null;
        };
        Update: {
          habit_id?: string;
          valid_from?: string;
          schedule_type?: "daily" | "days" | "weekly" | "none";
          weekdays?: number[] | null;
          times_per_week?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "habit_schedules_habit_id_fkey";
            columns: ["habit_id"];
            isOneToOne: false;
            referencedRelation: "habits";
            referencedColumns: ["id"];
          },
        ];
      };
      habit_checks: {
        Row: {
          habit_id: string;
          date: string;
        };
        Insert: {
          habit_id: string;
          date: string;
        };
        Update: {
          habit_id?: string;
          date?: string;
        };
        Relationships: [
          {
            foreignKeyName: "habit_checks_habit_id_fkey";
            columns: ["habit_id"];
            isOneToOne: false;
            referencedRelation: "habits";
            referencedColumns: ["id"];
          },
        ];
      };
      sleep_logs: {
        Row: {
          user_id: string;
          date: string;
          slept_at: string;
          woke_at: string;
          feeling: number;
          note: string | null;
        };
        Insert: {
          user_id?: string;
          date: string;
          slept_at: string;
          woke_at: string;
          feeling: number;
          note?: string | null;
        };
        Update: {
          user_id?: string;
          date?: string;
          slept_at?: string;
          woke_at?: string;
          feeling?: number;
          note?: string | null;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
