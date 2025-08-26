-- This migration sets up admin functions needed for running other migrations
-- Run this first through Supabase dashboard or CLI

-- Create a function to execute raw SQL (only accessible with service role key)
CREATE OR REPLACE FUNCTION execute_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only allow execution with service role key
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Insufficient privileges. This function requires service_role access.';
  END IF;
  
  -- Execute the SQL
  EXECUTE sql;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION execute_sql(text) TO service_role;

-- Revoke from other roles
REVOKE EXECUTE ON FUNCTION execute_sql(text) FROM anon, authenticated;

-- Comment on the function
COMMENT ON FUNCTION execute_sql(text) IS 'Admin function to execute raw SQL. Requires service_role key.';