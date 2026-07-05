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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      recipe_shares: {
        Row: {
          attempts: number
          created_at: string
          error_message: string | null
          id: number
          recipe_id: number | null
          share_intent: Json
          shared_url: string
          status: Database["public"]["Enums"]["recipe_share_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: number
          recipe_id?: number | null
          share_intent: Json
          shared_url: string
          status?: Database["public"]["Enums"]["recipe_share_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: number
          recipe_id?: number | null
          share_intent?: Json
          shared_url?: string
          status?: Database["public"]["Enums"]["recipe_share_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_shares_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          category: Database["public"]["Enums"]["recipe_category"]
          cook_time_minutes: number | null
          created_at: string
          description: string | null
          extracted_at: string | null
          id: number
          image_url: string | null
          ingredients: Json
          prep_time_minutes: number | null
          slug: string
          source_type: Database["public"]["Enums"]["recipe_source"]
          source_url: string | null
          steps: Json
          title: string
          total_time_minutes: number | null
          updated_at: string
          user_id: string
          youtube_id: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["recipe_category"]
          cook_time_minutes?: number | null
          created_at?: string
          description?: string | null
          extracted_at?: string | null
          id?: number
          image_url?: string | null
          ingredients?: Json
          prep_time_minutes?: number | null
          slug: string
          source_type: Database["public"]["Enums"]["recipe_source"]
          source_url?: string | null
          steps?: Json
          title: string
          total_time_minutes?: number | null
          updated_at?: string
          user_id: string
          youtube_id?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["recipe_category"]
          cook_time_minutes?: number | null
          created_at?: string
          description?: string | null
          extracted_at?: string | null
          id?: number
          image_url?: string | null
          ingredients?: Json
          prep_time_minutes?: number | null
          slug?: string
          source_type?: Database["public"]["Enums"]["recipe_source"]
          source_url?: string | null
          steps?: Json
          title?: string
          total_time_minutes?: number | null
          updated_at?: string
          user_id?: string
          youtube_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_id: { Args: never; Returns: string }
      normalize_url: { Args: { raw: string }; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      recipe_category:
        | "obiady"
        | "zupy"
        | "desery"
        | "sniadania"
        | "przekaski"
        | "salatki"
        | "napoje"
        | "inne"
      recipe_share_status: "pending" | "completed" | "failed"
      recipe_source:
        | "facebook_text"
        | "web_blog"
        | "facebook_reel"
        | "youtube"
        | "other"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      recipe_category: [
        "obiady",
        "zupy",
        "desery",
        "sniadania",
        "przekaski",
        "salatki",
        "napoje",
        "inne",
      ],
      recipe_share_status: ["pending", "completed", "failed"],
      recipe_source: [
        "facebook_text",
        "web_blog",
        "facebook_reel",
        "youtube",
        "other",
      ],
    },
  },
} as const
