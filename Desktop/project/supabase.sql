-- 段階的データベース修正スクリプト（既存環境対応）
-- 既存のデータベーススキーマに安全に追加

-- SECTION 1: 新しいカラムの追加

-- Step 1: trip_groups テーブルに復路設定を追加
ALTER TABLE trip_groups
ADD COLUMN IF NOT EXISTS return_location_lat DOUBLE PRECISION;

ALTER TABLE trip_groups
ADD COLUMN IF NOT EXISTS return_location_lng DOUBLE PRECISION;

ALTER TABLE trip_groups
ADD COLUMN IF NOT EXISTS return_to_departure BOOLEAN DEFAULT true;

-- Step 2: places テーブルに出発地制約フィールドを追加
ALTER TABLE places 
ADD COLUMN IF NOT EXISTS is_departure_point BOOLEAN DEFAULT false;

ALTER TABLE places 
ADD COLUMN IF NOT EXISTS is_return_point BOOLEAN DEFAULT false;

ALTER TABLE places 
ADD COLUMN IF NOT EXISTS departure_constraint_order INTEGER;

-- Step 3: route_change_logs テーブルの change_type に新しい値を追加
-- （既存のCHECK制約を削除して再作成）
ALTER TABLE route_change_logs DROP CONSTRAINT IF EXISTS route_change_logs_change_type_check;
ALTER TABLE route_change_logs 
ADD CONSTRAINT route_change_logs_change_type_check 
CHECK (change_type IN ('destination_reorder', 'time_adjustment', 'destination_exclude', 'preference_update', 'destination_add', 'destination_remove', 'departure_location_change'));

-- SECTION 2: 重複データのクリーンアップ

-- Step 4: 重複データクリーンアップ関数の作成
CREATE OR REPLACE FUNCTION cleanup_duplicate_data()
RETURNS TABLE (
    cleanup_type TEXT,
    records_removed INTEGER,
    details TEXT
)
LANGUAGE plpgsql
AS $func$
DECLARE
    session_cleanup_count INTEGER := 0;
    user_cleanup_count INTEGER := 0;
    dest_cleanup_count INTEGER := 0;
    current_count INTEGER;
    duplicate_rec RECORD;
BEGIN
    -- Clean up session-based my_places duplicates
    FOR duplicate_rec IN
        SELECT 
            session_id, 
            group_id, 
            place_id, 
            array_agg(id ORDER BY created_at DESC) as duplicate_ids
        FROM my_places 
        WHERE session_id IS NOT NULL AND place_id IS NOT NULL
        GROUP BY session_id, group_id, place_id 
        HAVING COUNT(*) > 1
    LOOP
        DELETE FROM my_places 
        WHERE id = ANY(duplicate_rec.duplicate_ids[2:]);
        
        GET DIAGNOSTICS current_count = ROW_COUNT;
        session_cleanup_count := session_cleanup_count + current_count;
    END LOOP;
    
    -- Clean up user-based my_places duplicates
    FOR duplicate_rec IN
        SELECT 
            user_id, 
            group_id, 
            place_id, 
            array_agg(id ORDER BY created_at DESC) as duplicate_ids
        FROM my_places 
        WHERE user_id IS NOT NULL AND place_id IS NOT NULL
        GROUP BY user_id, group_id, place_id 
        HAVING COUNT(*) > 1
    LOOP
        DELETE FROM my_places 
        WHERE id = ANY(duplicate_rec.duplicate_ids[2:]);
        
        GET DIAGNOSTICS current_count = ROW_COUNT;
        user_cleanup_count := user_cleanup_count + current_count;
    END LOOP;
    
    -- Clean up destinations duplicates
    FOR duplicate_rec IN
        SELECT 
            group_id, 
            place_id, 
            array_agg(id ORDER BY created_at DESC) as duplicate_ids
        FROM destinations 
        WHERE place_id IS NOT NULL
        GROUP BY group_id, place_id 
        HAVING COUNT(*) > 1
    LOOP
        DELETE FROM destinations 
        WHERE id = ANY(duplicate_rec.duplicate_ids[2:]);
        
        GET DIAGNOSTICS current_count = ROW_COUNT;
        dest_cleanup_count := dest_cleanup_count + current_count;
    END LOOP;
    
    -- Return results
    RETURN QUERY SELECT 
        'session_duplicates'::TEXT,
        session_cleanup_count,
        format('Removed %s duplicate session-based my_places records', session_cleanup_count);
        
    RETURN QUERY SELECT 
        'user_duplicates'::TEXT,
        user_cleanup_count,
        format('Removed %s duplicate user-based my_places records', user_cleanup_count);
        
    RETURN QUERY SELECT 
        'destination_duplicates'::TEXT,
        dest_cleanup_count,
        format('Removed %s duplicate destinations records', dest_cleanup_count);
END;
$func$;

-- Step 5: 重複データクリーンアップの実行
SELECT 'Step 1: 重複データクリーンアップ中...' as status;
SELECT * FROM cleanup_duplicate_data();

-- SECTION 3: ユニーク制約の追加

-- Step 6: 安全なユニーク制約の追加関数
CREATE OR REPLACE FUNCTION add_unique_constraints_safely()
RETURNS TABLE (
    constraint_type TEXT,
    status TEXT,
    details TEXT
)
LANGUAGE plpgsql
AS $func$
BEGIN
    -- destinations のユニーク制約
    BEGIN
        CREATE UNIQUE INDEX unique_place_per_group 
        ON destinations (group_id, place_id) 
        WHERE place_id IS NOT NULL;
        
        RETURN QUERY SELECT 
            'destinations_unique'::TEXT,
            'success'::TEXT,
            'Unique constraint added for destinations'::TEXT;
    EXCEPTION 
        WHEN duplicate_table THEN
            RETURN QUERY SELECT 
                'destinations_unique'::TEXT,
                'already_exists'::TEXT,
                'Unique constraint already exists for destinations'::TEXT;
        WHEN unique_violation THEN
            RETURN QUERY SELECT 
                'destinations_unique'::TEXT,
                'failed'::TEXT,
                'Still has duplicate data in destinations'::TEXT;
    END;
    
    -- my_places ユーザーベースのユニーク制約
    BEGIN
        CREATE UNIQUE INDEX unique_myplace_user_group 
        ON my_places (user_id, group_id, place_id) 
        WHERE user_id IS NOT NULL AND place_id IS NOT NULL;
        
        RETURN QUERY SELECT 
            'my_places_user_unique'::TEXT,
            'success'::TEXT,
            'Unique constraint added for user-based my_places'::TEXT;
    EXCEPTION 
        WHEN duplicate_table THEN
            RETURN QUERY SELECT 
                'my_places_user_unique'::TEXT,
                'already_exists'::TEXT,
                'Unique constraint already exists for user-based my_places'::TEXT;
        WHEN unique_violation THEN
            RETURN QUERY SELECT 
                'my_places_user_unique'::TEXT,
                'failed'::TEXT,
                'Still has duplicate data in user-based my_places'::TEXT;
    END;
    
    -- my_places セッションベースのユニーク制約
    BEGIN
        CREATE UNIQUE INDEX unique_myplace_session_group 
        ON my_places (session_id, group_id, place_id) 
        WHERE session_id IS NOT NULL AND place_id IS NOT NULL;
        
        RETURN QUERY SELECT 
            'my_places_session_unique'::TEXT,
            'success'::TEXT,
            'Unique constraint added for session-based my_places'::TEXT;
    EXCEPTION 
        WHEN duplicate_table THEN
            RETURN QUERY SELECT 
                'my_places_session_unique'::TEXT,
                'already_exists'::TEXT,
                'Unique constraint already exists for session-based my_places'::TEXT;
        WHEN unique_violation THEN
            RETURN QUERY SELECT 
                'my_places_session_unique'::TEXT,
                'failed'::TEXT,
                'Still has duplicate data in session-based my_places'::TEXT;
    END;
END;
$func$;

-- Step 7: ユニーク制約の追加実行
SELECT 'Step 2: ユニーク制約追加中...' as status;
SELECT * FROM add_unique_constraints_safely();

-- SECTION 4: 新しいインデックスの追加

-- Step 8: パフォーマンス向上のためのインデックス追加
CREATE INDEX IF NOT EXISTS idx_places_departure_order 
ON places(group_id, is_departure_point, departure_constraint_order);

CREATE INDEX IF NOT EXISTS idx_trip_groups_return_location 
ON trip_groups (return_location_lat, return_location_lng);

CREATE INDEX IF NOT EXISTS idx_optimized_routes_departure_constraint 
ON optimized_routes USING GIN ((route_data -> 'departure'));

CREATE INDEX IF NOT EXISTS idx_optimized_routes_return_constraint 
ON optimized_routes USING GIN ((route_data -> 'returnLocation'));

-- SECTION 5: 新しい関数の追加

-- Step 9: データ整合性チェック関数
CREATE OR REPLACE FUNCTION check_departure_constraint_integrity(group_id_param UUID)
RETURNS TABLE (
    issue_type TEXT,
    description TEXT,
    affected_records INTEGER
)
LANGUAGE plpgsql
AS $func$
DECLARE
    departure_count INTEGER;
    missing_departure INTEGER;
    duplicate_places INTEGER;
BEGIN
    -- Check if departure location is set
    SELECT COUNT(*) INTO departure_count
    FROM trip_groups 
    WHERE id = group_id_param AND departure_location IS NOT NULL;
    
    IF departure_count = 0 THEN
        RETURN QUERY SELECT 
            'missing_departure'::TEXT,
            'Trip group has no departure location set'::TEXT,
            0::INTEGER;
    END IF;
    
    -- Check if places table has departure point
    SELECT COUNT(*) INTO missing_departure
    FROM places 
    WHERE group_id = group_id_param AND is_departure_point = true;
    
    IF missing_departure = 0 THEN
        RETURN QUERY SELECT 
            'missing_departure_point'::TEXT,
            'Optimized route missing departure point in places table'::TEXT,
            0::INTEGER;
    END IF;
    
    -- Check for duplicate places
    SELECT COUNT(*) INTO duplicate_places
    FROM (
        SELECT place_id, COUNT(*) as cnt
        FROM destinations 
        WHERE group_id = group_id_param AND place_id IS NOT NULL
        GROUP BY place_id 
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_places > 0 THEN
        RETURN QUERY SELECT 
            'duplicate_destinations'::TEXT,
            'Duplicate places found in destinations table'::TEXT,
            duplicate_places::INTEGER;
    END IF;
    
    -- All checks passed
    IF departure_count > 0 AND missing_departure > 0 AND duplicate_places = 0 THEN
        RETURN QUERY SELECT 
            'integrity_ok'::TEXT,
            'All departure constraints are properly configured'::TEXT,
            1::INTEGER;
    END IF;
END;
$func$;

-- Step 10: 出発地制約付きルート生成関数
CREATE OR REPLACE FUNCTION generate_departure_constrained_route(
    group_id_param UUID,
    force_regenerate BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
AS $func$
DECLARE
    trip_info RECORD;
    destinations_data JSONB;
    result_route JSONB;
BEGIN
    -- Get trip information
    SELECT * INTO trip_info
    FROM trip_groups 
    WHERE id = group_id_param;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Trip group not found: %', group_id_param;
    END IF;
    
    -- Check if departure location is properly configured
    IF trip_info.departure_location IS NULL OR 
       trip_info.departure_location_lat IS NULL OR 
       trip_info.departure_location_lng IS NULL THEN
        RAISE EXCEPTION 'Departure location not properly configured';
    END IF;
    
    -- Check existing optimization results
    IF NOT force_regenerate THEN
        SELECT route_data INTO result_route
        FROM optimized_routes 
        WHERE group_id = group_id_param 
        ORDER BY version DESC 
        LIMIT 1;
        
        IF FOUND AND result_route->>'status' = 'success' THEN
            RETURN result_route;
        END IF;
    END IF;
    
    -- Get destinations data
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', d.id,
            'name', d.name,
            'latitude', d.latitude,
            'longitude', d.longitude,
            'userPreferences', (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'userId', up.user_id,
                        'sessionId', up.session_id,
                        'score', up.preference_score,
                        'duration', up.preferred_duration
                    )
                )
                FROM user_preferences up 
                WHERE up.destination_id = d.id
            )
        )
    ) INTO destinations_data
    FROM destinations d 
    WHERE d.group_id = group_id_param;
    
    -- Generate departure-constrained route
    result_route := jsonb_build_object(
        'status', 'requires_optimization',
        'departure', jsonb_build_object(
            'name', trip_info.departure_location,
            'latitude', trip_info.departure_location_lat,
            'longitude', trip_info.departure_location_lng
        ),
        'returnLocation', CASE 
            WHEN trip_info.return_to_departure THEN
                jsonb_build_object(
                    'name', trip_info.departure_location,
                    'latitude', trip_info.departure_location_lat,
                    'longitude', trip_info.departure_location_lng
                )
            ELSE
                jsonb_build_object(
                    'name', trip_info.return_location,
                    'latitude', trip_info.return_location_lat,
                    'longitude', trip_info.return_location_lng
                )
        END,
        'destinations', destinations_data,
        'constraints', jsonb_build_object(
            'maxDays', CASE 
                WHEN trip_info.end_date IS NOT NULL AND trip_info.start_date IS NOT NULL 
                THEN trip_info.end_date - trip_info.start_date + 1
                ELSE NULL
            END,
            'returnToDeparture', trip_info.return_to_departure,
            'autoCalculateEndDate', trip_info.auto_calculate_end_date
        ),
        'generatedAt', NOW()
    );
    
    RETURN result_route;
END;
$func$;

-- SECTION 6: トリガーの追加

-- Step 11: 出発地変更時のトリガー関数
CREATE OR REPLACE FUNCTION trigger_clear_routes_on_departure_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
    -- Clear optimization results when departure location changes
    IF OLD.departure_location_lat IS DISTINCT FROM NEW.departure_location_lat OR
       OLD.departure_location_lng IS DISTINCT FROM NEW.departure_location_lng OR
       OLD.departure_location IS DISTINCT FROM NEW.departure_location THEN
        
        -- Invalidate existing optimization results
        UPDATE optimized_routes 
        SET route_data = route_data || jsonb_build_object('status', 'invalidated_by_departure_change')
        WHERE group_id = NEW.id;
        
        -- Log the change
        INSERT INTO route_change_logs (
            group_id,
            change_type,
            old_value,
            new_value,
            impact_metrics
        ) VALUES (
            NEW.id,
            'departure_location_change',
            jsonb_build_object(
                'old_departure', OLD.departure_location,
                'old_lat', OLD.departure_location_lat,
                'old_lng', OLD.departure_location_lng
            ),
            jsonb_build_object(
                'new_departure', NEW.departure_location,
                'new_lat', NEW.departure_location_lat,
                'new_lng', NEW.departure_location_lng
            ),
            jsonb_build_object(
                'routes_invalidated', true,
                'requires_reoptimization', true
            )
        );
    END IF;
    
    RETURN NEW;
END;
$func$;

-- Step 12: トリガーの作成
DROP TRIGGER IF EXISTS trip_departure_change_trigger ON trip_groups;
CREATE TRIGGER trip_departure_change_trigger
    AFTER UPDATE ON trip_groups
    FOR EACH ROW
    EXECUTE FUNCTION trigger_clear_routes_on_departure_change();

-- SECTION 7: 検証とテスト

-- Step 13: 追加されたカラムの確認
SELECT 'Step 3: 新しいカラムの確認' as status;

SELECT 
    'places テーブルの新しいカラム' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'places' 
  AND column_name IN ('is_departure_point', 'is_return_point', 'departure_constraint_order')
ORDER BY ordinal_position;

SELECT 
    'trip_groups テーブルの新しいカラム' as table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'trip_groups' 
  AND column_name IN ('return_location_lat', 'return_location_lng', 'return_to_departure')
ORDER BY ordinal_position;

-- Step 14: 作成されたインデックスの確認
SELECT 'Step 4: 新しいインデックスの確認' as status;

SELECT 
    '作成されたユニークインデックス' as index_type,
    indexname,
    tablename
FROM pg_indexes 
WHERE indexname IN (
    'unique_place_per_group',
    'unique_myplace_user_group',
    'unique_myplace_session_group'
)
ORDER BY indexname;

SELECT 
    '作成されたパフォーマンスインデックス' as index_type,
    indexname,
    tablename
FROM pg_indexes 
WHERE indexname IN (
    'idx_places_departure_order',
    'idx_trip_groups_return_location',
    'idx_optimized_routes_departure_constraint',
    'idx_optimized_routes_return_constraint'
)
ORDER BY indexname;

-- Step 15: 作成された関数の確認
SELECT 'Step 5: 新しい関数の確認' as status;

SELECT 
    '作成された関数' as function_type,
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name IN (
    'cleanup_duplicate_data',
    'add_unique_constraints_safely',
    'check_departure_constraint_integrity',
    'generate_departure_constrained_route',
    'trigger_clear_routes_on_departure_change'
)
ORDER BY routine_name;

-- SECTION 8: 最終確認

-- Step 16: データベース拡張完了メッセージ
SELECT 'データベース拡張が正常に完了しました！' as final_status;

SELECT '追加された機能:' as added_features;
SELECT '✅ 出発地・復路設定フィールド' as feature_1;
SELECT '✅ 重複データ防止制約' as feature_2;
SELECT '✅ データ整合性チェック機能' as feature_3;
SELECT '✅ 出発地制約対応関数' as feature_4;
SELECT '✅ パフォーマンス最適化インデックス' as feature_5;
SELECT '✅ 出発地変更時の自動ルート無効化' as feature_6;

-- Step 17: 既存データの影響確認
SELECT 
    'データ影響確認' as check_type,
    'trip_groups レコード数: ' || COUNT(*) as record_count
FROM trip_groups;

SELECT 
    'データ影響確認' as check_type,
    'my_places レコード数: ' || COUNT(*) as record_count
FROM my_places;

SELECT 
    'データ影響確認' as check_type,
    'destinations レコード数: ' || COUNT(*) as record_count
FROM destinations;

-- Step 18: 手動テスト用のサンプルクエリ
SELECT 'サンプルテスト用クエリ:' as test_info;
SELECT '-- データ整合性チェック:' as test_query_1;
SELECT '-- SELECT * FROM check_departure_constraint_integrity(''your-group-id'');' as test_query_2;
SELECT '-- 出発地制約ルート生成:' as test_query_3;
SELECT '-- SELECT generate_departure_constrained_route(''your-group-id'', false);' as test_query_4;
-- 欠落しているテーブルの作成スクリプト
-- Voypath プロジェクト用

-- SECTION 1: optimization_updates テーブル（リアルタイム通知用）
CREATE TABLE IF NOT EXISTS optimization_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES trip_groups(id) ON DELETE CASCADE,
    update_type TEXT NOT NULL,
    data JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_optimization_updates_group_id 
ON optimization_updates(group_id, created_at DESC);

-- RLSポリシー
ALTER TABLE optimization_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on optimization_updates"
    ON optimization_updates
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 権限の付与
GRANT ALL ON optimization_updates TO authenticated, anon;

-- SECTION 2: session_settings テーブル（trip persistence用）
CREATE TABLE IF NOT EXISTS session_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    setting_key TEXT NOT NULL,
    setting_value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_session_setting UNIQUE(session_id, setting_key)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_session_settings_session_id 
ON session_settings(session_id);

-- RLSポリシー
ALTER TABLE session_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on session_settings"
    ON session_settings
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 権限の付与
GRANT ALL ON session_settings TO authenticated, anon;

-- SECTION 3: placesテーブルに欠落しているフィールドを追加
ALTER TABLE places 
ADD COLUMN IF NOT EXISTS duration INTEGER; -- アルゴリズムで使用される時間

-- 確認用クエリ
SELECT 'Tables created/updated successfully!' as status;
-- 欠落しているテーブルの作成スクリプト
  -- Voypath プロジェクト用

  -- SECTION 1: optimization_updates テーブル（リアルタイム通知用）
  CREATE TABLE IF NOT EXISTS optimization_updates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id UUID REFERENCES trip_groups(id) ON DELETE CASCADE,
      update_type TEXT NOT NULL,
      data JSONB,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- インデックスの作成
  CREATE INDEX IF NOT EXISTS idx_optimization_updates_group_id
  ON optimization_updates(group_id, created_at DESC);

  -- RLSポリシー
  ALTER TABLE optimization_updates ENABLE ROW LEVEL SECURITY;

  -- ポリシーを削除してから再作成
  DROP POLICY IF EXISTS "Allow all operations on optimization_updates" ON optimization_updates;
  CREATE POLICY "Allow all operations on optimization_updates"
      ON optimization_updates
      FOR ALL
      USING (true)
      WITH CHECK (true);

  -- 権限の付与
  GRANT ALL ON optimization_updates TO authenticated, anon;

  -- SECTION 2: session_settings テーブル（trip persistence用）
  CREATE TABLE IF NOT EXISTS session_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id TEXT NOT NULL,
      setting_key TEXT NOT NULL,
      setting_value TEXT,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      CONSTRAINT unique_session_setting UNIQUE(session_id, setting_key)
  );

  -- インデックス
  CREATE INDEX IF NOT EXISTS idx_session_settings_session_id
  ON session_settings(session_id);

  -- RLSポリシー
  ALTER TABLE session_settings ENABLE ROW LEVEL SECURITY;

  -- ポリシーを削除してから再作成
  DROP POLICY IF EXISTS "Allow all operations on session_settings" ON session_settings;
  CREATE POLICY "Allow all operations on session_settings"
      ON session_settings
      FOR ALL
      USING (true)
      WITH CHECK (true);

  -- 権限の付与
  GRANT ALL ON session_settings TO authenticated, anon;

  -- SECTION 3: placesテーブルに欠落しているフィールドを追加
  ALTER TABLE places
  ADD COLUMN IF NOT EXISTS duration INTEGER; -- アルゴリズムで使用される時間

  -- 確認用クエリ
  SELECT 'Tables created/updated successfully!' as status;

  -- Add optimization_updates table for real-time notifications
  -- This table tracks optimization updates for real-time synchronization

  CREATE TABLE IF NOT EXISTS optimization_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES trip_groups(id) ON DELETE CASCADE,
    update_type TEXT NOT NULL, -- 'route_optimized', 'place_added', 'place_removed', 'preferences_updated'
    data JSONB,
    user_id UUID REFERENCES users(id),
    session_id TEXT, -- for guest users
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Enable RLS
  ALTER TABLE optimization_updates ENABLE ROW LEVEL SECURITY;

  -- Create policy for optimization_updates
  CREATE POLICY "Allow all operations on optimization_updates"
  ON optimization_updates
  FOR ALL
  USING (true)
  WITH CHECK (true);

  -- Add index for performance
  CREATE INDEX IF NOT EXISTS idx_optimization_updates_group_id ON optimization_updates(group_id);
  CREATE INDEX IF NOT EXISTS idx_optimization_updates_timestamp ON optimization_updates(timestamp DESC);

  -- Grant permissions
  GRANT ALL ON optimization_updates TO authenticated, anon;

  -- Add comment
  COMMENT ON TABLE optimization_updates IS 'Real-time notification updates for optimization events';
  