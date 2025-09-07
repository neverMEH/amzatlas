# Technical Architecture Details

## Database Schema (Supabase PostgreSQL)

### Core SQP Schema Tables
**Primary data tables in `sqp` schema:**

- **`asin_performance_data`** - Main ASIN-level performance data
  - Primary key: `id` (bigserial)
  - Unique constraint: `(start_date, end_date, asin)`
  - Contains date range and ASIN identifier

- **`search_query_performance`** - Detailed search query metrics
  - Foreign key: `asin_performance_id` → `asin_performance_data.id`
  - Comprehensive funnel metrics: impressions → clicks → cart adds → purchases
  - Market-level data: competitor pricing, shipping preferences
  - 50+ performance metrics per search query

- **`brands`** - Brand management and hierarchy
  - UUID primary key with brand name normalization
  - Supports parent-child brand relationships
  - Automatic brand extraction and mapping

- **`asin_brand_mapping`** - ASIN to brand associations
  - Maps ASINs to brands with confidence scoring
  - Supports manual overrides and verification
  - Tracks extraction method (automatic/manual/override)

### Materialized Views and Public Schema
**Optimized views for API performance:**

- **`search_performance_summary`** - Main view for dashboard APIs
- **`period_comparisons`** - Week/month/quarter comparison data
- **`weekly_summary`, `monthly_summary`, `quarterly_summary`, `yearly_summary`** - Time-based aggregations
- **Public schema views** - API-accessible views with proper permissions

### Migration System
- **47+ database migrations** applied sequentially
- **Key migrations:**
  - `013_restructure_for_bigquery_schema.sql` - Core table structure
  - `018_create_brand_management_tables.sql` - Brand system
  - `031_consolidated_infrastructure.sql` - Refresh infrastructure
  - `039_create_public_views_for_sqp_tables.sql` - API access layer

## BigQuery Integration

### Data Source Configuration
```typescript
datasets: {
  production: 'dataclient_amzatlas_agency_85',
  development: 'sqp_data_dev', 
  staging: 'sqp_data_staging'
}
location: 'US'
```

### Data Pipeline Architecture
- **Nested data processing** - Handles Amazon's complex nested JSON structure
- **Weekly batch processing** - Processes ~30k records per batch to avoid timeouts
- **Data transformation** - Flattens nested `dataByAsin.searchQueryData[]` structure
- **Connection pooling** - Manages BigQuery connections with retry logic

### ETL Process Flow
1. **Extract**: Query BigQuery tables with date-based filtering
2. **Transform**: Process nested JSON, calculate derived metrics
3. **Load**: Batch insert to Supabase with conflict resolution
4. **Validate**: Data quality checks and sync logging

## API Architecture

### Versioned API Strategy
- **v1 APIs** - Legacy endpoints for backward compatibility
- **v2 APIs** - Enhanced endpoints supporting nested data structure

### Key API Endpoints (30+ total)
**Dashboard APIs:**
- `/api/dashboard/v2/asin-overview` - Complete ASIN performance (274 lines)
- `/api/dashboard/v2/keyword-performance` - Single keyword analysis (466 lines) 
- `/api/dashboard/v2/keyword-comparison` - Multi-keyword comparison (237 lines)
- `/api/dashboard/v2/market-share` - Competitive analysis
- `/api/dashboard/v2/funnel-analysis` - Conversion funnel data

**Brand Management APIs:**
- `/api/brands/[brandId]/dashboard` - Brand-specific dashboard data
- `/api/brands/hierarchy` - Brand relationship tree
- `/api/brands/search` - Brand search and filtering

**System APIs:**
- `/api/health/pipeline` - System health monitoring
- `/api/refresh/status` - Data sync pipeline status
- `/api/monitoring/pipeline` - Performance metrics

## Edge Functions (Supabase)

### Data Processing Functions
- **`daily-refresh-orchestrator`** - Main sync orchestration
- **`refresh-asin-performance`** - ASIN data refresh
- **`refresh-daily-sqp`** - Daily aggregation updates
- **`refresh-search-queries`** - Search query data sync
- **`refresh-summary-tables`** - Materialized view updates
- **`webhook-processor`** - Webhook handling and notifications

### Monitoring Functions
- **`refresh-generic-table`** - Generic table refresh utility
- Pipeline health checks and error notification system

## Performance Optimizations

### Caching Strategy
- **LRU Cache** for date calculations - 200x performance improvement
- **React Query** client-side caching with 5-minute stale time
- **Materialized views** for expensive aggregations

### Database Optimizations
- **Indexes** on frequently queried columns (brand names, ASINs, dates)
- **Batch processing** for large data imports (weekly batches)
- **Connection pooling** for BigQuery and Supabase connections

### Frontend Optimizations
- **Next.js App Router** with static generation where possible
- **TypeScript** for compile-time optimization
- **Component-level state management** to avoid unnecessary re-renders

## Development Infrastructure

### Testing Architecture
- **Vitest** - 100+ test files across components and APIs
- **React Testing Library** - Component integration testing
- **Integration tests** - API endpoint validation
- **Performance tests** - Date calculation and comparison benchmarks

### Build & Deployment
- **Railway** - Automated deployment from main branch
- **Next.js** production build with TypeScript compilation
- **Environment management** - Railway environment variable injection
- **Health checks** - `/api/health/pipeline` endpoint monitoring

### Data Quality Monitoring
- **Sync logging** - Complete audit trail of data operations
- **Error handling** - Comprehensive error tracking and alerts
- **Data validation** - Schema validation and constraint checking
- **Performance monitoring** - Query execution time tracking