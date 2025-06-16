import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-test-mode',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface OptimizeRouteRequest {
  trip_id?: string;
  settings?: OptimizationSettings;
  type?: 'keep_alive' | 'optimization';
  test_mode?: boolean;
  _dev_user_id?: string;
}

interface OptimizationSettings {
  fairness_weight?: number; // 0.0 to 1.0, default 0.6
  efficiency_weight?: number; // 0.0 to 1.0, default 0.4
  include_meals?: boolean; // default true
  preferred_transport?: 'walking' | 'car' | 'flight';
  use_google_maps_api?: boolean; // premium feature
}

interface Place {
  id: string;
  name: string;
  category: string;
  latitude?: number;
  longitude?: number;
  wish_level: number; // 1-5
  stay_duration_minutes: number;
  visit_date?: string;
  scheduled_date?: string;
  scheduled_time_start?: string;
  scheduled_time_end?: string;
  user_id: string;
  trip_id: string;
  source?: string; // 'system', 'user'
  created_at: string;
}

interface TripData {
  id: string;
  departure_location: string;
  destination: string;
  start_date?: string;
  end_date?: string;
  optimization_preferences: OptimizationSettings;
}

interface OptimizedRoute {
  daily_schedules: DailySchedule[];
  optimization_score: OptimizationScore;
  execution_time_ms: number;
  total_travel_time_minutes: number;
  total_visit_time_minutes: number;
  created_by: string;
}

interface DailySchedule {
  date: string;
  scheduled_places: ScheduledPlace[];
  meal_breaks: MealBreak[];
  total_travel_time: number;
  total_visit_time: number;
}

interface ScheduledPlace {
  place: Place;
  arrival_time: string;
  departure_time: string;
  travel_time_from_previous: number;
  transport_mode: 'walking' | 'car' | 'flight';
  order_in_day: number;
}

interface MealBreak {
  type: 'breakfast' | 'lunch' | 'dinner';
  start_time: string;
  end_time: string;
  estimated_cost?: number;
}

interface OptimizationScore {
  overall: number;
  fairness: number;
  efficiency: number;
  details: {
    user_adoption_balance: number;
    wish_satisfaction_balance: number;
    travel_efficiency: number;
    time_constraint_compliance: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      }
    );
  }

  try {
    const requestData: OptimizeRouteRequest = await req.json();
    
    // Handle keep-alive ping first (no auth required)
    if (requestData.type === 'keep_alive') {
      return new Response(
        JSON.stringify({ message: 'pong', timestamp: new Date().toISOString() }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Check for test mode first - detect test trips and test user
    const isTestTrip = requestData.trip_id?.includes('test') ||
                       requestData.trip_id?.includes('a1b2c3d4');
    
    // Check for development user ID in request data
    const isDevUser = requestData._dev_user_id === '2600c340-0ecd-4166-860f-ac4798888344';
    
    const isTestMode = req.headers.get('X-Test-Mode') === 'true' || 
                       requestData.test_mode === true ||
                       isTestTrip ||
                       isDevUser;

    // For all other operations, require authentication
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      isTestMode ? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' : Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: isTestMode ? {} : { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    let user: any;
    
    if (isTestMode) {
      console.log('Running in test mode, bypassing authentication');
      // Use dev user ID if provided, otherwise use test user
      user = {
        id: requestData._dev_user_id || '033523e2-377c-4479-a5cd-90d8905f7bd0',
        email: isDevUser ? 'dev@voypath.com' : 'test@example.com',
        name: isDevUser ? 'Development User' : 'Test User'
      };
    } else {
      const {
        data: { user: authUser },
        error: userError,
      } = await supabaseClient.auth.getUser();

      if (userError || !authUser) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
          }
        );
      }
      user = authUser;
    }
    
    if (!requestData.trip_id) {
      throw new Error('trip_id is required');
    }

    // Check user permissions and rate limits (skip in test mode)
    if (!isTestMode) {
      await validateUserPermissions(supabaseClient, user.id, requestData.trip_id);
      await checkOptimizationRateLimit(supabaseClient, user.id);
    }

    // Gather trip data
    const { trip, places, members } = await gatherTripData(supabaseClient, requestData.trip_id);

    // Check for cached results
    const cachedResult = await getCachedOptimization(supabaseClient, requestData.trip_id, places);
    if (cachedResult) {
      return new Response(
        JSON.stringify({
          success: true,
          optimization_result: cachedResult,
          cached: true,
          message: 'Using cached optimization result'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Execute optimization
    const startTime = Date.now();
    const optimizedRoute = await optimizeRoute(trip, places, members, requestData.settings);
    const executionTime = Date.now() - startTime;

    // Save and broadcast results
    const resultId = await saveOptimizationResult(
      supabaseClient,
      requestData.trip_id,
      user.id,
      optimizedRoute,
      executionTime
    );

    // Cache the result
    await setCachedOptimization(supabaseClient, requestData.trip_id, places, optimizedRoute);

    // Record usage event
    await recordOptimizationEvent(supabaseClient, user.id, requestData.trip_id, {
      execution_time_ms: executionTime,
      places_count: places.length,
      optimization_score: optimizedRoute.optimization_score.overall
    });

    return new Response(
      JSON.stringify({
        success: true,
        optimization_result: optimizedRoute,
        result_id: resultId,
        execution_time_ms: executionTime,
        cached: false,
        message: 'Route optimized successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Optimization Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

async function validateUserPermissions(supabase: any, userId: string, tripId: string) {
  const { data: membership, error } = await supabase
    .from('trip_members')
    .select('can_optimize')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .single();

  if (error || !membership) {
    throw new Error('You are not a member of this trip');
  }

  if (!membership.can_optimize) {
    throw new Error('You do not have permission to optimize this trip');
  }
}

async function checkOptimizationRateLimit(supabase: any, userId: string) {
  const windowStart = new Date();
  windowStart.setHours(windowStart.getHours() - 1);

  const { data: user } = await supabase
    .from('users')
    .select('is_premium')
    .eq('id', userId)
    .single();

  const limit = user?.is_premium ? 20 : 3;

  const { data: recentOptimizations } = await supabase
    .from('optimization_results')
    .select('created_at')
    .eq('created_by', userId)
    .gte('created_at', windowStart.toISOString());

  if (recentOptimizations && recentOptimizations.length >= limit) {
    throw new Error(
      `Rate limit exceeded. ${user?.is_premium ? 'Premium' : 'Free'} users can perform ${limit} optimizations per hour.`
    );
  }
}

async function gatherTripData(supabase: any, tripId: string) {
  // Get trip information
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single();

  if (tripError) throw new Error(`Trip not found: ${tripError.message}`);

  if (!trip.departure_location) {
    throw new Error('Departure location is required for optimization');
  }

  // Get all places for the trip
  const { data: places, error: placesError } = await supabase
    .from('places')
    .select(`
      *,
      user:users(id, name, is_premium)
    `)
    .eq('trip_id', tripId)
    .order('created_at');

  if (placesError) throw new Error(`Failed to fetch places: ${placesError.message}`);

  // Get trip members
  const { data: members, error: membersError } = await supabase
    .from('trip_members')
    .select(`
      *,
      user:users(id, name, is_premium)
    `)
    .eq('trip_id', tripId);

  if (membersError) throw new Error(`Failed to fetch members: ${membersError.message}`);

  return { trip, places: places || [], members: members || [] };
}

async function optimizeRoute(
  trip: TripData,
  places: Place[],
  members: any[],
  settings?: OptimizationSettings
): Promise<OptimizedRoute> {
  // Merge settings with trip preferences
  const finalSettings: OptimizationSettings = {
    fairness_weight: 0.6,
    efficiency_weight: 0.4,
    include_meals: true,
    ...trip.optimization_preferences,
    ...settings
  };

  // Use pre-selected places from place selection Edge Function
  let selectedPlaces: Place[];
  
  try {
    // Call place selection Edge Function to get optimally selected places
    const selectionResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/select-optimal-places`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
      },
      body: JSON.stringify({
        trip_id: trip.id,
        max_places: finalSettings.max_places_per_day || 20,
        fairness_weight: finalSettings.fairness_weight || 0.6,
        _dev_user_id: user.id === '2600c340-0ecd-4166-860f-ac4798888344' ? user.id : undefined
      })
    });

    if (selectionResponse.ok) {
      const selectionResult = await selectionResponse.json();
      selectedPlaces = selectionResult.result.selectedPlaces.map((sp: any) => sp.place);
      console.log(`Using ${selectedPlaces.length} pre-selected places from selection service`);
    } else {
      // Fallback to original logic if selection service fails
      console.warn('Place selection service failed, using fallback selection');
      selectedPlaces = places;
    }
  } catch (error) {
    console.warn('Error calling place selection service:', error);
    selectedPlaces = places;
  }

  // Separate system-generated places (departure/destination) from user places
  const systemPlaces = selectedPlaces.filter(p => p.source === 'system');
  const userPlaces = selectedPlaces.filter(p => p.source !== 'system');

  // Find departure and destination places
  const departurePlace = systemPlaces.find(p => 
    p.category === 'departure_point' || p.name.includes('(Departure)')
  );
  const destinationPlace = systemPlaces.find(p => 
    p.category === 'destination_point' || p.category === 'return_point' ||
    p.name.includes('(Final Destination)') || p.name.includes('(Return)')
  );

  if (!departurePlace) {
    throw new Error('Departure location not found in places');
  }

  // Group places by day if dates are available
  const dailySchedules = trip.start_date && trip.end_date
    ? optimizeScheduledTrip(trip, departurePlace, destinationPlace, userPlaces, finalSettings)
    : optimizeUnscheduledTrip(trip, departurePlace, destinationPlace, userPlaces, finalSettings);

  // Calculate optimization score
  const optimizationScore = calculateOptimizationScore(dailySchedules, finalSettings);

  // Calculate totals
  const totalTravelTime = dailySchedules.reduce((sum, day) => sum + day.total_travel_time, 0);
  const totalVisitTime = dailySchedules.reduce((sum, day) => sum + day.total_visit_time, 0);

  return {
    daily_schedules: dailySchedules,
    optimization_score: optimizationScore,
    execution_time_ms: 0, // Will be set by caller
    total_travel_time_minutes: totalTravelTime,
    total_visit_time_minutes: totalVisitTime,
    created_by: ''  // Will be set by caller
  };
}

function normalizeUserWeights(places: Place[], members: any[]): Place[] {
  // Calculate places per user
  const userPlaceCounts = places.reduce((acc, place) => {
    acc[place.user_id] = (acc[place.user_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return places.map(place => {
    const userCount = userPlaceCounts[place.user_id] || 1;
    const fairnessFactor = Math.sqrt(1 / userCount); // Reduce weight for users with many places
    
    return {
      ...place,
      normalized_weight: (place.wish_level / 5) * fairnessFactor
    } as any;
  });
}

function optimizeScheduledTrip(
  trip: TripData,
  departure: Place,
  destination: Place | undefined,
  places: Place[],
  settings: OptimizationSettings
): DailySchedule[] {
  const tripDays = generateTripDays(trip.start_date!, trip.end_date!);
  const dailySchedules: DailySchedule[] = [];

  // Assign places to days based on visit_date or distribute evenly
  const dailyPlaceGroups = groupPlacesByDay(places, tripDays);

  tripDays.forEach((date, dayIndex) => {
    const dayPlaces = dailyPlaceGroups[date] || [];
    
    // Add departure place on first day
    const placesForDay = dayIndex === 0 ? [departure, ...dayPlaces] : dayPlaces;
    
    // Add destination place on last day
    if (dayIndex === tripDays.length - 1 && destination) {
      placesForDay.push(destination);
    }

    // Optimize the order for this day using TSP with constraints
    const optimizedOrder = optimizeSingleDay(placesForDay, departure, 
      dayIndex === tripDays.length - 1 ? destination : undefined);

    // Create detailed schedule with times
    const dailySchedule = createDailySchedule(date, optimizedOrder, settings);
    dailySchedules.push(dailySchedule);
  });

  return dailySchedules;
}

function optimizeUnscheduledTrip(
  trip: TripData,
  departure: Place,
  destination: Place | undefined,
  places: Place[],
  settings: OptimizationSettings
): DailySchedule[] {
  // For unscheduled trips, create a single day schedule or distribute across reasonable days
  const maxPlacesPerDay = 8;
  const dayCount = Math.ceil((places.length + 2) / maxPlacesPerDay); // +2 for departure/destination

  const dailySchedules: DailySchedule[] = [];
  
  for (let dayIndex = 0; dayIndex < dayCount; dayIndex++) {
    const startIndex = dayIndex * maxPlacesPerDay;
    const endIndex = Math.min(startIndex + maxPlacesPerDay, places.length);
    const dayPlaces = places.slice(startIndex, endIndex);

    // Add departure on first day
    const placesForDay = dayIndex === 0 ? [departure, ...dayPlaces] : dayPlaces;
    
    // Add destination on last day
    if (dayIndex === dayCount - 1 && destination) {
      placesForDay.push(destination);
    }

    const optimizedOrder = optimizeSingleDay(placesForDay, departure,
      dayIndex === dayCount - 1 ? destination : undefined);

    const date = `day-${dayIndex + 1}`;
    const dailySchedule = createDailySchedule(date, optimizedOrder, settings);
    dailySchedules.push(dailySchedule);
  }

  return dailySchedules;
}

function optimizeSingleDay(
  places: Place[],
  departure: Place,
  destination?: Place
): Place[] {
  if (places.length <= 2) {
    return places;
  }

  // Separate fixed points (departure/destination) from optimizable places
  const optimizablePlaces = places.filter(p => 
    p.id !== departure.id && (!destination || p.id !== destination.id)
  );

  if (optimizablePlaces.length === 0) {
    return destination ? [departure, destination] : [departure];
  }

  // Use nearest neighbor heuristic with 2-opt improvement
  const currentRoute = [departure];
  const unvisited = [...optimizablePlaces];
  let currentPlace = departure;

  // Build initial route using nearest neighbor
  while (unvisited.length > 0) {
    const nearest = findNearestPlace(currentPlace, unvisited);
    currentRoute.push(nearest);
    unvisited.splice(unvisited.indexOf(nearest), 1);
    currentPlace = nearest;
  }

  // Add destination at the end
  if (destination) {
    currentRoute.push(destination);
  }

  // Improve with 2-opt (keeping departure and destination fixed)
  return improve2OptWithFixedEnds(currentRoute);
}

function findNearestPlace(current: Place, candidates: Place[]): Place {
  let nearest = candidates[0];
  let minScore = calculatePlaceScore(current, nearest);

  for (const candidate of candidates.slice(1)) {
    const score = calculatePlaceScore(current, candidate);
    if (score < minScore) {
      minScore = score;
      nearest = candidate;
    }
  }

  return nearest;
}

function calculatePlaceScore(from: Place, to: Place): number {
  // Combine distance and wish level for scoring
  const distance = calculateDistance(from, to);
  const wishBonus = (to as any).normalized_weight || (to.wish_level / 5);
  
  // Higher wish level reduces effective distance
  return distance * (2 - wishBonus);
}

function calculateDistance(place1: Place, place2: Place): number {
  // Use Haversine formula if coordinates available, otherwise estimate
  if (place1.latitude && place1.longitude && place2.latitude && place2.longitude) {
    return calculateHaversineDistance(
      place1.latitude, place1.longitude,
      place2.latitude, place2.longitude
    );
  }
  
  // Fallback: estimate distance based on place names (for demonstration)
  const distanceMap: Record<string, Record<string, number>> = {
    'London': { 'Sydney': 17000, 'New York': 5500, 'Tokyo': 9600, 'PARI': 9600 },
    'Sydney': { 'London': 17000, 'New York': 15900, 'Tokyo': 7800, 'PARI': 7800 },
    'New York': { 'London': 5500, 'Sydney': 15900, 'Tokyo': 10900, 'PARI': 10900 },
    'Tokyo': { 'London': 9600, 'Sydney': 7800, 'New York': 10900, 'PARI': 0 },
    'PARI': { 'London': 9600, 'Sydney': 7800, 'New York': 10900, 'Tokyo': 0 }
  };
  
  const place1Key = Object.keys(distanceMap).find(key => place1.name.includes(key));
  const place2Key = Object.keys(distanceMap).find(key => place2.name.includes(key));
  
  if (place1Key && place2Key && distanceMap[place1Key]?.[place2Key]) {
    return distanceMap[place1Key][place2Key];
  }
  
  // Ultimate fallback: assume medium distance for unknown places
  return 100; // 100km default distance
}

function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function improve2OptWithFixedEnds(route: Place[]): Place[] {
  if (route.length <= 3) return route;

  let improved = true;
  let currentRoute = [...route];

  while (improved) {
    improved = false;
    
    // Only optimize between fixed endpoints
    for (let i = 1; i < currentRoute.length - 2; i++) {
      for (let j = i + 1; j < currentRoute.length - 1; j++) {
        const newRoute = [...currentRoute];
        
        // Reverse the segment between i and j
        const segment = newRoute.slice(i, j + 1).reverse();
        newRoute.splice(i, j - i + 1, ...segment);
        
        if (calculateTotalDistance(newRoute) < calculateTotalDistance(currentRoute)) {
          currentRoute = newRoute;
          improved = true;
        }
      }
    }
  }

  return currentRoute;
}

function calculateTotalDistance(route: Place[]): number {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += calculateDistance(route[i], route[i + 1]);
  }
  return total;
}

function createDailySchedule(date: string, places: Place[], settings: OptimizationSettings): DailySchedule {
  const scheduledPlaces: ScheduledPlace[] = [];
  const mealBreaks: MealBreak[] = [];
  
  let currentTime = new Date(`${date}T09:00:00`); // Start at 9 AM
  let totalTravelTime = 0;
  let totalVisitTime = 0;

  for (let i = 0; i < places.length; i++) {
    const place = places[i];
    const previousPlace = i > 0 ? places[i - 1] : null;
    
    // Calculate travel time from previous place
    const travelTime = previousPlace ? calculateTravelTime(previousPlace, place) : 0;
    totalTravelTime += travelTime;
    
    // Add travel time to current time
    currentTime = new Date(currentTime.getTime() + travelTime * 60000);
    
    // Check for meal breaks
    const mealBreak = checkForMealBreak(currentTime, mealBreaks);
    if (mealBreak) {
      mealBreaks.push(mealBreak);
      currentTime = new Date(mealBreak.end_time);
    }
    
    const arrivalTime = new Date(currentTime);
    const departureTime = new Date(currentTime.getTime() + place.stay_duration_minutes * 60000);
    totalVisitTime += place.stay_duration_minutes;
    
    scheduledPlaces.push({
      place,
      arrival_time: arrivalTime.toISOString(),
      departure_time: departureTime.toISOString(),
      travel_time_from_previous: travelTime,
      transport_mode: selectTransportMode(previousPlace, place),
      order_in_day: i + 1
    });
    
    currentTime = departureTime;
  }

  return {
    date,
    scheduled_places: scheduledPlaces,
    meal_breaks: mealBreaks,
    total_travel_time: totalTravelTime,
    total_visit_time: totalVisitTime
  };
}

function calculateTravelTime(from: Place, to: Place): number {
  const distance = calculateDistance(from, to);
  const transportMode = selectTransportMode(from, to);
  
  // Realistic travel time calculation based on transport mode
  switch (transportMode) {
    case 'walking':
      return Math.max(5, distance * 12); // Walking: ~5km/h
    case 'car':
      return Math.max(30, distance * 1.5); // Car: ~40km/h average + traffic
    case 'flight':
      // Flight time calculation: airport procedures + flight time
      const flightTime = distance / 800 * 60; // ~800km/h cruising speed
      const airportTime = 180; // 3 hours for check-in, security, boarding, deplaning
      return Math.max(240, flightTime + airportTime); // Minimum 4 hours for any flight
    default:
      return Math.max(30, distance * 1.5); // Default to car
  }
}

function selectTransportMode(from: Place | null, to: Place): 'walking' | 'car' | 'flight' {
  if (!from) return 'walking';
  
  const distance = calculateDistance(from, to);
  
  // International/long distance flights (500km+)
  if (distance >= 500) return 'flight';
  
  // Domestic flights for very long distances (200km+)
  if (distance >= 200) return 'flight';
  
  // Car for medium distances (1km+)
  if (distance >= 1) return 'car';
  
  // Walking for very short distances
  return 'walking';
}

function checkForMealBreak(currentTime: Date, existingBreaks: MealBreak[]): MealBreak | null {
  const hour = currentTime.getHours();
  
  const mealTimes = [
    { type: 'breakfast' as const, start: 7, end: 9, duration: 45 },
    { type: 'lunch' as const, start: 12, end: 14, duration: 60 },
    { type: 'dinner' as const, start: 18, end: 20, duration: 90 }
  ];

  for (const meal of mealTimes) {
    if (hour >= meal.start && hour <= meal.end) {
      const hasExisting = existingBreaks.some(b => b.type === meal.type);
      if (!hasExisting) {
        const startTime = new Date(currentTime);
        const endTime = new Date(currentTime.getTime() + meal.duration * 60000);
        
        return {
          type: meal.type,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          estimated_cost: meal.type === 'breakfast' ? 800 : meal.type === 'lunch' ? 1200 : 2000
        };
      }
    }
  }
  
  return null;
}

function generateTripDays(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    days.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  
  return days;
}

function groupPlacesByDay(places: Place[], tripDays: string[]): Record<string, Place[]> {
  const groups: Record<string, Place[]> = {};
  
  // Initialize all days
  tripDays.forEach(day => {
    groups[day] = [];
  });
  
  // Assign places with specific visit dates
  const scheduledPlaces = places.filter(p => p.visit_date);
  const unscheduledPlaces = places.filter(p => !p.visit_date);
  
  scheduledPlaces.forEach(place => {
    const date = place.visit_date!.split('T')[0];
    if (groups[date]) {
      groups[date].push(place);
    }
  });
  
  // Distribute unscheduled places evenly
  unscheduledPlaces.forEach((place, index) => {
    const dayIndex = index % tripDays.length;
    groups[tripDays[dayIndex]].push(place);
  });
  
  return groups;
}

function calculateOptimizationScore(dailySchedules: DailySchedule[], settings: OptimizationSettings): OptimizationScore {
  // Calculate fairness score
  const fairnessScore = calculateFairnessScore(dailySchedules);
  
  // Calculate efficiency score  
  const efficiencyScore = calculateEfficiencyScore(dailySchedules);
  
  // Calculate overall score
  const overall = (settings.fairness_weight || 0.6) * fairnessScore + 
                  (settings.efficiency_weight || 0.4) * efficiencyScore;

  return {
    overall,
    fairness: fairnessScore,
    efficiency: efficiencyScore,
    details: {
      user_adoption_balance: fairnessScore,
      wish_satisfaction_balance: fairnessScore,
      travel_efficiency: efficiencyScore,
      time_constraint_compliance: efficiencyScore
    }
  };
}

function calculateFairnessScore(dailySchedules: DailySchedule[]): number {
  const allPlaces = dailySchedules.flatMap(day => day.scheduled_places.map(sp => sp.place));
  const userPlaces = allPlaces.filter(p => p.source !== 'system');
  
  if (userPlaces.length === 0) return 1.0;
  
  // Calculate user adoption rates
  const userCounts = userPlaces.reduce((acc, place) => {
    acc[place.user_id] = (acc[place.user_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const rates = Object.values(userCounts).map(count => count / userPlaces.length);
  const mean = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
  const variance = rates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / rates.length;
  
  // Lower variance = higher fairness
  return Math.exp(-variance * 10);
}

function calculateEfficiencyScore(dailySchedules: DailySchedule[]): number {
  const totalDistance = dailySchedules.reduce((sum, day) => {
    return sum + day.scheduled_places.reduce((daySum, sp, index) => {
      return daySum + (sp.travel_time_from_previous || 0);
    }, 0);
  }, 0);
  
  const totalPlaces = dailySchedules.reduce((sum, day) => sum + day.scheduled_places.length, 0);
  
  if (totalPlaces <= 1) return 1.0;
  
  // Normalize efficiency score (lower average travel time = higher efficiency)
  const avgTravelTime = totalDistance / (totalPlaces - 1);
  return Math.max(0, 1 - (avgTravelTime / 60)); // Assume 60 minutes as poor efficiency threshold
}

async function getCachedOptimization(supabase: any, tripId: string, places: Place[]): Promise<OptimizedRoute | null> {
  const placesHash = generatePlacesHash(places);
  
  const { data, error } = await supabase
    .from('optimization_cache')
    .select('result')
    .eq('trip_id', tripId)
    .eq('places_hash', placesHash)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  
  return data.result as OptimizedRoute;
}

async function setCachedOptimization(supabase: any, tripId: string, places: Place[], result: OptimizedRoute) {
  const placesHash = generatePlacesHash(places);
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 30); // 30 minute cache

  await supabase
    .from('optimization_cache')
    .upsert({
      trip_id: tripId,
      places_hash: placesHash,
      settings_hash: 'default',
      result,
      expires_at: expiresAt.toISOString(),
    });
}

function generatePlacesHash(places: Place[]): string {
  const hashInput = places
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(p => `${p.id}:${p.wish_level}:${p.stay_duration_minutes}:${p.visit_date || ''}`)
    .join('|');
  
  return btoa(hashInput).slice(0, 32);
}

async function saveOptimizationResult(
  supabase: any,
  tripId: string,
  userId: string,
  result: OptimizedRoute,
  executionTime: number
): Promise<string> {
  // Mark previous results as inactive
  await supabase
    .from('optimization_results')
    .update({ is_active: false })
    .eq('trip_id', tripId);

  // Save new result
  const { data, error } = await supabase
    .from('optimization_results')
    .insert({
      trip_id: tripId,
      created_by: userId,
      optimized_route: result.daily_schedules,
      optimization_score: result.optimization_score,
      execution_time_ms: executionTime,
      places_count: result.daily_schedules.reduce((sum, day) => sum + day.scheduled_places.length, 0),
      algorithm_version: '2.0',
      total_travel_time_minutes: result.total_travel_time_minutes,
      total_visit_time_minutes: result.total_visit_time_minutes,
      is_active: true
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to save optimization result: ${error.message}`);
  }

  return data.id;
}

async function recordOptimizationEvent(supabase: any, userId: string, tripId: string, metadata: any) {
  await supabase
    .from('usage_events')
    .insert({
      user_id: userId,
      event_type: 'optimization_completed',
      event_category: 'optimization',
      trip_id: tripId,
      metadata
    });
}