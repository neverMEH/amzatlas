-- Migration: Create public view for weekly_summary (with fallback)
-- Description: Create public view for weekly_summary, using search_performance_summary as fallback

-- Drop existing view if it exists
DROP VIEW IF EXISTS public.weekly_summary CASCADE;

-- Check if sqp.weekly_summary exists, if not use search_performance_summary aggregated by week
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'sqp' 
    AND table_name = 'weekly_summary'
  ) THEN
    -- If weekly_summary exists, create view from it
    CREATE VIEW public.weekly_summary AS
    SELECT * FROM sqp.weekly_summary;
  ELSE
    -- If weekly_summary doesn't exist, aggregate from search_performance_summary
    CREATE VIEW public.weekly_summary AS
    SELECT 
      MIN(sps.start_date) AS period_start,
      MAX(sps.end_date) AS period_end,
      sps.asin,
      SUM(sps.impressions) AS total_impressions,
      SUM(sps.clicks) AS total_clicks,
      SUM(sps.cart_adds) AS cart_adds,
      SUM(sps.purchases) AS total_purchases,
      CASE 
        WHEN SUM(sps.impressions) > 0 
        THEN SUM(sps.clicks)::DECIMAL / SUM(sps.impressions) 
        ELSE 0 
      END AS avg_ctr,
      CASE 
        WHEN SUM(sps.impressions) > 0 
        THEN SUM(sps.purchases)::DECIMAL / SUM(sps.impressions) 
        ELSE 0 
      END AS avg_cvr,
      AVG(sps.impression_share) AS impression_share,
      AVG(sps.click_share) AS click_share,
      AVG(sps.purchase_share) AS purchase_share
    FROM public.search_performance_summary sps
    GROUP BY sps.asin, sps.start_date
    ORDER BY sps.asin, sps.start_date;
  END IF;
END $$;

-- Grant permissions
GRANT SELECT ON public.weekly_summary TO anon, authenticated;

-- Comment
COMMENT ON VIEW public.weekly_summary IS 'Public view for weekly aggregated performance data';