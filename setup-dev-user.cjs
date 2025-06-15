const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rdufxwoeneglyponagdz.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0ODY3NDgsImV4cCI6MjA2NTA2Mjc0OH0.n4rjoYq3hdi145qlH-JC-xn6PCTA1vEsdpX_vS-YK08';

const supabase = createClient(supabaseUrl, anonKey);

async function createConfirmedUser() {
  console.log('🔧 Creating confirmed development user...');
  
  try {
    // Create user with auto-confirm
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: 'test@example.com',
      password: 'testpassword123',
      options: {
        emailRedirectTo: undefined // No email confirmation needed
      }
    });
    
    if (signUpError && !signUpError.message.includes('already been registered')) {
      console.error('❌ Sign up failed:', signUpError.message);
      return;
    }
    
    let userId = signUpData?.user?.id;
    
    if (signUpError?.message.includes('already been registered')) {
      console.log('User already exists, trying to sign in...');
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'testpassword123'
      });
      
      if (signInError) {
        console.error('❌ Sign in failed:', signInError.message);
        return;
      }
      
      userId = signInData.user?.id;
    }
    
    console.log('✅ User ready:', userId);
    
    // Create user profile
    const { error: profileError } = await supabase
      .from('users')
      .upsert({
        id: userId,
        email: 'test@example.com',
        name: 'Development User',
        is_guest: false,
        last_active_at: new Date().toISOString()
      });
    
    if (profileError) {
      console.warn('Profile creation warning:', profileError.message);
    } else {
      console.log('✅ User profile created');
    }
    
    // Create development trip
    const tripId = 'dev-trip-' + Date.now();
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .insert({
        id: tripId,
        name: 'Real Development Trip',
        departure_location: 'Tokyo Station',
        destination: 'Kyoto Station',
        start_date: '2024-07-01',
        end_date: '2024-07-03',
        owner_id: userId,
        member_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (tripError) {
      console.error('❌ Trip creation failed:', tripError.message);
      return;
    }
    
    console.log('✅ Trip created:', trip.name);
    
    // Create places with proper stay_duration_minutes
    const places = [
      {
        name: 'Senso-ji Temple',
        category: 'cultural',
        latitude: 35.7148,
        longitude: 139.7967,
        wish_level: 5,
        stay_duration_minutes: 90
      },
      {
        name: 'Tokyo Skytree',
        category: 'landmark', 
        latitude: 35.7101,
        longitude: 139.8107,
        wish_level: 4,
        stay_duration_minutes: 120
      },
      {
        name: 'Meiji Shrine',
        category: 'cultural',
        latitude: 35.6764,
        longitude: 139.6993,
        wish_level: 4,
        stay_duration_minutes: 75
      }
    ];
    
    for (const place of places) {
      const { error: placeError } = await supabase
        .from('places')
        .insert({
          id: 'place-' + place.name.replace(/\\s+/g, '-').toLowerCase() + '-' + Date.now(),
          ...place,
          trip_id: tripId,
          user_id: userId,
          place_type: 'member_wish',
          source: 'user',
          display_color_hex: '#0077BE',
          color_type: 'single',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (placeError) {
        console.warn('Place creation warning for', place.name, ':', placeError.message);
      } else {
        console.log('✅ Place created:', place.name);
      }
    }
    
    console.log('\\n🎯 Development environment ready!');
    console.log('User ID:', userId);
    console.log('Email: test@example.com');
    console.log('Password: testpassword123');
    console.log('Trip ID:', tripId);
    console.log('Places: 3 created');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  }
}

createConfirmedUser();