# Fix Missing Views for Chart Population

## Problem Summary
The charts aren't populating because the application expects certain database views that were removed during table updates. The main issue is that the API routes are looking for views with specific column structures that don't match the existing views.

## Root Causes
1. The `weekly_summary` table doesn't exist, causing errors in the asin-overview API
2. The existing `search_performance_summary` view has aggregated data, but the API expects row-level data
3. Missing views for brand performance and period comparisons

## Solution

### 1. Apply the SQL Fix Script
Run the `fix-missing-views.sql` script in your Supabase SQL editor:

```bash
# The script is located at:
/mnt/c/Users/Aeciu/Dev Work/amzatlas/fix-missing-views.sql
```

This script will:
- Create a `search_query_detail` view with row-level data for each search query
- Create alias views for backward compatibility
- Ensure the `asin_performance_by_brand` view exists
- Create basic period comparison views if missing

### 2. Code Updates Applied
The following changes have been made to fix the API routes:

#### `/src/app/api/dashboard/v2/asin-overview/route.ts`
- Changed from `weekly_summary` table to `search_query_detail` view
- Updated column mappings to match the actual view structure
- Fixed both main data fetch and comparison data fetch

### 3. Views Created/Updated

#### `public.search_query_detail`
Provides row-level search query performance data with columns:
- `start_date`, `end_date`, `asin`, `product_title`
- `search_query`, `impressions`, `clicks`, `cart_adds`, `purchases`
- `impression_share`, `click_share`, `cart_add_share`, `purchase_share`
- Calculated rates: `click_through_rate`, `cart_add_rate`, `purchase_rate`, `conversion_rate`
- Pricing: `median_price`, `median_click_price`, `median_cart_add_price`

#### `public.asin_performance_by_brand`
Aggregates ASIN performance by brand for brand dashboards

#### `public.period_comparisons`
Basic period comparison view for weekly/monthly aggregations

## Verification Steps

1. **Check if views exist:**
```sql
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'VIEW'
ORDER BY table_name;
```

2. **Verify data in the views:**
```sql
-- Check search_query_detail
SELECT COUNT(*) FROM public.search_query_detail;

-- Check sample data
SELECT * FROM public.search_query_detail LIMIT 5;
```

3. **Test the API endpoints:**
- Visit the dashboard and check if charts are loading
- Check browser console for any API errors
- Verify that the performance chart, funnel chart, and search query table populate

## Additional Notes

- The existing `search_performance_summary` materialized view is kept for backward compatibility
- The new views use the actual column names from the `sqp.search_query_performance` table
- All views have proper permissions granted for `anon`, `authenticated`, and `service_role`

## If Issues Persist

1. Check if the base tables have data:
```sql
SELECT COUNT(*) FROM sqp.asin_performance_data;
SELECT COUNT(*) FROM sqp.search_query_performance;
```

2. Refresh materialized views if needed:
```sql
REFRESH MATERIALIZED VIEW sqp.search_performance_summary;
```

3. Check for any permission issues:
```sql
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'search_query_detail';
```