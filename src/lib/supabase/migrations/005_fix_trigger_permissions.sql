-- Fix trigger functions to properly handle inserts through views
-- The trigger functions need to be owned by a role with permissions on sqp schema

-- Update trigger functions to use SECURITY DEFINER
DROP FUNCTION IF EXISTS public.sqp_weekly_summary_insert() CASCADE;
CREATE OR REPLACE FUNCTION public.sqp_weekly_summary_insert()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, sqp
AS $$
BEGIN
  INSERT INTO sqp.weekly_summary (
    period_start, period_end, query, asin,
    total_impressions, total_clicks, total_purchases,
    avg_ctr, avg_cvr, purchases_per_impression,
    impression_share, click_share, purchase_share,
    min_impressions, max_impressions, avg_impressions, stddev_impressions
  ) VALUES (
    NEW.period_start, NEW.period_end, NEW.query, NEW.asin,
    NEW.total_impressions, NEW.total_clicks, NEW.total_purchases,
    NEW.avg_ctr, NEW.avg_cvr, NEW.purchases_per_impression,
    NEW.impression_share, NEW.click_share, NEW.purchase_share,
    NEW.min_impressions, NEW.max_impressions, NEW.avg_impressions, NEW.stddev_impressions
  ) RETURNING * INTO NEW;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS public.sqp_monthly_summary_insert() CASCADE;
CREATE OR REPLACE FUNCTION public.sqp_monthly_summary_insert()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, sqp
AS $$
BEGIN
  INSERT INTO sqp.monthly_summary (
    period_start, period_end, year, month, query, asin,
    total_impressions, total_clicks, total_purchases,
    avg_ctr, avg_cvr, purchases_per_impression,
    impression_share, click_share, purchase_share,
    active_weeks
  ) VALUES (
    NEW.period_start, NEW.period_end, NEW.year, NEW.month, NEW.query, NEW.asin,
    NEW.total_impressions, NEW.total_clicks, NEW.total_purchases,
    NEW.avg_ctr, NEW.avg_cvr, NEW.purchases_per_impression,
    NEW.impression_share, NEW.click_share, NEW.purchase_share,
    NEW.active_weeks
  ) RETURNING * INTO NEW;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS public.sqp_period_comparisons_insert() CASCADE;
CREATE OR REPLACE FUNCTION public.sqp_period_comparisons_insert()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, sqp
AS $$
BEGIN
  INSERT INTO sqp.period_comparisons (
    period_type, current_period_start, current_period_end,
    previous_period_start, previous_period_end, query, asin,
    current_impressions, current_clicks, current_purchases,
    current_ctr, current_cvr,
    previous_impressions, previous_clicks, previous_purchases,
    previous_ctr, previous_cvr,
    impressions_change, clicks_change, purchases_change,
    ctr_change, cvr_change,
    impressions_change_pct, clicks_change_pct, purchases_change_pct
  ) VALUES (
    NEW.period_type, NEW.current_period_start, NEW.current_period_end,
    NEW.previous_period_start, NEW.previous_period_end, NEW.query, NEW.asin,
    NEW.current_impressions, NEW.current_clicks, NEW.current_purchases,
    NEW.current_ctr, NEW.current_cvr,
    NEW.previous_impressions, NEW.previous_clicks, NEW.previous_purchases,
    NEW.previous_ctr, NEW.previous_cvr,
    NEW.impressions_change, NEW.clicks_change, NEW.purchases_change,
    NEW.ctr_change, NEW.cvr_change,
    NEW.impressions_change_pct, NEW.clicks_change_pct, NEW.purchases_change_pct
  ) RETURNING * INTO NEW;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for monthly summary
CREATE TRIGGER sqp_monthly_summary_insert_trigger
  INSTEAD OF INSERT ON public.sqp_monthly_summary
  FOR EACH ROW EXECUTE FUNCTION public.sqp_monthly_summary_insert();

-- Re-create triggers for other views
CREATE TRIGGER sqp_weekly_summary_insert_trigger
  INSTEAD OF INSERT ON public.sqp_weekly_summary
  FOR EACH ROW EXECUTE FUNCTION public.sqp_weekly_summary_insert();

CREATE TRIGGER sqp_period_comparisons_insert_trigger
  INSTEAD OF INSERT ON public.sqp_period_comparisons
  FOR EACH ROW EXECUTE FUNCTION public.sqp_period_comparisons_insert();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.sqp_weekly_summary_insert() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sqp_monthly_summary_insert() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sqp_period_comparisons_insert() TO anon, authenticated, service_role;

-- Also grant schema usage
GRANT USAGE ON SCHEMA sqp TO anon, authenticated, service_role;