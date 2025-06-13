/**
 * Test script for new Edge Functions
 * Tests normalize-preferences and select-optimal-places functions
 */

const SUPABASE_URL = 'https://rdufxwoeneglyponagdz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTc5MzY5NDgsImV4cCI6MjAzMzUxMjk0OH0.YBBFEwGlJ_sSWWJXbM9qI_5gVTZnNacL0v72aODEJN8';

async function testKeepAlive() {
  console.log('🔥 Testing keep-alive functionality...');
  
  const tests = [
    { name: 'normalize-preferences', function: 'normalize-preferences' },
    { name: 'select-optimal-places', function: 'select-optimal-places' },
    { name: 'optimize-route', function: 'optimize-route' }
  ];

  for (const test of tests) {
    try {
      const startTime = Date.now();
      const response = await fetch(`${SUPABASE_URL}/functions/v1/${test.function}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          type: 'keep_alive'
        })
      });

      const responseTime = Date.now() - startTime;
      const data = await response.json();

      if (response.ok && data.message === 'pong') {
        console.log(`✅ ${test.name}: ${responseTime}ms - ${data.message} (${data.timestamp})`);
      } else {
        console.log(`❌ ${test.name}: ${response.status} - ${JSON.stringify(data)}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: Error - ${error.message}`);
    }
  }
}

async function testNormalizePreferences() {
  console.log('\n🧠 Testing normalize-preferences function...');
  
  // Test with a non-existent trip (should fail gracefully)
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/normalize-preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        trip_id: 'test-trip-id-12345',
        force_refresh: true
      })
    });

    const data = await response.json();
    
    if (response.status === 401) {
      console.log('✅ normalize-preferences: Correctly requires authentication');
    } else {
      console.log(`⚠️ normalize-preferences: Unexpected response - ${response.status}:`, data);
    }
  } catch (error) {
    console.log(`❌ normalize-preferences: Error - ${error.message}`);
  }
}

async function testSelectOptimalPlaces() {
  console.log('\n🎯 Testing select-optimal-places function...');
  
  // Test with a non-existent trip (should fail gracefully)
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/select-optimal-places`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        trip_id: 'test-trip-id-12345',
        max_places: 10,
        fairness_weight: 0.6
      })
    });

    const data = await response.json();
    
    if (response.status === 401) {
      console.log('✅ select-optimal-places: Correctly requires authentication');
    } else {
      console.log(`⚠️ select-optimal-places: Unexpected response - ${response.status}:`, data);
    }
  } catch (error) {
    console.log(`❌ select-optimal-places: Error - ${error.message}`);
  }
}

async function testOptimizationFlow() {
  console.log('\n🚀 Testing complete optimization flow...');
  
  // Test optimize-route function
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/optimize-route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        trip_id: 'test-trip-id-12345',
        settings: {
          fairness_weight: 0.6,
          efficiency_weight: 0.4,
          include_meals: true,
          preferred_transport: 'public_transport'
        }
      })
    });

    const data = await response.json();
    
    if (response.status === 401) {
      console.log('✅ optimize-route: Correctly requires authentication');
    } else {
      console.log(`⚠️ optimize-route: Unexpected response - ${response.status}:`, data);
    }
  } catch (error) {
    console.log(`❌ optimize-route: Error - ${error.message}`);
  }
}

async function testErrorHandling() {
  console.log('\n🛡️ Testing error handling...');
  
  const errorTests = [
    {
      name: 'Missing trip_id',
      function: 'normalize-preferences',
      body: { force_refresh: true }
    },
    {
      name: 'Invalid JSON',
      function: 'select-optimal-places',
      body: 'invalid-json'
    },
    {
      name: 'Wrong HTTP method',
      function: 'optimize-route',
      method: 'GET'
    }
  ];

  for (const test of errorTests) {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/${test.function}`, {
        method: test.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: typeof test.body === 'string' ? test.body : JSON.stringify(test.body)
      });

      const data = await response.json();
      
      if (response.status >= 400) {
        console.log(`✅ ${test.name}: Correctly handled error (${response.status})`);
      } else {
        console.log(`⚠️ ${test.name}: Expected error but got ${response.status}:`, data);
      }
    } catch (error) {
      console.log(`✅ ${test.name}: Correctly threw error - ${error.message}`);
    }
  }
}

async function runAllTests() {
  console.log('🧪 Starting Edge Functions Test Suite\n');
  
  await testKeepAlive();
  await testNormalizePreferences();
  await testSelectOptimalPlaces();
  await testOptimizationFlow();
  await testErrorHandling();
  
  console.log('\n✨ Test suite completed!');
}

// Run the tests
runAllTests().catch(console.error);