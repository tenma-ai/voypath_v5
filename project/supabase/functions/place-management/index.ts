import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlaceCreateRequest {
  trip_id: string;
  name: string;
  category: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  wish_level: number; // 1-5
  stay_duration_minutes: number;
  price_level?: number; // 1-4
  estimated_cost?: number;
  opening_hours?: Record<string, any>;
  image_url?: string;
  visit_date?: string;
  preferred_time_slots?: string[];
  notes?: string;
  tags?: string[];
  external_id?: string; // Google Places ID等
  country_hint?: string; // 地理的検証用の国コード
}

interface PlaceUpdateRequest {
  place_id: string;
  name?: string;
  category?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  wish_level?: number;
  stay_duration_minutes?: number;
  price_level?: number;
  estimated_cost?: number;
  opening_hours?: Record<string, any>;
  image_url?: string;
  visit_date?: string;
  preferred_time_slots?: string[];
  notes?: string;
  tags?: string[];
}

interface PlaceSearchRequest {
  trip_id?: string;
  query?: string;
  category?: string;
  min_rating?: number;
  max_rating?: number;
  min_price_level?: number;
  max_price_level?: number;
  min_wish_level?: number;
  max_wish_level?: number;
  has_coordinates?: boolean;
  scheduled?: boolean;
  user_id?: string;
  latitude?: number;
  longitude?: number;
  radius_km?: number;
  tags?: string[];
  limit?: number;
  offset?: number;
  sort_by?: 'created_at' | 'wish_level' | 'rating' | 'name' | 'distance';
  sort_order?: 'asc' | 'desc';
}

serve(async (req) => {
  // CORS対応
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Supabase クライアント初期化
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // 認証確認
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    const url = new URL(req.url);
    const method = req.method;
    const pathSegments = url.pathname.split('/').filter(Boolean);

    // ルーティング
    switch (method) {
      case 'POST':
        return await handleCreatePlace(req, supabaseClient, user.id);
      
      case 'GET':
        if (pathSegments.length >= 2) {
          if (pathSegments[1] === 'search') {
            // GET /place-management/search (場所検索)
            return await handleSearchPlaces(req, supabaseClient, user.id);
          } else {
            // GET /place-management/{place_id}
            const placeId = pathSegments[1];
            return await handleGetPlace(supabaseClient, user.id, placeId);
          }
        } else {
          // GET /place-management?trip_id={trip_id} (旅行の場所一覧)
          const tripId = url.searchParams.get('trip_id');
          if (!tripId) {
            throw new Error('trip_id parameter is required');
          }
          return await handleGetTripPlaces(supabaseClient, user.id, tripId);
        }
      
      case 'PUT':
        return await handleUpdatePlace(req, supabaseClient, user.id);
      
      case 'DELETE':
        if (pathSegments.length >= 2) {
          const placeId = pathSegments[1];
          return await handleDeletePlace(supabaseClient, user.id, placeId);
        } else {
          throw new Error('Place ID is required for deletion');
        }
      
      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 405,
          }
        );
    }
  } catch (error) {
    console.error('Place Management Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

async function handleCreatePlace(req: Request, supabase: any, userId: string) {
  const requestData: PlaceCreateRequest = await req.json();
  
  // 必須フィールドバリデーション
  if (!requestData.trip_id || !requestData.name || !requestData.category || 
      !requestData.wish_level || !requestData.stay_duration_minutes) {
    throw new Error('trip_id, name, category, wish_level, and stay_duration_minutes are required');
  }

  // 希望度レベル検証 (1-5)
  if (requestData.wish_level < 1 || requestData.wish_level > 5) {
    throw new Error('wish_level must be between 1 and 5');
  }

  // 滞在時間検証 (正の数)
  if (requestData.stay_duration_minutes <= 0) {
    throw new Error('stay_duration_minutes must be positive');
  }

  // 地理座標のバリデーション
  if (requestData.latitude !== undefined || requestData.longitude !== undefined) {
    if (requestData.latitude === undefined || requestData.longitude === undefined) {
      throw new Error('Both latitude and longitude must be provided together');
    }
    
    if (requestData.latitude < -90 || requestData.latitude > 90) {
      throw new Error('Latitude must be between -90 and 90');
    }
    
    if (requestData.longitude < -180 || requestData.longitude > 180) {
      throw new Error('Longitude must be between -180 and 180');
    }
  }

  // 評価の範囲チェック
  if (requestData.rating !== undefined && (requestData.rating < 0 || requestData.rating > 5)) {
    throw new Error('Rating must be between 0 and 5');
  }

  // 価格レベルの範囲チェック  
  if (requestData.price_level !== undefined && (requestData.price_level < 1 || requestData.price_level > 4)) {
    throw new Error('Price level must be between 1 and 4');
  }

  // 旅行メンバーシップと場所追加権限確認
  const { data: membership, error: memberError } = await supabase
    .from('trip_members')
    .select('can_add_places')
    .eq('trip_id', requestData.trip_id)
    .eq('user_id', userId)
    .single();

  if (memberError || !membership) {
    return new Response(
      JSON.stringify({ error: 'You are not a member of this trip' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      }
    );
  }

  if (!membership.can_add_places) {
    return new Response(
      JSON.stringify({ error: 'You do not have permission to add places to this trip' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      }
    );
  }

  // 訪問日検証（指定された場合）
  if (requestData.visit_date) {
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('start_date, end_date')
      .eq('id', requestData.trip_id)
      .single();

    if (tripError) {
      throw new Error(`Failed to validate trip dates: ${tripError.message}`);
    }

    const visitDate = new Date(requestData.visit_date);
    const startDate = new Date(trip.start_date);
    const endDate = new Date(trip.end_date);

    if (visitDate < startDate || visitDate > endDate) {
      throw new Error('visit_date must be within the trip duration');
    }
  }

  // 重複チェック機能
  await performDuplicateChecks(requestData, supabase);

  // 場所データ準備
  let placeData: any = {
    trip_id: requestData.trip_id,
    user_id: userId,
    name: requestData.name.trim(),
    category: requestData.category,
    wish_level: requestData.wish_level,
    stay_duration_minutes: requestData.stay_duration_minutes,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // オプショナルフィールドの追加
  if (requestData.address) placeData.address = requestData.address.trim();
  if (requestData.latitude !== undefined && requestData.longitude !== undefined) {
    placeData.latitude = requestData.latitude;
    placeData.longitude = requestData.longitude;
  }
  if (requestData.rating !== undefined) placeData.rating = requestData.rating;
  if (requestData.price_level !== undefined) placeData.price_level = requestData.price_level;
  if (requestData.estimated_cost !== undefined) placeData.estimated_cost = requestData.estimated_cost;
  if (requestData.opening_hours) placeData.opening_hours = requestData.opening_hours;
  if (requestData.image_url) placeData.image_url = requestData.image_url;
  if (requestData.visit_date) placeData.visit_date = requestData.visit_date;
  if (requestData.preferred_time_slots) placeData.preferred_time_slots = requestData.preferred_time_slots;
  if (requestData.notes) placeData.notes = requestData.notes.trim();
  if (requestData.tags) placeData.tags = requestData.tags;
  if (requestData.external_id) placeData.external_id = requestData.external_id;

  // 地理情報処理の強化
  placeData = await enhanceGeographicData(placeData, requestData);

  // 場所作成
  const { data: place, error: createError } = await supabase
    .from('places')
    .insert(placeData)
    .select(`
      *,
      user:users(id, name, avatar_url),
      trip:trips(name, destination)
    `)
    .single();

  if (createError) {
    throw new Error(`Failed to create place: ${createError.message}`);
  }

  // 使用状況イベント記録
  await supabase
    .from('usage_events')
    .insert({
      user_id: userId,
      event_type: 'place_added',
      event_category: 'place_management',
      trip_id: requestData.trip_id,
      metadata: {
        place_name: place.name,
        category: place.category,
        wish_level: place.wish_level,
        has_coordinates: !!(requestData.latitude && requestData.longitude),
        visit_date_specified: !!requestData.visit_date,
        has_external_id: !!requestData.external_id,
        has_address: !!requestData.address,
        duplicate_checks_performed: true
      }
    });

  return new Response(
    JSON.stringify({ 
      success: true, 
      place: place,
      message: 'Place added successfully'
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    }
  );
}

async function handleGetTripPlaces(supabase: any, userId: string, tripId: string) {
  // 旅行メンバーシップ確認
  const { data: membership, error: memberError } = await supabase
    .from('trip_members')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .single();

  if (memberError || !membership) {
    return new Response(
      JSON.stringify({ error: 'You are not a member of this trip' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      }
    );
  }

  // 旅行の場所一覧を取得
  const { data: places, error } = await supabase
    .from('places')
    .select(`
      *,
      user:users(id, name, avatar_url, is_premium)
    `)
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch places: ${error.message}`);
  }

  // 統計情報を計算
  const statistics = {
    total_places: places.length,
    places_by_category: places.reduce((acc: any, place: any) => {
      acc[place.category] = (acc[place.category] || 0) + 1;
      return acc;
    }, {}),
    places_by_user: places.reduce((acc: any, place: any) => {
      const userName = place.user.name;
      acc[userName] = (acc[userName] || 0) + 1;
      return acc;
    }, {}),
    avg_wish_level: places.length > 0 
      ? places.reduce((sum: number, place: any) => sum + place.wish_level, 0) / places.length 
      : 0,
    total_estimated_time: places.reduce((sum: number, place: any) => sum + place.stay_duration_minutes, 0),
    places_with_coordinates: places.filter((place: any) => place.latitude && place.longitude).length,
    scheduled_places: places.filter((place: any) => place.scheduled).length
  };

  return new Response(
    JSON.stringify({ 
      success: true, 
      places: places,
      statistics: statistics,
      total_count: places.length
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
}

async function handleGetPlace(supabase: any, userId: string, placeId: string) {
  // 場所詳細を取得（アクセス権限はRLSで制御）
  const { data: place, error } = await supabase
    .from('places')
    .select(`
      *,
      user:users(id, name, avatar_url, is_premium),
      trip:trips(
        id, name, destination, start_date, end_date,
        trip_members!inner(role, can_edit_places)
      )
    `)
    .eq('id', placeId)
    .eq('trip.trip_members.user_id', userId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch place: ${error.message}`);
  }

  // ユーザーの編集権限を確認
  const userMember = place.trip.trip_members.find((member: any) => member.user_id === userId);
  const canEdit = place.user_id === userId || 
                  (userMember && (userMember.role === 'admin' || userMember.can_edit_places));

  // 営業時間情報の詳細化
  const enhancedOperatingHours = await enhanceOperatingHours(place.opening_hours);

  // レビュー情報の取得（模擬データ）
  const reviewsInfo = await getPlaceReviews(placeId, supabase);

  // 関連場所の取得
  const relatedPlaces = await getRelatedPlaces(place, supabase, userId);

  const enrichedPlace = {
    ...place,
    user_permissions: {
      can_edit: canEdit,
      can_delete: place.user_id === userId || (userMember && userMember.role === 'admin'),
      is_owner: place.user_id === userId
    },
    enhanced_operating_hours: enhancedOperatingHours,
    reviews_summary: reviewsInfo,
    related_places: relatedPlaces
  };

  return new Response(
    JSON.stringify({ 
      success: true, 
      place: enrichedPlace
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
}

async function handleUpdatePlace(req: Request, supabase: any, userId: string) {
  const requestData: PlaceUpdateRequest = await req.json();
  
  if (!requestData.place_id) {
    throw new Error('Place ID is required');
  }

  // 場所の存在と編集権限確認
  const { data: place, error: placeError } = await supabase
    .from('places')
    .select(`
      *,
      trip:trips!inner(
        id, start_date, end_date,
        trip_members!inner(role, can_edit_places, user_id)
      )
    `)
    .eq('id', requestData.place_id)
    .eq('trip.trip_members.user_id', userId)
    .single();

  if (placeError || !place) {
    return new Response(
      JSON.stringify({ error: 'Place not found or access denied' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      }
    );
  }

  // 編集権限確認
  const userMember = place.trip.trip_members.find((member: any) => member.user_id === userId);
  const canEdit = place.user_id === userId || 
                  (userMember && (userMember.role === 'admin' || userMember.can_edit_places));

  if (!canEdit) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions to edit this place' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      }
    );
  }

  // 更新データ準備
  const updateData: any = {
    updated_at: new Date().toISOString()
  };

  if (requestData.name) updateData.name = requestData.name;
  if (requestData.category) updateData.category = requestData.category;
  if (requestData.address !== undefined) updateData.address = requestData.address;
  if (requestData.latitude !== undefined) updateData.latitude = requestData.latitude;
  if (requestData.longitude !== undefined) updateData.longitude = requestData.longitude;
  if (requestData.rating !== undefined) updateData.rating = requestData.rating;
  if (requestData.wish_level !== undefined) {
    if (requestData.wish_level < 1 || requestData.wish_level > 5) {
      throw new Error('wish_level must be between 1 and 5');
    }
    updateData.wish_level = requestData.wish_level;
  }
  if (requestData.stay_duration_minutes !== undefined) {
    if (requestData.stay_duration_minutes <= 0) {
      throw new Error('stay_duration_minutes must be positive');
    }
    updateData.stay_duration_minutes = requestData.stay_duration_minutes;
  }
  if (requestData.price_level !== undefined) updateData.price_level = requestData.price_level;
  if (requestData.estimated_cost !== undefined) updateData.estimated_cost = requestData.estimated_cost;
  if (requestData.opening_hours !== undefined) updateData.opening_hours = requestData.opening_hours;
  if (requestData.image_url !== undefined) updateData.image_url = requestData.image_url;
  if (requestData.visit_date !== undefined) {
    if (requestData.visit_date) {
      // 訪問日検証
      const visitDate = new Date(requestData.visit_date);
      const startDate = new Date(place.trip.start_date);
      const endDate = new Date(place.trip.end_date);

      if (visitDate < startDate || visitDate > endDate) {
        throw new Error('visit_date must be within the trip duration');
      }
    }
    updateData.visit_date = requestData.visit_date;
  }
  if (requestData.preferred_time_slots !== undefined) updateData.preferred_time_slots = requestData.preferred_time_slots;
  if (requestData.notes !== undefined) updateData.notes = requestData.notes;
  if (requestData.tags !== undefined) updateData.tags = requestData.tags;

  // 場所更新
  const { data: updatedPlace, error: updateError } = await supabase
    .from('places')
    .update(updateData)
    .eq('id', requestData.place_id)
    .select(`
      *,
      user:users(id, name, avatar_url),
      trip:trips(name, destination)
    `)
    .single();

  if (updateError) {
    throw new Error(`Failed to update place: ${updateError.message}`);
  }

  // 使用状況イベント記録
  await supabase
    .from('usage_events')
    .insert({
      user_id: userId,
      event_type: 'place_updated',
      event_category: 'place_management',
      trip_id: place.trip_id,
      metadata: {
        place_id: requestData.place_id,
        place_name: updatedPlace.name,
        updated_fields: Object.keys(updateData).filter(key => key !== 'updated_at'),
        updated_by_owner: place.user_id === userId
      }
    });

  // 通知機能の実装
  await sendPlaceUpdateNotification(updatedPlace, place.trip_id, userId, Object.keys(updateData).filter(key => key !== 'updated_at'), supabase);

  return new Response(
    JSON.stringify({ 
      success: true, 
      place: updatedPlace,
      message: 'Place updated successfully'
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
}

async function handleDeletePlace(supabase: any, userId: string, placeId: string) {
  // 場所の存在と削除権限確認
  const { data: place, error: placeError } = await supabase
    .from('places')
    .select(`
      *,
      trip:trips!inner(
        trip_members!inner(role, user_id)
      )
    `)
    .eq('id', placeId)
    .eq('trip.trip_members.user_id', userId)
    .single();

  if (placeError || !place) {
    return new Response(
      JSON.stringify({ error: 'Place not found or access denied' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      }
    );
  }

  // 削除権限確認（作成者または管理者のみ）
  const userMember = place.trip.trip_members.find((member: any) => member.user_id === userId);
  const canDelete = place.user_id === userId || (userMember && userMember.role === 'admin');

  if (!canDelete) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions to delete this place' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      }
    );
  }

  // 関連データの事前確認と処理
  const relatedDataInfo = await processRelatedDataBeforeDeletion(placeId, place, supabase);

  // 場所削除
  const { error: deleteError } = await supabase
    .from('places')
    .delete()
    .eq('id', placeId);

  if (deleteError) {
    throw new Error(`Failed to delete place: ${deleteError.message}`);
  }

  // 使用状況イベント記録
  await supabase
    .from('usage_events')
    .insert({
      user_id: userId,
      event_type: 'place_deleted',
      event_category: 'place_management',
      trip_id: place.trip_id,
      metadata: {
        place_id: placeId,
        place_name: place.name,
        category: place.category,
        deleted_by_owner: place.user_id === userId,
        related_data_processed: relatedDataInfo.processedItems,
        had_scheduled_data: relatedDataInfo.hadScheduledData,
        affected_optimization_results: relatedDataInfo.affectedOptimizations
      }
    });

  // 削除通知の送信
  await sendPlaceDeletionNotification(place, userId, relatedDataInfo, supabase);

  return new Response(
    JSON.stringify({ 
      success: true,
      message: 'Place deleted successfully'
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
}

async function handleSearchPlaces(req: Request, supabase: any, userId: string) {
  const url = new URL(req.url);
  
  // クエリパラメータの取得
  const searchParams: PlaceSearchRequest = {
    trip_id: url.searchParams.get('trip_id') || undefined,
    query: url.searchParams.get('query') || undefined,
    category: url.searchParams.get('category') || undefined,
    min_rating: url.searchParams.get('min_rating') ? parseFloat(url.searchParams.get('min_rating')!) : undefined,
    max_rating: url.searchParams.get('max_rating') ? parseFloat(url.searchParams.get('max_rating')!) : undefined,
    min_price_level: url.searchParams.get('min_price_level') ? parseInt(url.searchParams.get('min_price_level')!) : undefined,
    max_price_level: url.searchParams.get('max_price_level') ? parseInt(url.searchParams.get('max_price_level')!) : undefined,
    min_wish_level: url.searchParams.get('min_wish_level') ? parseInt(url.searchParams.get('min_wish_level')!) : undefined,
    max_wish_level: url.searchParams.get('max_wish_level') ? parseInt(url.searchParams.get('max_wish_level')!) : undefined,
    has_coordinates: url.searchParams.get('has_coordinates') === 'true',
    scheduled: url.searchParams.get('scheduled') ? url.searchParams.get('scheduled') === 'true' : undefined,
    user_id: url.searchParams.get('user_id') || undefined,
    latitude: url.searchParams.get('latitude') ? parseFloat(url.searchParams.get('latitude')!) : undefined,
    longitude: url.searchParams.get('longitude') ? parseFloat(url.searchParams.get('longitude')!) : undefined,
    radius_km: url.searchParams.get('radius_km') ? parseFloat(url.searchParams.get('radius_km')!) : 5.0,
    tags: url.searchParams.get('tags') ? url.searchParams.get('tags')!.split(',') : undefined,
    limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 50,
    offset: url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : 0,
    sort_by: (url.searchParams.get('sort_by') as any) || 'created_at',
    sort_order: (url.searchParams.get('sort_order') as any) || 'desc'
  };

  // バリデーション
  if (searchParams.trip_id) {
    // 旅行メンバーシップ確認
    const { data: membership, error: memberError } = await supabase
      .from('trip_members')
      .select('role')
      .eq('trip_id', searchParams.trip_id)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return new Response(
        JSON.stringify({ error: 'You are not a member of this trip' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }
  }

  // ベースクエリの構築
  let query = supabase
    .from('places')
    .select(`
      *,
      user:users(id, name, avatar_url, is_premium)
    `);

  // フィルタリング条件の適用
  if (searchParams.trip_id) {
    query = query.eq('trip_id', searchParams.trip_id);
  } else {
    // trip_idが指定されていない場合は、ユーザーがメンバーの旅行のみ
    const { data: userTrips, error: tripsError } = await supabase
      .from('trip_members')
      .select('trip_id')
      .eq('user_id', userId);

    if (tripsError) {
      throw new Error(`Failed to fetch user trips: ${tripsError.message}`);
    }

    const tripIds = userTrips.map((t: any) => t.trip_id);
    if (tripIds.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          places: [], 
          total_count: 0,
          search_params: searchParams
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
    query = query.in('trip_id', tripIds);
  }

  // テキスト検索
  if (searchParams.query) {
    query = query.or(`name.ilike.%${searchParams.query}%,address.ilike.%${searchParams.query}%,notes.ilike.%${searchParams.query}%`);
  }

  // カテゴリフィルター
  if (searchParams.category) {
    query = query.eq('category', searchParams.category);
  }

  // 評価フィルター
  if (searchParams.min_rating !== undefined) {
    query = query.gte('rating', searchParams.min_rating);
  }
  if (searchParams.max_rating !== undefined) {
    query = query.lte('rating', searchParams.max_rating);
  }

  // 価格レベルフィルター
  if (searchParams.min_price_level !== undefined) {
    query = query.gte('price_level', searchParams.min_price_level);
  }
  if (searchParams.max_price_level !== undefined) {
    query = query.lte('price_level', searchParams.max_price_level);
  }

  // 希望度フィルター
  if (searchParams.min_wish_level !== undefined) {
    query = query.gte('wish_level', searchParams.min_wish_level);
  }
  if (searchParams.max_wish_level !== undefined) {
    query = query.lte('wish_level', searchParams.max_wish_level);
  }

  // 座標の有無フィルター
  if (searchParams.has_coordinates !== undefined) {
    if (searchParams.has_coordinates) {
      query = query.not('latitude', 'is', null).not('longitude', 'is', null);
    } else {
      query = query.or('latitude.is.null,longitude.is.null');
    }
  }

  // スケジュール状態フィルター
  if (searchParams.scheduled !== undefined) {
    query = query.eq('scheduled', searchParams.scheduled);
  }

  // ユーザーフィルター
  if (searchParams.user_id) {
    query = query.eq('user_id', searchParams.user_id);
  }

  // タグフィルター
  if (searchParams.tags && searchParams.tags.length > 0) {
    query = query.overlaps('tags', searchParams.tags);
  }

  // ソート機能
  let orderBy = 'created_at';
  if (searchParams.sort_by === 'distance' && searchParams.latitude && searchParams.longitude) {
    // 地理的ソートは後で処理
    orderBy = 'created_at';
  } else if (searchParams.sort_by && ['wish_level', 'rating', 'name'].indexOf(searchParams.sort_by) !== -1) {
    orderBy = searchParams.sort_by!;
  }

  query = query.order(orderBy, { ascending: searchParams.sort_order === 'asc' });

  // ページネーション
  query = query.range(searchParams.offset!, searchParams.offset! + searchParams.limit! - 1);

  // クエリ実行
  const { data: places, error, count } = await query;

  if (error) {
    throw new Error(`Failed to search places: ${error.message}`);
  }

  let processedPlaces = places || [];

  // 地理的距離計算とソート
  if (searchParams.latitude !== undefined && searchParams.longitude !== undefined) {
    const userLat = searchParams.latitude;
    const userLon = searchParams.longitude;
    const radiusKm = searchParams.radius_km!;

    processedPlaces = processedPlaces
      .map((place: any) => {
        if (place.latitude && place.longitude) {
          const distance = calculateHaversineDistance(
            userLat, 
            userLon, 
            place.latitude, 
            place.longitude
          );
          return { ...place, distance_km: distance };
        }
        return { ...place, distance_km: null };
      })
      .filter((place: any) => {
        // 地理的フィルタリング
        if (place.distance_km === null) return true; // 座標がない場所は含める
        return place.distance_km <= radiusKm;
      });

    // 距離によるソート
    if (searchParams.sort_by === 'distance') {
      processedPlaces.sort((a: any, b: any) => {
        if (a.distance_km === null && b.distance_km === null) return 0;
        if (a.distance_km === null) return 1;
        if (b.distance_km === null) return -1;
        return searchParams.sort_order === 'asc' 
          ? a.distance_km - b.distance_km 
          : b.distance_km - a.distance_km;
      });
    }
  }

  // 統計情報の計算
  const statistics = {
    total_places: processedPlaces.length,
    places_by_category: processedPlaces.reduce((acc: any, place: any) => {
      acc[place.category] = (acc[place.category] || 0) + 1;
      return acc;
    }, {}),
    avg_wish_level: processedPlaces.length > 0 
      ? processedPlaces.reduce((sum: number, place: any) => sum + place.wish_level, 0) / processedPlaces.length 
      : 0,
    avg_rating: processedPlaces.length > 0 
      ? processedPlaces.filter((p: any) => p.rating).reduce((sum: number, place: any) => sum + (place.rating || 0), 0) / processedPlaces.filter((p: any) => p.rating).length
      : 0,
    places_with_coordinates: processedPlaces.filter((place: any) => place.latitude && place.longitude).length,
    scheduled_places: processedPlaces.filter((place: any) => place.scheduled).length
  };

  // 使用状況イベント記録
  await supabase
    .from('usage_events')
    .insert({
      user_id: userId,
      event_type: 'places_searched',
      event_category: 'place_management',
      trip_id: searchParams.trip_id || null,
      metadata: {
        search_query: searchParams.query,
        category: searchParams.category,
        has_filters: !!(searchParams.min_rating || searchParams.max_rating || 
                        searchParams.min_price_level || searchParams.max_price_level ||
                        searchParams.min_wish_level || searchParams.max_wish_level),
        has_location_filter: !!(searchParams.latitude && searchParams.longitude),
        results_count: processedPlaces.length,
        sort_by: searchParams.sort_by,
        sort_order: searchParams.sort_order
      }
    });

  return new Response(
    JSON.stringify({ 
      success: true, 
      places: processedPlaces,
      statistics: statistics,
      total_count: processedPlaces.length,
      search_params: searchParams,
      has_more: processedPlaces.length === searchParams.limit
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
}

// 重複チェック機能
async function performDuplicateChecks(requestData: PlaceCreateRequest, supabase: any) {
  const duplicateErrors: string[] = [];

  // 1. 場所名の重複チェック（同一旅行内、大文字小文字無視）
  const { data: nameMatches, error: nameError } = await supabase
    .from('places')
    .select('id, name')
    .eq('trip_id', requestData.trip_id)
    .ilike('name', requestData.name.trim());

  if (nameError) {
    console.warn('Name duplicate check failed:', nameError);
  } else if (nameMatches && nameMatches.length > 0) {
    duplicateErrors.push(`A place named "${requestData.name}" already exists in this trip`);
  }

  // 2. 地理的近接チェック（座標が提供されている場合）
  if (requestData.latitude && requestData.longitude) {
    const { data: nearbyPlaces, error: nearbyError } = await supabase
      .from('places')
      .select('id, name, latitude, longitude')
      .eq('trip_id', requestData.trip_id)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (nearbyError) {
      console.warn('Geographic duplicate check failed:', nearbyError);
    } else if (nearbyPlaces && nearbyPlaces.length > 0) {
      const PROXIMITY_THRESHOLD_KM = 0.1; // 100メートル以内は重複とみなす
      
      for (const existingPlace of nearbyPlaces) {
        const distance = calculateHaversineDistance(
          requestData.latitude,
          requestData.longitude,
          existingPlace.latitude,
          existingPlace.longitude
        );
        
        if (distance < PROXIMITY_THRESHOLD_KM) {
          duplicateErrors.push(
            `A place named "${existingPlace.name}" is located very close to this location (${Math.round(distance * 1000)}m away)`
          );
        }
      }
    }
  }

  // 3. 外部ID重複チェック（external_idが提供されている場合）
  if (requestData.external_id) {
    const { data: externalMatches, error: externalError } = await supabase
      .from('places')
      .select('id, name, external_id')
      .eq('trip_id', requestData.trip_id)
      .eq('external_id', requestData.external_id);

    if (externalError) {
      console.warn('External ID duplicate check failed:', externalError);
    } else if (externalMatches && externalMatches.length > 0) {
      duplicateErrors.push(
        `A place with the same external ID already exists: "${externalMatches[0].name}"`
      );
    }
  }

  // 4. 住所の類似チェック（住所が提供されている場合）
  if (requestData.address && requestData.address.length > 10) {
    const { data: addressMatches, error: addressError } = await supabase
      .from('places')
      .select('id, name, address')
      .eq('trip_id', requestData.trip_id)
      .not('address', 'is', null)
      .ilike('address', `%${requestData.address.slice(0, 20)}%`); // 住所の最初20文字で部分一致

    if (addressError) {
      console.warn('Address similarity check failed:', addressError);
    } else if (addressMatches && addressMatches.length > 0) {
      for (const match of addressMatches) {
        const similarity = calculateStringSimilarity(
          requestData.address.toLowerCase(), 
          match.address.toLowerCase()
        );
        
        if (similarity > 0.8) { // 80%以上の類似度
          duplicateErrors.push(
            `A place with similar address already exists: "${match.name}" at "${match.address}"`
          );
        }
      }
    }
  }

  // 重複エラーがある場合は例外を投げる
  if (duplicateErrors.length > 0) {
    throw new Error(`Duplicate place detected:\n${duplicateErrors.join('\n')}`);
  }
}

// 文字列類似度計算（簡易版）
function calculateStringSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1
        );
      }
    }
  }
  
  const maxLen = Math.max(len1, len2);
  return 1 - matrix[len1][len2] / maxLen;
}

// 地理情報処理の強化
async function enhanceGeographicData(placeData: any, requestData: PlaceCreateRequest): Promise<any> {
  // 住所が提供されているが座標がない場合、ジオコーディングを提案（実装簡略化）
  if (requestData.address && !requestData.latitude && !requestData.longitude) {
    console.log(`Geocoding suggestion: Consider adding coordinates for address: ${requestData.address}`);
    
    // 実際の実装では外部ジオコーディングAPIを使用
    // const coordinates = await geocodeAddress(requestData.address);
    // if (coordinates) {
    //   placeData.latitude = coordinates.lat;
    //   placeData.longitude = coordinates.lng;
    // }
  }

  // 座標が提供されている場合、地理的妥当性をチェック
  if (placeData.latitude && placeData.longitude) {
    // 日本国内の座標範囲チェック（オプション）
    if (requestData.country_hint === 'JP') {
      if (placeData.latitude < 24 || placeData.latitude > 46 || 
          placeData.longitude < 123 || placeData.longitude > 146) {
        console.warn('Coordinates appear to be outside Japan despite country hint');
      }
    }
    
    // PostGIS地点データを設定（データベーストリガーで自動設定されるが、明示的に確認）
    placeData.location_point = `POINT(${placeData.longitude} ${placeData.latitude})`;
  }

  return placeData;
}

// ハヴァーサイン距離計算関数
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

// Enhanced operating hours information
async function enhanceOperatingHours(openingHours: any): Promise<any> {
  if (!openingHours) {
    return {
      status: 'no_data',
      message: 'Operating hours information not available',
      current_status: 'unknown'
    };
  }

  const now = new Date();
  const currentDay = now.getDay(); // 0=Sunday, 1=Monday, ...
  const currentHour = now.getHours() + now.getMinutes() / 60;

  // Get today's operating hours
  const todayHours = openingHours[currentDay];
  
  if (!todayHours) {
    return {
      status: 'no_data_today',
      message: 'Today\'s operating hours information not available',
      current_status: 'unknown',
      weekly_schedule: openingHours
    };
  }

  // Determine current operating status
  let currentStatus = 'unknown';
  let statusMessage = '';
  let nextStatusChange = null;

  if (todayHours.is_closed) {
    currentStatus = 'closed';
    statusMessage = 'Closed today';
  } else {
    const openTime = parseTimeToHours(todayHours.open_time);
    const closeTime = parseTimeToHours(todayHours.close_time);
    
    if (currentHour < openTime) {
      currentStatus = 'closed';
      statusMessage = `Opens at ${todayHours.open_time}`;
      nextStatusChange = {
        status: 'open',
        time: todayHours.open_time,
        minutes_until: Math.round((openTime - currentHour) * 60)
      };
    } else if (currentHour >= openTime && currentHour < closeTime) {
      currentStatus = 'open';
      const minutesUntilClose = Math.round((closeTime - currentHour) * 60);
      
      if (minutesUntilClose <= 60) {
        statusMessage = `Closing soon (${minutesUntilClose} minutes)`;
      } else {
        statusMessage = `Open until ${todayHours.close_time}`;
      }
      
      nextStatusChange = {
        status: 'closed',
        time: todayHours.close_time,
        minutes_until: minutesUntilClose
      };
    } else {
      currentStatus = 'closed';
      statusMessage = 'Closed';
    }
  }

  // Organize weekly schedule
  const weeklySchedule = Object.entries(openingHours).map(([dayNum, hours]: [string, any]) => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return {
      day: dayNames[parseInt(dayNum)],
      day_number: parseInt(dayNum),
      is_closed: hours.is_closed,
      open_time: hours.open_time,
      close_time: hours.close_time,
      is_today: parseInt(dayNum) === currentDay
    };
  });

  return {
    status: 'available',
    current_status: currentStatus,
    status_message: statusMessage,
    next_status_change: nextStatusChange,
    today_hours: todayHours,
    weekly_schedule: weeklySchedule,
    last_updated: now.toISOString()
  };
}

// Get place reviews (mock implementation)
async function getPlaceReviews(placeId: string, supabase: any): Promise<any> {
  // In production, this would fetch from external review APIs or internal review tables
  // Currently returns mock data
  
  // Internal review table implementation example (commented out)
  /*
  const { data: reviews, error } = await supabase
    .from('place_reviews')
    .select(`
      *,
      user:users(name, avatar_url)
    `)
    .eq('place_id', placeId)
    .order('created_at', { ascending: false })
    .limit(10);
  */

  // Generate mock data
  const mockReviews = generateMockReviews(placeId);
  
  return {
    source: 'mock_data',
    total_reviews: mockReviews.length,
    average_rating: mockReviews.reduce((sum, r) => sum + r.rating, 0) / mockReviews.length,
    rating_distribution: {
      5: mockReviews.filter(r => r.rating === 5).length,
      4: mockReviews.filter(r => r.rating === 4).length,
      3: mockReviews.filter(r => r.rating === 3).length,
      2: mockReviews.filter(r => r.rating === 2).length,
      1: mockReviews.filter(r => r.rating === 1).length,
    },
    recent_reviews: mockReviews.slice(0, 5),
    keywords: extractReviewKeywords(mockReviews)
  };
}

// Get related places
async function getRelatedPlaces(place: any, supabase: any, userId: string): Promise<any[]> {
  const relatedPlaces = [];

  // 1. Places in same category
  const { data: sameCategoryPlaces, error: categoryError } = await supabase
    .from('places')
    .select(`
      id, name, category, rating, address, latitude, longitude,
      user:users(name)
    `)
    .eq('trip_id', place.trip_id)
    .eq('category', place.category)
    .neq('id', place.id)
    .limit(3);

  if (!categoryError && sameCategoryPlaces) {
    relatedPlaces.push({
      type: 'same_category',
      title: `Same category (${place.category}) places`,
      places: sameCategoryPlaces.map((p: any) => ({
        ...p,
        relation_type: 'same_category',
        similarity_score: 0.8
      }))
    });
  }

  // 2. Geographically nearby places
  if (place.latitude && place.longitude) {
    const { data: nearbyPlaces, error: nearbyError } = await supabase
      .from('places')
      .select(`
        id, name, category, rating, address, latitude, longitude,
        user:users(name)
      `)
      .eq('trip_id', place.trip_id)
      .neq('id', place.id)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(10);

    if (!nearbyError && nearbyPlaces) {
      const placesWithDistance = nearbyPlaces
        .map((p: any) => ({
          ...p,
          distance: calculateHaversineDistance(
            place.latitude, place.longitude,
            p.latitude, p.longitude
          ),
          relation_type: 'nearby',
        }))
        .filter(p => p.distance < 2) // Within 2km
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3)
        .map(p => ({
          ...p,
          similarity_score: Math.max(0.3, 1 - p.distance / 2)
        }));

      if (placesWithDistance.length > 0) {
        relatedPlaces.push({
          type: 'nearby',
          title: 'Nearby places',
          places: placesWithDistance
        });
      }
    }
  }

  // 3. Places added by same user
  const { data: sameUserPlaces, error: userError } = await supabase
    .from('places')
    .select(`
      id, name, category, rating, address,
      user:users(name)
    `)
    .eq('trip_id', place.trip_id)
    .eq('user_id', place.user_id)
    .neq('id', place.id)
    .limit(3);

  if (!userError && sameUserPlaces && sameUserPlaces.length > 0) {
    relatedPlaces.push({
      type: 'same_user',
      title: `Other places by ${place.user.name}`,
      places: sameUserPlaces.map((p: any) => ({
        ...p,
        relation_type: 'same_user',
        similarity_score: 0.6
      }))
    });
  }

  return relatedPlaces;
}

// Generate mock review data
function generateMockReviews(placeId: string): any[] {
  const reviewTexts = [
    "Great place to visit. Amazing atmosphere, would love to come back again.",
    "Not as good as expected. Too crowded and couldn't enjoy it properly.",
    "Highly recommended for families. Kids really enjoyed it.",
    "Very photogenic place, posted lots of pictures on Instagram.",
    "Good accessibility and easy to explore for tourists."
  ];

  const authors = [
    "Travel Lover A", "Food Explorer B", "Photo Enthusiast C", "Family Travel Expert D", "Solo Travel Master E"
  ];

  return Array.from({ length: 8 }, (_, i) => ({
    id: `review-${placeId}-${i}`,
    rating: Math.floor(Math.random() * 5) + 1,
    text: reviewTexts[i % reviewTexts.length],
    author: authors[i % authors.length],
    created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    helpful_count: Math.floor(Math.random() * 20)
  }));
}

// Extract review keywords
function extractReviewKeywords(reviews: any[]): string[] {
  const keywords = ['atmosphere', 'crowded', 'family', 'photogenic', 'accessibility', 'kids', 'photo', 'tourist'];
  return keywords.filter(keyword => 
    reviews.some(review => review.text.toLowerCase().includes(keyword))
  );
}

// Convert time string to hours
function parseTimeToHours(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours + minutes / 60;
}

// Place update notification functionality
async function sendPlaceUpdateNotification(
  updatedPlace: any, 
  tripId: string, 
  updatedByUserId: string, 
  updatedFields: string[], 
  supabase: any
): Promise<void> {
  try {
    // Get trip members (excluding updater)
    const { data: tripMembers, error: membersError } = await supabase
      .from('trip_members')
      .select(`
        user_id,
        user:users(id, name, email)
      `)
      .eq('trip_id', tripId)
      .neq('user_id', updatedByUserId);

    if (membersError) {
      console.warn('Failed to fetch trip members for notification:', membersError);
      return;
    }

    if (!tripMembers || tripMembers.length === 0) {
      console.log('No other members to notify for place update');
      return;
    }

    // Get updater information
    const { data: updater, error: updaterError } = await supabase
      .from('users')
      .select('name')
      .eq('id', updatedByUserId)
      .single();

    if (updaterError) {
      console.warn('Failed to fetch updater info:', updaterError);
      return;
    }

    // Translate field names to English
    const fieldTranslations: Record<string, string> = {
      name: 'place name',
      category: 'category',
      address: 'address',
      latitude: 'latitude',
      longitude: 'longitude',
      rating: 'rating',
      wish_level: 'wish level',
      stay_duration_minutes: 'stay duration',
      price_level: 'price level',
      estimated_cost: 'estimated cost',
      opening_hours: 'opening hours',
      image_url: 'image',
      visit_date: 'visit date',
      preferred_time_slots: 'preferred time slots',
      notes: 'notes',
      tags: 'tags'
    };

    const translatedFields = updatedFields
      .map(field => fieldTranslations[field] || field)
      .join(', ');

    // Create notification message
    const notificationMessage = updatedFields.length === 1 
      ? `${updater.name} updated ${translatedFields} for "${updatedPlace.name}"`
      : `${updater.name} updated multiple fields (${translatedFields}) for "${updatedPlace.name}"`;

    // Send real-time notifications
    const notifications = tripMembers.map((member: any) => ({
      user_id: member.user_id,
      trip_id: tripId,
      type: 'place_updated',
      title: 'Place information updated',
      message: notificationMessage,
      data: {
        place_id: updatedPlace.id,
        place_name: updatedPlace.name,
        updated_by: updater.name,
        updated_by_id: updatedByUserId,
        updated_fields: updatedFields,
        trip_id: tripId
      },
      created_at: new Date().toISOString(),
      read: false
    }));

    // Save notifications to database
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notificationError) {
      console.warn('Failed to save notifications:', notificationError);
    } else {
      console.log(`Place update notifications sent to ${notifications.length} members`);
    }

    // Broadcast real-time notification
    await broadcastRealtimeNotification(tripId, {
      type: 'place_updated',
      place: updatedPlace,
      updated_by: updater.name,
      updated_fields: translatedFields,
      message: notificationMessage
    }, supabase);

  } catch (error) {
    console.error('Error sending place update notification:', error);
    // Don't let notification errors affect place update success
  }
}

// Broadcast real-time notifications
async function broadcastRealtimeNotification(
  tripId: string, 
  notificationData: any, 
  supabase: any
): Promise<void> {
  try {
    // Broadcast notification to Supabase Realtime channel
    // In production, frontend subscribes to trip-specific channels
    await supabase
      .channel(`trip-${tripId}`)
      .send({
        type: 'broadcast',
        event: 'place_update_notification',
        payload: notificationData
      });

    console.log(`Realtime notification broadcasted to trip-${tripId}`);
  } catch (error) {
    console.warn('Failed to broadcast realtime notification:', error);
  }
}

// Related data processing before place deletion
async function processRelatedDataBeforeDeletion(
  placeId: string, 
  place: any, 
  supabase: any
): Promise<any> {
  const processedItems: string[] = [];
  let hadScheduledData = false;
  let affectedOptimizations = 0;

  try {
    // 1. Check for scheduled data (arrival/departure times)
    if (place.scheduled && (place.arrival_time || place.departure_time)) {
      hadScheduledData = true;
      processedItems.push('scheduled_times');
      console.log(`Place ${place.name} had scheduled data that will be removed`);
    }

    // 2. Check for optimization results that reference this place
    const { data: optimizationResults, error: optError } = await supabase
      .from('optimization_results')
      .select('id, optimized_route')
      .eq('trip_id', place.trip_id);

    if (!optError && optimizationResults) {
      for (const result of optimizationResults) {
        if (result.optimized_route) {
          // Check if this place is referenced in the optimization route
          const routeString = JSON.stringify(result.optimized_route);
          if (routeString.includes(placeId)) {
            affectedOptimizations++;
          }
        }
      }
      
      if (affectedOptimizations > 0) {
        processedItems.push('optimization_results');
        console.log(`Found ${affectedOptimizations} optimization results that reference this place`);
      }
    }

    // 3. Check for any messages that mention this place
    const { data: relatedMessages, error: msgError } = await supabase
      .from('messages')
      .select('id')
      .eq('trip_id', place.trip_id)
      .ilike('content', `%${place.name}%`);

    if (!msgError && relatedMessages && relatedMessages.length > 0) {
      processedItems.push('related_messages');
      console.log(`Found ${relatedMessages.length} messages that mention this place`);
    }

    // 4. Check for usage events related to this place
    const { data: usageEvents, error: usageError } = await supabase
      .from('usage_events')
      .select('id')
      .eq('event_category', 'place_management')
      .contains('metadata', { place_id: placeId });

    if (!usageError && usageEvents && usageEvents.length > 0) {
      processedItems.push('usage_events');
      console.log(`Found ${usageEvents.length} usage events for this place`);
    }

    console.log(`Related data processing completed for place ${placeId}`);
    return {
      processedItems,
      hadScheduledData,
      affectedOptimizations,
      relatedMessagesCount: relatedMessages?.length || 0,
      usageEventsCount: usageEvents?.length || 0
    };

  } catch (error) {
    console.warn('Error processing related data:', error);
    return {
      processedItems: ['error_occurred'],
      hadScheduledData: false,
      affectedOptimizations: 0,
      error: error.message
    };
  }
}

// Send place deletion notification to trip members
async function sendPlaceDeletionNotification(
  deletedPlace: any,
  deletedByUserId: string,
  relatedDataInfo: any,
  supabase: any
): Promise<void> {
  try {
    // Get trip members (excluding deleter)
    const { data: tripMembers, error: membersError } = await supabase
      .from('trip_members')
      .select(`
        user_id,
        user:users(id, name, email)
      `)
      .eq('trip_id', deletedPlace.trip_id)
      .neq('user_id', deletedByUserId);

    if (membersError) {
      console.warn('Failed to fetch trip members for deletion notification:', membersError);
      return;
    }

    if (!tripMembers || tripMembers.length === 0) {
      console.log('No other members to notify for place deletion');
      return;
    }

    // Get deleter information
    const { data: deleter, error: deleterError } = await supabase
      .from('users')
      .select('name')
      .eq('id', deletedByUserId)
      .single();

    if (deleterError) {
      console.warn('Failed to fetch deleter info:', deleterError);
      return;
    }

    // Create notification message with impact information
    let impactDetails = '';
    if (relatedDataInfo.hadScheduledData) {
      impactDetails += ' This may affect the trip schedule.';
    }
    if (relatedDataInfo.affectedOptimizations > 0) {
      impactDetails += ` ${relatedDataInfo.affectedOptimizations} optimization result(s) may be affected.`;
    }

    const notificationMessage = `${deleter.name} deleted "${deletedPlace.name}" from the trip.${impactDetails}`;

    // Send notifications to database
    const notifications = tripMembers.map((member: any) => ({
      user_id: member.user_id,
      trip_id: deletedPlace.trip_id,
      type: 'place_deleted',
      title: 'Place removed from trip',
      message: notificationMessage,
      data: {
        deleted_place_id: deletedPlace.id,
        deleted_place_name: deletedPlace.name,
        deleted_place_category: deletedPlace.category,
        deleted_by: deleter.name,
        deleted_by_id: deletedByUserId,
        trip_id: deletedPlace.trip_id,
        impact_info: relatedDataInfo
      },
      created_at: new Date().toISOString(),
      read: false
    }));

    // Save notifications to database
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notificationError) {
      console.warn('Failed to save deletion notifications:', notificationError);
    } else {
      console.log(`Place deletion notifications sent to ${notifications.length} members`);
    }

    // Broadcast real-time notification
    await broadcastRealtimeDeletionNotification(deletedPlace.trip_id, {
      type: 'place_deleted',
      place: {
        id: deletedPlace.id,
        name: deletedPlace.name,
        category: deletedPlace.category
      },
      deleted_by: deleter.name,
      impact_info: relatedDataInfo,
      message: notificationMessage
    }, supabase);

  } catch (error) {
    console.error('Error sending place deletion notification:', error);
    // Don't let notification errors affect deletion success
  }
}

// Broadcast real-time deletion notifications
async function broadcastRealtimeDeletionNotification(
  tripId: string,
  notificationData: any,
  supabase: any
): Promise<void> {
  try {
    // Broadcast notification to Supabase Realtime channel
    await supabase
      .channel(`trip-${tripId}`)
      .send({
        type: 'broadcast',
        event: 'place_deletion_notification',
        payload: notificationData
      });

    console.log(`Realtime deletion notification broadcasted to trip-${tripId}`);
  } catch (error) {
    console.warn('Failed to broadcast realtime deletion notification:', error);
  }
}