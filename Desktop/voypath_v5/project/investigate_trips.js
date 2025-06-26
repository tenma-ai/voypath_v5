#!/usr/bin/env node

// Trip investigation script
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rdufxwoeneglyponagdz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0ODY3NDgsImV4cCI6MjA2NTA2Mjc0OH0.n4rjoYq3hdi145qlH-JC-xn6PCTA1vEsdpX_vS-YK08';

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateTrips() {
  console.log('🔍 Investigating trips "dsファ" and "jsdajfd"...\n');

  try {
    // 1. Search for trips with these names
    console.log('1. 📋 Searching for trips...');
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('*')
      .or('name.ilike.%dsファ%,name.ilike.%jsdajfd%');

    if (tripsError) {
      console.error('❌ Error fetching trips:', tripsError);
      return;
    }

    if (!trips || trips.length === 0) {
      console.log('❌ No trips found with names containing "dsファ" or "jsdajfd"');
      return;
    }

    console.log(`✅ Found ${trips.length} trip(s):`);
    trips.forEach(trip => {
      console.log(`   - ID: ${trip.id}, Name: "${trip.name}", Owner: ${trip.owner_id}`);
      console.log(`     Created: ${trip.created_at}, Last optimized: ${trip.last_optimized_at}`);
    });

    // 2. Get places for each trip
    console.log('\n2. 📍 Fetching places for each trip...');
    for (const trip of trips) {
      console.log(`\n--- Places for trip "${trip.name}" (${trip.id}) ---`);
      
      const { data: places, error: placesError } = await supabase
        .from('places')
        .select('*')
        .eq('trip_id', trip.id)
        .order('created_at', { ascending: true });

      if (placesError) {
        console.error(`❌ Error fetching places for trip ${trip.id}:`, placesError);
        continue;
      }

      console.log(`Found ${places?.length || 0} places:`);
      places?.forEach((place, index) => {
        console.log(`   ${index + 1}. ${place.name}`);
        console.log(`      - Lat/Lng: ${place.latitude}, ${place.longitude}`);
        console.log(`      - is_selected_for_optimization: ${place.is_selected_for_optimization}`);
        console.log(`      - Category: ${place.category}`);
        console.log(`      - Wish level: ${place.wish_level}`);
        console.log(`      - Created: ${place.created_at}`);
      });
    }

    // 3. Get optimization results for each trip
    console.log('\n3. 🎯 Fetching optimization results...');
    for (const trip of trips) {
      console.log(`\n--- Optimization results for trip "${trip.name}" (${trip.id}) ---`);
      
      const { data: optimizations, error: optimizationError } = await supabase
        .from('optimization_results')
        .select('*')
        .eq('trip_id', trip.id)
        .order('created_at', { ascending: false });

      if (optimizationError) {
        console.error(`❌ Error fetching optimization results for trip ${trip.id}:`, optimizationError);
        continue;
      }

      console.log(`Found ${optimizations?.length || 0} optimization result(s):`);
      optimizations?.forEach((opt, index) => {
        console.log(`   ${index + 1}. ID: ${opt.id}, Active: ${opt.is_active}`);
        console.log(`      - Created: ${opt.created_at}`);
        console.log(`      - Places count: ${opt.places_count}`);
        console.log(`      - Execution time: ${opt.execution_time_ms}ms`);
        console.log(`      - Algorithm version: ${opt.algorithm_version}`);
        
        // Analyze the optimized_route structure
        if (opt.optimized_route) {
          console.log(`      - Optimized route structure:`);
          if (typeof opt.optimized_route === 'object') {
            const route = opt.optimized_route;
            if (route.daily_schedules && Array.isArray(route.daily_schedules)) {
              console.log(`        - Daily schedules: ${route.daily_schedules.length} day(s)`);
              route.daily_schedules.forEach((day, dayIndex) => {
                console.log(`          Day ${dayIndex + 1}: ${day.places?.length || 0} places`);
                if (day.places && day.places.length > 0) {
                  day.places.forEach((place, placeIndex) => {
                    console.log(`            ${placeIndex + 1}. ${place.name || place.id}`);
                    if (place.coordinates) {
                      console.log(`               Coords: [${place.coordinates[0]}, ${place.coordinates[1]}]`);
                    }
                  });
                }
              });
            } else {
              console.log(`        - Route keys: ${Object.keys(route).join(', ')}`);
            }
          }
        }
      });
    }

    // 4. Detailed comparison
    console.log('\n4. 🔍 Detailed comparison between trips...');
    if (trips.length >= 2) {
      const trip1 = trips[0];
      const trip2 = trips[1];
      
      console.log(`\nComparing "${trip1.name}" vs "${trip2.name}":`);
      
      // Get places for both trips
      const { data: places1 } = await supabase
        .from('places')
        .select('*')
        .eq('trip_id', trip1.id);
        
      const { data: places2 } = await supabase
        .from('places')
        .select('*')
        .eq('trip_id', trip2.id);

      // Get optimization results for both trips  
      const { data: opt1 } = await supabase
        .from('optimization_results')
        .select('*')
        .eq('trip_id', trip1.id)
        .eq('is_active', true)
        .single();
        
      const { data: opt2 } = await supabase
        .from('optimization_results')
        .select('*')
        .eq('trip_id', trip2.id)
        .eq('is_active', true)
        .single();

      console.log('\nPlaces comparison:');
      console.log(`  ${trip1.name}: ${places1?.length || 0} places`);
      console.log(`  ${trip2.name}: ${places2?.length || 0} places`);
      
      // Check coordinates validity
      const validCoords1 = places1?.filter(p => p.latitude && p.longitude).length || 0;
      const validCoords2 = places2?.filter(p => p.latitude && p.longitude).length || 0;
      console.log(`  Valid coordinates: ${trip1.name}=${validCoords1}, ${trip2.name}=${validCoords2}`);
      
      // Check optimization selection
      const selected1 = places1?.filter(p => p.is_selected_for_optimization).length || 0;
      const selected2 = places2?.filter(p => p.is_selected_for_optimization).length || 0;
      console.log(`  Selected for optimization: ${trip1.name}=${selected1}, ${trip2.name}=${selected2}`);

      console.log('\nOptimization results comparison:');
      console.log(`  ${trip1.name}: ${opt1 ? 'HAS' : 'NO'} active optimization`);
      console.log(`  ${trip2.name}: ${opt2 ? 'HAS' : 'NO'} active optimization`);
      
      if (opt1) {
        console.log(`    - Places in optimization: ${opt1.places_count}`);
        console.log(`    - Daily schedules: ${opt1.optimized_route?.daily_schedules?.length || 'N/A'}`);
      }
      
      if (opt2) {
        console.log(`    - Places in optimization: ${opt2.places_count}`);
        console.log(`    - Daily schedules: ${opt2.optimized_route?.daily_schedules?.length || 'N/A'}`);
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the investigation
investigateTrips().then(() => {
  console.log('\n✅ Investigation complete!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Investigation failed:', error);
  process.exit(1);
});