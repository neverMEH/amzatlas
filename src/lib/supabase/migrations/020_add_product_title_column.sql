-- Migration: Add product_title column to asin_performance_data
-- Description: Adds product_title column if it doesn't exist for brand extraction

-- Check if column exists and add it if not
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'sqp' 
    AND table_name = 'asin_performance_data' 
    AND column_name = 'product_title'
  ) THEN
    ALTER TABLE sqp.asin_performance_data 
    ADD COLUMN product_title TEXT;
    
    COMMENT ON COLUMN sqp.asin_performance_data.product_title IS 'Product title from Amazon, used for brand extraction';
  END IF;
END $$;

-- Create index on product_title for faster searches
CREATE INDEX IF NOT EXISTS idx_asin_performance_data_product_title 
ON sqp.asin_performance_data (product_title) 
WHERE product_title IS NOT NULL;

-- Grant permissions
GRANT UPDATE (product_title) ON sqp.asin_performance_data TO service_role;