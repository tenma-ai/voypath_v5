import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvitationCreateRequest {
  trip_id: string;
  max_uses?: number;
  expires_hours?: number;
  description?: string;
}

interface InvitationJoinRequest {
  invitation_code: string;
}

interface MemberUpdateRequest {
  trip_id: string;
  user_id: string;
  role?: 'admin' | 'member';
  can_add_places?: boolean;
  can_edit_places?: boolean;
  can_optimize?: boolean;
  can_invite_members?: boolean;
  nickname?: string;
}

serve(async (req) => {
  console.log('=== TRIP MEMBER MANAGEMENT FUNCTION START ===');
  console.log('URL:', req.url);
  console.log('Method:', req.method);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
  
  // CORS対応
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request handled');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 認証ヘッダー取得（大文字小文字両方対応）
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    console.log('🔐 Auth header received:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader) {
      console.log('❌ No authorization header found');
      return new Response(
        JSON.stringify({ error: 'Authorization header is required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    // Supabase クライアント初期化 - Service Roleキーを使用してRLSをバイパス
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    // Service Role用の別のクライアントを作成（RLSを完全にバイパス）
    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // 認証確認
    console.log('🔍 Attempting to get user from auth header...');
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    console.log('👤 User data:', user ? `Found user: ${user.id}` : 'No user found');
    console.log('❌ User error:', userError ? userError.message : 'No error');

    if (userError || !user) {
      console.log('❌ Authentication failed:', userError?.message || 'No user');
      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized',
          details: userError?.message || 'No user found'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    const url = new URL(req.url);
    const method = req.method;
    const pathSegments = url.pathname.split('/').filter(Boolean);

    console.log('🛣️ URL pathname:', url.pathname);
    console.log('📁 Path segments:', pathSegments);
    console.log('👤 Authenticated user ID:', user.id);

    // ルーティング
    switch (method) {
      case 'POST':
        if (pathSegments.includes('create-invitation') || url.pathname.endsWith('/create-invitation')) {
          return await handleCreateInvitation(req, supabaseClient, user.id);
        } else if (pathSegments.includes('join-trip') || url.pathname.endsWith('/join-trip')) {
          // Use service client for join-trip to bypass RLS completely
          return await handleJoinTrip(req, supabaseServiceClient, user.id);
        } else {
          throw new Error('Invalid POST endpoint');
        }
      
      case 'GET':
        if (pathSegments.includes('invitations') && pathSegments.length >= 3) {
          // GET /trip-member-management/invitations/{trip_id}
          const tripId = pathSegments[2];
          return await handleGetInvitations(supabaseClient, user.id, tripId);
        } else if (pathSegments.includes('members') && pathSegments.length >= 3) {
          // GET /trip-member-management/members/{trip_id}
          const tripId = pathSegments[2];
          return await handleGetMembers(supabaseClient, user.id, tripId);
        } else {
          throw new Error('Invalid GET endpoint');
        }
      
      case 'PUT':
        return await handleUpdateMember(req, supabaseClient, user.id);
      
      case 'DELETE':
        if (pathSegments.includes('members') && pathSegments.length >= 4) {
          // DELETE /trip-member-management/members/{trip_id}/{user_id}
          const tripId = pathSegments[2];
          const targetUserId = pathSegments[3];
          return await handleRemoveMember(supabaseClient, user.id, tripId, targetUserId);
        } else {
          throw new Error('Invalid DELETE endpoint');
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
    console.error('❌ Trip Member Management Error:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Request URL:', req.url);
    console.error('❌ Request method:', req.method);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Check server logs for more information',
        url: req.url,
        method: req.method
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

async function handleCreateInvitation(req: Request, supabase: any, userId: string) {
  const requestData: InvitationCreateRequest = await req.json();
  
  if (!requestData.trip_id) {
    throw new Error('Trip ID is required');
  }

  // 招待権限確認
  const { data: memberCheck, error: memberError } = await supabase
    .from('trip_members')
    .select('role, can_invite_members')
    .eq('trip_id', requestData.trip_id)
    .eq('user_id', userId)
    .single();

  if (memberError) {
    throw new Error('You are not a member of this trip');
  }

  if (memberCheck.role !== 'admin' && !memberCheck.can_invite_members) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions to create invitations' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      }
    );
  }

  // 招待コード生成（8文字のランダム英数字）
  const invitationCode = generateInvitationCode();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + (requestData.expires_hours || 72));

  const { data: invitations, error: invitationError } = await supabase
    .from('invitation_codes')
    .insert({
      trip_id: requestData.trip_id,
      created_by: userId,
      code: invitationCode,
      max_uses: requestData.max_uses || 1,
      expires_at: expiresAt.toISOString(),
      description: requestData.description || 'Trip invitation'
    })
    .select('*');

  if (invitationError || !invitations || invitations.length === 0) {
    throw new Error(`Failed to create invitation: ${invitationError?.message || 'Unknown error'}`);
  }

  const invitation = invitations[0];

  // トリップ情報を取得
  const { data: trips, error: tripError } = await supabase
    .from('trips')
    .select('name, destination, start_date, end_date')
    .eq('id', requestData.trip_id)
    .limit(1);

  if (trips && trips.length > 0) {
    invitation.trip = trips[0];
  }

  // 使用状況イベント記録
  await supabase
    .from('usage_events')
    .insert({
      user_id: userId,
      event_type: 'invitation_created',
      event_category: 'trip_management',
      trip_id: requestData.trip_id,
      metadata: {
        invitation_code: invitationCode,
        max_uses: requestData.max_uses || 1,
        expires_hours: requestData.expires_hours || 72
      }
    });

  return new Response(
    JSON.stringify({ 
      success: true, 
      invitation: invitation,
      message: 'Invitation created successfully'
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    }
  );
}

async function handleJoinTrip(req: Request, supabase: any, userId: string) {
  console.log('🎯 handleJoinTrip called for user:', userId);
  
  // Debug Supabase configuration
  console.log('🔧 Supabase URL:', Deno.env.get('SUPABASE_URL'));
  console.log('🔧 Service Role Key exists:', !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  console.log('🔧 Service Role Key length:', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.length);
  console.log('🔧 Service Role Key first 10 chars:', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.substring(0, 10));
  
  const requestData: InvitationJoinRequest = await req.json();
  console.log('📝 Request data:', JSON.stringify(requestData));
  
  if (!requestData.invitation_code) {
    console.log('❌ No invitation code provided');
    throw new Error('Invitation code is required');
  }

  // 招待コード検証
  const inviteCode = requestData.invitation_code.toUpperCase();
  console.log('🔍 Searching for invitation code:', inviteCode);
  console.log('📊 Querying invitation_codes table...');
  
  // Test direct SQL query to bypass any potential RLS issues
  console.log('🔧 Testing with direct SQL query...');
  const { data: sqlResult, error: sqlError } = await supabase.rpc('get_invitation_code_direct', {
    p_code: inviteCode
  }).single();
  
  if (sqlError) {
    console.log('❌ SQL RPC error:', sqlError);
    // If RPC doesn't exist, continue with regular query
  } else {
    console.log('✅ SQL RPC result:', sqlResult);
  }
  
  // First, let's check all invitation codes to debug
  const { data: allCodes, error: allError } = await supabase
    .from('invitation_codes')
    .select('code, is_active, trip_id')
    .limit(20);
  
  console.log('📋 All invitation codes (first 20):', allCodes);
  console.log('❌ All codes error:', allError);
  
  // Now search for the specific code
  const { data: invitations, error: invitationError } = await supabase
    .from('invitation_codes')
    .select('*')
    .eq('code', inviteCode)
    .eq('is_active', true)
    .limit(1);
  
  console.log('📊 Full query result:', {
    invitations: invitations,
    error: invitationError,
    searchedCode: inviteCode
  });

  console.log('📋 Invitation search result:', invitations?.length ? `Found ${invitations.length} records` : 'Not found');
  console.log('❌ Invitation error:', invitationError?.message || 'No error');

  // If the regular query fails, use the RPC function
  let invitation = null;
  if (invitationError || !invitations || invitations.length === 0) {
    console.log('⚠️ Regular query failed, trying RPC function...');
    
    if (sqlResult && !sqlError) {
      console.log('✅ Using RPC function result');
      invitation = sqlResult;
    } else {
      console.log('❌ Both regular query and RPC failed');
      return new Response(
        JSON.stringify({ 
          error: 'Invalid or expired invitation code',
          details: invitationError?.message || 'Invitation not found'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      );
    }
  } else {
    invitation = invitations[0];
  }
  console.log('✅ Found invitation:', invitation.id);

  // トリップ情報を取得
  console.log('🎯 Fetching trip info for:', invitation.trip_id);
  const { data: trips, error: tripError } = await supabase
    .from('trips')
    .select('id, name, max_members, total_members')
    .eq('id', invitation.trip_id)
    .limit(1);

  if (tripError || !trips || trips.length === 0) {
    console.log('❌ Trip not found:', tripError?.message);
    return new Response(
      JSON.stringify({ 
        error: 'Associated trip not found',
        details: tripError?.message || 'Trip not found'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      }
    );
  }

  const trip = trips[0];
  console.log('✅ Found trip:', trip.name);

  // invitation オブジェクトに trip 情報を追加
  invitation.trip = trip;

  // 有効期限チェック
  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    return new Response(
      JSON.stringify({ error: 'Invitation code has expired' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 410,
      }
    );
  }

  // 使用回数チェック
  if (invitation.current_uses >= invitation.max_uses) {
    return new Response(
      JSON.stringify({ error: 'Invitation code has reached maximum uses' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 410,
      }
    );
  }

  // 既存メンバーチェック
  console.log('👤 Checking if user is already a member...');
  const { data: existingMembers } = await supabase
    .from('trip_members')
    .select('user_id')
    .eq('trip_id', invitation.trip_id)
    .eq('user_id', userId)
    .limit(1);

  if (existingMembers && existingMembers.length > 0) {
    console.log('❌ User is already a member of this trip');
    return new Response(
      JSON.stringify({ error: 'You are already a member of this trip' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 409,
      }
    );
  }

  // 最大メンバー数チェック
  if (invitation.trip.total_members >= invitation.trip.max_members) {
    return new Response(
      JSON.stringify({ error: 'Trip has reached maximum number of members' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 409,
      }
    );
  }

  // メンバー追加
  console.log('👥 Adding user as member to trip:', invitation.trip_id);
  const { data: newMembers, error: memberError } = await supabase
    .from('trip_members')
    .insert({
      trip_id: invitation.trip_id,
      user_id: userId,
      role: 'member',
      invited_by: invitation.created_by,
      invitation_accepted_at: new Date().toISOString(),
      can_add_places: true,
      can_edit_places: false,
      can_optimize: true,
      can_invite_members: false
    })
    .select('*');

  if (memberError || !newMembers || newMembers.length === 0) {
    console.log('❌ Failed to add member:', memberError?.message);
    throw new Error(`Failed to join trip: ${memberError?.message || 'Unknown error'}`);
  }

  const newMember = newMembers[0];
  console.log('✅ Successfully added member:', newMember.user_id);

  // ユーザー情報を取得
  const { data: userDataArray } = await supabase
    .from('users')
    .select('name, avatar_url')
    .eq('id', userId)
    .limit(1);

  if (userDataArray && userDataArray.length > 0) {
    newMember.user = userDataArray[0];
  }

  // トリップ情報を追加
  newMember.trip = invitation.trip;

  // 招待コード使用回数更新
  await supabase
    .from('invitation_codes')
    .update({
      current_uses: invitation.current_uses + 1,
      used_at: [...(invitation.used_at || []), new Date().toISOString()]
    })
    .eq('id', invitation.id);

  // 他のメンバーに通知作成
  const { data: tripMembers } = await supabase
    .from('trip_members')
    .select('user_id')
    .eq('trip_id', invitation.trip_id)
    .neq('user_id', userId);

  if (tripMembers && tripMembers.length > 0) {
    const notifications = tripMembers.map(member => ({
      user_id: member.user_id,
      title: 'New member joined',
      content: `${newMember.user.name} joined ${newMember.trip.name}`,
      notification_type: 'trip_invitation',
      trip_id: invitation.trip_id,
      related_user_id: userId
    }));

    await supabase
      .from('notifications')
      .insert(notifications);
  }

  // 使用状況イベント記録
  await supabase
    .from('usage_events')
    .insert({
      user_id: userId,
      event_type: 'trip_joined',
      event_category: 'trip_management',
      trip_id: invitation.trip_id,
      metadata: {
        invitation_code: requestData.invitation_code,
        trip_name: invitation.trip.name
      }
    });

  return new Response(
    JSON.stringify({ 
      success: true, 
      member: newMember,
      trip: newMember.trip,
      message: 'Successfully joined the trip'
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    }
  );
}

async function handleGetInvitations(supabase: any, userId: string, tripId: string) {
  // 招待コード一覧取得権限確認
  const { data: memberCheck, error: memberError } = await supabase
    .from('trip_members')
    .select('role, can_invite_members')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .single();

  if (memberError) {
    throw new Error('You are not a member of this trip');
  }

  if (memberCheck.role !== 'admin' && !memberCheck.can_invite_members) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions to view invitations' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      }
    );
  }

  const { data: invitations, error } = await supabase
    .from('invitation_codes')
    .select(`
      *,
      created_by_user:users!created_by(name, avatar_url)
    `)
    .eq('trip_id', tripId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch invitations: ${error.message}`);
  }

  // 招待コードのステータス確認
  const enrichedInvitations = invitations.map(invitation => ({
    ...invitation,
    is_expired: invitation.expires_at && new Date(invitation.expires_at) < new Date(),
    is_exhausted: invitation.current_uses >= invitation.max_uses,
    remaining_uses: invitation.max_uses - invitation.current_uses
  }));

  return new Response(
    JSON.stringify({ 
      success: true, 
      invitations: enrichedInvitations
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
}

async function handleGetMembers(supabase: any, userId: string, tripId: string) {
  // メンバー一覧取得（メンバーなら参照可能）
  const { data: memberCheck, error: memberError } = await supabase
    .from('trip_members')
    .select('user_id')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .single();

  if (memberError) {
    throw new Error('You are not a member of this trip');
  }

  const { data: members, error } = await supabase
    .from('trip_members')
    .select(`
      *,
      user:users(id, name, display_name, avatar_url, is_premium),
      invited_by_user:users!invited_by(name, avatar_url)
    `)
    .eq('trip_id', tripId)
    .order('joined_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch members: ${error.message}`);
  }

  // メンバー統計情報を追加
  const enrichedMembers = await Promise.all(
    members.map(async (member) => {
      // 各メンバーの場所追加数を取得
      const { count: placeCount } = await supabase
        .from('places')
        .select('*', { count: 'exact', head: true })
        .eq('trip_id', tripId)
        .eq('user_id', member.user_id);

      return {
        ...member,
        statistics: {
          places_added: placeCount || 0,
          days_since_joined: Math.ceil((new Date().getTime() - new Date(member.joined_at).getTime()) / (1000 * 60 * 60 * 24))
        }
      };
    })
  );

  return new Response(
    JSON.stringify({ 
      success: true, 
      members: enrichedMembers,
      total_count: members.length
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
}

async function handleUpdateMember(req: Request, supabase: any, userId: string) {
  const requestData: MemberUpdateRequest = await req.json();
  
  if (!requestData.trip_id || !requestData.user_id) {
    throw new Error('Trip ID and User ID are required');
  }

  // 更新権限確認（管理者のみ）
  const { data: adminCheck, error: adminError } = await supabase
    .from('trip_members')
    .select('role')
    .eq('trip_id', requestData.trip_id)
    .eq('user_id', userId)
    .single();

  if (adminError) {
    throw new Error('You are not a member of this trip');
  }

  if (adminCheck.role !== 'admin') {
    return new Response(
      JSON.stringify({ error: 'Only administrators can update member permissions' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      }
    );
  }

  // 対象メンバーが存在するかチェック
  const { data: targetMember, error: targetError } = await supabase
    .from('trip_members')
    .select('user_id, role')
    .eq('trip_id', requestData.trip_id)
    .eq('user_id', requestData.user_id)
    .single();

  if (targetError) {
    throw new Error('Target user is not a member of this trip');
  }

  // 更新データ準備
  const updateData: any = {};
  
  if (requestData.role !== undefined) updateData.role = requestData.role;
  if (requestData.can_add_places !== undefined) updateData.can_add_places = requestData.can_add_places;
  if (requestData.can_edit_places !== undefined) updateData.can_edit_places = requestData.can_edit_places;
  if (requestData.can_optimize !== undefined) updateData.can_optimize = requestData.can_optimize;
  if (requestData.can_invite_members !== undefined) updateData.can_invite_members = requestData.can_invite_members;
  if (requestData.nickname !== undefined) updateData.nickname = requestData.nickname;

  // メンバー情報更新
  const { data: updatedMember, error: updateError } = await supabase
    .from('trip_members')
    .update(updateData)
    .eq('trip_id', requestData.trip_id)
    .eq('user_id', requestData.user_id)
    .select(`
      *,
      user:users(name, avatar_url)
    `)
    .single();

  if (updateError) {
    throw new Error(`Failed to update member: ${updateError.message}`);
  }

  // 使用状況イベント記録
  await supabase
    .from('usage_events')
    .insert({
      user_id: userId,
      event_type: 'member_updated',
      event_category: 'trip_management',
      trip_id: requestData.trip_id,
      metadata: {
        target_user_id: requestData.user_id,
        updated_fields: Object.keys(updateData)
      }
    });

  return new Response(
    JSON.stringify({ 
      success: true, 
      member: updatedMember,
      message: 'Member updated successfully'
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
}

async function handleRemoveMember(supabase: any, userId: string, tripId: string, targetUserId: string) {
  // 削除権限確認
  const { data: adminCheck, error: adminError } = await supabase
    .from('trip_members')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .single();

  if (adminError) {
    throw new Error('You are not a member of this trip');
  }

  // 自分を削除する場合は許可、他人を削除する場合は管理者権限が必要
  if (targetUserId !== userId && adminCheck.role !== 'admin') {
    return new Response(
      JSON.stringify({ error: 'Only administrators can remove other members' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      }
    );
  }

  // 旅行の所有者かチェック
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('owner_id')
    .eq('id', tripId)
    .single();

  if (tripError) {
    throw new Error('Trip not found');
  }

  // 旅行の所有者は削除できない
  if (targetUserId === trip.owner_id) {
    return new Response(
      JSON.stringify({ error: 'Trip owner cannot be removed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }

  // メンバー削除
  const { error: removeError } = await supabase
    .from('trip_members')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', targetUserId);

  if (removeError) {
    throw new Error(`Failed to remove member: ${removeError.message}`);
  }

  // 使用状況イベント記録
  await supabase
    .from('usage_events')
    .insert({
      user_id: userId,
      event_type: targetUserId === userId ? 'left_trip' : 'member_removed',
      event_category: 'trip_management',
      trip_id: tripId,
      metadata: {
        target_user_id: targetUserId
      }
    });

  return new Response(
    JSON.stringify({ 
      success: true,
      message: 'Member removed successfully'
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
}

function generateInvitationCode(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}