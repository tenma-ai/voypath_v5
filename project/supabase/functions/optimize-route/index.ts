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
  // Distance calculation for transport mode determination
  // 距離ベースの判定を優先（空港であっても近距離は車を使用）
  if (distance <= 2) {
    // Walking for short distances
    return 'walking';
  }
  if (distance <= 500) {
    // Car for medium distances
    return 'car';
  }
  // 長距離の場合のみ飛行機を使用
  // Flight for long distances
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
  // ユーザーごとにグループ化
  const userGroups = new Map();
  places.forEach((place)=>{
    if (place.source !== 'system' && 
        place.category !== 'departure_point' && 
        place.category !== 'destination_point' &&
        place.place_type !== 'system_airport') {
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
    // User preference normalization completed
  });
  return places;
}
// 場所の絞り込み（公平性考慮）
function filterPlacesByFairness(places, maxPlaces, availableDays = null) {
  // システムプレース（出発地・帰国地・システム空港）を除外し、my placesのみを絞り込み対象とする
  const systemPlaces = places.filter((p)=>
    p.source === 'system' || 
    p.category === 'departure_point' || 
    p.category === 'destination_point' ||
    p.place_type === 'system_airport'
  );
  const visitPlaces = places.filter((p)=>
    p.source !== 'system' && 
    p.category !== 'departure_point' && 
    p.category !== 'destination_point' &&
    p.place_type !== 'system_airport'
  );
  
  // If available days is specified, calculate max places based on time constraints
  let effectiveMaxPlaces = maxPlaces;
  if (availableDays !== null) {
    // Assume max 10 hours of activities per day (600 minutes)
    const maxMinutesPerDay = 600;
    const totalAvailableMinutes = availableDays * maxMinutesPerDay;
    
    // Calculate average stay time + travel time per place
    const avgStayTime = visitPlaces.reduce((sum, p) => sum + (p.stay_duration_minutes || 120), 0) / visitPlaces.length || 120;
    const avgTravelTime = 60; // Assume 60 minutes average travel between places
    const avgTimePerPlace = avgStayTime + avgTravelTime;
    
    // Calculate max places that can fit in available days
    const timeBasedMaxPlaces = Math.floor(totalAvailableMinutes / avgTimePerPlace);
    effectiveMaxPlaces = Math.min(maxPlaces, timeBasedMaxPlaces);
    
    // 時間制約でさらに絞り込みが必要な場合のログ
    if (timeBasedMaxPlaces < maxPlaces) {
      console.log(`⚠️ Time constraint applied: ${maxPlaces} → ${timeBasedMaxPlaces} places (${availableDays} days available)`);
    }
  }
  
  // 時間制約内に収まる場合はそのまま返す
  if (visitPlaces.length <= effectiveMaxPlaces - systemPlaces.length) {
    return places;
  }
  
  // 公平性を考慮したラウンドロビン方式で選択
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
  const maxVisitPlaces = effectiveMaxPlaces - systemPlaces.length;
  
  // メンバー数を考慮した公平性重み計算
  const memberCount = userGroups.size;
  const fairnessWeight = Math.max(0.5, 1.0 - (memberCount * 0.1)); // メンバー数が多いほど公平性を重視
  
  // ラウンドロビンで選択（公平性を保証）
  let round = 0;
  while(selectedVisitPlaces.length < maxVisitPlaces && Array.from(userGroups.values()).some((arr)=>arr.length > 0)){
    // 各ラウンドでメンバー間の公平性をチェック
    const currentUserCounts = new Map();
    selectedVisitPlaces.forEach(place => {
      currentUserCounts.set(place.user_id, (currentUserCounts.get(place.user_id) || 0) + 1);
    });
    
    for (const [userId, userPlaces] of userGroups){
      if (userPlaces.length > 0 && selectedVisitPlaces.length < maxVisitPlaces) {
        const currentCount = currentUserCounts.get(userId) || 0;
        const maxCount = Math.max(...Array.from(currentUserCounts.values()), 0);
        
        // 公平性チェック：現在のユーザーが他のユーザーより極端に少ない場合は優先選択
        const fairnessRatio = maxCount > 0 ? currentCount / maxCount : 1.0;
        const shouldSelect = fairnessRatio >= fairnessWeight || selectedVisitPlaces.length === 0;
        
        if (shouldSelect) {
          const selectedPlace = userPlaces.shift();
          selectedPlace.selection_round = round + 1; // Track which round this place was selected
          selectedVisitPlaces.push(selectedPlace);
        }
      }
    }
    round++;
    
    // 無限ループ防止
    if (round > 100) {
      console.warn("⚠️ Round limit reached in place selection");
      break;
    }
  }
  
  // 公平性統計の計算とログ出力
  const userSelections = new Map();
  selectedVisitPlaces.forEach(place => {
    userSelections.set(place.user_id, (userSelections.get(place.user_id) || 0) + 1);
  });
  
  const selectionCounts = Array.from(userSelections.values());
  const minSelections = Math.min(...selectionCounts);
  const maxSelections = Math.max(...selectionCounts);
  const fairnessScore = minSelections / maxSelections;
  
  console.log(`✅ Fair selection completed: ${selectedVisitPlaces.length}/${maxVisitPlaces} places selected`);
  console.log(`📊 Fairness score: ${fairnessScore.toFixed(2)} (${minSelections}-${maxSelections} per member)`);
  
  return [
    ...systemPlaces,
    ...selectedVisitPlaces
  ];
}
// Enhanced duplicate removal with longest stay time preference and color blending
function removeDuplicatePlaces(places) {
  const uniquePlacesMap = new Map();
  const duplicateGroups = new Map();
  
  // Group places by location key
  for (const place of places) {
    const placeKey = `${place.latitude.toFixed(4)}-${place.longitude.toFixed(4)}-${place.name}`;
    
    if (!duplicateGroups.has(placeKey)) {
      duplicateGroups.set(placeKey, []);
    }
    duplicateGroups.get(placeKey).push(place);
  }
  
  // Process each group and merge duplicates
  for (const [placeKey, groupPlaces] of duplicateGroups) {
    if (groupPlaces.length === 1) {
      uniquePlacesMap.set(placeKey, groupPlaces[0]);
    } else {
      // Multiple places at same location - merge them
      // Multiple places at same location - merge them
      
      // Find place with longest stay duration
      const longestStay = groupPlaces.reduce((max, place) => 
        (place.stay_duration_minutes || 120) > (max.stay_duration_minutes || 120) ? place : max
      );
      
      // Collect all contributors for color blending
      const contributors = groupPlaces.map(p => ({
        user_id: p.user_id,
        display_color_hex: p.display_color_hex || '#0077BE',
        wish_level: p.wish_level || 3
      }));
      
      // Create merged place with enhanced properties
      const mergedPlace = {
        ...longestStay,
        stay_duration_minutes: longestStay.stay_duration_minutes,
        wish_level: Math.max(...groupPlaces.map(p => p.wish_level || 3)),
        contributors: contributors,
        contributor_count: contributors.length,
        // Set color type based on contributor count
        color_type: contributors.length === 1 ? 'single' : 
                   contributors.length <= 4 ? 'gradient' : 'popular',
        display_color_hex: contributors.length === 1 ? contributors[0].display_color_hex :
                          contributors.length <= 4 ? blendColors(contributors.map(c => c.display_color_hex)) :
                          '#FFD700' // Gold for popular places
      };
      
      uniquePlacesMap.set(placeKey, mergedPlace);
    }
  }
  
  return Array.from(uniquePlacesMap.values());
}

// Helper function to blend multiple colors for gradient effect
function blendColors(hexColors) {
  if (hexColors.length === 1) return hexColors[0];
  if (hexColors.length === 0) return '#0077BE';
  
  // Convert hex to RGB
  const rgbColors = hexColors.map(hex => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  });
  
  // Average the RGB values
  const avgR = Math.round(rgbColors.reduce((sum, color) => sum + color.r, 0) / rgbColors.length);
  const avgG = Math.round(rgbColors.reduce((sum, color) => sum + color.g, 0) / rgbColors.length);
  const avgB = Math.round(rgbColors.reduce((sum, color) => sum + color.b, 0) / rgbColors.length);
  
  // Convert back to hex
  return `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`;
}
// 空港検出・挿入（シンプル版）
async function insertAirportsIfNeeded(supabase, places) {
  // Log message
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
        // Log: `✈️ Flight needed: ${currentPlace.name} → ${nextPlace.name} (${distance.toFixed(1)}km)`);
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
              place_type: 'system_airport',
              source: 'system',
              stay_duration_minutes: 120,
              wish_level: 1,
              user_id: null,
              is_airport: true,
              airport_code: depAirport.iata_code
            };
            newRoute.push(depAirportPlace);
            // Log message
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
              place_type: 'system_airport',
              source: 'system',
              stay_duration_minutes: 120,
              wish_level: 1,
              user_id: null,
              is_airport: true,
              airport_code: arrAirport.iata_code
            };
            newRoute.push(arrAirportPlace);
            // Log message
          }
        }
      }
    }
  }
  // Log: `✅ Route with airports: ${newRoute.map((p)=>p.name).join(' → ')}`);
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
  // 国際空港を示すキーワード（現在未使用だが将来の拡張用）
  // const internationalKeywords = [
  //   'international', 
  //   'intl',
  //   'airport'
  // ];
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
    // Log message
    // OpenFlights データベースから空港データを取得
    const airportsData = await fetchOpenFlightsData();
    if (!airportsData || airportsData.length === 0) {
      // Log message
      return await findNearestAirportFallback(lat, lng);
    }
    // 商用国際空港のみをフィルタ（厳格な条件）
    const commercialAirports = airportsData.filter((airport)=>airport.iata && airport.iata !== '\\N' && airport.iata.length === 3 && Math.abs(airport.latitude) > 0 && Math.abs(airport.longitude) > 0 && // 国際空港のフィルタリング条件
      isInternationalAirport(airport));
    if (commercialAirports.length === 0) {
      // Log message
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
    // Log: `🛫 Found nearest airport: ${nearest.name} (${nearest.iata}) - Distance: ${minDistance.toFixed(1)}km`);
    return {
      iata_code: nearest.iata,
      airport_name: nearest.name,
      city_name: nearest.city,
      latitude: nearest.latitude,
      longitude: nearest.longitude,
      commercial_service: true
    };
  } catch (error) {
    // Error occurred
    return await findNearestAirportFallback(lat, lng);
  }
}
// OpenFlights データの取得
async function fetchOpenFlightsData() {
  try {
    // Log message
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
    // Log message
    return airports;
  } catch (error) {
    // Error occurred
    return [];
  }
}
// フォールバック用の主要空港検索
async function findNearestAirportFallback(lat, lng) {
  // Log message
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
  // Log: `🛫 Fallback: Selected ${nearest.airport_name} (${nearest.iata_code}) - Distance: ${minDistance.toFixed(1)}km`);
  return {
    ...nearest,
    commercial_service: true
  };
}
// シンプルなTSP（最短距離貪欲法）
function optimizeRouteOrder(places) {
  // Log message
  // Log: `  Input places: ${places.map((p)=>`${p.name}(${p.place_type})`).join(', ')}`);
  if (places.length <= 2) return places;
  const departure = places.find((p)=>p.source === 'system' && p.category === 'departure_point');
  const destination = places.find((p)=>p.source === 'system' && p.category === 'destination_point');
  const others = places.filter((p)=>
    (p.source !== 'system' || (p.category !== 'departure_point' && p.category !== 'destination_point')) &&
    p.place_type !== 'system_airport'
  );
  // Log message
  // Log message
  // Log: `  Others: ${others.map((p)=>p.name).join(', ')}`);
  const route = [];
  // 出発地を最初に
  if (departure) {
    route.push(departure);
    // Log message
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
    // Log message
    // Log message
    // 往復判定：名前に明確に「same as departure」が含まれる場合のみ往復として扱う
    const isExplicitRoundTrip = destName.toLowerCase().includes('same as departure');
    if (isExplicitRoundTrip && departure) {
      // 復路として出発地のコピーを作成
      const returnPlace = {
        ...departure,
        id: `return_${departure.id}`,
        name: `Return to ${depName}`,
        source: 'system',
        category: 'destination_point'
      };
      route.push(returnPlace);
      // Log message
    } else {
      // 通常の目的地として追加
      route.push(destination);
      // Log message
    }
  } else {
    // Log message
  }
  // Log: `✅ Route optimized: ${route.map((p)=>p.name).join(' → ')}`);
  return route;
}
// 移動時間・移動手段の計算
function calculateRouteDetails(places) {
  // Log message
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
    // Log: `${prev.name} → ${curr.name}: ${distance.toFixed(1)}km, ${transportMode}, ${travelTime}min`);
  }
  return route;
}
// 日別スケジュール分割（時間制約対応強化）
function createDailySchedule(places, tripStartDate = null, availableDays = null) {
  const maxDailyHours = 10; // 1日最大10時間（より現実的に調整）
  const maxDailyMinutes = maxDailyHours * 60;
  const schedules = [];
  let currentDay = 1;
  let currentPlaces = [];
  let currentTime = 0;
  let timeCounter = 9 * 60; // 9:00 AMから開始
  
  // 時間制約チェック用の変数
  let skippedPlaces = [];
  let totalProcessedTime = 0;
  
  for(let i = 0; i < places.length; i++){
    const place = places[i];
    const placeTime = place.stay_duration_minutes + (place.travel_time_from_previous || 0);
    
    // Check if we've exceeded available days
    if (availableDays !== null && currentDay > availableDays) {
      console.log(`⚠️ Reached trip duration limit (${availableDays} days). Remaining ${places.length - i} places will be skipped.`);
      skippedPlaces = places.slice(i);
      break;
    }
    
    // フライトの場合は到着が翌日になるので新しい日を作成
    if (place.transport_mode === 'flight' && currentPlaces.length > 0) {
      // 現在の日を完了
      schedules.push(createDaySchedule(currentDay, currentPlaces, tripStartDate));
      currentDay++;
      currentPlaces = [];
      currentTime = 0;
      timeCounter = 9 * 60; // 翌日の9:00 AMから開始
    } else if (currentTime + placeTime > maxDailyMinutes && currentPlaces.length > 0) {
      schedules.push(createDaySchedule(currentDay, currentPlaces, tripStartDate));
      currentDay++;
      currentPlaces = [];
      currentTime = 0;
      timeCounter = 9 * 60; // リセット
    }
    
    // Check again if we've exceeded available days after creating a new day
    if (availableDays !== null && currentDay > availableDays) {
      console.log(`⚠️ Reached trip duration limit (${availableDays} days) after day creation. Remaining ${places.length - i} places will be skipped.`);
      skippedPlaces = places.slice(i);
      break;
    }
    
    // システムプレース（出発地・帰国地）は必ず含める
    const isSystemPlace = place.source === 'system' && (place.category === 'departure_point' || place.category === 'destination_point');
    
    // 時間設定 - 1日の時間制限を適用
    if (place.travel_time_from_previous) {
      timeCounter += place.travel_time_from_previous;
    }
    // 1日の終了時刻（20:00 = 1200分）を超えないよう制限（より現実的に）
    const maxDayEndTime = 20 * 60; // 20:00
    const arrival = Math.min(timeCounter, maxDayEndTime);
    place.arrival_time = formatTime(arrival);
    // 滞在時間を追加（ただし翌日にまたがらないよう調整）
    const stayDuration = Math.min(place.stay_duration_minutes, maxDayEndTime - arrival);
    timeCounter = arrival + stayDuration;
    place.departure_time = formatTime(timeCounter);
    place.order_in_day = currentPlaces.length + 1;
    
    // システムプレースは常に追加、それ以外は時間制約をチェック
    if (isSystemPlace || (availableDays === null || currentDay <= availableDays)) {
      currentPlaces.push(place);
      currentTime += placeTime;
      totalProcessedTime += placeTime;
    } else {
      skippedPlaces.push(place);
    }
  }
  
  // 最後の日を追加（日数制限内の場合のみ）
  if (currentPlaces.length > 0 && (availableDays === null || currentDay <= availableDays)) {
    schedules.push(createDaySchedule(currentDay, currentPlaces, tripStartDate));
  }
  
  // スキップされた場所の情報をログ出力
  if (skippedPlaces.length > 0) {
    console.log(`⚠️ ${skippedPlaces.length} places were skipped due to time constraints:`);
    skippedPlaces.forEach(place => {
      console.log(`  - ${place.name} (${place.user_id}, wish_level: ${place.normalized_wish_level || 'N/A'})`);
    });
    
    // 公平性に配慮した代替提案のためのデータを保存
    const skippedByUser = new Map();
    skippedPlaces.forEach(place => {
      if (!skippedByUser.has(place.user_id)) {
        skippedByUser.set(place.user_id, []);
      }
      skippedByUser.get(place.user_id).push(place);
    });
    
    console.log(`📊 Skipped places by member: ${Array.from(skippedByUser.entries()).map(([userId, places]) => `${userId}:${places.length}`).join(', ')}`);
  }
  
  console.log(`✅ Created ${schedules.length} daily schedules (limit was ${availableDays || 'none'} days)`);
  console.log(`⏱️ Total processed time: ${Math.round(totalProcessedTime / 60)}h ${totalProcessedTime % 60}m`);
  
  return schedules;
}
function createDaySchedule(day, places, tripStartDate = null) {
  let date;
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
    total_travel_time: places.reduce((sum, p)=>sum + (p.travel_time_from_previous || 0), 0),
    total_visit_time: places.reduce((sum, p)=>sum + p.stay_duration_minutes, 0),
    meal_breaks: []
  };
}
function formatTime(minutes) {
  // Handle invalid inputs
  if (typeof minutes !== 'number' || minutes < 0) {
    return '09:00:00';
  }
  // Cap hours at 23:59:59 to prevent invalid time formats
  const maxMinutesPerDay = 23 * 60 + 59; // 1439 minutes = 23:59
  const cappedMinutes = Math.min(minutes, maxMinutesPerDay);
  const hours = Math.floor(cappedMinutes / 60);
  const mins = cappedMinutes % 60;
  // Ensure hours are within valid range (0-23)
  const validHours = Math.max(0, Math.min(23, hours));
  return `${validHours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:00`;
}
// 最適化結果の検証
function validateOptimizationResult(places, schedules) {
  // Log message
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
  // Schedule validation complete
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
  const visitPlaces = places.filter((p)=>
    p.source !== 'system' && 
    p.category !== 'departure_point' && 
    p.category !== 'destination_point' &&
    p.place_type !== 'system_airport'
  );
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
  // Log: `📊 Score calculation: efficiency=${efficiency.toFixed(2)}, wish=${avgNormalizedWish.toFixed(2)}, fairness=${fairness.toFixed(2)}, feasibility=${feasibility.toFixed(2)}, total=${totalScore.toFixed(1)}%`);
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
    // Log message
    const { trip_id, member_id, user_places, constraints } = await req.json();
    if (!trip_id || !member_id) {
      throw new Error('Missing trip_id or member_id');
    }
    // Log message
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    
    // Get trip details including dates
    const { data: tripData, error: tripError } = await supabase
      .from('trips')
      .select('start_date, end_date')
      .eq('id', trip_id)
      .single();
    
    if (tripError || !tripData) {
      throw new Error(`Failed to get trip details: ${tripError?.message || 'Trip not found'}`);
    }
    
    // Calculate available days
    let availableDays = 1;
    if (tripData.start_date && tripData.end_date) {
      const startDate = new Date(tripData.start_date);
      const endDate = new Date(tripData.end_date);
      availableDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    }
    // Log message
    
    // データベースから場所を取得（user_placesが提供されていない場合）
    let places = user_places;
    if (!places || places.length === 0) {
      const { data, error } = await supabase.from('places').select('*').eq('trip_id', trip_id);
      if (error) throw new Error(`Database error: ${error.message}`);
      places = data || [];
    }
    
    // Remove duplicates and merge places at the same location
    // Log message
    places = removeDuplicatePlaces(places);
    // Log message
    if (places.length === 0) {
      throw new Error('No places found for optimization');
    }
    // Log message
    // デバッグ: 入力データの詳細をログ出力
    places.forEach((place, index)=>{
      // Log: `  Place ${index + 1}: ${place.name} (type: ${place.place_type}, stay: ${place.stay_duration_minutes}min, lat: ${place.latitude}, lng: ${place.longitude})`);
    });
    // 1. 滞在時間の正規化と確認（stay_duration_minutesが適切に設定されているか）
    // Log message
    places.forEach((place, index)=>{
      // 空港の場合は120分に固定、それ以外はユーザー設定値を使用
      if (place.category === 'airport') {
        place.stay_duration_minutes = 120;
        // Log message
      } else if (!place.stay_duration_minutes || place.stay_duration_minutes <= 0) {
        // stay_duration_minutesが設定されていない場合のデフォルト値
        place.stay_duration_minutes = 60; // 1時間デフォルト
        // Log message
      } else {
        // Log message
      }
    });
    // 2. 希望度の正規化（必須機能）
    const normalizedPlaces = normalizePreferences(places);
    // 3. 場所の絞り込み（公平性考慮）- Remove time-based filtering to include all places
    const maxPlaces = constraints?.max_places || 50; // Increase default limit
    const filteredPlaces = filterPlacesByFairness(normalizedPlaces, maxPlaces, null);
    // 4. 出発地・目的地の固定（必須機能）
    const departure = filteredPlaces.find((p)=>p.source === 'system' && p.category === 'departure_point');
    const destination = filteredPlaces.find((p)=>p.source === 'system' && p.category === 'destination_point');
    // Log message
    // 5. ルート最適化（TSP）- 基本的な場所のみで実行
    const optimizedRoute = optimizeRouteOrder(filteredPlaces);
    // 6. 最適化されたルートに長距離移動用の空港を挿入
    const routeWithAirports = await insertAirportsIfNeeded(supabase, optimizedRoute);
    // 7. 移動時間・移動手段計算
    const routeWithDetails = calculateRouteDetails(routeWithAirports);
    // 8. 日別スケジュール作成 - Pass trip start date with no date constraints to include all places
    const dailySchedules = createDailySchedule(routeWithDetails, tripData.start_date, null);
    // 9. 最適化スコア計算
    const optimizationScore = calculateOptimizationScore(routeWithDetails, dailySchedules);
    const executionTime = Date.now() - startTime;
    
    // Update places in database to mark which were selected
    // Log message
    const selectedPlaceIds = new Set(routeWithDetails.map(p => p.id));
    const allPlaceIds = places.map(p => p.id);
    
    // Mark selected places
    if (selectedPlaceIds.size > 0) {
      const { error: updateSelectedError } = await supabase
        .from('places')
        .update({ 
          is_selected_for_optimization: true,
          selection_round: null // Will be updated below for round-robin selected places
        })
        .in('id', Array.from(selectedPlaceIds));
      
      if (updateSelectedError) {
        // Error occurred
      }
    }
    
    // Mark unselected places
    const unselectedIds = allPlaceIds.filter(id => !selectedPlaceIds.has(id));
    if (unselectedIds.length > 0) {
      const { error: updateUnselectedError } = await supabase
        .from('places')
        .update({ 
          is_selected_for_optimization: false,
          selection_round: null
        })
        .in('id', unselectedIds);
      
      if (updateUnselectedError) {
        // Error occurred
      }
    }
    
    // Update selection round for places that have it
    for (const place of routeWithDetails) {
      if (place.selection_round) {
        const { error: roundError } = await supabase
          .from('places')
          .update({ selection_round: place.selection_round })
          .eq('id', place.id);
        
        if (roundError) {
          // Error occurred
        }
      }
    }
    
    // 10. 結果保存
    // Log message
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
      // Error occurred
    // 保存に失敗してもレスポンスは返す（一時的なメモリ結果として）
    } else {
      // Log message
    }
    // Log message
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
    // Error occurred
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
