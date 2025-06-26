/*
  # Voypath Database Schema - Complete Implementation (Fixed)
  
  This schema includes:
  1. Core tables (users, trips, members, etc.)
  2. Two-tier places system (my_places and places)
  3. Server-side state management
  4. Performance optimizations and indexes
  5. Database Integration and Result Storage (Prompt 9)
  6. JSONB route storage with version control
  7. Real-time synchronization support
  8. Caching and performance optimization
*/

-- SECTION 1: CORE TABLES

-- Users (guest and authenticated)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE, -- null for guest users
    full_name TEXT,
    avatar_url TEXT,
    display_initials TEXT, -- guest initials like 'AB'
    is_guest BOOLEAN DEFAULT false,
    session_id TEXT, -- guest session identifier
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trip groups
CREATE TABLE IF NOT EXISTS trip_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    description TEXT,
    start_date DATE, -- optional
    end_date DATE, -- optional, auto-calculated if null
    departure_location TEXT NOT NULL, -- only required field
    return_location TEXT, -- null means same as departure
    departure_location_lat DOUBLE PRECISION,
    departure_location_lng DOUBLE PRECISION,
    auto_calculate_end_date BOOLEAN DEFAULT true,
    preferences_deadline TIMESTAMP WITH TIME ZONE,
    planning_deadline TIMESTAMP WITH TIME ZONE,
    share_code TEXT UNIQUE, -- 6-digit code
    share_link TEXT UNIQUE, -- UUID for sharing
    -- Permission settings
    allow_order_change TEXT DEFAULT 'all', -- 'all', 'admin_only', 'specific_members'
    allow_destination_add TEXT DEFAULT 'all', -- 'all', 'approval_required'
    order_change_members TEXT[], -- specific member IDs
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'planning' -- 'planning', 'confirmed', 'completed'
);

-- Pre-registered participants
CREATE TABLE IF NOT EXISTS pre_registered_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES trip_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    is_joined BOOLEAN DEFAULT false,
    joined_user_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Group members
CREATE TABLE IF NOT EXISTS group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES trip_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    participant_id UUID REFERENCES pre_registered_participants(id),
    display_name TEXT NOT NULL,
    assigned_color TEXT NOT NULL, -- HEX color like '#FF5733'
    role TEXT DEFAULT 'member', -- 'admin', 'member', 'viewer'
    session_id TEXT, -- for guest users
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Destinations
CREATE TABLE IF NOT EXISTS destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES trip_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    place_id TEXT, -- Google Places ID
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User preferences for destinations
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES trip_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    destination_id UUID REFERENCES destinations(id) ON DELETE CASCADE,
    preference_score INTEGER CHECK (preference_score >= 1 AND preference_score <= 5),
    preferred_duration INTEGER, -- hours
    notes TEXT,
    is_personal_favorite BOOLEAN DEFAULT false,
    session_id TEXT, -- for guest users
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optimized routes (enhanced for JSONB storage)
CREATE TABLE IF NOT EXISTS optimized_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES trip_groups(id) ON DELETE CASCADE,
    route_data JSONB NOT NULL, -- optimization results
    fairness_score DECIMAL(5, 2) CHECK (fairness_score >= 0 AND fairness_score <= 1),
    total_distance DECIMAL(10, 2) CHECK (total_distance >= 0),
    total_duration INTEGER CHECK (total_duration >= 0), -- minutes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1
);

-- Group chat messages
CREATE TABLE IF NOT EXISTS group_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES trip_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    display_name TEXT NOT NULL,
    message_text TEXT NOT NULL,
    message_type TEXT DEFAULT 'text', -- 'text', 'emoji', 'system'
    session_id TEXT, -- guest session
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT false
);

-- User settings
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    theme_preference TEXT DEFAULT 'system', -- 'light', 'dark', 'system'
    notification_enabled BOOLEAN DEFAULT true,
    language_preference TEXT DEFAULT 'auto',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SECTION 2: TWO-TIER PLACES SYSTEM

-- Tier 1: Personal Wishlist (my_places)
CREATE TABLE IF NOT EXISTS my_places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    session_id TEXT, -- For guest users
    group_id UUID REFERENCES trip_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    place_id TEXT, -- Google Places ID
    preference_score INTEGER CHECK (preference_score >= 1 AND preference_score <= 5) DEFAULT 3,
    preferred_duration INTEGER DEFAULT 60, -- Minutes
    preferred_date DATE, -- Optional specific date preference
    notes TEXT,
    is_personal_favorite BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tier 2: Group Itinerary (places)
CREATE TABLE IF NOT EXISTS places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES trip_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    place_id TEXT, -- Google Places ID
    visit_order INTEGER, -- Order in the itinerary
    scheduled_date DATE, -- Date assigned by algorithm
    scheduled_duration INTEGER, -- Minutes assigned by algorithm
    source_places UUID[], -- Array of my_places IDs that contributed
    fairness_score DECIMAL(5, 2), -- Individual place fairness score
    transport_mode TEXT, -- 'air', 'land', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SECTION 3: DATABASE INTEGRATION AND RESULT STORAGE (Prompt 9)

-- Route versions for version control
CREATE TABLE IF NOT EXISTS route_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES trip_groups(id) ON DELETE CASCADE,
    version BIGINT NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id TEXT,
    change_type TEXT NOT NULL CHECK (change_type IN ('optimization', 'manual_edit', 'user_preference_update', 'reorder', 'time_adjust')),
    change_description TEXT NOT NULL,
    route_data_snapshot JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(group_id, version)
);

-- Route change logs for detailed change tracking
CREATE TABLE IF NOT EXISTS route_change_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES trip_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id TEXT,
    change_type TEXT NOT NULL CHECK (change_type IN ('destination_reorder', 'time_adjustment', 'destination_exclude', 'preference_update', 'destination_add', 'destination_remove')),
    target_destination_id UUID,
    old_value JSONB,
    new_value JSONB,
    impact_metrics JSONB NOT NULL DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SECTION 4: SERVER-SIDE STATE MANAGEMENT

-- User sessions table for server-side state management
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    session_id TEXT, -- For guest users
    selected_trip_id UUID REFERENCES trip_groups(id),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique session per user/guest
    CONSTRAINT unique_user_session UNIQUE(user_id),
    CONSTRAINT unique_guest_session UNIQUE(session_id),
    
    -- Validation - either user_id or session_id must be provided
    CONSTRAINT user_or_session_required CHECK (
        (user_id IS NOT NULL) OR (session_id IS NOT NULL)
    )
);

-- SECTION 5: INDEXES AND OPTIMIZATIONS

-- Core table indexes
CREATE INDEX IF NOT EXISTS idx_trip_groups_location 
ON trip_groups (departure_location_lat, departure_location_lng);

CREATE INDEX IF NOT EXISTS idx_trip_groups_created_by ON trip_groups(created_by);
CREATE INDEX IF NOT EXISTS idx_trip_groups_share_code ON trip_groups(share_code);
CREATE INDEX IF NOT EXISTS idx_trip_groups_created_at ON trip_groups(created_at);

CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_session_id ON group_members(session_id);

-- Places system indexes
CREATE INDEX IF NOT EXISTS idx_places_group_id ON places(group_id);
CREATE INDEX IF NOT EXISTS idx_places_visit_order ON places(group_id, visit_order);

CREATE INDEX IF NOT EXISTS idx_my_places_group_id ON my_places(group_id);
CREATE INDEX IF NOT EXISTS idx_my_places_user_id ON my_places(user_id);
CREATE INDEX IF NOT EXISTS idx_my_places_session_id ON my_places(session_id);
CREATE INDEX IF NOT EXISTS idx_my_places_preference ON my_places(group_id, preference_score DESC);

-- Database integration indexes
CREATE INDEX IF NOT EXISTS idx_optimized_routes_destinations 
ON optimized_routes USING GIN ((route_data -> 'multiDaySchedule' -> 'days'));

CREATE INDEX IF NOT EXISTS idx_optimized_routes_users 
ON optimized_routes USING GIN ((route_data -> 'generationInfo' -> 'userPreferencesSnapshot'));

CREATE INDEX IF NOT EXISTS idx_optimized_routes_bounds 
ON optimized_routes USING GIN ((route_data -> 'visualizationData' -> 'mapBounds'));

CREATE INDEX IF NOT EXISTS idx_optimized_routes_status 
ON optimized_routes USING GIN ((route_data -> 'status'));

CREATE INDEX IF NOT EXISTS idx_optimized_routes_group_version 
ON optimized_routes (group_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_optimized_routes_fairness 
ON optimized_routes (fairness_score DESC);

CREATE INDEX IF NOT EXISTS idx_optimized_routes_created 
ON optimized_routes (created_at DESC);

-- Route versions indexes
CREATE INDEX IF NOT EXISTS idx_route_versions_group_version 
ON route_versions (group_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_route_versions_user 
ON route_versions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_route_versions_change_type 
ON route_versions (change_type, created_at DESC);

-- Route change logs indexes
CREATE INDEX IF NOT EXISTS idx_route_change_logs_group 
ON route_change_logs (group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_route_change_logs_user 
ON route_change_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_route_change_logs_destination 
ON route_change_logs (target_destination_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_route_change_logs_type 
ON route_change_logs (change_type, created_at DESC);

-- User sessions indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_trip_id ON user_sessions(selected_trip_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON user_sessions(last_activity);

-- SECTION 6: MATERIALIZED VIEWS FOR PERFORMANCE

-- Route statistics materialized view
DROP MATERIALIZED VIEW IF EXISTS route_statistics;
CREATE MATERIALIZED VIEW route_statistics AS
SELECT 
    group_id,
    (route_data->>'status') as status,
    (route_data->'optimizationMetrics'->>'fairnessScore')::decimal as fairness_score,
    (route_data->'optimizationMetrics'->>'totalDistance')::decimal as total_distance,
    (route_data->'optimizationMetrics'->>'totalDuration')::integer as total_duration,
    (route_data->'optimizationMetrics'->>'destinationCount')::integer as destination_count,
    jsonb_array_length(route_data->'multiDaySchedule'->'days') as day_count,
    (route_data->'generationInfo'->>'algorithmVersion') as algorithm_version,
    (route_data->'generationInfo'->>'generatedAt')::timestamp as generated_at,
    created_at,
    version
FROM optimized_routes;

-- SECTION 7: UTILITY FUNCTIONS

-- Function to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_modified_column() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW; 
END;
$$ LANGUAGE plpgsql;

-- Trigger to update the updated_at column
DROP TRIGGER IF EXISTS update_user_sessions_updated_at ON user_sessions;
CREATE TRIGGER update_user_sessions_updated_at
BEFORE UPDATE ON user_sessions
FOR EACH ROW
EXECUTE PROCEDURE update_modified_column();

-- Function to find routes containing a specific destination
CREATE OR REPLACE FUNCTION find_routes_containing_destination(destination_id TEXT)
RETURNS TABLE (
    id UUID,
    group_id UUID,
    route_data JSONB,
    fairness_score DECIMAL,
    total_distance DECIMAL,
    total_duration INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    version INTEGER
) 
LANGUAGE SQL STABLE
AS $$
    SELECT 
        routes.id,
        routes.group_id,
        routes.route_data,
        routes.fairness_score,
        routes.total_distance,
        routes.total_duration,
        routes.created_at,
        routes.version
    FROM optimized_routes routes
    WHERE routes.route_data @> jsonb_build_object(
        'multiDaySchedule', jsonb_build_object(
            'days', jsonb_build_array(
                jsonb_build_object(
                    'destinations', jsonb_build_array(
                        jsonb_build_object('destinationId', destination_id)
                    )
                )
            )
        )
    );
$$;

-- Function to find routes for a specific user
CREATE OR REPLACE FUNCTION find_routes_for_user(user_id TEXT)
RETURNS TABLE (
    id UUID,
    group_id UUID,
    route_data JSONB,
    fairness_score DECIMAL,
    total_distance DECIMAL,
    total_duration INTEGER,
    created_at TIMESTAMP WITH TIME ZONE,
    version INTEGER
) 
LANGUAGE SQL STABLE
AS $$
    SELECT 
        routes.id,
        routes.group_id,
        routes.route_data,
        routes.fairness_score,
        routes.total_distance,
        routes.total_duration,
        routes.created_at,
        routes.version
    FROM optimized_routes routes
    WHERE routes.route_data @> jsonb_build_object(
        'generationInfo', jsonb_build_object(
            'userPreferencesSnapshot', jsonb_build_array(
                jsonb_build_object('userId', user_id)
            )
        )
    );
$$;

-- Function to get route statistics
CREATE OR REPLACE FUNCTION get_route_statistics(group_id_param UUID)
RETURNS TABLE (
    total_destinations INTEGER,
    total_distance DECIMAL,
    total_duration INTEGER,
    fairness_score DECIMAL,
    day_count INTEGER,
    last_updated TIMESTAMP WITH TIME ZONE
)
LANGUAGE SQL STABLE
AS $$
    SELECT 
        (route_data->'optimizationMetrics'->>'destinationCount')::integer as total_destinations,
        (route_data->'optimizationMetrics'->>'totalDistance')::decimal as total_distance,
        (route_data->'optimizationMetrics'->>'totalDuration')::integer as total_duration,
        (route_data->'optimizationMetrics'->>'fairnessScore')::decimal as fairness_score,
        jsonb_array_length(route_data->'multiDaySchedule'->'days') as day_count,
        created_at as last_updated
    FROM optimized_routes 
    WHERE optimized_routes.group_id = group_id_param;
$$;

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_route_statistics()
RETURNS void 
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW route_statistics;
END;
$$;

-- Trigger to auto-refresh materialized view when routes are updated
CREATE OR REPLACE FUNCTION trigger_refresh_route_statistics()
RETURNS trigger 
LANGUAGE plpgsql
AS $$
BEGIN
    -- Refresh in background to avoid blocking
    PERFORM pg_notify('route_statistics_refresh', NEW.group_id::text);
    RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS route_updated_refresh_stats ON optimized_routes;
CREATE TRIGGER route_updated_refresh_stats
    AFTER INSERT OR UPDATE ON optimized_routes
    FOR EACH ROW
    EXECUTE FUNCTION trigger_refresh_route_statistics();

-- Cleanup function for stale sessions and old data
CREATE OR REPLACE FUNCTION cleanup_stale_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete stale user sessions
    DELETE FROM user_sessions
    WHERE last_activity < NOW() - INTERVAL '30 days';
    
    -- Delete route versions older than 30 days
    DELETE FROM route_versions 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Delete change logs older than 90 days
    DELETE FROM route_change_logs 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- SECTION 8: SECURITY AND RLS POLICIES

-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE pre_registered_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimized_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE my_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_change_logs ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow all operations on users" ON users;
DROP POLICY IF EXISTS "Allow all operations on trip_groups" ON trip_groups;
DROP POLICY IF EXISTS "Allow all operations on pre_registered_participants" ON pre_registered_participants;
DROP POLICY IF EXISTS "Allow all operations on group_members" ON group_members;
DROP POLICY IF EXISTS "Allow all operations on destinations" ON destinations;
DROP POLICY IF EXISTS "Allow all operations on user_preferences" ON user_preferences;
DROP POLICY IF EXISTS "Allow all operations on optimized_routes" ON optimized_routes;
DROP POLICY IF EXISTS "Allow all operations on group_chat_messages" ON group_chat_messages;
DROP POLICY IF EXISTS "Allow all operations on user_settings" ON user_settings;
DROP POLICY IF EXISTS "Allow all operations on my_places" ON my_places;
DROP POLICY IF EXISTS "Allow all operations on places" ON places;
DROP POLICY IF EXISTS "Allow all operations on route_versions" ON route_versions;
DROP POLICY IF EXISTS "Allow all operations on route_change_logs" ON route_change_logs;
DROP POLICY IF EXISTS "Users can view and manage their own sessions" ON user_sessions;

-- Create new policies for all tables (simplified for development)
CREATE POLICY "Allow all operations on users"
    ON users
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on trip_groups"
    ON trip_groups
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on pre_registered_participants"
    ON pre_registered_participants
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on group_members"
    ON group_members
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on destinations"
    ON destinations
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on user_preferences"
    ON user_preferences
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on optimized_routes"
    ON optimized_routes
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on group_chat_messages"
    ON group_chat_messages
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on user_settings"
    ON user_settings
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on my_places"
    ON my_places
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on places"
    ON places
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on route_versions"
    ON route_versions
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations on route_change_logs"
    ON route_change_logs
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Users can view and manage their own sessions"
    ON user_sessions
    FOR ALL
    USING (
        (user_id = auth.uid()) OR 
        (session_id = current_setting('app.session_id', true))
    );

-- SECTION 9: GRANTS AND PERMISSIONS

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon;
GRANT SELECT ON route_statistics TO authenticated, anon;

-- SECTION 10: DOCUMENTATION

-- Table comments
COMMENT ON TABLE users IS 'User accounts for both authenticated and guest users';
COMMENT ON TABLE trip_groups IS 'Travel groups with settings and permissions';
COMMENT ON TABLE my_places IS 'Personal wishlist tier - individual user preferences';
COMMENT ON TABLE places IS 'Group itinerary tier - algorithmic optimization results';
COMMENT ON TABLE user_sessions IS 'Server-side state management for user sessions';
COMMENT ON TABLE route_versions IS 'Version control for optimized routes with change tracking';
COMMENT ON TABLE route_change_logs IS 'Detailed change log for route modifications and user interactions';
COMMENT ON MATERIALIZED VIEW route_statistics IS 'Pre-computed statistics for route queries and analytics';

-- Function comments
COMMENT ON FUNCTION find_routes_containing_destination(TEXT) IS 'Find all routes that contain a specific destination ID';
COMMENT ON FUNCTION find_routes_for_user(TEXT) IS 'Find all routes that include preferences from a specific user';
COMMENT ON FUNCTION get_route_statistics(UUID) IS 'Get comprehensive statistics for a route';
COMMENT ON FUNCTION refresh_route_statistics() IS 'Manually refresh the route statistics materialized view';
COMMENT ON FUNCTION cleanup_stale_sessions() IS 'Cleanup old route versions, change logs, and stale sessions';

-- Initial refresh of materialized view
SELECT refresh_route_statistics();

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Voypath database schema setup completed successfully!';
    RAISE NOTICE 'Includes: Core tables, Two-tier places system, Database integration, JSONB storage, Real-time support';
END $$;