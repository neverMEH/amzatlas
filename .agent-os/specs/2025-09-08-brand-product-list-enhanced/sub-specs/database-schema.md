# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-09-08-brand-product-list-enhanced/spec.md

> Created: 2025-09-08
> Version: 1.0.0

## Schema Changes

### 1. New Materialized View: brand_product_segments

This materialized view provides efficient weekly and monthly segmentation of brand product performance data, enabling fast queries for expandable date segments in the product table.

```sql
-- Create materialized view for brand product time segments
CREATE MATERIALIZED VIEW IF NOT EXISTS public.brand_product_segments AS
WITH date_segments AS (
  -- Generate weekly segments with week boundaries
  SELECT 
    abm.brand_id,
    apd.asin,
    -- Week boundaries (Monday to Sunday)
    DATE_TRUNC('week', apd.start_date)::date as week_start,
    (DATE_TRUNC('week', apd.start_date) + INTERVAL '6 days')::date as week_end,
    -- Month boundaries (1st to last day of month)
    DATE_TRUNC('month', apd.start_date)::date as month_start,
    (DATE_TRUNC('month', apd.start_date) + INTERVAL '1 month' - INTERVAL '1 day')::date as month_end,
    apd.start_date,
    apd.end_date,
    apd.id as asin_performance_id
  FROM sqp.asin_performance_data apd
  JOIN public.asin_brand_mapping abm ON apd.asin = abm.asin
  WHERE abm.is_active = true
),
weekly_aggregates AS (
  -- Weekly performance aggregations with share calculations
  SELECT 
    ds.brand_id,
    ds.asin,
    ds.week_start,
    ds.week_end,
    'weekly' as segment_type,
    -- Core metrics aggregated across the week
    SUM(sqp.total_query_impression_count) as total_impressions,
    SUM(sqp.asin_impression_count) as asin_impressions,
    SUM(sqp.total_click_count) as total_clicks,
    SUM(sqp.asin_click_count) as asin_clicks,
    SUM(sqp.total_cart_add_count) as total_cart_adds,
    SUM(sqp.asin_cart_add_count) as asin_cart_adds,
    SUM(sqp.total_purchase_count) as total_purchases,
    SUM(sqp.asin_purchase_count) as asin_purchases,
    -- Calculate share metrics within the weekly segment
    CASE 
      WHEN SUM(sqp.total_query_impression_count) > 0
      THEN ROUND((SUM(sqp.asin_impression_count)::NUMERIC / SUM(sqp.total_query_impression_count)::NUMERIC * 100), 2)
      ELSE 0
    END as impression_share_pct,
    CASE 
      WHEN SUM(sqp.total_click_count) > 0
      THEN ROUND((SUM(sqp.asin_click_count)::NUMERIC / SUM(sqp.total_click_count)::NUMERIC * 100), 2)
      ELSE 0
    END as click_share_pct,
    CASE 
      WHEN SUM(sqp.total_cart_add_count) > 0
      THEN ROUND((SUM(sqp.asin_cart_add_count)::NUMERIC / SUM(sqp.total_cart_add_count)::NUMERIC * 100), 2)
      ELSE 0
    END as cart_add_share_pct,
    CASE 
      WHEN SUM(sqp.total_purchase_count) > 0
      THEN ROUND((SUM(sqp.asin_purchase_count)::NUMERIC / SUM(sqp.total_purchase_count)::NUMERIC * 100), 2)
      ELSE 0
    END as purchase_share_pct,
    -- Calculate performance rates
    CASE 
      WHEN SUM(sqp.asin_impression_count) > 0
      THEN ROUND((SUM(sqp.asin_click_count)::NUMERIC / SUM(sqp.asin_impression_count)::NUMERIC * 100), 2)
      ELSE 0
    END as ctr_pct,
    CASE 
      WHEN SUM(sqp.asin_click_count) > 0
      THEN ROUND((SUM(sqp.asin_purchase_count)::NUMERIC / SUM(sqp.asin_click_count)::NUMERIC * 100), 2)
      ELSE 0
    END as cvr_pct,
    -- Pricing data (weighted averages)
    CASE 
      WHEN SUM(sqp.asin_purchase_count) > 0
      THEN ROUND(
        SUM(sqp.asin_median_purchase_price * sqp.asin_purchase_count) / 
        SUM(sqp.asin_purchase_count), 2
      )
      ELSE NULL
    END as avg_purchase_price,
    -- Data quality indicators
    COUNT(DISTINCT ds.asin_performance_id) as data_points_count,
    MIN(ds.start_date) as earliest_date,
    MAX(ds.end_date) as latest_date
  FROM date_segments ds
  JOIN sqp.search_query_performance sqp ON ds.asin_performance_id = sqp.asin_performance_id
  GROUP BY ds.brand_id, ds.asin, ds.week_start, ds.week_end
),
monthly_aggregates AS (
  -- Monthly performance aggregations with share calculations
  SELECT 
    ds.brand_id,
    ds.asin,
    ds.month_start,
    ds.month_end,
    'monthly' as segment_type,
    -- Core metrics aggregated across the month
    SUM(sqp.total_query_impression_count) as total_impressions,
    SUM(sqp.asin_impression_count) as asin_impressions,
    SUM(sqp.total_click_count) as total_clicks,
    SUM(sqp.asin_click_count) as asin_clicks,
    SUM(sqp.total_cart_add_count) as total_cart_adds,
    SUM(sqp.asin_cart_add_count) as asin_cart_adds,
    SUM(sqp.total_purchase_count) as total_purchases,
    SUM(sqp.asin_purchase_count) as asin_purchases,
    -- Calculate share metrics within the monthly segment
    CASE 
      WHEN SUM(sqp.total_query_impression_count) > 0
      THEN ROUND((SUM(sqp.asin_impression_count)::NUMERIC / SUM(sqp.total_query_impression_count)::NUMERIC * 100), 2)
      ELSE 0
    END as impression_share_pct,
    CASE 
      WHEN SUM(sqp.total_click_count) > 0
      THEN ROUND((SUM(sqp.asin_click_count)::NUMERIC / SUM(sqp.total_click_count)::NUMERIC * 100), 2)
      ELSE 0
    END as click_share_pct,
    CASE 
      WHEN SUM(sqp.total_cart_add_count) > 0
      THEN ROUND((SUM(sqp.asin_cart_add_count)::NUMERIC / SUM(sqp.total_cart_add_count)::NUMERIC * 100), 2)
      ELSE 0
    END as cart_add_share_pct,
    CASE 
      WHEN SUM(sqp.total_purchase_count) > 0
      THEN ROUND((SUM(sqp.asin_purchase_count)::NUMERIC / SUM(sqp.total_purchase_count)::NUMERIC * 100), 2)
      ELSE 0
    END as purchase_share_pct,
    -- Calculate performance rates
    CASE 
      WHEN SUM(sqp.asin_impression_count) > 0
      THEN ROUND((SUM(sqp.asin_click_count)::NUMERIC / SUM(sqp.asin_impression_count)::NUMERIC * 100), 2)
      ELSE 0
    END as ctr_pct,
    CASE 
      WHEN SUM(sqp.asin_click_count) > 0
      THEN ROUND((SUM(sqp.asin_purchase_count)::NUMERIC / SUM(sqp.asin_click_count)::NUMERIC * 100), 2)
      ELSE 0
    END as cvr_pct,
    -- Pricing data (weighted averages)
    CASE 
      WHEN SUM(sqp.asin_purchase_count) > 0
      THEN ROUND(
        SUM(sqp.asin_median_purchase_price * sqp.asin_purchase_count) / 
        SUM(sqp.asin_purchase_count), 2
      )
      ELSE NULL
    END as avg_purchase_price,
    -- Data quality indicators
    COUNT(DISTINCT ds.asin_performance_id) as data_points_count,
    MIN(ds.start_date) as earliest_date,
    MAX(ds.end_date) as latest_date
  FROM date_segments ds
  JOIN sqp.search_query_performance sqp ON ds.asin_performance_id = sqp.asin_performance_id
  GROUP BY ds.brand_id, ds.asin, ds.month_start, ds.month_end
)
-- Union weekly and monthly segments into single view
SELECT 
  brand_id,
  asin,
  segment_type,
  week_start as period_start,
  week_end as period_end,
  total_impressions,
  asin_impressions,
  total_clicks,
  asin_clicks,
  total_cart_adds,
  asin_cart_adds,
  total_purchases,
  asin_purchases,
  impression_share_pct,
  click_share_pct,
  cart_add_share_pct,
  purchase_share_pct,
  ctr_pct,
  cvr_pct,
  avg_purchase_price,
  data_points_count,
  earliest_date,
  latest_date,
  CURRENT_TIMESTAMP as last_refreshed
FROM weekly_aggregates
UNION ALL
SELECT 
  brand_id,
  asin,
  segment_type,
  month_start as period_start,
  month_end as period_end,
  total_impressions,
  asin_impressions,
  total_clicks,
  asin_clicks,
  total_cart_adds,
  asin_cart_adds,
  total_purchases,
  asin_purchases,
  impression_share_pct,
  click_share_pct,
  cart_add_share_pct,
  purchase_share_pct,
  ctr_pct,
  cvr_pct,
  avg_purchase_price,
  data_points_count,
  earliest_date,
  latest_date,
  CURRENT_TIMESTAMP as last_refreshed
FROM monthly_aggregates;

-- Add comprehensive indexes for optimal query performance
CREATE INDEX idx_brand_product_segments_lookup ON public.brand_product_segments(brand_id, asin, segment_type, period_start);
CREATE INDEX idx_brand_product_segments_period ON public.brand_product_segments(period_start, period_end);
CREATE INDEX idx_brand_product_segments_brand ON public.brand_product_segments(brand_id);
CREATE INDEX idx_brand_product_segments_asin ON public.brand_product_segments(asin);
CREATE INDEX idx_brand_product_segments_performance ON public.brand_product_segments(asin_impressions DESC, asin_purchases DESC);
CREATE INDEX idx_brand_product_segments_dates ON public.brand_product_segments(earliest_date, latest_date);

-- Grant permissions for API access
GRANT SELECT ON public.brand_product_segments TO authenticated, service_role;

-- Add documentation
COMMENT ON MATERIALIZED VIEW public.brand_product_segments IS 
'Pre-aggregated weekly and monthly performance segments for brand products. Optimizes expandable date segment queries by eliminating need for real-time aggregations on 204k+ records.';

COMMENT ON COLUMN public.brand_product_segments.segment_type IS 
'Segment granularity: weekly (Monday-Sunday boundaries) or monthly (1st-last day boundaries)';

COMMENT ON COLUMN public.brand_product_segments.data_points_count IS 
'Number of underlying asin_performance_data records that contributed to this segment aggregation';
```

### 2. Enhanced Brand Performance Views

Update existing brand views to support efficient time-based segmentation queries:

```sql
-- Enhanced brand performance summary with segment metadata
CREATE OR REPLACE VIEW public.brand_performance_enhanced AS
WITH brand_segment_stats AS (
  SELECT 
    brand_id,
    asin,
    COUNT(*) FILTER (WHERE segment_type = 'weekly') as weekly_segments_count,
    COUNT(*) FILTER (WHERE segment_type = 'monthly') as monthly_segments_count,
    MIN(earliest_date) as first_data_date,
    MAX(latest_date) as last_data_date,
    -- Performance indicators for segment availability
    BOOL_OR(segment_type = 'weekly' AND asin_impressions > 0) as has_weekly_data,
    BOOL_OR(segment_type = 'monthly' AND asin_impressions > 0) as has_monthly_data
  FROM public.brand_product_segments
  GROUP BY brand_id, asin
),
brand_totals AS (
  SELECT 
    bps.brand_id,
    b.brand_name,
    b.display_name,
    -- Aggregate all ASINs for brand totals
    COUNT(DISTINCT bps.asin) as total_asins,
    COUNT(DISTINCT bps.asin) FILTER (WHERE bss.has_weekly_data) as asins_with_weekly_data,
    COUNT(DISTINCT bps.asin) FILTER (WHERE bss.has_monthly_data) as asins_with_monthly_data,
    -- Performance totals
    SUM(bps.asin_impressions) as total_impressions,
    SUM(bps.asin_clicks) as total_clicks,
    SUM(bps.asin_cart_adds) as total_cart_adds,
    SUM(bps.asin_purchases) as total_purchases,
    -- Share metrics (brand-level aggregation)
    CASE 
      WHEN SUM(bps.total_impressions) > 0
      THEN ROUND((SUM(bps.asin_impressions)::NUMERIC / SUM(bps.total_impressions)::NUMERIC * 100), 2)
      ELSE 0
    END as avg_impression_share,
    CASE 
      WHEN SUM(bps.total_purchases) > 0
      THEN ROUND((SUM(bps.asin_purchases)::NUMERIC / SUM(bps.total_purchases)::NUMERIC * 100), 2)
      ELSE 0
    END as avg_purchase_share,
    -- Date range
    MIN(bss.first_data_date) as data_start_date,
    MAX(bss.last_data_date) as data_end_date
  FROM public.brand_product_segments bps
  JOIN public.brands b ON bps.brand_id = b.id
  LEFT JOIN brand_segment_stats bss ON bps.brand_id = bss.brand_id AND bps.asin = bss.asin
  WHERE bps.segment_type = 'monthly' -- Use monthly to avoid double counting
  GROUP BY bps.brand_id, b.brand_name, b.display_name
)
SELECT * FROM brand_totals;

-- Add index for enhanced view performance
CREATE INDEX idx_brand_performance_enhanced_id ON public.brand_performance_enhanced(brand_id);

-- Grant permissions
GRANT SELECT ON public.brand_performance_enhanced TO authenticated, service_role;
```

### 3. Segment Metadata Function

Create a PostgreSQL function for efficient segment metadata queries:

```sql
-- Function to get segment metadata for product table display
CREATE OR REPLACE FUNCTION public.get_product_segment_metadata(
  p_brand_id UUID,
  p_date_from DATE,
  p_date_to DATE
)
RETURNS TABLE (
  asin VARCHAR(20),
  has_weekly_segments BOOLEAN,
  has_monthly_segments BOOLEAN,
  weekly_count INTEGER,
  monthly_count INTEGER,
  earliest_segment_date DATE,
  latest_segment_date DATE,
  total_segment_impressions BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bps.asin,
    BOOL_OR(bps.segment_type = 'weekly' AND bps.asin_impressions > 0) as has_weekly_segments,
    BOOL_OR(bps.segment_type = 'monthly' AND bps.asin_impressions > 0) as has_monthly_segments,
    COUNT(*) FILTER (WHERE bps.segment_type = 'weekly')::INTEGER as weekly_count,
    COUNT(*) FILTER (WHERE bps.segment_type = 'monthly')::INTEGER as monthly_count,
    MIN(bps.earliest_date) as earliest_segment_date,
    MAX(bps.latest_date) as latest_segment_date,
    SUM(bps.asin_impressions) as total_segment_impressions
  FROM public.brand_product_segments bps
  WHERE bps.brand_id = p_brand_id
    AND bps.period_start >= p_date_from
    AND bps.period_end <= p_date_to
    AND bps.asin_impressions > 0  -- Only include ASINs with actual data
  GROUP BY bps.asin
  ORDER BY total_segment_impressions DESC;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.get_product_segment_metadata(UUID, DATE, DATE) TO authenticated, service_role;

-- Add documentation
COMMENT ON FUNCTION public.get_product_segment_metadata IS 
'Returns segment availability metadata for products within a brand and date range. Used by product table to show expansion indicators.';
```

### 4. Performance Indexes

Add specialized indexes for optimal segment query performance:

```sql
-- Composite index for segment queries (most common access pattern)
CREATE INDEX idx_segments_brand_asin_type_period ON public.brand_product_segments(
  brand_id, 
  asin, 
  segment_type, 
  period_start, 
  period_end
) WHERE asin_impressions > 0;

-- Index for date range filtering (API queries)
CREATE INDEX idx_segments_date_range ON public.brand_product_segments(
  period_start, 
  period_end
) INCLUDE (brand_id, asin, segment_type, asin_impressions);

-- Index for performance sorting (top products)
CREATE INDEX idx_segments_performance_ranking ON public.brand_product_segments(
  brand_id, 
  segment_type, 
  asin_impressions DESC, 
  asin_purchases DESC
) WHERE asin_impressions > 0;

-- Partial index for recent data (most frequently accessed)
CREATE INDEX idx_segments_recent_data ON public.brand_product_segments(
  brand_id, 
  asin, 
  period_start DESC
) WHERE period_start >= CURRENT_DATE - INTERVAL '90 days';

-- GIN index for array operations if needed for batch queries
CREATE INDEX idx_segments_asin_gin ON public.brand_product_segments 
USING GIN ((ARRAY[asin]));
```

### 5. Foreign Key Relationships

Ensure proper referential integrity with existing tables:

```sql
-- Note: Materialized views cannot have foreign key constraints directly
-- but the underlying queries maintain referential integrity through JOINs

-- Add constraint validation via check function (optional)
CREATE OR REPLACE FUNCTION validate_brand_product_segments()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate brand_id exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM public.brands 
    WHERE id = NEW.brand_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid brand_id: %', NEW.brand_id;
  END IF;
  
  -- Validate ASIN has brand mapping
  IF NOT EXISTS (
    SELECT 1 FROM public.asin_brand_mapping 
    WHERE asin = NEW.asin AND brand_id = NEW.brand_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'ASIN % not mapped to brand %', NEW.asin, NEW.brand_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: Triggers on materialized views are limited, validation happens during refresh
```

### 6. Materialized View Refresh Strategy

Implement efficient refresh mechanism for the segments view:

```sql
-- Function for incremental refresh based on data changes
CREATE OR REPLACE FUNCTION public.refresh_brand_product_segments_incremental()
RETURNS void AS $$
DECLARE
  last_refresh_time TIMESTAMP;
  affected_dates DATE[];
BEGIN
  -- Get last refresh time from metadata
  SELECT COALESCE(MAX(last_refreshed), '1970-01-01'::TIMESTAMP) 
  INTO last_refresh_time
  FROM public.brand_product_segments;
  
  -- Find date ranges that need refresh (based on recent data updates)
  SELECT ARRAY_AGG(DISTINCT apd.start_date)
  INTO affected_dates
  FROM sqp.asin_performance_data apd
  WHERE apd.updated_at > last_refresh_time
    OR apd.created_at > last_refresh_time;
  
  -- Only refresh if there are changes
  IF array_length(affected_dates, 1) > 0 THEN
    RAISE NOTICE 'Refreshing brand_product_segments for % affected dates', array_length(affected_dates, 1);
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.brand_product_segments;
    
    -- Log the refresh
    INSERT INTO public.materialized_view_refresh_log (
      view_name, 
      refresh_start, 
      refresh_end, 
      status, 
      row_count,
      metadata
    ) VALUES (
      'brand_product_segments',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      'success',
      (SELECT COUNT(*) FROM public.brand_product_segments),
      jsonb_build_object(
        'affected_dates', affected_dates,
        'incremental', true
      )
    );
  ELSE
    RAISE NOTICE 'No changes detected, skipping refresh';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant execution permission
GRANT EXECUTE ON FUNCTION public.refresh_brand_product_segments_incremental() TO authenticated, service_role;
```

## Migrations

### Migration Sequence

The database changes should be applied as a single migration file to ensure atomicity:

```sql
-- Migration: 053_create_brand_product_segments.sql
-- Description: Add materialized view and indexes for brand product date segments
-- Dependencies: Requires migrations 013, 049-052 (brand hierarchy and performance tables)
-- Performance Impact: Initial creation may take 2-3 minutes for 204k+ records

-- Check prerequisites
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'sqp' AND table_name = 'asin_performance_data') THEN
    RAISE EXCEPTION 'Required table sqp.asin_performance_data not found. Run migration 013 first.';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'asin_brand_mapping') THEN
    RAISE EXCEPTION 'Required table public.asin_brand_mapping not found. Run brand migrations first.';
  END IF;
END $$;

-- [Include all CREATE statements from above sections]

-- Migration validation
DO $$
DECLARE
  row_count INTEGER;
  index_count INTEGER;
BEGIN
  -- Verify materialized view was created and populated
  SELECT COUNT(*) INTO row_count FROM public.brand_product_segments;
  RAISE NOTICE 'Created brand_product_segments with % rows', row_count;
  
  -- Verify indexes were created
  SELECT COUNT(*) INTO index_count 
  FROM pg_indexes 
  WHERE tablename = 'brand_product_segments' AND schemaname = 'public';
  RAISE NOTICE 'Created % indexes on brand_product_segments', index_count;
  
  IF row_count = 0 THEN
    RAISE WARNING 'brand_product_segments is empty - this may indicate data issues';
  END IF;
END $$;
```

### Rollback Strategy

```sql
-- Rollback migration: 053_rollback_brand_product_segments.sql
-- Description: Clean removal of brand product segments infrastructure

-- Drop materialized view and all dependent objects
DROP MATERIALIZED VIEW IF EXISTS public.brand_product_segments CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS public.get_product_segment_metadata(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS public.refresh_brand_product_segments_incremental();
DROP FUNCTION IF EXISTS validate_brand_product_segments();

-- Drop enhanced view
DROP VIEW IF EXISTS public.brand_performance_enhanced;

-- Note: Indexes are automatically dropped with the materialized view
```

## Performance Considerations

### Query Performance Optimization

1. **Materialized View Benefits**:
   - Pre-aggregated data eliminates need for complex JOINs during API requests
   - Weekly/monthly segments calculated once during refresh, not per query
   - Share calculations pre-computed for 204k+ record dataset

2. **Index Strategy**:
   - Primary composite index covers most common access pattern: `(brand_id, asin, segment_type, period_start)`
   - Partial indexes only include rows with actual data (`asin_impressions > 0`)
   - INCLUDE columns provide covering indexes for SELECT-only queries

3. **Memory Usage**:
   - Estimated materialized view size: ~50-100MB for current dataset
   - Indexes add ~20-40MB additional storage
   - Total memory impact: <150MB for significant query performance gains

### Refresh Strategy Performance

1. **Initial Creation**: 2-3 minutes for full dataset (one-time cost)
2. **Full Refresh**: 1-2 minutes during scheduled maintenance
3. **Incremental Detection**: <5 seconds to identify changes
4. **Concurrent Refresh**: Zero downtime during refresh operations

### API Query Performance Impact

**Before Materialized View** (estimated):
- Expandable segment query: 2-5 seconds for complex aggregations
- Multiple segment queries: 10-30 seconds total page load time

**After Materialized View** (expected):
- Expandable segment query: 50-200ms for pre-aggregated data
- Multiple segment queries: <1 second total page load time
- 10-50x performance improvement for segment expansion

### Data Freshness vs Performance Trade-off

- **Real-time**: Every data sync triggers incremental refresh (highest accuracy, moderate overhead)
- **Scheduled**: Hourly refresh during business hours (balanced approach, recommended)
- **Daily**: Overnight refresh (lowest overhead, acceptable for most use cases)

The specification provides a robust foundation for efficient expandable date segments while maintaining optimal query performance across the 204k+ record dataset.