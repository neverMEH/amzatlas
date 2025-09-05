-- Migration: 032_add_refresh_helper_functions_fixed.sql
-- Description: Add helper functions needed by edge functions for refresh operations
-- Created: 2025-09-05
-- Fixed: Handle existing functions by dropping them first

-- Drop existing functions if they exist with different signatures
DROP FUNCTION IF EXISTS get_table_columns(text, text);
DROP FUNCTION IF EXISTS get_table_row_count(text, text);
DROP FUNCTION IF EXISTS refresh_materialized_view(text);
DROP FUNCTION IF EXISTS execute_sql(text);
DROP FUNCTION IF EXISTS validate_refresh_completion(text, text, integer);

-- Function to refresh materialized views (used by refresh-summary-tables)
CREATE OR REPLACE FUNCTION refresh_materialized_view(view_name TEXT)
RETURNS void AS $$
BEGIN
  -- Validate the view exists and is a materialized view
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_matviews 
    WHERE schemaname || '.' || matviewname = view_name
  ) THEN
    RAISE EXCEPTION 'Materialized view % does not exist', view_name;
  END IF;
  
  -- Execute refresh
  EXECUTE 'REFRESH MATERIALIZED VIEW CONCURRENTLY ' || view_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION refresh_materialized_view TO service_role;

-- Function to execute SQL (used by summary table refreshes)
-- Note: This should be used carefully and only with trusted input
CREATE OR REPLACE FUNCTION execute_sql(sql TEXT)
RETURNS void AS $$
BEGIN
  -- Basic SQL injection protection
  IF sql ~* '(drop|truncate|delete|grant|revoke|alter)\s' THEN
    RAISE EXCEPTION 'Unsafe SQL operation detected';
  END IF;
  
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION execute_sql TO service_role;

-- Function to get table columns (used by generic refresh)
CREATE FUNCTION get_table_columns(schema_name TEXT, table_name TEXT)
RETURNS TABLE(column_name TEXT, data_type TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.column_name::TEXT,
    c.data_type::TEXT
  FROM information_schema.columns c
  WHERE c.table_schema = schema_name
    AND c.table_name = table_name
  ORDER BY c.ordinal_position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_table_columns TO service_role;

-- Function to get table row count (for monitoring)
CREATE FUNCTION get_table_row_count(schema_name TEXT, table_name TEXT)
RETURNS BIGINT AS $$
DECLARE
  row_count BIGINT;
BEGIN
  EXECUTE format('SELECT COUNT(*) FROM %I.%I', schema_name, table_name) INTO row_count;
  RETURN row_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_table_row_count TO service_role;

-- Function to validate refresh completion
CREATE FUNCTION validate_refresh_completion(
  p_table_schema TEXT,
  p_table_name TEXT,
  p_expected_min_rows INTEGER DEFAULT 1
)
RETURNS TABLE(
  is_valid BOOLEAN,
  row_count BIGINT,
  last_updated TIMESTAMP WITH TIME ZONE,
  message TEXT
) AS $$
DECLARE
  v_row_count BIGINT;
  v_last_updated TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get row count
  v_row_count := get_table_row_count(p_table_schema, p_table_name);
  
  -- Get last updated time (assuming updated_at column exists)
  BEGIN
    EXECUTE format(
      'SELECT MAX(updated_at) FROM %I.%I', 
      p_table_schema, 
      p_table_name
    ) INTO v_last_updated;
  EXCEPTION
    WHEN undefined_column THEN
      -- If no updated_at column, try created_at
      BEGIN
        EXECUTE format(
          'SELECT MAX(created_at) FROM %I.%I', 
          p_table_schema, 
          p_table_name
        ) INTO v_last_updated;
      EXCEPTION
        WHEN undefined_column THEN
          v_last_updated := NULL;
      END;
  END;
  
  -- Return validation result
  RETURN QUERY
  SELECT 
    v_row_count >= p_expected_min_rows AS is_valid,
    v_row_count,
    v_last_updated,
    CASE 
      WHEN v_row_count < p_expected_min_rows THEN 
        format('Table has %s rows, expected at least %s', v_row_count, p_expected_min_rows)
      WHEN v_last_updated IS NULL THEN
        'Could not determine last update time'
      WHEN v_last_updated < CURRENT_TIMESTAMP - INTERVAL '25 hours' THEN
        format('Table last updated %s, may be stale', v_last_updated)
      ELSE 
        'Validation passed'
    END AS message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION validate_refresh_completion TO service_role;

-- Add index on refresh_config for edge function queries
CREATE INDEX IF NOT EXISTS idx_refresh_config_enabled_next 
ON sqp.refresh_config(is_enabled, next_refresh_at) 
WHERE is_enabled = true;