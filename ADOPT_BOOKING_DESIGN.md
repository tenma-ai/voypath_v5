# Adopt-Booking Edge Function 設計書

## 🎯 概要
adopt-booking Edge Functionは、`is_added_to_trip=true`にされた予約(booking)の固定時間をcalendar timeline viewに反映する機能です。
既存のedit-schedule関数の複雑性を回避し、新しいアプローチで予約時間を厳守した最適化を実現します。

**基本フロー:**
1. ユーザーが予約を保存 → bookingsテーブル
2. ユーザーが"add to trip"実行 → is_added_to_trip=true & adopt_booking関数トリガー  
3. adopt_booking関数で新しいoptimization_result生成
4. is_active=trueで自動反映

## 📋 基本仕様

### 入力データ
```typescript
// adopt-bookingへのリクエスト形式
{
  trip_id: string,                    // 必須: トリップID
  user_id: string,                    // 必須: ユーザーID
  booking_id?: string,                // オプション: 特定予約のみ処理
  action: 'adopt_bookings'            // アクション種別
}
```

### 処理対象データ
```sql
-- is_added_to_trip=trueの予約を取得
SELECT * FROM bookings 
WHERE trip_id = :trip_id 
  AND is_added_to_trip = true
  AND (:booking_id IS NULL OR id = :booking_id)
ORDER BY 
  departure_date ASC, 
  departure_time ASC,
  check_in_date ASC,
  check_in_time ASC;
```

### 予約データ構造
```typescript
interface Booking {
  id: string;
  trip_id: string;
  user_id: string;
  booking_type: 'flight' | 'hotel' | 'walking' | 'car';
  is_added_to_trip: boolean;
  
  // フライト予約
  flight_number?: string;
  departure_time?: string;        // "09:00"
  arrival_time?: string;          // "11:00" 
  departure_date?: date;          // "2025-07-19"
  arrival_date?: date;            // "2025-07-19" or "2025-07-20"
  route?: string;                 // "Tokyo → Osaka"
  
  // ホテル予約  
  hotel_name?: string;
  check_in_time?: string;         // "23:00"
  check_out_time?: string;        // "11:00"
  check_in_date?: date;           // "2025-07-19"
  check_out_date?: date;          // "2025-07-20"
  address?: string;
  latitude?: number;
  longitude?: number;
  
  // 交通手段予約
  transport_info?: jsonb;
  
  // 共通フィールド
  notes?: string;
  price?: string;
  passengers?: number;
  guests?: number;
  created_at: timestamp;
  updated_at: timestamp;
}
```

## 🔄 処理フロー詳細

### 1. 既存optimization_result分析
```typescript
// 最新のアクティブな最適化結果を取得
const currentOptimization = await supabase
  .from('optimization_results')
  .select('*')
  .eq('trip_id', tripId)
  .eq('is_active', true)
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

// optimized_routeから既存のschedule構造を抽出
const existingSchedule = currentOptimization.data.optimized_route;
// 例: 
// [
//   {
//     day: 1,
//     date: "2025-07-19", 
//     scheduled_places: [
//       { 
//         id: "place1", 
//         arrival_time: "08:00:00", 
//         departure_time: "09:00:00",
//         stay_duration_minutes: 60,
//         travel_time_from_previous: null
//       },
//       { 
//         id: "place2", 
//         arrival_time: "15:36:00", 
//         departure_time: "17:36:00", 
//         stay_duration_minutes: 120,
//         travel_time_from_previous: 396
//       }
//     ]
//   }
// ]
```

### 2. 時間変換システム

#### 絶対時間 → 累積時間変換
```typescript
function convertAbsoluteTimeToCumulative(
  date: string,              // "2025-07-19"
  time: string,              // "23:00"
  tripStartDate: string      // "2025-07-19"
): number {
  const tripStart = new Date(`${tripStartDate}T08:00:00.000Z`);  // trip開始日の8:00
  const absoluteDateTime = new Date(`${date}T${time}:00.000Z`);
  
  // trip開始からの総経過分数（深夜時間含む）
  const cumulativeMinutes = (absoluteDateTime.getTime() - tripStart.getTime()) / (1000 * 60);
  
  return cumulativeMinutes;
  
  // 例:
  // trip開始: 2025-07-19 08:00
  // 予約時間: 2025-07-19 23:00
  // → 累積時間: 900分 (15時間後)
  
  // trip開始: 2025-07-19 08:00  
  // 予約時間: 2025-07-20 11:00
  // → 累積時間: 1620分 (27時間後)
}
```

#### 累積時間 → 絶対時間変換
```typescript
function convertCumulativeTimeToAbsolute(
  cumulativeMinutes: number,  // 900
  tripStartDate: string       // "2025-07-19"
): { date: string, time: string } {
  const tripStart = new Date(`${tripStartDate}T08:00:00.000Z`);
  const absoluteDateTime = new Date(tripStart.getTime() + cumulativeMinutes * 60 * 1000);
  
  return {
    date: absoluteDateTime.toISOString().split('T')[0],     // "2025-07-19"
    time: absoluteDateTime.toTimeString().substring(0, 8)   // "23:00:00"
  };
}
```

### 3. セグメント分割アルゴリズム

#### 予約による分割点の特定
```typescript
function identifyBookingSegmentPoints(
  existingSchedule: DailySchedule[],
  addedBookings: Booking[]
): SegmentPoint[] {
  const segmentPoints = [];
  
  // 全既存placeを累積時間順にソート
  const allPlaces = existingSchedule
    .flatMap(day => day.scheduled_places.map(place => ({
      ...place,
      cumulativeTime: convertAbsoluteTimeToCumulative(day.date, place.arrival_time, tripStartDate)
    })))
    .sort((a, b) => a.cumulativeTime - b.cumulativeTime);
  
  // 各予約の時間を累積時間に変換
  for (const booking of addedBookings) {
    if (booking.booking_type === 'flight' || booking.booking_type === 'car' || booking.booking_type === 'walking') {
      // 交通手段: 出発時間と到着時間で2つの分割点
      const departurePoint = convertAbsoluteTimeToCumulative(
        booking.departure_date, 
        booking.departure_time, 
        tripStartDate
      );
      const arrivalPoint = convertAbsoluteTimeToCumulative(
        booking.arrival_date || booking.departure_date, 
        booking.arrival_time, 
        tripStartDate
      );
      
      segmentPoints.push({
        type: 'transport_departure',
        cumulativeTime: departurePoint,
        booking: booking,
        fixedDuration: calculateTransportDuration(booking)
      });
      
      segmentPoints.push({
        type: 'transport_arrival', 
        cumulativeTime: arrivalPoint,
        booking: booking
      });
      
    } else if (booking.booking_type === 'hotel') {
      // ホテル: チェックイン時間で1つの分割点
      const checkInPoint = convertAbsoluteTimeToCumulative(
        booking.check_in_date,
        booking.check_in_time,
        tripStartDate
      );
      const checkOutPoint = convertAbsoluteTimeToCumulative(
        booking.check_out_date,
        booking.check_out_time,
        tripStartDate
      );
      
      segmentPoints.push({
        type: 'hotel_stay',
        cumulativeTime: checkInPoint,
        booking: booking,
        fixedDuration: Math.round((new Date(`${booking.check_out_date}T${booking.check_out_time}:00`) - 
                                   new Date(`${booking.check_in_date}T${booking.check_in_time}:00`)) / (1000 * 60))
      });
    }
  }
  
  return segmentPoints.sort((a, b) => a.cumulativeTime - b.cumulativeTime);
}
```

#### セグメント作成
```typescript
function createSegments(
  allPlaces: Place[],           // 累積時間順の全既存place
  segmentPoints: SegmentPoint[] // 予約による分割点
): Segment[] {
  const segments = [];
  let currentSegmentPlaces = [];
  let segmentStartTime = 0;
  
  for (let i = 0; i < segmentPoints.length; i++) {
    const point = segmentPoints[i];
    
    // 現在の分割点より前の場所を現在セグメントに追加
    while (allPlaces.length > 0 && allPlaces[0].cumulativeTime < point.cumulativeTime) {
      currentSegmentPlaces.push(allPlaces.shift());
    }
    
    // 現在セグメントを完結（場所がある場合のみ）
    if (currentSegmentPlaces.length > 0) {
      segments.push({
        type: 'flexible',
        startCumulativeTime: segmentStartTime,
        endCumulativeTime: point.cumulativeTime,
        places: [...currentSegmentPlaces],
        originalDuration: point.cumulativeTime - segmentStartTime
      });
      currentSegmentPlaces = [];
    }
    
    // 予約セグメントを作成
    segments.push({
      type: 'fixed_booking',
      startCumulativeTime: point.cumulativeTime,
      endCumulativeTime: point.cumulativeTime + (point.fixedDuration || 0),
      booking: point.booking,
      fixedDuration: point.fixedDuration || 0
    });
    
    segmentStartTime = point.cumulativeTime + (point.fixedDuration || 0);
  }
  
  // 最後のセグメント（残りの場所）
  if (currentSegmentPlaces.length > 0 || allPlaces.length > 0) {
    segments.push({
      type: 'flexible',
      startCumulativeTime: segmentStartTime,
      endCumulativeTime: segmentStartTime + getTotalRemainingTime(currentSegmentPlaces.concat(allPlaces)),
      places: currentSegmentPlaces.concat(allPlaces),
      originalDuration: getTotalRemainingTime(currentSegmentPlaces.concat(allPlaces))
    });
  }
  
  return segments;
}
```

### 4. セグメント最適化（時間調整）

#### 柔軟セグメントの時間調整
```typescript
function optimizeFlexibleSegment(
  segment: FlexibleSegment,
  newAvailableTime: number    // 予約反映後の利用可能時間
): FlexibleSegment {
  const originalTime = segment.originalDuration;
  const places = segment.places;
  
  if (newAvailableTime <= 0) {
    // 時間がない場合: 全ての場所を削除
    return {
      ...segment,
      places: [],
      adjustmentRatio: 0,
      deletedPlaces: [...places]
    };
  }
  
  // 移動時間を計算（変更しない）
  const totalTravelTime = places.reduce((sum, place) => 
    sum + (place.travel_time_from_previous || 0), 0
  );
  
  // 滞在時間の調整可能時間
  const originalStayTime = originalTime - totalTravelTime;
  const newStayTime = newAvailableTime - totalTravelTime;
  
  if (newStayTime <= 0) {
    // 移動時間だけで時間が足りない場合: 場所を削除
    const placesToKeep = [];
    let accumulatedTravelTime = 0;
    
    for (const place of places) {
      const travelTime = place.travel_time_from_previous || 0;
      if (accumulatedTravelTime + travelTime + 30 <= newAvailableTime) { // 最低30分滞在
        placesToKeep.push({
          ...place,
          stay_duration_minutes: 30
        });
        accumulatedTravelTime += travelTime + 30;
      } else {
        break;
      }
    }
    
    return {
      ...segment,
      places: placesToKeep,
      adjustmentRatio: newStayTime / originalStayTime,
      deletedPlaces: places.slice(placesToKeep.length)
    };
  }
  
  // 等倍調整
  const adjustmentRatio = newStayTime / originalStayTime;
  
  const adjustedPlaces = places.map(place => ({
    ...place,
    stay_duration_minutes: Math.max(
      Math.round(place.stay_duration_minutes * adjustmentRatio),
      30  // 最低30分滞在
    )
  }));
  
  return {
    ...segment,
    places: adjustedPlaces,
    adjustmentRatio: adjustmentRatio,
    deletedPlaces: []
  };
}
```

#### 予約セグメントの処理
```typescript
function processBookingSegment(segment: BookingSegment): ProcessedSegment {
  const booking = segment.booking;
  
  if (booking.booking_type === 'hotel') {
    // ホテル予約: 新しい場所として追加
    return {
      ...segment,
      generatedPlace: {
        id: `hotel_${booking.id}`,
        name: booking.hotel_name,
        latitude: booking.latitude,
        longitude: booking.longitude,
        category: 'accommodation',
        place_type: 'booking_hotel',
        source: 'booking',
        arrival_time: booking.check_in_time + ':00',
        departure_time: booking.check_out_time + ':00',
        stay_duration_minutes: segment.fixedDuration,
        booking_id: booking.id,
        is_booking_generated: true,
        // 深夜時間帯対応
        spans_midnight: booking.check_in_date !== booking.check_out_date
      }
    };
    
  } else {
    // 交通手段予約: 移動時間として処理、新しい場所は追加しない
    return {
      ...segment,
      transportInfo: {
        mode: booking.booking_type,
        route: booking.route,
        departure_time: booking.departure_time + ':00',
        arrival_time: booking.arrival_time + ':00',
        duration: segment.fixedDuration,
        booking_id: booking.id,
        // 深夜・日跨ぎ対応
        spans_midnight: booking.departure_date !== (booking.arrival_date || booking.departure_date)
      }
    };
  }
}
```

### 5. 深夜時間帯・日跨ぎ対応

#### 深夜時間の処理
```typescript
function handleOvernightSegments(segments: ProcessedSegment[]): ProcessedSegment[] {
  return segments.map(segment => {
    if (segment.type === 'fixed_booking') {
      const booking = segment.booking;
      
      // 深夜時間帯のチェック（20:00-08:00）
      const startTime = segment.startCumulativeTime % (24 * 60);  // 1日内での時刻
      const endTime = (segment.startCumulativeTime + segment.fixedDuration) % (24 * 60);
      
      const isOvernightPeriod = 
        startTime >= (20 * 60) ||  // 20:00以降開始
        endTime <= (8 * 60) ||     // 08:00以前終了  
        startTime > endTime;       // 日跨ぎ
      
      if (isOvernightPeriod) {
        return {
          ...segment,
          allowsOvernightActivity: true,
          overnightReason: booking.booking_type === 'hotel' ? 'hotel_stay' : 
                          booking.booking_type === 'flight' ? 'flight_schedule' : 'transport_booking'
        };
      }
    }
    
    return segment;
  });
}
```

#### 日跨ぎスケジュール生成
```typescript
function generateDailyScheduleWithOvernightSupport(
  segments: ProcessedSegment[],
  tripStartDate: string
): DailySchedule[] {
  const dailySchedules = [];
  const placesByDay = new Map<string, ScheduledPlace[]>();
  
  for (const segment of segments) {
    if (segment.type === 'flexible' && segment.places) {
      // 柔軟セグメント: 各場所を適切な日に配置
      for (const place of segment.places) {
        const absoluteTime = convertCumulativeTimeToAbsolute(
          place.cumulativeArrivalTime, 
          tripStartDate
        );
        
        if (!placesByDay.has(absoluteTime.date)) {
          placesByDay.set(absoluteTime.date, []);
        }
        
        placesByDay.get(absoluteTime.date)!.push({
          ...place,
          arrival_time: absoluteTime.time,
          departure_time: convertCumulativeTimeToAbsolute(
            place.cumulativeArrivalTime + place.stay_duration_minutes,
            tripStartDate
          ).time
        });
      }
      
    } else if (segment.type === 'fixed_booking' && segment.generatedPlace) {
      // 予約セグメント: ホテルなど
      const place = segment.generatedPlace;
      
      if (place.spans_midnight) {
        // 日跨ぎホテル: 各日に分割して配置
        const checkInDate = segment.booking.check_in_date;
        const checkOutDate = segment.booking.check_out_date;
        
        let currentDate = new Date(checkInDate);
        const endDate = new Date(checkOutDate);
        
        while (currentDate <= endDate) {
          const dateString = currentDate.toISOString().split('T')[0];
          
          if (!placesByDay.has(dateString)) {
            placesByDay.set(dateString, []);
          }
          
          // その日の宿泊時間を計算
          const dayStart = currentDate.toISOString().split('T')[0] === checkInDate ? 
                          segment.booking.check_in_time : '00:00';
          const dayEnd = currentDate.toISOString().split('T')[0] === checkOutDate ? 
                        segment.booking.check_out_time : '23:59';
          
          placesByDay.get(dateString)!.push({
            ...place,
            id: `${place.id}_${dateString}`,
            arrival_time: dayStart + ':00',
            departure_time: dayEnd + ':00',
            is_hotel_segment: true,
            original_hotel_id: place.id
          });
          
          currentDate.setDate(currentDate.getDate() + 1);
        }
      } else {
        // 通常の予約
        const absoluteTime = convertCumulativeTimeToAbsolute(
          segment.startCumulativeTime,
          tripStartDate
        );
        
        if (!placesByDay.has(absoluteTime.date)) {
          placesByDay.set(absoluteTime.date, []);
        }
        
        placesByDay.get(absoluteTime.date)!.push(place);
      }
    }
  }
  
  // 日別スケジュール作成
  const sortedDates = Array.from(placesByDay.keys()).sort();
  
  return sortedDates.map((date, index) => {
    const places = placesByDay.get(date)!
      .sort((a, b) => a.arrival_time.localeCompare(b.arrival_time))
      .map((place, order) => ({ ...place, order_in_day: order + 1 }));
    
    return {
      day: index + 1,
      date: date,
      scheduled_places: places,
      total_travel_time: places.reduce((sum, p) => sum + (p.travel_time_from_previous || 0), 0),
      total_visit_time: places.reduce((sum, p) => sum + (p.stay_duration_minutes || 0), 0),
      meal_breaks: [],
      has_overnight_activities: places.some(p => 
        isOvernightTime(p.arrival_time) || isOvernightTime(p.departure_time)
      )
    };
  });
}

function isOvernightTime(timeString: string): boolean {
  const hour = parseInt(timeString.split(':')[0]);
  return hour >= 20 || hour < 8;  // 20:00-08:00
}
```

### 6. 新optimization_result生成・保存

#### optimization_results構造
```typescript
interface AdoptBookingResult {
  id: string;
  trip_id: string;
  created_by: string;
  optimized_route: DailySchedule[];  // 上記で生成された日別スケジュール
  optimization_score: {
    total_score: number;              // 85-95 (予約制約により高スコア)
    fairness_score: number;          // 90-100 (予約優先により公平)
    efficiency_score: number;        // 計算値 (調整率に基づく)
    feasibility_score: number;       // 計算値 (削除場所に基づく)
    validation_issues: string[];     // 削除された場所のリスト
    details: {
      is_feasible: boolean;
      travel_efficiency: number;
      user_adoption_balance: number;
      wish_satisfaction_balance: number;
      time_constraint_compliance: number;
      // adopt_booking固有
      booking_integration_success: boolean;
      total_bookings_adopted: number;
      segments_adjusted: number;
      places_deleted_count: number;
      average_adjustment_ratio: number;  // 平均調整倍率
    }
  };
  execution_time_ms: number;
  places_count: number;
  total_travel_time_minutes: number;
  total_visit_time_minutes: number;
  is_active: boolean;                  // true (フロントエンド表示用)
  algorithm_version: string;           // "adopt-booking-v1"
  notes: string;                       // "Adopted X bookings with Y% average time adjustment"
  created_at: timestamp;
}
```

#### 保存処理
```typescript
async function saveAdoptBookingResult(
  tripId: string,
  userId: string,
  optimizedSchedule: DailySchedule[],
  optimizationMetrics: OptimizationMetrics
) {
  // 1. 既存の結果を無効化
  await supabase
    .from('optimization_results')
    .update({ is_active: false })
    .eq('trip_id', tripId);
  
  // 2. 新規結果を保存
  const newResult = {
    trip_id: tripId,
    created_by: userId,
    optimized_route: optimizedSchedule,
    optimization_score: calculateAdoptBookingScore(optimizationMetrics),
    execution_time_ms: optimizationMetrics.executionTime,
    places_count: optimizationMetrics.totalPlaces,
    total_travel_time_minutes: optimizationMetrics.totalTravelTime,
    total_visit_time_minutes: optimizationMetrics.totalVisitTime,
    is_active: true,
    algorithm_version: 'adopt-booking-v1',
    notes: `Adopted ${optimizationMetrics.bookingsCount} bookings with ${Math.round(optimizationMetrics.averageAdjustmentRatio * 100)}% average time adjustment`
  };
  
  const { data, error } = await supabase
    .from('optimization_results')
    .insert(newResult);
  
  return { data, error };
}
```

## 🎯 重要な設計原則

### 1. 予約時間の絶対厳守
- フライト、交通手段、ホテルの時間は**絶対に変更しない**
- 移動時間も予約で指定された場合は**厳守する**

### 2. 既存場所の調整方針
- **移動時間**: 維持（距離ベースの計算値または予約指定値）
- **滞在時間**: 等倍調整（予約後の利用可能時間に基づく）
- **順序**: 時系列順に固定（累積時間順）

### 3. 深夜時間帯の許可条件
- ホテル滞在中: 深夜活動OK
- フライト・交通手段: 深夜移動OK  
- 通常観光: 深夜活動NG（20:00-08:00は除外）

### 4. 場所削除の優先順位
1. wish_level低い場所から削除
2. 予約で生成された場所は削除不可
3. 最低30分滞在時間確保

## ⚠️ エラーハンドリング

### 1. 時間制約違反
```typescript
if (newAvailableTime <= 0) {
  return {
    success: false,
    error: 'INSUFFICIENT_TIME',
    message: `予約により時間が不足しています。${deletedPlaces.length}箇所の観光地を削除する必要があります。`,
    deletedPlaces: deletedPlaces,
    suggestedAction: '予約時間を調整するか、観光地を減らしてください。'
  };
}
```

### 2. 予約データ不整合
```typescript
if (!booking.departure_time || !booking.departure_date) {
  return {
    success: false,
    error: 'INVALID_BOOKING_DATA',
    message: '予約データに必須項目が不足しています。',
    booking_id: booking.id
  };
}
```

### 3. 深夜時間帯の警告
```typescript
if (hasOvernightActivities && !isHotelOrTransportBooking) {
  warnings.push({
    type: 'OVERNIGHT_ACTIVITY',
    message: '深夜時間帯(20:00-08:00)の活動が含まれています。',
    affected_places: overnightPlaces
  });
}
```

## 🚀 実装手順

### Phase 1: Edge Function作成
1. `supabase/functions/adopt-booking/index.ts` 作成
2. 基本的なリクエスト処理とレスポンス構造
3. データベース接続とクエリ実装

### Phase 2: コア機能実装  
1. 時間変換関数群
2. セグメント分割アルゴリズム
3. 時間調整ロジック

### Phase 3: 深夜・日跨ぎ対応
1. 深夜時間帯の判定と処理
2. 日跨ぎスケジュール生成
3. ホテル滞在の複数日処理

### Phase 4: 統合とテスト
1. BookingServiceからのトリガー実装
2. エラーハンドリング強化
3. 既存システムとの結合テスト

## 📊 テスト方式

### 1. 基本ケース
- ホテル予約 → 深夜チェックイン対応確認
- フライト予約 → 移動時間厳守確認  
- 複数予約 → セグメント分割確認

### 2. 時間制約ケース
- 時間不足 → 場所削除確認
- 深夜時間 → 深夜活動制限確認
- 日跨ぎ → 複数日分割確認

### 3. データ整合性
- optimization_results形式確認
- is_active切り替え確認
- フロントエンド表示確認

---

*この設計書に基づいてadopt-booking Edge Functionを実装し、予約時間を厳守した柔軟なスケジュール調整を実現します。*