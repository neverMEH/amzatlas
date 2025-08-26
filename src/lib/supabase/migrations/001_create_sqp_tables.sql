-- Create schema for SQP data
CREATE SCHEMA IF NOT EXISTS sqp;

-- Set search path to include both schemas
SET search_path TO sqp, public;

-- Weekly summary table (base aggregation since data comes in weekly)
CREATE TABLE sqp.weekly_summary (
  id BIGSERIAL PRIMARY KEY,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  query TEXT NOT NULL,
  asin VARCHAR(10) NOT NULL,
  
  -- Metrics
  total_impressions INTEGER NOT NULL DEFAULT 0,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  total_purchases INTEGER NOT NULL DEFAULT 0,
  avg_ctr DECIMAL(10, 6) DEFAULT 0,
  avg_cvr DECIMAL(10, 6) DEFAULT 0,
  purchases_per_impression DECIMAL(10, 6) DEFAULT 0,
  
  -- Share metrics (within the week across all ASINs for the query)
  impression_share DECIMAL(10, 6) DEFAULT 0,
  click_share DECIMAL(10, 6) DEFAULT 0,
  purchase_share DECIMAL(10, 6) DEFAULT 0,
  
  -- Statistical metrics
  min_impressions INTEGER,
  max_impressions INTEGER,
  avg_impressions DECIMAL(10, 2),
  stddev_impressions DECIMAL(10, 2),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique constraint to prevent duplicates
  UNIQUE(period_start, query, asin)
);

-- Monthly summary table
CREATE TABLE sqp.monthly_summary (
  id BIGSERIAL PRIMARY KEY,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  query TEXT NOT NULL,
  asin VARCHAR(10) NOT NULL,
  
  -- Metrics
  total_impressions INTEGER NOT NULL DEFAULT 0,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  total_purchases INTEGER NOT NULL DEFAULT 0,
  avg_ctr DECIMAL(10, 6) DEFAULT 0,
  avg_cvr DECIMAL(10, 6) DEFAULT 0,
  purchases_per_impression DECIMAL(10, 6) DEFAULT 0,
  
  -- Share metrics
  impression_share DECIMAL(10, 6) DEFAULT 0,
  click_share DECIMAL(10, 6) DEFAULT 0,
  purchase_share DECIMAL(10, 6) DEFAULT 0,
  
  -- Week counts
  active_weeks INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(year, month, query, asin)
);

-- Quarterly summary table
CREATE TABLE sqp.quarterly_summary (
  id BIGSERIAL PRIMARY KEY,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  year INTEGER NOT NULL,
  quarter INTEGER NOT NULL,
  query TEXT NOT NULL,
  asin VARCHAR(10) NOT NULL,
  
  -- Metrics
  total_impressions INTEGER NOT NULL DEFAULT 0,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  total_purchases INTEGER NOT NULL DEFAULT 0,
  avg_ctr DECIMAL(10, 6) DEFAULT 0,
  avg_cvr DECIMAL(10, 6) DEFAULT 0,
  purchases_per_impression DECIMAL(10, 6) DEFAULT 0,
  
  -- Share metrics
  impression_share DECIMAL(10, 6) DEFAULT 0,
  click_share DECIMAL(10, 6) DEFAULT 0,
  purchase_share DECIMAL(10, 6) DEFAULT 0,
  
  -- Period counts
  active_weeks INTEGER NOT NULL DEFAULT 0,
  active_months INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(year, quarter, query, asin)
);

-- Yearly summary table
CREATE TABLE sqp.yearly_summary (
  id BIGSERIAL PRIMARY KEY,
  year INTEGER NOT NULL,
  query TEXT NOT NULL,
  asin VARCHAR(10) NOT NULL,
  
  -- Metrics
  total_impressions INTEGER NOT NULL DEFAULT 0,
  total_clicks INTEGER NOT NULL DEFAULT 0,
  total_purchases INTEGER NOT NULL DEFAULT 0,
  avg_ctr DECIMAL(10, 6) DEFAULT 0,
  avg_cvr DECIMAL(10, 6) DEFAULT 0,
  purchases_per_impression DECIMAL(10, 6) DEFAULT 0,
  
  -- Share metrics
  impression_share DECIMAL(10, 6) DEFAULT 0,
  click_share DECIMAL(10, 6) DEFAULT 0,
  purchase_share DECIMAL(10, 6) DEFAULT 0,
  
  -- Period counts
  active_weeks INTEGER NOT NULL DEFAULT 0,
  active_months INTEGER NOT NULL DEFAULT 0,
  active_quarters INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(year, query, asin)
);

-- Period-over-period comparison table
CREATE TABLE sqp.period_comparisons (
  id BIGSERIAL PRIMARY KEY,
  period_type VARCHAR(20) NOT NULL, -- 'weekly', 'monthly', 'quarterly', 'yearly'
  current_period_start DATE NOT NULL,
  current_period_end DATE NOT NULL,
  previous_period_start DATE NOT NULL,
  previous_period_end DATE NOT NULL,
  query TEXT NOT NULL,
  asin VARCHAR(10) NOT NULL,
  
  -- Current period metrics
  current_impressions INTEGER NOT NULL DEFAULT 0,
  current_clicks INTEGER NOT NULL DEFAULT 0,
  current_purchases INTEGER NOT NULL DEFAULT 0,
  current_ctr DECIMAL(10, 6) DEFAULT 0,
  current_cvr DECIMAL(10, 6) DEFAULT 0,
  
  -- Previous period metrics
  previous_impressions INTEGER NOT NULL DEFAULT 0,
  previous_clicks INTEGER NOT NULL DEFAULT 0,
  previous_purchases INTEGER NOT NULL DEFAULT 0,
  previous_ctr DECIMAL(10, 6) DEFAULT 0,
  previous_cvr DECIMAL(10, 6) DEFAULT 0,
  
  -- Changes (absolute)
  impressions_change INTEGER,
  clicks_change INTEGER,
  purchases_change INTEGER,
  ctr_change DECIMAL(10, 6),
  cvr_change DECIMAL(10, 6),
  
  -- Changes (percentage)
  impressions_change_pct DECIMAL(10, 2),
  clicks_change_pct DECIMAL(10, 2),
  purchases_change_pct DECIMAL(10, 2),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(period_type, current_period_start, query, asin)
);

-- Create indexes for better query performance
CREATE INDEX idx_weekly_summary_query ON sqp.weekly_summary(query);
CREATE INDEX idx_weekly_summary_asin ON sqp.weekly_summary(asin);
CREATE INDEX idx_weekly_summary_period ON sqp.weekly_summary(period_start, period_end);
CREATE INDEX idx_weekly_summary_query_asin ON sqp.weekly_summary(query, asin);

CREATE INDEX idx_monthly_summary_query ON sqp.monthly_summary(query);
CREATE INDEX idx_monthly_summary_asin ON sqp.monthly_summary(asin);
CREATE INDEX idx_monthly_summary_year_month ON sqp.monthly_summary(year, month);

CREATE INDEX idx_quarterly_summary_query ON sqp.quarterly_summary(query);
CREATE INDEX idx_quarterly_summary_asin ON sqp.quarterly_summary(asin);
CREATE INDEX idx_quarterly_summary_year_quarter ON sqp.quarterly_summary(year, quarter);

CREATE INDEX idx_yearly_summary_query ON sqp.yearly_summary(query);
CREATE INDEX idx_yearly_summary_asin ON sqp.yearly_summary(asin);
CREATE INDEX idx_yearly_summary_year ON sqp.yearly_summary(year);

CREATE INDEX idx_period_comparisons_query_asin ON sqp.period_comparisons(query, asin);
CREATE INDEX idx_period_comparisons_period_type ON sqp.period_comparisons(period_type);

-- Create update timestamp trigger function
CREATE OR REPLACE FUNCTION sqp.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update timestamp trigger to all tables
CREATE TRIGGER update_weekly_summary_timestamp
  BEFORE UPDATE ON sqp.weekly_summary
  FOR EACH ROW
  EXECUTE FUNCTION sqp.update_timestamp();

CREATE TRIGGER update_monthly_summary_timestamp
  BEFORE UPDATE ON sqp.monthly_summary
  FOR EACH ROW
  EXECUTE FUNCTION sqp.update_timestamp();

CREATE TRIGGER update_quarterly_summary_timestamp
  BEFORE UPDATE ON sqp.quarterly_summary
  FOR EACH ROW
  EXECUTE FUNCTION sqp.update_timestamp();

CREATE TRIGGER update_yearly_summary_timestamp
  BEFORE UPDATE ON sqp.yearly_summary
  FOR EACH ROW
  EXECUTE FUNCTION sqp.update_timestamp();

-- Row Level Security (RLS) policies can be added here based on your requirements
-- Example:
-- ALTER TABLE sqp.weekly_summary ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can view their own data" ON sqp.weekly_summary
--   FOR SELECT USING (auth.uid() = user_id);