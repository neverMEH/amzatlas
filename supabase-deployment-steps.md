# Supabase Edge Functions Deployment Steps

Supabase CLI is now installed! To complete the deployment, you need to:

## Step 1: Login to Supabase

```bash
supabase login
```

This will open a browser window for authentication. If you're on a headless system, you can use an access token instead:

```bash
# Option A: Interactive login (opens browser)
supabase login

# Option B: Use access token (get from https://app.supabase.com/account/tokens)
export SUPABASE_ACCESS_TOKEN="your-personal-access-token"
```

## Step 2: Link Your Project

```bash
supabase link --project-ref unkdghonqrxplvjxeotl
```

## Step 3: Set Secrets

```bash
# Set your BigQuery credentials
supabase secrets set GOOGLE_APPLICATION_CREDENTIALS_JSON='your-bigquery-json-here'
supabase secrets set BIGQUERY_PROJECT_ID='amazon-sp-report-loader'
supabase secrets set BIGQUERY_DATASET='dataclient_amzatlas_agency_85'
```

## Step 4: Deploy Functions

```bash
# Run the deployment script
cd /root/amzatlas
./supabase/functions/deploy-functions.sh
```

## Step 5: Test Deployment

```bash
# Test the orchestrator
supabase functions invoke daily-refresh-orchestrator

# Check function logs
supabase functions logs daily-refresh-orchestrator
```

## Alternative: If Login Doesn't Work

If you can't login interactively, get a personal access token:

1. Go to https://app.supabase.com/account/tokens
2. Create a new token
3. Run:
   ```bash
   export SUPABASE_ACCESS_TOKEN="your-token-here"
   supabase link --project-ref unkdghonqrxplvjxeotl
   ```