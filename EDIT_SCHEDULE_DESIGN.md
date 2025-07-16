# Edit-Schedule Edge Function 設計書

## 🎯 概要
edit-schedule Edge Functionは、時間制約のあるbooking（フライト・car・walking・ホテル）をtripに追加し、既存のscheduleを更新する機能です。

## 📋 基本仕様

### 入力データ (BookingService.addToTrip から)
```typescript
// edit-scheduleへのリクエスト形式（optimize-route互換）
{
  trip_id: string,                  // 必須: トリップID
  member_id: string,                // 必須: ユーザーID
  action: 'optimize_with_constraints',  // アクション種別
  
  // optimize-routeと同じ構造で取得・受け渡し
  user_places: Place[],             // 全place情報（制約付き含む）
  constraints: {
    time_constraint_minutes: number,    // デフォルト: 1440 (24時間)
    distance_constraint_km: number,     // デフォルト: 1000
    budget_constraint_yen: number,      // デフォルト: 100000
    max_places: number                  // デフォルト: 20
  },
  transport_mode: string,           // 'mixed' | 'car' | 'walking' | 'flight'
  
  // trip情報（DBから取得）
  trip_data: {
    id: string,
    name: string,
    start_date: string,             // "2025-09-06" (YYYY-MM-DD)
    end_date: string,               // "2025-09-12" (YYYY-MM-DD)
    description?: string,
    created_at: string
  }
}
```

### Place型定義（時間制約対応）
```typescript
interface Place {
  // 基本情報
  id: string,
  name: string,
  latitude: number,
  longitude: number,
  trip_id: string,
  user_id: string,
  
  // 場所分類
  category: string,                    // 'tourist_attraction' | 'departure_point' | 'final_destination' | 'transportation' | 'attraction'
  place_type: string,                  // 'member_wish' | 'departure' | 'destination' | 'system_airport'
  source: string,                      // 'google_maps_booking' | 'system' | 'user' | 'system_old'
  
  // 優先度・時間
  wish_level: number,                  // 1-5 (bookingは5で高優先度)
  stay_duration_minutes: number,       // 滞在時間（分）
  preferred_time_of_day?: string,      // 'morning' | 'noon' | 'afternoon' | 'night'
  
  // 🔥 時間制約（edit-scheduleの核心）
  constraint_arrival_time?: string,   // "2025-09-06 23:00:00+00" (timestamptz)
  constraint_departure_time?: string, // "2025-09-07 11:00:00+00" (timestamptz)
  
  // edit-schedule変換後の制約情報（optimize-route互換）
  cumulative_arrival_time?: number,   // 累積到着時間（分）
  cumulative_departure_time?: number, // 累積出発時間（分）
  constraint_type?: 'HOTEL_CHECKIN' | 'AIRPORT_DEPARTURE' | 'AIRPORT_ARRIVAL',
  original_constraint_times?: {       // 元の制約時間保持
    check_in?: string,
    check_out?: string
  },
  original_departure_time?: string,   // 空港出発時刻保持
  original_arrival_time?: string,     // 空港到着時刻保持
  
  // メタデータ
  notes?: string,                      // "Hotel booking: Hotel Villa Fontaine Grand Haneda Airport | Context: Yokohama-2025-09-06"
  address?: string,
  google_place_id?: string,
  display_color_hex?: string,
  
  // 最適化後に設定される値
  transport_mode?: 'walking' | 'car' | 'flight',
  travel_time_from_previous?: number,
  arrival_time?: string,              // "HH:MM:SS" 
  departure_time?: string,            // "HH:MM:SS"
  order_in_day?: number,
  day_number?: number,
  
  // 計算用
  normalized_wish_level?: number,
  is_airport?: boolean,
  airport_code?: string,
  created_at: string
}
```

### 時間制約フォーマット詳細
```typescript
// データベース保存形式（PostgreSQL timestamptz）
constraint_arrival_time: "2025-09-06 23:00:00+00"    // UTC基準
constraint_departure_time: "2025-09-07 11:00:00+00"   // UTC基準

// JavaScript Date変換
const constraintTime = new Date(place.constraint_arrival_time);
// → Mon Sep 06 2025 23:00:00 GMT+0000 (UTC)

// 時刻抽出（edit-scheduleでの使用）
const hours = constraintTime.getUTCHours();      // 23
const minutes = constraintTime.getUTCMinutes();  // 0
const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
// → "23:00:00"

// 日付抽出（日分割での使用）
const dateString = constraintTime.toISOString().split('T')[0];
// → "2025-09-06"
```

### 制約パターン例（optimize-route互換変換後）
```typescript
// 1. ホテル予約：チェックイン制約（チェックアウトは滞在時間で管理）
{
  name: "Hotel Villa Fontaine Grand Haneda Airport",
  constraint_arrival_time: "2025-09-06 23:00:00+00",    // 元データ保持
  constraint_departure_time: "2025-09-07 11:00:00+00",   // 元データ保持
  
  // edit-schedule変換後（optimize-route互換）
  cumulative_arrival_time: 900,                         // 15時間後 = チェックイン時刻
  stay_duration_minutes: 720,                           // チェックアウト時刻まで調整
  constraint_type: "HOTEL_CHECKIN",
  original_constraint_times: {
    check_in: "2025-09-06 23:00:00+00",
    check_out: "2025-09-07 11:00:00+00"
  },
  wish_level: 5,
  source: "google_maps_booking"
}

// 2. フライト予約：出発空港制約
{
  name: "Departure: Hanedakuko, Ota City, Tokyo",
  constraint_departure_time: "2025-09-07 15:00:00+00",  // 元データ保持
  constraint_arrival_time: null,
  
  // edit-schedule変換後（arrival_time = departure_time - stay_duration）
  cumulative_arrival_time: 810,                         // 15:00-90分 = 13:30
  stay_duration_minutes: 90,                            // 空港処理時間
  constraint_type: "AIRPORT_DEPARTURE",
  original_departure_time: "2025-09-07 15:00:00+00",
  category: "transportation",
  place_type: "departure"
}

// 3. フライト予約：到着空港制約  
{
  name: "Beijing Daxing International Airport",
  constraint_arrival_time: "2025-09-07 19:00:00+00",    // 元データ保持
  constraint_departure_time: null,
  
  // edit-schedule変換後（arrival_time = 到着時刻）
  cumulative_arrival_time: 1020,                        // 19:00 = 到着時刻
  stay_duration_minutes: 90,                            // 空港処理時間
  constraint_type: "AIRPORT_ARRIVAL",
  original_arrival_time: "2025-09-07 19:00:00+00",
  category: "attraction",
  place_type: "member_wish"
}

// 4. 通常の場所：制約なし
{
  name: "Forbidden City",
  constraint_arrival_time: null,
  constraint_departure_time: null,
  cumulative_arrival_time: undefined,                   // 制約なし
  constraint_type: undefined,
  wish_level: 3,
  source: "user"
}
```

### 出力データ (optimize-route互換)
```typescript
// レスポンス形式
{
  success: true,
  optimization: {
    daily_schedules: Array<{
      day: number,                    // 日番号 (1, 2, 3...)
      date: string,                   // "2025-09-07" (YYYY-MM-DD)
      scheduled_places: Array<{
        // 基本place情報（全てのフィールド保持）
        id: string,
        name: string,
        latitude: number,
        longitude: number,
        trip_id: string,
        user_id: string,
        category: string,
        place_type: string,
        source: string,
        wish_level: number,
        stay_duration_minutes: number,
        
        // 最適化後の時間・順序情報
        arrival_time: string,           // "12:00:00" (HH:MM:SS)
        departure_time: string,         // "13:00:00" (HH:MM:SS)
        day_number: number,             // 訪問日番号
        order_in_day: number,           // 当日内の順序 (1, 2, 3...)
        transport_mode: 'walking' | 'car' | 'flight',
        travel_time_from_previous: number,  // 前の場所からの移動時間（分）
        
        // 制約情報（元データ保持）
        constraint_arrival_time?: string,   // "2025-09-06T23:00:00+00:00"
        constraint_departure_time?: string, // "2025-09-07T11:00:00+00:00"
        constraint_day?: number,            // 制約日番号（最適化で設定）
        constraint_time?: string,           // "12:00:00" (制約時刻簡略)
        
        // 🔥 日跨ぎ分割結果情報（UI統合用）
        is_virtual_split?: boolean,         // 分割された仮想placeかどうか
        original_place_id?: string,         // 元のplace ID（分割前）
        split_day_index?: number,           // 分割セグメントの日番号
        split_total_days?: number,          // 総分割日数
        merged_from_splits?: any[]          // UI統合時の元分割データ
        
        // その他メタデータ（完全保持）
        address?: string,
        google_place_id?: string,
        rating?: number,
        google_rating?: number,
        images?: string[],
        notes?: string,
        display_color_hex?: string,
        estimated_cost?: number,
        opening_hours?: object,
        google_types?: string[],
        preferred_time_of_day?: string,
        
        // 最適化メタデータ
        is_selected_for_optimization?: boolean,
        optimization_metadata?: object,
        fairness_contribution_score?: number,
        
        // 日時情報
        scheduled_date?: string,        // "2025-09-07"
        visit_date?: string,            // "2025-09-07"
        created_at: string,
        updated_at?: string
      }>,
      total_travel_time: number,      // 当日の総移動時間（分）
      total_visit_time: number,       // 当日の総滞在時間（分）
      meal_breaks: []                 // 食事休憩（現在は空配列）
    }>
  },
  
  // 最適化スコア（edit-schedule対応）
  optimization_score: {
    total_score: number,              // 総合スコア (0-100)
    fairness_score: number,          // 公平性スコア
    efficiency_score: number,        // 効率性スコア
    feasibility_score: number,       // 実現可能性スコア
    validation_issues: string[],     // 検証で発見された問題
    details: {
      is_feasible: boolean,
      travel_efficiency: number,
      user_adoption_balance: number,
      wish_satisfaction_balance: number,
      time_constraint_compliance: number,
      
      // edit-schedule固有のメトリクス
      constraint_satisfaction: boolean,    // 制約満足度
      constrained_places: number,         // 制約付き場所数
      segments_processed: number          // 処理されたセグメント数
    }
  },
  
  // 実行統計
  execution_time_ms: number,
  places_count: number,
  total_travel_time_minutes: number,
  total_visit_time_minutes: number,
  
  message: string
}
```

### optimization_resultsテーブル保存形式
```typescript
{
  id: string,                       // UUID
  trip_id: string,
  created_by: string,               // user_id
  optimized_route: DailySchedule[], // 上記daily_schedules配列
  optimization_score: {
    total_score: number,
    fairness_score: number,
    efficiency_score: number,
    feasibility_score: number,
    validation_issues: string[],
    details: {
      is_feasible: boolean,
      travel_efficiency: number,
      user_adoption_balance: number,
      wish_satisfaction_balance: number,
      time_constraint_compliance: number,
      constraint_satisfaction: boolean,
      constrained_places: number,
      segments_processed: number
    }
  },
  execution_time_ms: number,
  places_count: number,
  total_travel_time_minutes: number,
  total_visit_time_minutes: number,
  is_active: boolean,               // 重要: 最新結果はtrue
  algorithm_version: string,        // "edit-schedule-constraints-v1"
  created_at: string
}
```

## 🔄 処理フロー: DB単一 → 最適化分割 → UI統合

### 1. BookingService.addToTrip (booking → placesテーブル単一保存)
```typescript
// Step 1: BookingService.addToTrip実行
// フライト・car・walkingの場合：日跨ぎ対応で制約保存
booking: {
  booking_type: 'flight',
  route: "Tokyo Haneda Airport → Beijing Daxing International Airport",
  departure_time: "23:00",  // 深夜出発
  departure_date: "2025-09-07",
  arrival_time: "03:00",   // 翌日早朝到着
  arrival_date: "2025-09-08"  // 日跨ぎ
}

↓ BookingServiceが実行（日跨ぎ検出付き）

// 日跨ぎ検出ロジック（既存）
let arrivalDate = booking.arrival_date || booking.departure_date;
if (!booking.arrival_date && booking.departure_time && booking.arrival_time) {
  const depHour = parseInt(booking.departure_time.split(':')[0]);
  const arrHour = parseInt(booking.arrival_time.split(':')[0]);
  // 到着時刻が出発より早い場合は翌日と判定
  if (arrHour < depHour && (depHour - arrHour) > 12) {
    const nextDay = new Date(booking.departure_date);
    nextDay.setDate(nextDay.getDate() + 1);
    arrivalDate = nextDay.toISOString().split('T')[0];
  }
}

// placesテーブル更新（既存のplace）- 日跨ぎ対応
const departureDateTime = `${booking.departure_date}T${booking.departure_time}:00.000Z`;
const arrivalDateTime = `${arrivalDate}T${booking.arrival_time}:00.000Z`;
const isMultiDay = booking.departure_date !== arrivalDate;

UPDATE places SET 
  constraint_departure_time = "2025-09-07T23:00:00+00:00",
  is_multi_day_booking = true  -- 日跨ぎフラグ
WHERE name LIKE "%Tokyo Haneda%" AND trip_id = xxx;

UPDATE places SET 
  constraint_arrival_time = "2025-09-08T03:00:00+00:00",
  is_multi_day_booking = true  -- 日跨ぎフラグ
WHERE name LIKE "%Beijing Daxing%" AND trip_id = xxx;

// ホテルの場合：単一placeとして保存（日跨ぎも1レコード）
booking: {
  booking_type: 'hotel',
  hotel_name: "Hilton Tokyo",
  check_in_date: "2025-09-07",
  check_in_time: "15:00",
  check_out_date: "2025-09-09",  // 2日間跨ぎ
  check_out_time: "11:00",
  latitude: 35.6762,
  longitude: 139.7603
}

↓ BookingServiceが実行（単一place作成）

// 🔥 新方式：日跨ぎも単一placeとして保存
const checkInDateTime = `${booking.check_in_date}T${booking.check_in_time}:00.000Z`;
const checkOutDateTime = `${booking.check_out_date}T${booking.check_out_time}:00.000Z`;
const stayDurationMinutes = Math.round((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));
const isMultiDay = booking.check_in_date !== booking.check_out_date;

// 単一placeとしてDB保存
INSERT INTO places (
  trip_id, name, latitude, longitude,
  constraint_arrival_time, constraint_departure_time,
  stay_duration_minutes, is_multi_day_booking,
  place_type, category, source, notes
) VALUES (
  xxx, "Hilton Tokyo", 35.6762, 139.7603,
  "2025-09-07T15:00:00+00:00", "2025-09-09T11:00:00+00:00",
  2640, true,  // 44時間, 日跨ぎフラグ
  "member_wish", "tourist_attraction", "google_maps_booking",
  "Hotel booking: Hilton Tokyo | Context: Tokyo-2025-09-07"
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
### 2. edit-schedule Edge Function: 日跨ぎ分割 + 最適化実行
```sql
-- 1. 最新の最適化結果を取得（順番情報の正確な情報源）
SELECT 
  optimized_route,
  optimization_score,
  created_at
FROM optimization_results 
WHERE trip_id = :trip_id 
  AND is_active = true
ORDER BY created_at DESC 
LIMIT 1;

-- 2. トリップ詳細
SELECT start_date, end_date, name, description 
FROM trips 
WHERE id = :trip_id;

-- 3. 全place情報（制約付き・日跨ぎ情報含む）
SELECT *, 
  constraint_departure_time,
  constraint_arrival_time,
  is_multi_day_booking,     -- 🔥 日跨ぎフラグ
  scheduled,
  is_selected_for_optimization,
  scheduled_date,
  scheduled_time_start,
  scheduled_time_end,
  travel_time_from_previous,
  CASE 
    WHEN constraint_departure_time IS NOT NULL OR constraint_arrival_time IS NOT NULL 
    THEN TRUE ELSE FALSE 
  END as has_time_constraint
FROM places 
WHERE trip_id = :trip_id 
ORDER BY 
  has_time_constraint DESC,  -- 制約付きplace優先
  is_multi_day_booking DESC, -- 日跨ぎplace優先
  scheduled DESC,           -- 採用済みplace優先
  wish_level DESC, 
  created_at ASC;

-- 4. 新規制約付きplace（日跨ぎ含む）
SELECT * FROM places 
WHERE trip_id = :trip_id 
  AND (constraint_arrival_time IS NOT NULL OR constraint_departure_time IS NOT NULL)
  AND (scheduled = false OR scheduled IS NULL)
ORDER BY is_multi_day_booking DESC;  -- 日跨ぎ優先処理

-- 5. edit-schedule内で日跨ぎ分割実行
-- ↓ splitMultiDayConstraints(allPlaces) 実行
-- ↓ convertConstraintsToCumulativeTime(splitPlaces) 実行  
-- ↓ optimize-route呼び出し（分割されたplace使用）
```

### 3. UI結果統合: 分割placeを元の単一placeに統合表示
```typescript
// UIコンポーネント内での処理（CalendarView等）
function mergeVirtualSplitsForUI(optimizationResult: any) {
  const mergedSchedules = [];
  
  for (const daySchedule of optimizationResult.daily_schedules) {
    const mergedPlaces = [];
    const virtualGroups = new Map();
    
    for (const place of daySchedule.scheduled_places) {
      if (place.is_virtual_split && place.original_place_id) {
        // 🔥 分割place → original_place_idでグループ化
        if (!virtualGroups.has(place.original_place_id)) {
          virtualGroups.set(place.original_place_id, []);
        }
        virtualGroups.get(place.original_place_id).push(place);
      } else {
        // 通常place → そのまま
        mergedPlaces.push(place);
      }
    }
    
    // 分割placeを統合して表示
    for (const [originalId, splitParts] of virtualGroups) {
      const mainPart = splitParts[0];
      const totalDuration = splitParts.reduce((sum, part) => sum + part.stay_duration_minutes, 0);
      
      mergedPlaces.push({
        ...mainPart,
        id: originalId,                    // 元IDに戻す
        is_virtual_split: false,           // 統合済みフラグ
        stay_duration_minutes: totalDuration,
        merged_from_splits: splitParts,    // UI用分割情報
        constraint_arrival_time: splitParts[0].constraint_arrival_time,
        constraint_departure_time: splitParts[splitParts.length - 1].constraint_departure_time,
        // UIで必要な場合は splitParts を使って日別表示可能
        display_segments: splitParts.map(part => ({
          date: part.scheduled_date,
          arrival_time: part.arrival_time,
          departure_time: part.departure_time,
          day_index: part.split_day_index
        }))
      });
    }
    
    mergedSchedules.push({
      ...daySchedule,
      scheduled_places: mergedPlaces
    });
  }
  
  return { ...optimizationResult, daily_schedules: mergedSchedules };
}
```

### 4. edit-schedule内での日跨ぎ分割と累積時間制最適化

#### 🔥 日跨ぎplace動的分割処理（edit-schedule内）
```typescript
// edit-schedule Edge Function内で最適化用に動的分割
// DB: 単一レコード → 最適化: 日別分割 → UI: 統合表示

function splitMultiDayConstraints(places: Place[], tripStartDate: string): Place[] {
  const splitPlaces = [];
  
  for (const place of places) {
    if (place.is_multi_day_booking && place.constraint_arrival_time && place.constraint_departure_time) {
      // 🏨 日跨ぎホテル → 日別セグメント作成
      const checkIn = new Date(place.constraint_arrival_time);
      const checkOut = new Date(place.constraint_departure_time);
      
      let currentDate = new Date(checkIn);
      let dayIndex = 0;
      
      while (currentDate < checkOut) {
        const nextDay = new Date(currentDate);
        nextDay.setDate(nextDay.getDate() + 1);
        nextDay.setHours(0, 0, 0, 0);
        
        const dayStart = dayIndex === 0 ? checkIn : 
                        new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0);
        const dayEnd = nextDay > checkOut ? checkOut : 
                      new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 23, 59, 59);
        
        // 各日のセグメント作成（仮想place）
        splitPlaces.push({
          ...place,
          id: `${place.id}_day${dayIndex + 1}`,           // 仮想ID for optimization
          original_place_id: place.id,                    // 元ID保持
          constraint_arrival_time: dayStart.toISOString(),
          constraint_departure_time: dayEnd.toISOString(),
          stay_duration_minutes: Math.floor((dayEnd.getTime() - dayStart.getTime()) / (1000 * 60)),
          is_virtual_split: true,                         // 分割フラグ
          split_day_index: dayIndex + 1,
          split_total_days: Math.ceil((checkOut.getTime() - checkIn.getTime()) / (24 * 60 * 60 * 1000))
        });
        
        currentDate = nextDay;
        dayIndex++;
      }
    } else {
      // 通常place → そのまま
      splitPlaces.push(place);
    }
  }
  
  return splitPlaces;
}

#### 制約時間のoptimize-route互換変換
```typescript
// optimize-routeはarrival_timeのみ対応のため、制約を変換
// 基準: tripStartDate の 8:00 AM = 0分 から開始  
// 活動時間: 8:00-20:00 (12時間) - optimize-routeの実装に合わせる

function convertConstraintsToCumulativeTime(splitPlaces: Place[], tripStartDate: string) {
  const tripStart = new Date(`${tripStartDate}T08:00:00.000Z`); // 8:00 AM基準
  
  return splitPlaces.map(constraint => {
    let cumulativeTime = 0;
    let constraintType = null;
    
    // 日跨ぎ分割されたホテル制約: 各日別に処理
    if (constraint.is_virtual_split && constraint.constraint_arrival_time && constraint.constraint_departure_time) {
      const segmentStart = new Date(constraint.constraint_arrival_time);
      const segmentEnd = new Date(constraint.constraint_departure_time);
      const segmentDuration = Math.floor((segmentEnd.getTime() - segmentStart.getTime()) / (1000 * 60));
      
      cumulativeTime = Math.floor((segmentStart.getTime() - tripStart.getTime()) / (1000 * 60));
      constraintType = `HOTEL_SEGMENT_DAY${constraint.split_day_index}`;
      
      return {
        ...constraint,
        cumulative_arrival_time: cumulativeTime,
        stay_duration_minutes: segmentDuration,
        constraint_type: constraintType,
        original_place_id: constraint.original_place_id
      };
    }
    
    // 通常ホテル制約: チェックイン時刻のみ使用、滞在時間で調整
    else if (constraint.constraint_arrival_time && constraint.constraint_departure_time) {
      const checkInTime = new Date(constraint.constraint_arrival_time);
      const checkOutTime = new Date(constraint.constraint_departure_time);
      const hotelDuration = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));
      
      cumulativeTime = Math.floor((checkInTime.getTime() - tripStart.getTime()) / (1000 * 60));
      constraintType = 'HOTEL_CHECKIN';
      
      return {
        ...constraint,
        cumulative_arrival_time: cumulativeTime,
        stay_duration_minutes: hotelDuration,
        constraint_type: constraintType,
        original_constraint_times: {
          check_in: constraint.constraint_arrival_time,
          check_out: constraint.constraint_departure_time
        }
      };
    }
    
    // 空港制約: departure/arrival別に処理
    else if (constraint.constraint_departure_time) {
      // 出発空港: 出発時刻 = arrival_time + stay_duration
      const departureTime = new Date(constraint.constraint_departure_time);
      const departureMinutes = Math.floor((departureTime.getTime() - tripStart.getTime()) / (1000 * 60));
      const airportStayDuration = constraint.stay_duration_minutes || 90; // デフォルト90分
      
      cumulativeTime = departureMinutes - airportStayDuration; // arrival_time = departure_time - duration
      constraintType = 'AIRPORT_DEPARTURE';
      
      return {
        ...constraint,
        cumulative_arrival_time: cumulativeTime,
        stay_duration_minutes: airportStayDuration,
        constraint_type: constraintType,
        original_departure_time: constraint.constraint_departure_time
      };
    }
    
    else if (constraint.constraint_arrival_time) {
      // 到着空港: 到着時刻 = arrival_time
      const arrivalTime = new Date(constraint.constraint_arrival_time);
      cumulativeTime = Math.floor((arrivalTime.getTime() - tripStart.getTime()) / (1000 * 60));
      constraintType = 'AIRPORT_ARRIVAL';
      
      return {
        ...constraint,
        cumulative_arrival_time: cumulativeTime,
        stay_duration_minutes: constraint.stay_duration_minutes || 90,
        constraint_type: constraintType,
        original_arrival_time: constraint.constraint_arrival_time
      };
    }
    
    return constraint;
  });
}

// 🔥 edit-schedule処理フロー例
// 入力: DB単一レコード "Hilton Tokyo" (2025-09-07 15:00〜2025-09-09 11:00)
// ↓ splitMultiDayConstraints実行
// 分割: 3つの仮想place作成
// - "hotel_123_day1": 2025-09-07 15:00〜23:59 (Day 1セグメント)
// - "hotel_123_day2": 2025-09-08 00:00〜23:59 (Day 2セグメント) 
// - "hotel_123_day3": 2025-09-09 00:00〜11:00 (Day 3セグメント)
// ↓ convertConstraintsToCumulativeTime実行
// 変換: optimize-route互換形式
// ↓ optimize-route実行
// 最適化: 各セグメント独立最適化
// ↓ UI表示時
// 統合: original_place_id="hotel_123"でグループ化 → 1つのホテル予約として表示

// 深夜フライト処理例:
// 出発空港 constraint_departure_time = "2025-09-07T23:00:00+00:00" (is_multi_day_booking=true)
// → cumulative_arrival_time = 810分 (23:00-90分 = 21:30), stay_duration_minutes = 90分
// 到着空港 constraint_arrival_time = "2025-09-08T03:00:00+00:00" (is_multi_day_booking=true) 
// → cumulative_arrival_time = -300分 (翌日03:00 → 前日計算), stay_duration_minutes = 90分

// 🎯 重要: 深夜制約(20:00-8:00)は累積時間が負値・範囲外になる可能性
// → edit-schedule内で日別セグメント分割により解決
```

#### セグメント設計原則（累積時間制）
```typescript
// 累積時間での制約配置
// 例: A → B → C(540分制約) → D → E → F(1020分制約) → G → H
// 🔥 重要: optimize-routeの活動時間 8:00-20:00 (12時間) に準拠
// 深夜制約 (20:00-8:00) がある場合は日分割が必要

// セグメント1: [0分固定, A, B, C制約540分固定]
// - 累積時間: 0分 → ... → 540分
// - 実時間: 8:00 → ... → 17:00 (540分 = 9時間後)
// - 場所: tripStart → A → B → C制約
// - 最適化: A,Bの順序固定、滞在時間調整のみ

// セグメント2: [C制約540分固定, D, E, F制約1020分固定] 
// - 累積時間: 540分 → ... → 1020分
// - 実時間: 17:00 → ... → 翌日8:00+8時間 = 16:00
// - 場所: C制約 → D → E → F制約
// - 最適化: D,Eの順序固定、滞在時間調整のみ

// セグメント3: [F制約1020分固定, G, H, tripEnd]
// - 累積時間: 1020分 → ... → 自然終了 or 深夜調整
// - 場所: F制約 → G → H → tripEnd
// - 最適化: G,Hの順序固定、滞在時間調整のみ
```

#### セグメント最適化フロー（累積時間制・optimize-route互換）
```typescript
function optimizeSegmentWithFixedOrder(
  segmentPlaces: Place[],
  segmentStartCumulativeTime: number,  // 累積時間での開始時刻
  segmentEndCumulativeTime: number,    // 累積時間での終了時刻
  segmentStartPlace: Place,            // 固定開始点
  segmentEndPlace: Place               // 固定終了点
) {
  let timeCounter = segmentStartCumulativeTime;
  
  // セグメント内の全場所（固定点含む）
  const allPlaces = [segmentStartPlace, ...segmentPlaces, segmentEndPlace];
  
  // 1. 距離計算（順序固定）- optimize-routeと同じ関数
  for (let i = 0; i < allPlaces.length - 1; i++) {
    const distance = calculateDistance(allPlaces[i], allPlaces[i + 1]);
    allPlaces[i].distanceToNext = distance;
  }
  
  // 2. 移動手段決定 - optimize-routeと同じ関数  
  for (let i = 0; i < allPlaces.length - 1; i++) {
    // optimize-routeと同じ determineTransportMode()
    allPlaces[i].transport_mode = determineTransportMode(allPlaces[i].distanceToNext);
  }
  
  // 3. 空港挿入（flight区間のみ）- optimize-routeと同じ関数
  const placesWithAirports = insertAirportsForFlights(allPlaces);
  
  // 4. 移動時間計算 - optimize-routeと同じ関数
  const totalTravelTime = calculateTotalTravelTime(placesWithAirports);
  const availableTime = segmentEndCumulativeTime - segmentStartCumulativeTime;
  const maxStayTime = availableTime - totalTravelTime;
  
  // 5. 時間制約チェック → 削除処理 - optimize-routeと同じロジック
  if (maxStayTime < getMinimumStayTime(segmentPlaces)) {
    // wish_level最低の場所から削除（制約付きは削除不可）
    return removeLowestPriorityPlaces(segmentPlaces, availableTime, totalTravelTime);
  }
  
  // 6. 余り時間の等分配分（制約なし場所のみ）
  const unconstrainedPlaces = segmentPlaces.filter(p => 
    !p.constraint_arrival_time && !p.constraint_departure_time
  );
  
  if (unconstrainedPlaces.length > 0) {
    const extraTime = maxStayTime - getBaseStayTime(segmentPlaces);
    const timePerPlace = Math.floor(extraTime / unconstrainedPlaces.length);
    
    for (const place of unconstrainedPlaces) {
      place.stay_duration_minutes += timePerPlace;
    }
  }
  
  // 7. 累積時間での時刻設定（optimize-route互換）
  timeCounter = segmentStartCumulativeTime;
  for (const place of placesWithAirports) {
    if (place.cumulative_arrival_time !== undefined) {
      // 制約付き場所: 固定arrival_timeを使用
      timeCounter = place.cumulative_arrival_time;
      place.arrival_time = formatTime(timeCounter % (24 * 60));
      
      // departure_time = arrival_time + stay_duration
      timeCounter += place.stay_duration_minutes;
      place.departure_time = formatTime(timeCounter % (24 * 60));
      place.cumulative_departure_time = timeCounter;
      
    } else {
      // 制約なし場所: 累積時間で計算
      timeCounter += (place.travel_time_from_previous || 0);
      place.cumulative_arrival_time = timeCounter;
      place.arrival_time = formatTime(timeCounter % (24 * 60));
      
      timeCounter += place.stay_duration_minutes;
      place.cumulative_departure_time = timeCounter;
      place.departure_time = formatTime(timeCounter % (24 * 60));
    }
  }
  
  return placesWithAirports;
}
```

#### 深夜調整と20:00制限の拡張
```typescript
// optimize-routeは20:00で日を区切るが、edit-scheduleでは24時間制対応
function handleOvernightAdjustment(
  timeCounter: number,
  hasConstraintsAfter: boolean
): number {
  const DAILY_END_TIME = 20 * 60; // 1200分 = 20:00 (optimize-route基準)
  const MIDNIGHT = 24 * 60;       // 1440分 = 24:00
  
  const currentDayTime = timeCounter % MIDNIGHT;
  
  if (hasConstraintsAfter) {
    // 制約がある場合: 24時間制で継続
    return timeCounter;
  } else {
    // 制約がない場合: 20:00で調整（optimize-route互換）
    if (currentDayTime > DAILY_END_TIME) {
      const nextDayStart = Math.floor(timeCounter / MIDNIGHT + 1) * MIDNIGHT + (8 * 60);
      const overnightGap = nextDayStart - timeCounter;
      
      console.log(`🌙 Overnight adjustment: +${overnightGap}分 (深夜時間追加)`);
      return nextDayStart;
    }
  }
  
  return timeCounter;
}
```

#### 全輸送手段制約での空セグメント対応
```typescript
// 問題: 輸送制約 A(出発) → B(到着) では A→B間のセグメントが空になる
// 解決: booking_type別の制約分割処理

function handleTransportConstraints(constraint: Place) {
  const bookingType = constraint.booking_type;
  
  switch (bookingType) {
    case 'hotel':
      // ホテル: 通常のplace制約として処理
      return createPlaceConstraint(constraint);
      
    case 'flight':
    case 'car':  
    case 'walking':
      // 全輸送手段: 出発地・到着地の2つの制約として分割
      return createTransportConstraints(constraint, bookingType);
  }
}

function createTransportConstraints(transportBooking: Place, transportMode: string) {
  // 輸送予約を出発地・到着地制約に分割（flight/car/walking共通）
  const [departureLocation, arrivalLocation] = parseTransportRoute(transportBooking.route);
  
  const departureConstraint = {
    ...findExistingPlace(departureLocation),
    constraint_departure_time: transportBooking.departure_time,
    transport_mode: transportMode,
    is_transport_departure: true,
    booking_id: transportBooking.id
  };
  
  const arrivalConstraint = {
    ...findExistingPlace(arrivalLocation), 
    constraint_arrival_time: transportBooking.arrival_time,
    transport_mode: transportMode,
    is_transport_arrival: true,
    booking_id: transportBooking.id
  };
  
  // 空セグメント情報（全輸送手段共通）
  const transportSegment = {
    type: 'TRANSPORT_ONLY',
    booking_id: transportBooking.id,
    departure_place_id: departureConstraint.id,
    arrival_place_id: arrivalConstraint.id,
    transport_mode: transportMode,
    travel_time_minutes: calculateTransportDuration(transportBooking),
    user_specified_duration: true, // ユーザー指定時間を保持
    
    // 輸送手段別の詳細情報
    transport_details: {
      departure_time: transportBooking.departure_time,
      arrival_time: transportBooking.arrival_time,
      route: transportBooking.route,
      ...(transportMode === 'flight' && {
        flight_number: transportBooking.flight_number,
        airline: transportBooking.airline
      }),
      ...(transportMode === 'car' && {
        vehicle_type: transportBooking.vehicle_type,
        rental_company: transportBooking.rental_company
      }),
      ...(transportMode === 'walking' && {
        walking_route: transportBooking.walking_route,
        difficulty: transportBooking.difficulty
      })
    }
  };
  
  return { departureConstraint, arrivalConstraint, transportSegment };
}

// 空セグメントの最適化処理（全輸送手段対応）
function optimizeTransportOnlySegment(transportSegment: TransportSegment) {
  // 移動手段: ユーザー指定を維持
  // 移動時間: ユーザー指定を維持  
  // 距離: 実際の距離を計算（optimization_result保存用）
  
  const actualDistance = calculateDistance(
    transportSegment.departure_place,
    transportSegment.arrival_place
  );
  
  return {
    // optimize-route互換の出力
    scheduled_places: [
      {
        ...transportSegment.departure_place,
        departure_time: transportSegment.transport_details.departure_time,
        transport_mode: transportSegment.transport_mode,
        travel_time_from_previous: 0, // 出発地なので0
        
        // 制約情報保持
        constraint_departure_time: transportSegment.transport_details.departure_time,
        is_transport_departure: true,
        booking_id: transportSegment.booking_id
      },
      {
        ...transportSegment.arrival_place,
        arrival_time: transportSegment.transport_details.arrival_time,
        transport_mode: transportSegment.transport_mode,
        travel_time_from_previous: transportSegment.travel_time_minutes,
        
        // 制約情報保持
        constraint_arrival_time: transportSegment.transport_details.arrival_time,
        is_transport_arrival: true,
        booking_id: transportSegment.booking_id
      }
    ],
    // 統計情報
    total_travel_time: transportSegment.travel_time_minutes,
    total_visit_time: 0, // 移動のみなので0
    segment_type: 'TRANSPORT_ONLY',
    actual_distance: actualDistance,
    transport_details: transportSegment.transport_details
  };
}
```

### 累積時間から日別スケジュール変換とoptimization_result保存
```typescript
// 累積時間制から日別スケジュールに変換してoptimization_resultsに保存
async function convertCumulativeTimeAndSaveResults(
  optimizedPlaces: Place[],
  tripId: string,
  userId: string,
  tripStartDate: string
) {
  // 1. 累積時間から実際の日時に変換 - optimize-routeと同じ変換方式
  const dailySchedules = [];
  const currentDayPlaces = [];
  let currentDay = 1;
  
  for (const place of optimizedPlaces) {
    // 累積時間から日数・時刻を計算（optimize-route互換）
    const cumulativeTime = place.cumulative_arrival_time || place.cumulative_departure_time || 0;
    
    // 日数計算: 24時間で割った商+1
    const dayNumber = Math.floor(cumulativeTime / (24 * 60)) + 1;
    
    // 時刻計算: 24時間で割った余り
    const timeOfDay = cumulativeTime % (24 * 60);
    const arrivalTimeOfDay = place.cumulative_arrival_time ? 
      place.cumulative_arrival_time % (24 * 60) : timeOfDay;
    const departureTimeOfDay = place.cumulative_departure_time ? 
      place.cumulative_departure_time % (24 * 60) : timeOfDay;
    
    // HH:MM:SS形式に変換 - optimize-routeと同じformatTime()
    place.arrival_time = formatTime(arrivalTimeOfDay);
    place.departure_time = formatTime(departureTimeOfDay);
    place.day_number = dayNumber;
    
    // 日付文字列を計算
    const placeDate = new Date(tripStartDate);
    placeDate.setDate(placeDate.getDate() + dayNumber - 1);
    const dateString = placeDate.toISOString().split('T')[0];
    
    // 日が変わった場合の処理
    if (dayNumber !== currentDay) {
      if (currentDayPlaces.length > 0) {
        // 前の日のスケジュールを作成
        const prevDate = new Date(tripStartDate);
        prevDate.setDate(prevDate.getDate() + currentDay - 1);
        const prevDateString = prevDate.toISOString().split('T')[0];
        
        dailySchedules.push(createDailyScheduleFromCumulative(
          currentDay,
          [...currentDayPlaces],
          prevDateString
        ));
        
        currentDayPlaces.length = 0; // 配列をクリア
      }
      currentDay = dayNumber;
    }
    
    // order_in_dayを設定
    place.order_in_day = currentDayPlaces.length + 1;
    currentDayPlaces.push(place);
  }
  
  // 最後の日のスケジュールを作成
  if (currentDayPlaces.length > 0) {
    const lastDate = new Date(tripStartDate);
    lastDate.setDate(lastDate.getDate() + currentDay - 1);
    const lastDateString = lastDate.toISOString().split('T')[0];
    
    dailySchedules.push(createDailyScheduleFromCumulative(
      currentDay,
      currentDayPlaces,
      lastDateString
    ));
  }
  
  // 2. 最適化スコア計算（edit-schedule用）
  const optimizationScore = calculateEditScheduleScore(optimizedPlaces, dailySchedules);
  
  // 3. optimization_resultsテーブルに保存
  await saveOptimizationResults(tripId, userId, {
    optimized_route: dailySchedules,
    optimization_score: optimizationScore,
    execution_time_ms: Date.now() - startTime,
    places_count: optimizedPlaces.length,
    total_travel_time_minutes: getTotalTravelTime(dailySchedules),
    total_visit_time_minutes: getTotalVisitTime(dailySchedules),
    algorithm_version: 'edit-schedule-constraints-v1'
  });
  
  return dailySchedules;
}

// 累積時間制での日別スケジュール作成
function createDailyScheduleFromCumulative(
  dayNumber: number,
  places: Place[],
  dateString: string
): DailySchedule {
  // 当日の移動時間・滞在時間を計算
  const totalTravelTime = places.reduce((sum, place) => 
    sum + (place.travel_time_from_previous || 0), 0
  );
  
  const totalVisitTime = places.reduce((sum, place) => 
    sum + (place.stay_duration_minutes || 0), 0
  );
  
  return {
    day: dayNumber,
    date: dateString, // "2025-09-07"
    scheduled_places: places,
    total_travel_time: totalTravelTime,
    total_visit_time: totalVisitTime,
    meal_breaks: [], // 現在は空配列
    
    // edit-schedule固有情報
    constraint_info: {
      constrained_places: places.filter(p => 
        p.constraint_arrival_time || p.constraint_departure_time
      ).length,
      has_overnight_extension: places.some(p => {
        const timeOfDay = (p.cumulative_arrival_time || 0) % (24 * 60);
        return timeOfDay > (20 * 60); // 20:00以降
      })
    }
  };
}

// 日別スケジュール作成
function createDailySchedule(
  dayNumber: number,
  places: Place[],
  dateString: string,
  originalSegments: OptimizedSegment[]
) {
  // 当日の移動時間・滞在時間を計算
  const totalTravelTime = places.reduce((sum, place) => 
    sum + (place.travel_time_from_previous || 0), 0
  );
  
  const totalVisitTime = places.reduce((sum, place) => 
    sum + (place.stay_duration_minutes || 0), 0
  );
  
  return {
    day: dayNumber,
    date: dateString, // "2025-09-07"
    scheduled_places: places,
    total_travel_time: totalTravelTime,
    total_visit_time: totalVisitTime,
    meal_breaks: [], // 現在は空配列
    
    // edit-schedule固有情報
    segments_info: originalSegments.filter(seg => 
      seg.constraint_date === dateString || 
      seg.scheduled_places.some(p => extractDateFromTime(p.arrival_time) === dateString)
    ).map(seg => ({
      segment_type: seg.segment_type,
      constraint_count: seg.constraint_count || 0,
      places_count: seg.scheduled_places.length
    }))
  };
}

// 最適化スコア計算（edit-schedule用）
function calculateEditScheduleScore(
  segments: OptimizedSegment[],
  dailySchedules: DailySchedule[]
): OptimizationScore {
  const totalPlaces = getTotalPlacesCount(dailySchedules);
  const constrainedPlaces = segments.reduce((count, seg) => 
    count + (seg.constraint_count || 0), 0
  );
  const segmentsProcessed = segments.length;
  
  // 制約満足度
  const constraintSatisfaction = segments.every(seg => 
    seg.segment_type === 'TRANSPORT_ONLY' || seg.all_constraints_satisfied
  );
  
  // 基本スコア計算（optimize-routeと同様）
  const baseScore = calculateBaseOptimizationScore(dailySchedules);
  
  return {
    total_score: baseScore.total_score,
    fairness_score: baseScore.fairness_score,
    efficiency_score: baseScore.efficiency_score,
    feasibility_score: baseScore.feasibility_score,
    validation_issues: baseScore.validation_issues,
    details: {
      ...baseScore.details,
      // edit-schedule固有のメトリクス
      constraint_satisfaction: constraintSatisfaction,
      constrained_places: constrainedPlaces,
      segments_processed: segmentsProcessed,
      transport_only_segments: segments.filter(s => s.segment_type === 'TRANSPORT_ONLY').length
    }
  };
}
```

### 5. 時間制約適用と日分割
```typescript
// 制約付きplaceの時間設定
function applyTimeConstraints(place: Place) {
  if (place.constraint_arrival_time) {
    const constraintTime = new Date(place.constraint_arrival_time);
    place.arrival_time = formatTime(constraintTime.getUTCHours() * 60 + constraintTime.getUTCMinutes());
    
    // 滞在時間を考慮した出発時間
    const departureMinutes = constraintTime.getUTCHours() * 60 + 
                           constraintTime.getUTCMinutes() + 
                           place.stay_duration_minutes;
    place.departure_time = formatTime(departureMinutes);
  }
  
  if (place.constraint_departure_time) {
    const constraintTime = new Date(place.constraint_departure_time);
    place.departure_time = formatTime(constraintTime.getUTCHours() * 60 + constraintTime.getUTCMinutes());
    
    // 滞在時間を考慮した到着時間
    const arrivalMinutes = constraintTime.getUTCHours() * 60 + 
                         constraintTime.getUTCMinutes() - 
                         place.stay_duration_minutes;
    place.arrival_time = formatTime(Math.max(0, arrivalMinutes));
  }
  
  // 日分割用の制約情報も設定
  if (place.constraint_arrival_time || place.constraint_departure_time) {
    const constraintDateTime = new Date(place.constraint_arrival_time || place.constraint_departure_time);
    place.constraint_day = calculateDayNumber(constraintDateTime, tripStartDate);
    place.constraint_time = place.arrival_time || place.departure_time;
  }
}

// 制約に基づく日分割
function assignDaysByConstraints(places: Place[], tripStartDate: string) {
  const placesByDay = new Map<string, Place[]>();
  
  for (const place of places) {
    let dayKey = '1'; // デフォルト
    
    // 制約がある場合はその日付を使用
    if (place.constraint_arrival_time || place.constraint_departure_time) {
      const constraintDateTime = new Date(place.constraint_arrival_time || place.constraint_departure_time);
      dayKey = constraintDateTime.toISOString().split('T')[0];
    } else if (place.scheduled_date) {
      // 既存スケジュールの日付を使用
      dayKey = place.scheduled_date;
    }
    
    if (!placesByDay.has(dayKey)) {
      placesByDay.set(dayKey, []);
    }
    placesByDay.get(dayKey)!.push(place);
  }
  
  return placesByDay;
}
```

### 6. データベース保存と状態更新
```typescript
// 既存結果を無効化して新規保存
async function saveOptimizationResults(tripId: string, optimizedSchedule: DailySchedule[], optimizationScore: OptimizationScore) {
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
    optimization_score: {
      total_score: optimizationScore.total_score,
      fairness_score: optimizationScore.fairness_score,
      efficiency_score: optimizationScore.efficiency_score,
      feasibility_score: optimizationScore.feasibility_score,
      validation_issues: optimizationScore.validation_issues,
      details: {
        user_adoption_balance: optimizationScore.details.user_adoption_balance,
        wish_satisfaction_balance: optimizationScore.details.wish_satisfaction_balance,
        travel_efficiency: optimizationScore.details.travel_efficiency,
        time_constraint_compliance: optimizationScore.details.time_constraint_compliance,
        is_feasible: optimizationScore.details.is_feasible,
        // edit-schedule固有
        constraint_satisfaction: optimizationScore.details.constraint_satisfaction,
        segments_processed: optimizationScore.details.segments_processed,
        constrained_places: optimizationScore.details.constrained_places
      }
    },
    execution_time_ms: executionTime,
    places_count: totalPlaces,
    total_travel_time_minutes: totalTravelTime,
    total_visit_time_minutes: totalVisitTime,
    is_active: true, // 重要！
    algorithm_version: 'edit-schedule-constraints-v1'
  };
  
  const { data, error } = await supabase
    .from('optimization_results')
    .insert(newResult);
  
  // 3. placesテーブルの状態を更新
  await updatePlacesScheduleStatus(optimizedSchedule);
  
  return { data, error };
}

// placesテーブルの状態更新
async function updatePlacesScheduleStatus(optimizedSchedule: DailySchedule[]) {
  // 全placeをリセット
  await supabase
    .from('places')
    .update({ 
      scheduled: false, 
      is_selected_for_optimization: false,
      scheduled_date: null,
      scheduled_time_start: null,
      scheduled_time_end: null,
      travel_time_from_previous: null
    })
    .eq('trip_id', tripId);
  
  // 採用されたplaceの状態を更新
  for (const day of optimizedSchedule) {
    for (const place of day.scheduled_places) {
      await supabase
        .from('places')
        .update({
          scheduled: true,
          is_selected_for_optimization: true,
          scheduled_date: day.date,
          scheduled_time_start: place.arrival_time,
          scheduled_time_end: place.departure_time,
          travel_time_from_previous: place.travel_time_from_previous
        })
        .eq('id', place.id);
    }
  }
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