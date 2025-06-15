-- ============================================================================
-- VOYPATH 共有機能データベース拡張
-- 既存Supabaseスキーマに追加する共有機能テーブル群
-- ============================================================================

-- Trip shares table (共有リンク管理)
CREATE TABLE trip_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  share_token VARCHAR(32) UNIQUE NOT NULL, -- URL短縮用ランダムトークン
  share_type VARCHAR(20) NOT NULL CHECK (share_type IN ('view', 'collaborate')),
  
  -- アクセス制御
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  max_uses INTEGER, -- 使用回数制限
  current_uses INTEGER DEFAULT 0,
  
  -- パスワード保護
  password_hash TEXT, -- bcrypt ハッシュ
  
  -- 権限設定
  permissions JSONB DEFAULT '{
    "can_view_places": true,
    "can_add_places": false,
    "can_edit_places": false,
    "can_view_optimization": true,
    "can_optimize": false,
    "can_export": true,
    "can_comment": false
  }'::jsonb,
  
  -- メタデータ
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ,
  access_log JSONB DEFAULT '[]'::jsonb,
  
  -- 制約
  CONSTRAINT valid_share_token CHECK (char_length(share_token) = 32),
  CONSTRAINT valid_max_uses CHECK (max_uses IS NULL OR max_uses > 0),
  CONSTRAINT valid_expiry CHECK (expires_at IS NULL OR expires_at > NOW())
);

-- Share access log (アクセス履歴)
CREATE TABLE share_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID NOT NULL REFERENCES trip_shares(id) ON DELETE CASCADE,
  
  -- アクセス情報
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  referer TEXT,
  
  -- ユーザー情報（認証済みユーザーの場合）
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- 位置情報（オプション）
  location_info JSONB -- {"country": "JP", "city": "Tokyo"}
);

-- Shared place comments (共有での場所コメント)
CREATE TABLE shared_place_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  share_id UUID NOT NULL REFERENCES trip_shares(id) ON DELETE CASCADE,
  
  -- コメント内容
  comment TEXT NOT NULL,
  commenter_name VARCHAR(100), -- 匿名コメンター名
  commenter_email VARCHAR(255), -- オプション
  
  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  
  -- モデレーション
  is_approved BOOLEAN DEFAULT true,
  is_spam BOOLEAN DEFAULT false
);

-- ============================================================================
-- インデックス作成
-- ============================================================================

-- 共有リンク高速検索用
CREATE INDEX idx_trip_shares_token ON trip_shares(share_token);
CREATE INDEX idx_trip_shares_trip_id ON trip_shares(trip_id);
CREATE INDEX idx_trip_shares_created_by ON trip_shares(created_by);
CREATE INDEX idx_trip_shares_active ON trip_shares(is_active, expires_at);

-- アクセスログ高速検索用
CREATE INDEX idx_share_access_log_share_id ON share_access_log(share_id);
CREATE INDEX idx_share_access_log_accessed_at ON share_access_log(accessed_at);
CREATE INDEX idx_share_access_log_user_id ON share_access_log(user_id);

-- コメント高速検索用
CREATE INDEX idx_shared_place_comments_place_id ON shared_place_comments(place_id);
CREATE INDEX idx_shared_place_comments_share_id ON shared_place_comments(share_id);

-- ============================================================================
-- Row Level Security (RLS) 設定
-- ============================================================================

-- Trip shares のRLS
ALTER TABLE trip_shares ENABLE ROW LEVEL SECURITY;

-- 作成者は全権限
CREATE POLICY "trip_shares_owner_policy" ON trip_shares
  FOR ALL USING (created_by = auth.uid());

-- 有効な共有リンクは誰でも読み取り可能
CREATE POLICY "trip_shares_public_read_policy" ON trip_shares
  FOR SELECT USING (
    is_active = true 
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR current_uses < max_uses)
  );

-- Share access log のRLS
ALTER TABLE share_access_log ENABLE ROW LEVEL SECURITY;

-- 共有リンク作成者のみアクセス可能
CREATE POLICY "share_access_log_owner_policy" ON share_access_log
  FOR ALL USING (
    share_id IN (
      SELECT id FROM trip_shares WHERE created_by = auth.uid()
    )
  );

-- Shared place comments のRLS
ALTER TABLE shared_place_comments ENABLE ROW LEVEL SECURITY;

-- 関連する共有リンクがアクティブなら誰でも読み取り可能
CREATE POLICY "shared_place_comments_read_policy" ON shared_place_comments
  FOR SELECT USING (
    share_id IN (
      SELECT id FROM trip_shares 
      WHERE is_active = true 
        AND (expires_at IS NULL OR expires_at > NOW())
    )
  );

-- 承認されたコメントのみ作成可能
CREATE POLICY "shared_place_comments_insert_policy" ON shared_place_comments
  FOR INSERT WITH CHECK (
    share_id IN (
      SELECT id FROM trip_shares 
      WHERE is_active = true 
        AND (expires_at IS NULL OR expires_at > NOW())
        AND permissions->>'can_comment' = 'true'
    )
  );

-- ============================================================================
-- 共有機能専用関数
-- ============================================================================

-- 共有リンクトークン生成関数
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(16), 'hex');
END;
$$ LANGUAGE plpgsql;

-- 共有リンクアクセス記録関数
CREATE OR REPLACE FUNCTION record_share_access(
  p_share_token TEXT,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referer TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_share_id UUID;
BEGIN
  -- 共有リンクの存在確認・使用回数更新
  UPDATE trip_shares 
  SET current_uses = current_uses + 1,
      last_accessed_at = NOW()
  WHERE share_token = p_share_token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR current_uses < max_uses)
  RETURNING id INTO v_share_id;

  IF v_share_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- アクセスログ記録
  INSERT INTO share_access_log (
    share_id, ip_address, user_agent, referer, user_id
  ) VALUES (
    v_share_id, p_ip_address, p_user_agent, p_referer, p_user_id
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 共有統計取得関数
CREATE OR REPLACE FUNCTION get_share_statistics(p_user_id UUID)
RETURNS TABLE (
  total_shares BIGINT,
  active_shares BIGINT,
  total_accesses BIGINT,
  unique_visitors BIGINT,
  avg_accesses_per_share NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(ts.id) as total_shares,
    COUNT(CASE WHEN ts.is_active = true 
               AND (ts.expires_at IS NULL OR ts.expires_at > NOW()) 
               THEN 1 END) as active_shares,
    COALESCE(SUM(ts.current_uses), 0) as total_accesses,
    COUNT(DISTINCT sal.ip_address) as unique_visitors,
    CASE 
      WHEN COUNT(ts.id) > 0 THEN 
        COALESCE(SUM(ts.current_uses), 0)::NUMERIC / COUNT(ts.id)
      ELSE 0 
    END as avg_accesses_per_share
  FROM trip_shares ts
  LEFT JOIN share_access_log sal ON ts.id = sal.share_id
  WHERE ts.created_by = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 初期データ・デフォルト設定
-- ============================================================================

-- 共有権限テンプレート
INSERT INTO public.app_settings (key, value) VALUES 
('share_permission_templates', '{
  "view_only": {
    "can_view_places": true,
    "can_add_places": false,
    "can_edit_places": false,
    "can_view_optimization": true,
    "can_optimize": false,
    "can_export": false,
    "can_comment": false
  },
  "collaborate": {
    "can_view_places": true,
    "can_add_places": true,
    "can_edit_places": true,
    "can_view_optimization": true,
    "can_optimize": false,
    "can_export": true,
    "can_comment": true
  },
  "full_access": {
    "can_view_places": true,
    "can_add_places": true,
    "can_edit_places": true,
    "can_view_optimization": true,
    "can_optimize": true,
    "can_export": true,
    "can_comment": true
  }
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 共有制限設定
INSERT INTO public.app_settings (key, value) VALUES 
('share_limits', '{
  "free_user": {
    "max_active_shares": 2,
    "max_uses_per_share": 100,
    "max_expiry_days": 30,
    "password_protection": false,
    "analytics": false
  },
  "premium_user": {
    "max_active_shares": null,
    "max_uses_per_share": null,
    "max_expiry_days": null,
    "password_protection": true,
    "analytics": true
  }
}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ============================================================================
-- 実行完了メッセージ
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ 共有機能データベース拡張が完了しました';
  RAISE NOTICE '📊 作成されたテーブル: trip_shares, share_access_log, shared_place_comments';
  RAISE NOTICE '🔐 RLS ポリシーが適用されました';
  RAISE NOTICE '⚡ インデックスが作成されました';
  RAISE NOTICE '🛠 共有機能専用関数が追加されました';
END;
$$;