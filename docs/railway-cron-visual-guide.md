# 🖼️ Visual Guide: Setting Up Daily Sync on Railway

## Quick Start Checklist

- [ ] 1. Open Railway Dashboard
- [ ] 2. Create New Service named "Daily Sync"
- [ ] 3. Set Start Command: `node src/scripts/daily-sync.js`
- [ ] 4. Set Cron Schedule: `0 2 * * *`
- [ ] 5. Copy environment variables
- [ ] 6. Deploy and verify

## Step-by-Step Visual Instructions

### 🟦 Step 1: Open Railway Dashboard

```
railway.app → Login → Select "amzatlas" project
```

### 🟦 Step 2: Create New Service

```
┌─────────────────────────────────────┐
│  Your Railway Project               │
│                                     │
│  ┌─────────────┐  ┌─────────────┐  │
│  │   Web App   │  │  + New      │  │ ← Click this
│  │  (Active)   │  │  Service    │  │
│  └─────────────┘  └─────────────┘  │
└─────────────────────────────────────┘
```

Choose: **Empty Service** → Name it: **"Daily Sync"**

### 🟦 Step 3: Configure the Service

Click on the new "Daily Sync" service card:

```
┌─────────────────────────────────────┐
│  Daily Sync Service                 │
│                                     │
│  📑 Deployments                     │
│  ⚙️  Settings        ← Click this   │
│  📊 Metrics                         │
│  🔒 Variables                       │
└─────────────────────────────────────┘
```

### 🟦 Step 4: Set Start Command

In Settings → Deploy section:

```
┌─────────────────────────────────────┐
│  Deploy Configuration               │
│                                     │
│  Start Command:                     │
│  ┌─────────────────────────────┐   │
│  │ node src/scripts/daily-sync.js│  │ ← Enter this
│  └─────────────────────────────┘   │
│                                     │
│  Restart Policy: ON_FAILURE ✓       │
└─────────────────────────────────────┘
```

### 🟦 Step 5: Set Cron Schedule

Still in Settings → Deploy section:

```
┌─────────────────────────────────────┐
│  Cron Schedule:                     │
│  ┌─────────────────────────────┐   │
│  │ 0 2 * * *                   │   │ ← Daily at 2 AM UTC
│  └─────────────────────────────┘   │
│                                     │
│  Preview: "At 02:00"                │
└─────────────────────────────────────┘
```

**Other Schedule Options:**
- `0 */6 * * *` = Every 6 hours
- `0 0 * * *` = Daily at midnight
- `0 12 * * *` = Daily at noon

### 🟦 Step 6: Copy Environment Variables

Go to Variables tab:

```
┌─────────────────────────────────────┐
│  🔒 Variables                       │
│                                     │
│  + New Variable                     │
│                                     │
│  Add these (copy from main service):│
│  • GOOGLE_APPLICATION_CREDENTIALS_JSON
│  • SUPABASE_URL                     │
│  • SUPABASE_SERVICE_ROLE_KEY        │
│  • BIGQUERY_PROJECT_ID              │
│  • BIGQUERY_DATASET                 │
│  • SYNC_BATCH_SIZE = 5000           │
│  • NODE_ENV = production            │
└─────────────────────────────────────┘
```

**How to copy variables quickly:**
1. Open your main web service in another tab
2. Go to its Variables section
3. Copy each variable one by one

### 🟦 Step 7: Connect GitHub

In Settings → Source:

```
┌─────────────────────────────────────┐
│  Source                             │
│                                     │
│  GitHub Repo: amzatlas ✓            │
│  Branch: main ✓                     │
│  Root Directory: / ✓                │
│                                     │
│  [Connect GitHub Repo]              │
└─────────────────────────────────────┘
```

### 🟦 Step 8: Deploy

The service will auto-deploy after configuration.

```
┌─────────────────────────────────────┐
│  Deployments                        │
│                                     │
│  🟢 #1 Building...                  │
│      ↓                              │
│  🟢 #1 Deploying...                 │
│      ↓                              │
│  ✅ #1 Active                       │
└─────────────────────────────────────┘
```

### 🟦 Step 9: Verify Cron is Active

Check the service overview:

```
┌─────────────────────────────────────┐
│  Daily Sync                         │
│                                     │
│  Status: ✅ Active                  │
│  Type: Cron Service                 │
│  Schedule: 0 2 * * * (Daily 2 AM)  │
│  Last Run: Not yet run              │
│  Next Run: Tomorrow at 02:00 UTC    │
└─────────────────────────────────────┘
```

## 🧪 Testing Your Setup

### Option 1: Wait for First Run
The cron will run automatically at the scheduled time.

### Option 2: Test Manually (Recommended)
1. SSH into your Railway service:
   ```bash
   railway run node src/scripts/daily-sync.js
   ```

2. Or test with small batch:
   ```bash
   railway run npm run sync:test
   ```

### Option 3: Check Health
```bash
railway run npm run sync:health
```

## 📊 Monitoring the Sync

### Check Logs in Railway:

```
┌─────────────────────────────────────┐
│  Deployment Logs                    │
│                                     │
│  [2025-09-08 02:00:00] Starting    │
│  daily BigQuery to Supabase sync    │
│  [2025-09-08 02:00:01] Connected   │
│  to services                        │
│  [2025-09-08 02:00:02] Found 5000  │
│  rows to sync                       │
│  [2025-09-08 02:00:15] Inserted    │
│  500 parent records                 │
│  [2025-09-08 02:00:45] Sync        │
│  completed successfully!            │
└─────────────────────────────────────┘
```

### Check Database:

In Supabase SQL Editor:
```sql
-- Recent syncs
SELECT * FROM sync_log 
WHERE sync_type = 'daily' 
ORDER BY started_at DESC 
LIMIT 5;

-- Today's sync
SELECT * FROM sync_log 
WHERE sync_type = 'daily' 
AND DATE(started_at) = CURRENT_DATE;
```

## 🚨 Troubleshooting

### If cron doesn't run:

1. **Check Schedule Format**
   ```
   ✅ Correct: 0 2 * * *
   ❌ Wrong: 2:00 AM
   ❌ Wrong: 02:00
   ```

2. **Check Logs for Errors**
   - Click on deployment
   - View build logs
   - Look for missing modules

3. **Verify Environment Variables**
   - All variables must be set
   - No typos in names
   - Values properly formatted

### Common Error Messages:

```
Error: Missing required environment variables
→ Solution: Add all variables from Step 6

Error: Cannot find module
→ Solution: Check build logs, ensure npm install ran

Error: ENOENT: no such file or directory
→ Solution: Verify file path is correct
```

## 🎯 Success Confirmation

You'll see these indicators when working correctly:

1. **Railway Dashboard**: Shows "Last Run" timestamp
2. **Logs**: Show successful completion
3. **Database**: New entries in sync_log
4. **Data**: Updated records in Supabase

## 📱 Mobile Monitoring

Railway has a mobile app! You can:
- Check cron status
- View logs
- Get notifications
- Restart services

## 🔔 Set Up Notifications

1. Go to Project Settings → Integrations
2. Add Slack/Discord webhook
3. Configure alerts for:
   - Failed deployments
   - Service crashes
   - Successful syncs (optional)

---

**Need help?** The setup should take about 10-15 minutes. If you get stuck, check the logs first - they usually explain what's wrong!