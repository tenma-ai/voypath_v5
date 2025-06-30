import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://rdufxwoeneglyponagdz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0ODY3NDgsImV4cCI6MjA2NTA2Mjc0OH0.n4rjoYq3hdi145qlH-JC-xn6PCTA1vEsdpX_vS-YK08';

const supabase = createClient(supabaseUrl, supabaseKey);

async function queryPlaces() {
  const tripId = 'ca09279b-6509-42d9-9cf9-cda1efe85846';
  
  console.log(`\n=== Querying places for trip ID: ${tripId} ===\n`);
  
  try {
    // Query places for the specific trip
    const { data: places, error } = await supabase
      .from('places')
      .select(`
        id,
        name,
        category,
        source,
        place_type,
        wish_level,
        stay_duration_minutes,
        latitude,
        longitude,
        address,
        user_id,
        created_at,
        scheduled,
        display_color,
        notes
      `)
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error querying places:', error);
      return;
    }

    if (!places || places.length === 0) {
      console.log('No places found for this trip ID');
      return;
    }

    console.log(`Found ${places.length} places:\n`);
    console.log('==========================================');

    places.forEach((place, index) => {
      console.log(`${index + 1}. Place ID: ${place.id}`);
      console.log(`   Name: ${place.name}`);
      console.log(`   Category: ${place.category}`);
      console.log(`   Source: ${place.source || 'N/A'}`);
      console.log(`   Place Type: ${place.place_type || 'N/A'}`);
      console.log(`   Wish Level: ${place.wish_level}`);
      console.log(`   Stay Duration: ${place.stay_duration_minutes} minutes`);
      console.log(`   Coordinates: ${place.latitude}, ${place.longitude}`);
      console.log(`   Address: ${place.address || 'N/A'}`);
      console.log(`   User ID: ${place.user_id}`);
      console.log(`   Scheduled: ${place.scheduled}`);
      console.log(`   Display Color: ${place.display_color || 'N/A'}`);
      console.log(`   Notes: ${place.notes || 'N/A'}`);
      console.log(`   Created: ${new Date(place.created_at).toLocaleString()}`);
      console.log('==========================================');
    });

    // Identify system places (departure/destination)
    const systemPlaces = places.filter(p => p.source === 'system' || 
      p.category === 'departure_point' || 
      p.category === 'destination_point' || 
      p.category === 'return_point');
    
    const userPlaces = places.filter(p => p.source !== 'system' && 
      p.category !== 'departure_point' && 
      p.category !== 'destination_point' && 
      p.category !== 'return_point');

    console.log(`\n=== SUMMARY ===`);
    console.log(`Total places: ${places.length}`);
    console.log(`System places (departure/destination): ${systemPlaces.length}`);
    console.log(`User places: ${userPlaces.length}`);

    if (systemPlaces.length > 0) {
      console.log(`\n=== SYSTEM PLACES ===`);
      systemPlaces.forEach(place => {
        console.log(`- ${place.name} (ID: ${place.id}, Category: ${place.category})`);
      });
    }

    if (userPlaces.length > 0) {
      console.log(`\n=== USER PLACES ===`);
      userPlaces.forEach(place => {
        console.log(`- ${place.name} (ID: ${place.id}, Category: ${place.category})`);
      });
    }

    // Show the actual place IDs that should be used instead of test data
    console.log(`\n=== ACTUAL PLACE IDs FOR OPTIMIZATION ===`);
    console.log('Instead of using "test-departure" and "test-destination", use these real IDs:');
    places.forEach(place => {
      console.log(`- "${place.id}" // ${place.name} (${place.category})`);
    });

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

// Also query the trip to understand the context
async function queryTrip() {
  const tripId = 'ca09279b-6509-42d9-9cf9-cda1efe85846';
  
  console.log(`\n=== Trip Information ===\n`);
  
  try {
    const { data: trip, error } = await supabase
      .from('trips')
      .select(`
        id,
        name,
        description,
        departure_location,
        destination,
        start_date,
        end_date,
        owner_id,
        total_places,
        total_members,
        created_at
      `)
      .eq('id', tripId)
      .single();

    if (error) {
      console.error('Error querying trip:', error);
      return;
    }

    if (!trip) {
      console.log('Trip not found');
      return;
    }

    console.log(`Trip ID: ${trip.id}`);
    console.log(`Name: ${trip.name || 'N/A'}`);
    console.log(`Description: ${trip.description || 'N/A'}`);
    console.log(`Departure: ${trip.departure_location}`);
    console.log(`Destination: ${trip.destination || 'N/A'}`);
    console.log(`Start Date: ${trip.start_date || 'N/A'}`);
    console.log(`End Date: ${trip.end_date || 'N/A'}`);
    console.log(`Owner ID: ${trip.owner_id}`);
    console.log(`Total Places: ${trip.total_places}`);
    console.log(`Total Members: ${trip.total_members}`);
    console.log(`Created: ${new Date(trip.created_at).toLocaleString()}`);

  } catch (err) {
    console.error('Unexpected error querying trip:', err);
  }
}

// Run both queries
async function main() {
  await queryTrip();
  await queryPlaces();
}

main().catch(console.error);