const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rdufxwoeneglyponagdz.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0ODY3NDgsImV4cCI6MjA2NTA2Mjc0OH0.n4rjoYq3hdi145qlH-JC-xn6PCTA1vEsdpX_vS-YK08';

const supabase = createClient(supabaseUrl, anonKey);

async function testRealAuth() {
  console.log('🔧 Testing real authentication and Edge Functions...');
  
  try {
    // Test if we can sign up a new user
    console.log('Attempting to sign up new user...');
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: 'test@voypath.com',
      password: 'testpassword123'
    });
    
    if (signUpError) {
      console.log('Sign up failed (expected if user exists):', signUpError.message);
      
      // Try to sign in with existing user
      console.log('Attempting to sign in existing user...');
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: 'test@voypath.com', 
        password: 'testpassword123'
      });
      
      if (signInError) {
        console.error('❌ Sign in failed:', signInError.message);
        return;
      }
      
      console.log('✅ Sign in successful:', signInData.user?.id);
      
      // Test Edge Function call with real auth
      console.log('Testing Edge Function with real authentication...');
      const { data: functionData, error: functionError } = await supabase.functions.invoke('normalize-preferences', {
        body: {
          trip_id: '737a36f2-66b0-4dfa-a764-3d6e305faf11',
          force_refresh: true
        }
      });
      
      if (functionError) {
        console.error('❌ Edge Function failed:', functionError.message);
      } else {
        console.log('✅ Edge Function successful:', functionData);
      }
      
    } else {
      console.log('✅ Sign up successful:', signUpData.user?.id);
    }
    
  } catch (error) {
    console.error('❌ Auth test failed:', error.message);
  }
}

testRealAuth();