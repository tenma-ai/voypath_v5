import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Comprehensive interfaces for type safety
interface Place {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  category: string;
  place_type: string;
  stay_duration_minutes: number;
  wish_level: number;
  user_id: string;
  normalized_wish_level?: number;
  fairness_contribution_score?: number;
  is_selected_for_optimization?: boolean;
  scheduled?: boolean;
  visit_date?: string;
  arrival_time?: string;
  departure_time?: string;
  transport_mode?: TransportMode;
  travel_time_from_previous?: number;
  order_in_day?: number;
  is_airport?: boolean;
  airport_code?: string;
}

interface Airport {
  iata_code: string;
  airport_name: string;
  city_name: string;
  latitude: number;
  longitude: number;
  commercial_service: boolean;
  international_service: boolean;
}

interface NormalizedUser {
  user_id: string;
  total_places: number;
  avg_wish_level: number;
  normalized_weight: number;
  places: Place[];
}

interface OptimizationConstraints {
  time_constraint_minutes: number;
  distance_constraint_km: number;
  budget_constraint_yen: number;
  max_places: number;
}

interface DailySchedule {
  day: number;
  date: string;
  places: Place[];
  total_travel_time: number;
  total_visit_time: number;
  meal_breaks: MealBreak[];
}

interface MealBreak {
  type: 'breakfast' | 'lunch' | 'dinner';
  start_time: string;
  duration_minutes: number;
  estimated_cost: number;
}

interface OptimizationResult {
  success: boolean;
  optimization: {
    daily_schedules: DailySchedule[];
    optimization_score: {
      total_score: number;
      fairness_score: number;
      efficiency_score: number;
      details: {
        user_adoption_balance: number;
        wish_satisfaction_balance: number;
        travel_efficiency: number;
        time_constraint_compliance: number;
      };
    };
    optimized_route: any;
    total_duration_minutes: number;
    places: Place[];
    execution_time_ms: number;
  };
  message: string;
}

type TransportMode = 'walking' | 'public_transport' | 'car' | 'flight';

// Utility functions for calculations
function safeDistance(point1: [number, number], point2: [number, number]): number {
  try {
    if (!point1 || !point2 || point1.length !== 2 || point2.length !== 2) {
      return 1000; // Default fallback distance
    }
    
    const [lat1, lon1] = point1;
    const [lat2, lon2] = point2;
    
    if (typeof lat1 !== 'number' || typeof lon1 !== 'number' || 
        typeof lat2 !== 'number' || typeof lon2 !== 'number') {
      return 1000;
    }
    
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  } catch (error) {
    console.error('Error calculating distance:', error);
    return 1000;
  }
}

function determineTransportMode(distance: number, fromAirport = false, toAirport = false): TransportMode {
  console.log(`🚗 Determining transport mode for distance: ${distance}km, fromAirport: ${fromAirport}, toAirport: ${toAirport}`);
  
  // If either end is an airport, must use flight
  if (fromAirport || toAirport) {
    console.log('  ✈️ Selected: flight (airport involved)');
    return 'flight';
  }
  
  // Distance-based determination
  if (distance <= 1) {
    console.log('  🚶 Selected: walking (short distance)');
    return 'walking';
  }
  if (distance <= 50) {
    console.log('  🚗 Selected: car (medium distance)');
    return 'car';
  }
  if (distance <= 500) {
    console.log('  🚗 Selected: car (long distance within country)');
    return 'car';
  }
  
  console.log('  ✈️ Selected: flight (international distance)');
  return 'flight';
}

function calculateTravelTime(distance: number, mode: TransportMode): number {
  const speeds = {
    walking: 5, // km/h
    public_transport: 25, // km/h
    car: 50, // km/h
    flight: 600 // km/h (including airport time)
  };
  
  const baseTime = (distance / speeds[mode]) * 60; // minutes
  
  // Add overhead times
  const overhead = {
    walking: 5,
    public_transport: 15,
    car: 10,
    flight: 120 // 2 hours for airport procedures
  };
  
  const totalTime = Math.round(baseTime + overhead[mode]);
  
  // Cap maximum travel time to reasonable limits
  const maxTimes = {
    walking: 480, // 8 hours max
    public_transport: 720, // 12 hours max
    car: 720, // 12 hours max
    flight: 1200 // 20 hours max (long international flights)
  };
  
  const cappedTime = Math.min(totalTime, maxTimes[mode]);
  
  console.log(`⏱️ Travel time for ${distance}km by ${mode}: ${baseTime.toFixed(0)}min base + ${overhead[mode]}min overhead = ${totalTime}min (capped to ${cappedTime}min)`);
  
  return cappedTime;
}

// Step 1-2: Retrieve and validate data from database
async function retrieveTripData(supabase: any, tripId: string, memberId: string) {
  console.log('🔄 Step 1-2: Retrieving trip data from database');
  console.log(`🔍 Fetching data for trip_id: ${tripId}, member_id: ${memberId}`);
  
  const { data: places, error: placesError } = await supabase
    .from('places')
    .select('*')
    .eq('trip_id', tripId);
    
  if (placesError) {
    console.error('❌ Failed to fetch places:', placesError);
    throw new Error(`Failed to fetch places: ${placesError.message}`);
  }
  
  const { data: tripMembers, error: membersError } = await supabase
    .from('trip_members')
    .select('user_id, assigned_color_index')
    .eq('trip_id', tripId);
    
  if (membersError) {
    console.error('❌ Failed to fetch trip members:', membersError);
    throw new Error(`Failed to fetch trip members: ${membersError.message}`);
  }
  
  console.log(`📊 Retrieved ${places?.length || 0} places and ${tripMembers?.length || 0} members`);
  
  // Log sample place data to debug data structure
  if (places && places.length > 0) {
    console.log('📍 Sample place data:', JSON.stringify(places[0], null, 2));
  }
  
  return {
    places: places || [],
    members: tripMembers || []
  };
}

// Helper function to safely convert database values to proper types
function sanitizePlace(place: any): Place {
  return {
    ...place,
    id: place.id || `place_${Date.now()}_${Math.random()}`,
    name: place.name || 'Unknown Place',
    latitude: parseFloat(place.latitude) || 0,
    longitude: parseFloat(place.longitude) || 0,
    category: place.category || 'other',
    place_type: place.place_type || 'visit',
    stay_duration_minutes: parseInt(place.stay_duration_minutes) || 120,
    wish_level: parseInt(place.wish_level) || 1,
    user_id: place.user_id || 'unknown'
  };
}

// Step 3: Normalize user preferences
async function normalizePreferences(places: any[]): Promise<NormalizedUser[]> {
  console.log('🔄 Step 3: Normalizing user preferences');
  console.log(`📊 Processing ${places?.length || 0} places for normalization`);
  
  if (!places || !Array.isArray(places) || places.length === 0) {
    console.log('⚠️ No places provided for normalization');
    return [];
  }
  
  const userGroups = new Map<string, Place[]>();
  
  // Group places by user with proper data sanitization
  // Include ALL places: system places (departure/destination) + user places
  places.forEach(place => {
    if (!place || !place.user_id) {
      console.log('⚠️ Skipping place without user_id:', place);
      return;
    }
    
    if (!userGroups.has(place.user_id)) {
      userGroups.set(place.user_id, []);
    }
    
    const sanitizedPlace = sanitizePlace(place);
    console.log(`📍 Sanitized place: ${sanitizedPlace.name} (${sanitizedPlace.latitude}, ${sanitizedPlace.longitude}) - Type: ${sanitizedPlace.place_type}`);
    userGroups.get(place.user_id)!.push(sanitizedPlace);
  });
  
  console.log(`📈 User groups created: ${userGroups.size} users`);
  userGroups.forEach((places, userId) => {
    console.log(`  - User ${userId}: ${places.length} places (${places.map(p => p.name).join(', ')})`);
  });
  
  const normalizedUsers: NormalizedUser[] = [];
  
  // Calculate normalization for each user
  userGroups.forEach((userPlaces, userId) => {
    const totalPlaces = userPlaces.length;
    const avgWishLevel = userPlaces.reduce((sum, p) => sum + p.wish_level, 0) / totalPlaces;
    
    // Normalize wish levels relative to user's average
    const normalizedPlaces = userPlaces.map(place => ({
      ...place,
      normalized_wish_level: place.wish_level / avgWishLevel,
      fairness_contribution_score: place.wish_level / (avgWishLevel * totalPlaces)
    }));
    
    normalizedUsers.push({
      user_id: userId,
      total_places: totalPlaces,
      avg_wish_level: avgWishLevel,
      normalized_weight: 1.0 / userGroups.size, // Equal weight for each user
      places: normalizedPlaces
    });
  });
  
  console.log(`✅ Normalized ${normalizedUsers.length} users with ${places.length} total places`);
  return normalizedUsers;
}

// Step 4: Filter places for fairness
async function filterPlacesForFairness(
  normalizedUsers: NormalizedUser[], 
  constraints: OptimizationConstraints
): Promise<Place[]> {
  console.log('🔄 Step 4: Filtering places for fairness');
  
  const allPlaces = normalizedUsers.flatMap(user => user.places);
  
  // Calculate total time needed for all places
  const totalTimeNeeded = allPlaces.reduce((sum, place) => {
    return sum + (place.stay_duration_minutes || 120); // Default 2 hours per place
  }, 0);
  
  // Add estimated travel time (rough estimate: 30 min average between places)
  const estimatedTravelTime = (allPlaces.length - 1) * 30;
  const totalEstimatedTime = totalTimeNeeded + estimatedTravelTime;
  
  console.log(`📊 Total time needed: ${totalTimeNeeded} minutes visit + ${estimatedTravelTime} minutes travel = ${totalEstimatedTime} minutes`);
  console.log(`📊 Time constraint: ${constraints.time_constraint_minutes} minutes`);
  
  // If all places fit within time constraint AND max places constraint, include all
  if (allPlaces.length <= constraints.max_places && totalEstimatedTime <= constraints.time_constraint_minutes) {
    console.log(`✅ All ${allPlaces.length} places fit within constraints (time and count)`);
    return allPlaces.map(place => ({ ...place, is_selected_for_optimization: true }));
  }
  
  // Fair selection algorithm - round-robin with wish level weighting
  const selectedPlaces: Place[] = [];
  const userQueues = normalizedUsers.map(user => ({
    ...user,
    places: [...user.places].sort((a, b) => b.normalized_wish_level! - a.normalized_wish_level!)
  }));
  
  let round = 0;
  while (selectedPlaces.length < constraints.max_places && userQueues.some(u => u.places.length > 0)) {
    for (const user of userQueues) {
      if (user.places.length > 0 && selectedPlaces.length < constraints.max_places) {
        const place = user.places.shift()!;
        place.is_selected_for_optimization = true;
        selectedPlaces.push(place);
      }
    }
    round++;
  }
  
  console.log(`✅ Selected ${selectedPlaces.length} places through ${round} rounds of fair selection`);
  return selectedPlaces;
}

// Step 5: Fix departure/destination and determine visit order
async function fixDepartureDestination(places: Place[]): Promise<{ departure: Place | null, destination: Place | null, visitPlaces: Place[] }> {
  console.log('🔄 Step 5: Fixing departure/destination and determining visit order');
  console.log(`📊 Processing ${places.length} places:`);
  places.forEach((place, index) => {
    console.log(`  ${index + 1}. ${place.name} - Type: ${place.place_type || 'undefined'} - Source: ${place.source || 'undefined'}`);
  });
  
  // Find departure and destination (handle duplicates properly)
  const departurePlaces = places.filter(p => p.place_type === 'departure');
  const destinationPlaces = places.filter(p => p.place_type === 'destination');
  
  let departure = departurePlaces.length > 0 ? departurePlaces[0] : null;
  let destination = destinationPlaces.length > 0 ? destinationPlaces[0] : null;
  
  // Remove ALL departure and destination places to get visit places
  const visitPlaces = places.filter(p => 
    p.place_type !== 'departure' && 
    p.place_type !== 'destination' &&
    p.source !== 'system'
  );
  
  // Log duplicates if found
  if (departurePlaces.length > 1) {
    console.log(`⚠️ Found ${departurePlaces.length} departure places, using first one: ${departure?.name}`);
    console.log(`⚠️ Duplicate departure places:`, departurePlaces.map(p => p.name));
  }
  if (destinationPlaces.length > 1) {
    console.log(`⚠️ Found ${destinationPlaces.length} destination places, using first one: ${destination?.name}`);
    console.log(`⚠️ Duplicate destination places:`, destinationPlaces.map(p => p.name));
  }
  
  console.log(`📋 Found departure: ${departure ? departure.name : 'None'}`);
  console.log(`📋 Found destination: ${destination ? destination.name : 'None'}`);
  console.log(`📋 Visit places: ${visitPlaces.length} (${visitPlaces.map(p => p.name).join(', ')})`);
  
  // If no system places found, try to create them from the data
  if (!departure && !destination) {
    console.log('⚠️ No system places found, attempting to identify from place names');
    
    // Find places with Departure: or Destination: in name
    const allDepartureCandidates = places.filter(p => p.name.includes('Departure:'));
    const allDestinationCandidates = places.filter(p => p.name.includes('Destination:'));
    
    if (allDepartureCandidates.length > 0) {
      departure = allDepartureCandidates[0]; // Use first departure candidate
      departure.place_type = 'departure';
      console.log(`📍 Identified departure: ${departure.name}`);
      
      // Remove other departure candidates from consideration
      if (allDepartureCandidates.length > 1) {
        console.log(`⚠️ Found ${allDepartureCandidates.length} departure candidates, using first: ${departure.name}`);
      }
    }
    
    if (allDestinationCandidates.length > 0) {
      destination = allDestinationCandidates[0]; // Use first destination candidate
      destination.place_type = 'destination';
      console.log(`📍 Identified destination: ${destination.name}`);
    }
    
    // Re-filter visit places to exclude newly identified system places
    const finalVisitPlaces = places.filter(p => 
      p !== departure && 
      p !== destination &&
      !p.name.includes('Departure:') &&
      !p.name.includes('Destination:')
    );
    
    console.log(`📋 After identification - Visit places: ${finalVisitPlaces.length} (${finalVisitPlaces.map(p => p.name).join(', ')})`);
    
    return { departure, destination, visitPlaces: finalVisitPlaces };
  }
  
  // For round trips (no destination), create a virtual destination same as departure
  if (departure && !destination) {
    console.log('🔄 Round trip detected - creating virtual destination');
    destination = {
      ...departure,
      id: `${departure.id}_destination`,
      name: departure.name.replace('Departure:', 'Return to:'),
      place_type: 'destination'
    };
    console.log(`📍 Created virtual destination: ${destination.name}`);
  }
  
  // Sort visit places by wish level and fairness score
  visitPlaces.sort((a, b) => {
    const scoreA = (a.normalized_wish_level || 1) * (a.fairness_contribution_score || 1);
    const scoreB = (b.normalized_wish_level || 1) * (b.fairness_contribution_score || 1);
    return scoreB - scoreA;
  });
  
  console.log(`✅ Fixed route: ${departure ? 'Departure set' : 'No departure'}, ${destination ? 'Destination set' : 'No destination'}, ${visitPlaces.length} visit places`);
  return { departure, destination, visitPlaces };
}

// Step 6: Determine transport modes
async function determineTransportModes(places: Place[]): Promise<Place[]> {
  console.log('🔄 Step 6: Determining transport modes');
  
  const updatedPlaces = [...places];
  
  for (let i = 1; i < updatedPlaces.length; i++) {
    const prevPlace = updatedPlaces[i - 1];
    const currentPlace = updatedPlaces[i];
    
    const distance = safeDistance(
      [prevPlace.latitude, prevPlace.longitude],
      [currentPlace.latitude, currentPlace.longitude]
    );
    
    const transportMode = determineTransportMode(
      distance,
      prevPlace.is_airport,
      currentPlace.is_airport
    );
    
    currentPlace.transport_mode = transportMode;
    currentPlace.travel_time_from_previous = calculateTravelTime(distance, transportMode);
  }
  
  console.log('✅ Transport modes determined for all place transitions');
  return updatedPlaces;
}

// Step 7: Insert airports using AirportDB API
async function insertAirports(supabase: any, places: Place[]): Promise<Place[]> {
  console.log('🔄 Step 7: Inserting airports using AirportDB data');
  
  const updatedPlaces = [...places];
  const newAirports: Place[] = [];
  
  // Find long-distance transitions that need flights
  for (let i = 1; i < updatedPlaces.length; i++) {
    const prevPlace = updatedPlaces[i - 1];
    const currentPlace = updatedPlaces[i];
    
    if (currentPlace.transport_mode === 'flight') {
      // Find nearest airports for departure and arrival
      const { data: departureAirports } = await supabase
        .from('airportdb_cache')
        .select('*')
        .eq('commercial_service', true)
        .order('location_point <-> point(' + prevPlace.longitude + ',' + prevPlace.latitude + ')')
        .limit(1);
        
      const { data: arrivalAirports } = await supabase
        .from('airportdb_cache')
        .select('*')
        .eq('commercial_service', true)
        .order('location_point <-> point(' + currentPlace.longitude + ',' + currentPlace.latitude + ')')
        .limit(1);
      
      if (departureAirports && departureAirports[0] && arrivalAirports && arrivalAirports[0]) {
        const depAirport = departureAirports[0];
        const arrAirport = arrivalAirports[0];
        
        // Insert departure airport if not same as previous place
        if (!prevPlace.is_airport) {
          const depAirportPlace: Place = {
            id: `airport_${depAirport.iata_code}_dep`,
            name: `${depAirport.airport_name} (${depAirport.iata_code})`,
            latitude: parseFloat(depAirport.latitude),
            longitude: parseFloat(depAirport.longitude),
            category: 'airport',
            place_type: 'airport',
            stay_duration_minutes: 60,
            wish_level: 1,
            user_id: prevPlace.user_id,
            is_airport: true,
            airport_code: depAirport.iata_code,
            transport_mode: 'car'
          };
          newAirports.push(depAirportPlace);
        }
        
        // Insert arrival airport if not same as current place
        if (!currentPlace.is_airport) {
          const arrAirportPlace: Place = {
            id: `airport_${arrAirport.iata_code}_arr`,
            name: `${arrAirport.airport_name} (${arrAirport.iata_code})`,
            latitude: parseFloat(arrAirport.latitude),
            longitude: parseFloat(arrAirport.longitude),
            category: 'airport',
            place_type: 'airport',
            stay_duration_minutes: 60,
            wish_level: 1,
            user_id: currentPlace.user_id,
            is_airport: true,
            airport_code: arrAirport.iata_code,
            transport_mode: 'flight'
          };
          newAirports.push(arrAirportPlace);
        }
      }
    }
  }
  
  // Simply add all airports to the route - TSP will optimize the order
  if (newAirports.length > 0) {
    console.log(`✅ Adding ${newAirports.length} airports to route for TSP optimization`);
    return [...updatedPlaces, ...newAirports];
  }
  
  console.log(`✅ No airports needed for this route`);
  return updatedPlaces;
}

// Step 8: TSP Greedy Algorithm for route optimization
async function optimizeRouteWithTSP(places: Place[]): Promise<Place[]> {
  console.log('🔄 Step 8: Applying TSP greedy algorithm for route optimization');
  
  if (places.length <= 2) return places;
  
  const optimizedRoute: Place[] = [];
  const unvisited = [...places];
  
  // Extract departure and destination
  const departure = unvisited.find(p => p.place_type === 'departure');
  const destination = unvisited.find(p => p.place_type === 'destination');
  
  // Remove departure and destination from unvisited list
  if (departure) {
    optimizedRoute.push(departure);
    unvisited.splice(unvisited.indexOf(departure), 1);
  }
  
  if (destination && destination.id !== departure?.id) {
    unvisited.splice(unvisited.indexOf(destination), 1);
  }
  
  // Greedy TSP for middle places only (excluding destination)
  while (unvisited.length > 0) {
    const currentPlace = optimizedRoute[optimizedRoute.length - 1];
    let nearestPlace = unvisited[0];
    let minDistance = safeDistance(
      [currentPlace.latitude, currentPlace.longitude],
      [nearestPlace.latitude, nearestPlace.longitude]
    );
    
    for (let i = 1; i < unvisited.length; i++) {
      const distance = safeDistance(
        [currentPlace.latitude, currentPlace.longitude],
        [unvisited[i].latitude, unvisited[i].longitude]
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestPlace = unvisited[i];
      }
    }
    
    optimizedRoute.push(nearestPlace);
    unvisited.splice(unvisited.indexOf(nearestPlace), 1);
  }
  
  // Add destination at the end (only if different from departure)
  if (destination && destination.id !== departure?.id) {
    optimizedRoute.push(destination);
  } else if (destination && destination.id === departure?.id) {
    // For round trips, add a copy of departure as destination
    const returnTrip = { ...departure, id: `${departure.id}_return`, name: departure.name.replace('Departure:', 'Return to:') };
    optimizedRoute.push(returnTrip);
  }
  
  console.log(`✅ Route optimized using TSP greedy algorithm: ${optimizedRoute.length} places`);
  return optimizedRoute;
}

// Step 9: Calculate realistic travel times
async function calculateRealisticTravelTimes(places: Place[]): Promise<Place[]> {
  console.log('🔄 Step 9: Calculating realistic travel times');
  
  const updatedPlaces = [...places];
  
  for (let i = 1; i < updatedPlaces.length; i++) {
    const prevPlace = updatedPlaces[i - 1];
    const currentPlace = updatedPlaces[i];
    
    const distance = safeDistance(
      [prevPlace.latitude, prevPlace.longitude],
      [currentPlace.latitude, currentPlace.longitude]
    );
    
    const mode = currentPlace.transport_mode || determineTransportMode(distance, prevPlace.is_airport, currentPlace.is_airport);
    currentPlace.transport_mode = mode;
    currentPlace.travel_time_from_previous = calculateTravelTime(distance, mode);
  }
  
  console.log('✅ Realistic travel times calculated for all transitions');
  return updatedPlaces;
}

// Step 10: Split schedule by days
async function splitScheduleByDays(places: Place[], constraintMinutes: number): Promise<DailySchedule[]> {
  console.log('🔄 Step 10: Splitting schedule by days');
  
  const dailySchedules: DailySchedule[] = [];
  let currentDay = 1;
  let currentDayPlaces: Place[] = [];
  let currentDayTime = 0;
  const maxDailyTime = Math.min(constraintMinutes, 720); // Max 12 hours per day
  
  for (const place of places) {
    const placeTime = place.stay_duration_minutes + (place.travel_time_from_previous || 0);
    
    // Start new day if current day would exceed time limit
    if (currentDayTime + placeTime > maxDailyTime && currentDayPlaces.length > 0) {
      dailySchedules.push({
        day: currentDay,
        date: new Date(Date.now() + (currentDay - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        places: currentDayPlaces,
        total_travel_time: currentDayPlaces.reduce((sum, p) => sum + (p.travel_time_from_previous || 0), 0),
        total_visit_time: currentDayPlaces.reduce((sum, p) => sum + p.stay_duration_minutes, 0),
        meal_breaks: []
      });
      
      currentDay++;
      currentDayPlaces = [];
      currentDayTime = 0;
    }
    
    currentDayPlaces.push(place);
    currentDayTime += placeTime;
  }
  
  // Add final day if there are remaining places
  if (currentDayPlaces.length > 0) {
    dailySchedules.push({
      day: currentDay,
      date: new Date(Date.now() + (currentDay - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      places: currentDayPlaces,
      total_travel_time: currentDayPlaces.reduce((sum, p) => sum + (p.travel_time_from_previous || 0), 0),
      total_visit_time: currentDayPlaces.reduce((sum, p) => sum + p.stay_duration_minutes, 0),
      meal_breaks: []
    });
  }
  
  console.log(`✅ Schedule split into ${dailySchedules.length} days`);
  return dailySchedules;
}

// Step 11: Insert meal times (MVP implementation)
async function insertMealTimes(dailySchedules: DailySchedule[]): Promise<DailySchedule[]> {
  console.log('🔄 Step 11: Inserting meal times (MVP implementation)');
  
  const updatedSchedules = dailySchedules.map(schedule => ({
    ...schedule,
    meal_breaks: [
      { type: 'lunch' as const, start_time: '12:00', duration_minutes: 60, estimated_cost: 1500 },
      { type: 'dinner' as const, start_time: '18:00', duration_minutes: 90, estimated_cost: 3000 }
    ]
  }));
  
  console.log('✅ Basic meal times inserted for all days');
  return updatedSchedules;
}

// Step 12: Adjust for business hours (MVP implementation)
async function adjustForBusinessHours(dailySchedules: DailySchedule[]): Promise<DailySchedule[]> {
  console.log('🔄 Step 12: Adjusting for business hours (MVP implementation)');
  
  // Basic implementation - assume all places open 9:00-18:00
  const updatedSchedules = dailySchedules.map(schedule => ({
    ...schedule,
    places: schedule.places.map((place, index) => ({
      ...place,
      arrival_time: place.arrival_time || `${9 + index * 2}:00:00`,
      departure_time: place.departure_time || `${9 + index * 2 + Math.floor(place.stay_duration_minutes / 60)}:${(place.stay_duration_minutes % 60).toString().padStart(2, '0')}:00`
    }))
  }));
  
  console.log('✅ Basic business hours adjustment applied');
  return updatedSchedules;
}

// Step 13: Build detailed schedule
async function buildDetailedSchedule(dailySchedules: DailySchedule[]): Promise<DailySchedule[]> {
  console.log('🔄 Step 13: Building detailed schedule with times and transport');
  
  const detailedSchedules = dailySchedules.map(schedule => {
    let currentTime = 9 * 60; // Start at 9:00 AM (in minutes)
    
    const detailedPlaces = schedule.places.map((place, index) => {
      // Add travel time to get to this place
      if (index > 0 && place.travel_time_from_previous) {
        currentTime += place.travel_time_from_previous;
      }
      
      const arrivalHour = Math.floor(currentTime / 60);
      const arrivalMinute = currentTime % 60;
      const arrival_time = `${arrivalHour.toString().padStart(2, '0')}:${arrivalMinute.toString().padStart(2, '0')}:00`;
      
      // Add stay duration
      currentTime += place.stay_duration_minutes;
      
      const departureHour = Math.floor(currentTime / 60);
      const departureMinute = currentTime % 60;
      const departure_time = `${departureHour.toString().padStart(2, '0')}:${departureMinute.toString().padStart(2, '0')}:00`;
      
      return {
        ...place,
        arrival_time,
        departure_time,
        order_in_day: index + 1
      };
    });
    
    return {
      ...schedule,
      places: detailedPlaces
    };
  });
  
  console.log('✅ Detailed schedule built with precise times and transport');
  return detailedSchedules;
}

// Step 14: Store results in database
async function storeOptimizationResults(
  supabase: any,
  tripId: string,
  memberId: string,
  dailySchedules: DailySchedule[],
  optimizationScore: any,
  executionTime: number
): Promise<void> {
  console.log('🔄 Step 14: Storing results in database');
  
  const { error } = await supabase
    .from('optimization_results')
    .insert({
      trip_id: tripId,
      created_by: memberId,
      optimized_route: dailySchedules,
      optimization_score: optimizationScore,
      execution_time_ms: executionTime,
      places_count: dailySchedules.reduce((sum, day) => sum + day.places.length, 0),
      total_travel_time_minutes: dailySchedules.reduce((sum, day) => sum + day.total_travel_time, 0),
      total_visit_time_minutes: dailySchedules.reduce((sum, day) => sum + day.total_visit_time, 0),
      is_active: true,
      algorithm_version: '15-step-mvp-v1'
    });
    
  if (error) {
    console.error('Failed to store optimization results:', error);
    throw new Error(`Failed to store results: ${error.message}`);
  }
  
  console.log('✅ Optimization results stored in database');
}

// Step 15: Calculate optimization scores
function calculateOptimizationScore(
  normalizedUsers: NormalizedUser[],
  selectedPlaces: Place[],
  dailySchedules: DailySchedule[],
  constraints: OptimizationConstraints
): any {
  console.log('🔄 Step 15: Calculating optimization scores');
  
  // User adoption balance (fairness)
  const userPlaceCounts = normalizedUsers.map(user => 
    selectedPlaces.filter(place => place.user_id === user.user_id).length
  );
  const avgPlacesPerUser = userPlaceCounts.reduce((sum, count) => sum + count, 0) / userPlaceCounts.length;
  const fairnessVariance = userPlaceCounts.reduce((sum, count) => sum + Math.pow(count - avgPlacesPerUser, 2), 0) / userPlaceCounts.length;
  const fairnessScore = Math.max(0, 100 - fairnessVariance * 10);
  
  // Wish satisfaction balance
  const totalWishValue = selectedPlaces.reduce((sum, place) => sum + (place.normalized_wish_level || 1), 0);
  const maxPossibleWish = selectedPlaces.length * 1.5; // Assuming max normalized wish is 1.5
  const wishSatisfactionScore = Math.min(100, (totalWishValue / maxPossibleWish) * 100);
  
  // Travel efficiency
  const totalTravelTime = dailySchedules.reduce((sum, day) => sum + day.total_travel_time, 0);
  const totalVisitTime = dailySchedules.reduce((sum, day) => sum + day.total_visit_time, 0);
  const efficiencyRatio = totalVisitTime / (totalVisitTime + totalTravelTime);
  const efficiencyScore = efficiencyRatio * 100;
  
  // Time constraint compliance
  const totalTime = totalTravelTime + totalVisitTime;
  const complianceScore = totalTime <= constraints.time_constraint_minutes ? 100 : 
    Math.max(0, 100 - ((totalTime - constraints.time_constraint_minutes) / constraints.time_constraint_minutes) * 100);
  
  const overallScore = (fairnessScore + wishSatisfactionScore + efficiencyScore + complianceScore) / 4;
  
  const optimizationScore = {
    total_score: Math.round(overallScore),
    fairness_score: Math.round(fairnessScore),
    efficiency_score: Math.round(efficiencyScore),
    details: {
      user_adoption_balance: fairnessScore / 100,
      wish_satisfaction_balance: wishSatisfactionScore / 100,
      travel_efficiency: efficiencyScore / 100,
      time_constraint_compliance: complianceScore / 100
    }
  };
  
  console.log(`✅ Optimization score calculated: ${overallScore.toFixed(1)}% overall`);
  return optimizationScore;
}

// Main optimization function implementing all 15 steps
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    console.log('🚀 Starting 15-step route optimization process');
    
    const requestData = await req.json();
    console.log('📥 Received request data:', JSON.stringify(requestData, null, 2));
    
    const { trip_id, member_id, user_places, constraints, transport_mode } = requestData;
    
    // Enhanced input validation
    if (!trip_id || typeof trip_id !== 'string') {
      throw new Error('Missing or invalid trip_id parameter');
    }
    
    if (!member_id || typeof member_id !== 'string') {
      throw new Error('Missing or invalid member_id parameter');
    }
    
    console.log(`🔍 Processing optimization for trip: ${trip_id}, member: ${member_id}`);
    
    // Log user_places data structure for debugging
    if (user_places) {
      console.log('📊 user_places data type:', typeof user_places);
      console.log('📊 user_places is array:', Array.isArray(user_places));
      console.log('📊 user_places length:', user_places?.length);
      if (user_places && user_places.length > 0) {
        console.log('📍 First user_place sample:', JSON.stringify(user_places[0], null, 2));
      }
    }
    
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const optimizationConstraints: OptimizationConstraints = {
      time_constraint_minutes: constraints?.time_constraint_minutes || 1440,
      distance_constraint_km: constraints?.distance_constraint_km || 1000,
      budget_constraint_yen: constraints?.budget_constraint_yen || 100000,
      max_places: constraints?.max_places || 20
    };
    
    // Execute 15-step optimization process
    
    // Steps 1-2: Retrieve trip data - prefer user_places if provided
    let allPlaces = user_places;
    
    // If user_places not provided or empty, retrieve from database
    if (!allPlaces || !Array.isArray(allPlaces) || allPlaces.length === 0) {
      console.log('📥 No user_places provided, retrieving from database');
      const tripData = await retrieveTripData(supabase, trip_id, member_id);
      allPlaces = tripData.places;
    } else {
      console.log(`📥 Using provided user_places: ${allPlaces.length} places`);
      console.log('📊 Breakdown of provided places:');
      allPlaces.forEach((place, index) => {
        console.log(`  ${index + 1}. ${place.name} - Type: ${place.place_type || 'undefined'} - Source: ${place.source || 'undefined'}`);
      });
    }
    
    // Separate system places from user places BEFORE normalization
    const systemPlaces = (allPlaces || []).filter(p => 
      p.place_type === 'departure' || p.place_type === 'destination' || p.source === 'system'
    );
    const userPlaces = (allPlaces || []).filter(p => 
      p.place_type !== 'departure' && p.place_type !== 'destination' && p.source !== 'system'
    );
    
    console.log(`🔍 Separated places - System: ${systemPlaces.length}, User: ${userPlaces.length}`);
    console.log('📊 System places:', systemPlaces.map(p => ({ name: p.name, type: p.place_type })));
    console.log('📊 User places:', userPlaces.map(p => ({ name: p.name, category: p.category })));

    // Step 3: Normalize preferences for USER places only (system places are fixed)
    console.log('📊 Processing USER places for normalization (excluding system places):', JSON.stringify(userPlaces, null, 2));
    const normalizedUsers = await normalizePreferences(userPlaces);
    
    // Step 4: Filter USER places for fairness (system places always included)
    const selectedVisitPlaces = await filterPlacesForFairness(normalizedUsers, optimizationConstraints);
    
    // Step 5: Combine system places (always included) with selected user places
    const allSelectedPlaces = [...systemPlaces, ...selectedVisitPlaces];
    console.log(`🔗 Combined places: ${allSelectedPlaces.length} total (${systemPlaces.length} system + ${selectedVisitPlaces.length} user)`);
    console.log(`🔗 Combined place names: ${allSelectedPlaces.map(p => p.name)}`);
    const { departure, destination, visitPlaces } = await fixDepartureDestination(allSelectedPlaces);
    
    console.log(`📋 After fixDepartureDestination:`);
    console.log(`  - Departure: ${departure ? departure.name : 'None'}`);
    console.log(`  - Destination: ${destination ? destination.name : 'None'}`);
    console.log(`  - Visit places: ${visitPlaces.length} (${visitPlaces.map(p => p.name).join(', ')})`);
    console.log(`  - Total places being processed: ${[departure, ...visitPlaces, destination].filter(Boolean).length}`);
    
    // Step 6: Determine transport modes
    const placesWithTransport = await determineTransportModes([
      ...(departure ? [departure] : []),
      ...visitPlaces,
      ...(destination ? [destination] : [])
    ]);
    
    // Step 7: Insert airports
    const placesWithAirports = await insertAirports(supabase, placesWithTransport);
    
    // Step 8: TSP optimization
    console.log(`🔄 Input to TSP: ${placesWithAirports.length} places`);
    const optimizedRoute = await optimizeRouteWithTSP(placesWithAirports);
    console.log(`✅ TSP output: ${optimizedRoute.length} places`);
    
    // Step 9: Calculate realistic travel times
    const routeWithTravelTimes = await calculateRealisticTravelTimes(optimizedRoute);
    console.log(`✅ Route with travel times: ${routeWithTravelTimes.length} places`);
    
    // Step 10: Split by days
    const dailySchedules = await splitScheduleByDays(routeWithTravelTimes, optimizationConstraints.time_constraint_minutes);
    console.log(`📅 After splitScheduleByDays: ${dailySchedules.length} days`);
    dailySchedules.forEach((day, index) => {
      console.log(`  Day ${index + 1}: ${day.places.length} places (${day.places.map(p => p.name).join(', ')})`);
    });
    
    // Step 11: Insert meal times
    const schedulesWithMeals = await insertMealTimes(dailySchedules);
    
    // Step 12: Adjust business hours
    const schedulesWithBusinessHours = await adjustForBusinessHours(schedulesWithMeals);
    
    // Step 13: Build detailed schedule
    const detailedSchedules = await buildDetailedSchedule(schedulesWithBusinessHours);
    
    // Step 15: Calculate optimization score
    const optimizationScore = calculateOptimizationScore(
      normalizedUsers,
      allSelectedPlaces,
      detailedSchedules,
      optimizationConstraints
    );
    
    const executionTime = Date.now() - startTime;
    
    // Step 14: Store results
    await storeOptimizationResults(
      supabase,
      trip_id,
      member_id,
      detailedSchedules,
      optimizationScore,
      executionTime
    );
    
    console.log(`🎉 15-step optimization completed successfully in ${executionTime}ms`);
    
    // Return comprehensive result
    const result: OptimizationResult = {
      success: true,
      optimization: {
        daily_schedules: detailedSchedules,
        optimization_score: optimizationScore,
        optimized_route: { daily_schedules: detailedSchedules },
        total_duration_minutes: detailedSchedules.reduce((sum, day) => 
          sum + day.total_travel_time + day.total_visit_time, 0),
        places: routeWithTravelTimes,
        execution_time_ms: executionTime
      },
      message: `Route optimized successfully using 15-step algorithm. Processed ${normalizedUsers.length} users, selected ${allSelectedPlaces.length} places (${systemPlaces.length} system + ${selectedVisitPlaces.length} user), organized into ${detailedSchedules.length} days with ${optimizationScore.total_score}% optimization score.`
    };
    
    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('❌ Optimization failed:', error);
    console.error('Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});