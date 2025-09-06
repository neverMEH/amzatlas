# Spec Requirements Document

> Spec: Fix BigQuery Refresh with Real Data
> Created: 2025-09-06
> Status: Planning

## Overview

Execute and validate BigQuery refresh migrations to fix ASIN column length issue that is currently preventing data sync from completing successfully. The existing ASIN column in Supabase has a 10-character limit, but some ASINs in BigQuery are 11 characters, causing sync failures and incomplete data in the dashboard.

## User Stories

- As a data analyst, I need the BigQuery sync to work with all ASINs (including 11-character ones) so I can see complete data in the dashboard
- As a developer, I need reliable migration execution to ensure database schema changes are applied safely without data loss
- As a business user, I need access to all ASIN performance data without missing records due to technical limitations
- As a system administrator, I need confidence that the data pipeline is robust and handles all data variations properly

## Spec Scope

- Execute the existing ASIN column length migration (031_fix_asin_column_corrected.sql) against the real Supabase database
- Validate that the migration completes successfully without data corruption
- Test BigQuery sync with real production data to ensure all ASINs sync properly
- Verify dashboard displays all ASINs correctly including 11-character ones
- Monitor sync performance and data integrity after migration
- Document the execution process and results for future reference

## Out of Scope

- Creating new migration files (migrations already exist and have been tested)
- Modifying BigQuery source data structure
- Changing dashboard functionality beyond ensuring all data displays
- Performance optimization beyond validating the sync works correctly
- Mock or test data scenarios (focus is on real production data)

## Expected Deliverable

- Successfully executed migration with ASIN columns extended to VARCHAR(15)
- Complete BigQuery sync showing all ASINs in dashboard
- Validation report confirming data integrity and completeness
- Performance monitoring results showing sync stability
- Documentation of execution steps and any issues encountered

## Spec Documentation

- Tasks: @.agent-os/specs/2025-09-06-fix-bigquery-refresh-real-data/tasks.md