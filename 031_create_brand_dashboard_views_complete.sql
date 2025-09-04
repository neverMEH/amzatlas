-- Create materialized view for ASIN share metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS sqp.asin_share_metrics AS
WITH market_totals AS (
    SELECT 
        start_date,
        end_date,
        SUM(impressions) as total_market_impressions,
        SUM(clicks) as total_market_clicks,
        SUM(cart_adds) as total_market_cart_adds,
        SUM(purchases) as total_market_purchases
    FROM public.search_performance_summary
    GROUP BY start_date, end_date
),
asin_metrics AS (
    SELECT 
        sps.asin,
        sps.start_date,
        sps.end_date,
        SUM(sps.impressions) as asin_impressions,
        SUM(sps.clicks) as asin_clicks,
        SUM(sps.cart_adds) as asin_cart_adds,
        SUM(sps.purchases) as asin_purchases,
        CASE WHEN SUM(sps.clicks) > 0 
            THEN (SUM(sps.purchases)::numeric / SUM(sps.clicks)::numeric) * 100
            ELSE 0 
        END as asin_cvr,
        CASE WHEN SUM(sps.impressions) > 0 
            THEN (SUM(sps.clicks)::numeric / SUM(sps.impressions)::numeric) * 100
            ELSE 0 
        END as asin_ctr
    FROM public.search_performance_summary sps
    GROUP BY sps.asin, sps.start_date, sps.end_date
)
SELECT 
    am.asin,
    am.start_date,
    am.end_date,
    am.asin_impressions,
    am.asin_clicks,
    am.asin_cart_adds,
    am.asin_purchases,
    am.asin_cvr,
    am.asin_ctr,
    -- Share calculations
    ROUND((am.asin_impressions::numeric / NULLIF(mt.total_market_impressions, 0) * 100), 1) as impression_share,
    ROUND((am.asin_clicks::numeric / NULLIF(mt.total_market_clicks, 0) * 100), 1) as ctr_share,
    ROUND((am.asin_purchases::numeric / NULLIF(mt.total_market_purchases, 0) * 100), 1) as cvr_share,
    ROUND((am.asin_cart_adds::numeric / NULLIF(mt.total_market_cart_adds, 0) * 100), 1) as cart_add_share,
    ROUND((am.asin_purchases::numeric / NULLIF(mt.total_market_purchases, 0) * 100), 1) as purchase_share
FROM asin_metrics am
JOIN market_totals mt ON am.start_date = mt.start_date AND am.end_date = mt.end_date;

-- Create index for performance
CREATE INDEX idx_asin_share_metrics_asin_date ON sqp.asin_share_metrics(asin, start_date, end_date);

-- Create view for ASIN performance by brand with share metrics
CREATE OR REPLACE VIEW public.asin_performance_by_brand AS
SELECT 
    b.id as brand_id,
    b.display_name as brand_name,
    apd.asin,
    apd.product_title,
    -- Current period metrics (aggregated from all dates)
    COALESCE(SUM(asm.asin_impressions), 0) as impressions,
    COALESCE(SUM(asm.asin_clicks), 0) as clicks,
    COALESCE(SUM(asm.asin_cart_adds), 0) as cart_adds,
    COALESCE(SUM(asm.asin_purchases), 0) as purchases,
    -- Calculate rates
    CASE WHEN SUM(asm.asin_impressions) > 0 
        THEN ROUND((SUM(asm.asin_clicks)::numeric / SUM(asm.asin_impressions)::numeric) * 100, 1)
        ELSE 0 
    END as click_through_rate,
    CASE WHEN SUM(asm.asin_clicks) > 0 
        THEN ROUND((SUM(asm.asin_purchases)::numeric / SUM(asm.asin_clicks)::numeric) * 100, 1)
        ELSE 0 
    END as conversion_rate,
    -- Average share metrics
    COALESCE(AVG(asm.impression_share), 0) as impression_share,
    COALESCE(AVG(asm.ctr_share), 0) as ctr_share,
    COALESCE(AVG(asm.cvr_share), 0) as cvr_share,
    COALESCE(AVG(asm.cart_add_share), 0) as cart_add_share,
    COALESCE(AVG(asm.purchase_share), 0) as purchase_share
FROM sqp.brands b
JOIN sqp.asin_brand_mapping abm ON b.id = abm.brand_id
JOIN sqp.asin_performance_data apd ON abm.asin = apd.asin
LEFT JOIN sqp.asin_share_metrics asm ON apd.asin = asm.asin
GROUP BY b.id, b.display_name, apd.asin, apd.product_title;

-- Create materialized view for brand search query metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS sqp.brand_search_query_metrics AS
SELECT 
    b.id as brand_id,
    sqp_table.search_query,
    SUM(sqp_table.impressions) as impressions,
    SUM(sqp_table.clicks) as clicks,
    SUM(sqp_table.cart_adds) as cart_adds,
    SUM(sqp_table.purchases) as purchases,
    CASE WHEN SUM(sqp_table.clicks) > 0 
        THEN ROUND((SUM(sqp_table.purchases)::numeric / SUM(sqp_table.clicks)::numeric) * 100, 1)
        ELSE 0 
    END as cvr,
    CASE WHEN SUM(sqp_table.impressions) > 0 
        THEN ROUND((SUM(sqp_table.clicks)::numeric / SUM(sqp_table.impressions)::numeric) * 100, 1)
        ELSE 0 
    END as ctr,
    -- Calculate share metrics at query level within brand
    ROUND((SUM(sqp_table.impressions)::numeric / SUM(SUM(sqp_table.impressions)) OVER (PARTITION BY b.id) * 100), 1) as impression_share,
    ROUND((SUM(sqp_table.clicks)::numeric / SUM(SUM(sqp_table.clicks)) OVER (PARTITION BY b.id) * 100), 1) as ctr_share,
    ROUND((SUM(sqp_table.purchases)::numeric / SUM(SUM(sqp_table.purchases)) OVER (PARTITION BY b.id) * 100), 1) as cvr_share,
    ROUND((SUM(sqp_table.cart_adds)::numeric / SUM(SUM(sqp_table.cart_adds)) OVER (PARTITION BY b.id) * 100), 1) as cart_add_share,
    ROUND((SUM(sqp_table.purchases)::numeric / SUM(SUM(sqp_table.purchases)) OVER (PARTITION BY b.id) * 100), 1) as purchase_share
FROM sqp.brands b
JOIN sqp.asin_brand_mapping abm ON b.id = abm.brand_id
JOIN sqp.search_query_performance sqp_table ON abm.asin = sqp_table.asin
GROUP BY b.id, sqp_table.search_query;

-- Create index for performance
CREATE INDEX idx_brand_search_query_metrics_brand_id ON sqp.brand_search_query_metrics(brand_id);

-- Grant permissions
GRANT SELECT ON sqp.asin_share_metrics TO authenticated;
GRANT SELECT ON public.asin_performance_by_brand TO authenticated;
GRANT SELECT ON sqp.brand_search_query_metrics TO authenticated;

-- Refresh materialized views
REFRESH MATERIALIZED VIEW sqp.asin_share_metrics;
REFRESH MATERIALIZED VIEW sqp.brand_search_query_metrics;