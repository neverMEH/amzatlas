-- Migration: Create public view for brand search query metrics
-- Description: Expose brand search query metrics to public schema for API access

-- Create public view for brand search query metrics
CREATE OR REPLACE VIEW public.brand_search_query_metrics AS
SELECT * FROM sqp.brand_search_query_metrics;

-- Grant permissions
GRANT SELECT ON public.brand_search_query_metrics TO authenticated;
GRANT SELECT ON public.brand_search_query_metrics TO anon;

-- Create index on materialized view if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'sqp' 
        AND tablename = 'brand_search_query_metrics' 
        AND indexname = 'idx_brand_search_query_metrics'
    ) THEN
        CREATE INDEX idx_brand_search_query_metrics 
        ON sqp.brand_search_query_metrics(brand_id, impressions DESC);
    END IF;
END
$$;

-- Refresh the materialized view to ensure it has data
REFRESH MATERIALIZED VIEW sqp.brand_search_query_metrics;