#!/usr/bin/env node
import { config } from 'dotenv';
import { PipelineOrchestrator } from '../lib/bigquery/pipeline-orchestrator';
import { PipelineConfig } from '../lib/bigquery/types/pipeline';

// Load environment variables
config();

const pipelineConfig: PipelineConfig = {
  name: 'sqp-data-pipeline',
  schedule: process.env.PIPELINE_SCHEDULE || '0 */6 * * *', // Default: every 6 hours
  maxRetries: parseInt(process.env.PIPELINE_MAX_RETRIES || '3'),
  retryDelayMs: parseInt(process.env.PIPELINE_RETRY_DELAY_MS || '5000'),
  steps: [
    {
      name: 'extract',
      type: 'extract',
      config: {
        startDate: process.env.PIPELINE_START_DATE,
        endDate: process.env.PIPELINE_END_DATE,
        batchSize: parseInt(process.env.PIPELINE_BATCH_SIZE || '5000'),
        incremental: process.env.PIPELINE_INCREMENTAL === 'true'
      },
      timeout: 600000 // 10 minutes
    },
    {
      name: 'transform',
      type: 'transform',
      config: {
        aggregationLevel: process.env.PIPELINE_AGGREGATION_LEVEL || 'daily',
        calculateTrends: true,
        calculateMarketShare: true
      },
      dependencies: ['extract'],
      timeout: 300000 // 5 minutes
    },
    {
      name: 'load',
      type: 'load',
      config: {
        targetTables: {
          daily: 'sqp_daily_summary',
          weekly: 'sqp_weekly_trends',
          monthly: 'sqp_monthly_summary',
          quarterly: 'sqp_quarterly_summary',
          yearly: 'sqp_yearly_summary'
        },
        createMaterializedViews: true
      },
      dependencies: ['transform'],
      timeout: 300000 // 5 minutes
    }
  ],
  monitoring: {
    enableAlerts: process.env.PIPELINE_ENABLE_ALERTS === 'true',
    alertThresholds: {
      errorRate: parseFloat(process.env.PIPELINE_ERROR_THRESHOLD || '0.05'),
      executionTime: parseInt(process.env.PIPELINE_EXECUTION_TIME_THRESHOLD || '3600000'),
      dataFreshness: parseInt(process.env.PIPELINE_DATA_FRESHNESS_THRESHOLD || '86400000')
    }
  }
};

async function runPipeline() {
  console.log(`[${new Date().toISOString()}] Starting SQP data pipeline...`);
  
  const orchestrator = new PipelineOrchestrator(pipelineConfig);
  
  try {
    // Check if we should resume from a previous failure
    const resumeFromFailure = process.env.PIPELINE_RESUME_ON_FAILURE === 'true';
    
    // Execute the pipeline
    const result = await orchestrator.execute({ resumeFromFailure });
    
    if (result.success) {
      console.log(`[${new Date().toISOString()}] Pipeline completed successfully!`);
      console.log(`Run ID: ${result.runId}`);
      console.log(`Duration: ${result.duration}ms`);
      console.log(`Steps completed: ${result.stepsCompleted}/${result.totalSteps}`);
      
      if (result.warnings && result.warnings.length > 0) {
        console.warn('Warnings:', result.warnings);
      }
      
      if (result.alerts && result.alerts.length > 0) {
        console.warn('Alerts triggered:', result.alerts);
      }
      
      process.exit(0);
    } else {
      console.error(`[${new Date().toISOString()}] Pipeline failed!`);
      console.error(`Error: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Unexpected error:`, error);
    process.exit(1);
  } finally {
    // Ensure cleanup
    orchestrator.shutdown();
  }
}

// Handle process signals for graceful shutdown
process.on('SIGINT', () => {
  console.log('\\nReceived SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\\nReceived SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the pipeline
runPipeline();