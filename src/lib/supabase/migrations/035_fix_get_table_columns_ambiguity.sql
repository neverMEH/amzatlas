-- Fix ambiguous column reference in get_table_columns function

-- Drop the existing function
DROP FUNCTION IF EXISTS get_table_columns(text, text);

-- Recreate with parameter names that don't conflict with column names
CREATE FUNCTION get_table_columns(p_schema_name TEXT, p_table_name TEXT)
RETURNS TABLE(column_name TEXT, data_type TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.column_name::TEXT,
    c.data_type::TEXT
  FROM information_schema.columns c
  WHERE c.table_schema = p_schema_name
    AND c.table_name = p_table_name
  ORDER BY c.ordinal_position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_table_columns TO service_role;

-- Also ensure the other helper functions exist and are accessible
-- These are required by the edge functions

-- Ensure refresh_materialized_view exists
CREATE OR REPLACE FUNCTION refresh_materialized_view(view_name TEXT)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_matviews 
    WHERE schemaname || '.' || matviewname = view_name
  ) THEN
    RAISE EXCEPTION 'Materialized view % does not exist', view_name;
  END IF;
  
  EXECUTE 'REFRESH MATERIALIZED VIEW CONCURRENTLY ' || view_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION refresh_materialized_view TO service_role;

-- Ensure execute_sql exists  
CREATE OR REPLACE FUNCTION execute_sql(sql TEXT)
RETURNS void AS $$
BEGIN
  IF sql ~* '(drop|truncate|delete|grant|revoke|alter)\s' THEN
    RAISE EXCEPTION 'Unsafe SQL operation detected';
  END IF;
  
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION execute_sql TO service_role;