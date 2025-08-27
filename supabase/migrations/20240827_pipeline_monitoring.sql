-- Pipeline states table
CREATE TABLE IF NOT EXISTS pipeline_states (
  pipeline_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'locked', 'running', 'completed', 'failed', 'cancelled')),
  last_run_time TIMESTAMPTZ,
  last_success_time TIMESTAMPTZ,
  current_step TEXT,
  step_data JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for status queries
CREATE INDEX idx_pipeline_states_status ON pipeline_states(status);

-- Pipeline state transitions table
CREATE TABLE IF NOT EXISTS pipeline_transitions (
  id BIGSERIAL PRIMARY KEY,
  pipeline_id TEXT NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Indexes for transition queries
CREATE INDEX idx_pipeline_transitions_pipeline_id ON pipeline_transitions(pipeline_id);
CREATE INDEX idx_pipeline_transitions_timestamp ON pipeline_transitions(timestamp);

-- Pipeline metrics table
CREATE TABLE IF NOT EXISTS pipeline_metrics (
  id BIGSERIAL PRIMARY KEY,
  pipeline_id TEXT NOT NULL,
  run_id UUID UNIQUE NOT NULL,
  status TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration INTEGER, -- milliseconds
  steps JSONB DEFAULT '{}',
  total_records_processed INTEGER DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for metrics queries
CREATE INDEX idx_pipeline_metrics_pipeline_id ON pipeline_metrics(pipeline_id);
CREATE INDEX idx_pipeline_metrics_run_id ON pipeline_metrics(run_id);
CREATE INDEX idx_pipeline_metrics_status ON pipeline_metrics(status);
CREATE INDEX idx_pipeline_metrics_created_at ON pipeline_metrics(created_at);

-- Pipeline errors table
CREATE TABLE IF NOT EXISTS pipeline_errors (
  id BIGSERIAL PRIMARY KEY,
  pipeline_id TEXT NOT NULL,
  run_id UUID,
  step TEXT NOT NULL,
  error TEXT NOT NULL,
  stack TEXT,
  context JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for error queries
CREATE INDEX idx_pipeline_errors_pipeline_id ON pipeline_errors(pipeline_id);
CREATE INDEX idx_pipeline_errors_run_id ON pipeline_errors(run_id);
CREATE INDEX idx_pipeline_errors_timestamp ON pipeline_errors(timestamp);

-- Pipeline logs table
CREATE TABLE IF NOT EXISTS pipeline_logs (
  id BIGSERIAL PRIMARY KEY,
  pipeline_id TEXT NOT NULL,
  run_id UUID,
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warning', 'error')),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for log queries
CREATE INDEX idx_pipeline_logs_pipeline_id ON pipeline_logs(pipeline_id);
CREATE INDEX idx_pipeline_logs_run_id ON pipeline_logs(run_id);
CREATE INDEX idx_pipeline_logs_level ON pipeline_logs(level);
CREATE INDEX idx_pipeline_logs_timestamp ON pipeline_logs(timestamp);

-- Pipeline metadata table (for key-value pairs like data freshness)
CREATE TABLE IF NOT EXISTS pipeline_metadata (
  pipeline_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (pipeline_id, key)
);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_pipeline_states_updated_at BEFORE UPDATE ON pipeline_states
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pipeline_metadata_updated_at BEFORE UPDATE ON pipeline_metadata
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE pipeline_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_metadata ENABLE ROW LEVEL SECURITY;

-- Create policies for service role (full access)
CREATE POLICY "Service role has full access to pipeline_states" ON pipeline_states
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to pipeline_transitions" ON pipeline_transitions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to pipeline_metrics" ON pipeline_metrics
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to pipeline_errors" ON pipeline_errors
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to pipeline_logs" ON pipeline_logs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to pipeline_metadata" ON pipeline_metadata
  FOR ALL USING (auth.role() = 'service_role');

-- Create read-only policies for authenticated users
CREATE POLICY "Authenticated users can read pipeline_states" ON pipeline_states
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read pipeline_metrics" ON pipeline_metrics
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read pipeline_errors" ON pipeline_errors
  FOR SELECT USING (auth.role() = 'authenticated');

-- Comments
COMMENT ON TABLE pipeline_states IS 'Current state of each pipeline';
COMMENT ON TABLE pipeline_transitions IS 'Historical record of pipeline state changes';
COMMENT ON TABLE pipeline_metrics IS 'Performance metrics for each pipeline run';
COMMENT ON TABLE pipeline_errors IS 'Error records for pipeline failures';
COMMENT ON TABLE pipeline_logs IS 'Detailed logs for pipeline execution';
COMMENT ON TABLE pipeline_metadata IS 'Key-value metadata for pipelines';