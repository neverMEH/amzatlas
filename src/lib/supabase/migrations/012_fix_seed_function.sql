-- Fix the seed_test_data function with proper type casting
-- Drop the old function if it exists
DROP FUNCTION IF EXISTS public.seed_test_data(INTEGER);

-- Create corrected function
CREATE OR REPLACE FUNCTION public.seed_test_data(days INTEGER DEFAULT 30)
RETURNS TABLE (
    inserted_count INTEGER,
    status TEXT
) AS $$
DECLARE
    v_count INTEGER := 0;
    v_date DATE;
    v_impressions INTEGER;
    v_clicks INTEGER;
    v_purchases INTEGER;
    v_spend NUMERIC;
    v_sales NUMERIC;
BEGIN
    -- Clear existing recent data (optional)
    DELETE FROM sqp.daily_sqp_data 
    WHERE date >= CURRENT_DATE - (days || ' days')::INTERVAL;
    
    -- Generate test data
    FOR v_date IN 
        SELECT generate_series(
            CURRENT_DATE - (days || ' days')::INTERVAL,
            CURRENT_DATE,
            INTERVAL '1 day'
        )::DATE
    LOOP
        -- Echo Dot + alexa devices
        v_impressions := 1000 + FLOOR(RANDOM() * 2000)::INTEGER;
        v_clicks := FLOOR(v_impressions * (0.04 + RANDOM() * 0.04))::INTEGER;
        v_purchases := FLOOR(v_clicks * (0.08 + RANDOM() * 0.08))::INTEGER;
        v_spend := ROUND((v_clicks * (0.4 + RANDOM() * 0.6))::NUMERIC, 2);
        v_sales := ROUND((v_purchases * (40 + RANDOM() * 60))::NUMERIC, 2);
        
        INSERT INTO sqp.daily_sqp_data (
            date, query, asin, impressions, clicks, purchases,
            spend, sales, organic_rank, ad_rank,
            click_through_rate, conversion_rate, cost_per_click, acos
        ) VALUES (
            v_date, 
            'alexa devices', 
            'B08N5WRWNW',
            v_impressions, 
            v_clicks, 
            v_purchases,
            v_spend,
            v_sales,
            FLOOR(5 + RANDOM() * 20)::INTEGER,
            FLOOR(1 + RANDOM() * 10)::INTEGER,
            ROUND((v_clicks::NUMERIC / NULLIF(v_impressions, 0)), 4),
            ROUND((v_purchases::NUMERIC / NULLIF(v_clicks, 0)), 4),
            ROUND((v_spend / NULLIF(v_clicks, 0)), 2),
            ROUND((v_spend / NULLIF(v_sales, 0) * 100), 2)
        );
        
        v_count := v_count + 1;
        
        -- Echo Dot + echo dot
        v_impressions := 2000 + FLOOR(RANDOM() * 3000)::INTEGER;
        v_clicks := FLOOR(v_impressions * (0.04 + RANDOM() * 0.06))::INTEGER;
        v_purchases := FLOOR(v_clicks * (0.08 + RANDOM() * 0.12))::INTEGER;
        v_spend := ROUND((v_clicks * (0.35 + RANDOM() * 0.45))::NUMERIC, 2);
        v_sales := ROUND((v_purchases * (40 + RANDOM() * 60))::NUMERIC, 2);
        
        INSERT INTO sqp.daily_sqp_data (
            date, query, asin, impressions, clicks, purchases,
            spend, sales, organic_rank, ad_rank,
            click_through_rate, conversion_rate, cost_per_click, acos
        ) VALUES (
            v_date, 
            'echo dot', 
            'B08N5WRWNW',
            v_impressions, 
            v_clicks, 
            v_purchases,
            v_spend,
            v_sales,
            FLOOR(3 + RANDOM() * 10)::INTEGER,
            FLOOR(1 + RANDOM() * 5)::INTEGER,
            ROUND((v_clicks::NUMERIC / NULLIF(v_impressions, 0)), 4),
            ROUND((v_purchases::NUMERIC / NULLIF(v_clicks, 0)), 4),
            ROUND((v_spend / NULLIF(v_clicks, 0)), 2),
            ROUND((v_spend / NULLIF(v_sales, 0) * 100), 2)
        );
        
        v_count := v_count + 1;
        
        -- Fire TV + streaming device
        v_impressions := 800 + FLOOR(RANDOM() * 1500)::INTEGER;
        v_clicks := FLOOR(v_impressions * (0.04 + RANDOM() * 0.04))::INTEGER;
        v_purchases := FLOOR(v_clicks * (0.08 + RANDOM() * 0.10))::INTEGER;
        v_spend := ROUND((v_clicks * (0.45 + RANDOM() * 0.55))::NUMERIC, 2);
        v_sales := ROUND((v_purchases * (50 + RANDOM() * 50))::NUMERIC, 2);
        
        INSERT INTO sqp.daily_sqp_data (
            date, query, asin, impressions, clicks, purchases,
            spend, sales, organic_rank, ad_rank,
            click_through_rate, conversion_rate, cost_per_click, acos
        ) VALUES (
            v_date, 
            'streaming device', 
            'B08KJN3333',
            v_impressions, 
            v_clicks, 
            v_purchases,
            v_spend,
            v_sales,
            FLOOR(8 + RANDOM() * 25)::INTEGER,
            FLOOR(2 + RANDOM() * 12)::INTEGER,
            ROUND((v_clicks::NUMERIC / NULLIF(v_impressions, 0)), 4),
            ROUND((v_purchases::NUMERIC / NULLIF(v_clicks, 0)), 4),
            ROUND((v_spend / NULLIF(v_clicks, 0)), 2),
            ROUND((v_spend / NULLIF(v_sales, 0) * 100), 2)
        );
        
        v_count := v_count + 1;
        
        -- Add some variety with random keyword-ASIN combinations
        IF RANDOM() < 0.5 THEN
            -- Smart home + Echo Show
            v_impressions := 1200 + FLOOR(RANDOM() * 1800)::INTEGER;
            v_clicks := FLOOR(v_impressions * (0.035 + RANDOM() * 0.045))::INTEGER;
            v_purchases := FLOOR(v_clicks * (0.07 + RANDOM() * 0.09))::INTEGER;
            v_spend := ROUND((v_clicks * (0.40 + RANDOM() * 0.50))::NUMERIC, 2);
            v_sales := ROUND((v_purchases * (60 + RANDOM() * 40))::NUMERIC, 2);
            
            INSERT INTO sqp.daily_sqp_data (
                date, query, asin, impressions, clicks, purchases,
                spend, sales, organic_rank, ad_rank,
                click_through_rate, conversion_rate, cost_per_click, acos
            ) VALUES (
                v_date, 
                'smart home', 
                'B07FZ8S74R',
                v_impressions, 
                v_clicks, 
                v_purchases,
                v_spend,
                v_sales,
                FLOOR(12 + RANDOM() * 25)::INTEGER,
                FLOOR(4 + RANDOM() * 12)::INTEGER,
                ROUND((v_clicks::NUMERIC / NULLIF(v_impressions, 0)), 4),
                ROUND((v_purchases::NUMERIC / NULLIF(v_clicks, 0)), 4),
                ROUND((v_spend / NULLIF(v_clicks, 0)), 2),
                ROUND((v_spend / NULLIF(v_sales, 0) * 100), 2)
            );
            
            v_count := v_count + 1;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT v_count, ('Success - Inserted ' || v_count || ' records')::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.seed_test_data TO authenticated, service_role;

-- Test it with a small batch
SELECT * FROM public.seed_test_data(1);