-- Add UPDATE triggers for the views

-- Weekly Summary Update Function
DROP FUNCTION IF EXISTS public.sqp_weekly_summary_update() CASCADE;
CREATE OR REPLACE FUNCTION public.sqp_weekly_summary_update()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, sqp
AS $$
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
  WHERE id = OLD.id
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Monthly Summary Update Function
DROP FUNCTION IF EXISTS public.sqp_monthly_summary_update() CASCADE;
CREATE OR REPLACE FUNCTION public.sqp_monthly_summary_update()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, sqp
AS $$
BEGIN
  UPDATE sqp.monthly_summary SET
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
    updated_at = CURRENT_TIMESTAMP
  WHERE id = OLD.id
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Period Comparison Update Function
DROP FUNCTION IF EXISTS public.sqp_period_comparisons_update() CASCADE;
CREATE OR REPLACE FUNCTION public.sqp_period_comparisons_update()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, sqp
AS $$
BEGIN
  UPDATE sqp.period_comparisons SET
    period_type = NEW.period_type,
    current_period_start = NEW.current_period_start,
    current_period_end = NEW.current_period_end,
    previous_period_start = NEW.previous_period_start,
    previous_period_end = NEW.previous_period_end,
    query = NEW.query,
    asin = NEW.asin,
    current_impressions = NEW.current_impressions,
    current_clicks = NEW.current_clicks,
    current_purchases = NEW.current_purchases,
    current_ctr = NEW.current_ctr,
    current_cvr = NEW.current_cvr,
    previous_impressions = NEW.previous_impressions,
    previous_clicks = NEW.previous_clicks,
    previous_purchases = NEW.previous_purchases,
    previous_ctr = NEW.previous_ctr,
    previous_cvr = NEW.previous_cvr,
    impressions_change = NEW.impressions_change,
    clicks_change = NEW.clicks_change,
    purchases_change = NEW.purchases_change,
    ctr_change = NEW.ctr_change,
    cvr_change = NEW.cvr_change,
    impressions_change_pct = NEW.impressions_change_pct,
    clicks_change_pct = NEW.clicks_change_pct,
    purchases_change_pct = NEW.purchases_change_pct
  WHERE id = OLD.id
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create UPDATE triggers
CREATE TRIGGER sqp_weekly_summary_update_trigger
  INSTEAD OF UPDATE ON public.sqp_weekly_summary
  FOR EACH ROW EXECUTE FUNCTION public.sqp_weekly_summary_update();

CREATE TRIGGER sqp_monthly_summary_update_trigger
  INSTEAD OF UPDATE ON public.sqp_monthly_summary
  FOR EACH ROW EXECUTE FUNCTION public.sqp_monthly_summary_update();

CREATE TRIGGER sqp_period_comparisons_update_trigger
  INSTEAD OF UPDATE ON public.sqp_period_comparisons
  FOR EACH ROW EXECUTE FUNCTION public.sqp_period_comparisons_update();

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.sqp_weekly_summary_update() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sqp_monthly_summary_update() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sqp_period_comparisons_update() TO anon, authenticated, service_role;