-- Migration for Route Storage Integration (Prompt 9)
-- Comprehensive database setup for JSONB route storage, version control, and real-time sync

-- Drop existing tables if they exist (for development)
DROP TABLE IF EXISTS route_versions CASCADE;
DROP TABLE IF EXISTS route_change_logs CASCADE;
DROP INDEX IF EXISTS idx_optimized_routes_destinations;
DROP INDEX IF EXISTS idx_optimized_routes_users;
DROP INDEX IF EXISTS idx_optimized_routes_bounds;
DROP INDEX IF EXISTS idx_optimized_routes_group_version;
DROP INDEX IF EXISTS idx_optimized_routes_fairness;

-- Enhanced optimized_routes table
-- Note: Main table already exists, we're adding indexes and constraints

-- Add constraints to existing optimized_routes table
ALTER TABLE optimized_routes 
ADD CONSTRAINT IF NOT EXISTS chk_fairness_score_range 
CHECK (fairness_score >= 0 AND fairness_score <= 1);

ALTER TABLE optimized_routes 
ADD CONSTRAINT IF NOT EXISTS chk_total_distance_positive 
CHECK (total_distance >= 0);

ALTER TABLE optimized_routes 
ADD CONSTRAINT IF NOT EXISTS chk_total_duration_positive 
CHECK (total_duration >= 0);

-- Create route_versions table for version control
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

-- Create route_change_logs table for detailed change tracking
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

-- Create route_statistics materialized view for performance
CREATE MATERIALIZED VIEW IF NOT EXISTS route_statistics AS
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

-- Create indexes for JSONB queries and performance optimization

-- Index for destination searches within route data
CREATE INDEX IF NOT EXISTS idx_optimized_routes_destinations 
ON optimized_routes USING GIN ((route_data -> 'multiDaySchedule' -> 'days'));

-- Index for user preference queries
CREATE INDEX IF NOT EXISTS idx_optimized_routes_users 
ON optimized_routes USING GIN ((route_data -> 'generationInfo' -> 'userPreferencesSnapshot'));

-- Index for geographical bounds queries
CREATE INDEX IF NOT EXISTS idx_optimized_routes_bounds 
ON optimized_routes USING GIN ((route_data -> 'visualizationData' -> 'mapBounds'));

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_optimized_routes_status 
ON optimized_routes USING GIN ((route_data -> 'status'));

-- Standard B-tree indexes
CREATE INDEX IF NOT EXISTS idx_optimized_routes_group_version 
ON optimized_routes (group_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_optimized_routes_fairness 
ON optimized_routes (fairness_score DESC);

CREATE INDEX IF NOT EXISTS idx_optimized_routes_created 
ON optimized_routes (created_at DESC);

-- Indexes for route_versions
CREATE INDEX IF NOT EXISTS idx_route_versions_group_version 
ON route_versions (group_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_route_versions_user 
ON route_versions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_route_versions_change_type 
ON route_versions (change_type, created_at DESC);

-- Indexes for route_change_logs
CREATE INDEX IF NOT EXISTS idx_route_change_logs_group 
ON route_change_logs (group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_route_change_logs_user 
ON route_change_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_route_change_logs_destination 
ON route_change_logs (target_destination_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_route_change_logs_type 
ON route_change_logs (change_type, created_at DESC);

-- Functions for JSONB queries

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
    or.id,
    or.group_id,
    or.route_data,
    or.fairness_score,
    or.total_distance,
    or.total_duration,
    or.created_at,
    or.version
  FROM optimized_routes or
  WHERE or.route_data @> jsonb_build_object(
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
    or.id,
    or.group_id,
    or.route_data,
    or.fairness_score,
    or.total_distance,
    or.total_duration,
    or.created_at,
    or.version
  FROM optimized_routes or
  WHERE or.route_data @> jsonb_build_object(
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

-- Data cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_route_data()
RETURNS void 
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete route versions older than 30 days
  DELETE FROM route_versions 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Delete change logs older than 90 days
  DELETE FROM route_change_logs 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- Vacuum tables for performance
  PERFORM pg_stat_reset_single_table_counters('public', 'route_versions');
  PERFORM pg_stat_reset_single_table_counters('public', 'route_change_logs');
END;
$$;

-- Row Level Security Policies

-- Enable RLS on new tables
ALTER TABLE route_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_change_logs ENABLE ROW LEVEL SECURITY;

-- Policies for route_versions
CREATE POLICY "Allow all operations on route_versions"
ON route_versions
FOR ALL
USING (true)
WITH CHECK (true);

-- Policies for route_change_logs  
CREATE POLICY "Allow all operations on route_change_logs"
ON route_change_logs
FOR ALL
USING (true)
WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON route_versions TO authenticated, anon;
GRANT ALL ON route_change_logs TO authenticated, anon;
GRANT SELECT ON route_statistics TO authenticated, anon;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;

-- Comments for documentation
COMMENT ON TABLE route_versions IS 'Version control for optimized routes with change tracking';
COMMENT ON TABLE route_change_logs IS 'Detailed change log for route modifications and user interactions';
COMMENT ON MATERIALIZED VIEW route_statistics IS 'Pre-computed statistics for route queries and analytics';

COMMENT ON FUNCTION find_routes_containing_destination(TEXT) IS 'Find all routes that contain a specific destination ID';
COMMENT ON FUNCTION find_routes_for_user(TEXT) IS 'Find all routes that include preferences from a specific user';
COMMENT ON FUNCTION get_route_statistics(UUID) IS 'Get comprehensive statistics for a route';
COMMENT ON FUNCTION refresh_route_statistics() IS 'Manually refresh the route statistics materialized view';
COMMENT ON FUNCTION cleanup_old_route_data() IS 'Cleanup old route versions and change logs for performance';

-- Initial refresh of materialized view
SELECT refresh_route_statistics();