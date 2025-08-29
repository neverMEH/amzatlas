-- Migration: Create public views for sqp tables
-- Description: Expose sqp schema tables through public schema views for API access

-- Drop existing views if they exist
DROP VIEW IF EXISTS public.asin_performance_data CASCADE;
DROP VIEW IF EXISTS public.search_query_performance CASCADE;
DROP VIEW IF EXISTS public.sync_log CASCADE;
DROP VIEW IF EXISTS public.data_quality_checks CASCADE;
DROP VIEW IF EXISTS public.asin_brand_mapping CASCADE;
DROP VIEW IF EXISTS public.brands CASCADE;
DROP VIEW IF EXISTS public.brand_hierarchy CASCADE;

-- Create views in public schema that reference sqp tables

-- ASIN Performance Data
CREATE VIEW public.asin_performance_data AS
SELECT * FROM sqp.asin_performance_data;

-- Search Query Performance
CREATE VIEW public.search_query_performance AS
SELECT * FROM sqp.search_query_performance;

-- Sync Log
CREATE VIEW public.sync_log AS
SELECT * FROM sqp.sync_log;

-- Data Quality Checks
CREATE VIEW public.data_quality_checks AS
SELECT * FROM sqp.data_quality_checks;

-- ASIN Brand Mapping
CREATE VIEW public.asin_brand_mapping AS
SELECT * FROM sqp.asin_brand_mapping;

-- Brands
CREATE VIEW public.brands AS
SELECT * FROM sqp.brands;

-- Brand Hierarchy
CREATE VIEW public.brand_hierarchy AS
SELECT * FROM sqp.brand_hierarchy;

-- Create INSTEAD OF triggers to handle INSERT/UPDATE/DELETE operations on views

-- Trigger for asin_performance_data
CREATE OR REPLACE FUNCTION public.asin_performance_data_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO sqp.asin_performance_data VALUES (NEW.*);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE sqp.asin_performance_data 
    SET start_date = NEW.start_date,
        end_date = NEW.end_date,
        asin = NEW.asin,
        product_title = NEW.product_title,
        updated_at = NEW.updated_at
    WHERE id = OLD.id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM sqp.asin_performance_data WHERE id = OLD.id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER asin_performance_data_instead
INSTEAD OF INSERT OR UPDATE OR DELETE ON public.asin_performance_data
FOR EACH ROW EXECUTE FUNCTION public.asin_performance_data_trigger();

-- Trigger for search_query_performance
CREATE OR REPLACE FUNCTION public.search_query_performance_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO sqp.search_query_performance VALUES (NEW.*);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE sqp.search_query_performance SET (
      asin_performance_id,
      search_query,
      search_query_score,
      search_query_volume,
      total_query_impression_count,
      asin_impression_count,
      asin_impression_share,
      total_click_count,
      total_click_rate,
      asin_click_count,
      asin_click_share,
      total_median_click_price,
      asin_median_click_price,
      total_same_day_shipping_click_count,
      total_one_day_shipping_click_count,
      total_two_day_shipping_click_count,
      total_cart_add_count,
      total_cart_add_rate,
      asin_cart_add_count,
      asin_cart_add_share,
      total_median_cart_add_price,
      asin_median_cart_add_price,
      total_same_day_shipping_cart_add_count,
      total_one_day_shipping_cart_add_count,
      total_two_day_shipping_cart_add_count,
      total_purchase_count,
      total_purchase_rate,
      asin_purchase_count,
      asin_purchase_share,
      total_median_purchase_price,
      asin_median_purchase_price,
      total_same_day_shipping_purchase_count,
      total_one_day_shipping_purchase_count,
      total_two_day_shipping_purchase_count,
      updated_at
    ) = (
      NEW.asin_performance_id,
      NEW.search_query,
      NEW.search_query_score,
      NEW.search_query_volume,
      NEW.total_query_impression_count,
      NEW.asin_impression_count,
      NEW.asin_impression_share,
      NEW.total_click_count,
      NEW.total_click_rate,
      NEW.asin_click_count,
      NEW.asin_click_share,
      NEW.total_median_click_price,
      NEW.asin_median_click_price,
      NEW.total_same_day_shipping_click_count,
      NEW.total_one_day_shipping_click_count,
      NEW.total_two_day_shipping_click_count,
      NEW.total_cart_add_count,
      NEW.total_cart_add_rate,
      NEW.asin_cart_add_count,
      NEW.asin_cart_add_share,
      NEW.total_median_cart_add_price,
      NEW.asin_median_cart_add_price,
      NEW.total_same_day_shipping_cart_add_count,
      NEW.total_one_day_shipping_cart_add_count,
      NEW.total_two_day_shipping_cart_add_count,
      NEW.total_purchase_count,
      NEW.total_purchase_rate,
      NEW.asin_purchase_count,
      NEW.asin_purchase_share,
      NEW.total_median_purchase_price,
      NEW.asin_median_purchase_price,
      NEW.total_same_day_shipping_purchase_count,
      NEW.total_one_day_shipping_purchase_count,
      NEW.total_two_day_shipping_purchase_count,
      NEW.updated_at
    )
    WHERE id = OLD.id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM sqp.search_query_performance WHERE id = OLD.id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER search_query_performance_instead
INSTEAD OF INSERT OR UPDATE OR DELETE ON public.search_query_performance
FOR EACH ROW EXECUTE FUNCTION public.search_query_performance_trigger();


-- Grant permissions
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT INSERT, UPDATE ON public.asin_performance_data TO anon, authenticated;
GRANT INSERT, UPDATE ON public.search_query_performance TO anon, authenticated;
GRANT INSERT ON public.sync_log TO anon, authenticated;
GRANT INSERT ON public.data_quality_checks TO anon, authenticated;

-- Comments
COMMENT ON VIEW public.asin_performance_data IS 'Public view for sqp.asin_performance_data to enable API access';
COMMENT ON VIEW public.search_query_performance IS 'Public view for sqp.search_query_performance to enable API access';
COMMENT ON VIEW public.sync_log IS 'Public view for sqp.sync_log to enable API access';
COMMENT ON VIEW public.data_quality_checks IS 'Public view for sqp.data_quality_checks to enable API access';
COMMENT ON VIEW public.asin_brand_mapping IS 'Public view for sqp.asin_brand_mapping to enable API access';
COMMENT ON VIEW public.brands IS 'Public view for sqp.brands to enable API access';
COMMENT ON VIEW public.brand_hierarchy IS 'Public view for sqp.brand_hierarchy to enable API access';