-- Migration: Create Remaining Brand Optimization Indexes
-- Description: Creates indexes that depend on columns added in migration 023a

-- Core brand filtering indexes (now that asin column exists)
CREATE INDEX IF NOT EXISTS idx_search_query_performance_brand 
ON sqp.search_query_performance (asin, end_date DESC);

CREATE INDEX IF NOT EXISTS idx_asin_performance_data_brand 
ON sqp.asin_performance_data (asin, end_date DESC);

-- Performance indexes for aggregation queries
-- Only create if search_performance_summary exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'sqp' 
    AND table_name = 'search_performance_summary'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_search_performance_summary_brand 
    ON sqp.search_performance_summary (asin, week_start DESC) 
    INCLUDE (impressions, clicks, cart_adds, purchases);
  END IF;
END $$;