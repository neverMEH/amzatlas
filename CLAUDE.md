# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# SQP Intelligence - Claude Development Guide

## Project Overview

**SQP Intelligence** (Search Query Performance Intelligence) is a comprehensive data analysis and dashboard application for Amazon Search Query Performance data. The system extracts, processes, and visualizes data from BigQuery and syncs it to Supabase for real-time dashboard capabilities.

### Core Purpose
- Analyze Amazon Search Query Performance data to understand market share, conversion rates, and competitive positioning
- Provide comprehensive reporting on keyword performance, purchase velocity, and ROI trends
- Enable data-driven decision making for Amazon advertising and product optimization

### Technology Stack
- **Frontend**: Next.js 14 with React 18, TypeScript, TailwindCSS
- **Backend**: Node.js with TypeScript
- **Database**: Supabase (PostgreSQL) with custom `sqp` schema
- **Data Source**: Google BigQuery
- **Charts**: Recharts
- **State Management**: React Query (@tanstack/react-query)
- **Testing**: Vitest
- **Deployment**: Railway

## Architecture Overview

### Data Flow
1. **BigQuery Source**: Raw Amazon SQP data in nested structure
2. **ETL Pipeline**: Data extraction, transformation, and loading via custom sync scripts
3. **Supabase Storage**: Structured data in PostgreSQL with materialized views
4. **API Layer**: Next.js API routes serving processed data
5. **Dashboard**: Single-page React application with ASIN performance visualizations

### Key Components
- **BigQuery Client**: Connection pool and query management
- **Sync Engine**: Automated data synchronization with error handling
- **Dashboard**: Single-page ASIN performance dashboard with comprehensive metrics
- **Reporting**: Automated report generation and performance analysis
- **Brand Management**: Automatic ASIN-to-brand mapping with pattern matching

## Environment Setup

### Required Environment Variables
```bash
# BigQuery Configuration
BIGQUERY_PROJECT_ID=your-project-id
BIGQUERY_DATASET=dataclient_amzatlas_agency_85
BIGQUERY_DATASET_DEV=sqp_data_dev
BIGQUERY_DATASET_STAGING=sqp_data_staging
BIGQUERY_LOCATION=US
GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...}'

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Environment
NODE_ENV=development
```

### Initial Setup
```bash
# Install dependencies
npm install

# Apply database migrations
npm run migrate:run

# Verify BigQuery schema
npm run verify:schema

# Test connections
npm run debug:env
npm run debug:bigquery-config
```

## Database Schema

### Recent Schema Migration
The project recently migrated from a flat BigQuery structure to a nested structure that better reflects the actual Amazon SQP data format. Key changes:

#### New Tables (Migration 013)
- `sqp.asin_performance_data` - ASIN-level performance metrics
- `sqp.search_query_performance` - Detailed search query data with funnel metrics
- `sqp.search_performance_summary` - Materialized view for optimized querying

#### Enhanced Metrics
- **Cart Add Stage**: New funnel stage between clicks and purchases
- **Market Share**: Built-in competitive analysis metrics
- **Price Intelligence**: Median pricing data at each funnel stage
- **Shipping Preferences**: Customer delivery speed preferences

#### Schema Structure
```sql
-- Main ASIN data
asin_performance_data (start_date, end_date, asin)
  └── search_query_performance (search_query, funnel_metrics, pricing_data)
```

### Key Views and Tables
- `period_comparisons` - Week/month/quarter comparison view
- `weekly_summary`, `monthly_summary`, `quarterly_summary`, `yearly_summary` - Aggregated metrics
- `daily_sqp_data` - Daily performance tracking
- `search_performance_summary` - Optimized materialized view

## Available Scripts

### Development
```bash
npm run dev              # Start development server
npm run build            # Production build
npm run build:debug     # Debug build issues
npm run start           # Start production server
npm run lint            # Run ESLint
```

### Testing
```bash
npm test                # Run test suite
npm run test:ui         # Visual test interface
npm run test:coverage   # Test coverage report
```

### Database Operations
```bash
npm run migrate:up           # Apply pending migrations
npm run migrate:status       # Check migration status  
npm run migrate:run         # Run specific migration
npm run migrate:bigquery-schema  # Apply BigQuery schema migrations
```

### Data Sync & Pipeline
```bash
npm run sync:run            # Manual data sync from BigQuery
npm run sync:status         # Check sync status
npm run sync:nested-bigquery # Sync using new nested structure (single week)
npx tsx src/scripts/sync-all-data.ts # Full sync of all data (weekly batches)
npm run pipeline:run        # Run full data pipeline
npm run pipeline:status     # Check pipeline health
```

### Debugging & Testing
```bash
npm run debug:env              # Debug environment variables
npm run debug:bigquery-config  # Test BigQuery configuration
npm run debug:creds           # Debug credentials
npm run test:bigquery         # Test BigQuery connection
npm run test:new-apis         # Test v2 API endpoints
npm run verify:schema         # Verify BigQuery schema matches expectations
```

### Data Management
```bash
npm run seed:db            # Seed database with test data
npm run fix:columns        # Add missing columns to tables
```

## API Endpoints

### Dashboard APIs (v1)
- `GET /api/dashboard/metrics` - Core metrics summary
- `GET /api/dashboard/keywords` - Keyword performance data  
- `GET /api/dashboard/trends` - Trend analysis
- `GET /api/dashboard/market-share-trends` - Market share over time
- `GET /api/dashboard/roi-trends` - ROI trend analysis

### Enhanced APIs (v2) - New Nested Data Structure
- `GET /api/dashboard/v2/search-performance` - Comprehensive search metrics
- `GET /api/dashboard/v2/market-share` - Market share analysis
- `GET /api/dashboard/v2/funnel-analysis` - Conversion funnel data
- `GET /api/dashboard/v2/price-analysis` - Price competitiveness metrics
- `GET /api/dashboard/v2/top-queries` - Top performing search queries

### Performance Reports
- `GET /api/reports/performance/market-share` - Market share reports
- `GET /api/reports/performance/cvr-gap` - Conversion rate gap analysis
- `GET /api/reports/performance/purchase-velocity` - Purchase velocity metrics
- `GET /api/reports/performance/rank-correlation` - Search rank correlation
- `GET /api/reports/performance/yoy-keywords` - Year-over-year keyword analysis

### System Health
- `GET /api/health/pipeline` - Pipeline health check
- `GET /api/monitoring/pipeline` - Pipeline monitoring data

## Key File Locations

### Configuration
- `/src/config/bigquery.config.ts` - BigQuery connection and table configuration
- `/src/config/supabase.config.ts` - Supabase client configuration
- `/src/config/column-mappings.ts` - BigQuery to Supabase column mappings

### Data Layer
- `/src/lib/bigquery/` - BigQuery client, query builders, data transformers
- `/src/lib/supabase/` - Supabase client, migrations, sync utilities
- `/src/services/dashboard/` - Data services for dashboard APIs

### Frontend Components
- `/src/components/dashboard/` - Legacy dashboard UI components (removed)
- `/src/components/asin-performance/` - New single-page ASIN performance dashboard components
  - `ASINSelector.tsx` - ASIN selection dropdown
  - `DateRangePicker.tsx` - Date range and comparison period selector
  - `MetricsCards.tsx` - Key performance indicator cards
  - `PerformanceChart.tsx` - Time series chart with metric toggles
  - `FunnelChart.tsx` - Conversion funnel visualization
  - `SearchQueryTable.tsx` - Sortable, searchable keyword performance table
- `/src/app/page.tsx` - Main dashboard page (single-page application)

### Data Processing
- `/src/lib/bigquery/transformers/` - Data transformation utilities
- `/src/lib/supabase/sync/` - Data synchronization logic
- `/src/scripts/` - Utility scripts for data management

## Development Guidelines

### Code Organization
- Follow the established directory structure with clear separation of concerns
- Use TypeScript for all new code with proper type definitions
- Place reusable logic in `/src/lib/` directory
- Keep components focused and composable

### Database Migrations
- Always create migration files for schema changes
- Test migrations on development data before production
- Follow the established naming convention: `###_descriptive_name.sql`
- Update both tables and views when adding new columns

### Data Synchronization
- Use the new nested BigQuery sync for enhanced metrics
- Handle errors gracefully with proper logging
- Implement proper transaction management for data consistency
- Monitor sync performance and optimize batch sizes

### API Development
- Use consistent error handling patterns
- Implement proper input validation
- Return structured JSON responses
- Add appropriate logging for debugging

### Testing
- Write unit tests for data transformations and business logic
- Use integration tests for API endpoints
- Test both old and new data structures during migration period
- Maintain test coverage for critical paths

## Recent Changes & Migration Notes

### Dashboard Redesign (Aug 2025)
- **Complete dashboard overhaul**: Replaced multi-page dashboard with single-page ASIN performance report
- **Desktop-optimized**: Designed for 1920px width, removed all mobile responsiveness
- **Component architecture**: 
  - Removed legacy `/dashboard/*` routes and components
  - Created new `/src/components/asin-performance/` component library
  - Single-page application at root `/` route
- **Features implemented**:
  - ASIN selector with product titles and brands
  - Date range picker with comparison period support
  - Metrics cards showing KPIs with percentage changes
  - Performance chart with time series data and metric toggles
  - Conversion funnel visualization (Impressions → Clicks → Cart Adds → Purchases)
  - Search query performance table with sorting, filtering, and pagination
- **Test-driven development**: All components built with comprehensive test coverage
- **Production fixes**: Created migrations 029-030 to handle missing database objects

### Data Consistency Fix (Aug 2025)
- **Issue**: KPI metrics showed performance down while charts/tables showed performance up
- **Root Cause**: PerformanceChart was generating synthetic comparison data with inverted calculations
  - Formula `impressions * (1 - changes.impressions)` was backwards
  - If current period had 20% more impressions, it would show comparison as 80% of current
- **Solution**:
  - Modified API (`/api/dashboard/v2/asin-overview`) to return actual historical comparison time series
  - Added `comparisonTimeSeries` field with real data from comparison period
  - Updated PerformanceChart to use real comparison data instead of synthetic calculations
  - Fixed FunnelChart key mapping bug where "Cart Adds" wasn't properly mapped
  - Updated TypeScript interfaces to include new `comparisonTimeSeries` field
- **Result**: All dashboard components now show consistent and accurate comparison data
- **Files changed**: 
  - `src/app/api/dashboard/v2/asin-overview/route.ts`
  - `src/app/page.tsx`
  - `src/components/asin-performance/FunnelChart.tsx`
  - `src/lib/api/asin-performance.ts`

### Brand Management System (Aug 2025)
- Added automatic ASIN-to-brand mapping based on product titles
- Implemented RPC functions for brand matching and creation
- Successfully mapped 83 ASINs to Work Sharp brand
- Added CLI tools for brand management (add-brand.ts, cleanup-brands.ts)
- See `/docs/brand-management-system.md` for detailed documentation

### BigQuery Schema Migration (Dec 2024)
- Migrated from flat to nested BigQuery data structure
- Added comprehensive funnel analysis (Impressions → Clicks → Cart Adds → Purchases)
- Introduced market-level metrics for competitive analysis
- Enhanced price intelligence with median pricing data

### Key Migration Files
- `013_restructure_for_bigquery_schema.sql` - New table structure
- `014_update_period_comparisons_view.sql` - Updated views with cart add metrics
- `015_add_missing_weekly_summary_columns.sql` - Added cart add columns to weekly summary
- `016_create_public_sync_views.sql` - Created public views for sync_log and data_quality_checks
- `017_fix_summary_table_permissions.sql` - Fixed permissions for summary tables
- `025_add_post_sync_brand_extraction.sql` - Trigger for automatic brand extraction
- `026_create_public_views_for_sqp_tables.sql` - Public schema views for API access
- `027_add_brand_matching_functions.sql` - RPC functions for brand management
- `docs/bigquery-schema-migration.md` - Detailed migration guide
- `docs/brand-management-system.md` - Brand management documentation

### Data Sync Implementation (Dec 2024)
- **BigQuery Schema**: Discovered flat structure with space-separated column names (e.g., `Child ASIN`, `Search Query`)
- **Date Handling**: BigQuery returns dates as objects with `value` property, requiring conversion
- **Sync Process**: Implemented weekly batch processing for 200k+ rows
- **Full Sync Script**: `/src/scripts/sync-all-data.ts` - Processes data week by week to avoid timeouts

### Current Data Status
- **Total Records**: 204,515 search query performance records
- **Unique ASINs**: 85 (all available ASINs)
- **Unique Queries**: 40,731 search terms
- **Date Range**: August 18, 2024 to August 3, 2025 (51 weeks)
- **Sync Status**: Full data successfully synced to Supabase

### Backwards Compatibility
- Old APIs remain functional during transition period
- New v2 APIs provide enhanced functionality
- Both data structures are populated during sync

### Performance Considerations
- Materialized views optimize common queries
- Connection pooling manages BigQuery resources
- Batch processing handles large datasets efficiently
- Weekly sync batches prevent timeout issues
- Disabled auto-refresh triggers on materialized views for performance

## Troubleshooting

### Common Issues
1. **BigQuery Connection Failures**: Check credentials and project access
2. **Supabase Migration Errors**: Verify migration order and dependencies
3. **Sync Timeouts**: Adjust batch sizes and connection pool settings
4. **Missing Data**: Check date ranges and ASIN filters
5. **Permission Errors**: Run migration 017 to fix table permissions
6. **ON CONFLICT Errors**: Normal for views with rules - data still syncs correctly
7. **Date Format Issues**: BigQuery returns dates as `{value: "2024-01-01T00:00:00.000Z"}` objects

### Debug Commands
```bash
npm run debug:env              # Check environment setup
npm run debug:bigquery-config  # Test BigQuery configuration  
npm run test:bigquery         # Verify BigQuery connectivity
npm run verify:schema         # Validate schema consistency
```

### Monitoring
- Check `/api/health/pipeline` for system status
- Monitor Railway deployment logs for errors
- Use Supabase dashboard for database performance
- Review BigQuery query execution metrics

## Deployment

### Railway Configuration
- Automatic deployments from main branch
- Health checks on `/api/health/pipeline`
- Cron-based pipeline execution every 6 hours
- Environment variables managed through Railway dashboard

### Production Checklist
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] BigQuery permissions verified
- [ ] Health checks passing
- [ ] Monitoring alerts configured

## Additional Resources

- **Project Summary**: `/PROJECT_SUMMARY.md` - Comprehensive project overview
- **Migration Guide**: `/docs/bigquery-schema-migration.md` - Schema migration details
- **Migration Order**: `/src/lib/supabase/migrations/README_MIGRATION_ORDER.md` - Migration sequence
- **Supabase README**: `/src/lib/supabase/README.md` - Database documentation

For questions or issues, refer to the test scripts in `/src/scripts/` for debugging utilities and examples.