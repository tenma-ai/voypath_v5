-- Voypath Database Setup for Supabase
-- Generated from requirements and database specifications
-- Run this script in Supabase SQL Editor

-- =============================================================================
-- 1. EXTENSIONS
-- =============================================================================

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Full-text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Geographic data (for future expansion)
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Encryption functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 2. CUSTOM TYPES
-- =============================================================================

-- Day of week enumeration
CREATE TYPE day_of_week AS ENUM (
  'sunday', 'monday', 'tuesday', 'wednesday', 
  'thursday', 'friday', 'saturday'
);

-- Transportation mode enumeration
CREATE TYPE transport_mode AS ENUM (
  'walking', 'public_transport', 'car', 'bicycle', 'taxi'
);

-- Message type enumeration
CREATE TYPE message_type AS ENUM (
  'text', 'place_share', 'system', 'optimization_result'
);

-- Trip member role enumeration
CREATE TYPE member_role AS ENUM ('admin', 'member');

-- Notification type enumeration
CREATE TYPE notification_type AS ENUM (
  'trip_invitation', 'place_added', 'optimization_completed', 
  'message_received', 'deadline_reminder'
);

-- =============================================================================
-- 3. TABLES
-- =============================================================================

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  name TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  is_guest BOOLEAN DEFAULT true,
  is_premium BOOLEAN DEFAULT false,
  premium_expires_at TIMESTAMPTZ,
  theme_preference TEXT DEFAULT 'light' CHECK (theme_preference IN ('light', 'dark', 'system')),
  language_preference TEXT DEFAULT 'en' CHECK (language_preference IN ('en', 'ja', 'ko', 'zh')),
  notification_settings JSONB DEFAULT '{
    "members": true,
    "updates": true, 
    "messages": true,
    "reminders": true
  }'::jsonb,
  timezone TEXT DEFAULT 'UTC',
  last_login_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Stripe integration
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Constraints
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$' OR email IS NULL),
  CONSTRAINT valid_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
  CONSTRAINT valid_premium_expiry CHECK (
    (is_premium = false AND premium_expires_at IS NULL) OR
    (is_premium = true AND premium_expires_at IS NOT NULL)
  )
);

-- Trips table
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  departure_location TEXT NOT NULL,
  name TEXT,
  description TEXT,
  destination TEXT,
  start_date DATE,
  end_date DATE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  
  -- Settings
  add_place_deadline TIMESTAMPTZ,
  max_members INTEGER DEFAULT 10,
  is_public BOOLEAN DEFAULT false,
  
  -- Metadata
  icon TEXT, -- image URL
  tags TEXT[], -- trip tags
  budget_range JSONB, -- {"min": 10000, "max": 50000, "currency": "JPY"}
  
  -- Optimization settings
  optimization_preferences JSONB DEFAULT '{
    "fairness_weight": 0.6,
    "efficiency_weight": 0.4,
    "auto_optimize": false,
    "include_meals": true,
    "preferred_transport": null
  }'::jsonb,
  
  -- Statistics
  total_places INTEGER DEFAULT 0,
  total_members INTEGER DEFAULT 1,
  last_optimized_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_date_range CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  CONSTRAINT valid_name_length CHECK (name IS NULL OR (char_length(name) >= 1 AND char_length(name) <= 200)),
  CONSTRAINT valid_departure_location_length CHECK (char_length(departure_location) >= 1 AND char_length(departure_location) <= 200),
  CONSTRAINT valid_destination_length CHECK (destination IS NULL OR (char_length(destination) >= 1 AND char_length(destination) <= 200)),
  CONSTRAINT valid_max_members CHECK (max_members >= 1 AND max_members <= 50),
  CONSTRAINT valid_deadline CHECK (add_place_deadline IS NULL OR start_date IS NULL OR add_place_deadline <= start_date)
);

-- Places table
CREATE TABLE places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  address TEXT,
  
  -- Geographic information
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location_point GEOGRAPHY(POINT, 4326), -- PostGIS point data
  
  -- Rating and wish level
  rating DECIMAL(2,1) CHECK (rating >= 0 AND rating <= 5),
  wish_level INTEGER NOT NULL CHECK (wish_level >= 1 AND wish_level <= 5),
  
  -- Stay duration and budget info
  stay_duration_minutes INTEGER NOT NULL CHECK (stay_duration_minutes > 0),
  price_level INTEGER CHECK (price_level >= 1 AND price_level <= 4),
  estimated_cost INTEGER CHECK (estimated_cost >= 0),
  
  -- Opening hours (JSONB format)
  opening_hours JSONB DEFAULT '{}'::jsonb,
  
  -- Media
  image_url TEXT,
  images TEXT[], -- multiple image URLs
  
  -- Schedule information
  scheduled BOOLEAN DEFAULT false,
  scheduled_date DATE,
  scheduled_time_start TIME,
  scheduled_time_end TIME,
  visit_date DATE, -- user preferred date
  preferred_time_slots TEXT[], -- ['morning', 'afternoon', 'evening']
  
  -- Transportation info
  transport_mode transport_mode,
  travel_time_from_previous INTEGER, -- travel time from previous place (minutes)
  
  -- Metadata
  notes TEXT,
  tags TEXT[],
  external_id TEXT, -- external API (Google Places, etc.) ID
  source TEXT DEFAULT 'user', -- 'user', 'google_places', 'foursquare'
  
  -- Relations
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE ON UPDATE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  
  -- Optimization related
  normalized_weight DECIMAL(10, 6), -- normalized weight
  optimization_metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_coordinates CHECK (
    (latitude IS NULL AND longitude IS NULL) OR
    (latitude IS NOT NULL AND longitude IS NOT NULL AND
     latitude >= -90 AND latitude <= 90 AND
     longitude >= -180 AND longitude <= 180)
  ),
  CONSTRAINT valid_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 200)
);

-- Trip members table
CREATE TABLE trip_members (
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE ON UPDATE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  role member_role DEFAULT 'member',
  
  -- Participation info
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  invitation_accepted_at TIMESTAMPTZ,
  
  -- Permission settings
  can_add_places BOOLEAN DEFAULT true,
  can_edit_places BOOLEAN DEFAULT false, -- can edit other users' places
  can_optimize BOOLEAN DEFAULT true,
  can_invite_members BOOLEAN DEFAULT false,
  
  -- Metadata
  nickname TEXT, -- nickname within the trip
  preferences JSONB DEFAULT '{}'::jsonb,
  
  PRIMARY KEY (trip_id, user_id),
  
  -- Constraints
  CONSTRAINT valid_nickname_length CHECK (nickname IS NULL OR char_length(nickname) <= 50)
);

-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE ON UPDATE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  
  -- Message content
  content TEXT NOT NULL,
  message_type message_type DEFAULT 'text',
  
  -- Attached data
  attachments JSONB DEFAULT '[]'::jsonb, -- files, images, etc.
  mentioned_users UUID[], -- mentioned users
  
  -- Reply info
  reply_to UUID REFERENCES messages(id) ON DELETE SET NULL,
  thread_id UUID, -- thread ID
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb, -- place info when place_share, etc.
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_content_length CHECK (char_length(content) >= 1 AND char_length(content) <= 4000),
  CONSTRAINT valid_system_message CHECK (
    (message_type = 'system' AND user_id IS NULL) OR
    (message_type != 'system' AND user_id IS NOT NULL)
  )
);

-- Optimization results table
CREATE TABLE optimization_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE ON UPDATE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  
  -- Optimization results
  optimized_route JSONB NOT NULL, -- daily schedule
  optimization_score JSONB NOT NULL, -- score details
  
  -- Execution info
  execution_time_ms INTEGER NOT NULL,
  places_count INTEGER NOT NULL,
  algorithm_version TEXT DEFAULT '1.0',
  
  -- Settings
  optimization_settings JSONB DEFAULT '{}'::jsonb,
  
  -- Statistics
  total_travel_time_minutes INTEGER,
  total_visit_time_minutes INTEGER,
  total_estimated_cost INTEGER,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true, -- currently applied optimization result
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_execution_time CHECK (execution_time_ms > 0),
  CONSTRAINT valid_places_count CHECK (places_count > 0),
  CONSTRAINT valid_travel_time CHECK (total_travel_time_minutes IS NULL OR total_travel_time_minutes >= 0),
  CONSTRAINT valid_visit_time CHECK (total_visit_time_minutes IS NULL OR total_visit_time_minutes >= 0)
);

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  
  -- Notification content
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  notification_type notification_type NOT NULL,
  
  -- Related data
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  related_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  related_place_id UUID REFERENCES places(id) ON DELETE SET NULL,
  related_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  
  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  
  -- Action
  action_url TEXT,
  action_data JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_title_length CHECK (char_length(title) >= 1 AND char_length(title) <= 200),
  CONSTRAINT valid_content_length CHECK (char_length(content) >= 1 AND char_length(content) <= 1000),
  CONSTRAINT valid_expiry CHECK (expires_at IS NULL OR expires_at > created_at)
);

-- Invitation codes table
CREATE TABLE invitation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE ON UPDATE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  
  -- Invitation code
  code TEXT NOT NULL UNIQUE,
  
  -- Settings
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  description TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ[],
  
  -- Constraints
  CONSTRAINT valid_code_format CHECK (code ~ '^[A-Z0-9]{6,12}$'),
  CONSTRAINT valid_max_uses CHECK (max_uses > 0),
  CONSTRAINT valid_current_uses CHECK (current_uses >= 0 AND current_uses <= max_uses),
  CONSTRAINT valid_expiry CHECK (expires_at IS NULL OR expires_at > created_at)
);

-- Place images table (TODO-079)
CREATE TABLE place_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE ON UPDATE CASCADE,
  
  -- Image storage info
  image_url TEXT NOT NULL,
  image_path TEXT NOT NULL, -- path in Supabase Storage
  
  -- Image metadata
  image_name TEXT,
  image_description TEXT,
  is_primary BOOLEAN DEFAULT false,
  
  -- File info
  file_size INTEGER,
  content_type TEXT,
  
  -- Ownership
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_image_name_length CHECK (image_name IS NULL OR char_length(image_name) <= 200),
  CONSTRAINT valid_image_description_length CHECK (image_description IS NULL OR char_length(image_description) <= 1000),
  CONSTRAINT valid_file_size CHECK (file_size IS NULL OR file_size > 0),
  CONSTRAINT valid_image_url CHECK (image_url ~ '^https?://'),
  CONSTRAINT valid_content_type CHECK (content_type IS NULL OR content_type ~ '^image/')
);

-- Usage events table (for analytics)
CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  
  -- Event info
  event_type TEXT NOT NULL,
  event_category TEXT, -- 'optimization', 'trip_management', 'social', etc.
  
  -- Related data
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  session_id TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Technical info
  user_agent TEXT,
  ip_address INET,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_event_type_length CHECK (char_length(event_type) >= 1 AND char_length(event_type) <= 100)
);

-- Optimization cache table
CREATE TABLE optimization_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE ON UPDATE CASCADE,
  
  -- Cache key
  places_hash TEXT NOT NULL,
  settings_hash TEXT NOT NULL,
  
  -- Cache data
  result JSONB NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Statistics
  hit_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Constraints
  CONSTRAINT valid_hash_format CHECK (
    places_hash ~ '^[A-Za-z0-9+/=]{20,}$' AND
    settings_hash ~ '^[A-Za-z0-9+/=]{10,}$'
  ),
  CONSTRAINT valid_expiry CHECK (expires_at > created_at),
  CONSTRAINT valid_hit_count CHECK (hit_count >= 0)
);

-- =============================================================================
-- 4. INDEXES
-- =============================================================================

-- Users table indexes
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_is_premium ON users(is_premium);
CREATE INDEX idx_users_premium_expires_at ON users(premium_expires_at) WHERE premium_expires_at IS NOT NULL;
CREATE INDEX idx_users_stripe_customer_id ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_users_stripe_subscription_id ON users(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_last_active_at ON users(last_active_at);
CREATE INDEX idx_users_name_trgm ON users USING gin(name gin_trgm_ops);

-- Trips table indexes
CREATE INDEX idx_trips_owner_id ON trips(owner_id);
CREATE INDEX idx_trips_start_date ON trips(start_date) WHERE start_date IS NOT NULL;
CREATE INDEX idx_trips_end_date ON trips(end_date) WHERE end_date IS NOT NULL;
CREATE INDEX idx_trips_departure_location ON trips(departure_location);
CREATE INDEX idx_trips_destination ON trips(destination) WHERE destination IS NOT NULL;
CREATE INDEX idx_trips_created_at ON trips(created_at);
CREATE INDEX idx_trips_is_public ON trips(is_public) WHERE is_public = true;
CREATE INDEX idx_trips_name_trgm ON trips USING gin(name gin_trgm_ops) WHERE name IS NOT NULL;
CREATE INDEX idx_trips_description_trgm ON trips USING gin(description gin_trgm_ops) WHERE description IS NOT NULL;

-- Places table indexes
CREATE INDEX idx_places_trip_id ON places(trip_id);
CREATE INDEX idx_places_user_id ON places(user_id);
CREATE INDEX idx_places_category ON places(category);
CREATE INDEX idx_places_scheduled ON places(scheduled);
CREATE INDEX idx_places_visit_date ON places(visit_date);
CREATE INDEX idx_places_wish_level ON places(wish_level);
CREATE INDEX idx_places_created_at ON places(created_at);
CREATE INDEX idx_places_trip_scheduled ON places(trip_id, scheduled);
CREATE INDEX idx_places_trip_category ON places(trip_id, category);
CREATE INDEX idx_places_trip_user ON places(trip_id, user_id);
CREATE INDEX idx_places_location_point ON places USING GIST(location_point) WHERE location_point IS NOT NULL;
CREATE INDEX idx_places_name_trgm ON places USING gin(name gin_trgm_ops);
CREATE INDEX idx_places_address_trgm ON places USING gin(address gin_trgm_ops) WHERE address IS NOT NULL;

-- Trip members table indexes
CREATE INDEX idx_trip_members_trip_id ON trip_members(trip_id);
CREATE INDEX idx_trip_members_user_id ON trip_members(user_id);
CREATE INDEX idx_trip_members_role ON trip_members(role);
CREATE INDEX idx_trip_members_joined_at ON trip_members(joined_at);

-- Messages table indexes
CREATE INDEX idx_messages_trip_id ON messages(trip_id);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_message_type ON messages(message_type);
CREATE INDEX idx_messages_reply_to ON messages(reply_to) WHERE reply_to IS NOT NULL;
CREATE INDEX idx_messages_thread_id ON messages(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX idx_messages_trip_created ON messages(trip_id, created_at DESC);
CREATE INDEX idx_messages_content_trgm ON messages USING gin(content gin_trgm_ops) WHERE is_deleted = false;

-- Optimization results table indexes
CREATE INDEX idx_optimization_results_trip_id ON optimization_results(trip_id);
CREATE INDEX idx_optimization_results_created_by ON optimization_results(created_by);
CREATE INDEX idx_optimization_results_created_at ON optimization_results(created_at);
CREATE INDEX idx_optimization_results_is_active ON optimization_results(is_active) WHERE is_active = true;
CREATE INDEX idx_optimization_results_trip_active ON optimization_results(trip_id, is_active) WHERE is_active = true;

-- Notifications table indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_trip_id ON notifications(trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_expires_at ON notifications(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- Invitation codes table indexes
CREATE UNIQUE INDEX idx_invitation_codes_code ON invitation_codes(code);
CREATE INDEX idx_invitation_codes_trip_id ON invitation_codes(trip_id);
CREATE INDEX idx_invitation_codes_created_by ON invitation_codes(created_by);
CREATE INDEX idx_invitation_codes_is_active ON invitation_codes(is_active) WHERE is_active = true;
CREATE INDEX idx_invitation_codes_expires_at ON invitation_codes(expires_at) WHERE expires_at IS NOT NULL;

-- Place images table indexes (TODO-079)
CREATE INDEX idx_place_images_place_id ON place_images(place_id);
CREATE INDEX idx_place_images_uploaded_by ON place_images(uploaded_by);
CREATE INDEX idx_place_images_created_at ON place_images(created_at);
CREATE INDEX idx_place_images_is_primary ON place_images(is_primary) WHERE is_primary = true;
CREATE UNIQUE INDEX idx_place_images_primary_per_place ON place_images(place_id) WHERE is_primary = true;

-- Usage events table indexes
CREATE INDEX idx_usage_events_created_at ON usage_events(created_at);
CREATE INDEX idx_usage_events_user_id ON usage_events(user_id);
CREATE INDEX idx_usage_events_event_type ON usage_events(event_type);
CREATE INDEX idx_usage_events_trip_id ON usage_events(trip_id) WHERE trip_id IS NOT NULL;
CREATE INDEX idx_usage_events_user_created ON usage_events(user_id, created_at) WHERE user_id IS NOT NULL;

-- Optimization cache table indexes
CREATE INDEX idx_optimization_cache_trip_id ON optimization_cache(trip_id);
CREATE INDEX idx_optimization_cache_expires_at ON optimization_cache(expires_at);
CREATE INDEX idx_optimization_cache_last_accessed ON optimization_cache(last_accessed_at);
CREATE UNIQUE INDEX idx_optimization_cache_lookup ON optimization_cache(trip_id, places_hash, settings_hash);

-- =============================================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_cache ENABLE ROW LEVEL SECURITY;

-- Users table RLS policies
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable insert for authenticated users" ON users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view public info of trip members" ON users
  FOR SELECT
  USING (
    id IN (
      SELECT tm.user_id 
      FROM trip_members tm 
      WHERE tm.trip_id IN (
        SELECT tm2.trip_id 
        FROM trip_members tm2 
        WHERE tm2.user_id = auth.uid()
      )
    )
  );

-- Trips table RLS policies
CREATE POLICY "Trip members can view trips" ON trips
  FOR SELECT
  USING (
    id IN (
      SELECT trip_id 
      FROM trip_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Trip owners can update trips" ON trips
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Authenticated users can create trips" ON trips
  FOR INSERT
  WITH CHECK (
    auth.uid() = owner_id AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Trip owners can delete trips" ON trips
  FOR DELETE
  USING (owner_id = auth.uid());

-- Places table RLS policies
CREATE POLICY "Trip members can view places" ON places
  FOR SELECT
  USING (
    trip_id IN (
      SELECT trip_id 
      FROM trip_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can add places" ON places
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    trip_id IN (
      SELECT tm.trip_id 
      FROM trip_members tm 
      WHERE tm.user_id = auth.uid() AND tm.can_add_places = true
    )
  );

CREATE POLICY "Place owners or admins can update places" ON places
  FOR UPDATE
  USING (
    user_id = auth.uid() OR
    trip_id IN (
      SELECT tm.trip_id 
      FROM trip_members tm 
      WHERE tm.user_id = auth.uid() AND 
            (tm.role = 'admin' OR tm.can_edit_places = true)
    )
  )
  WITH CHECK (
    user_id = auth.uid() OR
    trip_id IN (
      SELECT tm.trip_id 
      FROM trip_members tm 
      WHERE tm.user_id = auth.uid() AND 
            (tm.role = 'admin' OR tm.can_edit_places = true)
    )
  );

CREATE POLICY "Place owners or admins can delete places" ON places
  FOR DELETE
  USING (
    user_id = auth.uid() OR
    trip_id IN (
      SELECT tm.trip_id 
      FROM trip_members tm 
      WHERE tm.user_id = auth.uid() AND tm.role = 'admin'
    )
  );

-- Trip members table RLS policies
CREATE POLICY "Trip members can view trip members" ON trip_members
  FOR SELECT
  USING (
    trip_id IN (
      SELECT trip_id 
      FROM trip_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Trip admins can manage members" ON trip_members
  FOR ALL
  USING (
    trip_id IN (
      SELECT tm.trip_id 
      FROM trip_members tm 
      WHERE tm.user_id = auth.uid() AND 
            (tm.role = 'admin' OR tm.can_invite_members = true)
    )
  );

CREATE POLICY "Users can join trips via invitation" ON trip_members
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Messages table RLS policies
CREATE POLICY "Trip members can view messages" ON messages
  FOR SELECT
  USING (
    trip_id IN (
      SELECT trip_id 
      FROM trip_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can send messages" ON messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    trip_id IN (
      SELECT trip_id 
      FROM trip_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Message authors can update messages" ON messages
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Message authors can delete messages" ON messages
  FOR DELETE
  USING (user_id = auth.uid());

-- Optimization results RLS policies
CREATE POLICY "Trip members can view optimization results" ON optimization_results
  FOR SELECT
  USING (
    trip_id IN (
      SELECT trip_id 
      FROM trip_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can create optimization results" ON optimization_results
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    trip_id IN (
      SELECT tm.trip_id 
      FROM trip_members tm 
      WHERE tm.user_id = auth.uid() AND tm.can_optimize = true
    )
  );

-- Notifications RLS policies
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT
  WITH CHECK (true); -- Allow system to create notifications

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Invitation codes RLS policies
CREATE POLICY "Trip members can view invitation codes" ON invitation_codes
  FOR SELECT
  USING (
    trip_id IN (
      SELECT trip_id 
      FROM trip_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Trip admins can manage invitation codes" ON invitation_codes
  FOR ALL
  USING (
    trip_id IN (
      SELECT tm.trip_id 
      FROM trip_members tm 
      WHERE tm.user_id = auth.uid() AND 
            (tm.role = 'admin' OR tm.can_invite_members = true)
    )
  );

-- Place images RLS policies (TODO-079)
CREATE POLICY "Trip members can view place images" ON place_images
  FOR SELECT
  USING (
    place_id IN (
      SELECT p.id 
      FROM places p 
      JOIN trip_members tm ON p.trip_id = tm.trip_id 
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can upload place images" ON place_images
  FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid() AND 
    place_id IN (
      SELECT p.id 
      FROM places p 
      JOIN trip_members tm ON p.trip_id = tm.trip_id 
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Image owners and trip admins can update place images" ON place_images
  FOR UPDATE
  USING (
    uploaded_by = auth.uid() OR 
    place_id IN (
      SELECT p.id 
      FROM places p 
      JOIN trip_members tm ON p.trip_id = tm.trip_id 
      WHERE tm.user_id = auth.uid() AND tm.role = 'admin'
    )
  )
  WITH CHECK (
    uploaded_by = auth.uid() OR 
    place_id IN (
      SELECT p.id 
      FROM places p 
      JOIN trip_members tm ON p.trip_id = tm.trip_id 
      WHERE tm.user_id = auth.uid() AND tm.role = 'admin'
    )
  );

CREATE POLICY "Image owners and trip admins can delete place images" ON place_images
  FOR DELETE
  USING (
    uploaded_by = auth.uid() OR 
    place_id IN (
      SELECT p.id 
      FROM places p 
      JOIN trip_members tm ON p.trip_id = tm.trip_id 
      WHERE tm.user_id = auth.uid() AND tm.role = 'admin'
    )
  );

-- Usage events RLS policies
CREATE POLICY "Users can view own usage events" ON usage_events
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can create usage events" ON usage_events
  FOR INSERT
  WITH CHECK (true); -- Allow system to create usage events

-- Optimization cache RLS policies
CREATE POLICY "Trip members can view optimization cache" ON optimization_cache
  FOR SELECT
  USING (
    trip_id IN (
      SELECT trip_id 
      FROM trip_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can manage optimization cache" ON optimization_cache
  FOR ALL
  USING (
    trip_id IN (
      SELECT trip_id 
      FROM trip_members 
      WHERE user_id = auth.uid()
    )
  );

-- =============================================================================
-- 6. FUNCTIONS
-- =============================================================================

-- Update updated_at column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS 
'BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;'
LANGUAGE plpgsql;

-- Update location point function
CREATE OR REPLACE FUNCTION update_location_point()
RETURNS TRIGGER AS 
'BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location_point = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  ELSE
    NEW.location_point = NULL;
  END IF;
  RETURN NEW;
END;'
LANGUAGE plpgsql;

-- Update trip statistics function
CREATE OR REPLACE FUNCTION update_trip_statistics(p_trip_id UUID) RETURNS VOID AS 
'BEGIN
  UPDATE trips SET
    total_places = (
      SELECT COUNT(*) FROM places WHERE trip_id = p_trip_id
    ),
    total_members = (
      SELECT COUNT(*) FROM trip_members WHERE trip_id = p_trip_id
    ),
    updated_at = NOW()
  WHERE id = p_trip_id;
END;'
LANGUAGE plpgsql SECURITY DEFINER;

-- Auto update trip statistics function
CREATE OR REPLACE FUNCTION auto_update_trip_statistics()
RETURNS TRIGGER AS 
'BEGIN
  IF TG_OP = ''INSERT'' THEN
    PERFORM update_trip_statistics(NEW.trip_id);
  ELSIF TG_OP = ''DELETE'' THEN
    PERFORM update_trip_statistics(OLD.trip_id);
  ELSIF TG_OP = ''UPDATE'' AND NEW.trip_id != OLD.trip_id THEN
    PERFORM update_trip_statistics(OLD.trip_id);
    PERFORM update_trip_statistics(NEW.trip_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;'
LANGUAGE plpgsql;

-- Create trip with owner function
CREATE OR REPLACE FUNCTION create_trip_with_owner(
  p_departure_location TEXT,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_destination TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_owner_id UUID
) RETURNS UUID AS 
'DECLARE
  v_trip_id UUID;
  v_trip_name TEXT;
  v_final_destination TEXT;
BEGIN
  -- Auto-generate name if not provided
  IF p_name IS NULL THEN
    v_trip_name := p_departure_location || ''からの旅行'';
  ELSE
    v_trip_name := p_name;
  END IF;
  
  -- Handle destination logic
  -- If destination is empty, null, or "same as departure location", use departure location
  IF p_destination IS NULL OR p_destination = '''' OR LOWER(p_destination) = ''same as departure location'' THEN
    v_final_destination := p_departure_location;
  ELSE
    v_final_destination := p_destination;
  END IF;
  
  INSERT INTO trips (departure_location, name, description, destination, start_date, end_date, owner_id)
  VALUES (p_departure_location, v_trip_name, p_description, v_final_destination, p_start_date, p_end_date, p_owner_id)
  RETURNING id INTO v_trip_id;
  
  INSERT INTO trip_members (trip_id, user_id, role, can_add_places, can_edit_places, can_optimize, can_invite_members)
  VALUES (v_trip_id, p_owner_id, ''admin'', true, true, true, true);
  
  -- Add departure location as the first place (mandatory)
  INSERT INTO places (
    name, 
    category, 
    trip_id, 
    user_id, 
    wish_level, 
    stay_duration_minutes,
    scheduled,
    scheduled_date,
    notes,
    source
  ) VALUES (
    p_departure_location || '' (Departure)'',
    ''departure_point'',
    v_trip_id,
    p_owner_id,
    5,
    60,
    CASE WHEN p_start_date IS NOT NULL THEN true ELSE false END,
    p_start_date,
    ''Auto-generated departure location'',
    ''system''
  );
  
  -- Add destination/return point as the last place
  IF v_final_destination != p_departure_location THEN
    -- Different destination: add as final destination
    INSERT INTO places (
      name, 
      category, 
      trip_id, 
      user_id, 
      wish_level, 
      stay_duration_minutes,
      scheduled,
      scheduled_date,
      notes,
      source
    ) VALUES (
      v_final_destination || '' (Final Destination)'',
      ''destination_point'',
      v_trip_id,
      p_owner_id,
      5,
      60,
      CASE WHEN p_end_date IS NOT NULL THEN true ELSE false END,
      p_end_date,
      ''Auto-generated final destination'',
      ''system''
    );
  ELSE
    -- Same as departure: add return point
    INSERT INTO places (
      name, 
      category, 
      trip_id, 
      user_id, 
      wish_level, 
      stay_duration_minutes,
      scheduled,
      scheduled_date,
      notes,
      source
    ) VALUES (
      v_final_destination || '' (Return)'',
      ''return_point'',
      v_trip_id,
      p_owner_id,
      5,
      60,
      CASE WHEN p_end_date IS NOT NULL THEN true ELSE false END,
      p_end_date,
      ''Auto-generated return to departure location'',
      ''system''
    );
  END IF;
  
  -- Update statistics
  UPDATE trips SET 
    total_members = 1,
    total_places = (SELECT COUNT(*) FROM places WHERE trip_id = v_trip_id)
  WHERE id = v_trip_id;
  
  RETURN v_trip_id;
END;'
LANGUAGE plpgsql SECURITY DEFINER;

-- Generate invitation code function
CREATE OR REPLACE FUNCTION generate_invitation_code(
  p_trip_id UUID,
  p_created_by UUID,
  p_max_uses INTEGER DEFAULT 1,
  p_expires_hours INTEGER DEFAULT 72
) RETURNS TEXT AS 
'DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM trip_members 
    WHERE trip_id = p_trip_id 
    AND user_id = p_created_by 
    AND (role = ''admin'' OR can_invite_members = true)
  ) THEN
    RAISE EXCEPTION ''Insufficient permissions to create invitation code'';
  END IF;
  
  LOOP
    v_code := UPPER(
      SUBSTRING(
        ENCODE(gen_random_bytes(6), ''base64''),
        1, 8
      )
    );
    
    v_code := REGEXP_REPLACE(v_code, ''[^A-Z0-9]'', '''', ''g'');
    
    IF LENGTH(v_code) < 8 THEN
      v_code := v_code || SUBSTRING(''ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'', 1, 8 - LENGTH(v_code));
    ELSE
      v_code := SUBSTRING(v_code, 1, 8);
    END IF;
    
    SELECT EXISTS(SELECT 1 FROM invitation_codes WHERE code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  INSERT INTO invitation_codes (trip_id, created_by, code, max_uses, expires_at)
  VALUES (
    p_trip_id, 
    p_created_by, 
    v_code, 
    p_max_uses,
    NOW() + INTERVAL ''1 hour'' * p_expires_hours
  );
  
  RETURN v_code;
END;'
LANGUAGE plpgsql SECURITY DEFINER;

-- Use invitation code function
CREATE OR REPLACE FUNCTION use_invitation_code(
  p_code TEXT,
  p_user_id UUID
) RETURNS UUID AS 
'DECLARE
  v_invitation invitation_codes%ROWTYPE;
  v_trip_id UUID;
BEGIN
  SELECT * INTO v_invitation 
  FROM invitation_codes 
  WHERE code = UPPER(p_code) 
  AND is_active = true 
  AND (expires_at IS NULL OR expires_at > NOW())
  AND current_uses < max_uses;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION ''Invalid or expired invitation code'';
  END IF;
  
  v_trip_id := v_invitation.trip_id;
  
  IF EXISTS (
    SELECT 1 FROM trip_members 
    WHERE trip_id = v_trip_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION ''User is already a member of this trip'';
  END IF;
  
  INSERT INTO trip_members (trip_id, user_id, role, invited_by, invitation_accepted_at)
  VALUES (v_trip_id, p_user_id, ''member'', v_invitation.created_by, NOW());
  
  UPDATE invitation_codes 
  SET current_uses = current_uses + 1,
      used_at = array_append(used_at, NOW())
  WHERE id = v_invitation.id;
  
  UPDATE trips 
  SET total_members = (
    SELECT COUNT(*) FROM trip_members WHERE trip_id = v_trip_id
  )
  WHERE id = v_trip_id;
  
  INSERT INTO notifications (
    user_id, title, content, notification_type, trip_id, related_user_id
  )
  SELECT 
    tm.user_id,
    ''New member joined'',
    (SELECT name FROM users WHERE id = p_user_id) || '' joined '' || t.name,
    ''trip_invitation'',
    v_trip_id,
    p_user_id
  FROM trip_members tm
  JOIN trips t ON t.id = v_trip_id
  WHERE tm.trip_id = v_trip_id AND tm.user_id != p_user_id;
  
  RETURN v_trip_id;
END;'
LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup expired data function
CREATE OR REPLACE FUNCTION cleanup_expired_data() RETURNS INTEGER AS 
'DECLARE
  v_deleted_count INTEGER := 0;
BEGIN
  DELETE FROM optimization_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  UPDATE invitation_codes 
  SET is_active = false 
  WHERE expires_at < NOW() AND is_active = true;
  
  DELETE FROM notifications WHERE expires_at < NOW();
  
  DELETE FROM usage_events WHERE created_at < NOW() - INTERVAL ''3 months'';
  
  RETURN v_deleted_count;
END;'
LANGUAGE plpgsql SECURITY DEFINER;

-- Create notification on place add function
CREATE OR REPLACE FUNCTION create_notification_on_place_add()
RETURNS TRIGGER AS 
'BEGIN
  INSERT INTO notifications (user_id, title, content, notification_type, trip_id, related_place_id, related_user_id)
  SELECT 
    tm.user_id,
    ''New place added'',
    (SELECT name FROM users WHERE id = NEW.user_id) || '' added '' || NEW.name || '' to '' || (SELECT name FROM trips WHERE id = NEW.trip_id),
    ''place_added'',
    NEW.trip_id,
    NEW.id,
    NEW.user_id
  FROM trip_members tm
  WHERE tm.trip_id = NEW.trip_id 
  AND tm.user_id != NEW.user_id;
  
  RETURN NEW;
END;'
LANGUAGE plpgsql SECURITY DEFINER;

-- Validate visit date in trip function
CREATE OR REPLACE FUNCTION validate_visit_date_in_trip()
RETURNS TRIGGER AS 
'DECLARE
  trip_start_date DATE;
  trip_end_date DATE;
BEGIN
  IF NEW.visit_date IS NULL THEN
    RETURN NEW;
  END IF;
  
  SELECT start_date, end_date INTO trip_start_date, trip_end_date
  FROM trips WHERE id = NEW.trip_id;
  
  IF NEW.visit_date < trip_start_date OR NEW.visit_date > trip_end_date THEN
    RAISE EXCEPTION ''Visit date must be within trip duration (% to %)'', trip_start_date, trip_end_date;
  END IF;
  
  RETURN NEW;
END;'
LANGUAGE plpgsql;

-- =============================================================================
-- 7. TRIGGERS
-- =============================================================================

-- Update timestamp triggers
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trips_updated_at 
  BEFORE UPDATE ON trips 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_places_updated_at 
  BEFORE UPDATE ON places 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_place_images_updated_at 
  BEFORE UPDATE ON place_images 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Location point update trigger
CREATE TRIGGER update_places_location_point
  BEFORE INSERT OR UPDATE ON places
  FOR EACH ROW EXECUTE FUNCTION update_location_point();

-- Statistics update triggers
CREATE TRIGGER auto_update_places_statistics
  AFTER INSERT OR UPDATE OR DELETE ON places
  FOR EACH ROW EXECUTE FUNCTION auto_update_trip_statistics();

CREATE TRIGGER auto_update_members_statistics
  AFTER INSERT OR UPDATE OR DELETE ON trip_members
  FOR EACH ROW EXECUTE FUNCTION auto_update_trip_statistics();

-- Notification triggers
CREATE TRIGGER notify_place_added
  AFTER INSERT ON places
  FOR EACH ROW EXECUTE FUNCTION create_notification_on_place_add();

-- Visit date validation trigger
CREATE TRIGGER validate_places_visit_date
  BEFORE INSERT OR UPDATE ON places
  FOR EACH ROW EXECUTE FUNCTION validate_visit_date_in_trip();

-- =============================================================================
-- 8. VIEWS
-- =============================================================================

-- Trip summary view
CREATE VIEW trip_summary AS
SELECT 
  t.id,
  t.name,
  t.description,
  t.departure_location,
  t.destination,
  t.start_date,
  t.end_date,
  t.created_at,
  t.updated_at,
  
  -- Statistics
  COUNT(DISTINCT tm.user_id) as member_count,
  COUNT(DISTINCT p.id) as place_count,
  COUNT(DISTINCT p.id) FILTER (WHERE p.scheduled = true) as scheduled_place_count,
  
  -- Latest activity
  MAX(p.created_at) as last_place_added,
  MAX(m.created_at) as last_message_sent,
  MAX(or_recent.created_at) as last_optimized,
  
  -- Owner info
  u.name as owner_name,
  u.avatar_url as owner_avatar,
  
  -- Progress info
  CASE 
    WHEN t.start_date IS NULL OR t.end_date IS NULL THEN 'planning'
    WHEN t.start_date > CURRENT_DATE THEN 'planning'
    WHEN t.end_date < CURRENT_DATE THEN 'completed'
    ELSE 'active'
  END as status,
  
  -- Place add deadline
  CASE 
    WHEN t.add_place_deadline IS NOT NULL AND t.add_place_deadline < NOW() THEN true
    ELSE false
  END as add_place_deadline_passed

FROM trips t
LEFT JOIN users u ON u.id = t.owner_id
LEFT JOIN trip_members tm ON tm.trip_id = t.id
LEFT JOIN places p ON p.trip_id = t.id
LEFT JOIN messages m ON m.trip_id = t.id
LEFT JOIN optimization_results or_recent ON or_recent.trip_id = t.id AND or_recent.is_active = true

GROUP BY t.id, u.name, u.avatar_url, or_recent.created_at;

-- User activity summary view
CREATE VIEW user_activity_summary AS
SELECT 
  u.id,
  u.name,
  u.email,
  u.is_premium,
  u.last_active_at,
  
  -- Trip statistics
  COUNT(DISTINCT t.id) as total_trips,
  COUNT(DISTINCT CASE WHEN tm.role = 'admin' THEN t.id END) as owned_trips,
  COUNT(DISTINCT p.id) as total_places_added,
  COUNT(DISTINCT m.id) as total_messages_sent,
  
  -- Optimization statistics
  COUNT(DISTINCT or_stats.id) as optimization_runs,
  AVG(or_stats.execution_time_ms) as avg_optimization_time,
  
  -- Latest activity
  MAX(p.created_at) as last_place_added,
  MAX(m.created_at) as last_message_sent,
  MAX(or_stats.created_at) as last_optimization_run

FROM users u
LEFT JOIN trip_members tm ON tm.user_id = u.id
LEFT JOIN trips t ON t.id = tm.trip_id
LEFT JOIN places p ON p.user_id = u.id
LEFT JOIN messages m ON m.user_id = u.id
LEFT JOIN optimization_results or_stats ON or_stats.created_by = u.id

GROUP BY u.id, u.name, u.email, u.is_premium, u.last_active_at;

-- =============================================================================
-- 9. INITIAL SETUP
-- =============================================================================

-- Schema migrations table
-- =============================================================================
-- External API Quota Management
-- =============================================================================

CREATE TABLE api_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_type TEXT NOT NULL, -- 'google_places', 'pexels'
  used_count INTEGER DEFAULT 0,
  quota_limit INTEGER NOT NULL,
  last_reset TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(api_type)
);

-- Add RLS for api_quotas (service role only)
ALTER TABLE api_quotas ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage quotas
CREATE POLICY "Service role can manage API quotas" ON api_quotas
  FOR ALL 
  TO service_role
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_api_quotas_updated_at
  BEFORE UPDATE ON api_quotas
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- Index for efficient quota checks
CREATE INDEX idx_api_quotas_type_reset ON api_quotas(api_type, last_reset);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Record initial migration
INSERT INTO schema_migrations (version) VALUES ('001_initial_schema')
ON CONFLICT (version) DO NOTHING;

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE trips;
ALTER PUBLICATION supabase_realtime ADD TABLE places;
ALTER PUBLICATION supabase_realtime ADD TABLE trip_members;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE optimization_results;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- =============================================================================
-- SETUP COMPLETE
-- =============================================================================

-- The Voypath database is now ready for use with:
-- ✅ All tables with proper constraints and relationships
-- ✅ Comprehensive indexing for performance
-- ✅ Row Level Security (RLS) policies for data access control
-- ✅ Triggers for automatic data management
-- ✅ Functions for business logic
-- ✅ Views for complex queries
-- ✅ Realtime subscriptions enabled
-- ✅ Ready for React + TypeScript + Supabase integration