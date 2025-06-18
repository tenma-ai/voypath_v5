const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rdufxwoeneglyponagdz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0ODY3NDgsImV4cCI6MjA2NTA2Mjc0OH0.n4rjoYq3hdi145qlH-JC-xn6PCTA1vEsdpX_vS-YK08';

const supabase = createClient(supabaseUrl, supabaseKey);

async function addTestPlaces() {
  try {
    const tripId = '76f2f51d-48f3-40d2-b795-cf533a561c2f';
    const userId = '2600c340-0ecd-4166-860f-ac4798888344';

    // Delete existing non-Yokohama places
    console.log('Cleaning up existing places...');
    const { error: deleteError } = await supabase
      .from('places')
      .delete()
      .eq('trip_id', tripId)
      .neq('place_type', 'departure')
      .neq('place_type', 'destination');

    if (deleteError) {
      console.error('Delete error:', deleteError);
    }

    // Add Yokohama test places
    const testPlaces = [
      {
        id: crypto.randomUUID(),
        trip_id: tripId,
        user_id: userId,
        name: 'Yokohama Red Brick Warehouse',
        category: 'shopping',
        latitude: 35.4529,
        longitude: 139.6428,
        description: 'Historic shopping complex',
        wish_level: 4,
        stay_duration_minutes: 120,
        place_type: 'member_wish',
        source: 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        trip_id: tripId,
        user_id: userId,
        name: 'Sankeien Garden',
        category: 'nature',
        latitude: 35.4173,
        longitude: 139.6607,
        description: 'Traditional Japanese garden',
        wish_level: 5,
        stay_duration_minutes: 150,
        place_type: 'member_wish',
        source: 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        trip_id: tripId,
        user_id: userId,
        name: 'Yokohama Chinatown',
        category: 'food',
        latitude: 35.4436,
        longitude: 139.6463,
        description: 'Largest Chinatown in Japan',
        wish_level: 3,
        stay_duration_minutes: 90,
        place_type: 'member_wish',
        source: 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        trip_id: tripId,
        user_id: userId,
        name: 'Minato Mirai 21',
        category: 'entertainment',
        latitude: 35.4563,
        longitude: 139.6375,
        description: 'Modern waterfront district',
        wish_level: 4,
        stay_duration_minutes: 180,
        place_type: 'member_wish',
        source: 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        trip_id: tripId,
        user_id: userId,
        name: 'Yokohama Museum of Art',
        category: 'culture',
        latitude: 35.4571,
        longitude: 139.6313,
        description: 'Contemporary art museum',
        wish_level: 3,
        stay_duration_minutes: 120,
        place_type: 'member_wish',
        source: 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    console.log('Adding test places...');
    const { data, error } = await supabase
      .from('places')
      .insert(testPlaces)
      .select();

    if (error) {
      console.error('Insert error:', error);
      return;
    }

    console.log(`Successfully added ${data.length} places`);
    data.forEach(place => {
      console.log(`- ${place.name} (${place.category})`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

addTestPlaces();