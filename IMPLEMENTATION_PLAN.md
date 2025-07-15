# VoyPath v5 - 時間固定スケジュール最適化機能 実装計画書 (改訂版)

## 🎯 プロジェクト概要

### 現在の問題
- ルート最適化が完了するまで移動時間が不明なため、ユーザーがフライト時間を事前に指定できない
- 時間指定後に全体スケジュールがズレて整合性が取れなくなる
- ホテルや食事は表示のみで実際のスケジュール最適化に組み込まれていない
- **Saved Bookingsに"add to trip"機能が不完全**（Edit/Deleteボタンのみ存在）

### 解決目標
- **全移動手段（フライト・car・walking・ホテル）**の時間指定に対応した**セグメント分割最適化**システムの構築
- 時間制約を満たしつつ、収まらない場所は自動削除する機能
- Calendar timeline viewでの日跨ぎイベント分割表示
- **add to trip機能による動的スケジュール更新**
- **optimization-result形式の完全互換性維持**
- **Saved Bookingsでの完全なCRUD操作**（Create/Read/Update/Delete + Add to Trip）

---

## 🏗️ システム設計

### アーキテクチャ変更

#### 現在の流れ
```
add bookings → saved in database (終了)
optimize-route → optimization_result (store) → calendar timeline view
```

#### 提案する流れ（「ハッキング」アプローチ）
```
add bookings → saved in database → add to trip → edit_schedule実行
edit_schedule → optimization_result (store置き換え) → calendar timeline view
```

### 重要な設計原則

#### 1. 時間固定対象の明確化
- **フライト**: 両端の空港place時刻を固定
- **car/walking**: 両端のplace時刻を固定（移動手段自体ではなく）
- **ホテル**: 一般的なplaceとして扱い + 時間制約追加

#### 2. データ互換性の維持
```typescript
// edit-scheduleはoptimize-routeと同じ形式を出力
interface OptimizationResult {
  optimization: {
    daily_schedules: Array<{
      day: number;
      date: string; // YYYY-MM-DD
      scheduled_places: Array<{
        arrival_time: string; // "HH:mm:ss"
        departure_time: string; // "HH:mm:ss"
        // ... optimize-routeと同じ構造
      }>;
    }>;
  };
}
```

#### 3. 時間計算の統一
- edit-scheduleでもoptimize-routeの累積時間計算を使用
- 8:00基準の相対時間 → 最終的に時刻文字列変換
- 時間固定placeの制約に合わせて全体調整

### セグメント分割アプローチ
```
全体: A → B → C(時間固定place) → D → E → F(時間固定place) → G → H

セグメント1: A → B → (C固定へ向かう)
セグメント2: (C固定から) → D → E → (F固定へ向かう)  
セグメント3: (F固定から) → G → H
```

- 各セグメント内でoptimize-routeと同じ最適化ロジック
- セグメント間の順序は固定
- 収まらない場所は削除
- 時間固定placeの時刻制約を満たすよう全体調整

---

## 📋 実装順序

### Phase 1: Calendar Timeline View改修
1. **日跨ぎイベント分割表示**
   - 21:00-01:00フライトを21:00-23:59と00:00-01:00に分割
   - UIで同一イベントとして認識させる

2. **add to tripボタン追加**
   - saved bookingsにadd to tripボタンを追加
   - モーダルまたはリスト形式での操作

### Phase 2: Database Schema変更
1. **placesテーブル拡張**
   ```sql
   ALTER TABLE places ADD COLUMN constraint_departure_time TIMESTAMPTZ;
   ALTER TABLE places ADD COLUMN constraint_arrival_time TIMESTAMPTZ;
   ```

2. **bookingsテーブル拡張（ホテル位置情報用）**
   ```sql
   ALTER TABLE bookings ADD COLUMN latitude NUMERIC;
   ALTER TABLE bookings ADD COLUMN longitude NUMERIC;
   ALTER TABLE bookings ADD COLUMN google_place_id TEXT;
   ```

### Phase 3: edit_schedule Edge Function作成
1. **新規Edge Function作成**
   - `/voypath_v5/project/supabase/functions/edit-schedule/index.ts`
   - セグメント分割ロジック
   - 時間制約満足アルゴリズム

2. **optimize-routeとの分離**
   - 初回: optimize-route
   - 以降: edit-schedule

---

## 🛠️ 技術仕様

### 1. 時間固定placeの定義
#### 対象（全て両端のplaceを固定）
- **フライト**: 出発・到着空港place時刻を固定
- **car移動**: 出発・到着place時刻を固定  
- **walking移動**: 出発・到着place時刻を固定
- **ホテル**: 一般placeとして扱い + チェックイン・アウト時刻制約

#### データフロー（日付+時刻での制約）
```typescript
// フライト時間変更時（日付を含む）
元の計算:
出発空港: 2024-03-15 07:00 - 09:00
フライト: 2024-03-15 09:00 - 14:00  
到着空港: 2024-03-15 14:00 - 16:00

ユーザーがフライト時間を2024-03-15 21:00 - 2024-03-16 01:00に変更
↓
出発空港: 2024-03-15 19:00 - 21:00 (2時間前倒し)
到着空港: 2024-03-16 01:00 - 03:00 (日跨ぎ対応)
```

### 2. ホテル機能拡張
#### add bookingsポップアップ改修
```
┌─────────────────────────┐
│ Hotel Booking Details   │
├─────────────────────────┤
│ 🔍 [Search Hotels...]   │ ← Google Maps API検索ボックス (任意)
│                         │
│ Check-in: [Date]        │
│ Check-out: [Date]       │ 
│ Guests: [Number]        │
│ Price: [Amount]         │
│ Notes: [Text]           │
│                         │
│ [Cancel] [Save]         │
└─────────────────────────┘
```

#### 動作分岐
- **検索ボックス使用**: 位置情報付きでplace登録（placesテーブル） → 時間制約place
- **検索ボックス未使用**: bookingとしてのみ保存 (現在と同じ)

### 3. edit_schedule関数仕様
```typescript
interface EditScheduleRequest {
  trip_id: string;
  member_id: string;
  time_constraints: TimeConstraint[];
  action: 'add_booking' | 'update_time' | 'add_place';
}

interface TimeConstraint {
  place_id: string;
  constraint_departure_time?: string; // ISO datetime string
  constraint_arrival_time?: string;   // ISO datetime string
  type: 'flight_airport' | 'hotel' | 'car_endpoint' | 'walking_endpoint';
}
```

#### アルゴリズム（optimize-routeベース）
1. **時間制約placeでセグメント分割**
2. **各セグメント内でoptimize-routeと同じ累積時間計算**
3. **時間制約に合わせて全体スケジュール調整**
4. **収まらない場所を削除**
5. **optimize-routeと同じdaily_schedules形式で出力**
6. **optimization_resultとしてstore置き換え**

---

## 🔧 データベース変更詳細

### 現在のスキーマ分析結果

#### placesテーブル（主要カラム）
```sql
-- 既存の時間関連カラム
scheduled_date DATE
scheduled_time_start TIME
scheduled_time_end TIME
visit_date DATE

-- 空港関連カラム（既存）
is_airport BOOLEAN DEFAULT false
airport_code TEXT

-- 追加が必要なカラム
constraint_departure_time TIMESTAMPTZ  -- 新規追加
constraint_arrival_time TIMESTAMPTZ    -- 新規追加
```

#### bookingsテーブル（現在の構造）
```sql
-- フライト情報
flight_number TEXT
departure_time TEXT
arrival_time TEXT
departure_date DATE
route TEXT

-- ホテル情報
hotel_name TEXT
address TEXT
check_in_time TEXT
check_out_time TEXT
check_in_date DATE
check_out_date DATE
location TEXT  -- 住所のみ（緯度経度なし）

-- 追加が必要なカラム（ホテル位置情報用）
latitude NUMERIC        -- 新規追加（Google Maps選択時のみ）
longitude NUMERIC       -- 新規追加（Google Maps選択時のみ）
google_place_id TEXT    -- 新規追加（Google Maps選択時のみ）
```

#### 重要な方針変更
- **ホテルはbookingテーブルとplaceテーブル二重管理**
  - bookingテーブル: UI表示用の情報（現在と同じ）
  - placeテーブル: 位置情報がある場合のみ追加で登録（時間制約place）

---

## 🚀 実装手順

### Step 1: Calendar Timeline View修正
**対象ファイル**:
- `/src/components/CalendarView.tsx`
- `/src/components/DetailedScheduleTimelineView.tsx`

**変更内容**:
1. 日跨ぎイベント分割ロジック追加
2. add to tripボタン実装
3. 実際のbookingデータ表示

### Step 2: Database Schema更新
**Supabase MCP使用**:
```sql
-- placesテーブル拡張
ALTER TABLE places 
ADD COLUMN constraint_departure_time TIMESTAMPTZ,
ADD COLUMN constraint_arrival_time TIMESTAMPTZ;

-- bookingsテーブル拡張
ALTER TABLE bookings 
ADD COLUMN latitude NUMERIC,
ADD COLUMN longitude NUMERIC,
ADD COLUMN google_place_id TEXT;
```

### Step 3: edit-schedule Edge Function
**新規ファイル**:
- `/supabase/functions/edit-schedule/index.ts`

**機能**:
- セグメント分割最適化
- 時間制約満足
- 場所削除判定
- データベース更新

### Step 4: Frontend統合
**BookingService拡張**:
- add to trip機能追加
- edit-schedule API呼び出し

**Google Maps API統合**:
- ホテル検索ボックス
- 場所情報自動取得

---

## ⚠️ 懸念事項と対策

### 1. データ整合性
**懸念**: constraint時刻追加時の既存データとの整合性
**対策**: マイグレーション時にNULL許可、段階的更新

### 2. 時間計算の複雑性
**懸念**: optimize-routeの累積時間計算と時刻制約の整合性
**対策**: optimize-routeのロジックを最大限再利用、時間制約は最終調整として適用

### 3. データフロー「ハッキング」のリスク
**懸念**: optimization_result置き換えによる予期しない副作用
**対策**: 厳密にoptimize-routeと同じ形式を維持、段階的テスト

### 4. ホテル二重管理の複雑性
**懸念**: bookingテーブルとplaceテーブルの同期問題
**対策**: 明確な責任分離（booking=UI、place=最適化）、削除時の連携

### 5. 日付跨ぎの処理
**懸念**: 21:00-01:00フライトの日付計算とカレンダー表示
**対策**: ISO datetime stringで一意管理、Calendar viewでの分割表示対応

### 6. Google Maps API制限
**懸念**: API呼び出し回数制限
**対策**: 一般的な場所検索を使用、過度な制限はなし

---

## 📊 想定される影響範囲

### 修正が必要なファイル
- ✅ `/src/components/CalendarView.tsx`
- ✅ `/src/components/DetailedScheduleTimelineView.tsx`
- ✅ `/src/components/HotelBookingModal.tsx`
- ✅ `/src/services/BookingService.ts`
- ✅ `/supabase/functions/edit-schedule/index.ts` (新規)

### データベース変更
- ✅ placesテーブル: 2カラム追加（constraint_departure_time, constraint_arrival_time）
- ✅ bookingsテーブル: 3カラム追加（latitude, longitude, google_place_id）

### 新機能
- ✅ セグメント分割最適化（optimize-routeベース）
- ✅ 日跨ぎイベント分割表示（Calendar view）
- ✅ add to trip機能（booking → place変換）
- ✅ ホテル位置情報検索（Google Maps API）
- ✅ optimization_result置き換え（「ハッキング」方式）

---

## 🎯 成功指標

### Phase 1完了後
- [ ] 21:00-01:00フライトが2つのイベントに分割表示される
- [ ] add to tripボタンが表示される

### Phase 2完了後
- [ ] データベーススキーマが正常に更新される
- [ ] 既存データに影響がない

### Phase 3完了後
- [ ] edit-schedule Edge Functionが正常動作する
- [ ] セグメント分割最適化が機能する
- [ ] 時間制約が満たされる

### 最終完了後
- [ ] フライト時間指定→空港place時刻調整が正常動作
- [ ] car/walking時間指定→両端place時刻調整が正常動作
- [ ] ホテル位置情報検索→place登録→時間制約が機能
- [ ] セグメント分割最適化が正常動作（optimize-routeロジック使用）
- [ ] 収まらない場所の自動削除が動作
- [ ] optimization_result置き換えが透明に機能
- [ ] Calendar timeline viewでの日跨ぎイベント分割表示が正常動作

---

## 📝 備考

### 実装制約
- 実装はまだ開始しない（壁打ち・分析のみ）
- Ultrathinkerアプローチで段階的に進める
- 各Phaseで動作確認してから次に進む

### 今後の拡張可能性
- edit_scheduleでの複数場所同時追加対応
- リアルタイム協調編集
- 制約違反時の自動提案機能
- より高度なセグメント分割アルゴリズム

### 実装上の重要なポイント
1. **optimize-routeのロジック再利用を最優先**
2. **optimization_result形式の完全互換性を保持**
3. **Calendar timeline viewの既存表示ロジックを活用**
4. **ホテル二重管理の責任分離を明確化**
5. **日付+時刻での制約管理（ISO datetime string使用）**

---

*このドキュメントは随時更新されます。実装開始前に最終確認を行ってください。*
*改訂版: データフロー分析とユーザー指摘を反映済み*