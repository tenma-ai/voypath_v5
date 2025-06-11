import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Cache configuration
const CACHE_DURATIONS = {
  textsearch: 30 * 60, // 30 minutes for search results
  nearbysearch: 30 * 60, // 30 minutes for nearby searches
  details: 24 * 60 * 60, // 24 hours for place details (stable data)
  geocode: 7 * 24 * 60 * 60, // 7 days for geocoding (very stable)
}

// Generate cache key for requests
function generateCacheKey(endpoint: string, params: URLSearchParams): string {
  const sortedParams = Array.from(params.entries())
    .filter(([key]) => key !== 'key') // Exclude API key from cache key
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
  
  return `${endpoint}:${btoa(sortedParams).slice(0, 32)}`
}

// Cache management functions
async function getCachedResult(supabase: any, cacheKey: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('places_api_cache')
      .select('response_data')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .single()
    
    if (error || !data) return null
    return data.response_data
  } catch (error) {
    console.warn('Cache lookup failed:', error)
    return null
  }
}

async function setCachedResult(
  supabase: any, 
  cacheKey: string, 
  endpoint: string, 
  response: any
): Promise<void> {
  try {
    const cacheDuration = CACHE_DURATIONS[endpoint as keyof typeof CACHE_DURATIONS] || 1800 // 30 min default
    const expiresAt = new Date(Date.now() + cacheDuration * 1000)
    
    await supabase
      .from('places_api_cache')
      .upsert({
        cache_key: cacheKey,
        endpoint,
        response_data: response,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      })
  } catch (error) {
    console.warn('Cache storage failed:', error)
    // Don't throw - cache failures shouldn't break the API
  }
}

// Analytics and usage tracking
async function recordApiUsage(
  supabase: any,
  endpoint: string,
  cached: boolean,
  responseTime: number
): Promise<void> {
  try {
    await supabase
      .from('places_api_usage')
      .insert({
        endpoint,
        cached,
        response_time_ms: responseTime,
        timestamp: new Date().toISOString()
      })
  } catch (error) {
    console.warn('Usage tracking failed:', error)
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  let cached = false

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { searchParams } = new URL(req.url)
    const endpoint = searchParams.get('endpoint')
    const query = searchParams.get('query')
    const location = searchParams.get('location')
    const radius = searchParams.get('radius')
    const type = searchParams.get('type')
    const placeId = searchParams.get('place_id')
    const fields = searchParams.get('fields')

    if (!endpoint) {
      throw new Error('Endpoint parameter is required')
    }

    const GOOGLE_PLACES_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY')
    
    if (!GOOGLE_PLACES_API_KEY) {
      throw new Error('Google Places API key not configured')
    }

    let googleApiUrl: string
    const params = new URLSearchParams()
    params.append('key', GOOGLE_PLACES_API_KEY)

    switch (endpoint) {
      case 'textsearch':
        if (!query) {
          throw new Error('Query parameter is required for text search')
        }
        googleApiUrl = 'https://maps.googleapis.com/maps/api/place/textsearch/json'
        params.append('query', query)
        if (location) params.append('location', location)
        if (radius) params.append('radius', radius)
        if (type) params.append('type', type)
        break

      case 'nearbysearch':
        if (!location) {
          throw new Error('Location parameter is required for nearby search')
        }
        googleApiUrl = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json'
        params.append('location', location)
        params.append('radius', radius || '1000')
        if (type) params.append('type', type)
        break

      case 'details':
        if (!placeId) {
          throw new Error('Place ID is required for place details')
        }
        googleApiUrl = 'https://maps.googleapis.com/maps/api/place/details/json'
        params.append('place_id', placeId)
        if (fields) {
          params.append('fields', fields)
        } else {
          // Default fields
          params.append('fields', [
            'place_id',
            'name',
            'formatted_address',
            'geometry',
            'rating',
            'user_ratings_total',
            'price_level',
            'types',
            'photos',
            'opening_hours',
            'vicinity',
            'website',
            'formatted_phone_number'
          ].join(','))
        }
        break

      case 'geocode':
        const address = searchParams.get('address')
        const latlng = searchParams.get('latlng')
        
        if (!address && !latlng) {
          throw new Error('Either address or latlng parameter is required for geocoding')
        }
        
        googleApiUrl = 'https://maps.googleapis.com/maps/api/geocode/json'
        if (address) params.append('address', address)
        if (latlng) params.append('latlng', latlng)
        break

      default:
        throw new Error(`Unsupported endpoint: ${endpoint}`)
    }

    // Generate cache key for this request
    const cacheKey = generateCacheKey(endpoint, params)
    
    // Try to get cached result first
    let data = await getCachedResult(supabaseClient, cacheKey)
    
    if (data) {
      cached = true
      console.log(`Cache HIT for ${endpoint}: ${cacheKey}`)
    } else {
      console.log(`Cache MISS for ${endpoint}: ${cacheKey}`)
      
      // Make request to Google Places API
      const response = await fetch(`${googleApiUrl}?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error(`Google API request failed: ${response.status}`)
      }

      data = await response.json()

      // Check Google API response status
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Places API error: ${data.status} - ${data.error_message || 'Unknown error'}`)
      }

      // Cache the successful response
      await setCachedResult(supabaseClient, cacheKey, endpoint, data)
    }

    // Record usage analytics
    const responseTime = Date.now() - startTime
    await recordApiUsage(supabaseClient, endpoint, cached, responseTime)

    return new Response(JSON.stringify({
      ...data,
      _cache_info: {
        cached,
        cache_key: cacheKey,
        response_time_ms: responseTime
      }
    }), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'X-Cache-Status': cached ? 'HIT' : 'MISS',
        'X-Response-Time': `${responseTime}ms`
      },
    })

  } catch (error) {
    console.error('Google Places Proxy Error:', error)
    
    // Record failed request analytics if possible
    try {
      const responseTime = Date.now() - startTime
      const endpoint = new URL(req.url).searchParams.get('endpoint')
      if (endpoint) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        )
        await recordApiUsage(supabaseClient, endpoint, false, responseTime)
      }
    } catch (analyticsError) {
      console.warn('Failed to record error analytics:', analyticsError)
    }
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        status: 'ERROR',
        _cache_info: {
          cached: false,
          response_time_ms: Date.now() - startTime
        }
      }),
      {
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-Cache-Status': 'ERROR',
          'X-Response-Time': `${Date.now() - startTime}ms`
        },
      }
    )
  }
})