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
      monitor_schedules: {
        Row: {
          cadence: string;
          cadence_seconds: number;
          citation: string;
          execution_mode: string;
          fail_severity: string;
          id: string;
          live_enabled: boolean;
          name: string;
          next_due: string | null;
          rule_id: string;
          updated_at: string;
        };
        Insert: {
          cadence: string;
          cadence_seconds: number;
          citation: string;
          execution_mode?: string;
          fail_severity: string;
          id: string;
          live_enabled?: boolean;
          name: string;
          next_due?: string | null;
          rule_id: string;
          updated_at?: string;
        };
        Update: {
          cadence?: string;
          cadence_seconds?: number;
          citation?: string;
          execution_mode?: string;
          fail_severity?: string;
          id?: string;
          live_enabled?: boolean;
          name?: string;
          next_due?: string | null;
          rule_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      monitor_runs: {
        Row: {
          at: string;
          finding_id: string | null;
          id: number;
          incident_id: string | null;
          mode: string;
          monitor_id: string;
          note: string;
          origin: string;
          state: string;
        };
        Insert: {
          at?: string;
          finding_id?: string | null;
          id?: never;
          incident_id?: string | null;
          mode?: string;
          monitor_id: string;
          note: string;
          origin: string;
          state: string;
        };
        Update: {
          at?: string;
          finding_id?: string | null;
          id?: never;
          incident_id?: string | null;
          mode?: string;
          monitor_id?: string;
          note?: string;
          origin?: string;
          state?: string;
        };
        Relationships: [];
      };
      monitor_findings_drafts: {
        Row: {
          citation: string;
          cite: string;
          closed_evidence: string;
          created_at: string;
          document: string;
          due: string;
          escape: boolean;
          id: number;
          mode: string;
          monitor_id: string | null;
          opened_on: string;
          owner: string;
          remediate: string;
          severity: string;
          source: string;
          state: string;
          surface: string;
        };
        Insert: {
          citation: string;
          cite: string;
          closed_evidence?: string;
          created_at?: string;
          document: string;
          due: string;
          escape?: boolean;
          id?: never;
          mode?: string;
          monitor_id?: string | null;
          opened_on: string;
          owner: string;
          remediate: string;
          severity: string;
          source: string;
          state?: string;
          surface: string;
        };
        Update: {
          citation?: string;
          cite?: string;
          closed_evidence?: string;
          created_at?: string;
          document?: string;
          due?: string;
          escape?: boolean;
          id?: never;
          mode?: string;
          monitor_id?: string | null;
          opened_on?: string;
          owner?: string;
          remediate?: string;
          severity?: string;
          source?: string;
          state?: string;
          surface?: string;
        };
        Relationships: [];
      };
      audit_events: {
        Row: {
          action: string;
          actor: string;
          at: string;
          hash: string;
          id: number;
          mode: string;
          note: string;
          prev_hash: string;
          target: string;
        };
        Insert: {
          action: string;
          actor: string;
          at?: string;
          hash?: string;
          id?: never;
          mode?: string;
          note: string;
          prev_hash?: string;
          target: string;
        };
        Update: {
          action?: string;
          actor?: string;
          at?: string;
          hash?: string;
          id?: never;
          mode?: string;
          note?: string;
          prev_hash?: string;
          target?: string;
        };
        Relationships: [];
      };
      scanner_ingestions: {
        Row: {
          created_at: string;
          finding_id: string | null;
          id: number;
          last_sweep: string | null;
          mode: string;
          note: string;
          payload: Json;
          source: string;
        };
        Insert: {
          created_at?: string;
          finding_id?: string | null;
          id?: never;
          last_sweep?: string | null;
          mode?: string;
          note: string;
          payload?: Json;
          source: string;
        };
        Update: {
          created_at?: string;
          finding_id?: string | null;
          id?: never;
          last_sweep?: string | null;
          mode?: string;
          note?: string;
          payload?: Json;
          source?: string;
        };
        Relationships: [];
      };
      precheck_server_runs: {
        Row: {
          candidate: string;
          created_at: string;
          id: number;
          metrc_source: string;
          mode: string;
          reasons: string[];
          verdict: string;
        };
        Insert: {
          candidate: string;
          created_at?: string;
          id?: never;
          metrc_source?: string;
          mode?: string;
          reasons?: string[];
          verdict: string;
        };
        Update: {
          candidate?: string;
          created_at?: string;
          id?: never;
          metrc_source?: string;
          mode?: string;
          reasons?: string[];
          verdict?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      admin_role: { Args: Record<string, never>; Returns: string };
      checkpoint_audit_offsite: { Args: Record<string, never>; Returns: Json };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      mark_admin_mfa_enrolled: { Args: Record<string, never>; Returns: undefined };
      record_auth_attempt: {
        Args: { p_email: string; p_ip: string; p_outcome: string };
        Returns: Json;
      };
      verify_audit_chain: { Args: Record<string, never>; Returns: Json };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
