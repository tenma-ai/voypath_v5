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
  const { initializeFromDatabase, setUser } = useStore();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isHandlingAuth, setIsHandlingAuth] = useState(false);

  useEffect(() => {
    let isInitialCheck = true;
    
    // Check if user is already authenticated
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session && session.user) {
          await handleAuthenticated(session.user);
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        // Auth check failed
        setIsAuthenticated(false);
      } finally {
        setIsCheckingAuth(false);
        isInitialCheck = false;
      }
    };

    checkAuth();

    // Listen for auth state changes (avoid duplicate handling on initial load)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Skip the initial SIGNED_IN event that fires immediately after getSession
      if (isInitialCheck && event === 'SIGNED_IN') {
        return;
      }
      
      if (event === 'SIGNED_IN' && session?.user) {
        await handleAuthenticated(session.user);
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setUser(null);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const handleAuthenticated = async (user: any) => {
    // Prevent multiple simultaneous authentication handling
    if (isHandlingAuth) {
      return;
    }
    
    setIsHandlingAuth(true);
    
    try {
      // Set the authenticated user first
      setUser({
        id: user.id,
        name: user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        email: user.email,
        isGuest: user.is_anonymous || false,
        isPremium: false,
        avatar: user.user_metadata?.avatar_url || user.user_metadata?.picture
      });

      // Set authenticated state immediately
      setIsAuthenticated(true);

      // Background tasks with timeout
      const backgroundTasks = async () => {
        try {
          // Try to create/update user profile in background (non-blocking)
          const { createOrUpdateUserProfile } = await import('./lib/supabase');
          await Promise.race([
            createOrUpdateUserProfile(user),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Profile update timeout')), 3000))
          ]);
        } catch (profileError) {
          // Profile update failed, continue anyway
        }

        try {
          // Load data from database in background
          await Promise.race([
            initializeFromDatabase(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Database load timeout')), 3000))
          ]);
        } catch (dbError) {
          // Database load failed, continue anyway
        }

        try {
          // Check for pending trip join
          const { useStore } = await import('./store/useStore');
          await useStore.getState().handlePendingTripJoin();
        } catch (pendingTripError) {
          // Pending trip join failed, continue anyway
        }
      };

      // Run background tasks without blocking UI
      backgroundTasks();
      
    } catch (error) {
      // Critical error in handleAuthenticated
      setIsAuthenticated(false);
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