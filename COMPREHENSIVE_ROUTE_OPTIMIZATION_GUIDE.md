# 包括的ルート最適化システム - 詳細実装ガイド

## 目次

1. [システム全体アーキテクチャ](#システム全体アーキテクチャ)
2. [空港検出システムの詳細実装](#空港検出システムの詳細実装)
3. [出発地・目的地固定のロジック](#出発地目的地固定のロジック)
4. [型定義](#型定義)
5. [データフロー](#データフロー)
6. [ファイル構造](#ファイル構造)
7. [各処理ステップの詳細実装](#各処理ステップの詳細実装)

## システム全体アーキテクチャ

```
Frontend (React/TypeScript)
    ↕️ API通信 (REST/RPC)
Supabase (Database + Edge Functions + Auth + Storage)
    ↕️ 外部API連携
External APIs (Google Maps, AirportDB)
```

## 空港検出システムの詳細実装

### 概要

空港検出システムは、飛行機での移動が必要な地点間において、最寄りの空港を自動的に検出し、ルートに挿入する機能です。このシステムは距離ベースの移動手段判定と連携して動作します。

### 実装場所とファイル構造

**関連ファイル：**
- `/project/src/services/AirportDetectionService.ts` - 空港検出のメインロジック
- `/project/supabase/functions/optimize-route/index.ts` - Edge Function内での空港挿入処理
- `/project/src/types/optimization.ts` - 空港関連の型定義

### 詳細な処理フロー

#### 1. 移動手段の判定（距離ベース）

```typescript
// ファイル: /project/src/services/RealisticRouteCalculator.ts

export class RealisticRouteCalculator {
  /**
   * 2地点間の移動手段を距離に基づいて決定する
   * - 1km以下: 徒歩
   * - 1km〜500km: 車
   * - 500km以上: 飛行機
   */
  static determineTransportMode(
    fromPlace: Place,
    toPlace: Place,
    distance: number
  ): TransportMode {
    // 空港から/への移動は特別処理
    if (fromPlace.is_airport || toPlace.is_airport) {
      return 'flight';
    }
    
    // 距離ベースの判定
    if (distance <= 1) return 'walking';
    if (distance <= 500) return 'car';
    return 'flight';
  }
}
```

#### 2. 空港検出アルゴリズム

```typescript
// ファイル: /project/src/services/AirportDetectionService.ts

export class AirportDetectionService {
  private static airportDatabase: Airport[] = [];

  /**
   * 指定地点から最寄りの空港を検出する
   * 処理内容：
   * 1. 地点の座標を取得
   * 2. 半径100km以内の空港をAirportDBから検索
   * 3. 最も近い空港を選択
   * 4. 空港情報を返す
   */
  static async findNearestAirport(
    place: Place,
    maxDistanceKm: number = 100
  ): Promise<Airport | null> {
    // AirportDB APIを使用して近隣空港を検索
    const nearbyAirports = await this.searchNearbyAirports(
      place.latitude,
      place.longitude,
      maxDistanceKm
    );

    if (nearbyAirports.length === 0) {
      return null;
    }

    // 最寄り空港を選択
    return nearbyAirports.reduce((nearest, airport) => {
      const distanceToNearest = this.calculateDistance(place, nearest);
      const distanceToAirport = this.calculateDistance(place, airport);
      return distanceToAirport < distanceToNearest ? airport : nearest;
    });
  }

  /**
   * AirportDB APIを呼び出して空港を検索
   */
  private static async searchNearbyAirports(
    lat: number,
    lng: number,
    radiusKm: number
  ): Promise<Airport[]> {
    // 実際のAirportDB API呼び出し
    const response = await fetch(
      `https://airportdb.api/airports/nearby?lat=${lat}&lng=${lng}&radius=${radiusKm}`
    );
    return response.json();
  }
}
```

#### 3. ルートへの空港挿入

```typescript
// ファイル: /project/supabase/functions/optimize-route/index.ts

/**
 * 最適化されたルートに空港を挿入する
 * 処理内容：
 * 1. 各地点間の移動手段をチェック
 * 2. 飛行機移動が必要な場合、両端に空港を挿入
 * 3. 挿入位置を調整して自然なルートを生成
 */
async function insertAirportsIntoRoute(
  places: Place[]
): Promise<EnhancedPlace[]> {
  const enhancedRoute: EnhancedPlace[] = [];
  
  for (let i = 0; i < places.length; i++) {
    const currentPlace = places[i];
    const nextPlace = places[i + 1];
    
    // 現在の場所を追加
    enhancedRoute.push({
      ...currentPlace,
      transport_mode_to_next: null
    });
    
    if (nextPlace) {
      const distance = calculateDistance(currentPlace, nextPlace);
      const transportMode = determineTransportMode(
        currentPlace,
        nextPlace,
        distance
      );
      
      // 飛行機移動の場合、空港を挿入
      if (transportMode === 'flight' && !currentPlace.is_airport) {
        // 出発空港を検出
        const departureAirport = await AirportDetectionService.findNearestAirport(
          currentPlace
        );
        
        if (departureAirport) {
          enhancedRoute.push({
            ...departureAirport,
            place_type: 'transit_airport',
            stay_duration_minutes: 120, // チェックイン時間
            transport_mode_to_next: 'flight'
          });
        }
        
        // 到着空港を検出（次の場所が空港でない場合）
        if (!nextPlace.is_airport) {
          const arrivalAirport = await AirportDetectionService.findNearestAirport(
            nextPlace
          );
          
          if (arrivalAirport) {
            enhancedRoute.push({
              ...arrivalAirport,
              place_type: 'transit_airport',
              stay_duration_minutes: 60, // 到着処理時間
              transport_mode_to_next: determineTransportMode(
                arrivalAirport,
                nextPlace,
                calculateDistance(arrivalAirport, nextPlace)
              )
            });
          }
        }
      }
    }
  }
  
  return enhancedRoute;
}
```

## 出発地・目的地固定のロジック

### 概要

出発地と目的地（帰国地）は、ルート最適化において固定位置として扱われます。これらは必ずルートの最初と最後に配置され、その間の訪問地のみが最適化の対象となります。

### 実装場所とファイル構造

**関連ファイル：**
- `/project/src/pages/TripDetailPage.tsx` - 出発地・目的地の設定UI
- `/project/supabase/functions/optimize-route/index.ts` - 固定位置の処理
- `/project/src/store/useStore.ts` - 状態管理

### 詳細な処理フロー

#### 1. 出発地・目的地の設定（フロントエンド）

```typescript
// ファイル: /project/src/pages/TripDetailPage.tsx

/**
 * トリップ作成時に出発地と目的地を設定
 * 処理内容：
 * 1. Google Places APIで場所を検索
 * 2. place_typeを'departure'または'destination'に設定
 * 3. データベースに保存
 */
const handleSetDepartureLocation = async (place: google.maps.places.PlaceResult) => {
  const departurePlace: Place = {
    id: generateId(),
    trip_id: currentTrip.id,
    user_id: 'system',
    name: place.name || '',
    latitude: place.geometry?.location?.lat() || 0,
    longitude: place.geometry?.location?.lng() || 0,
    place_type: 'departure', // 固定タイプ
    source: 'system',
    stay_duration_minutes: 0,
    google_place_id: place.place_id || '',
    address: place.formatted_address || ''
  };
  
  // Supabaseに保存
  await supabase.from('places').insert(departurePlace);
};
```

#### 2. ルート最適化での固定処理（バックエンド）

```typescript
// ファイル: /project/supabase/functions/optimize-route/index.ts

/**
 * 出発地と目的地を固定してルートを最適化
 * 処理内容：
 * 1. 場所を3つのカテゴリに分類（出発地、目的地、訪問地）
 * 2. 訪問地のみを最適化対象とする
 * 3. 最終的に出発地→最適化された訪問地→目的地の順で結合
 */
function optimizeRouteWithFixedEndpoints(
  places: Place[]
): Place[] {
  // 場所を分類
  const departure = places.find(p => p.place_type === 'departure');
  const destination = places.find(p => p.place_type === 'destination');
  const visitPlaces = places.filter(p => p.place_type === 'member_wish');
  
  if (!departure) {
    throw new Error('出発地が設定されていません');
  }
  
  // 訪問地のみを最適化（TSP貪欲法）
  const optimizedVisitPlaces = applyTSPGreedy(visitPlaces, departure);
  
  // 固定順序で結合
  const finalRoute = [
    departure,
    ...optimizedVisitPlaces,
    ...(destination ? [destination] : [])
  ];
  
  return finalRoute;
}

/**
 * TSP貪欲法による訪問地の最適化
 * 出発地からスタートして、最も近い未訪問地を選択していく
 */
function applyTSPGreedy(
  visitPlaces: Place[],
  startPoint: Place
): Place[] {
  const optimized: Place[] = [];
  const unvisited = [...visitPlaces];
  let currentLocation = startPoint;
  
  while (unvisited.length > 0) {
    // 現在地から最も近い場所を見つける
    const nearestIndex = findNearestPlaceIndex(currentLocation, unvisited);
    const nearestPlace = unvisited[nearestIndex];
    
    optimized.push(nearestPlace);
    unvisited.splice(nearestIndex, 1);
    currentLocation = nearestPlace;
  }
  
  return optimized;
}
```

## 型定義

### 概要

システム全体で使用される型定義は、TypeScriptの型安全性を確保し、フロントエンドとバックエンド間でのデータ整合性を保証します。

### 実装場所とファイル構造

**関連ファイル：**
- `/project/src/types/optimization.ts` - 最適化関連の型定義
- `/project/src/types/placeSelection.ts` - 場所選択関連の型定義
- `/project/supabase/supabase.sql` - データベーススキーマ定義

### 主要な型定義

```typescript
// ファイル: /project/src/types/optimization.ts

/**
 * 場所の基本型定義
 */
export interface Place {
  id: string;
  trip_id: string;
  user_id: string;
  name: string;
  latitude: number;
  longitude: number;
  category?: string;
  place_type: 'departure' | 'destination' | 'member_wish' | 'transit_airport';
  source: 'user' | 'system';
  wish_level?: number; // 1-5
  normalized_wish_level?: number;
  stay_duration_minutes: number;
  google_place_id: string;
  address: string;
  is_airport?: boolean;
  created_at?: string;
  
  // 最適化後に追加される情報
  transport_mode_to_next?: TransportMode;
  travel_time_to_next?: number;
  arrival_time?: string;
  departure_time?: string;
  day_number?: number;
}

/**
 * 移動手段の型定義
 */
export type TransportMode = 'walking' | 'car' | 'flight';

/**
 * 最適化されたルートの型定義
 */
export interface OptimizedRoute {
  trip_id: string;
  optimization_id: string;
  daily_schedules: DailySchedule[];
  total_distance: number;
  total_duration_minutes: number;
  optimization_score: OptimizationScore;
  created_at: string;
}

/**
 * 日別スケジュールの型定義
 */
export interface DailySchedule {
  day: number;
  date: string;
  scheduled_places: ScheduledPlace[];
  meal_breaks: MealBreak[];
  total_travel_time: number;
  total_visit_time: number;
  start_time: string;
  end_time: string;
}

/**
 * スケジュールされた場所の型定義
 */
export interface ScheduledPlace extends Place {
  order_in_day: number;
  arrival_time: string;
  departure_time: string;
  transport_mode_from_previous?: TransportMode;
  travel_time_from_previous?: number;
  travel_distance_from_previous?: number;
}

/**
 * 最適化スコアの型定義
 */
export interface OptimizationScore {
  total_score: number;
  distance_efficiency: number;
  time_efficiency: number;
  fairness_score: number;
  wish_fulfillment_score: number;
}

/**
 * トリップメンバーの型定義
 */
export interface TripMember {
  id: string;
  trip_id: string;
  user_id: string;
  role: 'admin' | 'member';
  assigned_color_index: number;
  assigned_color: string;
  can_add_places: boolean;
  can_optimize: boolean;
  joined_at: string;
  user?: User;
}

/**
 * 最適化制約の型定義
 */
export interface OptimizationConstraints {
  max_daily_hours: number;
  time_constraint_minutes: number;
  max_places: number;
  include_meal_breaks: boolean;
  preferred_transport_modes: TransportMode[];
}
```

### データベーススキーマとの対応

```sql
-- ファイル: /project/supabase/supabase.sql

-- places テーブル（型定義と対応）
CREATE TABLE places (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    category VARCHAR(100),
    place_type VARCHAR(20) DEFAULT 'member_wish',
    source VARCHAR(20) DEFAULT 'user',
    wish_level INTEGER CHECK (wish_level BETWEEN 1 AND 5),
    stay_duration_minutes INTEGER DEFAULT 120,
    google_place_id VARCHAR(255),
    address TEXT,
    is_airport BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- optimization_results テーブル
CREATE TABLE optimization_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    optimized_route JSONB NOT NULL,
    optimization_score JSONB,
    execution_time_ms INTEGER,
    places_count INTEGER,
    is_active BOOLEAN DEFAULT true,
    algorithm_version VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## データフロー

### 概要

データは、フロントエンド、Supabaseデータベース、Edge Functions、外部APIの間を以下のフローで移動します。

### 15ステップの詳細なデータフロー

#### ステップ1: フロントエンドからデータベースへの記録

**処理内容：**
ユーザーがトリップを作成し、メンバーを招待し、場所を追加する際のデータフロー。

**関連ファイル：**
- `/project/src/pages/TripDetailPage.tsx` - UI操作
- `/project/src/lib/supabase.ts` - Supabaseクライアント
- `/project/src/store/useStore.ts` - 状態管理

```typescript
// ファイル: /project/src/pages/TripDetailPage.tsx

// トリップ作成時のデータフロー
const createTrip = async (tripData: CreateTripInput) => {
  // 1. Supabaseにトリップを作成
  const { data: trip, error } = await supabase
    .from('trips')
    .insert({
      name: tripData.name,
      departure_location: tripData.departure,
      destination: tripData.destination,
      start_date: tripData.startDate,
      end_date: tripData.endDate,
      owner_id: user.id
    })
    .select()
    .single();

  // 2. 作成者を管理者として追加
  await supabase
    .from('trip_members')
    .insert({
      trip_id: trip.id,
      user_id: user.id,
      role: 'admin',
      assigned_color_index: 0
    });

  // 3. 出発地を場所として追加
  await supabase
    .from('places')
    .insert({
      trip_id: trip.id,
      user_id: 'system',
      name: tripData.departure,
      place_type: 'departure',
      source: 'system',
      // ... 座標情報など
    });
};
```

#### ステップ2: データベースからバックエンドがデータ取得

**処理内容：**
Edge Functionが最適化処理のためにデータベースから必要なデータを取得。

**関連ファイル：**
- `/project/supabase/functions/optimize-route/index.ts` - データ取得ロジック

```typescript
// ファイル: /project/supabase/functions/optimize-route/index.ts

async function fetchTripData(tripId: string) {
  // トリップ情報取得
  const { data: trip } = await supabaseAdmin
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single();

  // メンバー情報取得（ユーザー情報も結合）
  const { data: members } = await supabaseAdmin
    .from('trip_members')
    .select(`
      *,
      user:user_id (
        id,
        email,
        full_name
      )
    `)
    .eq('trip_id', tripId);

  // 場所情報取得
  const { data: places } = await supabaseAdmin
    .from('places')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });

  return { trip, members, places };
}
```

#### ステップ3: 希望度の正規化

**処理内容：**
各ユーザーの希望度を公平に評価するための正規化処理。

**関連ファイル：**
- `/project/supabase/functions/normalize-preferences/index.ts` - 正規化処理

```typescript
// ファイル: /project/supabase/functions/normalize-preferences/index.ts

interface NormalizedPlace extends Place {
  normalized_wish_level: number;
  fairness_weight: number;
  user_contribution_factor: number;
}

export function normalizePreferences(places: Place[]): NormalizedPlace[] {
  // ユーザーごとにグループ化
  const userPlacesMap = new Map<string, Place[]>();
  
  places.forEach(place => {
    if (place.source === 'user') {
      const userPlaces = userPlacesMap.get(place.user_id) || [];
      userPlaces.push(place);
      userPlacesMap.set(place.user_id, userPlaces);
    }
  });

  // 各ユーザーの希望度を正規化
  const normalizedPlaces: NormalizedPlace[] = [];
  
  userPlacesMap.forEach((userPlaces, userId) => {
    // ユーザーの平均希望度を計算
    const avgWishLevel = userPlaces.reduce((sum, p) => sum + (p.wish_level || 3), 0) / userPlaces.length;
    
    // 各場所を正規化
    userPlaces.forEach(place => {
      const normalizedWishLevel = (place.wish_level || 3) / avgWishLevel;
      const fairnessWeight = 1 / userPlaces.length; // 場所数が多いユーザーに調整
      
      normalizedPlaces.push({
        ...place,
        normalized_wish_level: normalizedWishLevel,
        fairness_weight: fairnessWeight,
        user_contribution_factor: normalizedWishLevel * fairnessWeight
      });
    });
  });

  return normalizedPlaces;
}
```

#### ステップ4: 時間制約に基づく場所の絞り込み

**処理内容：**
トリップ期間に収まるように、公平性を考慮して場所を選択。

**関連ファイル：**
- `/project/supabase/functions/select-optimal-places/index.ts` - 場所選択アルゴリズム

```typescript
// ファイル: /project/supabase/functions/select-optimal-places/index.ts

export function selectOptimalPlaces(
  normalizedPlaces: NormalizedPlace[],
  constraints: OptimizationConstraints
): Place[] {
  // 総時間を計算
  const totalTimeNeeded = calculateTotalTimeNeeded(normalizedPlaces);
  
  // 制約内に収まる場合は全て選択
  if (totalTimeNeeded <= constraints.time_constraint_minutes) {
    return normalizedPlaces;
  }
  
  // ラウンドロビン方式で公平に選択
  const selectedPlaces: Place[] = [];
  const userQueues = createUserPriorityQueues(normalizedPlaces);
  
  while (selectedPlaces.length < constraints.max_places && hasPlacesInQueues(userQueues)) {
    // 各ユーザーから1つずつ選択
    for (const [userId, queue] of userQueues) {
      if (queue.length > 0) {
        const place = queue.shift()!;
        selectedPlaces.push(place);
        
        // 時間制約チェック
        if (calculateTotalTimeNeeded(selectedPlaces) > constraints.time_constraint_minutes) {
          selectedPlaces.pop();
          return selectedPlaces;
        }
      }
    }
  }
  
  return selectedPlaces;
}
```

## ファイル構造

### プロジェクト全体のファイル構造

```
/project/
├── src/                              # フロントエンドソースコード
│   ├── components/                   # Reactコンポーネント
│   │   ├── OptimizationModal.tsx    # 最適化設定モーダル
│   │   ├── OptimizationResult.tsx   # 最適化結果表示
│   │   ├── MapView.tsx              # 地図表示
│   │   └── DetailedScheduleTimelineView.tsx # スケジュール表示
│   ├── services/                     # ビジネスロジック
│   │   ├── AirportDetectionService.ts        # 空港検出
│   │   ├── TripOptimizationService.ts        # 最適化サービス
│   │   ├── RealisticRouteCalculator.ts       # ルート計算
│   │   └── DetailedScheduleService.ts        # スケジュール構築
│   ├── types/                        # 型定義
│   │   ├── optimization.ts          # 最適化関連の型
│   │   └── placeSelection.ts        # 場所選択の型
│   ├── lib/                          # ライブラリ設定
│   │   ├── supabase.ts              # Supabaseクライアント
│   │   └── googleMaps.ts            # Google Maps設定
│   └── store/                        # 状態管理
│       └── useStore.ts              # Zustandストア
│
├── supabase/                         # Supabaseバックエンド
│   ├── functions/                    # Edge Functions
│   │   ├── optimize-route/          # ルート最適化
│   │   │   └── index.ts            # メイン最適化ロジック
│   │   ├── normalize-preferences/   # 希望度正規化
│   │   │   └── index.ts            
│   │   ├── select-optimal-places/   # 場所選択
│   │   │   └── index.ts            
│   │   └── trip-management/         # トリップ管理
│   │       └── index.ts            
│   └── supabase.sql                 # データベーススキーマ
│
└── tests/                            # テストファイル
    ├── integration/                  # 統合テスト
    └── unit/                         # ユニットテスト
```

## 各処理ステップの詳細実装

### ステップ5-15の実装詳細は、次のファイルに記載します。

[続きは COMPREHENSIVE_ROUTE_OPTIMIZATION_GUIDE_PART2.md を参照]