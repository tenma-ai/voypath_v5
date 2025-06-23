import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateShareLinkRequest {
  action: 'create_share_link';
  trip_id: string;
  share_type: 'external_view' | 'collaboration';
  permissions: {
    can_view_places: boolean;
    can_add_places?: boolean;
    can_edit_places?: boolean;
    can_view_optimization?: boolean;
    can_optimize?: boolean;
    can_export?: boolean;
    can_comment?: boolean;
    can_join_as_member?: boolean;
  };
  password?: string;
  expires_hours?: number;
}

interface GetSharedTripRequest {
  action: 'get_shared_trip';
  shareToken: string;
  password?: string;
}

serve(async (req) => {
  console.log('=== TRIP SHARING V3 FUNCTION START ===');
  console.log('URL:', req.url);
  console.log('Method:', req.method);
  
  // CORS対応
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request handled');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Supabase クライアント初期化（認証不要の場合もあるため、anon keyで初期化）
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 405,
        }
      );
    }

    const requestData = await req.json();
    console.log('📝 Request data:', JSON.stringify(requestData, null, 2));

    switch (requestData.action) {
      case 'create_share_link':
        return await handleCreateShareLink(requestData as CreateShareLinkRequest, supabaseClient);
      case 'get_shared_trip':
        return await handleGetSharedTrip(requestData as GetSharedTripRequest, supabaseClient);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
    }
  } catch (error) {
    console.error('❌ Trip Sharing V3 Error:', error);
    console.error('❌ Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Check server logs for more information'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

async function handleCreateShareLink(requestData: CreateShareLinkRequest, supabase: any) {
  console.log('🔗 Creating share link for trip:', requestData.trip_id);

  // トリップの存在確認
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('id, name, description, start_date, end_date, total_members')
    .eq('id', requestData.trip_id)
    .single();

  if (tripError || !trip) {
    console.log('❌ Trip not found:', requestData.trip_id);
    return new Response(
      JSON.stringify({ error: 'Trip not found' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      }
    );
  }

  // 共有トークン生成
  const shareToken = generateShareToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + (requestData.expires_hours || 168)); // Default 1 week

  // 既存のアクティブな共有リンクをチェック
  const { data: existingShares } = await supabase
    .from('trip_shares')
    .select('share_token')
    .eq('trip_id', requestData.trip_id)
    .eq('share_type', requestData.share_type)
    .eq('is_active', true)
    .limit(1);

  if (existingShares && existingShares.length > 0) {
    console.log('✅ Using existing share link:', existingShares[0].share_token);
    return new Response(
      JSON.stringify({ 
        success: true,
        shareToken: existingShares[0].share_token,
        shareUrl: `https://voypath.app/shared/${existingShares[0].share_token}`,
        message: 'Using existing share link'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }

  // 新しい共有リンク作成
  const { data: shareData, error: shareError } = await supabase
    .from('trip_shares')
    .insert({
      trip_id: requestData.trip_id,
      share_token: shareToken,
      share_type: requestData.share_type,
      permissions: requestData.permissions,
      password_hash: requestData.password ? await hashPassword(requestData.password) : null,
      expires_at: expiresAt.toISOString(),
      is_active: true
    })
    .select('*')
    .single();

  if (shareError) {
    console.error('❌ Failed to create share link:', shareError);
    return new Response(
      JSON.stringify({ error: 'Failed to create share link' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }

  console.log('✅ Share link created successfully:', shareToken);

  return new Response(
    JSON.stringify({ 
      success: true,
      shareToken: shareToken,
      shareUrl: `https://voypath.app/shared/${shareToken}`,
      share: shareData,
      message: 'Share link created successfully'
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    }
  );
}

async function handleGetSharedTrip(requestData: GetSharedTripRequest, supabase: any) {
  console.log('🔍 Getting shared trip for token:', requestData.shareToken);

  // 共有リンクの検索
  const { data: shareData, error: shareError } = await supabase
    .from('trip_shares')
    .select('*')
    .eq('share_token', requestData.shareToken)
    .eq('is_active', true)
    .single();

  if (shareError || !shareData) {
    console.log('❌ Share link not found:', requestData.shareToken);
    return new Response(
      JSON.stringify({ error: 'Share link not found or expired' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      }
    );
  }

  // 有効期限チェック
  if (shareData.expires_at && new Date(shareData.expires_at) < new Date()) {
    console.log('❌ Share link expired:', requestData.shareToken);
    return new Response(
      JSON.stringify({ error: 'Share link has expired' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 410,
      }
    );
  }

  // パスワードチェック
  if (shareData.password_hash && !requestData.password) {
    console.log('🔒 Password required for share link:', requestData.shareToken);
    return new Response(
      JSON.stringify({ 
        requiresPassword: true,
        message: 'Password required to access this shared trip'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }

  if (shareData.password_hash && requestData.password) {
    const isPasswordValid = await verifyPassword(requestData.password, shareData.password_hash);
    if (!isPasswordValid) {
      console.log('❌ Invalid password for share link:', requestData.shareToken);
      return new Response(
        JSON.stringify({ error: 'Invalid password' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }
  }

  // トリップ情報取得
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*')
    .eq('id', shareData.trip_id)
    .single();

  if (tripError || !trip) {
    console.log('❌ Trip not found for share:', shareData.trip_id);
    return new Response(
      JSON.stringify({ error: 'Associated trip not found' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      }
    );
  }

  // 場所情報取得
  const { data: places, error: placesError } = await supabase
    .from('places')
    .select('*')
    .eq('trip_id', shareData.trip_id)
    .order('created_at');

  if (placesError) {
    console.warn('⚠️ Failed to load places for shared trip:', placesError);
  }

  const result = {
    shareId: shareData.id,
    trip: {
      ...trip,
      places: places || []
    },
    permissions: shareData.permissions,
    shareType: shareData.share_type,
    createdAt: shareData.created_at
  };

  console.log('✅ Shared trip data retrieved successfully');

  return new Response(
    JSON.stringify(result),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
}

function generateShareToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const hashedInput = await hashPassword(password);
  return hashedInput === hash;
}