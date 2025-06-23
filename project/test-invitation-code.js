// Test script to verify invitation code functionality
const SUPABASE_URL = 'https://rdufxwoeneglyponagdz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQyNDMxNDksImV4cCI6MjA0OTgxOTE0OX0.GzOoXV4kqKBZ8Vq-K0ItnxXoVTOlgNdcglNcINXOG-E';

async function testInvitationCode() {
  // Test with a valid code
  const testCode = 'LI1BTPVN';
  
  console.log('🧪 Testing invitation code:', testCode);
  
  // First, we need to get an auth token (you'll need to replace this with a real user token)
  // For testing, you can get this from the browser console when logged in:
  // const { data: { session } } = await supabase.auth.getSession(); console.log(session.access_token);
  const AUTH_TOKEN = 'YOUR_AUTH_TOKEN_HERE';
  
  if (AUTH_TOKEN === 'YOUR_AUTH_TOKEN_HERE') {
    console.error('❌ Please replace AUTH_TOKEN with a real user token');
    console.log('To get a token:');
    console.log('1. Log in to the app in your browser');
    console.log('2. Open browser console');
    console.log('3. Run: const { data: { session } } = await supabase.auth.getSession(); console.log(session.access_token);');
    console.log('4. Copy the token and replace AUTH_TOKEN above');
    return;
  }
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/trip-member-management/join-trip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        invitation_code: testCode
      }),
    });
    
    console.log('📥 Response status:', response.status);
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('📥 Response body:', responseText);
    
    try {
      const responseData = JSON.parse(responseText);
      console.log('📥 Parsed response:', responseData);
    } catch (e) {
      console.log('❌ Could not parse response as JSON');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testInvitationCode();