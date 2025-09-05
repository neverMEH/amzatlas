-- Migration: 033_create_minimal_public_views.sql
-- Description: Create minimal public schema views for edge functions
-- Created: 2025-09-05

-- Only create views for the essential refresh infrastructure tables
-- These should exist from migration 031

-- Infrastructure tables only
CREATE OR REPLACE VIEW public.refresh_config AS
SELECT * FROM sqp.refresh_config;

CREATE OR REPLACE VIEW public.refresh_audit_log AS
SELECT * FROM sqp.refresh_audit_log;

CREATE OR REPLACE VIEW public.refresh_checkpoints AS
SELECT * FROM sqp.refresh_checkpoints;

-- Grant permissions to service role
GRANT ALL ON public.refresh_config TO service_role;
GRANT ALL ON public.refresh_audit_log TO service_role;
GRANT ALL ON public.refresh_checkpoints TO service_role;

-- Also grant read permissions to authenticated role
GRANT SELECT ON public.refresh_config TO authenticated;
GRANT SELECT ON public.refresh_audit_log TO authenticated;
GRANT SELECT ON public.refresh_checkpoints TO authenticated;