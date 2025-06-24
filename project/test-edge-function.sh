#!/bin/bash

# Test trip-member-management Edge Function
echo "Testing invitation code 2YLQDDP2..."

# You need to replace this with a valid auth token
AUTH_TOKEN="YOUR_AUTH_TOKEN_HERE"

curl -X POST https://rdufxwoeneglyponagdz.supabase.co/functions/v1/trip-member-management/join-trip \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkdWZ4d29lbmVnbHlwb25hZ2R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQyNDMxNDksImV4cCI6MjA0OTgxOTE0OX0.GzOoXV4kqKBZ8Vq-K0ItnxXoVTOlgNdcglNcINXOG-E" \
  -d '{"invitation_code": "2YLQDDP2"}' \
  -v