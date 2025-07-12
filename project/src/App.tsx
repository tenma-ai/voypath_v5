import React, { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { StripeProvider } from './components/StripeProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SimpleAuth } from './components/SimpleAuth';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { TripDetailPage } from './pages/TripDetailPage';
import { MyPlacesPage } from './pages/MyPlacesPage';
import { PlaceSearchToDetail } from './components/PlaceSearchToDetail';
import { ChatPage } from './pages/ChatPage';
import { SharePage } from './pages/SharePage';
import { ProfilePage } from './pages/ProfilePage';
import { PremiumSuccessPage } from './pages/PremiumSuccessPage';
import { PremiumCancelPage } from './pages/PremiumCancelPage';
import { AuthCallback } from './components/AuthCallback';
import { SharedTripView } from './components/SharedTripView';
import { useStore } from './store/useStore';
import { supabase } from './lib/supabase';

function App() {
  const { initializeFromDatabase, setUser, user } = useStore();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isHandlingAuth, setIsHandlingAuth] = useState(false);
  
  // Use store's user state instead of duplicate isAuthenticated state
  const isAuthenticated = !!user;

  useEffect(() => {
    let isInitialCheck = true;
    
    // Check if user is already authenticated
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session && session.user) {
          await handleAuthenticated(session.user);
        } else {
          setUser(null);
        }
      } catch (error) {
        // Auth check failed
        setUser(null);
      } finally {
        setIsCheckingAuth(false);
        isInitialCheck = false;
      }
    };

    checkAuth();

    // Enhanced auth state change listener with better reliability
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`🔍 Auth state change: ${event}`, { hasSession: !!session, isInitialCheck });
      
      // Skip the initial SIGNED_IN event that fires immediately after getSession
      if (isInitialCheck && event === 'SIGNED_IN') {
        return;
      }
      
      try {
        if (event === 'SIGNED_IN' && session?.user) {
          await handleAuthenticated(session.user);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Ensure user state is consistent after token refresh
          if (!user || user.id !== session.user.id) {
            await handleAuthenticated(session.user);
          }
        } else if (event === 'USER_UPDATED' && session?.user) {
          // Update user data when profile changes
          setUser(prevUser => ({
            ...prevUser!,
            name: session.user.user_metadata?.name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
            email: session.user.email || prevUser!.email,
            avatar: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || prevUser!.avatar
          }));
        }
      } catch (error) {
        console.error('Auth state change handling failed:', error);
        // Don't clear auth state for handling errors unless it's a sign out
        if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Add proper tab focus session validation
  useEffect(() => {
    let validationTimer: NodeJS.Timeout | null = null;
    
    const validateSessionOnTabFocus = async () => {
      // Clear any pending validation
      if (validationTimer) {
        clearTimeout(validationTimer);
      }
      
      // Debounce validation to avoid excessive calls
      validationTimer = setTimeout(async () => {
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.warn('Session validation error:', error);
            setUser(null);
            return;
          }
          
          if (session?.user) {
            // Session is valid - ensure user state is consistent
            if (!user || user.id !== session.user.id) {
              console.log('🔄 Tab focus - refreshing user session');
              await handleAuthenticated(session.user);
            }
          } else {
            // No valid session - clear user state
            if (user) {
              console.log('🔄 Tab focus - clearing invalid session');
              setUser(null);
            }
          }
        } catch (error) {
          console.error('Tab focus session validation failed:', error);
          setUser(null);
        }
      }, 100); // 100ms debounce
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        validateSessionOnTabFocus();
      }
    };

    const handleWindowFocus = () => {
      validateSessionOnTabFocus();
    };

    // Add storage event listener for cross-tab synchronization
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.startsWith('sb-') || e.key === 'supabase.auth.token') {
        console.log('🔄 Storage change detected - validating session');
        validateSessionOnTabFocus();
      }
    };

    // Register event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('storage', handleStorageChange);

    // Cleanup
    return () => {
      if (validationTimer) clearTimeout(validationTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user]); // Depend on user state to avoid stale closures

  const handleAuthenticated = async (user: any) => {
    // Prevent multiple simultaneous authentication handling
    if (isHandlingAuth) {
      return;
    }
    
    setIsHandlingAuth(true);
    
    try {
      // Set the authenticated user first - this is the critical path
      setUser({
        id: user.id,
        name: user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        email: user.email,
        isGuest: user.is_anonymous || false,
        isPremium: false,
        avatar: user.user_metadata?.avatar_url || user.user_metadata?.picture
      });

      // Critical initialization with timeout protection
      const criticalInitialization = async () => {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Critical initialization timeout')), 8000)
        );
        
        try {
          await Promise.race([
            initializeFromDatabase(),
            timeoutPromise
          ]);
        } catch (error) {
          console.error('Critical initialization failed:', error);
          // Don't fail authentication for database initialization errors
          // The app should still work with the authenticated user
        }
      };

      // Run critical initialization
      await criticalInitialization();

      // Non-critical background tasks - run without blocking authentication
      setImmediate(async () => {
        try {
          // Update user profile in background (non-critical)
          const { createOrUpdateUserProfile } = await import('./lib/supabase');
          await createOrUpdateUserProfile(user);
        } catch (profileError) {
          console.warn('Profile update failed:', profileError);
        }
        
        try {
          // Check for pending trip join (non-critical)
          const { useStore } = await import('./store/useStore');
          await useStore.getState().handlePendingTripJoin();
        } catch (pendingTripError) {
          console.warn('Pending trip join failed:', pendingTripError);
        }
      });
      
    } catch (error) {
      // Critical error in handleAuthenticated - clear user state
      console.error('Authentication handling failed:', error);
      setUser(null);
    } finally {
      setIsHandlingAuth(false);
    }
  };

  // Show loading spinner while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Check if current path is a public route
  const currentPath = window.location.pathname;
  const isPublicRoute = currentPath.startsWith('/shared/') || 
                       currentPath.startsWith('/auth/') ||
                       currentPath.startsWith('/premium/');

  // Main app with routing that handles both authenticated and public routes
  return (
    <ErrorBoundary>
      <StripeProvider>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
          <Routes>
            {/* Public routes (no auth required) - Always render these */}
            <Route path="auth/callback" element={<AuthCallback />} />
            <Route path="shared/:shareToken" element={<SharedTripView />} />
            <Route path="premium/success" element={<PremiumSuccessPage />} />
            <Route path="premium/cancel" element={<PremiumCancelPage />} />
            
            {/* Protected routes */}
            {isAuthenticated ? (
              <Route path="/" element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="my-trip" element={
                  <ErrorBoundary>
                    <TripDetailPage />
                  </ErrorBoundary>
                } />
                <Route path="trip/:tripId" element={
                  <ErrorBoundary>
                    <TripDetailPage />
                  </ErrorBoundary>
                } />
                <Route path="my-trip/my-places" element={<MyPlacesPage />} />
                <Route path="my-trip/chat" element={<ChatPage />} />
                <Route path="my-trip/share" element={<SharePage />} />
                <Route path="add-place" element={<PlaceSearchToDetail />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>
            ) : (
              /* Show auth screen for non-public routes when not authenticated */
              !isPublicRoute && <Route path="*" element={<SimpleAuth onAuthenticated={handleAuthenticated} />} />
            )}
          </Routes>
        </div>
      </StripeProvider>
    </ErrorBoundary>
  );
}

export default App;