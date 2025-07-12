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
        timeout: 30000, // 30 seconds timeout instead of default
        heartbeatIntervalMs: 30000, // 30 second heartbeat
        reconnectAfterMs: (tries) => Math.min(tries * 1000, 10000) // Exponential backoff up to 10s
      }
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true, // Re-enable auto-refresh to work with Supabase's built-in system
      detectSessionInUrl: true,
      debug: false,
      flowType: 'pkce',
      storage: window.localStorage, // Explicit storage for cross-tab sync
      storageKey: 'sb-auth-token' // Custom storage key
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'X-Client-Info': 'voypath-web@1.0.0'
      }
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

// Enhanced token management with tab visibility awareness
let tokenRefreshTimer: NodeJS.Timeout | null = null;
let tokenRefreshInterval: NodeJS.Timeout | null = null;
let sessionCheckInterval: NodeJS.Timeout | null = null;
let lastSessionCheck = Date.now();

// Aggressive token refresh - refresh every 30 minutes (30 minutes before 1-hour expiry)
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
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
    sessionCheckInterval = null;
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
      
      // More aggressive refresh schedule for tab switching scenarios
      const refreshTime = Math.max(0, timeUntilExpiry - 30 * 60 * 1000); // 30 minutes before expiry
      
      if (!import.meta.env.PROD) {
        console.log(`🔍 Custom token refresh - Expiry: ${new Date(expiresAt).toISOString()}, Refresh in: ${Math.round(refreshTime / 1000 / 60)} minutes`);
      }
      
      // Schedule first refresh
      if (refreshTime > 0) {
        tokenRefreshTimer = setTimeout(async () => {
          await performTokenRefresh();
          // After successful refresh, set up interval for every 30 minutes
          tokenRefreshInterval = setInterval(performTokenRefresh, 30 * 60 * 1000);
        }, refreshTime);
        
        // Set up session validation check every 5 minutes
        sessionCheckInterval = setInterval(validateCurrentSession, 5 * 60 * 1000);
      } else {
        // Token expires soon or already expired, refresh immediately
        performTokenRefresh().then(() => {
          // Set up interval for every 30 minutes
          tokenRefreshInterval = setInterval(performTokenRefresh, 30 * 60 * 1000);
          // Set up session validation check every 5 minutes
          sessionCheckInterval = setInterval(validateCurrentSession, 5 * 60 * 1000);
        });
      }
    } else {
      console.warn('⚠️ No session or expiry time found');
    }
  });
};

// Enhanced token refresh with better error handling
const performTokenRefresh = async () => {
  try {
    lastSessionCheck = Date.now();
    
    if (!import.meta.env.PROD) {
      console.log('🔄 Performing enhanced token refresh');
    }
    
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('🚨 Token refresh failed:', error);
      
      // For tab switching issues, try getting a fresh session
      if (error.message?.includes('refresh_token_not_found') || error.message?.includes('invalid_grant')) {
        console.log('🔄 Attempting fresh session retrieval after refresh failure');
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData?.session) {
          console.error('🚨 Fresh session retrieval also failed:', sessionError);
          window.dispatchEvent(new CustomEvent('supabase-session-expired'));
          return;
        }
      }
      
      // Retry once after 3 seconds (shorter retry for tab switching)
      setTimeout(async () => {
        const { data: retryData, error: retryError } = await supabase.auth.refreshSession();
        if (retryError) {
          console.error('🚨 Token refresh retry failed:', retryError);
          window.dispatchEvent(new CustomEvent('supabase-session-expired'));
        } else if (!import.meta.env.PROD) {
          console.log('✅ Token refresh retry successful');
        }
      }, 3000);
    } else if (!import.meta.env.PROD) {
      console.log('✅ Token refreshed successfully via enhanced refresh');
    }
  } catch (refreshError) {
    console.error('🚨 Token refresh exception:', refreshError);
    window.dispatchEvent(new CustomEvent('supabase-session-expired'));
  }
};

// Validate current session periodically
const validateCurrentSession = async () => {
  try {
    // Skip validation if tab is hidden to avoid throttling
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }
    
    const timeSinceLastCheck = Date.now() - lastSessionCheck;
    if (timeSinceLastCheck < 4 * 60 * 1000) { // Don't check more than every 4 minutes
      return;
    }
    
    lastSessionCheck = Date.now();
    
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('🚨 Session validation failed:', error);
      window.dispatchEvent(new CustomEvent('supabase-session-expired'));
      return;
    }
    
    if (!session) {
      console.warn('⚠️ No session found during validation');
      window.dispatchEvent(new CustomEvent('supabase-session-expired'));
      return;
    }
    
    const expiresAt = session.expires_at * 1000;
    const timeUntilExpiry = expiresAt - Date.now();
    
    // If session expires within 10 minutes, refresh preemptively
    if (timeUntilExpiry < 10 * 60 * 1000) {
      if (!import.meta.env.PROD) {
        console.log('🔄 Session expiring soon, preemptive refresh');
      }
      await performTokenRefresh();
    }
  } catch (error) {
    console.error('🚨 Session validation error:', error);
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
    if (sessionCheckInterval) {
      clearInterval(sessionCheckInterval);
      sessionCheckInterval = null;
    }
  }
});

// Page Visibility API handling for tab focus issues
let wasTabHidden = false;

const handleVisibilityChange = async () => {
  if (document.hidden) {
    // Tab became hidden
    wasTabHidden = true;
    if (!import.meta.env.PROD) {
      console.log('🙈 Tab hidden - background timers may be throttled');
    }
  } else {
    // Tab became visible again
    if (wasTabHidden) {
      if (!import.meta.env.PROD) {
        console.log('👁️ Tab visible again - comprehensive session recovery');
      }
      wasTabHidden = false;
      
      // Wait a moment for tab to fully activate
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Comprehensive session recovery for tab switching
      try {
        // Step 1: Check current session state
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('🚨 Session retrieval error after tab focus:', error);
          
          // Try to recover from certain errors
          if (error.message?.includes('Invalid Refresh Token') || error.message?.includes('refresh_token_not_found')) {
            console.log('🔄 Attempting session recovery from refresh token error');
            // Clear potentially corrupted session and force re-auth
            await supabase.auth.signOut();
            window.dispatchEvent(new CustomEvent('supabase-session-expired'));
            return;
          }
          
          window.dispatchEvent(new CustomEvent('supabase-session-error', { detail: error }));
          return;
        }
        
        if (!session) {
          console.warn('⚠️ No session found after tab regain focus');
          window.dispatchEvent(new CustomEvent('supabase-session-expired'));
          return;
        }
        
        // Step 2: Validate session expiry
        const expiresAt = session.expires_at * 1000;
        const now = Date.now();
        const timeUntilExpiry = expiresAt - now;
        
        if (timeUntilExpiry <= 0) {
          console.warn('⚠️ Session already expired after tab focus');
          await performTokenRefresh();
          return;
        }
        
        // Step 3: Preemptive refresh if expiring soon (within 15 minutes)
        if (timeUntilExpiry < 15 * 60 * 1000) {
          if (!import.meta.env.PROD) {
            console.log('🔄 Preemptive token refresh due to tab regain focus');
          }
          await performTokenRefresh();
        }
        
        // Step 4: Test database connectivity
        await testDatabaseConnectivity();
        
        // Step 5: Emit success event for realtime reconnection
        window.dispatchEvent(new CustomEvent('supabase-tab-focus-recovery-success'));
        
      } catch (error) {
        console.error('🚨 Comprehensive error during tab focus recovery:', error);
        window.dispatchEvent(new CustomEvent('supabase-session-error', { detail: error }));
      }
      
      // Restart token refresh system
      setupCustomTokenRefresh();
    }
  }
};

// Test database connectivity after tab focus
const testDatabaseConnectivity = async () => {
  try {
    // Simple connectivity test - get user profile
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.error('🚨 Database connectivity test failed:', error);
      throw error;
    }
    
    if (!import.meta.env.PROD) {
      console.log('✅ Database connectivity test passed');
    }
    
    return true;
  } catch (error) {
    console.error('🚨 Database connectivity test exception:', error);
    throw error;
  }
};

// Window focus handler for additional session validation
const handleWindowFocus = async () => {
  // Debounce rapid focus events
  const now = Date.now();
  const timeSinceLastFocus = now - (handleWindowFocus as any).lastCall || 0;
  (handleWindowFocus as any).lastCall = now;
  
  if (timeSinceLastFocus < 1000) { // Ignore if called within 1 second
    return;
  }
  
  if (!import.meta.env.PROD) {
    console.log('🎯 Window gained focus - enhanced session validation');
  }
  
  try {
    // Enhanced session validation
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('🚨 Session error on window focus:', error);
      window.dispatchEvent(new CustomEvent('supabase-session-error', { detail: error }));
      return;
    }
    
    if (!session) {
      console.warn('⚠️ No session on window focus');
      window.dispatchEvent(new CustomEvent('supabase-session-expired'));
      return;
    }
    
    // Check session validity
    const expiresAt = session.expires_at * 1000;
    const timeUntilExpiry = expiresAt - Date.now();
    
    if (timeUntilExpiry <= 0) {
      console.warn('⚠️ Session expired on window focus');
      await performTokenRefresh();
      return;
    }
    
    // Test database connectivity
    await testDatabaseConnectivity();
    
    // Emit success event for realtime reconnection
    window.dispatchEvent(new CustomEvent('supabase-window-focus-valid'));
    
  } catch (error) {
    console.error('🚨 Window focus validation failed:', error);
    window.dispatchEvent(new CustomEvent('supabase-session-error', { detail: error }));
  }
};

// Add event listeners for tab visibility and window focus
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleWindowFocus);
}

// Periodic session health check for production
let sessionHealthTimer: NodeJS.Timeout | null = null;

const startSessionHealthCheck = () => {
  if (sessionHealthTimer) {
    clearInterval(sessionHealthTimer);
  }
  
  // Check session every 2 minutes in production - ONLY when tab is visible
  if (import.meta.env.PROD) {
    sessionHealthTimer = setInterval(async () => {
      // Skip health check if tab is hidden to avoid throttling issues
      if (document.hidden) {
        return;
      }
      
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
      
      // Skip keep-alive if tab is hidden to avoid throttling issues
      if (document.hidden) {
        if (!import.meta.env.PROD) {
          console.log('😴 Skipping keep-alive - tab is hidden');
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

// Session validation for critical operations
export const validateSessionBeforeOperation = async (operationName: string = 'operation') => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error(`🚨 Session validation failed for ${operationName}:`, error);
      throw new Error(`Session validation failed: ${error.message}`);
    }
    
    if (!session) {
      console.warn(`⚠️ No session found for ${operationName}`);
      throw new Error('Session expired. Please refresh the page and sign in again.');
    }
    
    // Check if token is about to expire (within 5 minutes)
    const expiresAt = session.expires_at * 1000;
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;
    
    if (timeUntilExpiry < 5 * 60 * 1000) {
      console.log(`🔄 Token expiring soon for ${operationName}, refreshing...`);
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        throw new Error(`Token refresh failed: ${refreshError.message}`);
      }
    }
    
    if (!import.meta.env.PROD) {
      console.log(`✅ Session validated for ${operationName}`);
    }
    
    return session;
  } catch (error) {
    console.error(`🚨 Session validation error for ${operationName}:`, error);
    throw error;
  }
};

// Enhanced operation wrapper with session validation
export const withSessionValidation = async <T>(
  operation: () => Promise<T>,
  operationName: string = 'operation'
): Promise<T> => {
  await validateSessionBeforeOperation(operationName);
  return operation();
};

// Debug helper to check current connection state
export const debugConnectionState = async () => {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    visibilityState: document.visibilityState,
    connectionState: navigator.onLine ? 'online' : 'offline',
    session: null as any,
    sessionValid: false,
    error: null as any
  };
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    debugInfo.session = session ? {
      userId: session.user?.id?.substring(0, 8) + '...',
      expiresAt: new Date(session.expires_at * 1000).toISOString(),
      timeUntilExpiry: Math.round((session.expires_at * 1000 - Date.now()) / 1000 / 60) + ' minutes'
    } : null;
    debugInfo.sessionValid = !!session && !error;
    debugInfo.error = error;
  } catch (err) {
    debugInfo.error = err;
  }
  
  console.log('🔍 Connection Debug Info:', debugInfo);
  return debugInfo;
};

// Test database connectivity
export const testDatabaseConnection = async () => {
  console.log('🧪 Testing database connection...');
  try {
    const startTime = Date.now();
    const { data, error, count } = await supabase
      .from('places')
      .select('id', { count: 'exact', head: true })
      .limit(1);
    
    const duration = Date.now() - startTime;
    const result = {
      success: !error,
      duration: `${duration}ms`,
      count,
      error: error?.message,
      timestamp: new Date().toISOString()
    };
    
    console.log('🧪 Database test result:', result);
    return result;
  } catch (err) {
    console.error('🚨 Database test failed:', err);
    return { success: false, error: err };
  }
};

// Make test functions available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).testSupabaseConnection = testSupabaseConnection;
  (window as any).debugConnectionState = debugConnectionState;
  (window as any).testDatabaseConnection = testDatabaseConnection;
  (window as any).validateSessionBeforeOperation = validateSessionBeforeOperation;
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