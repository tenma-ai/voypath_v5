/**
 * Color Management Edge Function
 * Handles member color assignment and management for trips
 * 
 * Endpoints:
 * - POST /color-management/assign - Assign color to member
 * - GET /color-management/trip/{tripId} - Get all trip member colors
 * - PUT /color-management/update - Update member color
 * - DELETE /color-management/recycle - Recycle member color
 * - GET /color-management/available/{tripId} - Get available colors
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Types
interface RefinedColor {
  id: number;
  name: string;
  hex: string;
  rgb: string;
  hsl: string;
}

interface ColorAssignmentRequest {
  tripId: string;
  userId: string;
}

interface ColorAssignmentResponse {
  success: boolean;
  color?: RefinedColor;
  remainingColors?: number;
  error?: string;
}

interface MemberColorAssignment {
  tripId: string;
  userId: string;
  colorIndex: number;
  color: RefinedColor;
  assignedAt: string;
}

// Predefined refined colors (matching MemberColorService)
const REFINED_COLORS: RefinedColor[] = [
  { id: 1, name: 'Ocean Blue', hex: '#0077BE', rgb: 'rgb(0,119,190)', hsl: 'hsl(202,100%,37%)' },
  { id: 2, name: 'Forest Green', hex: '#228B22', rgb: 'rgb(34,139,34)', hsl: 'hsl(120,61%,34%)' },
  { id: 3, name: 'Sunset Orange', hex: '#FF6B35', rgb: 'rgb(255,107,53)', hsl: 'hsl(16,100%,60%)' },
  { id: 4, name: 'Royal Purple', hex: '#7B68EE', rgb: 'rgb(123,104,238)', hsl: 'hsl(249,80%,67%)' },
  { id: 5, name: 'Cherry Red', hex: '#DC143C', rgb: 'rgb(220,20,60)', hsl: 'hsl(348,83%,47%)' },
  { id: 6, name: 'Teal', hex: '#008080', rgb: 'rgb(0,128,128)', hsl: 'hsl(180,100%,25%)' },
  { id: 7, name: 'Amber', hex: '#FFC000', rgb: 'rgb(255,192,0)', hsl: 'hsl(45,100%,50%)' },
  { id: 8, name: 'Lavender', hex: '#E6E6FA', rgb: 'rgb(230,230,250)', hsl: 'hsl(240,67%,94%)' },
  { id: 9, name: 'Coral', hex: '#FF7F50', rgb: 'rgb(255,127,80)', hsl: 'hsl(16,100%,66%)' },
  { id: 10, name: 'Emerald', hex: '#50C878', rgb: 'rgb(80,200,120)', hsl: 'hsl(140,54%,55%)' },
  { id: 11, name: 'Magenta', hex: '#FF00FF', rgb: 'rgb(255,0,255)', hsl: 'hsl(300,100%,50%)' },
  { id: 12, name: 'Navy', hex: '#000080', rgb: 'rgb(0,0,128)', hsl: 'hsl(240,100%,25%)' },
  { id: 13, name: 'Rose', hex: '#FF007F', rgb: 'rgb(255,0,127)', hsl: 'hsl(330,100%,50%)' },
  { id: 14, name: 'Lime', hex: '#32CD32', rgb: 'rgb(50,205,50)', hsl: 'hsl(120,61%,50%)' },
  { id: 15, name: 'Indigo', hex: '#4B0082', rgb: 'rgb(75,0,130)', hsl: 'hsl(275,100%,25%)' },
  { id: 16, name: 'Turquoise', hex: '#40E0D0', rgb: 'rgb(64,224,208)', hsl: 'hsl(174,72%,56%)' },
  { id: 17, name: 'Crimson', hex: '#B22222', rgb: 'rgb(178,34,34)', hsl: 'hsl(0,68%,42%)' },
  { id: 18, name: 'Olive', hex: '#808000', rgb: 'rgb(128,128,0)', hsl: 'hsl(60,100%,25%)' },
  { id: 19, name: 'Slate', hex: '#708090', rgb: 'rgb(112,128,144)', hsl: 'hsl(210,13%,50%)' },
  { id: 20, name: 'Maroon', hex: '#800000', rgb: 'rgb(128,0,0)', hsl: 'hsl(0,100%,25%)' }
];

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper functions
function getColorByIndex(index: number): RefinedColor | null {
  if (index < 1 || index > 20) return null;
  return REFINED_COLORS[index - 1];
}

async function logUsageEvent(
  userId: string | null,
  eventType: string,
  tripId?: string,
  metadata?: any
) {
  try {
    await supabase.from('usage_events').insert({
      user_id: userId,
      event_type: eventType,
      event_category: 'color_management',
      trip_id: tripId,
      metadata: metadata || {}
    });
  } catch (error) {
    console.error('Failed to log usage event:', error);
  }
}

// Route handlers
async function handleAssignColor(request: Request): Promise<Response> {
  try {
    const { tripId, userId }: ColorAssignmentRequest = await request.json();

    if (!tripId || !userId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'tripId and userId are required' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already has a color assigned in this trip
    const { data: existingAssignment } = await supabase
      .from('trip_members')
      .select('assigned_color_index')
      .eq('trip_id', tripId)
      .eq('user_id', userId)
      .single();

    if (existingAssignment?.assigned_color_index) {
      const existingColor = getColorByIndex(existingAssignment.assigned_color_index);
      
      await logUsageEvent(userId, 'color_already_assigned', tripId, {
        color_index: existingAssignment.assigned_color_index
      });

      return new Response(
        JSON.stringify({
          success: true,
          color: existingColor,
          remainingColors: await getRemainingColorCount(tripId)
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get all assigned colors in this trip
    const { data: assignedColors } = await supabase
      .from('trip_members')
      .select('assigned_color_index')
      .eq('trip_id', tripId)
      .not('assigned_color_index', 'is', null);

    const usedIndices = new Set(assignedColors?.map(m => m.assigned_color_index) || []);

    // Find first available color
    let availableIndex = 1;
    while (usedIndices.has(availableIndex) && availableIndex <= 20) {
      availableIndex++;
    }

    if (availableIndex > 20) {
      await logUsageEvent(userId, 'color_assignment_failed', tripId, {
        reason: 'no_available_colors',
        member_count: usedIndices.size
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: 'No available colors (maximum 20 members per trip)'
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Assign the color
    const { error } = await supabase
      .from('trip_members')
      .update({
        assigned_color_index: availableIndex,
        color_assigned_at: new Date().toISOString()
      })
      .eq('trip_id', tripId)
      .eq('user_id', userId);

    if (error) {
      await logUsageEvent(userId, 'color_assignment_failed', tripId, {
        reason: 'database_error',
        error: error.message
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to assign color: ${error.message}`
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const assignedColor = getColorByIndex(availableIndex);
    
    await logUsageEvent(userId, 'color_assigned', tripId, {
      color_index: availableIndex,
      color_name: assignedColor?.name
    });

    return new Response(
      JSON.stringify({
        success: true,
        color: assignedColor,
        remainingColors: await getRemainingColorCount(tripId)
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error assigning color:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleGetTripColors(tripId: string): Promise<Response> {
  try {
    if (!tripId) {
      return new Response(
        JSON.stringify({ error: 'Trip ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: members, error } = await supabase
      .from('trip_members')
      .select(`
        user_id, 
        assigned_color_index, 
        color_assigned_at,
        users(name, display_name)
      `)
      .eq('trip_id', tripId)
      .not('assigned_color_index', 'is', null);

    if (error) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch trip colors: ${error.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const memberColors: MemberColorAssignment[] = (members || []).map(member => ({
      tripId,
      userId: member.user_id,
      colorIndex: member.assigned_color_index,
      color: getColorByIndex(member.assigned_color_index)!,
      assignedAt: member.color_assigned_at,
      userName: member.users?.display_name || member.users?.name || 'Unknown User'
    }));

    await logUsageEvent(null, 'trip_colors_retrieved', tripId, {
      member_count: memberColors.length
    });

    return new Response(
      JSON.stringify({
        success: true,
        memberColors,
        totalMembers: memberColors.length,
        availableColors: await getRemainingColorCount(tripId)
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error getting trip colors:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleRecycleColor(request: Request): Promise<Response> {
  try {
    const { tripId, userId } = await request.json();

    if (!tripId || !userId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'tripId and userId are required' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get current color assignment for logging
    const { data: currentAssignment } = await supabase
      .from('trip_members')
      .select('assigned_color_index')
      .eq('trip_id', tripId)
      .eq('user_id', userId)
      .single();

    const { error } = await supabase
      .from('trip_members')
      .update({
        assigned_color_index: null,
        color_assigned_at: null
      })
      .eq('trip_id', tripId)
      .eq('user_id', userId);

    if (error) {
      await logUsageEvent(userId, 'color_recycle_failed', tripId, {
        reason: 'database_error',
        error: error.message
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to recycle color: ${error.message}`
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await logUsageEvent(userId, 'color_recycled', tripId, {
      recycled_color_index: currentAssignment?.assigned_color_index
    });

    return new Response(
      JSON.stringify({
        success: true,
        availableColors: await getRemainingColorCount(tripId)
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error recycling color:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function handleGetAvailableColors(tripId: string): Promise<Response> {
  try {
    if (!tripId) {
      return new Response(
        JSON.stringify({ error: 'Trip ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: assignedColors } = await supabase
      .from('trip_members')
      .select('assigned_color_index')
      .eq('trip_id', tripId)
      .not('assigned_color_index', 'is', null);

    const usedIndices = new Set(assignedColors?.map(m => m.assigned_color_index) || []);
    const availableColors = REFINED_COLORS.filter(color => !usedIndices.has(color.id));

    await logUsageEvent(null, 'available_colors_retrieved', tripId, {
      available_count: availableColors.length,
      used_count: usedIndices.size
    });

    return new Response(
      JSON.stringify({
        success: true,
        availableColors,
        usedColors: Array.from(usedIndices).map(index => getColorByIndex(index)),
        totalAvailable: availableColors.length,
        totalUsed: usedIndices.size
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error getting available colors:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function getRemainingColorCount(tripId: string): Promise<number> {
  try {
    const { data: assignedColors } = await supabase
      .from('trip_members')
      .select('assigned_color_index')
      .eq('trip_id', tripId)
      .not('assigned_color_index', 'is', null);

    return 20 - (assignedColors?.length || 0);
  } catch {
    return 0;
  }
}

// Main handler
serve(async (req: Request) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Remove 'color-management' from path if present
    if (pathParts[0] === 'color-management') {
      pathParts.shift();
    }

    const action = pathParts[0];
    const param = pathParts[1];

    let response: Response;

    switch (req.method) {
      case 'POST':
        switch (action) {
          case 'assign':
            response = await handleAssignColor(req);
            break;
          default:
            response = new Response(
              JSON.stringify({ error: 'Invalid POST endpoint' }),
              { status: 404, headers: { 'Content-Type': 'application/json' } }
            );
        }
        break;

      case 'GET':
        switch (action) {
          case 'trip':
            response = await handleGetTripColors(param);
            break;
          case 'available':
            response = await handleGetAvailableColors(param);
            break;
          default:
            response = new Response(
              JSON.stringify({ error: 'Invalid GET endpoint' }),
              { status: 404, headers: { 'Content-Type': 'application/json' } }
            );
        }
        break;

      case 'DELETE':
        switch (action) {
          case 'recycle':
            response = await handleRecycleColor(req);
            break;
          default:
            response = new Response(
              JSON.stringify({ error: 'Invalid DELETE endpoint' }),
              { status: 404, headers: { 'Content-Type': 'application/json' } }
            );
        }
        break;

      default:
        response = new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          { status: 405, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // Add CORS headers to response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    console.error('Color management function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});