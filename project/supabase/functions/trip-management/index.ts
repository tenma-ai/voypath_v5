import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TripCreateRequest {
  departure_location: string; // Required - most important field
  name?: string; // Optional - auto-generated if not provided
  description?: string;
  destination?: string; // Optional - can be "same as departure location" or auto-set
  start_date?: string; // Optional - for unscheduled trips
  end_date?: string; // Optional - for unscheduled trips
  add_place_deadline?: string;
  max_members?: number;
  optimization_preferences?: Record<string, any>;
}

interface TripUpdateRequest {
  trip_id: string;
  departure_location?: string;
  name?: string;
  description?: string;
  destination?: string;
  start_date?: string;
  end_date?: string;
  add_place_deadline?: string;
  max_members?: number;
  optimization_preferences?: Record<string, any>;
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
        return await handleCreateTrip(req, supabaseClient, user.id);
      
      case 'GET':
        if (pathSegments.length >= 2) {
          // GET /trip-management/{trip_id}
          const tripId = pathSegments[1];
          return await handleGetTrip(supabaseClient, user.id, tripId);
        } else {
          // GET /trip-management (ユーザーの旅行一覧)
          return await handleGetUserTrips(supabaseClient, user.id);
        }
      
      case 'PUT':
        return await handleUpdateTrip(req, supabaseClient, user.id);
      
      case 'DELETE':
        if (pathSegments.length >= 2) {
          const tripId = pathSegments[1];
          return await handleDeleteTrip(supabaseClient, user.id, tripId);
        } else {
          throw new Error('Trip ID is required for deletion');
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
    // Error occurred
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

async function handleCreateTrip(req: Request, supabase: any, userId: string) {
  const requestData: TripCreateRequest = await req.json();
  
  // バリデーション - departure_location is the only required field
  if (!requestData.departure_location?.trim()) {
    throw new Error('Departure location is required');
  }

  // 日付検証（提供された場合のみ）
  if (requestData.start_date && requestData.end_date) {
    const startDate = new Date(requestData.start_date);
    const endDate = new Date(requestData.end_date);
    
    if (endDate <= startDate) {
      throw new Error('End date must be after start date');
    }
  }

  // Use the database function to create trip with automatic departure/destination place generation
  const { data: tripId, error: tripError } = await supabase
    .rpc('create_trip_with_owner', {
      p_departure_location: requestData.departure_location,
      p_departure_latitude: requestData.departure_latitude || null,
      p_departure_longitude: requestData.departure_longitude || null,
      p_name: requestData.name || null,
      p_description: requestData.description || null,
      p_destination: requestData.destination || null,
      p_destination_latitude: requestData.destination_latitude || null,
      p_destination_longitude: requestData.destination_longitude || null,
      p_start_date: requestData.start_date || null,
      p_end_date: requestData.end_date || null,
      p_owner_id: userId
    });

  if (tripError) {
    throw new Error(`Failed to create trip: ${tripError.message}`);
  }

  // Get the created trip details
  const { data: trip, error: fetchError } = await supabase
    .from('trips')
    .select(`
      *,
      places(id, name, category, source)
    `)
    .eq('id', tripId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch created trip: ${fetchError.message}`);
  }

  // Update trip with additional settings if provided
  if (requestData.add_place_deadline || requestData.max_members || requestData.optimization_preferences) {
    const updateData: any = {};
    
    if (requestData.add_place_deadline) updateData.add_place_deadline = requestData.add_place_deadline;
    if (requestData.max_members) updateData.max_members = requestData.max_members;
    if (requestData.optimization_preferences) {
      updateData.optimization_preferences = requestData.optimization_preferences;
    } else {
      updateData.optimization_preferences = {
        fairness_weight: 0.6,
        efficiency_weight: 0.4,
        auto_optimize: false,
        include_meals: true,
        preferred_transport: null
      };
    }

    const { error: updateError } = await supabase
      .from('trips')
      .update(updateData)
      .eq('id', tripId);

    if (updateError) {
      // Warning occurred
    }
  }

  // 使用状況イベント記録
  const duration_days = requestData.start_date && requestData.end_date
    ? Math.ceil((new Date(requestData.end_date).getTime() - new Date(requestData.start_date).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  await supabase
    .from('usage_events')
    .insert({
      user_id: userId,
      event_type: 'trip_created',
      event_category: 'trip_management',
      trip_id: tripId,
      metadata: {
        departure_location: trip.departure_location,
        destination: trip.destination,
        trip_name: trip.name,
        duration_days,
        has_dates: !!(requestData.start_date && requestData.end_date),
        auto_generated_places: trip.places.filter((p: any) => p.source === 'system').length
      }
    });

  return new Response(
    JSON.stringify({ 
      success: true, 
      trip: trip,
      message: 'Trip created successfully with departure and destination places'
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    }
  );
}

async function handleGetUserTrips(supabase: any, userId: string) {
  // ユーザーが参加している旅行一覧を取得
  const { data: trips, error } = await supabase
    .from('trips')
    .select(`
      *,
      trip_members!inner(role, joined_at),
      places(count),
      messages(count)
    `)
    .eq('trip_members.user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch trips: ${error.message}`);
  }

  // 統計情報を追加
  const enrichedTrips = trips.map(trip => ({
    ...trip,
    member_count: trip.total_members || 0,
    place_count: trip.total_places || 0,
    user_role: trip.trip_members[0]?.role || 'member',
    is_owner: trip.owner_id === userId,
    days_until_start: Math.ceil((new Date(trip.start_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
    status: getTripStatus(trip)
  }));

  return new Response(
    JSON.stringify({ 
      success: true, 
      trips: enrichedTrips,
      total_count: trips.length
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
}

async function handleGetTrip(supabase: any, userId: string, tripId: string) {
  // 特定の旅行の詳細情報を取得
  const { data: trip, error } = await supabase
    .from('trips')
    .select(`
      *,
      trip_members!inner(
        role, 
        joined_at, 
        can_add_places, 
        can_edit_places, 
        can_optimize, 
        can_invite_members,
        user:users(id, name, avatar_url, is_premium)
      ),
      places(
        id, name, category, wish_level, user_id, created_at,
        user:users(name, avatar_url)
      ),
      optimization_results(
        id, optimization_score, created_at, is_active
      )
    `)
    .eq('id', tripId)
    .eq('trip_members.user_id', userId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch trip: ${error.message}`);
  }

  // ユーザーの権限情報を取得
  const userMember = trip.trip_members.find((member: any) => member.user.id === userId);
  
  const enrichedTrip = {
    ...trip,
    user_permissions: {
      role: userMember?.role || 'member',
      can_add_places: userMember?.can_add_places || false,
      can_edit_places: userMember?.can_edit_places || false,
      can_optimize: userMember?.can_optimize || false,
      can_invite_members: userMember?.can_invite_members || false,
      is_owner: trip.owner_id === userId
    },
    statistics: {
      total_members: trip.trip_members.length,
      total_places: trip.places.length,
      places_by_user: trip.places.reduce((acc: any, place: any) => {
        acc[place.user_id] = (acc[place.user_id] || 0) + 1;
        return acc;
      }, {}),
      avg_wish_level: trip.places.length > 0 
        ? trip.places.reduce((sum: number, place: any) => sum + place.wish_level, 0) / trip.places.length 
        : 0
    },
    status: getTripStatus(trip),
    latest_optimization: trip.optimization_results.find((result: any) => result.is_active)
  };

  return new Response(
    JSON.stringify({ 
      success: true, 
      trip: enrichedTrip
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
}

async function handleUpdateTrip(req: Request, supabase: any, userId: string) {
  const requestData: TripUpdateRequest = await req.json();
  
  if (!requestData.trip_id) {
    throw new Error('Trip ID is required');
  }

  // 更新権限確認（所有者のみ）
  const { data: trip, error: checkError } = await supabase
    .from('trips')
    .select('owner_id')
    .eq('id', requestData.trip_id)
    .single();

  if (checkError) {
    throw new Error(`Trip not found: ${checkError.message}`);
  }

  if (trip.owner_id !== userId) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions' }),
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

  if (requestData.departure_location) updateData.departure_location = requestData.departure_location;
  if (requestData.name) updateData.name = requestData.name;
  if (requestData.description !== undefined) updateData.description = requestData.description;
  if (requestData.destination) updateData.destination = requestData.destination;
  if (requestData.start_date) updateData.start_date = requestData.start_date;
  if (requestData.end_date) updateData.end_date = requestData.end_date;
  if (requestData.add_place_deadline !== undefined) updateData.add_place_deadline = requestData.add_place_deadline;
  if (requestData.max_members) updateData.max_members = requestData.max_members;
  if (requestData.optimization_preferences) updateData.optimization_preferences = requestData.optimization_preferences;

  // 日付検証（提供された場合）
  if (updateData.start_date && updateData.end_date) {
    const startDate = new Date(updateData.start_date);
    const endDate = new Date(updateData.end_date);
    
    if (endDate <= startDate) {
      throw new Error('End date must be after start date');
    }
  }

  // 旅行更新
  const { data: updatedTrip, error: updateError } = await supabase
    .from('trips')
    .update(updateData)
    .eq('id', requestData.trip_id)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to update trip: ${updateError.message}`);
  }

  // 使用状況イベント記録
  await supabase
    .from('usage_events')
    .insert({
      user_id: userId,
      event_type: 'trip_updated',
      event_category: 'trip_management',
      trip_id: requestData.trip_id,
      metadata: {
        updated_fields: Object.keys(updateData).filter(key => key !== 'updated_at')
      }
    });

  return new Response(
    JSON.stringify({ 
      success: true, 
      trip: updatedTrip,
      message: 'Trip updated successfully'
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
}

async function handleDeleteTrip(supabase: any, userId: string, tripId: string) {
  // 削除権限確認（所有者のみ）
  const { data: trip, error: checkError } = await supabase
    .from('trips')
    .select('owner_id, name')
    .eq('id', tripId)
    .single();

  if (checkError) {
    throw new Error(`Trip not found: ${checkError.message}`);
  }

  if (trip.owner_id !== userId) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      }
    );
  }

  // 旅行削除（カスケード削除により関連データも自動削除される）
  const { error: deleteError } = await supabase
    .from('trips')
    .delete()
    .eq('id', tripId);

  if (deleteError) {
    throw new Error(`Failed to delete trip: ${deleteError.message}`);
  }

  // 使用状況イベント記録
  await supabase
    .from('usage_events')
    .insert({
      user_id: userId,
      event_type: 'trip_deleted',
      event_category: 'trip_management',
      trip_id: tripId,
      metadata: {
        trip_name: trip.name
      }
    });

  return new Response(
    JSON.stringify({ 
      success: true,
      message: 'Trip deleted successfully'
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
}

function getTripStatus(trip: any): string {
  const now = new Date();
  const startDate = new Date(trip.start_date);
  const endDate = new Date(trip.end_date);
  
  if (now < startDate) {
    return 'planning';
  } else if (now >= startDate && now <= endDate) {
    return 'active';
  } else {
    return 'completed';
  }
}