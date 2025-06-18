import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupSystemPlaces() {
  try {
    console.log('Analyzing system places...');
    
    // Get all places grouped by trip
    const { data: allPlaces, error: fetchError } = await supabase
      .from('places')
      .select('id, name, place_type, trip_id, created_at')
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('Error fetching places:', fetchError);
      return;
    }

    // Group by trip and find duplicates
    const placesByTrip = {};
    allPlaces.forEach(place => {
      if (!placesByTrip[place.trip_id]) {
        placesByTrip[place.trip_id] = [];
      }
      placesByTrip[place.trip_id].push(place);
    });

    console.log(`Found ${Object.keys(placesByTrip).length} trips`);

    // Check each trip for duplicate system places
    for (const [tripId, places] of Object.entries(placesByTrip)) {
      const departures = places.filter(p => p.place_type === 'departure');
      const destinations = places.filter(p => p.place_type === 'destination');
      
      if (departures.length > 1) {
        console.log(`Trip ${tripId} has ${departures.length} departure places - keeping newest`);
        // Keep the newest one
        const toDelete = departures.slice(0, -1);
        for (const place of toDelete) {
          const { error } = await supabase
            .from('places')
            .delete()
            .eq('id', place.id);
          if (error) console.error(`Failed to delete duplicate departure ${place.id}:`, error);
          else console.log(`Deleted duplicate departure: ${place.name}`);
        }
      }
      
      if (destinations.length > 1) {
        console.log(`Trip ${tripId} has ${destinations.length} destination places - keeping newest`);
        // Keep the newest one
        const toDelete = destinations.slice(0, -1);
        for (const place of toDelete) {
          const { error } = await supabase
            .from('places')
            .delete()
            .eq('id', place.id);
          if (error) console.error(`Failed to delete duplicate destination ${place.id}:`, error);
          else console.log(`Deleted duplicate destination: ${place.name}`);
        }
      }
    }

    console.log('✅ Cleanup completed');

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the cleanup
cleanupSystemPlaces();