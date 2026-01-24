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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      chapters: {
        Row: {
          chat_dialogue: Json | null
          chat_dialogue_en: Json | null
          chat_dialogue_pl: Json | null
          cover_image_prompt: string | null
          cover_image_prompt_2: string | null
          cover_image_prompt_3: string | null
          cover_image_url: string | null
          cover_image_url_2: string | null
          cover_image_url_3: string | null
          created_at: string | null
          description: string | null
          description_en: string | null
          description_pl: string | null
          id: string
          narrator_commentary: string | null
          narrator_commentary_en: string | null
          narrator_commentary_pl: string | null
          narrator_monologue: string | null
          narrator_monologue_en: string | null
          narrator_monologue_pl: string | null
          number: number
          seo_description: string | null
          seo_keywords: string[] | null
          seo_title: string | null
          title: string
          title_en: string | null
          title_pl: string | null
          tweets: Json | null
          tweets_en: Json | null
          tweets_pl: Json | null
          updated_at: string | null
          volume_id: string
          week_of_month: number
        }
        Insert: {
          chat_dialogue?: Json | null
          chat_dialogue_en?: Json | null
          chat_dialogue_pl?: Json | null
          cover_image_prompt?: string | null
          cover_image_prompt_2?: string | null
          cover_image_prompt_3?: string | null
          cover_image_url?: string | null
          cover_image_url_2?: string | null
          cover_image_url_3?: string | null
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          description_pl?: string | null
          id?: string
          narrator_commentary?: string | null
          narrator_commentary_en?: string | null
          narrator_commentary_pl?: string | null
          narrator_monologue?: string | null
          narrator_monologue_en?: string | null
          narrator_monologue_pl?: string | null
          number: number
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          title: string
          title_en?: string | null
          title_pl?: string | null
          tweets?: Json | null
          tweets_en?: Json | null
          tweets_pl?: Json | null
          updated_at?: string | null
          volume_id: string
          week_of_month: number
        }
        Update: {
          chat_dialogue?: Json | null
          chat_dialogue_en?: Json | null
          chat_dialogue_pl?: Json | null
          cover_image_prompt?: string | null
          cover_image_prompt_2?: string | null
          cover_image_prompt_3?: string | null
          cover_image_url?: string | null
          cover_image_url_2?: string | null
          cover_image_url_3?: string | null
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          description_pl?: string | null
          id?: string
          narrator_commentary?: string | null
          narrator_commentary_en?: string | null
          narrator_commentary_pl?: string | null
          narrator_monologue?: string | null
          narrator_monologue_en?: string | null
          narrator_monologue_pl?: string | null
          number?: number
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          title?: string
          title_en?: string | null
          title_pl?: string | null
          tweets?: Json | null
          tweets_en?: Json | null
          tweets_pl?: Json | null
          updated_at?: string | null
          volume_id?: string
          week_of_month?: number
        }
        Relationships: [
          {
            foreignKeyName: "chapters_volume_id_fkey"
            columns: ["volume_id"]
            isOneToOne: false
            referencedRelation: "volumes"
            referencedColumns: ["id"]
          },
        ]
      }
      character_relationships: {
        Row: {
          character_id: string
          created_at: string | null
          description: string | null
          id: string
          related_character_id: string
          relationship_type: string
          strength: number
          updated_at: string | null
        }
        Insert: {
          character_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          related_character_id: string
          relationship_type: string
          strength?: number
          updated_at?: string | null
        }
        Update: {
          character_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          related_character_id?: string
          relationship_type?: string
          strength?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "character_relationships_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_relationships_related_character_id_fkey"
            columns: ["related_character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          avatar: string
          character_id: string
          created_at: string | null
          description: string | null
          dialogue_count: number
          id: string
          is_active: boolean | null
          last_dialogue_at: string | null
          name: string
          style: string
          total_likes: number
          updated_at: string | null
        }
        Insert: {
          avatar?: string
          character_id: string
          created_at?: string | null
          description?: string | null
          dialogue_count?: number
          id?: string
          is_active?: boolean | null
          last_dialogue_at?: string | null
          name: string
          style: string
          total_likes?: number
          updated_at?: string | null
        }
        Update: {
          avatar?: string
          character_id?: string
          created_at?: string | null
          description?: string | null
          dialogue_count?: number
          id?: string
          is_active?: boolean | null
          last_dialogue_at?: string | null
          name?: string
          style?: string
          total_likes?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      daily_views: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          view_date: string
          views: number
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          view_date?: string
          views?: number
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          view_date?: string
          views?: number
        }
        Relationships: []
      }
      generations: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          model_used: string | null
          news_used: Json | null
          part_id: string | null
          prompt: string | null
          result: string | null
          success: boolean | null
          type: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          model_used?: string | null
          news_used?: Json | null
          part_id?: string | null
          prompt?: string | null
          result?: string | null
          success?: boolean | null
          type: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          model_used?: string | null
          news_used?: Json | null
          part_id?: string | null
          prompt?: string | null
          result?: string | null
          success?: boolean | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "generations_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      news_items: {
        Row: {
          category: string | null
          content: string | null
          description: string | null
          external_id: string | null
          fetched_at: string | null
          id: string
          image_url: string | null
          part_id: string | null
          published_at: string | null
          source_name: string | null
          source_url: string | null
          title: string
          url: string
          used_for_part_id: string | null
          used_in_generation: boolean | null
        }
        Insert: {
          category?: string | null
          content?: string | null
          description?: string | null
          external_id?: string | null
          fetched_at?: string | null
          id?: string
          image_url?: string | null
          part_id?: string | null
          published_at?: string | null
          source_name?: string | null
          source_url?: string | null
          title: string
          url: string
          used_for_part_id?: string | null
          used_in_generation?: boolean | null
        }
        Update: {
          category?: string | null
          content?: string | null
          description?: string | null
          external_id?: string | null
          fetched_at?: string | null
          id?: string
          image_url?: string | null
          part_id?: string | null
          published_at?: string | null
          source_name?: string | null
          source_url?: string | null
          title?: string
          url?: string
          used_for_part_id?: string | null
          used_in_generation?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "news_items_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_items_used_for_part_id_fkey"
            columns: ["used_for_part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
        ]
      }
      parts: {
        Row: {
          chapter_id: string
          chat_dialogue: Json | null
          chat_dialogue_en: Json | null
          chat_dialogue_pl: Json | null
          content: string
          content_en: string | null
          content_html: string | null
          content_pl: string | null
          cover_image_prompt: string | null
          cover_image_prompt_2: string | null
          cover_image_type: string | null
          cover_image_url: string | null
          cover_image_url_2: string | null
          created_at: string | null
          date: string
          id: string
          is_flash_news: boolean
          narrative_plot: Database["public"]["Enums"]["narrative_plot"] | null
          narrative_purpose:
            | Database["public"]["Enums"]["narrative_purpose"]
            | null
          narrative_source:
            | Database["public"]["Enums"]["narrative_source"]
            | null
          narrative_special:
            | Database["public"]["Enums"]["narrative_special"]
            | null
          narrative_structure:
            | Database["public"]["Enums"]["narrative_structure"]
            | null
          news_sources: Json | null
          number: number
          published_at: string | null
          scheduled_at: string | null
          seo_description: string | null
          seo_keywords: string[] | null
          seo_title: string | null
          status: Database["public"]["Enums"]["story_status"] | null
          title: string
          title_en: string | null
          title_pl: string | null
          tweets: Json | null
          tweets_en: Json | null
          tweets_pl: Json | null
          updated_at: string | null
        }
        Insert: {
          chapter_id: string
          chat_dialogue?: Json | null
          chat_dialogue_en?: Json | null
          chat_dialogue_pl?: Json | null
          content?: string
          content_en?: string | null
          content_html?: string | null
          content_pl?: string | null
          cover_image_prompt?: string | null
          cover_image_prompt_2?: string | null
          cover_image_type?: string | null
          cover_image_url?: string | null
          cover_image_url_2?: string | null
          created_at?: string | null
          date: string
          id?: string
          is_flash_news?: boolean
          narrative_plot?: Database["public"]["Enums"]["narrative_plot"] | null
          narrative_purpose?:
            | Database["public"]["Enums"]["narrative_purpose"]
            | null
          narrative_source?:
            | Database["public"]["Enums"]["narrative_source"]
            | null
          narrative_special?:
            | Database["public"]["Enums"]["narrative_special"]
            | null
          narrative_structure?:
            | Database["public"]["Enums"]["narrative_structure"]
            | null
          news_sources?: Json | null
          number: number
          published_at?: string | null
          scheduled_at?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          status?: Database["public"]["Enums"]["story_status"] | null
          title: string
          title_en?: string | null
          title_pl?: string | null
          tweets?: Json | null
          tweets_en?: Json | null
          tweets_pl?: Json | null
          updated_at?: string | null
        }
        Update: {
          chapter_id?: string
          chat_dialogue?: Json | null
          chat_dialogue_en?: Json | null
          chat_dialogue_pl?: Json | null
          content?: string
          content_en?: string | null
          content_html?: string | null
          content_pl?: string | null
          cover_image_prompt?: string | null
          cover_image_prompt_2?: string | null
          cover_image_type?: string | null
          cover_image_url?: string | null
          cover_image_url_2?: string | null
          created_at?: string | null
          date?: string
          id?: string
          is_flash_news?: boolean
          narrative_plot?: Database["public"]["Enums"]["narrative_plot"] | null
          narrative_purpose?:
            | Database["public"]["Enums"]["narrative_purpose"]
            | null
          narrative_source?:
            | Database["public"]["Enums"]["narrative_source"]
            | null
          narrative_special?:
            | Database["public"]["Enums"]["narrative_special"]
            | null
          narrative_structure?:
            | Database["public"]["Enums"]["narrative_structure"]
            | null
          news_sources?: Json | null
          number?: number
          published_at?: string | null
          scheduled_at?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          status?: Database["public"]["Enums"]["story_status"] | null
          title?: string
          title_en?: string | null
          title_pl?: string | null
          tweets?: Json | null
          tweets_en?: Json | null
          tweets_pl?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parts_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          anthropic_api_key: string | null
          auto_generation_enabled: boolean | null
          bradbury_weight: number | null
          clarke_weight: number | null
          created_at: string | null
          gaiman_weight: number | null
          gemini_api_key: string | null
          generation_interval_hours: number | null
          id: string
          last_auto_generation: string | null
          llm_image_model: string | null
          llm_image_provider: string | null
          llm_provider: string | null
          llm_text_model: string | null
          llm_text_provider: string | null
          narrative_plot: Database["public"]["Enums"]["narrative_plot"] | null
          narrative_purpose:
            | Database["public"]["Enums"]["narrative_purpose"]
            | null
          narrative_source:
            | Database["public"]["Enums"]["narrative_source"]
            | null
          narrative_special:
            | Database["public"]["Enums"]["narrative_special"]
            | null
          narrative_structure:
            | Database["public"]["Enums"]["narrative_structure"]
            | null
          openai_api_key: string | null
          updated_at: string | null
        }
        Insert: {
          anthropic_api_key?: string | null
          auto_generation_enabled?: boolean | null
          bradbury_weight?: number | null
          clarke_weight?: number | null
          created_at?: string | null
          gaiman_weight?: number | null
          gemini_api_key?: string | null
          generation_interval_hours?: number | null
          id?: string
          last_auto_generation?: string | null
          llm_image_model?: string | null
          llm_image_provider?: string | null
          llm_provider?: string | null
          llm_text_model?: string | null
          llm_text_provider?: string | null
          narrative_plot?: Database["public"]["Enums"]["narrative_plot"] | null
          narrative_purpose?:
            | Database["public"]["Enums"]["narrative_purpose"]
            | null
          narrative_source?:
            | Database["public"]["Enums"]["narrative_source"]
            | null
          narrative_special?:
            | Database["public"]["Enums"]["narrative_special"]
            | null
          narrative_structure?:
            | Database["public"]["Enums"]["narrative_structure"]
            | null
          openai_api_key?: string | null
          updated_at?: string | null
        }
        Update: {
          anthropic_api_key?: string | null
          auto_generation_enabled?: boolean | null
          bradbury_weight?: number | null
          clarke_weight?: number | null
          created_at?: string | null
          gaiman_weight?: number | null
          gemini_api_key?: string | null
          generation_interval_hours?: number | null
          id?: string
          last_auto_generation?: string | null
          llm_image_model?: string | null
          llm_image_provider?: string | null
          llm_provider?: string | null
          llm_text_model?: string | null
          llm_text_provider?: string | null
          narrative_plot?: Database["public"]["Enums"]["narrative_plot"] | null
          narrative_purpose?:
            | Database["public"]["Enums"]["narrative_purpose"]
            | null
          narrative_source?:
            | Database["public"]["Enums"]["narrative_source"]
            | null
          narrative_special?:
            | Database["public"]["Enums"]["narrative_special"]
            | null
          narrative_structure?:
            | Database["public"]["Enums"]["narrative_structure"]
            | null
          openai_api_key?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      view_counts: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          unique_visitors: number
          updated_at: string
          views: number
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          unique_visitors?: number
          updated_at?: string
          views?: number
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          unique_visitors?: number
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      volumes: {
        Row: {
          cover_image_prompt: string | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          description_en: string | null
          description_pl: string | null
          id: string
          month: number
          number: number
          summary: string | null
          summary_en: string | null
          summary_pl: string | null
          title: string
          title_en: string | null
          title_pl: string | null
          updated_at: string | null
          year: number
        }
        Insert: {
          cover_image_prompt?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          description_pl?: string | null
          id?: string
          month: number
          number: number
          summary?: string | null
          summary_en?: string | null
          summary_pl?: string | null
          title: string
          title_en?: string | null
          title_pl?: string | null
          updated_at?: string | null
          year: number
        }
        Update: {
          cover_image_prompt?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          description_pl?: string | null
          id?: string
          month?: number
          number?: number
          summary?: string | null
          summary_en?: string | null
          summary_pl?: string | null
          title?: string
          title_en?: string | null
          title_pl?: string | null
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      narrative_plot:
        | "overcoming_monster"
        | "rags_to_riches"
        | "quest"
        | "comedy"
        | "tragedy"
        | "resurrection"
        | "forbidden"
        | "mystery"
      narrative_purpose:
        | "informational"
        | "evaluative"
        | "artistic"
        | "instructive"
        | "identificational"
      narrative_source: "author" | "character" | "inconspicuous" | "polyphonic"
      narrative_special:
        | "conspiratorial"
        | "transmedia"
        | "personal"
        | "corporate"
        | "escapist"
        | "propaganda"
      narrative_structure:
        | "linear"
        | "retrospective"
        | "flashforward"
        | "circular"
        | "parallel"
        | "episodic"
      story_status: "draft" | "scheduled" | "published"
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
      narrative_plot: [
        "overcoming_monster",
        "rags_to_riches",
        "quest",
        "comedy",
        "tragedy",
        "resurrection",
        "forbidden",
        "mystery",
      ],
      narrative_purpose: [
        "informational",
        "evaluative",
        "artistic",
        "instructive",
        "identificational",
      ],
      narrative_source: ["author", "character", "inconspicuous", "polyphonic"],
      narrative_special: [
        "conspiratorial",
        "transmedia",
        "personal",
        "corporate",
        "escapist",
        "propaganda",
      ],
      narrative_structure: [
        "linear",
        "retrospective",
        "flashforward",
        "circular",
        "parallel",
        "episodic",
      ],
      story_status: ["draft", "scheduled", "published"],
    },
  },
} as const
