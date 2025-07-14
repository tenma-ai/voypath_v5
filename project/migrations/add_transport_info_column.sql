-- Add transport_info column to bookings table for public transportation data
-- This column will store JSONB data with transport-specific information

ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS transport_info JSONB;

-- Add comment for the new column
COMMENT ON COLUMN bookings.transport_info IS 'JSONB field for storing transport-specific data like route details, stations, platforms, etc.';

-- Example of transport_info structure:
-- {
--   "route_details": "Route description",
--   "walking_distance": "1.2 km", 
--   "walking_duration": "15 min",
--   "line_number": "JR Yamanote Line",
--   "platform": "Platform 3",
--   "direction": "Clockwise",
--   "departure_station": "Tokyo Station",
--   "arrival_station": "Shibuya Station"
-- }