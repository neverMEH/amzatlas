-- Migration: 033_create_public_views_for_edge_functions.sql
-- Description: Create public schema views for edge functions to access sqp tables
-- Created: 2025-09-05

-- Create views in public schema that point to sqp tables
CREATE OR REPLACE VIEW public.refresh_config AS
SELECT * FROM sqp.refresh_config;

CREATE OR REPLACE VIEW public.refresh_audit_log AS
SELECT * FROM sqp.refresh_audit_log;

CREATE OR REPLACE VIEW public.refresh_checkpoints AS
SELECT * FROM sqp.refresh_checkpoints;

CREATE OR REPLACE VIEW public.asin_performance_data AS
SELECT * FROM sqp.asin_performance_data;

CREATE OR REPLACE VIEW public.search_query_performance AS
SELECT * FROM sqp.search_query_performance;

CREATE OR REPLACE VIEW public.daily_sqp_data AS
SELECT * FROM sqp.daily_sqp_data;

CREATE OR REPLACE VIEW public.weekly_summary AS
SELECT * FROM sqp.weekly_summary;

CREATE OR REPLACE VIEW public.monthly_summary AS
SELECT * FROM sqp.monthly_summary;

CREATE OR REPLACE VIEW public.quarterly_summary AS
SELECT * FROM sqp.quarterly_summary;

CREATE OR REPLACE VIEW public.yearly_summary AS
SELECT * FROM sqp.yearly_summary;

-- Grant permissions to service role
GRANT ALL ON public.refresh_config TO service_role;
GRANT ALL ON public.refresh_audit_log TO service_role;
GRANT ALL ON public.refresh_checkpoints TO service_role;
GRANT ALL ON public.asin_performance_data TO service_role;
GRANT ALL ON public.search_query_performance TO service_role;
GRANT ALL ON public.daily_sqp_data TO service_role;
GRANT ALL ON public.weekly_summary TO service_role;
GRANT ALL ON public.monthly_summary TO service_role;
GRANT ALL ON public.quarterly_summary TO service_role;
GRANT ALL ON public.yearly_summary TO service_role;