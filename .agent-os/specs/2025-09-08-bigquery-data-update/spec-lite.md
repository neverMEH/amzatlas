# BigQuery Data Update - Spec Lite

## Quick Summary
Sync last 60 days of data from BigQuery to Supabase to ensure all tables have complete and up-to-date information.

## Why
- Fill any data gaps in Supabase tables
- Ensure dashboard shows most recent data
- Maintain data consistency across the system

## What
- Pull 60 days of data from BigQuery
- Update asin_performance_data and search_query_performance tables
- Refresh all materialized views
- Validate data completeness

## Key Tasks
1. Check current data status
2. Configure and run sync for 60-day range
3. Update views and validate results
4. Test application with new data