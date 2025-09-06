-- Script to find ALL objects that depend on ASIN columns
-- Fixed version with proper ORDER BY syntax

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
  END as object_type,
  c.relkind as sort_order
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
  sort_order,
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

-- 3. Simple list of all objects with ASIN columns
SELECT 
  table_schema,
  table_name,
  table_type
FROM information_schema.tables t
WHERE EXISTS (
  SELECT 1 
  FROM information_schema.columns c
  WHERE c.table_schema = t.table_schema
    AND c.table_name = t.table_name
    AND c.column_name = 'asin'
)
AND table_schema IN ('sqp', 'public')
ORDER BY 
  CASE table_type
    WHEN 'BASE TABLE' THEN 1
    WHEN 'VIEW' THEN 2
  END,
  table_schema,
  table_name;