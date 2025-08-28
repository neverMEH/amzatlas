# Migration Order

Run migrations in this order to avoid dependency issues:

1. `001_create_sqp_tables.sql` - Creates base tables
2. `003_create_public_views.sql` - Creates public schema views
3. `004_fix_permissions.sql` - Fixes permissions
4. `005_fix_trigger_permissions.sql` - Fixes trigger permissions
5. `007_add_sync_tracking.sql` - Adds sync tracking tables
6. `009_create_dashboard_views.sql` - Creates dashboard views (replaces period_comparisons table with view)
7. `010_create_public_views.sql` - Updates public views
8. `011_create_daily_sqp_data.sql` - Creates daily data table
9. `012_fix_seed_function.sql` - Fixes seed function
10. `013_restructure_for_bigquery_schema.sql` - Adds new tables for nested BigQuery structure
11. `014_update_period_comparisons_view.sql` - Updates period_comparisons view with cart add columns

## Important Notes

- Migration 009 converts `period_comparisons` from a table to a view
- Migration 013 adds columns to tables but NOT to views
- Migration 014 handles the view updates separately

## Running Migrations

```bash
# Run all migrations in order
npm run migrate:run

# Or run specific migrations
npm run migrate:run -- 013_restructure_for_bigquery_schema.sql
npm run migrate:run -- 014_update_period_comparisons_view.sql
```