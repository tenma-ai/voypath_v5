/**
 * Optimization System Execution Test
 * Tests the complete optimization pipeline
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rdufxwoeneglyponagdz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0ODY3NDgsImV4cCI6MjA2NTA2Mjc0OH0.n4rjoYq3hdi145qlH-JC-xn6PCTA1vEsdpX_vS-YK08';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testOptimizationExecution() {
  console.log('🚀 Starting Optimization System Test...\n');

  try {
    // Step 1: Verify trip and places data
    console.log('📊 Step 1: Verifying data...');
    const tripId = '4126dd20-f7b3-4b3c-a639-a0e250c6d8f1';
    
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single();

    if (tripError) {
      throw new Error(`Trip fetch failed: ${tripError.message}`);
    }

    console.log(`✅ Trip found: ${trip.name}`);
    console.log(`📅 Trip period: ${trip.start_date} to ${trip.end_date}`);

    const { data: places, error: placesError } = await supabase
      .from('places')
      .select('id, name, scheduled, wish_level, stay_duration_minutes, latitude, longitude')
      .eq('trip_id', tripId);

    if (placesError) {
      throw new Error(`Places fetch failed: ${placesError.message}`);
    }

    console.log(`📍 Places count: ${places.length}`);
    console.log(`🔴 Unscheduled: ${places.filter(p => !p.scheduled).length}`);
    console.log(`🟢 Scheduled: ${places.filter(p => p.scheduled).length}\n`);

    // Step 2: Test Edge Functions connectivity
    console.log('🔗 Step 2: Testing Edge Functions connectivity...');
    
    const keepAliveTests = [
      { name: 'normalize-preferences', path: 'normalize-preferences' },
      { name: 'select-optimal-places', path: 'select-optimal-places' },
      { name: 'optimize-route', path: 'optimize-route' }
    ];

    for (const test of keepAliveTests) {
      try {
        const response = await supabase.functions.invoke(test.path, {
          body: { type: 'keep_alive' }
        });
        
        if (response.data?.message === 'pong') {
          console.log(`✅ ${test.name}: Connected`);
        } else {
          console.log(`❌ ${test.name}: No response`);
        }
      } catch (error) {
        console.log(`❌ ${test.name}: Error - ${error.message}`);
      }
    }

    // Step 3: Execute full optimization
    console.log('\n⚡ Step 3: Executing full optimization...');
    
    const optimizationStart = Date.now();
    
    const { data: optimizationResult, error: optimizationError } = await supabase.functions.invoke('optimize-route', {
      body: {
        trip_id: tripId,
        settings: {
          fairness_weight: 0.6,
          efficiency_weight: 0.4,
          include_meals: true,
          preferred_transport: 'public_transport'
        }
      }
    });

    const optimizationTime = Date.now() - optimizationStart;

    if (optimizationError) {
      throw new Error(`Optimization failed: ${optimizationError.message}`);
    }

    console.log(`✅ Optimization completed in ${optimizationTime}ms`);
    console.log(`📊 Success: ${optimizationResult.success}`);
    console.log(`💾 Cached: ${optimizationResult.cached}`);
    console.log(`📝 Message: ${optimizationResult.message}`);

    if (optimizationResult.optimization_result) {
      const result = optimizationResult.optimization_result;
      console.log(`\n📈 Optimization Results:`);
      console.log(`🏆 Overall Score: ${(result.optimization_score.overall * 100).toFixed(1)}%`);
      console.log(`⚖️ Fairness: ${(result.optimization_score.fairness * 100).toFixed(1)}%`);
      console.log(`⚡ Efficiency: ${(result.optimization_score.efficiency * 100).toFixed(1)}%`);
      console.log(`📅 Daily Schedules: ${result.daily_schedules.length} days`);
      
      let totalPlaces = 0;
      result.daily_schedules.forEach((day, index) => {
        console.log(`   Day ${index + 1}: ${day.scheduled_places.length} places`);
        totalPlaces += day.scheduled_places.length;
      });
      
      console.log(`📍 Total Places Scheduled: ${totalPlaces}`);
      console.log(`⏱️ Total Travel Time: ${result.total_travel_time_minutes} minutes`);
      console.log(`🕐 Total Visit Time: ${result.total_visit_time_minutes} minutes`);
    }

    // Step 4: Verify database updates
    console.log('\n💾 Step 4: Verifying database updates...');
    
    const { data: optimizationResults, error: resultError } = await supabase
      .from('optimization_results')
      .select('*')
      .eq('trip_id', tripId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (resultError) {
      console.log(`❌ Failed to fetch optimization results: ${resultError.message}`);
    } else if (optimizationResults.length > 0) {
      const result = optimizationResults[0];
      console.log(`✅ Optimization result saved to database`);
      console.log(`🆔 Result ID: ${result.id}`);
      console.log(`📊 Places Count: ${result.places_count}`);
      console.log(`⏱️ Execution Time: ${result.execution_time_ms}ms`);
      console.log(`🔧 Algorithm Version: ${result.algorithm_version}`);
    } else {
      console.log(`❌ No optimization results found in database`);
    }

    // Step 5: Check if places were updated
    console.log('\n🔄 Step 5: Checking places update status...');
    
    const { data: updatedPlaces, error: updateError } = await supabase
      .from('places')
      .select('id, name, scheduled, visit_date, scheduled_date, scheduled_time_start, scheduled_time_end')
      .eq('trip_id', tripId);

    if (updateError) {
      console.log(`❌ Failed to fetch updated places: ${updateError.message}`);
    } else {
      const scheduledCount = updatedPlaces.filter(p => p.scheduled).length;
      const withDates = updatedPlaces.filter(p => p.visit_date || p.scheduled_date).length;
      const withTimes = updatedPlaces.filter(p => p.scheduled_time_start && p.scheduled_time_end).length;
      
      console.log(`📊 Places Status After Optimization:`);
      console.log(`   📍 Total Places: ${updatedPlaces.length}`);
      console.log(`   🟢 Scheduled: ${scheduledCount}`);
      console.log(`   🔴 Unscheduled: ${updatedPlaces.length - scheduledCount}`);
      console.log(`   📅 With Dates: ${withDates}`);
      console.log(`   ⏰ With Times: ${withTimes}`);
      
      if (scheduledCount > 0) {
        console.log(`\n✅ SUCCESS: Places were successfully scheduled!`);
      } else {
        console.log(`\n❌ WARNING: No places were marked as scheduled`);
      }
    }

    console.log('\n🎉 Optimization system test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testOptimizationExecution();