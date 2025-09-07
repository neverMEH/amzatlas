import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';

// Mock environment variables
const TEST_SUPABASE_URL = process.env.TEST_SUPABASE_URL || 'http://localhost:54321';
const TEST_SUPABASE_SERVICE_KEY = process.env.TEST_SUPABASE_SERVICE_KEY || 'test-service-key';

describe('007_add_sync_tracking migration', () => {
  let supabase: any;
  let migrationSQL: string;

  beforeEach(async () => {
    // Skip if no test database available
    if (!process.env.TEST_SUPABASE_URL) {
      return;
    }

    supabase = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_SERVICE_KEY);
    
    // Read migration file
    const migrationPath = path.join(__dirname, '..', '007_add_sync_tracking.sql');
    migrationSQL = await fs.readFile(migrationPath, 'utf-8');
  });

  afterEach(async () => {
    if (!supabase) return;

    // Clean up test data
    await supabase.rpc('exec_sql', {
      sql: `
        DROP TRIGGER IF EXISTS update_summaries_on_weekly_insert ON sqp.weekly_summary;
        DROP FUNCTION IF EXISTS sqp.update_aggregate_summaries() CASCADE;
        DROP FUNCTION IF EXISTS sqp.check_data_freshness() CASCADE;
        DROP FUNCTION IF EXISTS sqp.get_latest_sync_status(VARCHAR) CASCADE;
        ALTER TABLE sqp.weekly_summary 
          DROP COLUMN IF EXISTS bigquery_sync_id,
          DROP COLUMN IF EXISTS sync_log_id,
          DROP COLUMN IF EXISTS last_synced_at;
        DROP TABLE IF EXISTS sqp.data_quality_checks CASCADE;
        DROP TABLE IF EXISTS sqp.sync_log CASCADE;
      `
    });
  });

  it('should create sync_log table with correct structure', async () => {
    if (!supabase) {
      console.log('Skipping test - no test database configured');
      return;
    }

    // Run migration
    await supabase.rpc('exec_sql', { sql: migrationSQL });

    // Check table exists and has correct columns
    const { data: columns, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_schema', 'sqp')
      .eq('table_name', 'sync_log')
      .order('ordinal_position');

    expect(error).toBeNull();
    expect(columns).toBeDefined();
    
    const columnNames = columns.map((col: any) => col.column_name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('sync_type');
    expect(columnNames).toContain('sync_status');
    expect(columnNames).toContain('started_at');
    expect(columnNames).toContain('completed_at');
    expect(columnNames).toContain('source_table');
    expect(columnNames).toContain('target_table');
    expect(columnNames).toContain('records_processed');
    expect(columnNames).toContain('error_message');
    expect(columnNames).toContain('sync_metadata');
  });

  it('should create data_quality_checks table with foreign key to sync_log', async () => {
    if (!supabase) return;

    await supabase.rpc('exec_sql', { sql: migrationSQL });

    // Check foreign key constraint
    const { data: constraints, error } = await supabase
      .from('information_schema.table_constraints')
      .select('constraint_name, constraint_type')
      .eq('table_schema', 'sqp')
      .eq('table_name', 'data_quality_checks')
      .eq('constraint_type', 'FOREIGN KEY');

    expect(error).toBeNull();
    expect(constraints).toBeDefined();
    expect(constraints.length).toBeGreaterThan(0);
  });

  it('should add sync tracking columns to weekly_summary table', async () => {
    if (!supabase) return;

    await supabase.rpc('exec_sql', { sql: migrationSQL });

    const { data: columns, error } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'sqp')
      .eq('table_name', 'weekly_summary')
      .in('column_name', ['bigquery_sync_id', 'sync_log_id', 'last_synced_at']);

    expect(error).toBeNull();
    expect(columns).toBeDefined();
    expect(columns.length).toBe(3);
  });

  it('should create get_latest_sync_status function', async () => {
    if (!supabase) return;

    await supabase.rpc('exec_sql', { sql: migrationSQL });

    // Insert test data
    const { error: insertError } = await supabase
      .from('sqp.sync_log')
      .insert({
        sync_type: 'weekly',
        sync_status: 'completed',
        source_table: 'bigquery.test',
        target_table: 'sqp.weekly_summary',
        records_processed: 100,
        completed_at: new Date().toISOString()
      });

    expect(insertError).toBeNull();

    // Call function
    const { data, error } = await supabase.rpc('get_latest_sync_status', {
      p_sync_type: 'weekly'
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data[0]).toHaveProperty('last_sync_status', 'completed');
    expect(data[0]).toHaveProperty('records_processed', 100);
  });

  it('should create check_data_freshness function', async () => {
    if (!supabase) return;

    await supabase.rpc('exec_sql', { sql: migrationSQL });

    // Insert test data
    const testDate = new Date();
    testDate.setDate(testDate.getDate() - 7); // 7 days old

    await supabase
      .from('sqp.weekly_summary')
      .insert({
        period_start: testDate.toISOString().split('T')[0],
        period_end: testDate.toISOString().split('T')[0],
        query: 'test query',
        asin: 'B000000001',
        total_impressions: 100,
        total_clicks: 10,
        total_purchases: 1
      });

    // Call function
    const { data, error } = await supabase.rpc('check_data_freshness');

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.length).toBeGreaterThan(0);
    
    const weeklySummary = data.find((d: any) => d.table_name === 'weekly_summary');
    expect(weeklySummary).toBeDefined();
    expect(weeklySummary.days_old).toBe(7);
    expect(weeklySummary.is_stale).toBe(false); // Not stale until 14 days
  });

  it('should create trigger for auto-updating monthly summaries', async () => {
    if (!supabase) return;

    await supabase.rpc('exec_sql', { sql: migrationSQL });

    // Insert weekly data
    const { error: insertError } = await supabase
      .from('sqp.weekly_summary')
      .insert({
        period_start: '2025-08-01',
        period_end: '2025-08-07',
        query: 'test trigger',
        asin: 'B000000001',
        total_impressions: 1000,
        total_clicks: 100,
        total_purchases: 10,
        avg_ctr: 0.1,
        avg_cvr: 0.1
      });

    expect(insertError).toBeNull();

    // Check if monthly summary was created
    const { data: monthlyData, error } = await supabase
      .from('sqp.monthly_summary')
      .select('*')
      .eq('query', 'test trigger')
      .eq('asin', 'B000000001')
      .single();

    expect(error).toBeNull();
    expect(monthlyData).toBeDefined();
    expect(monthlyData.year).toBe(2025);
    expect(monthlyData.month).toBe(8);
    expect(monthlyData.total_impressions).toBe(1000);
    expect(monthlyData.active_weeks).toBe(1);
  });

  it('should handle duplicate inserts with ON CONFLICT in trigger', async () => {
    if (!supabase) return;

    await supabase.rpc('exec_sql', { sql: migrationSQL });

    // Insert first weekly record
    await supabase
      .from('sqp.weekly_summary')
      .insert({
        period_start: '2025-08-01',
        period_end: '2025-08-07',
        query: 'duplicate test',
        asin: 'B000000001',
        total_impressions: 1000,
        total_clicks: 100,
        total_purchases: 10,
        avg_ctr: 0.1,
        avg_cvr: 0.1
      });

    // Insert second weekly record for same month
    await supabase
      .from('sqp.weekly_summary')
      .insert({
        period_start: '2025-08-08',
        period_end: '2025-08-14',
        query: 'duplicate test',
        asin: 'B000000001',
        total_impressions: 2000,
        total_clicks: 200,
        total_purchases: 20,
        avg_ctr: 0.1,
        avg_cvr: 0.1
      });

    // Check monthly summary aggregated correctly
    const { data: monthlyData, error } = await supabase
      .from('sqp.monthly_summary')
      .select('*')
      .eq('query', 'duplicate test')
      .eq('asin', 'B000000001')
      .single();

    expect(error).toBeNull();
    expect(monthlyData.total_impressions).toBe(3000); // 1000 + 2000
    expect(monthlyData.total_clicks).toBe(300); // 100 + 200
    expect(monthlyData.active_weeks).toBe(2); // 2 weeks
  });

  it('should create proper indexes for performance', async () => {
    if (!supabase) return;

    await supabase.rpc('exec_sql', { sql: migrationSQL });

    const { data: indexes, error } = await supabase
      .from('pg_indexes')
      .select('indexname')
      .eq('schemaname', 'sqp')
      .in('tablename', ['sync_log', 'data_quality_checks', 'weekly_summary'])
      .in('indexname', [
        'idx_sync_log_status',
        'idx_sync_log_type',
        'idx_quality_checks_sync',
        'idx_quality_checks_status',
        'idx_weekly_summary_sync'
      ]);

    expect(error).toBeNull();
    expect(indexes.length).toBe(5);
  });

  it('should handle errors gracefully when sync fails', async () => {
    if (!supabase) return;

    await supabase.rpc('exec_sql', { sql: migrationSQL });

    // Create a failed sync log
    const { data: syncLog, error: insertError } = await supabase
      .from('sqp.sync_log')
      .insert({
        sync_type: 'weekly',
        sync_status: 'failed',
        source_table: 'bigquery.test',
        target_table: 'sqp.weekly_summary',
        error_message: 'Connection timeout',
        error_details: { code: 'TIMEOUT', retry_count: 3 }
      })
      .select()
      .single();

    expect(insertError).toBeNull();
    expect(syncLog).toBeDefined();
    expect(syncLog.error_message).toBe('Connection timeout');

    // Add quality check for failed sync
    const { error: checkError } = await supabase
      .from('sqp.data_quality_checks')
      .insert({
        sync_log_id: syncLog.id,
        check_type: 'row_count',
        check_status: 'failed',
        source_value: 1000,
        target_value: 0,
        difference: 1000,
        difference_pct: 100,
        check_message: 'No rows synced due to error'
      });

    expect(checkError).toBeNull();
  });
});