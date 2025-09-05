# Manual Edge Function Deployment Guide

Since the Supabase CLI is not installed, you can deploy the edge functions through the Supabase Dashboard.

## Option 1: Install Supabase CLI (Recommended)

```bash
# Install via npm
npm install -g supabase

# Or via Homebrew (macOS)
brew install supabase/tap/supabase

# After installation, link to your project
supabase link --project-ref unkdghonqrxplvjxeotl
```

Then run the deployment script again:
```bash
./supabase/functions/deploy-functions.sh
```

## Option 2: Deploy via Supabase Dashboard

### Step 1: Set Environment Variables

1. Go to your Supabase Dashboard
2. Navigate to **Settings** → **Edge Functions**
3. Click on **Secrets** tab
4. Add these secrets:
   - `GOOGLE_APPLICATION_CREDENTIALS_JSON` - Your BigQuery service account JSON
   - `BIGQUERY_PROJECT_ID` - `amazon-sp-report-loader`
   - `BIGQUERY_DATASET` - `dataclient_amzatlas_agency_85`

### Step 2: Deploy Each Function

For each function, you'll need to:

1. Go to **Edge Functions** in your Supabase Dashboard
2. Click **New Function**
3. Enter the function name
4. Copy the code from the corresponding file
5. Configure the settings

#### Deploy Orchestrator (with Schedule)

**Function Name:** `daily-refresh-orchestrator`
**Code Location:** `/root/amzatlas/supabase/functions/daily-refresh-orchestrator/index.ts`
**Schedule:** `0 2 * * *` (2 AM UTC daily)
**Verify JWT:** Unchecked

#### Deploy Worker Functions

Deploy these functions without a schedule:

1. **Function Name:** `refresh-asin-performance`
   - **Code:** `/root/amzatlas/supabase/functions/refresh-asin-performance/index.ts`
   - **Verify JWT:** Unchecked

2. **Function Name:** `refresh-search-queries`
   - **Code:** `/root/amzatlas/supabase/functions/refresh-search-queries/index.ts`
   - **Verify JWT:** Unchecked

3. **Function Name:** `refresh-summary-tables`
   - **Code:** `/root/amzatlas/supabase/functions/refresh-summary-tables/index.ts`
   - **Verify JWT:** Unchecked

4. **Function Name:** `refresh-daily-sqp`
   - **Code:** `/root/amzatlas/supabase/functions/refresh-daily-sqp/index.ts`
   - **Verify JWT:** Unchecked

5. **Function Name:** `refresh-generic-table`
   - **Code:** `/root/amzatlas/supabase/functions/refresh-generic-table/index.ts`
   - **Verify JWT:** Unchecked

### Step 3: Deploy Shared Code

Each function also needs the shared utilities. When deploying via Dashboard, you'll need to include the shared code in each function:

1. Copy the contents of `/root/amzatlas/supabase/functions/_shared/utils.ts`
2. Replace the import statement in each function:
   ```typescript
   // Replace this:
   import { createErrorResponse, createSuccessResponse, logError } from '../_shared/utils.ts'
   
   // With the actual utility functions at the top of each file
   ```

## Option 3: Deploy via Supabase API

You can also deploy using the Supabase Management API. Here's a script to help:

```bash
# First, get your access token from the Supabase Dashboard
# Go to Settings → API → Service Role Key

# Then use curl to deploy each function
PROJECT_REF="unkdghonqrxplvjxeotl"
ACCESS_TOKEN="your-service-role-key"

# Deploy orchestrator with schedule
curl -X POST https://api.supabase.com/v1/projects/$PROJECT_REF/functions \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "daily-refresh-orchestrator",
    "verify_jwt": false,
    "schedule": "0 2 * * *"
  }'
```

## Testing After Deployment

Once deployed (via any method), test the functions:

```bash
# If you have Supabase CLI:
supabase functions invoke daily-refresh-orchestrator

# Or via curl:
curl -X POST https://$PROJECT_REF.supabase.co/functions/v1/daily-refresh-orchestrator \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json"
```

## Verification in Dashboard

1. Go to **Edge Functions** in Supabase Dashboard
2. Verify all 6 functions are listed
3. Check the orchestrator shows the schedule "0 2 * * *"
4. Click on each function to view logs
5. Check **Secrets** tab to ensure environment variables are set

## Next Steps

After deployment:
1. Monitor the first automated run at 2 AM UTC
2. Check audit logs: `SELECT * FROM sqp.refresh_audit_log ORDER BY refresh_started_at DESC`
3. Verify data is being refreshed in your tables