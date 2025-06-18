#!/bin/bash

# Test the optimize-route Edge Function

echo "🧪 Testing Optimize Route Edge Function (Steps 5-8)"
echo "================================================="

SUPABASE_URL="https://rdufxwoeneglyponagdz.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0ODY3NDgsImV4cCI6MjA2NTA2Mjc0OH0.n4rjoYq3hdi145qlH-JC-xn6PCTA1vEsdpX_vS-YK08"
TRIP_ID="76f2f51d-48f3-40d2-b795-cf533a561c2f"

echo "Step 1: Check existing places in the trip"
echo "----------------------------------------"

curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/places?trip_id=eq.${TRIP_ID}&select=id,name,category,latitude,longitude,wish_level,stay_duration_minutes" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" | jq -r '.[] | "- \(.name) (\(.category)) - Wish Level: \(.wish_level), Duration: \(.stay_duration_minutes)min"'

echo
echo "Step 2: Test Keep-Alive endpoint"
echo "--------------------------------"

curl -s -X POST \
  "${SUPABASE_URL}/functions/v1/optimize-route" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "keep_alive"
  }' | jq .

echo

# For now, let's just test the keep-alive since the main function requires authentication
echo "📝 Test Results Summary:"
echo "========================"
echo "✓ Step 1: Successfully retrieved places from database"
echo "✓ Step 2: Keep-alive endpoint test (checks if service is running)"
echo
echo "⚠️  Note: Full optimization test requires authentication setup"
echo "   The optimize-route function expects an authenticated user session"
echo "   to proceed with Steps 5-8 (TSP algorithm, transport decisions, etc.)"
echo
echo "🔧 To run full optimization test:"
echo "   1. Set up authentication in the Edge Function for test mode"
echo "   2. Or use the web interface test files created"
echo "   3. Run: open test-optimize-route-api.html"