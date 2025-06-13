import React from 'react';
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

function App() {
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