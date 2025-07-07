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
    const { origin, destination, depart_date, token, currency = 'JPY' } = req.query;

    if (!origin || !destination || !depart_date || !token) {
      res.status(400).json({ 
        error: 'Missing required parameters: origin, destination, depart_date, token' 
      });
      return;
    }

    // Call TravelPayouts API
    const apiUrl = `https://api.travelpayouts.com/v1/prices/direct?origin=${origin}&destination=${destination}&depart_date=${depart_date}&token=${token}&currency=${currency}`;
    
    const response = await fetch(apiUrl, {
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
    
    res.status(200).json({
      success: true,
      data: data,
      source: 'travelpayouts_api'
    });

  } catch (error) {
    console.error('TravelPayouts proxy error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      source: 'proxy_error'
    });
  }
}