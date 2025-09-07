-- Create views in public schema that reference sqp schema tables
-- This allows the Supabase client to access sqp data through the public schema

-- Note: Run migration 011 first to create daily_sqp_data table if it doesn't exist

-- Create view for daily_sqp_data (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'sqp' AND table_name = 'daily_sqp_data') THEN
        CREATE OR REPLACE VIEW public.daily_sqp_data AS
        SELECT * FROM sqp.daily_sqp_data;
    END IF;
END $$;

-- Create view for weekly_summary
CREATE OR REPLACE VIEW public.weekly_summary AS
SELECT * FROM sqp.weekly_summary;

-- Create view for monthly_summary
CREATE OR REPLACE VIEW public.monthly_summary AS
SELECT * FROM sqp.monthly_summary;

-- Create view for yearly_summary
CREATE OR REPLACE VIEW public.yearly_summary AS
SELECT * FROM sqp.yearly_summary;

-- Grant permissions on these views
GRANT SELECT ON public.daily_sqp_data TO authenticated, service_role;
GRANT SELECT ON public.weekly_summary TO authenticated, service_role;
GRANT SELECT ON public.monthly_summary TO authenticated, service_role;
GRANT SELECT ON public.yearly_summary TO authenticated, service_role;

-- For inserting data, we need to create rules or triggers
-- Create INSTEAD OF INSERT rules for the views

-- Rule for inserting into daily_sqp_data
CREATE OR REPLACE RULE insert_daily_sqp_data AS
ON INSERT TO public.daily_sqp_data
DO INSTEAD
INSERT INTO sqp.daily_sqp_data (
    date, query, asin, impressions, clicks, purchases,
    spend, sales, organic_rank, ad_rank,
    click_through_rate, conversion_rate, cost_per_click, acos,
    created_at, updated_at
) VALUES (
    NEW.date, NEW.query, NEW.asin, NEW.impressions, NEW.clicks, NEW.purchases,
    NEW.spend, NEW.sales, NEW.organic_rank, NEW.ad_rank,
    NEW.click_through_rate, NEW.conversion_rate, NEW.cost_per_click, NEW.acos,
    COALESCE(NEW.created_at, CURRENT_TIMESTAMP), 
    COALESCE(NEW.updated_at, CURRENT_TIMESTAMP)
);

-- Rule for deleting from daily_sqp_data
CREATE OR REPLACE RULE delete_daily_sqp_data AS
ON DELETE TO public.daily_sqp_data
DO INSTEAD
DELETE FROM sqp.daily_sqp_data WHERE id = OLD.id;

-- Rule for updating daily_sqp_data
CREATE OR REPLACE RULE update_daily_sqp_data AS
ON UPDATE TO public.daily_sqp_data
DO INSTEAD
UPDATE sqp.daily_sqp_data SET
    date = NEW.date,
    query = NEW.query,
    asin = NEW.asin,
    impressions = NEW.impressions,
    clicks = NEW.clicks,
    purchases = NEW.purchases,
    spend = NEW.spend,
    sales = NEW.sales,
    organic_rank = NEW.organic_rank,
    ad_rank = NEW.ad_rank,
    click_through_rate = NEW.click_through_rate,
    conversion_rate = NEW.conversion_rate,
    cost_per_click = NEW.cost_per_click,
    acos = NEW.acos,
    updated_at = CURRENT_TIMESTAMP
WHERE id = OLD.id;

-- Grant INSERT, UPDATE, DELETE permissions
GRANT INSERT, UPDATE, DELETE ON public.daily_sqp_data TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.weekly_summary TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.monthly_summary TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.yearly_summary TO authenticated, service_role;

-- Create helper function for seeding data directly in SQL
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
BEGIN
    -- Clear existing recent data (optional)
    DELETE FROM sqp.daily_sqp_data 
    WHERE date >= CURRENT_DATE - INTERVAL '1 day' * days;
    
    -- Generate test data
    FOR v_date IN 
        SELECT generate_series(
            CURRENT_DATE - INTERVAL '1 day' * days,
            CURRENT_DATE,
            INTERVAL '1 day'
        )::DATE
    LOOP
        -- Echo Dot + alexa devices
        v_impressions := 1000 + FLOOR(RANDOM() * 2000);
        v_clicks := FLOOR(v_impressions * (0.04 + RANDOM() * 0.04));
        v_purchases := FLOOR(v_clicks * (0.08 + RANDOM() * 0.08));
        
        INSERT INTO sqp.daily_sqp_data (
            date, query, asin, impressions, clicks, purchases,
            spend, sales, organic_rank, ad_rank,
            click_through_rate, conversion_rate, cost_per_click, acos
        ) VALUES (
            v_date, 'alexa devices', 'B08N5WRWNW',
            v_impressions, v_clicks, v_purchases,
            ROUND((v_clicks * (0.4 + RANDOM() * 0.6))::NUMERIC, 2),
            ROUND((v_purchases * (40 + RANDOM() * 60))::NUMERIC, 2),
            FLOOR(5 + RANDOM() * 20)::INTEGER,
            FLOOR(1 + RANDOM() * 10)::INTEGER,
            ROUND(v_clicks::NUMERIC / NULLIF(v_impressions, 0), 4),
            ROUND(v_purchases::NUMERIC / NULLIF(v_clicks, 0), 4),
            ROUND((0.4 + RANDOM() * 0.6)::NUMERIC, 2),
            ROUND((10 + RANDOM() * 20)::NUMERIC, 2)
        );
        
        v_count := v_count + 1;
        
        -- Echo Dot + echo dot
        v_impressions := 2000 + FLOOR(RANDOM() * 3000);
        v_clicks := FLOOR(v_impressions * (0.04 + RANDOM() * 0.06));
        v_purchases := FLOOR(v_clicks * (0.08 + RANDOM() * 0.12));
        
        INSERT INTO sqp.daily_sqp_data (
            date, query, asin, impressions, clicks, purchases,
            spend, sales, organic_rank, ad_rank,
            click_through_rate, conversion_rate, cost_per_click, acos
        ) VALUES (
            v_date, 'echo dot', 'B08N5WRWNW',
            v_impressions, v_clicks, v_purchases,
            ROUND((v_clicks * (0.35 + RANDOM() * 0.45))::NUMERIC, 2),
            ROUND((v_purchases * (40 + RANDOM() * 60))::NUMERIC, 2),
            FLOOR(3 + RANDOM() * 10)::INTEGER,
            FLOOR(1 + RANDOM() * 5)::INTEGER,
            ROUND(v_clicks::NUMERIC / NULLIF(v_impressions, 0), 4),
            ROUND(v_purchases::NUMERIC / NULLIF(v_clicks, 0), 4),
            ROUND((0.35 + RANDOM() * 0.45)::NUMERIC, 2),
            ROUND((8 + RANDOM() * 25)::NUMERIC, 2)
        );
        
        v_count := v_count + 1;
        
        -- Fire TV + streaming device
        v_impressions := 800 + FLOOR(RANDOM() * 1500);
        v_clicks := FLOOR(v_impressions * (0.04 + RANDOM() * 0.04));
        v_purchases := FLOOR(v_clicks * (0.08 + RANDOM() * 0.10));
        
        INSERT INTO sqp.daily_sqp_data (
            date, query, asin, impressions, clicks, purchases,
            spend, sales, organic_rank, ad_rank,
            click_through_rate, conversion_rate, cost_per_click, acos
        ) VALUES (
            v_date, 'streaming device', 'B08KJN3333',
            v_impressions, v_clicks, v_purchases,
            ROUND((v_clicks * (0.45 + RANDOM() * 0.55))::NUMERIC, 2),
            ROUND((v_purchases * (50 + RANDOM() * 50))::NUMERIC, 2),
            FLOOR(8 + RANDOM() * 25)::INTEGER,
            FLOOR(2 + RANDOM() * 12)::INTEGER,
            ROUND(v_clicks::NUMERIC / NULLIF(v_impressions, 0), 4),
            ROUND(v_purchases::NUMERIC / NULLIF(v_clicks, 0), 4),
            ROUND((0.45 + RANDOM() * 0.55)::NUMERIC, 2),
            ROUND((12 + RANDOM() * 28)::NUMERIC, 2)
        );
        
        v_count := v_count + 1;
    END LOOP;
    
    RETURN QUERY SELECT v_count, 'Success - Inserted ' || v_count || ' records'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.seed_test_data TO authenticated, service_role;