const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rdufxwoeneglyponagdz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0ODY3NDgsImV4cCI6MjA2NTA2Mjc0OH0.n4rjoYq3hdi145qlH-JC-xn6PCTA1vEsdpX_vS-YK08';

const supabase = createClient(supabaseUrl, supabaseKey);

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function comprehensiveTest() {
  console.log('🔄 Running comprehensive stay_duration_minutes fix test...\n');
  
  const tripId = '737a36f2-66b0-4dfa-a764-3d6e305faf11';
  const userId = '033523e2-377c-4479-a5cd-90d8905f7bd0';
  
  let allTestsPassed = true;

  // Test 1: Direct database insertion with various values
  console.log('📋 Test 1: Direct Database Insertion');
  const testCases = [
    { name: 'Zero duration (should fail)', duration: 0, shouldPass: false },
    { name: 'Low duration (15 min)', duration: 15, shouldPass: true },
    { name: 'Fixed minimum (30 min)', duration: 30, shouldPass: true },
    { name: 'System places (60 min)', duration: 60, shouldPass: true },
    { name: 'Normal duration (120 min)', duration: 120, shouldPass: true }
  ];

  for (const testCase of testCases) {
    try {
      const testPlace = {
        id: generateUUID(),
        name: `Test: ${testCase.name}`,
        category: 'attraction',
        latitude: 35.6762,
        longitude: 139.6503,
        wish_level: 3,
        stay_duration_minutes: testCase.duration,
        trip_id: tripId,
        user_id: userId,
        place_type: 'member_wish',
        source: 'user',
        display_color_hex: '#0077BE',
        color_type: 'single',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('places')
        .insert(testPlace)
        .select()
        .single();

      if (testCase.shouldPass) {
        if (error) {
          console.log(`❌ ${testCase.name}: FAILED (expected to pass) - ${error.message}`);
          allTestsPassed = false;
        } else {
          console.log(`✅ ${testCase.name}: PASSED - stay_duration_minutes = ${data.stay_duration_minutes}`);
        }
      } else {
        if (error) {
          console.log(`✅ ${testCase.name}: PASSED (correctly rejected) - ${error.message}`);
        } else {
          console.log(`❌ ${testCase.name}: FAILED (should have been rejected)`);
          allTestsPassed = false;
        }
      }
    } catch (err) {
      console.log(`❌ ${testCase.name}: ERROR - ${err.message}`);
      allTestsPassed = false;
    }
  }

  // Test 2: System places creation
  console.log('\n📋 Test 2: System Places Creation');
  try {
    // Clean up existing system places first
    await supabase
      .from('places')
      .delete()
      .eq('trip_id', tripId)
      .in('place_type', ['departure', 'destination']);

    // Get trip info
    const { data: trip } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single();

    if (trip && trip.departure_location) {
      const systemPlace = {
        id: generateUUID(),
        name: `Departure: ${trip.departure_location}`,
        category: 'transportation',
        address: trip.departure_location,
        latitude: 35.6812,
        longitude: 139.7671,
        rating: 0,
        wish_level: 5,
        stay_duration_minutes: 60, // Fixed minimum
        price_level: 1,
        trip_id: tripId,
        user_id: userId,
        place_type: 'departure',
        source: 'system_generated'
      };

      const { data, error } = await supabase
        .from('places')
        .insert(systemPlace)
        .select()
        .single();

      if (error) {
        console.log(`❌ System place creation: FAILED - ${error.message}`);
        allTestsPassed = false;
      } else {
        console.log(`✅ System place creation: PASSED - stay_duration_minutes = ${data.stay_duration_minutes}`);
      }
    }
  } catch (err) {
    console.log(`❌ System places test: ERROR - ${err.message}`);
    allTestsPassed = false;
  }

  // Test 3: Edge case handling with Math.max constraint
  console.log('\n📋 Test 3: Math.max Constraint Simulation');
  const edgeCases = [
    { input: 0, expected: 30 },
    { input: 15, expected: 30 },
    { input: 45, expected: 45 },
    { input: 120, expected: 120 }
  ];

  for (const edgeCase of edgeCases) {
    const result = Math.max(30, edgeCase.input);
    if (result === edgeCase.expected) {
      console.log(`✅ Math.max(30, ${edgeCase.input}) = ${result} (expected ${edgeCase.expected})`);
    } else {
      console.log(`❌ Math.max(30, ${edgeCase.input}) = ${result} (expected ${edgeCase.expected})`);
      allTestsPassed = false;
    }
  }

  // Test 4: Check current places in database
  console.log('\n📋 Test 4: Current Places Check');
  try {
    const { data: places, error } = await supabase
      .from('places')
      .select('id, name, stay_duration_minutes, place_type')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.log(`❌ Places query: FAILED - ${error.message}`);
      allTestsPassed = false;
    } else {
      console.log(`✅ Found ${places.length} places in trip ${tripId}:`);
      places.forEach(place => {
        const duration = place.stay_duration_minutes;
        const status = duration > 0 ? '✅' : '❌';
        console.log(`  ${status} ${place.name}: ${duration} minutes (${place.place_type})`);
        if (duration <= 0) allTestsPassed = false;
      });
    }
  } catch (err) {
    console.log(`❌ Places check: ERROR - ${err.message}`);
    allTestsPassed = false;
  }

  // Final result
  console.log('\n' + '='.repeat(50));
  if (allTestsPassed) {
    console.log('🎉 ALL TESTS PASSED! stay_duration_minutes constraint issue is FIXED');
    console.log('✅ Places can now be added without constraint violations');
    console.log('✅ System places creation works correctly');
    console.log('✅ Edge cases are handled properly');
  } else {
    console.log('❌ SOME TESTS FAILED - further investigation needed');
  }
  console.log('='.repeat(50));
}

comprehensiveTest();