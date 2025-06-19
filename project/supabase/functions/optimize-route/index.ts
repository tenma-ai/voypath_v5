import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
// 距離計算（ハバーサイン公式）
function calculateDistance(point1, point2) {
  const R = 6371; // 地球の半径(km)
  const [lat1, lon1] = point1;
  const [lat2, lon2] = point2;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
// 移動手段の判定（改善版）
function determineTransportMode(distance, fromAirport = false, toAirport = false) {
  console.log(`🚗 Distance: ${distance.toFixed(1)}km, fromAirport: ${fromAirport}, toAirport: ${toAirport}`);
  // 距離ベースの判定を優先（空港であっても近距離は車を使用）
  if (distance <= 2) {
    console.log('  🚶 Walking (short distance)');
    return 'walking';
  }
  if (distance <= 500) {
    console.log('  🚗 Car (medium distance)');
    return 'car';
  }
  // 長距離の場合のみ飛行機を使用
  console.log('  ✈️ Flight (long distance)');
  return 'flight';
}
// 移動時間の計算（改善版）
function calculateTravelTime(distance, mode) {
  if (mode === 'flight') {
    // 飛行機の現実的な時間計算（空港での手続き時間を含む）
    if (distance > 8000) {
      // 超長距離国際線（例：東京→ニューヨーク）
      return 660; // 11時間（飛行時間8時間 + 空港手続き3時間）
    } else if (distance > 3000) {
      // 長距離国際線（例：東京→ヨーロッパ）
      return 480; // 8時間（飛行時間6時間 + 空港手続き2時間）
    } else if (distance > 1000) {
      // 中距離国際線（例：東京→アジア）
      return 300; // 5時間（飛行時間3時間 + 空港手続き2時間）
    } else {
      // 国内線・短距離
      return 120; // 2時間（飛行時間1時間 + 空港手続き1時間）
    }
  }
  const speeds = {
    walking: 5,
    car: 80,
    flight: 800 // この値は上記で個別処理するため使用されない
  };
  const baseTime = distance / speeds[mode] * 60; // 分単位
  // オーバーヘッド時間（休憩、乗車準備等）
  const overhead = {
    walking: 5,
    car: 20,
    flight: 0 // 上記で個別処理
  };
  return Math.round(baseTime + overhead[mode]);
}
// 希望度の正規化（必須機能）
function normalizePreferences(places) {
  console.log('🔄 Normalizing preferences');
  // ユーザーごとにグループ化
  const userGroups = new Map();
  places.forEach((place)=>{
    if (place.place_type === 'visit') {
      if (!userGroups.has(place.user_id)) {
        userGroups.set(place.user_id, []);
      }
      userGroups.get(place.user_id).push(place);
    }
  });
  // 各ユーザーの希望度を正規化
  userGroups.forEach((userPlaces, userId)=>{
    const avgWish = userPlaces.reduce((sum, p)=>sum + p.wish_level, 0) / userPlaces.length;
    userPlaces.forEach((place)=>{
      place.normalized_wish_level = place.wish_level / avgWish;
    });
    console.log(`User ${userId}: ${userPlaces.length} places, avg wish: ${avgWish.toFixed(2)}`);
  });
  return places;
}
// 場所の絞り込み（公平性考慮）
function filterPlacesByFairness(places, maxPlaces) {
  console.log('🔄 Filtering places by fairness');
  const systemPlaces = places.filter((p)=>p.place_type === 'departure' || p.place_type === 'destination');
  const visitPlaces = places.filter((p)=>p.place_type === 'visit');
  if (visitPlaces.length <= maxPlaces - systemPlaces.length) {
    console.log('✅ All places fit within limit');
    return places;
  }
  // ラウンドロビン方式で公平に選択
  const userGroups = new Map();
  visitPlaces.forEach((place)=>{
    if (!userGroups.has(place.user_id)) {
      userGroups.set(place.user_id, []);
    }
    userGroups.get(place.user_id).push(place);
  });
  // 各ユーザーの場所を希望度順にソート
  userGroups.forEach((places)=>{
    places.sort((a, b)=>(b.normalized_wish_level || 1) - (a.normalized_wish_level || 1));
  });
  const selectedVisitPlaces = [];
  const maxVisitPlaces = maxPlaces - systemPlaces.length;
  // ラウンドロビンで選択
  let round = 0;
  while(selectedVisitPlaces.length < maxVisitPlaces && Array.from(userGroups.values()).some((arr)=>arr.length > 0)){
    for (const [userId, userPlaces] of userGroups){
      if (userPlaces.length > 0 && selectedVisitPlaces.length < maxVisitPlaces) {
        selectedVisitPlaces.push(userPlaces.shift());
      }
    }
    round++;
  }
  console.log(`✅ Selected ${selectedVisitPlaces.length} visit places in ${round} rounds`);
  return [
    ...systemPlaces,
    ...selectedVisitPlaces
  ];
}
// 重複除去のためのヘルパー関数
function removeDuplicatePlaces(places) {
  const uniquePlaces = [];
  const seenPlaces = new Set();
  for (const place of places){
    // 重複判定のキー: 緯度経度と名前で判定
    const placeKey = `${place.latitude.toFixed(4)}-${place.longitude.toFixed(4)}-${place.name}`;
    if (!seenPlaces.has(placeKey)) {
      seenPlaces.add(placeKey);
      uniquePlaces.push(place);
    } else {
      console.log(`⏭️ Removed duplicate place: ${place.name}`);
    }
  }
  return uniquePlaces;
}
// 空港検出・挿入（シンプル版）
async function insertAirportsIfNeeded(supabase, places) {
  console.log('🔄 Checking for airport insertions needed');
  const newRoute = [];
  for(let i = 0; i < places.length; i++){
    const currentPlace = places[i];
    newRoute.push(currentPlace);
    // 次の場所があるかチェック
    if (i < places.length - 1) {
      const nextPlace = places[i + 1];
      const distance = calculateDistance([
        currentPlace.latitude,
        currentPlace.longitude
      ], [
        nextPlace.latitude,
        nextPlace.longitude
      ]);
      const transportMode = determineTransportMode(distance, currentPlace.is_airport, nextPlace.is_airport);
      if (transportMode === 'flight') {
        console.log(`✈️ Flight needed: ${currentPlace.name} → ${nextPlace.name} (${distance.toFixed(1)}km)`);
        // 出発空港を追加（現在地が空港でない場合）
        if (!currentPlace.is_airport) {
          const depAirport = await findNearestAirport(supabase, currentPlace.latitude, currentPlace.longitude);
          if (depAirport) {
            const depAirportPlace = {
              id: `airport_${depAirport.iata_code}_dep_${Date.now()}`,
              name: `${depAirport.airport_name} (${depAirport.iata_code})`,
              latitude: depAirport.latitude,
              longitude: depAirport.longitude,
              category: 'airport',
              place_type: 'airport',
              stay_duration_minutes: 120, // 空港は2時間で固定
              wish_level: 1,
              user_id: currentPlace.user_id,
              is_airport: true,
              airport_code: depAirport.iata_code
            };
            newRoute.push(depAirportPlace);
            console.log(`🛫 Inserted departure airport: ${depAirportPlace.name}`);
          }
        }
        // 到着空港を追加（次の場所が空港でない場合）
        if (!nextPlace.is_airport) {
          const arrAirport = await findNearestAirport(supabase, nextPlace.latitude, nextPlace.longitude);
          if (arrAirport) {
            const arrAirportPlace = {
              id: `airport_${arrAirport.iata_code}_arr_${Date.now()}`,
              name: `${arrAirport.airport_name} (${arrAirport.iata_code})`,
              latitude: arrAirport.latitude,
              longitude: arrAirport.longitude,
              category: 'airport',
              place_type: 'airport',
              stay_duration_minutes: 120, // 空港は2時間で固定
              wish_level: 1,
              user_id: nextPlace.user_id,
              is_airport: true,
              airport_code: arrAirport.iata_code
            };
            newRoute.push(arrAirportPlace);
            console.log(`🛬 Inserted arrival airport: ${arrAirportPlace.name}`);
          }
        }
      }
    }
  }
  console.log(`✅ Route with airports: ${newRoute.map((p)=>p.name).join(' → ')}`);
  return newRoute;
}
// 国際空港判定関数
function isInternationalAirport(airport) {
  const name = airport.name?.toLowerCase() || '';
  const type = airport.type?.toLowerCase() || '';
  // 除外すべき空港タイプ
  const excludeKeywords = [
    'heliport',
    'helipad',
    'helicopter',
    'naval',
    'air force',
    'military',
    'army',
    'navy',
    'base',
    'station',
    'field',
    'private',
    'restricted',
    'closed',
    'abandoned',
    'seaplane',
    'balloonport'
  ];
  // 名前に除外キーワードが含まれている場合は除外
  for (const keyword of excludeKeywords){
    if (name.includes(keyword)) {
      return false;
    }
  }
  // タイプが明確に空港以外の場合は除外
  if (type && !type.includes('airport')) {
    return false;
  }
  // 国際空港を示すキーワード
  const internationalKeywords = [
    'international',
    'intl',
    'airport'
  ];
  // 主要な国際空港のIATAコード（確実に含めたいもの）
  const majorInternationalAirports = [
    'NRT',
    'HND',
    'KIX',
    'CTS',
    'FUK',
    'OKA',
    'JFK',
    'LAX',
    'ORD',
    'DFW',
    'DEN',
    'SFO',
    'SEA',
    'LAS',
    'PHX',
    'IAH',
    'CLT',
    'MIA',
    'BOS',
    'MSP',
    'DTW',
    'LHR',
    'CDG',
    'AMS',
    'FRA',
    'MAD',
    'FCO',
    'MUC',
    'ZUR',
    'VIE',
    'CPH',
    'ARN',
    'OSL',
    'HEL',
    'ICN',
    'PVG',
    'PEK',
    'CAN',
    'HKG',
    'TPE',
    'NRT',
    'SIN',
    'BKK',
    'KUL',
    'CGK',
    'MNL',
    'DEL',
    'BOM',
    'SYD',
    'MEL',
    'BNE',
    'PER',
    'AKL',
    'CHC',
    'DXB',
    'DOH',
    'AUH',
    'KWI',
    'JNB',
    'CAI',
    'ADD',
    'LOS',
    'GRU',
    'GIG',
    'EZE',
    'SCL',
    'LIM',
    'BOG',
    'UIO',
    'YYZ',
    'YVR',
    'YUL',
    'YYC' // カナダ
  ];
  // 主要国際空港リストに含まれている場合は確実に含める
  if (majorInternationalAirports.includes(airport.iata)) {
    return true;
  }
  // 名前に"International"が含まれている場合
  if (name.includes('international') || name.includes('intl')) {
    return true;
  }
  // その他の大規模空港の条件（名前に"Airport"が含まれ、3文字のIATAコードがある）
  if (name.includes('airport') && airport.iata && airport.iata.length === 3) {
    return true;
  }
  return false;
}
// OpenFlights データを使用した最寄り空港検索
async function findNearestAirport(supabase, lat, lng) {
  try {
    console.log(`🔍 Searching nearest airport for coordinates: ${lat}, ${lng}`);
    // OpenFlights データベースから空港データを取得
    const airportsData = await fetchOpenFlightsData();
    if (!airportsData || airportsData.length === 0) {
      console.log('⚠️ Failed to fetch OpenFlights data, using fallback airports');
      return await findNearestAirportFallback(lat, lng);
    }
    // 商用国際空港のみをフィルタ（厳格な条件）
    const commercialAirports = airportsData.filter((airport)=>airport.iata && airport.iata !== '\\N' && airport.iata.length === 3 && Math.abs(airport.latitude) > 0 && Math.abs(airport.longitude) > 0 && // 国際空港のフィルタリング条件
      isInternationalAirport(airport));
    if (commercialAirports.length === 0) {
      console.log('⚠️ No commercial airports found, using fallback');
      return await findNearestAirportFallback(lat, lng);
    }
    // 最寄りの空港を検索
    let nearest = commercialAirports[0];
    let minDistance = calculateDistance([
      lat,
      lng
    ], [
      nearest.latitude,
      nearest.longitude
    ]);
    for (const airport of commercialAirports){
      const distance = calculateDistance([
        lat,
        lng
      ], [
        airport.latitude,
        airport.longitude
      ]);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = airport;
      }
    }
    console.log(`🛫 Found nearest airport: ${nearest.name} (${nearest.iata}) - Distance: ${minDistance.toFixed(1)}km`);
    return {
      iata_code: nearest.iata,
      airport_name: nearest.name,
      city_name: nearest.city,
      latitude: nearest.latitude,
      longitude: nearest.longitude,
      commercial_service: true
    };
  } catch (error) {
    console.error('❌ Airport search error:', error);
    return await findNearestAirportFallback(lat, lng);
  }
}
// OpenFlights データの取得
async function fetchOpenFlightsData() {
  try {
    console.log('📥 Fetching OpenFlights airport data...');
    const response = await fetch('https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const csvData = await response.text();
    const lines = csvData.split('\n').filter((line)=>line.trim());
    const airports = [];
    for (const line of lines){
      if (line.trim()) {
        const parts = line.split(',').map((part)=>part.replace(/"/g, '').trim());
        if (parts.length >= 8) {
          airports.push({
            id: parts[0],
            name: parts[1],
            city: parts[2],
            country: parts[3],
            iata: parts[4] || null,
            icao: parts[5] || null,
            latitude: parseFloat(parts[6]) || 0,
            longitude: parseFloat(parts[7]) || 0,
            altitude: parseInt(parts[8]) || 0,
            type: parts[12] || null
          });
        }
      }
    }
    console.log(`✅ Loaded ${airports.length} airports from OpenFlights`);
    return airports;
  } catch (error) {
    console.error('❌ Failed to fetch OpenFlights data:', error);
    return [];
  }
}
// フォールバック用の主要空港検索
async function findNearestAirportFallback(lat, lng) {
  console.log('🔄 Using fallback airport database');
  const majorAirports = [
    {
      iata_code: 'NRT',
      airport_name: 'Narita International Airport',
      city_name: 'Tokyo',
      latitude: 35.7647,
      longitude: 140.3864
    },
    {
      iata_code: 'HND',
      airport_name: 'Tokyo Haneda International Airport',
      city_name: 'Tokyo',
      latitude: 35.5523,
      longitude: 139.7800
    },
    {
      iata_code: 'KIX',
      airport_name: 'Kansai International Airport',
      city_name: 'Osaka',
      latitude: 34.4273,
      longitude: 135.2444
    },
    {
      iata_code: 'JFK',
      airport_name: 'John F Kennedy International Airport',
      city_name: 'New York',
      latitude: 40.6398,
      longitude: -73.7789
    },
    {
      iata_code: 'LAX',
      airport_name: 'Los Angeles International Airport',
      city_name: 'Los Angeles',
      latitude: 33.9425,
      longitude: -118.4081
    },
    {
      iata_code: 'LHR',
      airport_name: 'London Heathrow Airport',
      city_name: 'London',
      latitude: 51.4706,
      longitude: -0.461941
    },
    {
      iata_code: 'CDG',
      airport_name: 'Charles de Gaulle International Airport',
      city_name: 'Paris',
      latitude: 49.0128,
      longitude: 2.55
    },
    {
      iata_code: 'ICN',
      airport_name: 'Incheon International Airport',
      city_name: 'Seoul',
      latitude: 37.4691,
      longitude: 126.451
    }
  ];
  let nearest = majorAirports[0];
  let minDistance = calculateDistance([
    lat,
    lng
  ], [
    nearest.latitude,
    nearest.longitude
  ]);
  for (const airport of majorAirports){
    const distance = calculateDistance([
      lat,
      lng
    ], [
      airport.latitude,
      airport.longitude
    ]);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = airport;
    }
  }
  console.log(`🛫 Fallback: Selected ${nearest.airport_name} (${nearest.iata_code}) - Distance: ${minDistance.toFixed(1)}km`);
  return {
    ...nearest,
    commercial_service: true
  };
}
// シンプルなTSP（最短距離貪欲法）
function optimizeRouteOrder(places) {
  console.log('🔄 Optimizing route order with simple TSP');
  console.log(`  Input places: ${places.map((p)=>`${p.name}(${p.place_type})`).join(', ')}`);
  if (places.length <= 2) return places;
  const departure = places.find((p)=>p.place_type === 'departure');
  const destination = places.find((p)=>p.place_type === 'destination');
  const others = places.filter((p)=>p.place_type !== 'departure' && p.place_type !== 'destination');
  console.log(`  Departure: ${departure?.name || 'NONE'}`);
  console.log(`  Destination: ${destination?.name || 'NONE'}`);
  console.log(`  Others: ${others.map((p)=>p.name).join(', ')}`);
  const route = [];
  // 出発地を最初に
  if (departure) {
    route.push(departure);
    console.log(`  Added departure: ${departure.name}`);
  }
  // 貪欲法で中間地点を最適化
  const remaining = [
    ...others
  ];
  let current = departure || others[0];
  while(remaining.length > 0){
    let nearest = remaining[0];
    let minDistance = calculateDistance([
      current.latitude,
      current.longitude
    ], [
      nearest.latitude,
      nearest.longitude
    ]);
    for(let i = 1; i < remaining.length; i++){
      const distance = calculateDistance([
        current.latitude,
        current.longitude
      ], [
        remaining[i].latitude,
        remaining[i].longitude
      ]);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = remaining[i];
      }
    }
    route.push(nearest);
    remaining.splice(remaining.indexOf(nearest), 1);
    current = nearest;
  }
  // 目的地を最後に（同じ場所への往復の場合のみ出発地と同じ場所を追加）
  if (destination) {
    const depName = departure?.name || '';
    const destName = destination.name || '';
    console.log(`  Processing destination: ${destName}`);
    console.log(`  Departure name: ${depName}`);
    
    // 往復判定：名前に明確に「same as departure」が含まれる場合のみ往復として扱う
    const isExplicitRoundTrip = destName.toLowerCase().includes('same as departure');
    
    if (isExplicitRoundTrip && departure) {
      // 復路として出発地のコピーを作成
      const returnPlace = {
        ...departure,
        id: `return_${departure.id}`,
        name: `Return to ${depName}`,
        place_type: 'destination'
      };
      route.push(returnPlace);
      console.log(`  Added return destination: ${returnPlace.name}`);
    } else {
      // 通常の目的地として追加
      route.push(destination);
      console.log(`  Added destination: ${destination.name}`);
    }
  } else {
    console.log(`  No destination found!`);
  }
  console.log(`✅ Route optimized: ${route.map((p)=>p.name).join(' → ')}`);
  return route;
}
// 移動時間・移動手段の計算
function calculateRouteDetails(places) {
  console.log('🔄 Calculating route details');
  const route = [
    ...places
  ];
  for(let i = 1; i < route.length; i++){
    const prev = route[i - 1];
    const curr = route[i];
    const distance = calculateDistance([
      prev.latitude,
      prev.longitude
    ], [
      curr.latitude,
      curr.longitude
    ]);
    const transportMode = determineTransportMode(distance, prev.is_airport, curr.is_airport);
    const travelTime = calculateTravelTime(distance, transportMode);
    curr.transport_mode = transportMode;
    curr.travel_time_from_previous = travelTime;
    console.log(`${prev.name} → ${curr.name}: ${distance.toFixed(1)}km, ${transportMode}, ${travelTime}min`);
  }
  return route;
}
// 日別スケジュール分割
function createDailySchedule(places) {
  console.log('🔄 Creating daily schedule');
  const maxDailyHours = 12; // 1日最大12時間
  const maxDailyMinutes = maxDailyHours * 60;
  const schedules = [];
  let currentDay = 1;
  let currentPlaces = [];
  let currentTime = 0;
  let timeCounter = 9 * 60; // 9:00 AMから開始
  for(let i = 0; i < places.length; i++){
    const place = places[i];
    const placeTime = place.stay_duration_minutes + (place.travel_time_from_previous || 0);
    // フライトの場合は到着が翌日になるので新しい日を作成
    if (place.transport_mode === 'flight' && currentPlaces.length > 0) {
      // 現在の日を完了
      schedules.push(createDaySchedule(currentDay, currentPlaces, timeCounter));
      currentDay++;
      currentPlaces = [];
      currentTime = 0;
      timeCounter = 9 * 60; // 翌日の9:00 AMから開始
    }
    // 通常の時間超過チェック（フライト以外）
    else if (currentTime + placeTime > maxDailyMinutes && currentPlaces.length > 0) {
      schedules.push(createDaySchedule(currentDay, currentPlaces, timeCounter));
      currentDay++;
      currentPlaces = [];
      currentTime = 0;
      timeCounter = 9 * 60; // リセット
    }
    // 時間設定
    if (place.travel_time_from_previous) {
      timeCounter += place.travel_time_from_previous;
    }
    place.arrival_time = formatTime(timeCounter);
    timeCounter += place.stay_duration_minutes;
    place.departure_time = formatTime(timeCounter);
    place.order_in_day = currentPlaces.length + 1;
    currentPlaces.push(place);
    currentTime += placeTime;
  }
  // 最後の日を追加
  if (currentPlaces.length > 0) {
    schedules.push(createDaySchedule(currentDay, currentPlaces, timeCounter));
  }
  console.log(`✅ Created ${schedules.length} daily schedules`);
  return schedules;
}
function createDaySchedule(day, places, timeCounter) {
  const date = new Date();
  date.setDate(date.getDate() + day - 1);
  return {
    day,
    date: date.toISOString().split('T')[0],
    scheduled_places: places,
    total_travel_time: places.reduce((sum, p)=>sum + (p.travel_time_from_previous || 0), 0),
    total_visit_time: places.reduce((sum, p)=>sum + p.stay_duration_minutes, 0),
    meal_breaks: []
  };
}
function formatTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:00`;
}
// 最適化結果の検証
function validateOptimizationResult(places, schedules) {
  console.log('🔍 Validating optimization result');
  const issues = [];
  // 1. 重複チェック
  const placeNames = places.map((p)=>p.name);
  const uniqueNames = new Set(placeNames);
  if (placeNames.length !== uniqueNames.size) {
    issues.push('Duplicate places found in route');
  }
  // 2. 移動時間の合理性チェック
  let unrealisticMoves = 0;
  for(let i = 1; i < places.length; i++){
    const place = places[i];
    if (place.travel_time_from_previous && place.travel_time_from_previous > 720) {
      unrealisticMoves++;
    }
  }
  if (unrealisticMoves > 0) {
    issues.push(`${unrealisticMoves} unrealistic travel times (>12h) found`);
  }
  // 3. 日程の合理性チェック
  schedules.forEach((schedule, index)=>{
    if (schedule.total_travel_time > 720) {
      issues.push(`Day ${index + 1} has excessive travel time (${Math.round(schedule.total_travel_time / 60)}h)`);
    }
    if (schedule.scheduled_places.length === 0) {
      issues.push(`Day ${index + 1} has no scheduled places`);
    }
  });
  // 4. フライト数チェック
  const flightDays = schedules.filter((schedule)=>schedule.scheduled_places.some((place)=>place.transport_mode === 'flight')).length;
  if (flightDays > schedules.length * 0.5) {
    issues.push('Too many flight days - schedule may be unrealistic');
  }
  const isValid = issues.length === 0;
  console.log(`✅ Validation result: ${isValid ? 'VALID' : 'ISSUES FOUND'}`);
  if (!isValid) {
    issues.forEach((issue)=>console.log(`  ⚠️ ${issue}`));
  }
  return {
    isValid,
    issues
  };
}
// 改善された最適化スコア計算
function calculateOptimizationScore(places, schedules) {
  const totalTravel = schedules.reduce((sum, day)=>sum + day.total_travel_time, 0);
  const totalVisit = schedules.reduce((sum, day)=>sum + day.total_visit_time, 0);
  // 効率性（訪問時間 / 総時間）
  const efficiency = totalVisit > 0 && totalTravel > 0 ? totalVisit / (totalVisit + totalTravel) : 0.5;
  // 希望度満足度
  const visitPlaces = places.filter((p)=>p.place_type === 'visit');
  const avgNormalizedWish = visitPlaces.length > 0 ? visitPlaces.reduce((sum, p)=>sum + (p.normalized_wish_level || 0.8), 0) / visitPlaces.length : 0.8;
  // 公平性（ユーザー間のバランス）
  let fairness = 1.0;
  if (visitPlaces.length > 0) {
    const userCounts = new Map();
    visitPlaces.forEach((p)=>{
      userCounts.set(p.user_id, (userCounts.get(p.user_id) || 0) + 1);
    });
    const counts = Array.from(userCounts.values());
    if (counts.length > 1) {
      const avgCount = counts.reduce((sum, c)=>sum + c, 0) / counts.length;
      const variance = counts.reduce((sum, c)=>sum + Math.pow(c - avgCount, 2), 0) / counts.length;
      fairness = avgCount > 0 ? Math.max(0, 1 - variance / avgCount) : 1.0;
    }
  }
  // 実現可能性（新しい指標）
  const validation = validateOptimizationResult(places, schedules);
  const feasibility = validation.isValid ? 1.0 : Math.max(0.1, 1.0 - validation.issues.length * 0.2);
  // スコア計算（実現可能性を重視）
  const totalScore = (efficiency * 0.3 + avgNormalizedWish * 0.2 + fairness * 0.2 + feasibility * 0.3) * 100;
  console.log(`📊 Score calculation: efficiency=${efficiency.toFixed(2)}, wish=${avgNormalizedWish.toFixed(2)}, fairness=${fairness.toFixed(2)}, feasibility=${feasibility.toFixed(2)}, total=${totalScore.toFixed(1)}%`);
  return {
    total_score: Math.round(Math.max(0, Math.min(100, totalScore))),
    fairness_score: Math.round(Math.max(0, Math.min(100, fairness * 100))),
    efficiency_score: Math.round(Math.max(0, Math.min(100, efficiency * 100))),
    feasibility_score: Math.round(Math.max(0, Math.min(100, feasibility * 100))),
    validation_issues: validation.issues,
    details: {
      user_adoption_balance: fairness,
      wish_satisfaction_balance: avgNormalizedWish,
      travel_efficiency: efficiency,
      time_constraint_compliance: feasibility,
      is_feasible: validation.isValid
    }
  };
}
// メイン処理
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  const startTime = Date.now();
  try {
    console.log('🚀 Starting simplified route optimization');
    const { trip_id, member_id, user_places, constraints } = await req.json();
    if (!trip_id || !member_id) {
      throw new Error('Missing trip_id or member_id');
    }
    console.log(`📍 Processing ${user_places?.length || 0} places for trip ${trip_id}`);
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    // データベースから場所を取得（user_placesが提供されていない場合）
    let places = user_places;
    if (!places || places.length === 0) {
      const { data, error } = await supabase.from('places').select('*').eq('trip_id', trip_id);
      if (error) throw new Error(`Database error: ${error.message}`);
      places = data || [];
    }
    if (places.length === 0) {
      throw new Error('No places found for optimization');
    }
    console.log(`📊 Input: ${places.length} places`);
    // デバッグ: 入力データの詳細をログ出力
    places.forEach((place, index)=>{
      console.log(`  Place ${index + 1}: ${place.name} (type: ${place.place_type}, stay: ${place.stay_duration_minutes}min, lat: ${place.latitude}, lng: ${place.longitude})`);
    });
    // 1. 滞在時間の正規化と確認（stay_duration_minutesが適切に設定されているか）
    console.log('🔄 Ensuring proper stay durations for all places');
    places.forEach((place, index) => {
      // 空港の場合は120分に固定、それ以外はユーザー設定値を使用
      if (place.place_type === 'airport' || place.category === 'airport') {
        place.stay_duration_minutes = 120;
        console.log(`  Airport ${place.name}: Set to 120 minutes`);
      } else if (!place.stay_duration_minutes || place.stay_duration_minutes <= 0) {
        // stay_duration_minutesが設定されていない場合のデフォルト値
        place.stay_duration_minutes = 60; // 1時間デフォルト
        console.log(`  ${place.name}: No duration set, defaulting to 60 minutes`);
      } else {
        console.log(`  ${place.name}: Using configured duration of ${place.stay_duration_minutes} minutes`);
      }
    });
    
    // 2. 希望度の正規化（必須機能）
    const normalizedPlaces = normalizePreferences(places);
    // 3. 場所の絞り込み（公平性考慮）
    const maxPlaces = constraints?.max_places || 20;
    const filteredPlaces = filterPlacesByFairness(normalizedPlaces, maxPlaces);
    // 4. 出発地・目的地の固定（必須機能）
    const departure = filteredPlaces.find((p)=>p.place_type === 'departure');
    const destination = filteredPlaces.find((p)=>p.place_type === 'destination');
    console.log(`🏁 Departure: ${departure?.name || 'None'}, Destination: ${destination?.name || 'None'}`);
    // 5. ルート最適化（TSP）- 基本的な場所のみで実行
    const optimizedRoute = optimizeRouteOrder(filteredPlaces);
    // 6. 最適化されたルートに長距離移動用の空港を挿入
    const routeWithAirports = await insertAirportsIfNeeded(supabase, optimizedRoute);
    // 7. 移動時間・移動手段計算
    const routeWithDetails = calculateRouteDetails(routeWithAirports);
    // 8. 日別スケジュール作成
    const dailySchedules = createDailySchedule(routeWithDetails);
    // 9. 最適化スコア計算
    const optimizationScore = calculateOptimizationScore(routeWithDetails, dailySchedules);
    const executionTime = Date.now() - startTime;
    // 10. 結果保存
    console.log('💾 Saving optimization result to database...');
    const { data: savedResult, error: saveError } = await supabase.from('optimization_results').insert({
      trip_id,
      created_by: member_id,
      optimized_route: dailySchedules,
      optimization_score: optimizationScore,
      execution_time_ms: executionTime,
      places_count: routeWithDetails.length,
      total_travel_time_minutes: dailySchedules.reduce((sum, day)=>sum + day.total_travel_time, 0),
      total_visit_time_minutes: dailySchedules.reduce((sum, day)=>sum + day.total_visit_time, 0),
      is_active: true,
      algorithm_version: 'simplified-v1'
    }).select();
    
    if (saveError) {
      console.error('❌ Failed to save optimization result:', saveError);
      // 保存に失敗してもレスポンスは返す（一時的なメモリ結果として）
    } else {
      console.log('✅ Optimization result saved successfully:', savedResult?.[0]?.id);
    }
    console.log(`✅ Optimization completed in ${executionTime}ms`);
    return new Response(JSON.stringify({
      success: true,
      optimization: {
        daily_schedules: dailySchedules,
        optimization_score: optimizationScore,
        optimized_route: {
          daily_schedules: dailySchedules
        },
        total_duration_minutes: dailySchedules.reduce((sum, day)=>sum + day.total_travel_time + day.total_visit_time, 0),
        places: routeWithDetails,
        execution_time_ms: executionTime
      },
      message: `Route optimized with ${routeWithDetails.length} places in ${dailySchedules.length} days. Score: ${optimizationScore.total_score}%`
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('❌ Optimization failed:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      execution_time_ms: Date.now() - startTime
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
