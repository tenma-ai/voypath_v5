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
// 統一認証関数
async function authenticateUser(req) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    throw new Error('Authorization header is required');
  }
  const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: {
      headers: {
        Authorization: authHeader
      }
    }
  });
  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error || !user) {
    throw new Error('Invalid authentication');
  }
  return {
    supabaseClient,
    user
  };
}
// 効率的な場所選択アルゴリズム
function selectOptimalPlaces(places, members, maxPlaces, fairnessWeight) {
  if (places.length === 0) return [];
  
  // システムプレース（departure/destination）とユーザープレースを分離
  const systemPlaces = places.filter(place => 
    place.place_type === 'departure' || 
    place.place_type === 'destination' || 
    place.source === 'system'
  );
  const userPlaces = places.filter(place => 
    place.place_type !== 'departure' && 
    place.place_type !== 'destination' && 
    place.source !== 'system'
  );
  
  // ユーザープレースのみを正規化された希望度でソート
  const sortedPlaces = [
    ...userPlaces
  ].sort((a, b)=>(b.normalized_wish_level || b.wish_level / 5) - (a.normalized_wish_level || a.wish_level / 5));
  const selected = [];
  const memberCounts = {};
  // メンバーカウント初期化
  members.forEach((member)=>{
    const userId = member.user_id || member.id;
    memberCounts[userId] = 0;
  });
  // 公平性を考慮した選択
  for (const place of sortedPlaces){
    if (selected.length >= maxPlaces) break;
    // 公平性チェック
    const tempCounts = {
      ...memberCounts
    };
    tempCounts[place.user_id] = (tempCounts[place.user_id] || 0) + 1;
    const counts = Object.values(tempCounts);
    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts);
    const fairnessScore = maxCount > 0 ? minCount / maxCount : 1.0;
    // 公平性閾値をチェック（少数の場所の場合は緩和）
    const threshold = places.length <= 3 ? 0.3 : fairnessWeight;
    if (fairnessScore >= threshold || selected.length === 0) {
      selected.push(place);
      memberCounts[place.user_id] = tempCounts[place.user_id];
    }
  }
  // 最低1つのユーザープレースを保証
  if (selected.length === 0 && sortedPlaces.length > 0) {
    selected.push(sortedPlaces[0]);
  }
  
  // システムプレース（常に含める）+ 選択されたユーザープレース
  return [...systemPlaces, ...selected];
}
function calculateFairness(places, members) {
  if (places.length === 0 || members.length === 0) return 1.0;
  const memberCounts = {};
  members.forEach((member)=>{
    const userId = member.user_id || member.id;
    memberCounts[userId] = 0;
  });
  places.forEach((place)=>{
    if (memberCounts[place.user_id] !== undefined) {
      memberCounts[place.user_id]++;
    }
  });
  const counts = Object.values(memberCounts);
  const maxCount = Math.max(...counts);
  const minCount = Math.min(...counts);
  return maxCount > 0 ? minCount / maxCount : 1.0;
}
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: COMMON_CORS_HEADERS
    });
  }
  try {
    const requestData = await req.json();
    // バリデーション
    if (!requestData.places || !Array.isArray(requestData.places)) {
      return createErrorResponse('Places array is required', 400);
    }
    if (!requestData.members || !Array.isArray(requestData.members)) {
      return createErrorResponse('Members array is required', 400);
    }
    console.log(`🎯 Starting place selection: ${requestData.places.length} places, ${requestData.members.length} members`);
    const maxPlaces = Math.min((requestData.preferences.duration_days || 3) * (requestData.preferences.max_places_per_day || 4), requestData.places.length);
    const selectedPlaces = selectOptimalPlaces(requestData.places, requestData.members, maxPlaces, requestData.preferences.fairness_weight || 0.6);
    console.log(`✅ Selected ${selectedPlaces.length} places`);
    return createSuccessResponse({
      selected_places: selectedPlaces,
      fairness_score: calculateFairness(selectedPlaces, requestData.members),
      efficiency_score: 1.0,
      selection_rationale: `Selected ${selectedPlaces.length}/${requestData.places.length} places using optimized algorithm`,
      member_distribution: requestData.members.reduce((acc, member)=>{
        const userId = member.user_id || member.id;
        acc[userId] = selectedPlaces.filter((p)=>p.user_id === userId).length;
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('❌ Place selection error:', error);
    return createErrorResponse(error.message);
  }
});
