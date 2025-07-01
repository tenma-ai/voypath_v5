#!/bin/bash

# API Security Setup Script for Voypath
# This script sets up Google Maps API security measures

set -euo pipefail

PROJECT_ID="lithe-anvil-461717-p8"
BILLING_ACCOUNT_ID="01326B-BBDC78-5918F8"

echo "🔐 Starting API Security Setup..."

# 1. Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed. Please install it first:"
    echo "brew install google-cloud-sdk"
    exit 1
fi

# 2. Set project
echo "📋 Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# 3. Create API usage quotas
echo "📊 Setting API usage quotas..."

# Maps JavaScript API - 1000 requests per day
echo "Setting Maps JavaScript API quota..."
gcloud alpha services quota update \
    --service=maps-backend.googleapis.com \
    --consumer=projects/$PROJECT_ID \
    --name=map-loads-per-day \
    --value=1000 \
    --force || echo "⚠️  Maps API quota update failed"

# Geocoding API - 100 requests per day
echo "Setting Geocoding API quota..."
gcloud alpha services quota update \
    --service=geocoding-backend.googleapis.com \
    --consumer=projects/$PROJECT_ID \
    --name=requests-per-day \
    --value=100 \
    --force || echo "⚠️  Geocoding API quota update failed"

# 4. Create budget alert
echo "💰 Creating budget alert..."

cat > budget-config.json << EOF
{
  "displayName": "Maps API Monthly Budget",
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
    }
  ]
}
EOF

# Create budget
gcloud billing budgets create \
    --billing-account=$BILLING_ACCOUNT_ID \
    --budget-from-file=budget-config.json || echo "⚠️  Budget creation failed"

# 5. Create monitoring scripts
echo "📝 Creating monitoring scripts..."

# Usage monitoring script
cat > monitor-usage.sh << 'EOF'
#!/bin/bash

PROJECT_ID="lithe-anvil-461717-p8"
THRESHOLD=800  # 80% of daily limit

echo "🔍 Checking API usage..."

# Check Maps API usage
MAPS_USAGE=$(gcloud monitoring timeseries list \
    --filter='metric.type="serviceruntime.googleapis.com/api/request_count" AND resource.labels.service="maps-backend.googleapis.com"' \
    --interval-end-time=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
    --interval-start-time=$(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%SZ) \
    --format="value(points[0].value.int64Value)" 2>/dev/null || echo "0")

echo "Maps API usage today: $MAPS_USAGE requests"

if [ "$MAPS_USAGE" -gt "$THRESHOLD" ]; then
    echo "⚠️  WARNING: Maps API usage is at ${MAPS_USAGE} requests (over 80% of daily limit)"
fi

# Check current month's cost
echo "💰 Checking current month's cost..."
gcloud billing projects describe $PROJECT_ID
EOF

chmod +x monitor-usage.sh

# Emergency stop script
cat > emergency-stop.sh << 'EOF'
#!/bin/bash

PROJECT_ID="lithe-anvil-461717-p8"

echo "🚨 EMERGENCY STOP - Disabling APIs..."

read -p "Are you sure you want to disable Maps APIs? (yes/no): " confirmation
if [ "$confirmation" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

# Disable APIs
gcloud services disable maps-backend.googleapis.com --force
gcloud services disable geocoding-backend.googleapis.com --force
gcloud services disable places-backend.googleapis.com --force

echo "✅ APIs disabled. To re-enable, run:"
echo "gcloud services enable maps-backend.googleapis.com geocoding-backend.googleapis.com places-backend.googleapis.com"
EOF

chmod +x emergency-stop.sh

# 6. Create .gitignore if needed
if ! grep -q "\.env" .gitignore 2>/dev/null; then
    echo "📝 Adding .env to .gitignore..."
    echo -e "\n# Environment variables\n.env\n.env.local\n.env.*.local" >> .gitignore
fi

# 7. Create API key restriction script
cat > restrict-api-key.sh << 'EOF'
#!/bin/bash

API_KEY=$1
if [ -z "$API_KEY" ]; then
    echo "Usage: ./restrict-api-key.sh <API_KEY>"
    exit 1
fi

echo "🔒 Restricting API key..."

# Create restricted API key
gcloud alpha services api-keys create \
    --display-name="Voypath Maps API Key (Restricted)" \
    --api-target=service=maps-backend.googleapis.com \
    --api-target=service=geocoding-backend.googleapis.com \
    --api-target=service=places-backend.googleapis.com \
    --allowed-referrers="https://*.vercel.app/*,http://localhost:3000/*,http://localhost:5173/*"

echo "✅ New restricted API key created. Please update your .env file."
EOF

chmod +x restrict-api-key.sh

# Clean up
rm -f budget-config.json

echo "✅ Security setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Run './monitor-usage.sh' to check current usage"
echo "2. Run './restrict-api-key.sh' to create a new restricted API key"
echo "3. Update the API key in your .env file"
echo "4. Commit these security scripts to your repository"
echo ""
echo "⚠️  IMPORTANT: Never commit your .env file to Git!"