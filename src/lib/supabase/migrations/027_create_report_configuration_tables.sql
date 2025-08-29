-- Migration: Create Report Configuration Tables
-- This migration creates tables for managing automated reports and their schedules

-- Report configurations table
CREATE TABLE IF NOT EXISTS sqp.report_configurations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  report_type VARCHAR(50) NOT NULL CHECK (report_type IN (
    'period_comparison',
    'keyword_trends',
    'market_share_analysis',
    'anomaly_detection',
    'comprehensive_dashboard',
    'custom'
  )),
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN (
    'daily',
    'weekly',
    'bi_weekly',
    'monthly',
    'quarterly',
    'on_demand'
  )),
  
  -- Configuration
  config JSONB NOT NULL DEFAULT '{}', -- Stores report-specific settings
  filters JSONB NOT NULL DEFAULT '{}', -- Brand IDs, date ranges, etc.
  
  -- Scheduling
  schedule_day_of_week INTEGER CHECK (schedule_day_of_week BETWEEN 0 AND 6), -- 0 = Sunday
  schedule_time TIME, -- HH:MM:SS
  schedule_day_of_month INTEGER CHECK (schedule_day_of_month BETWEEN 1 AND 31),
  
  -- Export settings
  export_formats TEXT[] DEFAULT ARRAY['pdf'], -- pdf, csv, xlsx
  include_charts BOOLEAN DEFAULT true,
  include_raw_data BOOLEAN DEFAULT false,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  
  -- Metadata
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report recipients table
CREATE TABLE IF NOT EXISTS sqp.report_recipients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_configuration_id UUID NOT NULL REFERENCES sqp.report_configurations(id) ON DELETE CASCADE,
  
  -- Recipient details
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  
  -- Delivery preferences
  delivery_method VARCHAR(20) DEFAULT 'email' CHECK (delivery_method IN ('email', 'webhook', 'sftp')),
  webhook_url TEXT,
  sftp_credentials JSONB,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_delivered_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report execution history table
CREATE TABLE IF NOT EXISTS sqp.report_execution_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_configuration_id UUID NOT NULL REFERENCES sqp.report_configurations(id) ON DELETE CASCADE,
  
  -- Execution details
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'running' CHECK (status IN (
    'running',
    'completed',
    'failed',
    'cancelled'
  )),
  error_message TEXT,
  
  -- Generated files
  generated_files JSONB DEFAULT '[]', -- Array of {format, file_path, size_bytes}
  
  -- Metrics
  execution_time_ms INTEGER,
  rows_processed INTEGER,
  
  -- Delivery status
  delivery_status JSONB DEFAULT '{}', -- Per-recipient delivery status
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report templates table for custom reports
CREATE TABLE IF NOT EXISTS sqp.report_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Template configuration
  sections JSONB NOT NULL DEFAULT '[]', -- Array of report sections
  default_filters JSONB DEFAULT '{}',
  
  -- Layout settings
  layout_config JSONB DEFAULT '{}', -- Page size, margins, etc.
  style_config JSONB DEFAULT '{}', -- Colors, fonts, etc.
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_system_template BOOLEAN DEFAULT false,
  
  -- Metadata
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled report queue table
CREATE TABLE IF NOT EXISTS sqp.report_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_configuration_id UUID NOT NULL REFERENCES sqp.report_configurations(id) ON DELETE CASCADE,
  
  -- Queue management
  scheduled_for TIMESTAMPTZ NOT NULL,
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10), -- 1 = highest
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled'
  )),
  
  -- Processing
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  
  -- Results
  execution_history_id UUID REFERENCES sqp.report_execution_history(id),
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_report_configurations_active ON sqp.report_configurations(is_active) WHERE is_active = true;
CREATE INDEX idx_report_configurations_next_run ON sqp.report_configurations(next_run_at) WHERE is_active = true;
CREATE INDEX idx_report_recipients_configuration ON sqp.report_recipients(report_configuration_id);
CREATE INDEX idx_report_recipients_email ON sqp.report_recipients(email);
CREATE INDEX idx_report_execution_history_configuration ON sqp.report_execution_history(report_configuration_id);
CREATE INDEX idx_report_execution_history_status ON sqp.report_execution_history(status);
CREATE INDEX idx_report_queue_scheduled ON sqp.report_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_report_queue_status ON sqp.report_queue(status);

-- Create function to calculate next run time
CREATE OR REPLACE FUNCTION sqp.calculate_next_run_time(
  p_frequency VARCHAR,
  p_last_run TIMESTAMPTZ,
  p_schedule_time TIME,
  p_schedule_day_of_week INTEGER,
  p_schedule_day_of_month INTEGER
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_next_run TIMESTAMPTZ;
  v_base_time TIMESTAMPTZ;
BEGIN
  -- Use last run time or current time as base
  v_base_time := COALESCE(p_last_run, NOW());
  
  CASE p_frequency
    WHEN 'daily' THEN
      v_next_run := (v_base_time::DATE + INTERVAL '1 day' + p_schedule_time)::TIMESTAMPTZ;
      
    WHEN 'weekly' THEN
      -- Calculate next occurrence of the scheduled day
      v_next_run := v_base_time::DATE + 
        ((p_schedule_day_of_week - EXTRACT(DOW FROM v_base_time)::INTEGER + 7) % 7)::INTEGER * INTERVAL '1 day' +
        p_schedule_time;
      -- If it's in the past, add a week
      IF v_next_run <= v_base_time THEN
        v_next_run := v_next_run + INTERVAL '7 days';
      END IF;
      
    WHEN 'bi_weekly' THEN
      -- Similar to weekly but add 14 days
      v_next_run := v_base_time::DATE + 
        ((p_schedule_day_of_week - EXTRACT(DOW FROM v_base_time)::INTEGER + 7) % 7)::INTEGER * INTERVAL '1 day' +
        p_schedule_time;
      IF v_next_run <= v_base_time THEN
        v_next_run := v_next_run + INTERVAL '14 days';
      END IF;
      
    WHEN 'monthly' THEN
      -- Calculate next occurrence of the scheduled day of month
      v_next_run := (DATE_TRUNC('month', v_base_time) + 
        INTERVAL '1 month' - INTERVAL '1 day' + 
        LEAST(p_schedule_day_of_month, EXTRACT(DAY FROM DATE_TRUNC('month', v_base_time) + INTERVAL '1 month' - INTERVAL '1 day')::INTEGER) * INTERVAL '1 day' +
        p_schedule_time)::TIMESTAMPTZ;
      
    WHEN 'quarterly' THEN
      -- First day of next quarter
      v_next_run := DATE_TRUNC('quarter', v_base_time) + INTERVAL '3 months' + p_schedule_time;
      
    ELSE
      -- On demand or unknown frequency
      v_next_run := NULL;
  END CASE;
  
  RETURN v_next_run;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update next_run_at
CREATE OR REPLACE FUNCTION sqp.update_report_next_run_time()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate next run time when report is created or updated
  NEW.next_run_at := sqp.calculate_next_run_time(
    NEW.frequency,
    NEW.last_run_at,
    NEW.schedule_time,
    NEW.schedule_day_of_week,
    NEW.schedule_day_of_month
  );
  
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_report_configurations_update_next_run
  BEFORE INSERT OR UPDATE ON sqp.report_configurations
  FOR EACH ROW
  EXECUTE FUNCTION sqp.update_report_next_run_time();

-- Create function to enqueue scheduled reports
CREATE OR REPLACE FUNCTION sqp.enqueue_scheduled_reports()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_report RECORD;
BEGIN
  -- Find all reports due to run
  FOR v_report IN
    SELECT id, next_run_at
    FROM sqp.report_configurations
    WHERE is_active = true
      AND next_run_at IS NOT NULL
      AND next_run_at <= NOW()
      AND NOT EXISTS (
        SELECT 1 FROM sqp.report_queue
        WHERE report_configuration_id = sqp.report_configurations.id
          AND status IN ('pending', 'processing')
      )
  LOOP
    -- Create queue entry
    INSERT INTO sqp.report_queue (
      report_configuration_id,
      scheduled_for,
      priority
    ) VALUES (
      v_report.id,
      v_report.next_run_at,
      5 -- Default priority
    );
    
    -- Update last_run_at to trigger next_run_at calculation
    UPDATE sqp.report_configurations
    SET last_run_at = NOW()
    WHERE id = v_report.id;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Create default report templates
INSERT INTO sqp.report_templates (name, description, is_system_template, sections) VALUES
  ('Weekly Performance Summary', 'Comprehensive weekly performance report', true, 
   '[{"type": "period_comparison", "title": "Week-over-Week Performance", "config": {"period": "week"}},
     {"type": "top_keywords", "title": "Top Performing Keywords", "config": {"limit": 20}},
     {"type": "keyword_trends", "title": "Keyword Trend Analysis", "config": {"window_size": 6}},
     {"type": "market_share", "title": "Market Share Overview", "config": {}}]'::JSONB),
     
  ('Monthly Dashboard Report', 'Monthly dashboard metrics and insights', true,
   '[{"type": "executive_summary", "title": "Executive Summary", "config": {}},
     {"type": "period_comparison", "title": "Monthly Performance", "config": {"period": "month"}},
     {"type": "anomaly_detection", "title": "Anomaly Detection", "config": {"threshold": 2}},
     {"type": "revenue_analysis", "title": "Revenue Analysis", "config": {}}]'::JSONB),
     
  ('Keyword Performance Deep Dive', 'Detailed keyword analysis report', true,
   '[{"type": "keyword_trends", "title": "Keyword Trends", "config": {"window_size": 6}},
     {"type": "zero_purchase_keywords", "title": "Zero Purchase Keywords", "config": {"limit": 50}},
     {"type": "rising_declining", "title": "Rising & Declining Keywords", "config": {"limit": 20}}]'::JSONB);

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA sqp TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA sqp TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA sqp TO service_role;