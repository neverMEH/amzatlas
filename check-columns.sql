-- Check what columns actually exist in search_performance_summary
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'search_performance_summary'
ORDER BY ordinal_position;

-- Also check if it exists in sqp schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'sqp' 
AND table_name = 'search_performance_summary'
ORDER BY ordinal_position;

-- Try to get a sample row to see actual columns
SELECT * FROM public.search_performance_summary LIMIT 1;