# BigQuery Schema Migration Guide

## Overview

This document describes the migration from the simplified flat BigQuery schema to the actual nested BigQuery structure for Amazon Search Query Performance (SQP) data.

## Schema Changes

### Old Schema (Flat Structure)
The previous implementation used a simplified flat structure:
- `search_query` - The search term
- `asin` - Amazon Standard Identification Number
- `date` - Query date
- `impressions` - Number of impressions
- `clicks` - Number of clicks
- `purchases` - Number of purchases

### New Schema (Nested Structure)
The actual BigQuery schema is hierarchical:

```
dataByAsin[]
├── startDate
├── endDate
├── asin
└── searchQueryData[]
    ├── searchQuery
    ├── searchQueryScore
    ├── searchQueryVolume
    ├── impressionData
    │   ├── totalQueryImpressionCount
    │   ├── asinImpressionCount
    │   └── asinImpressionShare
    ├── clickData
    │   ├── totalClickCount
    │   ├── totalClickRate
    │   ├── asinClickCount
    │   ├── asinClickShare
    │   ├── totalMedianClickPrice
    │   ├── asinMedianClickPrice
    │   └── shipping speed counts
    ├── cartAddData (similar structure to clickData)
    └── purchaseData (similar structure to clickData)
```

## Key Improvements

### 1. Market Context
- **Total market metrics**: See how the entire market performs for each query
- **Market share calculations**: Built-in share metrics for impressions, clicks, cart adds, and purchases
- **Competitive analysis**: Compare ASIN performance against the market

### 2. Enhanced Funnel Analysis
- **Cart Add stage**: New intermediate step between clicks and purchases
- **Funnel rates**: Pre-calculated rates at each stage
- **Drop-off analysis**: Understand where customers leave the funnel

### 3. Price Intelligence
- **Median prices**: Track median prices at each funnel stage
- **Price competitiveness**: Compare ASIN prices to market medians
- **Price impact**: Analyze how price affects conversion rates

### 4. Shipping Preferences
- **Delivery speed analysis**: Track customer preferences for same-day, 1-day, and 2-day shipping
- **Shipping impact**: Understand how shipping options affect conversions

### 5. Query Intelligence
- **Query scores**: Relevance scores for each search query
- **Query volume**: Total search volume for market sizing
- **Query performance**: Track performance across multiple queries

## Migration Steps

### 1. Database Migration
Run the migration script to create new tables:
```bash
npm run migrate:run -- 013_restructure_for_bigquery_schema.sql
```

### 2. Data Sync
Use the new sync script to import nested data:
```bash
npm run sync:nested-bigquery --start-date=2024-01-01 --end-date=2024-01-07
```

### 3. API Migration
The new API endpoints are available at `/api/dashboard/v2/`:
- `/api/dashboard/v2/search-performance` - Detailed search metrics
- `/api/dashboard/v2/market-share` - Market share analysis
- `/api/dashboard/v2/funnel-analysis` - Conversion funnel data
- `/api/dashboard/v2/price-analysis` - Price competitiveness
- `/api/dashboard/v2/top-queries` - Top performing queries

### 4. Dashboard Updates
Use the new `EnhancedMetricsDashboard` component to display the rich metrics:
```tsx
import { EnhancedMetricsDashboard } from '@/components/dashboard/enhanced-metrics-dashboard';

<EnhancedMetricsDashboard 
  asins={['B08N5WRWNW']}
  startDate="2024-01-01"
  endDate="2024-01-07"
/>
```

## Benefits

1. **Richer Insights**: Access to market-level data, not just ASIN-specific metrics
2. **Better Decision Making**: Understand competitive positioning and market opportunities
3. **Price Optimization**: Data-driven pricing decisions based on market intelligence
4. **Funnel Optimization**: Identify and fix conversion bottlenecks
5. **Query Strategy**: Focus on high-value, high-volume search terms

## Backward Compatibility

The old tables and APIs remain functional. The new schema populates both old and new tables during sync to ensure a smooth transition.

## Performance Considerations

1. **Data Volume**: The nested structure stores more data per record
2. **Query Complexity**: Materialized views optimize common query patterns
3. **Sync Performance**: Batch processing handles large datasets efficiently

## Next Steps

1. Test the new sync process with a small date range
2. Validate data accuracy between BigQuery and Supabase
3. Gradually migrate dashboards to use new endpoints
4. Monitor query performance and optimize as needed