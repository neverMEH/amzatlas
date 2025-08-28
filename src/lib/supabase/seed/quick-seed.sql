-- Quick seed script - Run this directly in Supabase SQL Editor
-- This creates 30 days of test data

-- First run the public views migration (010) if you haven't already
-- Then run this function to seed data:

SELECT * FROM public.seed_test_data(30);

-- Verify the data:
SELECT 
    date,
    query,
    asin,
    impressions,
    clicks,
    purchases,
    ROUND((clicks::NUMERIC / NULLIF(impressions, 0)) * 100, 2) as ctr_percent,
    ROUND((purchases::NUMERIC / NULLIF(clicks, 0)) * 100, 2) as cvr_percent
FROM public.daily_sqp_data
ORDER BY date DESC
LIMIT 20;

-- Check data counts:
SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT date) as days,
    COUNT(DISTINCT query) as keywords,
    COUNT(DISTINCT asin) as products
FROM public.daily_sqp_data;

-- If you need more variety, you can manually insert additional data:
INSERT INTO public.daily_sqp_data (
    date, query, asin, impressions, clicks, purchases,
    spend, sales, organic_rank, ad_rank,
    click_through_rate, conversion_rate, cost_per_click, acos
)
SELECT 
    CURRENT_DATE - (n || ' days')::INTERVAL as date,
    keywords.keyword,
    asins.asin,
    FLOOR(500 + RANDOM() * 2000)::INTEGER as impressions,
    FLOOR(30 + RANDOM() * 100)::INTEGER as clicks,
    FLOOR(3 + RANDOM() * 20)::INTEGER as purchases,
    ROUND((30 + RANDOM() * 70)::NUMERIC, 2) as spend,
    ROUND((100 + RANDOM() * 500)::NUMERIC, 2) as sales,
    FLOOR(5 + RANDOM() * 30)::INTEGER as organic_rank,
    FLOOR(1 + RANDOM() * 15)::INTEGER as ad_rank,
    ROUND((0.04 + RANDOM() * 0.06)::NUMERIC, 4) as click_through_rate,
    ROUND((0.06 + RANDOM() * 0.10)::NUMERIC, 4) as conversion_rate,
    ROUND((0.40 + RANDOM() * 0.60)::NUMERIC, 2) as cost_per_click,
    ROUND((10 + RANDOM() * 30)::NUMERIC, 2) as acos
FROM 
    generate_series(0, 29) as n,
    (VALUES 
        ('smart home'), 
        ('kindle'), 
        ('fire tv'),
        ('smart speaker'),
        ('4k streaming')
    ) as keywords(keyword),
    (VALUES 
        ('B07FZ8S74R'), 
        ('B08F6PHTJ4'), 
        ('B08MQZXN1X')
    ) as asins(asin)
WHERE RANDOM() < 0.3; -- Only insert 30% to create variety