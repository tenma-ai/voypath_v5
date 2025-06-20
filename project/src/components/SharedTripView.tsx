import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

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
  const [shareData, setShareData] = useState<SharedTripData | null>(null);
  const [isPasswordRequired, setIsPasswordRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        
        if (data.requiresPassword) {
          setIsPasswordRequired(true);
          setIsLoading(false);
          return;
        }

        setShareData(data);
        setIsPasswordRequired(false);
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading shared trip...</p>
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