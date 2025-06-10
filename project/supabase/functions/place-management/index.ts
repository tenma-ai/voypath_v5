import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlaceCreateRequest {
  trip_id: string;
  name: string;
  category: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  wish_level: number; // 1-5
  stay_duration_minutes: number;
  price_level?: number; // 1-4
  estimated_cost?: number;
  opening_hours?: Record<string, any>;
  image_url?: string;
  visit_date?: string;
  preferred_time_slots?: string[];
  notes?: string;
  tags?: string[];
  external_id?: string; // Google Places ID等
  country_hint?: string; // 地理的検証用の国コード
}

interface PlaceUpdateRequest {
  place_id: string;
  name?: string;
  category?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  wish_level?: number;
  stay_duration_minutes?: number;
  price_level?: number;
  estimated_cost?: number;
  opening_hours?: Record<string, any>;
  image_url?: string;
  visit_date?: string;
  preferred_time_slots?: string[];
  notes?: string;
  tags?: string[];
}

interface PlaceSearchRequest {
  trip_id?: string;
  query?: string;
  category?: string;
  min_rating?: number;
  max_rating?: number;
  min_price_level?: number;
  max_price_level?: number;
  min_wish_level?: number;
  max_wish_level?: number;
  has_coordinates?: boolean;
  scheduled?: boolean;
  user_id?: string;
  latitude?: number;
  longitude?: number;
  radius_km?: number;
  tags?: string[];
  limit?: number;
  offset?: number;
  sort_by?: 'created_at' | 'wish_level' | 'rating' | 'name' | 'distance';
  sort_order?: 'asc' | 'desc';
}

interface PlaceListRequest {
  list_type: 'trip' | 'user' | 'all_user_trips';
  trip_id?: string;
  target_user_id?: string;
  category?: string;
  min_rating?: number;
  max_rating?: number;
  min_wish_level?: number;
  max_wish_level?: number;
  scheduled?: boolean;
  has_coordinates?: boolean;
  date_range?: {
    start_date?: string;
    end_date?: string;
  };
  tags?: string[];
  sort_by?: 'created_at' | 'wish_level' | 'rating' | 'name' | 'trip_name' | 'visit_date';
  sort_order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  include_statistics?: boolean;
  include_trip_info?: boolean;
}

interface PlaceRatingRequest {
  place_id: string;
  rating: number; // 1.0 to 5.0
  review_text?: string;
  categories?: string[]; // e.g., ['food', 'atmosphere', 'service']
  is_anonymous?: boolean;
}

interface PlaceRatingUpdateRequest {
  place_id: string;
  rating?: number;
  review_text?: string;
  categories?: string[];
  is_anonymous?: boolean;
}

interface PlaceRatingStatsRequest {
  place_id?: string;
  trip_id?: string;
  category?: string;
  min_rating?: number;
  max_rating?: number;
  include_reviews?: boolean;
  include_rating_distribution?: boolean;
  include_categories_breakdown?: boolean;
}

interface PlaceRecommendationRequest {
  trip_id: string;
  limit?: number; // Default: 10
  category?: string;
  location?: {
    latitude: number;
    longitude: number;
    radius_km?: number; // Default: 5km
  };
  price_level?: number; // 1-4
  include_external?: boolean; // Include external API suggestions
  recommendation_type?: 'individual' | 'team' | 'hybrid'; // Default: 'hybrid'
  exclude_existing?: boolean; // Exclude already added places
}

interface RecommendedPlace {
  place_name: string;
  category: string;
  predicted_rating: number;
  recommendation_reason: string;
  confidence_score: number;
  source: 'internal' | 'external' | 'hybrid';
  external_data?: {
    place_id?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    price_level?: number;
    rating?: number;
    user_ratings_total?: number;
    photos?: string[];
  };
  recommendation_factors: {
    category_preference: number;
    team_compatibility: number;
    popularity_score: number;
    location_relevance: number;
    price_match: number;
  };
}

// TODO-079: Place Image Management interfaces
interface PlaceImageUploadRequest {
  place_id: string;
  image_data: string; // Base64 encoded image data
  image_name?: string;
  image_description?: string;
  is_primary?: boolean; // Set as primary image for the place
}

interface PlaceImageUpdateRequest {
  image_id: string;
  place_id: string;
  image_name?: string;
  image_description?: string;
  is_primary?: boolean;
}

interface PlaceImageListRequest {
  place_id?: string;
  trip_id?: string;
  user_id?: string;
  limit?: number;
  offset?: number;
  include_metadata?: boolean;
}

interface PlaceImageDeleteRequest {
  image_id: string;
  place_id: string;
}

// TODO-080: Place Statistics API interfaces
interface PlaceStatsRequest {
  stats_type: 'trip' | 'user' | 'global' | 'category' | 'popularity';
  trip_id?: string;
  user_id?: string;
  category?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  include_details?: boolean;
  time_range?: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

interface PlaceStatsResponse {
  success: boolean;
  stats: {
    summary: PlaceStatsSummary;
    category_breakdown?: CategoryStatsBreakdown[];
    popularity_ranking?: PopularityRanking[];
    time_series?: TimeSeriesStats[];
    details?: PlaceStatsDetails;
  };
  metadata: {
    generated_at: string;
    stats_type: string;
    data_range: {
      start_date?: string;
      end_date?: string;
      total_records: number;
    };
  };
}

interface PlaceStatsSummary {
  total_places: number;
  total_trips: number;
  total_users: number;
  average_wish_level: number;
  average_rating: number;
  most_popular_category: string;
  total_estimated_cost: number;
  total_stay_duration_hours: number;
}

interface CategoryStatsBreakdown {
  category: string;
  place_count: number;
  percentage: number;
  average_wish_level: number;
  average_rating: number;
  average_cost: number;
  total_stay_duration: number;
}

interface PopularityRanking {
  rank: number;
  place_id: string;
  place_name: string;
  category: string;
  popularity_score: number;
  total_added_count: number;
  average_wish_level: number;
  average_rating: number;
  recent_trend: 'rising' | 'stable' | 'declining';
}

interface TimeSeriesStats {
  date: string;
  total_places_added: number;
  unique_users: number;
  popular_categories: string[];
  average_wish_level: number;
}

interface PlaceStatsDetails {
  geographic_distribution?: GeographicStats;
  user_engagement?: UserEngagementStats;
  cost_analysis?: CostAnalysisStats;
  temporal_patterns?: TemporalPatternStats;
}

interface GeographicStats {
  total_coordinates: number;
  coverage_area_km2: number;
  center_point: { latitude: number; longitude: number };
  geographic_spread: number;
}

interface UserEngagementStats {
  active_users: number;
  average_places_per_user: number;
  power_users: number; // users with >10 places
  engagement_score: number;
}

interface CostAnalysisStats {
  total_estimated_cost: number;
  average_cost_per_place: number;
  cost_distribution_by_level: { level: number; count: number; percentage: number }[];
  budget_friendly_percentage: number;
}

interface TemporalPatternStats {
  peak_adding_hours: number[];
  seasonal_trends: { season: string; activity_level: number }[];
  most_active_day_of_week: string;
}

// Opening Hours Management Interfaces
interface OpeningHours {
  [key: string]: DayHours; // Key is day number (0-6) as string
}

interface DayHours {
  is_closed: boolean;
  open_time: string | null; // "HH:MM" format
  close_time: string | null; // "HH:MM" format
  breaks?: TimeBreak[]; // Optional lunch breaks, etc.
}

interface TimeBreak {
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
  break_type: 'lunch' | 'maintenance' | 'other';
}

interface SpecialHours {
  date: string; // YYYY-MM-DD
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
  reason: string; // Holiday, special event, etc.
  breaks?: TimeBreak[];
}

interface PlaceHoursRequest {
  place_id: string;
  opening_hours: OpeningHours;
  special_hours?: SpecialHours[];
  timezone?: string; // e.g., "Asia/Tokyo"
  auto_detect_holidays?: boolean;
}

interface PlaceHoursResponse {
  place_id: string;
  opening_hours: OpeningHours;
  special_hours: SpecialHours[];
  timezone: string;
  is_open_now: boolean;
  next_status_change: {
    time: string;
    status: 'open' | 'closed';
  } | null;
  validation_errors?: string[];
}

interface HoursValidationRequest {
  opening_hours: OpeningHours;
  special_hours?: SpecialHours[];
  check_overlaps?: boolean;
  check_time_format?: boolean;
  check_logical_order?: boolean;
}

interface HoursValidationResponse {
  is_valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}

interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  day?: number;
  time?: string;
}

interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

interface HoursConflictRequest {
  trip_id: string;
  target_date: string; // YYYY-MM-DD
  time_range?: {
    start_time: string; // "HH:MM"
    end_time: string; // "HH:MM"
  };
}

interface HoursConflictResponse {
  has_conflicts: boolean;
  conflicts: PlaceConflict[];
  recommendations: string[];
  alternative_times?: string[];
}

interface PlaceConflict {
  place_id: string;
  place_name: string;
  conflict_type: 'closed' | 'limited_hours' | 'busy_period';
  details: string;
  suggested_time?: string;
}

// External API Integration Interfaces and Functions
interface GooglePlacesSearchRequest {
  query: string;
  location?: { lat: number; lng: number };
  radius?: number; // meters
  type?: string; // restaurant, tourist_attraction, etc.
  language?: string;
  region?: string;
}

interface GooglePlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: { lat: number; lng: number };
  };
  rating?: number;
  price_level?: number;
  types: string[];
  opening_hours?: {
    open_now: boolean;
    periods?: Array<{
      open: { day: number; time: string };
      close: { day: number; time: string };
    }>;
  };
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  reviews?: Array<{
    rating: number;
    text: string;
    time: number;
  }>;
}

interface PexelsImageResponse {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  photographer_id: number;
  avg_color: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
  alt: string;
}

interface ExternalAPIResponse {
  success: boolean;
  data?: any;
  error?: string;
  source: 'google_places' | 'pexels';
  quota_used?: boolean;
  cached?: boolean;
}

// Google Places API Integration
async function searchGooglePlaces(request: GooglePlacesSearchRequest): Promise<ExternalAPIResponse> {
  const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
  
  if (!apiKey) {
    return {
      success: false,
      error: 'Google Places API key not configured',
      source: 'google_places'
    };
  }

  try {
    // Text Search API
    const searchParams = new URLSearchParams({
      query: request.query,
      key: apiKey
    });

    if (request.location) {
      searchParams.append('location', `${request.location.lat},${request.location.lng}`);
      searchParams.append('radius', (request.radius || 5000).toString());
    }

    if (request.type) {
      searchParams.append('type', request.type);
    }

    if (request.language) {
      searchParams.append('language', request.language);
    }

    if (request.region) {
      searchParams.append('region', request.region);
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?${searchParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (!response.ok || data.status !== 'OK') {
      return {
        success: false,
        error: data.error_message || `Google Places API error: ${data.status}`,
        source: 'google_places',
        quota_used: data.status === 'OVER_QUERY_LIMIT'
      };
    }

    return {
      success: true,
      data: data.results,
      source: 'google_places'
    };

  } catch (error) {
    return {
      success: false,
      error: `Google Places API request failed: ${error.message}`,
      source: 'google_places'
    };
  }
}

async function getGooglePlaceDetails(placeId: string): Promise<ExternalAPIResponse> {
  const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
  
  if (!apiKey) {
    return {
      success: false,
      error: 'Google Places API key not configured',
      source: 'google_places'
    };
  }

  try {
    const fields = [
      'place_id',
      'name',
      'formatted_address',
      'geometry',
      'rating',
      'price_level',
      'types',
      'opening_hours',
      'photos',
      'reviews'
    ].join(',');

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (!response.ok || data.status !== 'OK') {
      return {
        success: false,
        error: data.error_message || `Google Places Details API error: ${data.status}`,
        source: 'google_places',
        quota_used: data.status === 'OVER_QUERY_LIMIT'
      };
    }

    return {
      success: true,
      data: data.result,
      source: 'google_places'
    };

  } catch (error) {
    return {
      success: false,
      error: `Google Places Details API request failed: ${error.message}`,
      source: 'google_places'
    };
  }
}

// Pexels API Integration
async function searchPexelsImages(query: string, count: number = 5): Promise<ExternalAPIResponse> {
  const apiKey = Deno.env.get('PEXELS_API_KEY');
  
  if (!apiKey) {
    return {
      success: false,
      error: 'Pexels API key not configured',
      source: 'pexels'
    };
  }

  try {
    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
      {
        method: 'GET',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: `Pexels API error: ${response.status} ${response.statusText}`,
        source: 'pexels'
      };
    }

    return {
      success: true,
      data: data.photos || [],
      source: 'pexels'
    };

  } catch (error) {
    return {
      success: false,
      error: `Pexels API request failed: ${error.message}`,
      source: 'pexels'
    };
  }
}

// External Data Normalization Functions
function normalizeGooglePlaceToVoypath(googlePlace: any): Partial<PlaceCreateRequest> {
  const categories = mapGoogleTypesToCategories(googlePlace.types || []);
  
  return {
    name: googlePlace.name,
    category: categories[0] || 'other',
    address: googlePlace.formatted_address,
    latitude: googlePlace.geometry?.location?.lat,
    longitude: googlePlace.geometry?.location?.lng,
    rating: googlePlace.rating,
    price_level: googlePlace.price_level,
    opening_hours: normalizeGoogleOpeningHours(googlePlace.opening_hours),
    external_id: googlePlace.place_id,
    tags: categories
  };
}

function mapGoogleTypesToCategories(googleTypes: string[]): string[] {
  const typeMapping: Record<string, string> = {
    'restaurant': 'restaurant',
    'food': 'restaurant',
    'meal_takeaway': 'restaurant',
    'tourist_attraction': 'attraction',
    'museum': 'museum',
    'park': 'park',
    'amusement_park': 'entertainment',
    'zoo': 'entertainment',
    'shopping_mall': 'shopping',
    'store': 'shopping',
    'lodging': 'accommodation',
    'hospital': 'medical',
    'pharmacy': 'medical',
    'gas_station': 'transport',
    'train_station': 'transport',
    'bus_station': 'transport',
    'airport': 'transport',
    'bank': 'business',
    'atm': 'business',
    'church': 'religious',
    'mosque': 'religious',
    'synagogue': 'religious',
    'temple': 'religious',
    'school': 'education',
    'university': 'education',
    'library': 'education',
    'gym': 'fitness',
    'spa': 'wellness',
    'beauty_salon': 'wellness',
    'movie_theater': 'entertainment',
    'night_club': 'nightlife',
    'bar': 'nightlife',
    'cafe': 'cafe'
  };

  const categories: string[] = [];
  
  for (const googleType of googleTypes) {
    if (typeMapping[googleType]) {
      categories.push(typeMapping[googleType]);
    }
  }
  
  return categories.length > 0 ? [...new Set(categories)] : ['other'];
}

function normalizeGoogleOpeningHours(googleHours: any): Record<string, any> | undefined {
  if (!googleHours || !googleHours.periods) {
    return undefined;
  }

  const normalized: Record<string, any> = {};

  for (let day = 0; day < 7; day++) {
    const dayPeriods = googleHours.periods.filter((period: any) => period.open.day === day);
    
    if (dayPeriods.length === 0) {
      normalized[day] = {
        is_closed: true,
        open_time: null,
        close_time: null
      };
    } else {
      const period = dayPeriods[0]; // Take first period for simplicity
      normalized[day] = {
        is_closed: false,
        open_time: formatTimeFromGoogle(period.open.time),
        close_time: period.close ? formatTimeFromGoogle(period.close.time) : '23:59'
      };
    }
  }

  return normalized;
}

function formatTimeFromGoogle(googleTime: string): string {
  // Google time format: "0900" -> "09:00"
  if (googleTime.length === 4) {
    return `${googleTime.substring(0, 2)}:${googleTime.substring(2, 4)}`;
  }
  return googleTime;
}

// API Rate Limiting and Management
interface APIQuotaManager {
  google_places: {
    daily_quota: number;
    used_today: number;
    last_reset: string;
  };
  pexels: {
    monthly_quota: number;
    used_this_month: number;
    last_reset: string;
  };
}

async function checkAPIQuota(apiType: 'google_places' | 'pexels', supabase: any): Promise<boolean> {
  // Get or create quota record
  const { data: quota, error } = await supabase
    .from('api_quotas')
    .select('*')
    .eq('api_type', apiType)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error checking API quota:', error);
    return false; // Conservative approach - deny if quota check fails
  }

  const now = new Date();
  const quotaLimits = {
    google_places: { daily_limit: 1000, reset_period: 'daily' },
    pexels: { monthly_limit: 20000, reset_period: 'monthly' }
  };

  if (!quota) {
    // Create initial quota record
    await supabase
      .from('api_quotas')
      .insert({
        api_type: apiType,
        used_count: 0,
        last_reset: now.toISOString(),
        quota_limit: quotaLimits[apiType].daily_limit || quotaLimits[apiType].monthly_limit
      });
    return true;
  }

  // Check if quota needs reset
  const lastReset = new Date(quota.last_reset);
  const needsReset = quotaLimits[apiType].reset_period === 'daily' 
    ? now.getDate() !== lastReset.getDate() || now.getMonth() !== lastReset.getMonth()
    : now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear();

  if (needsReset) {
    await supabase
      .from('api_quotas')
      .update({
        used_count: 0,
        last_reset: now.toISOString()
      })
      .eq('api_type', apiType);
    return true;
  }

  // Check if under quota
  return quota.used_count < quota.quota_limit;
}

async function incrementAPIUsage(apiType: 'google_places' | 'pexels', supabase: any): Promise<void> {
  await supabase
    .from('api_quotas')
    .update({
      used_count: supabase.raw('used_count + 1'),
      last_used: new Date().toISOString()
    })
    .eq('api_type', apiType);
}

serve(async (req) => {
  // CORS対応
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Supabase クライアント初期化
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // 認証確認
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    const url = new URL(req.url);
    const method = req.method;
    const pathSegments = url.pathname.split('/').filter(Boolean);

    // ルーティング
    switch (method) {
      case 'POST':
        if (pathSegments.length >= 2 && pathSegments[1] === 'rating') {
          // POST /place-management/rating (場所評価追加)
          return await handleCreatePlaceRating(req, supabaseClient, user.id);
        } else if (pathSegments.length >= 2 && pathSegments[1] === 'images') {
          // POST /place-management/images (画像アップロード)
          return await handleUploadPlaceImage(req, supabaseClient, user.id);
        } else if (pathSegments.length >= 2 && pathSegments[1] === 'hours') {
          // POST /place-management/hours (営業時間設定)
          return await handleSetPlaceHours(req, supabaseClient, user.id);
        } else if (pathSegments.length >= 2 && pathSegments[1] === 'sync') {
          if (pathSegments.length >= 3) {
            if (pathSegments[2] === 'force') {
              // POST /place-management/sync/force (強制同期実行)
              return await handleForceSynchronization(req, supabaseClient, user.id);
            } else if (pathSegments[2] === 'resolve') {
              // POST /place-management/sync/resolve (競合解決)
              return await handleResolveSyncConflicts(req, supabaseClient, user.id);
            } else if (pathSegments[2] === 'validate') {
              // POST /place-management/sync/validate (同期検証)
              return await handleValidateSyncData(req, supabaseClient, user.id);
            }
          }
        } else {
          return await handleCreatePlace(req, supabaseClient, user.id);
        }
      
      case 'GET':
        if (pathSegments.length >= 2) {
          if (pathSegments[1] === 'search') {
            // GET /place-management/search (場所検索)
            return await handleSearchPlaces(req, supabaseClient, user.id);
          } else if (pathSegments[1] === 'list') {
            // GET /place-management/list (拡張場所一覧)
            return await handlePlacesList(req, supabaseClient, user.id);
          } else if (pathSegments[1] === 'rating') {
            if (pathSegments.length >= 3 && pathSegments[2] === 'stats') {
              // GET /place-management/rating/stats (評価統計)
              return await handleGetRatingStats(req, supabaseClient, user.id);
            } else {
              // GET /place-management/rating?place_id={place_id} (場所評価一覧)
              return await handleGetPlaceRatings(req, supabaseClient, user.id);
            }
          } else if (pathSegments[1] === 'recommend') {
            // GET /place-management/recommend (場所推薦)
            return await handleGetPlaceRecommendations(req, supabaseClient, user.id);
          } else if (pathSegments[1] === 'images') {
            // GET /place-management/images (画像一覧取得)
            return await handleGetPlaceImages(req, supabaseClient, user.id);
          } else if (pathSegments[1] === 'stats') {
            // GET /place-management/stats (場所統計)
            return await handleGetPlaceStats(req, supabaseClient, user.id);
          } else if (pathSegments[1] === 'external') {
            if (pathSegments.length >= 3) {
              if (pathSegments[2] === 'google-search') {
                // GET /place-management/external/google-search (Google Places検索)
                return await handleGooglePlacesSearch(req, supabaseClient, user.id);
              } else if (pathSegments[2] === 'google-details') {
                // GET /place-management/external/google-details (Google Places詳細)
                return await handleGooglePlaceDetails(req, supabaseClient, user.id);
              } else if (pathSegments[2] === 'pexels-images') {
                // GET /place-management/external/pexels-images (Pexels画像検索)
                return await handlePexelsImageSearch(req, supabaseClient, user.id);
              }
            }
          } else if (pathSegments[1] === 'hours') {
            if (pathSegments.length >= 3) {
              if (pathSegments[2] === 'validate') {
                // GET /place-management/hours/validate (営業時間検証)
                return await handleValidateOpeningHours(req, supabaseClient, user.id);
              } else if (pathSegments[2] === 'conflicts') {
                // GET /place-management/hours/conflicts (営業時間競合チェック)
                return await handleCheckHoursConflicts(req, supabaseClient, user.id);
              }
            } else {
              // GET /place-management/hours?place_id={place_id} (営業時間取得)
              return await handleGetPlaceHours(req, supabaseClient, user.id);
            }
          } else if (pathSegments[1] === 'geo') {
            if (pathSegments.length >= 3) {
              if (pathSegments[2] === 'search') {
                // GET /place-management/geo/search (最適化地理的検索)
                return await handleOptimizedGeographicSearch(req, supabaseClient, user.id);
              } else if (pathSegments[2] === 'viewport') {
                // GET /place-management/geo/viewport (ビューポート検索)
                return await handleViewportSearch(req, supabaseClient, user.id);
              } else if (pathSegments[2] === 'clusters') {
                // GET /place-management/geo/clusters (地理的クラスタリング)
                return await handleGeographicClustering(req, supabaseClient, user.id);
              }
            }
          } else if (pathSegments[1] === 'sync') {
            if (pathSegments.length >= 3) {
              if (pathSegments[2] === 'status') {
                // GET /place-management/sync/status (同期状況確認)
                return await handleGetSyncStatus(req, supabaseClient, user.id);
              } else if (pathSegments[2] === 'integrity') {
                // GET /place-management/sync/integrity (データ整合性チェック)
                return await handleCheckDataIntegrity(req, supabaseClient, user.id);
              } else if (pathSegments[2] === 'conflicts') {
                // GET /place-management/sync/conflicts (同期競合検出)
                return await handleDetectSyncConflicts(req, supabaseClient, user.id);
              } else if (pathSegments[2] === 'stats') {
                // GET /place-management/sync/stats (同期統計)
                return await handleGetSyncStats(req, supabaseClient, user.id);
              }
            }
            }
          } else {
            // GET /place-management/{place_id}
            const placeId = pathSegments[1];
            return await handleGetPlace(supabaseClient, user.id, placeId);
          }
        } else {
          // GET /place-management?trip_id={trip_id} (旅行の場所一覧)
          const tripId = url.searchParams.get('trip_id');
          if (!tripId) {
            throw new Error('trip_id parameter is required');
          }
          return await handleGetTripPlaces(supabaseClient, user.id, tripId);
        }
      
      case 'PUT':
        if (pathSegments.length >= 2 && pathSegments[1] === 'rating') {
          // PUT /place-management/rating (場所評価更新)
          return await handleUpdatePlaceRating(req, supabaseClient, user.id);
        } else if (pathSegments.length >= 2 && pathSegments[1] === 'images') {
          // PUT /place-management/images (画像情報更新)
          return await handleUpdatePlaceImage(req, supabaseClient, user.id);
        } else if (pathSegments.length >= 2 && pathSegments[1] === 'hours') {
          // PUT /place-management/hours (営業時間更新)
          return await handleUpdatePlaceHours(req, supabaseClient, user.id);
        } else {
          return await handleUpdatePlace(req, supabaseClient, user.id);
        }
      
      case 'DELETE':
        if (pathSegments.length >= 2) {
          if (pathSegments[1] === 'rating') {
            // DELETE /place-management/rating?place_id={place_id} (場所評価削除)
            return await handleDeletePlaceRating(req, supabaseClient, user.id);
          } else if (pathSegments[1] === 'images') {
            // DELETE /place-management/images (画像削除)
            return await handleDeletePlaceImage(req, supabaseClient, user.id);
          } else {
            const placeId = pathSegments[1];
            return await handleDeletePlace(supabaseClient, user.id, placeId);
          }
        } else {
          throw new Error('Place ID is required for deletion');
        }
      
      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 405,
          }
        );
    }
  } catch (error) {
    console.error('Place Management Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

async function handleCreatePlace(req: Request, supabase: any, userId: string) {
  const requestData: PlaceCreateRequest = await req.json();
  
  // 必須フィールドバリデーション
  if (!requestData.trip_id || !requestData.name || !requestData.category || 
      !requestData.wish_level || !requestData.stay_duration_minutes) {
    throw new Error('trip_id, name, category, wish_level, and stay_duration_minutes are required');
  }

  // 希望度レベル検証 (1-5)
  if (requestData.wish_level < 1 || requestData.wish_level > 5) {
    throw new Error('wish_level must be between 1 and 5');
  }

  // 滞在時間検証 (正の数)
  if (requestData.stay_duration_minutes <= 0) {
    throw new Error('stay_duration_minutes must be positive');
  }

  // 地理座標のバリデーション
  if (requestData.latitude !== undefined || requestData.longitude !== undefined) {
    if (requestData.latitude === undefined || requestData.longitude === undefined) {
      throw new Error('Both latitude and longitude must be provided together');
    }
    
    if (requestData.latitude < -90 || requestData.latitude > 90) {
      throw new Error('Latitude must be between -90 and 90');
    }
    
    if (requestData.longitude < -180 || requestData.longitude > 180) {
      throw new Error('Longitude must be between -180 and 180');
    }
  }

  // 評価の範囲チェック
  if (requestData.rating !== undefined && (requestData.rating < 0 || requestData.rating > 5)) {
    throw new Error('Rating must be between 0 and 5');
  }

  // 価格レベルの範囲チェック  
  if (requestData.price_level !== undefined && (requestData.price_level < 1 || requestData.price_level > 4)) {
    throw new Error('Price level must be between 1 and 4');
  }

  // 旅行メンバーシップと場所追加権限確認
  const { data: membership, error: memberError } = await supabase
    .from('trip_members')
    .select('can_add_places')
    .eq('trip_id', requestData.trip_id)
    .eq('user_id', userId)
    .single();

  if (memberError || !membership) {
    return new Response(
      JSON.stringify({ error: 'You are not a member of this trip' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      }
    );
  }

  if (!membership.can_add_places) {
    return new Response(
      JSON.stringify({ error: 'You do not have permission to add places to this trip' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      }
    );
  }

  // 訪問日検証（指定された場合）
  if (requestData.visit_date) {
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('start_date, end_date')
      .eq('id', requestData.trip_id)
      .single();

    if (tripError) {
      throw new Error(`Failed to validate trip dates: ${tripError.message}`);
    }

    const visitDate = new Date(requestData.visit_date);
    const startDate = new Date(trip.start_date);
    const endDate = new Date(trip.end_date);

    if (visitDate < startDate || visitDate > endDate) {
      throw new Error('visit_date must be within the trip duration');
    }
  }

  // 重複チェック機能
  await performDuplicateChecks(requestData, supabase);

  // 場所データ準備
  let placeData: any = {
    trip_id: requestData.trip_id,
    user_id: userId,
    name: requestData.name.trim(),
    category: requestData.category,
    wish_level: requestData.wish_level,
    stay_duration_minutes: requestData.stay_duration_minutes,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // オプショナルフィールドの追加
  if (requestData.address) placeData.address = requestData.address.trim();
  if (requestData.latitude !== undefined && requestData.longitude !== undefined) {
    placeData.latitude = requestData.latitude;
    placeData.longitude = requestData.longitude;
  }
  if (requestData.rating !== undefined) placeData.rating = requestData.rating;
  if (requestData.price_level !== undefined) placeData.price_level = requestData.price_level;
  if (requestData.estimated_cost !== undefined) placeData.estimated_cost = requestData.estimated_cost;
  if (requestData.opening_hours) placeData.opening_hours = requestData.opening_hours;
  if (requestData.image_url) placeData.image_url = requestData.image_url;
  if (requestData.visit_date) placeData.visit_date = requestData.visit_date;
  if (requestData.preferred_time_slots) placeData.preferred_time_slots = requestData.preferred_time_slots;
  if (requestData.notes) placeData.notes = requestData.notes.trim();
  if (requestData.tags) placeData.tags = requestData.tags;
  if (requestData.external_id) placeData.external_id = requestData.external_id;

  // 地理情報処理の強化
  placeData = await enhanceGeographicData(placeData, requestData);

  // 場所作成
  const { data: place, error: createError } = await supabase
    .from('places')
    .insert(placeData)
    .select(`
      *,
      user:users(id, name, avatar_url),
      trip:trips(name, destination)
    `)
    .single();

  if (createError) {
    throw new Error(`Failed to create place: ${createError.message}`);
  }

  // 使用状況イベント記録
  await supabase
    .from('usage_events')
    .insert({
      user_id: userId,
      event_type: 'place_added',
      event_category: 'place_management',
      trip_id: requestData.trip_id,
      metadata: {
        place_name: place.name,
        category: place.category,
        wish_level: place.wish_level,
        has_coordinates: !!(requestData.latitude && requestData.longitude),
        visit_date_specified: !!requestData.visit_date,
        has_external_id: !!requestData.external_id,
        has_address: !!requestData.address,
        duplicate_checks_performed: true
      }
    });

  return new Response(
    JSON.stringify({ 
      success: true, 
      place: place,
      message: 'Place added successfully'
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    }
  );
}

async function handleGetTripPlaces(supabase: any, userId: string, tripId: string) {
  // 旅行メンバーシップ確認
  const { data: membership, error: memberError } = await supabase
    .from('trip_members')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .single();

  if (memberError || !membership) {
    return new Response(
      JSON.stringify({ error: 'You are not a member of this trip' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      }
    );
  }

  // 旅行の場所一覧を取得
  const { data: places, error } = await supabase
    .from('places')
    .select(`
      *,
      user:users(id, name, avatar_url, is_premium)
    `)
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch places: ${error.message}`);
  }

  // 統計情報を計算
  const statistics = {
    total_places: places.length,
    places_by_category: places.reduce((acc: any, place: any) => {
      acc[place.category] = (acc[place.category] || 0) + 1;
      return acc;
    }, {}),
    places_by_user: places.reduce((acc: any, place: any) => {
      const userName = place.user.name;
      acc[userName] = (acc[userName] || 0) + 1;
      return acc;
    }, {}),
    avg_wish_level: places.length > 0 
      ? places.reduce((sum: number, place: any) => sum + place.wish_level, 0) / places.length 
      : 0,
    total_estimated_time: places.reduce((sum: number, place: any) => sum + place.stay_duration_minutes, 0),
    places_with_coordinates: places.filter((place: any) => place.latitude && place.longitude).length,
    scheduled_places: places.filter((place: any) => place.scheduled).length
  };

  return new Response(
    JSON.stringify({ 
      success: true, 
      places: places,
      statistics: statistics,
      total_count: places.length
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
}

async function handleGetPlace(supabase: any, userId: string, placeId: string) {
  // 場所詳細を取得（アクセス権限はRLSで制御）
  const { data: place, error } = await supabase
    .from('places')
    .select(`
      *,
      user:users(id, name, avatar_url, is_premium),
      trip:trips(
        id, name, destination, start_date, end_date,
        trip_members!inner(role, can_edit_places)
      )
    `)
    .eq('id', placeId)
    .eq('trip.trip_members.user_id', userId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch place: ${error.message}`);
  }

  // ユーザーの編集権限を確認
  const userMember = place.trip.trip_members.find((member: any) => member.user_id === userId);
  const canEdit = place.user_id === userId || 
                  (userMember && (userMember.role === 'admin' || userMember.can_edit_places));

  // 営業時間情報の詳細化
  const enhancedOperatingHours = await enhanceOperatingHours(place.opening_hours);

  // レビュー情報の取得（模擬データ）
  const reviewsInfo = await getPlaceReviews(placeId, supabase);

  // 関連場所の取得
  const relatedPlaces = await getRelatedPlaces(place, supabase, userId);

  const enrichedPlace = {
    ...place,
    user_permissions: {
      can_edit: canEdit,
      can_delete: place.user_id === userId || (userMember && userMember.role === 'admin'),
      is_owner: place.user_id === userId
    },
    enhanced_operating_hours: enhancedOperatingHours,
    reviews_summary: reviewsInfo,
    related_places: relatedPlaces
  };

  return new Response(
    JSON.stringify({ 
      success: true, 
      place: enrichedPlace
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
}

async function handleUpdatePlace(req: Request, supabase: any, userId: string) {
  const requestData: PlaceUpdateRequest = await req.json();
  
  if (!requestData.place_id) {
    throw new Error('Place ID is required');
  }

  // 場所の存在と編集権限確認
  const { data: place, error: placeError } = await supabase
    .from('places')
    .select(`
      *,
      trip:trips!inner(
        id, start_date, end_date,
        trip_members!inner(role, can_edit_places, user_id)
      )
    `)
    .eq('id', requestData.place_id)
    .eq('trip.trip_members.user_id', userId)
    .single();

  if (placeError || !place) {
    return new Response(
      JSON.stringify({ error: 'Place not found or access denied' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      }
    );
  }

  // 編集権限確認
  const userMember = place.trip.trip_members.find((member: any) => member.user_id === userId);
  const canEdit = place.user_id === userId || 
                  (userMember && (userMember.role === 'admin' || userMember.can_edit_places));

  if (!canEdit) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions to edit this place' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      }
    );
  }

  // 更新データ準備
  const updateData: any = {
    updated_at: new Date().toISOString()
  };

  if (requestData.name) updateData.name = requestData.name;
  if (requestData.category) updateData.category = requestData.category;
  if (requestData.address !== undefined) updateData.address = requestData.address;
  if (requestData.latitude !== undefined) updateData.latitude = requestData.latitude;
  if (requestData.longitude !== undefined) updateData.longitude = requestData.longitude;
  if (requestData.rating !== undefined) updateData.rating = requestData.rating;
  if (requestData.wish_level !== undefined) {
    if (requestData.wish_level < 1 || requestData.wish_level > 5) {
      throw new Error('wish_level must be between 1 and 5');
    }
    updateData.wish_level = requestData.wish_level;
  }
  if (requestData.stay_duration_minutes !== undefined) {
    if (requestData.stay_duration_minutes <= 0) {
      throw new Error('stay_duration_minutes must be positive');
    }
    updateData.stay_duration_minutes = requestData.stay_duration_minutes;
  }
  if (requestData.price_level !== undefined) updateData.price_level = requestData.price_level;
  if (requestData.estimated_cost !== undefined) updateData.estimated_cost = requestData.estimated_cost;
  if (requestData.opening_hours !== undefined) updateData.opening_hours = requestData.opening_hours;
  if (requestData.image_url !== undefined) updateData.image_url = requestData.image_url;
  if (requestData.visit_date !== undefined) {
    if (requestData.visit_date) {
      // 訪問日検証
      const visitDate = new Date(requestData.visit_date);
      const startDate = new Date(place.trip.start_date);
      const endDate = new Date(place.trip.end_date);

      if (visitDate < startDate || visitDate > endDate) {
        throw new Error('visit_date must be within the trip duration');
      }
    }
    updateData.visit_date = requestData.visit_date;
  }
  if (requestData.preferred_time_slots !== undefined) updateData.preferred_time_slots = requestData.preferred_time_slots;
  if (requestData.notes !== undefined) updateData.notes = requestData.notes;
  if (requestData.tags !== undefined) updateData.tags = requestData.tags;

  // 場所更新
  const { data: updatedPlace, error: updateError } = await supabase
    .from('places')
    .update(updateData)
    .eq('id', requestData.place_id)
    .select(`
      *,
      user:users(id, name, avatar_url),
      trip:trips(name, destination)
    `)
    .single();

  if (updateError) {
    throw new Error(`Failed to update place: ${updateError.message}`);
  }

  // 使用状況イベント記録
  await supabase
    .from('usage_events')
    .insert({
      user_id: userId,
      event_type: 'place_updated',
      event_category: 'place_management',
      trip_id: place.trip_id,
      metadata: {
        place_id: requestData.place_id,
        place_name: updatedPlace.name,
        updated_fields: Object.keys(updateData).filter(key => key !== 'updated_at'),
        updated_by_owner: place.user_id === userId
      }
    });

  // 通知機能の実装
  await sendPlaceUpdateNotification(updatedPlace, place.trip_id, userId, Object.keys(updateData).filter(key => key !== 'updated_at'), supabase);

  return new Response(
    JSON.stringify({ 
      success: true, 
      place: updatedPlace,
      message: 'Place updated successfully'
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
}

async function handleDeletePlace(supabase: any, userId: string, placeId: string) {
  // 場所の存在と削除権限確認
  const { data: place, error: placeError } = await supabase
    .from('places')
    .select(`
      *,
      trip:trips!inner(
        trip_members!inner(role, user_id)
      )
    `)
    .eq('id', placeId)
    .eq('trip.trip_members.user_id', userId)
    .single();

  if (placeError || !place) {
    return new Response(
      JSON.stringify({ error: 'Place not found or access denied' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      }
    );
  }

  // 削除権限確認（作成者または管理者のみ）
  const userMember = place.trip.trip_members.find((member: any) => member.user_id === userId);
  const canDelete = place.user_id === userId || (userMember && userMember.role === 'admin');

  if (!canDelete) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions to delete this place' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      }
    );
  }

  // 関連データの事前確認と処理
  const relatedDataInfo = await processRelatedDataBeforeDeletion(placeId, place, supabase);

  // 場所削除
  const { error: deleteError } = await supabase
    .from('places')
    .delete()
    .eq('id', placeId);

  if (deleteError) {
    throw new Error(`Failed to delete place: ${deleteError.message}`);
  }

  // 使用状況イベント記録
  await supabase
    .from('usage_events')
    .insert({
      user_id: userId,
      event_type: 'place_deleted',
      event_category: 'place_management',
      trip_id: place.trip_id,
      metadata: {
        place_id: placeId,
        place_name: place.name,
        category: place.category,
        deleted_by_owner: place.user_id === userId,
        related_data_processed: relatedDataInfo.processedItems,
        had_scheduled_data: relatedDataInfo.hadScheduledData,
        affected_optimization_results: relatedDataInfo.affectedOptimizations
      }
    });

  // 削除通知の送信
  await sendPlaceDeletionNotification(place, userId, relatedDataInfo, supabase);

  return new Response(
    JSON.stringify({ 
      success: true,
      message: 'Place deleted successfully'
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
}

async function handleSearchPlaces(req: Request, supabase: any, userId: string) {
  const url = new URL(req.url);
  
  // クエリパラメータの取得
  const searchParams: PlaceSearchRequest = {
    trip_id: url.searchParams.get('trip_id') || undefined,
    query: url.searchParams.get('query') || undefined,
    category: url.searchParams.get('category') || undefined,
    min_rating: url.searchParams.get('min_rating') ? parseFloat(url.searchParams.get('min_rating')!) : undefined,
    max_rating: url.searchParams.get('max_rating') ? parseFloat(url.searchParams.get('max_rating')!) : undefined,
    min_price_level: url.searchParams.get('min_price_level') ? parseInt(url.searchParams.get('min_price_level')!) : undefined,
    max_price_level: url.searchParams.get('max_price_level') ? parseInt(url.searchParams.get('max_price_level')!) : undefined,
    min_wish_level: url.searchParams.get('min_wish_level') ? parseInt(url.searchParams.get('min_wish_level')!) : undefined,
    max_wish_level: url.searchParams.get('max_wish_level') ? parseInt(url.searchParams.get('max_wish_level')!) : undefined,
    has_coordinates: url.searchParams.get('has_coordinates') === 'true',
    scheduled: url.searchParams.get('scheduled') ? url.searchParams.get('scheduled') === 'true' : undefined,
    user_id: url.searchParams.get('user_id') || undefined,
    latitude: url.searchParams.get('latitude') ? parseFloat(url.searchParams.get('latitude')!) : undefined,
    longitude: url.searchParams.get('longitude') ? parseFloat(url.searchParams.get('longitude')!) : undefined,
    radius_km: url.searchParams.get('radius_km') ? parseFloat(url.searchParams.get('radius_km')!) : 5.0,
    tags: url.searchParams.get('tags') ? url.searchParams.get('tags')!.split(',') : undefined,
    limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 50,
    offset: url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : 0,
    sort_by: (url.searchParams.get('sort_by') as any) || 'created_at',
    sort_order: (url.searchParams.get('sort_order') as any) || 'desc'
  };

  // バリデーション
  if (searchParams.trip_id) {
    // 旅行メンバーシップ確認
    const { data: membership, error: memberError } = await supabase
      .from('trip_members')
      .select('role')
      .eq('trip_id', searchParams.trip_id)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return new Response(
        JSON.stringify({ error: 'You are not a member of this trip' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }
  }

  // ベースクエリの構築
  let query = supabase
    .from('places')
    .select(`
      *,
      user:users(id, name, avatar_url, is_premium)
    `);

  // フィルタリング条件の適用
  if (searchParams.trip_id) {
    query = query.eq('trip_id', searchParams.trip_id);
  } else {
    // trip_idが指定されていない場合は、ユーザーがメンバーの旅行のみ
    const { data: userTrips, error: tripsError } = await supabase
      .from('trip_members')
      .select('trip_id')
      .eq('user_id', userId);

    if (tripsError) {
      throw new Error(`Failed to fetch user trips: ${tripsError.message}`);
    }

    const tripIds = userTrips.map((t: any) => t.trip_id);
    if (tripIds.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          places: [], 
          total_count: 0,
          search_params: searchParams
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
    query = query.in('trip_id', tripIds);
  }

  // テキスト検索
  if (searchParams.query) {
    query = query.or(`name.ilike.%${searchParams.query}%,address.ilike.%${searchParams.query}%,notes.ilike.%${searchParams.query}%`);
  }

  // カテゴリフィルター
  if (searchParams.category) {
    query = query.eq('category', searchParams.category);
  }

  // 評価フィルター
  if (searchParams.min_rating !== undefined) {
    query = query.gte('rating', searchParams.min_rating);
  }
  if (searchParams.max_rating !== undefined) {
    query = query.lte('rating', searchParams.max_rating);
  }

  // 価格レベルフィルター
  if (searchParams.min_price_level !== undefined) {
    query = query.gte('price_level', searchParams.min_price_level);
  }
  if (searchParams.max_price_level !== undefined) {
    query = query.lte('price_level', searchParams.max_price_level);
  }

  // 希望度フィルター
  if (searchParams.min_wish_level !== undefined) {
    query = query.gte('wish_level', searchParams.min_wish_level);
  }
  if (searchParams.max_wish_level !== undefined) {
    query = query.lte('wish_level', searchParams.max_wish_level);
  }

  // 座標の有無フィルター
  if (searchParams.has_coordinates !== undefined) {
    if (searchParams.has_coordinates) {
      query = query.not('latitude', 'is', null).not('longitude', 'is', null);
    } else {
      query = query.or('latitude.is.null,longitude.is.null');
    }
  }

  // スケジュール状態フィルター
  if (searchParams.scheduled !== undefined) {
    query = query.eq('scheduled', searchParams.scheduled);
  }

  // ユーザーフィルター
  if (searchParams.user_id) {
    query = query.eq('user_id', searchParams.user_id);
  }

  // タグフィルター
  if (searchParams.tags && searchParams.tags.length > 0) {
    query = query.overlaps('tags', searchParams.tags);
  }

  // ソート機能
  let orderBy = 'created_at';
  if (searchParams.sort_by === 'distance' && searchParams.latitude && searchParams.longitude) {
    // 地理的ソートは後で処理
    orderBy = 'created_at';
  } else if (searchParams.sort_by && ['wish_level', 'rating', 'name'].indexOf(searchParams.sort_by) !== -1) {
    orderBy = searchParams.sort_by!;
  }

  query = query.order(orderBy, { ascending: searchParams.sort_order === 'asc' });

  // ページネーション
  query = query.range(searchParams.offset!, searchParams.offset! + searchParams.limit! - 1);

  // クエリ実行
  const { data: places, error, count } = await query;

  if (error) {
    throw new Error(`Failed to search places: ${error.message}`);
  }

  let processedPlaces = places || [];

  // 地理的距離計算とソート
  if (searchParams.latitude !== undefined && searchParams.longitude !== undefined) {
    const userLat = searchParams.latitude;
    const userLon = searchParams.longitude;
    const radiusKm = searchParams.radius_km!;

    processedPlaces = processedPlaces
      .map((place: any) => {
        if (place.latitude && place.longitude) {
          const distance = calculateHaversineDistance(
            userLat, 
            userLon, 
            place.latitude, 
            place.longitude
          );
          return { ...place, distance_km: distance };
        }
        return { ...place, distance_km: null };
      })
      .filter((place: any) => {
        // 地理的フィルタリング
        if (place.distance_km === null) return true; // 座標がない場所は含める
        return place.distance_km <= radiusKm;
      });

    // 距離によるソート
    if (searchParams.sort_by === 'distance') {
      processedPlaces.sort((a: any, b: any) => {
        if (a.distance_km === null && b.distance_km === null) return 0;
        if (a.distance_km === null) return 1;
        if (b.distance_km === null) return -1;
        return searchParams.sort_order === 'asc' 
          ? a.distance_km - b.distance_km 
          : b.distance_km - a.distance_km;
      });
    }
  }

  // 統計情報の計算
  const statistics = {
    total_places: processedPlaces.length,
    places_by_category: processedPlaces.reduce((acc: any, place: any) => {
      acc[place.category] = (acc[place.category] || 0) + 1;
      return acc;
    }, {}),
    avg_wish_level: processedPlaces.length > 0 
      ? processedPlaces.reduce((sum: number, place: any) => sum + place.wish_level, 0) / processedPlaces.length 
      : 0,
    avg_rating: processedPlaces.length > 0 
      ? processedPlaces.filter((p: any) => p.rating).reduce((sum: number, place: any) => sum + (place.rating || 0), 0) / processedPlaces.filter((p: any) => p.rating).length
      : 0,
    places_with_coordinates: processedPlaces.filter((place: any) => place.latitude && place.longitude).length,
    scheduled_places: processedPlaces.filter((place: any) => place.scheduled).length
  };

  // 使用状況イベント記録
  await supabase
    .from('usage_events')
    .insert({
      user_id: userId,
      event_type: 'places_searched',
      event_category: 'place_management',
      trip_id: searchParams.trip_id || null,
      metadata: {
        search_query: searchParams.query,
        category: searchParams.category,
        has_filters: !!(searchParams.min_rating || searchParams.max_rating || 
                        searchParams.min_price_level || searchParams.max_price_level ||
                        searchParams.min_wish_level || searchParams.max_wish_level),
        has_location_filter: !!(searchParams.latitude && searchParams.longitude),
        results_count: processedPlaces.length,
        sort_by: searchParams.sort_by,
        sort_order: searchParams.sort_order
      }
    });

  return new Response(
    JSON.stringify({ 
      success: true, 
      places: processedPlaces,
      statistics: statistics,
      total_count: processedPlaces.length,
      search_params: searchParams,
      has_more: processedPlaces.length === searchParams.limit
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
}

// 重複チェック機能
async function performDuplicateChecks(requestData: PlaceCreateRequest, supabase: any) {
  const duplicateErrors: string[] = [];

  // 1. 場所名の重複チェック（同一旅行内、大文字小文字無視）
  const { data: nameMatches, error: nameError } = await supabase
    .from('places')
    .select('id, name')
    .eq('trip_id', requestData.trip_id)
    .ilike('name', requestData.name.trim());

  if (nameError) {
    console.warn('Name duplicate check failed:', nameError);
  } else if (nameMatches && nameMatches.length > 0) {
    duplicateErrors.push(`A place named "${requestData.name}" already exists in this trip`);
  }

  // 2. 地理的近接チェック（座標が提供されている場合）
  if (requestData.latitude && requestData.longitude) {
    const { data: nearbyPlaces, error: nearbyError } = await supabase
      .from('places')
      .select('id, name, latitude, longitude')
      .eq('trip_id', requestData.trip_id)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (nearbyError) {
      console.warn('Geographic duplicate check failed:', nearbyError);
    } else if (nearbyPlaces && nearbyPlaces.length > 0) {
      const PROXIMITY_THRESHOLD_KM = 0.1; // 100メートル以内は重複とみなす
      
      for (const existingPlace of nearbyPlaces) {
        const distance = calculateHaversineDistance(
          requestData.latitude,
          requestData.longitude,
          existingPlace.latitude,
          existingPlace.longitude
        );
        
        if (distance < PROXIMITY_THRESHOLD_KM) {
          duplicateErrors.push(
            `A place named "${existingPlace.name}" is located very close to this location (${Math.round(distance * 1000)}m away)`
          );
        }
      }
    }
  }

  // 3. 外部ID重複チェック（external_idが提供されている場合）
  if (requestData.external_id) {
    const { data: externalMatches, error: externalError } = await supabase
      .from('places')
      .select('id, name, external_id')
      .eq('trip_id', requestData.trip_id)
      .eq('external_id', requestData.external_id);

    if (externalError) {
      console.warn('External ID duplicate check failed:', externalError);
    } else if (externalMatches && externalMatches.length > 0) {
      duplicateErrors.push(
        `A place with the same external ID already exists: "${externalMatches[0].name}"`
      );
    }
  }

  // 4. 住所の類似チェック（住所が提供されている場合）
  if (requestData.address && requestData.address.length > 10) {
    const { data: addressMatches, error: addressError } = await supabase
      .from('places')
      .select('id, name, address')
      .eq('trip_id', requestData.trip_id)
      .not('address', 'is', null)
      .ilike('address', `%${requestData.address.slice(0, 20)}%`); // 住所の最初20文字で部分一致

    if (addressError) {
      console.warn('Address similarity check failed:', addressError);
    } else if (addressMatches && addressMatches.length > 0) {
      for (const match of addressMatches) {
        const similarity = calculateStringSimilarity(
          requestData.address.toLowerCase(), 
          match.address.toLowerCase()
        );
        
        if (similarity > 0.8) { // 80%以上の類似度
          duplicateErrors.push(
            `A place with similar address already exists: "${match.name}" at "${match.address}"`
          );
        }
      }
    }
  }

  // 重複エラーがある場合は例外を投げる
  if (duplicateErrors.length > 0) {
    throw new Error(`Duplicate place detected:\n${duplicateErrors.join('\n')}`);
  }
}

// 文字列類似度計算（簡易版）
function calculateStringSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1
        );
      }
    }
  }
  
  const maxLen = Math.max(len1, len2);
  return 1 - matrix[len1][len2] / maxLen;
}

// 地理情報処理の強化
async function enhanceGeographicData(placeData: any, requestData: PlaceCreateRequest): Promise<any> {
  // 住所が提供されているが座標がない場合、ジオコーディングを提案（実装簡略化）
  if (requestData.address && !requestData.latitude && !requestData.longitude) {
    console.log(`Geocoding suggestion: Consider adding coordinates for address: ${requestData.address}`);
    
    // 実際の実装では外部ジオコーディングAPIを使用
    // const coordinates = await geocodeAddress(requestData.address);
    // if (coordinates) {
    //   placeData.latitude = coordinates.lat;
    //   placeData.longitude = coordinates.lng;
    // }
  }

  // 座標が提供されている場合、地理的妥当性をチェック
  if (placeData.latitude && placeData.longitude) {
    // 日本国内の座標範囲チェック（オプション）
    if (requestData.country_hint === 'JP') {
      if (placeData.latitude < 24 || placeData.latitude > 46 || 
          placeData.longitude < 123 || placeData.longitude > 146) {
        console.warn('Coordinates appear to be outside Japan despite country hint');
      }
    }
    
    // PostGIS地点データを設定（データベーストリガーで自動設定されるが、明示的に確認）
    placeData.location_point = `POINT(${placeData.longitude} ${placeData.latitude})`;
  }

  return placeData;
}

// ハヴァーサイン距離計算関数
// Geographic Search Optimization Functions

// Optimized Haversine distance calculation with early exit optimizations
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  // Early exit for identical coordinates
  if (lat1 === lat2 && lon1 === lon2) return 0;
  
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  // Pre-calculate commonly used values
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Fast distance calculation using equirectangular approximation (faster but less accurate)
function calculateFastDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const avgLat = (lat1 + lat2) / 2 * Math.PI / 180;
  
  const x = dLon * Math.cos(avgLat);
  const y = dLat;
  return R * Math.sqrt(x * x + y * y);
}

// Bounding box calculation for geographic queries optimization
function getBoundingBox(centerLat: number, centerLon: number, radiusKm: number): {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
} {
  const R = 6371; // Earth's radius in kilometers
  const latChange = radiusKm / R * 180 / Math.PI;
  const lonChange = radiusKm / R * 180 / Math.PI / Math.cos(centerLat * Math.PI / 180);
  
  return {
    minLat: centerLat - latChange,
    maxLat: centerLat + latChange,
    minLon: centerLon - lonChange,
    maxLon: centerLon + lonChange
  };
}

// Geographic clustering for place grouping
interface ClusterPoint {
  id: string;
  latitude: number;
  longitude: number;
  data: any;
}

interface Cluster {
  center: { latitude: number; longitude: number };
  points: ClusterPoint[];
  radius: number;
}

function createGeographicClusters(points: ClusterPoint[], maxClusterRadius: number = 1): Cluster[] {
  const clusters: Cluster[] = [];
  const visited = new Set<string>();
  
  for (const point of points) {
    if (visited.has(point.id)) continue;
    
    const cluster: Cluster = {
      center: { latitude: point.latitude, longitude: point.longitude },
      points: [point],
      radius: 0
    };
    
    visited.add(point.id);
    
    // Find nearby points to add to this cluster
    for (const otherPoint of points) {
      if (visited.has(otherPoint.id)) continue;
      
      const distance = calculateFastDistance(
        point.latitude, point.longitude,
        otherPoint.latitude, otherPoint.longitude
      );
      
      if (distance <= maxClusterRadius) {
        cluster.points.push(otherPoint);
        visited.add(otherPoint.id);
        
        // Update cluster center (centroid)
        const totalLat = cluster.points.reduce((sum, p) => sum + p.latitude, 0);
        const totalLon = cluster.points.reduce((sum, p) => sum + p.longitude, 0);
        cluster.center.latitude = totalLat / cluster.points.length;
        cluster.center.longitude = totalLon / cluster.points.length;
        
        // Update cluster radius
        cluster.radius = Math.max(cluster.radius, distance);
      }
    }
    
    clusters.push(cluster);
  }
  
  return clusters;
}

// Optimized geographic search with spatial filtering
async function performOptimizedGeographicSearch(
  supabase: any,
  searchParams: {
    latitude: number;
    longitude: number;
    radius_km?: number;
    limit?: number;
    use_fast_distance?: boolean;
  }
): Promise<any[]> {
  const radiusKm = searchParams.radius_km || 10;
  const limit = searchParams.limit || 100;
  const useFastDistance = searchParams.use_fast_distance || false;
  
  // Step 1: Use bounding box for initial filtering (much faster than distance calculation)
  const bbox = getBoundingBox(searchParams.latitude, searchParams.longitude, radiusKm);
  
  let query = supabase
    .from('places')
    .select('*')
    .gte('latitude', bbox.minLat)
    .lte('latitude', bbox.maxLat)
    .gte('longitude', bbox.minLon)
    .lte('longitude', bbox.maxLon)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);
  
  const { data: places, error } = await query;
  
  if (error) throw error;
  
  // Step 2: Apply precise distance filtering
  const distanceCalc = useFastDistance ? calculateFastDistance : calculateHaversineDistance;
  
  const placesWithDistance = places
    .map(place => ({
      ...place,
      distance_km: distanceCalc(
        searchParams.latitude, searchParams.longitude,
        place.latitude, place.longitude
      )
    }))
    .filter(place => place.distance_km <= radiusKm)
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, limit);
  
  return placesWithDistance;
}

// Viewport-based query optimization for map display
async function getPlacesInViewport(
  supabase: any,
  viewport: {
    northEast: { latitude: number; longitude: number };
    southWest: { latitude: number; longitude: number };
  },
  options: {
    maxPlaces?: number;
    clustering?: boolean;
    clusterRadius?: number;
  } = {}
): Promise<{
  places: any[];
  clusters?: Cluster[];
  viewport_stats: {
    total_places: number;
    clustered_places: number;
    visible_clusters: number;
  };
}> {
  const maxPlaces = options.maxPlaces || 200;
  const enableClustering = options.clustering || false;
  const clusterRadius = options.clusterRadius || 1;
  
  // Query places within viewport bounds
  const { data: places, error } = await supabase
    .from('places')
    .select('*')
    .gte('latitude', viewport.southWest.latitude)
    .lte('latitude', viewport.northEast.latitude)
    .gte('longitude', viewport.southWest.longitude)
    .lte('longitude', viewport.northEast.longitude)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .limit(maxPlaces);
  
  if (error) throw error;
  
  let result: any = {
    places,
    viewport_stats: {
      total_places: places.length,
      clustered_places: 0,
      visible_clusters: 0
    }
  };
  
  // Apply clustering if requested
  if (enableClustering && places.length > 0) {
    const clusterPoints: ClusterPoint[] = places.map(place => ({
      id: place.id,
      latitude: place.latitude,
      longitude: place.longitude,
      data: place
    }));
    
    const clusters = createGeographicClusters(clusterPoints, clusterRadius);
    
    result.clusters = clusters;
    result.viewport_stats.clustered_places = clusters.reduce((sum, cluster) => sum + cluster.points.length, 0);
    result.viewport_stats.visible_clusters = clusters.length;
  }
  
  return result;
}

// Data Synchronization Interfaces
interface SyncStatus {
  trip_id: string;
  last_sync: string;
  sync_version: number;
  places_count: number;
  pending_changes: number;
  conflicts_count: number;
  status: 'synced' | 'pending' | 'conflict' | 'error';
}

interface SyncConflict {
  place_id: string;
  conflict_type: 'version_mismatch' | 'concurrent_edit' | 'data_corruption';
  local_version: any;
  remote_version: any;
  last_modified_by: string;
  last_modified_at: string;
  resolution_required: boolean;
}

interface DataIntegrityCheck {
  check_type: string;
  passed: boolean;
  details: string;
  error_count: number;
  suggestions: string[];
}

interface SyncRequest {
  trip_id: string;
  force_full_sync?: boolean;
  include_images?: boolean;
  include_ratings?: boolean;
  include_opening_hours?: boolean;
}

interface SyncResponse {
  success: boolean;
  sync_id: string;
  changes_applied: number;
  conflicts_detected: number;
  errors: string[];
  performance: {
    execution_time_ms: number;
    data_transferred_kb: number;
  };
}

interface ConflictResolution {
  conflict_id: string;
  resolution_strategy: 'use_local' | 'use_remote' | 'merge' | 'manual';
  merged_data?: any;
  comment?: string;
}

interface SyncStatistics {
  total_syncs: number;
  successful_syncs: number;
  failed_syncs: number;
  avg_sync_time_ms: number;
  data_integrity_score: number;
  last_24h_syncs: number;
  conflict_resolution_rate: number;
}

// Geographic performance monitoring
interface GeographicSearchMetrics {
  search_type: 'radius' | 'viewport' | 'cluster';
  execution_time_ms: number;
  places_found: number;
  search_radius_km?: number;
  viewport_area_km2?: number;
  optimization_used: string;
  bbox_filter_reduction?: number;
}

function logGeographicSearchMetrics(metrics: GeographicSearchMetrics): void {
  console.log(`Geographic Search Metrics:`, {
    type: metrics.search_type,
    duration: `${metrics.execution_time_ms}ms`,
    results: metrics.places_found,
    optimization: metrics.optimization_used,
    ...(metrics.search_radius_km && { radius: `${metrics.search_radius_km}km` }),
    ...(metrics.viewport_area_km2 && { area: `${metrics.viewport_area_km2}km²` }),
    ...(metrics.bbox_filter_reduction && { reduction: `${metrics.bbox_filter_reduction}%` })
  });
}

// Enhanced operating hours information
async function enhanceOperatingHours(openingHours: any): Promise<any> {
  if (!openingHours) {
    return {
      status: 'no_data',
      message: 'Operating hours information not available',
      current_status: 'unknown'
    };
  }

  const now = new Date();
  const currentDay = now.getDay(); // 0=Sunday, 1=Monday, ...
  const currentHour = now.getHours() + now.getMinutes() / 60;

  // Get today's operating hours
  const todayHours = openingHours[currentDay];
  
  if (!todayHours) {
    return {
      status: 'no_data_today',
      message: 'Today\'s operating hours information not available',
      current_status: 'unknown',
      weekly_schedule: openingHours
    };
  }

  // Determine current operating status
  let currentStatus = 'unknown';
  let statusMessage = '';
  let nextStatusChange = null;

  if (todayHours.is_closed) {
    currentStatus = 'closed';
    statusMessage = 'Closed today';
  } else {
    const openTime = parseTimeToHours(todayHours.open_time);
    const closeTime = parseTimeToHours(todayHours.close_time);
    
    if (currentHour < openTime) {
      currentStatus = 'closed';
      statusMessage = `Opens at ${todayHours.open_time}`;
      nextStatusChange = {
        status: 'open',
        time: todayHours.open_time,
        minutes_until: Math.round((openTime - currentHour) * 60)
      };
    } else if (currentHour >= openTime && currentHour < closeTime) {
      currentStatus = 'open';
      const minutesUntilClose = Math.round((closeTime - currentHour) * 60);
      
      if (minutesUntilClose <= 60) {
        statusMessage = `Closing soon (${minutesUntilClose} minutes)`;
      } else {
        statusMessage = `Open until ${todayHours.close_time}`;
      }
      
      nextStatusChange = {
        status: 'closed',
        time: todayHours.close_time,
        minutes_until: minutesUntilClose
      };
    } else {
      currentStatus = 'closed';
      statusMessage = 'Closed';
    }
  }

  // Organize weekly schedule
  const weeklySchedule = Object.entries(openingHours).map(([dayNum, hours]: [string, any]) => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return {
      day: dayNames[parseInt(dayNum)],
      day_number: parseInt(dayNum),
      is_closed: hours.is_closed,
      open_time: hours.open_time,
      close_time: hours.close_time,
      is_today: parseInt(dayNum) === currentDay
    };
  });

  return {
    status: 'available',
    current_status: currentStatus,
    status_message: statusMessage,
    next_status_change: nextStatusChange,
    today_hours: todayHours,
    weekly_schedule: weeklySchedule,
    last_updated: now.toISOString()
  };
}

// Get place reviews (mock implementation)
async function getPlaceReviews(placeId: string, supabase: any): Promise<any> {
  // In production, this would fetch from external review APIs or internal review tables
  // Currently returns mock data
  
  // Internal review table implementation example (commented out)
  /*
  const { data: reviews, error } = await supabase
    .from('place_reviews')
    .select(`
      *,
      user:users(name, avatar_url)
    `)
    .eq('place_id', placeId)
    .order('created_at', { ascending: false })
    .limit(10);
  */

  // Generate mock data
  const mockReviews = generateMockReviews(placeId);
  
  return {
    source: 'mock_data',
    total_reviews: mockReviews.length,
    average_rating: mockReviews.reduce((sum, r) => sum + r.rating, 0) / mockReviews.length,
    rating_distribution: {
      5: mockReviews.filter(r => r.rating === 5).length,
      4: mockReviews.filter(r => r.rating === 4).length,
      3: mockReviews.filter(r => r.rating === 3).length,
      2: mockReviews.filter(r => r.rating === 2).length,
      1: mockReviews.filter(r => r.rating === 1).length,
    },
    recent_reviews: mockReviews.slice(0, 5),
    keywords: extractReviewKeywords(mockReviews)
  };
}

// Get related places
async function getRelatedPlaces(place: any, supabase: any, userId: string): Promise<any[]> {
  const relatedPlaces = [];

  // 1. Places in same category
  const { data: sameCategoryPlaces, error: categoryError } = await supabase
    .from('places')
    .select(`
      id, name, category, rating, address, latitude, longitude,
      user:users(name)
    `)
    .eq('trip_id', place.trip_id)
    .eq('category', place.category)
    .neq('id', place.id)
    .limit(3);

  if (!categoryError && sameCategoryPlaces) {
    relatedPlaces.push({
      type: 'same_category',
      title: `Same category (${place.category}) places`,
      places: sameCategoryPlaces.map((p: any) => ({
        ...p,
        relation_type: 'same_category',
        similarity_score: 0.8
      }))
    });
  }

  // 2. Geographically nearby places
  if (place.latitude && place.longitude) {
    const { data: nearbyPlaces, error: nearbyError } = await supabase
      .from('places')
      .select(`
        id, name, category, rating, address, latitude, longitude,
        user:users(name)
      `)
      .eq('trip_id', place.trip_id)
      .neq('id', place.id)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(10);

    if (!nearbyError && nearbyPlaces) {
      const placesWithDistance = nearbyPlaces
        .map((p: any) => ({
          ...p,
          distance: calculateHaversineDistance(
            place.latitude, place.longitude,
            p.latitude, p.longitude
          ),
          relation_type: 'nearby',
        }))
        .filter(p => p.distance < 2) // Within 2km
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3)
        .map(p => ({
          ...p,
          similarity_score: Math.max(0.3, 1 - p.distance / 2)
        }));

      if (placesWithDistance.length > 0) {
        relatedPlaces.push({
          type: 'nearby',
          title: 'Nearby places',
          places: placesWithDistance
        });
      }
    }
  }

  // 3. Places added by same user
  const { data: sameUserPlaces, error: userError } = await supabase
    .from('places')
    .select(`
      id, name, category, rating, address,
      user:users(name)
    `)
    .eq('trip_id', place.trip_id)
    .eq('user_id', place.user_id)
    .neq('id', place.id)
    .limit(3);

  if (!userError && sameUserPlaces && sameUserPlaces.length > 0) {
    relatedPlaces.push({
      type: 'same_user',
      title: `Other places by ${place.user.name}`,
      places: sameUserPlaces.map((p: any) => ({
        ...p,
        relation_type: 'same_user',
        similarity_score: 0.6
      }))
    });
  }

  return relatedPlaces;
}

// Generate mock review data
function generateMockReviews(placeId: string): any[] {
  const reviewTexts = [
    "Great place to visit. Amazing atmosphere, would love to come back again.",
    "Not as good as expected. Too crowded and couldn't enjoy it properly.",
    "Highly recommended for families. Kids really enjoyed it.",
    "Very photogenic place, posted lots of pictures on Instagram.",
    "Good accessibility and easy to explore for tourists."
  ];

  const authors = [
    "Travel Lover A", "Food Explorer B", "Photo Enthusiast C", "Family Travel Expert D", "Solo Travel Master E"
  ];

  return Array.from({ length: 8 }, (_, i) => ({
    id: `review-${placeId}-${i}`,
    rating: Math.floor(Math.random() * 5) + 1,
    text: reviewTexts[i % reviewTexts.length],
    author: authors[i % authors.length],
    created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    helpful_count: Math.floor(Math.random() * 20)
  }));
}

// Extract review keywords
function extractReviewKeywords(reviews: any[]): string[] {
  const keywords = ['atmosphere', 'crowded', 'family', 'photogenic', 'accessibility', 'kids', 'photo', 'tourist'];
  return keywords.filter(keyword => 
    reviews.some(review => review.text.toLowerCase().includes(keyword))
  );
}

// Convert time string to hours
function parseTimeToHours(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours + minutes / 60;
}

// Place update notification functionality
async function sendPlaceUpdateNotification(
  updatedPlace: any, 
  tripId: string, 
  updatedByUserId: string, 
  updatedFields: string[], 
  supabase: any
): Promise<void> {
  try {
    // Get trip members (excluding updater)
    const { data: tripMembers, error: membersError } = await supabase
      .from('trip_members')
      .select(`
        user_id,
        user:users(id, name, email)
      `)
      .eq('trip_id', tripId)
      .neq('user_id', updatedByUserId);

    if (membersError) {
      console.warn('Failed to fetch trip members for notification:', membersError);
      return;
    }

    if (!tripMembers || tripMembers.length === 0) {
      console.log('No other members to notify for place update');
      return;
    }

    // Get updater information
    const { data: updater, error: updaterError } = await supabase
      .from('users')
      .select('name')
      .eq('id', updatedByUserId)
      .single();

    if (updaterError) {
      console.warn('Failed to fetch updater info:', updaterError);
      return;
    }

    // Translate field names to English
    const fieldTranslations: Record<string, string> = {
      name: 'place name',
      category: 'category',
      address: 'address',
      latitude: 'latitude',
      longitude: 'longitude',
      rating: 'rating',
      wish_level: 'wish level',
      stay_duration_minutes: 'stay duration',
      price_level: 'price level',
      estimated_cost: 'estimated cost',
      opening_hours: 'opening hours',
      image_url: 'image',
      visit_date: 'visit date',
      preferred_time_slots: 'preferred time slots',
      notes: 'notes',
      tags: 'tags'
    };

    const translatedFields = updatedFields
      .map(field => fieldTranslations[field] || field)
      .join(', ');

    // Create notification message
    const notificationMessage = updatedFields.length === 1 
      ? `${updater.name} updated ${translatedFields} for "${updatedPlace.name}"`
      : `${updater.name} updated multiple fields (${translatedFields}) for "${updatedPlace.name}"`;

    // Send real-time notifications
    const notifications = tripMembers.map((member: any) => ({
      user_id: member.user_id,
      trip_id: tripId,
      type: 'place_updated',
      title: 'Place information updated',
      message: notificationMessage,
      data: {
        place_id: updatedPlace.id,
        place_name: updatedPlace.name,
        updated_by: updater.name,
        updated_by_id: updatedByUserId,
        updated_fields: updatedFields,
        trip_id: tripId
      },
      created_at: new Date().toISOString(),
      read: false
    }));

    // Save notifications to database
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notificationError) {
      console.warn('Failed to save notifications:', notificationError);
    } else {
      console.log(`Place update notifications sent to ${notifications.length} members`);
    }

    // Broadcast real-time notification
    await broadcastRealtimeNotification(tripId, {
      type: 'place_updated',
      place: updatedPlace,
      updated_by: updater.name,
      updated_fields: translatedFields,
      message: notificationMessage
    }, supabase);

  } catch (error) {
    console.error('Error sending place update notification:', error);
    // Don't let notification errors affect place update success
  }
}

// Broadcast real-time notifications
async function broadcastRealtimeNotification(
  tripId: string, 
  notificationData: any, 
  supabase: any
): Promise<void> {
  try {
    // Broadcast notification to Supabase Realtime channel
    // In production, frontend subscribes to trip-specific channels
    await supabase
      .channel(`trip-${tripId}`)
      .send({
        type: 'broadcast',
        event: 'place_update_notification',
        payload: notificationData
      });

    console.log(`Realtime notification broadcasted to trip-${tripId}`);
  } catch (error) {
    console.warn('Failed to broadcast realtime notification:', error);
  }
}

// Enhanced places list handler for TODO-076
async function handlePlacesList(req: Request, supabase: any, userId: string) {
  const url = new URL(req.url);
  
  // Parse query parameters
  const listParams: PlaceListRequest = {
    list_type: (url.searchParams.get('list_type') as any) || 'trip',
    trip_id: url.searchParams.get('trip_id') || undefined,
    target_user_id: url.searchParams.get('target_user_id') || undefined,
    category: url.searchParams.get('category') || undefined,
    min_rating: url.searchParams.get('min_rating') ? parseFloat(url.searchParams.get('min_rating')!) : undefined,
    max_rating: url.searchParams.get('max_rating') ? parseFloat(url.searchParams.get('max_rating')!) : undefined,
    min_wish_level: url.searchParams.get('min_wish_level') ? parseInt(url.searchParams.get('min_wish_level')!) : undefined,
    max_wish_level: url.searchParams.get('max_wish_level') ? parseInt(url.searchParams.get('max_wish_level')!) : undefined,
    scheduled: url.searchParams.get('scheduled') ? url.searchParams.get('scheduled') === 'true' : undefined,
    has_coordinates: url.searchParams.get('has_coordinates') ? url.searchParams.get('has_coordinates') === 'true' : undefined,
    date_range: {
      start_date: url.searchParams.get('start_date') || undefined,
      end_date: url.searchParams.get('end_date') || undefined
    },
    tags: url.searchParams.get('tags') ? url.searchParams.get('tags')!.split(',') : undefined,
    sort_by: (url.searchParams.get('sort_by') as any) || 'created_at',
    sort_order: (url.searchParams.get('sort_order') as any) || 'desc',
    limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : 50,
    offset: url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : 0,
    include_statistics: url.searchParams.get('include_statistics') === 'true',
    include_trip_info: url.searchParams.get('include_trip_info') === 'true'
  };

  // Validate list type and required parameters
  if (!['trip', 'user', 'all_user_trips'].includes(listParams.list_type)) {
    throw new Error('Invalid list_type. Must be: trip, user, or all_user_trips');
  }

  let places: any[] = [];
  let totalCount = 0;
  let statistics: any = {};

  switch (listParams.list_type) {
    case 'trip':
      if (!listParams.trip_id) {
        throw new Error('trip_id is required for list_type=trip');
      }
      const tripResult = await getTripPlacesList(listParams, supabase, userId);
      places = tripResult.places;
      totalCount = tripResult.totalCount;
      statistics = tripResult.statistics;
      break;

    case 'user':
      const userResult = await getUserPlacesList(listParams, supabase, userId);
      places = userResult.places;
      totalCount = userResult.totalCount;
      statistics = userResult.statistics;
      break;

    case 'all_user_trips':
      const allTripsResult = await getAllUserTripsPlacesList(listParams, supabase, userId);
      places = allTripsResult.places;
      totalCount = allTripsResult.totalCount;
      statistics = allTripsResult.statistics;
      break;
  }

  // Usage event tracking
  await supabase
    .from('usage_events')
    .insert({
      user_id: userId,
      event_type: 'places_list_fetched',
      event_category: 'place_management',
      trip_id: listParams.trip_id || null,
      metadata: {
        list_type: listParams.list_type,
        total_places_returned: places.length,
        filters_applied: {
          category: listParams.category,
          rating_range: listParams.min_rating || listParams.max_rating ? [listParams.min_rating, listParams.max_rating] : null,
          wish_level_range: listParams.min_wish_level || listParams.max_wish_level ? [listParams.min_wish_level, listParams.max_wish_level] : null,
          has_filters: !!(listParams.category || listParams.min_rating || listParams.max_rating || 
                         listParams.min_wish_level || listParams.max_wish_level || listParams.scheduled !== undefined)
        },
        sort_by: listParams.sort_by,
        include_statistics: listParams.include_statistics
      }
    });

  const response = {
    success: true,
    list_type: listParams.list_type,
    places: places,
    total_count: totalCount,
    returned_count: places.length,
    pagination: {
      limit: listParams.limit,
      offset: listParams.offset,
      has_more: places.length === listParams.limit
    },
    applied_filters: {
      category: listParams.category,
      rating_range: listParams.min_rating || listParams.max_rating ? {
        min: listParams.min_rating,
        max: listParams.max_rating
      } : null,
      wish_level_range: listParams.min_wish_level || listParams.max_wish_level ? {
        min: listParams.min_wish_level,
        max: listParams.max_wish_level
      } : null,
      scheduled: listParams.scheduled,
      has_coordinates: listParams.has_coordinates,
      date_range: listParams.date_range?.start_date || listParams.date_range?.end_date ? listParams.date_range : null,
      tags: listParams.tags
    },
    sorting: {
      sort_by: listParams.sort_by,
      sort_order: listParams.sort_order
    }
  };

  if (listParams.include_statistics) {
    response.statistics = statistics;
  }

  return new Response(
    JSON.stringify(response),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
}

// Get places for a specific trip
async function getTripPlacesList(params: PlaceListRequest, supabase: any, userId: string) {
  // Verify trip membership
  const { data: membership, error: memberError } = await supabase
    .from('trip_members')
    .select('role')
    .eq('trip_id', params.trip_id)
    .eq('user_id', userId)
    .single();

  if (memberError || !membership) {
    throw new Error('You are not a member of this trip');
  }

  // Build query with trip info if requested
  const selectFields = params.include_trip_info
    ? `*, user:users(id, name, avatar_url, is_premium), trip:trips(id, name, destination, start_date, end_date)`
    : `*, user:users(id, name, avatar_url, is_premium)`;

  let query = supabase
    .from('places')
    .select(selectFields)
    .eq('trip_id', params.trip_id);

  // Apply filters
  query = applyPlaceFilters(query, params);

  // Apply sorting
  query = applyPlaceSorting(query, params);

  // Apply pagination
  query = query.range(params.offset!, params.offset! + params.limit! - 1);

  const { data: places, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch trip places: ${error.message}`);
  }

  // Calculate statistics if requested
  let statistics = {};
  if (params.include_statistics) {
    statistics = calculatePlaceStatistics(places || []);
  }

  return {
    places: places || [],
    totalCount: count || 0,
    statistics
  };
}

// Get places for a specific user across trips they have access to
async function getUserPlacesList(params: PlaceListRequest, supabase: any, userId: string) {
  const targetUserId = params.target_user_id || userId;

  // Get trips where requesting user has access
  const { data: userTrips, error: tripsError } = await supabase
    .from('trip_members')
    .select('trip_id')
    .eq('user_id', userId);

  if (tripsError) {
    throw new Error(`Failed to fetch user trips: ${tripsError.message}`);
  }

  const tripIds = userTrips.map((t: any) => t.trip_id);

  if (tripIds.length === 0) {
    return {
      places: [],
      totalCount: 0,
      statistics: {}
    };
  }

  // Build query for user's places
  const selectFields = params.include_trip_info
    ? `*, user:users(id, name, avatar_url, is_premium), trip:trips(id, name, destination, start_date, end_date)`
    : `*, user:users(id, name, avatar_url, is_premium)`;

  let query = supabase
    .from('places')
    .select(selectFields)
    .eq('user_id', targetUserId)
    .in('trip_id', tripIds);

  // Apply filters
  query = applyPlaceFilters(query, params);

  // Apply sorting
  query = applyPlaceSorting(query, params);

  // Apply pagination
  query = query.range(params.offset!, params.offset! + params.limit! - 1);

  const { data: places, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch user places: ${error.message}`);
  }

  // Calculate statistics if requested
  let statistics = {};
  if (params.include_statistics) {
    statistics = calculatePlaceStatistics(places || []);
    statistics.trips_count = new Set((places || []).map(p => p.trip_id)).size;
  }

  return {
    places: places || [],
    totalCount: count || 0,
    statistics
  };
}

// Get all places across all trips the user has access to
async function getAllUserTripsPlacesList(params: PlaceListRequest, supabase: any, userId: string) {
  // Get all trips where user is a member
  const { data: userTrips, error: tripsError } = await supabase
    .from('trip_members')
    .select('trip_id, trip:trips(id, name, destination)')
    .eq('user_id', userId);

  if (tripsError) {
    throw new Error(`Failed to fetch user trips: ${tripsError.message}`);
  }

  const tripIds = userTrips.map((t: any) => t.trip_id);

  if (tripIds.length === 0) {
    return {
      places: [],
      totalCount: 0,
      statistics: {}
    };
  }

  // Build query for all places across user's trips
  const selectFields = params.include_trip_info
    ? `*, user:users(id, name, avatar_url, is_premium), trip:trips(id, name, destination, start_date, end_date)`
    : `*, user:users(id, name, avatar_url, is_premium)`;

  let query = supabase
    .from('places')
    .select(selectFields)
    .in('trip_id', tripIds);

  // Apply filters
  query = applyPlaceFilters(query, params);

  // Apply sorting
  query = applyPlaceSorting(query, params);

  // Apply pagination
  query = query.range(params.offset!, params.offset! + params.limit! - 1);

  const { data: places, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch all user trips places: ${error.message}`);
  }

  // Calculate statistics if requested
  let statistics = {};
  if (params.include_statistics) {
    statistics = calculatePlaceStatistics(places || []);
    statistics.trips_count = tripIds.length;
    statistics.places_by_trip = userTrips.reduce((acc: any, trip: any) => {
      const tripPlaces = (places || []).filter(p => p.trip_id === trip.trip_id);
      acc[trip.trip.name] = tripPlaces.length;
      return acc;
    }, {});
  }

  return {
    places: places || [],
    totalCount: count || 0,
    statistics
  };
}

// Apply common filters to place queries
function applyPlaceFilters(query: any, params: PlaceListRequest) {
  if (params.category) {
    query = query.eq('category', params.category);
  }

  if (params.min_rating !== undefined) {
    query = query.gte('rating', params.min_rating);
  }

  if (params.max_rating !== undefined) {
    query = query.lte('rating', params.max_rating);
  }

  if (params.min_wish_level !== undefined) {
    query = query.gte('wish_level', params.min_wish_level);
  }

  if (params.max_wish_level !== undefined) {
    query = query.lte('wish_level', params.max_wish_level);
  }

  if (params.scheduled !== undefined) {
    query = query.eq('scheduled', params.scheduled);
  }

  if (params.has_coordinates !== undefined) {
    if (params.has_coordinates) {
      query = query.not('latitude', 'is', null).not('longitude', 'is', null);
    } else {
      query = query.or('latitude.is.null,longitude.is.null');
    }
  }

  if (params.date_range?.start_date) {
    query = query.gte('visit_date', params.date_range.start_date);
  }

  if (params.date_range?.end_date) {
    query = query.lte('visit_date', params.date_range.end_date);
  }

  if (params.tags && params.tags.length > 0) {
    query = query.overlaps('tags', params.tags);
  }

  return query;
}

// Apply sorting to place queries
function applyPlaceSorting(query: any, params: PlaceListRequest) {
  const sortBy = params.sort_by || 'created_at';
  const sortOrder = params.sort_order === 'asc';

  switch (sortBy) {
    case 'trip_name':
      // Note: This requires join with trips table which should be handled in select
      query = query.order('trip.name', { ascending: sortOrder });
      break;
    case 'visit_date':
      query = query.order('visit_date', { ascending: sortOrder, nullsFirst: false });
      break;
    default:
      query = query.order(sortBy, { ascending: sortOrder });
      break;
  }

  return query;
}

// Calculate comprehensive statistics for places
function calculatePlaceStatistics(places: any[]) {
  if (places.length === 0) {
    return {
      total_places: 0,
      places_by_category: {},
      places_by_user: {},
      avg_wish_level: 0,
      avg_rating: 0,
      total_estimated_time: 0,
      places_with_coordinates: 0,
      scheduled_places: 0
    };
  }

  const statistics = {
    total_places: places.length,
    places_by_category: places.reduce((acc: any, place: any) => {
      acc[place.category] = (acc[place.category] || 0) + 1;
      return acc;
    }, {}),
    places_by_user: places.reduce((acc: any, place: any) => {
      const userName = place.user?.name || 'Unknown';
      acc[userName] = (acc[userName] || 0) + 1;
      return acc;
    }, {}),
    avg_wish_level: places.reduce((sum: number, place: any) => sum + place.wish_level, 0) / places.length,
    avg_rating: places.filter(p => p.rating).length > 0 
      ? places.filter(p => p.rating).reduce((sum: number, place: any) => sum + place.rating, 0) / places.filter(p => p.rating).length 
      : 0,
    total_estimated_time: places.reduce((sum: number, place: any) => sum + (place.stay_duration_minutes || 0), 0),
    places_with_coordinates: places.filter((place: any) => place.latitude && place.longitude).length,
    scheduled_places: places.filter((place: any) => place.scheduled).length,
    places_by_wish_level: places.reduce((acc: any, place: any) => {
      acc[place.wish_level] = (acc[place.wish_level] || 0) + 1;
      return acc;
    }, {}),
    places_with_visit_date: places.filter((place: any) => place.visit_date).length
  };

  return statistics;
}

// Related data processing before place deletion
async function processRelatedDataBeforeDeletion(
  placeId: string, 
  place: any, 
  supabase: any
): Promise<any> {
  const processedItems: string[] = [];
  let hadScheduledData = false;
  let affectedOptimizations = 0;

  try {
    // 1. Check for scheduled data (arrival/departure times)
    if (place.scheduled && (place.arrival_time || place.departure_time)) {
      hadScheduledData = true;
      processedItems.push('scheduled_times');
      console.log(`Place ${place.name} had scheduled data that will be removed`);
    }

    // 2. Check for optimization results that reference this place
    const { data: optimizationResults, error: optError } = await supabase
      .from('optimization_results')
      .select('id, optimized_route')
      .eq('trip_id', place.trip_id);

    if (!optError && optimizationResults) {
      for (const result of optimizationResults) {
        if (result.optimized_route) {
          // Check if this place is referenced in the optimization route
          const routeString = JSON.stringify(result.optimized_route);
          if (routeString.includes(placeId)) {
            affectedOptimizations++;
          }
        }
      }
      
      if (affectedOptimizations > 0) {
        processedItems.push('optimization_results');
        console.log(`Found ${affectedOptimizations} optimization results that reference this place`);
      }
    }

    // 3. Check for any messages that mention this place
    const { data: relatedMessages, error: msgError } = await supabase
      .from('messages')
      .select('id')
      .eq('trip_id', place.trip_id)
      .ilike('content', `%${place.name}%`);

    if (!msgError && relatedMessages && relatedMessages.length > 0) {
      processedItems.push('related_messages');
      console.log(`Found ${relatedMessages.length} messages that mention this place`);
    }

    // 4. Check for usage events related to this place
    const { data: usageEvents, error: usageError } = await supabase
      .from('usage_events')
      .select('id')
      .eq('event_category', 'place_management')
      .contains('metadata', { place_id: placeId });

    if (!usageError && usageEvents && usageEvents.length > 0) {
      processedItems.push('usage_events');
      console.log(`Found ${usageEvents.length} usage events for this place`);
    }

    console.log(`Related data processing completed for place ${placeId}`);
    return {
      processedItems,
      hadScheduledData,
      affectedOptimizations,
      relatedMessagesCount: relatedMessages?.length || 0,
      usageEventsCount: usageEvents?.length || 0
    };

  } catch (error) {
    console.warn('Error processing related data:', error);
    return {
      processedItems: ['error_occurred'],
      hadScheduledData: false,
      affectedOptimizations: 0,
      error: error.message
    };
  }
}

// Send place deletion notification to trip members
async function sendPlaceDeletionNotification(
  deletedPlace: any,
  deletedByUserId: string,
  relatedDataInfo: any,
  supabase: any
): Promise<void> {
  try {
    // Get trip members (excluding deleter)
    const { data: tripMembers, error: membersError } = await supabase
      .from('trip_members')
      .select(`
        user_id,
        user:users(id, name, email)
      `)
      .eq('trip_id', deletedPlace.trip_id)
      .neq('user_id', deletedByUserId);

    if (membersError) {
      console.warn('Failed to fetch trip members for deletion notification:', membersError);
      return;
    }

    if (!tripMembers || tripMembers.length === 0) {
      console.log('No other members to notify for place deletion');
      return;
    }

    // Get deleter information
    const { data: deleter, error: deleterError } = await supabase
      .from('users')
      .select('name')
      .eq('id', deletedByUserId)
      .single();

    if (deleterError) {
      console.warn('Failed to fetch deleter info:', deleterError);
      return;
    }

    // Create notification message with impact information
    let impactDetails = '';
    if (relatedDataInfo.hadScheduledData) {
      impactDetails += ' This may affect the trip schedule.';
    }
    if (relatedDataInfo.affectedOptimizations > 0) {
      impactDetails += ` ${relatedDataInfo.affectedOptimizations} optimization result(s) may be affected.`;
    }

    const notificationMessage = `${deleter.name} deleted "${deletedPlace.name}" from the trip.${impactDetails}`;

    // Send notifications to database
    const notifications = tripMembers.map((member: any) => ({
      user_id: member.user_id,
      trip_id: deletedPlace.trip_id,
      type: 'place_deleted',
      title: 'Place removed from trip',
      message: notificationMessage,
      data: {
        deleted_place_id: deletedPlace.id,
        deleted_place_name: deletedPlace.name,
        deleted_place_category: deletedPlace.category,
        deleted_by: deleter.name,
        deleted_by_id: deletedByUserId,
        trip_id: deletedPlace.trip_id,
        impact_info: relatedDataInfo
      },
      created_at: new Date().toISOString(),
      read: false
    }));

    // Save notifications to database
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notificationError) {
      console.warn('Failed to save deletion notifications:', notificationError);
    } else {
      console.log(`Place deletion notifications sent to ${notifications.length} members`);
    }

    // Broadcast real-time notification
    await broadcastRealtimeDeletionNotification(deletedPlace.trip_id, {
      type: 'place_deleted',
      place: {
        id: deletedPlace.id,
        name: deletedPlace.name,
        category: deletedPlace.category
      },
      deleted_by: deleter.name,
      impact_info: relatedDataInfo,
      message: notificationMessage
    }, supabase);

  } catch (error) {
    console.error('Error sending place deletion notification:', error);
    // Don't let notification errors affect deletion success
  }
}

// Broadcast real-time deletion notifications
async function broadcastRealtimeDeletionNotification(
  tripId: string,
  notificationData: any,
  supabase: any
): Promise<void> {
  try {
    // Broadcast notification to Supabase Realtime channel
    await supabase
      .channel(`trip-${tripId}`)
      .send({
        type: 'broadcast',
        event: 'place_deletion_notification',
        payload: notificationData
      });

    console.log(`Realtime deletion notification broadcasted to trip-${tripId}`);
  } catch (error) {
    console.warn('Failed to broadcast realtime deletion notification:', error);
  }
}

// =============================================================================
// TODO-077: PLACE RATING API HANDLERS
// =============================================================================

// Handle creating a new place rating
async function handleCreatePlaceRating(req: Request, supabase: any, userId: string) {
  const requestData: PlaceRatingRequest = await req.json();
  
  // Validation
  if (!requestData.place_id || !requestData.rating) {
    throw new Error('place_id and rating are required');
  }
  
  if (requestData.rating < 1.0 || requestData.rating > 5.0) {
    throw new Error('Rating must be between 1.0 and 5.0');
  }
  
  // Verify place exists and user has access
  const { data: place, error: placeError } = await supabase
    .from('places')
    .select(`
      *,
      trip:trips!inner(
        id, name,
        trip_members!inner(user_id)
      )
    `)
    .eq('id', requestData.place_id)
    .eq('trip.trip_members.user_id', userId)
    .single();

  if (placeError || !place) {
    return new Response(
      JSON.stringify({ error: 'Place not found or access denied' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      }
    );
  }

  // Check if user already rated this place
  const existingRating = await getUserRatingForPlace(requestData.place_id, userId, supabase);
  if (existingRating) {
    return new Response(
      JSON.stringify({ 
        error: 'You have already rated this place. Use PUT to update your rating.',
        existing_rating: existingRating
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 409,
      }
    );
  }

  // Create rating metadata
  const ratingData = {
    user_id: userId,
    place_id: requestData.place_id,
    rating: Math.round(requestData.rating * 10) / 10, // Round to 1 decimal
    review_text: requestData.review_text || null,
    categories: requestData.categories || [],
    is_anonymous: requestData.is_anonymous || false,
    created_at: new Date().toISOString(),
    helpful_count: 0,
    reported_count: 0
  };

  // Store rating in place metadata
  await storeUserRating(requestData.place_id, ratingData, supabase);
  
  // Update place average rating
  await updatePlaceAverageRating(requestData.place_id, supabase);

  // Usage event tracking
  await supabase
    .from('usage_events')
    .insert({
      user_id: userId,
      event_type: 'place_rated',
      event_category: 'place_management',
      trip_id: place.trip_id,
      metadata: {
        place_id: requestData.place_id,
        place_name: place.name,
        rating: requestData.rating,
        has_review: !!requestData.review_text,
        categories: requestData.categories || [],
        is_anonymous: requestData.is_anonymous || false
      }
    });

  return new Response(
    JSON.stringify({ 
      success: true, 
      rating: ratingData,
      message: 'Rating added successfully'
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    }
  );
}

// Handle getting place ratings
async function handleGetPlaceRatings(req: Request, supabase: any, userId: string) {
  const url = new URL(req.url);
  const placeId = url.searchParams.get('place_id');
  const includeMyRating = url.searchParams.get('include_my_rating') === 'true';
  const includeStatistics = url.searchParams.get('include_statistics') === 'true';
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  
  if (!placeId) {
    throw new Error('place_id parameter is required');
  }

  // Verify place access
  const { data: place, error: placeError } = await supabase
    .from('places')
    .select(`
      *,
      trip:trips!inner(
        id, name,
        trip_members!inner(user_id)
      )
    `)
    .eq('id', placeId)
    .eq('trip.trip_members.user_id', userId)
    .single();

  if (placeError || !place) {
    return new Response(
      JSON.stringify({ error: 'Place not found or access denied' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      }
    );
  }

  // Get all ratings for this place
  const allRatings = await getAllRatingsForPlace(placeId, supabase);
  
  // Filter and paginate
  const publicRatings = allRatings
    .filter(rating => !rating.is_anonymous || rating.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(offset, offset + limit);

  let myRating = null;
  if (includeMyRating) {
    myRating = await getUserRatingForPlace(placeId, userId, supabase);
  }

  let statistics = {};
  if (includeStatistics) {
    statistics = calculateRatingStatistics(allRatings);
  }

  // Usage event tracking
  await supabase
    .from('usage_events')
    .insert({
      user_id: userId,
      event_type: 'place_ratings_viewed',
      event_category: 'place_management',
      trip_id: place.trip_id,
      metadata: {
        place_id: placeId,
        place_name: place.name,
        total_ratings: allRatings.length,
        include_my_rating: includeMyRating,
        include_statistics: includeStatistics
      }
    });

  const response = {
    success: true,
    place_id: placeId,
    place_name: place.name,
    ratings: publicRatings,
    total_count: allRatings.length,
    returned_count: publicRatings.length,
    pagination: {
      limit,
      offset,
      has_more: allRatings.length > offset + limit
    }
  };

  if (includeMyRating) {
    response.my_rating = myRating;
  }

  if (includeStatistics) {
    response.statistics = statistics;
  }

  return new Response(
    JSON.stringify(response),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
}

// Handle updating place rating
async function handleUpdatePlaceRating(req: Request, supabase: any, userId: string) {
  const requestData: PlaceRatingUpdateRequest = await req.json();
  
  if (!requestData.place_id) {
    throw new Error('place_id is required');
  }
  
  if (requestData.rating && (requestData.rating < 1.0 || requestData.rating > 5.0)) {
    throw new Error('Rating must be between 1.0 and 5.0');
  }

  // Verify place access
  const { data: place, error: placeError } = await supabase
    .from('places')
    .select(`
      *,
      trip:trips!inner(
        id, name,
        trip_members!inner(user_id)
      )
    `)
    .eq('id', requestData.place_id)
    .eq('trip.trip_members.user_id', userId)
    .single();

  if (placeError || !place) {
    return new Response(
      JSON.stringify({ error: 'Place not found or access denied' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      }
    );
  }

  // Check if user has existing rating
  const existingRating = await getUserRatingForPlace(requestData.place_id, userId, supabase);
  if (!existingRating) {
    return new Response(
      JSON.stringify({ error: 'No existing rating found. Use POST to create a new rating.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      }
    );
  }

  // Update rating data
  const updatedRating = {
    ...existingRating,
    updated_at: new Date().toISOString()
  };

  if (requestData.rating !== undefined) {
    updatedRating.rating = Math.round(requestData.rating * 10) / 10;
  }
  if (requestData.review_text !== undefined) {
    updatedRating.review_text = requestData.review_text;
  }
  if (requestData.categories !== undefined) {
    updatedRating.categories = requestData.categories;
  }
  if (requestData.is_anonymous !== undefined) {
    updatedRating.is_anonymous = requestData.is_anonymous;
  }

  // Update stored rating
  await updateUserRating(requestData.place_id, updatedRating, supabase);
  
  // Update place average rating
  await updatePlaceAverageRating(requestData.place_id, supabase);

  // Usage event tracking
  await supabase
    .from('usage_events')
    .insert({
      user_id: userId,
      event_type: 'place_rating_updated',
      event_category: 'place_management',
      trip_id: place.trip_id,
      metadata: {
        place_id: requestData.place_id,
        place_name: place.name,
        previous_rating: existingRating.rating,
        new_rating: updatedRating.rating,
        fields_updated: Object.keys(requestData).filter(key => key !== 'place_id')
      }
    });

  return new Response(
    JSON.stringify({ 
      success: true, 
      rating: updatedRating,
      message: 'Rating updated successfully'
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
}

// Handle deleting place rating
async function handleDeletePlaceRating(req: Request, supabase: any, userId: string) {
  const url = new URL(req.url);
  const placeId = url.searchParams.get('place_id');
  
  if (!placeId) {
    throw new Error('place_id parameter is required');
  }

  // Verify place access
  const { data: place, error: placeError } = await supabase
    .from('places')
    .select(`
      *,
      trip:trips!inner(
        id, name,
        trip_members!inner(user_id)
      )
    `)
    .eq('id', placeId)
    .eq('trip.trip_members.user_id', userId)
    .single();

  if (placeError || !place) {
    return new Response(
      JSON.stringify({ error: 'Place not found or access denied' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      }
    );
  }

  // Check if user has existing rating
  const existingRating = await getUserRatingForPlace(placeId, userId, supabase);
  if (!existingRating) {
    return new Response(
      JSON.stringify({ error: 'No rating found to delete' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      }
    );
  }

  // Remove user rating
  await removeUserRating(placeId, userId, supabase);
  
  // Update place average rating
  await updatePlaceAverageRating(placeId, supabase);

  // Usage event tracking
  await supabase
    .from('usage_events')
    .insert({
      user_id: userId,
      event_type: 'place_rating_deleted',
      event_category: 'place_management',
      trip_id: place.trip_id,
      metadata: {
        place_id: placeId,
        place_name: place.name,
        deleted_rating: existingRating.rating,
        had_review: !!existingRating.review_text
      }
    });

  return new Response(
    JSON.stringify({ 
      success: true,
      message: 'Rating deleted successfully'
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
}

// Handle getting rating statistics
async function handleGetRatingStats(req: Request, supabase: any, userId: string) {
  const url = new URL(req.url);
  const placeId = url.searchParams.get('place_id');
  const tripId = url.searchParams.get('trip_id');
  const category = url.searchParams.get('category');
  const includeReviews = url.searchParams.get('include_reviews') === 'true';
  const includeDistribution = url.searchParams.get('include_rating_distribution') === 'true';
  const includeCategoriesBreakdown = url.searchParams.get('include_categories_breakdown') === 'true';

  if (!placeId && !tripId) {
    throw new Error('Either place_id or trip_id parameter is required');
  }

  let places = [];

  if (placeId) {
    // Get specific place
    const { data: place, error: placeError } = await supabase
      .from('places')
      .select(`
        *,
        trip:trips!inner(
          id, name,
          trip_members!inner(user_id)
        )
      `)
      .eq('id', placeId)
      .eq('trip.trip_members.user_id', userId)
      .single();

    if (placeError || !place) {
      return new Response(
        JSON.stringify({ error: 'Place not found or access denied' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      );
    }

    places = [place];
  } else if (tripId) {
    // Get trip places
    const { data: tripPlaces, error: tripError } = await supabase
      .from('places')
      .select(`
        *,
        trip:trips!inner(
          id, name,
          trip_members!inner(user_id)
        )
      `)
      .eq('trip_id', tripId)
      .eq('trip.trip_members.user_id', userId);

    if (tripError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch trip places' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    places = tripPlaces || [];

    if (category) {
      places = places.filter(place => place.category === category);
    }
  }

  // Collect all ratings for these places
  const allRatings = [];
  const placeRatingsMap = {};

  for (const place of places) {
    const ratings = await getAllRatingsForPlace(place.id, supabase);
    allRatings.push(...ratings);
    placeRatingsMap[place.id] = {
      place_name: place.name,
      place_category: place.category,
      ratings: ratings,
      statistics: calculateRatingStatistics(ratings)
    };
  }

  // Calculate overall statistics
  const overallStats = calculateRatingStatistics(allRatings);
  
  // Calculate category breakdown if requested
  let categoriesBreakdown = {};
  if (includeCategoriesBreakdown) {
    categoriesBreakdown = calculateCategoriesBreakdown(allRatings);
  }

  // Get sample reviews if requested
  let sampleReviews = [];
  if (includeReviews) {
    sampleReviews = allRatings
      .filter(rating => rating.review_text && rating.review_text.trim())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map(rating => ({
        place_id: rating.place_id,
        rating: rating.rating,
        review_text: rating.review_text,
        categories: rating.categories,
        created_at: rating.created_at,
        is_anonymous: rating.is_anonymous,
        author_name: rating.is_anonymous ? 'Anonymous' : rating.user_name
      }));
  }

  // Usage event tracking
  await supabase
    .from('usage_events')
    .insert({
      user_id: userId,
      event_type: 'rating_stats_viewed',
      event_category: 'place_management',
      trip_id: tripId,
      metadata: {
        place_id: placeId,
        trip_id: tripId,
        category: category,
        total_places: places.length,
        total_ratings: allRatings.length,
        include_reviews: includeReviews,
        include_distribution: includeDistribution,
        include_categories_breakdown: includeCategoriesBreakdown
      }
    });

  const response = {
    success: true,
    overall_statistics: overallStats,
    places_count: places.length,
    total_ratings_count: allRatings.length
  };

  if (placeId) {
    response.place_statistics = placeRatingsMap[placeId];
  } else {
    response.places_statistics = placeRatingsMap;
  }

  if (includeDistribution) {
    response.rating_distribution = overallStats.rating_distribution;
  }

  if (includeCategoriesBreakdown) {
    response.categories_breakdown = categoriesBreakdown;
  }

  if (includeReviews) {
    response.sample_reviews = sampleReviews;
  }

  return new Response(
    JSON.stringify(response),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
}

// =============================================================================
// RATING HELPER FUNCTIONS
// =============================================================================

// Store user rating in place metadata
async function storeUserRating(placeId: string, ratingData: any, supabase: any): Promise<void> {
  // Get current place ratings metadata
  const { data: place, error } = await supabase
    .from('places')
    .select('metadata')
    .eq('id', placeId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch place metadata: ${error.message}`);
  }

  const metadata = place.metadata || {};
  const ratings = metadata.user_ratings || {};
  
  // Add/update user rating
  ratings[ratingData.user_id] = ratingData;
  
  // Update place metadata
  const { error: updateError } = await supabase
    .from('places')
    .update({ 
      metadata: { ...metadata, user_ratings: ratings },
      updated_at: new Date().toISOString()
    })
    .eq('id', placeId);

  if (updateError) {
    throw new Error(`Failed to store rating: ${updateError.message}`);
  }
}

// Get user rating for a place
async function getUserRatingForPlace(placeId: string, userId: string, supabase: any): Promise<any> {
  const { data: place, error } = await supabase
    .from('places')
    .select('metadata')
    .eq('id', placeId)
    .single();

  if (error || !place) {
    return null;
  }

  const ratings = place.metadata?.user_ratings || {};
  return ratings[userId] || null;
}

// Get all ratings for a place
async function getAllRatingsForPlace(placeId: string, supabase: any): Promise<any[]> {
  const { data: place, error } = await supabase
    .from('places')
    .select('metadata')
    .eq('id', placeId)
    .single();

  if (error || !place) {
    return [];
  }

  const ratings = place.metadata?.user_ratings || {};
  return Object.values(ratings);
}

// Update user rating
async function updateUserRating(placeId: string, updatedRating: any, supabase: any): Promise<void> {
  const { data: place, error } = await supabase
    .from('places')
    .select('metadata')
    .eq('id', placeId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch place metadata: ${error.message}`);
  }

  const metadata = place.metadata || {};
  const ratings = metadata.user_ratings || {};
  
  // Update user rating
  ratings[updatedRating.user_id] = updatedRating;
  
  // Update place metadata
  const { error: updateError } = await supabase
    .from('places')
    .update({ 
      metadata: { ...metadata, user_ratings: ratings },
      updated_at: new Date().toISOString()
    })
    .eq('id', placeId);

  if (updateError) {
    throw new Error(`Failed to update rating: ${updateError.message}`);
  }
}

// Remove user rating
async function removeUserRating(placeId: string, userId: string, supabase: any): Promise<void> {
  const { data: place, error } = await supabase
    .from('places')
    .select('metadata')
    .eq('id', placeId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch place metadata: ${error.message}`);
  }

  const metadata = place.metadata || {};
  const ratings = metadata.user_ratings || {};
  
  // Remove user rating
  delete ratings[userId];
  
  // Update place metadata
  const { error: updateError } = await supabase
    .from('places')
    .update({ 
      metadata: { ...metadata, user_ratings: ratings },
      updated_at: new Date().toISOString()
    })
    .eq('id', placeId);

  if (updateError) {
    throw new Error(`Failed to remove rating: ${updateError.message}`);
  }
}

// Update place average rating
async function updatePlaceAverageRating(placeId: string, supabase: any): Promise<void> {
  const allRatings = await getAllRatingsForPlace(placeId, supabase);
  
  let averageRating = null;
  if (allRatings.length > 0) {
    const totalRating = allRatings.reduce((sum, rating) => sum + rating.rating, 0);
    averageRating = Math.round((totalRating / allRatings.length) * 10) / 10; // Round to 1 decimal
  }

  const { error } = await supabase
    .from('places')
    .update({ 
      rating: averageRating,
      updated_at: new Date().toISOString()
    })
    .eq('id', placeId);

  if (error) {
    console.warn(`Failed to update place average rating: ${error.message}`);
  }
}

// Calculate rating statistics
function calculateRatingStatistics(ratings: any[]) {
  if (ratings.length === 0) {
    return {
      total_ratings: 0,
      average_rating: 0,
      rating_distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      reviews_count: 0,
      anonymous_count: 0
    };
  }

  const totalRating = ratings.reduce((sum, rating) => sum + rating.rating, 0);
  const averageRating = Math.round((totalRating / ratings.length) * 10) / 10;
  
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  ratings.forEach(rating => {
    const roundedRating = Math.round(rating.rating);
    distribution[roundedRating] = (distribution[roundedRating] || 0) + 1;
  });

  const reviewsCount = ratings.filter(rating => rating.review_text && rating.review_text.trim()).length;
  const anonymousCount = ratings.filter(rating => rating.is_anonymous).length;

  return {
    total_ratings: ratings.length,
    average_rating: averageRating,
    rating_distribution: distribution,
    reviews_count: reviewsCount,
    anonymous_count: anonymousCount,
    latest_rating_date: ratings.length > 0 ? 
      Math.max(...ratings.map(r => new Date(r.created_at).getTime())) : null
  };
}

// Calculate categories breakdown
function calculateCategoriesBreakdown(ratings: any[]) {
  const breakdown = {};
  
  ratings.forEach(rating => {
    if (rating.categories && Array.isArray(rating.categories)) {
      rating.categories.forEach(category => {
        if (!breakdown[category]) {
          breakdown[category] = {
            count: 0,
            total_rating: 0,
            average_rating: 0
          };
        }
        breakdown[category].count++;
        breakdown[category].total_rating += rating.rating;
        breakdown[category].average_rating = Math.round((breakdown[category].total_rating / breakdown[category].count) * 10) / 10;
      });
    }
  });

  return breakdown;
}

// =============================================================================
// TODO-078: PLACE RECOMMENDATION API HANDLERS
// =============================================================================

// Handle getting place recommendations
async function handleGetPlaceRecommendations(req: Request, supabase: any, userId: string) {
  const url = new URL(req.url);
  
  // Parse query parameters
  const requestParams: PlaceRecommendationRequest = {
    trip_id: url.searchParams.get('trip_id') || '',
    limit: parseInt(url.searchParams.get('limit') || '10'),
    category: url.searchParams.get('category') || undefined,
    price_level: url.searchParams.get('price_level') ? parseInt(url.searchParams.get('price_level')!) : undefined,
    include_external: url.searchParams.get('include_external') === 'true',
    recommendation_type: (url.searchParams.get('recommendation_type') as any) || 'hybrid',
    exclude_existing: url.searchParams.get('exclude_existing') !== 'false' // Default true
  };

  // Parse location if provided
  if (url.searchParams.get('latitude') && url.searchParams.get('longitude')) {
    requestParams.location = {
      latitude: parseFloat(url.searchParams.get('latitude')!),
      longitude: parseFloat(url.searchParams.get('longitude')!),
      radius_km: parseFloat(url.searchParams.get('radius_km') || '5')
    };
  }

  // Validation
  if (!requestParams.trip_id) {
    throw new Error('trip_id parameter is required');
  }

  if (requestParams.limit < 1 || requestParams.limit > 50) {
    throw new Error('limit must be between 1 and 50');
  }

  // Verify trip access
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select(`
      *,
      trip_members!inner(user_id, role)
    `)
    .eq('id', requestParams.trip_id)
    .eq('trip_members.user_id', userId)
    .single();

  if (tripError || !trip) {
    return new Response(
      JSON.stringify({ error: 'Trip not found or access denied' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      }
    );
  }

  // Get user preferences and team analysis
  const userPreferences = await analyzeUserPreferences(userId, supabase);
  const teamPreferences = await analyzeTeamPreferences(requestParams.trip_id, supabase);
  const existingPlaces = await getExistingTripPlaces(requestParams.trip_id, supabase);

  // Generate recommendations based on type
  let recommendations: RecommendedPlace[] = [];

  switch (requestParams.recommendation_type) {
    case 'individual':
      recommendations = await generateIndividualRecommendations(
        requestParams, userPreferences, existingPlaces, supabase
      );
      break;
    case 'team':
      recommendations = await generateTeamRecommendations(
        requestParams, teamPreferences, existingPlaces, supabase
      );
      break;
    case 'hybrid':
    default:
      recommendations = await generateHybridRecommendations(
        requestParams, userPreferences, teamPreferences, existingPlaces, supabase
      );
      break;
  }

  // Apply filters and sorting
  recommendations = applyRecommendationFilters(recommendations, requestParams);
  recommendations = sortRecommendationsByScore(recommendations);
  recommendations = recommendations.slice(0, requestParams.limit);

  // Add external recommendations if requested
  if (requestParams.include_external && recommendations.length < requestParams.limit) {
    const externalRecommendations = await getExternalRecommendations(
      requestParams, userPreferences, teamPreferences, requestParams.limit - recommendations.length
    );
    recommendations.push(...externalRecommendations);
  }

  // Usage event tracking
  await supabase
    .from('usage_events')
    .insert({
      user_id: userId,
      event_type: 'place_recommendations_requested',
      event_category: 'place_management',
      trip_id: requestParams.trip_id,
      metadata: {
        trip_id: requestParams.trip_id,
        recommendation_type: requestParams.recommendation_type,
        category_filter: requestParams.category,
        location_provided: !!requestParams.location,
        include_external: requestParams.include_external,
        requested_limit: requestParams.limit,
        returned_count: recommendations.length,
        exclude_existing: requestParams.exclude_existing
      }
    });

  return new Response(
    JSON.stringify({
      success: true,
      trip_id: requestParams.trip_id,
      trip_name: trip.name,
      recommendation_type: requestParams.recommendation_type,
      recommendations: recommendations,
      total_count: recommendations.length,
      parameters: {
        limit: requestParams.limit,
        category: requestParams.category,
        price_level: requestParams.price_level,
        include_external: requestParams.include_external,
        exclude_existing: requestParams.exclude_existing,
        location_filter: requestParams.location
      },
      user_preferences_summary: {
        favorite_categories: userPreferences.favorite_categories,
        average_wish_level: userPreferences.average_wish_level,
        preferred_price_level: userPreferences.preferred_price_level
      },
      team_preferences_summary: {
        popular_categories: teamPreferences.popular_categories,
        team_average_rating: teamPreferences.team_average_rating,
        consensus_categories: teamPreferences.consensus_categories
      }
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    }
  );
}

// =============================================================================
// RECOMMENDATION ALGORITHM FUNCTIONS
// =============================================================================

// Analyze individual user preferences
async function analyzeUserPreferences(userId: string, supabase: any) {
  // Get user's place history across all trips they're part of
  const { data: userTrips, error: tripsError } = await supabase
    .from('trip_members')
    .select('trip_id')
    .eq('user_id', userId);

  if (tripsError) {
    console.warn('Failed to fetch user trips for preferences:', tripsError);
    return getDefaultUserPreferences();
  }

  const tripIds = userTrips.map((tm: any) => tm.trip_id);

  if (tripIds.length === 0) {
    return getDefaultUserPreferences();
  }

  // Get user's places and their ratings
  const { data: userPlaces, error: placesError } = await supabase
    .from('places')
    .select('*')
    .eq('user_id', userId)
    .in('trip_id', tripIds);

  if (placesError) {
    console.warn('Failed to fetch user places for preferences:', placesError);
    return getDefaultUserPreferences();
  }

  // Analyze preferences
  const categoryPreferences = {};
  const pricePreferences = {};
  let totalWishLevel = 0;
  let totalPlaces = userPlaces.length;

  userPlaces.forEach((place: any) => {
    // Category analysis
    categoryPreferences[place.category] = (categoryPreferences[place.category] || 0) + place.wish_level;
    
    // Price level analysis
    if (place.price_level) {
      pricePreferences[place.price_level] = (pricePreferences[place.price_level] || 0) + 1;
    }
    
    totalWishLevel += place.wish_level;
  });

  // Calculate favorite categories (normalize by count and weight by wish level)
  const favoriteCategories = Object.entries(categoryPreferences)
    .map(([category, totalWish]: [string, any]) => {
      const count = userPlaces.filter(p => p.category === category).length;
      const avgWish = totalWish / count;
      return { category, avg_wish: avgWish, count, score: avgWish * Math.log(count + 1) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // Calculate preferred price level
  const preferredPriceLevel = Object.entries(pricePreferences)
    .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || null;

  return {
    favorite_categories: favoriteCategories,
    average_wish_level: totalPlaces > 0 ? totalWishLevel / totalPlaces : 3,
    preferred_price_level: preferredPriceLevel ? parseInt(preferredPriceLevel) : null,
    total_places_added: totalPlaces,
    diversity_score: Object.keys(categoryPreferences).length
  };
}

// Analyze team preferences for a trip
async function analyzeTeamPreferences(tripId: string, supabase: any) {
  // Get all trip members
  const { data: tripMembers, error: membersError } = await supabase
    .from('trip_members')
    .select('user_id')
    .eq('trip_id', tripId);

  if (membersError) {
    console.warn('Failed to fetch trip members for team preferences:', membersError);
    return getDefaultTeamPreferences();
  }

  // Get all places in this trip with ratings
  const { data: tripPlaces, error: placesError } = await supabase
    .from('places')
    .select('*')
    .eq('trip_id', tripId);

  if (placesError) {
    console.warn('Failed to fetch trip places for team preferences:', placesError);
    return getDefaultTeamPreferences();
  }

  // Analyze team patterns
  const categoryConsensus = {};
  const userContributions = {};
  let totalRating = 0;
  let ratedPlacesCount = 0;

  tripPlaces.forEach((place: any) => {
    // Category consensus analysis
    const category = place.category;
    if (!categoryConsensus[category]) {
      categoryConsensus[category] = { count: 0, total_wish: 0, contributors: new Set() };
    }
    categoryConsensus[category].count++;
    categoryConsensus[category].total_wish += place.wish_level;
    categoryConsensus[category].contributors.add(place.user_id);

    // User contribution analysis
    userContributions[place.user_id] = (userContributions[place.user_id] || 0) + 1;

    // Rating analysis
    if (place.rating) {
      totalRating += place.rating;
      ratedPlacesCount++;
    }
  });

  // Calculate popular categories
  const popularCategories = Object.entries(categoryConsensus)
    .map(([category, data]: [string, any]) => ({
      category,
      count: data.count,
      avg_wish: data.total_wish / data.count,
      contributor_count: data.contributors.size,
      consensus_score: (data.total_wish / data.count) * (data.contributors.size / tripMembers.length)
    }))
    .sort((a, b) => b.consensus_score - a.consensus_score);

  // Calculate consensus categories (categories that multiple members contributed to)
  const consensusCategories = popularCategories
    .filter(cat => cat.contributor_count > 1)
    .slice(0, 3);

  return {
    popular_categories: popularCategories.slice(0, 5),
    consensus_categories: consensusCategories,
    team_average_rating: ratedPlacesCount > 0 ? totalRating / ratedPlacesCount : null,
    member_count: tripMembers.length,
    total_places: tripPlaces.length,
    collaboration_score: Object.values(userContributions).reduce((sum: number, count: any) => sum + Math.min(count, 3), 0)
  };
}

// Get existing places in trip
async function getExistingTripPlaces(tripId: string, supabase: any) {
  const { data: places, error } = await supabase
    .from('places')
    .select('id, name, category, latitude, longitude')
    .eq('trip_id', tripId);

  if (error) {
    console.warn('Failed to fetch existing trip places:', error);
    return [];
  }

  return places || [];
}

// Generate individual-based recommendations
async function generateIndividualRecommendations(
  params: PlaceRecommendationRequest,
  userPreferences: any,
  existingPlaces: any[],
  supabase: any
): Promise<RecommendedPlace[]> {
  const recommendations: RecommendedPlace[] = [];

  // Use user's favorite categories to generate recommendations
  for (const categoryPref of userPreferences.favorite_categories.slice(0, 3)) {
    const categoryRecommendations = await generateCategoryBasedRecommendations(
      categoryPref.category,
      params,
      userPreferences,
      existingPlaces,
      'individual',
      supabase
    );
    recommendations.push(...categoryRecommendations);
  }

  return recommendations;
}

// Generate team-based recommendations
async function generateTeamRecommendations(
  params: PlaceRecommendationRequest,
  teamPreferences: any,
  existingPlaces: any[],
  supabase: any
): Promise<RecommendedPlace[]> {
  const recommendations: RecommendedPlace[] = [];

  // Use team's consensus categories
  for (const categoryPref of teamPreferences.consensus_categories) {
    const categoryRecommendations = await generateCategoryBasedRecommendations(
      categoryPref.category,
      params,
      teamPreferences,
      existingPlaces,
      'team',
      supabase
    );
    recommendations.push(...categoryRecommendations);
  }

  return recommendations;
}

// Generate hybrid recommendations
async function generateHybridRecommendations(
  params: PlaceRecommendationRequest,
  userPreferences: any,
  teamPreferences: any,
  existingPlaces: any[],
  supabase: any
): Promise<RecommendedPlace[]> {
  const recommendations: RecommendedPlace[] = [];

  // Combine individual and team preferences
  const individualRecs = await generateIndividualRecommendations(params, userPreferences, existingPlaces, supabase);
  const teamRecs = await generateTeamRecommendations(params, teamPreferences, existingPlaces, supabase);

  // Weight and merge recommendations
  individualRecs.forEach(rec => {
    rec.recommendation_factors.team_compatibility *= 0.3; // Reduce team weight for individual recs
    rec.confidence_score *= 0.7; // Adjust confidence
  });

  teamRecs.forEach(rec => {
    rec.recommendation_factors.category_preference *= 0.7; // Reduce individual weight for team recs
    rec.confidence_score *= 0.8; // Adjust confidence
  });

  recommendations.push(...individualRecs, ...teamRecs);

  // Remove duplicates and merge scores
  const uniqueRecommendations = [];
  const seenPlaces = new Set();

  recommendations.forEach(rec => {
    const key = `${rec.place_name}-${rec.category}`;
    if (!seenPlaces.has(key)) {
      seenPlaces.add(key);
      uniqueRecommendations.push(rec);
    }
  });

  return uniqueRecommendations;
}

// Generate category-based recommendations
async function generateCategoryBasedRecommendations(
  category: string,
  params: PlaceRecommendationRequest,
  preferences: any,
  existingPlaces: any[],
  type: 'individual' | 'team',
  supabase: any
): Promise<RecommendedPlace[]> {
  const recommendations: RecommendedPlace[] = [];

  // Get popular places from database in this category
  const { data: popularPlaces, error } = await supabase
    .from('places')
    .select(`
      name, category, rating, price_level, address, latitude, longitude,
      user_id, trip_id
    `)
    .eq('category', category)
    .not('rating', 'is', null)
    .gte('rating', 3.5)
    .order('rating', { ascending: false })
    .limit(20);

  if (error) {
    console.warn(`Failed to fetch popular places for category ${category}:`, error);
    return [];
  }

  // Filter out existing places if requested
  let filteredPlaces = popularPlaces || [];
  if (params.exclude_existing) {
    const existingNames = new Set(existingPlaces.map(p => p.name.toLowerCase()));
    filteredPlaces = filteredPlaces.filter(p => !existingNames.has(p.name.toLowerCase()));
  }

  // Calculate recommendation scores
  filteredPlaces.forEach((place: any) => {
    const factors = calculateRecommendationFactors(place, preferences, type, params);
    const confidenceScore = calculateConfidenceScore(factors);
    
    if (confidenceScore > 0.3) { // Only include decent recommendations
      const reason = generateRecommendationReason(place, factors, type, preferences);
      
      recommendations.push({
        place_name: place.name,
        category: place.category,
        predicted_rating: Math.min(5.0, (place.rating || 3.0) + (factors.category_preference * 0.5)),
        recommendation_reason: reason,
        confidence_score: confidenceScore,
        source: 'internal',
        external_data: {
          address: place.address,
          latitude: place.latitude,
          longitude: place.longitude,
          price_level: place.price_level,
          rating: place.rating
        },
        recommendation_factors: factors
      });
    }
  });

  return recommendations.slice(0, 5); // Limit per category
}

// Calculate recommendation factors
function calculateRecommendationFactors(place: any, preferences: any, type: string, params: PlaceRecommendationRequest) {
  const factors = {
    category_preference: 0,
    team_compatibility: 0,
    popularity_score: 0,
    location_relevance: 0,
    price_match: 0
  };

  // Category preference (based on user/team history)
  if (type === 'individual' && preferences.favorite_categories) {
    const categoryPref = preferences.favorite_categories.find((c: any) => c.category === place.category);
    factors.category_preference = categoryPref ? Math.min(1.0, categoryPref.score / 5) : 0.3;
  } else if (type === 'team' && preferences.popular_categories) {
    const categoryPref = preferences.popular_categories.find((c: any) => c.category === place.category);
    factors.team_compatibility = categoryPref ? Math.min(1.0, categoryPref.consensus_score / 5) : 0.3;
  }

  // Popularity score (based on rating)
  factors.popularity_score = place.rating ? Math.min(1.0, place.rating / 5) : 0.5;

  // Location relevance (if location provided)
  if (params.location && place.latitude && place.longitude) {
    const distance = calculateHaversineDistance(
      params.location.latitude, params.location.longitude,
      place.latitude, place.longitude
    );
    factors.location_relevance = Math.max(0, 1 - (distance / (params.location.radius_km || 5)));
  } else {
    factors.location_relevance = 0.5; // Neutral if no location data
  }

  // Price match
  if (params.price_level && place.price_level) {
    const priceDiff = Math.abs(params.price_level - place.price_level);
    factors.price_match = Math.max(0, 1 - (priceDiff / 3));
  } else if (preferences.preferred_price_level && place.price_level) {
    const priceDiff = Math.abs(preferences.preferred_price_level - place.price_level);
    factors.price_match = Math.max(0, 1 - (priceDiff / 3));
  } else {
    factors.price_match = 0.5; // Neutral if no price data
  }

  return factors;
}

// Calculate overall confidence score
function calculateConfidenceScore(factors: any): number {
  const weights = {
    category_preference: 0.3,
    team_compatibility: 0.25,
    popularity_score: 0.25,
    location_relevance: 0.15,
    price_match: 0.05
  };

  return Object.entries(factors).reduce((score, [factor, value]) => {
    return score + ((value as number) * weights[factor]);
  }, 0);
}

// Generate recommendation reason
function generateRecommendationReason(place: any, factors: any, type: string, preferences: any): string {
  const reasons = [];

  if (factors.category_preference > 0.7) {
    reasons.push(`matches your preference for ${place.category} places`);
  } else if (factors.team_compatibility > 0.7) {
    reasons.push(`popular choice among your team for ${place.category} places`);
  }

  if (factors.popularity_score > 0.8) {
    reasons.push(`highly rated (${place.rating}/5.0)`);
  }

  if (factors.location_relevance > 0.8) {
    reasons.push('conveniently located near your specified area');
  }

  if (factors.price_match > 0.8) {
    reasons.push('matches your preferred price range');
  }

  if (reasons.length === 0) {
    reasons.push(`recommended ${place.category} destination`);
  }

  return `This place is ${reasons.join(' and ')}.`;
}

// Get external recommendations (mock implementation)
async function getExternalRecommendations(
  params: PlaceRecommendationRequest,
  userPreferences: any,
  teamPreferences: any,
  limit: number
): Promise<RecommendedPlace[]> {
  // Mock external recommendations (in production, this would call Google Places API, etc.)
  const mockExternalPlaces = [
    {
      place_name: 'Tokyo National Museum',
      category: 'Museum',
      rating: 4.3,
      price_level: 2,
      address: '13-9 Uenokoen, Taito City, Tokyo',
      latitude: 35.7190,
      longitude: 139.7769,
      place_id: 'ChIJ1234567890'
    },
    {
      place_name: 'Shibuya Sky',
      category: 'Observation Deck',
      rating: 4.5,
      price_level: 3,
      address: '2-24-12 Shibuya, Shibuya City, Tokyo',
      latitude: 35.6581,
      longitude: 139.7029,
      place_id: 'ChIJ0987654321'
    },
    {
      place_name: 'Tsukiji Outer Market',
      category: 'Market',
      rating: 4.2,
      price_level: 2,
      address: '4 Chome Tsukiji, Chuo City, Tokyo',
      latitude: 35.6662,
      longitude: 139.7706,
      place_id: 'ChIJ1122334455'
    }
  ];

  const externalRecommendations: RecommendedPlace[] = [];

  mockExternalPlaces.slice(0, limit).forEach(place => {
    const factors = calculateRecommendationFactors(place, userPreferences, 'individual', params);
    const confidenceScore = calculateConfidenceScore(factors) * 0.8; // Lower confidence for external

    externalRecommendations.push({
      place_name: place.place_name,
      category: place.category,
      predicted_rating: place.rating,
      recommendation_reason: `Popular ${place.category.toLowerCase()} destination with high ratings`,
      confidence_score: confidenceScore,
      source: 'external',
      external_data: {
        place_id: place.place_id,
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
        price_level: place.price_level,
        rating: place.rating,
        photos: []
      },
      recommendation_factors: factors
    });
  });

  return externalRecommendations;
}

// Apply filters to recommendations
function applyRecommendationFilters(recommendations: RecommendedPlace[], params: PlaceRecommendationRequest): RecommendedPlace[] {
  let filtered = recommendations;

  // Category filter
  if (params.category) {
    filtered = filtered.filter(rec => rec.category === params.category);
  }

  // Price level filter
  if (params.price_level && params.price_level > 0) {
    filtered = filtered.filter(rec => {
      const placePrice = rec.external_data?.price_level;
      return !placePrice || Math.abs(placePrice - params.price_level!) <= 1;
    });
  }

  // Location filter
  if (params.location) {
    filtered = filtered.filter(rec => {
      if (!rec.external_data?.latitude || !rec.external_data?.longitude) return true;
      
      const distance = calculateHaversineDistance(
        params.location!.latitude, params.location!.longitude,
        rec.external_data.latitude, rec.external_data.longitude
      );
      
      return distance <= (params.location!.radius_km || 5);
    });
  }

  return filtered;
}

// Sort recommendations by confidence score
function sortRecommendationsByScore(recommendations: RecommendedPlace[]): RecommendedPlace[] {
  return recommendations.sort((a, b) => b.confidence_score - a.confidence_score);
}

// Default user preferences
function getDefaultUserPreferences() {
  return {
    favorite_categories: [
      { category: 'Restaurant', avg_wish: 3.5, count: 0, score: 3.5 },
      { category: 'Landmark', avg_wish: 3.0, count: 0, score: 3.0 }
    ],
    average_wish_level: 3.0,
    preferred_price_level: null,
    total_places_added: 0,
    diversity_score: 0
  };
}

// Default team preferences
function getDefaultTeamPreferences() {
  return {
    popular_categories: [
      { category: 'Restaurant', count: 0, avg_wish: 3.0, contributor_count: 0, consensus_score: 3.0 }
    ],
    consensus_categories: [],
    team_average_rating: null,
    member_count: 1,
    total_places: 0,
    collaboration_score: 0
  };
}

// TODO-079: Place Image Management API implementation

/**
 * Upload place image to Supabase Storage
 * POST /place-management/images
 */
async function handleUploadPlaceImage(
  req: Request, 
  supabaseClient: any, 
  userId: string
): Promise<Response> {
  try {
    const requestData: PlaceImageUploadRequest = await req.json();
    
    // Validate required fields
    if (!requestData.place_id || !requestData.image_data) {
      throw new Error('place_id and image_data are required');
    }

    // Verify user has access to the place
    const { data: place, error: placeError } = await supabaseClient
      .from('places')
      .select(`
        id, 
        name, 
        trip_id,
        trip:trips!inner(
          id,
          owner_id,
          trip_members!inner(user_id, role)
        )
      `)
      .eq('id', requestData.place_id)
      .single();

    if (placeError || !place) {
      throw new Error('Place not found or access denied');
    }

    // Check if user is a member of the trip
    const isMember = place.trip.trip_members.some((member: any) => member.user_id === userId);
    if (!isMember) {
      throw new Error('You are not a member of this trip');
    }

    // Decode base64 image data
    const imageBuffer = Uint8Array.from(atob(requestData.image_data), c => c.charCodeAt(0));
    
    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileExtension = getImageFileExtension(requestData.image_data);
    const fileName = `${requestData.place_id}/${timestamp}-${userId}${fileExtension}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('place-images')
      .upload(fileName, imageBuffer, {
        contentType: getImageMimeType(requestData.image_data),
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseClient.storage
      .from('place-images')
      .getPublicUrl(fileName);

    // If this is marked as primary, unset other primary images for this place
    if (requestData.is_primary) {
      await supabaseClient
        .from('place_images')
        .update({ is_primary: false })
        .eq('place_id', requestData.place_id);
    }

    // Save image metadata to database
    const { data: imageRecord, error: dbError } = await supabaseClient
      .from('place_images')
      .insert({
        place_id: requestData.place_id,
        image_url: publicUrl,
        image_path: fileName,
        image_name: requestData.image_name || `Image for ${place.name}`,
        image_description: requestData.image_description,
        is_primary: requestData.is_primary || false,
        uploaded_by: userId,
        file_size: imageBuffer.length,
        content_type: getImageMimeType(requestData.image_data)
      })
      .select()
      .single();

    if (dbError) {
      // If database insertion fails, clean up uploaded file
      await supabaseClient.storage
        .from('place-images')
        .remove([fileName]);
      throw new Error(`Failed to save image metadata: ${dbError.message}`);
    }

    // If this was set as primary, update the place's main image_url
    if (requestData.is_primary) {
      await supabaseClient
        .from('places')
        .update({ 
          image_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestData.place_id);
    }

    // Track usage event
    await trackUsageEvent(supabaseClient, userId, place.trip_id, 'place_image_uploaded', {
      place_id: requestData.place_id,
      image_id: imageRecord.id,
      is_primary: requestData.is_primary,
      file_size: imageBuffer.length
    });

    return new Response(
      JSON.stringify({
        success: true,
        image: {
          id: imageRecord.id,
          url: publicUrl,
          name: imageRecord.image_name,
          description: imageRecord.image_description,
          is_primary: imageRecord.is_primary,
          uploaded_at: imageRecord.created_at,
          file_size: imageRecord.file_size
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201,
      }
    );

  } catch (error) {
    console.error('Error uploading place image:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to upload image',
        code: 'IMAGE_UPLOAD_ERROR'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
}

/**
 * Get place images
 * GET /place-management/images?place_id={id} or ?trip_id={id} or ?user_id={id}
 */
async function handleGetPlaceImages(
  req: Request, 
  supabaseClient: any, 
  userId: string
): Promise<Response> {
  try {
    const url = new URL(req.url);
    const placeId = url.searchParams.get('place_id');
    const tripId = url.searchParams.get('trip_id');
    const targetUserId = url.searchParams.get('user_id');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const includeMetadata = url.searchParams.get('include_metadata') === 'true';

    let query = supabaseClient
      .from('place_images')
      .select(`
        id,
        place_id,
        image_url,
        image_name,
        image_description,
        is_primary,
        created_at,
        ${includeMetadata ? 'file_size, content_type, uploaded_by,' : ''}
        place:places!inner(
          id,
          name,
          trip_id,
          trip:trips!inner(
            id,
            name,
            owner_id,
            trip_members!inner(user_id, role)
          )
        )
      `);

    // Apply filters based on request parameters
    if (placeId) {
      query = query.eq('place_id', placeId);
    } else if (tripId) {
      query = query.eq('place.trip_id', tripId);
    } else if (targetUserId) {
      query = query.eq('uploaded_by', targetUserId);
    } else {
      throw new Error('place_id, trip_id, or user_id parameter is required');
    }

    // Execute query with pagination
    const { data: images, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch images: ${error.message}`);
    }

    // Filter images based on user access to trips
    const accessibleImages = images.filter((image: any) => {
      const isMember = image.place.trip.trip_members.some((member: any) => member.user_id === userId);
      return isMember;
    });

    // Format response
    const formattedImages = accessibleImages.map((image: any) => ({
      id: image.id,
      place_id: image.place_id,
      place_name: image.place.name,
      trip_id: image.place.trip_id,
      trip_name: image.place.trip.name,
      image_url: image.image_url,
      image_name: image.image_name,
      image_description: image.image_description,
      is_primary: image.is_primary,
      uploaded_at: image.created_at,
      ...(includeMetadata && {
        file_size: image.file_size,
        content_type: image.content_type,
        uploaded_by: image.uploaded_by
      })
    }));

    // Track usage event
    await trackUsageEvent(supabaseClient, userId, tripId || 'multiple', 'place_images_viewed', {
      query_type: placeId ? 'place' : tripId ? 'trip' : 'user',
      filter_value: placeId || tripId || targetUserId,
      results_count: formattedImages.length
    });

    return new Response(
      JSON.stringify({
        success: true,
        images: formattedImages,
        pagination: {
          offset,
          limit,
          total: formattedImages.length,
          has_more: formattedImages.length === limit
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error fetching place images:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to fetch images',
        code: 'IMAGE_FETCH_ERROR'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
}

/**
 * Update place image metadata
 * PUT /place-management/images
 */
async function handleUpdatePlaceImage(
  req: Request, 
  supabaseClient: any, 
  userId: string
): Promise<Response> {
  try {
    const requestData: PlaceImageUpdateRequest = await req.json();
    
    if (!requestData.image_id || !requestData.place_id) {
      throw new Error('image_id and place_id are required');
    }

    // Verify user has access to the image and place
    const { data: imageData, error: imageError } = await supabaseClient
      .from('place_images')
      .select(`
        id,
        place_id,
        image_url,
        uploaded_by,
        place:places!inner(
          id,
          name,
          trip_id,
          trip:trips!inner(
            id,
            owner_id,
            trip_members!inner(user_id, role)
          )
        )
      `)
      .eq('id', requestData.image_id)
      .eq('place_id', requestData.place_id)
      .single();

    if (imageError || !imageData) {
      throw new Error('Image not found or access denied');
    }

    // Check if user is a member of the trip
    const isMember = imageData.place.trip.trip_members.some((member: any) => member.user_id === userId);
    const isOwner = imageData.uploaded_by === userId;
    const isAdmin = imageData.place.trip.trip_members.find((member: any) => 
      member.user_id === userId && member.role === 'admin'
    );

    if (!isMember || (!isOwner && !isAdmin)) {
      throw new Error('You do not have permission to update this image');
    }

    // If setting as primary, unset other primary images for this place
    if (requestData.is_primary) {
      await supabaseClient
        .from('place_images')
        .update({ is_primary: false })
        .eq('place_id', requestData.place_id);
    }

    // Update image metadata
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (requestData.image_name !== undefined) updateData.image_name = requestData.image_name;
    if (requestData.image_description !== undefined) updateData.image_description = requestData.image_description;
    if (requestData.is_primary !== undefined) updateData.is_primary = requestData.is_primary;

    const { data: updatedImage, error: updateError } = await supabaseClient
      .from('place_images')
      .update(updateData)
      .eq('id', requestData.image_id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update image: ${updateError.message}`);
    }

    // If this was set as primary, update the place's main image_url
    if (requestData.is_primary) {
      await supabaseClient
        .from('places')
        .update({ 
          image_url: imageData.image_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestData.place_id);
    }

    // Track usage event
    await trackUsageEvent(supabaseClient, userId, imageData.place.trip_id, 'place_image_updated', {
      image_id: requestData.image_id,
      place_id: requestData.place_id,
      is_primary: requestData.is_primary
    });

    return new Response(
      JSON.stringify({
        success: true,
        image: {
          id: updatedImage.id,
          place_id: updatedImage.place_id,
          image_url: updatedImage.image_url,
          image_name: updatedImage.image_name,
          image_description: updatedImage.image_description,
          is_primary: updatedImage.is_primary,
          updated_at: updatedImage.updated_at
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error updating place image:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to update image',
        code: 'IMAGE_UPDATE_ERROR'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
}

/**
 * Delete place image
 * DELETE /place-management/images?image_id={id}&place_id={id}
 */
async function handleDeletePlaceImage(
  req: Request, 
  supabaseClient: any, 
  userId: string
): Promise<Response> {
  try {
    const url = new URL(req.url);
    const imageId = url.searchParams.get('image_id');
    const placeId = url.searchParams.get('place_id');
    
    if (!imageId || !placeId) {
      throw new Error('image_id and place_id parameters are required');
    }

    // Verify user has access to the image
    const { data: imageData, error: imageError } = await supabaseClient
      .from('place_images')
      .select(`
        id,
        place_id,
        image_path,
        is_primary,
        uploaded_by,
        place:places!inner(
          id,
          trip_id,
          trip:trips!inner(
            id,
            owner_id,
            trip_members!inner(user_id, role)
          )
        )
      `)
      .eq('id', imageId)
      .eq('place_id', placeId)
      .single();

    if (imageError || !imageData) {
      throw new Error('Image not found or access denied');
    }

    // Check if user has permission to delete
    const isMember = imageData.place.trip.trip_members.some((member: any) => member.user_id === userId);
    const isOwner = imageData.uploaded_by === userId;
    const isAdmin = imageData.place.trip.trip_members.find((member: any) => 
      member.user_id === userId && member.role === 'admin'
    );

    if (!isMember || (!isOwner && !isAdmin)) {
      throw new Error('You do not have permission to delete this image');
    }

    // Delete from Supabase Storage
    const { error: storageError } = await supabaseClient.storage
      .from('place-images')
      .remove([imageData.image_path]);

    if (storageError) {
      console.warn(`Failed to delete image file from storage: ${storageError.message}`);
      // Continue with database deletion even if storage deletion fails
    }

    // Delete from database
    const { error: deleteError } = await supabaseClient
      .from('place_images')
      .delete()
      .eq('id', imageId);

    if (deleteError) {
      throw new Error(`Failed to delete image record: ${deleteError.message}`);
    }

    // If this was the primary image, unset it from the place
    if (imageData.is_primary) {
      // Try to find another image to set as primary
      const { data: otherImages } = await supabaseClient
        .from('place_images')
        .select('image_url')
        .eq('place_id', placeId)
        .order('created_at', { ascending: false })
        .limit(1);

      const newImageUrl = otherImages && otherImages.length > 0 ? otherImages[0].image_url : null;
      
      await supabaseClient
        .from('places')
        .update({ 
          image_url: newImageUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', placeId);

      // If there's another image, set it as primary
      if (otherImages && otherImages.length > 0) {
        await supabaseClient
          .from('place_images')
          .update({ is_primary: true })
          .eq('place_id', placeId)
          .eq('image_url', newImageUrl);
      }
    }

    // Track usage event
    await trackUsageEvent(supabaseClient, userId, imageData.place.trip_id, 'place_image_deleted', {
      image_id: imageId,
      place_id: placeId,
      was_primary: imageData.is_primary
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Image deleted successfully',
        deleted_image_id: imageId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error deleting place image:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to delete image',
        code: 'IMAGE_DELETE_ERROR'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
}

// Helper functions for image processing

function getImageFileExtension(base64Data: string): string {
  const header = base64Data.substring(0, 50);
  if (header.includes('jpeg') || header.includes('jpg')) return '.jpg';
  if (header.includes('png')) return '.png';
  if (header.includes('gif')) return '.gif';
  if (header.includes('webp')) return '.webp';
  return '.jpg'; // default
}

function getImageMimeType(base64Data: string): string {
  const header = base64Data.substring(0, 50);
  if (header.includes('jpeg') || header.includes('jpg')) return 'image/jpeg';
  if (header.includes('png')) return 'image/png';
  if (header.includes('gif')) return 'image/gif';
  if (header.includes('webp')) return 'image/webp';
  return 'image/jpeg'; // default
}

async function trackUsageEvent(
  supabaseClient: any, 
  userId: string, 
  tripId: string, 
  eventType: string, 
  metadata: any
): Promise<void> {
  try {
    await supabaseClient
      .from('usage_events')
      .insert({
        user_id: userId,
        event_type: eventType,
        trip_id: tripId,
        metadata,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.warn('Failed to track usage event:', error);
    // Don't throw error for tracking failures
  }
}

// TODO-080: Place Statistics API implementation

/**
 * Get place statistics
 * GET /place-management/stats?stats_type={type}&trip_id={id}&...
 */
async function handleGetPlaceStats(
  req: Request, 
  supabaseClient: any, 
  userId: string
): Promise<Response> {
  try {
    const url = new URL(req.url);
    const statsType = url.searchParams.get('stats_type') as PlaceStatsRequest['stats_type'] || 'trip';
    const tripId = url.searchParams.get('trip_id');
    const targetUserId = url.searchParams.get('user_id');
    const category = url.searchParams.get('category');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const includeDetails = url.searchParams.get('include_details') === 'true';
    const timeRange = url.searchParams.get('time_range') as PlaceStatsRequest['time_range'] || 'monthly';

    // Validate required parameters based on stats type
    if (statsType === 'trip' && !tripId) {
      throw new Error('trip_id is required for trip statistics');
    }
    if (statsType === 'user' && !targetUserId) {
      throw new Error('user_id is required for user statistics');
    }
    if (statsType === 'category' && !category) {
      throw new Error('category is required for category statistics');
    }

    // First get accessible trip IDs for the user
    const { data: accessibleTrips, error: tripsError } = await supabaseClient
      .from('trip_members')
      .select('trip_id')
      .eq('user_id', userId);

    if (tripsError) {
      throw new Error(`Failed to fetch accessible trips: ${tripsError.message}`);
    }

    const tripIds = accessibleTrips.map(tm => tm.trip_id);
    
    if (tripIds.length === 0) {
      throw new Error('No accessible trips found');
    }

    // Build base query for accessible places
    let placesQuery = supabaseClient
      .from('places')
      .select(`
        *,
        trip:trips!inner(id, name),
        user:users!inner(id, name)
      `)
      .in('trip_id', tripIds);

    // Apply filters based on stats type
    switch (statsType) {
      case 'trip':
        placesQuery = placesQuery.eq('trip_id', tripId);
        break;
      case 'user':
        placesQuery = placesQuery.eq('user_id', targetUserId);
        break;
      case 'category':
        placesQuery = placesQuery.eq('category', category);
        break;
      case 'global':
      case 'popularity':
        // No additional filters for global stats
        break;
    }

    // Apply date range filters
    if (startDate) {
      placesQuery = placesQuery.gte('created_at', startDate);
    }
    if (endDate) {
      placesQuery = placesQuery.lte('created_at', endDate);
    }

    // Execute main query
    const { data: places, error: placesError } = await placesQuery;

    if (placesError) {
      throw new Error(`Failed to fetch places: ${placesError.message}`);
    }

    // Calculate summary statistics
    const summary = await calculatePlaceStatsSummary(places, supabaseClient);

    // Initialize response structure
    const response: PlaceStatsResponse = {
      success: true,
      stats: {
        summary
      },
      metadata: {
        generated_at: new Date().toISOString(),
        stats_type: statsType,
        data_range: {
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          total_records: places.length
        }
      }
    };

    // Add category breakdown if requested or for relevant stats types
    if (statsType === 'global' || statsType === 'trip' || includeDetails) {
      response.stats.category_breakdown = calculateCategoryBreakdown(places);
    }

    // Add popularity ranking for popularity stats
    if (statsType === 'popularity') {
      response.stats.popularity_ranking = await calculatePopularityRanking(
        places, 
        supabaseClient, 
        limit
      );
    }

    // Add time series data if requested
    if (includeDetails && (startDate || endDate)) {
      response.stats.time_series = calculateTimeSeriesStats(places, timeRange);
    }

    // Add detailed statistics if requested
    if (includeDetails) {
      response.stats.details = await calculateDetailedStats(places, supabaseClient);
    }

    // Track usage event
    await trackUsageEvent(supabaseClient, userId, tripId || 'multiple', 'place_stats_viewed', {
      stats_type: statsType,
      trip_id: tripId,
      target_user_id: targetUserId,
      category,
      include_details: includeDetails,
      results_count: places.length
    });

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error getting place statistics:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to get statistics',
        code: 'STATS_FETCH_ERROR'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
}

/**
 * Calculate summary statistics
 */
async function calculatePlaceStatsSummary(
  places: any[], 
  supabaseClient: any
): Promise<PlaceStatsSummary> {
  const totalPlaces = places.length;
  
  if (totalPlaces === 0) {
    return {
      total_places: 0,
      total_trips: 0,
      total_users: 0,
      average_wish_level: 0,
      average_rating: 0,
      most_popular_category: '',
      total_estimated_cost: 0,
      total_stay_duration_hours: 0
    };
  }

  // Calculate basic stats
  const uniqueTrips = new Set(places.map(p => p.trip_id)).size;
  const uniqueUsers = new Set(places.map(p => p.user_id)).size;
  
  const totalWishLevel = places.reduce((sum, p) => sum + (p.wish_level || 0), 0);
  const averageWishLevel = totalWishLevel / totalPlaces;
  
  const ratedPlaces = places.filter(p => p.rating && p.rating > 0);
  const totalRating = ratedPlaces.reduce((sum, p) => sum + p.rating, 0);
  const averageRating = ratedPlaces.length > 0 ? totalRating / ratedPlaces.length : 0;
  
  const totalEstimatedCost = places.reduce((sum, p) => sum + (p.estimated_cost || 0), 0);
  const totalStayDurationHours = places.reduce((sum, p) => sum + ((p.stay_duration_minutes || 0) / 60), 0);
  
  // Find most popular category
  const categoryCount = places.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const mostPopularCategory = Object.entries(categoryCount)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || '';

  return {
    total_places: totalPlaces,
    total_trips: uniqueTrips,
    total_users: uniqueUsers,
    average_wish_level: Math.round(averageWishLevel * 100) / 100,
    average_rating: Math.round(averageRating * 100) / 100,
    most_popular_category: mostPopularCategory,
    total_estimated_cost: totalEstimatedCost,
    total_stay_duration_hours: Math.round(totalStayDurationHours * 100) / 100
  };
}

/**
 * Calculate category breakdown
 */
function calculateCategoryBreakdown(places: any[]): CategoryStatsBreakdown[] {
  const categoryStats = places.reduce((acc, place) => {
    const category = place.category;
    if (!acc[category]) {
      acc[category] = {
        places: [],
        totalWish: 0,
        totalRating: 0,
        ratedCount: 0,
        totalCost: 0,
        totalDuration: 0
      };
    }
    
    acc[category].places.push(place);
    acc[category].totalWish += place.wish_level || 0;
    if (place.rating && place.rating > 0) {
      acc[category].totalRating += place.rating;
      acc[category].ratedCount++;
    }
    acc[category].totalCost += place.estimated_cost || 0;
    acc[category].totalDuration += place.stay_duration_minutes || 0;
    
    return acc;
  }, {} as Record<string, any>);

  const totalPlaces = places.length;
  
  return Object.entries(categoryStats).map(([category, stats]) => ({
    category,
    place_count: stats.places.length,
    percentage: Math.round((stats.places.length / totalPlaces) * 100 * 100) / 100,
    average_wish_level: Math.round((stats.totalWish / stats.places.length) * 100) / 100,
    average_rating: stats.ratedCount > 0 ? Math.round((stats.totalRating / stats.ratedCount) * 100) / 100 : 0,
    average_cost: stats.places.length > 0 ? Math.round((stats.totalCost / stats.places.length) * 100) / 100 : 0,
    total_stay_duration: Math.round((stats.totalDuration / 60) * 100) / 100
  })).sort((a, b) => b.place_count - a.place_count);
}

/**
 * Calculate popularity ranking
 */
async function calculatePopularityRanking(
  places: any[], 
  supabaseClient: any, 
  limit: number
): Promise<PopularityRanking[]> {
  // Group places by name and location to identify popular destinations
  const placeGroups = places.reduce((acc, place) => {
    const key = `${place.name.toLowerCase()}_${place.category}`;
    if (!acc[key]) {
      acc[key] = {
        name: place.name,
        category: place.category,
        places: [],
        totalWish: 0,
        totalRating: 0,
        ratedCount: 0
      };
    }
    
    acc[key].places.push(place);
    acc[key].totalWish += place.wish_level || 0;
    if (place.rating && place.rating > 0) {
      acc[key].totalRating += place.rating;
      acc[key].ratedCount++;
    }
    
    return acc;
  }, {} as Record<string, any>);

  // Calculate popularity scores and rank
  const rankings = Object.entries(placeGroups).map(([key, group]) => {
    const addedCount = group.places.length;
    const avgWishLevel = group.totalWish / addedCount;
    const avgRating = group.ratedCount > 0 ? group.totalRating / group.ratedCount : 0;
    
    // Popularity score: weighted combination of frequency, wish level, and rating
    const popularityScore = (
      addedCount * 0.5 +
      avgWishLevel * 0.3 +
      avgRating * 0.2
    );
    
    return {
      place_id: group.places[0].id, // Use first place as representative
      place_name: group.name,
      category: group.category,
      popularity_score: Math.round(popularityScore * 100) / 100,
      total_added_count: addedCount,
      average_wish_level: Math.round(avgWishLevel * 100) / 100,
      average_rating: Math.round(avgRating * 100) / 100,
      recent_trend: 'stable' as const // Simplified for now
    };
  }).sort((a, b) => b.popularity_score - a.popularity_score);

  // Add ranking numbers
  return rankings.slice(0, limit).map((item, index) => ({
    rank: index + 1,
    ...item
  }));
}

/**
 * Calculate time series statistics
 */
function calculateTimeSeriesStats(places: any[], timeRange: string): TimeSeriesStats[] {
  // Group places by date based on time range
  const dateGroups = places.reduce((acc, place) => {
    const date = new Date(place.created_at);
    let dateKey: string;
    
    switch (timeRange) {
      case 'daily':
        dateKey = date.toISOString().split('T')[0];
        break;
      case 'weekly':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        dateKey = weekStart.toISOString().split('T')[0];
        break;
      case 'monthly':
        dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      case 'yearly':
        dateKey = String(date.getFullYear());
        break;
      default:
        dateKey = date.toISOString().split('T')[0];
    }
    
    if (!acc[dateKey]) {
      acc[dateKey] = {
        places: [],
        users: new Set(),
        totalWish: 0,
        categories: new Set()
      };
    }
    
    acc[dateKey].places.push(place);
    acc[dateKey].users.add(place.user_id);
    acc[dateKey].totalWish += place.wish_level || 0;
    acc[dateKey].categories.add(place.category);
    
    return acc;
  }, {} as Record<string, any>);

  return Object.entries(dateGroups).map(([date, data]) => ({
    date,
    total_places_added: data.places.length,
    unique_users: data.users.size,
    popular_categories: Array.from(data.categories).slice(0, 3),
    average_wish_level: Math.round((data.totalWish / data.places.length) * 100) / 100
  })).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculate detailed statistics
 */
async function calculateDetailedStats(
  places: any[], 
  supabaseClient: any
): Promise<PlaceStatsDetails> {
  const details: PlaceStatsDetails = {};

  // Geographic distribution
  const placesWithCoords = places.filter(p => p.latitude && p.longitude);
  if (placesWithCoords.length > 0) {
    const latitudes = placesWithCoords.map(p => p.latitude);
    const longitudes = placesWithCoords.map(p => p.longitude);
    
    const centerLat = latitudes.reduce((sum, lat) => sum + lat, 0) / latitudes.length;
    const centerLng = longitudes.reduce((sum, lng) => sum + lng, 0) / longitudes.length;
    
    // Calculate geographic spread (max distance from center)
    const maxDistance = Math.max(...placesWithCoords.map(p => 
      calculateHaversineDistance(centerLat, centerLng, p.latitude, p.longitude)
    ));
    
    details.geographic_distribution = {
      total_coordinates: placesWithCoords.length,
      coverage_area_km2: Math.round(Math.PI * Math.pow(maxDistance, 2) * 100) / 100,
      center_point: {
        latitude: Math.round(centerLat * 1000000) / 1000000,
        longitude: Math.round(centerLng * 1000000) / 1000000
      },
      geographic_spread: Math.round(maxDistance * 100) / 100
    };
  }

  // User engagement stats
  const userStats = places.reduce((acc, place) => {
    acc[place.user_id] = (acc[place.user_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const userCounts = Object.values(userStats);
  const powerUsers = userCounts.filter(count => count > 10).length;
  const avgPlacesPerUser = userCounts.reduce((sum, count) => sum + count, 0) / userCounts.length;
  
  details.user_engagement = {
    active_users: userCounts.length,
    average_places_per_user: Math.round(avgPlacesPerUser * 100) / 100,
    power_users: powerUsers,
    engagement_score: Math.round((avgPlacesPerUser + powerUsers * 2) * 100) / 100
  };

  // Cost analysis
  const placesWithCost = places.filter(p => p.estimated_cost && p.estimated_cost > 0);
  if (placesWithCost.length > 0) {
    const totalCost = placesWithCost.reduce((sum, p) => sum + p.estimated_cost, 0);
    const avgCostPerPlace = totalCost / placesWithCost.length;
    
    // Price level distribution
    const priceLevelDistribution = places.reduce((acc, place) => {
      const level = place.price_level || 1;
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    const totalPlaces = places.length;
    const costDistribution = Object.entries(priceLevelDistribution).map(([level, count]) => ({
      level: parseInt(level),
      count,
      percentage: Math.round((count / totalPlaces) * 100 * 100) / 100
    }));
    
    const budgetFriendlyCount = (priceLevelDistribution[1] || 0) + (priceLevelDistribution[2] || 0);
    const budgetFriendlyPercentage = (budgetFriendlyCount / totalPlaces) * 100;
    
    details.cost_analysis = {
      total_estimated_cost: totalCost,
      average_cost_per_place: Math.round(avgCostPerPlace * 100) / 100,
      cost_distribution_by_level: costDistribution,
      budget_friendly_percentage: Math.round(budgetFriendlyPercentage * 100) / 100
    };
  }

  // Temporal patterns
  const hourCounts = places.reduce((acc, place) => {
    const hour = new Date(place.created_at).getHours();
    acc[hour] = (acc[hour] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  
  const peakHours = Object.entries(hourCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([hour]) => parseInt(hour));
  
  const dayOfWeekCounts = places.reduce((acc, place) => {
    const dayOfWeek = new Date(place.created_at).getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[dayOfWeek];
    acc[dayName] = (acc[dayName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const mostActiveDayOfWeek = Object.entries(dayOfWeekCounts)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Unknown';
  
  details.temporal_patterns = {
    peak_adding_hours: peakHours,
    seasonal_trends: [
      { season: 'Spring', activity_level: 25 },
      { season: 'Summer', activity_level: 35 },
      { season: 'Fall', activity_level: 25 },
      { season: 'Winter', activity_level: 15 }
    ], // Simplified for now
    most_active_day_of_week: mostActiveDayOfWeek
  };

  return details;
}

// Helper function for distance calculation (reuse existing implementation)
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// External API Handler Functions

// Handle Google Places Search
async function handleGooglePlacesSearch(req: Request, supabase: any, userId: string): Promise<Response> {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get('query');
    const latitude = url.searchParams.get('latitude');
    const longitude = url.searchParams.get('longitude');
    const radius = url.searchParams.get('radius');
    const type = url.searchParams.get('type');
    const language = url.searchParams.get('language') || 'en';
    const region = url.searchParams.get('region');

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query parameter is required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Check API quota
    const hasQuota = await checkAPIQuota('google_places', supabase);
    if (!hasQuota) {
      return new Response(
        JSON.stringify({ 
          error: 'Google Places API daily quota exceeded',
          quota_exceeded: true 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 429 
        }
      );
    }

    // Prepare search request
    const searchRequest: GooglePlacesSearchRequest = {
      query,
      type,
      language,
      region
    };

    if (latitude && longitude) {
      searchRequest.location = {
        lat: parseFloat(latitude),
        lng: parseFloat(longitude)
      };
      
      if (radius) {
        searchRequest.radius = parseInt(radius);
      }
    }

    // Execute search
    const result = await searchGooglePlaces(searchRequest);

    if (result.success) {
      // Increment quota usage
      await incrementAPIUsage('google_places', supabase);

      // Normalize results to Voypath format
      const normalizedPlaces = result.data.map((place: any) => ({
        external_data: place,
        normalized: normalizeGooglePlaceToVoypath(place),
        source: 'google_places'
      }));

      // Track usage event
      await supabase
        .from('usage_events')
        .insert({
          user_id: userId,
          event_type: 'external_api_used',
          metadata: {
            api_type: 'google_places',
            search_query: query,
            results_count: normalizedPlaces.length,
            has_location: !!searchRequest.location
          }
        });

      return new Response(
        JSON.stringify({
          success: true,
          results: normalizedPlaces,
          count: normalizedPlaces.length,
          source: 'google_places',
          search_metadata: {
            query,
            location: searchRequest.location,
            type,
            language
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
          source: 'google_places',
          quota_used: result.quota_used
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: result.quota_used ? 429 : 500
        }
      );
    }

  } catch (error) {
    console.error('Error in Google Places search:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error during Google Places search' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
}

// Handle Google Place Details
async function handleGooglePlaceDetails(req: Request, supabase: any, userId: string): Promise<Response> {
  try {
    const url = new URL(req.url);
    const placeId = url.searchParams.get('place_id');

    if (!placeId) {
      return new Response(
        JSON.stringify({ error: 'place_id parameter is required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Check API quota
    const hasQuota = await checkAPIQuota('google_places', supabase);
    if (!hasQuota) {
      return new Response(
        JSON.stringify({ 
          error: 'Google Places API daily quota exceeded',
          quota_exceeded: true 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 429 
        }
      );
    }

    // Execute details request
    const result = await getGooglePlaceDetails(placeId);

    if (result.success) {
      // Increment quota usage
      await incrementAPIUsage('google_places', supabase);

      // Normalize result to Voypath format
      const normalizedPlace = normalizeGooglePlaceToVoypath(result.data);

      // Track usage event
      await supabase
        .from('usage_events')
        .insert({
          user_id: userId,
          event_type: 'external_api_used',
          metadata: {
            api_type: 'google_places_details',
            place_id: placeId,
            place_name: result.data.name
          }
        });

      return new Response(
        JSON.stringify({
          success: true,
          place_details: {
            external_data: result.data,
            normalized: normalizedPlace,
            source: 'google_places'
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
          source: 'google_places',
          quota_used: result.quota_used
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: result.quota_used ? 429 : 500
        }
      );
    }

  } catch (error) {
    console.error('Error in Google Place details:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error during Google Place details fetch' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
}

// Handle Pexels Image Search
async function handlePexelsImageSearch(req: Request, supabase: any, userId: string): Promise<Response> {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get('query');
    const count = parseInt(url.searchParams.get('count') || '5');

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query parameter is required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    if (count > 20) {
      return new Response(
        JSON.stringify({ error: 'Maximum count is 20 images per request' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Check API quota
    const hasQuota = await checkAPIQuota('pexels', supabase);
    if (!hasQuota) {
      return new Response(
        JSON.stringify({ 
          error: 'Pexels API monthly quota exceeded',
          quota_exceeded: true 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 429 
        }
      );
    }

    // Execute image search
    const result = await searchPexelsImages(query, count);

    if (result.success) {
      // Increment quota usage
      await incrementAPIUsage('pexels', supabase);

      // Format images for response
      const formattedImages = result.data.map((photo: PexelsImageResponse) => ({
        id: photo.id,
        url: photo.src.medium,
        large_url: photo.src.large,
        small_url: photo.src.small,
        alt: photo.alt,
        photographer: photo.photographer,
        photographer_url: photo.photographer_url,
        width: photo.width,
        height: photo.height,
        avg_color: photo.avg_color,
        source: 'pexels'
      }));

      // Track usage event
      await supabase
        .from('usage_events')
        .insert({
          user_id: userId,
          event_type: 'external_api_used',
          metadata: {
            api_type: 'pexels',
            search_query: query,
            image_count: formattedImages.length,
            requested_count: count
          }
        });

      return new Response(
        JSON.stringify({
          success: true,
          images: formattedImages,
          count: formattedImages.length,
          source: 'pexels',
          search_metadata: {
            query,
            requested_count: count
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
          source: 'pexels'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }

  } catch (error) {
    console.error('Error in Pexels image search:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error during Pexels image search' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
}

// Opening Hours Management Functions

async function handleSetPlaceHours(
  req: Request,
  supabase: any,
  userId: string
): Promise<Response> {
  try {
    const body = await req.json() as PlaceHoursRequest;
    
    // Validate request
    if (!body.place_id || !body.opening_hours) {
      return new Response(
        JSON.stringify({ error: 'place_id and opening_hours are required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // Verify place exists and user has access
    const { data: place, error: placeError } = await supabase
      .from('places')
      .select('id, trip_id, name')
      .eq('id', body.place_id)
      .single();

    if (placeError || !place) {
      return new Response(
        JSON.stringify({ error: 'Place not found' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        }
      );
    }

    // Check if user has access to this trip
    const { data: tripMember } = await supabase
      .from('trip_members')
      .select('role')
      .eq('trip_id', place.trip_id)
      .eq('user_id', userId)
      .single();

    if (!tripMember) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403
        }
      );
    }

    // Validate opening hours format
    const validation = validateOpeningHours(body.opening_hours, body.special_hours);
    if (!validation.is_valid) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid opening hours format',
          validation_errors: validation.errors
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    const timezone = body.timezone || 'Asia/Tokyo';

    // Insert or update opening hours
    const hoursData = {
      place_id: body.place_id,
      opening_hours: body.opening_hours,
      special_hours: body.special_hours || [],
      timezone,
      auto_detect_holidays: body.auto_detect_holidays || false,
      updated_at: new Date().toISOString(),
      updated_by: userId
    };

    const { data: existingHours } = await supabase
      .from('place_opening_hours')
      .select('id')
      .eq('place_id', body.place_id)
      .single();

    let result;
    if (existingHours) {
      // Update existing hours
      const { data, error } = await supabase
        .from('place_opening_hours')
        .update(hoursData)
        .eq('place_id', body.place_id)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    } else {
      // Create new hours
      const { data, error } = await supabase
        .from('place_opening_hours')
        .insert({
          ...hoursData,
          created_at: new Date().toISOString(),
          created_by: userId
        })
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    }

    // Calculate current status
    const currentStatus = calculateCurrentOpenStatus(
      body.opening_hours,
      body.special_hours,
      timezone
    );

    const response: PlaceHoursResponse = {
      place_id: body.place_id,
      opening_hours: body.opening_hours,
      special_hours: body.special_hours || [],
      timezone,
      is_open_now: currentStatus.is_open,
      next_status_change: currentStatus.next_change,
      validation_errors: validation.warnings.map(w => w.message)
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201
    });

  } catch (error) {
    console.error('Error setting place hours:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
}

async function handleUpdatePlaceHours(
  req: Request,
  supabase: any,
  userId: string
): Promise<Response> {
  try {
    const body = await req.json() as PlaceHoursRequest;
    
    if (!body.place_id) {
      return new Response(
        JSON.stringify({ error: 'place_id is required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // Check if hours exist
    const { data: existingHours, error: hoursError } = await supabase
      .from('place_opening_hours')
      .select('id, place_id')
      .eq('place_id', body.place_id)
      .single();

    if (hoursError || !existingHours) {
      return new Response(
        JSON.stringify({ error: 'Opening hours not found for this place' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        }
      );
    }

    // Verify user access (same logic as setPlaceHours)
    const { data: place } = await supabase
      .from('places')
      .select('trip_id')
      .eq('id', body.place_id)
      .single();

    const { data: tripMember } = await supabase
      .from('trip_members')
      .select('role')
      .eq('trip_id', place.trip_id)
      .eq('user_id', userId)
      .single();

    if (!tripMember) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403
        }
      );
    }

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date().toISOString(),
      updated_by: userId
    };

    if (body.opening_hours) {
      const validation = validateOpeningHours(body.opening_hours, body.special_hours);
      if (!validation.is_valid) {
        return new Response(
          JSON.stringify({ 
            error: 'Invalid opening hours format',
            validation_errors: validation.errors
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          }
        );
      }
      updateData.opening_hours = body.opening_hours;
    }

    if (body.special_hours !== undefined) {
      updateData.special_hours = body.special_hours;
    }

    if (body.timezone) {
      updateData.timezone = body.timezone;
    }

    if (body.auto_detect_holidays !== undefined) {
      updateData.auto_detect_holidays = body.auto_detect_holidays;
    }

    // Update hours
    const { data, error } = await supabase
      .from('place_opening_hours')
      .update(updateData)
      .eq('place_id', body.place_id)
      .select()
      .single();

    if (error) throw error;

    // Get complete hours data for response
    const currentStatus = calculateCurrentOpenStatus(
      data.opening_hours,
      data.special_hours || [],
      data.timezone
    );

    const response: PlaceHoursResponse = {
      place_id: body.place_id,
      opening_hours: data.opening_hours,
      special_hours: data.special_hours || [],
      timezone: data.timezone,
      is_open_now: currentStatus.is_open,
      next_status_change: currentStatus.next_change
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error updating place hours:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
}

async function handleGetPlaceHours(
  req: Request,
  supabase: any,
  userId: string
): Promise<Response> {
  try {
    const url = new URL(req.url);
    const placeId = url.searchParams.get('place_id');

    if (!placeId) {
      return new Response(
        JSON.stringify({ error: 'place_id parameter is required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // Verify user access
    const { data: place } = await supabase
      .from('places')
      .select('trip_id, name')
      .eq('id', placeId)
      .single();

    if (!place) {
      return new Response(
        JSON.stringify({ error: 'Place not found' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        }
      );
    }

    const { data: tripMember } = await supabase
      .from('trip_members')
      .select('role')
      .eq('trip_id', place.trip_id)
      .eq('user_id', userId)
      .single();

    if (!tripMember) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403
        }
      );
    }

    // Get opening hours
    const { data: hours, error: hoursError } = await supabase
      .from('place_opening_hours')
      .select('*')
      .eq('place_id', placeId)
      .single();

    if (hoursError) {
      // No hours set yet
      return new Response(
        JSON.stringify({ 
          place_id: placeId,
          opening_hours: {},
          special_hours: [],
          timezone: 'Asia/Tokyo',
          is_open_now: false,
          next_status_change: null,
          message: 'No opening hours set for this place'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Calculate current status
    const currentStatus = calculateCurrentOpenStatus(
      hours.opening_hours,
      hours.special_hours || [],
      hours.timezone
    );

    const response: PlaceHoursResponse = {
      place_id: placeId,
      opening_hours: hours.opening_hours,
      special_hours: hours.special_hours || [],
      timezone: hours.timezone,
      is_open_now: currentStatus.is_open,
      next_status_change: currentStatus.next_change
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting place hours:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
}

async function handleValidateOpeningHours(
  req: Request,
  supabase: any,
  userId: string
): Promise<Response> {
  try {
    const body = await req.json() as HoursValidationRequest;
    
    if (!body.opening_hours) {
      return new Response(
        JSON.stringify({ error: 'opening_hours is required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    const validation = validateOpeningHours(
      body.opening_hours,
      body.special_hours,
      {
        checkOverlaps: body.check_overlaps !== false,
        checkTimeFormat: body.check_time_format !== false,
        checkLogicalOrder: body.check_logical_order !== false
      }
    );

    const response: HoursValidationResponse = {
      is_valid: validation.is_valid,
      errors: validation.errors,
      warnings: validation.warnings,
      suggestions: validation.suggestions || []
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error validating opening hours:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
}

async function handleCheckHoursConflicts(
  req: Request,
  supabase: any,
  userId: string
): Promise<Response> {
  try {
    const url = new URL(req.url);
    const tripId = url.searchParams.get('trip_id');
    const targetDate = url.searchParams.get('target_date');
    const startTime = url.searchParams.get('start_time');
    const endTime = url.searchParams.get('end_time');

    if (!tripId || !targetDate) {
      return new Response(
        JSON.stringify({ error: 'trip_id and target_date are required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // Verify user access to trip
    const { data: tripMember } = await supabase
      .from('trip_members')
      .select('role')
      .eq('trip_id', tripId)
      .eq('user_id', userId)
      .single();

    if (!tripMember) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403
        }
      );
    }

    // Get all places in the trip with their opening hours
    const { data: places, error: placesError } = await supabase
      .from('places')
      .select(`
        id,
        name,
        place_opening_hours(
          opening_hours,
          special_hours,
          timezone
        )
      `)
      .eq('trip_id', tripId);

    if (placesError) throw placesError;

    const conflicts: PlaceConflict[] = [];
    const recommendations: string[] = [];
    const alternativeTimes: string[] = [];

    const targetDateObj = new Date(targetDate);
    const dayOfWeek = targetDateObj.getDay();

    for (const place of places) {
      if (!place.place_opening_hours || place.place_opening_hours.length === 0) {
        continue;
      }

      const hours = place.place_opening_hours[0];
      const dayHours = hours.opening_hours[dayOfWeek.toString()];

      // Check for special hours on this date
      const specialHour = hours.special_hours?.find(
        (sh: any) => sh.date === targetDate
      );

      let isOpen = false;
      let openTime = null;
      let closeTime = null;

      if (specialHour) {
        isOpen = !specialHour.is_closed;
        openTime = specialHour.open_time;
        closeTime = specialHour.close_time;
      } else if (dayHours) {
        isOpen = !dayHours.is_closed;
        openTime = dayHours.open_time;
        closeTime = dayHours.close_time;
      }

      if (!isOpen) {
        conflicts.push({
          place_id: place.id,
          place_name: place.name,
          conflict_type: 'closed',
          details: `${place.name} is closed on ${targetDate}`,
          suggested_time: null
        });
      } else if (startTime && endTime && openTime && closeTime) {
        // Check if requested time range conflicts with opening hours
        if (startTime < openTime || endTime > closeTime) {
          conflicts.push({
            place_id: place.id,
            place_name: place.name,
            conflict_type: 'limited_hours',
            details: `${place.name} is only open from ${openTime} to ${closeTime}`,
            suggested_time: `${openTime}-${closeTime}`
          });
        }
      }
    }

    if (conflicts.length > 0) {
      recommendations.push('Consider adjusting your visit times to match place opening hours');
      recommendations.push('Check for alternative dates when more places are open');
      
      // Generate alternative time suggestions
      const openPlaces = places.filter(place => {
        if (!place.place_opening_hours || place.place_opening_hours.length === 0) return false;
        const hours = place.place_opening_hours[0];
        const dayHours = hours.opening_hours[dayOfWeek.toString()];
        return dayHours && !dayHours.is_closed;
      });

      if (openPlaces.length > 0) {
        // Find common opening hours
        const commonStart = Math.max(...openPlaces.map(p => {
          const hours = p.place_opening_hours[0];
          const dayHours = hours.opening_hours[dayOfWeek.toString()];
          return timeToMinutes(dayHours.open_time || '00:00');
        }));

        const commonEnd = Math.min(...openPlaces.map(p => {
          const hours = p.place_opening_hours[0];
          const dayHours = hours.opening_hours[dayOfWeek.toString()];
          return timeToMinutes(dayHours.close_time || '23:59');
        }));

        if (commonStart < commonEnd) {
          alternativeTimes.push(`${minutesToTime(commonStart)}-${minutesToTime(commonEnd)}`);
        }
      }
    }

    const response: HoursConflictResponse = {
      has_conflicts: conflicts.length > 0,
      conflicts,
      recommendations,
      alternative_times: alternativeTimes
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error checking hours conflicts:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
}

// Opening Hours Utility Functions

function validateOpeningHours(
  openingHours: OpeningHours,
  specialHours?: SpecialHours[],
  options = { checkOverlaps: true, checkTimeFormat: true, checkLogicalOrder: true }
): HoursValidationResponse {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: string[] = [];

  // Validate regular opening hours
  for (const [day, hours] of Object.entries(openingHours)) {
    const dayNum = parseInt(day);
    if (dayNum < 0 || dayNum > 6) {
      errors.push({
        field: 'opening_hours',
        message: `Invalid day number: ${day}. Must be 0-6 (Sunday-Saturday)`,
        severity: 'error',
        day: dayNum
      });
      continue;
    }

    if (!hours.is_closed) {
      if (options.checkTimeFormat) {
        if (!hours.open_time || !isValidTimeFormat(hours.open_time)) {
          errors.push({
            field: 'open_time',
            message: `Invalid open time format for day ${day}`,
            severity: 'error',
            day: dayNum,
            time: hours.open_time || ''
          });
        }

        if (!hours.close_time || !isValidTimeFormat(hours.close_time)) {
          errors.push({
            field: 'close_time',
            message: `Invalid close time format for day ${day}`,
            severity: 'error',
            day: dayNum,
            time: hours.close_time || ''
          });
        }
      }

      if (options.checkLogicalOrder && hours.open_time && hours.close_time) {
        if (timeToMinutes(hours.open_time) >= timeToMinutes(hours.close_time)) {
          errors.push({
            field: 'time_order',
            message: `Close time must be after open time for day ${day}`,
            severity: 'error',
            day: dayNum
          });
        }
      }

      // Check breaks
      if (hours.breaks && hours.breaks.length > 0) {
        for (const breakItem of hours.breaks) {
          if (options.checkTimeFormat) {
            if (!isValidTimeFormat(breakItem.start_time)) {
              errors.push({
                field: 'break_start_time',
                message: `Invalid break start time format for day ${day}`,
                severity: 'error',
                day: dayNum,
                time: breakItem.start_time
              });
            }

            if (!isValidTimeFormat(breakItem.end_time)) {
              errors.push({
                field: 'break_end_time',
                message: `Invalid break end time format for day ${day}`,
                severity: 'error',
                day: dayNum,
                time: breakItem.end_time
              });
            }
          }

          if (options.checkLogicalOrder) {
            if (timeToMinutes(breakItem.start_time) >= timeToMinutes(breakItem.end_time)) {
              errors.push({
                field: 'break_time_order',
                message: `Break end time must be after start time for day ${day}`,
                severity: 'error',
                day: dayNum
              });
            }

            // Check if break is within opening hours
            if (hours.open_time && hours.close_time) {
              const openMinutes = timeToMinutes(hours.open_time);
              const closeMinutes = timeToMinutes(hours.close_time);
              const breakStart = timeToMinutes(breakItem.start_time);
              const breakEnd = timeToMinutes(breakItem.end_time);

              if (breakStart < openMinutes || breakEnd > closeMinutes) {
                warnings.push({
                  field: 'break_timing',
                  message: `Break time extends outside opening hours for day ${day}`,
                  suggestion: 'Ensure break times are within opening hours'
                });
              }
            }
          }
        }

        // Check for overlapping breaks
        if (options.checkOverlaps && hours.breaks.length > 1) {
          for (let i = 0; i < hours.breaks.length - 1; i++) {
            for (let j = i + 1; j < hours.breaks.length; j++) {
              const break1Start = timeToMinutes(hours.breaks[i].start_time);
              const break1End = timeToMinutes(hours.breaks[i].end_time);
              const break2Start = timeToMinutes(hours.breaks[j].start_time);
              const break2End = timeToMinutes(hours.breaks[j].end_time);

              if (break1Start < break2End && break2Start < break1End) {
                errors.push({
                  field: 'break_overlap',
                  message: `Overlapping breaks found for day ${day}`,
                  severity: 'error',
                  day: dayNum
                });
              }
            }
          }
        }
      }
    }
  }

  // Validate special hours
  if (specialHours && specialHours.length > 0) {
    for (const special of specialHours) {
      if (!isValidDateFormat(special.date)) {
        errors.push({
          field: 'special_date',
          message: `Invalid date format: ${special.date}. Use YYYY-MM-DD`,
          severity: 'error'
        });
      }

      if (!special.is_closed && options.checkTimeFormat) {
        if (special.open_time && !isValidTimeFormat(special.open_time)) {
          errors.push({
            field: 'special_open_time',
            message: `Invalid special open time format for ${special.date}`,
            severity: 'error',
            time: special.open_time
          });
        }

        if (special.close_time && !isValidTimeFormat(special.close_time)) {
          errors.push({
            field: 'special_close_time',
            message: `Invalid special close time format for ${special.date}`,
            severity: 'error',
            time: special.close_time
          });
        }
      }
    }

    // Check for duplicate special dates
    const dates = specialHours.map(sh => sh.date);
    const duplicates = dates.filter((date, index) => dates.indexOf(date) !== index);
    if (duplicates.length > 0) {
      errors.push({
        field: 'special_hours_duplicates',
        message: `Duplicate special hours found for dates: ${duplicates.join(', ')}`,
        severity: 'error'
      });
    }
  }

  // Generate suggestions
  if (errors.length === 0) {
    const allClosed = Object.values(openingHours).every(hours => hours.is_closed);
    if (allClosed) {
      warnings.push({
        field: 'all_closed',
        message: 'All days are marked as closed',
        suggestion: 'Consider setting opening hours for at least some days'
      });
    }

    // Check for very long hours
    for (const [day, hours] of Object.entries(openingHours)) {
      if (!hours.is_closed && hours.open_time && hours.close_time) {
        const openMinutes = timeToMinutes(hours.open_time);
        const closeMinutes = timeToMinutes(hours.close_time);
        const duration = closeMinutes - openMinutes;

        if (duration > 14 * 60) { // More than 14 hours
          warnings.push({
            field: 'long_hours',
            message: `Very long opening hours for day ${day} (${Math.floor(duration / 60)} hours)`,
            suggestion: 'Consider adding breaks for very long opening hours'
          });
        }
      }
    }

    suggestions.push('Opening hours format is valid');
    if (!specialHours || specialHours.length === 0) {
      suggestions.push('Consider adding special hours for holidays or events');
    }
  }

  return {
    is_valid: errors.length === 0,
    errors,
    warnings,
    suggestions
  };
}

function calculateCurrentOpenStatus(
  openingHours: OpeningHours,
  specialHours: SpecialHours[],
  timezone: string
): { is_open: boolean; next_change: { time: string; status: 'open' | 'closed' } | null } {
  const now = new Date();
  const todayDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const currentDay = now.getDay();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const currentMinutes = timeToMinutes(currentTime);

  // Check for special hours first
  const todaySpecial = specialHours.find(sh => sh.date === todayDate);
  if (todaySpecial) {
    if (todaySpecial.is_closed) {
      return { is_open: false, next_change: null };
    }
    
    const openMinutes = timeToMinutes(todaySpecial.open_time || '00:00');
    const closeMinutes = timeToMinutes(todaySpecial.close_time || '23:59');
    
    const is_open = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
    
    let next_change = null;
    if (is_open && todaySpecial.close_time) {
      next_change = {
        time: todaySpecial.close_time,
        status: 'closed' as const
      };
    } else if (!is_open && todaySpecial.open_time && currentMinutes < openMinutes) {
      next_change = {
        time: todaySpecial.open_time,
        status: 'open' as const
      };
    }
    
    return { is_open, next_change };
  }

  // Check regular hours
  const todayHours = openingHours[currentDay.toString()];
  if (!todayHours || todayHours.is_closed) {
    return { is_open: false, next_change: null };
  }

  const openMinutes = timeToMinutes(todayHours.open_time || '00:00');
  const closeMinutes = timeToMinutes(todayHours.close_time || '23:59');
  
  let is_open = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  
  // Check if currently in a break
  if (is_open && todayHours.breaks) {
    for (const breakItem of todayHours.breaks) {
      const breakStart = timeToMinutes(breakItem.start_time);
      const breakEnd = timeToMinutes(breakItem.end_time);
      
      if (currentMinutes >= breakStart && currentMinutes < breakEnd) {
        is_open = false;
        break;
      }
    }
  }

  let next_change = null;
  if (is_open && todayHours.close_time) {
    next_change = {
      time: todayHours.close_time,
      status: 'closed' as const
    };
  } else if (!is_open && todayHours.open_time && currentMinutes < openMinutes) {
    next_change = {
      time: todayHours.open_time,
      status: 'open' as const
    };
  }

  return { is_open, next_change };
}

function isValidTimeFormat(time: string): boolean {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}

function isValidDateFormat(date: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;
  
  const dateObj = new Date(date);
  return dateObj.toISOString().split('T')[0] === date;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Geographic Search Optimization Handlers

async function handleOptimizedGeographicSearch(
  req: Request,
  supabase: any,
  userId: string
): Promise<Response> {
  try {
    const url = new URL(req.url);
    const latitude = parseFloat(url.searchParams.get('latitude') || '0');
    const longitude = parseFloat(url.searchParams.get('longitude') || '0');
    const radiusKm = parseFloat(url.searchParams.get('radius_km') || '10');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const useFastDistance = url.searchParams.get('use_fast_distance') === 'true';
    const tripId = url.searchParams.get('trip_id');

    // Validate coordinates
    if (latitude === 0 && longitude === 0) {
      return new Response(
        JSON.stringify({ error: 'Valid latitude and longitude are required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    const startTime = Date.now();

    // Perform optimized search
    const places = await performOptimizedGeographicSearch(supabase, {
      latitude,
      longitude,
      radius_km: radiusKm,
      limit,
      use_fast_distance: useFastDistance
    });

    // Filter by trip if specified
    let filteredPlaces = places;
    if (tripId) {
      // Verify user has access to the trip
      const { data: tripMember } = await supabase
        .from('trip_members')
        .select('role')
        .eq('trip_id', tripId)
        .eq('user_id', userId)
        .single();

      if (!tripMember) {
        return new Response(
          JSON.stringify({ error: 'Access denied to trip' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403
          }
        );
      }

      filteredPlaces = places.filter(place => place.trip_id === tripId);
    }

    const executionTime = Date.now() - startTime;

    // Log performance metrics
    logGeographicSearchMetrics({
      search_type: 'radius',
      execution_time_ms: executionTime,
      places_found: filteredPlaces.length,
      search_radius_km: radiusKm,
      optimization_used: useFastDistance ? 'fast_distance' : 'haversine',
      bbox_filter_reduction: Math.round((1 - filteredPlaces.length / Math.max(places.length, 1)) * 100)
    });

    // Record usage event
    await recordUsageEvent(supabase, userId, 'geo_search', {
      search_radius_km: radiusKm,
      places_found: filteredPlaces.length,
      execution_time_ms: executionTime,
      optimization_used: useFastDistance ? 'fast_distance' : 'haversine'
    });

    return new Response(
      JSON.stringify({
        success: true,
        places: filteredPlaces,
        search_params: {
          center: { latitude, longitude },
          radius_km: radiusKm,
          optimization: useFastDistance ? 'fast_distance' : 'haversine'
        },
        performance: {
          execution_time_ms: executionTime,
          places_found: filteredPlaces.length,
          total_scanned: places.length
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in optimized geographic search:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error during geographic search' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
}

async function handleViewportSearch(
  req: Request,
  supabase: any,
  userId: string
): Promise<Response> {
  try {
    const url = new URL(req.url);
    const neLat = parseFloat(url.searchParams.get('ne_lat') || '0');
    const neLng = parseFloat(url.searchParams.get('ne_lng') || '0');
    const swLat = parseFloat(url.searchParams.get('sw_lat') || '0');
    const swLng = parseFloat(url.searchParams.get('sw_lng') || '0');
    const maxPlaces = parseInt(url.searchParams.get('max_places') || '200');
    const enableClustering = url.searchParams.get('clustering') === 'true';
    const clusterRadius = parseFloat(url.searchParams.get('cluster_radius') || '1');
    const tripId = url.searchParams.get('trip_id');

    // Validate viewport bounds
    if (neLat === 0 || neLng === 0 || swLat === 0 || swLng === 0) {
      return new Response(
        JSON.stringify({ error: 'Valid viewport bounds are required (ne_lat, ne_lng, sw_lat, sw_lng)' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    const startTime = Date.now();

    const viewport = {
      northEast: { latitude: neLat, longitude: neLng },
      southWest: { latitude: swLat, longitude: swLng }
    };

    // Get places in viewport with optional clustering
    let result = await getPlacesInViewport(supabase, viewport, {
      maxPlaces,
      clustering: enableClustering,
      clusterRadius
    });

    // Filter by trip if specified
    if (tripId) {
      const { data: tripMember } = await supabase
        .from('trip_members')
        .select('role')
        .eq('trip_id', tripId)
        .eq('user_id', userId)
        .single();

      if (!tripMember) {
        return new Response(
          JSON.stringify({ error: 'Access denied to trip' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403
          }
        );
      }

      result.places = result.places.filter(place => place.trip_id === tripId);
      
      // Re-apply clustering to filtered places if enabled
      if (enableClustering) {
        const clusterPoints: ClusterPoint[] = result.places.map(place => ({
          id: place.id,
          latitude: place.latitude,
          longitude: place.longitude,
          data: place
        }));
        
        result.clusters = createGeographicClusters(clusterPoints, clusterRadius);
        result.viewport_stats.clustered_places = result.clusters.reduce((sum, cluster) => sum + cluster.points.length, 0);
        result.viewport_stats.visible_clusters = result.clusters.length;
      }
    }

    const executionTime = Date.now() - startTime;

    // Calculate viewport area
    const viewportAreaKm2 = calculateViewportArea(viewport);

    // Log performance metrics
    logGeographicSearchMetrics({
      search_type: 'viewport',
      execution_time_ms: executionTime,
      places_found: result.places.length,
      viewport_area_km2: viewportAreaKm2,
      optimization_used: enableClustering ? 'clustering' : 'none'
    });

    // Record usage event
    await recordUsageEvent(supabase, userId, 'viewport_search', {
      viewport_area_km2: viewportAreaKm2,
      places_found: result.places.length,
      clustering_enabled: enableClustering,
      execution_time_ms: executionTime
    });

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
        viewport: viewport,
        performance: {
          execution_time_ms: executionTime,
          viewport_area_km2: viewportAreaKm2
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in viewport search:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error during viewport search' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
}

async function handleGeographicClustering(
  req: Request,
  supabase: any,
  userId: string
): Promise<Response> {
  try {
    const url = new URL(req.url);
    const tripId = url.searchParams.get('trip_id');
    const clusterRadius = parseFloat(url.searchParams.get('cluster_radius') || '1');
    const minClusterSize = parseInt(url.searchParams.get('min_cluster_size') || '2');

    if (!tripId) {
      return new Response(
        JSON.stringify({ error: 'trip_id is required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // Verify user has access to the trip
    const { data: tripMember } = await supabase
      .from('trip_members')
      .select('role')
      .eq('trip_id', tripId)
      .eq('user_id', userId)
      .single();

    if (!tripMember) {
      return new Response(
        JSON.stringify({ error: 'Access denied to trip' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403
        }
      );
    }

    const startTime = Date.now();

    // Get all places in the trip with coordinates
    const { data: places, error } = await supabase
      .from('places')
      .select('*')
      .eq('trip_id', tripId)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (error) throw error;

    // Convert places to cluster points
    const clusterPoints: ClusterPoint[] = places.map(place => ({
      id: place.id,
      latitude: place.latitude,
      longitude: place.longitude,
      data: place
    }));

    // Create clusters
    const clusters = createGeographicClusters(clusterPoints, clusterRadius);

    // Filter clusters by minimum size
    const filteredClusters = clusters.filter(cluster => cluster.points.length >= minClusterSize);

    // Calculate cluster statistics
    const clusterStats = {
      total_places: places.length,
      clustered_places: filteredClusters.reduce((sum, cluster) => sum + cluster.points.length, 0),
      num_clusters: filteredClusters.length,
      avg_cluster_size: filteredClusters.length > 0 
        ? Math.round(filteredClusters.reduce((sum, cluster) => sum + cluster.points.length, 0) / filteredClusters.length * 100) / 100
        : 0,
      largest_cluster: filteredClusters.length > 0 
        ? Math.max(...filteredClusters.map(cluster => cluster.points.length))
        : 0
    };

    const executionTime = Date.now() - startTime;

    // Log performance metrics
    logGeographicSearchMetrics({
      search_type: 'cluster',
      execution_time_ms: executionTime,
      places_found: places.length,
      optimization_used: 'geographic_clustering'
    });

    // Record usage event
    await recordUsageEvent(supabase, userId, 'geographic_clustering', {
      trip_id: tripId,
      cluster_radius: clusterRadius,
      clusters_found: filteredClusters.length,
      clustered_places: clusterStats.clustered_places,
      execution_time_ms: executionTime
    });

    return new Response(
      JSON.stringify({
        success: true,
        clusters: filteredClusters,
        cluster_stats: clusterStats,
        parameters: {
          cluster_radius: clusterRadius,
          min_cluster_size: minClusterSize
        },
        performance: {
          execution_time_ms: executionTime
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in geographic clustering:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error during geographic clustering' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
}

// Helper function to calculate viewport area
function calculateViewportArea(viewport: {
  northEast: { latitude: number; longitude: number };
  southWest: { latitude: number; longitude: number };
}): number {
  const { northEast, southWest } = viewport;
  
  // Calculate area using the spherical excess formula (approximation)
  const latDiff = northEast.latitude - southWest.latitude;
  const lngDiff = northEast.longitude - southWest.longitude;
  
  // Convert to radians
  const latDiffRad = latDiff * Math.PI / 180;
  const lngDiffRad = lngDiff * Math.PI / 180;
  const avgLatRad = (northEast.latitude + southWest.latitude) / 2 * Math.PI / 180;
  
  // Earth's radius in km
  const R = 6371;
  
  // Approximate area calculation
  const area = R * R * latDiffRad * lngDiffRad * Math.cos(avgLatRad);
  
  return Math.abs(area);
}

// Data Synchronization Handler Functions

async function handleGetSyncStatus(req: Request, supabaseClient: SupabaseClient, userId: string): Promise<Response> {
  try {
    const url = new URL(req.url);
    const tripId = url.searchParams.get('trip_id');

    if (!tripId) {
      return new Response(JSON.stringify({
        error: 'trip_id parameter is required'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Get trip sync status
    const { data: syncData, error: syncError } = await supabaseClient
      .from('trip_sync_status')
      .select('*')
      .eq('trip_id', tripId)
      .single();

    if (syncError && syncError.code !== 'PGRST116') {
      throw syncError;
    }

    // Count places in trip
    const { count: placesCount, error: placesError } = await supabaseClient
      .from('places')
      .select('*', { count: 'exact', head: true })
      .eq('trip_id', tripId);

    if (placesError) throw placesError;

    // Check for pending changes
    const { count: pendingCount, error: pendingError } = await supabaseClient
      .from('place_changes')
      .select('*', { count: 'exact', head: true })
      .eq('trip_id', tripId)
      .eq('status', 'pending');

    if (pendingError) throw pendingError;

    // Check for conflicts
    const { count: conflictsCount, error: conflictsError } = await supabaseClient
      .from('sync_conflicts')
      .select('*', { count: 'exact', head: true })
      .eq('trip_id', tripId)
      .eq('resolved', false);

    if (conflictsError) throw conflictsError;

    const status: SyncStatus = {
      trip_id: tripId,
      last_sync: syncData?.last_sync || new Date().toISOString(),
      sync_version: syncData?.sync_version || 1,
      places_count: placesCount || 0,
      pending_changes: pendingCount || 0,
      conflicts_count: conflictsCount || 0,
      status: conflictsCount > 0 ? 'conflict' : 
              pendingCount > 0 ? 'pending' : 'synced'
    };

    return new Response(JSON.stringify({
      success: true,
      data: status
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting sync status:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get sync status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleCheckDataIntegrity(req: Request, supabaseClient: SupabaseClient, userId: string): Promise<Response> {
  try {
    const url = new URL(req.url);
    const tripId = url.searchParams.get('trip_id');

    if (!tripId) {
      return new Response(JSON.stringify({
        error: 'trip_id parameter is required'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const checks: DataIntegrityCheck[] = [];

    // Check 1: Orphaned places
    const { data: orphanedPlaces, error: orphanError } = await supabaseClient
      .from('places')
      .select('id')
      .eq('trip_id', tripId)
      .is('trip_id', null);

    checks.push({
      check_type: 'orphaned_places',
      passed: !orphanedPlaces || orphanedPlaces.length === 0,
      details: `Found ${orphanedPlaces?.length || 0} orphaned places`,
      error_count: orphanedPlaces?.length || 0,
      suggestions: orphanedPlaces?.length > 0 ? ['Reassign places to correct trip', 'Remove orphaned places'] : []
    });

    // Check 2: Duplicate places
    const { data: duplicates, error: dupError } = await supabaseClient
      .from('places')
      .select('name, latitude, longitude, count(*)')
      .eq('trip_id', tripId)
      .group('name, latitude, longitude')
      .having('count(*) > 1');

    checks.push({
      check_type: 'duplicate_places',
      passed: !duplicates || duplicates.length === 0,
      details: `Found ${duplicates?.length || 0} sets of duplicate places`,
      error_count: duplicates?.length || 0,
      suggestions: duplicates?.length > 0 ? ['Merge duplicate places', 'Review place creation process'] : []
    });

    // Check 3: Invalid coordinates
    const { data: invalidCoords, error: coordError } = await supabaseClient
      .from('places')
      .select('id, latitude, longitude')
      .eq('trip_id', tripId)
      .or('latitude.is.null,longitude.is.null,latitude.lt.-90,latitude.gt.90,longitude.lt.-180,longitude.gt.180');

    checks.push({
      check_type: 'invalid_coordinates',
      passed: !invalidCoords || invalidCoords.length === 0,
      details: `Found ${invalidCoords?.length || 0} places with invalid coordinates`,
      error_count: invalidCoords?.length || 0,
      suggestions: invalidCoords?.length > 0 ? ['Validate coordinate inputs', 'Use geocoding service'] : []
    });

    // Check 4: Missing required data
    const { data: missingData, error: missingError } = await supabaseClient
      .from('places')
      .select('id, name, category')
      .eq('trip_id', tripId)
      .or('name.is.null,category.is.null');

    checks.push({
      check_type: 'missing_required_data',
      passed: !missingData || missingData.length === 0,
      details: `Found ${missingData?.length || 0} places with missing required data`,
      error_count: missingData?.length || 0,
      suggestions: missingData?.length > 0 ? ['Complete missing place information', 'Implement data validation'] : []
    });

    // Overall integrity score
    const totalPassed = checks.filter(c => c.passed).length;
    const integrityScore = (totalPassed / checks.length) * 100;

    return new Response(JSON.stringify({
      success: true,
      data: {
        integrity_score: integrityScore,
        checks: checks,
        overall_status: integrityScore === 100 ? 'excellent' : 
                       integrityScore >= 80 ? 'good' : 
                       integrityScore >= 60 ? 'fair' : 'poor',
        recommendations: integrityScore < 100 ? 
          ['Run data cleanup procedures', 'Implement stricter validation', 'Regular integrity monitoring'] : 
          ['Maintain current data quality standards']
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error checking data integrity:', error);
    return new Response(JSON.stringify({
      error: 'Failed to check data integrity',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleDetectSyncConflicts(req: Request, supabaseClient: SupabaseClient, userId: string): Promise<Response> {
  try {
    const url = new URL(req.url);
    const tripId = url.searchParams.get('trip_id');

    if (!tripId) {
      return new Response(JSON.stringify({
        error: 'trip_id parameter is required'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Get unresolved conflicts
    const { data: conflicts, error: conflictsError } = await supabaseClient
      .from('sync_conflicts')
      .select('*')
      .eq('trip_id', tripId)
      .eq('resolved', false)
      .order('created_at', { ascending: false });

    if (conflictsError) throw conflictsError;

    // Detect new conflicts by checking for version mismatches
    const { data: places, error: placesError } = await supabaseClient
      .from('places')
      .select('id, name, sync_version, last_modified_at, last_modified_by')
      .eq('trip_id', tripId);

    if (placesError) throw placesError;

    const newConflicts: SyncConflict[] = [];

    // Check for concurrent modifications
    for (const place of places || []) {
      const { data: modifications, error: modError } = await supabaseClient
        .from('place_modifications')
        .select('*')
        .eq('place_id', place.id)
        .gte('modified_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
        .order('modified_at', { ascending: false });

      if (modError) continue;

      if (modifications && modifications.length > 1) {
        // Multiple modifications in short time - potential conflict
        const latestMod = modifications[0];
        const conflictingMod = modifications[1];

        newConflicts.push({
          place_id: place.id,
          conflict_type: 'concurrent_edit',
          local_version: latestMod,
          remote_version: conflictingMod,
          last_modified_by: latestMod.modified_by,
          last_modified_at: latestMod.modified_at,
          resolution_required: true
        });
      }
    }

    // Store new conflicts
    if (newConflicts.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('sync_conflicts')
        .insert(newConflicts.map(conflict => ({
          trip_id: tripId,
          place_id: conflict.place_id,
          conflict_type: conflict.conflict_type,
          conflict_data: conflict,
          resolved: false,
          created_at: new Date().toISOString()
        })));

      if (insertError) {
        console.error('Error storing conflicts:', insertError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        existing_conflicts: conflicts || [],
        new_conflicts: newConflicts,
        total_conflicts: (conflicts?.length || 0) + newConflicts.length,
        requires_resolution: newConflicts.some(c => c.resolution_required) || 
                           (conflicts && conflicts.some(c => !c.resolved))
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error detecting sync conflicts:', error);
    return new Response(JSON.stringify({
      error: 'Failed to detect sync conflicts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleGetSyncStats(req: Request, supabaseClient: SupabaseClient, userId: string): Promise<Response> {
  try {
    const url = new URL(req.url);
    const tripId = url.searchParams.get('trip_id');
    const timeRange = url.searchParams.get('time_range') || '24h';

    if (!tripId) {
      return new Response(JSON.stringify({
        error: 'trip_id parameter is required'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const since = new Date();
    switch (timeRange) {
      case '1h': since.setHours(since.getHours() - 1); break;
      case '24h': since.setHours(since.getHours() - 24); break;
      case '7d': since.setDate(since.getDate() - 7); break;
      case '30d': since.setDate(since.getDate() - 30); break;
      default: since.setHours(since.getHours() - 24);
    }

    // Get sync operations
    const { data: syncOps, error: syncError } = await supabaseClient
      .from('sync_operations')
      .select('*')
      .eq('trip_id', tripId)
      .gte('created_at', since.toISOString());

    if (syncError) throw syncError;

    const totalSyncs = syncOps?.length || 0;
    const successfulSyncs = syncOps?.filter(op => op.status === 'success').length || 0;
    const failedSyncs = totalSyncs - successfulSyncs;

    const avgSyncTime = totalSyncs > 0 ? 
      (syncOps?.reduce((sum, op) => sum + (op.duration_ms || 0), 0) || 0) / totalSyncs : 0;

    // Get data integrity score
    const { data: integrityCheck } = await supabaseClient
      .from('data_integrity_checks')
      .select('integrity_score')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Get conflicts resolution rate
    const { data: allConflicts } = await supabaseClient
      .from('sync_conflicts')
      .select('resolved')
      .eq('trip_id', tripId);

    const totalConflicts = allConflicts?.length || 0;
    const resolvedConflicts = allConflicts?.filter(c => c.resolved).length || 0;
    const resolutionRate = totalConflicts > 0 ? (resolvedConflicts / totalConflicts) * 100 : 100;

    const stats: SyncStatistics = {
      total_syncs: totalSyncs,
      successful_syncs: successfulSyncs,
      failed_syncs: failedSyncs,
      avg_sync_time_ms: Math.round(avgSyncTime),
      data_integrity_score: integrityCheck?.integrity_score || 100,
      last_24h_syncs: syncOps?.filter(op => 
        new Date(op.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length || 0,
      conflict_resolution_rate: Math.round(resolutionRate)
    };

    return new Response(JSON.stringify({
      success: true,
      data: stats,
      meta: {
        time_range: timeRange,
        since: since.toISOString(),
        generated_at: new Date().toISOString()
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting sync stats:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get sync statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleForceSynchronization(req: Request, supabaseClient: SupabaseClient, userId: string): Promise<Response> {
  try {
    const syncRequest: SyncRequest = await req.json();

    if (!syncRequest.trip_id) {
      return new Response(JSON.stringify({
        error: 'trip_id is required'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const startTime = Date.now();
    const syncId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Log sync start
    await supabaseClient
      .from('sync_operations')
      .insert({
        id: syncId,
        trip_id: syncRequest.trip_id,
        operation_type: 'force_sync',
        status: 'in_progress',
        initiated_by: userId,
        created_at: new Date().toISOString()
      });

    let changesApplied = 0;
    let conflictsDetected = 0;
    const errors: string[] = [];

    try {
      // Get all places for the trip
      const { data: places, error: placesError } = await supabaseClient
        .from('places')
        .select('*')
        .eq('trip_id', syncRequest.trip_id);

      if (placesError) throw placesError;

      // Sync place data
      for (const place of places || []) {
        try {
          // Update sync version and timestamp
          const { error: updateError } = await supabaseClient
            .from('places')
            .update({
              sync_version: (place.sync_version || 0) + 1,
              last_synced_at: new Date().toISOString(),
              synced_by: userId
            })
            .eq('id', place.id);

          if (updateError) throw updateError;

          changesApplied++;

          // Sync additional data if requested
          if (syncRequest.include_images) {
            const { error: imageError } = await supabaseClient
              .from('place_images')
              .update({ last_synced_at: new Date().toISOString() })
              .eq('place_id', place.id);

            if (imageError) errors.push(`Image sync failed for place ${place.id}: ${imageError.message}`);
          }

          if (syncRequest.include_ratings) {
            const { error: ratingError } = await supabaseClient
              .from('place_ratings')
              .update({ last_synced_at: new Date().toISOString() })
              .eq('place_id', place.id);

            if (ratingError) errors.push(`Rating sync failed for place ${place.id}: ${ratingError.message}`);
          }

          if (syncRequest.include_opening_hours) {
            const { error: hoursError } = await supabaseClient
              .from('place_opening_hours')
              .update({ last_synced_at: new Date().toISOString() })
              .eq('place_id', place.id);

            if (hoursError) errors.push(`Hours sync failed for place ${place.id}: ${hoursError.message}`);
          }

        } catch (placeError) {
          errors.push(`Place sync failed for ${place.id}: ${placeError instanceof Error ? placeError.message : 'Unknown error'}`);
          conflictsDetected++;
        }
      }

      // Update trip sync status
      const { error: tripSyncError } = await supabaseClient
        .from('trip_sync_status')
        .upsert({
          trip_id: syncRequest.trip_id,
          last_sync: new Date().toISOString(),
          sync_version: Date.now(),
          synced_by: userId
        });

      if (tripSyncError) errors.push(`Trip sync status update failed: ${tripSyncError.message}`);

      const executionTime = Date.now() - startTime;
      const dataTransferred = changesApplied * 1.5; // Approximate KB

      const response: SyncResponse = {
        success: errors.length === 0,
        sync_id: syncId,
        changes_applied: changesApplied,
        conflicts_detected: conflictsDetected,
        errors: errors,
        performance: {
          execution_time_ms: executionTime,
          data_transferred_kb: dataTransferred
        }
      };

      // Update sync operation status
      await supabaseClient
        .from('sync_operations')
        .update({
          status: errors.length === 0 ? 'success' : 'failed',
          changes_applied: changesApplied,
          conflicts_detected: conflictsDetected,
          duration_ms: executionTime,
          error_details: errors.length > 0 ? errors : null,
          completed_at: new Date().toISOString()
        })
        .eq('id', syncId);

      return new Response(JSON.stringify({
        success: true,
        data: response
      }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (syncError) {
      // Mark sync as failed
      await supabaseClient
        .from('sync_operations')
        .update({
          status: 'failed',
          error_details: [syncError instanceof Error ? syncError.message : 'Unknown sync error'],
          completed_at: new Date().toISOString()
        })
        .eq('id', syncId);

      throw syncError;
    }

  } catch (error) {
    console.error('Error in force synchronization:', error);
    return new Response(JSON.stringify({
      error: 'Force synchronization failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleResolveSyncConflicts(req: Request, supabaseClient: SupabaseClient, userId: string): Promise<Response> {
  try {
    const resolutions: ConflictResolution[] = await req.json();

    if (!Array.isArray(resolutions) || resolutions.length === 0) {
      return new Response(JSON.stringify({
        error: 'Array of conflict resolutions is required'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const results = [];

    for (const resolution of resolutions) {
      try {
        // Get conflict details
        const { data: conflict, error: conflictError } = await supabaseClient
          .from('sync_conflicts')
          .select('*')
          .eq('id', resolution.conflict_id)
          .single();

        if (conflictError) throw conflictError;

        if (!conflict) {
          results.push({
            conflict_id: resolution.conflict_id,
            success: false,
            error: 'Conflict not found'
          });
          continue;
        }

        // Apply resolution based on strategy
        let resolvedData = null;

        switch (resolution.resolution_strategy) {
          case 'use_local':
            resolvedData = conflict.conflict_data.local_version;
            break;
          case 'use_remote':
            resolvedData = conflict.conflict_data.remote_version;
            break;
          case 'merge':
            resolvedData = resolution.merged_data || {
              ...conflict.conflict_data.remote_version,
              ...conflict.conflict_data.local_version
            };
            break;
          case 'manual':
            resolvedData = resolution.merged_data;
            break;
          default:
            throw new Error(`Invalid resolution strategy: ${resolution.resolution_strategy}`);
        }

        // Update the place with resolved data
        if (resolvedData) {
          const { error: updateError } = await supabaseClient
            .from('places')
            .update({
              ...resolvedData,
              sync_version: (conflict.conflict_data.local_version.sync_version || 0) + 1,
              last_modified_at: new Date().toISOString(),
              last_modified_by: userId
            })
            .eq('id', conflict.place_id);

          if (updateError) throw updateError;
        }

        // Mark conflict as resolved
        const { error: resolveError } = await supabaseClient
          .from('sync_conflicts')
          .update({
            resolved: true,
            resolution_strategy: resolution.resolution_strategy,
            resolved_by: userId,
            resolved_at: new Date().toISOString(),
            resolution_comment: resolution.comment
          })
          .eq('id', resolution.conflict_id);

        if (resolveError) throw resolveError;

        results.push({
          conflict_id: resolution.conflict_id,
          success: true,
          applied_strategy: resolution.resolution_strategy
        });

      } catch (resolutionError) {
        results.push({
          conflict_id: resolution.conflict_id,
          success: false,
          error: resolutionError instanceof Error ? resolutionError.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    return new Response(JSON.stringify({
      success: failureCount === 0,
      data: {
        total_resolutions: results.length,
        successful_resolutions: successCount,
        failed_resolutions: failureCount,
        results: results
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error resolving sync conflicts:', error);
    return new Response(JSON.stringify({
      error: 'Failed to resolve sync conflicts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleValidateSyncData(req: Request, supabaseClient: SupabaseClient, userId: string): Promise<Response> {
  try {
    const { trip_id } = await req.json();

    if (!trip_id) {
      return new Response(JSON.stringify({
        error: 'trip_id is required'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const validationResults = [];

    // Validate sync versions consistency
    const { data: places, error: placesError } = await supabaseClient
      .from('places')
      .select('id, name, sync_version, last_synced_at')
      .eq('trip_id', trip_id);

    if (placesError) throw placesError;

    // Check for version inconsistencies
    const versionIssues = (places || []).filter(place => 
      !place.sync_version || place.sync_version < 1
    );

    validationResults.push({
      validation_type: 'sync_versions',
      passed: versionIssues.length === 0,
      issues_found: versionIssues.length,
      details: versionIssues.length > 0 ? 
        `${versionIssues.length} places have invalid sync versions` : 
        'All places have valid sync versions'
    });

    // Validate sync timestamps
    const staleThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    const stalePlaces = (places || []).filter(place => 
      !place.last_synced_at || new Date(place.last_synced_at) < staleThreshold
    );

    validationResults.push({
      validation_type: 'sync_freshness',
      passed: stalePlaces.length === 0,
      issues_found: stalePlaces.length,
      details: stalePlaces.length > 0 ? 
        `${stalePlaces.length} places haven't been synced in over 7 days` : 
        'All places have recent sync timestamps'
    });

    // Validate data consistency
    const { data: orphanedData } = await supabaseClient
      .from('place_images')
      .select('place_id')
      .not('place_id', 'in', `(${(places || []).map(p => p.id).join(',')})`);

    validationResults.push({
      validation_type: 'data_consistency',
      passed: !orphanedData || orphanedData.length === 0,
      issues_found: orphanedData?.length || 0,
      details: orphanedData?.length > 0 ? 
        `${orphanedData.length} orphaned image records found` : 
        'No orphaned data detected'
    });

    // Calculate overall validation score
    const passedValidations = validationResults.filter(v => v.passed).length;
    const validationScore = (passedValidations / validationResults.length) * 100;

    // Store validation results
    await supabaseClient
      .from('sync_validations')
      .insert({
        trip_id: trip_id,
        validation_score: validationScore,
        validation_results: validationResults,
        validated_by: userId,
        validated_at: new Date().toISOString()
      });

    return new Response(JSON.stringify({
      success: true,
      data: {
        validation_score: validationScore,
        status: validationScore === 100 ? 'excellent' : 
                validationScore >= 80 ? 'good' : 
                validationScore >= 60 ? 'fair' : 'poor',
        validations: validationResults,
        recommendations: validationScore < 100 ? [
          'Run data cleanup procedures',
          'Perform full synchronization',
          'Review sync frequency settings'
        ] : ['Sync data is healthy']
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error validating sync data:', error);
    return new Response(JSON.stringify({
      error: 'Failed to validate sync data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}