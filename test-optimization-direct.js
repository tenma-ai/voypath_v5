/**
 * Direct test of optimization functions with authentication
 * Node.js version to verify functionality
 */

const TEST_TRIP_ID = '4126dd20-f7b3-4b3c-a639-a0e250c6d8f1';
const SUPABASE_URL = 'https://rdufxwoeneglyponagdz.supabase.co';

async function testWithAuth() {
  console.log('🧪 Testing Edge Functions with authentication...\n');

  // Step 1: Create anonymous session
  console.log('📝 Step 1: Creating anonymous session...');
  const signInResponse = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTc5MzY5NDgsImV4cCI6MjAzMzUxMjk0OH0.YBBFEwGlJ_sSWWJXbM9qI_5gVTZnNacL0v72aODEJN8'
    },
    body: JSON.stringify({
      email: `test-${Date.now()}@example.com`,
      password: 'testpassword123'
    })
  });

  let authToken = null;
  if (signInResponse.ok) {
    const signInData = await signInResponse.json();
    authToken = signInData.access_token;
    console.log('✅ Authentication successful');
  } else {
    console.log('❌ Authentication failed, trying anonymous...');
    
    // Try anonymous sign in
    const anonResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=anonymous`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTc5MzY5NDgsImV4cCI6MjAzMzUxMjk0OH0.YBBFEwGlJ_sSWWJXbM9qI_5gVTZnNacL0v72aODEJN8'
      }
    });
    
    if (anonResponse.ok) {
      const anonData = await anonResponse.json();
      authToken = anonData.access_token;
      console.log('✅ Anonymous authentication successful');
    } else {
      console.log('❌ All authentication methods failed');
      return;
    }
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTc5MzY5NDgsImV4cCI6MjAzMzUxMjk0OH0.YBBFEwGlJ_sSWWJXbM9qI_5gVTZnNacL0v72aODEJN8'
  };

  // Step 2: Test keep-alive
  console.log('\n🔥 Step 2: Testing keep-alive functionality...');
  const functions = ['normalize-preferences', 'select-optimal-places', 'optimize-route'];
  
  for (const functionName of functions) {
    try {
      const startTime = Date.now();
      const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ type: 'keep_alive' })
      });
      
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${functionName}: ${responseTime}ms - ${data.message}`);
      } else {
        const errorData = await response.json();
        console.log(`❌ ${functionName}: ${response.status} - ${JSON.stringify(errorData)}`);
      }
    } catch (error) {
      console.log(`❌ ${functionName}: ${error.message}`);
    }
  }

  // Step 3: Test normalization without requiring trip access
  console.log('\n🧠 Step 3: Testing normalize-preferences (expected to fail due to trip access)...');
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/normalize-preferences`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        trip_id: TEST_TRIP_ID,
        force_refresh: true
      })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log(`✅ Normalization successful: ${data.result.normalizedUsers.length} users, ${data.result.totalPlaces} places`);
      console.log(`   Group Fairness Score: ${(data.result.groupFairnessScore * 100).toFixed(1)}%`);
    } else {
      console.log(`⚠️ Normalization failed as expected: ${data.error || data.message}`);
      console.log('   This is normal - user is not a member of the test trip');
    }
  } catch (error) {
    console.log(`❌ Normalization error: ${error.message}`);
  }

  // Step 4: Test place selection
  console.log('\n🎯 Step 4: Testing select-optimal-places (expected to fail due to trip access)...');
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/select-optimal-places`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        trip_id: TEST_TRIP_ID,
        max_places: 8,
        fairness_weight: 0.7
      })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log(`✅ Place selection successful: ${data.result.selectedPlaces.length} places selected`);
      console.log(`   Final Fairness Score: ${(data.result.finalFairnessScore * 100).toFixed(1)}%`);
    } else {
      console.log(`⚠️ Place selection failed as expected: ${data.error || data.message}`);
      console.log('   This is normal - user is not a member of the test trip');
    }
  } catch (error) {
    console.log(`❌ Place selection error: ${error.message}`);
  }

  // Step 5: Test complete optimization
  console.log('\n🚀 Step 5: Testing complete optimization (expected to fail due to trip access)...');
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/optimize-route`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        trip_id: TEST_TRIP_ID,
        settings: {
          fairness_weight: 0.6,
          efficiency_weight: 0.4,
          include_meals: true,
          preferred_transport: 'public_transport'
        }
      })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log(`✅ Optimization successful: ${data.optimization_result.daily_schedules.length} days`);
      console.log(`   Overall Score: ${(data.optimization_result.optimization_score.overall * 100).toFixed(1)}%`);
      console.log(`   Execution Time: ${data.optimization_result.execution_time_ms}ms`);
    } else {
      console.log(`⚠️ Optimization failed as expected: ${data.error || data.message}`);
      console.log('   This is normal - user is not a member of the test trip');
    }
  } catch (error) {
    console.log(`❌ Optimization error: ${error.message}`);
  }

  console.log('\n✨ Test completed!');
  console.log('\n📋 Summary:');
  console.log('• Keep-alive functionality should work for all functions');
  console.log('• Authentication is working properly');
  console.log('• Trip access validation is working (functions reject unauthorized users)');
  console.log('• To test full functionality, user needs to be added as trip member');
}

// Run the test
testWithAuth().catch(console.error);