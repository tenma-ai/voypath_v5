import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

interface SimpleAuthProps {
  onAuthenticated: (user: any) => void;
}

export function SimpleAuth({ onAuthenticated }: SimpleAuthProps) {
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
          onAuthenticated(data.user);
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
          // Handle rate limiting gracefully
          if (error.status === 429 || error.message?.includes('rate')) {
            throw new Error('Too many sign up attempts. Please wait a moment and try again.');
          }
          throw error;
        }
        if (data.user) {
          console.log('✅ User signed up:', data.user.id);
          
          // For development, proceed immediately with sign up
          // In production, user would need to confirm email
          if (import.meta.env.DEV) {
            console.log('🔧 Development mode: proceeding without email confirmation');
            onAuthenticated(data.user);
          } else {
            // In production, show message about email confirmation
            setError('Please check your email and click the confirmation link to complete sign up.');
          }
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
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });

      if (error) throw error;
      
      // The OAuth flow will redirect the user, so we don't need to do anything else
    } catch (err) {
      // Check if it's a provider not enabled error
      if (err instanceof Error && err.message.includes('provider is not enabled')) {
        setError('Google sign-in is not yet configured. Please use email sign-in instead.');
      } else {
        setError(err instanceof Error ? err.message : 'Google authentication failed');
      }
      setIsLoading(false);
    }
  };

  const handleDevSession = async () => {
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
            Sign in to Voypath
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Plan amazing trips with friends
          </p>
        </div>
        
        {/* Google OAuth */}
        <div>
          <button
            onClick={handleGoogleAuth}
            disabled={isLoading}
            className="group relative w-full flex justify-center items-center py-3 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
              <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"/>
              <path fill="#FBBC04" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"/>
              <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/>
            </svg>
            Sign in with Google
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-50 text-gray-500">Or continue with email</span>
          </div>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleAuth}>
          <div>
            <div className="mt-1 flex rounded-md shadow-sm">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className={`flex-1 py-2 px-4 text-sm font-medium rounded-l-md ${
                  mode === 'signin'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`flex-1 py-2 px-4 text-sm font-medium rounded-r-md ${
                  mode === 'signup'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300'
                }`}
              >
                Sign Up
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
              />
            </div>
            
            {mode === 'signup' && (
              <div>
                <label htmlFor="confirmPassword" className="sr-only">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Confirm Password"
                />
              </div>
            )}
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center">{error}</div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          </div>

          {import.meta.env.DEV && (
            <div className="text-center">
              <button
                type="button"
                onClick={handleDevSession}
                className="text-sm text-indigo-600 hover:text-indigo-500"
              >
                Use development session
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}