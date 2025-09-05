import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'child_process'
import path from 'path'

describe('031_add_refresh_infrastructure migration', () => {
  const supabaseUrl = process.env.SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  describe('Table Creation', () => {
    it('should create refresh_config table with correct structure', async () => {
      const { data, error } = await supabase
        .from('sqp.refresh_config')
        .select()
        .limit(0)

      expect(error).toBeNull()
      
      // Check columns exist by querying information schema
      const { data: columns } = await supabase
        .rpc('get_table_columns', { 
          schema_name: 'sqp', 
          table_name: 'refresh_config' 
        })
      
      const columnNames = columns?.map((c: any) => c.column_name) || []
      expect(columnNames).toContain('id')
      expect(columnNames).toContain('table_schema')
      expect(columnNames).toContain('table_name')
      expect(columnNames).toContain('is_enabled')
      expect(columnNames).toContain('refresh_frequency_hours')
      expect(columnNames).toContain('priority')
      expect(columnNames).toContain('last_refresh_at')
      expect(columnNames).toContain('next_refresh_at')
      expect(columnNames).toContain('custom_sync_params')
      expect(columnNames).toContain('dependencies')
    })

    it('should create refresh_audit_log table with correct structure', async () => {
      const { data, error } = await supabase
        .from('sqp.refresh_audit_log')
        .select()
        .limit(0)

      expect(error).toBeNull()
      
      const { data: columns } = await supabase
        .rpc('get_table_columns', { 
          schema_name: 'sqp', 
          table_name: 'refresh_audit_log' 
        })
      
      const columnNames = columns?.map((c: any) => c.column_name) || []
      expect(columnNames).toContain('id')
      expect(columnNames).toContain('refresh_config_id')
      expect(columnNames).toContain('table_schema')
      expect(columnNames).toContain('table_name')
      expect(columnNames).toContain('refresh_started_at')
      expect(columnNames).toContain('refresh_completed_at')
      expect(columnNames).toContain('status')
      expect(columnNames).toContain('rows_processed')
      expect(columnNames).toContain('error_message')
    })

    it('should create refresh_checkpoints table with unique constraint', async () => {
      const { data, error } = await supabase
        .from('sqp.refresh_checkpoints')
        .select()
        .limit(0)

      expect(error).toBeNull()
      
      // Test unique constraint
      const testCheckpoint = {
        function_name: 'test-function',
        table_schema: 'sqp',
        table_name: 'test_table',
        checkpoint_data: { test: true },
        status: 'active'
      }

      // Insert first checkpoint
      const { error: insertError1 } = await supabase
        .from('sqp.refresh_checkpoints')
        .insert(testCheckpoint)

      expect(insertError1).toBeNull()

      // Try to insert duplicate (should fail)
      const { error: insertError2 } = await supabase
        .from('sqp.refresh_checkpoints')
        .insert(testCheckpoint)

      expect(insertError2).not.toBeNull()
      expect(insertError2?.code).toBe('23505') // Unique violation

      // Cleanup
      await supabase
        .from('sqp.refresh_checkpoints')
        .delete()
        .eq('function_name', 'test-function')
    })
  })

  describe('Triggers and Functions', () => {
    it('should auto-register new tables in sqp schema', async () => {
      // Create a test table
      await supabase.rpc('execute_sql', {
        sql: `CREATE TABLE IF NOT EXISTS sqp.test_auto_register_table (id SERIAL PRIMARY KEY)`
      })

      // Wait a moment for trigger to fire
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Check if table was registered
      const { data } = await supabase
        .from('sqp.refresh_config')
        .select()
        .eq('table_schema', 'sqp')
        .eq('table_name', 'test_auto_register_table')
        .single()

      expect(data).not.toBeNull()
      expect(data?.is_enabled).toBe(true)
      expect(data?.refresh_frequency_hours).toBe(24)
      expect(data?.priority).toBe(100)

      // Cleanup
      await supabase.rpc('execute_sql', {
        sql: `DROP TABLE IF EXISTS sqp.test_auto_register_table CASCADE`
      })
      
      await supabase
        .from('sqp.refresh_config')
        .delete()
        .eq('table_name', 'test_auto_register_table')
    })

    it('should update timestamp on refresh_config updates', async () => {
      // Insert test config
      const { data: inserted } = await supabase
        .from('sqp.refresh_config')
        .insert({
          table_schema: 'sqp',
          table_name: 'test_update_timestamp',
          is_enabled: true
        })
        .select()
        .single()

      const originalTimestamp = inserted?.updated_at

      // Wait and update
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const { data: updated } = await supabase
        .from('sqp.refresh_config')
        .update({ priority: 50 })
        .eq('id', inserted?.id)
        .select()
        .single()

      expect(updated?.updated_at).not.toBe(originalTimestamp)
      expect(new Date(updated?.updated_at).getTime()).toBeGreaterThan(
        new Date(originalTimestamp).getTime()
      )

      // Cleanup
      await supabase
        .from('sqp.refresh_config')
        .delete()
        .eq('id', inserted?.id)
    })
  })

  describe('Initial Data Population', () => {
    it('should populate configurations for core tables', async () => {
      const { data: configs } = await supabase
        .from('sqp.refresh_config')
        .select()
        .eq('table_schema', 'sqp')
        .in('table_name', [
          'asin_performance_data',
          'search_query_performance',
          'search_performance_summary',
          'daily_sqp_data',
          'weekly_summary',
          'monthly_summary',
          'quarterly_summary',
          'yearly_summary'
        ])

      expect(configs?.length).toBe(8)
      
      // Check priorities
      const asinPerf = configs?.find(c => c.table_name === 'asin_performance_data')
      expect(asinPerf?.priority).toBe(90)
      
      const weeklySummary = configs?.find(c => c.table_name === 'weekly_summary')
      expect(weeklySummary?.priority).toBe(80)
    })

    it('should set up table dependencies correctly', async () => {
      const { data: dependencies } = await supabase
        .from('sqp.refresh_dependencies')
        .select(`
          *,
          parent:refresh_config!refresh_dependencies_parent_config_id_fkey(table_name),
          dependent:refresh_config!refresh_dependencies_dependent_config_id_fkey(table_name)
        `)

      // Check that asin_performance_data is parent to summaries
      const asinDeps = dependencies?.filter(
        d => d.parent?.table_name === 'asin_performance_data'
      )
      
      const dependentTables = asinDeps?.map(d => d.dependent?.table_name) || []
      expect(dependentTables).toContain('search_performance_summary')
      expect(dependentTables).toContain('weekly_summary')
      expect(dependentTables).toContain('monthly_summary')
    })
  })

  describe('Constraints and Indexes', () => {
    it('should have proper indexes for performance', async () => {
      const { data: indexes } = await supabase
        .rpc('get_table_indexes', {
          schema_name: 'sqp',
          table_name: 'refresh_config'
        })

      const indexNames = indexes?.map((i: any) => i.index_name) || []
      expect(indexNames).toContain('idx_refresh_config_next_refresh')
      expect(indexNames).toContain('idx_refresh_config_priority')
    })

    it('should enforce status check constraint on audit log', async () => {
      const { error } = await supabase
        .from('sqp.refresh_audit_log')
        .insert({
          table_schema: 'sqp',
          table_name: 'test_table',
          refresh_started_at: new Date().toISOString(),
          status: 'invalid_status' // Should fail
        })

      expect(error).not.toBeNull()
      expect(error?.code).toBe('23514') // Check violation
    })
  })
})

// Helper RPC functions that would need to be created
const helperFunctions = `
CREATE OR REPLACE FUNCTION get_table_columns(schema_name text, table_name text)
RETURNS TABLE(column_name text) AS $$
BEGIN
  RETURN QUERY
  SELECT c.column_name::text
  FROM information_schema.columns c
  WHERE c.table_schema = schema_name
  AND c.table_name = table_name;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_table_indexes(schema_name text, table_name text)
RETURNS TABLE(index_name text) AS $$
BEGIN
  RETURN QUERY
  SELECT i.indexname::text
  FROM pg_indexes i
  WHERE i.schemaname = schema_name
  AND i.tablename = table_name;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION execute_sql(sql text)
RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql;
`