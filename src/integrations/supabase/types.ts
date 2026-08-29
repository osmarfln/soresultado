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
      capital_results: {
        Row: {
          created_at: string
          created_by: string | null
          draw_date: string
          draw_time: Database["public"]["Enums"]["capital_draw_time"]
          id: string
          prize_1_bicho: string
          prize_1_group: number
          prize_1_milhar: string
          prize_2_bicho: string
          prize_2_group: number
          prize_2_milhar: string
          prize_3_bicho: string
          prize_3_group: number
          prize_3_milhar: string
          prize_4_bicho: string
          prize_4_group: number
          prize_4_milhar: string
          prize_5_bicho: string
          prize_5_group: number
          prize_5_milhar: string
          scraped_at: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          draw_date: string
          draw_time: Database["public"]["Enums"]["capital_draw_time"]
          id?: string
          prize_1_bicho: string
          prize_1_group: number
          prize_1_milhar: string
          prize_2_bicho: string
          prize_2_group: number
          prize_2_milhar: string
          prize_3_bicho: string
          prize_3_group: number
          prize_3_milhar: string
          prize_4_bicho: string
          prize_4_group: number
          prize_4_milhar: string
          prize_5_bicho: string
          prize_5_group: number
          prize_5_milhar: string
          scraped_at?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          draw_date?: string
          draw_time?: Database["public"]["Enums"]["capital_draw_time"]
          id?: string
          prize_1_bicho?: string
          prize_1_group?: number
          prize_1_milhar?: string
          prize_2_bicho?: string
          prize_2_group?: number
          prize_2_milhar?: string
          prize_3_bicho?: string
          prize_3_group?: number
          prize_3_milhar?: string
          prize_4_bicho?: string
          prize_4_group?: number
          prize_4_milhar?: string
          prize_5_bicho?: string
          prize_5_group?: number
          prize_5_milhar?: string
          scraped_at?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      draw_results: {
        Row: {
          created_at: string
          created_by: string | null
          draw_date: string
          draw_time: Database["public"]["Enums"]["draw_time"]
          id: string
          prize_1_bicho: string
          prize_1_group: number
          prize_1_milhar: string
          prize_2_bicho: string
          prize_2_group: number
          prize_2_milhar: string
          prize_3_bicho: string
          prize_3_group: number
          prize_3_milhar: string
          prize_4_bicho: string
          prize_4_group: number
          prize_4_milhar: string
          prize_5_bicho: string
          prize_5_group: number
          prize_5_milhar: string
          scraped_at: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          draw_date: string
          draw_time: Database["public"]["Enums"]["draw_time"]
          id?: string
          prize_1_bicho: string
          prize_1_group: number
          prize_1_milhar: string
          prize_2_bicho: string
          prize_2_group: number
          prize_2_milhar: string
          prize_3_bicho: string
          prize_3_group: number
          prize_3_milhar: string
          prize_4_bicho: string
          prize_4_group: number
          prize_4_milhar: string
          prize_5_bicho: string
          prize_5_group: number
          prize_5_milhar: string
          scraped_at?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          draw_date?: string
          draw_time?: Database["public"]["Enums"]["draw_time"]
          id?: string
          prize_1_bicho?: string
          prize_1_group?: number
          prize_1_milhar?: string
          prize_2_bicho?: string
          prize_2_group?: number
          prize_2_milhar?: string
          prize_3_bicho?: string
          prize_3_group?: number
          prize_3_milhar?: string
          prize_4_bicho?: string
          prize_4_group?: number
          prize_4_milhar?: string
          prize_5_bicho?: string
          prize_5_group?: number
          prize_5_milhar?: string
          scraped_at?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      federal_results: {
        Row: {
          created_at: string
          created_by: string | null
          draw_date: string
          draw_number: string | null
          id: string
          prize_1_bicho: string
          prize_1_group: number
          prize_1_milhar: string
          prize_2_bicho: string
          prize_2_group: number
          prize_2_milhar: string
          prize_3_bicho: string
          prize_3_group: number
          prize_3_milhar: string
          prize_4_bicho: string
          prize_4_group: number
          prize_4_milhar: string
          prize_5_bicho: string
          prize_5_group: number
          prize_5_milhar: string
          scraped_at: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          draw_date: string
          draw_number?: string | null
          id?: string
          prize_1_bicho?: string
          prize_1_group?: number
          prize_1_milhar?: string
          prize_2_bicho?: string
          prize_2_group?: number
          prize_2_milhar?: string
          prize_3_bicho?: string
          prize_3_group?: number
          prize_3_milhar?: string
          prize_4_bicho?: string
          prize_4_group?: number
          prize_4_milhar?: string
          prize_5_bicho?: string
          prize_5_group?: number
          prize_5_milhar?: string
          scraped_at?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          draw_date?: string
          draw_number?: string | null
          id?: string
          prize_1_bicho?: string
          prize_1_group?: number
          prize_1_milhar?: string
          prize_2_bicho?: string
          prize_2_group?: number
          prize_2_milhar?: string
          prize_3_bicho?: string
          prize_3_group?: number
          prize_3_milhar?: string
          prize_4_bicho?: string
          prize_4_group?: number
          prize_4_milhar?: string
          prize_5_bicho?: string
          prize_5_group?: number
          prize_5_milhar?: string
          scraped_at?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      federal_schedule: {
        Row: {
          created_at: string
          draw_hour: number
          draw_minute: number
          enabled: boolean
          id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          draw_hour: number
          draw_minute: number
          enabled?: boolean
          id?: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          draw_hour?: number
          draw_minute?: number
          enabled?: boolean
          id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: []
      }
      page_visits: {
        Row: {
          id: string
          page: string
          visit_date: string
          visit_hour: number
          visited_at: string
        }
        Insert: {
          id?: string
          page?: string
          visit_date?: string
          visit_hour?: number
          visited_at?: string
        }
        Update: {
          id?: string
          page?: string
          visit_date?: string
          visit_hour?: number
          visited_at?: string
        }
        Relationships: []
      }
      scrape_robot_logs: {
        Row: {
          created_at: string
          details: Json
          duration_ms: number
          error_message: string | null
          http_status: number | null
          id: string
          inserted_count: number
          lottery: string
          results_found: number
          source_url: string
          status: string
          updated_count: number
        }
        Insert: {
          created_at?: string
          details?: Json
          duration_ms?: number
          error_message?: string | null
          http_status?: number | null
          id?: string
          inserted_count?: number
          lottery: string
          results_found?: number
          source_url: string
          status: string
          updated_count?: number
        }
        Update: {
          created_at?: string
          details?: Json
          duration_ms?: number
          error_message?: string | null
          http_status?: number | null
          id?: string
          inserted_count?: number
          lottery?: string
          results_found?: number
          source_url?: string
          status?: string
          updated_count?: number
        }
        Relationships: []
      }
      sp_results: {
        Row: {
          created_at: string
          created_by: string | null
          draw_date: string
          draw_time: Database["public"]["Enums"]["sp_draw_time"]
          id: string
          prize_1_bicho: string
          prize_1_group: number
          prize_1_milhar: string
          prize_2_bicho: string
          prize_2_group: number
          prize_2_milhar: string
          prize_3_bicho: string
          prize_3_group: number
          prize_3_milhar: string
          prize_4_bicho: string
          prize_4_group: number
          prize_4_milhar: string
          prize_5_bicho: string
          prize_5_group: number
          prize_5_milhar: string
          scraped_at: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          draw_date: string
          draw_time: Database["public"]["Enums"]["sp_draw_time"]
          id?: string
          prize_1_bicho: string
          prize_1_group: number
          prize_1_milhar: string
          prize_2_bicho: string
          prize_2_group: number
          prize_2_milhar: string
          prize_3_bicho: string
          prize_3_group: number
          prize_3_milhar: string
          prize_4_bicho: string
          prize_4_group: number
          prize_4_milhar: string
          prize_5_bicho: string
          prize_5_group: number
          prize_5_milhar: string
          scraped_at?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          draw_date?: string
          draw_time?: Database["public"]["Enums"]["sp_draw_time"]
          id?: string
          prize_1_bicho?: string
          prize_1_group?: number
          prize_1_milhar?: string
          prize_2_bicho?: string
          prize_2_group?: number
          prize_2_milhar?: string
          prize_3_bicho?: string
          prize_3_group?: number
          prize_3_milhar?: string
          prize_4_bicho?: string
          prize_4_group?: number
          prize_4_milhar?: string
          prize_5_bicho?: string
          prize_5_group?: number
          prize_5_milhar?: string
          scraped_at?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      sponsors: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          image_url: string
          is_active: boolean
          link_url: string | null
          name: string
          position: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          link_url?: string | null
          name: string
          position?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          link_url?: string | null
          name?: string
          position?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      ticker_settings: {
        Row: {
          bg_color: string
          created_at: string
          font_family: string
          font_size: string
          id: string
          is_active: boolean
          message: string
          speed: number
          text_color: string
          updated_at: string
        }
        Insert: {
          bg_color?: string
          created_at?: string
          font_family?: string
          font_size?: string
          id?: string
          is_active?: boolean
          message?: string
          speed?: number
          text_color?: string
          updated_at?: string
        }
        Update: {
          bg_color?: string
          created_at?: string
          font_family?: string
          font_size?: string
          id?: string
          is_active?: boolean
          message?: string
          speed?: number
          text_color?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
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
    }
    Enums: {
      app_role: "admin" | "manager" | "user"
      capital_draw_time:
        | "LCAP_09"
        | "LCAP_10"
        | "LCAP_11"
        | "LCAP_13"
        | "PTSP_13"
        | "CAP_14"
        | "LCAP_15"
        | "BAND_15"
        | "LCAP_16"
        | "CAP_18"
        | "LCAP_19"
        | "LCAP_20"
        | "PTNSP_20"
        | "LCAP_2230"
        | "LCAP_18"
      draw_time: "PPT" | "PTM" | "PT" | "PTV" | "PTN" | "COR"
      sp_draw_time:
        | "PTSP_0820"
        | "PTSP_1000"
        | "PTSP_1300"
        | "BAND_1530"
        | "PTSP_1900"
        | "PTNSP_2000"
        | "PTSP_2040"
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
      app_role: ["admin", "manager", "user"],
      capital_draw_time: [
        "LCAP_09",
        "LCAP_10",
        "LCAP_11",
        "LCAP_13",
        "PTSP_13",
        "CAP_14",
        "LCAP_15",
        "BAND_15",
        "LCAP_16",
        "CAP_18",
        "LCAP_19",
        "LCAP_20",
        "PTNSP_20",
        "LCAP_2230",
        "LCAP_18",
      ],
      draw_time: ["PPT", "PTM", "PT", "PTV", "PTN", "COR"],
      sp_draw_time: [
        "PTSP_0820",
        "PTSP_1000",
        "PTSP_1300",
        "BAND_1530",
        "PTSP_1900",
        "PTNSP_2000",
        "PTSP_2040",
      ],
    },
  },
} as const
