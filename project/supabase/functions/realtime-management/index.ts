import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RealtimeChannel {
  id?: string
  channel_name: string
  channel_type: 'trip' | 'place' | 'message' | 'optimization' | 'presence'
  trip_id: string
  is_active?: boolean
  max_subscribers?: number
  current_subscribers?: number
  metadata?: Record<string, any>
}

interface RealtimeConnection {
  id?: string
  user_id: string
  trip_id: string
  channel_name: string
  connection_id: string
  status?: 'connected' | 'disconnected' | 'reconnecting'
  metadata?: Record<string, any>
}

interface PresenceState {
  user_id: string
  trip_id: string
  user_info: {
    name: string
    avatar_url?: string
    display_name?: string
  }
  status: 'online' | 'away' | 'busy'
  last_seen: string
  current_page?: string
  metadata?: Record<string, any>
}

// Define proper types for request bodies
interface CreateChannelRequest {
  channel_name?: string
  channel_type: 'trip' | 'place' | 'message' | 'optimization' | 'presence'
  trip_id: string
  max_subscribers?: number
  metadata?: Record<string, unknown>
}

interface UpdateChannelRequest {
  channel_id: string
  channel_name?: string
  is_active?: boolean
  max_subscribers?: number
  metadata?: Record<string, unknown>
}

interface CreateConnectionRequest {
  trip_id: string
  channel_name: string
  connection_id: string
  metadata?: Record<string, unknown>
}

interface UpdateConnectionRequest {
  connection_id: string
  status?: 'connected' | 'disconnected' | 'reconnecting'
  metadata?: Record<string, unknown>
}

interface UpdatePresenceRequest {
  trip_id: string
  status?: 'online' | 'away' | 'busy'
  current_page?: string
  [key: string]: unknown
}

interface SubscribeRequest {
  trip_id: string
  subscription_type: string
  settings?: Record<string, unknown>
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    const url = new URL(req.url)
    const action = url.pathname.split('/').pop() || ''

    switch (req.method) {
      case 'GET':
        return await handleGet(supabaseClient, action, url.searchParams, user.id)
      case 'POST':
        const body = await req.json()
        return await handlePost(supabaseClient, action, body, user.id)
      case 'PUT':
        const updateBody = await req.json()
        return await handlePut(supabaseClient, action, updateBody, user.id)
      case 'DELETE':
        return await handleDelete(supabaseClient, action, url.searchParams, user.id)
      default:
        return new Response('Method not allowed', { status: 405, headers: corsHeaders })
    }
  } catch (error) {
    console.error('Realtime management error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function handleGet(supabaseClient: SupabaseClient, action: string, searchParams: URLSearchParams, userId: string) {
  switch (action) {
    case 'channels':
      return await getChannels(supabaseClient, searchParams, userId)
    case 'connections':
      return await getConnections(supabaseClient, searchParams, userId)
    case 'presence':
      return await getPresence(supabaseClient, searchParams, userId)
    case 'status':
      return await getRealtimeStatus(supabaseClient, searchParams, userId)
    default:
      return new Response('Not found', { status: 404, headers: corsHeaders })
  }
}

async function handlePost(supabaseClient: SupabaseClient, action: string, body: unknown, userId: string) {
  switch (action) {
    case 'channels':
      return await createChannel(supabaseClient, body as CreateChannelRequest, userId)
    case 'connections':
      return await createConnection(supabaseClient, body as CreateConnectionRequest, userId)
    case 'presence':
      return await updatePresence(supabaseClient, body as UpdatePresenceRequest, userId)
    case 'subscribe':
      return await subscribeToChannel(supabaseClient, body as SubscribeRequest, userId)
    default:
      return new Response('Not found', { status: 404, headers: corsHeaders })
  }
}

async function handlePut(supabaseClient: SupabaseClient, action: string, body: unknown, userId: string) {
  switch (action) {
    case 'channels':
      return await updateChannel(supabaseClient, body as UpdateChannelRequest, userId)
    case 'connections':
      return await updateConnection(supabaseClient, body as UpdateConnectionRequest, userId)
    case 'presence':
      return await updatePresence(supabaseClient, body as UpdatePresenceRequest, userId)
    default:
      return new Response('Not found', { status: 404, headers: corsHeaders })
  }
}

async function handleDelete(supabaseClient: SupabaseClient, action: string, searchParams: URLSearchParams, userId: string) {
  switch (action) {
    case 'channels':
      return await deleteChannel(supabaseClient, searchParams, userId)
    case 'connections':
      return await deleteConnection(supabaseClient, searchParams, userId)
    case 'unsubscribe':
      return await unsubscribeFromChannel(supabaseClient, searchParams, userId)
    default:
      return new Response('Not found', { status: 404, headers: corsHeaders })
  }
}

// Channel Management Functions
async function getChannels(supabaseClient: SupabaseClient, searchParams: URLSearchParams, userId: string) {
  const tripId = searchParams.get('trip_id')
  const channelType = searchParams.get('channel_type')
  
  let query = supabaseClient
    .from('realtime_channels')
    .select('*')
    .eq('is_active', true)

  if (tripId) {
    query = query.eq('trip_id', tripId)
  }

  if (channelType) {
    query = query.eq('channel_type', channelType)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) throw error

  return new Response(JSON.stringify({ success: true, data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function createChannel(supabaseClient: SupabaseClient, body: CreateChannelRequest, userId: string) {
  // Verify user has access to the trip
  const { data: tripMember } = await supabaseClient
    .from('trip_members')
    .select('role')
    .eq('trip_id', body.trip_id)
    .eq('user_id', userId)
    .single()

  if (!tripMember) {
    return new Response('Unauthorized - not a trip member', { status: 403, headers: corsHeaders })
  }

  // Generate channel name if not provided
  const channelName = body.channel_name || `${body.channel_type}_${body.trip_id}_${Date.now()}`

  const { data, error } = await supabaseClient
    .from('realtime_channels')
    .insert({
      channel_name: channelName,
      channel_type: body.channel_type,
      trip_id: body.trip_id,
      max_subscribers: body.max_subscribers || 50,
      metadata: body.metadata || {}
    })
    .select()
    .single()

  if (error) throw error

  return new Response(JSON.stringify({ success: true, data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function updateChannel(supabaseClient: SupabaseClient, body: UpdateChannelRequest, userId: string) {
  const { channel_id, ...updateData } = body

  // Verify user has access
  const { data: channel } = await supabaseClient
    .from('realtime_channels')
    .select('trip_id')
    .eq('id', channel_id)
    .single()

  if (!channel) {
    return new Response('Channel not found', { status: 404, headers: corsHeaders })
  }

  const { data: tripMember } = await supabaseClient
    .from('trip_members')
    .select('role')
    .eq('trip_id', channel.trip_id)
    .eq('user_id', userId)
    .single()

  if (!tripMember || (tripMember.role !== 'admin' && tripMember.role !== 'owner')) {
    return new Response('Unauthorized - admin access required', { status: 403, headers: corsHeaders })
  }

  const { data, error } = await supabaseClient
    .from('realtime_channels')
    .update(updateData)
    .eq('id', channel_id)
    .select()
    .single()

  if (error) throw error

  return new Response(JSON.stringify({ success: true, data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function deleteChannel(supabaseClient: SupabaseClient, searchParams: URLSearchParams, userId: string) {
  const channelId = searchParams.get('channel_id')

  if (!channelId) {
    return new Response('Channel ID required', { status: 400, headers: corsHeaders })
  }

  // Verify user has access
  const { data: channel } = await supabaseClient
    .from('realtime_channels')
    .select('trip_id')
    .eq('id', channelId)
    .single()

  if (!channel) {
    return new Response('Channel not found', { status: 404, headers: corsHeaders })
  }

  const { data: tripMember } = await supabaseClient
    .from('trip_members')
    .select('role')
    .eq('trip_id', channel.trip_id)
    .eq('user_id', userId)
    .single()

  if (!tripMember || (tripMember.role !== 'admin' && tripMember.role !== 'owner')) {
    return new Response('Unauthorized - admin access required', { status: 403, headers: corsHeaders })
  }

  const { error } = await supabaseClient
    .from('realtime_channels')
    .delete()
    .eq('id', channelId)

  if (error) throw error

  return new Response(JSON.stringify({ success: true, message: 'Channel deleted' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Connection Management Functions
async function getConnections(supabaseClient: SupabaseClient, searchParams: URLSearchParams, userId: string) {
  const tripId = searchParams.get('trip_id')
  const status = searchParams.get('status')
  
  let query = supabaseClient
    .from('realtime_connections')
    .select('*, users(name, display_name, avatar_url)')
    .eq('user_id', userId)

  if (tripId) {
    query = query.eq('trip_id', tripId)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query.order('connected_at', { ascending: false })

  if (error) throw error

  return new Response(JSON.stringify({ success: true, data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function createConnection(supabaseClient: SupabaseClient, body: CreateConnectionRequest, userId: string) {
  const connectionData = {
    user_id: userId,
    trip_id: body.trip_id,
    channel_name: body.channel_name,
    connection_id: body.connection_id,
    metadata: body.metadata || {}
  }

  const { data, error } = await supabaseClient
    .from('realtime_connections')
    .insert(connectionData)
    .select()
    .single()

  if (error) throw error

  // Update channel subscriber count
  await supabaseClient.rpc('increment_channel_subscribers', {
    p_channel_name: body.channel_name
  })

  return new Response(JSON.stringify({ success: true, data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function updateConnection(supabaseClient: SupabaseClient, body: UpdateConnectionRequest, userId: string) {
  const { connection_id, ...updateData } = body

  const { data, error } = await supabaseClient
    .from('realtime_connections')
    .update({
      ...updateData,
      last_ping: new Date().toISOString()
    })
    .eq('connection_id', connection_id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error

  return new Response(JSON.stringify({ success: true, data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function deleteConnection(supabaseClient: SupabaseClient, searchParams: URLSearchParams, userId: string) {
  const connectionId = searchParams.get('connection_id')

  if (!connectionId) {
    return new Response('Connection ID required', { status: 400, headers: corsHeaders })
  }

  // Get connection info before deleting
  const { data: connection } = await supabaseClient
    .from('realtime_connections')
    .select('channel_name')
    .eq('connection_id', connectionId)
    .eq('user_id', userId)
    .single()

  const { error } = await supabaseClient
    .from('realtime_connections')
    .delete()
    .eq('connection_id', connectionId)
    .eq('user_id', userId)

  if (error) throw error

  // Update channel subscriber count
  if (connection) {
    await supabaseClient.rpc('decrement_channel_subscribers', {
      p_channel_name: connection.channel_name
    })
  }

  return new Response(JSON.stringify({ success: true, message: 'Connection deleted' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Presence Management Functions
async function getPresence(supabaseClient: SupabaseClient, searchParams: URLSearchParams, userId: string) {
  const tripId = searchParams.get('trip_id')
  
  let query = supabaseClient
    .from('realtime_connections')
    .select(`
      user_id,
      status,
      last_ping,
      connected_at,
      metadata,
      users(name, display_name, avatar_url)
    `)
    .eq('status', 'connected')
    .gte('last_ping', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Active in last 5 minutes

  if (tripId) {
    query = query.eq('trip_id', tripId)
  }

  const { data, error } = await query

  if (error) throw error

  // Transform data to presence format
  const presenceData = (data || []).map((conn: {
    user_id: string
    last_ping: string
    metadata?: Record<string, unknown>
    users: { name: string; display_name?: string; avatar_url?: string }
  }) => ({
    user_id: conn.user_id,
    user_info: {
      name: conn.users.name,
      display_name: conn.users.display_name,
      avatar_url: conn.users.avatar_url
    },
    status: (conn.metadata?.presence_status as string) || 'online',
    last_seen: conn.last_ping,
    current_page: conn.metadata?.current_page as string,
    is_active: new Date(conn.last_ping) > new Date(Date.now() - 2 * 60 * 1000) // Active in last 2 minutes
  }))

  return new Response(JSON.stringify({ success: true, data: presenceData }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function updatePresence(supabaseClient: SupabaseClient, body: UpdatePresenceRequest, userId: string) {
  const { trip_id, status, current_page, ...metadata } = body

  // Update all user's connections for this trip
  const { data, error } = await supabaseClient
    .from('realtime_connections')
    .update({
      last_ping: new Date().toISOString(),
      metadata: {
        presence_status: status,
        current_page: current_page,
        ...metadata
      }
    })
    .eq('user_id', userId)
    .eq('trip_id', trip_id)
    .eq('status', 'connected')
    .select()

  if (error) throw error

  return new Response(JSON.stringify({ success: true, data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Subscription Management Functions
async function subscribeToChannel(supabaseClient: SupabaseClient, body: SubscribeRequest, userId: string) {
  const { trip_id, subscription_type, settings } = body

  const subscriptionData = {
    trip_id,
    user_id: userId,
    channel_name: `${subscription_type}_${trip_id}`,
    subscription_type,
    settings: settings || {}
  }

  const { data, error } = await supabaseClient
    .from('realtime_settings')
    .upsert(subscriptionData, { onConflict: 'trip_id,user_id,subscription_type' })
    .select()
    .single()

  if (error) throw error

  return new Response(JSON.stringify({ success: true, data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function unsubscribeFromChannel(supabaseClient: SupabaseClient, searchParams: URLSearchParams, userId: string) {
  const tripId = searchParams.get('trip_id')
  const subscriptionType = searchParams.get('subscription_type')

  if (!tripId || !subscriptionType) {
    return new Response('Trip ID and subscription type required', { status: 400, headers: corsHeaders })
  }

  const { error } = await supabaseClient
    .from('realtime_settings')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .eq('subscription_type', subscriptionType)

  if (error) throw error

  return new Response(JSON.stringify({ success: true, message: 'Unsubscribed from channel' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Status and monitoring
async function getRealtimeStatus(supabaseClient: SupabaseClient, searchParams: URLSearchParams, userId: string) {
  const tripId = searchParams.get('trip_id')

  // Get publication status
  const { data: pubStatus } = await supabaseClient.rpc('get_realtime_publication_status')

  // Get user's subscriptions
  let subsQuery = supabaseClient
    .from('realtime_settings')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (tripId) {
    subsQuery = subsQuery.eq('trip_id', tripId)
  }

  const { data: subscriptions } = await subsQuery

  // Get active connections
  const { data: connections } = await supabaseClient
    .from('realtime_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'connected')

  // Get channel statistics
  const { data: channels } = await supabaseClient
    .from('realtime_channels')
    .select('channel_type, current_subscribers, max_subscribers')
    .eq('is_active', true)

  return new Response(JSON.stringify({
    success: true,
    data: {
      publication_status: pubStatus,
      user_subscriptions: subscriptions || [],
      active_connections: connections || [],
      channel_statistics: channels || [],
      system_status: {
        realtime_enabled: true,
        last_check: new Date().toISOString()
      }
    }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
} 