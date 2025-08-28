-- Manual seed script for Supabase SQL Editor
-- This script can be run directly in the Supabase dashboard

-- First, let's create a smaller set of test data for immediate testing
-- This creates data for the last 30 days

-- Helper function to generate dates
CREATE OR REPLACE FUNCTION generate_daily_data_for_testing() 
RETURNS void AS $$
DECLARE
    v_date DATE;
    v_keyword TEXT;
    v_asin TEXT;
    v_impressions INTEGER;
    v_clicks INTEGER;
    v_purchases INTEGER;
    v_spend NUMERIC;
    v_sales NUMERIC;
BEGIN
    -- Clear existing data (optional - comment out if you want to keep existing data)
    -- DELETE FROM sqp.daily_sqp_data WHERE date >= CURRENT_DATE - INTERVAL '30 days';
    
    -- Loop through last 30 days
    FOR v_date IN 
        SELECT generate_series(
            CURRENT_DATE - INTERVAL '30 days',
            CURRENT_DATE,
            INTERVAL '1 day'
        )::DATE
    LOOP
        -- Insert data for key product-keyword combinations
        -- Echo Dot with relevant keywords
        INSERT INTO sqp.daily_sqp_data (
            date, query, asin, impressions, clicks, purchases, 
            spend, sales, organic_rank, ad_rank, 
            click_through_rate, conversion_rate, cost_per_click, acos
        ) VALUES
        -- Echo Dot + alexa devices
        (
            v_date,
            'alexa devices',
            'B08N5WRWNW',
            FLOOR(1000 + RANDOM() * 2000)::INTEGER, -- impressions
            FLOOR(50 + RANDOM() * 150)::INTEGER,    -- clicks
            FLOOR(5 + RANDOM() * 20)::INTEGER,      -- purchases
            ROUND((50 + RANDOM() * 100)::NUMERIC, 2), -- spend
            ROUND((100 + RANDOM() * 500)::NUMERIC, 2), -- sales
            FLOOR(5 + RANDOM() * 20)::INTEGER,      -- organic_rank
            FLOOR(1 + RANDOM() * 10)::INTEGER,      -- ad_rank
            ROUND((0.04 + RANDOM() * 0.04)::NUMERIC, 4), -- ctr
            ROUND((0.08 + RANDOM() * 0.08)::NUMERIC, 4), -- cvr
            ROUND((0.40 + RANDOM() * 0.60)::NUMERIC, 2), -- cpc
            ROUND((10 + RANDOM() * 30)::NUMERIC, 2)  -- acos
        ),
        -- Echo Dot + echo dot
        (
            v_date,
            'echo dot',
            'B08N5WRWNW',
            FLOOR(2000 + RANDOM() * 3000)::INTEGER,
            FLOOR(100 + RANDOM() * 200)::INTEGER,
            FLOOR(10 + RANDOM() * 30)::INTEGER,
            ROUND((80 + RANDOM() * 120)::NUMERIC, 2),
            ROUND((200 + RANDOM() * 600)::NUMERIC, 2),
            FLOOR(3 + RANDOM() * 10)::INTEGER,
            FLOOR(1 + RANDOM() * 5)::INTEGER,
            ROUND((0.04 + RANDOM() * 0.06)::NUMERIC, 4),
            ROUND((0.08 + RANDOM() * 0.12)::NUMERIC, 4),
            ROUND((0.35 + RANDOM() * 0.45)::NUMERIC, 2),
            ROUND((8 + RANDOM() * 25)::NUMERIC, 2)
        ),
        -- Fire TV + streaming device
        (
            v_date,
            'streaming device',
            'B08KJN3333',
            FLOOR(800 + RANDOM() * 1500)::INTEGER,
            FLOOR(40 + RANDOM() * 100)::INTEGER,
            FLOOR(4 + RANDOM() * 15)::INTEGER,
            ROUND((40 + RANDOM() * 80)::NUMERIC, 2),
            ROUND((120 + RANDOM() * 400)::NUMERIC, 2),
            FLOOR(8 + RANDOM() * 25)::INTEGER,
            FLOOR(2 + RANDOM() * 12)::INTEGER,
            ROUND((0.04 + RANDOM() * 0.04)::NUMERIC, 4),
            ROUND((0.08 + RANDOM() * 0.10)::NUMERIC, 4),
            ROUND((0.45 + RANDOM() * 0.55)::NUMERIC, 2),
            ROUND((12 + RANDOM() * 28)::NUMERIC, 2)
        ),
        -- Kindle + e-reader
        (
            v_date,
            'e-reader',
            'B08F6PHTJ4',
            FLOOR(600 + RANDOM() * 1200)::INTEGER,
            FLOOR(30 + RANDOM() * 80)::INTEGER,
            FLOOR(3 + RANDOM() * 12)::INTEGER,
            ROUND((35 + RANDOM() * 70)::NUMERIC, 2),
            ROUND((150 + RANDOM() * 450)::NUMERIC, 2),
            FLOOR(10 + RANDOM() * 30)::INTEGER,
            FLOOR(3 + RANDOM() * 15)::INTEGER,
            ROUND((0.04 + RANDOM() * 0.03)::NUMERIC, 4),
            ROUND((0.08 + RANDOM() * 0.08)::NUMERIC, 4),
            ROUND((0.50 + RANDOM() * 0.50)::NUMERIC, 2),
            ROUND((15 + RANDOM() * 30)::NUMERIC, 2)
        ),
        -- Smart home general keyword
        (
            v_date,
            'smart home',
            'B08N5WRWNW',
            FLOOR(1200 + RANDOM() * 1800)::INTEGER,
            FLOOR(60 + RANDOM() * 120)::INTEGER,
            FLOOR(6 + RANDOM() * 18)::INTEGER,
            ROUND((55 + RANDOM() * 90)::NUMERIC, 2),
            ROUND((180 + RANDOM() * 540)::NUMERIC, 2),
            FLOOR(12 + RANDOM() * 35)::INTEGER,
            FLOOR(4 + RANDOM() * 16)::INTEGER,
            ROUND((0.04 + RANDOM() * 0.03)::NUMERIC, 4),
            ROUND((0.08 + RANDOM() * 0.08)::NUMERIC, 4),
            ROUND((0.45 + RANDOM() * 0.45)::NUMERIC, 2),
            ROUND((18 + RANDOM() * 32)::NUMERIC, 2)
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the function to generate data
SELECT generate_daily_data_for_testing();

-- Drop the temporary function
DROP FUNCTION generate_daily_data_for_testing();

-- Verify the data was inserted
SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT date) as days,
    COUNT(DISTINCT query) as keywords,
    COUNT(DISTINCT asin) as products,
    MIN(date) as earliest_date,
    MAX(date) as latest_date
FROM sqp.daily_sqp_data
WHERE date >= CURRENT_DATE - INTERVAL '30 days';

-- Check sample data
SELECT 
    date,
    query,
    asin,
    impressions,
    clicks,
    purchases,
    ROUND(clicks::NUMERIC / NULLIF(impressions, 0) * 100, 2) as ctr_pct,
    ROUND(purchases::NUMERIC / NULLIF(clicks, 0) * 100, 2) as cvr_pct,
    spend,
    sales,
    acos
FROM sqp.daily_sqp_data
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC, purchases DESC
LIMIT 20;

-- If you have the refresh_all_views function from migration 002, run it:
-- SELECT sqp.refresh_all_views();

-- Otherwise, manually refresh summary tables by running aggregation
-- This populates weekly_summary table
INSERT INTO sqp.weekly_summary (
    period_start, period_end, query, asin, 
    total_impressions, total_clicks, total_purchases,
    total_spend, total_sales, 
    avg_organic_rank, avg_ad_rank,
    avg_ctr, avg_cvr, avg_cpc, avg_acos,
    impression_share, click_share, purchase_share,
    purchases_per_impression
)
SELECT 
    date_trunc('week', date)::DATE as period_start,
    (date_trunc('week', date) + INTERVAL '6 days')::DATE as period_end,
    query,
    asin,
    SUM(impressions) as total_impressions,
    SUM(clicks) as total_clicks,
    SUM(purchases) as total_purchases,
    SUM(spend) as total_spend,
    SUM(sales) as total_sales,
    AVG(organic_rank) as avg_organic_rank,
    AVG(ad_rank) as avg_ad_rank,
    AVG(click_through_rate) as avg_ctr,
    AVG(conversion_rate) as avg_cvr,
    AVG(cost_per_click) as avg_cpc,
    AVG(acos) as avg_acos,
    -- Calculate shares (simplified - in reality you'd calculate against total market)
    0.20 + RANDOM() * 0.10 as impression_share,
    0.20 + RANDOM() * 0.10 as click_share,
    0.20 + RANDOM() * 0.10 as purchase_share,
    CASE WHEN SUM(impressions) > 0 
        THEN SUM(purchases)::NUMERIC / SUM(impressions) 
        ELSE 0 
    END as purchases_per_impression
FROM sqp.daily_sqp_data
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date_trunc('week', date), query, asin
ON CONFLICT (period_start, period_end, query, asin) 
DO UPDATE SET
    total_impressions = EXCLUDED.total_impressions,
    total_clicks = EXCLUDED.total_clicks,
    total_purchases = EXCLUDED.total_purchases,
    updated_at = CURRENT_TIMESTAMP;

-- Check weekly summary
SELECT 
    period_end,
    query,
    SUM(total_purchases) as total_purchases,
    SUM(total_clicks) as total_clicks,
    ROUND(AVG(avg_cvr) * 100, 2) as avg_cvr_pct
FROM sqp.weekly_summary
GROUP BY period_end, query
ORDER BY period_end DESC, total_purchases DESC
LIMIT 10;