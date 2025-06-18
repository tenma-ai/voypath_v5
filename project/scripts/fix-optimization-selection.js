import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixOptimizationSelection() {
  try {
    console.log('Fetching user places that are not selected for optimization...');
    
    // Get all user places that are not system places
    const { data: places, error: fetchError } = await supabase
      .from('places')
      .select('id, name, place_type, is_selected_for_optimization')
      .eq('place_type', 'member_wish')
      .eq('is_selected_for_optimization', false);

    if (fetchError) {
      console.error('Error fetching places:', fetchError);
      return;
    }

    if (!places || places.length === 0) {
      console.log('No unselected user places found.');
      return;
    }

    console.log(`Found ${places.length} user places not selected for optimization`);

    // Update all user places to be selected for optimization
    const { error: updateError } = await supabase
      .from('places')
      .update({ is_selected_for_optimization: true })
      .eq('place_type', 'member_wish');

    if (updateError) {
      console.error('Error updating places:', updateError);
      return;
    }

    console.log('✅ Successfully updated all user places to be selected for optimization');
    
    // Show updated places
    places.forEach(place => {
      console.log(`- ${place.name} (${place.place_type || 'visit'})`);
    });

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the fix
fixOptimizationSelection();