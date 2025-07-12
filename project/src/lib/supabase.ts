import { createClient, RealtimeChannel } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Network restriction detection (background only, no UI impact)
const isNetworkRestricted = () => {
  const hostname = window.location.hostname;
  
  // Only detect known problematic patterns - be conservative
  return hostname.includes('.vercel.app') && document.referrer.includes('vercel.com');
};

const getSupabaseConfig = () => {
  const baseConfig = {
    realtime: {
      params: {
        eventsPerSecond: 2, // Reduced from 10 to 2 to prevent connection issues
        timeout: 30000 // 30 seconds timeout instead of default
      }
    },
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: true,
      debug: false,
      flowType: 'pkce'
    }
  };

  if (isNetworkRestricted()) {
    // Ultra-conservative settings for restricted networks
    return {
      ...baseConfig,
      global: {
        fetch: (url, options = {}) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
            console.warn('🚨 Network-restricted timeout (2s):', url);
          }, 2000); // Even shorter timeout for restricted networks
          
          return fetch(url, {
            ...options,
            signal: controller.signal,
            mode: 'cors',
            credentials: 'omit', // Avoid credential issues
            cache: 'no-cache' // Prevent caching issues
          }).finally(() => {
            clearTimeout(timeoutId);
          });
        }
      }
    };
  }

  // Normal configuration
  return {
    ...baseConfig,
    global: {
      fetch: (url, options = {}) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          console.warn('🚨 Network request timed out after 3 seconds:', url);
        }, 3000);
        
        return fetch(url, {
          ...options,
          signal: controller.signal
        }).finally(() => {
          clearTimeout(timeoutId);
        });
      }
    }
  };
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, getSupabaseConfig());

// Custom token management that works regardless of page visibility
let tokenRefreshTimer: NodeJS.Timeout | null = null;
let tokenRefreshInterval: NodeJS.Timeout | null = null;

// Aggressive token refresh - refresh every 45 minutes (15 minutes before 1-hour expiry)
const setupCustomTokenRefresh = () => {
  // Clear any existing timers
  if (tokenRefreshTimer) {
    clearTimeout(tokenRefreshTimer);
    tokenRefreshTimer = null;
  }
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
    tokenRefreshInterval = null;
  }
  
  supabase.auth.getSession().then(({ data: { session }, error }) => {
    if (error) {
      console.error('🚨 Session retrieval error:', error);
      return;
    }
    
    if (session?.expires_at) {
      const expiresAt = session.expires_at * 1000;
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;
      
      // If session expires within 1 hour, treat it as a 1-hour session
      const actualExpiry = timeUntilExpiry > 60 * 60 * 1000 ? now + 60 * 60 * 1000 : expiresAt;
      const timeUntilActualExpiry = actualExpiry - now;
      const refreshTime = Math.max(0, timeUntilActualExpiry - 15 * 60 * 1000); // 15 minutes before expiry
      
      if (!import.meta.env.PROD) {
        console.log(`🔍 Custom token refresh - Actual expiry: ${new Date(actualExpiry).toISOString()}, Refresh in: ${Math.round(refreshTime / 1000 / 60)} minutes`);
      }
      
      // Schedule first refresh
      if (refreshTime > 0) {
        tokenRefreshTimer = setTimeout(async () => {
          await performTokenRefresh();
          // After successful refresh, set up interval for every 45 minutes
          tokenRefreshInterval = setInterval(performTokenRefresh, 45 * 60 * 1000);
        }, refreshTime);
      } else {
        // Token expires soon or already expired, refresh immediately
        performTokenRefresh().then(() => {
          // Set up interval for every 45 minutes
          tokenRefreshInterval = setInterval(performTokenRefresh, 45 * 60 * 1000);
        });
      }
    } else {
      console.warn('⚠️ No session or expiry time found');
    }
  });
};

// Perform token refresh with retry logic
const performTokenRefresh = async () => {
  try {
    if (!import.meta.env.PROD) {
      console.log('🔄 Performing custom token refresh');
    }
    
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('🚨 Token refresh failed:', error);
      
      // Retry once after 5 seconds
      setTimeout(async () => {
        const { data: retryData, error: retryError } = await supabase.auth.refreshSession();
        if (retryError) {
          console.error('🚨 Token refresh retry failed:', retryError);
        } else if (!import.meta.env.PROD) {
          console.log('✅ Token refresh retry successful');
        }
      }, 5000);
    } else if (!import.meta.env.PROD) {
      console.log('✅ Token refreshed successfully via custom refresh');
    }
  } catch (refreshError) {
    console.error('🚨 Token refresh exception:', refreshError);
  }
};

// Listen for auth events to setup custom refresh
supabase.auth.onAuthStateChange((event, session) => {
  // Minimal logging for security
  if (!import.meta.env.PROD) {
    console.log(`🔍 Auth state change: ${event}`, {
      hasSession: !!session,
      userId: session?.user?.id ? session.user.id.substring(0, 8) + '...' : null,
      expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null
    });
  }
  
  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    setupCustomTokenRefresh();
  } else if (event === 'SIGNED_OUT') {
    // Clear all refresh timers
    if (tokenRefreshTimer) {
      clearTimeout(tokenRefreshTimer);
      tokenRefreshTimer = null;
    }
    if (tokenRefreshInterval) {
      clearInterval(tokenRefreshInterval);
      tokenRefreshInterval = null;
    }
  }
});

// Periodic session health check for production
let sessionHealthTimer: NodeJS.Timeout | null = null;

const startSessionHealthCheck = () => {
  if (sessionHealthTimer) {
    clearInterval(sessionHealthTimer);
  }
  
  // Check session every 2 minutes in production
  if (import.meta.env.PROD) {
    sessionHealthTimer = setInterval(async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('🚨 Session health check failed:', error);
          return;
        }
        
        if (!session) {
          console.warn('⚠️ Session health check: No session found');
          return;
        }
        
        const now = Date.now();
        const expiresAt = session.expires_at * 1000;
        const timeUntilExpiry = expiresAt - now;
        
        if (timeUntilExpiry < 10 * 60 * 1000) { // Less than 10 minutes
          console.warn(`⚠️ Session expires soon: ${Math.round(timeUntilExpiry / 1000 / 60)} minutes`);
          // Don't refresh here - let the custom refresh system handle it
        } else if (!import.meta.env.PROD) {
          console.log(`✅ Session healthy: ${Math.round(timeUntilExpiry / 1000 / 60)} minutes remaining`);
        }
      } catch (error) {
        console.error('🚨 Session health check exception:', error);
      }
    }, 2 * 60 * 1000); // Every 2 minutes
  }
};

// Lightweight connection keep-alive for free tier - OPTIMIZED to prevent realtime conflicts
let keepAliveTimer: NodeJS.Timeout | null = null;
let isRealtimeActive = false;

// Function to check if realtime subscriptions are active
const checkRealtimeStatus = () => {
  // Simple check for active realtime channels
  return isRealtimeActive;
};

const startKeepAlive = () => {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
  }
  
  // OPTIMIZED: Longer intervals and conditional execution to prevent conflicts
  keepAliveTimer = setInterval(async () => {
    try {
      // Skip keep-alive if realtime is active to prevent polling conflicts
      if (checkRealtimeStatus()) {
        if (!import.meta.env.PROD) {
          console.log('😴 Skipping keep-alive - realtime is active');
        }
        return;
      }
      
      // Very lightweight query - just check if we can connect
      await supabase.from('places').select('id', { count: 'exact', head: true }).limit(1);
      if (!import.meta.env.PROD) {
        console.log('🔄 Connection keep-alive ping successful');
      }
    } catch (error) {
      if (!import.meta.env.PROD) {
        console.warn('⚠️ Keep-alive ping failed:', error);
      }
    }
  }, 5 * 60 * 1000); // Every 5 minutes (increased from 3 to reduce conflicts)
};

// Export function to control realtime status
export const setRealtimeActive = (active: boolean) => {
  isRealtimeActive = active;
  if (!import.meta.env.PROD) {
    console.log(`🔄 Realtime status updated: ${active ? 'ACTIVE' : 'INACTIVE'}`);
  }
};

// Start session health check - but only for monitoring, not for refresh
startSessionHealthCheck();

// Initialize custom token refresh on startup
setupCustomTokenRefresh();

// Start keep-alive for connection stability
startKeepAlive();

// Silent background connectivity monitor (no UI impact) - OPTIMIZED
let connectivityCheckTimer: NodeJS.Timeout | null = null;
let lastSuccessfulConnection = Date.now();

const startConnectivityMonitor = () => {
  if (connectivityCheckTimer) {
    clearInterval(connectivityCheckTimer);
  }
  
  connectivityCheckTimer = setInterval(async () => {
    try {
      // Skip connectivity check if realtime is active to prevent conflicts
      if (checkRealtimeStatus()) {
        if (!import.meta.env.PROD) {
          console.log('😴 Skipping connectivity check - realtime is active');
        }
        return;
      }
      
      // Very lightweight connectivity test
      const response = await fetch(supabaseUrl + '/rest/v1/', {
        method: 'HEAD',
        signal: AbortSignal.timeout(2000)
      });
      
      if (response.ok) {
        lastSuccessfulConnection = Date.now();
        resetNetworkFailureCount();
      }
    } catch (error) {
      const timeSinceLastSuccess = Date.now() - lastSuccessfulConnection;
      
      // If no successful connection for more than 6 minutes, log warning
      if (timeSinceLastSuccess > 6 * 60 * 1000) {
        console.warn('⚠️ Extended connectivity issues detected, but continuing silently');
      }
    }
  }, 7 * 60 * 1000); // Check every 7 minutes (increased from 4 to reduce conflicts)
};

// Start silent monitoring (completely in background)
startConnectivityMonitor();

// Test function for diagnosing connection issues
export const testSupabaseConnection = async () => {
  const startTime = Date.now();
  console.log('🧪 Testing Supabase connection...', {
    timestamp: new Date().toISOString()
  });
  
  try {
    // Test 1: Check session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    const sessionDuration = Date.now() - startTime;
    console.log('🧪 Session check:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id ? session.user.id.substring(0, 8) + '...' : null,
      duration: `${sessionDuration}ms`,
      error: sessionError?.message
    });
    
    // Test 2: Simple database query
    const queryStartTime = Date.now();
    const { data, error, count } = await supabase
      .from('places')
      .select('id', { count: 'exact', head: true })
      .limit(1);
    
    const queryDuration = Date.now() - queryStartTime;
    console.log('🧪 Database query test:', {
      success: !error,
      count,
      duration: `${queryDuration}ms`,
      error: error?.message,
      code: error?.code
    });
    
    const totalDuration = Date.now() - startTime;
    console.log('🧪 Total connection test duration:', `${totalDuration}ms`);
    
    return {
      sessionOk: !!session && !sessionError,
      queryOk: !error,
      totalDuration,
      sessionDuration,
      queryDuration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('🧪 Connection test failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
    return {
      sessionOk: false,
      queryOk: false,
      totalDuration: duration,
      error
    };
  }
};

// Network failure detection and recovery
let networkFailureCount = 0;
const MAX_NETWORK_FAILURES = 2; // Reduced to 2 for faster user feedback

// Fast retry function optimized for 10-second Supabase limit
export const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 500
): Promise<T> => {
  const startTime = Date.now();
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      
      if (attempt > 1) {
        console.log(`✅ Operation succeeded on attempt ${attempt} (total: ${duration}ms)`);
        resetNetworkFailureCount();
      }
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // If we're approaching 10 seconds, don't retry
      if (duration > 8000) {
        console.warn(`⏰ Approaching 10s limit (${duration}ms), giving up`);
        throw error;
      }
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      console.warn(`⚠️ Attempt ${attempt} failed (${duration}ms), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 1.2, 1000); // Slower exponential backoff, capped at 1s
    }
  }
  throw new Error('Max retries exceeded');
};

export const handleNetworkFailure = (error: any, operation: string) => {
  networkFailureCount++;
  
  console.error(`🚨 Network failure #${networkFailureCount} in ${operation}:`, error);
  
  if (networkFailureCount >= MAX_NETWORK_FAILURES) {
    console.error('🚨 Multiple network failures detected. Connection may be blocked.');
    
    // Silent background recovery - no UI interruption
    console.log('🔄 Attempting silent recovery in background...');
    
    // Try to clear any cached connections
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(reg => reg.update());
      });
    }
    
    // Only show user prompt in extreme cases (more than 5 failures)
    if (networkFailureCount >= 5 && typeof window !== 'undefined') {
      const shouldReload = confirm(
        'ネットワーク接続に継続的な問題があります。ページを再読み込みしますか？\n\n' +
        'Persistent network issues detected. Would you like to reload the page?'
      );
      
      if (shouldReload) {
        window.location.reload();
      }
    }
  }
};

// Reset failure count on successful operations
export const resetNetworkFailureCount = () => {
  if (networkFailureCount > 0) {
    console.log('✅ Network connection restored');
    networkFailureCount = 0;
  }
};

// Environment and configuration diagnostics
export const getEnvironmentInfo = () => {
  const info = {
    // Supabase configuration
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL ? 'Set' : 'Missing',
    supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Set' : 'Missing',
    
    // Runtime environment
    environment: import.meta.env.PROD ? 'production' : 'development',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
    
    // Connection info
    connectionType: typeof navigator !== 'undefined' && 'connection' in navigator 
      ? (navigator as any).connection?.effectiveType : 'Unknown',
    
    // Timing info
    timestamp: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    
    // Browser capabilities
    fetchSupported: typeof fetch !== 'undefined',
    webSocketSupported: typeof WebSocket !== 'undefined',
    localStorageSupported: typeof localStorage !== 'undefined'
  };
  
  console.log('🔍 Environment Information:', info);
  return info;
};

// Database query functions for management
export const findTripsWithName = async (searchTerm: string) => {
  try {
    const { data, error } = await supabase
      .from('trips')
      .select('id, name, description, departure_location, owner_id')
      .or(`name.ilike.%${searchTerm}%, description.ilike.%${searchTerm}%, departure_location.ilike.%${searchTerm}%`);
    
    if (error) throw error;
    console.log('🔍 Found trips:', data);
    return data;
  } catch (error) {
    console.error('❌ Failed to find trips:', error);
    throw error;
  }
};

export const findBookingsForTrip = async (tripId: string, userId?: string) => {
  try {
    let query = supabase
      .from('bookings')
      .select('*')
      .eq('trip_id', tripId);
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    console.log('🔍 Found bookings:', data);
    return data;
  } catch (error) {
    console.error('❌ Failed to find bookings:', error);
    throw error;
  }
};

export const findUserByName = async (name: string) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email')
      .ilike('name', `%${name}%`);
    
    if (error) throw error;
    console.log('🔍 Found users:', data);
    return data;
  } catch (error) {
    console.error('❌ Failed to find users:', error);
    throw error;
  }
};

export const deleteBooking = async (bookingId: string) => {
  try {
    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId);
    
    if (error) throw error;
    console.log('✅ Deleted booking:', bookingId);
    return true;
  } catch (error) {
    console.error('❌ Failed to delete booking:', error);
    throw error;
  }
};

export const findPlacesByUser = async (userName: string) => {
  try {
    // First find the user ID
    const users = await findUserByName(userName);
    if (!users || users.length === 0) {
      console.log('❌ User not found:', userName);
      return [];
    }
    
    const userId = users[0].id;
    
    // Find places created by this user
    const { data, error } = await supabase
      .from('places')
      .select('*')
      .eq('user_id', userId);
    
    if (error) throw error;
    console.log('🔍 Found places for user:', data);
    return data;
  } catch (error) {
    console.error('❌ Failed to find places:', error);
    throw error;
  }
};

export const deletePlace = async (placeId: string) => {
  try {
    const { error } = await supabase
      .from('places')
      .delete()
      .eq('id', placeId);
    
    if (error) throw error;
    console.log('✅ Deleted place:', placeId);
    return true;
  } catch (error) {
    console.error('❌ Failed to delete place:', error);
    throw error;
  }
};

export const findBookedFlightPlaces = async () => {
  try {
    const { data, error } = await supabase
      .from('places')
      .select('*')
      .or('name.ilike.%Booked Flight%, name.ilike.%Flight%, category.eq.transportation')
      .eq('category', 'transportation');
    
    if (error) throw error;
    console.log('🔍 Found booked flight places:', data);
    return data;
  } catch (error) {
    console.error('❌ Failed to find booked flight places:', error);
    throw error;
  }
};

export const findSpecificBookedFlight = async () => {
  try {
    const { data, error } = await supabase
      .from('places')
      .select('*')
      .eq('name', 'Booked Flight')
      .eq('category', 'transportation')
      .ilike('notes', '%09:00 - 11:00%')
      .ilike('notes', '%5 passengers%');
    
    if (error) throw error;
    console.log('🔍 Found specific booked flight:', data);
    return data;
  } catch (error) {
    console.error('❌ Failed to find specific booked flight:', error);
    throw error;
  }
};

// Make test functions available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).testSupabaseConnection = testSupabaseConnection;
  (window as any).handleNetworkFailure = handleNetworkFailure;
  (window as any).resetNetworkFailureCount = resetNetworkFailureCount;
  (window as any).getEnvironmentInfo = getEnvironmentInfo;
  (window as any).findTripsWithName = findTripsWithName;
  (window as any).findBookingsForTrip = findBookingsForTrip;
  (window as any).findUserByName = findUserByName;
  (window as any).deleteBooking = deleteBooking;
  (window as any).findPlacesByUser = findPlacesByUser;
  (window as any).deletePlace = deletePlace;
  (window as any).findBookedFlightPlaces = findBookedFlightPlaces;
}

// Auth helper functions with integrated persistence
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) {
    // Error: 'Get user error:', error)
    throw error
  }
  return user
}

export const getSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) {
    // Error: 'Get session error:', error)
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
      // Found existing Supabase session
      return session.user
    }

    // For development, try to get an authenticated session
    // No session found
    
    // In development mode, show a simple auth prompt
    if (import.meta.env.DEV) {
      // Development mode
      // Return null to trigger UI authentication flow
      return null
    }

    // Fallback to development user
    // Using development user
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
    // Error: 'Authentication error:', error)
    throw error
  }
}

export const signInAnonymously = async () => {
  try {
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) {
      // Warning: 'Anonymous sign in not available, using scalable session:', error)
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
    // Warning: 'Anonymous authentication failed, using scalable session:', error)
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
    // Error: 'Email sign in error:', error)
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
    // Error: 'Email sign up error:', error)
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
    // Error: 'Guest promotion error:', error)
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
    name: additionalData?.name || authUser.user_metadata?.name || authUser.user_metadata?.full_name || `User ${authUser.id.slice(0, 8)}`,
    avatar_url: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture,
    is_guest: additionalData?.is_guest ?? authUser.is_anonymous ?? false,
    last_active_at: new Date().toISOString(),
    created_at: authUser.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...additionalData
  }
  
  // Log message
  
  // Add timeout wrapper
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('User profile update timeout after 5 seconds')), 5000);
  });
  
  try {
    const upsertPromise = supabase
      .from('users')
      .upsert(profileData, { onConflict: 'id' })
      .select()
      .single();
    
    const { data, error } = await Promise.race([upsertPromise, timeoutPromise]) as any;
    
    if (error) {
      // Error occurred
      throw error;
    }
    
    // Log message
    return data;
  } catch (error) {
    // Error occurred
    
    // For timeout or other errors, try a simple update instead
    if (error instanceof Error && error.message.includes('timeout')) {
      // Log message
      try {
        const { data, error: updateError } = await supabase
          .from('users')
          .update({ last_active_at: new Date().toISOString() })
          .eq('id', authUser.id)
          .select()
          .single();
        
        if (updateError) throw updateError;
        // Log message
        return data;
      } catch (fallbackError) {
        // Error occurred
      }
    }
    
    throw error;
  }
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) {
    // Error: 'Sign out error:', error)
    throw error
  }
}

// Direct Supabase database insertion for places
export const addPlaceToDatabase = async (placeData: any) => {
  try {
    const startTime = Date.now();
    console.log('🔍 Adding place to database - Debug info:', {
      environment: import.meta.env.PROD ? 'production' : 'development',
      placeId: placeData.id,
      placeName: placeData.name,
      timestamp: new Date().toISOString()
    });
    
    // Get current user - check session first, then fallback to dev user
    let user;
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (!import.meta.env.PROD) {
        console.log('🔍 Session check result:', {
          hasSession: !!session,
          hasUser: !!session?.user,
          userId: session?.user?.id ? session.user.id.substring(0, 8) + '...' : null,
          expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
          error: error?.message
        });
      }
      
      if (session?.user) {
        user = session.user;
      } else {
        console.warn('⚠️ No valid session found for place addition');
      }
    } catch (error) {
      console.error('🚨 Session retrieval failed during place addition:', error);
    }
    
    // If no session, use the development user that was authenticated
    if (!user) {
      // Get user from the App's authenticated state or use dev user
      user = {
        id: placeData.user_id || '2600c340-0ecd-4166-860f-ac4798888344',
        email: 'dev@voypath.com',
        user_metadata: { name: 'Development User' }
      };
      // Log message
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
      is_selected_for_optimization: false, // Places start as pending, not auto-selected
      status: placeData.status || 'pending' // Default to pending status
    }
    
    // Insert into Supabase using retry logic
    const { data, error } = await retryOperation(async () => {
      return await supabase
        .from('places')
        .insert(requiredFields)
        .select()
        .single();
    });
    
    if (error) {
      const duration = Date.now() - startTime;
      console.error('🚨 Supabase insert error:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
      throw error
    }
    
    const duration = Date.now() - startTime;
    console.log('✅ Place saved successfully:', {
      placeId: data.id,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
    resetNetworkFailureCount(); // Reset failure count on success
    return { place: data }
    
  } catch (error) {
    // Handle network failures
    if (error instanceof Error && (
      error.name === 'AbortError' ||
      error.message.includes('timeout') ||
      error.message.includes('network') ||
      error.message.includes('fetch')
    )) {
      handleNetworkFailure(error, 'addPlaceToDatabase');
    }
    
    console.error('🚨 Failed to add place to Supabase:', error);
    throw error
  }
}

// Realtime subscription management
const realtimeChannels = new Map<string, RealtimeChannel>()

// Tables that should have realtime updates enabled
const REALTIME_ENABLED_TABLES = ['subscriptions', 'users', 'subscription_items']

export const subscribeToRealtime = (
  table: string,
  tripId?: string,
  callback?: (payload: any) => void
) => {
  // Only allow realtime for specific tables
  if (!REALTIME_ENABLED_TABLES.includes(table)) {
    // Log message
    return null as any;
  }
  
  // Log message
  
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
          // Realtime change received
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
          // Realtime change received
          callback?.(payload)
        }
      )
  }

  channel.subscribe((status) => {
    // Realtime channel status changed
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
    // Unsubscribed from realtime channel
  }
}

export const unsubscribeAllRealtime = () => {
  realtimeChannels.forEach((channel, key) => {
    supabase.removeChannel(channel)
    // Unsubscribed from realtime channel
  })
  realtimeChannels.clear()
}

// Deprecated: callSupabaseFunction removed - use supabase.functions.invoke() instead