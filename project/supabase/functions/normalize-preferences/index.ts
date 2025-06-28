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
function normalizePreferences(places, members, settings) {
  // システムプレース（departure/destination）を除外してユーザープレースのみを正規化
  const userPlaces = places.filter(place => 
    place.place_type !== 'departure' && 
    place.place_type !== 'destination' && 
    place.source !== 'system'
  );
  
  // ユーザーごとの場所数計算（システムプレース除外）
  const userPlaceCounts = {};
  userPlaces.forEach((place)=>{
    userPlaceCounts[place.user_id] = (userPlaceCounts[place.user_id] || 0) + 1;
  });
  
  // 正規化はユーザープレースのみに適用
  const normalizedUserPlaces = userPlaces.map((place)=>{
    const userCount = userPlaceCounts[place.user_id] || 1;
    // 公平性係数（多くの場所を持つユーザーにペナルティ）
    const fairnessFactor = Math.sqrt(1 / userCount);
    // 基本希望度（1-5を0-1に正規化）
    const basePreference = place.wish_level / 5;
    // 設定に基づく重み調整
    let settingsMultiplier = 1.0;
    if ((settings.fairness_weight || 0.6) > 0.7) {
      settingsMultiplier = fairnessFactor; // 公平性重視
    } else if ((settings.efficiency_weight || 0.4) > 0.7) {
      settingsMultiplier = basePreference; // 希望度重視
    } else {
      settingsMultiplier = (basePreference + fairnessFactor) / 2; // バランス
    }
    const normalizedValue = basePreference * fairnessFactor * settingsMultiplier;
    return {
      ...place,
      normalized_wish_level: Math.max(0.1, Math.min(1.0, normalizedValue))
    };
  });
  
  // システムプレースを元の形で取得
  const systemPlaces = places.filter(place => 
    place.place_type === 'departure' || 
    place.place_type === 'destination' || 
    place.source === 'system'
  );
  
  // システムプレース（変更なし）+ 正規化されたユーザープレース
  return [...systemPlaces, ...normalizedUserPlaces];
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
    // バリデーション
    if (!requestData.trip_id || !requestData.places || !requestData.members) {
      return createErrorResponse('trip_id, places, and members are required', 400);
    }
    // Log message
    // Log message
    const normalizedPlaces = normalizePreferences(requestData.places, requestData.members, requestData.settings);
    // 結果をデータベースに保存
    await supabaseClient.from('trip_optimization_results').upsert({
      trip_id: requestData.trip_id,
      step: 'normalize_preferences',
      result: {
        normalized_places: normalizedPlaces
      },
      created_at: new Date().toISOString()
    });
    // Log message
    return createSuccessResponse({
      normalized_places: normalizedPlaces,
      normalization_stats: {
        total_places: normalizedPlaces.length,
        users_count: requestData.members.length,
        fairness_adjustment_applied: true
      }
    });
  } catch (error) {
    // Error occurred
    return createErrorResponse(error.message);
  }
});
