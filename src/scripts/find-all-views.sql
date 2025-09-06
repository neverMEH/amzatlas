-- Find ALL views and materialized views in sqp and public schemas
-- This will show us everything that needs to be dropped

-- 1. Find all materialized views
SELECT 
  'DROP MATERIALIZED VIEW IF EXISTS ' || schemaname || '.' || matviewname || ' CASCADE;' as drop_command,
  schemaname,
  matviewname as name,
  'MATERIALIZED VIEW' as type
FROM pg_matviews
WHERE schemaname IN ('sqp', 'public')
ORDER BY schemaname, matviewname;

-- 2. Find all regular views  
SELECT 
  'DROP VIEW IF EXISTS ' || schemaname || '.' || viewname || ' CASCADE;' as drop_command,
  schemaname,
  viewname as name,
  'VIEW' as type
FROM pg_views
WHERE schemaname IN ('sqp', 'public')
ORDER BY schemaname, viewname;

-- 3. Combined list ordered by dependency
SELECT 
  schemaname || '.' || matviewname as full_name,
  'MATERIALIZED VIEW' as type,
  'DROP MATERIALIZED VIEW IF EXISTS ' || schemaname || '.' || matviewname || ' CASCADE;' as drop_command
FROM pg_matviews
WHERE schemaname IN ('sqp', 'public')
UNION ALL
SELECT 
  schemaname || '.' || viewname as full_name,
  'VIEW' as type,
  'DROP VIEW IF EXISTS ' || schemaname || '.' || viewname || ' CASCADE;' as drop_command
FROM pg_views
WHERE schemaname IN ('sqp', 'public')
ORDER BY 
  CASE type 
    WHEN 'MATERIALIZED VIEW' THEN 1
    WHEN 'VIEW' THEN 2
  END,
  full_name;