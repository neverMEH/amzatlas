# Brand Dashboard Integration Guide

## Overview

The Brand Dashboard provides a comprehensive view of all products and search queries for a specific brand, with comparison capabilities and detailed performance metrics.

## Implementation Status

### ✅ Completed Components

1. **Header with Brand Selector** (`/src/components/layout/Header.tsx`)
   - Dynamic brand loading from API
   - Persistent selection in localStorage
   - Responsive dropdown with search capability

2. **KPI Modules** (`/src/components/dashboard/KpiModules.tsx`)
   - 4 key metrics: Impressions, Clicks, Cart Adds, Purchases
   - Sparkline visualizations (20 data points)
   - Comparison mode with percentage changes
   - Loading and error states

3. **Product List Table** (`/src/components/dashboard/ProductList.tsx`)
   - Comprehensive metrics with 13 columns
   - Share metrics with color coding (green ≥40%, blue ≥25%, yellow <25%)
   - Sorting on all columns with visual indicators
   - Pagination (7-10 items per page)
   - Checkbox selection
   - Click navigation to ASIN performance dashboard
   - Comparison mode with indicators

4. **Search Query Table** (`/src/components/dashboard/SearchQueryList.tsx`)
   - Same features as Product List
   - Query-specific metrics and shares
   - Full sorting and pagination support

5. **Comparison Indicators** (`/src/components/dashboard/ComparisonIndicator.tsx`)
   - Green up arrow for positive changes
   - Red down arrow for negative changes
   - Handles null/undefined values gracefully

### 🚀 API Endpoints

1. **GET /api/brands**
   - Returns list of active brands
   - Used by Header component for brand selection

2. **GET /api/brands/[brandId]/dashboard**
   - Main dashboard data endpoint
   - Parameters:
     - `date_from`: Start date (YYYY-MM-DD)
     - `date_to`: End date (YYYY-MM-DD)
     - `comparison_date_from`: Optional comparison start
     - `comparison_date_to`: Optional comparison end
     - `product_limit`: Max products to return (default: 50)
     - `query_limit`: Max queries to return (default: 50)

3. **GET /api/products/[asin]/image**
   - Returns product image (currently placeholder)
   - Redirects to color-coded placeholder based on ASIN

### 📊 Database Schema

The following views/tables need to be created:

```sql
-- Migration 031_create_brand_dashboard_views.sql

-- ASIN share metrics
CREATE MATERIALIZED VIEW sqp.asin_share_metrics AS ...

-- Brand performance view
CREATE VIEW public.asin_performance_by_brand AS ...

-- Search query metrics by brand
CREATE MATERIALIZED VIEW sqp.brand_search_query_metrics AS ...
```

## Navigation Flow

1. **Entry Points**:
   - `/brands` - Redirects to first available brand
   - `/brands/[brandId]` - Direct brand dashboard access

2. **Brand Selection**:
   - Header dropdown allows switching between brands
   - Selection persists in localStorage
   - URL updates on brand change

3. **ASIN Navigation**:
   - Clicking a product row navigates to `/?asin=[ASIN]`
   - ASIN performance dashboard pre-selects the ASIN

## Testing

All components have comprehensive test coverage:

- Header: 9 tests
- KpiModules: 11 tests  
- ComparisonIndicator: 11 tests
- ProductList: 16 tests
- ProductListItem: 12 tests
- SearchQueryList: 15 tests
- SearchQueryListItem: 9 tests
- **Total**: 83 tests, all passing ✅

## Environment Setup

Required environment variables:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# BigQuery Configuration  
BIGQUERY_PROJECT_ID=your-project-id
BIGQUERY_DATASET=your-dataset
GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...}'
```

## Deployment Steps

1. **Database Setup**:
   ```bash
   # Apply migration
   npm run migrate:up
   ```

2. **Environment Configuration**:
   - Set all required environment variables
   - Verify Supabase connection
   - Test BigQuery access

3. **Build and Deploy**:
   ```bash
   npm run build
   npm run start
   ```

## Usage

1. Navigate to `/brands` or `/brands/[brandId]`
2. Select date range and optional comparison period
3. Toggle comparison mode to see period-over-period changes
4. Sort columns by clicking headers
5. Click product rows to view detailed ASIN performance

## Performance Considerations

- Materialized views for share calculations
- Pagination limits data transfer
- Sparkline data reduced to 20 points
- Connection pooling for database queries

## Future Enhancements

1. Real product images from S3/CDN
2. Export functionality (CSV/Excel)
3. Advanced filtering options
4. Saved views and preferences
5. Email reports integration