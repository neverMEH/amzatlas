#!/bin/bash

# Deploy edge functions using access token
# This script bypasses the need for database password

echo "🚀 Deploying Edge Functions with Access Token..."

# Export the token
export SUPABASE_ACCESS_TOKEN="sbp_c77c9bbdabf9991fb6fa7b36e020a6f1f508792d"
PROJECT_REF="unkdghonqrxplvjxeotl"

# First, we need to set up the secrets
echo "🔑 Setting up secrets..."
supabase secrets set GOOGLE_APPLICATION_CREDENTIALS_JSON="$GOOGLE_APPLICATION_CREDENTIALS_JSON" --project-ref $PROJECT_REF
supabase secrets set BIGQUERY_PROJECT_ID="amazon-sp-report-loader" --project-ref $PROJECT_REF
supabase secrets set BIGQUERY_DATASET="dataclient_amzatlas_agency_85" --project-ref $PROJECT_REF

echo "📦 Deploying functions..."

# Deploy orchestrator
echo "1️⃣ Deploying daily-refresh-orchestrator..."
supabase functions deploy daily-refresh-orchestrator \
  --project-ref $PROJECT_REF \
  --no-verify-jwt

# Deploy worker functions
echo "2️⃣ Deploying refresh-asin-performance..."
supabase functions deploy refresh-asin-performance \
  --project-ref $PROJECT_REF \
  --no-verify-jwt

echo "3️⃣ Deploying refresh-search-queries..."
supabase functions deploy refresh-search-queries \
  --project-ref $PROJECT_REF \
  --no-verify-jwt

echo "4️⃣ Deploying refresh-summary-tables..."
supabase functions deploy refresh-summary-tables \
  --project-ref $PROJECT_REF \
  --no-verify-jwt

echo "5️⃣ Deploying refresh-daily-sqp..."
supabase functions deploy refresh-daily-sqp \
  --project-ref $PROJECT_REF \
  --no-verify-jwt

echo "6️⃣ Deploying refresh-generic-table..."
supabase functions deploy refresh-generic-table \
  --project-ref $PROJECT_REF \
  --no-verify-jwt

echo "✅ Functions deployed!"
echo ""
echo "⚠️ NOTE: The schedule for daily-refresh-orchestrator needs to be set manually in the Supabase Dashboard:"
echo "   1. Go to Edge Functions → daily-refresh-orchestrator"
echo "   2. Click 'Schedule'"
echo "   3. Set to: 0 2 * * * (2 AM UTC daily)"
echo ""
echo "🧪 To test the deployment:"
echo "   supabase functions invoke daily-refresh-orchestrator --project-ref $PROJECT_REF"