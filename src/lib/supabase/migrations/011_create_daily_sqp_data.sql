-- Create daily_sqp_data table that was referenced but not created
-- This table stores granular daily SQP data

-- Create the daily data table in sqp schema
CREATE TABLE IF NOT EXISTS sqp.daily_sqp_data (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    query TEXT NOT NULL,
    asin VARCHAR(10) NOT NULL,
    
    -- Metrics
    impressions INTEGER NOT NULL DEFAULT 0,
    clicks INTEGER NOT NULL DEFAULT 0,
    purchases INTEGER NOT NULL DEFAULT 0,
    spend DECIMAL(10, 2) DEFAULT 0,
    sales DECIMAL(10, 2) DEFAULT 0,
    
    -- Rankings
    organic_rank INTEGER,
    ad_rank INTEGER,
    
    -- Calculated rates
    click_through_rate DECIMAL(10, 6) DEFAULT 0,
    conversion_rate DECIMAL(10, 6) DEFAULT 0,
    cost_per_click DECIMAL(10, 2) DEFAULT 0,
    acos DECIMAL(10, 2) DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint to prevent duplicates
    UNIQUE(date, query, asin)
);

-- Create indexes for performance
CREATE INDEX idx_daily_sqp_data_date ON sqp.daily_sqp_data(date);
CREATE INDEX idx_daily_sqp_data_query ON sqp.daily_sqp_data(query);
CREATE INDEX idx_daily_sqp_data_asin ON sqp.daily_sqp_data(asin);
CREATE INDEX idx_daily_sqp_data_date_query ON sqp.daily_sqp_data(date, query);
CREATE INDEX idx_daily_sqp_data_performance ON sqp.daily_sqp_data(date, purchases DESC);

-- Create trigger to update weekly_summary when daily data is inserted
CREATE OR REPLACE FUNCTION sqp.update_weekly_summary_from_daily()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate week boundaries
    DECLARE
        v_week_start DATE;
        v_week_end DATE;
    BEGIN
        v_week_start := date_trunc('week', NEW.date)::DATE;
        v_week_end := v_week_start + INTERVAL '6 days';
        
        -- Insert or update weekly summary
        INSERT INTO sqp.weekly_summary (
            period_start,
            period_end,
            query,
            asin,
            total_impressions,
            total_clicks,
            total_purchases,
            avg_ctr,
            avg_cvr,
            purchases_per_impression,
            created_at,
            updated_at
        )
        SELECT 
            v_week_start,
            v_week_end,
            NEW.query,
            NEW.asin,
            SUM(impressions),
            SUM(clicks),
            SUM(purchases),
            AVG(click_through_rate),
            AVG(conversion_rate),
            CASE WHEN SUM(impressions) > 0 
                THEN SUM(purchases)::DECIMAL / SUM(impressions) 
                ELSE 0 
            END,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        FROM sqp.daily_sqp_data
        WHERE date >= v_week_start 
            AND date <= v_week_end
            AND query = NEW.query
            AND asin = NEW.asin
        ON CONFLICT (period_start, query, asin)
        DO UPDATE SET
            total_impressions = EXCLUDED.total_impressions,
            total_clicks = EXCLUDED.total_clicks,
            total_purchases = EXCLUDED.total_purchases,
            avg_ctr = EXCLUDED.avg_ctr,
            avg_cvr = EXCLUDED.avg_cvr,
            purchases_per_impression = EXCLUDED.purchases_per_impression,
            updated_at = CURRENT_TIMESTAMP;
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS update_weekly_summary_trigger ON sqp.daily_sqp_data;
CREATE TRIGGER update_weekly_summary_trigger
AFTER INSERT OR UPDATE ON sqp.daily_sqp_data
FOR EACH ROW
EXECUTE FUNCTION sqp.update_weekly_summary_from_daily();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON sqp.daily_sqp_data TO authenticated, service_role;
GRANT USAGE ON SEQUENCE sqp.daily_sqp_data_id_seq TO authenticated, service_role;

-- Update the public view (if migration 010 was already run)
DROP VIEW IF EXISTS public.daily_sqp_data CASCADE;

CREATE OR REPLACE VIEW public.daily_sqp_data AS
SELECT * FROM sqp.daily_sqp_data;

-- Re-create rules for the view
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

CREATE OR REPLACE RULE delete_daily_sqp_data AS
ON DELETE TO public.daily_sqp_data
DO INSTEAD
DELETE FROM sqp.daily_sqp_data WHERE id = OLD.id;

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

-- Grant permissions on the view
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_sqp_data TO authenticated, service_role;