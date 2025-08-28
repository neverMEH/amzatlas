-- Seed data for SQP tables
-- This script populates the database with realistic test data

-- Clear existing data (be careful in production!)
TRUNCATE TABLE sqp.daily_sqp_data CASCADE;
TRUNCATE TABLE sqp.weekly_summary CASCADE;
TRUNCATE TABLE sqp.monthly_summary CASCADE;
TRUNCATE TABLE sqp.yearly_summary CASCADE;

-- Helper function to generate realistic metrics
CREATE OR REPLACE FUNCTION generate_realistic_metrics(
    p_base_impressions INTEGER,
    p_week_number INTEGER,
    p_keyword_popularity NUMERIC,
    p_asin_quality NUMERIC
) RETURNS TABLE (
    impressions INTEGER,
    clicks INTEGER,
    purchases INTEGER,
    ctr NUMERIC,
    cvr NUMERIC
) AS $$
DECLARE
    v_seasonal_factor NUMERIC;
    v_trend_factor NUMERIC;
    v_random_factor NUMERIC;
    v_impressions INTEGER;
    v_clicks INTEGER;
    v_purchases INTEGER;
BEGIN
    -- Calculate seasonal factor (higher in Q4)
    v_seasonal_factor := 1 + (0.3 * SIN(2 * PI() * p_week_number / 52));
    
    -- Calculate trend factor (gradual growth)
    v_trend_factor := 1 + (p_week_number * 0.005);
    
    -- Random variation
    v_random_factor := 0.8 + (RANDOM() * 0.4);
    
    -- Calculate impressions
    v_impressions := ROUND(p_base_impressions * v_seasonal_factor * v_trend_factor * v_random_factor * p_keyword_popularity);
    
    -- Calculate clicks (CTR between 2-8% based on quality)
    clicks := ROUND(v_impressions * (0.02 + (0.06 * p_asin_quality) * (0.8 + RANDOM() * 0.4)));
    
    -- Calculate purchases (CVR between 5-15% based on quality)
    purchases := ROUND(clicks * (0.05 + (0.10 * p_asin_quality) * (0.8 + RANDOM() * 0.4)));
    
    impressions := v_impressions;
    ctr := CASE WHEN v_impressions > 0 THEN clicks::NUMERIC / v_impressions ELSE 0 END;
    cvr := CASE WHEN clicks > 0 THEN purchases::NUMERIC / clicks ELSE 0 END;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Define test products and keywords
WITH test_asins AS (
    SELECT * FROM (VALUES 
        ('B08N5WRWNW', 'Echo Dot (4th Gen)', 0.9),  -- High quality ASIN
        ('B07FZ8S74R', 'Echo Show 8', 0.8),
        ('B08KJN3333', 'Fire TV Stick 4K', 0.85),
        ('B08MQZXN1X', 'Fire HD 10 Tablet', 0.75),
        ('B08F6PHTJ4', 'Kindle Paperwhite', 0.7),
        ('B09B8V1LZ3', 'Echo Show 15', 0.6),
        ('B09BS26B8B', 'Astro Robot', 0.5),
        ('B08XVYZ1Y5', 'All-new Kindle', 0.65)
    ) AS t(asin, product_name, quality_score)
),
test_keywords AS (
    SELECT * FROM (VALUES
        ('alexa devices', 0.9),
        ('smart speaker', 0.85),
        ('echo dot', 0.95),
        ('smart home', 0.8),
        ('voice assistant', 0.75),
        ('amazon echo', 0.9),
        ('streaming device', 0.8),
        ('fire tv', 0.85),
        ('4k streaming', 0.7),
        ('tablet', 0.8),
        ('e-reader', 0.75),
        ('kindle', 0.85),
        ('smart display', 0.7),
        ('home automation', 0.65),
        ('wifi speaker', 0.6)
    ) AS t(keyword, popularity)
),
date_series AS (
    -- Generate dates for the last 52 weeks
    SELECT 
        generate_series(
            CURRENT_DATE - INTERVAL '52 weeks',
            CURRENT_DATE,
            INTERVAL '1 day'
        )::DATE as date
)

-- Insert daily data
INSERT INTO sqp.daily_sqp_data (
    date,
    query,
    asin,
    impressions,
    clicks,
    purchases,
    spend,
    sales,
    organic_rank,
    ad_rank,
    click_through_rate,
    conversion_rate,
    cost_per_click,
    acos
)
SELECT 
    d.date,
    k.keyword as query,
    a.asin,
    metrics.impressions,
    metrics.clicks,
    metrics.purchases,
    ROUND(metrics.clicks * (0.30 + RANDOM() * 0.70), 2) as spend, -- CPC between $0.30-$1.00
    ROUND(metrics.purchases * (20 + RANDOM() * 80), 2) as sales, -- AOV between $20-$100
    FLOOR(5 + RANDOM() * 45)::INTEGER as organic_rank, -- Rank 5-50
    FLOOR(1 + RANDOM() * 20)::INTEGER as ad_rank, -- Ad rank 1-20
    ROUND(metrics.ctr, 4) as click_through_rate,
    ROUND(metrics.cvr, 4) as conversion_rate,
    CASE 
        WHEN metrics.clicks > 0 
        THEN ROUND((metrics.clicks * (0.30 + RANDOM() * 0.70)) / metrics.clicks, 2)
        ELSE 0 
    END as cost_per_click,
    CASE 
        WHEN metrics.purchases > 0 
        THEN ROUND((metrics.clicks * (0.30 + RANDOM() * 0.70)) / (metrics.purchases * (20 + RANDOM() * 80)) * 100, 2)
        ELSE 0 
    END as acos
FROM date_series d
CROSS JOIN test_keywords k
CROSS JOIN test_asins a
CROSS JOIN LATERAL (
    SELECT * FROM generate_realistic_metrics(
        1000, -- Base impressions
        EXTRACT(WEEK FROM d.date)::INTEGER,
        k.popularity,
        a.quality_score
    )
) metrics
WHERE 
    -- Only generate data for realistic keyword-ASIN combinations
    (
        (k.keyword LIKE '%echo%' AND a.product_name LIKE '%Echo%') OR
        (k.keyword LIKE '%alexa%' AND a.product_name LIKE '%Echo%') OR
        (k.keyword LIKE '%fire%' AND a.product_name LIKE '%Fire%') OR
        (k.keyword LIKE '%streaming%' AND a.product_name LIKE '%Fire TV%') OR
        (k.keyword LIKE '%kindle%' AND a.product_name LIKE '%Kindle%') OR
        (k.keyword LIKE '%reader%' AND a.product_name LIKE '%Kindle%') OR
        (k.keyword LIKE '%tablet%' AND a.product_name LIKE '%Fire HD%') OR
        (k.keyword IN ('smart home', 'home automation', 'voice assistant')) OR
        (k.keyword = 'smart display' AND a.product_name LIKE '%Show%') OR
        (RANDOM() < 0.2) -- 20% chance for other combinations
    )
    AND metrics.impressions > 0;

-- Clean up helper function
DROP FUNCTION IF EXISTS generate_realistic_metrics;

-- Refresh materialized views
DO $$
BEGIN
    -- Refresh views in dependency order
    PERFORM sqp.refresh_all_views();
    
    -- Log completion
    RAISE NOTICE 'Data seeding completed successfully';
    RAISE NOTICE 'Total daily records: %', (SELECT COUNT(*) FROM sqp.daily_sqp_data);
    RAISE NOTICE 'Total weekly summaries: %', (SELECT COUNT(*) FROM sqp.weekly_summary);
    RAISE NOTICE 'Total monthly summaries: %', (SELECT COUNT(*) FROM sqp.monthly_summary);
    RAISE NOTICE 'Total yearly summaries: %', (SELECT COUNT(*) FROM sqp.yearly_summary);
END $$;