import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

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
    const token = url.searchParams.get('token')

    if (!origin || !destination || !depart_date || !token) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Missing required parameters: origin, destination, depart_date, token' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('🔍 WayAway Proxy Request:', {
      origin,
      destination, 
      depart_date,
      return_date,
      currency
    })

    // Call TravelPayouts Data API for flight prices
    const apiUrl = `https://api.travelpayouts.com/v1/prices/direct`
    const params = new URLSearchParams({
      origin,
      destination,
      depart_date,
      currency
      // Don't include token in URL params - use header authentication only
    })

    if (return_date) {
      params.append('return_date', return_date)
    }
    
    console.log('🌐 Calling TravelPayouts API:', `${apiUrl}?${params.toString()}`)

    const response = await fetch(`${apiUrl}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'VoyPath/1.0',
        'X-Access-Token': token  // Use proper header authentication as required
      }
    })

    if (!response.ok) {
      throw new Error(`TravelPayouts API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    console.log('✅ TravelPayouts API Response:', {
      success: data.success,
      dataKeys: data.data ? Object.keys(data.data) : [],
      currency: data.currency
    })

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