# Google Auth + Stripe + 共有機能統合実装計画（Supabase版）

## 📋 Phase 1: Google Auth実装（Supabase統合）

### Step 1.1: Google Cloud Console設定
**User Action Required:**
1. [Google Cloud Console](https://console.cloud.google.com)にログイン
2. 新規プロジェクト作成または既存プロジェクト選択
3. APIs & Services → Credentials
4. OAuth 2.0 Client IDを作成:
   - Application type: Web application
   - Authorized JavaScript origins: `http://localhost:8080`, `http://localhost:3000`
   - Authorized redirect URIs: 
     - `http://localhost:8080/auth/callback`
     - `https://rdufxwoeneglyponagdz.supabase.co/auth/v1/callback`
5. Client IDとClient Secretを取得

### Step 1.2: Supabase Auth Provider設定
**User Action Required:**
1. [Supabase Dashboard](https://supabase.com/dashboard/project/rdufxwoeneglyponagdz) にアクセス
2. Authentication → Providers → Google
3. 「Enable Google provider」をオン
4. Client ID: 【Step 1.1で取得したClient ID】を入力
5. Client Secret: 【Step 1.1で取得したClient Secret】を入力
6. 「Save」をクリック

### Step 1.3: 必要パッケージインストール
```bash
npm install @supabase/auth-helpers-react @supabase/auth-helpers-nextjs
npm install @google-cloud/oauth2 googleapis
```

### Step 1.4: 環境変数設定
`.env`ファイル更新（既存Supabase設定活用）:
```env
# 既存Supabase設定（そのまま）
VITE_SUPABASE_URL=https://rdufxwoeneglyponagdz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Google OAuth（新規追加済み）
VITE_GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### Step 1.5: 認証コンポーネント実装（Supabase版）
- `SupabaseAuthProvider.tsx` - Supabase認証プロバイダー
- `GoogleSignIn.tsx` - Supabase Google認証ボタン
- `AuthGuard.tsx` - Supabase認証ガードコンポーネント

### Step 1.6: ユーザーデータ構造設計（既存users テーブル活用）
Supabase既存データベース構造との整合性:
```typescript
interface User {
  id: string;           // Supabase Auth UID (Google連携後)
  email: string;        // Google email（Supabase Authで管理）
  name: string;         // Google display name
  avatar_url?: string;  // Google photo URL（既存フィールド）
  is_guest: boolean;    // false (Google認証ユーザー)
  is_premium: boolean;  // Stripe連携で管理（既存フィールド）
  premium_expires_at?: string; // 既存フィールド
  stripe_customer_id?: string; // 既存フィールド
  stripe_subscription_id?: string; // 既存フィールド
  created_at: string;   // 既存フィールド
  last_active_at?: string; // 既存フィールド
}

// Supabase Auth metadata活用
interface SupabaseUserMetadata {
  avatar_url?: string;
  email?: string;
  email_verified?: boolean;
  full_name?: string;
  iss?: string;
  name?: string;
  picture?: string;
  provider_id?: string;
  sub?: string;
}
```

## 📋 Phase 2: Stripe統合

### Step 2.1: Stripe Dashboard設定
**User Action Required:**
1. [Stripe Dashboard](https://dashboard.stripe.com)にログイン
2. API Keys取得（Test + Live）
3. Product作成:
   - Premium Plan: $9.99/month
   - Features: 無制限旅行、高度最適化、優先サポート
4. Webhook設定: `http://localhost:8080/api/stripe/webhook`

### Step 2.2: Stripe設定
```bash
npm install @stripe/stripe-js stripe
```

環境変数追加:
```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Step 2.3: Stripe統合コンポーネント
- `StripeProvider.tsx` - Stripe Elements プロバイダー
- `PremiumSubscription.tsx` - サブスクリプション管理
- `PaymentForm.tsx` - 支払いフォーム
- `BillingPortal.tsx` - 請求管理ポータル

### Step 2.4: Premium機能定義
```typescript
const PREMIUM_FEATURES = {
  MAX_TRIPS: {
    free: 1,
    premium: Infinity
  },
  OPTIMIZATION_QUALITY: {
    free: 'basic',
    premium: 'advanced'
  },
  FEATURES: {
    free: ['basic_planning', 'simple_optimization'],
    premium: ['unlimited_trips', 'advanced_optimization', 'priority_support', 'offline_maps']
  }
};
```

## 📋 Phase 3: 共有機能実装

### Step 3.1: データベース構造拡張・既存システム統合

⚠️ **重要発見**: 既存のinvitation_codesテーブルが存在しているため、共有機能はこれと統合が必要

```sql
-- 既存invitation_codesテーブルを拡張して共有機能に対応
ALTER TABLE invitation_codes ADD COLUMN IF NOT EXISTS share_type VARCHAR(20) DEFAULT 'member_invite' 
  CHECK (share_type IN ('member_invite', 'view_share', 'collaborate_share'));
ALTER TABLE invitation_codes ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE invitation_codes ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{
  "can_view_places": true,
  "can_add_places": false,
  "can_edit_places": false,
  "can_view_optimization": true,
  "can_optimize": false,
  "can_export": false,
  "can_comment": false,
  "can_join_as_member": true
}'::jsonb;
ALTER TABLE invitation_codes ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ;
ALTER TABLE invitation_codes ADD COLUMN IF NOT EXISTS access_log JSONB DEFAULT '[]'::jsonb;

-- OR create new trip_shares table for external sharing (non-member)
CREATE TABLE trip_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  share_token VARCHAR(32) UNIQUE NOT NULL, -- URL短縮用ランダムトークン
  share_type VARCHAR(20) NOT NULL CHECK (share_type IN ('external_view', 'external_collaborate')),
  
  -- アクセス制御
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  max_uses INTEGER, -- 使用回数制限
  current_uses INTEGER DEFAULT 0,
  
  -- パスワード保護
  password_hash TEXT, -- bcrypt ハッシュ
  
  -- 権限設定（外部ユーザー向け - メンバー参加は不可）
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
```

### Step 3.2: 統合された共有システム設計

```typescript
// 共有タイプの明確な分類
type ShareType = 
  | 'member_invite'        // 既存: メンバー招待（trip_membersに参加）
  | 'external_view'        // 新規: 外部閲覧専用
  | 'external_collaborate' // 新規: 外部共同編集（一時的なアクション権限）

interface ShareLink {
  id: string;
  tripId: string;
  token: string; // invitation_codes.code または trip_shares.share_token
  type: ShareType;
  isActive: boolean;
  expiresAt?: Date;
  maxUses?: number;
  currentUses: number;
  passwordHash?: string;
  permissions: SharePermissions;
  createdBy: string;
}

interface SharePermissions {
  // 閲覧権限
  canViewPlaces: boolean;
  canViewOptimization: boolean;
  canExport: boolean;
  
  // アクション権限（外部ユーザー向け）
  canAddPlaces: boolean;          // 一時的な場所追加
  canEditPlaces: boolean;         // 一時的な場所編集
  canComment: boolean;            // コメント投稿
  canOptimize: boolean;           // 最適化実行
  
  // メンバーシップ権限
  canJoinAsMember: boolean;       // メンバーとして参加可能
  
  // Admin専用設定（既存メンバーのみ）
  canSetDeadlines: boolean;       // add_place_deadline設定
  canManageMembers: boolean;      // メンバー管理
  canDeleteTrip: boolean;         // 旅行削除
  canChangeSettings: boolean;     // 旅行設定変更
}
```

### Step 3.3: Admin/Member権限詳細設計

```typescript
// 既存のtrip_membersテーブル権限を活用
interface MemberPermissions {
  // 既存フィールド（データベースから取得）
  role: 'admin' | 'member';
  can_add_places: boolean;
  can_edit_places: boolean;
  can_optimize: boolean;
  can_invite_members: boolean;
  
  // 拡張Admin権限（roleベースで自動判定）
  canSetDeadlines: boolean;        // trips.add_place_deadline設定
  canManageMembers: boolean;       // trip_members操作
  canDeleteTrip: boolean;          // 旅行削除（ownerのみ）
  canChangeSettings: boolean;      // optimization_preferences等
  canCreateShares: boolean;        // 共有リンク作成
  canManageShares: boolean;        // 共有リンク管理・削除
}

// 権限チェック関数
const getMemberPermissions = (member: TripMember, trip: Trip): MemberPermissions => {
  const isOwner = member.user_id === trip.owner_id;
  const isAdmin = member.role === 'admin' || isOwner;
  
  return {
    role: member.role,
    can_add_places: member.can_add_places,
    can_edit_places: member.can_edit_places,
    can_optimize: member.can_optimize,
    can_invite_members: member.can_invite_members,
    
    // Admin専用権限
    canSetDeadlines: isAdmin,
    canManageMembers: isAdmin,
    canDeleteTrip: isOwner,
    canChangeSettings: isAdmin,
    canCreateShares: isAdmin || member.can_invite_members,
    canManageShares: isAdmin
  };
};
```

### Step 3.4: 共有コンポーネント実装
- `ShareTripModal.tsx` - 共有設定モーダル（Admin/Member権限対応）
- `ShareLinkGenerator.tsx` - リンク生成・管理
- `SharedTripView.tsx` - 共有ビューページ（外部ユーザー向け）
- `MemberAccessGuard.tsx` - メンバー権限制御
- `ExternalShareGuard.tsx` - 外部共有アクセス制御
- `ShareAnalytics.tsx` - アクセス解析（Admin専用）

### Step 3.5: 共有URL構造
```
// メンバー招待（既存システム拡張）
https://voypath.app/invite/{invitation_code}
https://voypath.app/invite/{invitation_code}?pwd=true

// 外部共有（新規システム）
https://voypath.app/shared/{share_token}
https://voypath.app/shared/{share_token}?pwd=true
https://voypath.app/shared/{share_token}/places (場所一覧)
https://voypath.app/shared/{share_token}/map (地図表示)
https://voypath.app/shared/{share_token}/schedule (スケジュール)
```

## 📋 Phase 4: Supabaseデータベース統合

### Step 4.1: 既存Supabaseテーブル活用
```sql
-- 既存テーブル構造（MCPで確認済み）
users               -- ユーザー情報（認証済みユーザー）
trips               -- 旅行データ
trip_members        -- メンバー管理（admin/member権限）
places              -- 場所データ
invitation_codes    -- 招待コード（拡張済み）

-- 新規追加テーブル（ENHANCED_SHARING_DATABASE_EXTENSION.sql）
trip_shares         -- 外部共有リンク
pending_place_actions -- 外部ユーザーアクション承認
share_access_log    -- 統合アクセス履歴
```

### Step 4.2: Supabase統合戦略
1. **既存データ活用**: users, trips, trip_members テーブル継続使用
2. **拡張機能追加**: 共有機能テーブルをMCPで管理
3. **リアルタイム機能**: Supabase Realtime活用
4. **権限管理**: 既存RLS + 新規共有権限ポリシー

## 📋 Phase 5: 機能統合・テスト

### Step 5.1: Supabase認証フロー統合
- App.tsx の認証ロジック書き換え（Supabase Auth使用）
- useStore.ts の認証状態管理更新（Supabase session管理）
- 全コンポーネントの認証チェック追加（useUser hook活用）
- 共有アクセス時の認証バイパス実装（匿名アクセス対応）

```typescript
// Supabase認証統合例
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react';

const useAuth = () => {
  const user = useUser();
  const supabase = useSupabaseClient();
  
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
    if (error) throw error;
  };
  
  return { user, signInWithGoogle };
};
```

### Step 5.2: Premium機能実装
```typescript
const PREMIUM_FEATURES = {
  SHARING: {
    free: {
      maxActiveShares: 2,
      hasPasswordProtection: false,
      hasExpiryControl: false,
      hasAnalytics: false,
      maxViewsPerShare: 100
    },
    premium: {
      maxActiveShares: Infinity,
      hasPasswordProtection: true,
      hasExpiryControl: true,
      hasAnalytics: true,
      maxViewsPerShare: Infinity,
      customDomains: true,
      embedCode: true
    }
  }
};
```

### Step 5.3: 共有機能とPremium連携
- 無料ユーザー: 基本共有のみ
- Premiumユーザー: 高度な共有機能
- 共有経由での Premium 転換促進

### Step 5.4: 課金フロー実装
- サブスクリプション開始
- 支払い失敗処理
- プラン変更・キャンセル
- 共有機能制限の適用

## 🔄 実装順序（Supabase版）

### Week 1: 基盤構築
1. Google Cloud Console設定
2. Supabase Google認証設定
3. 基本認証コンポーネント実装（Supabase版）
4. 認証フロー動作確認
4. 共有機能データベース設計

### Week 2: 認証・共有基盤
1. Google Auth完全実装
2. 共有リンク生成機能
3. 基本共有ページ実装
4. アクセス制御実装

### Week 3: Stripe統合・Premium共有
1. Stripe Dashboard 設定
2. 課金コンポーネント実装
3. Premium共有機能実装
4. 制限機能実装

### Week 4: 統合・最適化
1. 全機能統合テスト
2. 共有分析機能実装
3. エラーハンドリング強化
4. パフォーマンス最適化

### Week 5: デプロイ・運用
1. 本番環境設定
2. ドメイン・SSL設定
3. 本番デプロイ
4. 監視・ログ設定

## ⚠️ 重要な注意点

### セキュリティ
- API キーの環境変数管理
- Firebase Security Rules 設定
- Stripe Webhook 署名検証
- **共有リンクのトークン生成セキュリティ**
- **共有アクセスの Rate Limiting**
- **パスワード保護の bcrypt ハッシュ化**

### 共有機能セキュリティ
```typescript
// 安全なトークン生成
const generateShareToken = (): string => {
  return crypto.randomBytes(16).toString('hex'); // 32文字
};

// アクセス制御
const validateShareAccess = async (token: string, permissions: string[]) => {
  // 1. トークン有効性チェック
  // 2. 有効期限チェック  
  // 3. 使用回数制限チェック
  // 4. 権限チェック
  // 5. Rate Limiting チェック
};
```

### ユーザビリティ
- 認証エラー時の分かりやすいメッセージ
- 支払い失敗時の適切な案内
- 共有リンクの分かりやすい権限説明
- モバイル対応の共有UI

### 法的要件
- 利用規約・プライバシーポリシー
- GDPR/CCPA 対応
- 返金ポリシー
- **共有データの取り扱い方針**

## 📊 成功指標

### 認証・課金
1. **認証成功率**: 95%以上
2. **支払い完了率**: 90%以上  
3. **Premium転換率**: 5%以上

### 共有機能
4. **共有リンク作成率**: 30%以上（全旅行作成者中）
5. **共有経由でのアプリ利用開始率**: 15%以上
6. **共有からPremium転換率**: 8%以上
7. **共有リンクの平均アクセス数**: 10回以上

### 全体
8. **ユーザー満足度**: 4.5/5以上
9. **月間アクティブユーザー**: 前月比120%以上
10. **平均セッション時間**: 15分以上

## 🛠 必要ツール・リソース

### 開発環境
- Google Cloud Console アクセス
- Firebase Console アクセス
- Stripe Dashboard アクセス
- 開発環境 (Node.js 18+)
- テスト用クレジットカード情報

### 共有機能専用
- URL短縮サービス（オプション）
- アクセス解析ツール（Google Analytics等）
- 画像・動画共有用CDN
- Push通知サービス（共有通知用）

### データベース拡張
```sql
-- 既存Supabaseに追加するSQL
\i /path/to/sharing_tables.sql
```

### 新規パッケージ
```bash
npm install bcryptjs qrcode html2canvas
npm install @types/bcryptjs @types/qrcode
```

## 🚀 即座に開始可能なTask（Supabase版）

1. **Google Cloud Console でOAuth設定**（5分）
2. **Supabase Google認証プロバイダー設定**（5分）  
3. **Stripe アカウント作成・設定**（15分）
4. **共有機能データベーステーブル作成**（10分）

**User Action Required**: 上記4つの設定を完了してください。設定完了後、実装を開始できます！

## 📊 **Supabase版の利点**

### ✅ **Claude Code MCP完全対応**
- データベース操作: `mcp__supabase__execute_sql`
- テーブル管理: `mcp__supabase__list_tables`
- 認証管理: `mcp__supabase__*` 各種機能

### ✅ **既存システム活用**
- 既存users/trips/trip_membersテーブル継続使用
- 既存Google Maps/Stripe設定も活用
- 段階的な機能拡張が可能

### ✅ **シンプルな設定**
- Firebase不要（設定ステップ削減）
- 既存Supabaseプロジェクト活用
- 環境変数最小限

## 📋 Phase 6: 外部ユーザーアクション機能詳細実装

### Step 6.0: 外部共有時の Place 追加・編集機能

```typescript
// 外部ユーザーによる場所追加のフロー
interface ExternalPlaceAction {
  shareId: string;                    // 共有リンクID
  temporaryUserId: string;            // セッション固有のID
  actionType: 'add' | 'edit' | 'comment';
  placeData: PartialPlace;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

// 一時的な場所データ（承認待ち状態）
interface PendingPlaceAction {
  id: string;
  shareId: string;
  originalPlaceId?: string;           // 編集の場合
  actionType: 'add' | 'edit' | 'comment';
  proposedData: {
    name: string;
    address: string;
    latitude?: number;
    longitude?: number;
    category: string;
    wish_level: number;
    stay_duration_minutes: number;
    notes?: string;
    proposed_by_session: string;      // セッションID
  };
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;                // trip member user_id
}

// 承認フロー
class ExternalActionApprovalService {
  async submitPlaceAction(
    shareToken: string, 
    action: ExternalPlaceAction
  ): Promise<PendingPlaceAction> {
    // 1. 共有権限確認
    const shareData = await this.validateSharePermissions(shareToken, action.actionType);
    
    // 2. 一時データとして保存
    const pendingAction = await this.savePendingAction(shareData.tripId, action);
    
    // 3. Trip adminに通知
    await this.notifyTripAdmins(shareData.tripId, pendingAction);
    
    return pendingAction;
  }
  
  async approvePendingAction(
    actionId: string, 
    reviewerUserId: string
  ): Promise<void> {
    // 1. 権限確認（adminまたはowner）
    const action = await this.getPendingAction(actionId);
    await this.validateReviewerPermissions(action.tripId, reviewerUserId);
    
    // 2. 実際のPlaceデータに反映
    if (action.actionType === 'add') {
      await this.createPlaceFromPending(action);
    } else if (action.actionType === 'edit') {
      await this.updatePlaceFromPending(action);
    }
    
    // 3. 承認状態更新
    await this.updateActionStatus(actionId, 'approved', reviewerUserId);
    
    // 4. 外部ユーザーに承認通知（もし可能なら）
    await this.notifyExternalUser(action);
  }
}
```

### Step 6.1: Admin権限機能詳細実装

```typescript
// Admin専用のDeadline管理機能
interface TripDeadlineSettings {
  addPlaceDeadline?: Date;            // 既存フィールド
  editPlaceDeadline?: Date;           // 新規追加
  optimizationDeadline?: Date;        // 新規追加
  memberJoinDeadline?: Date;          // 新規追加
  
  // デッドライン通知設定
  deadlineNotifications: {
    enabled: boolean;
    notifyBefore: number[];           // [1日前, 3時間前] など
    notifyMembers: boolean;
    notifyExternalUsers: boolean;
  };
}

class AdminDeadlineService {
  async setTripDeadlines(
    tripId: string, 
    adminUserId: string, 
    deadlines: TripDeadlineSettings
  ): Promise<void> {
    // 1. Admin権限確認
    await this.validateAdminPermissions(tripId, adminUserId);
    
    // 2. デッドライン設定
    await this.updateTripDeadlines(tripId, deadlines);
    
    // 3. 通知設定
    if (deadlines.deadlineNotifications.enabled) {
      await this.scheduleDeadlineNotifications(tripId, deadlines);
    }
    
    // 4. メンバーに変更通知
    await this.notifyDeadlineChanges(tripId, deadlines);
  }
  
  async validateActionAgainstDeadlines(
    tripId: string, 
    actionType: 'add_place' | 'edit_place' | 'optimize' | 'join_member'
  ): Promise<boolean> {
    const deadlines = await this.getTripDeadlines(tripId);
    const now = new Date();
    
    switch (actionType) {
      case 'add_place':
        return !deadlines.addPlaceDeadline || now <= deadlines.addPlaceDeadline;
      case 'edit_place':
        return !deadlines.editPlaceDeadline || now <= deadlines.editPlaceDeadline;
      case 'optimize':
        return !deadlines.optimizationDeadline || now <= deadlines.optimizationDeadline;
      case 'join_member':
        return !deadlines.memberJoinDeadline || now <= deadlines.memberJoinDeadline;
      default:
        return true;
    }
  }
}

// Member権限でのアクション制御
class MemberActionService {
  async canPerformAction(
    tripId: string, 
    userId: string, 
    actionType: string
  ): Promise<PermissionCheckResult> {
    // 1. メンバー権限取得
    const member = await this.getTripMember(tripId, userId);
    if (!member) {
      return { allowed: false, reason: 'NOT_MEMBER' };
    }
    
    // 2. デッドライン確認
    const deadlineOk = await this.deadlineService.validateActionAgainstDeadlines(
      tripId, 
      actionType as any
    );
    if (!deadlineOk) {
      return { allowed: false, reason: 'DEADLINE_PASSED' };
    }
    
    // 3. 個別権限確認
    const permissions = getMemberPermissions(member, trip);
    
    switch (actionType) {
      case 'add_place':
        return { 
          allowed: permissions.can_add_places, 
          reason: permissions.can_add_places ? null : 'NO_ADD_PERMISSION' 
        };
      case 'edit_place':
        return { 
          allowed: permissions.can_edit_places, 
          reason: permissions.can_edit_places ? null : 'NO_EDIT_PERMISSION' 
        };
      case 'optimize':
        return { 
          allowed: permissions.can_optimize, 
          reason: permissions.can_optimize ? null : 'NO_OPTIMIZE_PERMISSION' 
        };
      default:
        return { allowed: false, reason: 'UNKNOWN_ACTION' };
    }
  }
}
```

## 📋 Phase 7: 共有機能詳細実装計画

### Step 6.1: フロントエンド共有コンポーネント実装

#### ShareTripModal.tsx
```tsx
interface ShareTripModalProps {
  tripId: string;
  isOpen: boolean;
  onClose: () => void;
}

const ShareTripModal: React.FC<ShareTripModalProps> = ({ tripId, isOpen, onClose }) => {
  const [shareType, setShareType] = useState<'view' | 'collaborate'>('view');
  const [hasPassword, setHasPassword] = useState(false);
  const [expiryDays, setExpiryDays] = useState<number | null>(null);
  const [maxUses, setMaxUses] = useState<number | null>(null);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  
  // 共有リンク生成・管理ロジック
  const generateShareLink = async () => {
    const permissions = getPermissionsByType(shareType);
    const shareData = {
      tripId,
      type: shareType,
      permissions,
      passwordProtected: hasPassword,
      expiresAt: expiryDays ? addDays(new Date(), expiryDays) : null,
      maxUses
    };
    
    const newShare = await shareService.createShareLink(shareData);
    setShareLinks([...shareLinks, newShare]);
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {/* 共有設定UI */}
      <div className="space-y-6">
        {/* 共有タイプ選択 */}
        <div>
          <h3>共有タイプ</h3>
          <RadioGroup value={shareType} onChange={setShareType}>
            <Radio value="view">閲覧のみ</Radio>
            <Radio value="collaborate">共同編集</Radio>
          </RadioGroup>
        </div>
        
        {/* Premium機能（有料ユーザーのみ） */}
        {isPremiumUser && (
          <>
            <div>
              <Checkbox checked={hasPassword} onChange={setHasPassword}>
                パスワード保護
              </Checkbox>
            </div>
            
            <div>
              <label>有効期限</label>
              <Select value={expiryDays} onChange={setExpiryDays}>
                <Option value={null}>無制限</Option>
                <Option value={1}>1日</Option>
                <Option value={7}>1週間</Option>
                <Option value={30}>1ヶ月</Option>
              </Select>
            </div>
            
            <div>
              <label>最大アクセス数</label>
              <Input
                type="number"
                value={maxUses || ''}
                onChange={(e) => setMaxUses(e.target.value ? parseInt(e.target.value) : null)}
                placeholder="無制限"
              />
            </div>
          </>
        )}
        
        <Button onClick={generateShareLink}>
          共有リンクを生成
        </Button>
        
        {/* 既存の共有リンク一覧 */}
        <div>
          <h4>作成済み共有リンク</h4>
          {shareLinks.map(link => (
            <ShareLinkItem key={link.id} link={link} />
          ))}
        </div>
      </div>
    </Modal>
  );
};
```

#### SharedTripView.tsx
```tsx
const SharedTripView: React.FC = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [isPasswordRequired, setIsPasswordRequired] = useState(false);
  const [password, setPassword] = useState('');
  
  useEffect(() => {
    loadSharedTrip();
  }, [shareToken]);
  
  const loadSharedTrip = async () => {
    try {
      const result = await shareService.getSharedTrip(shareToken!);
      
      if (result.requiresPassword) {
        setIsPasswordRequired(true);
        return;
      }
      
      setShareData(result.data);
      
      // アクセス記録
      shareService.recordAccess(shareToken!, {
        ipAddress: await getClientIP(),
        userAgent: navigator.userAgent,
        referer: document.referrer
      });
      
    } catch (error) {
      // エラーハンドリング（期限切れ、無効なリンク等）
      handleShareError(error);
    }
  };
  
  const handlePasswordSubmit = async () => {
    try {
      const result = await shareService.authenticateShare(shareToken!, password);
      setShareData(result.data);
      setIsPasswordRequired(false);
    } catch (error) {
      // パスワード認証エラー
      handlePasswordError(error);
    }
  };
  
  if (isPasswordRequired) {
    return <PasswordPrompt onSubmit={handlePasswordSubmit} />;
  }
  
  if (!shareData) {
    return <LoadingSpinner />;
  }
  
  return (
    <div className="shared-trip-view">
      {/* 共有専用ヘッダー */}
      <SharedTripHeader 
        tripData={shareData.trip}
        permissions={shareData.permissions}
      />
      
      {/* 共有コンテンツ */}
      <div className="shared-content">
        {shareData.permissions.can_view_places && (
          <SharedPlacesList 
            places={shareData.places}
            canAdd={shareData.permissions.can_add_places}
            canEdit={shareData.permissions.can_edit_places}
            canComment={shareData.permissions.can_comment}
          />
        )}
        
        {shareData.permissions.can_view_optimization && (
          <SharedOptimizationResult 
            result={shareData.optimizationResult}
            canOptimize={shareData.permissions.can_optimize}
          />
        )}
        
        {shareData.permissions.can_export && (
          <SharedExportOptions tripData={shareData.trip} />
        )}
      </div>
      
      {/* アプリ導入促進 */}
      <SharedTripFooter />
    </div>
  );
};
```

### Step 6.2: バックエンド共有サービス実装

#### ShareService.ts
```typescript
class ShareService {
  // 共有リンク生成
  async createShareLink(shareData: CreateShareRequest): Promise<ShareLink> {
    const token = this.generateSecureToken();
    const passwordHash = shareData.password ? 
      await bcrypt.hash(shareData.password, 12) : null;
    
    const share: ShareLink = {
      id: uuid(),
      tripId: shareData.tripId,
      token,
      type: shareData.type,
      permissions: shareData.permissions,
      passwordHash,
      expiresAt: shareData.expiresAt,
      maxUses: shareData.maxUses,
      currentUses: 0,
      isActive: true,
      createdBy: shareData.userId,
      createdAt: new Date()
    };
    
    // データベースに保存
    await this.supabase
      .from('trip_shares')
      .insert(share);
    
    return share;
  }
  
  // 共有データ取得
  async getSharedTrip(token: string): Promise<SharedTripData> {
    const { data: share } = await this.supabase
      .from('trip_shares')
      .select(`
        *,
        trips:trip_id (
          id, name, description, created_at,
          places (*),
          optimization_results (*)
        )
      `)
      .eq('share_token', token)
      .eq('is_active', true)
      .single();
    
    if (!share) {
      throw new Error('Invalid or expired share link');
    }
    
    // 使用制限チェック
    if (this.isShareExpired(share)) {
      throw new Error('Share link has expired');
    }
    
    // パスワード保護チェック
    if (share.password_hash) {
      return {
        requiresPassword: true,
        shareId: share.id
      };
    }
    
    return {
      shareId: share.id,
      trip: share.trips,
      permissions: share.permissions,
      places: share.trips.places,
      optimizationResult: share.trips.optimization_results[0]
    };
  }
  
  // アクセス記録
  async recordAccess(token: string, accessInfo: AccessInfo): Promise<void> {
    // record_share_access関数を呼び出し
    await this.supabase.rpc('record_share_access', {
      p_share_token: token,
      p_ip_address: accessInfo.ipAddress,
      p_user_agent: accessInfo.userAgent,
      p_referer: accessInfo.referer,
      p_user_id: accessInfo.userId || null
    });
  }
  
  // 統計取得
  async getShareStatistics(userId: string): Promise<ShareStatistics> {
    const { data } = await this.supabase.rpc('get_share_statistics', {
      p_user_id: userId
    });
    
    return data[0];
  }
  
  private generateSecureToken(): string {
    return crypto.randomBytes(16).toString('hex');
  }
  
  private isShareExpired(share: ShareLink): boolean {
    if (share.expiresAt && new Date() > new Date(share.expiresAt)) {
      return true;
    }
    
    if (share.maxUses && share.currentUses >= share.maxUses) {
      return true;
    }
    
    return false;
  }
}
```

### Step 6.3: ルーティング・ナビゲーション更新

#### App.tsx 更新
```tsx
// 新しいルート追加
const router = createBrowserRouter([
  // 既存ルート...
  
  // 共有専用ルート
  {
    path: '/shared/:shareToken',
    element: <SharedTripView />,
    errorBoundary: ShareErrorBoundary
  },
  {
    path: '/shared/:shareToken/places',
    element: <SharedPlacesView />
  },
  {
    path: '/shared/:shareToken/map',
    element: <SharedMapView />
  },
  {
    path: '/shared/:shareToken/schedule',
    element: <SharedScheduleView />
  },
  
  // 共有管理ページ
  {
    path: '/my-shares',
    element: <MySharesPage />,
    loader: requireAuth
  }
]);
```

### Step 6.4: Premium連携・制限機能

#### ShareLimitChecker.ts
```typescript
class ShareLimitChecker {
  async canCreateShare(userId: string): Promise<CanCreateShareResult> {
    const user = await this.getUser(userId);
    const currentShares = await this.getCurrentShareCount(userId);
    
    const limits = user.isPremium ? 
      PREMIUM_SHARE_LIMITS : 
      FREE_SHARE_LIMITS;
    
    if (currentShares >= limits.maxActiveShares) {
      return {
        canCreate: false,
        reason: 'LIMIT_EXCEEDED',
        upgradeRequired: !user.isPremium,
        currentCount: currentShares,
        maxCount: limits.maxActiveShares
      };
    }
    
    return {
      canCreate: true,
      availableFeatures: this.getAvailableFeatures(user.isPremium)
    };
  }
}
```

### Step 6.5: SEO・OGP対応

#### SharedTripSEO.tsx
```tsx
const SharedTripSEO: React.FC<{ tripData: TripData }> = ({ tripData }) => {
  const ogImageUrl = generateTripOGImage(tripData);
  
  return (
    <Helmet>
      <title>{tripData.name} - Voypath で共有された旅行プラン</title>
      <meta name="description" content={`${tripData.description} - Voypath で作成された旅行プランを見る`} />
      
      {/* OGP */}
      <meta property="og:title" content={`${tripData.name} - 旅行プラン`} />
      <meta property="og:description" content={tripData.description} />
      <meta property="og:image" content={ogImageUrl} />
      <meta property="og:type" content="website" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={`${tripData.name} - 旅行プラン`} />
      <meta name="twitter:description" content={tripData.description} />
      <meta name="twitter:image" content={ogImageUrl} />
      
      {/* Schema.org */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "TravelPlan",
          "name": tripData.name,
          "description": tripData.description,
          "itinerary": tripData.places.map(place => ({
            "@type": "Place",
            "name": place.name,
            "address": place.address
          }))
        })}
      </script>
    </Helmet>
  );
};
```

### Step 6.6: モバイル最適化・PWA対応

#### SharedTripPWA設定
```typescript
// PWA manifest更新
const pwaManifest = {
  // 既存設定...
  
  // 共有機能用ショートカット
  shortcuts: [
    {
      name: "新しい旅行を作成",
      short_name: "新規作成",
      description: "新しい旅行プランを作成する",
      url: "/create-trip",
      icons: [{ src: "/icons/create-trip.png", sizes: "96x96", type: "image/png" }]
    },
    {
      name: "共有リンクを管理",
      short_name: "共有管理",
      description: "作成した共有リンクを管理する",
      url: "/my-shares",
      icons: [{ src: "/icons/share-manage.png", sizes: "96x96", type: "image/png" }]
    }
  ],
  
  // 共有機能対応
  share_target: {
    action: "/shared/receive",
    method: "GET",
    params: {
      url: "shared_url"
    }
  }
};
```

## 📋 Phase 7: 統合・テスト・最適化

### Step 7.1: E2Eテスト実装
```typescript
// 共有機能E2Eテスト
describe('Share Functionality', () => {
  it('should create and access share link', async ({ page }) => {
    // 1. ログイン・旅行作成
    await loginAsUser(page, 'test@example.com');
    await createTestTrip(page);
    
    // 2. 共有リンク生成
    await page.click('[data-testid="share-button"]');
    await page.selectOption('[data-testid="share-type"]', 'view');
    await page.click('[data-testid="generate-link"]');
    
    const shareUrl = await page.textContent('[data-testid="share-url"]');
    
    // 3. 新しいブラウザコンテキストで共有リンクアクセス
    const newContext = await browser.newContext();
    const sharedPage = await newContext.newPage();
    await sharedPage.goto(shareUrl);
    
    // 4. 共有コンテンツ確認
    await expect(sharedPage.locator('[data-testid="shared-trip-name"]')).toBeVisible();
    await expect(sharedPage.locator('[data-testid="places-list"]')).toBeVisible();
    
    // 5. 権限制限確認
    await expect(sharedPage.locator('[data-testid="add-place-button"]')).not.toBeVisible();
  });
});
```

### Step 7.2: パフォーマンス最適化
```typescript
// 共有ページ最適化
const SharedTripViewOptimized = React.memo(() => {
  // 必要最小限のデータのみ読み込み
  const { data: shareData } = useSWR(
    `/api/shared/${shareToken}`,
    { 
      revalidateOnFocus: false,
      dedupingInterval: 30000 // 30秒間はキャッシュ使用
    }
  );
  
  // 画像遅延読み込み
  const { ref: imageRef, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true
  });
  
  return (
    <div>
      {/* Critical Above-the-fold content */}
      <SharedTripHeader {...shareData} />
      
      {/* Lazy loaded content */}
      <div ref={imageRef}>
        {inView && <SharedPlaceImages places={shareData.places} />}
      </div>
    </div>
  );
});
```

### Step 7.3: セキュリティ監査・強化
```typescript
// Rate Limiting実装
const shareAccessLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 100, // IP当たり最大100回アクセス
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

// CSRFプロテクション
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

// セキュリティヘッダー
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.voypath.app"]
    }
  }
}));
```

## 🎯 実装完了の成功指標

### 技術指標
- [ ] 共有リンクレスポンス時間 < 500ms
- [ ] SEOスコア > 90点
- [ ] アクセシビリティスコア > 95点
- [ ] PWA Lighthouse スコア > 90点
- [ ] セキュリティ監査 A評価

### ビジネス指標  
- [ ] 共有リンク生成率 > 30%
- [ ] 共有経由アプリ利用開始率 > 15%
- [ ] 共有からPremium転換率 > 8%
- [ ] ユーザー満足度 > 4.5/5

---

**実装準備完了**: データベース拡張SQL、詳細設計、テスト計画がすべて整いました。User Action完了後、即座に開発開始可能です！