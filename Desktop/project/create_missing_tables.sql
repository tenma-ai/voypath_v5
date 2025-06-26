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