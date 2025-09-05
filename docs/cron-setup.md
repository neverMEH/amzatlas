# Cron Job Setup for BigQuery Sync

## Overview
This document explains how to set up automated BigQuery data synchronization using cron jobs.

## Option 1: System Cron (Linux/Unix)

### Daily Sync at 2 AM
```bash
# Edit crontab
crontab -e

# Add this line for daily sync at 2 AM
0 2 * * * curl -X POST https://your-domain.com/api/sync/orchestrate \
  -H "Authorization: Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"refreshType":"scheduled"}'
```

### Every 6 Hours
```bash
0 */6 * * * curl -X POST https://your-domain.com/api/sync/orchestrate \
  -H "Authorization: Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"refreshType":"scheduled"}'
```

## Option 2: Vercel Cron (Recommended for Vercel deployments)

Create `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/sync/cron",
    "schedule": "0 2 * * *"
  }]
}
```

Then create `/api/sync/cron/route.ts`:
```typescript
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // Verify this is from Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Trigger orchestration
  const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/sync/orchestrate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refreshType: 'scheduled' })
  })

  const result = await response.json()
  return NextResponse.json(result)
}
```

## Option 3: Railway Cron (For Railway deployments)

In your Railway service settings:
1. Go to Settings → Cron
2. Add a cron schedule: `0 2 * * *`
3. Set the endpoint: `/api/sync/orchestrate`

## Option 4: GitHub Actions

Create `.github/workflows/sync-bigquery.yml`:
```yaml
name: Sync BigQuery Data

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
  workflow_dispatch:  # Allow manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    
    steps:
    - name: Trigger BigQuery Sync
      run: |
        curl -X POST ${{ secrets.API_URL }}/api/sync/orchestrate \
          -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
          -H "Content-Type: application/json" \
          -d '{"refreshType":"scheduled"}' \
          --fail
```

## Option 5: Supabase pg_cron

Create a PostgreSQL function:
```sql
CREATE OR REPLACE FUNCTION trigger_bigquery_sync()
RETURNS void AS $$
DECLARE
  response json;
BEGIN
  -- Use pg_http extension to call your API
  SELECT content::json INTO response
  FROM http_post(
    'https://your-domain.com/api/sync/orchestrate',
    '{"refreshType":"scheduled"}'::json,
    'application/json',
    headers => ARRAY[
      http_header('Authorization', 'Bearer ' || current_setting('app.service_role_key'))
    ]
  );
  
  RAISE NOTICE 'Sync response: %', response;
END;
$$ LANGUAGE plpgsql;

-- Schedule the function
SELECT cron.schedule(
  'sync-bigquery',
  '0 2 * * *',
  'SELECT trigger_bigquery_sync()'
);
```

## Monitoring

Check sync status:
- Visit `/refresh-monitor` dashboard
- Check logs: `curl https://your-domain.com/api/sync/orchestrate`
- View webhook deliveries: `curl https://your-domain.com/api/sync/webhook`

## Environment Variables Required

```bash
# Required for all options
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_BASE_URL=https://your-domain.com

# Additional for Vercel Cron
CRON_SECRET=your-random-secret
```

## Testing

Test the sync manually:
```bash
curl -X POST https://your-domain.com/api/sync/orchestrate \
  -H "Authorization: Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"refreshType":"manual","tables":["asin_performance_data"]}'
```