# Supabase Security Configuration Backup

## Project Information
- **Project ID**: rdufxwoeneglyponagdz
- **Project Name**: voypath_v5
- **Region**: ap-northeast-1
- **Status**: ACTIVE_HEALTHY
- **Database Version**: PostgreSQL 17.4.1.041

## Current Database Tables
The following tables exist in the public schema (backup taken on 2025-06-28):

### Core Tables
- `users` - User profiles and authentication data
- `trips` - Trip information and settings
- `places` - Location data with user preferences
- `trip_members` - Trip membership and roles
- `member_colors` - User color assignments
- `trip_member_colors` - Trip-specific color assignments

### Messaging System
- `messages` - Chat messages
- `chat_messages` - Chat system data
- `message_reactions` - Message reactions
- `message_reads` - Read receipts

### Sharing and Invitations
- `trip_shares` - Public trip sharing
- `invitation_codes` - Trip invitation system
- `share_access_log` - Access tracking

### Optimization System
- `optimization_results` - Route optimization data
- `optimization_cache` - Cached optimization results
- `optimization_progress` - Progress tracking
- `normalized_preferences` - User preference data
- `trip_optimization_settings` - Trip-specific settings

### External API Integration
- `google_maps_api_config` - API configuration
- `google_maps_usage` - Usage tracking
- `places_api_cache` - Cached API responses
- `places_api_usage` - API usage metrics
- `google_directions_cache` - Directions cache
- `google_distance_matrix_cache` - Distance matrix cache
- `google_street_view_cache` - Street view cache
- `airportdb_cache` - Airport data cache

### Real-time System
- `realtime_channels` - WebSocket channels
- `realtime_connections` - Connection tracking
- `realtime_publications` - Publication data
- `realtime_settings` - Real-time configuration

### Utility Tables
- `notifications` - User notifications
- `usage_events` - Analytics and usage tracking
- `pending_place_actions` - Queued actions
- `shared_place_comments` - Comments on places
- `transport_constraints` - Transportation settings
- `trip_map_settings` - Map display settings
- `geographic_regions` - Geographic data
- `spatial_ref_sys` - PostGIS spatial reference systems
- `schema_migrations` - Database migrations

## IMPORTANT: Rollback Information

### Before Making Changes
This document serves as a baseline for the current state before implementing comprehensive RLS security. If authentication issues occur after security changes, refer to this backup to understand the original configuration.

### Project Access Information
- **Project URL**: https://rdufxwoeneglyponagdz.supabase.co
- **Database Host**: db.rdufxwoeneglyponagdz.supabase.co
- **Current Status**: All tables exist and should be accessible

### Rollback Procedure
If severe authentication issues occur:
1. Check RLS policies on affected tables
2. Temporarily disable RLS on critical tables if needed
3. Review auth.users table for user access issues
4. Check service role key permissions
5. Verify anon key configuration

### Critical Tables for Immediate Access
Priority order for fixing authentication issues:
1. `users` - Core user authentication
2. `trips` - Basic trip access
3. `trip_members` - Membership verification
4. `messages` - Communication functionality
5. `places` - Core functionality

### Emergency Access Commands
If needed, these SQL commands can help restore access:
```sql
-- Temporarily disable RLS on critical tables (EMERGENCY ONLY)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE trips DISABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members DISABLE ROW LEVEL SECURITY;

-- Re-enable after fixing policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;
```

This backup was created before implementing comprehensive RLS security policies to ensure we can restore functionality if needed.