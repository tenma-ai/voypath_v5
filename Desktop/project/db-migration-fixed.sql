-- Supabase migration script (修正版)
-- trip_groupsテーブルに緯度・経度のカラムを追加

-- 既存のテーブルに新しいカラムを追加
ALTER TABLE trip_groups
ADD COLUMN IF NOT EXISTS departure_location_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS departure_location_lng DOUBLE PRECISION;

-- 新しいカラムにインデックスを追加（オプション）
CREATE INDEX IF NOT EXISTS idx_trip_groups_location 
ON trip_groups (departure_location_lat, departure_location_lng)