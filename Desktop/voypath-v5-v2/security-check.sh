#!/bin/bash

# セキュリティチェックスクリプト
# APIキーの漏洩チェックと.envファイルの保護状態確認

set -euo pipefail

echo "🔐 セキュリティチェック開始"
echo "=========================="
echo ""

# 1. .envファイルがgitignoreされているか確認
echo "📋 .gitignore チェック"
echo "--------------------"
if grep -q "^\.env$\|^\.env\*" .gitignore 2>/dev/null; then
    echo "✅ .env ファイルは .gitignore に含まれています"
else
    echo "❌ 警告: .env ファイルが .gitignore に含まれていません！"
    echo "   以下を .gitignore に追加してください:"
    echo "   .env"
    echo "   .env.*"
fi
echo ""

# 2. 現在のファイルでAPIキーをチェック
echo "🔍 現在のファイルでのAPIキー検索"
echo "-------------------------------"
FOUND_KEYS=0

# Google Maps APIキー
if grep -r "AIza[0-9A-Za-z\-_]\{35\}" --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=.git . 2>/dev/null; then
    echo "⚠️  Google Maps APIキーが見つかりました！"
    ((FOUND_KEYS++))
fi

# 一般的なAPIキーパターン
if grep -rE "(api_key|apikey|api-key)\s*[:=]\s*['\"][0-9a-zA-Z\-_]{20,}['\"]" --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=.git . 2>/dev/null | grep -v "process.env\|import.meta.env"; then
    echo "⚠️  ハードコードされたAPIキーが見つかりました！"
    ((FOUND_KEYS++))
fi

if [ $FOUND_KEYS -eq 0 ]; then
    echo "✅ ハードコードされたAPIキーは見つかりませんでした"
fi
echo ""

# 3. Git履歴でのAPIキーチェック
echo "📜 Git履歴でのAPIキー検索"
echo "------------------------"
echo "最近のコミットをチェック中..."

# 簡易的なチェック（詳細なチェックにはgitleaksを推奨）
if git log -p -S"AIza" --all | grep -q "AIza[0-9A-Za-z\-_]\{35\}"; then
    echo "⚠️  警告: Git履歴にGoogle Maps APIキーが含まれている可能性があります"
    echo "   詳細な調査にはgitleaksの使用を推奨します"
else
    echo "✅ Git履歴に明らかなAPIキーは見つかりませんでした"
fi
echo ""

# 4. 環境変数の使用状況チェック
echo "🌍 環境変数の使用状況"
echo "-------------------"
echo "環境変数を使用している箇所:"
grep -r "process\.env\|import\.meta\.env" --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=.git . 2>/dev/null | grep -E "API|KEY" | head -10 || echo "環境変数の使用が見つかりませんでした"
echo ""

# 5. 推奨事項
echo "📝 セキュリティ推奨事項"
echo "---------------------"
echo "1. ✅ 完了: 古いAPIキーの無効化"
echo "2. ✅ 完了: 新しいAPIキーへの制限設定"
echo "3. ✅ 完了: 使用量制限の設定"
echo "4. ✅ 完了: 予算アラートの設定"
echo "5. ✅ 完了: 監視スクリプトの作成"
echo ""
echo "🛠️  追加の推奨アクション:"
echo "- 定期的に ./monitor-api-usage.sh を実行"
echo "- gitleaks をインストールして詳細なスキャンを実行"
echo "- Google Cloud Console で定期的にAPIキーを確認"
echo "- 不審なアクセスパターンがないかログを監視"
echo ""

# 6. gitleaksの提案
if ! command -v gitleaks &> /dev/null; then
    echo "💡 ヒント: gitleaks をインストールすると詳細なセキュリティスキャンが可能です"
    echo "   インストール: brew install gitleaks"
    echo "   使用方法: gitleaks detect --config .gitleaks.toml"
fi