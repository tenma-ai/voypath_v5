-- Add session-based user settings for trip persistence
CREATE TABLE IF NOT EXISTS session_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  setting_key TEXT NOT NULL,
  setting_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, setting_key)
);

-- Enable RLS
ALTER TABLE session_settings ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Allow all operations on session_settings"
  ON session_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_session_settings_session_key 
ON session_settings(session_id, setting_key);