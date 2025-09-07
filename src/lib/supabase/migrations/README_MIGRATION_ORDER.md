# Migration Order and Dependencies

This document tracks the order and dependencies of database migrations.

## Migration Sequence

### Initial Setup (001-010)
- `001_create_sqp_tables.sql` - Base SQP tables
- `002_create_sqp_views.sql` - Materialized views for analytics
- `003_create_public_views.sql` - Public schema views
- `004_fix_permissions.sql` - Permission fixes
- `005_fix_trigger_permissions.sql` - Trigger permission fixes
- `006_add_update_triggers.sql` - Update timestamp triggers
- `007_add_sync_tracking.sql` - BigQuery sync tracking
- `008_create_performance_report_functions.sql` - Performance reporting functions
- `009_create_dashboard_views.sql` - Dashboard view definitions
- `010_create_public_views.sql` - Additional public views

### Data Structure Updates (011-020)
- `011_create_daily_sqp_data.sql` - Daily data aggregation table
- `012_fix_seed_function.sql` - Seed function fixes
- `013_restructure_for_bigquery_schema.sql` - **Major schema change** - Nested BigQuery structure
- `014_update_period_comparisons_view.sql` - Update views for new schema
- `015_add_missing_weekly_summary_columns.sql` - Add cart_adds columns
- `016_create_public_sync_views.sql` - Public views for sync monitoring
- `017_fix_summary_table_permissions.sql` - Permission fixes for summary tables
- `018_create_brand_management_tables.sql` - Brand management system
- `019_create_brand_extraction_functions.sql` - Automated brand extraction
- `020_add_product_title_column.sql` - Product titles for brand extraction

### Brand and Optimization (021-030)
- `021_populate_initial_brands.sql` - Initial brand data
- `022_create_weekly_update_functions.sql` - Weekly update automation
- `023_create_brand_optimization_indexes.sql` - Performance indexes
  - `023a_add_missing_columns_and_fix_indexes.sql` - Column additions
  - `023b_create_remaining_indexes.sql` - Additional indexes
  - `023c_create_brand_performance_views.sql` - Brand performance views
- `024_create_period_comparison_views.sql` - Period comparison infrastructure
- `030_create_weekly_summary_view.sql` - Weekly summary generation

### Consolidated Infrastructure (031-035)
- `031_consolidated_infrastructure.sql` - **Consolidated**:
  - Keyword analysis functions
  - Refresh infrastructure tables
  - Brand dashboard views
  - ASIN column fixes
- `032_consolidated_brand_views.sql` - **Consolidated**:
  - Refresh helper functions
  - Brand dashboard views and fixes
- `033_consolidated_edge_functions.sql` - **Consolidated**:
  - Daily brand metrics
  - Public views for edge functions
  - Brand query metrics
- `034_add_webhook_notifications.sql` - Webhook infrastructure
- `035_fix_get_table_columns_ambiguity.sql` - Function ambiguity fix

### Renumbered Migrations (036-047)
- `036_add_post_sync_brand_extraction.sql` - Post-sync brand extraction trigger
- `037_create_rolling_average_views.sql` - Rolling average calculations
- `038_create_anomaly_detection_functions.sql` - Anomaly detection system
- `039_create_public_views_for_sqp_tables.sql` - Public schema SQP views
- `040_add_automatic_brand_matching.sql` - Automatic brand matching
- `041_add_brand_matching_functions.sql` - Brand matching RPC functions
- `042_create_report_configuration_tables.sql` - Report configuration system
- `043_create_trend_classification_functions.sql` - Trend classification
- `044_create_period_comparison_functions.sql` - Period comparison functions
- `045_create_period_comparison_public_views.sql` - Public period comparison views
- `046_create_public_rpc_wrappers.sql` - Public RPC function wrappers
- `047_create_search_performance_summary_view.sql` - Search performance summary

## Major Dependencies

### Schema Dependencies
1. Base tables (001) must exist before:
   - Views (002, 003)
   - Triggers (006)
   - Functions that reference them

2. BigQuery restructure (013) affects:
   - All subsequent views and functions
   - Sync processes
   - API queries

3. Brand tables (018) required for:
   - Brand extraction (019, 036)
   - Brand performance views (023c)
   - Brand matching functions (040, 041)

### Function Dependencies
- Performance functions (008) used by dashboard views (009)
- Brand extraction (019) requires brand tables (018)
- Period comparison functions (044) used by public views (045)

## Testing Order

When applying migrations to a fresh database:
1. Run migrations 001-030 in sequence
2. Run consolidated migrations 031-033
3. Run migrations 034-047 in sequence
4. Verify all objects created successfully
5. Run test data seeds if needed

## Rollback Procedures

Each migration should have a corresponding rollback:
- Tables: `DROP TABLE IF EXISTS`
- Views: `DROP VIEW IF EXISTS`
- Functions: `DROP FUNCTION IF EXISTS`
- Indexes: `DROP INDEX IF EXISTS`

Always backup before applying migrations to production.

---
*Last updated: 2025-09-06*
*Total migrations: 47 (after consolidation)*