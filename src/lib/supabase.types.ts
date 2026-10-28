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
      access_code_attempts: {
        Row: {
          attempted_at: string
          id: number
          user_id: string
        }
        Insert: {
          attempted_at?: string
          id?: never
          user_id: string
        }
        Update: {
          attempted_at?: string
          id?: never
          user_id?: string
        }
        Relationships: []
      }
      access_codes: {
        Row: {
          code_hash: string
          created_at: string
          expires_at: string | null
          id: number
          max_uses: number
          note: string | null
          use_count: number
        }
        Insert: {
          code_hash: string
          created_at?: string
          expires_at?: string | null
          id?: never
          max_uses?: number
          note?: string | null
          use_count?: number
        }
        Update: {
          code_hash?: string
          created_at?: string
          expires_at?: string | null
          id?: never
          max_uses?: number
          note?: string | null
          use_count?: number
        }
        Relationships: []
      }
      category_descriptions: {
        Row: {
          category: Database["public"]["Enums"]["recipe_category"]
          meta_description: string
          meta_title: string | null
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["recipe_category"]
          meta_description: string
          meta_title?: string | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["recipe_category"]
          meta_description?: string
          meta_title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          recipe_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          recipe_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          recipe_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "public_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_gallery_images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_color: number | null
          avatar_path: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
          username: string
        }
        Insert: {
          avatar_color?: number | null
          avatar_path?: string | null
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
          username: string
        }
        Update: {
          avatar_color?: number | null
          avatar_path?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      profiles_private: {
        Row: {
          created_at: string
          first_name: string | null
          gender: string | null
          gender_set_at: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          gender?: string | null
          gender_set_at?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_name?: string | null
          gender?: string | null
          gender_set_at?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      recipe_merge_log: {
        Row: {
          created_at: string
          id: number
          kind: string
          merge_id: string
          new_value: Json | null
          old_value: Json | null
          ref_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          kind: string
          merge_id: string
          new_value?: Json | null
          old_value?: Json | null
          ref_id: string
        }
        Update: {
          created_at?: string
          id?: never
          kind?: string
          merge_id?: string
          new_value?: Json | null
          old_value?: Json | null
          ref_id?: string
        }
        Relationships: []
      }
      recipe_shares: {
        Row: {
          attempts: number
          cleared_at: string | null
          created_at: string
          error_message: string | null
          id: number
          read_at: string | null
          recipe_id: number | null
          share_intent: Json
          shared_url: string
          status: Database["public"]["Enums"]["recipe_share_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          cleared_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: number
          read_at?: string | null
          recipe_id?: number | null
          share_intent: Json
          shared_url: string
          status?: Database["public"]["Enums"]["recipe_share_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          cleared_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: number
          read_at?: string | null
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
            referencedRelation: "public_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_shares_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipe_gallery_images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_shares_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_slug_rename_log: {
        Row: {
          created_at: string
          id: number
          new_slug: string
          old_slug: string
          recipe_id: number
        }
        Insert: {
          created_at?: string
          id?: never
          new_slug: string
          old_slug: string
          recipe_id: number
        }
        Update: {
          created_at?: string
          id?: never
          new_slug?: string
          old_slug?: string
          recipe_id?: number
        }
        Relationships: []
      }
      recipes: {
        Row: {
          category: Database["public"]["Enums"]["recipe_category"]
          cook_time_minutes: number | null
          created_at: string
          description: string | null
          dish: string | null
          dish_accusative: string | null
          dish_classified_at: string | null
          extracted_at: string | null
          id: number
          image_url: string | null
          image_urls: string[]
          ingredient_fingerprint: string | null
          ingredients: Json
          meta_description: string | null
          prep_time_minutes: number | null
          servings: number | null
          slug: string
          source_author: string | null
          source_fingerprint: string | null
          source_type: Database["public"]["Enums"]["recipe_source"]
          source_url: string | null
          step_images: string[]
          steps: Json
          tags: string[]
          times_estimated: boolean
          title: string
          total_time_minutes: number | null
          updated_at: string
          user_id: string
          variant_note: string | null
          youtube_id: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["recipe_category"]
          cook_time_minutes?: number | null
          created_at?: string
          description?: string | null
          dish?: string | null
          dish_accusative?: string | null
          dish_classified_at?: string | null
          extracted_at?: string | null
          id?: number
          image_url?: string | null
          image_urls?: string[]
          ingredient_fingerprint?: string | null
          ingredients?: Json
          meta_description?: string | null
          prep_time_minutes?: number | null
          servings?: number | null
          slug: string
          source_author?: string | null
          source_fingerprint?: string | null
          source_type: Database["public"]["Enums"]["recipe_source"]
          source_url?: string | null
          step_images?: string[]
          steps?: Json
          tags?: string[]
          times_estimated?: boolean
          title: string
          total_time_minutes?: number | null
          updated_at?: string
          user_id: string
          variant_note?: string | null
          youtube_id?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["recipe_category"]
          cook_time_minutes?: number | null
          created_at?: string
          description?: string | null
          dish?: string | null
          dish_accusative?: string | null
          dish_classified_at?: string | null
          extracted_at?: string | null
          id?: number
          image_url?: string | null
          image_urls?: string[]
          ingredient_fingerprint?: string | null
          ingredients?: Json
          meta_description?: string | null
          prep_time_minutes?: number | null
          servings?: number | null
          slug?: string
          source_author?: string | null
          source_fingerprint?: string | null
          source_type?: Database["public"]["Enums"]["recipe_source"]
          source_url?: string | null
          step_images?: string[]
          steps?: Json
          tags?: string[]
          times_estimated?: boolean
          title?: string
          total_time_minutes?: number | null
          updated_at?: string
          user_id?: string
          variant_note?: string | null
          youtube_id?: string | null
        }
        Relationships: []
      }
      recipes_merged_duplicates: {
        Row: {
          canonical_id: number
          category: Database["public"]["Enums"]["recipe_category"] | null
          cook_time_minutes: number | null
          created_at: string | null
          description: string | null
          extracted_at: string | null
          id: number | null
          image_url: string | null
          image_urls: string[] | null
          ingredients: Json | null
          merge_id: string
          merged_at: string
          meta_description: string | null
          prep_time_minutes: number | null
          row_data: Json
          slug: string | null
          source_author: string | null
          source_fingerprint: string | null
          source_type: Database["public"]["Enums"]["recipe_source"] | null
          source_url: string | null
          steps: Json | null
          tags: string[] | null
          times_estimated: boolean | null
          title: string | null
          total_time_minutes: number | null
          updated_at: string | null
          user_id: string | null
          youtube_id: string | null
        }
        Insert: {
          canonical_id: number
          category?: Database["public"]["Enums"]["recipe_category"] | null
          cook_time_minutes?: number | null
          created_at?: string | null
          description?: string | null
          extracted_at?: string | null
          id?: number | null
          image_url?: string | null
          image_urls?: string[] | null
          ingredients?: Json | null
          merge_id: string
          merged_at?: string
          meta_description?: string | null
          prep_time_minutes?: number | null
          row_data: Json
          slug?: string | null
          source_author?: string | null
          source_fingerprint?: string | null
          source_type?: Database["public"]["Enums"]["recipe_source"] | null
          source_url?: string | null
          steps?: Json | null
          tags?: string[] | null
          times_estimated?: boolean | null
          title?: string | null
          total_time_minutes?: number | null
          updated_at?: string | null
          user_id?: string | null
          youtube_id?: string | null
        }
        Update: {
          canonical_id?: number
          category?: Database["public"]["Enums"]["recipe_category"] | null
          cook_time_minutes?: number | null
          created_at?: string | null
          description?: string | null
          extracted_at?: string | null
          id?: number | null
          image_url?: string | null
          image_urls?: string[] | null
          ingredients?: Json | null
          merge_id?: string
          merged_at?: string
          meta_description?: string | null
          prep_time_minutes?: number | null
          row_data?: Json
          slug?: string | null
          source_author?: string | null
          source_fingerprint?: string | null
          source_type?: Database["public"]["Enums"]["recipe_source"] | null
          source_url?: string | null
          steps?: Json | null
          tags?: string[] | null
          times_estimated?: boolean | null
          title?: string | null
          total_time_minutes?: number | null
          updated_at?: string | null
          user_id?: string | null
          youtube_id?: string | null
        }
        Relationships: []
      }
      staff_audit_log: {
        Row: {
          actor_id: string
          after: Json | null
          before: Json | null
          created_at: string
          id: number
          operation: string
          resource: string
          target_id: string | null
          token_id: number | null
          via: string
        }
        Insert: {
          actor_id: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: never
          operation: string
          resource: string
          target_id?: string | null
          token_id?: number | null
          via: string
        }
        Update: {
          actor_id?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: never
          operation?: string
          resource?: string
          target_id?: string | null
          token_id?: number | null
          via?: string
        }
        Relationships: []
      }
      staff_role_permissions: {
        Row: {
          permission: string
          role: string
        }
        Insert: {
          permission: string
          role: string
        }
        Update: {
          permission?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_role_permissions_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "staff_roles"
            referencedColumns: ["name"]
          },
        ]
      }
      staff_roles: {
        Row: {
          description: string | null
          name: string
        }
        Insert: {
          description?: string | null
          name: string
        }
        Update: {
          description?: string | null
          name?: string
        }
        Relationships: []
      }
      user_full_access: {
        Row: {
          code_id: number | null
          granted_at: string
          source: string
          user_id: string
        }
        Insert: {
          code_id?: number | null
          granted_at?: string
          source: string
          user_id: string
        }
        Update: {
          code_id?: number | null
          granted_at?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_full_access_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "access_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          role: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          role: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "staff_roles"
            referencedColumns: ["name"]
          },
        ]
      }
    }
    Views: {
      public_recipes: {
        Row: {
          author_gender_form: string | null
          author_name: string | null
          author_username: string | null
          category: Database["public"]["Enums"]["recipe_category"] | null
          cook_time_minutes: number | null
          created_at: string | null
          description: string | null
          dish: string | null
          dish_accusative: string | null
          gallery_count: number | null
          id: number | null
          image_url: string | null
          ingredients: Json | null
          last_modified: string | null
          meta_description: string | null
          prep_time_minutes: number | null
          servings: number | null
          slug: string | null
          source_author: string | null
          source_type: Database["public"]["Enums"]["recipe_source"] | null
          source_url: string | null
          step_images: string[] | null
          steps: Json | null
          tags: string[] | null
          times_estimated: boolean | null
          title: string | null
          total_time_minutes: number | null
          variant_note: string | null
          youtube_id: string | null
        }
        Relationships: []
      }
      recipe_gallery_images: {
        Row: {
          id: number | null
          image_urls: string[] | null
        }
        Insert: {
          id?: number | null
          image_urls?: string[] | null
        }
        Update: {
          id?: number | null
          image_urls?: string[] | null
        }
        Relationships: []
      }
    }
    Functions: {
      access_code_hash: { Args: { p_code: string }; Returns: string }
      access_code_normalize: { Args: { p_code: string }; Returns: string }
      admin_block_user: {
        Args: { p_reason?: string; p_user: string }
        Returns: undefined
      }
      admin_block_user_as: {
        Args: {
          p_actor: string
          p_reason?: string
          p_token_id?: number
          p_user: string
          p_via?: string
        }
        Returns: undefined
      }
      admin_create_access_code: {
        Args: { p_expires_at?: string; p_max_uses?: number; p_note?: string }
        Returns: string
      }
      admin_create_access_code_as: {
        Args: {
          p_actor: string
          p_expires_at?: string
          p_max_uses?: number
          p_note?: string
          p_token_id?: number
          p_via?: string
        }
        Returns: string
      }
      admin_delete_user: { Args: { p_user: string }; Returns: undefined }
      admin_delete_user_as: {
        Args: {
          p_actor: string
          p_token_id?: number
          p_user: string
          p_via?: string
        }
        Returns: undefined
      }
      admin_get_user: {
        Args: { p_user: string }
        Returns: Database["public"]["CompositeTypes"]["admin_user_row"][]
        SetofOptions: {
          from: "*"
          to: "admin_user_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_get_user_as: {
        Args: { p_actor: string; p_user: string }
        Returns: Database["public"]["CompositeTypes"]["admin_user_row"][]
        SetofOptions: {
          from: "*"
          to: "admin_user_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_import_dispatch_failed: {
        Args: { p_share: number }
        Returns: undefined
      }
      admin_import_dispatch_failed_as: {
        Args: {
          p_actor: string
          p_share: number
          p_token_id?: number
          p_via?: string
        }
        Returns: undefined
      }
      admin_list_access_codes: {
        Args: { p_limit?: number }
        Returns: Database["public"]["CompositeTypes"]["admin_access_code_row"][]
        SetofOptions: {
          from: "*"
          to: "admin_access_code_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_access_codes_as: {
        Args: { p_actor: string; p_limit?: number }
        Returns: Database["public"]["CompositeTypes"]["admin_access_code_row"][]
        SetofOptions: {
          from: "*"
          to: "admin_access_code_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_audit: {
        Args: {
          p_before_id?: number
          p_filter_actor?: string
          p_from?: string
          p_limit?: number
          p_resource?: string
          p_to?: string
        }
        Returns: {
          actor_id: string
          after: Json | null
          before: Json | null
          created_at: string
          id: number
          operation: string
          resource: string
          target_id: string | null
          token_id: number | null
          via: string
        }[]
        SetofOptions: {
          from: "*"
          to: "staff_audit_log"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_audit_as: {
        Args: {
          p_actor: string
          p_before_id?: number
          p_filter_actor?: string
          p_from?: string
          p_limit?: number
          p_resource?: string
          p_to?: string
        }
        Returns: {
          actor_id: string
          after: Json | null
          before: Json | null
          created_at: string
          id: number
          operation: string
          resource: string
          target_id: string | null
          token_id: number | null
          via: string
        }[]
        SetofOptions: {
          from: "*"
          to: "staff_audit_log"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_imports: {
        Args: { p_before_id?: number; p_limit?: number; p_status?: string }
        Returns: Database["public"]["CompositeTypes"]["admin_import_row"][]
        SetofOptions: {
          from: "*"
          to: "admin_import_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_imports_as: {
        Args: {
          p_actor: string
          p_before_id?: number
          p_limit?: number
          p_status?: string
        }
        Returns: Database["public"]["CompositeTypes"]["admin_import_row"][]
        SetofOptions: {
          from: "*"
          to: "admin_import_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_roles: {
        Args: never
        Returns: Database["public"]["CompositeTypes"]["admin_role_row"][]
        SetofOptions: {
          from: "*"
          to: "admin_role_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_roles_as: {
        Args: { p_actor: string }
        Returns: Database["public"]["CompositeTypes"]["admin_role_row"][]
        SetofOptions: {
          from: "*"
          to: "admin_role_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_staff: {
        Args: never
        Returns: Database["public"]["CompositeTypes"]["admin_staff_row"][]
        SetofOptions: {
          from: "*"
          to: "admin_staff_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_staff_as: {
        Args: { p_actor: string }
        Returns: Database["public"]["CompositeTypes"]["admin_staff_row"][]
        SetofOptions: {
          from: "*"
          to: "admin_staff_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_users: {
        Args: {
          p_after_created?: string
          p_after_id?: string
          p_limit?: number
          p_query?: string
        }
        Returns: Database["public"]["CompositeTypes"]["admin_user_row"][]
        SetofOptions: {
          from: "*"
          to: "admin_user_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_users_as: {
        Args: {
          p_actor: string
          p_after_created?: string
          p_after_id?: string
          p_limit?: number
          p_query?: string
        }
        Returns: Database["public"]["CompositeTypes"]["admin_user_row"][]
        SetofOptions: {
          from: "*"
          to: "admin_user_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_retry_import: { Args: { p_share: number }; Returns: Json }
      admin_retry_import_as: {
        Args: {
          p_actor: string
          p_share: number
          p_token_id?: number
          p_via?: string
        }
        Returns: Json
      }
      admin_set_full_access: {
        Args: { p_on: boolean; p_user: string }
        Returns: undefined
      }
      admin_set_full_access_as: {
        Args: {
          p_actor: string
          p_on: boolean
          p_token_id?: number
          p_user: string
          p_via?: string
        }
        Returns: undefined
      }
      admin_set_role: {
        Args: { p_on: boolean; p_role: string; p_user: string }
        Returns: undefined
      }
      admin_set_role_as: {
        Args: {
          p_actor: string
          p_on: boolean
          p_role: string
          p_token_id?: number
          p_user: string
          p_via?: string
        }
        Returns: undefined
      }
      admin_unblock_user: { Args: { p_user: string }; Returns: undefined }
      admin_unblock_user_as: {
        Args: {
          p_actor: string
          p_token_id?: number
          p_user: string
          p_via?: string
        }
        Returns: undefined
      }
      admin_user_rows: {
        Args: {
          p_actor: string
          p_after_created: string
          p_after_id: string
          p_limit: number
          p_query: string
          p_user: string
        }
        Returns: Database["public"]["CompositeTypes"]["admin_user_row"][]
        SetofOptions: {
          from: "*"
          to: "admin_user_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_user_target_check: {
        Args: { p_actor: string; p_permission: string; p_user: string }
        Returns: undefined
      }
      assert_admin_access_grants: { Args: never; Returns: undefined }
      assert_admin_imports_grants: { Args: never; Returns: undefined }
      assert_admin_roles_grants: { Args: never; Returns: undefined }
      assert_admin_users_grants: { Args: never; Returns: undefined }
      assert_public_view_boundary: { Args: never; Returns: undefined }
      assert_staff_audit_grants: { Args: never; Returns: undefined }
      assert_staff_grants: { Args: never; Returns: undefined }
      category_tag_facets: {
        Args: {
          p_category: Database["public"]["Enums"]["recipe_category"]
          p_selected?: string[]
        }
        Returns: {
          count: number
          tag: string
        }[]
      }
      collapse_recipe_group: {
        Args: {
          p_canonical_id: number
          p_loser_ids: number[]
          p_merge_id: string
        }
        Returns: undefined
      }
      collapse_recipe_groups: {
        Args: { p_groups: Json; p_merge_id: string }
        Returns: number
      }
      create_access_code: {
        Args: {
          p_code: string
          p_expires_at?: string
          p_max_uses?: number
          p_note?: string
        }
        Returns: number
      }
      current_user_id: { Args: never; Returns: string }
      dish_versions: {
        Args: { p_recipe_id: number }
        Returns: {
          cook_time_minutes: number
          created_at: string
          favorites_count: number
          id: number
          image_url: string
          ingredients: Json
          prep_time_minutes: number
          servings: number
          slug: string
          source_author: string
          source_type: Database["public"]["Enums"]["recipe_source"]
          source_url: string
          times_estimated: boolean
          title: string
          total_count: number
          total_time_minutes: number
          variant_note: string
        }[]
      }
      dish_vocabulary: {
        Args: never
        Returns: {
          dish: string
          dish_accusative: string
          recipes: number
        }[]
      }
      generate_username: { Args: { base: string }; Returns: string }
      has_full_access: { Args: never; Returns: boolean }
      has_permission: { Args: { p_permission: string }; Returns: boolean }
      my_permissions: { Args: never; Returns: string[] }
      normalize_url: { Args: { raw: string }; Returns: string }
      profile_display_name: { Args: { meta: Json }; Returns: string }
      profile_gender_form: { Args: { p_username: string }; Returns: string }
      profile_username_base: { Args: { meta: Json }; Returns: string }
      recipe_category_context: {
        Args: { p_id: number }
        Returns: {
          category: Database["public"]["Enums"]["recipe_category"]
          idx: number
          next: Json
          prev: Json
          total: number
        }[]
      }
      recipe_search_text: {
        Args: { p_ingredients: Json; p_title: string }
        Returns: string
      }
      redeem_access_code: { Args: { p_code: string }; Returns: string }
      restore_recipe_merge: { Args: { p_merge_id: string }; Returns: number }
      search_recipes: {
        Args: { p_limit?: number; p_query: string; p_scope?: string }
        Returns: {
          category: Database["public"]["Enums"]["recipe_category"]
          cook_time_minutes: number
          created_at: string
          description: string
          id: number
          image_url: string
          prep_time_minutes: number
          slug: string
          source_author: string
          source_type: Database["public"]["Enums"]["recipe_source"]
          source_url: string
          title: string
          total_count: number
          total_time_minutes: number
        }[]
      }
      set_first_name: { Args: { p_first_name: string }; Returns: string }
      set_gender: { Args: { p_gender: string }; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      staff_audit: {
        Args: {
          p_actor: string
          p_after?: Json
          p_before?: Json
          p_operation: string
          p_resource: string
          p_target_id: string
          p_token_id: number
          p_via: string
        }
        Returns: number
      }
      staff_can: {
        Args: { p_actor: string; p_permission: string }
        Returns: boolean
      }
    }
    Enums: {
      recipe_category:
        | "obiady"
        | "zupy"
        | "desery"
        | "ciasta"
        | "ciasteczka"
        | "sniadania"
        | "pieczywo"
        | "przekaski"
        | "salatki"
        | "napoje"
        | "syropy"
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
      admin_access_code_row: {
        id: number | null
        note: string | null
        max_uses: number | null
        use_count: number | null
        expires_at: string | null
        created_at: string | null
        state: string | null
      }
      admin_import_row: {
        share_id: number | null
        user_id: string | null
        username: string | null
        display_name: string | null
        shared_url: string | null
        status: string | null
        error_message: string | null
        attempts: number | null
        created_at: string | null
        updated_at: string | null
        recipe_id: number | null
        stuck: boolean | null
      }
      admin_role_row: {
        name: string | null
        description: string | null
        permissions: string[] | null
      }
      admin_staff_row: {
        user_id: string | null
        username: string | null
        display_name: string | null
        roles: string[] | null
        granted_at: string | null
      }
      admin_user_row: {
        user_id: string | null
        username: string | null
        display_name: string | null
        email: string | null
        created_at: string | null
        last_sign_in_at: string | null
        banned_until: string | null
        provider: string | null
        recipe_count: number | null
        favorite_count: number | null
        full_access: boolean | null
        roles: string[] | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
        "ciasta",
        "ciasteczka",
        "sniadania",
        "pieczywo",
        "przekaski",
        "salatki",
        "napoje",
        "syropy",
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
