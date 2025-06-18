import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Place {
  id: string;
  name: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  type?: string;
  member_id: string;
  member_color?: string;
  stay_duration?: number;
}

interface Airport {
  iata_code: string;
  icao_code: string;
  name: string;
  city: string;
  country: string;
  location: {
    lat: number;
    lng: number;
  };
  elevation_ft: number;
  type: string;
  inserted_at?: number;
}

interface DetectAirportsRequest {
  trip_id: string;
  selected_places: Place[];
  transport_decisions: Array<{
    from: string;
    to: string;
    mode: 'car' | 'flight' | 'walking';
    distance_km: number;
    estimated_time_minutes: number;
  }>;
}

interface AirportDetectionResult {
  detected_airports: Airport[];
  flight_segments: Array<{
    from_place: Place;
    to_place: Place;
    departure_airport: Airport;
    arrival_airport: Airport;
    distance_km: number;
  }>;
  route_with_airports: Array<Place | Airport>;
}

// AirportDB APIのベースURL
const AIRPORTDB_API_BASE = 'https://airportdb.io/api/v1';

// ハーバーサイン距離計算
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // 地球の半径 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// 国コード推定（簡易版）
function estimateCountryCode(lat: number, lng: number): string {
  // 主要国の簡易境界判定
  if (lat >= 24 && lat <= 49 && lng >= -125 && lng <= -66) return 'US';
  if (lat >= 45 && lat <= 71 && lng >= -141 && lng <= -52) return 'CA';
  if (lat >= 35 && lat <= 46 && lng >= 139 && lng <= 146) return 'JP';
  if (lat >= 20 && lat <= 46 && lng >= 118 && lng <= 122) return 'CN';
  if (lat >= 36 && lat <= 72 && lng >= -10 && lng <= 40) return 'EU';
  if (lat >= -44 && lat <= -10 && lng >= 113 && lng <= 154) return 'AU';
  if (lat >= 8 && lat <= 37 && lng >= 68 && lng <= 97) return 'IN';
  if (lat >= -35 && lat <= 38 && lng >= -74 && lng <= -34) return 'BR';
  
  return 'XX'; // 不明
}

// AirportDB APIから空港データを取得
async function fetchAirportsFromAPI(lat: number, lng: number, radius: number): Promise<Airport[]> {
  const apiKey = Deno.env.get('AIRPORTDB_API_KEY');
  if (!apiKey) {
    console.log('AirportDB API key not found, using fallback data');
    return [];
  }

  try {
    const url = `${AIRPORTDB_API_BASE}/airports?lat=${lat}&lng=${lng}&radius=${radius}&limit=20`;
    const response = await fetch(url, {
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`AirportDB API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.airports || [];
  } catch (error) {
    console.log(`AirportDB API fetch error: ${error.message}`);
    return [];
  }
}

// 静的空港データ（フォールバック用）
const MAJOR_AIRPORTS: Record<string, Airport[]> = {
  'US': [
    {
      iata_code: 'JFK',
      icao_code: 'KJFK',
      name: 'John F Kennedy International Airport',
      city: 'New York',
      country: 'US',
      location: { lat: 40.6413, lng: -73.7781 },
      elevation_ft: 13,
      type: 'large_airport'
    },
    {
      iata_code: 'LAX',
      icao_code: 'KLAX',
      name: 'Los Angeles International Airport',
      city: 'Los Angeles',
      country: 'US',
      location: { lat: 34.0522, lng: -118.2437 },
      elevation_ft: 125,
      type: 'large_airport'
    },
    {
      iata_code: 'ORD',
      icao_code: 'KORD',
      name: 'Chicago O\'Hare International Airport',
      city: 'Chicago',
      country: 'US',
      location: { lat: 41.9742, lng: -87.9073 },
      elevation_ft: 672,
      type: 'large_airport'
    }
  ],
  'JP': [
    {
      iata_code: 'NRT',
      icao_code: 'RJAA',
      name: 'Narita International Airport',
      city: 'Tokyo',
      country: 'JP',
      location: { lat: 35.7647, lng: 140.3864 },
      elevation_ft: 141,
      type: 'large_airport'
    },
    {
      iata_code: 'HND',
      icao_code: 'RJTT',
      name: 'Tokyo Haneda Airport',
      city: 'Tokyo',
      country: 'JP',
      location: { lat: 35.5494, lng: 139.7798 },
      elevation_ft: 21,
      type: 'large_airport'
    },
    {
      iata_code: 'KIX',
      icao_code: 'RJBB',
      name: 'Kansai International Airport',
      city: 'Osaka',
      country: 'JP',
      location: { lat: 34.4347, lng: 135.2441 },
      elevation_ft: 26,
      type: 'large_airport'
    }
  ],
  'EU': [
    {
      iata_code: 'LHR',
      icao_code: 'EGLL',
      name: 'London Heathrow Airport',
      city: 'London',
      country: 'GB',
      location: { lat: 51.4700, lng: -0.4543 },
      elevation_ft: 83,
      type: 'large_airport'
    },
    {
      iata_code: 'CDG',
      icao_code: 'LFPG',
      name: 'Charles de Gaulle Airport',
      city: 'Paris',
      country: 'FR',
      location: { lat: 49.0097, lng: 2.5479 },
      elevation_ft: 392,
      type: 'large_airport'
    },
    {
      iata_code: 'FRA',
      icao_code: 'EDDF',
      name: 'Frankfurt Airport',
      city: 'Frankfurt',
      country: 'DE',
      location: { lat: 50.0379, lng: 8.5622 },
      elevation_ft: 364,
      type: 'large_airport'
    }
  ]
};

// 最寄り空港を検索
async function findNearestAirports(place: Place, maxDistance: number = 100): Promise<Airport[]> {
  const { lat, lng } = place.location;
  
  // まずAPIから取得を試行
  let airports = await fetchAirportsFromAPI(lat, lng, maxDistance);
  
  // APIが失敗した場合、静的データから検索
  if (airports.length === 0) {
    const countryCode = estimateCountryCode(lat, lng);
    const countryAirports = MAJOR_AIRPORTS[countryCode] || [];
    
    // 全主要空港から距離計算
    const allMajorAirports = Object.values(MAJOR_AIRPORTS).flat();
    const nearbyAirports = allMajorAirports
      .map(airport => ({
        ...airport,
        distance: haversineDistance(lat, lng, airport.location.lat, airport.location.lng)
      }))
      .filter(airport => airport.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
    
    airports = nearbyAirports;
  }
  
  return airports.filter(airport => 
    airport.type === 'large_airport' || 
    airport.type === 'medium_airport'
  );
}

// 最適な空港ペアを選択
function selectOptimalAirportPair(
  departurePlace: Place,
  arrivalPlace: Place,
  departureAirports: Airport[],
  arrivalAirports: Airport[]
): { departure: Airport; arrival: Airport } | null {
  let bestPair = null;
  let bestScore = -1;
  
  for (const depAirport of departureAirports) {
    for (const arrAirport of arrivalAirports) {
      // 同じ空港は除外
      if (depAirport.iata_code === arrAirport.iata_code) continue;
      
      // 距離スコア計算
      const depToAirportDist = haversineDistance(
        departurePlace.location.lat,
        departurePlace.location.lng,
        depAirport.location.lat,
        depAirport.location.lng
      );
      
      const airportToArrDist = haversineDistance(
        arrAirport.location.lat,
        arrAirport.location.lng,
        arrivalPlace.location.lat,
        arrivalPlace.location.lng
      );
      
      const airportDistance = haversineDistance(
        depAirport.location.lat,
        depAirport.location.lng,
        arrAirport.location.lat,
        arrAirport.location.lng
      );
      
      // スコア計算（空港間距離を重視、アクセス距離は最小化）
      const score = airportDistance / (1 + depToAirportDist + airportToArrDist);
      
      if (score > bestScore) {
        bestScore = score;
        bestPair = { departure: depAirport, arrival: arrAirport };
      }
    }
  }
  
  return bestPair;
}

// ルートに空港を挿入
function insertAirportsIntoRoute(
  places: Place[],
  flightSegments: Array<{
    from_place: Place;
    to_place: Place;
    departure_airport: Airport;
    arrival_airport: Airport;
    distance_km: number;
  }>
): Array<Place | Airport> {
  const routeWithAirports: Array<Place | Airport> = [];
  
  for (let i = 0; i < places.length; i++) {
    routeWithAirports.push(places[i]);
    
    // 次の場所への飛行機移動があるかチェック
    if (i < places.length - 1) {
      const segment = flightSegments.find(seg => 
        seg.from_place.id === places[i].id && 
        seg.to_place.id === places[i + 1].id
      );
      
      if (segment) {
        // 出発空港と到着空港を挿入
        routeWithAirports.push({
          ...segment.departure_airport,
          inserted_at: i + 0.5
        });
        routeWithAirports.push({
          ...segment.arrival_airport,
          inserted_at: i + 0.7
        });
      }
    }
  }
  
  return routeWithAirports;
}

// 空港タイプの判定
function getAirportType(airport: Airport): string {
  if (airport.type === 'large_airport') return 'International';
  if (airport.type === 'medium_airport') return 'Regional';
  if (airport.type === 'small_airport') return 'Local';
  return 'Unknown';
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { trip_id, selected_places, transport_decisions }: DetectAirportsRequest = await req.json();

    console.log(`Starting airport detection for trip ${trip_id}`);
    console.log(`Processing ${selected_places.length} places and ${transport_decisions.length} transport decisions`);

    // Step 6: 飛行機移動が必要なセグメントを特定
    const flightSegments = transport_decisions.filter(decision => decision.mode === 'flight');
    console.log(`Found ${flightSegments.length} flight segments`);

    if (flightSegments.length === 0) {
      // 飛行機移動がない場合
      const result: AirportDetectionResult = {
        detected_airports: [],
        flight_segments: [],
        route_with_airports: selected_places
      };

      // データベースに結果を保存
      const { error: saveError } = await supabaseClient
        .from('trip_optimization_results')
        .upsert({
          trip_id,
          step: 'detect_airports',
          result,
          created_at: new Date().toISOString()
        });

      if (saveError) {
        console.error('Error saving airport detection results:', saveError);
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 6: 各飛行機セグメントの空港を検出
    const detectedFlightSegments = [];
    const allDetectedAirports: Airport[] = [];

    for (const segment of flightSegments) {
      console.log(`Processing flight segment: ${segment.from} -> ${segment.to}`);
      
      // 出発地と到着地の場所を特定
      const fromPlace = selected_places.find(p => p.id === segment.from);
      const toPlace = selected_places.find(p => p.id === segment.to);
      
      if (!fromPlace || !toPlace) {
        console.log(`Places not found for segment: ${segment.from} -> ${segment.to}`);
        continue;
      }

      // 各場所の最寄り空港を検索
      const departureAirports = await findNearestAirports(fromPlace, 150);
      const arrivalAirports = await findNearestAirports(toPlace, 150);
      
      console.log(`Found ${departureAirports.length} departure airports, ${arrivalAirports.length} arrival airports`);

      if (departureAirports.length === 0 || arrivalAirports.length === 0) {
        console.log(`Insufficient airports found for ${fromPlace.name} -> ${toPlace.name}`);
        continue;
      }

      // 最適な空港ペアを選択
      const airportPair = selectOptimalAirportPair(fromPlace, toPlace, departureAirports, arrivalAirports);
      
      if (airportPair) {
        const flightDistance = haversineDistance(
          airportPair.departure.location.lat,
          airportPair.departure.location.lng,
          airportPair.arrival.location.lat,
          airportPair.arrival.location.lng
        );

        detectedFlightSegments.push({
          from_place: fromPlace,
          to_place: toPlace,
          departure_airport: airportPair.departure,
          arrival_airport: airportPair.arrival,
          distance_km: flightDistance
        });

        // 重複を避けて空港を追加
        if (!allDetectedAirports.find(a => a.iata_code === airportPair.departure.iata_code)) {
          allDetectedAirports.push(airportPair.departure);
        }
        if (!allDetectedAirports.find(a => a.iata_code === airportPair.arrival.iata_code)) {
          allDetectedAirports.push(airportPair.arrival);
        }

        console.log(`Selected airports: ${airportPair.departure.name} (${airportPair.departure.iata_code}) -> ${airportPair.arrival.name} (${airportPair.arrival.iata_code})`);
      }
    }

    // Step 7: ルートに空港を挿入
    const routeWithAirports = insertAirportsIntoRoute(selected_places, detectedFlightSegments);

    console.log(`Airport detection completed: ${allDetectedAirports.length} airports detected for ${detectedFlightSegments.length} flight segments`);

    const result: AirportDetectionResult = {
      detected_airports: allDetectedAirports,
      flight_segments: detectedFlightSegments,
      route_with_airports: routeWithAirports
    };

    // データベースに結果を保存
    const { error: saveError } = await supabaseClient
      .from('trip_optimization_results')
      .upsert({
        trip_id,
        step: 'detect_airports',
        result,
        created_at: new Date().toISOString()
      });

    if (saveError) {
      console.error('Error saving airport detection results:', saveError);
    }

    // 詳細ログ出力
    console.log('=== Airport Detection Summary ===');
    console.log(`Total airports detected: ${allDetectedAirports.length}`);
    allDetectedAirports.forEach(airport => {
      console.log(`- ${airport.name} (${airport.iata_code}) - ${getAirportType(airport)}`);
    });
    console.log(`Flight segments: ${detectedFlightSegments.length}`);
    detectedFlightSegments.forEach(seg => {
      console.log(`- ${seg.from_place.name} -> ${seg.to_place.name} via ${seg.departure_airport.iata_code}-${seg.arrival_airport.iata_code} (${seg.distance_km.toFixed(0)}km)`);
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in detect-airports-airportdb:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        step: 'detect_airports',
        details: 'Failed to detect airports using AirportDB'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});