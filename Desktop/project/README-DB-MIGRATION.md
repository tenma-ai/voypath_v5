# Supabaseデータベース移行手順

## 問題
トリップ作成時に次のエラーが発生しています：
```
Error creating trip: {
  code: 'PGRST204',
  message: "Could not find the 'departure_location_lat' column of 'trip_groups' in the schema cache"
}
```

これは、`trip_groups`テーブルに`departure_location_lat`および`departure_location_lng`カラムが存在しないことが原因です。

## 解決方法

### オプション1: Supabase管理コンソールから直接変更

1. [Supabase Dashboard](https://supabase.com/dashboard)にログインします
2. プロジェクト「zceqyydzdrbvtsxnqeqx」を選択します
3. 左側のメニューから「Table Editor」を選択します
4. `trip_groups`テーブルを選択します
5. 「Edit」をクリックし、カラムを追加します：
   - `departure_location_lat` (型: `double precision`, Nullable: `true`)
   - `departure_location_lng` (型: `double precision`, Nullable: `true`)
6. 「Save」をクリックして変更を保存します

### オプション2: SQLエディタから実行

1. [Supabase Dashboard](https://supabase.com/dashboard)にログインします
2. プロジェクト「zceqyydzdrbvtsxnqeqx」を選択します
3. 左側のメニューから「SQL Editor」を選択します
4. 新しいクエリを作成し、以下のSQLを貼り付けます：

```sql
-- 既存のテーブルに新しいカラムを追加
ALTER TABLE trip_groups
ADD COLUMN IF NOT EXISTS departure_location_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS departure_location_lng DOUBLE PRECISION;

-- 新しいカラムにインデックスを追加（オプション）
CREATE INDEX IF NOT EXISTS idx_trip_groups_location 
ON trip_groups (departure_location_lat, departure_location_lng);
```

5. 「Run」をクリックしてSQLを実行します

## 確認方法

データベース変更後、アプリケーションで新しいトリップを作成して、エラーが解消されたか確認してください。 