import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';

// Inline Auth Form Component
function AuthForm({ onSuccess }: { onSuccess: (user: any) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (mode === 'signup' && password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }

      if (mode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) throw error;
        if (data.user) {
          console.log('✅ User signed in:', data.user.id);
          onSuccess(data.user);
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              name: email.split('@')[0],
            }
          }
        });
        
        if (error) {
          if (error.status === 429 || error.message?.includes('rate')) {
            throw new Error('Too many sign up attempts. Please wait a moment and try again.');
          }
          throw error;
        }
        if (data.user) {
          console.log('✅ User signed up:', data.user.id);
          onSuccess(data.user);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        }
      });

      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google authentication failed');
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Google Sign In */}
      <button
        onClick={handleGoogleAuth}
        disabled={isLoading}
        className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">or</span>
        </div>
      </div>

      {/* Email/Password Form */}
      <form onSubmit={handleAuth} className="space-y-3">
        <div>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        {mode === 'signup' && (
          <div>
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        )}

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isLoading ? 'Please wait...' : (mode === 'signup' ? 'Sign Up & Join Trip' : 'Sign In & Join Trip')}
        </button>
      </form>

      <div className="text-center">
        <button
          onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
          className="text-sm text-indigo-600 hover:text-indigo-500"
        >
          {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  );
}

interface SharedTripData {
  shareId: string;
  trip: {
    id: string;
    name: string;
    description: string;
    start_date: string;
    end_date: string;
    places: Array<{
      id: string;
      name: string;
      address: string;
      latitude?: number;
      longitude?: number;
      category: string;
      wish_level: number;
      stay_duration_minutes: number;
      notes?: string;
    }>;
  };
  permissions: {
    can_view_places: boolean;
    can_add_places: boolean;
    can_edit_places: boolean;
    can_view_optimization: boolean;
    can_optimize: boolean;
    can_export: boolean;
    can_comment: boolean;
    can_join_as_member: boolean;
  };
  shareType: string;
  createdAt: string;
}

export function SharedTripView() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const navigate = useNavigate();
  const { user, setCurrentTrip, loadTripsFromDatabase } = useStore();
  
  // Debug user state on component mount
  useEffect(() => {
    console.log('🔐 SharedTripView user state on mount:', {
      user: user ? {
        id: user.id,
        name: user.name,
        email: user.email,
        isGuest: user.isGuest
      } : null,
      hasUser: !!user
    });
  }, [user]);
  const [shareData, setShareData] = useState<SharedTripData | null>(null);
  const [isPasswordRequired, setIsPasswordRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (shareToken) {
      loadSharedTrip();
    }
  }, [shareToken]);

  const loadSharedTrip = async (passwordInput?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('🔍 Loading shared trip with token:', shareToken);
      
      const requestBody = {
        action: 'get_shared_trip',
        shareToken,
        password: passwordInput || password
      };
      
      console.log('📤 Request body:', requestBody);
      console.log('🔑 ANON_KEY present:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
      
      const headers = {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      };
      
      console.log('📤 Request headers:', Object.keys(headers));
      
      const response = await fetch('https://rdufxwoeneglyponagdz.supabase.co/functions/v1/trip-sharing-v3', {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });
      
      console.log('📥 Response status:', response.status);
      
      if (!response.ok) {
        try {
          const errorText = await response.text();
          console.log('❌ Error response text:', errorText);
          
          // Try to parse as JSON for more details
          try {
            const errorJson = JSON.parse(errorText);
            console.log('❌ Error response JSON:', errorJson);
          } catch (parseError) {
            console.log('❌ Could not parse error as JSON');
          }
        } catch (readError) {
          console.log('❌ Could not read error response:', readError);
        }
      }

      if (response.ok) {
        const data = await response.json();
        
        console.log('📨 Full trip-sharing-v3 response:', data);
        console.log('🔑 Permissions object:', JSON.stringify(data.permissions, null, 2));
        
        if (data.requiresPassword) {
          setIsPasswordRequired(true);
          setIsLoading(false);
          return;
        }

        setShareData(data);
        setIsPasswordRequired(false);
        
        // Debug logging for redirect conditions
        console.log('🔍 SharedTripView redirect check:', {
          hasUser: !!user,
          userId: user?.id,
          hasTrip: !!data.trip,
          tripId: data.trip?.id,
          hasPermissions: !!data.permissions,
          canJoinAsMember: data.permissions?.can_join_as_member,
          allConditionsMet: !!(user && data.trip && data.permissions?.can_join_as_member)
        });
        
        // If user is authenticated, redirect to actual trip page
        if (user && data.trip && data.permissions?.can_join_as_member) {
          console.log('✅ All conditions met, redirecting to trip page');
          setIsRedirecting(true);
          await redirectToTripPage(data.trip);
          return;
        } else {
          console.log('❌ Redirect conditions not met, staying on shared view');
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load shared trip');
      }
    } catch (error) {
      setError('Failed to load shared trip');
    } finally {
      setIsLoading(false);
    }
  };

  const redirectToTripPage = async (trip: any) => {
    try {
      console.log('🔄 Redirecting to trip page:', trip.name);
      
      // First, add user as member to the trip via share link join
      await joinTripViaShareLink(trip.id);
      
      // Reload trips to ensure user has access to the shared trip
      await loadTripsFromDatabase();
      
      // Find the trip in user's trips and set as current
      const tripObj = {
        id: trip.id,
        name: trip.name,
        description: trip.description,
        startDate: trip.start_date,
        endDate: trip.end_date,
        memberCount: trip.total_members || 1,
        createdAt: trip.created_at,
        ownerId: trip.owner_id
      };
      
      await setCurrentTrip(tripObj);
      
      // Navigate to trip detail page
      navigate(`/trip/${trip.id}`);
      
    } catch (error) {
      console.error('❌ Failed to redirect to trip page:', error);
      setError('Failed to access trip. Please try joining manually.');
    }
  };


  const joinTripViaShareLink = async (tripId: string) => {
    try {
      console.log('🔗 Joining trip via share link:', tripId);
      
      // Get current session for auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('User not authenticated');
      }

      // Check if user is already a member
      try {
        const memberResponse = await fetch('https://rdufxwoeneglyponagdz.supabase.co/functions/v1/trip-member-management/members/' + tripId, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
        });
        
        if (memberResponse.ok) {
          const existingMembers = await memberResponse.json();
          const isAlreadyMember = existingMembers.some((m: any) => m.user_id === user?.id);
          
          if (isAlreadyMember) {
            console.log('✅ User is already a trip member');
            return;
          }
        }
      } catch (error) {
        console.log('⚠️ Could not check existing membership, proceeding to add user');
      }

      // Add user as member directly to database (simpler approach)
      const { error } = await supabase
        .from('trip_members')
        .insert({
          trip_id: tripId,
          user_id: user?.id,
          role: 'member',
          joined_at: new Date().toISOString()
        });

      if (error && !error.message.includes('duplicate')) {
        throw error;
      }
      
      console.log('✅ User added as trip member');
    } catch (error) {
      console.error('❌ Failed to join trip via share link:', error);
      throw error;
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await loadSharedTrip(password);
  };

  const exportTripData = () => {
    if (!shareData) return;

    const exportData = {
      trip: shareData.trip,
      exportedAt: new Date().toISOString(),
      exportedFrom: 'Voypath Shared Trip'
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${shareData.trip.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_trip_data.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading || isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">
            {isRedirecting ? 'Joining trip...' : 'Loading shared trip...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Trip Not Found</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700"
          >
            Go to Voypath
          </button>
        </div>
      </div>
    );
  }

  if (isPasswordRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-6">
            <div className="text-indigo-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 0h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Password Required</h1>
            <p className="text-gray-600">This shared trip is password protected.</p>
          </div>

          <form onSubmit={handlePasswordSubmit}>
            <div className="mb-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoading ? 'Verifying...' : 'Access Trip'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!shareData) {
    return null;
  }

  // If user is not authenticated and can join as member, show sign-up prompt with realistic background
  if (!user && shareData.permissions?.can_join_as_member) {
    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 relative">
        {/* Blurred Background Content - Realistic App UI */}
        <div className="filter blur-sm pointer-events-none">
          {/* Top Navigation Bar */}
          <div className="fixed top-0 left-0 right-0 z-[9999] bg-white/95 backdrop-blur-xl border-b border-slate-200/50">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Voypath
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Trip Header */}
          <div className="fixed top-12 left-0 right-0 z-[9996] bg-white/95 backdrop-blur-xl border-b border-slate-200/50">
            <div className="p-2 border-b border-slate-200/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <h1 className="text-base font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    {shareData.trip.name}
                  </h1>
                  {shareData.trip.start_date && shareData.trip.end_date && (
                    <div className="flex items-center space-x-1 text-xs text-slate-600">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2z" />
                      </svg>
                      <span>{new Date(shareData.trip.start_date).toLocaleDateString()} - {new Date(shareData.trip.end_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-1 text-xs text-slate-600">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span>{shareData.trip.total_members || 1}</span>
                  </div>
                </div>
                <div className="w-4 h-4 bg-slate-200 rounded"></div>
              </div>
            </div>

            {/* View Toggle */}
            <div className="p-2">
              <div className="flex items-center space-x-1 bg-slate-100 rounded-lg p-1">
                <div className="flex-1 py-1.5 px-3 bg-white rounded-md shadow-sm text-center">
                  <span className="text-xs font-medium text-slate-700">Map</span>
                </div>
                <div className="flex-1 py-1.5 px-3 text-center">
                  <span className="text-xs font-medium text-slate-500">Calendar</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="pt-32 h-screen">
            {/* Mock Map/Content */}
            <div className="h-full bg-slate-100 relative">
              {/* Mock map with places */}
              <div className="absolute inset-4 bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="h-full bg-gradient-to-br from-emerald-50 to-blue-50 relative">
                  {/* Mock place markers */}
                  {shareData.trip.places.slice(0, 6).map((place, index) => (
                    <div
                      key={place.id}
                      className="absolute w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-sm"
                      style={{
                        left: `${20 + index * 15}%`,
                        top: `${30 + (index % 3) * 20}%`,
                      }}
                    >
                      <div className="w-full h-full bg-red-500 rounded-full"></div>
                    </div>
                  ))}
                  
                  {/* Mock route lines */}
                  <svg className="absolute inset-0 w-full h-full">
                    <path
                      d="M 20% 40% Q 40% 20% 60% 50% T 80% 60%"
                      stroke="#3b82f6"
                      strokeWidth="2"
                      fill="none"
                      strokeDasharray="5,5"
                      opacity="0.6"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sign-up Modal Overlay */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[10000]">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="text-center mb-6">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Join "{shareData.trip.name}"</h2>
              <p className="text-gray-600">
                Sign up to collaborate on this trip with {shareData.trip.places.length} amazing places!
              </p>
            </div>

            {/* Inline Auth Component */}
            <AuthForm 
              onSuccess={async (user) => {
                try {
                  // Store trip info for pending join
                  const pendingTrip = {
                    shareToken: new URLSearchParams(window.location.search).get('token'),
                    tripId: shareData.trip.id,
                    tripName: shareData.trip.name
                  };
                  
                  console.log('🔗 Processing immediate trip join after auth:', pendingTrip);
                  
                  // Get current session
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) {
                    console.error('No session found after auth');
                    return;
                  }

                  // Add user as trip member directly
                  const { error } = await supabase
                    .from('trip_members')
                    .insert({
                      trip_id: pendingTrip.tripId,
                      user_id: session.user.id,
                      role: 'member',
                      joined_at: new Date().toISOString()
                    });

                  if (error && !error.message.includes('duplicate')) {
                    console.error('Failed to add user to trip:', error);
                  } else {
                    console.log('✅ User added as trip member immediately');
                  }

                  // Navigate to trip page
                  navigate(`/trip/${pendingTrip.tripId}`);
                  
                } catch (error) {
                  console.error('Error processing immediate trip join:', error);
                  // Fallback to reload
                  window.location.reload();
                }
              }}
            />

            <div className="mt-4 text-center text-xs text-gray-500">
              By joining, you'll be able to add places, collaborate with others, and help plan this trip.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="text-2xl font-bold text-indigo-600">Voypath</div>
              <div className="ml-4 text-sm text-gray-500">Shared Trip</div>
            </div>
            <div className="flex items-center space-x-4">
              {shareData.permissions.can_export && (
                <button
                  onClick={exportTripData}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm"
                >
                  Export Data
                </button>
              )}
              <button
                onClick={() => navigate('/')}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm"
              >
                Create Your Own Trip
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Trip Info */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{shareData.trip.name}</h1>
              {shareData.trip.description && (
                <p className="text-gray-600 mb-4">{shareData.trip.description}</p>
              )}
              <div className="flex items-center space-x-6 text-sm text-gray-500">
                {shareData.trip.start_date && (
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {new Date(shareData.trip.start_date).toLocaleDateString()}
                    {shareData.trip.end_date && ` - ${new Date(shareData.trip.end_date).toLocaleDateString()}`}
                  </div>
                )}
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {shareData.trip.places.length} places
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className={`inline-block px-3 py-1 text-sm rounded-full ${
                shareData.shareType === 'external_view' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                {shareData.shareType === 'external_view' ? 'View Only' : 'Collaborative'}
              </span>
              <p className="text-xs text-gray-500 mt-2">
                Shared on {new Date(shareData.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Places */}
        {shareData.permissions.can_view_places && (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">Places to Visit</h2>
            </div>
            <div className="divide-y">
              {shareData.trip.places.map((place, index) => (
                <div key={place.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <span className="inline-flex items-center justify-center w-8 h-8 bg-indigo-100 text-indigo-800 text-sm font-medium rounded-full mr-3">
                          {index + 1}
                        </span>
                        <h3 className="text-lg font-medium text-gray-900">{place.name}</h3>
                      </div>
                      <p className="text-gray-600 mb-2">{place.address}</p>
                      {place.notes && (
                        <p className="text-gray-500 text-sm mb-2">{place.notes}</p>
                      )}
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span className={`px-2 py-1 rounded text-xs ${
                          place.category === 'restaurant' ? 'bg-orange-100 text-orange-800' :
                          place.category === 'attraction' ? 'bg-purple-100 text-purple-800' :
                          place.category === 'shopping' ? 'bg-pink-100 text-pink-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {place.category}
                        </span>
                        <span>Stay: {Math.floor(place.stay_duration_minutes / 60)}h {place.stay_duration_minutes % 60}m</span>
                        <div className="flex items-center">
                          <span className="mr-1">Priority:</span>
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <svg
                                key={star}
                                className={`w-4 h-4 ${star <= place.wish_level ? 'text-yellow-400' : 'text-gray-300'}`}
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center text-gray-500 text-sm">
            <span>Powered by</span>
            <div className="ml-2 font-bold text-indigo-600">Voypath</div>
          </div>
          <p className="text-gray-400 text-xs mt-2">
            Create your own amazing trip plans at voypath.app
          </p>
        </div>
      </div>
    </div>
  );
}