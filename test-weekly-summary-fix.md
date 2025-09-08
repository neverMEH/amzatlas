# Weekly Summary Table Fix

## Issue
The application was trying to query a table called `weekly_summary` which doesn't exist in the database, causing the following error:
```
Error fetching weekly data: {
  code: 'PGRST205',
  details: null,
  hint: "Perhaps you meant the table 'public.data_freshness_summary'",
  message: "Could not find the table 'public.weekly_summary' in the schema cache"
}
```

## Root Cause
The `src/app/api/dashboard/v2/asin-overview/route.ts` file was using `weekly_summary` table which doesn't exist. 

## Solution
Updated the route to use `search_performance_summary` view instead, which is available in the public schema and contains the required data.

### Changes Made:
1. Changed table reference from `weekly_summary` to `search_performance_summary`
2. Updated column names to match the actual view:
   - `period_start` → `start_date`
   - `period_end` → `end_date`
   - `total_impressions` → `impressions`
   - `total_clicks` → `clicks`
   - `total_purchases` → `purchases`
3. Added proper aggregation for market share metrics using columns available in the view

### Files Modified:
- `/src/app/api/dashboard/v2/asin-overview/route.ts`

## Verification
The fix has been applied. The route should now properly fetch data from the existing `search_performance_summary` view instead of the non-existent `weekly_summary` table.