-- Fix booking_type check constraint to allow all supported types
-- Current constraint only allows 'flight' and 'hotel' 
-- Need to add 'walking' and 'car' for transport bookings

-- Drop the existing constraint
ALTER TABLE bookings 
DROP CONSTRAINT IF EXISTS bookings_booking_type_check;

-- Add the updated constraint with all supported booking types
ALTER TABLE bookings 
ADD CONSTRAINT bookings_booking_type_check 
CHECK (booking_type IN ('flight', 'hotel', 'walking', 'car'));

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT bookings_booking_type_check ON bookings IS 
'Ensures booking_type is one of: flight, hotel, walking, or car';