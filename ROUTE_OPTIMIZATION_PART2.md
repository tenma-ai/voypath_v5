# ルート最適化システム実装ガイド - Part 2: ステップ5-8

## ステップ5: Google Places APIでの詳細情報取得

### 実装ファイル: `project/src/services/GooglePlacesService.ts`

```typescript
// GooglePlacesService.ts:1-200
export class GooglePlacesService {
  private static instance: GooglePlacesService;
  private placesService: google.maps.places.PlacesService;
  private photoCache = new Map<string, string[]>();

  // 詳細情報取得のメインメソッド
  async getPlaceDetails(placeId: string): Promise<PlaceDetails> {
    return new Promise((resolve, reject) => {
      const request = {
        placeId: placeId,
        fields: [
          'name',
          'formatted_address',
          'geometry',
          'place_id',
          'types',
          'rating',
          'user_ratings_total',
          'price_level',
          'photos',
          'opening_hours',
          'website',
          'formatted_phone_number',
          'reviews',
          'utc_offset_minutes'
        ]
      };

      this.placesService.getDetails(request, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          const details: PlaceDetails = {
            id: place.place_id || '',
            name: place.name || '',
            address: place.formatted_address || '',
            location: {
              lat: place.geometry?.location?.lat() || 0,
              lng: place.geometry?.location?.lng() || 0
            },
            types: place.types || [],
            rating: place.rating,
            userRatingsTotal: place.user_ratings_total,
            priceLevel: place.price_level,
            photos: this.processPhotos(place.photos || []),
            openingHours: this.processOpeningHours(place.opening_hours),
            website: place.website,
            phoneNumber: place.formatted_phone_number,
            reviews: this.processReviews(place.reviews || []),
            utcOffset: place.utc_offset_minutes
          };
          resolve(details);
        } else {
          reject(new Error(`Failed to get place details: ${status}`));
        }
      });
    });
  }

  // 写真URLの処理と最適化
  private processPhotos(photos: google.maps.places.PlacePhoto[]): PhotoInfo[] {
    return photos.slice(0, 10).map(photo => ({
      url: photo.getUrl({
        maxWidth: 800,
        maxHeight: 600
      }),
      attributions: photo.html_attributions || []
    }));
  }

  // 営業時間の処理
  private processOpeningHours(hours?: google.maps.places.PlaceOpeningHours): OpeningHours | undefined {
    if (!hours) return undefined;

    return {
      weekdayText: hours.weekday_text || [],
      periods: hours.periods?.map(period => ({
        open: {
          day: period.open?.day || 0,
          time: period.open?.time || '',
          hours: parseInt(period.open?.time?.substring(0, 2) || '0'),
          minutes: parseInt(period.open?.time?.substring(2, 4) || '0')
        },
        close: period.close ? {
          day: period.close.day || 0,
          time: period.close.time || '',
          hours: parseInt(period.close.time?.substring(0, 2) || '0'),
          minutes: parseInt(period.close.time?.substring(2, 4) || '0')
        } : undefined
      })) || []
    };
  }
}
```

### エラーハンドリングとリトライロジック: `project/src/utils/RetryHandler.ts`

```typescript
// RetryHandler.ts:1-50
export class RetryHandler {
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      baseDelay?: number;
      maxDelay?: number;
      shouldRetry?: (error: any) => boolean;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      shouldRetry = (error) => this.isRetryableError(error)
    } = options;

    let lastError: any;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (!shouldRetry(error) || attempt === maxRetries - 1) {
          throw error;
        }
        
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  private static isRetryableError(error: any): boolean {
    // Google Maps APIのレート制限エラー
    if (error.status === 'OVER_QUERY_LIMIT') return true;
    
    // ネットワークエラー
    if (error.code === 'NETWORK_ERROR') return true;
    
    // タイムアウトエラー
    if (error.code === 'TIMEOUT') return true;
    
    return false;
  }
}
```

## ステップ6: 旅行メンバーの色分けシステム

### 実装ファイル: `project/src/services/MemberColorService.ts`

```typescript
// MemberColorService.ts:1-100
export class MemberColorService {
  private static instance: MemberColorService;
  private memberColors = new Map<string, string>();
  
  // カラーパレット定義（視認性とアクセシビリティを考慮）
  private readonly colorPalette = [
    '#3B82F6', // Blue
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#14B8A6', // Teal
    '#F97316', // Orange
    '#84CC16', // Lime
    '#06B6D4'  // Cyan
  ];

  // メンバーへの色割り当て
  assignColorToMember(memberId: string, existingAssignments: Map<string, string> = new Map()): string {
    // 既存の割り当てがある場合はそれを使用
    if (existingAssignments.has(memberId)) {
      return existingAssignments.get(memberId)!;
    }

    // 使用済みの色を特定
    const usedColors = new Set(existingAssignments.values());
    
    // 未使用の色から選択
    const availableColors = this.colorPalette.filter(color => !usedColors.has(color));
    
    // 利用可能な色がある場合は最初の色を使用
    if (availableColors.length > 0) {
      const assignedColor = availableColors[0];
      this.memberColors.set(memberId, assignedColor);
      return assignedColor;
    }
    
    // すべての色が使用済みの場合は、最も使用頻度の低い色を選択
    const colorUsageCount = new Map<string, number>();
    this.colorPalette.forEach(color => colorUsageCount.set(color, 0));
    
    existingAssignments.forEach(color => {
      const count = colorUsageCount.get(color) || 0;
      colorUsageCount.set(color, count + 1);
    });
    
    const leastUsedColor = [...colorUsageCount.entries()]
      .sort((a, b) => a[1] - b[1])[0][0];
    
    this.memberColors.set(memberId, leastUsedColor);
    return leastUsedColor;
  }

  // 場所とメンバーの関連付けを色で表示
  getPlaceColorsByMembers(place: Place, memberPreferences: MemberPreference[]): MemberColorAssignment[] {
    const assignments: MemberColorAssignment[] = [];
    
    memberPreferences.forEach(member => {
      const isSelected = member.selectedPlaces.some(p => p.id === place.id);
      if (isSelected) {
        assignments.push({
          memberId: member.id,
          memberName: member.name,
          color: this.getMemberColor(member.id),
          opacity: 1.0
        });
      }
    });
    
    return assignments;
  }
}
```

## ステップ7: 最適な場所の選定アルゴリズム

### 実装ファイル: `project/supabase/functions/select-optimal-places/index.ts`

```typescript
// select-optimal-places/index.ts:1-250
interface PlaceSelectionRequest {
  tripId: string;
  candidatePlaces: Place[];
  memberPreferences: MemberPreference[];
  tripDuration: number;
  startLocation: Location;
  endLocation: Location;
}

async function selectOptimalPlaces(request: PlaceSelectionRequest): Promise<Place[]> {
  const {
    candidatePlaces,
    memberPreferences,
    tripDuration,
    startLocation,
    endLocation
  } = request;

  // 1. 各場所のスコアを計算
  const scoredPlaces = candidatePlaces.map(place => ({
    place,
    score: calculatePlaceScore(place, memberPreferences, startLocation, endLocation)
  }));

  // 2. 時間制約を考慮した組み合わせ最適化
  const optimalCombination = findOptimalCombination(
    scoredPlaces,
    tripDuration,
    startLocation,
    endLocation
  );

  return optimalCombination;
}

// 場所のスコア計算ロジック
function calculatePlaceScore(
  place: Place,
  memberPreferences: MemberPreference[],
  startLocation: Location,
  endLocation: Location
): number {
  let score = 0;
  
  // 1. メンバーの選好度スコア
  const preferenceScore = calculatePreferenceScore(place, memberPreferences);
  score += preferenceScore * 0.4;
  
  // 2. 評価スコア（Google評価）
  const ratingScore = (place.rating || 0) / 5 * 100;
  score += ratingScore * 0.2;
  
  // 3. 人気度スコア（レビュー数）
  const popularityScore = Math.min(place.userRatingsTotal / 1000, 1) * 100;
  score += popularityScore * 0.1;
  
  // 4. 位置スコア（出発地・目的地との関係）
  const locationScore = calculateLocationScore(place, startLocation, endLocation);
  score += locationScore * 0.3;
  
  return score;
}

// メンバーの選好度計算
function calculatePreferenceScore(
  place: Place,
  memberPreferences: MemberPreference[]
): number {
  if (memberPreferences.length === 0) return 50;
  
  let totalScore = 0;
  let totalWeight = 0;
  
  memberPreferences.forEach(member => {
    const isSelected = member.selectedPlaces.some(p => p.id === place.id);
    const memberScore = isSelected ? 100 : 0;
    const weight = member.priority || 1;
    
    totalScore += memberScore * weight;
    totalWeight += weight;
  });
  
  return totalWeight > 0 ? totalScore / totalWeight : 0;
}

// 組み合わせ最適化アルゴリズム
function findOptimalCombination(
  scoredPlaces: ScoredPlace[],
  availableTime: number,
  startLocation: Location,
  endLocation: Location
): Place[] {
  // 動的計画法による最適化
  const dp: DPState[][] = Array(scoredPlaces.length + 1)
    .fill(null)
    .map(() => Array(Math.floor(availableTime / 30) + 1).fill(null));
  
  // 初期化
  for (let i = 0; i <= scoredPlaces.length; i++) {
    for (let j = 0; j <= Math.floor(availableTime / 30); j++) {
      dp[i][j] = {
        score: 0,
        places: [],
        totalTime: 0
      };
    }
  }
  
  // DP実行
  for (let i = 1; i <= scoredPlaces.length; i++) {
    const currentPlace = scoredPlaces[i - 1];
    const visitTime = estimateVisitTime(currentPlace.place);
    
    for (let j = 0; j <= Math.floor(availableTime / 30); j++) {
      // 現在の場所を選ばない場合
      dp[i][j] = { ...dp[i - 1][j] };
      
      // 現在の場所を選ぶ場合
      const timeSlots = Math.ceil(visitTime / 30);
      if (j >= timeSlots) {
        const newScore = dp[i - 1][j - timeSlots].score + currentPlace.score;
        if (newScore > dp[i][j].score) {
          dp[i][j] = {
            score: newScore,
            places: [...dp[i - 1][j - timeSlots].places, currentPlace.place],
            totalTime: dp[i - 1][j - timeSlots].totalTime + visitTime
          };
        }
      }
    }
  }
  
  // 最適解を見つける
  let bestState = dp[0][0];
  for (let j = 0; j <= Math.floor(availableTime / 30); j++) {
    if (dp[scoredPlaces.length][j].score > bestState.score) {
      bestState = dp[scoredPlaces.length][j];
    }
  }
  
  return bestState.places;
}
```

## ステップ8: リアルタイムルート計算

### 実装ファイル: `project/src/services/RealisticRouteCalculator.ts`

```typescript
// RealisticRouteCalculator.ts:1-300
export class RealisticRouteCalculator {
  private directionsService: google.maps.DirectionsService;
  private distanceMatrixService: google.maps.DistanceMatrixService;

  constructor() {
    this.directionsService = new google.maps.DirectionsService();
    this.distanceMatrixService = new google.maps.DistanceMatrixService();
  }

  // リアルタイムルート計算のメインメソッド
  async calculateRoute(
    waypoints: Waypoint[],
    options: RouteOptions
  ): Promise<RouteCalculationResult> {
    const { travelMode, departureTime, avoidHighways, avoidTolls } = options;
    
    // 1. 出発地と目的地の特定
    const origin = waypoints[0];
    const destination = waypoints[waypoints.length - 1];
    const intermediatePoints = waypoints.slice(1, -1);
    
    // 2. Google Directions APIリクエストの構築
    const request: google.maps.DirectionsRequest = {
      origin: { lat: origin.location.lat, lng: origin.location.lng },
      destination: { lat: destination.location.lat, lng: destination.location.lng },
      waypoints: intermediatePoints.map(point => ({
        location: { lat: point.location.lat, lng: point.location.lng },
        stopover: true
      })),
      travelMode: this.convertTravelMode(travelMode),
      drivingOptions: {
        departureTime: departureTime || new Date(),
        trafficModel: google.maps.TrafficModel.BEST_GUESS
      },
      avoidHighways,
      avoidTolls,
      optimizeWaypoints: false // 既に最適化済みの順序を使用
    };

    try {
      const result = await this.callDirectionsAPI(request);
      return this.processRouteResult(result, waypoints);
    } catch (error) {
      console.error('Route calculation failed:', error);
      throw error;
    }
  }

  // Directions API呼び出し
  private async callDirectionsAPI(
    request: google.maps.DirectionsRequest
  ): Promise<google.maps.DirectionsResult> {
    return new Promise((resolve, reject) => {
      this.directionsService.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          resolve(result);
        } else {
          reject(new Error(`Directions API error: ${status}`));
        }
      });
    });
  }

  // ルート結果の処理と詳細情報の抽出
  private processRouteResult(
    directionsResult: google.maps.DirectionsResult,
    waypoints: Waypoint[]
  ): RouteCalculationResult {
    const route = directionsResult.routes[0];
    const legs = route.legs;
    
    // 各区間の詳細情報を抽出
    const segments: RouteSegment[] = legs.map((leg, index) => ({
      from: waypoints[index],
      to: waypoints[index + 1],
      distance: {
        value: leg.distance?.value || 0,
        text: leg.distance?.text || ''
      },
      duration: {
        value: leg.duration?.value || 0,
        text: leg.duration?.text || ''
      },
      durationInTraffic: leg.duration_in_traffic ? {
        value: leg.duration_in_traffic.value,
        text: leg.duration_in_traffic.text
      } : undefined,
      steps: this.processSteps(leg.steps),
      startAddress: leg.start_address,
      endAddress: leg.end_address
    }));

    // 総計の計算
    const totalDistance = segments.reduce((sum, seg) => sum + seg.distance.value, 0);
    const totalDuration = segments.reduce((sum, seg) => sum + seg.duration.value, 0);
    const totalDurationInTraffic = segments.reduce(
      (sum, seg) => sum + (seg.durationInTraffic?.value || seg.duration.value), 
      0
    );

    return {
      segments,
      totalDistance,
      totalDuration,
      totalDurationInTraffic,
      bounds: route.bounds,
      overviewPolyline: route.overview_polyline,
      warnings: route.warnings || [],
      copyrights: route.copyrights
    };
  }

  // 詳細なステップ情報の処理
  private processSteps(steps: google.maps.DirectionsStep[]): RouteStep[] {
    return steps.map(step => ({
      instructions: step.instructions,
      distance: {
        value: step.distance?.value || 0,
        text: step.distance?.text || ''
      },
      duration: {
        value: step.duration?.value || 0,
        text: step.duration?.text || ''
      },
      startLocation: {
        lat: step.start_location.lat(),
        lng: step.start_location.lng()
      },
      endLocation: {
        lat: step.end_location.lat(),
        lng: step.end_location.lng()
      },
      polyline: step.polyline,
      travelMode: step.travel_mode,
      maneuver: step.maneuver
    }));
  }

  // 交通状況を考慮した時間計算
  async calculateRealisticTravelTime(
    from: Location,
    to: Location,
    departureTime: Date,
    travelMode: TravelMode
  ): Promise<TravelTimeEstimate> {
    const request: google.maps.DistanceMatrixRequest = {
      origins: [{ lat: from.lat, lng: from.lng }],
      destinations: [{ lat: to.lat, lng: to.lng }],
      travelMode: this.convertTravelMode(travelMode),
      drivingOptions: {
        departureTime,
        trafficModel: google.maps.TrafficModel.BEST_GUESS
      },
      unitSystem: google.maps.UnitSystem.METRIC,
      avoidHighways: false,
      avoidTolls: false
    };

    return new Promise((resolve, reject) => {
      this.distanceMatrixService.getDistanceMatrix(request, (response, status) => {
        if (status === google.maps.DistanceMatrixStatus.OK && response) {
          const element = response.rows[0].elements[0];
          
          if (element.status === google.maps.DistanceMatrixElementStatus.OK) {
            resolve({
              distance: element.distance.value,
              duration: element.duration.value,
              durationInTraffic: element.duration_in_traffic?.value,
              fare: element.fare?.value
            });
          } else {
            reject(new Error(`Distance Matrix element error: ${element.status}`));
          }
        } else {
          reject(new Error(`Distance Matrix API error: ${status}`));
        }
      });
    });
  }
}