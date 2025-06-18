import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// 共通CORS設定
const COMMON_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
// 統一エラーレスポンス
function createErrorResponse(message, statusCode = 500) {
  return new Response(JSON.stringify({
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  }), {
    status: statusCode,
    headers: {
      ...COMMON_CORS_HEADERS,
      'Content-Type': 'application/json'
    }
  });
}
// 統一成功レスポンス
function createSuccessResponse(data, statusCode = 200) {
  return new Response(JSON.stringify({
    success: true,
    ...data,
    timestamp: new Date().toISOString()
  }), {
    status: statusCode,
    headers: {
      ...COMMON_CORS_HEADERS,
      'Content-Type': 'application/json'
    }
  });
}
// ハーバーサイン距離計算
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
// TSP貪欲法による経路最適化（ステップ8）
function optimizeRouteWithTSP(places, departure, destination) {
  if (places.length === 0) return [
    departure,
    destination
  ];
  // 出発地と到着地を除いた中間地点
  const middlePoints = places.filter((p)=>p.id !== departure.id && p.id !== destination.id);
  if (middlePoints.length === 0) {
    return destination.id !== departure.id ? [
      departure,
      destination
    ] : [
      departure
    ];
  }
  const route = [
    departure
  ];
  const unvisited = [
    ...middlePoints
  ];
  let current = departure;
  // 貪欲法で最寄りの場所を選択
  while(unvisited.length > 0){
    let nearest = unvisited[0];
    let minDistance = calculateDistance(current.latitude || current.location?.lat || 0, current.longitude || current.location?.lng || 0, nearest.latitude || nearest.location?.lat || 0, nearest.longitude || nearest.location?.lng || 0);
    for(let i = 1; i < unvisited.length; i++){
      const distance = calculateDistance(current.latitude || current.location?.lat || 0, current.longitude || current.location?.lng || 0, unvisited[i].latitude || unvisited[i].location?.lat || 0, unvisited[i].longitude || unvisited[i].location?.lng || 0);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = unvisited[i];
      }
    }
    route.push(nearest);
    unvisited.splice(unvisited.indexOf(nearest), 1);
    current = nearest;
  }
  // 到着地を最後に追加（出発地と異なる場合）
  if (destination.id !== departure.id) {
    route.push(destination);
  }
  return route;
}
// 移動手段決定（ステップ6）
function determineTransportMode(from, to) {
  const distance = calculateDistance(from.latitude || from.location?.lat || 0, from.longitude || from.location?.lng || 0, to.latitude || to.location?.lat || 0, to.longitude || to.location?.lng || 0);
  
  console.log(`[CONSTRAINED-ROUTE] Transport mode determination: ${from.name || 'Unknown'} → ${to.name || 'Unknown'} (${distance.toFixed(2)}km)`);
  
  if (distance < 2) {
    console.log(`[CONSTRAINED-ROUTE] Selected: walking (distance < 2km)`);
    return 'walking'; // 2km未満は徒歩
  }
  if (distance >= 1000) {
    console.log(`[CONSTRAINED-ROUTE] Selected: flight (distance >= 1000km - intercontinental)`);
    return 'flight'; // 1000km以上は確実に飛行機（大陸間）
  }
  if (distance >= 300) {
    console.log(`[CONSTRAINED-ROUTE] Selected: flight (distance >= 300km - international)`);
    return 'flight'; // 300km以上は飛行機（国際・長距離）
  }
  
  console.log(`[CONSTRAINED-ROUTE] Selected: car (distance < 300km)`);
  return 'car'; // その他は車
}
// 現実的な移動時間計算（ステップ9）
function calculateTravelTime(from, to, mode) {
  const distance = calculateDistance(from.latitude || from.location?.lat || 0, from.longitude || from.location?.lng || 0, to.latitude || to.location?.lat || 0, to.longitude || to.location?.lng || 0);
  switch(mode){
    case 'walking':
      return Math.max(10, distance * 12); // 5km/h
    case 'car':
      return Math.max(15, distance * 1.5); // 40km/h平均
    case 'flight':
      return Math.max(240, distance / 800 * 60 + 180); // 800km/h + 3時間手続き
    default:
      return distance * 2;
  }
}
// 時間文字列をパース
function parseTimeString(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return {
    hours,
    minutes
  };
}
// 時間を分に変換
function timeToMinutes(hours, minutes) {
  return hours * 60 + minutes;
}
// 分を時間文字列に変換
function minutesToTimeString(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}
// 詳細スケジュール構築（ステップ13）
function createDetailedSchedule(route, tripStartDate, tripDurationDays, dailyStartTime, dailyEndTime) {
  const schedules = [];
  const placesPerDay = Math.ceil(route.length / tripDurationDays);
  const startTime = parseTimeString(dailyStartTime);
  const endTime = parseTimeString(dailyEndTime);
  const dailyAvailableMinutes = timeToMinutes(endTime.hours, endTime.minutes) - timeToMinutes(startTime.hours, startTime.minutes);
  for(let day = 1; day <= tripDurationDays; day++){
    const startIdx = (day - 1) * placesPerDay;
    const endIdx = Math.min(startIdx + placesPerDay, route.length);
    const dayPlaces = route.slice(startIdx, endIdx);
    if (dayPlaces.length === 0) continue;
    const currentDate = new Date(tripStartDate);
    currentDate.setDate(currentDate.getDate() + (day - 1));
    const dateString = currentDate.toISOString().split('T')[0];
    const items = [];
    let currentTime = timeToMinutes(startTime.hours, startTime.minutes);
    let dayTravelTime = 0;
    let dayPlaceTime = 0;
    dayPlaces.forEach((place, index)=>{
      // 移動時間追加
      if (index > 0) {
        const prevPlace = dayPlaces[index - 1];
        const transportMode = determineTransportMode(prevPlace, place);
        const travelTime = calculateTravelTime(prevPlace, place, transportMode);
        items.push({
          id: `transport_${prevPlace.id}_${place.id}`,
          type: 'transport',
          name: `${prevPlace.name} → ${place.name}`,
          start_time: minutesToTimeString(currentTime),
          end_time: minutesToTimeString(currentTime + travelTime),
          duration_minutes: travelTime,
          day,
          transport_mode: transportMode
        });
        currentTime += travelTime;
        dayTravelTime += travelTime;
      }
      // 場所での滞在
      const stayDuration = place.stay_duration_minutes || 120;
      items.push({
        id: place.id,
        type: 'place',
        name: place.name,
        location: {
          lat: place.latitude || place.location?.lat || 0,
          lng: place.longitude || place.location?.lng || 0
        },
        start_time: minutesToTimeString(currentTime),
        end_time: minutesToTimeString(currentTime + stayDuration),
        duration_minutes: stayDuration,
        day,
        member_color: place.member_color
      });
      currentTime += stayDuration;
      dayPlaceTime += stayDuration;
    });
    // 食事時間挿入（ステップ11）
    const mealTimes = [
      {
        name: '朝食',
        start: 8 * 60,
        duration: 45
      },
      {
        name: '昼食',
        start: 12 * 60,
        duration: 60
      },
      {
        name: '夕食',
        start: 18 * 60 + 30,
        duration: 90
      }
    ];
    mealTimes.forEach((meal)=>{
      // 既存のアイテムと重複しないかチェック
      const hasConflict = items.some((item)=>{
        const itemStart = timeToMinutes(...parseTimeString(item.start_time));
        const itemEnd = timeToMinutes(...parseTimeString(item.end_time));
        const mealEnd = meal.start + meal.duration;
        return meal.start < itemEnd && mealEnd > itemStart;
      });
      if (!hasConflict) {
        items.push({
          id: `meal_${day}_${meal.name}`,
          type: 'meal',
          name: meal.name,
          start_time: minutesToTimeString(meal.start),
          end_time: minutesToTimeString(meal.start + meal.duration),
          duration_minutes: meal.duration,
          day
        });
      }
    });
    // 時間順ソート
    items.sort((a, b)=>{
      const aTime = timeToMinutes(...parseTimeString(a.start_time));
      const bTime = timeToMinutes(...parseTimeString(b.start_time));
      return aTime - bTime;
    });
    const mealTime = items.filter((item)=>item.type === 'meal').reduce((sum, item)=>sum + item.duration_minutes, 0);
    schedules.push({
      day,
      date: dateString,
      items,
      total_duration_minutes: currentTime - timeToMinutes(startTime.hours, startTime.minutes),
      travel_time_minutes: dayTravelTime,
      place_time_minutes: dayPlaceTime,
      meal_time_minutes: mealTime
    });
  }
  return schedules;
}
function calculateEfficiencyScore(route) {
  if (route.length <= 1) return 1.0;
  let totalDistance = 0;
  for(let i = 0; i < route.length - 1; i++){
    totalDistance += calculateDistance(route[i].latitude || route[i].location?.lat || 0, route[i].longitude || route[i].location?.lng || 0, route[i + 1].latitude || route[i + 1].location?.lat || 0, route[i + 1].longitude || route[i + 1].location?.lng || 0);
  }
  const avgDistance = totalDistance / (route.length - 1);
  return Math.max(0, Math.min(1, 1 - avgDistance / 1000)); // 1000km基準で正規化
}
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: COMMON_CORS_HEADERS
    });
  }
  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization')
        }
      }
    });
    const requestData = await req.json();
    console.log(`🗺️ Starting constrained route generation for trip ${requestData.trip_id}`);
    // ステップ5: 出発地・到着地固定でTSP最適化
    const optimizedRoute = optimizeRouteWithTSP(requestData.route_with_airports, requestData.departure_location, requestData.destination_location);
    // ステップ10-13: 詳細スケジュール構築
    const detailedSchedule = createDetailedSchedule(optimizedRoute, requestData.trip_start_date, requestData.trip_duration_days, requestData.daily_start_time, requestData.daily_end_time);
    const totalTravelTime = detailedSchedule.reduce((sum, day)=>sum + day.travel_time_minutes, 0);
    const totalPlaceTime = detailedSchedule.reduce((sum, day)=>sum + day.place_time_minutes, 0);
    const result = {
      optimized_route: optimizedRoute,
      detailed_schedule: detailedSchedule,
      total_travel_time_minutes: totalTravelTime,
      total_place_time_minutes: totalPlaceTime,
      efficiency_score: calculateEfficiencyScore(optimizedRoute),
      schedule_feasibility: 0.85
    };
    // データベースに保存
    await supabaseClient.from('trip_optimization_results').upsert({
      trip_id: requestData.trip_id,
      step: 'constrained_route_generation',
      result,
      created_at: new Date().toISOString()
    });
    console.log(`✅ Route optimization completed: ${optimizedRoute.length} places, ${detailedSchedule.length} days`);
    return createSuccessResponse(result);
  } catch (error) {
    console.error('❌ Constrained route generation error:', error);
    return createErrorResponse(error.message);
  }
});
