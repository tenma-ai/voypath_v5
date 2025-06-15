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

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session && session.user) {
          console.log('✅ Found existing session:', session.user.id);
          await handleAuthenticated(session.user);
        } else {
          console.log('❌ No existing session found');
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('❌ Auth check failed:', error);
        setIsAuthenticated(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state changed:', event, session?.user?.id);
      
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
    try {
      // Set the authenticated user
      setUser({
        id: user.id,
        name: user.user_metadata?.name || 'User',
        email: user.email,
        isGuest: user.is_anonymous || false,
        isPremium: false
      });

      // Load data from database
      await initializeFromDatabase();
      setIsAuthenticated(true);
      console.log('✅ App initialized with authentication and database data');
    } catch (error) {
      console.error('❌ Failed to initialize app after auth:', error);
      setIsAuthenticated(false);
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

  // Main app with routing that handles both authenticated and public routes
  return (
    <ErrorBoundary>
      <StripeProvider>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
          <Routes>
            {/* Public routes (no auth required) */}
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
                <Route path="my-trip/my-places" element={<MyPlacesPage />} />
                <Route path="my-trip/chat" element={<ChatPage />} />
                <Route path="my-trip/share" element={<SharePage />} />
                <Route path="add-place" element={<PlaceSearchToDetail />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>
            ) : (
              <Route path="*" element={<SimpleAuth onAuthenticated={handleAuthenticated} />} />
            )}
          </Routes>
        </div>
      </StripeProvider>
    </ErrorBoundary>
  );
}

export default App;