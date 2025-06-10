# Voypath Project Rules - 堅牢なAIエージェント開発ガイドライン

## 🚨 CRITICAL FAILSAFE SYSTEM - 破綻防止システム

### 🔒 MANDATORY PRE-IMPLEMENTATION PROTOCOL - 実装前強制プロトコル

**以下の手順を順序通り完全に実行しない限り、いかなる実装も開始してはいけません：**
実装は全て英語で行うこと
#### ステップ1: 必須ファイル確認（REQUIRED FILE VERIFICATION）
```
✅ CHECKPOINT 1: 進捗整理.md の確認
- [ ] ファイルを開いて全内容を読む
- [ ] 現在のフェーズと完了済み機能を把握
- [ ] 既知の課題と制約事項を理解
- [ ] **発言必須**: "進捗整理.mdを確認完了。現在のフェーズは[具体的なフェーズ名]です。"

✅ CHECKPOINT 2: 実装手順.md の確認  
- [ ] ファイルを開いて全内容を読む
- [ ] 次の実装ステップの詳細を把握
- [ ] 依存関係と前提条件を確認
- [ ] **発言必須**: "実装手順.mdを確認完了。次のステップは[具体的なステップ内容]です。"

✅ CHECKPOINT 3: 現在のコードベース状態確認
- [ ] 関連するファイルの現在の状態を確認
- [ ] 既存の実装との整合性を検証
- [ ] **発言必須**: "関連ファイルの現在の状態を確認しました。"
```

#### ステップ2: UI/UX保護確認（UI/UX PROTECTION VERIFICATION）
```
✅ CHECKPOINT 4: UI変更禁止確認
- [ ] 変更予定の内容がバックエンドのみであることを確認
- [ ] フロントエンドコンポーネントに影響しないことを確認
- [ ] CSSやスタイリングに変更がないことを確認
- [ ] **発言必須**: "今回の変更はバックエンドのみで、UI/UXに影響しないことを確認しました。"
```

#### ステップ3: 実装計画策定（IMPLEMENTATION PLANNING）
```
✅ CHECKPOINT 5: 詳細実装計画の作成
- [ ] 変更する具体的なファイルとメソッドをリストアップ
- [ ] 変更の影響範囲を明確化
- [ ] テスト項目を事前に定義
- [ ] ロールバック計画を策定
- [ ] **発言必須**: "実装計画を策定しました。変更対象: [具体的なファイル名とメソッド]"
```

## 🛡️ ERROR LOOP PREVENTION SYSTEM - エラー循環防止システム

### エラー循環検出・防止機構

#### エラー追跡システム
```typescript
interface ErrorTracker {
  errorType: string
  occurredAt: string
  attemptNumber: number
  previousSolutions: string[]
  codeContext: string
}

// エラー循環防止ルール
const ERROR_LOOP_PREVENTION = {
  MAX_ATTEMPTS_PER_ERROR: 3,
  MAX_SIMILAR_ERRORS: 2,
  MANDATORY_BREAK_CONDITIONS: [
    "同じエラーが3回発生",
    "類似エラーが2回発生", 
    "30分以上同じ問題に取り組んでいる"
  ]
}
```

#### 強制停止条件（MANDATORY STOP CONDITIONS）
```
🚨 以下の条件に該当した場合、直ちに実装を停止せよ：

1. **同一エラーが3回発生した場合**
   - 即座に実装を停止
   - エラーログと試行回数を記録
   - ユーザーに状況報告と代替案を提示

2. **類似エラーが2つ以上発生した場合**  
   - 根本的なアプローチの見直しが必要
   - 現在の実装方針を再検討
   - より単純な代替実装を検討

3. **予期しないUI変更が発生した場合**
   - 全ての変更を即座にリバート
   - 変更前の状態に完全復元
   - 原因調査後に再計画
```

#### エラー対応プロトコル
```
エラー発生時の必須手順：

STEP 1: エラー分類
- [ ] 新規エラーか既知エラーかを判定
- [ ] エラーレベル（致命的/警告/情報）を分類
- [ ] **発言必須**: "エラーを検出しました。分類: [エラータイプ]、レベル: [重要度]"

STEP 2: 解決試行記録
- [ ] 試行した解決方法を記録
- [ ] 結果（成功/失敗/部分的成功）を記録
- [ ] **発言必須**: "解決方法[X]を試行しました。結果: [具体的な結果]"

STEP 3: 循環検出
- [ ] 過去の試行と同じ方法でないかチェック
- [ ] エラー回数が上限を超えていないかチェック
- [ ] **条件に該当した場合**: 即座に停止して報告
```

## 🔐 ABSOLUTE UI/UX PROTECTION - 絶対UI/UX保護システム

### UI変更検出・防止システム

#### 保護対象ファイル（PROTECTED FILES）
```
🚨 以下のファイルは絶対に変更禁止：

FRONTEND COMPONENTS:
- /src/components/**/*.tsx
- /src/app/**/*.tsx (page.tsx, layout.tsx等)
- /src/styles/**/*.css
- /tailwind.config.js
- /next.config.js

STYLING & UI:
- globals.css
- component.module.css
- *.scss, *.sass ファイル
- アニメーション関連ファイル

CONFIGURATION:
- package.json (dependencies変更時は事前確認必須)
- tsconfig.json (型設定変更時は事前確認必須)
```

#### UI保護チェックリスト
```
✅ 実装前UI保護確認：
- [ ] 変更対象がバックエンドファイルのみか？
- [ ] データベーススキーマまたはAPI関連か？
- [ ] フロントエンドコンポーネントに触れていないか？
- [ ] CSSやスタイリングに影響しないか？
- [ ] **全てYESの場合のみ実装開始**

✅ 実装中UI保護監視：
- [ ] 変更がSupabaseファイルまたはAPIファイルのみか？
- [ ] 予期しないファイル変更が発生していないか？
- [ ] TypeScriptエラーが新規発生していないか？

✅ 実装後UI保護検証：
- [ ] フロントエンドが正常に表示されるか？
- [ ] 既存の機能が損なわれていないか？
- [ ] レスポンシブデザインが維持されているか？
```

## 📋 PROGRESSIVE IMPLEMENTATION PROTOCOL - 段階的実装プロトコル

### 最小変更原則（MINIMAL CHANGE PRINCIPLE）

#### 実装サイズ制限
```
🎯 1回の実装で変更可能な範囲：

MICRO IMPLEMENTATION (推奨):
- 1つのファイルの1つの関数
- 1つのデータベーステーブルの作成
- 1つのAPIエンドポイントの実装

SMALL IMPLEMENTATION (許可):
- 最大3つの関連ファイル
- 1つの機能の完全実装
- 関連するテストの追加

MEDIUM IMPLEMENTATION (要注意):
- 最大5つのファイル
- 事前に詳細計画必須
- 段階的実装とテストが必要

LARGE IMPLEMENTATION (禁止):
- 6つ以上のファイル変更
- 複数機能の同時実装
- 大規模なリファクタリング
```

#### 段階的実装フロー
```
🔄 IMPLEMENTATION FLOW:

PHASE 1: PREPARATION
1. 必須ファイル確認完了
2. UI保護確認完了  
3. 実装計画策定完了
4. **発言必須**: "実装準備が完了しました。"

PHASE 2: MINIMAL IMPLEMENTATION
1. 最小単位での実装
2. 即座にテスト実行
3. 動作確認完了
4. **発言必須**: "最小実装が完了し、テストに合格しました。"

PHASE 3: VERIFICATION & COMMIT
1. 包括的テスト実行
2. UI/UX影響確認
3. GitHubプッシュ
4. 進捗管理.md更新
5. **発言必須**: "実装が完了し、進捗を更新しました。"

PHASE 4: NEXT STEP PLANNING
1. 次のステップの確認
2. 新たな実装計画の策定
3. **発言必須**: "次のステップの準備が整いました。"
```

## ⚡ COMPREHENSIVE TESTING PROTOCOL - 包括的テストプロトコル

### 必須テストマトリックス

#### 機能テスト（FUNCTIONAL TESTING）
```typescript
// 必須テスト項目
const MANDATORY_TESTS = {
  database: {
    connection: "データベース接続テスト",
    crud: "CRUD操作テスト", 
    schema: "スキーマ整合性テスト",
    rls: "Row Level Security テスト"
  },
  api: {
    endpoints: "APIエンドポイントテスト",
    auth: "認証・認可テスト",
    errors: "エラーハンドリングテスト",
    performance: "パフォーマンステスト"
  },
  integration: {
    frontend: "フロントエンド統合テスト",
    realtime: "リアルタイム機能テスト", 
    stripe: "Stripe連携テスト"
  }
}
```

#### テスト実行チェックリスト
```
✅ LEVEL 1: BASIC TESTS (必須)
- [ ] データベース接続確認
- [ ] 新規実装機能の単体テスト
- [ ] エラーが発生しないことを確認
- [ ] **発言必須**: "基本テストが完了しました。"

✅ LEVEL 2: INTEGRATION TESTS (必須)
- [ ] フロントエンドとの統合テスト
- [ ] 既存機能への影響確認
- [ ] 認証フローの動作確認
- [ ] **発言必須**: "統合テストが完了しました。"

✅ LEVEL 3: UI/UX VERIFICATION (必須)
- [ ] フロントエンド表示確認
- [ ] レスポンシブデザイン確認
- [ ] ユーザー操作フロー確認
- [ ] **発言必須**: "UI/UX検証が完了しました。"

✅ LEVEL 4: PERFORMANCE TESTS (推奨)
- [ ] レスポンス時間測定
- [ ] 同時アクセステスト
- [ ] メモリ使用量確認
```

## 🔧 ROLLBACK & RECOVERY SYSTEM - ロールバック・復旧システム

### 自動復旧メカニズム

#### 失敗時の自動対応
```
🆘 FAILURE RESPONSE PROTOCOL:

IMMEDIATE ACTIONS (自動実行):
1. 全ての変更を即座に停止
2. エラーログの詳細記録
3. 現在の状況をユーザーに報告
4. **発言必須**: "エラーが発生しました。自動復旧を開始します。"

ROLLBACK PROCEDURE:
1. 最後の成功状態への復旧
2. データベース変更のロールバック
3. ファイル変更の取り消し
4. **発言必須**: "ロールバックが完了しました。"

RECOVERY PLANNING:
1. 失敗原因の分析
2. 代替実装方法の提案
3. より安全なアプローチの策定
4. **発言必須**: "復旧計画を策定しました。"
```

#### 緊急停止条件
```
🚨 EMERGENCY STOP CONDITIONS:

CRITICAL FAILURES:
- データベース破損の兆候
- 認証システムの障害
- フロントエンドの完全停止
- セキュリティ脆弱性の発見

AUTOMATIC RESPONSES:
- 全ての変更を即座に停止
- 管理者への緊急通知
- システム状態の完全記録
- 安全な状態への復旧
```

## 📊 PROGRESS TRACKING SYSTEM - 進捗追跡システム

### 強制進捗記録

#### 進捗記録テンプレート
```markdown
## [YYYY-MM-DD HH:MM] 実装セッション記録

### 実装前確認
- [ ] 進捗整理.md確認完了
- [ ] 実装手順.md確認完了  
- [ ] UI保護確認完了
- [ ] 実装計画策定完了

### 実装内容
**変更ファイル**: 
- ファイル1: [変更内容の詳細]
- ファイル2: [変更内容の詳細]

**実装した機能**:
- 機能1: [詳細説明]
- 機能2: [詳細説明]

### テスト結果
**基本テスト**: ✅ 成功 / ❌ 失敗
**統合テスト**: ✅ 成功 / ❌ 失敗  
**UI/UX検証**: ✅ 成功 / ❌ 失敗

### 発見した問題・課題
- 問題1: [詳細と対処法]
- 問題2: [詳細と対処法]

### 次のステップ
- ステップ1: [具体的な内容]
- ステップ2: [具体的な内容]

### 完了確認
- [ ] GitHubプッシュ完了
- [ ] 進捗記録更新完了
- [ ] ユーザーへの報告完了
```

#### 必須報告事項
```
🗣️ MANDATORY COMMUNICATIONS:

実装開始時:
"[機能名]の実装を開始します。変更対象: [ファイル名]"

実装完了時:  
"[機能名]の実装が完了しました。テスト結果: [成功/失敗]"

問題発生時:
"問題が発生しました: [問題の詳細]。対処方法: [対処法]"

セッション終了時:
"実装セッションが完了しました。進捗管理.mdを更新しました。"
```

## 🎯 QUALITY ASSURANCE FRAMEWORK - 品質保証フレームワーク

### コード品質基準

#### TypeScript厳格モード
```typescript
// 必須: 厳格な型定義
interface StrictApiResponse<T> {
  readonly data: T | null
  readonly error: string | null
  readonly timestamp: string
  readonly success: boolean
}

// 禁止: any型の使用
// ❌ const result: any = await apiCall()
// ✅ const result: StrictApiResponse<UserData> = await apiCall()
```

#### エラーハンドリング標準
```typescript
// 必須: 包括的エラーハンドリング
const safeApiCall = async <T>(
  operation: () => Promise<T>
): Promise<StrictApiResponse<T>> => {
  try {
    const data = await operation()
    return {
      data,
      error: null,
      timestamp: new Date().toISOString(),
      success: true
    }
  } catch (error) {
    console.error('API Call Failed:', error)
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      success: false
    }
  }
}
```

## 🚀 DEPLOYMENT SAFETY PROTOCOL - デプロイ安全プロトコル

### 段階的デプロイメント

#### デプロイ前チェックリスト
```
✅ PRE-DEPLOYMENT VERIFICATION:

CODE QUALITY:
- [ ] TypeScriptエラーゼロ
- [ ] ESLintエラーゼロ
- [ ] テストカバレッジ80%以上
- [ ] コードレビュー完了

FUNCTIONALITY:
- [ ] 全機能の動作確認
- [ ] エラーハンドリング確認  
- [ ] パフォーマンス基準クリア
- [ ] セキュリティチェック完了

COMPATIBILITY:
- [ ] 既存機能への影響なし
- [ ] データベース整合性確認
- [ ] API互換性確認
- [ ] フロントエンド互換性確認
```

#### デプロイ実行手順
```bash
# 1. 最終テスト実行
npm run test:comprehensive

# 2. ビルド検証
npm run build

# 3. Supabase変更適用
supabase db push --dry-run  # 事前確認
supabase db push           # 本適用

# 4. Edge Functions デプロイ
supabase functions deploy [function-name]

# 5. 本番環境テスト
curl -X POST [production-endpoint] -H "Authorization: Bearer [token]"
```

---

## 🎯 FINAL EXECUTION CHECKLIST - 最終実行チェックリスト

**このチェックリストを完全に実行しない限り、実装を開始してはいけません：**

```
🔍 PRE-IMPLEMENTATION (実装前):
- [ ] 進捗整理.mdを確認し、発言で報告
- [ ] 実装手順.mdを確認し、発言で報告  
- [ ] 現在のコードベース状態を確認
- [ ] UI変更がないことを確認し、発言で報告
- [ ] 詳細実装計画を策定し、発言で報告

⚡ DURING IMPLEMENTATION (実装中):
- [ ] 最小単位での段階的実装
- [ ] 各ステップでのテスト実行
- [ ] エラー発生時の即座停止・報告
- [ ] UI変更監視の継続

✅ POST-IMPLEMENTATION (実装後):
- [ ] 包括的テストの実行
- [ ] UI/UX影響確認
- [ ] 動作確認完了の発言
- [ ] GitHubプッシュ実行  
- [ ] 進捗管理.md更新
- [ ] 更新完了の発言で報告

🚨 EMERGENCY PROTOCOLS (緊急時):
- [ ] 3回同じエラー → 即座停止
- [ ] UI変更検出 → 即座ロールバック
- [ ] 30分同じ問題 → エスカレーション
- [ ] 重大エラー → 緊急停止・復旧
```

**このルールに従うことで、AIエージェントによる安全で確実な開発を実現し、エラー循環や破綻的な変更を完全に防止します。**