import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// These tests require a running Supabase instance with migrations applied
// Set TEST_SUPABASE_URL and TEST_SUPABASE_SERVICE_KEY env vars to run

describe('Database Integration Tests', () => {
  let supabase: any;
  const skipTests = !process.env.TEST_SUPABASE_URL || !process.env.TEST_SUPABASE_SERVICE_KEY;

  beforeAll(() => {
    if (skipTests) {
      console.log('Skipping database integration tests - no test database configured');
      return;
    }

    supabase = createClient(
      process.env.TEST_SUPABASE_URL!,
      process.env.TEST_SUPABASE_SERVICE_KEY!
    );
  });

  afterAll(async () => {
    if (!supabase) return;

    // Clean up test data
    await supabase.from('sqp.data_quality_checks').delete().neq('id', 0);
    await supabase.from('sqp.sync_log').delete().neq('id', 0);
    await supabase.from('sqp.weekly_summary').delete().eq('query', 'integration-test');
    await supabase.from('sqp.monthly_summary').delete().eq('query', 'integration-test');
  });

  describe('sync_log table', () => {
    it('should create and retrieve sync log entries', async () => {
      if (skipTests) return;

      const syncLogData = {
        sync_type: 'weekly',
        sync_status: 'started',
        source_table: 'bigquery.test_table',
        target_table: 'sqp.weekly_summary',
        period_start: '2025-08-01',
        period_end: '2025-08-07',
      };

      // Create sync log entry
      const { data: created, error: createError } = await supabase
        .from('sqp.sync_log')
        .insert(syncLogData)
        .select()
        .single();

      expect(createError).toBeNull();
      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.sync_type).toBe('weekly');

      // Update sync log to completed
      const { data: updated, error: updateError } = await supabase
        .from('sqp.sync_log')
        .update({
          sync_status: 'completed',
          completed_at: new Date().toISOString(),
          records_processed: 1000,
          records_inserted: 800,
          records_updated: 200,
        })
        .eq('id', created.id)
        .select()
        .single();

      expect(updateError).toBeNull();
      expect(updated.sync_status).toBe('completed');
      expect(updated.records_processed).toBe(1000);
    });

    it('should handle sync failures with error tracking', async () => {
      if (skipTests) return;

      const failedSync = {
        sync_type: 'weekly',
        sync_status: 'failed',
        source_table: 'bigquery.test_table',
        target_table: 'sqp.weekly_summary',
        error_message: 'Connection timeout',
        error_details: {
          code: 'TIMEOUT',
          retry_count: 3,
          last_error: 'Network unreachable',
        },
      };

      const { data, error } = await supabase
        .from('sqp.sync_log')
        .insert(failedSync)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.error_message).toBe('Connection timeout');
      expect(data.error_details.code).toBe('TIMEOUT');
    });
  });

  describe('data_quality_checks table', () => {
    it('should create quality check entries linked to sync log', async () => {
      if (skipTests) return;

      // First create a sync log
      const { data: syncLog } = await supabase
        .from('sqp.sync_log')
        .insert({
          sync_type: 'weekly',
          sync_status: 'completed',
          source_table: 'bigquery.test',
          target_table: 'sqp.weekly_summary',
        })
        .select()
        .single();

      // Create quality checks
      const qualityChecks = [
        {
          sync_log_id: syncLog.id,
          check_type: 'row_count',
          check_status: 'passed',
          source_value: 1000,
          target_value: 1000,
          difference: 0,
          difference_pct: 0,
        },
        {
          sync_log_id: syncLog.id,
          check_type: 'sum_validation',
          check_status: 'warning',
          source_value: 50000,
          target_value: 49998,
          difference: 2,
          difference_pct: 0.004,
          column_name: 'total_impressions',
        },
      ];

      const { data, error } = await supabase
        .from('sqp.data_quality_checks')
        .insert(qualityChecks)
        .select();

      expect(error).toBeNull();
      expect(data.length).toBe(2);
      expect(data[0].check_type).toBe('row_count');
      expect(data[1].check_status).toBe('warning');
    });
  });

  describe('sync tracking columns on weekly_summary', () => {
    it('should store sync metadata on weekly_summary records', async () => {
      if (skipTests) return;

      // Create a sync log
      const { data: syncLog } = await supabase
        .from('sqp.sync_log')
        .insert({
          sync_type: 'weekly',
          sync_status: 'completed',
          source_table: 'bigquery.test',
          target_table: 'sqp.weekly_summary',
        })
        .select()
        .single();

      // Create weekly summary with sync tracking
      const weeklySummary = {
        period_start: '2025-08-01',
        period_end: '2025-08-07',
        query: 'integration-test',
        asin: 'B000000001',
        total_impressions: 1000,
        total_clicks: 100,
        total_purchases: 10,
        avg_ctr: 0.1,
        avg_cvr: 0.1,
        bigquery_sync_id: 'bq-job-123456',
        sync_log_id: syncLog.id,
        last_synced_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('sqp.weekly_summary')
        .insert(weeklySummary)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.bigquery_sync_id).toBe('bq-job-123456');
      expect(data.sync_log_id).toBe(syncLog.id);
      expect(data.last_synced_at).toBeDefined();
    });
  });

  describe('get_latest_sync_status function', () => {
    it('should return the latest sync status for a given type', async () => {
      if (skipTests) return;

      // Create multiple sync logs
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      await supabase.from('sqp.sync_log').insert([
        {
          sync_type: 'weekly',
          sync_status: 'completed',
          source_table: 'bigquery.test',
          target_table: 'sqp.weekly_summary',
          started_at: yesterday.toISOString(),
          completed_at: yesterday.toISOString(),
          records_processed: 500,
        },
        {
          sync_type: 'weekly',
          sync_status: 'completed',
          source_table: 'bigquery.test',
          target_table: 'sqp.weekly_summary',
          started_at: now.toISOString(),
          completed_at: now.toISOString(),
          records_processed: 1000,
        },
      ]);

      // Call the function
      const { data, error } = await supabase.rpc('get_latest_sync_status', {
        p_sync_type: 'weekly',
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBe(1);
      expect(data[0].records_processed).toBe(1000); // Should return the latest
      expect(data[0].last_sync_status).toBe('completed');
      expect(data[0].next_sync_due).toBeDefined();
    });

    it('should return empty result when no syncs exist', async () => {
      if (skipTests) return;

      const { data, error } = await supabase.rpc('get_latest_sync_status', {
        p_sync_type: 'quarterly', // Type with no records
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBe(0);
    });
  });

  describe('check_data_freshness function', () => {
    it('should check data freshness for all summary tables', async () => {
      if (skipTests) return;

      // Create test data with known dates
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 20); // 20 days old

      await supabase.from('sqp.weekly_summary').insert({
        period_start: oldDate.toISOString().split('T')[0],
        period_end: oldDate.toISOString().split('T')[0],
        query: 'integration-test',
        asin: 'B000000002',
        total_impressions: 100,
        total_clicks: 10,
        total_purchases: 1,
      });

      // Call the function
      const { data, error } = await supabase.rpc('check_data_freshness');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);

      const weeklySummary = data.find((d: any) => d.table_name === 'weekly_summary');
      expect(weeklySummary).toBeDefined();
      expect(weeklySummary.days_old).toBeGreaterThanOrEqual(20);
      expect(weeklySummary.is_stale).toBe(true); // Should be stale after 14 days
    });
  });

  describe('update_aggregate_summaries trigger', () => {
    it('should automatically create monthly summary on weekly insert', async () => {
      if (skipTests) return;

      // Insert weekly data
      const weeklyData = {
        period_start: '2025-08-01',
        period_end: '2025-08-07',
        query: 'integration-test',
        asin: 'B000000003',
        total_impressions: 5000,
        total_clicks: 500,
        total_purchases: 50,
        avg_ctr: 0.1,
        avg_cvr: 0.1,
        impression_share: 0.25,
        click_share: 0.3,
        purchase_share: 0.35,
      };

      const { error: insertError } = await supabase
        .from('sqp.weekly_summary')
        .insert(weeklyData);

      expect(insertError).toBeNull();

      // Wait a moment for trigger to execute
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if monthly summary was created
      const { data: monthlyData, error } = await supabase
        .from('sqp.monthly_summary')
        .select('*')
        .eq('query', 'integration-test')
        .eq('asin', 'B000000003')
        .eq('year', 2025)
        .eq('month', 8)
        .single();

      expect(error).toBeNull();
      expect(monthlyData).toBeDefined();
      expect(monthlyData.total_impressions).toBe(5000);
      expect(monthlyData.total_clicks).toBe(500);
      expect(monthlyData.active_weeks).toBe(1);
    });

    it('should aggregate multiple weekly records into monthly summary', async () => {
      if (skipTests) return;

      // Insert first week
      await supabase.from('sqp.weekly_summary').insert({
        period_start: '2025-08-08',
        period_end: '2025-08-14',
        query: 'integration-test',
        asin: 'B000000004',
        total_impressions: 3000,
        total_clicks: 300,
        total_purchases: 30,
        avg_ctr: 0.1,
        avg_cvr: 0.1,
      });

      // Insert second week
      await supabase.from('sqp.weekly_summary').insert({
        period_start: '2025-08-15',
        period_end: '2025-08-21',
        query: 'integration-test',
        asin: 'B000000004',
        total_impressions: 4000,
        total_clicks: 400,
        total_purchases: 40,
        avg_ctr: 0.1,
        avg_cvr: 0.1,
      });

      // Wait for triggers
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check aggregated monthly summary
      const { data: monthlyData, error } = await supabase
        .from('sqp.monthly_summary')
        .select('*')
        .eq('query', 'integration-test')
        .eq('asin', 'B000000004')
        .eq('year', 2025)
        .eq('month', 8)
        .single();

      expect(error).toBeNull();
      expect(monthlyData.total_impressions).toBe(7000); // 3000 + 4000
      expect(monthlyData.total_clicks).toBe(700); // 300 + 400
      expect(monthlyData.total_purchases).toBe(70); // 30 + 40
      expect(monthlyData.active_weeks).toBe(2);
      
      // Check recalculated CTR
      expect(monthlyData.avg_ctr).toBeCloseTo(0.1, 3); // 700/7000
    });
  });

  describe('Performance and indexes', () => {
    it('should have proper indexes for query performance', async () => {
      if (skipTests) return;

      // Check indexes exist
      const { data: indexes, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT indexname 
          FROM pg_indexes 
          WHERE schemaname = 'sqp' 
          AND indexname IN (
            'idx_sync_log_status',
            'idx_sync_log_type',
            'idx_quality_checks_sync',
            'idx_quality_checks_status',
            'idx_weekly_summary_sync'
          );
        `
      });

      expect(error).toBeNull();
      expect(indexes).toBeDefined();
      expect(indexes.length).toBeGreaterThanOrEqual(5);
    });
  });
});