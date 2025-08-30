-- Migration: Add keyword analysis RPC functions
-- Description: Functions for keyword performance analysis
-- Created: 2025-08-30

-- Function to get keyword funnel totals
CREATE OR REPLACE FUNCTION sqp.get_keyword_funnel_totals(
  p_asin TEXT,
  p_keyword TEXT,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  impressions BIGINT,
  clicks BIGINT,
  cart_adds BIGINT,
  purchases BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(sqp.impressions), 0)::BIGINT as impressions,
    COALESCE(SUM(sqp.clicks), 0)::BIGINT as clicks,
    COALESCE(SUM(sqp.cart_adds), 0)::BIGINT as cart_adds,
    COALESCE(SUM(sqp.purchases), 0)::BIGINT as purchases
  FROM sqp.search_query_performance sqp
  WHERE sqp.asin = p_asin
    AND sqp.search_query = p_keyword
    AND sqp.start_date >= p_start_date
    AND sqp.start_date <= p_end_date;
END;
$$;

-- Function to get keyword market share across all ASINs
CREATE OR REPLACE FUNCTION sqp.get_keyword_market_share(
  p_keyword TEXT,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  asin TEXT,
  brand TEXT,
  title TEXT,
  impressions BIGINT,
  clicks BIGINT,
  purchases BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sqp.asin,
    apd.brand,
    apd.product_title as title,
    COALESCE(SUM(sqp.impressions), 0)::BIGINT as impressions,
    COALESCE(SUM(sqp.clicks), 0)::BIGINT as clicks,
    COALESCE(SUM(sqp.purchases), 0)::BIGINT as purchases
  FROM sqp.search_query_performance sqp
  LEFT JOIN sqp.asin_performance_data apd 
    ON sqp.asin = apd.asin 
    AND sqp.start_date = apd.start_date
  WHERE sqp.search_query = p_keyword
    AND sqp.start_date >= p_start_date
    AND sqp.start_date <= p_end_date
  GROUP BY sqp.asin, apd.brand, apd.product_title
  ORDER BY impressions DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION sqp.get_keyword_funnel_totals TO authenticated;
GRANT EXECUTE ON FUNCTION sqp.get_keyword_market_share TO authenticated;

-- Function to get funnel totals for multiple keywords
CREATE OR REPLACE FUNCTION sqp.get_multiple_keyword_funnels(
  p_asin TEXT,
  p_keywords TEXT[],
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  search_query TEXT,
  impressions BIGINT,
  clicks BIGINT,
  cart_adds BIGINT,
  purchases BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sqp.search_query,
    COALESCE(SUM(sqp.impressions), 0)::BIGINT as impressions,
    COALESCE(SUM(sqp.clicks), 0)::BIGINT as clicks,
    COALESCE(SUM(sqp.cart_adds), 0)::BIGINT as cart_adds,
    COALESCE(SUM(sqp.purchases), 0)::BIGINT as purchases
  FROM sqp.search_query_performance sqp
  WHERE sqp.asin = p_asin
    AND sqp.search_query = ANY(p_keywords)
    AND sqp.start_date >= p_start_date
    AND sqp.start_date <= p_end_date
  GROUP BY sqp.search_query;
END;
$$;

-- Function to get impression shares for keywords
CREATE OR REPLACE FUNCTION sqp.get_keyword_impression_shares(
  p_asin TEXT,
  p_keywords TEXT[],
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  search_query TEXT,
  impression_share NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH keyword_totals AS (
    SELECT 
      search_query,
      SUM(impressions) as keyword_impressions
    FROM sqp.search_query_performance
    WHERE search_query = ANY(p_keywords)
      AND start_date >= p_start_date
      AND start_date <= p_end_date
    GROUP BY search_query
  ),
  asin_totals AS (
    SELECT 
      search_query,
      SUM(impressions) as asin_impressions
    FROM sqp.search_query_performance
    WHERE asin = p_asin
      AND search_query = ANY(p_keywords)
      AND start_date >= p_start_date
      AND start_date <= p_end_date
    GROUP BY search_query
  )
  SELECT 
    kt.search_query,
    CASE 
      WHEN kt.keyword_impressions > 0 
      THEN ROUND((at.asin_impressions::numeric / kt.keyword_impressions::numeric), 4)
      ELSE 0
    END as impression_share
  FROM keyword_totals kt
  LEFT JOIN asin_totals at ON kt.search_query = at.search_query
  ORDER BY kt.search_query;
END;
$$;

-- Grant execute permissions for new functions
GRANT EXECUTE ON FUNCTION sqp.get_multiple_keyword_funnels TO authenticated;
GRANT EXECUTE ON FUNCTION sqp.get_keyword_impression_shares TO authenticated;

-- Create indexes to optimize these queries
CREATE INDEX IF NOT EXISTS idx_search_query_performance_keyword_date 
ON sqp.search_query_performance(search_query, start_date);

CREATE INDEX IF NOT EXISTS idx_search_query_performance_asin_keyword_date 
ON sqp.search_query_performance(asin, search_query, start_date);