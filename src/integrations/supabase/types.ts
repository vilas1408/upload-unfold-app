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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accuracy_metrics: {
        Row: {
          accuracy_rate: number | null
          avg_loss_percent: number | null
          avg_profit_percent: number | null
          bearish_trend_accuracy: number | null
          best_performing_symbol: string | null
          bullish_trend_accuracy: number | null
          call_success_rate: number | null
          failed_predictions: number | null
          id: number
          neutral_trend_accuracy: number | null
          pending_predictions: number | null
          period: string
          period_end: string
          period_start: string
          put_success_rate: number | null
          successful_predictions: number | null
          total_predictions: number | null
          updated_at: string | null
          win_rate: number | null
          worst_performing_symbol: string | null
        }
        Insert: {
          accuracy_rate?: number | null
          avg_loss_percent?: number | null
          avg_profit_percent?: number | null
          bearish_trend_accuracy?: number | null
          best_performing_symbol?: string | null
          bullish_trend_accuracy?: number | null
          call_success_rate?: number | null
          failed_predictions?: number | null
          id?: number
          neutral_trend_accuracy?: number | null
          pending_predictions?: number | null
          period: string
          period_end: string
          period_start: string
          put_success_rate?: number | null
          successful_predictions?: number | null
          total_predictions?: number | null
          updated_at?: string | null
          win_rate?: number | null
          worst_performing_symbol?: string | null
        }
        Update: {
          accuracy_rate?: number | null
          avg_loss_percent?: number | null
          avg_profit_percent?: number | null
          bearish_trend_accuracy?: number | null
          best_performing_symbol?: string | null
          bullish_trend_accuracy?: number | null
          call_success_rate?: number | null
          failed_predictions?: number | null
          id?: number
          neutral_trend_accuracy?: number | null
          pending_predictions?: number | null
          period?: string
          period_end?: string
          period_start?: string
          put_success_rate?: number | null
          successful_predictions?: number | null
          total_predictions?: number | null
          updated_at?: string | null
          win_rate?: number | null
          worst_performing_symbol?: string | null
        }
        Relationships: []
      }
      admin_activity_log: {
        Row: {
          action: string
          admin_id: string
          details: Json | null
          id: string
          target_id: string | null
          timestamp: string | null
        }
        Insert: {
          action: string
          admin_id: string
          details?: Json | null
          id?: string
          target_id?: string | null
          timestamp?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          timestamp?: string | null
        }
        Relationships: []
      }
      option_premiums: {
        Row: {
          ask_price: number | null
          bid_price: number | null
          contract_type: string
          days_to_expiry: number
          delta: number | null
          expiry_date: string
          gamma: number | null
          id: number
          implied_volatility: number | null
          open_interest: number | null
          option_type: string
          premium: number
          strike_price: number
          symbol: string
          theta: number | null
          timestamp: string | null
          underlying_price: number
          vega: number | null
          volume: number | null
        }
        Insert: {
          ask_price?: number | null
          bid_price?: number | null
          contract_type: string
          days_to_expiry: number
          delta?: number | null
          expiry_date: string
          gamma?: number | null
          id?: number
          implied_volatility?: number | null
          open_interest?: number | null
          option_type: string
          premium: number
          strike_price: number
          symbol: string
          theta?: number | null
          timestamp?: string | null
          underlying_price: number
          vega?: number | null
          volume?: number | null
        }
        Update: {
          ask_price?: number | null
          bid_price?: number | null
          contract_type?: string
          days_to_expiry?: number
          delta?: number | null
          expiry_date?: string
          gamma?: number | null
          id?: number
          implied_volatility?: number | null
          open_interest?: number | null
          option_type?: string
          premium?: number
          strike_price?: number
          symbol?: string
          theta?: number | null
          timestamp?: string | null
          underlying_price?: number
          vega?: number | null
          volume?: number | null
        }
        Relationships: []
      }
      prediction_tracking: {
        Row: {
          actual_entry_premium: number | null
          actual_exit_premium: number | null
          actual_max_premium: number | null
          actual_min_premium: number | null
          direction_correct: boolean | null
          exit_reason: string | null
          expiry_date: string | null
          id: number
          iv_rank_at_prediction: number | null
          option_type: string
          outcome_recorded_at: string | null
          pnl_amount: number | null
          pnl_percent: number | null
          predicted_at: string | null
          predicted_direction: string | null
          predicted_entry_premium: number | null
          predicted_sl_premium: number | null
          predicted_strategy: string | null
          predicted_strike: number | null
          predicted_target_premium: number | null
          prediction_accuracy: number | null
          prediction_json: Json
          rsi_at_prediction: number | null
          sl_hit: boolean | null
          symbol: string
          target_hit: boolean | null
          technical_score: number | null
          tracked_until: string | null
          trend_at_prediction: string | null
          user_id: string | null
        }
        Insert: {
          actual_entry_premium?: number | null
          actual_exit_premium?: number | null
          actual_max_premium?: number | null
          actual_min_premium?: number | null
          direction_correct?: boolean | null
          exit_reason?: string | null
          expiry_date?: string | null
          id?: number
          iv_rank_at_prediction?: number | null
          option_type: string
          outcome_recorded_at?: string | null
          pnl_amount?: number | null
          pnl_percent?: number | null
          predicted_at?: string | null
          predicted_direction?: string | null
          predicted_entry_premium?: number | null
          predicted_sl_premium?: number | null
          predicted_strategy?: string | null
          predicted_strike?: number | null
          predicted_target_premium?: number | null
          prediction_accuracy?: number | null
          prediction_json: Json
          rsi_at_prediction?: number | null
          sl_hit?: boolean | null
          symbol: string
          target_hit?: boolean | null
          technical_score?: number | null
          tracked_until?: string | null
          trend_at_prediction?: string | null
          user_id?: string | null
        }
        Update: {
          actual_entry_premium?: number | null
          actual_exit_premium?: number | null
          actual_max_premium?: number | null
          actual_min_premium?: number | null
          direction_correct?: boolean | null
          exit_reason?: string | null
          expiry_date?: string | null
          id?: number
          iv_rank_at_prediction?: number | null
          option_type?: string
          outcome_recorded_at?: string | null
          pnl_amount?: number | null
          pnl_percent?: number | null
          predicted_at?: string | null
          predicted_direction?: string | null
          predicted_entry_premium?: number | null
          predicted_sl_premium?: number | null
          predicted_strategy?: string | null
          predicted_strike?: number | null
          predicted_target_premium?: number | null
          prediction_accuracy?: number | null
          prediction_json?: Json
          rsi_at_prediction?: number | null
          sl_hit?: boolean | null
          symbol?: string
          target_hit?: boolean | null
          technical_score?: number | null
          tracked_until?: string | null
          trend_at_prediction?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prediction_tracking_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_tuning: {
        Row: {
          accuracy_rate: number | null
          confidence_adjustment: number | null
          id: string
          last_calculated_at: string | null
          sample_size: number | null
          tuning_key: string
          tuning_type: string
        }
        Insert: {
          accuracy_rate?: number | null
          confidence_adjustment?: number | null
          id?: string
          last_calculated_at?: string | null
          sample_size?: number | null
          tuning_key: string
          tuning_type: string
        }
        Update: {
          accuracy_rate?: number | null
          confidence_adjustment?: number | null
          id?: string
          last_calculated_at?: string | null
          sample_size?: number | null
          tuning_key?: string
          tuning_type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          date_of_birth: string | null
          email: string
          id: string
          is_approved: boolean
          mobile_number: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          id: string
          is_approved?: boolean
          mobile_number?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          id?: string
          is_approved?: boolean
          mobile_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stock_predictions: {
        Row: {
          closing_price: number
          company_name: string
          confidence: string
          created_at: string
          days_ahead: number | null
          historical_data: Json
          id: string
          opening_price: number
          prediction_date: string
          reason: string
          risk_factors: string | null
          symbol: string
          technical_score: number | null
          trend_alignment: string | null
        }
        Insert: {
          closing_price: number
          company_name: string
          confidence: string
          created_at?: string
          days_ahead?: number | null
          historical_data: Json
          id?: string
          opening_price: number
          prediction_date: string
          reason: string
          risk_factors?: string | null
          symbol: string
          technical_score?: number | null
          trend_alignment?: string | null
        }
        Update: {
          closing_price?: number
          company_name?: string
          confidence?: string
          created_at?: string
          days_ahead?: number | null
          historical_data?: Json
          id?: string
          opening_price?: number
          prediction_date?: string
          reason?: string
          risk_factors?: string | null
          symbol?: string
          technical_score?: number | null
          trend_alignment?: string | null
        }
        Relationships: []
      }
      stocks: {
        Row: {
          created_at: string
          exchange: string
          id: string
          name: string
          sector: string | null
          symbol: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          exchange: string
          id?: string
          name: string
          sector?: string | null
          symbol: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          exchange?: string
          id?: string
          name?: string
          sector?: string | null
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      upstox_tokens: {
        Row: {
          access_token: string
          created_at: string
          id: string
          refresh_token: string | null
          token_expiry: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          refresh_token?: string | null
          token_expiry: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          refresh_token?: string | null
          token_expiry?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_plans: {
        Row: {
          created_at: string | null
          daily_prediction_limit: number
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          daily_prediction_limit?: number
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          daily_prediction_limit?: number
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      volatility_metrics: {
        Row: {
          date: string
          historical_volatility_30d: number | null
          historical_volatility_7d: number | null
          id: number
          implied_volatility_avg: number | null
          iv_percentile: number | null
          iv_rank: number | null
          symbol: string
          volume_avg_20d: number | null
          volume_ratio: number | null
          volume_today: number | null
        }
        Insert: {
          date: string
          historical_volatility_30d?: number | null
          historical_volatility_7d?: number | null
          id?: number
          implied_volatility_avg?: number | null
          iv_percentile?: number | null
          iv_rank?: number | null
          symbol: string
          volume_avg_20d?: number | null
          volume_ratio?: number | null
          volume_today?: number | null
        }
        Update: {
          date?: string
          historical_volatility_30d?: number | null
          historical_volatility_7d?: number | null
          id?: number
          implied_volatility_avg?: number | null
          iv_percentile?: number | null
          iv_rank?: number | null
          symbol?: string
          volume_avg_20d?: number | null
          volume_ratio?: number | null
          volume_today?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_user_approved: { Args: { user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      subscription_plan: "free" | "premium"
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
  public: {
    Enums: {
      app_role: ["admin", "user"],
      subscription_plan: ["free", "premium"],
    },
  },
} as const
