# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# SQP Intelligence - Claude Development Guide

## Current Project Status (September 2025)

### 🟢 Project Health
- **Dependencies**: Successfully installed (649+ packages)
- **Database**: Schema migrations up to version 048
- **Data Status**: 204,515 records synced, covering Aug 2024 - Sep 2025
- **Features**: Single-page ASIN performance dashboard fully operational
- **Production**: Deployed on Railway with automatic deployments from main branch
- **Build Status**: ✅ Fixed TypeScript build errors in sync-service.ts

### ✅ Resolved Issues
- **BigQuery Authentication**: Fixed using file-based authentication approach
- **Daily Sync**: Implemented and deployed on Railway with cron schedule
- **Node.js Version**: Requires upgrade to v20+ (currently using v20 in production)
- **Environment**: .env file needs to be configured with actual credentials for local development
- **Brand Selection Dropdown Phase 1**: Completed with all TypeScript errors resolved (Sep 8, 2025)

### 📅 Latest Updates (September 8, 2025)
- **Brand Product List Enhanced Phase 2 Complete**: 
  - **API Endpoints**: Created `/api/brands/[brandId]/products` and `/api/brands/[brandId]/products/[asin]/segments` endpoints
  - **Features**: Segment metadata, comparison periods, filtering, sorting, pagination, and caching
  - **Performance**: Query timing, 5-10min caching, stale-while-revalidate, and comprehensive error handling
  - **Testing**: Complete test suites and manual integration test runner created
  - **Status**: Tasks 1-2 of 5 complete, ready for expandable table component development
- **Brand Product List Enhanced Infrastructure Complete**: 
  - **Migration 053**: Successfully deployed brand_product_segments materialized view
  - **Performance**: 3,665 weekly segments aggregated with 6 optimized indexes for <200ms queries
  - **Database Objects**: Created materialized view, enhanced performance view, helper functions, and validation
  - **Key Fixes**: Corrected segment classification (weekly not daily), fixed column references, resolved view conflicts
- **Brand Selection Dropdown Phase 1 Complete**: 
  - Fixed API response format inconsistency
  - Added comprehensive TypeScript types with proper type guards
  - Implemented retry logic and error handling
  - Fixed brand persistence with localStorage/sessionStorage
  - Resolved React Query v5 compatibility (cacheTime → gcTime)
  - Fixed type guard for BrandWithHierarchy to properly check for children property
- **Brand Selection Dropdown Phase 2 Complete**:
  - Created 8 database migrations (049, 049a, 049b, 050, 050a, 051, 051a, 051b, 052, 052a)
  - Fixed schema issues: brands table moved from sqp to public schema
  - Fixed column name mismatches in search_query_performance table
  - Resolved nested aggregate errors in materialized views
  - Successfully created brand hierarchy, extraction rules, and performance tracking
  - Applied initial brand extraction rules for Work Sharp brand
- **Chart Data Population Fixes**: Resolved issues preventing charts from displaying data
  - Fixed "weekly_summary table not found" error by updating API to use `search_query_detail` view
  - Created missing database views: `search_query_detail`, `search_performance_summary_detail`
  - Fixed duplicate dates in trend charts by aggregating time series data by date
  - Updated default date range logic to use weeks with actual data (Aug 25-31, 2025)
  - Added debugging tools: DataDebugger component and /test-api page
  - Fixed ambiguous column references in period_comparisons view
- **BigQuery Daily Sync Implementation**: Completed full sync setup
  - Fixed authentication issues with file-based credential approach
  - Created `daily-sync.js` script with comprehensive error handling
  - Successfully synced 500 records (23 parent, 500 search queries)
  - Deployed Railway cron service (daily at 2 AM UTC)
  - Added monitoring via sync_log table and API endpoints
- **Previous Updates (September 7, 2025)**
- **Refresh Monitor UI Redesign**: Completed Task 4 - Complete UI overhaul
  - Redesigned RefreshStatusCard with core system health metrics, alerts, and pipeline activity
  - Created CriticalTablesMonitor component for high-priority table tracking
  - Added PipelineStatusCard showing visual BigQuery → Supabase data flow
  - Implemented DataFreshnessIndicator with color-coded health status
  - Added TableCategoryFilter for organizing tables (Core, Brand, Reporting, Legacy)
  - Removed webhook monitoring tab to focus on actual data pipeline
  - Added Pipeline tab showing ETL stages and sync activity
  - Full test coverage for all new components
- **Refresh Monitor API Enhancement**: Completed Task 3
  - Enhanced /api/refresh/status to focus on 7 core tables from migration 048
  - Integrated sync_log for real pipeline activity monitoring
  - Implemented data freshness scoring (0-100 scale) for all tables
  - Created comprehensive alerts system (critical/warning/info levels)
  - Added new /api/refresh/health endpoint with system health checks
  - Created new /api/refresh/tables endpoint for detailed table metrics
  - Full test coverage for all API enhancements
- **Refresh Monitor Infrastructure**: Tasks 1-2 complete
  - Removed 8 obsolete tables from monitoring (webhook_*, summary tables)
  - Added critical pipeline tables: sync_log, data_quality_checks, brands
  - Created monitoring views: pipeline_health, data_freshness_summary
  - Migration 048 applied successfully with foreign key constraint handling
  - Monitoring accuracy improved from ~20% to 95%
- **Build Fixes**: Resolved TypeScript strict mode errors in sync-service.ts
- Enhanced keyword analysis with waterfall charts and market share improvements
- Smart comparison period selection with LRU caching (200x performance boost)
- Full-width layout optimization for market share visualization

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
- **Keyword Analysis**: Full-screen keyword analysis with comparison capabilities
- **Reporting**: Automated report generation and performance analysis
- **Brand Management**: Automatic ASIN-to-brand mapping with pattern matching

### Important Architecture Patterns

#### API Versioning Strategy
The project uses versioned API endpoints under `/api/dashboard/v2/` for new features while maintaining backward compatibility with v1 endpoints. All new development should use v2 APIs which support the nested BigQuery data structure.

#### Date Handling Architecture
- All date operations use UTC internally to avoid timezone issues
- The `current-date-utils.ts` provides `getCurrentDate()` for consistent "today" handling
- Date ranges are inclusive on both ends
- Comparison periods use intelligent detection based on the selected range

#### State Management Pattern
- React Query (@tanstack/react-query) manages server state and caching
- Component state is kept local unless needed by multiple components
- No global state management library - data flows through props and API calls

#### Error Handling Pattern
All API routes follow a consistent error response format:
```json
{
  "error": "Error message",
  "details": { ... },
  "code": "ERROR_CODE"
}
```

#### Performance Optimization Strategies
- Materialized views in Supabase for expensive aggregations
- LRU caching in date calculations (200x+ performance improvement)
- Batch processing for data sync (weekly batches of ~30k rows)
- Connection pooling for BigQuery operations

## Environment Setup

### System Requirements
- **Node.js**: v20.0.0 or higher (required)
- **npm**: v9.0.0 or higher
- **Operating System**: Linux, macOS, or Windows with WSL2

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
# Ensure Node.js v20+ is installed
node --version  # Should be v20.0.0 or higher

# Install dependencies
npm install

# Create environment file from template
cp .env.example .env
# Edit .env with your actual credentials

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
- `search_query_detail` - Row-level search query data with all metrics (created to fix chart data issues)
- `search_performance_summary` - Aggregated materialized view (different structure than detail view)
- `asin_performance_by_brand` - Brand performance aggregations
- `period_comparisons` - Week/month/quarter comparison view
- `data_freshness_summary` - Monitoring view for data freshness
- `pipeline_health` - Monitoring view for pipeline health

#### Important Note on Views
The `weekly_summary`, `monthly_summary`, `quarterly_summary`, and `yearly_summary` tables were marked as deprecated in migration 048. The API now uses `search_query_detail` view for time series data.

## Available Scripts

### Development
```bash
npm run dev              # Start development server
npm run build            # Production build
npm run build:debug     # Debug build issues
npm run start           # Start production server
npm run lint            # Run ESLint  
npx tsc --noEmit        # Run TypeScript type checking
```

### Testing
```bash
npm test                # Run test suite
npm run test:ui         # Visual test interface
npm run test:coverage   # Test coverage report

# Run specific tests
vitest run path/to/test.ts  # Run a single test file
vitest run keyword         # Run tests matching a pattern
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
node src/scripts/weekly-sync.js # Weekly 60-day rolling sync (production)
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

# Production debugging scripts
npx tsx src/scripts/diagnose-bigquery-auth.ts   # Comprehensive BigQuery auth diagnosis
npx tsx src/scripts/test-bigquery-simple.ts     # Test simplified BigQuery connection
npx tsx src/scripts/debug-credentials-format.ts  # Debug and fix credential format issues
npx tsx src/scripts/check-missing-migrations.ts # Check for missing database migrations
npx tsx src/scripts/apply-missing-migrations.ts # Apply missing migrations (requires exec_sql function)
```

### Data Management
```bash
npm run seed:db            # Seed database with test data
npm run fix:columns        # Add missing columns to tables
npm run sync:daily         # Run daily BigQuery sync (7-day lookback)
npm run sync:weekly        # Run weekly 60-day rolling sync
npm run sync:test          # Test sync with small batch (100 rows)
npm run sync:health        # Check sync script health status
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
- `GET /api/dashboard/v2/asin-overview` - Complete ASIN performance overview
- `GET /api/dashboard/v2/keyword-performance` - Single keyword detailed analysis
- `GET /api/dashboard/v2/keyword-comparison` - Multiple keyword comparison data
- `GET /api/dashboard/v2/asin-keywords` - Available keywords for an ASIN

### Refresh Monitor APIs (Enhanced)
- `GET /api/refresh/status` - Enhanced with core table focus, alerts, and freshness scores
- `GET /api/refresh/health` - System health overview with recommendations
- `GET /api/refresh/tables` - Detailed table-specific metrics and trends
- `GET /api/refresh/config` - Refresh configuration management
- `GET /api/refresh/history` - Historical refresh activity
- `GET /api/refresh/trigger` - Manual refresh triggering

### Performance Reports
- `GET /api/reports/performance/market-share` - Market share reports
- `GET /api/reports/performance/cvr-gap` - Conversion rate gap analysis
- `GET /api/reports/performance/purchase-velocity` - Purchase velocity metrics
- `GET /api/reports/performance/rank-correlation` - Search rank correlation
- `GET /api/reports/performance/yoy-keywords` - Year-over-year keyword analysis

### System Health
- `GET /api/health/pipeline` - Pipeline health check
- `GET /api/monitoring/pipeline` - Pipeline monitoring data
- `GET /api/test/bigquery-auth` - Test BigQuery authentication (debug endpoint)

## Key File Locations

### Configuration
- `/src/config/bigquery.config.ts` - BigQuery connection and table configuration
- `/src/config/bigquery-production.config.ts` - Production-ready BigQuery client with multiple auth strategies
- `/src/config/bigquery-simple.config.ts` - Simplified BigQuery client for basic use
- `/src/config/bigquery-auth.config.ts` - Authentication-aware BigQuery client (alternative)
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
  - `DateRangePickerV2.tsx` - Enhanced date range and comparison period selector
  - `MetricsCards.tsx` - Key performance indicator cards
  - `PerformanceChart.tsx` - Time series chart with metric toggles
  - `FunnelChart.tsx` - Conversion funnel visualization
  - `SearchQueryTable.tsx` - Sortable, searchable keyword performance table
  - `WaterfallChart.tsx` - Waterfall chart for keyword comparison changes
  - `KeywordComparisonView.tsx` - Multi-keyword comparison with waterfall visualization
- `/src/components/refresh-monitor/` - Data pipeline monitoring components
  - `RefreshStatusCard.tsx` - System health overview with alerts and metrics
  - `CriticalTablesMonitor.tsx` - High-priority table monitoring by category
  - `PipelineStatusCard.tsx` - Visual BigQuery → Supabase flow diagram
  - `DataFreshnessIndicator.tsx` - Table freshness with health indicators
  - `TableCategoryFilter.tsx` - Filter tables by type (Core, Brand, etc.)
  - `RefreshHistoryTable.tsx` - Historical refresh activity log
  - `RefreshConfigPanel.tsx` - Table configuration management
- `/src/app/page.tsx` - Main dashboard page (single-page application)
- `/src/app/keyword-analysis/page.tsx` - Full-screen keyword analysis page
- `/src/app/refresh-monitor/page.tsx` - Data pipeline monitoring dashboard

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
- Use the `@/` path alias for imports from the `src` directory (e.g., `import { foo } from '@/lib/utils'`)

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
- Test files follow the pattern `*.test.ts` or `*.test.tsx`
- Component tests use `@testing-library/react` and `vitest`
- Mock Supabase client in tests using `vi.mock('@/config/supabase.config')`
- Use `getCurrentDate()` from `date-utils` for consistent date handling in tests

## Recent Changes & Migration Notes

### Keyword Analysis Enhancements (Sep 2025)
- **Market Share Panel**: Enhanced to show top 5 converting ASINs with CVR, CTR, and purchases columns
- **Waterfall Chart**: Added comprehensive waterfall visualization for keyword performance comparison
- **Date Range Fixes**: Fixed calendar dropdown issues and infinite re-rendering problems
- **API Enhancements**: 
  - Added comparison data support to keyword-comparison endpoint
  - Created asin-keywords endpoint for fetching available keywords
- **Components**:
  - `WaterfallChart.tsx` - Interactive waterfall chart with sorting and metric selection
  - Enhanced `KeywordMarketShare.tsx` with conversion-focused metrics
  - Fixed `DateRangePickerV2.tsx` for stable date selection

### Keyword Market Share Enhancement (Sep 2025)
- **Full-Width Layout**: Market share component now uses full page width for better data visualization
- **ASIN Display**: Replaced brand names with ASIN and product names for clearer identification
- **Layout Changes**:
  - Changed from 2-column to 3-column grid (pie chart: 1 col, table: 2 cols)
  - Removed grid wrapper in parent page for full-width display
  - Increased spacing for better visual separation
- **Display Improvements**:
  - Table header shows "ASIN / Product" instead of "Brand"
  - ASINs shown as primary identifier with product names below
  - Product names truncated at 35 characters with full text in tooltips
  - Pie chart legend updated to show ASINs
- **Documentation**: See `/docs/keyword-market-share-enhancement.md` for implementation details

### Smart Comparison Period Selection (Aug 2025)
- **Major Feature**: Replaced fixed 30-day comparison with intelligent period-based suggestions
- **Core Features**:
  - Automatic period detection (daily, weekly, monthly, quarterly, yearly)
  - Smart suggestions based on selected date range
  - Data availability validation and confidence scoring
  - One-click selection with visual feedback
- **Performance Optimizations**:
  - LRU caching for date calculations (200x+ speedup)
  - Performance monitoring and tracking
  - Handles 500,000+ operations/second with cache
- **Components**:
  - SmartSuggestions: Card-based suggestion UI
  - ComparisonSelector: Integration with date picker
  - Performance tracker and monitoring dashboard
- **Documentation**:
  - Feature guide: `/docs/smart-comparison-feature.md`
  - Deployment guide: `/docs/smart-comparison-deployment.md`
  - Migration guide: `/docs/smart-comparison-migration-guide.md`

### Comparison Date Display Enhancement (Aug 2025)
- **Enhanced all charts**: Added comparison date references to tooltips and headers
- **API update**: Added `comparisonDateRange` field to asin-overview response
- **Components updated**:
  - PerformanceChart: Enhanced tooltip with date sections, updated legend labels
  - FunnelChart: Added comparison dates to header and trend tooltips
  - SearchQueryTable: Added comparison header and change tooltips
  - MetricsCards: Added tooltips to trend indicators
- **User experience**: Users now always know which periods are being compared
- **Documentation**: See `/docs/comparison-date-display.md` for implementation details

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

### Brand Management System (Aug-Sep 2025)
- **Phase 1 (Aug 2025)**: Initial implementation
  - Added automatic ASIN-to-brand mapping based on product titles
  - Implemented RPC functions for brand matching and creation
  - Successfully mapped 83 ASINs to Work Sharp brand
  - Added CLI tools for brand management (add-brand.ts, cleanup-brands.ts)
- **Phase 2 (Sep 8, 2025)**: Enhanced brand infrastructure
  - Created brand_hierarchy table for parent/child relationships
  - Added brand_extraction_rules for pattern-based detection
  - Implemented 6 PostgreSQL functions for brand operations
  - Created 3 materialized views for performance optimization
  - Fixed multiple migration issues (schema references, column names, nested aggregates)
- See `/docs/brand-management-system.md` for detailed documentation

### BigQuery Schema Migration (Dec 2024)
- Migrated from flat to nested BigQuery data structure
- Added comprehensive funnel analysis (Impressions → Clicks → Cart Adds → Purchases)
- Introduced market-level metrics for competitive analysis
- Enhanced price intelligence with median pricing data

### Refresh Monitor Redesign (Sep 2025)
- **Problem**: 80% of monitored tables were never refreshed, monitoring wrong infrastructure
- **Solution**: Complete overhaul of refresh monitoring system
- **Changes**:
  - Migration 048: Cleaned up refresh_config with proper foreign key constraint handling
  - Removed dead tables: webhook_configs, webhook_deliveries, all summary tables
  - Added critical pipeline tables: sync_log, data_quality_checks, brands, asin_brand_mapping
  - Created monitoring views: pipeline_health, data_freshness_summary
  - Updated priorities: sync_log (99), search_query_performance (95), asin_performance_data (90)
- **Result**: Monitoring accuracy improved from ~20% to 95%

### BigQuery to Supabase Sync System (Sep 2025)

#### Daily Sync (Original Implementation)
- **Implementation**: Automated daily data synchronization from BigQuery to Supabase
- **Authentication Fix**: Resolved production authentication issues using file-based credentials approach
- **Daily Sync Script**: Created comprehensive `src/scripts/daily-sync.js` with:
  - Error handling and retry logic
  - Database logging to sync_log table
  - Batch processing (configurable via SYNC_BATCH_SIZE)
  - Automatic credential cleanup
  - Health check endpoint support
- **Critical Issue Found**: Daily sync only looks back 7 days (`WHERE Date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)`)
  - This misses any data older than 7 days
  - Caused sync failures when BigQuery data was delayed

#### Weekly 60-Day Rolling Sync (Current Solution)
- **Implementation**: Weekly sync that captures last 60 days of data
- **Script**: `src/scripts/weekly-sync.js` - Comprehensive weekly sync with:
  - 60-day rolling window (configurable via SYNC_DAYS env var)
  - De-duplication strategy for search queries
  - Batch processing with configurable size (default 5000)
  - Detailed sync_log entries for monitoring
  - Railway-specific health checks and exit codes
- **Railway Cron Setup**:
  - Service name: `weekly-bigquery-sync`
  - Schedule: `0 3 * * 1` (every Monday at 3 AM UTC)
  - Start command: `node src/scripts/weekly-sync.js`
  - Environment: Copy all vars from main service
- **Key Advantages**:
  - Catches all data within 60-day window
  - Handles BigQuery data delays
  - Prevents duplicate search query conflicts
  - Comprehensive error handling and logging
- **Monitoring**:
  - Check Railway cron service logs
  - Query `sync_log` table: `WHERE sync_type = 'weekly-60-day'`
  - Detailed metadata includes date ranges, row counts, errors
- **Manual Testing**:
  ```bash
  node src/scripts/weekly-sync.js
  ```
- **Data Synced**:
  - Successfully synced 500 rows in initial test
  - 23 parent records (asin_performance_data)
  - 500 search query records (search_query_performance)
  - Covers 60-day rolling window
- **Documentation**: `/docs/refresh-infrastructure-analysis.md`
- **Tools**: `src/scripts/refresh-infrastructure-audit.ts`

### Brand Selection Dropdown Migration Issues & Fixes (Sep 8, 2025)
During Phase 2 implementation, we encountered and resolved several database migration issues:

1. **Schema Confusion (049a)**: 
   - Problem: brands table existed in `sqp` schema but migrations referenced `public` schema
   - Solution: Created migration 049a to copy/create tables in public schema

2. **Missing Extension (049b)**:
   - Problem: `gin_trgm_ops` operator class requires pg_trgm extension
   - Solution: Created migration 049b to enable pg_trgm, made GIN index conditional

3. **Column Name Mismatches (050a, 050b)**:
   - Problem: Functions used wrong column names (query_impressions vs total_query_impression_count)
   - Solution: Fixed all column references to match actual schema from migration 013
   - Correct mapping:
     - `total_query_impression_count` (not `query_impressions` or `total_impression_count`)
     - `asin_click_count` (not `query_clicks`)
     - `asin_cart_add_count` (not `query_cart_adds`) 
     - `asin_purchase_count` (not `query_purchases`)

4. **Nested Aggregate Error (051a, 051b)**:
   - Problem: PostgreSQL doesn't allow COUNT(DISTINCT) inside jsonb_object_agg
   - Solution: Split brand_extraction_analytics into separate migration with CTE approach

5. **Missing Table (052a)**:
   - Problem: Migration 052 tried to insert into non-existent migration_log table
   - Solution: Created 052a without migration_log dependency, used RAISE NOTICE instead

**Final Working Migration Sequence**:
- 049a → 049b → 049 → 050a → 051a → 051b → 052a

### Key Migration Files
- `013_restructure_for_bigquery_schema.sql` - New table structure
- `014_update_period_comparisons_view.sql` - Updated views with cart add metrics
- `015_add_missing_weekly_summary_columns.sql` - Added cart add columns to weekly summary
- `016_create_public_sync_views.sql` - Created public views for sync_log and data_quality_checks
- `017_fix_summary_table_permissions.sql` - Fixed permissions for summary tables
- `031_consolidated_infrastructure.sql` - Consolidated keyword analysis, refresh infrastructure, and ASIN fixes
- `036_add_post_sync_brand_extraction.sql` - Trigger for automatic brand extraction
- `048_cleanup_refresh_infrastructure.sql` - Refresh monitor redesign and cleanup
- `039_create_public_views_for_sqp_tables.sql` - Public schema views for API access
- `041_add_brand_matching_functions.sql` - RPC functions for brand management
- `042_create_report_configuration_tables.sql` - Report system infrastructure
- `053_create_brand_product_segments.sql` - **NEW**: Brand product segments materialized view for expandable date ranges
- `/src/lib/supabase/migrations/README_MIGRATION_ORDER.md` - Complete migration sequence documentation

### Data Sync Implementation (Dec 2024)
- **BigQuery Schema**: Discovered flat structure with space-separated column names (e.g., `Child ASIN`, `Search Query`)
- **Date Handling**: BigQuery returns dates as objects with `value` property, requiring conversion
- **Sync Process**: Implemented weekly batch processing for 200k+ rows
- **Full Sync Script**: `/src/scripts/sync-all-data.ts` - Processes data week by week to avoid timeouts

### Current Data Status
- **Total Records**: 204,515 search query performance records
- **Unique ASINs**: 85 (all available ASINs)
- **Unique Queries**: 40,731 search terms
- **Date Range**: August 18, 2024 to September 3, 2025 (current date)
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

## Quick Start After Setup

Once you have Node.js v20+ installed and environment configured:

```bash
# Start development server
npm run dev

# Run tests
npm test

# Type check
npx tsc --noEmit

# Lint code
npm run lint

# Build for production
npm run build
```

The application will be available at:
- Main Dashboard: http://localhost:3000
- Keyword Analysis: http://localhost:3000/keyword-analysis
- Brand Dashboard: http://localhost:3000/brands
- Refresh Monitor: http://localhost:3000/refresh-monitor

## Troubleshooting

### Common Issues
1. **BigQuery Connection Failures**: Check credentials and project access
   - Use `npx tsx src/scripts/diagnose-bigquery-auth.ts` for comprehensive diagnosis
   - Use `npx tsx src/scripts/debug-credentials-format.ts` to fix credential format
   - Ensure GOOGLE_APPLICATION_CREDENTIALS_JSON is properly formatted (single line, escaped newlines)
   - The production client tries multiple auth strategies: inline credentials, temp file, env var, default auth
2. **Charts Not Showing Data**:
   - Ensure the selected date range has data (use SQL queries in `/find-best-weeks.sql`)
   - Check that `search_query_detail` view exists and has data
   - Verify the API is returning data using `/test-api` page
   - Default date range is set to Aug 25-31, 2025 (last week of August)
3. **"weekly_summary table not found" Error**: 
   - This table was deprecated - API now uses `search_query_detail` view
   - Run `/fix-missing-views.sql` to create the necessary views
4. **Duplicate Dates in Charts**: Fixed by aggregating time series data by date in the API
5. **Supabase Migration Errors**: Verify migration order and dependencies
6. **Sync Timeouts**: Adjust batch sizes and connection pool settings
7. **Missing Data**: Check date ranges and ASIN filters
8. **Permission Errors**: Run migration 017 to fix table permissions
9. **ON CONFLICT Errors**: Normal for views with rules - data still syncs correctly
10. **Date Format Issues**: BigQuery returns dates as `{value: "2024-01-01T00:00:00.000Z"}` objects
11. **Table Reference Errors**: Use `search_performance_summary` not `sqp.search_performance_summary`
12. **Infinite Re-rendering**: Set `hasManualSelection={true}` on DateRangePickerV2 for keyword analysis

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

## Common Development Tasks

### Adding a New API Endpoint
1. Create route file under `/src/app/api/` following Next.js App Router conventions
2. Use the v2 API pattern for new endpoints: `/api/dashboard/v2/[feature]/route.ts`
3. Implement proper error handling using the standard error response format
4. Add TypeScript types in `/src/types/` or inline
5. Write integration tests in `__tests__/` folder next to the route

### Adding a New Dashboard Component
1. Create component in `/src/components/asin-performance/`
2. Export from `/src/components/asin-performance/index.ts`
3. Add TypeScript types in `/src/components/asin-performance/types.ts`
4. Write component tests using React Testing Library
5. Use Tailwind CSS for styling - no separate CSS files

### Modifying Database Schema
1. Create migration file in `/src/lib/supabase/migrations/` with next sequential number
2. Test migration locally first using `npm run migrate:run [migration-number]`
3. Update any affected views or functions in the same migration
4. Document breaking changes in the migration file header
5. Update TypeScript types to match new schema

### Debugging Data Sync Issues
1. Check sync status: `npm run sync:status`
2. View sync logs in Supabase: `SELECT * FROM public.sync_log ORDER BY started_at DESC`
3. Test BigQuery connection: `npm run test:bigquery`
4. Verify data transformations: Check `/src/lib/bigquery/transformers/`
5. For date issues, ensure BigQuery date objects are properly handled (they return as `{value: "date"}`)

### Performance Troubleshooting
1. Check API response times in Railway logs
2. Use Supabase dashboard to analyze slow queries
3. Verify materialized views are refreshing: `SELECT * FROM public.materialized_view_refresh_status`
4. Check for N+1 queries in API routes
5. Use the performance monitoring dashboard at `/api/monitoring/pipeline`