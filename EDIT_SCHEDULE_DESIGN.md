# Edit-Schedule Edge Function 設計書

## 🎯 概要
edit-schedule Edge Functionは、時間制約のあるbooking（フライト・car・walking・ホテル）をtripに追加し、既存のscheduleを更新する機能です。

## 📋 基本仕様

### 入力データ (BookingService.addToTrip から)
```typescript
// edit-scheduleへのリクエスト形式（簡略化）
{
  trip_id: string,
  member_id: string, 
  action: 'optimize_with_constraints'
  // bookingデータは含まない（placesテーブルに保存済み）
}
```

### 出力データ (optimize-route互換)
```typescript
// レスポンス形式
{
  success: true,
  optimization: {
    daily_schedules: Array<{
      day: number,
      date: string, // "YYYY-MM-DD"
      scheduled_places: Array<{
        id: string,
        name: string,
        arrival_time: string, // "HH:mm:ss"
        departure_time: string, // "HH:mm:ss"
        day_number: number,
        order_in_day: number,
        transport_mode: 'walking' | 'car' | 'flight',
        travel_time_from_previous: number,
        stay_duration_minutes: number,
        // ... その他place情報
      }>,
      total_travel_time: number,
      total_visit_time: number,
      meal_breaks: []
    }>
  },
  message: string
}
```

## 🔄 処理フロー

### 1. BookingService.addToTrip (booking → placesテーブル制約)
```typescript
// Step 1: BookingService.addToTrip実行
// フライト・car・walkingの場合：両端の場所の制約として保存
booking: {
  booking_type: 'flight',
  route: "Tokyo Haneda Airport → Beijing Daxing International Airport",
  departure_time: "09:00",
  departure_date: "2025-09-07"
}

↓ BookingServiceが実行

// placesテーブル更新（既存のplace）
UPDATE places SET constraint_departure_time = "2025-09-07T09:00:00+00:00" 
WHERE name LIKE "%Tokyo Haneda%" AND trip_id = xxx;

UPDATE places SET constraint_arrival_time = "2025-09-07T14:00:00+00:00" 
WHERE name LIKE "%Beijing Daxing%" AND trip_id = xxx;

// ホテルの場合：新しい制約付きplaceとして追加
booking: {
  booking_type: 'hotel',
  hotel_name: "Hilton Tokyo",
  check_in_date: "2025-09-07",
  check_in_time: "15:00",
  check_out_date: "2025-09-08", 
  check_out_time: "11:00",
  latitude: 35.6762,
  longitude: 139.7603
}

↓ BookingServiceが実行

// placesテーブルに新規追加
INSERT INTO places (
  trip_id, name, latitude, longitude,
  constraint_arrival_time, constraint_departure_time,
  place_type, category
) VALUES (
  xxx, "Hilton Tokyo", 35.6762, 139.7603,
  "2025-09-07T15:00:00+00:00", "2025-09-08T11:00:00+00:00",
  "hotel", "accommodation"
);

// Step 2: BookingService.addToTripがedit-scheduleを呼び出し
// ただし、bookingデータは渡さない（placesテーブルに保存済み）
supabase.functions.invoke('edit-schedule', {
  body: {
    trip_id: tripId,
    member_id: userId,
    action: 'optimize_with_constraints'  // booking情報は渡さない
  }
});
```
### 2. edit-schedule Edge Functionのデータ取得
```sql
-- トリップ詳細
SELECT start_date, end_date FROM trips WHERE id = trip_id;

-- 全place情報（制約付き）- edit-scheduleが実行
SELECT *, 
  constraint_departure_time,
  constraint_arrival_time,
  CASE 
    WHEN constraint_departure_time IS NOT NULL OR constraint_arrival_time IS NOT NULL 
    THEN TRUE ELSE FALSE 
  END as has_time_constraint
FROM places 
WHERE trip_id = trip_id 
ORDER BY 
  has_time_constraint DESC,  -- 制約付きplace優先
  wish_level DESC, 
  created_at ASC;
```

### 3. セグメント分割最適化
```typescript
// IMPLEMENTATION_PLAN.mdの通り
全体: A → B → C(制約) → D → E → F(制約) → G → H

セグメント1: A → B → (C制約へ向かう)
セグメント2: (C制約から) → D → E → (F制約へ向かう)  
セグメント3: (F制約から) → G → H

// 各セグメント内でoptimize-routeロジック適用
// 制約間の順序は固定、収まらない場所は削除
```

### 4. 時間制約適用
```typescript
// 制約のある場所
if (place.constraint_departure_time) {
  const constraintTime = new Date(place.constraint_departure_time);
  place.arrival_time = formatTime((constraintTime.getHours() * 60); 
  place.departure_time = formatTime(constraintTime.getHours() * 60);
}

// 制約のない場所：セグメント内で通常の時間計算
```

### 5. データベース保存
```typescript
// optimization_resultsテーブル（optimize-route互換）
{
  trip_id: string,
  created_by: string,
  optimized_route: daily_schedules, // 上記形式
  optimization_score: {
    total_score: 85,
    fairness_score: 85,
    efficiency_score: 85,
    feasibility_score: 85,
    validation_issues: [],
    details: {
      user_adoption_balance: 0.85,
      wish_satisfaction_balance: 0.85,
      travel_efficiency: 0.85,
      time_constraint_compliance: 0.85,
      is_feasible: true,
      // edit-schedule固有
      constraint_satisfaction: true,
      segments_processed: number,
      constrained_places: number
    }
  },
  execution_time_ms: number,
  places_count: number,
  total_travel_time_minutes: number,
  total_visit_time_minutes: number,
  is_active: true, // 重要！
  algorithm_version: 'edit-schedule-constraints-v1'
}
```

## 🔧 optimize-routeとの差分

### 同じ部分
- **出力形式**: `daily_schedules`構造完全互換
- **距離・移動時間計算**: Haversine公式、同じ速度設定
- **移動手段判定**: 距離ベース（2km以下walking、500km以下car、それ以上flight）
- **時刻フォーマット**: `formatTime()`関数同一
- **データベース保存**: `optimization_results`テーブル、同じスキーマ

### 違う部分
- **入力**: optimize-route（全place最適化） vs edit-schedule（booking追加）
- **最適化方法**: optimize-route（TSP+日分割） vs edit-schedule（セグメント分割）
- **制約処理**: optimize-route（なし） vs edit-schedule（時間制約優先）
- **place順序**: optimize-route（完全最適化） vs edit-schedule（制約間固定順序）

## ⚠️ 重要な注意点

### 1. 制約時刻の扱い
- **ISO datetime文字列**: `"2025-09-07T09:00:00+00:00"`
- **日跨ぎ対応**: constraint_departure_timeとconstraint_arrival_timeの日付が異なる場合
- **タイムゾーン**: ユーザーの現地時間で入力、UTCで保存

### 2. データベース操作
```typescript
// 必須：既存結果を無効化してから新規保存
await supabase.from('optimization_results')
  .update({ is_active: false })
  .eq('trip_id', tripId);

await supabase.from('optimization_results').insert({
  // ... new data
  is_active: true
});
```

### 3. エラーハンドリング
- **空港place検索失敗**: 部分一致で retry
- **制約違反**: 収まらない場所は削除、ユーザーに通知
- **セグメント空**: 空のセグメントはスキップ

### 4. 移動時間・手段計算
```typescript
// optimize-routeと同じロジック使用
function calculateDistance(point1, point2) {
  // Haversine formula
}

function determineTransportMode(distance) {
  if (distance <= 2) return 'walking';
  if (distance <= 500) return 'car';
  return 'flight';
}

function calculateTravelTime(distance, mode) {
  // optimize-routeと同じ速度設定
}
```

## 🚀 実装の核心ポイント

### 1. セグメント分割ロジック
```typescript
function segmentPlacesByConstraints(places) {
  const segments = [];
  let currentSegment = [];
  
  for (const place of places) {
    if (place.constraint_departure_time || place.constraint_arrival_time) {
      // 制約place前のセグメントを完結
      if (currentSegment.length > 0) {
        segments.push([...currentSegment]);
        currentSegment = [];
      }
      // 制約place単体でセグメント
      segments.push([place]);
    } else {
      currentSegment.push(place);
    }
  }
  
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }
  
  return segments;
}
```

### 2. 制約ベース日分割
```typescript
function adjustScheduleForConstraints(optimizedRoute, tripStartDate) {
  const placesByDay = new Map();
  
  for (const place of optimizedRoute) {
    let dayKey = '1'; // デフォルト
    
    // 制約がある場合はその日付を使用
    if (place.constraint_departure_time) {
      dayKey = new Date(place.constraint_departure_time).toISOString().split('T')[0];
    }
    
    if (!placesByDay.has(dayKey)) {
      placesByDay.set(dayKey, []);
    }
    placesByDay.get(dayKey).push(place);
  }
  
  // 各日のスケジュール作成
  return Array.from(placesByDay.entries()).map(([date, places], index) => 
    createDaySchedule(index + 1, places, tripStartDate)
  );
}
```

### 3. BookingService.addToTrip実装例
```typescript
// BookingServiceでの制約追加処理
async function addToTrip(tripId: string, userId: string, booking: Booking) {
  // Step 1: bookingをbookingsテーブルに保存（既存処理）
  const savedBooking = await this.saveBooking(booking);
  
  // Step 2: placesテーブルに制約を追加
  if (booking.booking_type === 'flight' || booking.booking_type === 'car' || booking.booking_type === 'walking') {
    // 移動手段：両端の場所に制約追加
    const [depLocation, arrLocation] = booking.route.split(' → ');
    
    // 出発地place検索・制約追加
    await supabase.from('places')
      .update({ 
        constraint_departure_time: `${booking.departure_date}T${booking.departure_time}:00+00:00` 
      })
      .eq('trip_id', tripId)
      .ilike('name', `%${depLocation.trim()}%`);
    
    // 到着地place検索・制約追加
    await supabase.from('places')
      .update({ 
        constraint_arrival_time: `${booking.departure_date}T${booking.arrival_time}:00+00:00` 
      })
      .eq('trip_id', tripId)
      .ilike('name', `%${arrLocation.trim()}%`);
      
  } else if (booking.booking_type === 'hotel') {
    // ホテル：新しい制約付きplaceとして追加
    await supabase.from('places').insert({
      trip_id: tripId,
      user_id: userId,
      name: booking.hotel_name,
      address: booking.address,
      latitude: booking.latitude,
      longitude: booking.longitude,
      category: 'accommodation',
      place_type: 'hotel',
      constraint_arrival_time: `${booking.check_in_date}T${booking.check_in_time}:00+00:00`,
      constraint_departure_time: `${booking.check_out_date}T${booking.check_out_time}:00+00:00`,
      stay_duration_minutes: calculateHotelStayDuration(booking),
      wish_level: 5, // ホテルは高優先度
      source: 'booking'
    });
  }
  
  // Step 3: edit-scheduleを呼び出し（制約情報は渡さない）
  await supabase.functions.invoke('edit-schedule', {
    body: {
      trip_id: tripId,
      member_id: userId,
      action: 'optimize_with_constraints'
    }
  });
}
```

## 📝 テスト方法

### 1. 基本テスト(supabasemcpを使用すること)
- フライト追加 → 空港place時刻固定確認
- Map/List view表示確認
- is_active=true確認

### 2. Edge case
- 日跨ぎフライト
- 存在しない空港名
- 制約違反（時間が足りない）

### 3. データ整合性
- optimization_results形式
- daily_schedules構造
- place情報完全性

---

*この設計書は実装時の完全な指針として使用してください。optimize-routeとの互換性維持が最重要です。*