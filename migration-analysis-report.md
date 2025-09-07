# Supabase Migration Analysis Report
*Generated: 2025-09-06*

## Executive Summary

This report documents the current state of Supabase migrations and identifies opportunities for cleanup. The analysis reveals **significant duplication** and **unused database objects** that can be safely removed to improve maintainability.

### Key Findings
- **60 total migration files** with the highest number being 035
- **27 duplicate migration files** across 9 migration numbers
- **8 empty tables** with 0 rows that are candidates for removal
- **Multiple failed migration attempts** evidenced by duplicate ASIN column fixes

## Duplicate Migrations Analysis

### Critical Duplicates (Require Immediate Attention)

#### Migration 031 (6 files - Most Problematic)
1. `031_add_keyword_analysis_functions.sql` - Adds RPC functions for keyword analysis
2. `031_add_refresh_infrastructure.sql` - Creates refresh infrastructure tables (TESTED)
3. `031_create_brand_dashboard_views.sql` - Creates brand dashboard materialized views
4. `031_fix_asin_column_corrected.sql` - ASIN column fix attempt #1
5. `031_fix_asin_column_final_safe.sql` - ASIN column fix attempt #2
6. `031_fix_asin_column_simple.sql` - ASIN column fix attempt #3

**Recommendation**: Keep only `031_add_refresh_infrastructure.sql` as it's tested. Consolidate ASIN fixes into a single working migration.

#### Migration 033 (7 files - Most Duplicated)
1. `033_create_daily_brand_metrics_view.sql`
2. `033_create_minimal_public_views.sql`
3. `033_create_public_brand_query_view.sql`
4. `033_create_public_views_for_edge_functions.sql`
5. `033_create_public_views_for_edge_functions_current.sql`
6. `033_create_public_views_for_edge_functions_fixed.sql`
7. `033_recreate_brand_search_query_metrics.sql`

**Recommendation**: These appear to be iterative attempts to create edge function views. Consolidate into one migration.

#### Migration 032 (4 files)
1. `032_add_refresh_helper_functions.sql`
2. `032_add_refresh_helper_functions_fixed.sql`
3. `032_create_brand_dashboard_views_fixed.sql`
4. `032_recreate_asin_performance_by_brand.sql`

**Recommendation**: Keep the "_fixed" versions and remove originals.

### Other Duplicates

| Migration | Files | Recommendation |
|-----------|-------|----------------|
| 023 | 4 files (includes a,b,c suffixes) | Keep as-is - properly sequenced for dependencies |
| 025 | 2 files | Different functionality - renumber one to 036 |
| 026 | 2 files | Different functionality - renumber one to 037 |
| 027 | 4 files | Different functionality - renumber to 038-041 |
| 028 | 2 files | Related functionality - can be combined |
| 029 | 2 files | Different functionality - renumber one to 042 |

## Empty Tables Analysis

Based on the database inspection, the following tables have **0 rows** but have references in the codebase:

### Report System Tables (Implemented but Not Used)
1. **report_configurations** - Report configuration storage (12 references in API)
2. **report_recipients** - Report delivery recipients (4 references in API)
3. **report_execution_history** - Report execution tracking (14 references in API)
4. **report_queue** - Report processing queue (10 references in API)

*Created by: `027_create_report_configuration_tables.sql`*
*Status: API endpoints exist but feature appears unused in production*

### Infrastructure Tables (Partially Implemented)
5. **brand_query_stats** - Brand query performance tracking (3 references, mostly in test files)
6. **refresh_data_quality** - Data quality checks for refresh (3 references in tests)
7. **refresh_checkpoints** - Refresh process checkpoints (10 references, used in refresh monitor)
8. **webhook_deliveries** - Webhook delivery tracking (5 references, part of refresh monitor)

*Created by various migrations including `031_add_refresh_infrastructure.sql` and `034_add_webhook_notifications.sql`*
*Status: Part of the refresh-monitor feature at `/refresh-monitor`*

### Analysis Summary
- The report system has full API implementation but no data, suggesting it was built but never activated
- The refresh infrastructure is partially used by the refresh-monitor page
- These tables should NOT be dropped without confirming with stakeholders that these features are truly abandoned

## Unused Views and Functions

### Early Migration Objects (002_create_sqp_views.sql)
The following materialized views from migration 002 have limited usage:
- `sqp.weekly_trends` - Referenced in cleanup scripts and public views
- `sqp.monthly_trends` - Referenced in cleanup scripts and public views
- `sqp.top_keywords_by_period` - Referenced in cleanup scripts and public views
- `sqp.market_share` - Used by report generation service and dashboard views
- `sqp.year_over_year` - Referenced in period comparison functions
- `sqp.performance_scores` - Referenced in cleanup scripts and public views

**Note**: These views are referenced in migration 003 which creates public schema views for them, and some are used by the report generation service. They should be evaluated carefully before removal.

### Anomaly Detection Functions (026)
Migration `026_create_anomaly_detection_functions.sql` creates analysis functions with no apparent usage.

## Migration Cleanup Plan

### Phase 1: Backup Current State
```bash
# Create backup directory
mkdir -p migrations_backup_2025_09_06
cp -r src/lib/supabase/migrations/* migrations_backup_2025_09_06/
```

### Phase 2: Consolidate Duplicates
1. **031 series**: Create `031_consolidated_infrastructure.sql` combining:
   - Refresh infrastructure (from tested version)
   - Keyword analysis functions
   - Single ASIN column fix

2. **032 series**: Create `032_refresh_helpers_and_brand_views.sql`

3. **033 series**: Create `033_edge_function_views.sql`

### Phase 3: Renumber Remaining Duplicates
Starting from 036:
- 036_post_sync_brand_extraction.sql (was 025)
- 037_rolling_average_views.sql (was 025)
- 038_anomaly_detection_functions.sql (was 026)
- 039_public_views_for_sqp_tables.sql (was 026)
- ... continue sequential numbering

### Phase 4: Create Cleanup Migration
Create `043_remove_unused_objects.sql` to:
- DROP empty tables and their associated objects
- DROP unused materialized views from migration 002
- DROP unused functions

## Code References to Update

After cleanup, the following files may need updates:
- `/src/lib/supabase/migrations/README_MIGRATION_ORDER.md`
- Any deployment scripts referencing specific migration numbers
- Test files for removed objects

## Estimated Impact

- **Files to remove**: ~27 duplicate migration files
- **Tables to drop**: 0-8 tables (pending stakeholder confirmation on unused features)
- **Views to evaluate**: 6 materialized views from early migrations
- **Total cleanup**: ~35-40% reduction in migration complexity

## Important Considerations

1. **Empty Tables with API References**: The report and refresh infrastructure tables have full API implementations but no data. These features appear to be built but never activated. Stakeholder confirmation is required before removal.

2. **Early Materialized Views**: The views from migration 002 are referenced in public schema views and some are used by the report service. Consider keeping them if the report feature might be activated.

3. **Migration Dependencies**: Some duplicate migrations may have been applied in production. Careful testing is required to ensure cleanup doesn't break existing functionality.

## Next Steps

1. ✅ Complete migration analysis (this report)
2. Create comprehensive backup
3. Consolidate duplicate migrations
4. Renumber migrations sequentially
5. Create and test cleanup migration
6. Update documentation
7. Apply changes to development environment
8. Verify system integrity