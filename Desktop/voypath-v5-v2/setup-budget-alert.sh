#!/bin/bash

# 予算アラート設定スクリプト
# Google Maps APIの使用料金に対する予算アラートを設定

set -euo pipefail

PROJECT_ID="lithe-anvil-461717-p8"
BILLING_ACCOUNT_ID="01326B-BBDC78-5918F8"

echo "💰 予算アラートの設定を開始します..."

# 予算設定用JSONファイルを作成
cat > budget-config.json << EOF
{
  "displayName": "Voypath Maps API 月次予算",
  "budgetFilter": {
    "projects": ["projects/$PROJECT_ID"],
    "services": [
      "services/maps-backend.googleapis.com",
      "services/geocoding-backend.googleapis.com",
      "services/places-backend.googleapis.com"
    ]
  },
  "amount": {
    "specifiedAmount": {
      "currencyCode": "JPY",
      "units": "1000"
    }
  },
  "thresholdRules": [
    {
      "thresholdPercent": 0.5,
      "spendBasis": "CURRENT_SPEND"
    },
    {
      "thresholdPercent": 0.8,
      "spendBasis": "CURRENT_SPEND"
    },
    {
      "thresholdPercent": 1.0,
      "spendBasis": "CURRENT_SPEND"
    },
    {
      "thresholdPercent": 1.2,
      "spendBasis": "CURRENT_SPEND"
    }
  ],
  "notificationsRule": {
    "disableDefaultIamRecipients": false,
    "monitoringNotificationChannels": []
  }
}
EOF

# 予算を作成
echo "予算を作成中..."
gcloud billing budgets create \
    --billing-account=$BILLING_ACCOUNT_ID \
    --budget-from-file=budget-config.json \
    || echo "⚠️  予算作成に失敗しました。権限を確認してください。"

# クリーンアップ
rm -f budget-config.json

echo "✅ 予算アラートの設定が完了しました（成功した場合）"
echo ""
echo "📧 アラートは以下のタイミングで送信されます："
echo "- 50% (500円) 到達時"
echo "- 80% (800円) 到達時"
echo "- 100% (1000円) 到達時"
echo "- 120% (1200円) 超過時"