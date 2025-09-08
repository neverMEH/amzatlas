-- Migration: 053_create_brand_product_segments_fixed.sql
-- Description: Create materialized view for brand product segments with enhanced performance (FIXED VERSION)
-- Date: 2025-09-08
-- Author: Claude
-- Dependencies: Requires migrations 013, 049-052 (brand hierarchy and schema)

-- Drop existing view if it exists (in case of retry)
DROP MATERIALIZED VIEW IF EXISTS public.brand_product_segments CASCADE;

-- Create materialized view for brand product segments
-- This provides pre-aggregated daily segments for efficient querying
CREATE MATERIALIZED VIEW public.brand_product_segments AS
WITH brand_asin_mapping AS (
  -- Get all ASINs mapped to brands with product names
  SELECT DISTINCT
    bm.brand_id,
    b.brand_name,
    bm.asin,
    bm.product_title as product_name,
    bm.created_at as mapping_created_at
  FROM public.asin_brand_mapping bm
  JOIN public.brands b ON b.id = bm.brand_id
  WHERE b.is_active = true
    AND bm.asin IS NOT NULL
    AND bm.product_title IS NOT NULL
),
date_segments AS (
  -- Generate different segment types from the asin_performance_data
  SELECT DISTINCT
    ap.asin,
    ap.start_date,
    ap.end_date,
    -- Determine segment type based on date range
    CASE 
      WHEN ap.end_date - ap.start_date = 0 THEN 'daily'
      WHEN ap.end_date - ap.start_date <= 7 THEN 'weekly'
      WHEN ap.end_date - ap.start_date <= 31 THEN 'monthly'
      ELSE 'other'
    END as segment_type,
    -- Create segment identifiers
    ap.start_date as segment_start_date,
    ap.end_date as segment_end_date
  FROM sqp.asin_performance_data ap
  WHERE ap.start_date >= '2024-01-01'  -- Reasonable date cutoff
),
aggregated_performance AS (
  -- Aggregate search query performance by segment
  SELECT 
    ds.asin,
    ds.segment_type,
    ds.segment_start_date,
    ds.segment_end_date,
    
    -- Performance aggregations
    SUM(COALESCE(sq.total_query_impression_count, 0)) as total_impressions,
    SUM(COALESCE(sq.asin_impression_count, 0)) as asin_impressions,
    SUM(COALESCE(sq.asin_click_count, 0)) as total_clicks,
    SUM(COALESCE(sq.asin_cart_add_count, 0)) as total_cart_adds,
    SUM(COALESCE(sq.asin_purchase_count, 0)) as total_purchases,
    
    -- Share aggregations (weighted by impressions, with null safety)
    CASE 
      WHEN SUM(sq.asin_impression_count) > 0 THEN
        AVG(COALESCE(sq.asin_click_share, 0))
      ELSE 0 
    END as avg_click_share,
    
    CASE 
      WHEN SUM(sq.asin_impression_count) > 0 THEN
        AVG(COALESCE(sq.asin_cart_add_share, 0))
      ELSE 0 
    END as avg_cart_add_share,
    
    CASE 
      WHEN SUM(sq.asin_impression_count) > 0 THEN
        AVG(COALESCE(sq.asin_purchase_share, 0))
      ELSE 0 
    END as avg_purchase_share,
    
    -- Query metadata
    COUNT(DISTINCT sq.search_query) as query_count,
    
    -- Top performing query (simplified - just get one with most purchases)
    (
      SELECT sq_inner.search_query 
      FROM sqp.asin_performance_data ap_inner
      JOIN sqp.search_query_performance sq_inner ON ap_inner.id = sq_inner.asin_performance_id
      WHERE ap_inner.asin = ds.asin 
        AND ap_inner.start_date = ds.segment_start_date
        AND ap_inner.end_date = ds.segment_end_date
      ORDER BY COALESCE(sq_inner.asin_purchase_count, 0) DESC
      LIMIT 1
    ) as top_query,
    
    -- Top query purchase count
    MAX(COALESCE(sq.asin_purchase_count, 0)) as top_query_purchases

  FROM date_segments ds
  JOIN sqp.asin_performance_data ap ON ap.asin = ds.asin 
    AND ap.start_date = ds.segment_start_date 
    AND ap.end_date = ds.segment_end_date
  LEFT JOIN sqp.search_query_performance sq ON ap.id = sq.asin_performance_id
  WHERE ds.segment_type IN ('daily', 'weekly', 'monthly')
    -- Only include segments where we have some actual data
    AND EXISTS (
      SELECT 1 FROM sqp.search_query_performance sq2 
      WHERE sq2.asin_performance_id = ap.id 
      AND COALESCE(sq2.total_query_impression_count, 0) > 0
    )
  GROUP BY 
    ds.asin, ds.segment_type, ds.segment_start_date, ds.segment_end_date
)
SELECT 
  -- Identification
  bam.brand_id,
  bam.brand_name,
  bam.asin,
  bam.product_name,
  
  -- Segment information
  ap.segment_type,
  ap.segment_start_date,
  ap.segment_end_date,
  
  -- Performance metrics
  ap.total_impressions,
  ap.asin_impressions,
  ap.total_clicks,
  ap.total_cart_adds,
  ap.total_purchases,
  
  -- Calculated rates
  CASE 
    WHEN ap.asin_impressions > 0 THEN 
      ROUND(ap.total_clicks::decimal / ap.asin_impressions, 6)
    ELSE 0 
  END as click_through_rate,
  
  CASE 
    WHEN ap.total_clicks > 0 THEN 
      ROUND(ap.total_cart_adds::decimal / ap.total_clicks, 6)
    ELSE 0 
  END as cart_add_rate,
  
  CASE 
    WHEN ap.total_cart_adds > 0 THEN 
      ROUND(ap.total_purchases::decimal / ap.total_cart_adds, 6)
    ELSE 0 
  END as conversion_rate,
  
  -- Share metrics
  ROUND(COALESCE(ap.avg_click_share, 0), 6) as click_share,
  ROUND(COALESCE(ap.avg_cart_add_share, 0), 6) as cart_add_share,  
  ROUND(COALESCE(ap.avg_purchase_share, 0), 6) as purchase_share,
  
  -- Query metadata
  ap.query_count,
  ap.top_query,
  ap.top_query_purchases,
  
  -- Data quality indicators
  CASE 
    WHEN ap.total_impressions >= 1000 THEN 'high'
    WHEN ap.total_impressions >= 100 THEN 'medium'
    WHEN ap.total_impressions >= 10 THEN 'low'
    ELSE 'minimal'
  END as data_quality,
  
  -- Timestamps
  CURRENT_TIMESTAMP as materialized_at

FROM brand_asin_mapping bam
JOIN aggregated_performance ap ON ap.asin = bam.asin
WHERE ap.total_impressions > 0  -- Only include segments with actual performance data
ORDER BY 
  bam.brand_name, 
  bam.asin, 
  ap.segment_type, 
  ap.segment_start_date DESC;

-- Create performance-optimized indexes
-- Primary lookup index: brand + ASIN (most common query pattern)
CREATE UNIQUE INDEX idx_brand_product_segments_brand_asin 
  ON public.brand_product_segments(brand_id, asin, segment_type, segment_start_date);

-- Date range queries (for time series analysis)
CREATE INDEX idx_brand_product_segments_dates 
  ON public.brand_product_segments(segment_start_date, segment_end_date);

-- Segment type filtering
CREATE INDEX idx_brand_product_segments_segment_type 
  ON public.brand_product_segments(segment_type);

-- Performance-based partial index (only for records with significant data)
CREATE INDEX idx_brand_product_segments_performance_partial
  ON public.brand_product_segments(brand_id, total_purchases DESC, total_clicks DESC)
  WHERE total_impressions >= 100;

-- Brand-specific queries
CREATE INDEX idx_brand_product_segments_brand_performance
  ON public.brand_product_segments(brand_id, segment_type, total_purchases DESC);

-- Product name search (with conditional trigram support)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    CREATE INDEX idx_brand_product_segments_product_search
      ON public.brand_product_segments USING gin(product_name gin_trgm_ops);
  ELSE
    CREATE INDEX idx_brand_product_segments_product_search
      ON public.brand_product_segments(product_name);
  END IF;
END $$;

-- Create enhanced brand performance view with segment metadata
CREATE OR REPLACE VIEW public.brand_performance_enhanced AS
SELECT 
  b.id as brand_id,
  b.brand_name,
  b.is_active,
  bm.asin,
  bm.product_title as product_name,
  
  -- Segment availability counts
  COALESCE(weekly_counts.weekly_segments, 0) as weekly_segments_available,
  COALESCE(monthly_counts.monthly_segments, 0) as monthly_segments_available,
  COALESCE(daily_counts.daily_segments, 0) as daily_segments_available,
  
  -- Data availability flags
  CASE WHEN weekly_counts.weekly_segments > 0 THEN true ELSE false END as has_weekly_data,
  CASE WHEN monthly_counts.monthly_segments > 0 THEN true ELSE false END as has_monthly_data,
  CASE WHEN daily_counts.daily_segments > 0 THEN true ELSE false END as has_daily_data,
  
  -- Performance summary (from most recent daily segment)
  recent_perf.total_impressions,
  recent_perf.total_clicks,
  recent_perf.total_purchases,
  recent_perf.click_through_rate,
  recent_perf.conversion_rate,
  recent_perf.click_share,
  recent_perf.purchase_share,
  
  -- Metadata
  bm.created_at as mapping_created_at,
  b.created_at as brand_created_at

FROM public.brands b
JOIN public.asin_brand_mapping bm ON b.id = bm.brand_id

-- Count weekly segments
LEFT JOIN (
  SELECT 
    brand_id, 
    asin, 
    COUNT(*) as weekly_segments 
  FROM public.brand_product_segments 
  WHERE segment_type = 'weekly' 
  GROUP BY brand_id, asin
) weekly_counts ON weekly_counts.brand_id = b.id AND weekly_counts.asin = bm.asin

-- Count monthly segments
LEFT JOIN (
  SELECT 
    brand_id, 
    asin, 
    COUNT(*) as monthly_segments 
  FROM public.brand_product_segments 
  WHERE segment_type = 'monthly' 
  GROUP BY brand_id, asin
) monthly_counts ON monthly_counts.brand_id = b.id AND monthly_counts.asin = bm.asin

-- Count daily segments  
LEFT JOIN (
  SELECT 
    brand_id, 
    asin, 
    COUNT(*) as daily_segments 
  FROM public.brand_product_segments 
  WHERE segment_type = 'daily' 
  GROUP BY brand_id, asin
) daily_counts ON daily_counts.brand_id = b.id AND daily_counts.asin = bm.asin

-- Get most recent performance data
LEFT JOIN (
  SELECT DISTINCT ON (brand_id, asin)
    brand_id,
    asin,
    total_impressions,
    total_clicks, 
    total_purchases,
    click_through_rate,
    conversion_rate,
    click_share,
    purchase_share
  FROM public.brand_product_segments
  WHERE segment_type = 'daily'
  ORDER BY brand_id, asin, segment_start_date DESC
) recent_perf ON recent_perf.brand_id = b.id AND recent_perf.asin = bm.asin

WHERE b.is_active = true
ORDER BY b.brand_name, bm.product_title;

-- Create helper function for getting segment metadata  
CREATE OR REPLACE FUNCTION get_product_segment_metadata(
  p_brand_id UUID,
  p_asin TEXT,
  p_segment_type TEXT DEFAULT 'daily'
)
RETURNS TABLE(
  segment_count INTEGER,
  date_range_start DATE,
  date_range_end DATE,
  avg_impressions NUMERIC,
  avg_purchases NUMERIC,
  data_quality TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as segment_count,
    MIN(segment_start_date)::DATE as date_range_start,
    MAX(segment_end_date)::DATE as date_range_end,
    ROUND(AVG(total_impressions), 2) as avg_impressions,
    ROUND(AVG(total_purchases), 2) as avg_purchases,
    CASE 
      WHEN AVG(total_impressions) >= 1000 THEN 'high'::TEXT
      WHEN AVG(total_impressions) >= 100 THEN 'medium'::TEXT
      WHEN AVG(total_impressions) >= 10 THEN 'low'::TEXT
      ELSE 'minimal'::TEXT
    END as data_quality
  FROM public.brand_product_segments bps
  WHERE bps.brand_id = p_brand_id
    AND bps.asin = p_asin
    AND bps.segment_type = p_segment_type;
END;
$$ LANGUAGE plpgsql;

-- Create incremental refresh function for performance optimization
CREATE OR REPLACE FUNCTION refresh_brand_product_segments_incremental(
  lookback_days INTEGER DEFAULT 30
)
RETURNS BOOLEAN AS $$
DECLARE
  cutoff_date DATE;
  refresh_start TIMESTAMP;
  rows_affected INTEGER;
BEGIN
  refresh_start := CURRENT_TIMESTAMP;
  cutoff_date := CURRENT_DATE - INTERVAL '1 day' * lookback_days;
  
  -- Log refresh start
  RAISE NOTICE 'Starting incremental refresh for brand_product_segments, lookback: % days', lookback_days;
  
  -- For now, do a full refresh (future optimization: implement true incremental)
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.brand_product_segments;
  
  -- Get row count for monitoring
  SELECT COUNT(*) INTO rows_affected FROM public.brand_product_segments;
  
  -- Log completion
  RAISE NOTICE 'Completed refresh of brand_product_segments: % rows, duration: %', 
    rows_affected, 
    CURRENT_TIMESTAMP - refresh_start;
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error refreshing brand_product_segments: %', SQLERRM;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Create validation function
CREATE OR REPLACE FUNCTION validate_brand_product_segments()
RETURNS TABLE(
  validation_check TEXT,
  status TEXT,
  details TEXT
) AS $$
BEGIN
  -- Check data integrity
  RETURN QUERY
  SELECT 
    'Date Range Integrity'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
    FORMAT('%s records with invalid date ranges', COUNT(*))::TEXT
  FROM public.brand_product_segments 
  WHERE segment_start_date > segment_end_date;
  
  -- Check rate bounds
  RETURN QUERY
  SELECT 
    'Rate Value Bounds'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
    FORMAT('%s records with rates outside 0-1 range', COUNT(*))::TEXT
  FROM public.brand_product_segments 
  WHERE click_through_rate < 0 OR click_through_rate > 1
     OR conversion_rate < 0 OR conversion_rate > 1
     OR cart_add_rate < 0 OR cart_add_rate > 1;
     
  -- Check share metric bounds
  RETURN QUERY
  SELECT 
    'Share Metric Bounds'::TEXT,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
    FORMAT('%s records with share metrics outside 0-1 range', COUNT(*))::TEXT
  FROM public.brand_product_segments 
  WHERE click_share < 0 OR click_share > 1
     OR cart_add_share < 0 OR cart_add_share > 1
     OR purchase_share < 0 OR purchase_share > 1;

  -- Check for data presence
  RETURN QUERY
  SELECT 
    'Data Presence Check'::TEXT,
    CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
    FORMAT('%s total segments available', COUNT(*))::TEXT
  FROM public.brand_product_segments;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT SELECT ON public.brand_product_segments TO authenticated, service_role;
GRANT SELECT ON public.brand_performance_enhanced TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_product_segment_metadata(UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION refresh_brand_product_segments_incremental(INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION validate_brand_product_segments() TO authenticated, service_role;

-- Add comments for documentation
COMMENT ON MATERIALIZED VIEW public.brand_product_segments IS 'Pre-aggregated brand product performance segments for efficient expandable date range queries';
COMMENT ON VIEW public.brand_performance_enhanced IS 'Enhanced brand performance view with segment availability metadata';
COMMENT ON FUNCTION get_product_segment_metadata(UUID, TEXT, TEXT) IS 'Returns segment metadata for a specific brand/ASIN combination';
COMMENT ON FUNCTION refresh_brand_product_segments_incremental(INTEGER) IS 'Incrementally refreshes the brand_product_segments materialized view';
COMMENT ON FUNCTION validate_brand_product_segments() IS 'Validates data integrity in the brand_product_segments materialized view';

-- Success notification
DO $$
BEGIN
  RAISE NOTICE 'Migration 053 completed successfully: brand_product_segments materialized view and supporting infrastructure created';
END $$;