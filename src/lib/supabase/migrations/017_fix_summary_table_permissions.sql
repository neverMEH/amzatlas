-- Fix permissions for summary tables and create public views
-- This migration addresses permission issues encountered during sync

-- Grant proper permissions on sqp schema tables
GRANT ALL ON sqp.weekly_summary TO authenticated, service_role;
GRANT ALL ON sqp.monthly_summary TO authenticated, service_role;
GRANT ALL ON sqp.quarterly_summary TO authenticated, service_role;
GRANT ALL ON sqp.yearly_summary TO authenticated, service_role;

-- Grant sequence permissions
GRANT USAGE ON SEQUENCE sqp.weekly_summary_id_seq TO authenticated, service_role;
GRANT USAGE ON SEQUENCE sqp.monthly_summary_id_seq TO authenticated, service_role;
GRANT USAGE ON SEQUENCE sqp.quarterly_summary_id_seq TO authenticated, service_role;
GRANT USAGE ON SEQUENCE sqp.yearly_summary_id_seq TO authenticated, service_role;

-- Create or replace public views for summary tables
CREATE OR REPLACE VIEW public.weekly_summary AS
SELECT * FROM sqp.weekly_summary;

CREATE OR REPLACE VIEW public.monthly_summary AS
SELECT * FROM sqp.monthly_summary;

CREATE OR REPLACE VIEW public.quarterly_summary AS
SELECT * FROM sqp.quarterly_summary;

CREATE OR REPLACE VIEW public.yearly_summary AS
SELECT * FROM sqp.yearly_summary;

-- Grant permissions on public views
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_summary TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_summary TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quarterly_summary TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.yearly_summary TO authenticated, service_role;

-- Create rules to make views updatable for weekly_summary
CREATE OR REPLACE RULE weekly_summary_insert AS ON INSERT TO public.weekly_summary 
DO INSTEAD INSERT INTO sqp.weekly_summary VALUES (NEW.*) RETURNING *;

CREATE OR REPLACE RULE weekly_summary_update AS ON UPDATE TO public.weekly_summary 
DO INSTEAD UPDATE sqp.weekly_summary SET 
    period_start = NEW.period_start,
    period_end = NEW.period_end,
    query = NEW.query,
    asin = NEW.asin,
    total_impressions = NEW.total_impressions,
    total_clicks = NEW.total_clicks,
    total_purchases = NEW.total_purchases,
    avg_ctr = NEW.avg_ctr,
    avg_cvr = NEW.avg_cvr,
    purchases_per_impression = NEW.purchases_per_impression,
    impression_share = NEW.impression_share,
    click_share = NEW.click_share,
    purchase_share = NEW.purchase_share,
    min_impressions = NEW.min_impressions,
    max_impressions = NEW.max_impressions,
    avg_impressions = NEW.avg_impressions,
    stddev_impressions = NEW.stddev_impressions,
    updated_at = NEW.updated_at,
    bigquery_sync_id = NEW.bigquery_sync_id,
    sync_log_id = NEW.sync_log_id,
    last_synced_at = NEW.last_synced_at,
    search_query_score = NEW.search_query_score,
    search_query_volume = NEW.search_query_volume,
    total_query_impression_count = NEW.total_query_impression_count,
    total_click_count = NEW.total_click_count,
    total_cart_add_count = NEW.total_cart_add_count,
    total_purchase_count = NEW.total_purchase_count,
    total_median_click_price = NEW.total_median_click_price,
    asin_median_click_price = NEW.asin_median_click_price,
    total_median_cart_add_price = NEW.total_median_cart_add_price,
    asin_median_cart_add_price = NEW.asin_median_cart_add_price,
    total_median_purchase_price = NEW.total_median_purchase_price,
    asin_median_purchase_price = NEW.asin_median_purchase_price,
    cart_adds = NEW.cart_adds,
    cart_add_rate = NEW.cart_add_rate,
    cart_add_share = NEW.cart_add_share
WHERE id = OLD.id RETURNING *;

CREATE OR REPLACE RULE weekly_summary_delete AS ON DELETE TO public.weekly_summary 
DO INSTEAD DELETE FROM sqp.weekly_summary WHERE id = OLD.id;

-- Create rules for monthly_summary
CREATE OR REPLACE RULE monthly_summary_insert AS ON INSERT TO public.monthly_summary 
DO INSTEAD INSERT INTO sqp.monthly_summary VALUES (NEW.*) RETURNING *;

CREATE OR REPLACE RULE monthly_summary_update AS ON UPDATE TO public.monthly_summary 
DO INSTEAD UPDATE sqp.monthly_summary SET 
    period_start = NEW.period_start,
    period_end = NEW.period_end,
    year = NEW.year,
    month = NEW.month,
    query = NEW.query,
    asin = NEW.asin,
    total_impressions = NEW.total_impressions,
    total_clicks = NEW.total_clicks,
    total_purchases = NEW.total_purchases,
    avg_ctr = NEW.avg_ctr,
    avg_cvr = NEW.avg_cvr,
    purchases_per_impression = NEW.purchases_per_impression,
    impression_share = NEW.impression_share,
    click_share = NEW.click_share,
    purchase_share = NEW.purchase_share,
    active_weeks = NEW.active_weeks,
    updated_at = NEW.updated_at,
    cart_adds = NEW.cart_adds,
    cart_add_rate = NEW.cart_add_rate,
    cart_add_share = NEW.cart_add_share
WHERE id = OLD.id RETURNING *;

CREATE OR REPLACE RULE monthly_summary_delete AS ON DELETE TO public.monthly_summary 
DO INSTEAD DELETE FROM sqp.monthly_summary WHERE id = OLD.id;

-- Create rules for quarterly_summary
CREATE OR REPLACE RULE quarterly_summary_insert AS ON INSERT TO public.quarterly_summary 
DO INSTEAD INSERT INTO sqp.quarterly_summary VALUES (NEW.*) RETURNING *;

CREATE OR REPLACE RULE quarterly_summary_update AS ON UPDATE TO public.quarterly_summary 
DO INSTEAD UPDATE sqp.quarterly_summary SET 
    period_start = NEW.period_start,
    period_end = NEW.period_end,
    year = NEW.year,
    quarter = NEW.quarter,
    query = NEW.query,
    asin = NEW.asin,
    total_impressions = NEW.total_impressions,
    total_clicks = NEW.total_clicks,
    total_purchases = NEW.total_purchases,
    avg_ctr = NEW.avg_ctr,
    avg_cvr = NEW.avg_cvr,
    purchases_per_impression = NEW.purchases_per_impression,
    impression_share = NEW.impression_share,
    click_share = NEW.click_share,
    purchase_share = NEW.purchase_share,
    active_weeks = NEW.active_weeks,
    active_months = NEW.active_months,
    updated_at = NEW.updated_at,
    cart_adds = NEW.cart_adds,
    cart_add_rate = NEW.cart_add_rate,
    cart_add_share = NEW.cart_add_share
WHERE id = OLD.id RETURNING *;

CREATE OR REPLACE RULE quarterly_summary_delete AS ON DELETE TO public.quarterly_summary 
DO INSTEAD DELETE FROM sqp.quarterly_summary WHERE id = OLD.id;

-- Create rules for yearly_summary
CREATE OR REPLACE RULE yearly_summary_insert AS ON INSERT TO public.yearly_summary 
DO INSTEAD INSERT INTO sqp.yearly_summary VALUES (NEW.*) RETURNING *;

CREATE OR REPLACE RULE yearly_summary_update AS ON UPDATE TO public.yearly_summary 
DO INSTEAD UPDATE sqp.yearly_summary SET 
    year = NEW.year,
    query = NEW.query,
    asin = NEW.asin,
    total_impressions = NEW.total_impressions,
    total_clicks = NEW.total_clicks,
    total_purchases = NEW.total_purchases,
    avg_ctr = NEW.avg_ctr,
    avg_cvr = NEW.avg_cvr,
    purchases_per_impression = NEW.purchases_per_impression,
    impression_share = NEW.impression_share,
    click_share = NEW.click_share,
    purchase_share = NEW.purchase_share,
    active_weeks = NEW.active_weeks,
    active_months = NEW.active_months,
    active_quarters = NEW.active_quarters,
    updated_at = NEW.updated_at,
    cart_adds = NEW.cart_adds,
    cart_add_rate = NEW.cart_add_rate,
    cart_add_share = NEW.cart_add_share
WHERE id = OLD.id RETURNING *;

CREATE OR REPLACE RULE yearly_summary_delete AS ON DELETE TO public.yearly_summary 
DO INSTEAD DELETE FROM sqp.yearly_summary WHERE id = OLD.id;

-- Refresh materialized view permissions
REFRESH MATERIALIZED VIEW sqp.search_performance_summary;

-- Add comments for documentation
COMMENT ON VIEW public.weekly_summary IS 'Public schema view for sqp.weekly_summary table';
COMMENT ON VIEW public.monthly_summary IS 'Public schema view for sqp.monthly_summary table';
COMMENT ON VIEW public.quarterly_summary IS 'Public schema view for sqp.quarterly_summary table';
COMMENT ON VIEW public.yearly_summary IS 'Public schema view for sqp.yearly_summary table';