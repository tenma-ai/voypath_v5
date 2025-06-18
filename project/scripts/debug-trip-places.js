import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function debugTripPlaces() {
  const tripId = '8d448f25-68e1-4473-8051-031f364dd033';
  
  console.log(`Debugging places for trip: ${tripId}`);
  
  const { data, error } = await supabase
    .from('places')
    .select('*')
    .eq('trip_id', tripId);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Current data status:');
  data.forEach(place => {
    console.log(`- ${place.name} (${place.place_type}): is_selected_for_optimization = ${place.is_selected_for_optimization}`);
  });
  
  // Update any member_wish places that are not selected
  const toUpdate = data.filter(p => p.place_type === 'member_wish' && !p.is_selected_for_optimization);
  if (toUpdate.length > 0) {
    console.log(`Updating ${toUpdate.length} places...`);
    for (const place of toUpdate) {
      const { error: updateError } = await supabase
        .from('places')
        .update({ is_selected_for_optimization: true })
        .eq('id', place.id);
      
      if (updateError) {
        console.error(`Failed to update ${place.name}:`, updateError);
      } else {
        console.log(`✅ Updated ${place.name}`);
      }
    }
  } else {
    console.log('✅ All member_wish places are already selected for optimization');
  }
}

debugTripPlaces();