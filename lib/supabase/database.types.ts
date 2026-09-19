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
          notes: string;
          before_chart: string | null;
          after_chart: string | null;
          created_at: string;
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
          notes?: string;
          before_chart?: string | null;
          after_chart?: string | null;
          created_at?: string;
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
          notes?: string;
          before_chart?: string | null;
          after_chart?: string | null;
          created_at?: string;
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
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
