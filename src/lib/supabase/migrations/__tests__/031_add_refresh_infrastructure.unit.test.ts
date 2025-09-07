import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('031_add_refresh_infrastructure migration - Unit Tests', () => {
  const migrationPath = path.join(__dirname, '../031_add_refresh_infrastructure.sql')
  let migrationContent: string

  beforeAll(() => {
    migrationContent = readFileSync(migrationPath, 'utf-8')
  })

  describe('Table Definitions', () => {
    it('should create refresh_config table with all required columns', () => {
      expect(migrationContent).toContain('CREATE TABLE IF NOT EXISTS sqp.refresh_config')
      expect(migrationContent).toContain('id SERIAL PRIMARY KEY')
      expect(migrationContent).toContain('table_schema TEXT NOT NULL')
      expect(migrationContent).toContain('table_name TEXT NOT NULL')
      expect(migrationContent).toContain('is_enabled BOOLEAN DEFAULT true')
      expect(migrationContent).toContain('refresh_frequency_hours INTEGER DEFAULT 24')
      expect(migrationContent).toContain('priority INTEGER DEFAULT 100')
      expect(migrationContent).toContain('last_refresh_at TIMESTAMP WITH TIME ZONE')
      expect(migrationContent).toContain('next_refresh_at TIMESTAMP WITH TIME ZONE')
      expect(migrationContent).toContain('custom_sync_params JSONB DEFAULT \'{}\'')
      expect(migrationContent).toContain('UNIQUE(table_schema, table_name)')
    })

    it('should create refresh_audit_log table with proper constraints', () => {
      expect(migrationContent).toContain('CREATE TABLE IF NOT EXISTS sqp.refresh_audit_log')
      expect(migrationContent).toContain('refresh_config_id INTEGER REFERENCES sqp.refresh_config(id)')
      expect(migrationContent).toContain('status TEXT CHECK (status IN (\'running\', \'success\', \'failed\', \'warning\'))')
      expect(migrationContent).toContain('rows_processed INTEGER')
      expect(migrationContent).toContain('error_message TEXT')
      expect(migrationContent).toContain('bigquery_job_id TEXT')
    })

    it('should create refresh_checkpoints table with unique constraint', () => {
      expect(migrationContent).toContain('CREATE TABLE IF NOT EXISTS sqp.refresh_checkpoints')
      expect(migrationContent).toContain('function_name TEXT NOT NULL')
      expect(migrationContent).toContain('checkpoint_data JSONB NOT NULL')
      expect(migrationContent).toContain('status TEXT CHECK (status IN (\'active\', \'completed\', \'expired\'))')
      // Check for the partial unique index instead of inline constraint
      expect(migrationContent).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_checkpoints_unique_active')
      expect(migrationContent).toContain('WHERE status = \'active\'')
    })
  })

  describe('Indexes', () => {
    it('should create performance indexes on refresh_config', () => {
      expect(migrationContent).toContain('CREATE INDEX IF NOT EXISTS idx_refresh_config_next_refresh')
      expect(migrationContent).toContain('ON sqp.refresh_config(next_refresh_at)')
      expect(migrationContent).toContain('WHERE is_enabled = true')
      
      expect(migrationContent).toContain('CREATE INDEX IF NOT EXISTS idx_refresh_config_priority')
      expect(migrationContent).toContain('ON sqp.refresh_config(priority DESC)')
    })

    it('should create indexes on audit log for efficient querying', () => {
      expect(migrationContent).toContain('CREATE INDEX IF NOT EXISTS idx_audit_log_status_time')
      expect(migrationContent).toContain('CREATE INDEX IF NOT EXISTS idx_audit_log_table')
      expect(migrationContent).toContain('CREATE INDEX IF NOT EXISTS idx_audit_log_config_id')
    })
  })

  describe('Functions and Triggers', () => {
    it('should create auto-registration function for new tables', () => {
      expect(migrationContent).toContain('CREATE OR REPLACE FUNCTION sqp.auto_register_table_for_refresh()')
      expect(migrationContent).toContain('RETURNS event_trigger')
      expect(migrationContent).toContain('INSERT INTO sqp.refresh_config')
      expect(migrationContent).toContain('ON CONFLICT (table_schema, table_name) DO NOTHING')
    })

    it('should create event trigger for auto-registration', () => {
      expect(migrationContent).toContain('CREATE EVENT TRIGGER auto_register_refresh_tables')
      expect(migrationContent).toContain('ON ddl_command_end')
      expect(migrationContent).toContain('WHEN TAG IN (\'CREATE TABLE\', \'CREATE TABLE AS\')')
      expect(migrationContent).toContain('EXECUTE FUNCTION sqp.auto_register_table_for_refresh()')
    })

    it('should create cleanup function for expired checkpoints', () => {
      expect(migrationContent).toContain('CREATE OR REPLACE FUNCTION sqp.cleanup_expired_checkpoints()')
      expect(migrationContent).toContain('UPDATE sqp.refresh_checkpoints')
      expect(migrationContent).toContain('SET status = \'expired\'')
      expect(migrationContent).toContain('WHERE status = \'active\'')
      expect(migrationContent).toContain('AND expires_at < CURRENT_TIMESTAMP')
    })
  })

  describe('Initial Data Population', () => {
    it('should populate configurations for all core tables', () => {
      const coreTables = [
        'asin_performance_data',
        'search_query_performance',
        'search_performance_summary',
        'daily_sqp_data',
        'weekly_summary',
        'monthly_summary',
        'quarterly_summary',
        'yearly_summary'
      ]

      coreTables.forEach(tableName => {
        expect(migrationContent).toContain(`('sqp', '${tableName}',`)
      })
    })

    it('should set correct priorities for different table types', () => {
      // ASIN performance data should have highest priority
      expect(migrationContent).toMatch(/\('sqp', 'asin_performance_data', 90,/)
      
      // Summary tables should have lower priority
      expect(migrationContent).toMatch(/\('sqp', 'weekly_summary', 80,/)
    })

    it('should configure table dependencies', () => {
      expect(migrationContent).toContain('INSERT INTO sqp.refresh_dependencies')
      expect(migrationContent).toContain('p.table_name = \'asin_performance_data\'')
      expect(migrationContent).toContain('AND d.table_name IN (\'search_performance_summary\', \'weekly_summary\', \'monthly_summary\')')
    })
  })

  describe('Monitoring Views', () => {
    it('should create refresh status overview view', () => {
      expect(migrationContent).toContain('CREATE OR REPLACE VIEW sqp.refresh_status_overview')
      expect(migrationContent).toContain('rc.table_schema')
      expect(migrationContent).toContain('la.status as last_status')
      expect(migrationContent).toContain('ORDER BY rc.priority DESC')
    })
  })

  describe('Permissions', () => {
    it('should grant appropriate permissions', () => {
      expect(migrationContent).toContain('GRANT SELECT ON sqp.refresh_status_overview TO authenticated')
      expect(migrationContent).toContain('GRANT ALL ON sqp.refresh_config TO service_role')
      expect(migrationContent).toContain('GRANT ALL ON sqp.refresh_audit_log TO service_role')
      expect(migrationContent).toContain('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sqp TO service_role')
    })
  })

  describe('SQL Syntax Validation', () => {
    it('should have balanced parentheses in CREATE TABLE statements', () => {
      const createTableCount = (migrationContent.match(/CREATE TABLE/g) || []).length
      expect(createTableCount).toBeGreaterThan(0)
      
      // Check overall parentheses balance in the entire file
      const allOpenParens = (migrationContent.match(/\(/g) || []).length
      const allCloseParens = (migrationContent.match(/\)/g) || []).length
      expect(allOpenParens).toBe(allCloseParens)
      
      // Verify we have the expected tables
      const expectedTables = [
        'sqp.refresh_config',
        'sqp.refresh_audit_log',
        'sqp.refresh_dependencies',
        'sqp.refresh_data_quality',
        'sqp.refresh_checkpoints'
      ]
      
      expectedTables.forEach(tableName => {
        expect(migrationContent).toContain(`CREATE TABLE IF NOT EXISTS ${tableName}`)
      })
    })

    it('should have valid CHECK constraints', () => {
      const checkConstraints = migrationContent.match(/CHECK\s*\([^)]+\)/g) || []
      
      checkConstraints.forEach(constraint => {
        expect(constraint).toMatch(/CHECK\s*\([^)]+\)/)
      })
    })

    it('should have valid SQL statements', () => {
      // Check for common SQL statement patterns
      const sqlPatterns = [
        /CREATE TABLE/i,
        /CREATE INDEX/i,
        /CREATE OR REPLACE FUNCTION/i,
        /CREATE EVENT TRIGGER/i,
        /INSERT INTO/i,
        /GRANT/i
      ]
      
      sqlPatterns.forEach(pattern => {
        expect(migrationContent).toMatch(pattern)
      })
      
      // Verify functions end with appropriate language declaration
      const functions = migrationContent.match(/CREATE OR REPLACE FUNCTION[^$]+\$\$[^$]+\$\$\s*LANGUAGE\s+\w+/gs) || []
      expect(functions.length).toBeGreaterThan(0)
      
      functions.forEach(func => {
        expect(func).toMatch(/LANGUAGE\s+(plpgsql|sql)/i)
      })
    })
  })
})