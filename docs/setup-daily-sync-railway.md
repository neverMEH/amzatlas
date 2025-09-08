# 🚀 Setting Up Daily BigQuery Sync on Railway

This guide will walk you through setting up an automated daily sync from BigQuery to Supabase using Railway's cron feature.

## 📋 Prerequisites

Before starting, make sure you have:
- Access to your Railway project
- Admin/deployment permissions on Railway
- The sync script has been tested and works locally

## 🛠️ Step-by-Step Setup Guide

### Step 1: Prepare the Sync Script

The daily sync script has been created at: `src/scripts/daily-sync.js`

This script:
- Connects to BigQuery and Supabase
- Syncs the last 7 days of data
- Logs progress and errors
- Updates sync status in the database

### Step 2: Access Railway Dashboard

1. **Log in to Railway**: Go to [railway.app](https://railway.app)
2. **Select your project**: Click on your `amzatlas` project

### Step 3: Create a New Cron Service

Railway has two ways to set up cron jobs. Choose the method based on your Railway plan:

#### Method A: Using Railway Cron (Recommended)

1. **In your Railway project**, click the **"+ New"** button
2. Select **"Empty Service"**
3. Name it **"Daily BigQuery Sync"** or **"Cron Jobs"**

4. **Configure the service**:
   - Click on the new service card
   - Go to **Settings** tab
   - Scroll down to **Deploy** section

5. **Set the Start Command**:
   ```
   node src/scripts/daily-sync.js
   ```

6. **Configure Cron Schedule**:
   - Look for **"Cron Schedule"** field
   - Enter: `0 2 * * *` (This runs daily at 2 AM UTC)
   
   **Cron Schedule Format Explained**:
   ```
   ┌───────────── minute (0 - 59)
   │ ┌─────────── hour (0 - 23)
   │ │ ┌───────── day of the month (1 - 31)
   │ │ │ ┌─────── month (1 - 12)
   │ │ │ │ ┌───── day of the week (0 - 6) (Sunday to Saturday)
   │ │ │ │ │
   0 2 * * *
   ```
   
   Common schedules:
   - `0 2 * * *` - Daily at 2 AM
   - `0 */6 * * *` - Every 6 hours
   - `0 0 * * 0` - Weekly on Sunday at midnight
   - `*/30 * * * *` - Every 30 minutes

7. **Add Environment Variables**:
   - Go to **Variables** tab
   - Click **"+ New Variable"**
   - Add these variables (copy from your main service):
     ```
     GOOGLE_APPLICATION_CREDENTIALS_JSON
     SUPABASE_URL
     SUPABASE_SERVICE_ROLE_KEY
     BIGQUERY_PROJECT_ID
     BIGQUERY_DATASET
     SYNC_BATCH_SIZE=5000
     NODE_ENV=production
     ```

8. **Configure Source**:
   - Go to **Settings** → **Source**
   - Connect to the same GitHub repo as your main service
   - Select the same branch (usually `main`)

#### Method B: Using the Same Service (If cron service costs extra)

1. **Go to your existing Railway service**
2. Click **Settings** → **Deploy**
3. Add a **Cron Schedule**: `0 2 * * *`
4. Modify your start command to handle both web and cron:
   ```bash
   npm start & node src/scripts/daily-sync.js
   ```

### Step 4: Deploy the Cron Service

1. **Trigger a deployment**:
   - If connected to GitHub: Push a commit
   - Or use Railway CLI: `railway up`
   - Or manually: Click **"Deploy"** in Railway dashboard

2. **Monitor the deployment**:
   - Click on the deployment to see logs
   - Check for any errors during build

### Step 5: Verify the Setup

1. **Check Service Status**:
   - The service should show as **"Active"**
   - Look for the cron schedule in the service details

2. **Test Manually** (Optional):
   - Click **"Run Now"** if available
   - Or trigger via Railway CLI:
     ```bash
     railway run node src/scripts/daily-sync.js
     ```

3. **Check Logs**:
   - Go to **Deployments** → Click on latest
   - View logs to ensure no errors

### Step 6: Set Up Monitoring

1. **Database Monitoring**:
   - Visit your app's `/refresh-monitor` page
   - Check the `sync_log` table for sync history

2. **Railway Notifications**:
   - Go to Project Settings → Integrations
   - Set up Discord/Slack notifications for failures

3. **Create a Health Check** (Optional):
   ```javascript
   // In daily-sync.js, already included:
   if (process.argv.includes('--health-check')) {
     console.log('OK');
     process.exit(0);
   }
   ```

### Step 7: Monitor Daily Runs

After setup, monitor your sync:

1. **Check Sync Logs**:
   ```sql
   -- In Supabase SQL Editor
   SELECT * FROM sync_log 
   WHERE sync_type = 'daily'
   ORDER BY started_at DESC
   LIMIT 10;
   ```

2. **Check Refresh Status**:
   ```sql
   SELECT table_name, last_refresh_at, next_refresh_at
   FROM refresh_config
   WHERE table_name IN ('asin_performance_data', 'search_query_performance');
   ```

3. **Railway Logs**:
   - Cron executions appear in deployment logs
   - Failed runs trigger restart policy

## 🔧 Troubleshooting

### Common Issues and Solutions

1. **"Command not found" error**:
   - Ensure the path is correct: `node src/scripts/daily-sync.js`
   - Check if node_modules are installed in production

2. **Environment variables not found**:
   - Copy ALL required variables from main service
   - Check for typos in variable names

3. **Sync runs but no data**:
   - Check BigQuery date filters
   - Verify credentials have read access
   - Check Supabase connection

4. **Cron doesn't trigger**:
   - Verify cron syntax is correct
   - Check Railway service is active
   - Look for errors in deployment logs

### Testing Cron Syntax

Use [crontab.guru](https://crontab.guru/) to verify your cron schedule:
- `0 2 * * *` = "At 02:00"
- `0 */4 * * *` = "Every 4 hours"
- `30 1 * * 1-5` = "At 01:30 on every day-of-week from Monday through Friday"

## 📊 Monitoring Dashboard

Create a simple monitoring query in Supabase:

```sql
-- Daily sync performance
SELECT 
  DATE(started_at) as sync_date,
  status,
  EXTRACT(EPOCH FROM (completed_at - started_at)) as duration_seconds,
  rows_synced,
  metadata->>'parentRecordsInserted' as parent_records,
  metadata->>'searchQueriesInserted' as search_queries,
  error_message
FROM sync_log
WHERE sync_type = 'daily'
  AND started_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY started_at DESC;
```

## 🎉 Success Indicators

You'll know the setup is working when:
1. ✅ Cron service shows as "Active" in Railway
2. ✅ Logs show successful sync completion daily
3. ✅ `sync_log` table has new entries each day
4. ✅ Data in Supabase is updated daily
5. ✅ No error notifications from Railway

## 📝 Additional Notes

- **Timezone**: Railway uses UTC time for cron schedules
- **Costs**: Cron services may incur additional charges on Railway
- **Scaling**: Increase `SYNC_BATCH_SIZE` for faster syncs
- **Logs**: Railway keeps logs for 7 days by default

## 🆘 Need Help?

If you encounter issues:
1. Check Railway documentation: [docs.railway.app](https://docs.railway.app)
2. Review sync script logs in Railway dashboard
3. Check Supabase logs for database errors
4. Verify BigQuery permissions and quotas

---

**Congratulations!** 🎊 Your BigQuery to Supabase sync is now automated and will run daily at 2 AM UTC.