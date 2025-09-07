-- Create test table for BigQuery -> Supabase sync testing
-- This table will store search query performance data with ASIN filtering

CREATE TABLE IF NOT EXISTS sqp_test (
  id SERIAL PRIMARY KEY,
  search_query VARCHAR(255) NOT NULL,
  asin VARCHAR(20) NOT NULL,
  product_name TEXT,
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  purchases INTEGER DEFAULT 0,
  ctr DECIMAL(5,2) DEFAULT 0.00,
  cvr DECIMAL(5,2) DEFAULT 0.00,
  marketplace VARCHAR(50),
  category VARCHAR(255),
  sync_strategy VARCHAR(20),
  sync_timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for performance
CREATE INDEX idx_sqp_test_query ON sqp_test(search_query);
CREATE INDEX idx_sqp_test_asin ON sqp_test(asin);
CREATE INDEX idx_sqp_test_date ON sqp_test(date);
CREATE INDEX idx_sqp_test_strategy ON sqp_test(sync_strategy);
CREATE INDEX idx_sqp_test_sync_timestamp ON sqp_test(sync_timestamp);

-- Create composite index for common queries
CREATE INDEX idx_sqp_test_query_date ON sqp_test(search_query, date);
CREATE INDEX idx_sqp_test_asin_date ON sqp_test(asin, date);

-- Add comments for documentation
COMMENT ON TABLE sqp_test IS 'Test table for BigQuery to Supabase sync with ASIN filtering strategies';
COMMENT ON COLUMN sqp_test.sync_strategy IS 'ASIN filtering strategy used: top_1, top_5, top_10, or all';
COMMENT ON COLUMN sqp_test.ctr IS 'Click-through rate as percentage';
COMMENT ON COLUMN sqp_test.cvr IS 'Conversion rate as percentage';

-- Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_sqp_test_updated_at BEFORE UPDATE ON sqp_test
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (adjust as needed for your Supabase setup)
GRANT ALL ON sqp_test TO anon;
GRANT ALL ON sqp_test TO authenticated;
GRANT ALL ON sqp_test TO service_role;