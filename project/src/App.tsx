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
import { useStore } from './store/useStore';

function App() {
  const { initializeFromDatabase, setUser } = useStore();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      try {
        const { getSession } = await import('./lib/supabase');
        const session = await getSession();
        
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

  // Show authentication form if not authenticated
  if (!isAuthenticated) {
    return <SimpleAuth onAuthenticated={handleAuthenticated} />;
  }

  // Main app content for authenticated users
  return (
    <ErrorBoundary>
      <StripeProvider>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
          <Routes>
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
            {/* Premium pages outside of main layout */}
            <Route path="premium/success" element={<PremiumSuccessPage />} />
            <Route path="premium/cancel" element={<PremiumCancelPage />} />
          </Routes>
        </div>
      </StripeProvider>
    </ErrorBoundary>
  );
}

export default App;