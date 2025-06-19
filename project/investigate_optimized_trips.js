#!/usr/bin/env node

// Find trips with optimization results
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rdufxwoeneglyponagdz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0ODY3NDgsImV4cCI6MjA2NTA2Mjc0OH0.n4rjoYq3hdi145qlH-JC-xn6PCTA1vEsdpX_vS-YK08';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findOptimizedTrips() {
  console.log('🔍 Looking for trips with optimization results...\n');

  try {
    // 1. Find all optimization results
    const { data: optimizations, error: optError } = await supabase
      .from('optimization_results')
      .select('*')
      .order('created_at', { ascending: false });

    if (optError) {
      console.error('❌ Error fetching optimization results:', optError);
      return;
    }

    console.log(`✅ Found ${optimizations?.length || 0} optimization result(s)`);

    if (!optimizations || optimizations.length === 0) {
      console.log('❌ No optimization results found in database');
      return;
    }

    // 2. Get trip info for each optimization
    const tripIds = [...new Set(optimizations.map(opt => opt.trip_id))];
    console.log(`📋 Found ${tripIds.length} unique trip(s) with optimization results`);

    for (const tripId of tripIds) {
      console.log(`\n--- Trip ${tripId} ---`);
      
      // Get trip details
      const { data: trip, error: tripError } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();

      if (tripError) {
        console.error(`❌ Error fetching trip ${tripId}:`, tripError);
        continue;
      }

      console.log(`Trip name: "${trip.name}"`);
      console.log(`Owner: ${trip.owner_id}`);
      console.log(`Created: ${trip.created_at}`);
      console.log(`Last optimized: ${trip.last_optimized_at}`);

      // Get places for this trip
      const { data: places, error: placesError } = await supabase
        .from('places')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true });

      if (placesError) {
        console.error(`❌ Error fetching places for trip ${tripId}:`, placesError);
        continue;
      }

      console.log(`Places: ${places?.length || 0} total`);
      const validCoords = places?.filter(p => p.latitude && p.longitude).length || 0;
      const selectedForOpt = places?.filter(p => p.is_selected_for_optimization).length || 0;
      console.log(`  - Valid coordinates: ${validCoords}`);
      console.log(`  - Selected for optimization: ${selectedForOpt}`);

      // Get optimization results for this trip
      const tripOptimizations = optimizations.filter(opt => opt.trip_id === tripId);
      console.log(`Optimization results: ${tripOptimizations.length}`);

      tripOptimizations.forEach((opt, index) => {
        console.log(`  ${index + 1}. ID: ${opt.id}, Active: ${opt.is_active}`);
        console.log(`     Created: ${opt.created_at}`);
        console.log(`     Places count: ${opt.places_count}`);
        console.log(`     Execution time: ${opt.execution_time_ms}ms`);

        // Analyze the optimized_route structure in detail
        if (opt.optimized_route) {
          console.log(`     Optimized route analysis:`);
          const route = opt.optimized_route;
          
          if (typeof route === 'object') {
            console.log(`       - Type: ${Array.isArray(route) ? 'Array' : 'Object'}`);
            console.log(`       - Keys: ${Object.keys(route).join(', ')}`);
            
            if (route.daily_schedules && Array.isArray(route.daily_schedules)) {
              console.log(`       - Daily schedules: ${route.daily_schedules.length} day(s)`);
              route.daily_schedules.forEach((day, dayIndex) => {
                console.log(`         Day ${dayIndex + 1}:`);
                console.log(`           - Date: ${day.date || 'N/A'}`);
                console.log(`           - Places: ${day.places?.length || 0}`);
                
                if (day.places && day.places.length > 0) {
                  day.places.forEach((place, placeIndex) => {
                    console.log(`             ${placeIndex + 1}. ${place.name || place.id || 'Unnamed'}`);
                    if (place.coordinates && Array.isArray(place.coordinates)) {
                      console.log(`                Coords: [${place.coordinates[0]}, ${place.coordinates[1]}]`);
                    } else if (place.latitude && place.longitude) {
                      console.log(`                Lat/Lng: ${place.latitude}, ${place.longitude}`);
                    }
                    if (place.start_time) {
                      console.log(`                Start time: ${place.start_time}`);
                    }
                    if (place.end_time) {
                      console.log(`                End time: ${place.end_time}`);
                    }
                  });
                }
              });
            }
            
            if (route.metadata) {
              console.log(`       - Metadata keys: ${Object.keys(route.metadata).join(', ')}`);
            }
          }
        }
      });
    }

    // 3. Summary of findings
    console.log('\n🎯 Summary of findings:');
    console.log(`- Total optimization results: ${optimizations.length}`);
    console.log(`- Unique trips with optimizations: ${tripIds.length}`);
    
    const activeOptimizations = optimizations.filter(opt => opt.is_active);
    console.log(`- Active optimizations: ${activeOptimizations.length}`);
    
    const tripsWithDailySchedules = optimizations.filter(opt => 
      opt.optimized_route && 
      opt.optimized_route.daily_schedules && 
      Array.isArray(opt.optimized_route.daily_schedules) &&
      opt.optimized_route.daily_schedules.length > 0
    );
    console.log(`- Optimizations with daily schedules: ${tripsWithDailySchedules.length}`);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the investigation
findOptimizedTrips().then(() => {
  console.log('\n✅ Investigation complete!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Investigation failed:', error);
  process.exit(1);
});