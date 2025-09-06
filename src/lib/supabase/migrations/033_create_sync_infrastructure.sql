-- Migration: Create Sync Infrastructure Tables
-- This creates the necessary tables for the BigQuery sync service to work

-- Step 1: Create refresh_config table
CREATE TABLE IF NOT EXISTS sqp.refresh_config (
    id SERIAL PRIMARY KEY,
    table_schema VARCHAR(50) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    refresh_interval_hours INTEGER DEFAULT 24,
    is_enabled BOOLEAN DEFAULT true,
    last_refresh_at TIMESTAMP WITH TIME ZONE,
    next_refresh_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(table_schema, table_name)
);

-- Create index for efficient lookups
CREATE INDEX idx_refresh_config_enabled ON sqp.refresh_config(is_enabled, next_refresh_at);

-- Step 2: Create refresh_audit_log table
CREATE TABLE IF NOT EXISTS sqp.refresh_audit_log (
    id SERIAL PRIMARY KEY,
    table_schema VARCHAR(50) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    refresh_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    refresh_completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('in_progress', 'success', 'failed')),
    rows_processed INTEGER DEFAULT 0,
    error_message TEXT,
    refresh_type VARCHAR(50) DEFAULT 'scheduled',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for audit log
CREATE INDEX idx_refresh_audit_log_table ON sqp.refresh_audit_log(table_schema, table_name, refresh_started_at DESC);
CREATE INDEX idx_refresh_audit_log_status ON sqp.refresh_audit_log(status, refresh_started_at DESC);

-- Step 3: Insert default configurations for our tables
INSERT INTO sqp.refresh_config (table_schema, table_name, refresh_interval_hours) VALUES
    ('sqp', 'asin_performance_data', 24),
    ('sqp', 'search_query_performance', 24),
    ('sqp', 'daily_sqp_data', 24)
ON CONFLICT (table_schema, table_name) DO NOTHING;

-- Step 4: Create public views for these tables (for Supabase client access)
CREATE OR REPLACE VIEW public.refresh_config AS
SELECT * FROM sqp.refresh_config;

CREATE OR REPLACE VIEW public.refresh_audit_log AS
SELECT * FROM sqp.refresh_audit_log;

-- Grant permissions
GRANT SELECT ON public.refresh_config TO authenticated;
GRANT SELECT ON public.refresh_config TO anon;
GRANT ALL ON public.refresh_config TO service_role;

GRANT SELECT ON public.refresh_audit_log TO authenticated;
GRANT SELECT ON public.refresh_audit_log TO anon;
GRANT ALL ON public.refresh_audit_log TO service_role;

-- Grant permissions on sqp tables too
GRANT ALL ON sqp.refresh_config TO service_role;
GRANT ALL ON sqp.refresh_audit_log TO service_role;
GRANT USAGE ON SEQUENCE sqp.refresh_config_id_seq TO service_role;
GRANT USAGE ON SEQUENCE sqp.refresh_audit_log_id_seq TO service_role;

-- Step 5: Create helper function to get table info
CREATE OR REPLACE FUNCTION sqp.get_table_columns(
    p_schema_name TEXT,
    p_table_name TEXT
) RETURNS TABLE (
    column_name TEXT,
    data_type TEXT,
    character_maximum_length INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.column_name::TEXT,
        c.data_type::TEXT,
        c.character_maximum_length::INTEGER
    FROM information_schema.columns c
    WHERE c.table_schema = p_schema_name
      AND c.table_name = p_table_name
    ORDER BY c.ordinal_position;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION sqp.get_table_columns(TEXT, TEXT) TO service_role;

-- Step 6: Verify setup
DO $$
DECLARE
    config_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO config_count FROM sqp.refresh_config;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== Sync Infrastructure Setup Complete ===';
    RAISE NOTICE 'Tables created:';
    RAISE NOTICE '  - sqp.refresh_config';
    RAISE NOTICE '  - sqp.refresh_audit_log';
    RAISE NOTICE 'Configurations added: %', config_count;
    RAISE NOTICE '';
    RAISE NOTICE '✅ Sync service infrastructure is ready!';
END $$;