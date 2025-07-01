# Google Maps API セキュリティ対策ガイド

## 🔐 実施済みの対策

### 1. APIキーの更新
- ✅ 古いAPIキーを無効化
- ✅ 新しいAPIキーを生成・設定

### 2. セキュリティスクリプトの作成
以下のスクリプトを作成しました：

#### `setup-api-restrictions.sh`
- API使用量制限の設定
- Maps API: 1日1000リクエスト
- Geocoding API: 1日100リクエスト
- Places API: 1日100リクエスト

#### `setup-budget-alert.sh`
- 月額1000円の予算アラート設定
- 50%, 80%, 100%, 120%でメール通知

#### `monitor-api-usage.sh`
- 現在のAPI使用量を確認
- 閾値（80%）を超えた場合に警告表示
- 実行: `./monitor-api-usage.sh`

#### `emergency-stop-apis.sh`
- 緊急時にAPIを即座に無効化
- 二重確認付きで誤操作を防止
- 実行: `./emergency-stop-apis.sh`

#### `security-check.sh`
- APIキーの漏洩チェック
- .gitignoreの設定確認
- Git履歴のスキャン
- 実行: `./security-check.sh`

## 📋 定期的な運用タスク

### 日次タスク
```bash
# API使用量の確認
./monitor-api-usage.sh
```

### 週次タスク
```bash
# セキュリティチェック
./security-check.sh

# Google Cloud Consoleで確認
# https://console.cloud.google.com/apis/credentials?project=lithe-anvil-461717-p8
```

### 月次タスク
- 予算アラートメールの確認
- 異常なアクセスパターンの調査
- APIキーのローテーション検討

## 🚨 緊急時の対応

### APIキーが漏洩した場合
1. 即座に `./emergency-stop-apis.sh` を実行
2. Google Cloud Console でAPIキーを無効化
3. 新しいAPIキーを生成
4. .envファイルを更新
5. アプリケーションを再デプロイ

### 使用量が急増した場合
1. `./monitor-api-usage.sh` で詳細確認
2. アプリケーションログを確認
3. 必要に応じて `./emergency-stop-apis.sh` を実行
4. 原因を調査・対策

## 🛡️ 追加の推奨セキュリティ対策

### 1. APIキーの制限（Google Cloud Console）
- HTTPリファラー制限:
  - `https://*.vercel.app/*`
  - `http://localhost:3000/*`
  - `http://localhost:5173/*`
- API制限: Maps, Geocoding, Places APIのみ

### 2. gitleaksの導入
```bash
# インストール
brew install gitleaks

# スキャン実行
gitleaks detect --config .gitleaks.toml
```

### 3. 環境変数の管理
- 本番環境: Vercelの環境変数設定を使用
- 開発環境: .env.localファイルを使用
- **絶対に.envファイルをGitにコミットしない**

### 4. アクセスログの監視
Google Cloud Logging で以下を監視:
- 異常なリクエスト数
- 不審なリファラー
- エラー率の急増

## 📞 サポート

問題が発生した場合:
1. Google Cloud Support: https://cloud.google.com/support
2. プロジェクトID: `lithe-anvil-461717-p8`
3. 請求アカウント: `01326B-BBDC78-5918F8`