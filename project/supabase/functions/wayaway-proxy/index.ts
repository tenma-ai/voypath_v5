import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

// This Edge Function does not require authentication - it's for public API proxy
// No user authentication needed for flight search

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const origin = url.searchParams.get('origin')
    const destination = url.searchParams.get('destination')
    const depart_date = url.searchParams.get('depart_date')
    const return_date = url.searchParams.get('return_date')
    const currency = url.searchParams.get('currency') || 'JPY'
    const token = url.searchParams.get('token') || Deno.env.get('TRAVELPAYOUTS_TOKEN')

    if (!origin || !destination || !depart_date) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Missing required parameters: origin, destination, depart_date',
          received: { origin, destination, depart_date, hasToken: !!token }
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!token) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'No authentication token provided',
          tokenFromParam: !!url.searchParams.get('token'),
          tokenFromEnv: !!Deno.env.get('TRAVELPAYOUTS_TOKEN'),
          hint: 'Please provide API token via token parameter or set TRAVELPAYOUTS_TOKEN environment variable'
        }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate token format (TravelPayouts tokens are typically 32 character hex strings)
    // Allow more flexible token format validation
    if (token.length < 16 || token.length > 64) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid token format',
          tokenLength: token.length,
          hint: 'TravelPayouts tokens should be between 16-64 characters'
        }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Only log request details in development mode
    if (Deno.env.get('DENO_ENV') !== 'production') {
      console.log('🔍 WayAway Proxy Request:', {
        origin,
        destination, 
        depart_date,
        return_date,
        currency,
        hasToken: !!token,
        tokenLength: token?.length
      })
    }

    // Call TravelPayouts Data API for flight prices
    // Documentation: https://travelpayouts.github.io/slate/#non-stop_tickets
    const apiUrl = `https://api.travelpayouts.com/v1/prices/direct`
    
    // Test with minimal required parameters first
    const params = new URLSearchParams({
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      currency: currency.toUpperCase()
    })

    // Add dates if provided (API accepts both YYYY-MM-DD and YYYY-MM)
    if (depart_date) {
      params.append('depart_date', depart_date)
    }
    
    if (return_date) {
      params.append('return_date', return_date)
    }
    
    // Only log API calls in development mode, redact URL in production
    if (Deno.env.get('DENO_ENV') !== 'production') {
      console.log('🌐 Calling TravelPayouts API:', `${apiUrl}?${params.toString()}`)
      console.log('🔑 Using authentication header with token length:', token?.length)
    } else {
      console.log('🌐 Calling TravelPayouts API: [URL_REDACTED]')
    }

    const response = await fetch(`${apiUrl}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'VoyPath/1.0 (+https://voypath-v5.vercel.app)',
        'X-Access-Token': token  // TravelPayouts requires this exact header name
      }
    })

    console.log('📥 TravelPayouts API Response Status:', response.status, response.statusText)

    if (!response.ok) {
      // Get response body for detailed error information
      const errorText = await response.text()
      console.error('❌ TravelPayouts API Error Details:', {
        status: response.status,
        statusText: response.statusText,
        url: `${apiUrl}?${params.toString()}`,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorText,
        tokenPresent: !!token,
        tokenLength: token?.length
      })
      
      // Return detailed error response instead of throwing
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `TravelPayouts API error: ${response.status} ${response.statusText}`,
          details: errorText,
          apiUrl: `${apiUrl}?${params.toString()}`,
          timestamp: new Date().toISOString()
        }),
        { 
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const data = await response.json()
    
    // Only log response details in development mode
    if (Deno.env.get('DENO_ENV') !== 'production') {
      console.log('✅ TravelPayouts API Response:', {
        success: data.success,
        dataKeys: data.data ? Object.keys(data.data) : [],
        currency: data.currency
      })
    }

    // Transform response to standardized format
    const transformedResponse = {
      success: data.success || true,
      data: data.data || {},
      currency: data.currency || currency,
      source: 'TravelPayouts Data API',
      timestamp: new Date().toISOString()
    }

    return new Response(
      JSON.stringify(transformedResponse),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('WayAway proxy error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        source: 'wayaway_proxy_error',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})