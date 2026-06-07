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
      airframes: {
        Row: {
          created_at: string
          cruise_speed_mph: number
          endurance_min: number
          id: string
          manufacturer: string | null
          model: string
          notes: string | null
          range_mi: number
          retardant_capacity_l: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          cruise_speed_mph?: number
          endurance_min?: number
          id?: string
          manufacturer?: string | null
          model: string
          notes?: string | null
          range_mi?: number
          retardant_capacity_l?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          cruise_speed_mph?: number
          endurance_min?: number
          id?: string
          manufacturer?: string | null
          model?: string
          notes?: string | null
          range_mi?: number
          retardant_capacity_l?: number
          updated_at?: string
        }
        Relationships: []
      }
      bases: {
        Row: {
          city: string | null
          code: string
          created_at: string
          hangar_capacity: number
          id: string
          is_hq: boolean
          lat: number
          lng: number
          name: string
          notes: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          code: string
          created_at?: string
          hangar_capacity?: number
          id?: string
          is_hq?: boolean
          lat: number
          lng: number
          name: string
          notes?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          code?: string
          created_at?: string
          hangar_capacity?: number
          id?: string
          is_hq?: boolean
          lat?: number
          lng?: number
          name?: string
          notes?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      detection_area: {
        Row: {
          center_lat: number
          center_lng: number
          counties: string[]
          id: boolean
          radius_mi: number
          states: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          center_lat?: number
          center_lng?: number
          counties?: string[]
          id?: boolean
          radius_mi?: number
          states?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          center_lat?: number
          center_lng?: number
          counties?: string[]
          id?: boolean
          radius_mi?: number
          states?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      drones: {
        Row: {
          airframe_id: string | null
          base_id: string | null
          battery_pct: number
          created_at: string
          flight_hours: number
          heading_deg: number | null
          id: string
          last_lat: number | null
          last_lng: number | null
          last_telemetry_at: string | null
          next_service_at: string | null
          notes: string | null
          retardant_l: number
          status: Database["public"]["Enums"]["drone_status"]
          tail_number: string
          updated_at: string
        }
        Insert: {
          airframe_id?: string | null
          base_id?: string | null
          battery_pct?: number
          created_at?: string
          flight_hours?: number
          heading_deg?: number | null
          id?: string
          last_lat?: number | null
          last_lng?: number | null
          last_telemetry_at?: string | null
          next_service_at?: string | null
          notes?: string | null
          retardant_l?: number
          status?: Database["public"]["Enums"]["drone_status"]
          tail_number: string
          updated_at?: string
        }
        Update: {
          airframe_id?: string | null
          base_id?: string | null
          battery_pct?: number
          created_at?: string
          flight_hours?: number
          heading_deg?: number | null
          id?: string
          last_lat?: number | null
          last_lng?: number | null
          last_telemetry_at?: string | null
          next_service_at?: string | null
          notes?: string | null
          retardant_l?: number
          status?: Database["public"]["Enums"]["drone_status"]
          tail_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drones_airframe_id_fkey"
            columns: ["airframe_id"]
            isOneToOne: false
            referencedRelation: "airframes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drones_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_events: {
        Row: {
          actor: string | null
          created_at: string
          event_type: string
          id: string
          incident_id: string
          message: string | null
          payload: Json | null
        }
        Insert: {
          actor?: string | null
          created_at?: string
          event_type: string
          id?: string
          incident_id: string
          message?: string | null
          payload?: Json | null
        }
        Update: {
          actor?: string | null
          created_at?: string
          event_type?: string
          id?: string
          incident_id?: string
          message?: string | null
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_suggestions: {
        Row: {
          camera_id: string | null
          camera_name: string | null
          confidence: number
          county: string | null
          created_at: string
          id: string
          image_time: string | null
          image_url: string | null
          incident_id: string | null
          label: Database["public"]["Enums"]["suggestion_label"]
          lat: number
          lng: number
          reasoning: string | null
          resolved_at: string | null
          resolved_by: string | null
          source: string
          state: string | null
          status: Database["public"]["Enums"]["suggestion_status"]
        }
        Insert: {
          camera_id?: string | null
          camera_name?: string | null
          confidence: number
          county?: string | null
          created_at?: string
          id?: string
          image_time?: string | null
          image_url?: string | null
          incident_id?: string | null
          label: Database["public"]["Enums"]["suggestion_label"]
          lat: number
          lng: number
          reasoning?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source: string
          state?: string | null
          status?: Database["public"]["Enums"]["suggestion_status"]
        }
        Update: {
          camera_id?: string | null
          camera_name?: string | null
          confidence?: number
          county?: string | null
          created_at?: string
          id?: string
          image_time?: string | null
          image_url?: string | null
          incident_id?: string | null
          label?: Database["public"]["Enums"]["suggestion_label"]
          lat?: number
          lng?: number
          reasoning?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          state?: string | null
          status?: Database["public"]["Enums"]["suggestion_status"]
        }
        Relationships: []
      }
      incidents: {
        Row: {
          acreage: number | null
          assigned_drone_id: string | null
          confidence: number | null
          county: string | null
          created_at: string
          created_by: string | null
          discovered_at: string
          external_id: string | null
          frp: number | null
          id: string
          lat: number
          lng: number
          notes: string | null
          priority: Database["public"]["Enums"]["incident_priority"]
          source: Database["public"]["Enums"]["incident_source"]
          state: string | null
          status: Database["public"]["Enums"]["incident_status"]
          title: string
          updated_at: string
        }
        Insert: {
          acreage?: number | null
          assigned_drone_id?: string | null
          confidence?: number | null
          county?: string | null
          created_at?: string
          created_by?: string | null
          discovered_at?: string
          external_id?: string | null
          frp?: number | null
          id?: string
          lat: number
          lng: number
          notes?: string | null
          priority?: Database["public"]["Enums"]["incident_priority"]
          source?: Database["public"]["Enums"]["incident_source"]
          state?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
          title: string
          updated_at?: string
        }
        Update: {
          acreage?: number | null
          assigned_drone_id?: string | null
          confidence?: number | null
          county?: string | null
          created_at?: string
          created_by?: string | null
          discovered_at?: string
          external_id?: string | null
          frp?: number | null
          id?: string
          lat?: number
          lng?: number
          notes?: string | null
          priority?: Database["public"]["Enums"]["incident_priority"]
          source?: Database["public"]["Enums"]["incident_source"]
          state?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_assigned_drone_id_fkey"
            columns: ["assigned_drone_id"]
            isOneToOne: false
            referencedRelation: "drones"
            referencedColumns: ["id"]
          },
        ]
      }
      muted_cameras: {
        Row: {
          camera_id: string
          camera_name: string | null
          created_at: string
          muted_by: string | null
          muted_until: string
          reason: string | null
        }
        Insert: {
          camera_id: string
          camera_name?: string | null
          created_at?: string
          muted_by?: string | null
          muted_until?: string
          reason?: string | null
        }
        Update: {
          camera_id?: string
          camera_name?: string | null
          created_at?: string
          muted_by?: string | null
          muted_until?: string
          reason?: string | null
        }
        Relationships: []
      }
      user_branding: {
        Row: {
          accent_color: string | null
          brand_name: string | null
          logo_data_url: string | null
          primary_color: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accent_color?: string | null
          brand_name?: string | null
          logo_data_url?: string | null
          primary_color?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accent_color?: string | null
          brand_name?: string | null
          logo_data_url?: string | null
          primary_color?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          display_name: string | null
          email: string | null
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
          user_id?: string
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
      approve_user: {
        Args: {
          _role?: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      claim_first_admin: { Args: never; Returns: undefined }
      deny_user: { Args: { _user_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "dispatcher" | "pilot" | "maintenance"
      drone_status:
        | "ready"
        | "preflight"
        | "inflight"
        | "returning"
        | "charging"
        | "maintenance"
        | "offline"
      incident_priority: "p1" | "p2" | "p3" | "p4"
      incident_source:
        | "alertwest"
        | "firms"
        | "nws"
        | "user"
        | "manual"
        | "other"
      incident_status:
        | "new"
        | "triaging"
        | "dispatched"
        | "onscene"
        | "contained"
        | "closed"
        | "false_positive"
      maint_kind: "scheduled" | "unscheduled" | "inspection"
      profile_status: "pending" | "approved" | "denied"
      suggestion_label: "smoke" | "fire" | "clear"
      suggestion_status: "pending" | "promoted" | "dismissed"
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
      app_role: ["admin", "dispatcher", "pilot", "maintenance"],
      drone_status: [
        "ready",
        "preflight",
        "inflight",
        "returning",
        "charging",
        "maintenance",
        "offline",
      ],
      incident_priority: ["p1", "p2", "p3", "p4"],
      incident_source: ["alertwest", "firms", "nws", "user", "manual", "other"],
      incident_status: [
        "new",
        "triaging",
        "dispatched",
        "onscene",
        "contained",
        "closed",
        "false_positive",
      ],
      maint_kind: ["scheduled", "unscheduled", "inspection"],
      profile_status: ["pending", "approved", "denied"],
      suggestion_label: ["smoke", "fire", "clear"],
      suggestion_status: ["pending", "promoted", "dismissed"],
    },
  },
} as const
