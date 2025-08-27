import { BigQueryClient } from './client';
import { DataExtractor } from './data-extractor';
import { DataTransformer } from './data-transformer';
import { BigQueryToSupabaseSync } from './bigquery-to-supabase-sync';
import { PipelineStateManager } from './state-manager';
import { PipelineMonitor } from './monitor';
import { 
  PipelineConfig, 
  PipelineResult, 
  PipelineStep,
  StepResult,
  Alert
} from './types/pipeline';
import { parseExpression } from 'cron-parser';

export interface ExecuteOptions {
  resumeFromFailure?: boolean;
  dryRun?: boolean;
  skipValidation?: boolean;
}

export class PipelineOrchestrator {
  private config: PipelineConfig;
  private client: BigQueryClient;
  private extractor: DataExtractor;
  private transformer: DataTransformer;
  private sync: BigQueryToSupabaseSync;
  private stateManager: PipelineStateManager;
  private monitor: PipelineMonitor;
  private shutdownRequested = false;
  private currentRunId: string | null = null;

  constructor(config: PipelineConfig) {
    this.config = config;
    this.client = new BigQueryClient();
    this.extractor = new DataExtractor(this.client);
    this.transformer = new DataTransformer();
    this.sync = new BigQueryToSupabaseSync();
    this.stateManager = new PipelineStateManager(config.name);
    this.monitor = new PipelineMonitor({
      pipelineId: config.name,
      enableCloudLogging: true,
      enableMetrics: true,
      enableAlerts: config.monitoring?.enableAlerts || false,
      alertThresholds: config.monitoring?.alertThresholds || {
        errorRate: 0.05,
        executionTime: 3600000,
        dataFreshness: 86400000
      },
      alertChannels: ['email', 'slack'],
      logLevel: 'info'
    });
  }

  async execute(options: ExecuteOptions = {}): Promise<PipelineResult> {
    const startTime = new Date();
    let runId = '';
    
    try {
      // Check if pipeline is already running
      const locked = await this.stateManager.lockPipeline();
      if (!locked) {
        return {
          success: false,
          runId: '',
          startTime,
          stepsCompleted: 0,
          totalSteps: this.config.steps.length,
          error: 'Pipeline is already running'
        };
      }

      // Start monitoring
      runId = await this.monitor.startPipeline();
      this.currentRunId = runId;

      // Check if we should resume from failure
      let startStep = 0;
      if (options.resumeFromFailure) {
        const recovery = await this.stateManager.getRecoveryPoint();
        if (recovery.canRecover && recovery.nextStep) {
          const stepIndex = this.config.steps.findIndex(s => s.name === recovery.nextStep);
          if (stepIndex !== -1) {
            startStep = stepIndex;
            await this.monitor.log('info', `Resuming pipeline from step: ${recovery.nextStep}`);
          }
        }
      }

      // Execute pipeline steps
      const stepResults: StepResult[] = [];
      let lastStepData: any = null;

      for (let i = startStep; i < this.config.steps.length; i++) {
        if (this.shutdownRequested) {
          throw new Error('Pipeline shutdown requested');
        }

        const step = this.config.steps[i];
        
        // Check dependencies
        if (step.dependencies && step.dependencies.length > 0) {
          const unmetDependencies = step.dependencies.filter(dep => 
            !stepResults.some(r => r.stepName === dep && r.success)
          );
          
          if (unmetDependencies.length > 0) {
            throw new Error(`Unmet dependencies for step ${step.name}: ${unmetDependencies.join(', ')}`);
          }
        }

        // Execute step with retry logic
        const stepResult = await this.executeStep(step, lastStepData);
        stepResults.push(stepResult);

        if (!stepResult.success) {
          throw new Error(`Step ${step.name} failed: ${stepResult.error}`);
        }

        lastStepData = stepResult.data;
        
        // Save step data for recovery
        await this.stateManager.saveStepData(step.name, {
          completed: true,
          data: stepResult.data,
          duration: stepResult.duration,
          recordsProcessed: stepResult.recordsProcessed
        });
      }

      // Run data quality checks
      const qualityIssues = await this.validateDataQuality(lastStepData);
      const warnings = qualityIssues.map(issue => ({
        type: 'data_quality',
        message: issue
      }));

      // Check for alerts
      const alerts = await this.monitor.checkAlerts();

      // Mark pipeline as completed
      await this.stateManager.updateState({
        status: 'completed',
        lastSuccessTime: new Date()
      });
      
      await this.monitor.endPipeline('success');

      const endTime = new Date();
      return {
        success: true,
        runId,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        stepsCompleted: stepResults.length,
        totalSteps: this.config.steps.length,
        warnings,
        alerts,
        metrics: await this.monitor.getCurrentMetrics()
      };

    } catch (error) {
      await this.monitor.recordError({
        step: 'orchestrator',
        error: error as Error,
        context: { runId }
      });
      
      await this.stateManager.updateState({
        status: 'failed',
        metadata: { lastError: (error as Error).message }
      });
      
      await this.monitor.endPipeline('failed', (error as Error).message);

      return {
        success: false,
        runId,
        startTime,
        endTime: new Date(),
        duration: new Date().getTime() - startTime.getTime(),
        stepsCompleted: 0,
        totalSteps: this.config.steps.length,
        error: (error as Error).message
      };

    } finally {
      await this.stateManager.unlockPipeline();
      this.currentRunId = null;
    }
  }

  private async executeStep(step: PipelineStep, inputData?: any): Promise<StepResult> {
    const startTime = new Date();
    let retryCount = 0;
    const maxRetries = step.retryable !== false ? this.config.maxRetries : 0;

    await this.stateManager.updateState({
      status: 'running',
      currentStep: step.name
    });

    while (retryCount <= maxRetries) {
      try {
        await this.monitor.log('info', `Executing step: ${step.name}`, {
          attempt: retryCount + 1,
          maxRetries: maxRetries + 1
        });

        let result: any;
        let recordsProcessed = 0;

        switch (step.type) {
          case 'extract':
            result = await this.extractor.extract({
              ...step.config,
              startDate: step.config.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              endDate: step.config.endDate || new Date()
            });
            recordsProcessed = result.metadata?.recordCount || 0;
            break;

          case 'transform':
            result = await this.transformer.transform(inputData, step.config);
            recordsProcessed = result.metadata?.recordCount || 0;
            break;

          case 'load':
            // For now, simulate the sync operation
            result = {
              success: true,
              recordsProcessed: inputData?.length || 0,
              data: inputData
            };
            recordsProcessed = result.recordsProcessed || 0;
            break;

          default:
            throw new Error(`Unknown step type: ${step.type}`);
        }

        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();

        await this.monitor.recordStepMetrics(step.name, {
          duration,
          recordsProcessed,
          success: true
        });

        return {
          stepName: step.name,
          success: true,
          startTime,
          endTime,
          duration,
          recordsProcessed,
          data: result.data || result
        };

      } catch (error) {
        retryCount++;
        
        await this.monitor.recordError({
          step: step.name,
          error: error as Error,
          context: { retryCount, config: step.config }
        });

        if (retryCount > maxRetries) {
          const endTime = new Date();
          
          await this.monitor.recordStepMetrics(step.name, {
            duration: endTime.getTime() - startTime.getTime(),
            recordsProcessed: 0,
            success: false
          });

          return {
            stepName: step.name,
            success: false,
            startTime,
            endTime,
            duration: endTime.getTime() - startTime.getTime(),
            error: `Failed after ${maxRetries} retries: ${(error as Error).message}`
          };
        }

        // Apply exponential backoff
        const delay = Math.min(
          this.config.retryDelayMs * Math.pow(2, retryCount - 1),
          60000 // Max 1 minute
        );
        
        await this.monitor.log('warning', `Retrying step ${step.name} after ${delay}ms`, {
          error: (error as Error).message,
          retryCount
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Unexpected end of retry loop');
  }

  private async validateDataQuality(data: any): Promise<string[]> {
    const issues: string[] = [];

    if (!data || (Array.isArray(data) && data.length === 0)) {
      issues.push('No data processed in pipeline');
      return issues;
    }

    // Check for invalid data
    if (Array.isArray(data)) {
      const invalidRecords = data.filter(record => 
        !record.asin || 
        record.impressions < 0 ||
        record.clicks < 0 ||
        record.purchases < 0
      );

      if (invalidRecords.length > 0) {
        issues.push(`Found ${invalidRecords.length} invalid records`);
      }

      // Check data freshness
      const timestamps = data
        .map(r => r.date || r.timestamp)
        .filter(Boolean)
        .map(t => new Date(t));

      if (timestamps.length > 0) {
        const mostRecent = Math.max(...timestamps.map(t => t.getTime()));
        const dataAge = Date.now() - mostRecent;
        
        if (dataAge > 48 * 60 * 60 * 1000) { // 48 hours
          issues.push(`Data is older than expected (${Math.floor(dataAge / (24 * 60 * 60 * 1000))} days old)`);
        }
      }
    }

    return issues;
  }

  getSchedule() {
    const interval = parseExpression(this.config.schedule);
    return {
      expression: this.config.schedule,
      nextRun: interval.next().toDate()
    };
  }

  calculateNextRun(from: Date = new Date()): Date {
    const interval = parseExpression(this.config.schedule, { currentDate: from });
    return interval.next().toDate();
  }

  shutdown() {
    this.shutdownRequested = true;
    this.client.close();
    if (this.currentRunId) {
      this.stateManager.unlockPipeline();
    }
  }
}