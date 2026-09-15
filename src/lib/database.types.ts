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
      admins: {
        Row: {
          created_at: string;
          id: string;
          mfa_enrolled: boolean;
          role: string;
          status: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          mfa_enrolled?: boolean;
          role: string;
          status?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          mfa_enrolled?: boolean;
          role?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: string;
          actor: string | null;
          after: Json | null;
          at: string;
          before: Json | null;
          id: number;
          ip: string | null;
          path: string | null;
          target: string | null;
          user_agent: string | null;
        };
        Insert: {
          action: string;
          actor?: string | null;
          after?: Json | null;
          at?: string;
          before?: Json | null;
          id?: never;
          ip?: string | null;
          path?: string | null;
          target?: string | null;
          user_agent?: string | null;
        };
        Update: {
          action?: string;
          actor?: string | null;
          after?: Json | null;
          at?: string;
          before?: Json | null;
          id?: never;
          ip?: string | null;
          path?: string | null;
          target?: string | null;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      auth_attempts: {
        Row: {
          attempted_at: string;
          email_hash: string;
          id: number;
          ip: string | null;
          outcome: string;
        };
        Insert: {
          attempted_at?: string;
          email_hash: string;
          id?: never;
          ip?: string | null;
          outcome: string;
        };
        Update: {
          attempted_at?: string;
          email_hash?: string;
          id?: never;
          ip?: string | null;
          outcome?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      admin_role: { Args: Record<string, never>; Returns: string };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      mark_admin_mfa_enrolled: { Args: Record<string, never>; Returns: undefined };
      record_auth_attempt: {
        Args: { p_email: string; p_ip: string; p_outcome: string };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
