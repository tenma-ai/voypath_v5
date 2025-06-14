import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AirportDetectionRequest {
  location?: {
    latitude: number;
    longitude: number;
  };
  locations?: Array<{
    id: string;
    latitude: number;
    longitude: number;
  }>;
  searchRadiusKm?: number;
  flightType?: 'commercial' | 'international' | 'domestic' | 'any';
  airportSize?: 'large' | 'medium' | 'small' | 'any';
  batchMode?: boolean;
}

interface AirportData {
  iataCode: string;
  icaoCode: string;
  airportName: string;
  cityName: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  airportType: string;
  commercialService: boolean;
  internationalService: boolean;
  distanceKm: number;
  capabilityScore: number;
  capabilityBreakdown: {
    commercialScore: number;
    internationalScore: number;
    accessibilityScore: number;
    sizeScore: number;
    overallRating: 'excellent' | 'good' | 'fair' | 'poor';
  };
}

interface AirportDetectionResult {
  hasAirport: boolean;
  nearestAirport: AirportData | null;
  airportsInRadius: AirportData[];
  searchRadiusKm: number;
  source: 'cache' | 'airportdb' | 'fallback';
  executionTimeMs: number;
}

interface BatchAirportDetectionResult {
  batchId: string;
  results: Array<{
    locationId: string;
    location: { latitude: number; longitude: number };
    detection: AirportDetectionResult;
  }>;
  totalExecutionTimeMs: number;
  summary: {
    totalLocations: number;
    locationsWithAirports: number;
    averageAirportsPerLocation: number;
    cacheHitRate: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      }
    );
  }

  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  let requestStatus = 'success';
  let errorMessage: string | null = null;

  try {
    const { location, locations, searchRadiusKm = 50, flightType = 'any', airportSize = 'any', batchMode = false }: AirportDetectionRequest = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle batch mode
    if (batchMode && locations && locations.length > 0) {
      const batchResult = await detectAirportsBatch(locations, searchRadiusKm, flightType, airportSize, supabase);
      batchResult.totalExecutionTimeMs = Date.now() - startTime;

      return new Response(
        JSON.stringify({
          success: true,
          result: {
            ...batchResult,
            requestId
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Handle single location mode
    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      throw new Error('Invalid location data provided');
    }

    // Log request start
    await logAirportDetectionRequest(supabase, {
      requestId,
      location,
      searchRadiusKm,
      flightType,
      airportSize,
      timestamp: new Date().toISOString(),
      status: 'started'
    });

    // Execute airport detection
    const result = await detectAirports(location, searchRadiusKm, flightType, airportSize, supabase);
    result.executionTimeMs = Date.now() - startTime;

    // Log successful completion with metrics
    await logAirportDetectionMetrics(supabase, {
      requestId,
      executionTimeMs: result.executionTimeMs,
      airportsFound: result.airportsInRadius.length,
      source: result.source,
      cacheHit: result.source === 'cache',
      status: 'completed'
    });

    return new Response(
      JSON.stringify({
        success: true,
        result: {
          ...result,
          requestId // Include request ID for tracking
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    requestStatus = 'error';
    errorMessage = error.message;
    console.error('Airport detection error:', error);

    // Log error with metrics
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    await logAirportDetectionMetrics(supabase, {
      requestId,
      executionTimeMs: Date.now() - startTime,
      airportsFound: 0,
      source: 'error',
      cacheHit: false,
      status: 'error',
      errorMessage: error.message
    });

    return new Response(
      JSON.stringify({ 
        error: error.message,
        requestId 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

async function detectAirports(
  location: { latitude: number; longitude: number },
  searchRadiusKm: number,
  flightType: string,
  airportSize: string,
  supabase: any
): Promise<AirportDetectionResult> {
  
  // Step 1: Check cache first for performance
  const cachedAirports = await checkCachedAirports(location, searchRadiusKm, flightType, airportSize, supabase);
  
  if (cachedAirports.length > 0) {
    const nearestAirport = cachedAirports.reduce((nearest, airport) => 
      airport.distanceKm < nearest.distanceKm ? airport : nearest
    );

    return {
      hasAirport: true,
      nearestAirport,
      airportsInRadius: cachedAirports,
      searchRadiusKm,
      source: 'cache',
      executionTimeMs: 0
    };
  }

  // Step 2: Call AirportDB API if cache miss
  try {
    const airportDbResult = await callAirportDbApi(location, searchRadiusKm, flightType, airportSize);
    
    if (airportDbResult.length > 0) {
      // Cache the results for future use
      await cacheAirportResults(airportDbResult, supabase);
      
      const nearestAirport = airportDbResult.reduce((nearest, airport) => 
        airport.distanceKm < nearest.distanceKm ? airport : nearest
      );

      return {
        hasAirport: true,
        nearestAirport,
        airportsInRadius: airportDbResult,
        searchRadiusKm,
        source: 'airportdb',
        executionTimeMs: 0
      };
    }
  } catch (error) {
    console.warn('AirportDB API failed, using fallback:', error);
  }

  // Step 3: Fallback to hardcoded major airports
  const fallbackAirports = await fallbackAirportDetection(location, searchRadiusKm, supabase);
  
  const nearestAirport = fallbackAirports.length > 0 ? 
    fallbackAirports.reduce((nearest, airport) => 
      airport.distanceKm < nearest.distanceKm ? airport : nearest
    ) : null;

  return {
    hasAirport: fallbackAirports.length > 0,
    nearestAirport,
    airportsInRadius: fallbackAirports,
    searchRadiusKm,
    source: 'fallback',
    executionTimeMs: 0
  };
}

async function checkCachedAirports(
  location: { latitude: number; longitude: number },
  searchRadiusKm: number,
  flightType: string,
  airportSize: string,
  supabase: any
): Promise<AirportData[]> {
  
  try {
    // Use the cached airport search function we created in Phase 1
    const { data: airports, error } = await supabase.rpc('find_cached_airports_within_radius', {
      search_lat: location.latitude,
      search_lng: location.longitude,
      radius_km: searchRadiusKm,
      flight_type: flightType,
      airport_size: airportSize
    });

    if (error) {
      console.warn('Cache query failed:', error);
      return [];
    }

    return airports?.map((airport: any) => {
      const capability = calculateAirportCapabilityScore({
        airportType: airport.airport_type,
        commercialService: airport.commercial_service,
        internationalService: airport.international_service,
        distanceKm: airport.distance_km,
        iataCode: airport.iata_code,
        icaoCode: airport.icao_code
      });

      return {
        iataCode: airport.iata_code,
        icaoCode: airport.icao_code,
        airportName: airport.airport_name,
        cityName: airport.city_name,
        countryCode: airport.country_code,
        latitude: airport.latitude,
        longitude: airport.longitude,
        airportType: airport.airport_type,
        commercialService: airport.commercial_service,
        internationalService: airport.international_service,
        distanceKm: airport.distance_km,
        capabilityScore: capability.score,
        capabilityBreakdown: capability.breakdown
      };
    }) || [];

  } catch (error) {
    console.warn('Cache check failed:', error);
    return [];
  }
}

async function callAirportDbApi(
  location: { latitude: number; longitude: number },
  searchRadiusKm: number,
  flightType: string,
  airportSize: string
): Promise<AirportData[]> {
  
  // AirportDB API implementation with rate limiting (100req/min, 10000req/day)
  const AIRPORTDB_API_KEY = Deno.env.get('AIRPORTDB_API_KEY');
  
  if (!AIRPORTDB_API_KEY) {
    throw new Error('AirportDB API key not configured');
  }

  const apiUrl = new URL('https://api.airportdb.io/v1/airports');
  apiUrl.searchParams.set('lat', location.latitude.toString());
  apiUrl.searchParams.set('lng', location.longitude.toString());
  apiUrl.searchParams.set('radius', (searchRadiusKm * 1000).toString()); // Convert to meters
  apiUrl.searchParams.set('type', flightType === 'any' ? 'all' : flightType);
  
  const response = await fetch(apiUrl.toString(), {
    headers: {
      'Authorization': `Bearer ${AIRPORTDB_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`AirportDB API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  return data.airports?.map((airport: any) => {
    const distanceKm = calculateDistance(
      location.latitude, location.longitude,
      parseFloat(airport.latitude), parseFloat(airport.longitude)
    );

    const capability = calculateAirportCapabilityScore({
      airportType: airport.type || 'unknown',
      commercialService: airport.commercial_service || false,
      internationalService: airport.international_service || false,
      distanceKm,
      iataCode: airport.iata_code || '',
      icaoCode: airport.icao_code || ''
    });

    return {
      iataCode: airport.iata_code || '',
      icaoCode: airport.icao_code || '',
      airportName: airport.name || '',
      cityName: airport.city || '',
      countryCode: airport.country_code || '',
      latitude: parseFloat(airport.latitude) || 0,
      longitude: parseFloat(airport.longitude) || 0,
      airportType: airport.type || 'unknown',
      commercialService: airport.commercial_service || false,
      internationalService: airport.international_service || false,
      distanceKm,
      capabilityScore: capability.score,
      capabilityBreakdown: capability.breakdown
    };
  }) || [];
}

async function cacheAirportResults(airports: AirportData[], supabase: any): Promise<void> {
  
  try {
    const airportsToCache = airports.map(airport => ({
      iata_code: airport.iataCode,
      icao_code: airport.icaoCode,
      airport_name: airport.airportName,
      city_name: airport.cityName,
      country_code: airport.countryCode,
      latitude: airport.latitude,
      longitude: airport.longitude,
      airport_type: airport.airportType,
      commercial_service: airport.commercialService,
      international_service: airport.internationalService,
      cache_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      is_active: true
    }));

    // Insert or update cached airports
    const { error } = await supabase
      .from('airportdb_cache')
      .upsert(airportsToCache, { 
        onConflict: 'iata_code',
        ignoreDuplicates: false 
      });

    if (error) {
      console.warn('Failed to cache airport results:', error);
    }

  } catch (error) {
    console.warn('Airport caching failed:', error);
  }
}

async function fallbackAirportDetection(
  location: { latitude: number; longitude: number },
  searchRadiusKm: number,
  supabase: any
): Promise<AirportData[]> {
  
  // Fallback using major Japanese airports hardcoded in our cache
  try {
    const { data: airports, error } = await supabase
      .from('airportdb_cache')
      .select('*')
      .eq('is_active', true);

    if (error || !airports) {
      return [];
    }

    return airports
      .map((airport: any) => {
        const distance = calculateDistance(
          location.latitude, location.longitude,
          airport.latitude, airport.longitude
        );

        const capability = calculateAirportCapabilityScore({
          airportType: airport.airport_type,
          commercialService: airport.commercial_service,
          internationalService: airport.international_service,
          distanceKm: distance,
          iataCode: airport.iata_code,
          icaoCode: airport.icao_code
        });
        
        return {
          iataCode: airport.iata_code,
          icaoCode: airport.icao_code,
          airportName: airport.airport_name,
          cityName: airport.city_name,
          countryCode: airport.country_code,
          latitude: airport.latitude,
          longitude: airport.longitude,
          airportType: airport.airport_type,
          commercialService: airport.commercial_service,
          internationalService: airport.international_service,
          distanceKm: distance,
          capabilityScore: capability.score,
          capabilityBreakdown: capability.breakdown
        };
      })
      .filter((airport: AirportData) => airport.distanceKm <= searchRadiusKm)
      .sort((a: AirportData, b: AirportData) => a.capabilityScore - b.capabilityScore) // Sort by capability score (best first)
      .reverse();

  } catch (error) {
    console.warn('Fallback airport detection failed:', error);
    return [];
  }
}

// Utility function for distance calculation
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Airport capability scoring function
function calculateAirportCapabilityScore(airport: {
  airportType: string;
  commercialService: boolean;
  internationalService: boolean;
  distanceKm: number;
  iataCode: string;
  icaoCode: string;
}): { score: number; breakdown: AirportData['capabilityBreakdown'] } {
  
  // Commercial service scoring (0-30 points)
  let commercialScore = 0;
  if (airport.commercialService) {
    commercialScore = 30;
  } else if (airport.airportType === 'medium_airport') {
    commercialScore = 15;
  } else if (airport.airportType === 'small_airport') {
    commercialScore = 5;
  }

  // International service scoring (0-25 points)
  let internationalScore = 0;
  if (airport.internationalService) {
    internationalScore = 25;
  } else if (airport.commercialService) {
    internationalScore = 10; // Likely has domestic service
  }

  // Accessibility/Distance scoring (0-25 points)
  let accessibilityScore = 0;
  if (airport.distanceKm <= 10) {
    accessibilityScore = 25;
  } else if (airport.distanceKm <= 25) {
    accessibilityScore = 20;
  } else if (airport.distanceKm <= 50) {
    accessibilityScore = 15;
  } else if (airport.distanceKm <= 100) {
    accessibilityScore = 10;
  } else {
    accessibilityScore = 5;
  }

  // Size/Infrastructure scoring (0-20 points)
  let sizeScore = 0;
  if (airport.airportType === 'large_airport') {
    sizeScore = 20;
  } else if (airport.airportType === 'medium_airport') {
    sizeScore = 15;
  } else if (airport.airportType === 'small_airport') {
    sizeScore = 10;
  } else {
    sizeScore = 5;
  }

  // IATA code presence bonus (major airports have IATA codes)
  if (airport.iataCode && airport.iataCode.length === 3) {
    sizeScore += 5;
  }

  const totalScore = commercialScore + internationalScore + accessibilityScore + sizeScore;

  // Overall rating based on total score
  let overallRating: 'excellent' | 'good' | 'fair' | 'poor';
  if (totalScore >= 80) {
    overallRating = 'excellent';
  } else if (totalScore >= 60) {
    overallRating = 'good';
  } else if (totalScore >= 40) {
    overallRating = 'fair';
  } else {
    overallRating = 'poor';
  }

  return {
    score: totalScore,
    breakdown: {
      commercialScore,
      internationalScore,
      accessibilityScore,
      sizeScore,
      overallRating
    }
  };
}

// Request logging function
async function logAirportDetectionRequest(supabase: any, requestData: {
  requestId: string;
  location: { latitude: number; longitude: number };
  searchRadiusKm: number;
  flightType: string;
  airportSize: string;
  timestamp: string;
  status: string;
}): Promise<void> {
  try {
    const { error } = await supabase
      .from('airport_detection_logs')
      .insert({
        request_id: requestData.requestId,
        latitude: requestData.location.latitude,
        longitude: requestData.location.longitude,
        search_radius_km: requestData.searchRadiusKm,
        flight_type: requestData.flightType,
        airport_size: requestData.airportSize,
        request_timestamp: requestData.timestamp,
        status: requestData.status
      });

    if (error) {
      console.warn('Failed to log airport detection request:', error);
    }
  } catch (error) {
    console.warn('Request logging failed:', error);
  }
}

// Metrics logging function
async function logAirportDetectionMetrics(supabase: any, metricsData: {
  requestId: string;
  executionTimeMs: number;
  airportsFound: number;
  source: string;
  cacheHit: boolean;
  status: string;
  errorMessage?: string;
}): Promise<void> {
  try {
    const { error } = await supabase
      .from('airport_detection_metrics')
      .insert({
        request_id: metricsData.requestId,
        execution_time_ms: metricsData.executionTimeMs,
        airports_found: metricsData.airportsFound,
        data_source: metricsData.source,
        cache_hit: metricsData.cacheHit,
        status: metricsData.status,
        error_message: metricsData.errorMessage || null,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.warn('Failed to log airport detection metrics:', error);
    }
  } catch (error) {
    console.warn('Metrics logging failed:', error);
  }
}

// Batch airport detection function
async function detectAirportsBatch(
  locations: Array<{ id: string; latitude: number; longitude: number }>,
  searchRadiusKm: number,
  flightType: string,
  airportSize: string,
  supabase: any
): Promise<BatchAirportDetectionResult> {
  
  const batchId = crypto.randomUUID();
  const results = [];
  let totalCacheHits = 0;
  let totalAirportsFound = 0;
  let locationsWithAirports = 0;

  console.log(`Starting batch airport detection for ${locations.length} locations`);

  // Process locations in parallel with concurrency limit (to avoid overwhelming the API)
  const BATCH_SIZE = 5; // Process 5 locations at a time
  
  for (let i = 0; i < locations.length; i += BATCH_SIZE) {
    const batch = locations.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(async (location) => {
      try {
        const detection = await detectAirports(
          { latitude: location.latitude, longitude: location.longitude },
          searchRadiusKm,
          flightType,
          airportSize,
          supabase
        );

        if (detection.source === 'cache') {
          totalCacheHits++;
        }
        
        totalAirportsFound += detection.airportsInRadius.length;
        
        if (detection.hasAirport) {
          locationsWithAirports++;
        }

        return {
          locationId: location.id,
          location: { latitude: location.latitude, longitude: location.longitude },
          detection
        };
      } catch (error) {
        console.error(`Error detecting airports for location ${location.id}:`, error);
        
        // Return fallback result for failed location
        return {
          locationId: location.id,
          location: { latitude: location.latitude, longitude: location.longitude },
          detection: {
            hasAirport: false,
            nearestAirport: null,
            airportsInRadius: [],
            searchRadiusKm,
            source: 'error' as const,
            executionTimeMs: 0
          }
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Add small delay between batches to respect rate limits
    if (i + BATCH_SIZE < locations.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const cacheHitRate = locations.length > 0 ? (totalCacheHits / locations.length) * 100 : 0;
  const averageAirportsPerLocation = locations.length > 0 ? totalAirportsFound / locations.length : 0;

  return {
    batchId,
    results,
    totalExecutionTimeMs: 0, // Will be set by caller
    summary: {
      totalLocations: locations.length,
      locationsWithAirports,
      averageAirportsPerLocation: Math.round(averageAirportsPerLocation * 100) / 100,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100
    }
  };
}