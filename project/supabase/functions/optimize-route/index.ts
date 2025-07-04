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

// 移動時間の計算（実距離ベース版）
function calculateTravelTime(distance, mode) {
  if (mode === 'flight') {
    // 実際の距離に基づくフライト時間計算（時速700km）
    const flightHours = distance / 700; // 時速700km
    const flightMinutes = Math.round(flightHours * 60);
    
    // 空港手続き時間を追加
    let airportTime = 60; // 基本1時間
    if (distance > 3000) {
      airportTime = 90; // 国際線長距離は1.5時間
    }
    
    const totalTime = flightMinutes + airportTime;
    console.log(`✈️ Flight time calculation: ${distance.toFixed(1)}km ÷ 700km/h = ${flightHours.toFixed(1)}h (${flightMinutes}min) + airport (${airportTime}min) = ${totalTime}min total`);
    
    return totalTime;
  }
  
  const speeds = {
    walking: 5,
    car: 60, // 現実的な速度（渋滞考慮）
    flight: 700 // 上記で処理
  };
  
  const baseTime = distance / speeds[mode] * 60; // 分単位
  const overhead = {
    walking: 5,
    car: 10,
    flight: 0
  };
  
  return Math.round(baseTime + overhead[mode]);
}

// 希望度の正規化（必須機能）
function normalizePreferences(places) {
  // ユーザーごとにグループ化
  const userGroups = new Map();
  places.forEach((place) => {
    // システムプレースを除外（source=system OR 特定カテゴリ OR システム空港）
    const isSystemPlace = (
      place.source === 'system' || 
      place.category === 'departure_point' || 
      place.category === 'final_destination' ||
      place.place_type === 'system_airport'
    );
    
    if (!isSystemPlace) {
      if (!userGroups.has(place.user_id)) {
        userGroups.set(place.user_id, []);
      }
      userGroups.get(place.user_id).push(place);
    }
  });
  
  // 各ユーザーの希望度を正規化
  userGroups.forEach((userPlaces, userId) => {
    const avgWish = userPlaces.reduce((sum, p) => sum + p.wish_level, 0) / userPlaces.length;
    userPlaces.forEach((place) => {
      place.normalized_wish_level = place.wish_level / avgWish;
    });
    // User preference normalization completed
  });
  return places;
}

// 場所の絞り込み（公平性考慮） - 時間制約部分を削除
function filterPlacesByFairness(places, maxPlaces) {
  // システムプレース（出発地・帰国地・復路・システム空港）を除外し、my placesのみを絞り込み対象とする
  const systemPlaces = places.filter((p) => 
    p.source === 'system' || 
    p.category === 'departure_point' || 
    p.category === 'final_destination' ||
    p.place_type === 'system_airport'
  );
  const visitPlaces = places.filter((p) => 
    p.source !== 'system' && 
    p.category !== 'departure_point' && 
    p.category !== 'final_destination' &&
    p.place_type !== 'system_airport'
  );
  
  // 場所数が制限内に収まる場合はそのまま返す
  if (visitPlaces.length <= maxPlaces - systemPlaces.length) {
    return places;
  }
  
  // 公平性を考慮したラウンドロビン方式で選択
  const userGroups = new Map();
  visitPlaces.forEach((place) => {
    if (!userGroups.has(place.user_id)) {
      userGroups.set(place.user_id, []);
    }
    userGroups.get(place.user_id).push(place);
  });
  
  // 各ユーザーの場所を希望度順にソート
  userGroups.forEach((places) => {
    places.sort((a, b) => (b.normalized_wish_level || 1) - (a.normalized_wish_level || 1));
  });
  
  const selectedVisitPlaces = [];
  const maxVisitPlaces = maxPlaces - systemPlaces.length;
  
  // メンバー数を考慮した公平性重み計算
  const memberCount = userGroups.size;
  const fairnessWeight = Math.max(0.5, 1.0 - memberCount * 0.1); // メンバー数が多いほど公平性を重視
  
  // ラウンドロビンで選択（公平性を保証）
  let round = 0;
  while (selectedVisitPlaces.length < maxVisitPlaces && Array.from(userGroups.values()).some((arr) => arr.length > 0)) {
    // 各ラウンドでメンバー間の公平性をチェック
    const currentUserCounts = new Map();
    selectedVisitPlaces.forEach((place) => {
      currentUserCounts.set(place.user_id, (currentUserCounts.get(place.user_id) || 0) + 1);
    });
    
    for (const [userId, userPlaces] of userGroups) {
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
  selectedVisitPlaces.forEach((place) => {
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
      const longestStay = groupPlaces.reduce((max, place) => (place.stay_duration_minutes || 120) > (max.stay_duration_minutes || 120) ? place : max);
      
      // Collect all contributors for color blending
      const contributors = groupPlaces.map((p) => ({
        user_id: p.user_id,
        display_color_hex: p.display_color_hex || '#0077BE',
        wish_level: p.wish_level || 3
      }));
      
      // Create merged place with enhanced properties
      const mergedPlace = {
        ...longestStay,
        stay_duration_minutes: longestStay.stay_duration_minutes,
        wish_level: Math.max(...groupPlaces.map((p) => p.wish_level || 3)),
        contributors: contributors,
        contributor_count: contributors.length,
        // Set color type based on contributor count
        color_type: contributors.length === 1 ? 'single' : contributors.length <= 4 ? 'gradient' : 'popular',
        display_color_hex: contributors.length === 1 ? contributors[0].display_color_hex : contributors.length <= 4 ? blendColors(contributors.map((c) => c.display_color_hex)) : '#FFD700' // Gold for popular places
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
  const rgbColors = hexColors.map((hex) => {
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

// スケジュールが日数制限内に収まるかチェック
function checkScheduleFitsInDays(schedules, availableDays) {
  if (!availableDays || availableDays <= 0) {
    return true; // 制限がない場合は常にOK
  }
  return schedules.length <= availableDays;
}

// ラウンドロビン方式で各ユーザーから1つずつ場所を削除
function removeOneRandomPlacePerUser(places) {
  // システムプレースは保護
  const systemPlaces = places.filter((p) => 
    p.source === 'system' || 
    p.category === 'departure_point' || 
    p.category === 'final_destination' ||
    p.place_type === 'system_airport'
  );
  
  const visitPlaces = places.filter((p) => 
    p.source !== 'system' && 
    p.category !== 'departure_point' && 
    p.category !== 'final_destination' &&
    p.place_type !== 'system_airport'
  );
  
  if (visitPlaces.length === 0) {
    return places; // 削除できる場所がない
  }
  
  // ユーザーごとにグループ化
  const userGroups = new Map();
  visitPlaces.forEach((place) => {
    if (!userGroups.has(place.user_id)) {
      userGroups.set(place.user_id, []);
    }
    userGroups.get(place.user_id).push(place);
  });
  
  // 各ユーザーから1つずつ削除（希望度の低いものから）
  const remainingVisitPlaces = [];
  userGroups.forEach((userPlaces, userId) => {
    // 希望度の低い順にソート
    userPlaces.sort((a, b) => (a.normalized_wish_level || 1) - (b.normalized_wish_level || 1));
    
    // 最初の1つを削除、残りを保持
    if (userPlaces.length > 1) {
      remainingVisitPlaces.push(...userPlaces.slice(1));
      console.log(`🗑️ Removed ${userPlaces[0].name} from user ${userId} (wish_level: ${userPlaces[0].normalized_wish_level || 'N/A'})`);
    } else if (userPlaces.length === 1) {
      // 最後の1つの場合は、全ユーザーが同じ状況になったら削除
      const allUsersHaveOne = Array.from(userGroups.values()).every(places => places.length <= 1);
      if (allUsersHaveOne) {
        // 全ユーザーが1つずつの場合、希望度の最も低いものを削除
        const allLastPlaces = Array.from(userGroups.values()).map(places => places[0]).filter(Boolean);
        allLastPlaces.sort((a, b) => (a.normalized_wish_level || 1) - (b.normalized_wish_level || 1));
        const toRemove = allLastPlaces[0];
        remainingVisitPlaces.push(...allLastPlaces.filter(place => place.id !== toRemove.id));
        console.log(`🗑️ Removed last place ${toRemove.name} from user ${toRemove.user_id} (lowest wish_level: ${toRemove.normalized_wish_level || 'N/A'})`);
      } else {
        remainingVisitPlaces.push(...userPlaces);
      }
    }
  });
  
  return [...systemPlaces, ...remainingVisitPlaces];
}

// 効率的な場所削除による日数制限対応（空港挿入を前倒し）
async function iterativelyOptimizeWithDateConstraints(places, availableDays, tripStartDate, supabase) {
  console.log(`🔄 Starting efficient optimization with ${places.length} places and ${availableDays} days limit (airports included, 8:00 start time)`);
  
  // 実行時間制限を考慮（50秒でタイムアウト - Edge Function限界の60秒より余裕を持たせる）
  const startTime = Date.now();
  const maxExecutionTime = 50000; // 50秒
  
  // システムプレースを事前に分離・保護（検出条件を強化）
  const systemPlaces = places.filter((p) => {
    const isSystem = (
      p.source === 'system' || 
      p.category === 'departure_point' || 
      p.category === 'final_destination' ||
      p.place_type === 'system_airport' ||
      (p.name && (p.name.toLowerCase().includes('departure') || p.name.toLowerCase().includes('destination')))
    );
    
    if (isSystem) {
      console.log(`🔍 Detected system place: ${p.name} (category: ${p.category}, source: ${p.source}, type: ${p.place_type})`);
    }
    
    return isSystem;
  });
  
  let userPlaces = places.filter((p) => {
    const isUser = !(
      p.source === 'system' || 
      p.category === 'departure_point' || 
      p.category === 'final_destination' ||
      p.place_type === 'system_airport' ||
      (p.name && (p.name.toLowerCase().includes('departure') || p.name.toLowerCase().includes('destination')))
    );
    
    // Skip logging for performance when many places
    if (isUser && userPlaces.length <= 20) {
      console.log(`👤 User place: ${p.name} (category: ${p.category || 'none'}, user: ${p.user_id})`);
    }
    
    return isUser;
  });
  
  console.log(`🔒 Protected ${systemPlaces.length} system places, optimizing ${userPlaces.length} user places`);
  systemPlaces.forEach(p => console.log(`  - System: ${p.name} (${p.category || p.place_type || 'unknown'})`));
  
  let iteration = 0;
  const maxIterations = Math.min(10, Math.ceil(userPlaces.length / 5)); // 場所数に応じて調整、最大10回
  
  // 事前計算でパフォーマンス向上
  let lastValidResult = null;
  
  while (iteration < maxIterations && userPlaces.length > 0) {
    iteration++;
    const elapsed = Date.now() - startTime;
    
    // 実行時間チェック
    if (elapsed > maxExecutionTime) {
      console.warn(`⏰ Execution time limit reached (${elapsed}ms), stopping optimization`);
      break;
    }
    
    // 現在のテスト用場所リストを作成（システムプレース + ユーザープレース）
    const currentTestPlaces = [...systemPlaces, ...userPlaces];
    console.log(`📅 Iteration ${iteration}: Testing ${currentTestPlaces.length} places (${userPlaces.length} user + ${systemPlaces.length} system, including airport insertion) (${elapsed}ms elapsed)`);
    
    try {
      // 1. ルート最適化
      const optimizedRoute = optimizeRouteOrder(currentTestPlaces);
      
      // 2. 空港挿入を期間判定前に実行
      console.log(`✈️ Adding airports before schedule creation`);
      const routeWithAirports = await insertAirportsIfNeeded(supabase, optimizedRoute);
      const routeWithDetails = calculateRouteDetails(routeWithAirports);
      
      // 3. 空港込みでスケジュール作成（ユーザー設定の日数制限付き）
      const dailySchedules = createDailySchedule(routeWithDetails, tripStartDate, availableDays);
      
      // 4. ユーザー設定の日数制限チェック
      const actualDays = dailySchedules.length;
      
      if (actualDays <= availableDays) {
        console.log(`✅ Schedule with airports fits in ${actualDays} days (user limit: ${availableDays} days) after ${iteration} iterations (${elapsed}ms)`);
        
        return {
          places: routeWithDetails,
          schedules: dailySchedules,
          iterations: iteration,
          removedPlacesCount: places.length - currentTestPlaces.length,
          executionTime: elapsed
        };
      }
      
      // 有効な結果として保存（空港込み）
      lastValidResult = {
        places: routeWithDetails,
        schedules: dailySchedules,
        iterations: iteration,
        removedPlacesCount: places.length - currentTestPlaces.length,
        executionTime: elapsed
      };
      
      // 5. ユーザー設定の日数を超過している場合、ユーザープレースのみを削除
      console.log(`❌ Schedule with airports requires ${actualDays} days (user limit: ${availableDays} days), removing user places...`);
      
      if (userPlaces.length === 0) {
        console.warn(`⚠️ No user places left to remove, schedule will exceed user time limit`);
        break;
      }
      
      // 効率的な場所削除（希望度の低いものから）
      userPlaces.sort((a, b) => (a.normalized_wish_level || 1) - (b.normalized_wish_level || 1));
      const toRemove = Math.max(1, Math.ceil(userPlaces.length * 0.3)); // 30%ずつ削除（より積極的に）
      const removed = userPlaces.splice(0, toRemove);
      
      console.log(`🗑️ Removed ${removed.length} user places`);
      // 詳細ログは場所が少ない時のみ
      if (removed.length <= 10) {
        removed.forEach(p => console.log(`  - ${p.name} (wish_level: ${p.normalized_wish_level || 'N/A'})`));
      }
      
    } catch (error) {
      console.error(`❌ Error in iteration ${iteration}:`, error.message);
      
      // エラー時は大胆に削除
      if (userPlaces.length > 0) {
        const removed = userPlaces.splice(0, Math.max(1, Math.ceil(userPlaces.length * 0.3)));
        console.log(`🚨 Error recovery: Removed ${removed.length} user places`);
      } else {
        console.error(`Cannot recover from error - no user places left`);
        break;
      }
    }
  }
  
  // 最善の努力結果を返す（すでに空港込み）
  if (lastValidResult) {
    console.warn(`⚠️ Returning best effort result after ${iteration} iterations (airports already included)`);
    
    return {
      places: lastValidResult.places,
      schedules: lastValidResult.schedules,
      iterations: iteration,
      removedPlacesCount: places.length - lastValidResult.places.length,
      warning: 'Could not fit all places in user-defined days - system places protected, some places removed to fit time constraint',
      executionTime: Date.now() - startTime
    };
  }
  
  // 最後の手段：システムプレースのみで構成
  console.warn(`🚨 Using system places only as last resort`);
  const systemOnlyRoute = optimizeRouteOrder(systemPlaces);
  const systemRouteWithDetails = calculateRouteDetails(systemOnlyRoute);
  
  // システムプレースのみでも日数制限を適用
  const systemSchedules = createDailySchedule(systemRouteWithDetails, tripStartDate, availableDays);
  
  return {
    places: systemRouteWithDetails,
    schedules: systemSchedules,
    iterations: iteration,
    removedPlacesCount: places.length - systemPlaces.length,
    warning: 'Only system places (departure/destination) could be included due to time constraints',
    executionTime: Date.now() - startTime
  };
}

// 空港検出・挿入（UUID対応版）
async function insertAirportsIfNeeded(supabase, places) {
  // Log message
  const newRoute = [];
  
  for (let i = 0; i < places.length; i++) {
    const currentPlace = places[i];
    newRoute.push(currentPlace);
    
    // 次の場所があるかチェック
    if (i < places.length - 1) {
      const nextPlace = places[i + 1];
      const distance = calculateDistance([currentPlace.latitude, currentPlace.longitude], [nextPlace.latitude, nextPlace.longitude]);
      const transportMode = determineTransportMode(distance, currentPlace.is_airport, nextPlace.is_airport);
      
      if (transportMode === 'flight') {
        // Log: `✈️ Flight needed: ${currentPlace.name} → ${nextPlace.name} (${distance.toFixed(1)}km)`);
        
        // 出発空港を追加（現在地が空港でない場合）
        if (!currentPlace.is_airport) {
          const depAirport = await findNearestAirport(supabase, currentPlace.latitude, currentPlace.longitude);
          if (depAirport) {
            const depAirportPlace = {
              id: `airport_${depAirport.iata_code}_dep_${Date.now()}`, // データベース更新除外用
              name: `${depAirport.airport_name} (${depAirport.iata_code})`,
              latitude: depAirport.latitude,
              longitude: depAirport.longitude,
              category: 'airport',
              place_type: 'system_airport',
              source: 'system',
              stay_duration_minutes: 90, // 短縮：90分
              wish_level: 1,
              user_id: null,
              is_airport: true,
              airport_code: depAirport.iata_code,
              is_generated: true // システム生成フラグ
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
              id: `airport_${arrAirport.iata_code}_arr_${Date.now()}`, // データベース更新除外用
              name: `${arrAirport.airport_name} (${arrAirport.iata_code})`,
              latitude: arrAirport.latitude,
              longitude: arrAirport.longitude,
              category: 'airport',
              place_type: 'system_airport',
              source: 'system',
              stay_duration_minutes: 90, // 短縮：90分
              wish_level: 1,
              user_id: null,
              is_airport: true,
              airport_code: arrAirport.iata_code,
              is_generated: true // システム生成フラグ
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
    'heliport', 'helipad', 'helicopter', 'naval', 'air force', 'military', 'army', 'navy', 'base',
    'station', 'field', 'private', 'restricted', 'closed', 'abandoned', 'seaplane', 'balloonport'
  ];
  
  // 名前に除外キーワードが含まれている場合は除外
  for (const keyword of excludeKeywords) {
    if (name.includes(keyword)) {
      return false;
    }
  }
  
  // タイプが明確に空港以外の場合は除外
  if (type && !type.includes('airport')) {
    return false;
  }
  
  // 主要な国際空港のIATAコード
  const majorInternationalAirports = [
    'NRT', 'HND', 'KIX', 'CTS', 'FUK', 'OKA',
    'JFK', 'LAX', 'ORD', 'DFW', 'DEN', 'SFO', 'SEA', 'LAS', 'PHX', 'IAH', 'CLT', 'MIA', 'BOS', 'MSP', 'DTW',
    'LHR', 'CDG', 'AMS', 'FRA', 'MAD', 'FCO', 'MUC', 'ZUR', 'VIE', 'CPH', 'ARN', 'OSL', 'HEL',
    'ICN', 'PVG', 'PEK', 'CAN', 'HKG', 'TPE', 'SIN', 'BKK', 'KUL', 'CGK', 'MNL',
    'DEL', 'BOM', 'SYD', 'MEL', 'BNE', 'PER', 'AKL', 'CHC',
    'DXB', 'DOH', 'AUH', 'KWI', 'JNB', 'CAI', 'ADD', 'LOS',
    'GRU', 'GIG', 'EZE', 'SCL', 'LIM', 'BOG', 'UIO',
    'YYZ', 'YVR', 'YUL', 'YYC'
  ];
  
  // 主要国際空港リストに含まれている場合は確実に含める
  if (majorInternationalAirports.includes(airport.iata)) {
    return true;
  }
  
  // 名前に"International"が含まれている場合
  if (name.includes('international') || name.includes('intl')) {
    return true;
  }
  
  // その他の大規模空港の条件
  if (name.includes('airport') && airport.iata && airport.iata.length === 3) {
    return true;
  }
  
  return false;
}

// OpenFlights データを使用した最寄り空港検索
async function findNearestAirport(supabase, lat, lng) {
  try {
    // Log message
    const airportsData = await fetchOpenFlightsData();
    if (!airportsData || airportsData.length === 0) {
      return await findNearestAirportFallback(lat, lng);
    }
    
    // 商用国際空港のみをフィルタ
    const commercialAirports = airportsData.filter((airport) => 
      airport.iata && 
      airport.iata !== '\\N' && 
      airport.iata.length === 3 && 
      Math.abs(airport.latitude) > 0 && 
      Math.abs(airport.longitude) > 0 && 
      isInternationalAirport(airport)
    );
    
    if (commercialAirports.length === 0) {
      return await findNearestAirportFallback(lat, lng);
    }
    
    // 最寄りの空港を検索
    let nearest = commercialAirports[0];
    let minDistance = calculateDistance([lat, lng], [nearest.latitude, nearest.longitude]);
    
    for (const airport of commercialAirports) {
      const distance = calculateDistance([lat, lng], [airport.latitude, airport.longitude]);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = airport;
      }
    }
    
    return {
      iata_code: nearest.iata,
      airport_name: nearest.name,
      city_name: nearest.city,
      latitude: nearest.latitude,
      longitude: nearest.longitude,
      commercial_service: true
    };
  } catch (error) {
    return await findNearestAirportFallback(lat, lng);
  }
}

// OpenFlights データの取得
async function fetchOpenFlightsData() {
  try {
    const response = await fetch('https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const csvData = await response.text();
    const lines = csvData.split('\n').filter((line) => line.trim());
    const airports = [];
    
    for (const line of lines) {
      if (line.trim()) {
        const parts = line.split(',').map((part) => part.replace(/"/g, '').trim());
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
    
    return airports;
  } catch (error) {
    return [];
  }
}

// フォールバック用の主要空港検索
async function findNearestAirportFallback(lat, lng) {
  const majorAirports = [
    { iata_code: 'NRT', airport_name: 'Narita International Airport', city_name: 'Tokyo', latitude: 35.7647, longitude: 140.3864 },
    { iata_code: 'HND', airport_name: 'Tokyo Haneda International Airport', city_name: 'Tokyo', latitude: 35.5523, longitude: 139.7800 },
    { iata_code: 'KIX', airport_name: 'Kansai International Airport', city_name: 'Osaka', latitude: 34.4273, longitude: 135.2444 },
    { iata_code: 'JFK', airport_name: 'John F Kennedy International Airport', city_name: 'New York', latitude: 40.6398, longitude: -73.7789 },
    { iata_code: 'LAX', airport_name: 'Los Angeles International Airport', city_name: 'Los Angeles', latitude: 33.9425, longitude: -118.4081 },
    { iata_code: 'LHR', airport_name: 'London Heathrow Airport', city_name: 'London', latitude: 51.4706, longitude: -0.461941 },
    { iata_code: 'CDG', airport_name: 'Charles de Gaulle International Airport', city_name: 'Paris', latitude: 49.0128, longitude: 2.55 },
    { iata_code: 'ICN', airport_name: 'Incheon International Airport', city_name: 'Seoul', latitude: 37.4691, longitude: 126.451 }
  ];
  
  let nearest = majorAirports[0];
  let minDistance = calculateDistance([lat, lng], [nearest.latitude, nearest.longitude]);
  
  for (const airport of majorAirports) {
    const distance = calculateDistance([lat, lng], [airport.latitude, airport.longitude]);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = airport;
    }
  }
  
  return {
    ...nearest,
    commercial_service: true
  };
}

// シンプルなTSP（最短距離貪欲法）- 順序修正版
function optimizeRouteOrder(places) {
  console.log(`🗺️ Optimizing route order for ${places.length} places`);
  
  if (places.length <= 2) return places;
  
  // 出発地と到着地の検出（強化版）
  const departure = places.find((p) => {
    const isDeparture = (
      (p.source === 'system' && p.category === 'departure_point') ||
      (p.category === 'departure_point') ||
      (p.name && p.name.toLowerCase().includes('departure'))
    );
    if (isDeparture) {
      console.log(`🛫 Found departure: ${p.name} (category: ${p.category})`);
    }
    return isDeparture;
  });
  
  const finalDestination = places.find((p) => {
    const isFinalDestination = (
      p.category === 'final_destination' ||
      (p.name && p.name.toLowerCase().includes('destination'))
    );
    if (isFinalDestination) {
      console.log(`🏁 Found final destination: ${p.name} (category: ${p.category})`);
    }
    return isFinalDestination;
  });
  
  // その他の場所（出発地・最終目的地・システム空港以外）
  const others = places.filter((p) => {
    const isOther = !(
      (p.source === 'system' && p.category === 'departure_point') ||
      (p.category === 'departure_point') ||
      (p.category === 'final_destination') ||
      p.place_type === 'system_airport' ||
      (p.name && (p.name.toLowerCase().includes('departure') || p.name.toLowerCase().includes('destination')))
    );
    
    if (isOther) {
      console.log(`📍 Other place: ${p.name}`);
    }
    
    return isOther;
  });
  
  console.log(`📊 Route composition: ${departure ? 1 : 0} departure + ${others.length} others + ${finalDestination ? 1 : 0} final destination`);
  
  const route = [];
  
  // 1. 出発地を最初に（必須）
  if (departure) {
    route.push(departure);
    console.log(`✅ Added departure at position 1: ${departure.name}`);
  } else {
    console.warn(`⚠️ No departure point found in ${places.length} places`);
  }
  
  // 2. 貪欲法で中間地点を最適化
  const remaining = [...others];
  let current = departure || (others.length > 0 ? others[0] : null);
  
  while (remaining.length > 0 && current) {
    let nearest = remaining[0];
    let minDistance = calculateDistance([current.latitude, current.longitude], [nearest.latitude, nearest.longitude]);
    
    for (let i = 1; i < remaining.length; i++) {
      const distance = calculateDistance([current.latitude, current.longitude], [remaining[i].latitude, remaining[i].longitude]);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = remaining[i];
      }
    }
    
    route.push(nearest);
    console.log(`📍 Added place at position ${route.length}: ${nearest.name}`);
    remaining.splice(remaining.indexOf(nearest), 1);
    current = nearest;
  }
  
  // 3. 最終目的地を最後に（必須）
  if (finalDestination) {
    const depName = departure?.name || '';
    const destName = finalDestination.name || '';
    
    // 往復判定：名前に明確に「same as departure」が含まれる場合のみ往復として扱う
    const isExplicitRoundTrip = destName.toLowerCase().includes('same as departure');
    
    // 座標チェック：destination座標が設定されていない場合の処理
    const hasValidCoordinates = finalDestination.latitude && finalDestination.longitude && 
                               Math.abs(finalDestination.latitude) > 0.001 && Math.abs(finalDestination.longitude) > 0.001;
    
    if (isExplicitRoundTrip && departure) {
      // 復路として出発地のコピーを作成
      const returnPlace = {
        ...departure,
        id: `return_${departure.id}`,
        name: `Return to ${depName}`,
        source: 'system',
        category: 'final_destination'
      };
      route.push(returnPlace);
      console.log(`🔄 Added return destination at position ${route.length}: ${returnPlace.name}`);
    } else if (!hasValidCoordinates && departure && !isExplicitRoundTrip) {
      // 座標が設定されていない実際の目的地の場合：往復として扱う（フォールバック）
      console.warn(`⚠️ Destination "${destName}" has no valid coordinates - treating as round trip to departure`);
      const returnPlace = {
        ...departure,
        id: `return_${departure.id}`,
        name: `Return to ${depName} (fallback for ${destName})`,
        source: 'system',
        category: 'final_destination',
        original_destination_name: destName
      };
      route.push(returnPlace);
      console.log(`🔄 Added fallback return destination at position ${route.length}: ${returnPlace.name}`);
    } else {
      // 通常の目的地として追加（座標が有効な場合）
      route.push(finalDestination);
      console.log(`🏁 Added final destination at position ${route.length}: ${finalDestination.name} (lat: ${finalDestination.latitude}, lng: ${finalDestination.longitude})`);
    }
  } else {
    console.warn(`⚠️ No final destination found in ${places.length} places`);
  }
  
  console.log(`✅ Route optimized: ${route.map((p, i) => `${i+1}.${p.name}`).join(' → ')}`);
  
  return route;
}

// 移動時間・移動手段の計算
function calculateRouteDetails(places) {
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

// 日別スケジュール分割（適切な時間計算版）
function createDailySchedule(places, tripStartDate = null, availableDays = null) {
  const maxDailyHours = 10; // 1日最大10時間
  const maxDailyMinutes = maxDailyHours * 60;
  const schedules = [];
  let currentDay = 1;
  let currentPlaces = [];
  let currentTime = 0;
  let timeCounter = 8 * 60; // 8:00 AMから開始
  
  // 時間制約チェック用の変数
  let skippedPlaces = [];
  let totalProcessedTime = 0;
  
  console.log(`📅 Scheduling ${places.length} places with ${availableDays} days limit`);
  console.log(`🗺️ Route order: ${places.map(p => p.name).join(' → ')}`);
  
  for (let i = 0; i < places.length; i++) {
    const place = places[i];
    const placeTime = place.stay_duration_minutes + (place.travel_time_from_previous || 0);
    
    // 最終目的地判定を最初に行う
    const isFinalDestination = place.category === 'final_destination';
    
    // システムプレース判定を強化（出発地・最終目的地・システム空港は絶対保護）
    const isSystemPlace = (
      place.source === 'system' || 
      place.category === 'departure_point' || 
      place.category === 'final_destination' ||
      place.place_type === 'system_airport' ||
      (place.id && place.id.toString().startsWith('airport_')) ||
      (place.id && place.id.toString().startsWith('return_'))
    );
    
    // フライトの場合の処理
    if (place.transport_mode === 'flight' && currentPlaces.length > 0) {
      // フライト自体を当日に含める
      const flightStartTime = timeCounter + (place.travel_time_from_previous || 0);
      const flightEndTime = flightStartTime + place.stay_duration_minutes;
      
      place.arrival_time = formatTime(flightStartTime);
      place.departure_time = formatTime(flightEndTime);
      place.order_in_day = currentPlaces.length + 1;
      currentPlaces.push(place);
      
      // フライト終了後の時刻を計算
      timeCounter = flightEndTime;
      currentTime += place.stay_duration_minutes + (place.travel_time_from_previous || 0);
      
      // フライト後まだ時間がある場合（20:00前）は同日続行、そうでなければ翌日へ
      const maxDayEndTime = 20 * 60; // 20:00
      if (timeCounter >= maxDayEndTime) {
        // 時間が遅いので翌日へ
        schedules.push(createDaySchedule(currentDay, currentPlaces, tripStartDate));
        currentDay++;
        currentPlaces = [];
        currentTime = 0;
        timeCounter = 8 * 60; // 翌日の8:00 AMから観光開始
      }
      // 時間がある場合は同日続行（何もしない）
      continue; // この場所の処理は完了したので次へ
    } else if (currentTime + placeTime > maxDailyMinutes && currentPlaces.length > 0) {
      // Final destinationの場合は、前の場所の時間から続けて同じ日に配置するかチェック
      if (isFinalDestination && currentPlaces.length > 0) {
        const lastPlace = currentPlaces[currentPlaces.length - 1];
        if (lastPlace && lastPlace.departure_time) {
          const [hours, minutes] = lastPlace.departure_time.split(':').map(Number);
          const lastPlaceEndTime = hours * 60 + minutes;
          const finalDestinationArrival = lastPlaceEndTime + (place.travel_time_from_previous || 0);
          
          // 20:00 (1200分) 以前なら同じ日に配置
          if (finalDestinationArrival <= 20 * 60) {
            console.log(`🎯 Final destination fits on same day: arrival at ${formatTime(finalDestinationArrival)}`);
            // 新しい日を作らずに、同じ日に続ける
            timeCounter = finalDestinationArrival;
          } else {
            // 20:00を過ぎるので翌日へ
            schedules.push(createDaySchedule(currentDay, currentPlaces, tripStartDate));
            currentDay++;
            currentPlaces = [];
            currentTime = 0;
            timeCounter = 8 * 60; // 翌日は8:00から開始
          }
        }
      } else {
        // 通常の場所の場合、新しい日を作成
        schedules.push(createDaySchedule(currentDay, currentPlaces, tripStartDate));
        currentDay++;
        currentPlaces = [];
        currentTime = 0;
        timeCounter = 8 * 60; // 朝8時から活動開始
      }
    }
    
    // 最終目的地は通常の順序でスケジューリング（強制的に最終日にしない）
    if (isFinalDestination) {
      console.log(`🎯 Processing final destination ${place.name} in normal order`);
    }
    
    // システムプレースは日数制限を無視して必ず含める
    if (isSystemPlace) {
      console.log(`🔒 System place protected: ${place.name} (${place.category || place.place_type}) on day ${currentDay}`);
    } else {
      // 一般の場所のみ日数制限をチェック
      if (availableDays !== null && currentDay > availableDays) {
        console.log(`⚠️ Reached trip duration limit (${availableDays} days). Skipping non-system place: ${place.name}`);
        skippedPlaces.push(place);
        continue;
      }
    }
    
    // 時間設定（Final destinationの場合は既に時間が設定済みなのでスキップ）
    if (place.travel_time_from_previous && !isFinalDestination) {
      timeCounter += place.travel_time_from_previous;
    } else if (place.travel_time_from_previous && isFinalDestination) {
      // Final destinationの場合は既に正しい時間が設定済み
      console.log(`🎯 Skipping travel time addition for final destination (already calculated): ${place.name}`);
    }
    
    // 1日の終了時刻（20:00 = 1200分）を超えないよう制限
    const maxDayEndTime = 20 * 60; // 20:00
    const arrival = Math.min(timeCounter, maxDayEndTime);
    place.arrival_time = formatTime(arrival);
    
    // 滞在時間を追加
    const stayDuration = Math.min(place.stay_duration_minutes, maxDayEndTime - arrival);
    timeCounter = arrival + stayDuration;
    place.departure_time = formatTime(timeCounter);
    place.order_in_day = currentPlaces.length + 1;
    
    // 場所を追加
    currentPlaces.push(place);
    currentTime += placeTime;
    totalProcessedTime += placeTime;
    
    console.log(`📍 Scheduled: ${place.name} on day ${currentDay} at ${place.arrival_time}-${place.departure_time}`);
  }
  
  // 最後の日を追加（ユーザー設定の日数制限を厳格に適用）
  if (currentPlaces.length > 0) {
    const hasSystemPlace = currentPlaces.some(p => (
      p.source === 'system' || 
      p.category === 'departure_point' || 
      p.category === 'final_destination' ||
      p.place_type === 'system_airport' ||
      (p.id && p.id.toString().startsWith('airport_')) ||
      (p.id && p.id.toString().startsWith('return_'))
    ));
    
    // ユーザー設定の日数制限を厳格に適用
    if (availableDays === null || currentDay <= availableDays) {
      schedules.push(createDaySchedule(currentDay, currentPlaces, tripStartDate));
      console.log(`✅ Added final day ${currentDay} with ${currentPlaces.length} places`);
    } else {
      // 制限を超える場合は、全ての場所をスキップ（システムプレースも含む）
      console.warn(`⚠️ Cannot add day ${currentDay} - exceeds user limit of ${availableDays} days`);
      skippedPlaces.push(...currentPlaces);
      
      if (hasSystemPlace) {
        console.warn(`🚨 Warning: System places (departure/destination) skipped due to user time constraint`);
      }
    }
  }
  
  // スキップされた場所の情報をログ出力
  if (skippedPlaces.length > 0) {
    console.log(`⚠️ ${skippedPlaces.length} non-system places were skipped due to time constraints:`);
    skippedPlaces.forEach((place) => {
      console.log(`  - ${place.name} (${place.user_id || 'N/A'}, wish_level: ${place.normalized_wish_level || 'N/A'})`);
    });
  }
  
  console.log(`✅ Created ${schedules.length} daily schedules (user limit was ${availableDays || 'none'} days)`);
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
    total_travel_time: places.reduce((sum, p) => sum + (p.travel_time_from_previous || 0), 0),
    total_visit_time: places.reduce((sum, p) => sum + p.stay_duration_minutes, 0),
    meal_breaks: []
  };
}

function formatTime(minutes) {
  // Handle invalid inputs
  if (typeof minutes !== 'number' || minutes < 0) {
    return '08:00:00'; // 朝8時に変更
  }
  
  // Cap hours at 23:59:59 to prevent invalid time formats
  const maxMinutesPerDay = 23 * 60 + 59; // 1439 minutes = 23:59
  const cappedMinutes = Math.min(minutes, maxMinutesPerDay);
  const hours = Math.floor(cappedMinutes / 60);
  const mins = cappedMinutes % 60;
  
  // Ensure hours are within valid range (0-23)
  const validHours = Math.max(0, Math.min(23, hours));
  
  // 8時より前の場合は8時に調整
  const adjustedHours = Math.max(8, validHours);
  
  return `${adjustedHours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:00`;
}

// 最適化結果の検証
function validateOptimizationResult(places, schedules) {
  const issues = [];
  
  // 1. 重複チェック
  const placeNames = places.map((p) => p.name);
  const uniqueNames = new Set(placeNames);
  if (placeNames.length !== uniqueNames.size) {
    issues.push('Duplicate places found in route');
  }
  
  // 2. 移動時間の合理性チェック
  let unrealisticMoves = 0;
  for (let i = 1; i < places.length; i++) {
    const place = places[i];
    if (place.travel_time_from_previous && place.travel_time_from_previous > 720) {
      unrealisticMoves++;
    }
  }
  if (unrealisticMoves > 0) {
    issues.push(`${unrealisticMoves} unrealistic travel times (>12h) found`);
  }
  
  // 3. 日程の合理性チェック
  schedules.forEach((schedule, index) => {
    if (schedule.total_travel_time > 720) {
      issues.push(`Day ${index + 1} has excessive travel time (${Math.round(schedule.total_travel_time / 60)}h)`);
    }
    if (schedule.scheduled_places.length === 0) {
      issues.push(`Day ${index + 1} has no scheduled places`);
    }
  });
  
  // 4. フライト数チェック
  const flightDays = schedules.filter((schedule) => schedule.scheduled_places.some((place) => place.transport_mode === 'flight')).length;
  if (flightDays > schedules.length * 0.5) {
    issues.push('Too many flight days - schedule may be unrealistic');
  }
  
  const isValid = issues.length === 0;
  
  return {
    isValid,
    issues
  };
}

// 改善された最適化スコア計算
function calculateOptimizationScore(places, schedules) {
  const totalTravel = schedules.reduce((sum, day) => sum + day.total_travel_time, 0);
  const totalVisit = schedules.reduce((sum, day) => sum + day.total_visit_time, 0);
  
  // 効率性（訪問時間 / 総時間）
  const efficiency = totalVisit > 0 && totalTravel > 0 ? totalVisit / (totalVisit + totalTravel) : 0.5;
  
  // 希望度満足度
  const visitPlaces = places.filter((p) => 
    p.source !== 'system' && 
    p.category !== 'departure_point' && 
    p.category !== 'final_destination' &&
    p.place_type !== 'system_airport'
  );
  const avgNormalizedWish = visitPlaces.length > 0 ? visitPlaces.reduce((sum, p) => sum + (p.normalized_wish_level || 0.8), 0) / visitPlaces.length : 0.8;
  
  // 公平性（ユーザー間のバランス）
  let fairness = 1.0;
  if (visitPlaces.length > 0) {
    const userCounts = new Map();
    visitPlaces.forEach((p) => {
      userCounts.set(p.user_id, (userCounts.get(p.user_id) || 0) + 1);
    });
    const counts = Array.from(userCounts.values());
    if (counts.length > 1) {
      const avgCount = counts.reduce((sum, c) => sum + c, 0) / counts.length;
      const variance = counts.reduce((sum, c) => sum + Math.pow(c - avgCount, 2), 0) / counts.length;
      fairness = avgCount > 0 ? Math.max(0, 1 - variance / avgCount) : 1.0;
    }
  }
  
  // 実現可能性
  const validation = validateOptimizationResult(places, schedules);
  const feasibility = validation.isValid ? 1.0 : Math.max(0.1, 1.0 - validation.issues.length * 0.2);
  
  // スコア計算
  const totalScore = (efficiency * 0.3 + avgNormalizedWish * 0.2 + fairness * 0.2 + feasibility * 0.3) * 100;
  
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
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  const startTime = Date.now();
  let requestData = null;
  
  try {
    console.log('🚀 Optimization request received');
    
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
    
    const { trip_id, member_id, user_places, constraints } = requestData;
    
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
    
    console.log(`📋 Processing trip ${trip_id} for member ${member_id}`);
    
    // Supabaseクライアントの初期化
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get trip details including dates
    console.log(`🔍 Fetching trip details for ${trip_id}`);
    const { data: tripData, error: tripError } = await supabase
      .from('trips')
      .select('start_date, end_date')
      .eq('id', trip_id)
      .single();
      
    if (tripError) {
      console.error('❌ Trip fetch error:', tripError.message);
      throw new Error(`Failed to get trip details: ${tripError.message}`);
    }
    
    if (!tripData) {
      throw new Error('Trip not found');
    }
    
    // Calculate available days
    let availableDays = 1;
    if (tripData.start_date && tripData.end_date) {
      const startDate = new Date(tripData.start_date);
      const endDate = new Date(tripData.end_date);
      const timeDiff = endDate.getTime() - startDate.getTime();
      availableDays = Math.max(1, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1);
    }
    
    console.log(`📅 Trip duration: ${availableDays} days (${tripData.start_date} to ${tripData.end_date})`);
    
    // データベースから場所を取得（user_placesが提供されていない場合）
    let places = user_places;
    if (!places || places.length === 0) {
      console.log(`🔍 Fetching places from database for trip ${trip_id}`);
      const { data, error } = await supabase
        .from('places')
        .select('*')
        .eq('trip_id', trip_id);
        
      if (error) {
        console.error('❌ Places fetch error:', error.message);
        throw new Error(`Database error: ${error.message}`);
      }
      places = data || [];
    }
    
    console.log(`📍 Found ${places.length} places for optimization`);
    
    // データ検証とデバッグ情報
    if (!Array.isArray(places)) {
      throw new Error('Places data must be an array');
    }
    
    if (places.length === 0) {
      console.log('⚠️ No places found - creating minimal route with departure and destination');
      
      // Get trip details for departure and destination
      const { data: tripDetails, error: tripDetailsError } = await supabase
        .from('trips')
        .select('departure_location, departure_latitude, departure_longitude, destination_location, destination_latitude, destination_longitude')
        .eq('id', trip_id)
        .single();
        
      if (tripDetailsError || !tripDetails) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Could not retrieve trip details for optimization'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        });
      }
      
      // Create minimal system places
      const systemPlaces = [];
      
      // Add departure point if available
      if (tripDetails.departure_location && tripDetails.departure_latitude && tripDetails.departure_longitude) {
        systemPlaces.push({
          id: 'departure_' + trip_id,
          trip_id,
          user_id: member_id,
          name: tripDetails.departure_location,
          latitude: tripDetails.departure_latitude,
          longitude: tripDetails.departure_longitude,
          category: 'departure_point',
          source: 'system',
          place_type: 'departure',
          stay_duration_minutes: 0,
          wish_level: 5,
          created_at: new Date().toISOString()
        });
      }
      
      // Add destination if available
      if (tripDetails.destination_location && tripDetails.destination_latitude && tripDetails.destination_longitude) {
        systemPlaces.push({
          id: 'destination_' + trip_id,
          trip_id,
          user_id: member_id,
          name: tripDetails.destination_location,
          latitude: tripDetails.destination_latitude,
          longitude: tripDetails.destination_longitude,
          category: 'final_destination',
          source: 'system',
          place_type: 'destination',
          stay_duration_minutes: 0,
          wish_level: 5,
          created_at: new Date().toISOString()
        });
      }
      
      if (systemPlaces.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: 'No places or trip locations found for optimization'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        });
      }
      
      places = systemPlaces;
      console.log(`✅ Created ${places.length} system places for minimal route`);
    }
    
    // デバッグ：全ての場所の詳細をログ出力
    console.log(`🔍 Detailed places analysis:`);
    places.forEach((place, index) => {
      console.log(`  ${index + 1}. "${place.name}" - category: "${place.category || 'none'}", source: "${place.source || 'none'}", type: "${place.place_type || 'none'}", user: "${place.user_id || 'none'}"`);
    });
    
    // 基本的なデータ構造の検証
    for (const place of places) {
      if (!place.latitude || !place.longitude || !place.name) {
        console.warn(`⚠️ Invalid place data:`, place);
        throw new Error('Invalid place data: missing required fields (latitude, longitude, name)');
      }
    }
    
    // Remove duplicates and merge places at the same location
    console.log(`🧹 Removing duplicates from ${places.length} places`);
    places = removeDuplicatePlaces(places);
    console.log(`✅ ${places.length} unique places after deduplication`);
    
    // 滞在時間の正規化と確認（ユーザー設定を尊重）
    console.log('⏰ Checking and setting default stay durations (preserving user settings)');
    places.forEach((place, index) => {
      if (place.stay_duration_minutes && place.stay_duration_minutes > 0) {
        // ユーザーが設定した滞在時間を保持
        console.log(`✅ User-defined stay time: ${place.name} = ${place.stay_duration_minutes} minutes`);
      } else {
        // 設定されていない場合のみデフォルト値を使用
        if (place.category === 'airport' || place.place_type === 'system_airport') {
          place.stay_duration_minutes = 90; // 空港のデフォルト
          console.log(`🔧 Default airport time: ${place.name} = ${place.stay_duration_minutes} minutes`);
        } else if (place.category === 'attraction') {
          place.stay_duration_minutes = 180; // アトラクションのデフォルト
          console.log(`🔧 Default attraction time: ${place.name} = ${place.stay_duration_minutes} minutes`);
        } else {
          place.stay_duration_minutes = 120; // その他のデフォルト
          console.log(`🔧 Default general time: ${place.name} = ${place.stay_duration_minutes} minutes`);
        }
      }
    });
    
    // 希望度の正規化
    console.log('🔢 Normalizing preferences');
    const normalizedPlaces = normalizePreferences(places);
    console.log(`✅ Normalized preferences for ${normalizedPlaces.length} places`);
    
    // 反復的最適化を実行
    console.log(`🎯 Starting efficient optimization with ${availableDays} days constraint (airport insertion included, 8:00 start time)`);
    const optimizationResult = await iterativelyOptimizeWithDateConstraints(
      normalizedPlaces, 
      availableDays, 
      tripData.start_date, 
      supabase
    );
    
    const { 
      places: routeWithDetails, 
      schedules: dailySchedules, 
      iterations, 
      removedPlacesCount, 
      warning,
      executionTime: optimizationTime 
    } = optimizationResult;
    
    // 最適化スコア計算
    console.log('📊 Calculating optimization score');
    const optimizationScore = calculateOptimizationScore(routeWithDetails, dailySchedules);
    
    const totalExecutionTime = Date.now() - startTime;
    
    // データベース更新は最小限に（システム生成場所を除外）
    console.log('💾 Updating database with optimization results');
    
    // システム生成された場所（空港など）を除外してデータベース更新
    const originalPlaceIds = new Set(
      routeWithDetails
        .map((p) => p.id)
        .filter(id => id && typeof id === 'string' && !id.startsWith('airport_') && !id.startsWith('return_'))
    );
    
    console.log(`🏷️ Original places for DB update: ${originalPlaceIds.size} (excluding ${routeWithDetails.length - originalPlaceIds.size} system-generated)`);
    
    // 最適化結果の保存（簡素化）
    try {
      const { error: saveError } = await supabase.from('optimization_results').insert({
        trip_id,
        created_by: member_id,
        optimized_route: dailySchedules,
        optimization_score: optimizationScore,
        execution_time_ms: totalExecutionTime,
        places_count: routeWithDetails.length,
        total_travel_time_minutes: dailySchedules.reduce((sum, day) => sum + day.total_travel_time, 0),
        total_visit_time_minutes: dailySchedules.reduce((sum, day) => sum + day.total_visit_time, 0),
        is_active: true,
        algorithm_version: 'same-day-flight-v1'
      });
      
      if (saveError) {
        console.warn('⚠️ Error saving optimization results:', saveError.message);
      } else {
        console.log('✅ Optimization results saved successfully');
      }
    } catch (saveError) {
      console.warn('⚠️ Could not save to database:', saveError.message);
      // Continue without database save
    }
    
    const successMessage = `Route optimized: ${routeWithDetails.length} places in ${dailySchedules.length} days (${iterations} iterations, ${removedPlacesCount} removed). Score: ${optimizationScore.total_score}%`;
    
    console.log(`🎉 ${successMessage}`);
    if (warning) {
      console.warn(`⚠️ Warning: ${warning}`);
    }
    
    // レスポンス構築
    const response = {
      success: true,
      optimization: {
        daily_schedules: dailySchedules,
        optimization_score: optimizationScore,
        optimized_route: {
          daily_schedules: dailySchedules
        },
        total_duration_minutes: dailySchedules.reduce((sum, day) => sum + day.total_travel_time + day.total_visit_time, 0),
        places: routeWithDetails,
        execution_time_ms: totalExecutionTime,
        iterations,
        removed_places_count: removedPlacesCount
      },
      message: successMessage
    };
    
    if (warning) {
      response.optimization.warning = warning;
    }
    
    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('❌ Optimization error:', error.message);
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