# Spec Tasks

These are the tasks to be completed for cleaning up duplicate migrations and unused database objects to improve maintainability.

> Created: 2025-09-06
> Status: Ready for Implementation

## Tasks

- [ ] 1. Analyze and Document Current Migration State
  - [ ] 1.1 Write tests for migration analysis scripts
  - [ ] 1.2 Create migration analysis report documenting all duplicates and issues
  - [ ] 1.3 Identify which migrations have been successfully applied to production
  - [ ] 1.4 Document dependencies between migrations and database objects
  - [ ] 1.5 Create backup of all migration files before cleanup
  - [ ] 1.6 Verify all analysis tests pass

- [ ] 2. Clean Up Duplicate Migration Files
  - [ ] 2.1 Write tests for migration consolidation logic
  - [ ] 2.2 Consolidate multiple 031_* ASIN column fix migrations into one working version
  - [ ] 2.3 Renumber all migrations after 030 to have unique sequential numbers
  - [ ] 2.4 Remove duplicate migration files that create identical objects
  - [ ] 2.5 Update migration order documentation
  - [ ] 2.6 Verify all consolidation tests pass

- [ ] 3. Identify and Remove Unused Database Objects
  - [ ] 3.1 Write tests for unused object detection
  - [ ] 3.2 Analyze tables with 0 rows (brand_query_stats, report_configurations, report_recipients, report_execution_history, report_queue, refresh_data_quality, refresh_checkpoints, webhook_deliveries)
  - [ ] 3.3 Scan codebase to confirm these empty tables are not referenced
  - [ ] 3.4 Identify early migration objects (002_create_sqp_views.sql materialized views) that are unused
  - [ ] 3.5 Generate DROP statements for unused tables, views, and their associated migrations
  - [ ] 3.6 Create rollback migration in case objects need to be restored
  - [ ] 3.7 Verify all detection tests pass

- [ ] 4. Create Cleanup Migration and Documentation
  - [ ] 4.1 Write tests for cleanup migration validation
  - [ ] 4.2 Create consolidated cleanup migration file
  - [ ] 4.3 Document all removed objects and reasons for removal
  - [ ] 4.4 Update CLAUDE.md with new migration structure
  - [ ] 4.5 Create migration cleanup guide for future reference
  - [ ] 4.6 Verify all validation tests pass

- [ ] 5. Apply Changes and Verify System Integrity
  - [ ] 5.1 Write integration tests for post-cleanup system
  - [ ] 5.2 Apply cleanup migration to development environment
  - [ ] 5.3 Run full test suite to ensure no functionality is broken
  - [ ] 5.4 Verify all APIs continue to function correctly
  - [ ] 5.5 Document any required code changes due to cleanup
  - [ ] 5.6 Verify all integration tests pass