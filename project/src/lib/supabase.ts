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
      return session.user
    }

    // If no Supabase session, use scalable session management
    const { SessionManager } = await import('./sessionManager')
    
    let scalableSession = await SessionManager.getCurrentSession()
    if (!scalableSession) {
      console.log('No session found, creating new guest session...')
      scalableSession = await SessionManager.createGuestSession()
    }

    // Create user object from session
    return SessionManager.createUserFromSession(scalableSession)
    
  } catch (error) {
    console.error('Authentication error, creating fallback session:', error)
    
    // Final fallback - create minimal guest user
    const guestId = `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    return {
      id: guestId,
      name: 'Guest User',
      email: undefined,
      avatar: undefined,
      isGuest: true,
      isPremium: false,
      is_anonymous: true
    }
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

// Scalable database insertion with hybrid storage
export const addPlaceToDatabase = async (placeData: any) => {
  try {
    console.log('Adding place using hybrid data manager:', placeData)
    
    // Use hybrid data management system
    const { HybridDataManager } = await import('./hybridDataManager')
    const { SessionManager } = await import('./sessionManager')
    
    // Get current session
    let session = await SessionManager.getCurrentSession()
    if (!session) {
      session = await SessionManager.createGuestSession()
    }

    // Save using hybrid strategy
    const result = await HybridDataManager.savePlaceData(placeData, session)
    
    console.log('Place save operations:', result.operations)
    console.log('Place successfully processed:', result.place)
    
    return { place: result.place }
    
  } catch (error) {
    console.error('Failed to add place using hybrid system:', error)
    
    // Final fallback - simple local storage
    const fallbackPlace = {
      ...placeData,
      id: `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    try {
      const existingPlaces = JSON.parse(localStorage.getItem('fallback_places') || '[]')
      existingPlaces.push(fallbackPlace)
      localStorage.setItem('fallback_places', JSON.stringify(existingPlaces))
      
      console.log('Place stored in fallback storage:', fallbackPlace)
      return { place: fallbackPlace }
    } catch (storageError) {
      console.error('All storage methods failed:', storageError)
      throw new Error('Unable to save place data')
    }
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
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('User not authenticated')
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }))
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return response.json()
  } catch (error) {
    console.error('Supabase function call failed:', error)
    throw error
  }
}