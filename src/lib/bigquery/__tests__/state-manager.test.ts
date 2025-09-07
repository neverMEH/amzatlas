import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PipelineStateManager } from '../state-manager';
import { PipelineState, StateTransition } from '../types/pipeline';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis()
    }))
  }))
}));

describe('PipelineStateManager', () => {
  let stateManager: PipelineStateManager;
  let mockSupabase: any;

  const testPipelineId = 'test-pipeline';

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createClient('test-url', 'test-key');
    stateManager = new PipelineStateManager(testPipelineId);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('State Initialization', () => {
    it('should initialize with default state', async () => {
      const state = await stateManager.getState();

      expect(state).toEqual({
        pipelineId: testPipelineId,
        status: 'idle',
        lastRunTime: null,
        lastSuccessTime: null,
        currentStep: null,
        stepData: {},
        metadata: {}
      });
    });

    it('should load existing state from database', async () => {
      const existingState: PipelineState = {
        pipelineId: testPipelineId,
        status: 'completed',
        lastRunTime: new Date('2024-01-01T00:00:00Z'),
        lastSuccessTime: new Date('2024-01-01T00:00:00Z'),
        currentStep: null,
        stepData: { extract: { completed: true } },
        metadata: { version: '1.0' }
      };

      mockSupabase.from().single.mockResolvedValueOnce({
        data: existingState,
        error: null
      });

      const newStateManager = new PipelineStateManager(testPipelineId);
      const state = await newStateManager.getState();

      expect(state).toEqual(existingState);
    });
  });

  describe('State Updates', () => {
    it('should update state and persist to database', async () => {
      const updateData = {
        status: 'running' as const,
        currentStep: 'extract',
        metadata: { startTime: new Date() }
      };

      await stateManager.updateState(updateData);
      const state = await stateManager.getState();

      expect(state.status).toBe('running');
      expect(state.currentStep).toBe('extract');
      expect(state.metadata.startTime).toEqual(updateData.metadata.startTime);

      expect(mockSupabase.from().update).toHaveBeenCalledWith(
        expect.objectContaining(updateData)
      );
    });

    it('should handle concurrent state updates safely', async () => {
      const updates = [
        { currentStep: 'extract' },
        { currentStep: 'transform' },
        { currentStep: 'load' }
      ];

      await Promise.all(
        updates.map(update => stateManager.updateState(update))
      );

      const state = await stateManager.getState();
      expect(['extract', 'transform', 'load']).toContain(state.currentStep);
    });

    it('should validate state transitions', async () => {
      await stateManager.updateState({ status: 'running' });

      // Invalid transition: idle -> completed without running
      await expect(
        stateManager.transitionState('idle', 'completed')
      ).rejects.toThrow('Invalid state transition');

      // Valid transition
      await expect(
        stateManager.transitionState('running', 'completed')
      ).resolves.toBe(true);
    });
  });

  describe('Pipeline Locking', () => {
    it('should acquire lock successfully when pipeline is idle', async () => {
      const locked = await stateManager.lockPipeline();
      expect(locked).toBe(true);

      const state = await stateManager.getState();
      expect(state.status).toBe('locked');
      expect(state.metadata.lockedAt).toBeInstanceOf(Date);
      expect(state.metadata.lockId).toBeDefined();
    });

    it('should fail to acquire lock when pipeline is already locked', async () => {
      await stateManager.lockPipeline();
      
      const secondLock = await stateManager.lockPipeline();
      expect(secondLock).toBe(false);
    });

    it('should release lock successfully', async () => {
      await stateManager.lockPipeline();
      await stateManager.unlockPipeline();

      const state = await stateManager.getState();
      expect(state.status).toBe('idle');
      expect(state.metadata.lockedAt).toBeUndefined();
      expect(state.metadata.lockId).toBeUndefined();
    });

    it('should handle stale locks with timeout', async () => {
      vi.useFakeTimers();
      const now = new Date('2024-01-01T00:00:00Z');
      vi.setSystemTime(now);

      // Set a stale lock
      await stateManager.updateState({
        status: 'locked',
        metadata: {
          lockedAt: new Date('2024-01-01T00:00:00Z'),
          lockId: 'old-lock'
        }
      });

      // Move time forward past lock timeout (default 5 minutes)
      vi.setSystemTime(new Date('2024-01-01T00:10:00Z'));

      const locked = await stateManager.lockPipeline();
      expect(locked).toBe(true);

      const state = await stateManager.getState();
      expect(state.metadata.lockId).not.toBe('old-lock');
    });
  });

  describe('Step Data Management', () => {
    it('should save step data correctly', async () => {
      const extractData = {
        completed: true,
        recordsProcessed: 1000,
        duration: 5000,
        data: { lastOffset: 1000 }
      };

      await stateManager.saveStepData('extract', extractData);

      const state = await stateManager.getState();
      expect(state.stepData.extract).toEqual(extractData);
    });

    it('should retrieve step data for specific step', async () => {
      const testData = { completed: true, data: [] };
      await stateManager.saveStepData('transform', testData);

      const stepData = await stateManager.getStepData('transform');
      expect(stepData).toEqual(testData);
    });

    it('should clear step data', async () => {
      await stateManager.saveStepData('extract', { completed: true });
      await stateManager.saveStepData('transform', { completed: true });

      await stateManager.clearStepData();

      const state = await stateManager.getState();
      expect(state.stepData).toEqual({});
    });
  });

  describe('State History', () => {
    it('should save state transitions to history', async () => {
      const transitions: StateTransition[] = [];

      mockSupabase.from().insert.mockImplementation((data: any) => {
        if (data.transition) {
          transitions.push(data);
        }
        return mockSupabase.from();
      });

      await stateManager.updateState({ status: 'running' });
      await stateManager.updateState({ status: 'completed' });

      expect(transitions).toHaveLength(2);
      expect(transitions[0].fromStatus).toBe('idle');
      expect(transitions[0].toStatus).toBe('running');
      expect(transitions[1].fromStatus).toBe('running');
      expect(transitions[1].toStatus).toBe('completed');
    });

    it('should retrieve state history with pagination', async () => {
      const mockHistory: StateTransition[] = Array.from({ length: 25 }, (_, i) => ({
        id: i,
        pipelineId: testPipelineId,
        fromStatus: 'idle',
        toStatus: 'running',
        timestamp: new Date(`2024-01-${i + 1}T00:00:00Z`),
        metadata: {}
      }));

      mockSupabase.from().order().limit.mockResolvedValueOnce({
        data: mockHistory.slice(0, 20),
        error: null
      });

      const history = await stateManager.getHistory({ limit: 20 });

      expect(history).toHaveLength(20);
      expect(mockSupabase.from().limit).toHaveBeenCalledWith(20);
    });
  });

  describe('Recovery and Resilience', () => {
    it('should recover from incomplete pipeline runs', async () => {
      await stateManager.updateState({
        status: 'running',
        currentStep: 'transform',
        stepData: {
          extract: { completed: true, data: [] }
        }
      });

      const recovery = await stateManager.getRecoveryPoint();

      expect(recovery).toEqual({
        canRecover: true,
        lastCompletedStep: 'extract',
        nextStep: 'transform',
        stepData: { extract: { completed: true, data: [] } }
      });
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from().update.mockImplementationOnce(() => ({
        ...mockSupabase.from(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Database error')
        })
      }));

      await expect(
        stateManager.updateState({ status: 'running' })
      ).rejects.toThrow('Failed to update pipeline state');
    });
  });

  describe('State Queries', () => {
    it('should check if pipeline is in specific status', async () => {
      await stateManager.updateState({ status: 'running' });

      expect(await stateManager.isStatus('running')).toBe(true);
      expect(await stateManager.isStatus('idle')).toBe(false);
    });

    it('should calculate time since last success', async () => {
      const lastSuccess = new Date('2024-01-01T00:00:00Z');
      await stateManager.updateState({ lastSuccessTime: lastSuccess });

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T01:00:00Z'));

      const timeSinceSuccess = await stateManager.getTimeSinceLastSuccess();
      expect(timeSinceSuccess).toBe(3600000); // 1 hour in milliseconds

      vi.useRealTimers();
    });

    it('should get current pipeline health status', async () => {
      await stateManager.updateState({
        status: 'completed',
        lastSuccessTime: new Date(),
        metadata: {
          recentErrors: 0,
          successRate: 0.95
        }
      });

      const health = await stateManager.getHealth();

      expect(health).toEqual({
        status: 'healthy',
        lastSuccessTime: expect.any(Date),
        successRate: 0.95,
        recentErrors: 0
      });
    });
  });

  describe('Cleanup and Maintenance', () => {
    it('should clean up old state history', async () => {
      mockSupabase.from().delete = vi.fn().mockReturnThis();
      mockSupabase.from().lt = vi.fn().mockReturnThis();

      await stateManager.cleanupHistory({ daysToKeep: 30 });

      expect(mockSupabase.from().delete).toHaveBeenCalled();
      expect(mockSupabase.from().lt).toHaveBeenCalledWith(
        'timestamp',
        expect.any(String)
      );
    });

    it('should reset pipeline state', async () => {
      await stateManager.updateState({
        status: 'failed',
        currentStep: 'load',
        stepData: { extract: { completed: true } },
        metadata: { errors: ['error1', 'error2'] }
      });

      await stateManager.reset();

      const state = await stateManager.getState();
      expect(state.status).toBe('idle');
      expect(state.currentStep).toBeNull();
      expect(state.stepData).toEqual({});
      expect(state.metadata).toEqual({});
    });
  });
});