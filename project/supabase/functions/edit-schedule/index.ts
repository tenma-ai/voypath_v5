import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// 型定義
interface Place {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  trip_id: string;
  user_id: string;
  category: string;
  place_type: string;
  source: string;
  wish_level: number;
  stay_duration_minutes: number;
  preferred_time_of_day?: string;
  constraint_arrival_time?: string;
  constraint_departure_time?: string;
  is_multi_day_booking?: boolean;
  cumulative_arrival_time?: number;
  cumulative_departure_time?: number;
  constraint_type?: string;
  original_constraint_times?: {
    check_in?: string;
    check_out?: string;
  };
  original_departure_time?: string;
  original_arrival_time?: string;
  notes?: string;
  address?: string;
  google_place_id?: string;
  display_color_hex?: string;
  transport_mode?: string;
  travel_time_from_previous?: number;
  arrival_time?: string;
  departure_time?: string;
  order_in_day?: number;
  day_number?: number;
  normalized_wish_level?: number;
  is_airport?: boolean;
  airport_code?: string;
  created_at: string;
  is_virtual_split?: boolean;
  original_place_id?: string;
  split_day_index?: number;
  split_total_days?: number;
  merged_from_splits?: any[];
}

interface OptimizationScore {
  total_score: number;
  fairness_score: number;
  efficiency_score: number;
  feasibility_score: number;
  validation_issues: string[];
  details: {
    is_feasible: boolean;
    travel_efficiency: number;
    user_adoption_balance: number;
    wish_satisfaction_balance: number;
    time_constraint_compliance: number;
    constraint_satisfaction: boolean;
    constrained_places: number;
    segments_processed: number;
  };
}

interface DailySchedule {
  day: number;
  date: string;
  scheduled_places: Place[];
  total_travel_time: number;
  total_visit_time: number;
  meal_breaks: any[];
}

// 距離計算（ハバーサイン公式）- optimize-routeと同一
function calculateDistance(point1: [number, number], point2: [number, number]): number {
  const R = 6371;
  const [lat1, lon1] = point1;
  const [lat2, lon2] = point2;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 移動手段の判定 - optimize-routeと同一
function determineTransportMode(distance: number, fromAirport = false, toAirport = false): string {
  if (distance <= 2) {
    return 'walking';
  }
  if (distance <= 500) {
    return 'car';
  }
  return 'flight';
}

// 移動時間の計算 - optimize-routeと同一
function calculateTravelTime(distance: number, mode: string): number {
  if (mode === 'flight') {
    const flightHours = distance / 700;
    const flightMinutes = Math.round(flightHours * 60);
    let airportTime = 60;
    if (distance > 3000) {
      airportTime = 90;
    }
    return flightMinutes + airportTime;
  }
  
  const speeds: Record<string, number> = {
    walking: 5,
    car: 60,
    flight: 700
  };
  
  const baseTime = distance / speeds[mode] * 60;
  const overhead: Record<string, number> = {
    walking: 5,
    car: 10,
    flight: 0
  };
  
  return Math.round(baseTime + overhead[mode]);
}

// 時刻フォーマット - optimize-routeと同一
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

// 🔥 日跨ぎplace動的分割処理（edit-schedule内）
function splitMultiDayConstraints(places: Place[], tripStartDate: string): Place[] {
  const splitPlaces: Place[] = [];
  
  for (const place of places) {
    // 日跨ぎホテル専用の分割（is_multi_day_booking=trueの場合のみ）
    if (place.is_multi_day_booking && place.constraint_arrival_time && place.constraint_departure_time) {
      const checkIn = new Date(place.constraint_arrival_time);
      const checkOut = new Date(place.constraint_departure_time);
      
      let currentDate = new Date(checkIn);
      let dayIndex = 0;
      
      while (currentDate < checkOut) {
        const nextDay = new Date(currentDate);
        nextDay.setDate(nextDay.getDate() + 1);
        nextDay.setHours(0, 0, 0, 0);
        
        const dayStart = dayIndex === 0 ? checkIn : 
                        new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0);
        const dayEnd = nextDay > checkOut ? checkOut : 
                      new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 23, 59, 59);
        
        // 各日のセグメント作成（仮想place）
        splitPlaces.push({
          ...place,
          id: `${place.id}_day${dayIndex + 1}`,
          original_place_id: place.id,
          constraint_arrival_time: dayStart.toISOString(),
          constraint_departure_time: dayEnd.toISOString(),
          stay_duration_minutes: Math.floor((dayEnd.getTime() - dayStart.getTime()) / (1000 * 60)),
          is_virtual_split: true,
          split_day_index: dayIndex + 1,
          split_total_days: Math.ceil((checkOut.getTime() - checkIn.getTime()) / (24 * 60 * 60 * 1000))
        });
        
        currentDate = nextDay;
        dayIndex++;
      }
    } else {
      // 通常place（単一時間制約含む）→ そのまま追加
      splitPlaces.push(place);
    }
  }
  
  return splitPlaces;
}

// 制約時間のoptimize-route互換変換
function convertConstraintsToCumulativeTime(splitPlaces: Place[], tripStartDate: string): Place[] {
  const tripStart = new Date(`${tripStartDate}T08:00:00.000Z`);
  
  return splitPlaces.map(constraint => {
    let cumulativeTime = 0;
    let constraintType = null;
    
    // 日跨ぎ分割されたホテル制約: 各日別に処理
    if (constraint.is_virtual_split && constraint.constraint_arrival_time && constraint.constraint_departure_time) {
      const segmentStart = new Date(constraint.constraint_arrival_time);
      const segmentEnd = new Date(constraint.constraint_departure_time);
      const segmentDuration = Math.floor((segmentEnd.getTime() - segmentStart.getTime()) / (1000 * 60));
      
      cumulativeTime = Math.floor((segmentStart.getTime() - tripStart.getTime()) / (1000 * 60));
      constraintType = `HOTEL_SEGMENT_DAY${constraint.split_day_index}`;
      
      return {
        ...constraint,
        cumulative_arrival_time: cumulativeTime,
        stay_duration_minutes: segmentDuration,
        constraint_type: constraintType,
        original_place_id: constraint.original_place_id
      };
    }
    
    // 通常ホテル制約: チェックイン時刻のみ使用、滞在時間で調整
    else if (constraint.constraint_arrival_time && constraint.constraint_departure_time) {
      const checkInTime = new Date(constraint.constraint_arrival_time);
      const checkOutTime = new Date(constraint.constraint_departure_time);
      const hotelDuration = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));
      
      cumulativeTime = Math.floor((checkInTime.getTime() - tripStart.getTime()) / (1000 * 60));
      constraintType = 'HOTEL_CHECKIN';
      
      return {
        ...constraint,
        cumulative_arrival_time: cumulativeTime,
        stay_duration_minutes: hotelDuration,
        constraint_type: constraintType,
        original_constraint_times: {
          check_in: constraint.constraint_arrival_time,
          check_out: constraint.constraint_departure_time
        }
      };
    }
    
    // 空港制約: departure/arrival別に処理
    else if (constraint.constraint_departure_time) {
      // 出発空港: 出発時刻 = arrival_time + stay_duration
      const departureTime = new Date(constraint.constraint_departure_time);
      const departureMinutes = Math.floor((departureTime.getTime() - tripStart.getTime()) / (1000 * 60));
      const airportStayDuration = constraint.stay_duration_minutes || 90;
      
      cumulativeTime = departureMinutes - airportStayDuration;
      constraintType = 'AIRPORT_DEPARTURE';
      
      return {
        ...constraint,
        cumulative_arrival_time: cumulativeTime,
        stay_duration_minutes: airportStayDuration,
        constraint_type: constraintType,
        original_departure_time: constraint.constraint_departure_time
      };
    }
    
    else if (constraint.constraint_arrival_time) {
      // 到着空港: 到着時刻 = arrival_time
      const arrivalTime = new Date(constraint.constraint_arrival_time);
      cumulativeTime = Math.floor((arrivalTime.getTime() - tripStart.getTime()) / (1000 * 60));
      constraintType = 'AIRPORT_ARRIVAL';
      
      return {
        ...constraint,
        cumulative_arrival_time: cumulativeTime,
        stay_duration_minutes: constraint.stay_duration_minutes || 90,
        constraint_type: constraintType,
        original_arrival_time: constraint.constraint_arrival_time
      };
    }
    
    return constraint;
  });
}

// セグメント分割ロジック（制約ベース）
function segmentPlacesByConstraints(places: Place[]): Place[][] {
  const segments: Place[][] = [];
  let currentSegment: Place[] = [];
  
  for (const place of places) {
    if (place.cumulative_arrival_time !== undefined || place.constraint_arrival_time || place.constraint_departure_time) {
      // 制約place前のセグメントを完結
      if (currentSegment.length > 0) {
        segments.push([...currentSegment]);
        currentSegment = [];
      }
      // 制約place単体でセグメント
      segments.push([place]);
    } else {
      currentSegment.push(place);
    }
  }
  
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }
  
  return segments;
}

// セグメント最適化（順序固定、時間調整のみ）
function optimizeSegmentWithFixedOrder(
  segmentPlaces: Place[],
  segmentStartCumulativeTime: number,
  segmentEndCumulativeTime: number,
  segmentStartPlace?: Place,
  segmentEndPlace?: Place
): Place[] {
  let timeCounter = segmentStartCumulativeTime;
  
  // セグメント内の全場所（固定点含む）
  const allPlaces = [
    ...(segmentStartPlace ? [segmentStartPlace] : []),
    ...segmentPlaces,
    ...(segmentEndPlace ? [segmentEndPlace] : [])
  ];
  
  // 1. 距離計算（順序固定）
  for (let i = 0; i < allPlaces.length - 1; i++) {
    if (allPlaces[i] && allPlaces[i + 1]) {
      const distance = calculateDistance(
        [allPlaces[i].latitude, allPlaces[i].longitude],
        [allPlaces[i + 1].latitude, allPlaces[i + 1].longitude]
      );
      
      // 2. 移動手段決定
      allPlaces[i + 1].transport_mode = determineTransportMode(distance, allPlaces[i].is_airport, allPlaces[i + 1].is_airport);
      
      // 3. 移動時間計算
      allPlaces[i + 1].travel_time_from_previous = calculateTravelTime(distance, allPlaces[i + 1].transport_mode);
    }
  }
  
  // 累積時間での時刻設定
  for (const place of allPlaces) {
    if (place.cumulative_arrival_time !== undefined) {
      // 制約付き場所: 固定arrival_timeを使用
      timeCounter = place.cumulative_arrival_time;
      place.arrival_time = formatTime(timeCounter % (24 * 60));
      
      // departure_time = arrival_time + stay_duration
      timeCounter += place.stay_duration_minutes;
      place.departure_time = formatTime(timeCounter % (24 * 60));
      place.cumulative_departure_time = timeCounter;
      
    } else {
      // 制約なし場所: 累積時間で計算
      timeCounter += (place.travel_time_from_previous || 0);
      place.cumulative_arrival_time = timeCounter;
      place.arrival_time = formatTime(timeCounter % (24 * 60));
      
      timeCounter += place.stay_duration_minutes;
      place.cumulative_departure_time = timeCounter;
      place.departure_time = formatTime(timeCounter % (24 * 60));
    }
  }
  
  return allPlaces;
}

// 累積時間から日別スケジュール変換
function convertCumulativeTimeToSchedules(
  optimizedPlaces: Place[],
  tripStartDate: string
): DailySchedule[] {
  const dailySchedules: DailySchedule[] = [];
  const dayGroupedPlaces = new Map<number, Place[]>();
  
  // 日別にplaceをグループ化（重複除去）
  for (const place of optimizedPlaces) {
    const cumulativeTime = place.cumulative_arrival_time || place.cumulative_departure_time || 0;
    
    // 日数計算: 24時間で割った商+1
    const dayNumber = Math.floor(cumulativeTime / (24 * 60)) + 1;
    
    // 時刻計算: 24時間で割った余り
    const timeOfDay = cumulativeTime % (24 * 60);
    const arrivalTimeOfDay = place.cumulative_arrival_time ? 
      place.cumulative_arrival_time % (24 * 60) : timeOfDay;
    const departureTimeOfDay = place.cumulative_departure_time ? 
      place.cumulative_departure_time % (24 * 60) : timeOfDay;
    
    // HH:MM:SS形式に変換
    place.arrival_time = formatTime(arrivalTimeOfDay);
    place.departure_time = formatTime(departureTimeOfDay);
    place.day_number = dayNumber;
    
    // 同じ日に同じIDのplaceがある場合は重複を避ける
    if (!dayGroupedPlaces.has(dayNumber)) {
      dayGroupedPlaces.set(dayNumber, []);
    }
    
    const dayPlaces = dayGroupedPlaces.get(dayNumber)!;
    const isDuplicate = dayPlaces.some(existingPlace => 
      existingPlace.id === place.id || 
      (place.original_place_id && existingPlace.original_place_id === place.original_place_id)
    );
    
    if (!isDuplicate) {
      place.order_in_day = dayPlaces.length + 1;
      dayPlaces.push(place);
    }
  }
  
  // 日別スケジュールを作成（連続した日番号で）
  const sortedDays = Array.from(dayGroupedPlaces.keys()).sort((a, b) => a - b);
  
  for (let i = 0; i < sortedDays.length; i++) {
    const originalDayNumber = sortedDays[i];
    const consecutiveDayNumber = i + 1; // 1から始まる連続した日番号
    const places = dayGroupedPlaces.get(originalDayNumber)!;
    
    // 日付文字列を計算（連続した日番号を使用）
    const placeDate = new Date(tripStartDate);
    placeDate.setDate(placeDate.getDate() + consecutiveDayNumber - 1);
    const dateString = placeDate.toISOString().split('T')[0];
    
    // 各placeの day_number を連続した番号に更新
    places.forEach(place => {
      place.day_number = consecutiveDayNumber;
    });
    
    dailySchedules.push(createDailyScheduleFromCumulative(
      consecutiveDayNumber,
      places,
      dateString
    ));
  }
  
  return dailySchedules;
}

// 累積時間制での日別スケジュール作成
function createDailyScheduleFromCumulative(
  dayNumber: number,
  places: Place[],
  dateString: string
): DailySchedule {
  const totalTravelTime = places.reduce((sum, place) => 
    sum + (place.travel_time_from_previous || 0), 0
  );
  
  const totalVisitTime = places.reduce((sum, place) => 
    sum + (place.stay_duration_minutes || 0), 0
  );
  
  return {
    day: dayNumber,
    date: dateString,
    scheduled_places: places,
    total_travel_time: totalTravelTime,
    total_visit_time: totalVisitTime,
    meal_breaks: []
  };
}

// 最適化スコア計算（edit-schedule用）
function calculateEditScheduleScore(optimizedPlaces: Place[], dailySchedules: DailySchedule[]): OptimizationScore {
  const totalPlaces = dailySchedules.reduce((sum, day) => sum + day.scheduled_places.length, 0);
  const constrainedPlaces = optimizedPlaces.filter(p => 
    p.constraint_arrival_time || p.constraint_departure_time
  ).length;
  
  // 制約満足度
  const constraintSatisfaction = optimizedPlaces.every(p => 
    !p.constraint_arrival_time && !p.constraint_departure_time || 
    (p.cumulative_arrival_time !== undefined || p.cumulative_departure_time !== undefined)
  );
  
  // 基本スコア計算
  const totalTravel = dailySchedules.reduce((sum, day) => sum + day.total_travel_time, 0);
  const totalVisit = dailySchedules.reduce((sum, day) => sum + day.total_visit_time, 0);
  
  const efficiency = totalVisit > 0 && totalTravel > 0 ? totalVisit / (totalVisit + totalTravel) : 0.5;
  const fairness = 1.0; // 簡略化
  const feasibility = constraintSatisfaction ? 1.0 : 0.8;
  
  const totalScore = (efficiency * 0.3 + fairness * 0.2 + feasibility * 0.5) * 100;
  
  return {
    total_score: Math.round(Math.max(0, Math.min(100, totalScore))),
    fairness_score: Math.round(fairness * 100),
    efficiency_score: Math.round(efficiency * 100),
    feasibility_score: Math.round(feasibility * 100),
    validation_issues: [],
    details: {
      is_feasible: constraintSatisfaction,
      travel_efficiency: efficiency,
      user_adoption_balance: fairness,
      wish_satisfaction_balance: fairness,
      time_constraint_compliance: feasibility,
      constraint_satisfaction: constraintSatisfaction,
      constrained_places: constrainedPlaces,
      segments_processed: 1
    }
  };
}

// メイン処理
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  const startTime = Date.now();
  let requestData = null;
  
  try {
    console.log('🚀 Edit-schedule request received');
    
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
    
    const { trip_id, member_id, action, user_places, constraints, transport_mode, trip_data } = requestData;
    
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
    
    console.log(`📋 Processing trip ${trip_id} for member ${member_id}, action: ${action || 'optimize_with_constraints'}`);
    
    // Supabaseクライアントの初期化
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 1. 最新の最適化結果を取得（順番情報の正確な情報源）
    console.log(`🔍 Fetching latest optimization result for trip ${trip_id}`);
    const { data: latestOptResult, error: optError } = await supabase
      .from('optimization_results')
      .select('optimized_route, optimization_score, created_at')
      .eq('trip_id', trip_id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (optError && optError.code !== 'PGRST116') {
      console.warn('⚠️ Could not fetch optimization result:', optError.message);
    }
    
    // 2. トリップ詳細
    console.log(`🔍 Fetching trip details for ${trip_id}`);
    const { data: tripDetails, error: tripError } = await supabase
      .from('trips')
      .select('start_date, end_date, name, description')
      .eq('id', trip_id)
      .single();
      
    if (tripError) {
      console.error('❌ Trip fetch error:', tripError.message);
      throw new Error(`Failed to get trip details: ${tripError.message}`);
    }
    
    if (!tripDetails) {
      throw new Error('Trip not found');
    }
    
    // 3. 全place情報（制約付き・日跨ぎ情報含む）
    console.log(`🔍 Fetching all places for trip ${trip_id}`);
    const { data: allPlaces, error: placesError } = await supabase
      .from('places')
      .select('*')
      .eq('trip_id', trip_id)
      .order('wish_level', { ascending: false })
      .order('created_at', { ascending: true });
        
    if (placesError) {
      console.error('❌ Places fetch error:', placesError.message);
      throw new Error(`Database error: ${placesError.message}`);
    }
    
    const places = allPlaces || [];
    console.log(`📍 Found ${places.length} places for optimization`);
    
    // 新規制約付きplace（日跨ぎ含む）をログ出力
    const constraintPlaces = places.filter(p => 
      p.constraint_arrival_time || p.constraint_departure_time
    );
    
    console.log(`🔒 Found ${constraintPlaces.length} places with time constraints:`);
    constraintPlaces.forEach(p => {
      console.log(`  - ${p.name}: arrival=${p.constraint_arrival_time || 'none'}, departure=${p.constraint_departure_time || 'none'}, multi_day=${p.is_multi_day_booking || false}`);
    });
    
    // データ検証
    if (!Array.isArray(places)) {
      throw new Error('Places data must be an array');
    }
    
    if (places.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No places found for optimization'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }
    
    // 基本的なデータ構造の検証
    for (const place of places) {
      if (!place.latitude || !place.longitude || !place.name) {
        console.warn(`⚠️ Invalid place data:`, place);
        throw new Error('Invalid place data: missing required fields (latitude, longitude, name)');
      }
    }
    
    // デフォルト値設定
    places.forEach((place) => {
      if (!place.stay_duration_minutes || place.stay_duration_minutes <= 0) {
        if (place.category === 'airport' || place.place_type === 'system_airport') {
          place.stay_duration_minutes = 90;
        } else if (place.category === 'attraction') {
          place.stay_duration_minutes = 180;
        } else {
          place.stay_duration_minutes = 120;
        }
      }
      
      if (!place.wish_level || place.wish_level <= 0) {
        place.wish_level = place.source === 'google_maps_booking' ? 5 : 3;
      }
    });
    
    // 🔥 edit-schedule内で日跨ぎ分割実行
    console.log('📅 Splitting multi-day constraints...');
    const splitPlaces = splitMultiDayConstraints(places, tripDetails.start_date);
    console.log(`✅ Split into ${splitPlaces.length} places (was ${places.length})`);
    
    // 制約時間のoptimize-route互換変換
    console.log('🔄 Converting constraints to cumulative time...');
    const convertedPlaces = convertConstraintsToCumulativeTime(splitPlaces, tripDetails.start_date);
    console.log(`✅ Converted ${convertedPlaces.length} places to cumulative time format`);
    
    // セグメント分割
    console.log('🧩 Segmenting places by constraints...');
    const segments = segmentPlacesByConstraints(convertedPlaces);
    console.log(`✅ Created ${segments.length} segments`);
    
    // セグメント最適化
    console.log('⚙️ Optimizing segments...');
    let optimizedPlaces: Place[] = [];
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      console.log(`  Optimizing segment ${i + 1}/${segments.length} with ${segment.length} places`);
      
      const segmentStartTime = i === 0 ? 0 : (optimizedPlaces[optimizedPlaces.length - 1]?.cumulative_departure_time || 0);
      const segmentEndTime = segmentStartTime + 12 * 60; // 12時間セグメント
      
      const optimizedSegment = optimizeSegmentWithFixedOrder(
        segment,
        segmentStartTime,
        segmentEndTime
      );
      
      optimizedPlaces = optimizedPlaces.concat(optimizedSegment);
    }
    
    console.log(`✅ Optimized ${optimizedPlaces.length} places across ${segments.length} segments`);
    
    // 累積時間から日別スケジュール変換
    console.log('📅 Converting to daily schedules...');
    const dailySchedules = convertCumulativeTimeToSchedules(optimizedPlaces, tripDetails.start_date);
    console.log(`✅ Created ${dailySchedules.length} daily schedules`);
    
    // 最適化スコア計算
    console.log('📊 Calculating optimization score...');
    const optimizationScore = calculateEditScheduleScore(optimizedPlaces, dailySchedules);
    
    const totalExecutionTime = Date.now() - startTime;
    
    // 既存結果を無効化して新規保存
    console.log('💾 Saving optimization results...');
    
    // 1. 既存の結果を無効化
    await supabase
      .from('optimization_results')
      .update({ is_active: false })
      .eq('trip_id', trip_id);
    
    // 2. 新規結果を保存
    const { error: saveError } = await supabase.from('optimization_results').insert({
      trip_id,
      created_by: member_id,
      optimized_route: dailySchedules,
      optimization_score: optimizationScore,
      execution_time_ms: totalExecutionTime,
      places_count: optimizedPlaces.length,
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
    
    // placesテーブルの状態更新
    console.log('🔄 Updating places schedule status...');
    
    // 全placeをリセット
    await supabase
      .from('places')
      .update({ 
        scheduled: false, 
        is_selected_for_optimization: false,
        scheduled_date: null,
        scheduled_time_start: null,
        scheduled_time_end: null,
        travel_time_from_previous: null
      })
      .eq('trip_id', trip_id);
    
    // 採用されたplaceの状態を更新（仮想分割は除外）
    for (const day of dailySchedules) {
      for (const place of day.scheduled_places) {
        if (!place.is_virtual_split && place.id && !place.id.toString().includes('_day')) {
          await supabase
            .from('places')
            .update({
              scheduled: true,
              is_selected_for_optimization: true,
              scheduled_date: day.date,
              scheduled_time_start: place.arrival_time,
              scheduled_time_end: place.departure_time,
              travel_time_from_previous: place.travel_time_from_previous
            })
            .eq('id', place.id);
        }
      }
    }
    
    const successMessage = `Edit-schedule completed: ${optimizedPlaces.length} places in ${dailySchedules.length} days with constraints. Score: ${optimizationScore.total_score}%`;
    console.log(`🎉 ${successMessage}`);
    
    // レスポンス構築
    return new Response(JSON.stringify({
      success: true,
      optimization: {
        daily_schedules: dailySchedules
      },
      optimization_score: optimizationScore,
      execution_time_ms: totalExecutionTime,
      places_count: optimizedPlaces.length,
      total_travel_time_minutes: dailySchedules.reduce((sum, day) => sum + day.total_travel_time, 0),
      total_visit_time_minutes: dailySchedules.reduce((sum, day) => sum + day.total_visit_time, 0),
      message: successMessage
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
});