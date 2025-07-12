import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Distance calculation (Haversine formula)
function calculateDistance(point1: number[], point2: number[]): number {
  const R = 6371; // Earth's radius in km
  const [lat1, lon1] = point1;
  const [lat2, lon2] = point2;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Transport mode determination
function determineTransportMode(distance: number, fromAirport = false, toAirport = false): string {
  if (distance <= 2) {
    return 'walking';
  }
  if (distance <= 500) {
    return 'car';
  }
  return 'flight';
}

// Travel time calculation
function calculateTravelTime(distance: number, mode: string): number {
  if (mode === 'flight') {
    const flightHours = distance / 700; // 700km/h
    const flightMinutes = Math.round(flightHours * 60);
    
    let airportTime = 60; // Basic 1 hour
    if (distance > 3000) {
      airportTime = 90; // International long distance 1.5 hours
    }
    
    const totalTime = flightMinutes + airportTime;
    console.log(`✈️ Flight time calculation: ${distance.toFixed(1)}km ÷ 700km/h = ${flightHours.toFixed(1)}h (${flightMinutes}min) + airport (${airportTime}min) = ${totalTime}min total`);
    
    return totalTime;
  }
  
  const speeds: Record<string, number> = {
    walking: 5,
    car: 60, // Realistic speed (considering traffic)
    flight: 700 // Handled above
  };
  
  const baseTime = distance / speeds[mode] * 60; // in minutes
  const overhead: Record<string, number> = {
    walking: 5,
    car: 10,
    flight: 0
  };
  
  return Math.round(baseTime + overhead[mode]);
}

// Calculate route details
function calculateRouteDetails(places: any[]): any[] {
  const route = [...places];
  
  for (let i = 1; i < route.length; i++) {
    const prev = route[i - 1];
    const curr = route[i];
    const distance = calculateDistance([prev.latitude, prev.longitude], [curr.latitude, curr.longitude]);
    const transportMode = determineTransportMode(distance, prev.is_airport, curr.is_airport);
    const travelTime = calculateTravelTime(distance, transportMode);
    
    curr.transport_mode = transportMode;
    curr.travel_time_from_previous = travelTime;
  }
  
  return route;
}

// Create daily schedule with place reordering capabilities
function createDailySchedule(places: any[], tripStartDate: string | null = null, availableDays: number | null = null): any[] {
  const maxDailyHours = 10; // Maximum 10 hours per day
  const maxDailyMinutes = maxDailyHours * 60;
  const schedules: any[] = [];
  let currentDay = 1;
  let currentPlaces: any[] = [];
  let currentTime = 0;
  let timeCounter = 8 * 60; // Start at 8:00 AM
  
  console.log(`📅 Scheduling ${places.length} places with ${availableDays} days limit`);
  console.log(`🗺️ Route order: ${places.map(p => p.name).join(' → ')}`);
  
  for (let i = 0; i < places.length; i++) {
    const place = places[i];
    const placeTime = place.stay_duration_minutes + (place.travel_time_from_previous || 0);
    
    // Final destination check
    const isFinalDestination = place.category === 'final_destination';
    
    // System place check (always protected)
    const isSystemPlace = (
      place.source === 'system' || 
      place.category === 'departure_point' || 
      place.category === 'final_destination' ||
      place.place_type === 'system_airport' ||
      (place.id && place.id.toString().startsWith('airport_')) ||
      (place.id && place.id.toString().startsWith('return_'))
    );
    
    // Flight handling
    if (place.transport_mode === 'flight' && currentPlaces.length > 0) {
      const flightStartTime = timeCounter + (place.travel_time_from_previous || 0);
      const flightEndTime = flightStartTime + place.stay_duration_minutes;
      
      place.arrival_time = formatTime(flightStartTime);
      place.departure_time = formatTime(flightEndTime);
      place.order_in_day = currentPlaces.length + 1;
      currentPlaces.push(place);
      
      timeCounter = flightEndTime;
      currentTime += place.stay_duration_minutes + (place.travel_time_from_previous || 0);
      
      const maxDayEndTime = 20 * 60; // 20:00
      if (timeCounter >= maxDayEndTime) {
        schedules.push(createDaySchedule(currentDay, currentPlaces, tripStartDate));
        currentDay++;
        currentPlaces = [];
        currentTime = 0;
        timeCounter = 8 * 60; // Next day starts at 8:00 AM
      }
      continue;
    } else if (currentTime + placeTime > maxDailyMinutes && currentPlaces.length > 0) {
      // Handle final destination timing
      if (isFinalDestination && currentPlaces.length > 0) {
        const lastPlace = currentPlaces[currentPlaces.length - 1];
        if (lastPlace && lastPlace.departure_time) {
          const [hours, minutes] = lastPlace.departure_time.split(':').map(Number);
          const lastPlaceEndTime = hours * 60 + minutes;
          const finalDestinationArrival = lastPlaceEndTime + (place.travel_time_from_previous || 0);
          
          if (finalDestinationArrival <= 20 * 60) {
            console.log(`🎯 Final destination fits on same day: arrival at ${formatTime(finalDestinationArrival)}`);
            timeCounter = finalDestinationArrival;
          } else {
            schedules.push(createDaySchedule(currentDay, currentPlaces, tripStartDate));
            currentDay++;
            currentPlaces = [];
            currentTime = 0;
            timeCounter = 8 * 60;
          }
        }
      } else {
        schedules.push(createDaySchedule(currentDay, currentPlaces, tripStartDate));
        currentDay++;
        currentPlaces = [];
        currentTime = 0;
        timeCounter = 8 * 60;
      }
    }
    
    // Time setting
    if (place.travel_time_from_previous && !isFinalDestination) {
      timeCounter += place.travel_time_from_previous;
    }
    
    const maxDayEndTime = 20 * 60; // 20:00
    const arrival = Math.min(timeCounter, maxDayEndTime);
    place.arrival_time = formatTime(arrival);
    
    const stayDuration = Math.min(place.stay_duration_minutes, maxDayEndTime - arrival);
    timeCounter = arrival + stayDuration;
    place.departure_time = formatTime(timeCounter);
    place.order_in_day = currentPlaces.length + 1;
    place.day_number = currentDay;
    
    currentPlaces.push(place);
    currentTime += placeTime;
    
    console.log(`📍 Scheduled: ${place.name} on day ${currentDay} at ${place.arrival_time}-${place.departure_time}`);
  }
  
  // Add final day if has places
  if (currentPlaces.length > 0) {
    if (availableDays === null || currentDay <= availableDays) {
      schedules.push(createDaySchedule(currentDay, currentPlaces, tripStartDate));
      console.log(`✅ Added final day ${currentDay} with ${currentPlaces.length} places`);
    }
  }
  
  console.log(`✅ Created ${schedules.length} daily schedules`);
  
  return schedules;
}

function createDaySchedule(day: number, places: any[], tripStartDate: string | null = null): any {
  let date: Date;
  if (tripStartDate) {
    date = new Date(tripStartDate);
    date.setDate(date.getDate() + day - 1);
  } else {
    date = new Date();
    date.setDate(date.getDate() + day - 1);
  }
  
  return {
    day,
    date: date.toISOString().split('T')[0],
    scheduled_places: places,
    total_travel_time: places.reduce((sum, p) => sum + (p.travel_time_from_previous || 0), 0),
    total_visit_time: places.reduce((sum, p) => sum + p.stay_duration_minutes, 0),
    meal_breaks: []
  };
}

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

// Edit schedule handlers
async function handleReorderPlaces(data: any, supabase: any): Promise<any> {
  console.log('🔄 Handling place reorder:', data);
  
  const { dayData, sourceIndex, targetIndex } = data;
  
  if (!dayData || !dayData.scheduled_places) {
    throw new Error('Invalid day data for reordering');
  }
  
  // Clone the places array and reorder
  const places = [...dayData.scheduled_places];
  const [movedPlace] = places.splice(sourceIndex, 1);
  places.splice(targetIndex, 0, movedPlace);
  
  // Recalculate route details with new order
  const routeWithDetails = calculateRouteDetails(places);
  
  // Create updated schedule for just this day (preserve day number)
  const updatedDaySchedule = {
    day: dayData.day,
    date: dayData.date,
    scheduled_places: routeWithDetails.map((place, index) => ({
      ...place,
      order_in_day: index + 1,
      day_number: dayData.day
    })),
    total_travel_time: routeWithDetails.reduce((sum, p) => sum + (p.travel_time_from_previous || 0), 0),
    total_visit_time: routeWithDetails.reduce((sum, p) => sum + p.stay_duration_minutes, 0),
    meal_breaks: []
  };
  
  return {
    updated_schedule: {
      optimization: {
        daily_schedules: [updatedDaySchedule]
      }
    },
    message: `Place reordered from position ${sourceIndex + 1} to ${targetIndex + 1}`
  };
}

async function handleResizeDuration(data: any, supabase: any, tripId: string): Promise<any> {
  console.log('⏱️ Handling duration resize:', data);
  
  const { placeId, newDuration, oldDuration } = data;
  
  if (!placeId || !newDuration || newDuration <= 0) {
    throw new Error('Invalid duration resize data');
  }
  
  // Load current optimization result for the specific trip
  const { data: currentResult, error } = await supabase
    .from('optimization_results')
    .select('*')
    .eq('trip_id', tripId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
    
  if (error || !currentResult) {
    throw new Error('No active optimization result found');
  }
  
  // Update the specific place duration
  const updatedSchedules = currentResult.optimized_route.map((schedule: any) => {
    return {
      ...schedule,
      scheduled_places: schedule.scheduled_places.map((place: any) => {
        if ((place.id || place.place_name) === placeId) {
          const updatedPlace = {
            ...place,
            stay_duration_minutes: newDuration
          };
          
          // Recalculate departure time
          if (place.arrival_time) {
            const [hours, minutes] = place.arrival_time.split(':').map(Number);
            const arrivalMinutes = hours * 60 + minutes;
            const departureMinutes = arrivalMinutes + newDuration;
            updatedPlace.departure_time = formatTime(departureMinutes);
          }
          
          return updatedPlace;
        }
        return place;
      })
    };
  });
  
  // For UX responsiveness: Apply minimal time adjustments to subsequent places
  // This keeps changes within the same day when possible
  const processedSchedules = updatedSchedules.map((schedule: any) => {
    const places = schedule.scheduled_places;
    let timeAdjustment = 0;
    
    for (let i = 0; i < places.length; i++) {
      const place = places[i];
      
      // If this is the resized place, calculate time adjustment
      if ((place.id || place.place_name) === placeId) {
        timeAdjustment = newDuration - oldDuration;
        continue;
      }
      
      // Apply time adjustment to subsequent places
      if (timeAdjustment !== 0 && place.arrival_time && place.departure_time) {
        const [arrHours, arrMinutes] = place.arrival_time.split(':').map(Number);
        const [depHours, depMinutes] = place.departure_time.split(':').map(Number);
        
        const newArrivalMinutes = arrHours * 60 + arrMinutes + timeAdjustment;
        const newDepartureMinutes = depHours * 60 + depMinutes + timeAdjustment;
        
        // Check if times exceed day limits (20:00)
        const maxDayTime = 20 * 60;
        if (newDepartureMinutes > maxDayTime) {
          // Time exceeds day limit - user needs manual adjustment
          return {
            ...schedule,
            requires_manual_adjustment: true,
            adjustment_message: `Duration change causes schedule to exceed day limit. Please manually adjust or move some places to another day.`
          };
        }
        
        place.arrival_time = formatTime(newArrivalMinutes);
        place.departure_time = formatTime(newDepartureMinutes);
      }
    }
    
    return schedule;
  });
  
  return {
    updated_schedule: {
      optimization: {
        daily_schedules: processedSchedules
      }
    },
    message: `Duration updated to ${newDuration} minutes`,
    requires_manual_adjustment: processedSchedules.some((s: any) => s.requires_manual_adjustment)
  };
}

async function handleInsertPlace(data: any, supabase: any, tripId: string): Promise<any> {
  console.log('➕ Handling place insertion:', data);
  
  const { placeData, insertionContext } = data;
  
  if (!placeData || !insertionContext) {
    throw new Error('Invalid place insertion data');
  }
  
  // Load current optimization result for the specific trip
  const { data: currentResult, error } = await supabase
    .from('optimization_results')
    .select('*')
    .eq('trip_id', tripId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
    
  if (error || !currentResult) {
    throw new Error('No active optimization result found');
  }
  
  // Find the target day schedule
  const targetDayIndex = currentResult.optimized_route.findIndex((schedule: any) => 
    schedule.day === insertionContext.dayData.day
  );
  
  if (targetDayIndex === -1) {
    throw new Error('Target day not found');
  }
  
  const targetSchedule = currentResult.optimized_route[targetDayIndex];
  const places = [...targetSchedule.scheduled_places];
  
  // Insert the new place at the specified position
  const insertIndex = insertionContext.beforePlaceIndex;
  places.splice(insertIndex, 0, placeData);
  
  // Recalculate route details
  const routeWithDetails = calculateRouteDetails(places);
  
  // Create updated schedule for this day
  const updatedDaySchedule = createDailySchedule(routeWithDetails, targetSchedule.date);
  
  // Update the full schedule array
  const updatedSchedules = [...currentResult.optimized_route];
  updatedSchedules[targetDayIndex] = updatedDaySchedule[0];
  
  return {
    updated_schedule: {
      optimization: {
        daily_schedules: updatedSchedules
      }
    },
    message: `Place "${placeData.name}" inserted successfully`
  };
}

async function handleDeletePlace(data: any, supabase: any, tripId: string): Promise<any> {
  console.log('🗑️ Handling place deletion:', data);
  
  const { placeId, dayData, blockIndex } = data;
  
  if (!placeId || !dayData) {
    throw new Error('Invalid place deletion data');
  }
  
  // Load current optimization result for the specific trip
  const { data: currentResult, error } = await supabase
    .from('optimization_results')
    .select('*')
    .eq('trip_id', tripId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
    
  if (error || !currentResult) {
    throw new Error('No active optimization result found');
  }
  
  // Update the schedule by removing the place
  const updatedSchedules = currentResult.optimized_route.map((schedule: any) => {
    if (schedule.day === dayData.day) {
      const filteredPlaces = schedule.scheduled_places.filter((place: any) => 
        (place.id || place.place_name) !== placeId
      );
      
      // Recalculate route details
      const routeWithDetails = calculateRouteDetails(filteredPlaces);
      
      // Create updated schedule
      const updatedDaySchedule = createDailySchedule(routeWithDetails, schedule.date);
      
      return updatedDaySchedule[0];
    }
    return schedule;
  });
  
  return {
    updated_schedule: {
      optimization: {
        daily_schedules: updatedSchedules
      }
    },
    message: `Place deleted successfully`
  };
}

// @ts-ignore: Deno is available in Edge Functions
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  // DISABLED: Edge function temporarily disabled to fix authentication issues
  console.log('🚫 Edit schedule edge function DISABLED - was interfering with user authentication');
  
  return new Response(JSON.stringify({
    success: false,
    error: 'Edit functionality temporarily disabled to fix authentication issues',
    message: 'This edge function was interfering with user authentication sessions'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 503 // Service Unavailable
  });
  
  /* ORIGINAL CODE DISABLED
  const startTime = Date.now();
  
  try {
    console.log('🛠️ Edit schedule request received');
    
    const requestData = await req.json();
    const { trip_id, action, data, update_id, user_id } = requestData;
    
    // Validate required parameters
    if (!trip_id || !action || !data) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required parameters: trip_id, action, and data are required'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }
    
    console.log(`📋 Processing ${action} for trip ${trip_id}`);
    
    // Initialize Supabase client
    // @ts-ignore: Deno.env is available in Edge Functions
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    // @ts-ignore: Deno.env is available in Edge Functions
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    let result;
    
    // Handle different edit actions
    switch (action) {
      case 'reorder':
        result = await handleReorderPlaces(data, supabase);
        break;
      case 'resize':
        result = await handleResizeDuration(data, supabase, trip_id);
        break;
      case 'insert':
        result = await handleInsertPlace(data, supabase, trip_id);
        break;
      case 'delete':
        result = await handleDeletePlace(data, supabase, trip_id);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    const executionTime = Date.now() - startTime;
    
    // Save updated optimization result to database
    if (result.updated_schedule) {
      try {
        // Mark previous results as inactive
        await supabase
          .from('optimization_results')
          .update({ is_active: false })
          .eq('trip_id', trip_id);
        
        // Insert new result
        const { error: saveError } = await supabase
          .from('optimization_results')
          .insert({
            trip_id,
            created_by: user_id,
            optimized_route: result.updated_schedule.optimization.daily_schedules,
            optimization_score: {
              total_score: 85, // Placeholder score for edited schedules
              fairness_score: 85,
              efficiency_score: 85,
              details: {
                user_adoption_balance: 0.85,
                wish_satisfaction_balance: 0.85,
                travel_efficiency: 0.85,
                time_constraint_compliance: 0.85
              }
            },
            execution_time_ms: executionTime,
            places_count: result.updated_schedule.optimization.daily_schedules.reduce(
              (total: number, day: any) => total + day.scheduled_places.length, 0
            ),
            is_active: true,
            algorithm_version: 'edit-schedule-v1',
            edit_action: action,
            update_id
          });
        
        if (saveError) {
          console.warn('⚠️ Error saving edited schedule:', saveError.message);
        } else {
          console.log('✅ Edited schedule saved successfully');
        }
      } catch (saveError) {
        console.warn('⚠️ Could not save edited schedule:', saveError.message);
        // Continue without database save
      }
    }
    
    console.log(`🎉 Edit ${action} completed successfully (${executionTime}ms)`);
    
    return new Response(JSON.stringify({
      success: true,
      ...result,
      execution_time_ms: executionTime
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('❌ Edit schedule error:', error.message);
    console.error('❌ Stack trace:', error.stack);
    
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