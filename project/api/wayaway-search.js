/**
 * WayAway Flight Search Proxy
 * Server-side proxy to handle CORS and API calls to TravelPayouts
 */

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { origin, destination, depart_date, return_date, currency = 'JPY', token } = req.query;

    // Validate required parameters
    if (!origin || !destination || !depart_date || !token) {
      res.status(400).json({ 
        error: 'Missing required parameters: origin, destination, depart_date, token' 
      });
      return;
    }

    console.log('🔍 WayAway Proxy Request:', {
      origin,
      destination, 
      depart_date,
      return_date,
      currency
    });

    // Call TravelPayouts Data API for flight prices
    const apiUrl = `https://api.travelpayouts.com/v1/prices/direct`;
    const params = new URLSearchParams({
      origin,
      destination,
      depart_date,
      currency,
      token
    });

    if (return_date) {
      params.append('return_date', return_date);
    }
    
    console.log('🌐 Calling TravelPayouts API:', `${apiUrl}?${params.toString()}`);

    const response = await fetch(`${apiUrl}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'VoyPath/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`TravelPayouts API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log('✅ TravelPayouts API Response:', {
      success: data.success,
      dataKeys: data.data ? Object.keys(data.data) : [],
      currency: data.currency
    });

    // Transform response to standardized format
    const transformedResponse = {
      success: data.success || true,
      data: data.data || {},
      currency: data.currency || currency,
      source: 'TravelPayouts Data API',
      timestamp: new Date().toISOString()
    };

    res.status(200).json(transformedResponse);

  } catch (error) {
    console.error('WayAway proxy error:', error);
    
    // Return error response
    res.status(500).json({ 
      success: false,
      error: error.message,
      source: 'wayaway_proxy_error',
      timestamp: new Date().toISOString()
    });
  }
}