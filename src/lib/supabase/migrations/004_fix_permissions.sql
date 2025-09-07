-- Fix permissions for sequences and tables
-- This grants necessary permissions for INSERT operations

-- Grant USAGE on all sequences in sqp schema
GRANT USAGE ON ALL SEQUENCES IN SCHEMA sqp TO anon, authenticated, service_role;

-- Grant INSERT permissions on the actual sqp tables (not just the views)
GRANT INSERT, UPDATE, DELETE ON sqp.weekly_summary TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON sqp.monthly_summary TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON sqp.quarterly_summary TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON sqp.yearly_summary TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON sqp.period_comparisons TO anon, authenticated, service_role;

-- Grant permissions for future sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA sqp
GRANT USAGE ON SEQUENCES TO anon, authenticated, service_role;

-- Grant permissions for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA sqp
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;

-- Make sure the views also have proper permissions for INSERT/UPDATE/DELETE
-- This requires creating INSTEAD OF triggers on the views

-- Weekly Summary View Triggers
CREATE OR REPLACE FUNCTION public.sqp_weekly_summary_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO sqp.weekly_summary VALUES (NEW.*);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.sqp_weekly_summary_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sqp.weekly_summary SET
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
    updated_at = CURRENT_TIMESTAMP
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.sqp_weekly_summary_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM sqp.weekly_summary WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sqp_weekly_summary_insert_trigger ON public.sqp_weekly_summary;
DROP TRIGGER IF EXISTS sqp_weekly_summary_update_trigger ON public.sqp_weekly_summary;
DROP TRIGGER IF EXISTS sqp_weekly_summary_delete_trigger ON public.sqp_weekly_summary;

CREATE TRIGGER sqp_weekly_summary_insert_trigger
  INSTEAD OF INSERT ON public.sqp_weekly_summary
  FOR EACH ROW EXECUTE FUNCTION public.sqp_weekly_summary_insert();

CREATE TRIGGER sqp_weekly_summary_update_trigger
  INSTEAD OF UPDATE ON public.sqp_weekly_summary
  FOR EACH ROW EXECUTE FUNCTION public.sqp_weekly_summary_update();

CREATE TRIGGER sqp_weekly_summary_delete_trigger
  INSTEAD OF DELETE ON public.sqp_weekly_summary
  FOR EACH ROW EXECUTE FUNCTION public.sqp_weekly_summary_delete();

-- Period Comparisons View Triggers
CREATE OR REPLACE FUNCTION public.sqp_period_comparisons_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO sqp.period_comparisons VALUES (NEW.*);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sqp_period_comparisons_insert_trigger ON public.sqp_period_comparisons;

CREATE TRIGGER sqp_period_comparisons_insert_trigger
  INSTEAD OF INSERT ON public.sqp_period_comparisons
  FOR EACH ROW EXECUTE FUNCTION public.sqp_period_comparisons_insert();

-- Grant execute permissions on trigger functions
GRANT EXECUTE ON FUNCTION public.sqp_weekly_summary_insert() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sqp_weekly_summary_update() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sqp_weekly_summary_delete() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sqp_period_comparisons_insert() TO anon, authenticated, service_role;