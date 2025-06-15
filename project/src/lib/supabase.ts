import { createClient, RealtimeChannel } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// Auth helper functions with integrated persistence
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) {
    console.error('Get user error:', error)
    throw error
  }
  return user
}

export const getSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) {
    console.error('Get session error:', error)
    throw error
  }
  return session
}

// Import scalable session management
export const ensureAuthenticated = async () => {
  try {
    // Try to get existing session first
    const session = await getSession()
    if (session && session.user) {
      console.log('Found existing Supabase session for user:', session.user.id)
      return session.user
    }

    // For development, try to get an authenticated session
    console.log('No session found, need to authenticate...')
    
    // In development mode, show a simple auth prompt
    if (import.meta.env.DEV) {
      console.log('Development mode: Please sign up or sign in through the UI')
      // Return null to trigger UI authentication flow
      return null
    }

    // Fallback to development user
    console.log('Using development user for testing...')
    const devUserId = '2600c340-0ecd-4166-860f-ac4798888344' // Real authenticated user
    
    return {
      id: devUserId,
      email: 'test@voypath.com',
      user_metadata: {
        name: 'Development User'
      },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString()
    }
    
  } catch (error) {
    console.error('Authentication error:', error)
    throw error
  }
}

export const signInAnonymously = async () => {
  try {
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) {
      console.warn('Anonymous sign in not available, using scalable session:', error)
      // Use scalable session management instead
      const { SessionManager } = await import('./sessionManager')
      const scalableSession = await SessionManager.createGuestSession()
      const guestUser = SessionManager.createUserFromSession(scalableSession)
      return { user: guestUser, session: null }
    }
    
    // Create user profile for anonymous user
    if (data.user) {
      await createOrUpdateUserProfile(data.user)
    }
    
    return data
  } catch (error) {
    console.warn('Anonymous authentication failed, using scalable session:', error)
    // Fallback to scalable session management
    const { SessionManager } = await import('./sessionManager')
    const scalableSession = await SessionManager.createGuestSession()
    const guestUser = SessionManager.createUserFromSession(scalableSession)
    return { user: guestUser, session: null }
  }
}

export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  
  if (error) {
    console.error('Email sign in error:', error)
    throw error
  }
  
  return data
}

export const signUpWithEmail = async (email: string, password: string, name: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name
      }
    }
  })
  
  if (error) {
    console.error('Email sign up error:', error)
    throw error
  }
  
  return data
}

export const promoteGuestToUser = async (email: string, password: string, name: string) => {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user || !user.is_anonymous) {
    throw new Error('Current user is not a guest or not authenticated')
  }
  
  // Update auth with email and password
  const { data, error } = await supabase.auth.updateUser({
    email,
    password,
    data: {
      name: name
    }
  })
  
  if (error) {
    console.error('Guest promotion error:', error)
    throw error
  }
  
  // Update user profile
  await createOrUpdateUserProfile(data.user, { email, name, is_guest: false })
  
  return data
}


export const createOrUpdateUserProfile = async (authUser: any, additionalData?: any) => {
  const profileData = {
    id: authUser.id,
    email: additionalData?.email || authUser.email,
    name: additionalData?.name || authUser.user_metadata?.name || `User ${authUser.id.slice(0, 8)}`,
    avatar_url: authUser.user_metadata?.avatar_url,
    is_guest: additionalData?.is_guest ?? authUser.is_anonymous,
    last_active_at: new Date().toISOString(),
    ...additionalData
  }
  
  const { data, error } = await supabase
    .from('users')
    .upsert(profileData, { onConflict: 'id' })
    .select()
    .single()
  
  if (error) {
    console.error('User profile upsert error:', error)
    throw error
  }
  
  return data
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Sign out error:', error)
    throw error
  }
}

// Direct Supabase database insertion for places
export const addPlaceToDatabase = async (placeData: any) => {
  try {
    console.log('Adding place to Supabase:', placeData)
    
    // Get current user
    const user = await ensureAuthenticated()
    if (!user) {
      throw new Error('User authentication required')
    }
    
    // Ensure required fields are present
    const requiredFields = {
      id: placeData.id,
      name: placeData.name,
      category: placeData.category || 'attraction',
      latitude: placeData.latitude,
      longitude: placeData.longitude,
      wish_level: placeData.wish_level || placeData.wishLevel || 3,
      stay_duration_minutes: Math.max(30, placeData.stay_duration_minutes || (placeData.stayDuration * 60) || 120),
      trip_id: placeData.trip_id,
      user_id: placeData.user_id || user.id, // Ensure user_id is set
      place_type: placeData.place_type || 'member_wish',
      source: placeData.source || 'user',
      display_color_hex: placeData.display_color_hex || '#0077BE',
      color_type: placeData.color_type || 'single',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Optional fields
      address: placeData.address,
      rating: placeData.rating,
      price_level: placeData.price_level || placeData.priceLevel,
      estimated_cost: placeData.estimated_cost,
      google_place_id: placeData.google_place_id,
      google_rating: placeData.google_rating,
      google_price_level: placeData.google_price_level,
      google_types: placeData.google_types,
      notes: placeData.notes,
      image_url: placeData.image_url,
      images: placeData.images,
      scheduled: false,
      is_selected_for_optimization: false
    }
    
    // Insert into Supabase using regular client
    const { data, error } = await supabase
      .from('places')
      .insert(requiredFields)
      .select()
      .single()
    
    if (error) {
      console.error('Supabase insert error:', error)
      throw error
    }
    
    console.log('Place successfully saved to Supabase:', data)
    return { place: data }
    
  } catch (error) {
    console.error('Failed to add place to Supabase:', error)
    throw error
  }
}

// Realtime subscription management
const realtimeChannels = new Map<string, RealtimeChannel>()

export const subscribeToRealtime = (
  table: string,
  tripId?: string,
  callback?: (payload: any) => void
) => {
  const channelKey = `${table}_${tripId || 'all'}`
  
  if (realtimeChannels.has(channelKey)) {
    return realtimeChannels.get(channelKey)!
  }

  let channel: RealtimeChannel
  
  if (tripId) {
    channel = supabase
      .channel(`${table}_changes_${tripId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: `trip_id=eq.${tripId}`
        },
        (payload) => {
          console.log(`Realtime ${table} change for trip ${tripId}:`, payload)
          callback?.(payload)
        }
      )
  } else {
    channel = supabase
      .channel(`${table}_changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table
        },
        (payload) => {
          console.log(`Realtime ${table} change:`, payload)
          callback?.(payload)
        }
      )
  }

  channel.subscribe((status) => {
    console.log(`Realtime channel status for ${channelKey}:`, status)
  })

  realtimeChannels.set(channelKey, channel)
  return channel
}

export const unsubscribeFromRealtime = (table: string, tripId?: string) => {
  const channelKey = `${table}_${tripId || 'all'}`
  const channel = realtimeChannels.get(channelKey)
  
  if (channel) {
    supabase.removeChannel(channel)
    realtimeChannels.delete(channelKey)
    console.log(`Unsubscribed from realtime channel: ${channelKey}`)
  }
}

export const unsubscribeAllRealtime = () => {
  realtimeChannels.forEach((channel, key) => {
    supabase.removeChannel(channel)
    console.log(`Unsubscribed from realtime channel: ${key}`)
  })
  realtimeChannels.clear()
}

// API call helper with integrated authentication
export const callSupabaseFunction = async (functionName: string, data: any, method: string = 'POST') => {
  try {
    // Use real Edge Functions for all trips
    const user = await ensureAuthenticated()
    if (!user) {
      throw new Error('User authentication required')
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
    }
    
    // Get the current session for authorization
    const session = await getSession()
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    } else {
      // For test users, use the service role key in development
      console.log('No session token available, using anon key only')
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method,
      headers,
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ 
        error: `HTTP ${response.status}: ${response.statusText}` 
      }))
      console.error(`Edge function ${functionName} failed:`, error)
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return response.json()
  } catch (error) {
    console.error(`Supabase function ${functionName} call failed:`, error)
    throw error
  }
}