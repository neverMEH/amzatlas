-- Script to find ALL objects that depend on ASIN columns
-- This will show you everything that needs to be dropped

-- 1. Find all direct dependencies on ASIN columns
SELECT DISTINCT
  'DROP ' || 
  CASE c.relkind 
    WHEN 'v' THEN 'VIEW'
    WHEN 'm' THEN 'MATERIALIZED VIEW'
  END || 
  ' IF EXISTS ' || n.nspname || '.' || c.relname || ' CASCADE;' as drop_command,
  n.nspname || '.' || c.relname as object_name,
  CASE c.relkind 
    WHEN 'v' THEN 'VIEW'
    WHEN 'm' THEN 'MATERIALIZED VIEW'
  END as object_type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE EXISTS (
  SELECT 1 
  FROM pg_attribute a 
  WHERE a.attrelid = c.oid 
    AND a.attname = 'asin'
    AND NOT a.attisdropped
)
AND c.relkind IN ('v', 'm')
ORDER BY 
  CASE c.relkind 
    WHEN 'm' THEN 1  -- Materialized views first
    WHEN 'v' THEN 2  -- Regular views second
  END,
  n.nspname,
  c.relname;

-- 2. Find all tables with ASIN columns that need to be altered
SELECT 
  'ALTER TABLE ' || table_schema || '.' || table_name || 
  ' ALTER COLUMN ' || column_name || ' TYPE VARCHAR(20);' as alter_command,
  table_schema || '.' || table_name as table_name,
  character_maximum_length as current_length
FROM information_schema.columns
WHERE column_name = 'asin'
  AND table_schema IN ('sqp', 'public')
  AND data_type = 'character varying'
  AND character_maximum_length < 20
ORDER BY table_schema, table_name;

-- 3. Show dependency tree to understand relationships
WITH RECURSIVE dep_tree AS (
  -- Start with base tables that have ASIN columns
  SELECT 
    n.nspname || '.' || c.relname as object_name,
    n.nspname as schema_name,
    c.relname as table_name,
    CASE c.relkind
      WHEN 'r' THEN 'TABLE'
      WHEN 'v' THEN 'VIEW'
      WHEN 'm' THEN 'MATERIALIZED VIEW'
    END as object_type,
    0 as level,
    n.nspname || '.' || c.relname as path
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid
  WHERE a.attname = 'asin'
    AND NOT a.attisdropped
    AND c.relkind = 'r'  -- Start with tables
    
  UNION ALL
  
  -- Find all objects that depend on these
  SELECT DISTINCT
    n2.nspname || '.' || c2.relname as object_name,
    n2.nspname as schema_name,
    c2.relname as table_name,
    CASE c2.relkind
      WHEN 'r' THEN 'TABLE'
      WHEN 'v' THEN 'VIEW'  
      WHEN 'm' THEN 'MATERIALIZED VIEW'
    END as object_type,
    dt.level + 1 as level,
    dt.path || ' -> ' || n2.nspname || '.' || c2.relname as path
  FROM dep_tree dt
  JOIN pg_depend d ON d.refobjid = (dt.schema_name || '.' || dt.table_name)::regclass::oid
  JOIN pg_class c2 ON c2.oid = d.objid
  JOIN pg_namespace n2 ON n2.oid = c2.relnamespace
  WHERE c2.relkind IN ('v', 'm')
    AND d.deptype = 'n'
)
SELECT 
  repeat('  ', level) || object_name as indented_name,
  object_type,
  level as dependency_level
FROM dep_tree
ORDER BY level, object_name;