#!/bin/bash

# API使用量監視スクリプト
# Google Maps APIの使用状況を確認し、閾値を超えた場合に警告

set -euo pipefail

PROJECT_ID="lithe-anvil-461717-p8"
MAPS_THRESHOLD=800    # Maps API 1日の80%
GEOCODING_THRESHOLD=80 # Geocoding API 1日の80%
PLACES_THRESHOLD=80    # Places API 1日の80%

echo "🔍 Google Maps API 使用状況チェック"
echo "================================="
echo "プロジェクト: $PROJECT_ID"
echo "日時: $(date)"
echo ""

# 現在の日付情報
TODAY=$(date -u +%Y-%m-%d)
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
YESTERDAY=$(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%SZ)

# Maps JavaScript API使用量チェック
echo "📍 Maps JavaScript API"
echo "---------------------"
MAPS_USAGE=$(gcloud monitoring timeseries list \
    --project=$PROJECT_ID \
    --filter='metric.type="serviceruntime.googleapis.com/api/request_count" AND resource.labels.service="maps-backend.googleapis.com"' \
    --interval-end-time=$NOW \
    --interval-start-time=$YESTERDAY \
    --format="value(points[0].value.int64Value)" 2>/dev/null || echo "0")

echo "本日の使用量: ${MAPS_USAGE:-0} / 1000 リクエスト"
if [ "${MAPS_USAGE:-0}" -gt "$MAPS_THRESHOLD" ]; then
    echo "⚠️  警告: 使用量が80%を超えています！"
fi
echo ""

# Geocoding API使用量チェック
echo "🗺️  Geocoding API"
echo "----------------"
GEOCODING_USAGE=$(gcloud monitoring timeseries list \
    --project=$PROJECT_ID \
    --filter='metric.type="serviceruntime.googleapis.com/api/request_count" AND resource.labels.service="geocoding-backend.googleapis.com"' \
    --interval-end-time=$NOW \
    --interval-start-time=$YESTERDAY \
    --format="value(points[0].value.int64Value)" 2>/dev/null || echo "0")

echo "本日の使用量: ${GEOCODING_USAGE:-0} / 100 リクエスト"
if [ "${GEOCODING_USAGE:-0}" -gt "$GEOCODING_THRESHOLD" ]; then
    echo "⚠️  警告: 使用量が80%を超えています！"
fi
echo ""

# Places API使用量チェック
echo "📌 Places API"
echo "-------------"
PLACES_USAGE=$(gcloud monitoring timeseries list \
    --project=$PROJECT_ID \
    --filter='metric.type="serviceruntime.googleapis.com/api/request_count" AND resource.labels.service="places-backend.googleapis.com"' \
    --interval-end-time=$NOW \
    --interval-start-time=$YESTERDAY \
    --format="value(points[0].value.int64Value)" 2>/dev/null || echo "0")

echo "本日の使用量: ${PLACES_USAGE:-0} / 100 リクエスト"
if [ "${PLACES_USAGE:-0}" -gt "$PLACES_THRESHOLD" ]; then
    echo "⚠️  警告: 使用量が80%を超えています！"
fi
echo ""

# 課金情報チェック
echo "💰 課金状況"
echo "----------"
gcloud billing projects describe $PROJECT_ID 2>/dev/null || echo "課金情報を取得できませんでした"
echo ""

# サマリー
echo "📊 サマリー"
echo "----------"
TOTAL_ALERTS=0
[ "${MAPS_USAGE:-0}" -gt "$MAPS_THRESHOLD" ] && ((TOTAL_ALERTS++))
[ "${GEOCODING_USAGE:-0}" -gt "$GEOCODING_THRESHOLD" ] && ((TOTAL_ALERTS++))
[ "${PLACES_USAGE:-0}" -gt "$PLACES_THRESHOLD" ] && ((TOTAL_ALERTS++))

if [ $TOTAL_ALERTS -eq 0 ]; then
    echo "✅ すべてのAPIが正常な使用量範囲内です"
else
    echo "⚠️  $TOTAL_ALERTS 個のAPIで使用量警告が出ています"
    echo ""
    echo "推奨アクション:"
    echo "1. アプリケーションのAPI呼び出しを確認"
    echo "2. 必要に応じて緊急停止スクリプトの実行を検討"
    echo "3. Google Cloud Console で詳細を確認"
fi