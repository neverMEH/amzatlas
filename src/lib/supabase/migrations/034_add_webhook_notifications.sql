-- Migration: 034_add_webhook_notifications.sql
-- Description: Add webhook notification system for refresh events
-- Created: 2025-09-05

-- Create webhook configurations table
CREATE TABLE IF NOT EXISTS sqp.webhook_configs (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT, -- For webhook signature verification
    events TEXT[] NOT NULL DEFAULT ARRAY['refresh.failed', 'refresh.completed'], -- Events to subscribe to
    is_enabled BOOLEAN DEFAULT true,
    headers JSONB DEFAULT '{}', -- Custom headers to include
    retry_config JSONB DEFAULT '{"max_attempts": 3, "backoff_seconds": [5, 30, 300]}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create webhook delivery log table
CREATE TABLE IF NOT EXISTS sqp.webhook_deliveries (
    id SERIAL PRIMARY KEY,
    webhook_config_id INTEGER REFERENCES sqp.webhook_configs(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL,
    status TEXT CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
    attempt_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    request_headers JSONB,
    request_body JSONB,
    response_status INTEGER,
    response_headers JSONB,
    response_body TEXT,
    error_message TEXT,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_webhook_configs_enabled 
ON sqp.webhook_configs(is_enabled) 
WHERE is_enabled = true;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status_retry 
ON sqp.webhook_deliveries(status, next_retry_at) 
WHERE status IN ('pending', 'retrying');

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_config 
ON sqp.webhook_deliveries(webhook_config_id, created_at DESC);

-- Create public views for edge functions
CREATE OR REPLACE VIEW public.webhook_configs AS
SELECT * FROM sqp.webhook_configs;

CREATE OR REPLACE VIEW public.webhook_deliveries AS
SELECT * FROM sqp.webhook_deliveries;

-- Grant permissions
GRANT ALL ON public.webhook_configs TO service_role;
GRANT ALL ON public.webhook_deliveries TO service_role;
GRANT SELECT ON public.webhook_configs TO authenticated;
GRANT SELECT ON public.webhook_deliveries TO authenticated;

-- Function to queue webhook delivery
CREATE OR REPLACE FUNCTION sqp.queue_webhook_delivery(
    p_event_type TEXT,
    p_event_data JSONB
) RETURNS void AS $$
DECLARE
    v_config RECORD;
    v_delivery_id INTEGER;
BEGIN
    -- Find all enabled webhooks that subscribe to this event
    FOR v_config IN 
        SELECT * FROM sqp.webhook_configs 
        WHERE is_enabled = true 
        AND p_event_type = ANY(events)
    LOOP
        -- Create delivery record
        INSERT INTO sqp.webhook_deliveries (
            webhook_config_id,
            event_type,
            event_data,
            status,
            attempt_count
        ) VALUES (
            v_config.id,
            p_event_type,
            p_event_data,
            'pending',
            0
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger to send webhook on refresh completion
CREATE OR REPLACE FUNCTION sqp.trigger_refresh_webhook() RETURNS trigger AS $$
BEGIN
    -- Only trigger on status changes to final states
    IF (TG_OP = 'UPDATE' AND 
        OLD.status IN ('running', 'in_progress') AND 
        NEW.status IN ('success', 'failed', 'warning')) THEN
        
        -- Determine event type
        DECLARE
            v_event_type TEXT;
            v_event_data JSONB;
        BEGIN
            IF NEW.status = 'success' THEN
                v_event_type := 'refresh.completed';
            ELSIF NEW.status = 'failed' THEN
                v_event_type := 'refresh.failed';
            ELSE
                v_event_type := 'refresh.warning';
            END IF;
            
            -- Build event data
            v_event_data := jsonb_build_object(
                'audit_log_id', NEW.id,
                'table_schema', NEW.table_schema,
                'table_name', NEW.table_name,
                'status', NEW.status,
                'refresh_type', NEW.refresh_type,
                'started_at', NEW.refresh_started_at,
                'completed_at', NEW.refresh_completed_at,
                'duration_ms', NEW.execution_time_ms,
                'rows_processed', NEW.rows_processed,
                'error_message', NEW.error_message,
                'function_name', NEW.function_name
            );
            
            -- Queue webhook delivery
            PERFORM sqp.queue_webhook_delivery(v_event_type, v_event_data);
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on refresh_audit_log
CREATE TRIGGER refresh_audit_webhook_trigger
AFTER UPDATE ON sqp.refresh_audit_log
FOR EACH ROW
EXECUTE FUNCTION sqp.trigger_refresh_webhook();

-- Add some default webhook configurations (commented out, uncomment to use)
-- INSERT INTO sqp.webhook_configs (name, url, events, headers) VALUES
-- ('Slack Notifications', 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL', 
--  ARRAY['refresh.failed'], 
--  '{"Content-Type": "application/json"}'::jsonb),
-- ('Email Service', 'https://api.sendgrid.com/v3/mail/send',
--  ARRAY['refresh.failed', 'refresh.completed'],
--  '{"Authorization": "Bearer YOUR_API_KEY", "Content-Type": "application/json"}'::jsonb);