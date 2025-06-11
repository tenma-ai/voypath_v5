-- Scalable Database Schema for Voypath
-- Supports guest users without Supabase authentication

-- User Sessions Table (Scalable Session Management)
CREATE TABLE IF NOT EXISTS user_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_fingerprint VARCHAR(32) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_guest BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_sessions_device_fingerprint ON user_sessions(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(last_active_at) WHERE expires_at > NOW();

-- Guest Places Table (Scalable Data Storage)
CREATE TABLE IF NOT EXISTS guest_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES user_sessions(session_id) ON DELETE CASCADE,
  device_fingerprint VARCHAR(32) NOT NULL,
  
  -- Trip relationship (can be local trip ID for guests)
  trip_id UUID,
  
  -- Place basic information
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50),
  address TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Google Places integration
  google_place_id VARCHAR(255),
  google_rating DECIMAL(2, 1),
  google_review_count INTEGER,
  google_metadata JSONB DEFAULT '{}'::jsonb,
  
  -- User preferences
  wish_level INTEGER DEFAULT 3 CHECK (wish_level BETWEEN 1 AND 5),
  stay_duration_minutes INTEGER DEFAULT 60,
  visit_date DATE,
  preferred_time_slots TEXT[],
  notes TEXT,
  price_level INTEGER CHECK (price_level BETWEEN 1 AND 4),
  
  -- System information
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Migration tracking
  migrated_to_user_id UUID REFERENCES auth.users(id),
  migration_completed_at TIMESTAMPTZ,
  
  -- Source tracking
  source VARCHAR(50) DEFAULT 'guest_session'
);

-- Create indexes for guest_places
CREATE INDEX IF NOT EXISTS idx_guest_places_session ON guest_places(session_id);
CREATE INDEX IF NOT EXISTS idx_guest_places_fingerprint ON guest_places(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_guest_places_google_id ON guest_places(google_place_id) WHERE google_place_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guest_places_trip ON guest_places(trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guest_places_migration ON guest_places(migrated_to_user_id, migration_completed_at) WHERE migrated_to_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guest_places_location ON guest_places(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Guest Trips Table (Local trip management for guests)
CREATE TABLE IF NOT EXISTS guest_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES user_sessions(session_id) ON DELETE CASCADE,
  device_fingerprint VARCHAR(32) NOT NULL,
  
  -- Trip information
  name VARCHAR(255),
  description TEXT,
  departure_location VARCHAR(255) NOT NULL,
  destination VARCHAR(255),
  start_date DATE,
  end_date DATE,
  
  -- Settings
  member_count INTEGER DEFAULT 1,
  add_place_deadline TIMESTAMPTZ,
  
  -- System information
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Migration tracking
  migrated_to_user_id UUID REFERENCES auth.users(id),
  migration_completed_at TIMESTAMPTZ
);

-- Create indexes for guest_trips
CREATE INDEX IF NOT EXISTS idx_guest_trips_session ON guest_trips(session_id);
CREATE INDEX IF NOT EXISTS idx_guest_trips_fingerprint ON guest_trips(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_guest_trips_migration ON guest_trips(migrated_to_user_id, migration_completed_at) WHERE migrated_to_user_id IS NOT NULL;

-- Data Sync Queue (For offline synchronization)
CREATE TABLE IF NOT EXISTS data_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  operation_type VARCHAR(20) NOT NULL, -- 'insert', 'update', 'delete'
  table_name VARCHAR(50) NOT NULL,
  data JSONB NOT NULL,
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

-- Create indexes for sync queue
CREATE INDEX IF NOT EXISTS idx_sync_queue_session ON data_sync_queue(session_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_priority ON data_sync_queue(priority, created_at) WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sync_queue_pending ON data_sync_queue(created_at) WHERE completed_at IS NULL AND attempts < max_attempts;

-- Data Cleanup Queue (For scheduled cleanup)
CREATE TABLE IF NOT EXISTS data_cleanup_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID,
  cleanup_type VARCHAR(50) NOT NULL,
  target_table VARCHAR(50) NOT NULL,
  target_id UUID,
  cleanup_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for cleanup queue
CREATE INDEX IF NOT EXISTS idx_cleanup_queue_schedule ON data_cleanup_queue(cleanup_at) WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cleanup_queue_type ON data_cleanup_queue(cleanup_type, target_table);

-- Automatic cleanup functions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  -- Delete expired sessions (older than 1 day past expiration)
  DELETE FROM user_sessions 
  WHERE expires_at < NOW() - INTERVAL '1 day';
  
  -- Log cleanup
  RAISE NOTICE 'Cleaned up expired sessions';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_old_guest_data()
RETURNS void AS $$
BEGIN
  -- Clean up unmigrated guest data older than 90 days
  DELETE FROM guest_places 
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND migrated_to_user_id IS NULL;
    
  DELETE FROM guest_trips 
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND migrated_to_user_id IS NULL;
  
  -- Clean up completed sync queue items older than 7 days
  DELETE FROM data_sync_queue 
  WHERE completed_at < NOW() - INTERVAL '7 days';
  
  -- Log cleanup
  RAISE NOTICE 'Cleaned up old guest data';
END;
$$ LANGUAGE plpgsql;

-- Automatic update triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
CREATE TRIGGER trigger_guest_places_updated_at
  BEFORE UPDATE ON guest_places
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_guest_trips_updated_at
  BEFORE UPDATE ON guest_trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_sessions_updated_at
  BEFORE UPDATE ON user_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Data migration functions
CREATE OR REPLACE FUNCTION migrate_guest_data_to_user(
  p_session_id UUID,
  p_user_id UUID
) RETURNS JSON AS $$
DECLARE
  result JSON;
  places_count INTEGER := 0;
  trips_count INTEGER := 0;
BEGIN
  -- Start transaction
  BEGIN
    -- Migrate guest places to user places
    INSERT INTO places (
      trip_id, name, category, address, latitude, longitude,
      google_place_id, google_rating, google_review_count, google_metadata,
      wish_level, stay_duration_minutes, visit_date, preferred_time_slots,
      notes, price_level, user_id, source, created_at, updated_at
    )
    SELECT 
      trip_id, name, category, address, latitude, longitude,
      google_place_id, google_rating, google_review_count, google_metadata,
      wish_level, stay_duration_minutes, visit_date, preferred_time_slots,
      notes, price_level, p_user_id, 'migrated_from_guest', created_at, updated_at
    FROM guest_places 
    WHERE session_id = p_session_id AND migrated_to_user_id IS NULL;
    
    GET DIAGNOSTICS places_count = ROW_COUNT;
    
    -- Migrate guest trips to user trips
    INSERT INTO trips (
      name, description, departure_location, destination,
      start_date, end_date, member_count, add_place_deadline,
      owner_id, created_at, updated_at
    )
    SELECT 
      name, description, departure_location, destination,
      start_date, end_date, member_count, add_place_deadline,
      p_user_id, created_at, updated_at
    FROM guest_trips 
    WHERE session_id = p_session_id AND migrated_to_user_id IS NULL;
    
    GET DIAGNOSTICS trips_count = ROW_COUNT;
    
    -- Mark guest data as migrated
    UPDATE guest_places 
    SET migrated_to_user_id = p_user_id, migration_completed_at = NOW()
    WHERE session_id = p_session_id AND migrated_to_user_id IS NULL;
    
    UPDATE guest_trips 
    SET migrated_to_user_id = p_user_id, migration_completed_at = NOW()
    WHERE session_id = p_session_id AND migrated_to_user_id IS NULL;
    
    -- Schedule cleanup of migrated data (30 days later)
    INSERT INTO data_cleanup_queue (session_id, cleanup_type, target_table, cleanup_at)
    VALUES 
      (p_session_id, 'migrated_guest_data', 'guest_places', NOW() + INTERVAL '30 days'),
      (p_session_id, 'migrated_guest_data', 'guest_trips', NOW() + INTERVAL '30 days');
    
    -- Build result
    result := json_build_object(
      'success', true,
      'migrated_places', places_count,
      'migrated_trips', trips_count,
      'session_id', p_session_id,
      'user_id', p_user_id
    );
    
    RETURN result;
    
  EXCEPTION WHEN OTHERS THEN
    -- Rollback on error
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql;

-- Performance optimization functions
CREATE OR REPLACE FUNCTION optimize_session_performance()
RETURNS void AS $$
BEGIN
  -- Update statistics for better query planning
  ANALYZE user_sessions;
  ANALYZE guest_places;
  ANALYZE guest_trips;
  ANALYZE data_sync_queue;
  
  -- Vacuum to reclaim space
  VACUUM user_sessions;
  VACUUM guest_places;
  VACUUM guest_trips;
  
  RAISE NOTICE 'Performance optimization completed';
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) policies
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_trips ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_sessions
CREATE POLICY "Users can access their own sessions" ON user_sessions
  FOR ALL USING (user_id = auth.uid() OR is_guest = true);

-- RLS policies for guest_places
CREATE POLICY "Guest users can access their session data" ON guest_places
  FOR ALL USING (
    -- Allow if it's their session
    session_id IN (
      SELECT session_id FROM user_sessions 
      WHERE device_fingerprint = current_setting('app.device_fingerprint', true)
        OR user_id = auth.uid()
    )
    -- Or if they own the migrated data
    OR migrated_to_user_id = auth.uid()
  );

-- RLS policies for guest_trips  
CREATE POLICY "Guest users can access their session trips" ON guest_trips
  FOR ALL USING (
    -- Allow if it's their session
    session_id IN (
      SELECT session_id FROM user_sessions 
      WHERE device_fingerprint = current_setting('app.device_fingerprint', true)
        OR user_id = auth.uid()
    )
    -- Or if they own the migrated data
    OR migrated_to_user_id = auth.uid()
  );

-- Scheduled maintenance (requires pg_cron extension)
-- Run every hour to clean up expired sessions
-- SELECT cron.schedule('cleanup-sessions', '0 * * * *', 'SELECT cleanup_expired_sessions();');

-- Run daily to clean up old guest data
-- SELECT cron.schedule('cleanup-guest-data', '0 2 * * *', 'SELECT cleanup_old_guest_data();');

-- Run weekly to optimize performance
-- SELECT cron.schedule('optimize-performance', '0 3 * * 0', 'SELECT optimize_session_performance();');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_sessions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON guest_places TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON guest_trips TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON data_sync_queue TO anon, authenticated;
GRANT SELECT, INSERT ON data_cleanup_queue TO anon, authenticated;

-- Grant sequence permissions
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

COMMENT ON TABLE user_sessions IS 'Scalable session management for guest and authenticated users';
COMMENT ON TABLE guest_places IS 'Places data for guest users with migration support';
COMMENT ON TABLE guest_trips IS 'Trips data for guest users with migration support';
COMMENT ON TABLE data_sync_queue IS 'Queue for offline data synchronization';
COMMENT ON TABLE data_cleanup_queue IS 'Scheduled cleanup tasks for data maintenance';