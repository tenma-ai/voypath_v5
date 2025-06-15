import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

interface SimpleAuthProps {
  onAuthenticated: (user: any) => void;
}

export function SimpleAuth({ onAuthenticated }: SimpleAuthProps) {
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('testpassword123');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      console.log('🔧 Creating development session...');
      
      // Use the trip management Edge Function approach for development
      const response = await fetch('https://rdufxwoeneglyponagdz.supabase.co/functions/v1/trip-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: 'create_dev_session',
          email: 'dev@voypath.test'
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          console.log('✅ Development session created via Edge Function:', data.user.id);
          onAuthenticated(data.user);
          return;
        }
      }

      // Fallback: Create a valid development user session
      const devUser = {
        id: '2600c340-0ecd-4166-860f-ac4798888344',
        email: 'dev@voypath.test',
        user_metadata: {
          name: 'Development User'
        },
        app_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        is_anonymous: false,
        // Add session info for RLS
        access_token: 'dev-session-token',
        expires_at: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
      };

      console.log('✅ Development session created (fallback):', devUser.id);
      onAuthenticated(devUser);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Development Authentication
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Click to start development session and test real Edge Functions
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleAuth}>

          {error && (
            <div className="text-red-600 text-sm text-center">{error}</div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isLoading ? 'Starting session...' : 'Start Development Session'}
            </button>
          </div>

          <div className="text-center text-sm text-gray-500">
            <p>Development session via Edge Functions</p>
            <p>Uses fallback authentication for testing</p>
          </div>
        </form>
      </div>
    </div>
  );
}