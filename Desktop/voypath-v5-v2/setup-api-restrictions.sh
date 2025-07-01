#!/bin/bash

# API制限設定スクリプト
# 新しいAPIキーに対してHTTPリファラー制限とAPI制限を設定

set -euo pipefail

PROJECT_ID="lithe-anvil-461717-p8"

echo "🔒 APIキーの制限設定を開始します..."

# 1. 使用量制限の設定
echo "📊 使用量制限を設定中..."

# Maps JavaScript API - 1日1000リクエスト
echo "Maps JavaScript API の制限設定..."
gcloud alpha services quota update \
    --service=maps-backend.googleapis.com \
    --consumer=projects/$PROJECT_ID \
    --quota=map-loads-per-day \
    --value=1000 \
    --force 2>/dev/null || echo "⚠️  Maps API quota update failed (alpha command may not be available)"

# Geocoding API - 1日100リクエスト
echo "Geocoding API の制限設定..."
gcloud alpha services quota update \
    --service=geocoding-backend.googleapis.com \
    --consumer=projects/$PROJECT_ID \
    --quota=requests-per-day \
    --value=100 \
    --force 2>/dev/null || echo "⚠️  Geocoding API quota update failed (alpha command may not be available)"

# Places API - 1日100リクエスト
echo "Places API の制限設定..."
gcloud alpha services quota update \
    --service=places-backend.googleapis.com \
    --consumer=projects/$PROJECT_ID \
    --quota=requests-per-day \
    --value=100 \
    --force 2>/dev/null || echo "⚠️  Places API quota update failed (alpha command may not be available)"

echo "✅ 使用量制限の設定を試みました"
echo ""
echo "⚠️  注意: gcloud alpha コマンドが利用できない場合は、Google Cloud Console から手動で設定してください"
echo "URL: https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID"