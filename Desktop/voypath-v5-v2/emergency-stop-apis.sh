#!/bin/bash

# 緊急API停止スクリプト
# 不正利用が検出された場合にGoogle Maps APIを即座に無効化

set -euo pipefail

PROJECT_ID="lithe-anvil-461717-p8"

echo "🚨 緊急API停止スクリプト"
echo "======================"
echo ""
echo "このスクリプトは以下のAPIを無効化します:"
echo "- Maps JavaScript API"
echo "- Geocoding API" 
echo "- Places API"
echo ""
echo "⚠️  警告: APIを無効化するとアプリケーションが動作しなくなります"
echo ""

# 確認プロンプト
read -p "本当にAPIを無効化しますか？ (yes/no): " confirmation
if [ "$confirmation" != "yes" ]; then
    echo "❌ 操作がキャンセルされました"
    exit 0
fi

# 二重確認
read -p "もう一度確認します。本当に実行しますか？ (YES): " final_confirmation
if [ "$final_confirmation" != "YES" ]; then
    echo "❌ 操作がキャンセルされました"
    exit 0
fi

echo ""
echo "🔄 APIを無効化しています..."

# Maps JavaScript API
echo -n "Maps JavaScript API を無効化中..."
gcloud services disable maps-backend.googleapis.com --project=$PROJECT_ID --force 2>/dev/null && echo " ✅" || echo " ❌ 失敗"

# Geocoding API
echo -n "Geocoding API を無効化中..."
gcloud services disable geocoding-backend.googleapis.com --project=$PROJECT_ID --force 2>/dev/null && echo " ✅" || echo " ❌ 失敗"

# Places API
echo -n "Places API を無効化中..."
gcloud services disable places-backend.googleapis.com --project=$PROJECT_ID --force 2>/dev/null && echo " ✅" || echo " ❌ 失敗"

echo ""
echo "✅ 緊急停止が完了しました"
echo ""
echo "📝 APIを再度有効化するには:"
echo "gcloud services enable maps-backend.googleapis.com geocoding-backend.googleapis.com places-backend.googleapis.com --project=$PROJECT_ID"
echo ""
echo "🔒 追加の推奨アクション:"
echo "1. Google Cloud Console でAPIキーを確認・無効化"
echo "2. 不正アクセスログの確認"
echo "3. 新しいAPIキーの生成と適切な制限の設定"