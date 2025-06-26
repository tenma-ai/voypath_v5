-- Add optimization_updates table for real-time notifications
-- This table tracks optimization updates for real-time synchronization

CREATE TABLE IF NOT EXISTS optimization_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES trip_groups(id) ON DELETE CASCADE,
  update_type TEXT NOT NULL, -- 'route_optimized', 'place_added', 'place_removed', 'preferences_updated'
  data JSONB,
  user_id UUID REFERENCES users(id),
  session_id TEXT, -- for guest users
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE optimization_updates ENABLE ROW LEVEL SECURITY;

-- Create policy for optimization_updates
CREATE POLICY "Allow all operations on optimization_updates" 
ON optimization_updates 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_optimization_updates_group_id ON optimization_updates(group_id);
CREATE INDEX IF NOT EXISTS idx_optimization_updates_timestamp ON optimization_updates(timestamp DESC);

-- Grant permissions
GRANT ALL ON optimization_updates TO authenticated, anon;

-- Add comment
COMMENT ON TABLE optimization_updates IS 'Real-time notification updates for optimization events';