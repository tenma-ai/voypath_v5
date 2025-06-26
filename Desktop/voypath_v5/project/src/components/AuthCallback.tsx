import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('🔄 Auth callback started, URL:', window.location.href);
        console.log('🔄 URL params:', new URLSearchParams(window.location.search).toString());
        
        // Check for error in URL params
        const urlParams = new URLSearchParams(window.location.search);
        const authError = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');
        
        if (authError) {
          console.error('❌ OAuth error in URL:', authError, errorDescription);
          navigate('/?error=' + encodeURIComponent(`OAuth Error: ${authError} - ${errorDescription}`));
          return;
        }
        
        const { data, error } = await supabase.auth.getSession();
        console.log('🔄 Session data:', data);
        
        if (error) {
          console.error('❌ Auth callback error:', error);
          navigate('/?error=' + encodeURIComponent(error.message));
          return;
        }

        if (data.session && data.session.user) {
          console.log('✅ Auth callback successful:', data.session.user.id);
          console.log('✅ Provider:', data.session.user.app_metadata?.provider);
          
          // Check for pending share token
          const pendingShareToken = localStorage.getItem('pendingShareToken');
          if (pendingShareToken) {
            console.log('🔗 Found pending share token, redirecting to shared trip:', pendingShareToken);
            navigate(`/shared/${pendingShareToken}`);
          } else {
            // The main App component will handle the authentication state change
            navigate('/');
          }
        } else {
          console.log('❌ No session found in auth callback');
          navigate('/');
        }
      } catch (error) {
        console.error('❌ Auth callback error:', error);
        navigate('/');
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Completing sign-in...</p>
      </div>
    </div>
  );
}