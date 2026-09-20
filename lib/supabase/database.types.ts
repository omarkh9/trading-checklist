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
      trades: {
        Row: {
          id: string;
          user_id: string;
          pair: string;
          higher_time_frame: string | null;
          middle_time_frame: string | null;
          lower_time_frame: string | null;
          entry: string | null;
          direction: Database["public"]["Enums"]["trade_direction"];
          entry_price: string;
          stop_loss: string;
          take_profit: string;
          outcome: Database["public"]["Enums"]["trade_outcome"];
          pnl_mode: Database["public"]["Enums"]["trade_pnl_mode"];
          pnl_input: string;
          pnl_dollars: number;
          risk_size_mode: Database["public"]["Enums"]["trade_risk_size_mode"];
          risk_percent: string;
          fixed_lot_size: string;
          lot_size: string;
          account_balance_at_entry: number;
          strategy: string;
          notes: string;
          before_chart: string | null;
          after_chart: string | null;
          created_at: string;
          account_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          pair: string;
          higher_time_frame?: string | null;
          middle_time_frame?: string | null;
          lower_time_frame?: string | null;
          entry?: string | null;
          direction: Database["public"]["Enums"]["trade_direction"];
          entry_price?: string;
          stop_loss?: string;
          take_profit?: string;
          outcome: Database["public"]["Enums"]["trade_outcome"];
          pnl_mode?: Database["public"]["Enums"]["trade_pnl_mode"];
          pnl_input?: string;
          pnl_dollars?: number;
          risk_size_mode?: Database["public"]["Enums"]["trade_risk_size_mode"];
          risk_percent?: string;
          fixed_lot_size?: string;
          lot_size?: string;
          account_balance_at_entry?: number;
          strategy?: string;
          notes?: string;
          before_chart?: string | null;
          after_chart?: string | null;
          created_at?: string;
          account_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          pair?: string;
          higher_time_frame?: string | null;
          middle_time_frame?: string | null;
          lower_time_frame?: string | null;
          entry?: string | null;
          direction?: Database["public"]["Enums"]["trade_direction"];
          entry_price?: string;
          stop_loss?: string;
          take_profit?: string;
          outcome?: Database["public"]["Enums"]["trade_outcome"];
          pnl_mode?: Database["public"]["Enums"]["trade_pnl_mode"];
          pnl_input?: string;
          pnl_dollars?: number;
          risk_size_mode?: Database["public"]["Enums"]["trade_risk_size_mode"];
          risk_percent?: string;
          fixed_lot_size?: string;
          lot_size?: string;
          account_balance_at_entry?: number;
          strategy?: string;
          notes?: string;
          before_chart?: string | null;
          after_chart?: string | null;
          created_at?: string;
          account_id?: string | null;
        };
        Relationships: [];
      };
      trading_accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          starting_balance: number;
          created_at: string;
          mt5_login: string | null;
          mt5_server: string | null;
          mt5_webhook_token_hash: string | null;
          mt5_balance: number | null;
          mt5_equity: number | null;
          mt5_synced_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          starting_balance?: number;
          created_at?: string;
          mt5_login?: string | null;
          mt5_server?: string | null;
          mt5_webhook_token_hash?: string | null;
          mt5_balance?: number | null;
          mt5_equity?: number | null;
          mt5_synced_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          starting_balance?: number;
          created_at?: string;
          mt5_login?: string | null;
          mt5_server?: string | null;
          mt5_webhook_token_hash?: string | null;
          mt5_balance?: number | null;
          mt5_equity?: number | null;
          mt5_synced_at?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          username: string;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      checklist_rules: {
        Row: {
          id: string;
          user_id: string;
          label: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          label?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      checklist_sessions: {
        Row: {
          id: string;
          user_id: string;
          session_date: string;
          checked_rule_ids: string[];
          confidence: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_date: string;
          checked_rule_ids?: string[];
          confidence?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_date?: string;
          checked_rule_ids?: string[];
          confidence?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      apply_mt5_account_snapshot: {
        Args: {
          p_token: string;
          p_login?: string;
          p_server?: string;
          p_balance: number;
          p_equity?: number | null;
        };
        Returns: Json;
      };
    };
    Enums: {
      trade_direction: "Long" | "Short";
      trade_outcome: "Win" | "Loss" | "Breakeven";
      trade_pnl_mode: "dollar" | "percent";
      trade_risk_size_mode: "fixed" | "percent";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type TradeRow = Database["public"]["Tables"]["trades"]["Row"];
export type TradeInsert = Database["public"]["Tables"]["trades"]["Insert"];
export type TradeUpdate = Database["public"]["Tables"]["trades"]["Update"];
export type TradingAccountRow =
  Database["public"]["Tables"]["trading_accounts"]["Row"];
export type TradingAccountInsert =
  Database["public"]["Tables"]["trading_accounts"]["Insert"];
export type TradingAccountUpdate =
  Database["public"]["Tables"]["trading_accounts"]["Update"];
export type ChecklistRuleRow =
  Database["public"]["Tables"]["checklist_rules"]["Row"];
export type ChecklistSessionRow =
  Database["public"]["Tables"]["checklist_sessions"]["Row"];
