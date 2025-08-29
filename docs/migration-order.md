# Migration Order for Brand Management and Reporting Engine

## Important: Run these migrations in the exact order listed below

### Task 1: Brand Management System
1. **018_create_brand_management_tables.sql** - Creates brand, mapping, and product type tables
2. **019_create_brand_extraction_functions.sql** - Creates functions for brand extraction
3. **020_add_product_title_column.sql** - Adds product_title column to asin_performance_data
4. **021_populate_initial_brands.sql** - Populates brands from existing data
5. **022_create_weekly_update_functions.sql** - Creates functions for weekly updates
6. **023_create_brand_optimization_indexes.sql** - Creates initial indexes and functions
7. **023a_add_missing_columns_and_fix_indexes.sql** - Adds missing columns to search_query_performance
8. **023b_create_remaining_indexes.sql** - Creates indexes that depend on new columns
9. **023c_create_brand_performance_views.sql** - Creates materialized views for brand performance

### Task 2: Period-over-Period Reporting Engine  
10. **024_create_period_comparison_views.sql** - Creates WoW, MoM, QoQ, YoY comparison views
11. **025_create_rolling_average_views.sql** - Creates 6-week rolling average calculations
12. **026_create_anomaly_detection_functions.sql** - Creates Z-score anomaly detection
13. **027_create_trend_classification_functions.sql** - Creates trend classification system
14. **028_create_period_comparison_functions.sql** - Creates flexible period comparison functions

## Key Dependencies

- Migration 020 must run before 019's indexes can be created (product_title column)
- Migration 023a must run before 023b (adds asin column to search_query_performance)
- Migration 023a must run before 023c (columns needed for materialized view)
- All Task 1 migrations should complete before Task 2 migrations

## Running the Migrations

You can run these individually in Supabase SQL Editor:
```sql
-- Run each .sql file in order
```

Or if you have the migration tool configured:
```bash
npm run migrate:up
```

## Troubleshooting

If you encounter errors:

1. **"column does not exist"** - Check that you've run the migrations in order
2. **"relation does not exist"** - A required table hasn't been created yet
3. **"function does not exist"** - Functions from migration 019 haven't been created

## Post-Migration Steps

After all migrations are complete:

1. Refresh materialized views:
```sql
REFRESH MATERIALIZED VIEW sqp.brand_performance_summary;
REFRESH MATERIALIZED VIEW sqp.week_over_week_comparison;
REFRESH MATERIALIZED VIEW sqp.month_over_month_comparison;
-- etc for all materialized views
```

2. Run the brand update process:
```sql
SELECT sqp.weekly_data_update();
```

3. Verify brand mappings:
```sql
SELECT * FROM sqp.validate_brand_mappings();
```