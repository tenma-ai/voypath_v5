-- ============================================================================
-- VOYPATH 統合共有機能データベース拡張（既存システム統合版）
-- 既存invitation_codesテーブルとの統合 + 外部共有機能追加
-- ============================================================================

-- ============================================================================
-- 1. 既存invitation_codesテーブルの拡張
-- ============================================================================

-- 共有タイプenumの追加
DO $$ BEGIN
    CREATE TYPE share_type_enum AS ENUM ('member_invite', 'external_view', 'external_collaborate');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- invitation_codesテーブルを共有機能に拡張
ALTER TABLE invitation_codes 
ADD COLUMN IF NOT EXISTS share_type share_type_enum DEFAULT 'member_invite',
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{
  "can_view_places": true,
  "can_add_places": false,
  "can_edit_places": false,
  "can_view_optimization": true,
  "can_optimize": false,
  "can_export": false,
  "can_comment": false,
  "can_join_as_member": true
}'::jsonb,
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS access_log JSONB DEFAULT '[]'::jsonb;

-- ============================================================================
-- 2. 外部共有専用テーブル（メンバー以外への共有）
-- ============================================================================

CREATE TABLE IF NOT EXISTS trip_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  share_token VARCHAR(32) UNIQUE NOT NULL,
  share_type share_type_enum NOT NULL CHECK (share_type IN ('external_view', 'external_collaborate')),
  
  -- アクセス制御
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  
  -- パスワード保護
  password_hash TEXT,
  
  -- 権限設定（外部ユーザー向け）
  permissions JSONB DEFAULT '{
    "can_view_places": true,
    "can_add_places": false,
    "can_edit_places": false,
    "can_view_optimization": true,
    "can_optimize": false,
    "can_export": true,
    "can_comment": false,
    "can_join_as_member": false
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

-- ============================================================================
-- 3. 外部ユーザーアクション承認システム
-- ============================================================================

-- 承認待ちアクションステータス
DO $$ BEGIN
    CREATE TYPE action_status_enum AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 外部ユーザーからの提案アクション
CREATE TABLE IF NOT EXISTS pending_place_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID REFERENCES trip_shares(id) ON DELETE CASCADE,
  invitation_id UUID REFERENCES invitation_codes(id) ON DELETE CASCADE,
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  
  -- アクション詳細
  action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('add', 'edit', 'comment')),
  original_place_id UUID REFERENCES places(id) ON DELETE CASCADE, -- 編集時のみ
  
  -- 提案データ
  proposed_data JSONB NOT NULL, -- 場所データまたはコメント
  proposed_by_session VARCHAR(64) NOT NULL, -- セッションID
  proposer_info JSONB, -- {"name": "匿名ユーザー", "email": "optional"}
  
  -- 承認フロー
  status action_status_enum DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- メタデータ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  
  -- 制約: share_idかinvitation_idのどちらか一つは必須
  CONSTRAINT check_share_source CHECK (
    (share_id IS NOT NULL AND invitation_id IS NULL) OR 
    (share_id IS NULL AND invitation_id IS NOT NULL)
  )
);

-- ============================================================================
-- 4. Admin権限用デッドライン管理拡張
-- ============================================================================

-- tripsテーブルのデッドライン機能拡張
ALTER TABLE trips 
ADD COLUMN IF NOT EXISTS edit_place_deadline TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS optimization_deadline TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS member_join_deadline TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deadline_notifications JSONB DEFAULT '{
  "enabled": false,
  "notify_before": [86400, 10800],
  "notify_members": true,
  "notify_external_users": false
}'::jsonb;

-- ============================================================================
-- 5. 共有アクセス履歴（統合版）
-- ============================================================================

CREATE TABLE IF NOT EXISTS share_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 共有ソース（どちらか一方）
  share_id UUID REFERENCES trip_shares(id) ON DELETE CASCADE,
  invitation_id UUID REFERENCES invitation_codes(id) ON DELETE CASCADE,
  
  -- アクセス情報
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  referer TEXT,
  
  -- セッション情報
  session_id VARCHAR(64),
  
  -- ユーザー情報（認証済みの場合）
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- 位置情報（オプション）
  location_info JSONB,
  
  -- 制約
  CONSTRAINT check_access_source CHECK (
    (share_id IS NOT NULL AND invitation_id IS NULL) OR 
    (share_id IS NULL AND invitation_id IS NOT NULL)
  )
);

-- ============================================================================
-- 6. インデックス作成
-- ============================================================================

-- invitation_codes拡張用インデックス
CREATE INDEX IF NOT EXISTS idx_invitation_codes_share_type ON invitation_codes(share_type);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_active_expires ON invitation_codes(is_active, expires_at);

-- trip_shares用インデックス
CREATE INDEX IF NOT EXISTS idx_trip_shares_token ON trip_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_trip_shares_trip_id ON trip_shares(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_shares_created_by ON trip_shares(created_by);
CREATE INDEX IF NOT EXISTS idx_trip_shares_active ON trip_shares(is_active, expires_at);

-- pending_place_actions用インデックス
CREATE INDEX IF NOT EXISTS idx_pending_actions_trip_id ON pending_place_actions(trip_id);
CREATE INDEX IF NOT EXISTS idx_pending_actions_status ON pending_place_actions(status);
CREATE INDEX IF NOT EXISTS idx_pending_actions_share_id ON pending_place_actions(share_id);
CREATE INDEX IF NOT EXISTS idx_pending_actions_invitation_id ON pending_place_actions(invitation_id);

-- share_access_log用インデックス
CREATE INDEX IF NOT EXISTS idx_share_access_log_share_id ON share_access_log(share_id);
CREATE INDEX IF NOT EXISTS idx_share_access_log_invitation_id ON share_access_log(invitation_id);
CREATE INDEX IF NOT EXISTS idx_share_access_log_accessed_at ON share_access_log(accessed_at);
CREATE INDEX IF NOT EXISTS idx_share_access_log_session_id ON share_access_log(session_id);

-- ============================================================================
-- 7. Row Level Security (RLS) 設定
-- ============================================================================

-- trip_shares のRLS
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

-- pending_place_actions のRLS
ALTER TABLE pending_place_actions ENABLE ROW LEVEL SECURITY;

-- Trip メンバーは関連アクションを閲覧・承認可能
CREATE POLICY "pending_actions_trip_member_policy" ON pending_place_actions
  FOR ALL USING (
    trip_id IN (
      SELECT trip_id FROM trip_members WHERE user_id = auth.uid()
    )
  );

-- share_access_log のRLS
ALTER TABLE share_access_log ENABLE ROW LEVEL SECURITY;

-- 関連する共有の作成者のみアクセス可能
CREATE POLICY "share_access_log_owner_policy" ON share_access_log
  FOR ALL USING (
    (share_id IN (SELECT id FROM trip_shares WHERE created_by = auth.uid())) OR
    (invitation_id IN (SELECT id FROM invitation_codes WHERE created_by = auth.uid()))
  );

-- ============================================================================
-- 8. 共有機能専用関数
-- ============================================================================

-- 統合共有リンクアクセス記録関数
CREATE OR REPLACE FUNCTION record_unified_share_access(
  p_share_token TEXT DEFAULT NULL,
  p_invitation_code TEXT DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referer TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_share_id UUID;
  v_invitation_id UUID;
  v_success BOOLEAN := FALSE;
BEGIN
  -- trip_shares からアクセス記録
  IF p_share_token IS NOT NULL THEN
    UPDATE trip_shares 
    SET current_uses = current_uses + 1,
        last_accessed_at = NOW()
    WHERE share_token = p_share_token
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (max_uses IS NULL OR current_uses < max_uses)
    RETURNING id INTO v_share_id;
    
    IF v_share_id IS NOT NULL THEN
      INSERT INTO share_access_log (
        share_id, session_id, ip_address, user_agent, referer, user_id
      ) VALUES (
        v_share_id, p_session_id, p_ip_address, p_user_agent, p_referer, p_user_id
      );
      v_success := TRUE;
    END IF;
  END IF;
  
  -- invitation_codes からアクセス記録
  IF p_invitation_code IS NOT NULL THEN
    UPDATE invitation_codes 
    SET current_uses = COALESCE(current_uses, 0) + 1,
        last_accessed_at = NOW()
    WHERE code = p_invitation_code
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (max_uses IS NULL OR COALESCE(current_uses, 0) < max_uses)
    RETURNING id INTO v_invitation_id;
    
    IF v_invitation_id IS NOT NULL THEN
      INSERT INTO share_access_log (
        invitation_id, session_id, ip_address, user_agent, referer, user_id
      ) VALUES (
        v_invitation_id, p_session_id, p_ip_address, p_user_agent, p_referer, p_user_id
      );
      v_success := TRUE;
    END IF;
  END IF;

  RETURN v_success;
END;
$$ LANGUAGE plpgsql;

-- 外部アクション提案関数
CREATE OR REPLACE FUNCTION submit_external_place_action(
  p_share_token TEXT DEFAULT NULL,
  p_invitation_code TEXT DEFAULT NULL,
  p_action_type TEXT,
  p_proposed_data JSONB,
  p_session_id TEXT,
  p_proposer_info JSONB DEFAULT NULL,
  p_original_place_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_trip_id UUID;
  v_share_id UUID;
  v_invitation_id UUID;
  v_action_id UUID;
  v_permissions JSONB;
BEGIN
  -- 共有ソース特定とtrip_id取得
  IF p_share_token IS NOT NULL THEN
    SELECT ts.id, ts.trip_id, ts.permissions 
    INTO v_share_id, v_trip_id, v_permissions
    FROM trip_shares ts
    WHERE ts.share_token = p_share_token
      AND ts.is_active = true
      AND (ts.expires_at IS NULL OR ts.expires_at > NOW());
  ELSIF p_invitation_code IS NOT NULL THEN
    SELECT ic.id, ic.trip_id, ic.permissions 
    INTO v_invitation_id, v_trip_id, v_permissions
    FROM invitation_codes ic
    WHERE ic.code = p_invitation_code
      AND ic.is_active = true
      AND (ic.expires_at IS NULL OR ic.expires_at > NOW());
  END IF;
  
  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired share link';
  END IF;
  
  -- 権限チェック
  IF p_action_type = 'add' AND NOT (v_permissions->>'can_add_places')::boolean THEN
    RAISE EXCEPTION 'No permission to add places';
  END IF;
  
  IF p_action_type = 'edit' AND NOT (v_permissions->>'can_edit_places')::boolean THEN
    RAISE EXCEPTION 'No permission to edit places';
  END IF;
  
  IF p_action_type = 'comment' AND NOT (v_permissions->>'can_comment')::boolean THEN
    RAISE EXCEPTION 'No permission to comment';
  END IF;
  
  -- アクション記録
  INSERT INTO pending_place_actions (
    share_id, invitation_id, trip_id, action_type, 
    original_place_id, proposed_data, proposed_by_session,
    proposer_info, ip_address, user_agent
  ) VALUES (
    v_share_id, v_invitation_id, v_trip_id, p_action_type,
    p_original_place_id, p_proposed_data, p_session_id,
    p_proposer_info, p_ip_address, p_user_agent
  ) RETURNING id INTO v_action_id;
  
  RETURN v_action_id;
END;
$$ LANGUAGE plpgsql;

-- 統合共有統計取得関数
CREATE OR REPLACE FUNCTION get_unified_share_statistics(p_user_id UUID)
RETURNS TABLE (
  total_shares BIGINT,
  active_shares BIGINT,
  total_accesses BIGINT,
  unique_sessions BIGINT,
  pending_actions BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH share_stats AS (
    SELECT 
      COUNT(*) as share_count,
      COUNT(CASE WHEN ts.is_active = true 
                 AND (ts.expires_at IS NULL OR ts.expires_at > NOW()) 
                 THEN 1 END) as active_count,
      COALESCE(SUM(ts.current_uses), 0) as access_count
    FROM trip_shares ts
    WHERE ts.created_by = p_user_id
  ),
  invitation_stats AS (
    SELECT 
      COUNT(*) as invite_count,
      COUNT(CASE WHEN ic.is_active = true 
                 AND (ic.expires_at IS NULL OR ic.expires_at > NOW()) 
                 THEN 1 END) as active_invite_count,
      COALESCE(SUM(ic.current_uses), 0) as invite_access_count
    FROM invitation_codes ic
    WHERE ic.created_by = p_user_id
  ),
  session_stats AS (
    SELECT COUNT(DISTINCT sal.session_id) as unique_session_count
    FROM share_access_log sal
    LEFT JOIN trip_shares ts ON sal.share_id = ts.id
    LEFT JOIN invitation_codes ic ON sal.invitation_id = ic.id
    WHERE ts.created_by = p_user_id OR ic.created_by = p_user_id
  ),
  action_stats AS (
    SELECT COUNT(*) as pending_action_count
    FROM pending_place_actions ppa
    JOIN trips t ON ppa.trip_id = t.id
    WHERE t.owner_id = p_user_id AND ppa.status = 'pending'
  )
  SELECT 
    (ss.share_count + ins.invite_count)::BIGINT,
    (ss.active_count + ins.active_invite_count)::BIGINT,
    (ss.access_count + ins.invite_access_count)::BIGINT,
    ses.unique_session_count::BIGINT,
    acs.pending_action_count::BIGINT
  FROM share_stats ss, invitation_stats ins, session_stats ses, action_stats acs;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 実行完了メッセージ
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ 統合共有機能データベース拡張が完了しました';
  RAISE NOTICE '📊 拡張されたテーブル: invitation_codes, trips';
  RAISE NOTICE '📊 作成されたテーブル: trip_shares, pending_place_actions, share_access_log';
  RAISE NOTICE '🔐 RLS ポリシーが適用されました';
  RAISE NOTICE '⚡ インデックスが作成されました';
  RAISE NOTICE '🛠 統合共有機能専用関数が追加されました';
  RAISE NOTICE '🎯 Admin権限でのデッドライン管理機能が追加されました';
  RAISE NOTICE '🔄 外部ユーザーアクション承認システムが実装されました';
END;
$$;