// Database types for Voypath - Exact mirror of Supabase schema
// Auto-generated types can be replaced here with: npx supabase gen types typescript

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          display_initials: string | null
          is_guest: boolean
          session_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          display_initials?: string | null
          is_guest?: boolean
          session_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          display_initials?: string | null
          is_guest?: boolean
          session_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      trip_groups: {
        Row: {
          id: string
          name: string | null
          description: string | null
          start_date: string | null
          end_date: string | null
          departure_location: string
          return_location: string | null
          departure_location_lat: number | null
          departure_location_lng: number | null
          auto_calculate_end_date: boolean
          preferences_deadline: string | null
          planning_deadline: string | null
          share_code: string | null
          share_link: string | null
          allow_order_change: string
          allow_destination_add: string
          order_change_members: string[] | null
          created_by: string | null
          created_at: string
          updated_at: string
          status: string
        }
        Insert: {
          id?: string
          name?: string | null
          description?: string | null
          start_date?: string | null
          end_date?: string | null
          departure_location: string
          return_location?: string | null
          departure_location_lat?: number | null
          departure_location_lng?: number | null
          auto_calculate_end_date?: boolean
          preferences_deadline?: string | null
          planning_deadline?: string | null
          share_code?: string | null
          share_link?: string | null
          allow_order_change?: string
          allow_destination_add?: string
          order_change_members?: string[] | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          status?: string
        }
        Update: {
          id?: string
          name?: string | null
          description?: string | null
          start_date?: string | null
          end_date?: string | null
          departure_location?: string
          return_location?: string | null
          departure_location_lat?: number | null
          departure_location_lng?: number | null
          auto_calculate_end_date?: boolean
          preferences_deadline?: string | null
          planning_deadline?: string | null
          share_code?: string | null
          share_link?: string | null
          allow_order_change?: string
          allow_destination_add?: string
          order_change_members?: string[] | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          status?: string
        }
      }
      pre_registered_participants: {
        Row: {
          id: string
          group_id: string
          name: string
          email: string | null
          is_joined: boolean
          joined_user_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          name: string
          email?: string | null
          is_joined?: boolean
          joined_user_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          name?: string
          email?: string | null
          is_joined?: boolean
          joined_user_id?: string | null
          created_at?: string
        }
      }
      group_members: {
        Row: {
          id: string
          group_id: string
          user_id: string | null
          participant_id: string | null
          display_name: string
          assigned_color: string
          role: string
          session_id: string | null
          joined_at: string
        }
        Insert: {
          id?: string
          group_id: string
          user_id?: string | null
          participant_id?: string | null
          display_name: string
          assigned_color: string
          role?: string
          session_id?: string | null
          joined_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          user_id?: string | null
          participant_id?: string | null
          display_name?: string
          assigned_color?: string
          role?: string
          session_id?: string | null
          joined_at?: string
        }
      }
      destinations: {
        Row: {
          id: string
          group_id: string
          name: string
          address: string | null
          latitude: number | null
          longitude: number | null
          place_id: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          name: string
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          place_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          name?: string
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          place_id?: string | null
          created_by?: string | null
          created_at?: string
        }
      }
      user_preferences: {
        Row: {
          id: string
          group_id: string
          user_id: string | null
          destination_id: string
          preference_score: number
          preferred_duration: number | null
          notes: string | null
          is_personal_favorite: boolean
          session_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          group_id: string
          user_id?: string | null
          destination_id: string
          preference_score: number
          preferred_duration?: number | null
          notes?: string | null
          is_personal_favorite?: boolean
          session_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          user_id?: string | null
          destination_id?: string
          preference_score?: number
          preferred_duration?: number | null
          notes?: string | null
          is_personal_favorite?: boolean
          session_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      optimized_routes: {
        Row: {
          id: string
          group_id: string
          route_data: Record<string, any>
          fairness_score: number | null
          total_distance: number | null
          total_duration: number | null
          created_at: string
          version: number
        }
        Insert: {
          id?: string
          group_id: string
          route_data: Record<string, any>
          fairness_score?: number | null
          total_distance?: number | null
          total_duration?: number | null
          created_at?: string
          version?: number
        }
        Update: {
          id?: string
          group_id?: string
          route_data?: Record<string, any>
          fairness_score?: number | null
          total_distance?: number | null
          total_duration?: number | null
          created_at?: string
          version?: number
        }
      }
      group_chat_messages: {
        Row: {
          id: string
          group_id: string
          user_id: string | null
          display_name: string
          message_text: string
          message_type: string
          session_id: string | null
          created_at: string
          updated_at: string
          is_deleted: boolean
        }
        Insert: {
          id?: string
          group_id: string
          user_id?: string | null
          display_name: string
          message_text: string
          message_type?: string
          session_id?: string | null
          created_at?: string
          updated_at?: string
          is_deleted?: boolean
        }
        Update: {
          id?: string
          group_id?: string
          user_id?: string | null
          display_name?: string
          message_text?: string
          message_type?: string
          session_id?: string | null
          created_at?: string
          updated_at?: string
          is_deleted?: boolean
        }
      }
      user_settings: {
        Row: {
          id: string
          user_id: string
          theme_preference: string
          notification_enabled: boolean
          language_preference: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          theme_preference?: string
          notification_enabled?: boolean
          language_preference?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          theme_preference?: string
          notification_enabled?: boolean
          language_preference?: string
          created_at?: string
          updated_at?: string
        }
      }
      // Two-tier places system
      my_places: {
        Row: {
          id: string
          user_id: string | null
          session_id: string | null
          group_id: string
          name: string
          address: string | null
          latitude: number | null
          longitude: number | null
          place_id: string | null
          preference_score: number
          preferred_duration: number
          preferred_date: string | null
          notes: string | null
          is_personal_favorite: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          session_id?: string | null
          group_id: string
          name: string
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          place_id?: string | null
          preference_score?: number
          preferred_duration?: number
          preferred_date?: string | null
          notes?: string | null
          is_personal_favorite?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          session_id?: string | null
          group_id?: string
          name?: string
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          place_id?: string | null
          preference_score?: number
          preferred_duration?: number
          preferred_date?: string | null
          notes?: string | null
          is_personal_favorite?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      places: {
        Row: {
          id: string
          group_id: string
          name: string
          address: string | null
          latitude: number | null
          longitude: number | null
          place_id: string | null
          visit_order: number | null
          scheduled_date: string | null
          scheduled_duration: number | null
          source_places: string[] | null
          fairness_score: number | null
          transport_mode: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          group_id: string
          name: string
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          place_id?: string | null
          visit_order?: number | null
          scheduled_date?: string | null
          scheduled_duration?: number | null
          source_places?: string[] | null
          fairness_score?: number | null
          transport_mode?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          name?: string
          address?: string | null
          latitude?: number | null
          longitude?: number | null
          place_id?: string | null
          visit_order?: number | null
          scheduled_date?: string | null
          scheduled_duration?: number | null
          source_places?: string[] | null
          fairness_score?: number | null
          transport_mode?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      // Version control and change tracking
      route_versions: {
        Row: {
          id: string
          group_id: string
          version: number
          user_id: string | null
          session_id: string | null
          change_type: string
          change_description: string
          route_data_snapshot: Record<string, any>
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          version: number
          user_id?: string | null
          session_id?: string | null
          change_type: string
          change_description: string
          route_data_snapshot: Record<string, any>
          created_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          version?: number
          user_id?: string | null
          session_id?: string | null
          change_type?: string
          change_description?: string
          route_data_snapshot?: Record<string, any>
          created_at?: string
        }
      }
      route_change_logs: {
        Row: {
          id: string
          group_id: string
          user_id: string | null
          session_id: string | null
          change_type: string
          target_destination_id: string | null
          old_value: Record<string, any> | null
          new_value: Record<string, any> | null
          impact_metrics: Record<string, any>
          timestamp: string
          created_at: string
        }
        Insert: {
          id?: string
          group_id: string
          user_id?: string | null
          session_id?: string | null
          change_type: string
          target_destination_id?: string | null
          old_value?: Record<string, any> | null
          new_value?: Record<string, any> | null
          impact_metrics?: Record<string, any>
          timestamp?: string
          created_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          user_id?: string | null
          session_id?: string | null
          change_type?: string
          target_destination_id?: string | null
          old_value?: Record<string, any> | null
          new_value?: Record<string, any> | null
          impact_metrics?: Record<string, any>
          timestamp?: string
          created_at?: string
        }
      }
      user_sessions: {
        Row: {
          id: string
          user_id: string | null
          session_id: string | null
          selected_trip_id: string | null
          last_activity: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          session_id?: string | null
          selected_trip_id?: string | null
          last_activity?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          session_id?: string | null
          selected_trip_id?: string | null
          last_activity?: string
          created_at?: string
          updated_at?: string
        }
      }
      optimization_updates: {
        Row: {
          id: string
          group_id: string
          update_type: string
          data: Record<string, any> | null
          user_id: string | null
          session_id: string | null
          timestamp: string
        }
        Insert: {
          id?: string
          group_id: string
          update_type: string
          data?: Record<string, any> | null
          user_id?: string | null
          session_id?: string | null
          timestamp?: string
        }
        Update: {
          id?: string
          group_id?: string
          update_type?: string
          data?: Record<string, any> | null
          user_id?: string | null
          session_id?: string | null
          timestamp?: string
        }
      }
      session_settings: {
        Row: {
          id: string
          session_id: string
          setting_key: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          setting_key: string
          setting_value: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
        }
      }
    }
  }
}

// Type aliases for easier usage
export type Users = Database['public']['Tables']['users']['Row']
export type TripGroups = Database['public']['Tables']['trip_groups']['Row']
export type PreRegisteredParticipants = Database['public']['Tables']['pre_registered_participants']['Row']
export type GroupMembers = Database['public']['Tables']['group_members']['Row']
export type Destinations = Database['public']['Tables']['destinations']['Row']
export type UserPreferences = Database['public']['Tables']['user_preferences']['Row']
export type OptimizedRoutes = Database['public']['Tables']['optimized_routes']['Row']
export type GroupChatMessages = Database['public']['Tables']['group_chat_messages']['Row']
export type UserSettings = Database['public']['Tables']['user_settings']['Row']
export type MyPlaces = Database['public']['Tables']['my_places']['Row']
export type Places = Database['public']['Tables']['places']['Row']
export type RouteVersions = Database['public']['Tables']['route_versions']['Row']
export type RouteChangeLogs = Database['public']['Tables']['route_change_logs']['Row']
export type UserSessions = Database['public']['Tables']['user_sessions']['Row']
export type OptimizationUpdates = Database['public']['Tables']['optimization_updates']['Row']
export type SessionSettings = Database['public']['Tables']['session_settings']['Row']