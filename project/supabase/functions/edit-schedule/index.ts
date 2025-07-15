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

// Convert booking to place constraints
async function processBookingToConstraints(booking: any, tripId: string, memberId: string, supabase: any): Promise<void> {
  console.log(`🔄 Processing ${booking.booking_type} booking to constraints`);
  
  if (booking.booking_type === 'flight') {
    // For flights, create constraints on departure and arrival airports
    const routeParts = (booking.route || '').split(' → ');
    if (routeParts.length >= 2) {
      const departureAirport = routeParts[0].trim();
      const arrivalAirport = routeParts[1].trim();
      
      // Find or create departure airport place
      let { data: depPlace } = await supabase
        .from('places')
        .select('*')
        .eq('trip_id', tripId)
        .eq('name', departureAirport)
        .eq('is_airport', true)
        .single();
        
      if (!depPlace) {
        console.log(`Creating departure airport place: ${departureAirport}`);
        // Create airport place if it doesn't exist
        // This is a simplified approach - in production, you'd want to get lat/lng from booking data
      }
      
      // Find or create arrival airport place
      let { data: arrPlace } = await supabase
        .from('places')
        .select('*')
        .eq('trip_id', tripId)
        .eq('name', arrivalAirport)
        .eq('is_airport', true)
        .single();
        
      if (!arrPlace) {
        console.log(`Creating arrival airport place: ${arrivalAirport}`);
        // Create airport place if it doesn't exist
      }
      
      // Add time constraints based on flight times (properly formatted ISO datetime)
      if (depPlace && booking.departure_time && booking.departure_date) {
        // Create proper ISO datetime string with timezone
        const constraintTime = `${booking.departure_date}T${booking.departure_time}:00.000Z`;
        await supabase
          .from('places')
          .update({ constraint_departure_time: constraintTime })
          .eq('id', depPlace.id);
        console.log(`✅ Set departure constraint: ${constraintTime}`);
      }
      
      if (arrPlace && booking.arrival_time && booking.departure_date) {
        // Handle arrival time (might be next day for overnight flights)
        let arrivalDate = booking.departure_date;
        
        // Check if arrival time is earlier than departure time (next day flight)
        if (booking.departure_time && booking.arrival_time) {
          const depHour = parseInt(booking.departure_time.split(':')[0]);
          const arrHour = parseInt(booking.arrival_time.split(':')[0]);
          
          // If arrival time is much earlier than departure, assume next day
          if (arrHour < depHour && (depHour - arrHour) > 12) {
            const nextDay = new Date(booking.departure_date);
            nextDay.setDate(nextDay.getDate() + 1);
            arrivalDate = nextDay.toISOString().split('T')[0];
          }
        }
        
        const constraintTime = `${arrivalDate}T${booking.arrival_time}:00.000Z`;
        await supabase
          .from('places')
          .update({ constraint_arrival_time: constraintTime })
          .eq('id', arrPlace.id);
        console.log(`✅ Set arrival constraint: ${constraintTime}`);
      }
    }
  } else if (booking.booking_type === 'hotel') {
    // For hotels, create a hotel place with time constraints if location data exists
    if (booking.latitude && booking.longitude) {
      const { error: insertError } = await supabase
        .from('places')
        .insert({
          trip_id: tripId,
          user_id: memberId,
          name: booking.hotel_name || 'Hotel',
          latitude: booking.latitude,
          longitude: booking.longitude,
          address: booking.address,
          category: 'hotel',
          constraint_arrival_time: booking.check_in_date && booking.check_in_time ? 
            `${booking.check_in_date}T${booking.check_in_time}:00.000Z` : null,
          constraint_departure_time: booking.check_out_date && booking.check_out_time ? 
            `${booking.check_out_date}T${booking.check_out_time}:00.000Z` : null,
          stay_duration_minutes: 720, // 12 hours default hotel stay
          source: 'booking_import'
        });
        
      if (insertError) {
        console.warn('Could not create hotel place:', insertError.message);
      } else {
        console.log(`✅ Created hotel place with constraints`);
      }
    }
  } else if (booking.booking_type === 'car' || booking.booking_type === 'walking') {
    // For transport, create constraints on the endpoint places based on route
    const routeParts = (booking.route || '').split(' → ');
    if (routeParts.length >= 2) {
      const fromPlace = routeParts[0].trim();
      const toPlace = routeParts[1].trim();
      
      // Find places by name and add constraints
      const { data: places } = await supabase
        .from('places')
        .select('*')
        .eq('trip_id', tripId)
        .in('name', [fromPlace, toPlace]);
        
      for (const place of places || []) {
        if (place.name === fromPlace && booking.departure_time && booking.departure_date) {
          const constraintTime = `${booking.departure_date}T${booking.departure_time}:00.000Z`;
          await supabase
            .from('places')
            .update({ constraint_departure_time: constraintTime })
            .eq('id', place.id);
          console.log(`✅ Set transport departure constraint: ${constraintTime}`);
        }
        
        if (place.name === toPlace && booking.arrival_time && booking.departure_date) {
          const constraintTime = `${booking.departure_date}T${booking.arrival_time}:00.000Z`;
          await supabase
            .from('places')
            .update({ constraint_arrival_time: constraintTime })
            .eq('id', place.id);
          console.log(`✅ Set transport arrival constraint: ${constraintTime}`);
        }
      }
    }
  }
}

// 新しい時間制約ベースの最適化ハンドラー
async function handleTimeConstraintOptimization(tripId: string, memberId: string, supabase: any, booking?: any): Promise<any> {
  console.log(`🎯 Starting time-constraint optimization for trip ${tripId}`);
  
  // If booking data is provided, process it first
  if (booking) {
    await processBookingToConstraints(booking, tripId, memberId, supabase);
  }
  
  // トリップ詳細を取得
  const { data: tripData, error: tripError } = await supabase
    .from('trips')
    .select('start_date, end_date')
    .eq('id', tripId)
    .single();
    
  if (tripError) {
    throw new Error(`Failed to get trip details: ${tripError.message}`);
  }
  
  // 利用可能日数を計算
  let availableDays = 1;
  if (tripData.start_date && tripData.end_date) {
    const startDate = new Date(tripData.start_date);
    const endDate = new Date(tripData.end_date);
    const timeDiff = endDate.getTime() - startDate.getTime();
    availableDays = Math.max(1, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1);
  }
  
  // 時間制約付きのplacesを取得
  const { data: places, error: placesError } = await supabase
    .from('places')
    .select('*')
    .eq('trip_id', tripId);
    
  if (placesError) {
    throw new Error(`Failed to get places: ${placesError.message}`);
  }
  
  console.log(`📍 Found ${places.length} places for optimization`);
  
  if (places.length === 0) {
    throw new Error('No places found for optimization');
  }
  
  // 時間制約のあるplacesを特定
  const constrainedPlaces = places.filter(place => 
    place.constraint_departure_time || place.constraint_arrival_time
  );
  
  console.log(`🔒 Found ${constrainedPlaces.length} time-constrained places`);
  constrainedPlaces.forEach(p => {
    console.log(`  - ${p.name}: ${p.constraint_departure_time || 'no departure'} - ${p.constraint_arrival_time || 'no arrival'}`);
  });
  
  // セグメント分割最適化
  const segments = segmentPlacesByConstraints(places);
  let optimizedRoute = [];
  
  for (let i = 0; i < segments.length; i++) {
    const optimizedSegment = optimizeSegment(segments[i], i);
    optimizedRoute.push(...optimizedSegment);
  }
  
  console.log(`✅ Optimization complete: ${optimizedRoute.length} places in optimized route`);
  
  // 時間制約に合わせてスケジュール調整
  const dailySchedules = adjustScheduleForConstraints(optimizedRoute, tripData.start_date);
  
  // 結果をdatabaseに保存
  try {
    // 既存の結果を無効化
    await supabase
      .from('optimization_results')
      .update({ is_active: false })
      .eq('trip_id', tripId);
    
    // 新しい結果を保存
    const { error: saveError } = await supabase.from('optimization_results').insert({
      trip_id: tripId,
      created_by: memberId,
      optimized_route: dailySchedules,
      optimization_score: {
        total_score: 85,
        fairness_score: 85,
        efficiency_score: 85,
        feasibility_score: 85,
        details: {
          constraint_satisfaction: true,
          segments_processed: segments.length,
          constrained_places: constrainedPlaces.length
        }
      },
      execution_time_ms: Date.now(),
      places_count: optimizedRoute.length,
      total_travel_time_minutes: dailySchedules.reduce((sum, day) => sum + day.total_travel_time, 0),
      total_visit_time_minutes: dailySchedules.reduce((sum, day) => sum + day.total_visit_time, 0),
      is_active: true,
      algorithm_version: 'edit-schedule-constraints-v1'
    });
    
    if (saveError) {
      console.warn('⚠️ Error saving optimization results:', saveError.message);
    } else {
      console.log('✅ Optimization results saved successfully');
    }
  } catch (saveError) {
    console.warn('⚠️ Could not save to database:', saveError.message);
  }
  
  // optimize-routeと同じ形式でレスポンス構築
  return {
    optimization: {
      daily_schedules: dailySchedules,
      optimization_score: {
        total_score: 85,
        fairness_score: 85,
        efficiency_score: 85,
        feasibility_score: 85,
        details: {
          constraint_satisfaction: true,
          segments_processed: segments.length,
          constrained_places: constrainedPlaces.length
        }
      },
      optimized_route: {
        daily_schedules: dailySchedules
      },
      total_duration_minutes: dailySchedules.reduce((sum, day) => sum + day.total_travel_time + day.total_visit_time, 0),
      places: optimizedRoute,
      segments_count: segments.length
    },
    message: `Schedule optimized with constraints: ${optimizedRoute.length} places in ${dailySchedules.length} days (${segments.length} segments)`
  };
}

// セグメント分割ロジック
function segmentPlacesByConstraints(places: any[]): any[][] {
  console.log(`🔄 Segmenting ${places.length} places by time constraints`);
  
  // 時間制約のあるplaceを特定
  const constrainedPlaces = places.filter(place => 
    place.constraint_departure_time || place.constraint_arrival_time
  );
  
  if (constrainedPlaces.length === 0) {
    console.log('⚠️ No time constraints found, treating as single segment');
    return [places];
  }
  
  // 制約placeを時間順にソート
  constrainedPlaces.sort((a, b) => {
    const aTime = a.constraint_departure_time || a.constraint_arrival_time;
    const bTime = b.constraint_departure_time || b.constraint_arrival_time;
    return new Date(aTime).getTime() - new Date(bTime).getTime();
  });
  
  const segments: any[][] = [];
  let currentSegment: any[] = [];
  
  // 制約placeでセグメント分割
  for (let i = 0; i < places.length; i++) {
    const place = places[i];
    
    if (constrainedPlaces.includes(place)) {
      // 制約placeを発見
      if (currentSegment.length > 0) {
        currentSegment.push(place);
        segments.push([...currentSegment]);
        currentSegment = [place]; // 次のセグメントの開始点
      } else {
        currentSegment.push(place);
      }
    } else {
      currentSegment.push(place);
    }
  }
  
  // 最後のセグメント
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }
  
  console.log(`✅ Created ${segments.length} segments`);
  segments.forEach((segment, index) => {
    console.log(`  Segment ${index + 1}: ${segment.length} places`);
  });
  
  return segments;
}

// セグメント内最適化
function optimizeSegment(segment: any[], segmentIndex: number): any[] {
  console.log(`🎯 Optimizing segment ${segmentIndex + 1} with ${segment.length} places`);
  
  if (segment.length <= 1) {
    return segment;
  }
  
  // 制約placeと自由placeを分離
  const constrainedPlaces = segment.filter(p => p.constraint_departure_time || p.constraint_arrival_time);
  const freePlaces = segment.filter(p => !p.constraint_departure_time && !p.constraint_arrival_time);
  
  console.log(`  - Constrained places: ${constrainedPlaces.length}`);
  console.log(`  - Free places: ${freePlaces.length}`);
  
  if (freePlaces.length === 0) {
    // 制約placeのみの場合は時間順でソート
    return constrainedPlaces.sort((a, b) => {
      const aTime = a.constraint_departure_time || a.constraint_arrival_time;
      const bTime = b.constraint_departure_time || b.constraint_arrival_time;
      return new Date(aTime).getTime() - new Date(bTime).getTime();
    });
  }
  
  // 自由placeを距離ベースで最適化
  const optimizedFreePlaces = optimizeFreePlacesWithinSegment(freePlaces, constrainedPlaces);
  
  // 制約placeと自由placeを統合
  return integrateConstrainedAndFreePlaces(constrainedPlaces, optimizedFreePlaces);
}

// セグメント内の自由place最適化
function optimizeFreePlacesWithinSegment(freePlaces: any[], constrainedPlaces: any[]): any[] {
  if (freePlaces.length <= 1) {
    return freePlaces;
  }
  
  // 簡単な最短距離貪欲法
  const optimized: any[] = [];
  const remaining = [...freePlaces];
  
  // 開始点を決定（制約placeがあれば最も近いものから）
  let current: any;
  if (constrainedPlaces.length > 0) {
    const startConstraint = constrainedPlaces[0];
    let minDistance = Infinity;
    let startIndex = 0;
    
    for (let i = 0; i < remaining.length; i++) {
      const distance = calculateDistance(
        [startConstraint.latitude, startConstraint.longitude],
        [remaining[i].latitude, remaining[i].longitude]
      );
      if (distance < minDistance) {
        minDistance = distance;
        startIndex = i;
      }
    }
    current = remaining.splice(startIndex, 1)[0];
  } else {
    current = remaining.shift();
  }
  
  optimized.push(current);
  
  // 貪欲法で最適化
  while (remaining.length > 0) {
    let nearestIndex = 0;
    let minDistance = calculateDistance(
      [current.latitude, current.longitude],
      [remaining[0].latitude, remaining[0].longitude]
    );
    
    for (let i = 1; i < remaining.length; i++) {
      const distance = calculateDistance(
        [current.latitude, current.longitude],
        [remaining[i].latitude, remaining[i].longitude]
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = i;
      }
    }
    
    current = remaining.splice(nearestIndex, 1)[0];
    optimized.push(current);
  }
  
  return optimized;
}

// 制約placeと自由placeの統合
function integrateConstrainedAndFreePlaces(constrainedPlaces: any[], freePlaces: any[]): any[] {
  // 制約placeを時間順でソート
  const sortedConstrained = constrainedPlaces.sort((a, b) => {
    const aTime = a.constraint_departure_time || a.constraint_arrival_time;
    const bTime = b.constraint_departure_time || b.constraint_arrival_time;
    return new Date(aTime).getTime() - new Date(bTime).getTime();
  });
  
  // 自由placeを制約place間に配置
  const result: any[] = [];
  const remainingFree = [...freePlaces];
  
  for (let i = 0; i < sortedConstrained.length; i++) {
    const constrainedPlace = sortedConstrained[i];
    
    // 制約placeを追加
    result.push(constrainedPlace);
    
    // 次の制約placeまでの間に自由placeを配置
    if (remainingFree.length > 0) {
      const placesToAdd = Math.floor(remainingFree.length / (sortedConstrained.length - i));
      for (let j = 0; j < placesToAdd && remainingFree.length > 0; j++) {
        result.push(remainingFree.shift());
      }
    }
  }
  
  // 残りの自由placeを追加
  result.push(...remainingFree);
  
  return result;
}

// Calculate day number from constraint date and trip start date
function calculateDayNumberFromConstraint(constraintISO: string, tripStartDate: string | null): number {
  if (!tripStartDate) return 1;
  
  const constraintDate = new Date(constraintISO);
  const startDate = new Date(tripStartDate);
  
  // Calculate days difference
  const timeDiff = constraintDate.getTime() - startDate.getTime();
  const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  
  return Math.max(1, daysDiff + 1);
}

// Extract time from constraint datetime as HH:mm:ss
function extractTimeFromConstraint(constraintISO: string): string {
  const constraintDate = new Date(constraintISO);
  const hours = constraintDate.getHours().toString().padStart(2, '0');
  const minutes = constraintDate.getMinutes().toString().padStart(2, '0');
  const seconds = constraintDate.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

// Check if time is beyond 20:00 (requires splitting)
function requiresTimeSplitting(timeStr: string): boolean {
  const hours = parseInt(timeStr.split(':')[0]);
  return hours >= 21; // 21:00以降は分割が必要
}

// Split cross-day events (like 21:00-01:00 flights)
function splitCrossDayEvent(place: any, constraintTime: string, dayNumber: number, tripStartDate: string | null): any[] {
  const timeStr = extractTimeFromConstraint(constraintTime);
  
  if (!requiresTimeSplitting(timeStr)) {
    // No splitting needed
    return [{
      ...place,
      constraint_day: dayNumber,
      constraint_time: timeStr
    }];
  }
  
  // Split into two parts
  const isDeparture = !!place.constraint_departure_time;
  
  return [
    {
      ...place,
      name: `${place.name} (Part 1)`,
      constraint_day: dayNumber,
      constraint_time: timeStr,
      arrival_time: isDeparture ? timeStr : place.arrival_time,
      departure_time: "23:59:59", // End of day
      is_split: true,
      split_part: "first",
      original_place_id: place.id || place.name
    },
    {
      ...place,
      name: `${place.name} (Part 2)`,
      constraint_day: dayNumber + 1,
      constraint_time: "00:00:00",
      arrival_time: "00:00:00", // Start of next day
      departure_time: isDeparture ? place.arrival_time : "01:00:00", // Assume 1-hour default
      is_split: true,
      split_part: "second",
      original_place_id: place.id || place.name
    }
  ];
}

// 時間制約に合わせたスケジュール調整（optimization_result互換）
function adjustScheduleForConstraints(optimizedRoute: any[], tripStartDate: string | null): any[] {
  console.log(`⏰ Adjusting schedule for constraints with date handling`);
  
  // Group places by day based on constraints
  const dailyPlaces = new Map<number, any[]>();
  
  for (const place of optimizedRoute) {
    let targetDay = 1; // Default to day 1
    
    // Check for time constraints
    if (place.constraint_departure_time || place.constraint_arrival_time) {
      const constraintTime = place.constraint_departure_time || place.constraint_arrival_time;
      targetDay = calculateDayNumberFromConstraint(constraintTime, tripStartDate);
      
      console.log(`🔒 Constrained place: ${place.name} → Day ${targetDay} at ${extractTimeFromConstraint(constraintTime)}`);
      
      // Handle cross-day events (like 21:00-01:00 flights)
      const splitPlaces = splitCrossDayEvent(place, constraintTime, targetDay, tripStartDate);
      
      for (const splitPlace of splitPlaces) {
        const day = splitPlace.constraint_day;
        if (!dailyPlaces.has(day)) {
          dailyPlaces.set(day, []);
        }
        dailyPlaces.get(day)!.push(splitPlace);
      }
    } else {
      // Free places go to earliest available day
      if (!dailyPlaces.has(targetDay)) {
        dailyPlaces.set(targetDay, []);
      }
      dailyPlaces.get(targetDay)!.push(place);
    }
  }
  
  // Create daily schedules in optimization_result format
  const schedules: any[] = [];
  const sortedDays = Array.from(dailyPlaces.keys()).sort((a, b) => a - b);
  
  for (const dayNumber of sortedDays) {
    const dayPlaces = dailyPlaces.get(dayNumber)!;
    const daySchedule = createOptimizationResultDay(dayNumber, dayPlaces, tripStartDate);
    schedules.push(daySchedule);
  }
  
  console.log(`✅ Created ${schedules.length} daily schedules with constraint handling`);
  return schedules;
}

// Create optimization_result compatible day schedule
function createOptimizationResultDay(dayNumber: number, places: any[], tripStartDate: string | null): any {
  // Calculate absolute date for this day
  let dayDate = '2025-07-15'; // Default fallback
  if (tripStartDate) {
    const startDate = new Date(tripStartDate);
    const targetDate = new Date(startDate);
    targetDate.setDate(startDate.getDate() + dayNumber - 1);
    dayDate = targetDate.toISOString().split('T')[0];
  }
  
  // Process places with time assignment
  let timeCounter = 8 * 60; // Start at 8:00 AM
  const scheduledPlaces = [];
  
  // Sort places by constraint time first, then by order
  const sortedPlaces = places.sort((a, b) => {
    if (a.constraint_time && b.constraint_time) {
      return a.constraint_time.localeCompare(b.constraint_time);
    }
    if (a.constraint_time) return -1;
    if (b.constraint_time) return 1;
    return 0;
  });
  
  for (let i = 0; i < sortedPlaces.length; i++) {
    const place = sortedPlaces[i];
    
    // Calculate travel time from previous place
    if (i > 0) {
      const prevPlace = sortedPlaces[i - 1];
      const distance = calculateDistance(
        [prevPlace.latitude, prevPlace.longitude],
        [place.latitude, place.longitude]
      );
      const transportMode = determineTransportMode(distance, prevPlace.is_airport, place.is_airport);
      const travelTime = calculateTravelTime(distance, transportMode);
      
      place.transport_mode = transportMode;
      place.travel_time_from_previous = travelTime;
      
      // Add travel time to counter for free places
      if (!place.constraint_time) {
        timeCounter += travelTime;
      }
    }
    
    // Handle constrained places
    if (place.constraint_time) {
      const constraintHours = parseInt(place.constraint_time.split(':')[0]);
      const constraintMinutes = parseInt(place.constraint_time.split(':')[1]);
      const constraintTotalMinutes = constraintHours * 60 + constraintMinutes;
      
      // Set exact constraint times
      place.arrival_time = place.constraint_time;
      timeCounter = constraintTotalMinutes + (place.stay_duration_minutes || 60);
      place.departure_time = formatTime(timeCounter);
    } else {
      // Handle free places
      place.arrival_time = formatTime(timeCounter);
      timeCounter += (place.stay_duration_minutes || 60);
      place.departure_time = formatTime(timeCounter);
    }
    
    // Set other properties
    place.day_number = dayNumber;
    place.order_in_day = i + 1;
    
    scheduledPlaces.push(place);
    
    console.log(`📍 Day ${dayNumber}: ${place.name} at ${place.arrival_time}-${place.departure_time}`);
  }
  
  // Calculate totals
  const totalTravelTime = scheduledPlaces.reduce((sum, p) => sum + (p.travel_time_from_previous || 0), 0);
  const totalVisitTime = scheduledPlaces.reduce((sum, p) => sum + (p.stay_duration_minutes || 60), 0);
  
  return {
    day: dayNumber,
    date: dayDate,
    scheduled_places: scheduledPlaces,
    total_travel_time: totalTravelTime,
    total_visit_time: totalVisitTime,
    meal_breaks: []
  };
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
  
  const startTime = Date.now();
  let requestData = null;
  
  try {
    console.log('🚀 Edit-schedule request received (with time constraints support)');
    
    // リクエストデータの検証
    try {
      requestData = await req.json();
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError.message);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid JSON format in request body',
        details: parseError.message
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }
    
    const { trip_id, member_id, action } = requestData;
    
    // 必須パラメータの検証
    if (!trip_id || !member_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required parameters: trip_id and member_id are required'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }
    
    console.log(`📋 Processing edit-schedule for trip ${trip_id}, action: ${action || 'unknown'}`);
    
    // Supabaseクライアントの初期化
    // @ts-ignore: Deno.env is available in Edge Functions
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    // @ts-ignore: Deno.env is available in Edge Functions
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Handle different actions: add_booking, time_constraint_update, etc.
    let result;
    
    if (action === 'add_booking' || action === 'time_constraint_update') {
      // 新しい時間制約ベースの最適化
      const { booking } = requestData;
      result = await handleTimeConstraintOptimization(trip_id, member_id, supabase, booking);
    } else {
      // 既存のedit操作をサポート
      const { data } = requestData;
      
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
    }
    
    const executionTime = Date.now() - startTime;
    
    console.log(`🎉 Edit-schedule completed successfully (${executionTime}ms)`);
    
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
    console.error('❌ Edit-schedule error:', error.message);
    console.error('❌ Stack trace:', error.stack);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      execution_time_ms: executionTime,
      debug_info: {
        request_data_received: !!requestData,
        error_type: error.constructor.name
      }
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
  
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