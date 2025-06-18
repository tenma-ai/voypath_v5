const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rdufxwoeneglyponagdz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0ODY3NDgsImV4cCI6MjA2NTA2Mjc0OH0.n4rjoYq3hdi145qlH-JC-xn6PCTA1vEsdpX_vS-YK08';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testOptimizeRoute() {
  try {
    // First, let's check what places exist for this trip
    console.log('Checking places for trip...');
    const { data: places, error: placesError } = await supabase
      .from('places')
      .select('id, name, category, latitude, longitude, wish_level, stay_duration_minutes')
      .eq('trip_id', '76f2f51d-48f3-40d2-b795-cf533a561c2f')
      .neq('place_type', 'departure')
      .neq('place_type', 'destination');

    if (placesError) {
      console.error('Error fetching places:', placesError);
      return;
    }

    console.log(`Found ${places?.length || 0} places for optimization`);
    if (places && places.length > 0) {
      console.log('Places:', JSON.stringify(places.slice(0, 5), null, 2));
    }

    // Sign in as dev user to get a session
    console.log('\nSigning in as dev user...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'test@voypath.com',
      password: 'testpassword123'
    });

    if (authError) {
      console.error('Auth error:', authError);
      // Try to create the user
      console.log('Creating dev user...');
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: 'test@voypath.com',
        password: 'testpassword123',
        options: {
          data: { name: 'Test User' }
        }
      });
      
      if (signUpError) {
        console.error('Sign up error:', signUpError);
        return;
      }
      console.log('User created, please run the test again');
      return;
    }

    console.log('Authenticated successfully');
    const session = authData.session;

    // Now test the optimize-route function
    console.log('\nCalling optimize-route function...');
    const startTime = Date.now();
    
    const response = await fetch(`${supabaseUrl}/functions/v1/optimize-route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': supabaseKey
      },
      body: JSON.stringify({
        trip_id: '76f2f51d-48f3-40d2-b795-cf533a561c2f',
        settings: {
          preferred_transport: 'car',
          include_meals: true,
          fairness_weight: 0.6,
          efficiency_weight: 0.4
        }
      })
    });

    const duration = (Date.now() - startTime) / 1000;
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`Optimization failed (${response.status}):`, error);
      return;
    }

    const result = await response.json();
    console.log(`\nOptimization completed in ${duration}s`);
    console.log('Result summary:');
    console.log('- Success:', result.success);
    console.log('- Cached:', result.cached);
    console.log('- Execution time:', result.execution_time_ms, 'ms');
    
    if (result.optimization_result) {
      console.log('\nOptimization details:');
      console.log('- Total days:', result.optimization_result.total_days);
      console.log('- Places count:', result.optimization_result.optimized_places?.length);
      console.log('- Total travel time:', result.optimization_result.total_travel_time, 'minutes');
      console.log('- Optimization score:', result.optimization_result.optimization_score?.overall);
      
      if (result.optimization_result.optimized_places?.length > 0) {
        console.log('\nFirst optimized place:', JSON.stringify(result.optimization_result.optimized_places[0], null, 2));
      }
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testOptimizeRoute();