import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rdufxwoeneglyponagdz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0ODY3NDgsImV4cCI6MjA2NTA2Mjc0OH0.n4rjoYq3hdi145qlH-JC-xn6PCTA1vEsdpX_vS-YK08';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInvitationCodes() {
  console.log('Checking invitation codes...\n');

  // Get all invitation codes
  const { data: codes, error } = await supabase
    .from('invitation_codes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching invitation codes:', error);
    return;
  }

  console.log(`Found ${codes.length} invitation codes:\n`);

  codes.forEach(code => {
    console.log(`Code: ${code.code}`);
    console.log(`Trip ID: ${code.trip_id}`);
    console.log(`Active: ${code.is_active}`);
    console.log(`Expires: ${code.expires_at}`);
    console.log(`Uses: ${code.current_uses}/${code.max_uses}`);
    console.log(`Created by: ${code.created_by}`);
    console.log('---');
  });

  // Check specific trip
  const tripId = 'b03962c2-15fe-4cf1-98d4-1105375489f9';
  console.log(`\nChecking codes for trip ${tripId}:`);
  
  const { data: tripCodes, error: tripError } = await supabase
    .from('invitation_codes')
    .select('*')
    .eq('trip_id', tripId)
    .eq('is_active', true);

  if (tripError) {
    console.error('Error fetching trip codes:', tripError);
    return;
  }

  console.log(`Found ${tripCodes.length} active codes for this trip`);
  tripCodes.forEach(code => {
    console.log(`- ${code.code} (expires: ${code.expires_at})`);
  });
}

checkInvitationCodes();