const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rdufxwoeneglyponagdz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0ODY3NDgsImV4cCI6MjA2NTA2Mjc0OH0.n4rjoYq3hdi145qlH-JC-xn6PCTA1vEsdpX_vS-YK08';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSystemPlacesCreation() {
  console.log('Testing system places creation with stay_duration fix...');
  
  const tripId = '737a36f2-66b0-4dfa-a764-3d6e305faf11';
  const userId = '033523e2-377c-4479-a5cd-90d8905f7bd0';
  
  // Get trip information
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single();

  if (tripError || !trip) {
    console.error('Failed to get trip:', tripError);
    return;
  }
  
  console.log('Trip info - departure:', trip.departure_location, 'destination:', trip.destination);

  const systemPlaces = [];

  // Create departure place with proper stay_duration_minutes
  if (trip.departure_location) {
    systemPlaces.push({
      name: 'Departure: ' + trip.departure_location,
      category: 'transportation',
      address: trip.departure_location,
      latitude: 35.6812,
      longitude: 139.7671,
      rating: 0,
      wish_level: 5,
      stay_duration_minutes: 60, // Fixed value >= 30
      price_level: 1,
      trip_id: tripId,
      user_id: userId,
      place_type: 'departure',
      source: 'system_generated'
    });
  }

  if (systemPlaces.length > 0) {
    try {
      const { data, error } = await supabase
        .from('places')
        .insert(systemPlaces)
        .select();

      if (error) {
        console.error('❌ Failed to create system places:', error.message);
      } else {
        console.log('✅ Created', systemPlaces.length, 'system places successfully');
        data.forEach(place => {
          console.log('  -', place.name, ': stay_duration_minutes =', place.stay_duration_minutes);
        });
      }
    } catch (err) {
      console.error('❌ System places creation error:', err.message);
    }
  } else {
    console.log('No system places needed for this trip');
  }
}

testSystemPlacesCreation();