# Plan Pageの出発地・到着地表示修正 - 完了 ✅

## 問題の概要
Plan pageの三つのビュー形式（Calendar、List、Map）で出発地と到着地が表示されていませんでした。

## 修正内容

### 1. CalendarView.tsx の修正 ✅
**修正箇所**: `src/components/CalendarView.tsx`

**追加機能**:
- トリップの最初の日に出発地イベントを自動追加
- トリップの最後の日に帰着地イベントを自動追加
- Travel/Trip カテゴリのアイコン表示を改善

**具体的な変更**:
```typescript
// 出発イベントを最初の日に追加
events[firstDay].push({
  id: 'departure',
  name: `Departure from ${currentTrip.departureLocation}`,
  time: 'Start of trip',
  type: 'trip' as const,
  priority: 5,
  assignedTo: [],
  category: 'travel'
});

// 到着イベントを最後の日に追加
events[lastDay].push({
  id: 'arrival',
  name: `Return to ${currentTrip.destination || currentTrip.departureLocation}`,
  time: 'End of trip',
  type: 'trip' as const,
  priority: 5,
  assignedTo: [],
  category: 'travel'
});
```

### 2. ListView.tsx の修正 ✅
**修正箇所**: `src/components/ListView.tsx`

**追加機能**:
- 各日のスケジュールに出発・到着の移動情報を表示
- 最初の日に出発地からの移動情報
- 最後の日に目的地への帰着情報
- Travel eventの視覚的表示

**具体的な変更**:
```typescript
// 最初の日に出発情報を追加
if (index === 0 && currentTrip.departureLocation) {
  daySchedule.events.push({
    id: 'departure',
    type: 'travel',
    name: `Departure from ${currentTrip.departureLocation}`,
    time: 'Trip Start',
    mode: 'travel',
    from: currentTrip.departureLocation,
    to: places.length > 0 ? places[0].name : 'First destination'
  });
}

// 最後の日に帰着情報を追加
if (isLastDay && (currentTrip.destination || currentTrip.departureLocation)) {
  daySchedule.events.push({
    id: 'return',
    type: 'travel',
    name: `Return to ${currentTrip.destination || currentTrip.departureLocation}`,
    time: 'Trip End',
    mode: 'travel',
    from: places[places.length - 1].name,
    to: currentTrip.destination || currentTrip.departureLocation
  });
}
```

### 3. MapView.tsx の修正 ✅
**修正箇所**: `src/components/MapView.tsx`

**追加機能**:
- 出発地と到着地のマーカーを地図上に表示
- Google Maps Geocoding APIを使用した住所の座標変換
- 出発地（緑色、Dラベル）と到着地（赤色、Aラベル）の識別
- 地図の表示範囲を出発地・到着地を含むよう調整
- 凡例の更新

**具体的な変更**:
```typescript
// 出発地のマーカー
{departureCoords && (
  <Marker
    position={departureCoords}
    icon={{
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: '#22C55E', // Green for departure
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 3,
      scale: 12,
    }}
    label={{
      text: 'D',
      color: 'white',
      fontWeight: 'bold',
      fontSize: '14px',
    }}
    title={`Departure: ${currentTrip?.departureLocation}`}
  />
)}

// 到着地のマーカー
{destinationCoords && (
  <Marker
    position={destinationCoords}
    icon={{
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: '#EF4444', // Red for destination
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 3,
      scale: 12,
    }}
    label={{
      text: 'A',
      color: 'white',
      fontWeight: 'bold',
      fontSize: '14px',
    }}
    title={`Destination: ${currentTrip?.destination}`}
  />
)}
```

## データソース
修正では既存のTrip データ構造の以下のフィールドを使用：
- `currentTrip.departureLocation`: 出発地（必須フィールド）
- `currentTrip.destination`: 到着地（オプション、未設定時は出発地を使用）

## 技術的な実装詳細

### CalendarView
- `eventsByDate` の生成時に出発・到着イベントを自動追加
- トリップの期間（`tripStart`、`tripEnd`）に基づいて最初・最後の日を特定
- Travel イベント用のアイコン表示を追加

### ListView
- `schedule` の生成時に各日のイベント配列に移動情報を追加
- 出発地→最初の場所、最後の場所→到着地の移動情報
- Travel イベントの視覚的表示（既存のUIコンポーネントを活用）

### MapView
- Google Maps Geocoding APIを使用した住所→座標変換
- 出発地・到着地の座標を state として管理
- 地図の bounds 計算に出発地・到着地を含める
- 視覚的に区別できるマーカーデザイン（色・ラベル）

## ユーザー体験の改善

### Before（修正前）
- 出発地と到着地の情報が表示されない
- トリップの開始・終了が不明確
- 地図上で全体的な移動経路が把握困難

### After（修正後）
- **CalendarView**: 出発・帰着イベントがカレンダーに表示
- **ListView**: 移動情報がタイムラインに統合表示
- **MapView**: 出発地（緑D）・到着地（赤A）マーカーで視覚的に明確

## 互換性とエラーハンドリング

### データの有無による対応
- `departureLocation` が未設定の場合は出発イベント非表示
- `destination` が未設定の場合は `departureLocation` を帰着地として使用
- Geocoding 失敗時はコンソールエラーログのみ（UI に影響なし）

### レスポンシブ対応
- 既存の UI デザインに合わせたスタイリング
- モバイル・デスクトップ両対応
- ダークモード対応

## 結果
✅ **CalendarView**: 出発・到着イベント表示
✅ **ListView**: 移動情報の統合表示  
✅ **MapView**: 出発地・到着地マーカー表示
✅ **ビルド成功**: TypeScript エラーなし
✅ **UI一貫性**: 既存デザインとの統合

Plan page の三つのビューすべてで出発地と到着地の情報が適切に表示されるようになりました。