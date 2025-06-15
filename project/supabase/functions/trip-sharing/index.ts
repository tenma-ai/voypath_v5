import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, ...body } = await req.json();

    switch (action) {
      case 'create_share_link': {
        const authorization = req.headers.get('authorization');
        if (!authorization) {
          return new Response(
            JSON.stringify({ error: 'No authorization header' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify user authentication
        const userClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: authorization } } }
        );

        const { data: { user }, error: authError } = await userClient.auth.getUser();
        if (authError || !user) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify user can create shares for this trip
        const { data: member } = await supabaseClient
          .from('trip_members')
          .select('role, can_invite_members')
          .eq('trip_id', body.tripId)
          .eq('user_id', user.id)
          .single();

        if (!member || (member.role !== 'admin' && !member.can_invite_members)) {
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check user's sharing limits (Premium vs Free)
        const { data: userData } = await supabaseClient
          .from('users')
          .select('is_premium')
          .eq('id', user.id)
          .single();

        const isPremium = userData?.is_premium || false;

        // Count current active shares
        const { count: shareCount } = await supabaseClient
          .from('trip_shares')
          .select('id', { count: 'exact' })
          .eq('created_by', user.id)
          .eq('is_active', true);

        const maxShares = isPremium ? 999 : 2; // Premium: unlimited, Free: 2
        if ((shareCount || 0) >= maxShares) {
          return new Response(
            JSON.stringify({ 
              error: 'Share limit reached',
              current: shareCount,
              max: maxShares,
              upgrade_required: !isPremium 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Generate secure token
        const shareToken = Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        // Hash password if provided
        let passwordHash = null;
        if (body.password && isPremium) {
          const encoder = new TextEncoder();
          const data = encoder.encode(body.password);
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          passwordHash = Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        }

        // Create share link
        const shareData = {
          trip_id: body.tripId,
          share_token: shareToken,
          share_type: body.shareType || 'external_view',
          permissions: body.permissions || {
            can_view_places: true,
            can_add_places: false,
            can_edit_places: false,
            can_view_optimization: true,
            can_optimize: false,
            can_export: true,
            can_comment: false,
            can_join_as_member: false
          },
          expires_at: body.expiresAt || null,
          max_uses: isPremium ? body.maxUses || null : Math.min(body.maxUses || 100, 100),
          password_hash: passwordHash,
          created_by: user.id,
          is_active: true
        };

        const { data: share, error: shareError } = await supabaseClient
          .from('trip_shares')
          .insert(shareData)
          .select()
          .single();

        if (shareError) {
          return new Response(
            JSON.stringify({ error: shareError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            id: share.id,
            token: share.share_token,
            url: `${req.headers.get('origin')}/shared/${share.share_token}`,
            shareType: share.share_type,
            permissions: share.permissions,
            expiresAt: share.expires_at,
            maxUses: share.max_uses,
            hasPassword: !!passwordHash
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_shared_trip': {
        const { shareToken, password } = body;

        // Get share data
        const { data: share, error: shareError } = await supabaseClient
          .from('trip_shares')
          .select(`
            *,
            trips:trip_id (
              id, name, description, start_date, end_date,
              places (
                id, name, address, latitude, longitude, 
                category, wish_level, stay_duration_minutes, notes
              )
            )
          `)
          .eq('share_token', shareToken)
          .eq('is_active', true)
          .single();

        if (shareError || !share) {
          return new Response(
            JSON.stringify({ error: 'Invalid or expired share link' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check expiry
        if (share.expires_at && new Date(share.expires_at) < new Date()) {
          return new Response(
            JSON.stringify({ error: 'Share link has expired' }),
            { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check usage limit
        if (share.max_uses && share.current_uses >= share.max_uses) {
          return new Response(
            JSON.stringify({ error: 'Share link usage limit exceeded' }),
            { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check password if required
        if (share.password_hash) {
          if (!password) {
            return new Response(
              JSON.stringify({ 
                requiresPassword: true,
                shareId: share.id 
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Verify password
          const encoder = new TextEncoder();
          const data = encoder.encode(password);
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          const passwordHashCheck = Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

          if (passwordHashCheck !== share.password_hash) {
            return new Response(
              JSON.stringify({ error: 'Invalid password' }),
              { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // Record access
        await supabaseClient.rpc('record_share_access', {
          p_share_token: shareToken,
          p_ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
          p_user_agent: req.headers.get('user-agent'),
          p_referer: req.headers.get('referer')
        });

        return new Response(
          JSON.stringify({
            shareId: share.id,
            trip: share.trips,
            permissions: share.permissions,
            shareType: share.share_type,
            createdAt: share.created_at
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_my_shares': {
        const authorization = req.headers.get('authorization');
        if (!authorization) {
          return new Response(
            JSON.stringify({ error: 'No authorization header' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const userClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: authorization } } }
        );

        const { data: { user }, error: authError } = await userClient.auth.getUser();
        if (authError || !user) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: shares } = await supabaseClient
          .from('trip_shares')
          .select(`
            id, share_token, share_type, is_active, expires_at, 
            max_uses, current_uses, created_at, last_accessed_at,
            trips:trip_id (id, name)
          `)
          .eq('created_by', user.id)
          .order('created_at', { ascending: false });

        return new Response(
          JSON.stringify({ shares: shares || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_share': {
        const authorization = req.headers.get('authorization');
        if (!authorization) {
          return new Response(
            JSON.stringify({ error: 'No authorization header' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const userClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: authorization } } }
        );

        const { data: { user }, error: authError } = await userClient.auth.getUser();
        if (authError || !user) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { shareId, updates } = body;

        const { data: share, error: updateError } = await supabaseClient
          .from('trip_shares')
          .update(updates)
          .eq('id', shareId)
          .eq('created_by', user.id)
          .select()
          .single();

        if (updateError) {
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ share }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete_share': {
        const authorization = req.headers.get('authorization');
        if (!authorization) {
          return new Response(
            JSON.stringify({ error: 'No authorization header' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const userClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: authorization } } }
        );

        const { data: { user }, error: authError } = await userClient.auth.getUser();
        if (authError || !user) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { shareId } = body;

        const { error: deleteError } = await supabaseClient
          .from('trip_shares')
          .delete()
          .eq('id', shareId)
          .eq('created_by', user.id);

        if (deleteError) {
          return new Response(
            JSON.stringify({ error: deleteError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});