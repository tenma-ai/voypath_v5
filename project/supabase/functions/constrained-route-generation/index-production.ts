import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Place {
  id: string;
  name: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  type?: string;
  member_id: string;
  member_color?: string;
  stay_duration?: number;
}

interface Airport {
  iata_code: string;
  icao_code: string;
  name: string;
  city: string;
  country: string;
  location: {
    lat: number;
    lng: number;
  };
  elevation_ft: number;
  type: string;
  inserted_at?: number;
}

interface TransportSegment {
  from: string;
  to: string;
  mode: 'car' | 'flight' | 'walking';
  distance_km: number;
  estimated_time_minutes: number;
  real_time_minutes?: number;
}

interface ScheduleItem {
  id: string;
  type: 'place' | 'airport' | 'transport' | 'meal';
  name: string;
  location?: {
    lat: number;
    lng: number;
  };
  start_time: string;
  end_time: string;
  duration_minutes: number;
  day: number;
  transport_mode?: string;
  member_id?: string;
  member_color?: string;
  description?: string;
}

interface DaySchedule {
  day: number;
  date: string;
  items: ScheduleItem[];
  total_duration_minutes: number;
  travel_time_minutes: number;
  place_time_minutes: number;
  meal_time_minutes: number;
}

interface ConstrainedRouteRequest {
  trip_id: string;
  route_with_airports: Array<Place | Airport>;
  transport_decisions: TransportSegment[];
  trip_start_date: string;
  trip_duration_days: number;
  daily_start_time: string;
  daily_end_time: string;
  departure_location: Place;
  destination_location: Place;
}

interface ConstrainedRouteResult {
  optimized_route: Array<Place | Airport>;
  detailed_schedule: DaySchedule[];
  total_travel_time_minutes: number;
  total_place_time_minutes: number;
  efficiency_score: number;
  schedule_feasibility: number;
}

// ハーバーサイン距離計算
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // 地球の半径 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// 時間文字列をパース
function parseTimeString(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

// 時間を分に変換
function timeToMinutes(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}

// 分を時間文字列に変換
function minutesToTimeString(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// 現実的な移動時間計算
function calculateRealisticTravelTime(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: 'car' | 'flight' | 'walking'
): number {
  const distance = haversineDistance(from.lat, from.lng, to.lat, to.lng);
  
  switch (mode) {
    case 'walking':
      // 徒歩: 5km/h + 休憩時間
      const walkingTime = (distance / 5) * 60;
      return Math.max(walkingTime, 10); // 最低10分
      
    case 'car':
      // 車: 基本60km/h、渋滞・信号・休憩を考慮
      let carTime = (distance / 60) * 60;
      if (distance > 100) {
        // 長距離は高速利用で80km/h、休憩込み
        carTime = (distance / 80) * 60 + 15; // 休憩15分
      }
      if (distance > 300) {
        // 超長距離は追加休憩
        carTime += Math.floor(distance / 300) * 30;
      }
      return Math.max(carTime, 15); // 最低15分
      
    case 'flight':
      // 飛行機: 空港手続き + 飛行時間 + 移動時間
      const flightTime = (distance / 800) * 60; // 800km/h
      const airportTime = 180; // チェックイン3時間
      const airportAccess = 60; // 空港アクセス往復
      return flightTime + airportTime + airportAccess;
      
    default:
      return distance * 2; // フォールバック
  }
}

// TSP貪欲法による経路最適化
function optimizeRouteWithTSP(
  points: Array<Place | Airport>,
  departureLocation: Place,
  destinationLocation: Place
): Array<Place | Airport> {
  if (points.length <= 2) return points;
  
  // 出発地と到着地を除いた中間地点
  const middlePoints = points.filter(p => 
    p.id !== departureLocation.id && 
    p.id !== destinationLocation.id
  );
  
  if (middlePoints.length === 0) {
    return [departureLocation, destinationLocation];
  }
  
  // 出発地から開始
  const optimizedRoute: Array<Place | Airport> = [departureLocation];
  const unvisited = [...middlePoints];
  let currentPoint = departureLocation;
  
  // 貪欲法で最寄りの点を順次選択
  while (unvisited.length > 0) {
    let nearestPoint = unvisited[0];
    let minDistance = haversineDistance(
      currentPoint.location.lat,
      currentPoint.location.lng,
      nearestPoint.location.lat,
      nearestPoint.location.lng
    );
    
    for (let i = 1; i < unvisited.length; i++) {
      const distance = haversineDistance(
        currentPoint.location.lat,
        currentPoint.location.lng,
        unvisited[i].location.lat,
        unvisited[i].location.lng
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = unvisited[i];
      }
    }
    
    optimizedRoute.push(nearestPoint);
    unvisited.splice(unvisited.indexOf(nearestPoint), 1);
    currentPoint = nearestPoint;
  }
  
  // 到着地を最後に追加（出発地と同じでない場合）
  if (destinationLocation.id !== departureLocation.id) {
    optimizedRoute.push(destinationLocation);
  }
  
  return optimizedRoute;
}

// 食事時間の自動挿入
function insertMealTimes(scheduleItems: ScheduleItem[], day: number, date: string): ScheduleItem[] {
  const itemsWithMeals: ScheduleItem[] = [...scheduleItems];
  const mealTimes = [
    { name: '朝食', start: 8 * 60, duration: 45 }, // 8:00, 45分
    { name: '昼食', start: 12 * 60, duration: 60 }, // 12:00, 60分
    { name: '夕食', start: 18 * 60 + 30, duration: 90 } // 18:30, 90分
  ];
  
  for (const mealTime of mealTimes) {
    const mealStart = mealTime.start;
    const mealEnd = mealStart + mealTime.duration;
    
    // 既存のアイテムと重複しないかチェック
    const hasConflict = scheduleItems.some(item => {
      const startTime = parseTimeString(item.start_time);
      const endTime = parseTimeString(item.end_time);
      const itemStart = timeToMinutes(startTime.hours, startTime.minutes);
      const itemEnd = timeToMinutes(endTime.hours, endTime.minutes);
      return (mealStart < itemEnd && mealEnd > itemStart);
    });
    
    if (!hasConflict) {
      const mealItem: ScheduleItem = {
        id: `meal_${day}_${mealTime.name}`,
        type: 'meal',
        name: mealTime.name,
        start_time: minutesToTimeString(mealStart),
        end_time: minutesToTimeString(mealEnd),
        duration_minutes: mealTime.duration,
        day: day,
        description: `${mealTime.name}の時間`
      };
      
      itemsWithMeals.push(mealItem);
    }
  }
  
  // 時間順にソート
  itemsWithMeals.sort((a, b) => {
    const aStartTime = parseTimeString(a.start_time);
    const bStartTime = parseTimeString(b.start_time);
    const aTime = timeToMinutes(aStartTime.hours, aStartTime.minutes);
    const bTime = timeToMinutes(bStartTime.hours, bStartTime.minutes);
    return aTime - bTime;
  });
  
  return itemsWithMeals;
}

// 制約付き日程分割
function divideIntoConstrainedDays(
  route: Array<Place | Airport>,
  transportSegments: TransportSegment[],
  tripDurationDays: number,
  dailyStartTime: string,
  dailyEndTime: string,
  tripStartDate: string
): DaySchedule[] {
  const dailySchedules: DaySchedule[] = [];
  const startTime = parseTimeString(dailyStartTime);
  const endTime = parseTimeString(dailyEndTime);
  const dailyAvailableMinutes = timeToMinutes(endTime.hours, endTime.minutes) - timeToMinutes(startTime.hours, startTime.minutes);
  
  let currentDay = 1;
  let currentTime = timeToMinutes(startTime.hours, startTime.minutes);
  let routeIndex = 0;
  
  while (currentDay <= tripDurationDays && routeIndex < route.length) {
    const dayItems: ScheduleItem[] = [];
    let dayTravelTime = 0;
    let dayPlaceTime = 0;
    const currentDate = new Date(tripStartDate);
    currentDate.setDate(currentDate.getDate() + (currentDay - 1));
    const dateString = currentDate.toISOString().split('T')[0];
    
    // 1日の開始時間をリセット
    currentTime = timeToMinutes(startTime.hours, startTime.minutes);
    
    while (currentTime < timeToMinutes(endTime.hours, endTime.minutes) && routeIndex < route.length) {
      const currentPoint = route[routeIndex];
      
      // 場所の滞在時間を決定
      const isAirport = 'iata_code' in currentPoint;
      const stayDuration = isAirport ? 
        120 : // 空港: 2時間
        (currentPoint as Place).stay_duration || 120; // 場所: 指定時間または2時間
      
      // 次の場所への移動時間を計算
      let travelTime = 0;
      if (routeIndex < route.length - 1) {
        const nextPoint = route[routeIndex + 1];
        const segment = transportSegments.find(s => 
          s.from === currentPoint.id && s.to === nextPoint.id
        );
        
        if (segment) {
          travelTime = calculateRealisticTravelTime(
            currentPoint.location,
            nextPoint.location,
            segment.mode
          );
        } else {
          // フォールバック: 直線距離から推定
          const distance = haversineDistance(
            currentPoint.location.lat,
            currentPoint.location.lng,
            nextPoint.location.lat,
            nextPoint.location.lng
          );
          travelTime = distance < 10 ? distance * 12 : distance * 2; // 近距離は徒歩、遠距離は車
        }
      }
      
      // 時間制約チェック
      const totalTimeNeeded = stayDuration + travelTime;
      const remainingTime = timeToMinutes(endTime.hours, endTime.minutes) - currentTime;
      
      if (totalTimeNeeded > remainingTime && dayItems.length > 0) {
        // 今日はここまで、明日に持ち越し
        break;
      }
      
      // 場所のスケジュールアイテムを追加
      const placeItem: ScheduleItem = {
        id: currentPoint.id,
        type: isAirport ? 'airport' : 'place',
        name: currentPoint.name,
        location: currentPoint.location,
        start_time: minutesToTimeString(currentTime),
        end_time: minutesToTimeString(currentTime + stayDuration),
        duration_minutes: stayDuration,
        day: currentDay,
        member_id: isAirport ? undefined : (currentPoint as Place).member_id,
        member_color: isAirport ? undefined : (currentPoint as Place).member_color,
        description: isAirport ? 
          `空港での手続きと待機時間` : 
          `${currentPoint.name}での観光・滞在`
      };
      
      dayItems.push(placeItem);
      currentTime += stayDuration;
      dayPlaceTime += stayDuration;
      
      // 移動時間のスケジュールアイテムを追加
      if (travelTime > 0 && routeIndex < route.length - 1) {
        const nextPoint = route[routeIndex + 1];
        const segment = transportSegments.find(s => 
          s.from === currentPoint.id && s.to === nextPoint.id
        );
        
        const transportItem: ScheduleItem = {
          id: `transport_${currentPoint.id}_${nextPoint.id}`,
          type: 'transport',
          name: `${currentPoint.name} → ${nextPoint.name}`,
          start_time: minutesToTimeString(currentTime),
          end_time: minutesToTimeString(currentTime + travelTime),
          duration_minutes: travelTime,
          day: currentDay,
          transport_mode: segment?.mode || 'car',
          description: `${segment?.mode || '車'}での移動 (${segment?.distance_km.toFixed(1) || '不明'}km)`
        };
        
        dayItems.push(transportItem);
        currentTime += travelTime;
        dayTravelTime += travelTime;
      }
      
      routeIndex++;
    }
    
    // 食事時間を挿入
    const itemsWithMeals = insertMealTimes(dayItems, currentDay, dateString);
    const mealTime = itemsWithMeals
      .filter(item => item.type === 'meal')
      .reduce((sum, item) => sum + item.duration_minutes, 0);
    
    const daySchedule: DaySchedule = {
      day: currentDay,
      date: dateString,
      items: itemsWithMeals,
      total_duration_minutes: currentTime - timeToMinutes(startTime.hours, startTime.minutes),
      travel_time_minutes: dayTravelTime,
      place_time_minutes: dayPlaceTime,
      meal_time_minutes: mealTime
    };
    
    dailySchedules.push(daySchedule);
    currentDay++;
  }
  
  return dailySchedules;
}

// 効率性スコアの計算
function calculateEfficiencyScore(
  route: Array<Place | Airport>,
  transportSegments: TransportSegment[]
): number {
  if (route.length <= 1) return 1.0;
  
  let totalDistance = 0;
  let totalTime = 0;
  
  for (let i = 0; i < route.length - 1; i++) {
    const from = route[i];
    const to = route[i + 1];
    
    const segment = transportSegments.find(s => 
      s.from === from.id && s.to === to.id
    );
    
    if (segment) {
      totalDistance += segment.distance_km;
      totalTime += segment.real_time_minutes || segment.estimated_time_minutes;
    } else {
      const distance = haversineDistance(
        from.location.lat,
        from.location.lng,
        to.location.lat,
        to.location.lng
      );
      totalDistance += distance;
      totalTime += distance * 2; // 仮の時間計算
    }
  }
  
  // 効率性 = 距離あたりの場所数 / 平均移動時間
  const placesPerKm = route.length / (totalDistance || 1);
  const avgTimePerSegment = totalTime / Math.max(route.length - 1, 1);
  
  // 正規化スコア（0-1）
  const efficiencyScore = Math.min(1.0, (placesPerKm * 100) / (avgTimePerSegment / 60));
  
  return Math.max(0, efficiencyScore);
}

// スケジュール実現可能性の評価
function calculateScheduleFeasibility(
  dailySchedules: DaySchedule[],
  dailyAvailableMinutes: number
): number {
  if (dailySchedules.length === 0) return 0;
  
  let totalFeasibility = 0;
  
  for (const schedule of dailySchedules) {
    const utilizationRate = schedule.total_duration_minutes / dailyAvailableMinutes;
    const feasibility = utilizationRate <= 1.0 ? 
      1.0 - Math.abs(0.8 - utilizationRate) : // 80%利用が理想
      Math.max(0, 1.0 - (utilizationRate - 1.0) * 2); // 超過はペナルティ
    
    totalFeasibility += feasibility;
  }
  
  return totalFeasibility / dailySchedules.length;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      trip_id,
      route_with_airports,
      transport_decisions,
      trip_start_date,
      trip_duration_days,
      daily_start_time,
      daily_end_time,
      departure_location,
      destination_location
    }: ConstrainedRouteRequest = await req.json();

    console.log(`Starting constrained route generation for trip ${trip_id}`);
    console.log(`Route: ${route_with_airports.length} points, ${trip_duration_days} days`);

    // Step 5 & 8: 出発地・到着地固定 + TSP最適化
    const optimizedRoute = optimizeRouteWithTSP(
      route_with_airports,
      departure_location,
      destination_location
    );
    
    console.log(`Route optimized: ${optimizedRoute.length} points in optimal order`);

    // 移動時間の再計算（現実的時間）
    const updatedTransportSegments = transport_decisions.map(segment => ({
      ...segment,
      real_time_minutes: calculateRealisticTravelTime(
        route_with_airports.find(p => p.id === segment.from)?.location || { lat: 0, lng: 0 },
        route_with_airports.find(p => p.id === segment.to)?.location || { lat: 0, lng: 0 },
        segment.mode
      )
    }));

    console.log(`Transport times recalculated with realistic estimates`);

    // Step 10: 制約付き日程分割
    const dailySchedules = divideIntoConstrainedDays(
      optimizedRoute,
      updatedTransportSegments,
      trip_duration_days,
      daily_start_time,
      daily_end_time,
      trip_start_date
    );

    console.log(`Schedule divided into ${dailySchedules.length} days`);

    // 統計計算
    const totalTravelTime = dailySchedules.reduce((sum, day) => sum + day.travel_time_minutes, 0);
    const totalPlaceTime = dailySchedules.reduce((sum, day) => sum + day.place_time_minutes, 0);
    
    const startTime = parseTimeString(daily_start_time);
    const endTime = parseTimeString(daily_end_time);
    const dailyAvailableMinutes = timeToMinutes(endTime.hours, endTime.minutes) - timeToMinutes(startTime.hours, startTime.minutes);
    
    const efficiencyScore = calculateEfficiencyScore(optimizedRoute, updatedTransportSegments);
    const scheduleFeasibility = calculateScheduleFeasibility(dailySchedules, dailyAvailableMinutes);

    console.log(`=== Route Generation Results ===`);
    console.log(`Efficiency Score: ${(efficiencyScore * 100).toFixed(1)}%`);
    console.log(`Schedule Feasibility: ${(scheduleFeasibility * 100).toFixed(1)}%`);
    console.log(`Total Travel Time: ${(totalTravelTime / 60).toFixed(1)} hours`);
    console.log(`Total Place Time: ${(totalPlaceTime / 60).toFixed(1)} hours`);

    const result: ConstrainedRouteResult = {
      optimized_route: optimizedRoute,
      detailed_schedule: dailySchedules,
      total_travel_time_minutes: totalTravelTime,
      total_place_time_minutes: totalPlaceTime,
      efficiency_score: efficiencyScore,
      schedule_feasibility: scheduleFeasibility
    };

    // データベースに結果を保存
    const { error: saveError } = await supabaseClient
      .from('trip_optimization_results')
      .upsert({
        trip_id,
        step: 'constrained_route_generation',
        result,
        created_at: new Date().toISOString()
      });

    if (saveError) {
      console.error('Error saving constrained route results:', saveError);
    }

    // 詳細スケジュールログ
    dailySchedules.forEach(day => {
      console.log(`\n--- Day ${day.day} (${day.date}) ---`);
      console.log(`Total: ${(day.total_duration_minutes / 60).toFixed(1)}h, Travel: ${(day.travel_time_minutes / 60).toFixed(1)}h, Places: ${(day.place_time_minutes / 60).toFixed(1)}h`);
      day.items.forEach(item => {
        console.log(`${item.start_time}-${item.end_time}: ${item.name} (${item.type})`);
      });
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in constrained-route-generation:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        step: 'constrained_route_generation',
        details: 'Failed to generate constrained route with detailed schedule'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});