-- Migration: Add sync tracking tables and functions
-- Purpose: Support BigQuery to Supabase data synchronization

-- Create sync_log table
CREATE TABLE IF NOT EXISTS sqp.sync_log (
  id BIGSERIAL PRIMARY KEY,
  sync_type VARCHAR(50) NOT NULL, -- 'weekly', 'monthly', 'quarterly'
  sync_status VARCHAR(20) NOT NULL, -- 'started', 'completed', 'failed'
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Sync details
  source_table VARCHAR(255) NOT NULL,
  target_table VARCHAR(255) NOT NULL,
  period_start DATE,
  period_end DATE,
  
  -- Metrics
  records_processed INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  
  -- Error tracking
  error_message TEXT,
  error_details JSONB,
  
  -- Metadata
  sync_metadata JSONB, -- Additional sync parameters
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for sync_log
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON sqp.sync_log(sync_status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_log_type ON sqp.sync_log(sync_type, started_at DESC);

-- Create data_quality_checks table
CREATE TABLE IF NOT EXISTS sqp.data_quality_checks (
  id BIGSERIAL PRIMARY KEY,
  sync_log_id BIGINT REFERENCES sqp.sync_log(id),
  check_type VARCHAR(100) NOT NULL, -- 'row_count', 'sum_validation', 'null_check'
  check_status VARCHAR(20) NOT NULL, -- 'passed', 'failed', 'warning'
  
  -- Check details
  source_value NUMERIC,
  target_value NUMERIC,
  difference NUMERIC,
  difference_pct DECIMAL(10, 2),
  
  -- Context
  table_name VARCHAR(255),
  column_name VARCHAR(255),
  check_query TEXT,
  
  -- Results
  check_message TEXT,
  check_metadata JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for data_quality_checks
CREATE INDEX IF NOT EXISTS idx_quality_checks_sync ON sqp.data_quality_checks(sync_log_id);
CREATE INDEX IF NOT EXISTS idx_quality_checks_status ON sqp.data_quality_checks(check_status);

-- Add sync tracking columns to weekly_summary
ALTER TABLE sqp.weekly_summary 
ADD COLUMN IF NOT EXISTS bigquery_sync_id VARCHAR(255), -- BigQuery job ID or timestamp
ADD COLUMN IF NOT EXISTS sync_log_id BIGINT REFERENCES sqp.sync_log(id),
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

-- Create index for sync tracking
CREATE INDEX IF NOT EXISTS idx_weekly_summary_sync ON sqp.weekly_summary(last_synced_at, bigquery_sync_id);

-- Create sync status function
CREATE OR REPLACE FUNCTION sqp.get_latest_sync_status(
  p_sync_type VARCHAR DEFAULT 'weekly'
)
RETURNS TABLE (
  last_sync_time TIMESTAMP WITH TIME ZONE,
  last_sync_status VARCHAR(20),
  records_processed INTEGER,
  next_sync_due TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.completed_at as last_sync_time,
    s.sync_status as last_sync_status,
    s.records_processed,
    CASE 
      WHEN s.sync_status = 'completed' THEN s.completed_at + INTERVAL '1 day'
      ELSE CURRENT_TIMESTAMP
    END as next_sync_due
  FROM sqp.sync_log s
  WHERE s.sync_type = p_sync_type
  ORDER BY s.started_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Create data freshness check function
CREATE OR REPLACE FUNCTION sqp.check_data_freshness()
RETURNS TABLE (
  table_name TEXT,
  latest_period DATE,
  days_old INTEGER,
  is_stale BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'weekly_summary'::TEXT as table_name,
    MAX(period_end) as latest_period,
    EXTRACT(DAY FROM CURRENT_DATE - MAX(period_end))::INTEGER as days_old,
    MAX(period_end) < CURRENT_DATE - INTERVAL '14 days' as is_stale
  FROM sqp.weekly_summary
  
  UNION ALL
  
  SELECT 
    'monthly_summary'::TEXT,
    MAX(period_end),
    EXTRACT(DAY FROM CURRENT_DATE - MAX(period_end))::INTEGER,
    MAX(period_end) < CURRENT_DATE - INTERVAL '45 days'
  FROM sqp.monthly_summary;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function for auto-updating monthly summaries
CREATE OR REPLACE FUNCTION sqp.update_aggregate_summaries()
RETURNS TRIGGER AS $$
BEGIN
  -- Update monthly summary
  INSERT INTO sqp.monthly_summary (
    period_start, period_end, year, month, query, asin,
    total_impressions, total_clicks, total_purchases,
    avg_ctr, avg_cvr, impression_share, click_share, purchase_share,
    active_weeks
  )
  SELECT 
    DATE_TRUNC('month', NEW.period_start) as period_start,
    DATE_TRUNC('month', NEW.period_start) + INTERVAL '1 month - 1 day' as period_end,
    EXTRACT(YEAR FROM NEW.period_start)::INTEGER as year,
    EXTRACT(MONTH FROM NEW.period_start)::INTEGER as month,
    NEW.query,
    NEW.asin,
    NEW.total_impressions,
    NEW.total_clicks,
    NEW.total_purchases,
    NEW.avg_ctr,
    NEW.avg_cvr,
    NEW.impression_share,
    NEW.click_share,
    NEW.purchase_share,
    1 as active_weeks
  ON CONFLICT (year, month, query, asin) DO UPDATE SET
    total_impressions = monthly_summary.total_impressions + EXCLUDED.total_impressions,
    total_clicks = monthly_summary.total_clicks + EXCLUDED.total_clicks,
    total_purchases = monthly_summary.total_purchases + EXCLUDED.total_purchases,
    avg_ctr = CASE 
      WHEN (monthly_summary.total_impressions + EXCLUDED.total_impressions) > 0 
      THEN (monthly_summary.total_clicks + EXCLUDED.total_clicks)::DECIMAL / (monthly_summary.total_impressions + EXCLUDED.total_impressions)
      ELSE 0 
    END,
    avg_cvr = CASE 
      WHEN (monthly_summary.total_clicks + EXCLUDED.total_clicks) > 0 
      THEN (monthly_summary.total_purchases + EXCLUDED.total_purchases)::DECIMAL / (monthly_summary.total_clicks + EXCLUDED.total_clicks)
      ELSE 0 
    END,
    active_weeks = monthly_summary.active_weeks + 1,
    updated_at = CURRENT_TIMESTAMP;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating aggregates
CREATE TRIGGER update_summaries_on_weekly_insert
  AFTER INSERT OR UPDATE ON sqp.weekly_summary
  FOR EACH ROW
  EXECUTE FUNCTION sqp.update_aggregate_summaries();

-- Grant permissions (adjust based on your roles)
GRANT SELECT, INSERT, UPDATE ON sqp.sync_log TO authenticated;
GRANT SELECT, INSERT, UPDATE ON sqp.data_quality_checks TO authenticated;
GRANT EXECUTE ON FUNCTION sqp.get_latest_sync_status(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION sqp.check_data_freshness() TO authenticated;

-- Comment on tables
COMMENT ON TABLE sqp.sync_log IS 'Tracks all BigQuery to Supabase synchronization operations';
COMMENT ON TABLE sqp.data_quality_checks IS 'Records data quality validation results for each sync';
COMMENT ON COLUMN sqp.weekly_summary.bigquery_sync_id IS 'BigQuery job ID or timestamp for tracking sync source';
COMMENT ON COLUMN sqp.weekly_summary.sync_log_id IS 'Reference to sync_log entry that created/updated this record';
COMMENT ON COLUMN sqp.weekly_summary.last_synced_at IS 'Timestamp of last successful sync for this record';