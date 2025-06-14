# 制約付きルート生成アルゴリズム実装プラン

## 📋 実装詳細プラン

### Phase 1: 基盤アルゴリズム統合 (4-6時間)

#### 1.1 generateConstrainedRoute() 実装
```typescript
// supabase/functions/constrained-route-generation/index.ts
async function generateConstrainedRoute(
  places: Place[],
  departure: Place,
  destination: Place,
  constraints: RouteConstraints,
  tripId: string,
  userId: string,
  supabase: SupabaseClient
): Promise<DetailedSchedule> {
  
  // 1. 出発地・目的地固定の貪欲法ルート
  const baseRoute = [departure, ...optimizeGreedy(places), destination];

  // 2. 交通手段決定 (AirportDB統合)
  const routeWithTransport = await assignTransportModes(baseRoute, constraints, supabase);

  // 3. 移動時間計算
  const routeWithTiming = await calculateTravelTimes(routeWithTransport, supabase);

  // 4. 日程分割
  const maxDailyMinutes = constraints.maxDailyHours * 60;
  const dailyRoutes = splitIntoDays(routeWithTiming, maxDailyMinutes);

  // 5. 食事時間挿入
  const routeWithMeals = insertMealBreaks(dailyRoutes, constraints.mealBreaks);

  // 6. 営業時間調整
  const finalRoutes = await adjustForOpeningHours(routeWithMeals, supabase);

  // 7. 詳細スケジュール構築
  const detailedSchedule = await buildDetailedSchedule(
    tripId,
    finalRoutes,
    routeWithTiming,
    supabase
  );

  return detailedSchedule;
}
```

#### 1.2 optimizeGreedy() 改良実装
```typescript
function optimizeGreedy(places: Place[]): Place[] {
  if (places.length <= 1) return places;
  
  const result: Place[] = [];
  let current = places[0];
  let remaining = places.slice(1);
  result.push(current);
  
  while (remaining.length > 0) {
    // 最も近い場所を選択 (Haversine距離 + wish_level考慮)
    const nearest = remaining.reduce((closest, place) => {
      const currentDist = haversineDistance(current, place);
      const closestDist = haversineDistance(current, closest);
      
      // 距離 + wish_levelによるスコア計算
      const currentScore = currentDist * (1 - (place.wish_level - 1) / 4 * 0.3);
      const closestScore = closestDist * (1 - (closest.wish_level - 1) / 4 * 0.3);
      
      return currentScore < closestScore ? place : closest;
    });
    
    result.push(nearest);
    remaining = remaining.filter(p => p.id !== nearest.id);
    current = nearest;
  }
  
  return result;
}
```

#### 1.3 assignTransportModes() AirportDB統合実装
```typescript
async function assignTransportModes(
  route: Place[], 
  constraints: RouteConstraints,
  supabase: SupabaseClient
): Promise<PlaceWithTransport[]> {
  
  const routeWithTransport: PlaceWithTransport[] = [];
  
  for (let i = 0; i < route.length; i++) {
    const place = route[i];
    
    if (i === 0) {
      routeWithTransport.push({ 
        ...place, 
        transportToNext: null 
      });
      continue;
    }
    
    const prev = route[i - 1];
    const distance = haversineDistance(prev, place);
    
    // AirportDB APIを使用した交通手段決定
    const transportMode = await determineOptimalTransport(
      prev, 
      place, 
      distance, 
      constraints,
      supabase
    );
    
    routeWithTransport.push({
      ...place,
      transportToNext: transportMode,
      travelDistance: distance
    });
  }
  
  return routeWithTransport;
}

async function determineOptimalTransport(
  from: Place,
  to: Place,
  distance: number,
  constraints: RouteConstraints,
  supabase: SupabaseClient
): Promise<TransportMode> {
  
  // 1. 距離ベース基本判定
  if (distance <= constraints.transportModes.walkingMaxKm) {
    return 'walking';
  }
  
  // 2. 長距離の場合、AirportDB APIで空港確認
  if (distance >= constraints.transportModes.flightMinKm) {
    const hasAirports = await checkAirportAvailability(from, to, supabase);
    if (hasAirports.fromAirport && hasAirports.toAirport) {
      return 'flight';
    }
  }
  
  // 3. 中距離の場合
  if (distance >= constraints.transportModes.carMinKm) {
    // 地理的制約確認 (海を越える場合など)
    const isLandConnected = await checkLandConnection(from, to, supabase);
    if (isLandConnected) {
      return 'car';
    } else {
      // 海越えの場合は公共交通機関 (フェリー含む)
      return 'public_transport';
    }
  }
  
  return 'public_transport';
}
```

### Phase 2: 時間・制約計算システム (3-4時間)

#### 2.1 calculateTravelTimes() 実装
```typescript
async function calculateTravelTimes(
  route: PlaceWithTransport[],
  supabase: SupabaseClient
): Promise<PlaceWithTiming[]> {
  
  const routeWithTiming: PlaceWithTiming[] = [];
  
  for (let i = 0; i < route.length; i++) {
    const place = route[i];
    
    if (i === 0) {
      routeWithTiming.push({
        ...place,
        arrivalTime: "09:00",
        travelTimeMinutes: 0
      });
      continue;
    }
    
    const prev = route[i - 1];
    const travelTime = await calculateRealisticTravelTime(
      prev,
      place,
      place.transportToNext!,
      supabase
    );
    
    routeWithTiming.push({
      ...place,
      travelTimeMinutes: travelTime
    });
  }
  
  return routeWithTiming;
}

async function calculateRealisticTravelTime(
  from: Place,
  to: Place,
  mode: TransportMode,
  supabase: SupabaseClient
): Promise<number> {
  
  const distance = haversineDistance(from, to);
  
  // 基本速度定義 (km/h)
  const speedKmH = {
    walking: 4,
    public_transport: 25,
    car: 50,
    flight: 600
  };
  
  let travelTime = (distance / speedKmH[mode]) * 60; // 分に変換
  
  // 交通手段別追加時間
  switch (mode) {
    case 'flight':
      travelTime += 180; // 空港手続き3時間
      break;
    case 'public_transport':
      travelTime += 15; // 待ち時間
      break;
    case 'car':
      // 渋滞係数取得 (Google Maps API or 地域データベース)
      const trafficFactor = await getTrafficFactor(from, to, supabase);
      travelTime *= trafficFactor;
      break;
  }
  
  return Math.round(travelTime);
}
```

#### 2.2 splitIntoDays() 制約付き分割実装
```typescript
function splitIntoDays(
  route: PlaceWithTiming[], 
  maxDailyMinutes: number
): DailyRoute[] {
  
  const dailyRoutes: DailyRoute[] = [];
  let currentDay: PlaceWithTiming[] = [];
  let currentDayMinutes = 0;
  
  for (const place of route) {
    const placeTime = place.stay_duration_minutes + (place.travelTimeMinutes || 0);
    
    // 1日の制限を超える場合、新しい日に移行
    if (currentDayMinutes + placeTime > maxDailyMinutes && currentDay.length > 0) {
      dailyRoutes.push({
        date: `day-${dailyRoutes.length + 1}`,
        places: currentDay,
        totalMinutes: currentDayMinutes,
        totalDistance: calculateDayDistance(currentDay),
        estimatedCost: calculateDayCost(currentDay),
        mealBreaks: [] // 後で挿入
      });
      
      currentDay = [place];
      currentDayMinutes = placeTime;
    } else {
      currentDay.push(place);
      currentDayMinutes += placeTime;
    }
  }
  
  // 最後の日を追加
  if (currentDay.length > 0) {
    dailyRoutes.push({
      date: `day-${dailyRoutes.length + 1}`,
      places: currentDay,
      totalMinutes: currentDayMinutes,
      totalDistance: calculateDayDistance(currentDay),
      estimatedCost: calculateDayCost(currentDay),
      mealBreaks: []
    });
  }
  
  return dailyRoutes;
}
```

### Phase 3: 食事・営業時間システム (2-3時間)

#### 3.1 insertMealBreaks() 実装
```typescript
function insertMealBreaks(
  dailyRoutes: DailyRoute[], 
  mealSettings: MealBreakSettings
): DailyRoute[] {
  
  return dailyRoutes.map(dayRoute => {
    const mealBreaks: MealBreak[] = [];
    let currentTime = 540; // 09:00 (分で表現)
    
    for (const place of dayRoute.places) {
      currentTime += place.travelTimeMinutes || 0;
      
      // 各食事時間をチェック
      Object.entries(mealSettings).forEach(([mealType, settings]) => {
        const mealStartMinutes = settings.start * 60;
        const mealEndMinutes = mealStartMinutes + settings.duration;
        
        // 現在時刻が食事時間範囲内で、まだ追加されていない場合
        if (currentTime >= mealStartMinutes && 
            currentTime <= mealEndMinutes &&
            !mealBreaks.some(mb => mb.type === mealType)) {
          
          mealBreaks.push({
            type: mealType as 'breakfast' | 'lunch' | 'dinner',
            startTime: formatTime(mealStartMinutes),
            endTime: formatTime(mealEndMinutes),
            duration: settings.duration,
            suggestedLocation: findNearbyRestaurant(place, mealType)
          });
          
          currentTime = mealEndMinutes; // 食事時間を加算
        }
      });
      
      currentTime += place.stay_duration_minutes;
    }
    
    return {
      ...dayRoute,
      mealBreaks
    };
  });
}
```

#### 3.2 adjustForOpeningHours() 実装
```typescript
async function adjustForOpeningHours(
  dailyRoutes: DailyRoute[],
  supabase: SupabaseClient
): Promise<DailyRoute[]> {
  
  const adjustedRoutes: DailyRoute[] = [];
  
  for (const dayRoute of dailyRoutes) {
    const adjustedPlaces: PlaceWithTiming[] = [];
    let currentTime = 540; // 09:00
    
    for (const place of dayRoute.places) {
      // 営業時間データ取得
      const openingHours = await getOpeningHours(place, supabase);
      
      if (openingHours && !isWithinOpeningHours(currentTime, openingHours)) {
        // 営業時間外の場合、次の営業開始時間まで調整
        const nextOpenTime = getNextOpenTime(currentTime, openingHours);
        currentTime = nextOpenTime;
      }
      
      adjustedPlaces.push({
        ...place,
        arrivalTime: formatTime(currentTime),
        departureTime: formatTime(currentTime + place.stay_duration_minutes)
      });
      
      currentTime += place.stay_duration_minutes + (place.travelTimeMinutes || 0);
    }
    
    adjustedRoutes.push({
      ...dayRoute,
      places: adjustedPlaces
    });
  }
  
  return adjustedRoutes;
}
```

### Phase 4: 詳細スケジュール構築 (2-3時間)

#### 4.1 buildDetailedSchedule() 実装
```typescript
async function buildDetailedSchedule(
  tripId: string,
  dailyRoutes: DailyRoute[],
  originalRoute: PlaceWithTiming[],
  supabase: SupabaseClient
): Promise<DetailedSchedule> {
  
  // 公平性スコア計算
  const fairnessScores = calculateFairnessScores(originalRoute);
  
  // 最適化スコア計算
  const optimizationScore = calculateOptimizationScore(dailyRoutes, fairnessScores);
  
  // 制約違反チェック
  const constraintViolations = validateConstraints(dailyRoutes);
  
  // 代替ルート生成
  const alternativeRoutes = await generateAlternativeRoutes(dailyRoutes, supabase);
  
  return {
    tripId,
    dailyRoutes,
    totalDays: dailyRoutes.length,
    groupFairnessScore: fairnessScores.group,
    userFairnessScores: fairnessScores.users,
    totalEstimatedCost: dailyRoutes.reduce((sum, day) => sum + day.estimatedCost, 0),
    optimizationMetadata: {
      algorithmVersion: "2.0-constrained",
      executionTimeMs: Date.now(),
      placesConsidered: originalRoute.length,
      placesSelected: dailyRoutes.reduce((sum, day) => sum + day.places.length, 0),
      optimizationRounds: 1,
      createdAt: new Date().toISOString()
    },
    constraintViolations,
    alternativeRoutes
  };
}
```

## 🎯 実装優先順位とタイムライン

### Week 1: Core Algorithm Integration
- ✅ Day 1-2: generateConstrainedRoute() 基盤実装
- ✅ Day 3-4: optimizeGreedy() + assignTransportModes() (AirportDB統合)
- ✅ Day 5: calculateTravelTimes() 実装

### Week 2: Constraint Systems
- ✅ Day 1-2: splitIntoDays() + insertMealBreaks()
- ✅ Day 3-4: adjustForOpeningHours() + 営業時間DB統合
- ✅ Day 5: buildDetailedSchedule() + テスト

### Week 3: Integration & Testing
- ✅ Day 1-2: 既存システムとの統合
- ✅ Day 3-4: 包括的テスト実装
- ✅ Day 5: フロントエンド統合

## 📊 技術的依存関係

### 必須実装項目
1. **AirportDB Edge Function** (detect-airports-airportdb)
2. **営業時間データベーステーブル**
3. **地理的制約システム** (RealisticRouteCalculator拡張)
4. **制約違反検証システム**

### 推奨実装項目
1. **Google Maps API統合** (渋滞データ)
2. **天候制約システム**
3. **リアルタイム制約更新**
4. **機械学習ベース最適化** (将来拡張)

## 📈 品質保証計画

### テストケース
1. **単一日程最適化** (5-10箇所)
2. **複数日程分割** (15-25箇所)
3. **長距離移動** (空港必須ルート)
4. **営業時間制約** (美術館・レストラン等)
5. **食事時間挿入** (3食自動配置)
6. **地理的制約** (海越え・山越え)

### パフォーマンス要件
- **実行時間**: <30秒 (25箇所以下)
- **メモリ使用量**: <512MB
- **API呼び出し**: <100回/最適化
- **キャッシュヒット率**: >80%

この実装プランに従って、段階的に制約付きルート生成アルゴリズムを統合していきます。