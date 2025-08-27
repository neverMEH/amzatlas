import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  PipelineState, 
  PipelineStatus,
  StateTransition,
  RecoveryPoint 
} from './types/pipeline';
import { randomUUID } from 'crypto';

export interface StateManagerConfig {
  lockTimeoutMs?: number; // Default: 5 minutes
  retentionDays?: number; // Default: 30 days
}

export class PipelineStateManager {
  private supabase: SupabaseClient;
  private pipelineId: string;
  private state: PipelineState;
  private config: StateManagerConfig;

  constructor(
    pipelineId: string, 
    config: StateManagerConfig = {}
  ) {
    this.pipelineId = pipelineId;
    this.config = {
      lockTimeoutMs: config.lockTimeoutMs || 5 * 60 * 1000, // 5 minutes
      retentionDays: config.retentionDays || 30
    };

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize default state
    this.state = {
      pipelineId,
      status: 'idle',
      lastRunTime: null,
      lastSuccessTime: null,
      currentStep: null,
      stepData: {},
      metadata: {}
    };

    // Load existing state
    this.loadState();
  }

  private async loadState(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('pipeline_states')
        .select('*')
        .eq('pipeline_id', this.pipelineId)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is ok
        throw error;
      }

      if (data) {
        this.state = {
          ...data,
          lastRunTime: data.last_run_time ? new Date(data.last_run_time) : null,
          lastSuccessTime: data.last_success_time ? new Date(data.last_success_time) : null
        };
      } else {
        // Create initial state record
        await this.persistState();
      }
    } catch (error) {
      console.error('Failed to load pipeline state:', error);
    }
  }

  private async persistState(): Promise<void> {
    try {
      const stateData = {
        pipeline_id: this.state.pipelineId,
        status: this.state.status,
        last_run_time: this.state.lastRunTime?.toISOString() || null,
        last_success_time: this.state.lastSuccessTime?.toISOString() || null,
        current_step: this.state.currentStep,
        step_data: this.state.stepData,
        metadata: this.state.metadata,
        updated_at: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('pipeline_states')
        .upsert(stateData, {
          onConflict: 'pipeline_id'
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      throw new Error(`Failed to update pipeline state: ${error}`);
    }
  }

  async getState(): Promise<PipelineState> {
    await this.loadState(); // Refresh from database
    return { ...this.state };
  }

  async updateState(updates: Partial<PipelineState>): Promise<void> {
    const previousStatus = this.state.status;
    
    // Update local state
    this.state = {
      ...this.state,
      ...updates,
      lastRunTime: updates.status === 'running' ? new Date() : this.state.lastRunTime
    };

    // Persist to database
    await this.persistState();

    // Record state transition if status changed
    if (updates.status && updates.status !== previousStatus) {
      await this.recordTransition(previousStatus, updates.status);
    }
  }

  async lockPipeline(): Promise<boolean> {
    try {
      await this.loadState();

      // Check if already locked
      if (this.state.status === 'locked' || this.state.status === 'running') {
        // Check for stale lock
        const lockedAt = this.state.metadata.lockedAt;
        if (lockedAt) {
          const lockAge = Date.now() - new Date(lockedAt).getTime();
          if (lockAge < this.config.lockTimeoutMs!) {
            return false; // Lock is still valid
          }
        }
      }

      // Acquire lock
      const lockId = randomUUID();
      await this.updateState({
        status: 'locked',
        metadata: {
          ...this.state.metadata,
          lockedAt: new Date(),
          lockId
        }
      });

      return true;
    } catch (error) {
      console.error('Failed to acquire pipeline lock:', error);
      return false;
    }
  }

  async unlockPipeline(): Promise<void> {
    const updates: Partial<PipelineState> = {
      status: 'idle',
      metadata: { ...this.state.metadata }
    };

    delete updates.metadata!.lockedAt;
    delete updates.metadata!.lockId;

    await this.updateState(updates);
  }

  async saveStepData(stepName: string, data: any): Promise<void> {
    await this.updateState({
      stepData: {
        ...this.state.stepData,
        [stepName]: data
      }
    });
  }

  async getStepData(stepName: string): Promise<any> {
    await this.loadState();
    return this.state.stepData[stepName];
  }

  async clearStepData(): Promise<void> {
    await this.updateState({ stepData: {} });
  }

  async getRecoveryPoint(): Promise<RecoveryPoint> {
    await this.loadState();

    if (this.state.status !== 'failed' || !this.state.currentStep) {
      return {
        canRecover: false,
        lastCompletedStep: null,
        nextStep: null,
        stepData: {}
      };
    }

    // Find the last completed step
    const completedSteps = Object.entries(this.state.stepData)
      .filter(([_, data]) => data.completed)
      .map(([stepName, _]) => stepName);

    const lastCompleted = completedSteps[completedSteps.length - 1] || null;

    return {
      canRecover: true,
      lastCompletedStep: lastCompleted,
      nextStep: this.state.currentStep,
      stepData: this.state.stepData
    };
  }

  async transitionState(from: PipelineStatus, to: PipelineStatus): Promise<boolean> {
    const validTransitions: Record<PipelineStatus, PipelineStatus[]> = {
      idle: ['locked', 'running'],
      locked: ['running', 'idle'],
      running: ['completed', 'failed', 'cancelled'],
      completed: ['idle', 'running'],
      failed: ['idle', 'running'],
      cancelled: ['idle']
    };

    if (!validTransitions[from]?.includes(to)) {
      throw new Error(`Invalid state transition: ${from} -> ${to}`);
    }

    await this.updateState({ status: to });
    return true;
  }

  private async recordTransition(
    fromStatus: PipelineStatus, 
    toStatus: PipelineStatus
  ): Promise<void> {
    try {
      const transition: Omit<StateTransition, 'id'> = {
        pipelineId: this.pipelineId,
        fromStatus,
        toStatus,
        timestamp: new Date(),
        metadata: {
          runId: this.state.metadata.runId,
          currentStep: this.state.currentStep
        }
      };

      const { error } = await this.supabase
        .from('pipeline_transitions')
        .insert({
          pipeline_id: transition.pipelineId,
          from_status: transition.fromStatus,
          to_status: transition.toStatus,
          timestamp: transition.timestamp.toISOString(),
          metadata: transition.metadata
        });

      if (error) {
        console.error('Failed to record state transition:', error);
      }
    } catch (error) {
      console.error('Error recording state transition:', error);
    }
  }

  async getHistory(options: { limit?: number; offset?: number } = {}): Promise<StateTransition[]> {
    const { limit = 100, offset = 0 } = options;

    try {
      const { data, error } = await this.supabase
        .from('pipeline_transitions')
        .select('*')
        .eq('pipeline_id', this.pipelineId)
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return (data || []).map(row => ({
        id: row.id,
        pipelineId: row.pipeline_id,
        fromStatus: row.from_status,
        toStatus: row.to_status,
        timestamp: new Date(row.timestamp),
        metadata: row.metadata
      }));
    } catch (error) {
      console.error('Failed to get pipeline history:', error);
      return [];
    }
  }

  async isStatus(status: PipelineStatus): Promise<boolean> {
    await this.loadState();
    return this.state.status === status;
  }

  async getTimeSinceLastSuccess(): Promise<number | null> {
    await this.loadState();
    
    if (!this.state.lastSuccessTime) {
      return null;
    }

    return Date.now() - this.state.lastSuccessTime.getTime();
  }

  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastSuccessTime: Date | null;
    successRate: number;
    recentErrors: number;
  }> {
    await this.loadState();

    const recentErrors = this.state.metadata.recentErrors || 0;
    const successRate = this.state.metadata.successRate || 0;
    const timeSinceSuccess = await this.getTimeSinceLastSuccess();

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (recentErrors > 5 || successRate < 0.8) {
      status = 'unhealthy';
    } else if (recentErrors > 2 || successRate < 0.95 || (timeSinceSuccess && timeSinceSuccess > 24 * 60 * 60 * 1000)) {
      status = 'degraded';
    }

    return {
      status,
      lastSuccessTime: this.state.lastSuccessTime,
      successRate,
      recentErrors
    };
  }

  async cleanupHistory(options: { daysToKeep: number }): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - options.daysToKeep);

    try {
      const { error } = await this.supabase
        .from('pipeline_transitions')
        .delete()
        .eq('pipeline_id', this.pipelineId)
        .lt('timestamp', cutoffDate.toISOString());

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Failed to cleanup pipeline history:', error);
    }
  }

  async reset(): Promise<void> {
    await this.updateState({
      status: 'idle',
      currentStep: null,
      stepData: {},
      metadata: {}
    });
  }
}