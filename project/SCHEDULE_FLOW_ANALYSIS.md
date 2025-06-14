# スケジュール機能 - 全プロセス詳細分析

## 🔍 **概要**
add placeからUI表示までの全工程を詳細に分析し、現在の問題点を特定するための包括的ドキュメント

---

## 📊 **フローチャート**

```mermaid
graph TD
    A[ユーザーがPlace検索開始] --> B[PlaceSearchInput コンポーネント]
    B --> C[GooglePlacesService.searchPlaces()]
    C --> D[Google Places API 呼び出し]
    D --> E[検索結果表示]
    E --> F[ユーザーがPlace選択]
    F --> G[handlePlaceSelect 実行]
    G --> H[navigate to /add-place with selectedPlace]
    
    H --> I[AddPlacePage 表示]
    I --> J[ユーザーが設定入力]
    J --> K[Place保存処理開始]
    K --> L{認証状態確認}
    
    L -->|認証済み| M[Supabase places テーブルに保存]
    L -->|未認証| N[ローカルストレージに保存]
    
    M --> O[useStore の places 更新]
    N --> O
    
    O --> P[Schedule生成処理開始]
    P --> Q{最適化結果確認}
    
    Q -->|最適化済み| R[optimizationResult.detailedSchedule 使用]
    Q -->|未最適化| S[フォールバック処理]
    
    R --> T[DaySchedule 構築 - 最適化版]
    S --> U[DaySchedule 構築 - フォールバック版]
    
    T --> V[ListView/CalendarView/MapView 表示]
    U --> V
    
    V --> W[ユーザーに表示完了]
```

---

## 🔧 **詳細プロセス分析**

### **Phase 1: Place検索・選択**

#### 1.1 PlaceSearchInput コンポーネント
**ファイル**: `src/components/common/PlaceSearchInput.tsx`

```typescript
// 主要機能
- リアルタイム検索クエリ処理
- Google Places API 呼び出し
- 検索結果のドロップダウン表示
- Place選択時のコールバック実行
```

**問題点候補**:
- 検索API応答時間
- 検索結果の正確性
- ユーザビリティ問題

#### 1.2 GooglePlacesService
**ファイル**: `src/services/GooglePlacesService.ts`

```typescript
// 主要機能
export interface GooglePlace {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: { lat: number; lng: number };
  };
  photos?: { photo_reference: string }[];
  rating?: number;
  types: string[];
  price_level?: number;
}

async function searchPlaces(query: string, options?: SearchOptions): Promise<GooglePlace[]>
```

**問題点候補**:
- API キー設定
- レート制限
- レスポンス構造の変更

### **Phase 2: Place設定・保存**

#### 2.1 AddPlacePage Navigation
**ファイル**: Navigation処理

```typescript
// ListView.tsx, MapView.tsx での処理
const handlePlaceSelect = (place: GooglePlace) => {
  navigate('/add-place', { state: { selectedPlace: place } });
};
```

#### 2.2 AddPlacePage フォーム
**ファイル**: `src/pages/AddPlacePage.tsx` (推定)

**処理内容**:
```typescript
// ユーザー入力項目
- visit_date / scheduled_date
- scheduled_time_start / scheduled_time_end  
- stay_duration_minutes
- wish_level (priority)
- notes
- scheduled (boolean)
```

**問題点候補**:
- フィールド名の不整合
- バリデーション不足
- 日時フォーマット問題

#### 2.3 Place保存処理
**ファイル**: `src/store/useStore.ts`

```typescript
// 保存先の分岐
if (user) {
  // Supabase places テーブルに保存
  await supabase.from('places').insert(placeData);
} else {
  // ローカルストレージに保存
  localStorage.setItem('places', JSON.stringify(places));
}
```

**問題点候補**:
- 認証状態の判定
- データ構造の不整合
- 保存エラーハンドリング

### **Phase 3: Schedule生成処理**

#### 3.1 ListView Schedule生成
**ファイル**: `src/components/ListView.tsx` (lines 98-393)

**主要ロジック**:
```typescript
const schedule = useMemo(() => {
  if (!currentTrip) return [];
  
  // 🔄 分岐点1: 最適化結果の確認
  if (optimizationResult?.detailedSchedule) {
    // ✅ 最適化済みの場合
    return generateOptimizedSchedule();
  } else {
    // ⚠️ フォールバック処理
    return generateFallbackSchedule();
  }
}, [tripPlaces, currentTrip, optimizationResult]);
```

#### 3.2 最適化済みSchedule生成
**処理詳細**:
```typescript
// optimizationResult.detailedSchedule 構造
{
  detailedSchedule: [
    {
      places: [
        {
          id: string,
          name: string,
          arrival_time: string,
          departure_time: string,
          visit_duration: number,
          latitude: number,
          longitude: number,
          category: string,
          rating: number,
          member_preferences: [
            {
              member_id: string,
              preference_score: number
            }
          ]
        }
      ],
      travel_segments: [
        {
          mode: string,
          duration: number,
          distance: number
        }
      ]
    }
  ]
}
```

**問題点候補**:
- データ構造の不整合
- フィールド名の違い (snake_case vs camelCase)
- travel_segments の欠損

#### 3.3 フォールバックSchedule生成
**処理詳細**:
```typescript
// places テーブルからの直接読み込み
const scheduledPlaces = tripPlaces.filter(place => place.scheduled);
const placesWithDates = scheduledPlaces.filter(place => 
  place.visit_date || place.scheduled_date
);

// 日付別グループ化
const dateGroups = placesWithDates.reduce((groups, place) => {
  const date = place.visit_date || place.scheduled_date;
  if (date) {
    if (!groups[date]) groups[date] = [];
    groups[date].push(place);
  }
  return groups;
}, {} as Record<string, Place[]>);
```

**問題点候補**:
- scheduled フラグの設定漏れ
- 日付フォーマットの不整合
- デフォルト移動時間の不適切さ

### **Phase 4: UI表示処理**

#### 4.1 DaySchedule構造
**生成される構造**:
```typescript
interface DaySchedule {
  date: string;
  day: string;
  dayName: string;
  events: ScheduleEvent[];
}

interface ScheduleEvent {
  id: string;
  type: 'place' | 'travel' | 'meal';
  name: string;
  time?: string;
  duration?: string;
  category?: string;
  rating?: number;
  assignedTo?: string[];
  image?: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  mode?: string;          // travel専用
  distance?: string;      // travel専用
  from?: string;         // travel専用
  to?: string;           // travel専用
}
```

#### 4.2 ListView表示処理
**ファイル**: `src/components/ListView.tsx` (lines 576-887)

**レンダリング処理**:
```typescript
{selectedSchedule.events.map((event, index) => (
  <React.Fragment key={event.id}>
    <motion.div>
      {event.type === 'place' ? (
        // Place表示ロジック
        <PlaceEventCard event={event} />
      ) : event.type === 'travel' ? (
        // Travel表示ロジック  
        <TravelEventCard event={event} />
      ) : (
        // Meal表示ロジック
        <MealEventCard event={event} />
      )}
    </motion.div>
  </React.Fragment>
))}
```

---

## 🚨 **特定された問題点**

### **1. データ構造の不整合**

#### A. フィールド名の混在
```typescript
// places テーブル (snake_case)
place.visit_date
place.scheduled_date
place.stay_duration_minutes
place.wish_level

// 最適化結果 (camelCase)
place.arrivalTime
place.departureTime
place.visitDuration
place.wishLevel

// 現在の対応状況
const departureLocation = currentTrip.departureLocation || (currentTrip as any).departure_location;
```

#### B. 日時フォーマットの不統一
```typescript
// 想定される問題
- ISO 8601 vs ローカル日時文字列
- タイムゾーンの扱い
- 日付のみ vs 日時
```

### **2. 最適化結果の依存性**

#### A. detailedSchedule の構造依存
```typescript
// 問題: travel_segments が存在しない場合
const travelSegment = daySchedule.travel_segments?.[placeIndex];
if (travelSegment && nextPlace) {
  // 移動情報を表示
} else {
  // 移動情報が欠損 → 表示されない
}
```

#### B. フォールバック処理の不完全さ
```typescript
// デフォルト値の問題
duration: '15m',           // 固定値
mode: 'public_transport',  // 固定値  
distance: '1.2km',         // 固定値
```

### **3. UI表示の問題**

#### A. 空のScheduleの表示
```typescript
// 条件分岐の問題
) : schedule.length === 0 ? (
  // Empty Schedule State
) : selectedSchedule ? (
  // Normal Schedule Display
) : (
  // No Schedule for Selected Day
)
```

#### B. イベント生成ロジックの複雑さ
```typescript
// 複数の処理パスによる不整合
1. 最適化結果からの生成
2. 予定済みPlaceからの生成  
3. デフォルトDayの生成
4. 日付なしPlaceの追加
```

### **4. 状態管理の問題**

#### A. 複数データソースの同期
```typescript
// 同期が必要なデータ
- places (Supabase/localStorage)
- currentTrip 
- optimizationResult
- selectedDay
```

#### B. リアルタイム更新の欠如
```typescript
// 問題: place追加後の自動更新なし
// 解決案: useEffect での監視強化
```

---

## 🔧 **推奨修正方針**

### **Priority 1: データ構造の統一**
1. フィールド名の完全統一 (snake_case)
2. 日時フォーマットの標準化
3. 型定義の厳密化

### **Priority 2: フォールバック処理の改善**  
1. travel_segments 欠損時の適切な処理
2. デフォルト移動情報の動的計算
3. エラーハンドリングの強化

### **Priority 3: UI表示ロジックの簡素化**
1. Schedule生成ロジックの分離
2. 条件分岐の最適化
3. リアルタイム更新の実装

### **Priority 4: デバッグ機能の追加**
1. 詳細ログ出力
2. データ流れの可視化
3. 問題特定の自動化

---

## 📋 **次のアクション項目**

1. **データ調査**: 実際の places データ構造確認
2. **型定義修正**: Place interface の統一
3. **Schedule生成ロジック**: 分離・単純化
4. **テスト実装**: 各段階での動作確認
5. **エラーハンドリング**: 包括的な例外処理

---

*最終更新: 2025年1月13日*