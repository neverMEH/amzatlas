-- Migration: Fix Sync Infrastructure Tables
-- This handles existing tables and adds missing columns/configurations

-- Step 1: Check and update refresh_config table structure
DO $$
BEGIN
    -- Add missing columns if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'sqp' 
        AND table_name = 'refresh_config' 
        AND column_name = 'refresh_interval_hours'
    ) THEN
        ALTER TABLE sqp.refresh_config ADD COLUMN refresh_interval_hours INTEGER DEFAULT 24;
        RAISE NOTICE 'Added refresh_interval_hours column';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'sqp' 
        AND table_name = 'refresh_config' 
        AND column_name = 'is_enabled'
    ) THEN
        ALTER TABLE sqp.refresh_config ADD COLUMN is_enabled BOOLEAN DEFAULT true;
        RAISE NOTICE 'Added is_enabled column';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'sqp' 
        AND table_name = 'refresh_config' 
        AND column_name = 'last_refresh_at'
    ) THEN
        ALTER TABLE sqp.refresh_config ADD COLUMN last_refresh_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added last_refresh_at column';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'sqp' 
        AND table_name = 'refresh_config' 
        AND column_name = 'next_refresh_at'
    ) THEN
        ALTER TABLE sqp.refresh_config ADD COLUMN next_refresh_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added next_refresh_at column';
    END IF;
END $$;

-- Step 2: Create refresh_audit_log table if it doesn't exist
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

-- Step 3: Create indexes if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_refresh_config_enabled') THEN
        CREATE INDEX idx_refresh_config_enabled ON sqp.refresh_config(is_enabled, next_refresh_at);
        RAISE NOTICE 'Created idx_refresh_config_enabled index';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_refresh_audit_log_table') THEN
        CREATE INDEX idx_refresh_audit_log_table ON sqp.refresh_audit_log(table_schema, table_name, refresh_started_at DESC);
        RAISE NOTICE 'Created idx_refresh_audit_log_table index';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_refresh_audit_log_status') THEN
        CREATE INDEX idx_refresh_audit_log_status ON sqp.refresh_audit_log(status, refresh_started_at DESC);
        RAISE NOTICE 'Created idx_refresh_audit_log_status index';
    END IF;
END $$;

-- Step 4: Insert or update configurations
DO $$
DECLARE
    config_tables TEXT[] := ARRAY['asin_performance_data', 'search_query_performance', 'daily_sqp_data'];
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY config_tables
    LOOP
        INSERT INTO sqp.refresh_config (table_schema, table_name, refresh_interval_hours, is_enabled)
        VALUES ('sqp', tbl, 24, true)
        ON CONFLICT (table_schema, table_name) 
        DO UPDATE SET 
            refresh_interval_hours = COALESCE(EXCLUDED.refresh_interval_hours, sqp.refresh_config.refresh_interval_hours, 24),
            is_enabled = COALESCE(EXCLUDED.is_enabled, sqp.refresh_config.is_enabled, true),
            updated_at = CURRENT_TIMESTAMP;
    END LOOP;
    RAISE NOTICE 'Updated refresh configurations';
END $$;

-- Step 5: Create or replace public views
CREATE OR REPLACE VIEW public.refresh_config AS
SELECT * FROM sqp.refresh_config;

CREATE OR REPLACE VIEW public.refresh_audit_log AS
SELECT * FROM sqp.refresh_audit_log;

-- Step 6: Grant permissions
DO $$
BEGIN
    -- Grant permissions on tables
    GRANT SELECT ON public.refresh_config TO authenticated, anon;
    GRANT ALL ON public.refresh_config TO service_role;
    GRANT SELECT ON public.refresh_audit_log TO authenticated, anon;
    GRANT ALL ON public.refresh_audit_log TO service_role;

    -- Grant permissions on sqp tables
    GRANT ALL ON sqp.refresh_config TO service_role;
    GRANT ALL ON sqp.refresh_audit_log TO service_role;
    
    -- Grant sequence permissions if they exist
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'refresh_config_id_seq' AND relkind = 'S') THEN
        GRANT USAGE ON SEQUENCE sqp.refresh_config_id_seq TO service_role;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'refresh_audit_log_id_seq' AND relkind = 'S') THEN
        GRANT USAGE ON SEQUENCE sqp.refresh_audit_log_id_seq TO service_role;
    END IF;

    RAISE NOTICE 'Granted permissions';
END $$;

-- Step 7: Show current configuration status
DO $$
DECLARE
    config_count INTEGER;
    audit_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO config_count FROM sqp.refresh_config;
    SELECT COUNT(*) INTO audit_count FROM sqp.refresh_audit_log;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== Sync Infrastructure Status ===';
    RAISE NOTICE 'Configurations in refresh_config: %', config_count;
    RAISE NOTICE 'Audit log entries: %', audit_count;
    RAISE NOTICE '';
    
    -- Show current configurations
    RAISE NOTICE 'Current configurations:';
    FOR config_rec IN 
        SELECT table_schema, table_name, refresh_interval_hours, is_enabled, last_refresh_at
        FROM sqp.refresh_config 
        ORDER BY table_schema, table_name
    LOOP
        RAISE NOTICE '  %.%: % hours, enabled: %, last: %', 
            config_rec.table_schema, 
            config_rec.table_name, 
            config_rec.refresh_interval_hours,
            config_rec.is_enabled,
            COALESCE(config_rec.last_refresh_at::TEXT, 'never');
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ Sync infrastructure is ready!';
END $$;