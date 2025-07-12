import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function formatTime(minutes: number): string {
  if (typeof minutes !== 'number' || minutes < 0) {
    return '08:00:00';
  }
  
  const maxMinutesPerDay = 23 * 60 + 59;
  const cappedMinutes = Math.min(minutes, maxMinutesPerDay);
  const hours = Math.floor(cappedMinutes / 60);
  const mins = cappedMinutes % 60;
  
  const validHours = Math.max(0, Math.min(23, hours));
  const adjustedHours = Math.max(8, validHours);
  
  return `${adjustedHours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:00`;
}

// Optimized duration change handler for maximum UX responsiveness
async function handleDurationChangeOptimized(data: any, supabase: any): Promise<any> {
  const { placeId, newDuration, oldDuration, dayData } = data;
  
  if (!placeId || !newDuration || newDuration <= 0 || !dayData) {
    throw new Error('Invalid duration change data');
  }
  
  console.log(`⚡ Fast duration change: ${placeId} from ${oldDuration}min to ${newDuration}min`);
  
  const durationDelta = newDuration - oldDuration;
  const places = [...dayData.scheduled_places];
  
  // Quick validation and adjustment strategy
  let targetPlaceIndex = -1;
  let requiresManualAdjustment = false;
  let adjustmentMessage = '';
  
  // Find target place and apply immediate change
  for (let i = 0; i < places.length; i++) {
    const place = places[i];
    
    if ((place.id || place.place_name) === placeId) {
      targetPlaceIndex = i;
      
      // Update duration immediately
      place.stay_duration_minutes = newDuration;
      
      // Update departure time
      if (place.arrival_time) {
        const [hours, minutes] = place.arrival_time.split(':').map(Number);
        const arrivalMinutes = hours * 60 + minutes;
        const newDepartureMinutes = arrivalMinutes + newDuration;
        place.departure_time = formatTime(newDepartureMinutes);
        
        // Check if this change affects day boundary
        const maxDayTime = 20 * 60; // 20:00
        if (newDepartureMinutes > maxDayTime) {
          if (durationDelta > 0) {
            // Extension case: try to adjust hotel time to accommodate
            const hotelPlace = places.find(p => 
              p.category === 'lodging' || 
              p.place_type === 'hotel' || 
              (p.name && p.name.toLowerCase().includes('hotel'))
            );
            
            if (hotelPlace && hotelPlace.stay_duration_minutes > 480) { // Hotel > 8 hours
              const reduction = Math.min(hotelPlace.stay_duration_minutes - 480, durationDelta);
              hotelPlace.stay_duration_minutes -= reduction;
              console.log(`🏨 Reduced hotel time by ${reduction}min to accommodate extension`);
              
              // Recalculate if hotel adjustment is sufficient
              if (reduction >= durationDelta) {
                // Hotel adjustment successful, no manual intervention needed
                break;
              } else {
                requiresManualAdjustment = true;
                adjustmentMessage = `Duration extension requires ${durationDelta - reduction} more minutes. Please use drag-and-drop to move some places to another day.`;
              }
            } else {
              requiresManualAdjustment = true;
              adjustmentMessage = 'Duration extension causes schedule to exceed day limit. Please use drag-and-drop to move some places to another day.';
            }
          } else {
            // Shortening case that still exceeds day - should not happen but handle gracefully
            requiresManualAdjustment = true;
            adjustmentMessage = 'Schedule adjustment needed. Please review the day\'s timeline.';
          }
        }
      }
      break;
    }
  }
  
  if (targetPlaceIndex === -1) {
    throw new Error('Place not found in schedule');
  }
  
  // Apply parallel shift to subsequent places (only if within day limits)
  if (!requiresManualAdjustment && durationDelta !== 0) {
    for (let i = targetPlaceIndex + 1; i < places.length; i++) {
      const place = places[i];
      
      if (place.arrival_time && place.departure_time) {
        const [arrHours, arrMinutes] = place.arrival_time.split(':').map(Number);
        const [depHours, depMinutes] = place.departure_time.split(':').map(Number);
        
        const newArrivalMinutes = arrHours * 60 + arrMinutes + durationDelta;
        const newDepartureMinutes = depHours * 60 + depMinutes + durationDelta;
        
        // Check day boundary for subsequent places
        const maxDayTime = 20 * 60; // 20:00
        if (newDepartureMinutes > maxDayTime) {
          requiresManualAdjustment = true;
          adjustmentMessage = `Duration change causes subsequent places to exceed day limit. Please use drag-and-drop to reorganize the schedule.`;
          break;
        }
        
        place.arrival_time = formatTime(newArrivalMinutes);
        place.departure_time = formatTime(newDepartureMinutes);
      }
    }
  }
  
  // Create updated day schedule
  const updatedDaySchedule = {
    day: dayData.day,
    date: dayData.date,
    scheduled_places: places,
    total_travel_time: places.reduce((sum, p) => sum + (p.travel_time_from_previous || 0), 0),
    total_visit_time: places.reduce((sum, p) => sum + p.stay_duration_minutes, 0),
    meal_breaks: dayData.meal_breaks || [],
    requires_manual_adjustment: requiresManualAdjustment,
    adjustment_message: adjustmentMessage
  };
  
  return {
    updated_day_schedule: updatedDaySchedule,
    requires_manual_adjustment: requiresManualAdjustment,
    adjustment_message: adjustmentMessage,
    message: `Duration updated to ${newDuration} minutes${requiresManualAdjustment ? ' (manual adjustment required)' : ' (auto-adjusted)'}`
  };
}

// Main handler optimized for speed
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  // DISABLED: Edge function temporarily disabled to fix authentication issues
  console.log('🚫 Duration change edge function DISABLED - was interfering with user authentication');
  
  return new Response(JSON.stringify({
    success: false,
    error: 'Duration change functionality temporarily disabled to fix authentication issues',
    message: 'This edge function was interfering with user authentication sessions'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 503 // Service Unavailable
  });
  
  /* ORIGINAL CODE DISABLED
  const startTime = Date.now();
  
  try {
    console.log('⚡ Fast duration change request received');
    
    const requestData = await req.json();
    const { trip_id, place_id, new_duration, old_duration, day_data, user_id } = requestData;
    
    // Validate required parameters
    if (!trip_id || !place_id || !new_duration || !day_data) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required parameters: trip_id, place_id, new_duration, and day_data are required'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }
    
    console.log(`⚡ Processing fast duration change for place ${place_id}: ${old_duration}min → ${new_duration}min`);
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Process duration change with optimized logic
    const result = await handleDurationChangeOptimized({
      placeId: place_id,
      newDuration: new_duration,
      oldDuration: old_duration,
      dayData: day_data
    }, supabase);
    
    const executionTime = Date.now() - startTime;
    
    // Background database update (non-blocking for UX) - temporarily disabled
    // TODO: Create schedule_changes table if change tracking is needed
    if (result.updated_day_schedule && !result.requires_manual_adjustment) {
      console.log('✅ Duration change processed successfully (tracking disabled)');
    }
    
    console.log(`⚡ Fast duration change completed in ${executionTime}ms`);
    
    return new Response(JSON.stringify({
      success: true,
      ...result,
      execution_time_ms: executionTime,
      performance_optimized: true
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('❌ Fast duration change error:', error.message);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      execution_time_ms: executionTime
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
  */
});