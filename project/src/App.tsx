import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { StripeProvider } from './components/StripeProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
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

  useEffect(() => {
    // Initialize app with database data and demo user
    const initializeApp = async () => {
      try {
        // Set a demo user for development
        setUser({
          id: '033523e2-377c-4479-a5cd-90d8905f7bd0',
          name: 'Demo User',
          email: 'demo@voypath.com',
          isGuest: false,
          isPremium: false
        });

        // Load data from database
        await initializeFromDatabase();
        console.log('✅ App initialized with database data');
      } catch (error) {
        console.error('❌ Failed to initialize app:', error);
      }
    };

    initializeApp();
  }, [initializeFromDatabase, setUser]);
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