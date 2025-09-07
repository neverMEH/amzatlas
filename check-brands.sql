-- Check available brands
SELECT id, display_name, asin_count
FROM sqp.brands
ORDER BY asin_count DESC
LIMIT 10;