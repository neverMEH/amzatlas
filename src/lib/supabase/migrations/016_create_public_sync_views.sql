-- Create views in public schema for sync_log and data_quality_checks tables
-- This allows the Supabase client to access these tables since it only supports public schema

-- Create view for sync_log
CREATE OR REPLACE VIEW public.sync_log AS
SELECT * FROM sqp.sync_log;

-- Create view for data_quality_checks  
CREATE OR REPLACE VIEW public.data_quality_checks AS
SELECT * FROM sqp.data_quality_checks;

-- Grant permissions for authenticated and service role users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_log TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_quality_checks TO authenticated, service_role;

-- Create rules to make views updatable
CREATE OR REPLACE RULE sync_log_insert AS ON INSERT TO public.sync_log 
DO INSTEAD INSERT INTO sqp.sync_log VALUES (NEW.*);

CREATE OR REPLACE RULE sync_log_update AS ON UPDATE TO public.sync_log 
DO INSTEAD UPDATE sqp.sync_log SET 
    sync_type = NEW.sync_type,
    sync_status = NEW.sync_status,
    started_at = NEW.started_at,
    completed_at = NEW.completed_at,
    source_table = NEW.source_table,
    target_table = NEW.target_table,
    period_start = NEW.period_start,
    period_end = NEW.period_end,
    records_processed = NEW.records_processed,
    records_inserted = NEW.records_inserted,
    records_updated = NEW.records_updated,
    records_failed = NEW.records_failed,
    error_message = NEW.error_message,
    error_details = NEW.error_details,
    sync_metadata = NEW.sync_metadata
WHERE id = OLD.id;

CREATE OR REPLACE RULE sync_log_delete AS ON DELETE TO public.sync_log 
DO INSTEAD DELETE FROM sqp.sync_log WHERE id = OLD.id;

-- Similar rules for data_quality_checks
CREATE OR REPLACE RULE data_quality_checks_insert AS ON INSERT TO public.data_quality_checks 
DO INSTEAD INSERT INTO sqp.data_quality_checks VALUES (NEW.*);

CREATE OR REPLACE RULE data_quality_checks_update AS ON UPDATE TO public.data_quality_checks 
DO INSTEAD UPDATE sqp.data_quality_checks SET 
    sync_log_id = NEW.sync_log_id,
    check_type = NEW.check_type,
    check_status = NEW.check_status,
    source_value = NEW.source_value,
    target_value = NEW.target_value,
    difference = NEW.difference,
    difference_pct = NEW.difference_pct,
    table_name = NEW.table_name,
    column_name = NEW.column_name,
    check_query = NEW.check_query,
    check_message = NEW.check_message,
    check_metadata = NEW.check_metadata
WHERE id = OLD.id;

CREATE OR REPLACE RULE data_quality_checks_delete AS ON DELETE TO public.data_quality_checks 
DO INSTEAD DELETE FROM sqp.data_quality_checks WHERE id = OLD.id;

-- Add comments for documentation
COMMENT ON VIEW public.sync_log IS 'Public schema view for sqp.sync_log table to support Supabase client access';
COMMENT ON VIEW public.data_quality_checks IS 'Public schema view for sqp.data_quality_checks table to support Supabase client access';