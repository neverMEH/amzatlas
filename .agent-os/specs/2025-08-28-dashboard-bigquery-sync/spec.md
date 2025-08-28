# Spec Requirements Document

> Spec: Dashboard BigQuery Sync
> Created: 2025-08-28

## Overview

Implement automated data synchronization from BigQuery to Supabase tables with daily scheduled triggers to populate SQP Intelligence Platform dashboards. This feature will ensure dashboards display real-time Amazon seller performance data while maintaining fast load times through optimized Supabase views.

## User Stories

### Amazon Seller Data Visibility

As an Amazon seller, I want to see my weekly Search Query Performance data automatically updated in the dashboard, so that I can monitor keyword performance trends without manual data imports.

The system will check daily for new weekly data in BigQuery, transform it to match Supabase schema requirements, and update the relevant tables. Users will see their latest performance metrics including impressions, clicks, purchases, and conversion rates displayed in real-time charts and visualizations.

### Agency Multi-Client Dashboard

As an agency managing multiple Amazon seller accounts, I want to see aggregated performance metrics across all clients updated daily, so that I can identify optimization opportunities and generate automated reports.

The sync process will handle multi-tenant data segregation, ensuring each client's data remains isolated while enabling agency-level aggregations. Performance dashboards will update automatically after each sync cycle.

## Spec Scope

1. **BigQuery to Supabase Data Pipeline** - Daily scheduled function to extract weekly SQP data from BigQuery and populate Supabase tables
2. **Data Transformation Layer** - Convert BigQuery schema to match Supabase sqp.weekly_summary and related tables with proper data types
3. **Incremental Update Logic** - Check for new weekly periods and only sync data that hasn't been previously imported
4. **Dashboard Report Implementation** - Replace mock data endpoints with real Supabase queries for all performance, diagnostic, and actionable reports
5. **Report Components Update** - Implement 13 specific reports across three categories using actual SQP data
6. **Dashboard API Optimization** - Ensure all report endpoints efficiently query Supabase views for fast load times
7. **Monitoring and Alerting** - Track sync status, failures, and data quality issues with proper error handling

## Out of Scope

- Real-time streaming data updates (will use daily batch processing)
- Historical data migration beyond 90 days
- Custom dashboard creation or modification
- Direct BigQuery access from frontend
- User-triggered manual sync operations

## Expected Deliverable

1. Functional daily sync process that automatically populates Supabase tables with latest BigQuery data
2. Updated dashboards displaying current week's performance metrics with sub-second load times
3. Fully implemented report suite with 13 reports across Performance, Diagnostic, and Actionable categories
4. All dashboard components using real Supabase data instead of mock data
5. Monitoring dashboard showing sync status, last run time, records processed, and any errors