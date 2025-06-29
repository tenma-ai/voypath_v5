# VoyPath Travel Route Optimization App

> 旅行プランニングと最適化のためのマルチユーザー対応WebアプリケーションプラットフォームA multi-user travel planning and route optimization web application platform.

## 概要 (Overview)

VoyPathは、複数ユーザーでの旅行計画を効率的に作成・最適化するためのWebアプリケーションです。各メンバーが行きたい場所を追加し、AI搭載の最適化エンジンが最適なルートを提案します。

VoyPath is a web application for efficiently creating and optimizing travel plans with multiple users. Members can add places they want to visit, and an AI-powered optimization engine suggests optimal routes.

## 主要機能 (Key Features)

### 🗺️ インテリジェント・ルート最適化
- **公平性を考慮した場所選択**: ラウンドロビン方式により全メンバーの希望を均等に反映
- **現実的な移動手段の自動判定**: 距離と地理的制約に基づく交通手段の選択
- **時間制約に基づく場所フィルタリング**: 旅行期間に基づいて実現可能な場所数を自動調整
- **空港自動挿入**: 長距離移動時の最適な空港を自動検出・挿入

### 👥 コラボレーション機能
- **マルチユーザー旅行プラン**: 複数メンバーでの共同旅行計画
- **リアルタイム更新**: Supabase Realtimeによる即座の変更反映
- **招待コードシステム**: 8文字の一意コードによる簡単な参加
- **メンバー専用カラーシステム**: 各メンバーに自動割り当てされる識別カラー

### 🏨 スマート場所管理
- **Google Places API統合**: 豊富な場所データベースとの連携
- **重複場所の自動統合**: 同一地点の複数場所を滞在時間優先で統合
- **カテゴリー別場所管理**: 出発地・目的地・訪問地の明確な分離
- **滞在時間とコスト見積もり**: 場所ごとの詳細な時間・費用計算

### 📊 詳細スケジューリング
- **日別スケジュール生成**: 1日10時間の活動時間を基準とした現実的なスケジュール
- **交通手段別移動時間計算**: 徒歩・車・フライトの現実的な移動時間
- **時間制約遵守**: 旅行期間内での実現可能なプランの自動生成

## 技術スタック (Tech Stack)

### フロントエンド (Frontend)
- **React 18.3**: モダンなコンポーネントベースUI
- **TypeScript**: 型安全な開発環境
- **Vite**: 高速なビルドツール
- **Tailwind CSS**: ユーティリティファーストCSS
- **Zustand**: 軽量状態管理
- **React Router**: SPAルーティング

### バックエンド (Backend)
- **Supabase**: BaaS (Backend as a Service)
- **PostgreSQL**: メインデータベース
- **Row Level Security (RLS)**: セキュアなデータアクセス制御
- **Supabase Edge Functions**: サーバーサイドロジック (Deno)
- **PostGIS**: 地理情報システム拡張

### 外部API (External APIs)
- **Google Places API**: 場所検索・詳細情報
- **Google Maps JavaScript API**: 地図表示・ジオコーディング
- **OpenFlights Database**: 空港データベース

### デプロイメント (Deployment)
- **Vercel**: フロントエンドホスティング
- **Supabase Cloud**: バックエンドインフラ
- **GitHub Actions**: CI/CD

## プロジェクト構造 (Project Structure)

```
voypath_v5/project/
├── src/
│   ├── components/           # Reactコンポーネント
│   │   ├── common/          # 共通コンポーネント
│   │   ├── OptimizationLoadingOverlay.tsx
│   │   ├── OptimizeRouteButton.tsx
│   │   └── ...
│   ├── services/            # ビジネスロジック
│   │   ├── OptimizationSettingsService.ts
│   │   ├── PlaceSearchService.ts
│   │   ├── RealisticRouteCalculator.ts
│   │   └── ...
│   ├── lib/                 # ユーティリティライブラリ
│   │   ├── supabase.ts
│   │   ├── googleMaps.ts
│   │   └── ...
│   ├── store/               # 状態管理
│   │   └── useStore.ts
│   └── utils/               # ヘルパー関数
├── supabase/
│   ├── functions/           # Edge Functions
│   │   ├── optimize-route/  # ルート最適化エンジン
│   │   ├── select-optimal-places/
│   │   └── ...
│   ├── migrations/          # データベース移行
│   └── supabase.sql        # スキーマ定義
└── tests/                   # テスト
    ├── integration/
    ├── performance/
    └── ...
```

## 最適化アルゴリズム (Optimization Algorithm)

### 1. 希望度正規化 (Preference Normalization)
各ユーザーの希望度を平均値で正規化し、ユーザー間の評価基準の違いを補正

### 2. 公平性重視の場所選択 (Fair Place Selection)
```typescript
// ラウンドロビン方式による公平な場所選択
for (round = 0; selectedPlaces.length < maxPlaces; round++) {
  for (user of users) {
    if (user.hasRemainingPlaces() && selectedPlaces.length < maxPlaces) {
      selectedPlaces.push(user.getNextHighestRatedPlace());
    }
  }
}
```

### 3. TSP（巡回セールスマン問題）の簡略化
貪欲法による近似解を使用し、現実的な時間での計算を実現

### 4. 現実的制約の適用
- 距離ベースの交通手段判定
- 島嶼部への飛行機移動の強制
- 1日の活動時間制限（10時間）

## セットアップとインストール (Setup & Installation)

### 前提条件 (Prerequisites)
- Node.js 18+
- npm または yarn
- Supabaseアカウント
- Google Cloud Platformアカウント（Maps API用）

### インストール手順 (Installation Steps)

1. **リポジトリのクローン**
```bash
git clone <repository-url>
cd voypath_v5/project
```

2. **依存関係のインストール**
```bash
npm install
```

3. **環境変数の設定**
```bash
cp .env.example .env.local
```

必要な環境変数:
```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

4. **データベースのセットアップ**
```bash
# Supabase CLIを使用
supabase start
supabase db reset
```

5. **開発サーバーの起動**
```bash
npm run dev
```

### テストの実行 (Running Tests)
```bash
# 単体テスト
npm run test

# 統合テスト
npm run test:integration

# パフォーマンステスト
npm run test:performance

# カバレッジレポート
npm run test:coverage
```

## データベース設計 (Database Design)

### 主要テーブル (Core Tables)

#### trips
旅行の基本情報
- 出発地・目的地・期間
- 最適化設定・制約条件
- メンバー数・場所数の統計

#### places
訪問場所の詳細情報
- Google Places APIデータ
- 希望度・滞在時間・コスト
- 最適化結果への選択状況

#### trip_members
旅行メンバーの管理
- 権限設定・参加日時
- 専用カラー・ニックネーム
- 個人設定・希望

#### optimization_results
最適化結果の保存
- 日別スケジュール
- スコア詳細・実行時間
- アクティブ状態の管理

### RLS (Row Level Security)
全テーブルでRLSを有効化し、ユーザーは自分が参加する旅行のデータのみアクセス可能

## パフォーマンス最適化 (Performance Optimization)

### キャッシュ戦略
- **Google Places APIキャッシュ**: 30日間の結果保存
- **ジオコーディングキャッシュ**: 7日間のアドレス変換結果
- **最適化結果キャッシュ**: 場所・設定ハッシュベースのキャッシュ

### データベース最適化
- **複合インデックス**: クエリパターンに最適化されたインデックス
- **パーティショニング**: 大量データへの対応準備
- **定期クリーンアップ**: 期限切れデータの自動削除

## セキュリティ (Security)

### 認証・認可
- **Supabase Auth**: JWT ベースの認証
- **Row Level Security**: データレベルの認可制御
- **ゲストユーザー対応**: 一時的なアクセス許可

### データ保護
- **入力検証**: 全ユーザー入力の厳密な検証
- **SQL インジェクション対策**: パラメータ化クエリの徹底
- **XSS 対策**: React の自動エスケープ機能

## ライセンス (License)

このプロジェクトは MIT ライセンスの下で公開されています。

---
*Last updated: 2025-06-29*