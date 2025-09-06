-- Script to find ALL objects dependent on ASIN columns
-- Run this first to see what needs to be dropped

-- Find all views and materialized views that depend on tables with ASIN columns
WITH RECURSIVE dep_tree AS (
  -- Base: Find all tables with ASIN columns
  SELECT DISTINCT
    c.oid::regclass::text as object_name,
    c.relkind as object_type,
    n.nspname as schema_name,
    0 as level
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid
  WHERE a.attname = 'asin'
    AND c.relkind = 'r' -- regular tables
    AND n.nspname IN ('sqp', 'public')
    AND NOT a.attisdropped
  
  UNION ALL
  
  -- Recursive: Find all views that depend on these objects
  SELECT DISTINCT
    dv.objid::regclass::text as object_name,
    c2.relkind as object_type,
    n2.nspname as schema_name,
    dt.level + 1 as level
  FROM dep_tree dt
  JOIN pg_depend dv ON dv.refobjid = dt.object_name::regclass::oid
  JOIN pg_class c2 ON c2.oid = dv.objid
  JOIN pg_namespace n2 ON n2.oid = c2.relnamespace
  WHERE c2.relkind IN ('v', 'm') -- views and materialized views
    AND dv.deptype = 'n' -- normal dependency
)
SELECT DISTINCT
  object_name,
  schema_name,
  CASE object_type 
    WHEN 'r' THEN 'TABLE'
    WHEN 'v' THEN 'VIEW' 
    WHEN 'm' THEN 'MATERIALIZED VIEW'
  END as object_type,
  level as dependency_level
FROM dep_tree
WHERE object_type IN ('v', 'm')
ORDER BY level DESC, object_name;

-- Also check column-specific dependencies
SELECT DISTINCT
  'DROP ' || 
  CASE c.relkind 
    WHEN 'v' THEN 'VIEW'
    WHEN 'm' THEN 'MATERIALIZED VIEW'
  END || 
  ' IF EXISTS ' || n.nspname || '.' || c.relname || ' CASCADE;' as drop_command
FROM pg_depend d
JOIN pg_class c ON c.oid = d.objid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
WHERE a.attname = 'asin'
  AND c.relkind IN ('v', 'm')
  AND n.nspname IN ('sqp', 'public')
ORDER BY n.nspname, c.relname;