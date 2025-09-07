-- Direct seed script - run this in Supabase SQL Editor
-- This inserts data directly without using a function

-- Clear any existing test data from the last 30 days (optional)
DELETE FROM sqp.daily_sqp_data 
WHERE date >= CURRENT_DATE - INTERVAL '30 days';

-- Insert test data for the last 30 days
INSERT INTO sqp.daily_sqp_data (
    date, query, asin, impressions, clicks, purchases,
    spend, sales, organic_rank, ad_rank,
    click_through_rate, conversion_rate, cost_per_click, acos
)
SELECT 
    CURRENT_DATE - (n || ' days')::INTERVAL as date,
    kw.keyword as query,
    p.asin,
    -- Impressions (base + random variation)
    (1000 + FLOOR(RANDOM() * 2000))::INTEGER as impressions,
    -- Clicks (based on CTR 4-8%)
    GREATEST(1, FLOOR((1000 + FLOOR(RANDOM() * 2000)) * (0.04 + RANDOM() * 0.04)))::INTEGER as clicks,
    -- Purchases (based on CVR 8-16%)
    GREATEST(0, FLOOR(GREATEST(1, FLOOR((1000 + FLOOR(RANDOM() * 2000)) * (0.04 + RANDOM() * 0.04))) * (0.08 + RANDOM() * 0.08)))::INTEGER as purchases,
    -- Spend (CPC $0.40 - $1.00)
    ROUND(GREATEST(1, FLOOR((1000 + FLOOR(RANDOM() * 2000)) * (0.04 + RANDOM() * 0.04)))::NUMERIC * (0.40 + RANDOM() * 0.60), 2) as spend,
    -- Sales (AOV $40-100)
    ROUND(GREATEST(0, FLOOR(GREATEST(1, FLOOR((1000 + FLOOR(RANDOM() * 2000)) * (0.04 + RANDOM() * 0.04))) * (0.08 + RANDOM() * 0.08)))::NUMERIC * (40 + RANDOM() * 60), 2) as sales,
    -- Organic rank (5-25)
    FLOOR(5 + RANDOM() * 20)::INTEGER as organic_rank,
    -- Ad rank (1-10)
    FLOOR(1 + RANDOM() * 10)::INTEGER as ad_rank,
    -- CTR
    ROUND((0.04 + RANDOM() * 0.04)::NUMERIC, 4) as click_through_rate,
    -- CVR
    ROUND((0.08 + RANDOM() * 0.08)::NUMERIC, 4) as conversion_rate,
    -- CPC
    ROUND((0.40 + RANDOM() * 0.60)::NUMERIC, 2) as cost_per_click,
    -- ACOS
    ROUND((10 + RANDOM() * 20)::NUMERIC, 2) as acos
FROM 
    generate_series(0, 29) as n,
    (VALUES 
        ('alexa devices'),
        ('echo dot'),
        ('smart speaker'),
        ('smart home')
    ) as kw(keyword),
    (VALUES 
        ('B08N5WRWNW'), -- Echo Dot
        ('B07FZ8S74R'), -- Echo Show 8
        ('B08KJN3333')  -- Fire TV Stick
    ) as p(asin)
WHERE 
    -- Create realistic keyword-product combinations
    (kw.keyword = 'alexa devices' AND p.asin IN ('B08N5WRWNW', 'B07FZ8S74R')) OR
    (kw.keyword = 'echo dot' AND p.asin = 'B08N5WRWNW') OR
    (kw.keyword = 'smart speaker' AND p.asin IN ('B08N5WRWNW', 'B07FZ8S74R')) OR
    (kw.keyword = 'smart home' AND p.asin IN ('B08N5WRWNW', 'B07FZ8S74R', 'B08KJN3333'));

-- Add more variety with different products
INSERT INTO sqp.daily_sqp_data (
    date, query, asin, impressions, clicks, purchases,
    spend, sales, organic_rank, ad_rank,
    click_through_rate, conversion_rate, cost_per_click, acos
)
SELECT 
    CURRENT_DATE - (n || ' days')::INTERVAL as date,
    kw.keyword as query,
    p.asin,
    (800 + FLOOR(RANDOM() * 1500))::INTEGER as impressions,
    GREATEST(1, FLOOR((800 + FLOOR(RANDOM() * 1500)) * (0.03 + RANDOM() * 0.05)))::INTEGER as clicks,
    GREATEST(0, FLOOR(GREATEST(1, FLOOR((800 + FLOOR(RANDOM() * 1500)) * (0.03 + RANDOM() * 0.05))) * (0.06 + RANDOM() * 0.10)))::INTEGER as purchases,
    ROUND(GREATEST(1, FLOOR((800 + FLOOR(RANDOM() * 1500)) * (0.03 + RANDOM() * 0.05)))::NUMERIC * (0.45 + RANDOM() * 0.55), 2) as spend,
    ROUND(GREATEST(0, FLOOR(GREATEST(1, FLOOR((800 + FLOOR(RANDOM() * 1500)) * (0.03 + RANDOM() * 0.05))) * (0.06 + RANDOM() * 0.10)))::NUMERIC * (50 + RANDOM() * 50), 2) as sales,
    FLOOR(8 + RANDOM() * 25)::INTEGER as organic_rank,
    FLOOR(2 + RANDOM() * 12)::INTEGER as ad_rank,
    ROUND((0.03 + RANDOM() * 0.05)::NUMERIC, 4) as click_through_rate,
    ROUND((0.06 + RANDOM() * 0.10)::NUMERIC, 4) as conversion_rate,
    ROUND((0.45 + RANDOM() * 0.55)::NUMERIC, 2) as cost_per_click,
    ROUND((12 + RANDOM() * 28)::NUMERIC, 2) as acos
FROM 
    generate_series(0, 29) as n,
    (VALUES 
        ('fire tv'),
        ('streaming device'),
        ('4k streaming')
    ) as kw(keyword),
    (VALUES 
        ('B08KJN3333'), -- Fire TV Stick 4K
        ('B08MQZXN1X')  -- Fire HD 10 Tablet
    ) as p(asin)
WHERE 
    (kw.keyword IN ('fire tv', 'streaming device', '4k streaming') AND p.asin = 'B08KJN3333') OR
    (kw.keyword = 'streaming device' AND p.asin = 'B08MQZXN1X' AND RANDOM() < 0.3);

-- Add Kindle data
INSERT INTO sqp.daily_sqp_data (
    date, query, asin, impressions, clicks, purchases,
    spend, sales, organic_rank, ad_rank,
    click_through_rate, conversion_rate, cost_per_click, acos
)
SELECT 
    CURRENT_DATE - (n || ' days')::INTERVAL as date,
    kw.keyword as query,
    p.asin,
    (600 + FLOOR(RANDOM() * 1200))::INTEGER as impressions,
    GREATEST(1, FLOOR((600 + FLOOR(RANDOM() * 1200)) * (0.035 + RANDOM() * 0.045)))::INTEGER as clicks,
    GREATEST(0, FLOOR(GREATEST(1, FLOOR((600 + FLOOR(RANDOM() * 1200)) * (0.035 + RANDOM() * 0.045))) * (0.07 + RANDOM() * 0.09)))::INTEGER as purchases,
    ROUND(GREATEST(1, FLOOR((600 + FLOOR(RANDOM() * 1200)) * (0.035 + RANDOM() * 0.045)))::NUMERIC * (0.50 + RANDOM() * 0.50), 2) as spend,
    ROUND(GREATEST(0, FLOOR(GREATEST(1, FLOOR((600 + FLOOR(RANDOM() * 1200)) * (0.035 + RANDOM() * 0.045))) * (0.07 + RANDOM() * 0.09)))::NUMERIC * (60 + RANDOM() * 40), 2) as sales,
    FLOOR(10 + RANDOM() * 30)::INTEGER as organic_rank,
    FLOOR(3 + RANDOM() * 15)::INTEGER as ad_rank,
    ROUND((0.035 + RANDOM() * 0.045)::NUMERIC, 4) as click_through_rate,
    ROUND((0.07 + RANDOM() * 0.09)::NUMERIC, 4) as conversion_rate,
    ROUND((0.50 + RANDOM() * 0.50)::NUMERIC, 2) as cost_per_click,
    ROUND((15 + RANDOM() * 30)::NUMERIC, 2) as acos
FROM 
    generate_series(0, 29) as n,
    (VALUES 
        ('kindle'),
        ('e-reader'),
        ('kindle paperwhite')
    ) as kw(keyword),
    (VALUES 
        ('B08F6PHTJ4'), -- Kindle Paperwhite
        ('B08XVYZ1Y5')  -- All-new Kindle
    ) as p(asin)
WHERE 
    (kw.keyword IN ('kindle', 'e-reader', 'kindle paperwhite') AND p.asin IN ('B08F6PHTJ4', 'B08XVYZ1Y5'));

-- Check the results
SELECT 
    'Data seeded successfully!' as status,
    COUNT(*) as total_records,
    COUNT(DISTINCT date) as unique_days,
    COUNT(DISTINCT query) as unique_keywords,
    COUNT(DISTINCT asin) as unique_products
FROM sqp.daily_sqp_data
WHERE date >= CURRENT_DATE - INTERVAL '30 days';

-- View a sample of the data
SELECT 
    date,
    query,
    asin,
    impressions,
    clicks,
    purchases,
    ROUND((clicks::NUMERIC / NULLIF(impressions, 0)) * 100, 2) as ctr_percent,
    ROUND((purchases::NUMERIC / NULLIF(clicks, 0)) * 100, 2) as cvr_percent,
    spend,
    sales,
    acos
FROM sqp.daily_sqp_data
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC, purchases DESC
LIMIT 20;