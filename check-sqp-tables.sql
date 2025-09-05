-- Check which tables actually exist in the sqp schema
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'sqp'
ORDER BY table_name;