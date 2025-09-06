import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  consolidateMigrations,
  renumberMigrations,
  validateMigrationContent,
  mergeMigrationFiles
} from '../consolidate-migrations';
import fs from 'fs/promises';

vi.mock('fs/promises');

describe('Migration Consolidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('consolidateMigrations', () => {
    it('should consolidate multiple migrations with same number', async () => {
      const duplicates = [
        {
          number: '031',
          files: [
            '031_add_keyword_analysis_functions.sql',
            '031_add_refresh_infrastructure.sql',
            '031_fix_asin_column_simple.sql'
          ]
        }
      ];

      const mockContents = {
        '031_add_keyword_analysis_functions.sql': '-- Keyword functions\nCREATE FUNCTION keyword_analysis();',
        '031_add_refresh_infrastructure.sql': '-- Refresh tables\nCREATE TABLE refresh_config();',
        '031_fix_asin_column_simple.sql': '-- Fix ASIN\nALTER TABLE asin ALTER COLUMN asin TYPE VARCHAR(20);'
      };

      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        const filename = path.toString().split('/').pop();
        return mockContents[filename] || '';
      });

      const result = await consolidateMigrations(duplicates, '/mock/path');
      
      expect(result).toHaveLength(1);
      expect(result[0].number).toBe('031');
      expect(result[0].consolidatedContent).toContain('-- Keyword functions');
      expect(result[0].consolidatedContent).toContain('-- Refresh tables');
      expect(result[0].consolidatedContent).toContain('-- Fix ASIN');
    });

    it('should handle ASIN column fix migrations specially', async () => {
      const duplicates = [
        {
          number: '031',
          files: [
            '031_fix_asin_column_corrected.sql',
            '031_fix_asin_column_final_safe.sql',
            '031_fix_asin_column_simple.sql'
          ]
        }
      ];

      const result = await consolidateMigrations(duplicates, '/mock/path');
      
      expect(result[0].filesToRemove).toHaveLength(2); // Keep only one ASIN fix
      expect(result[0].name).toContain('fix_asin_column');
    });
  });

  describe('renumberMigrations', () => {
    it('should assign sequential numbers starting from given number', () => {
      const files = [
        '025_add_post_sync_brand_extraction.sql',
        '025_create_rolling_average_views.sql',
        '026_create_anomaly_detection_functions.sql',
        '026_create_public_views_for_sqp_tables.sql'
      ];

      const result = renumberMigrations(files, 36);
      
      expect(result).toEqual([
        { old: '025_add_post_sync_brand_extraction.sql', new: '036_add_post_sync_brand_extraction.sql' },
        { old: '025_create_rolling_average_views.sql', new: '037_create_rolling_average_views.sql' },
        { old: '026_create_anomaly_detection_functions.sql', new: '038_create_anomaly_detection_functions.sql' },
        { old: '026_create_public_views_for_sqp_tables.sql', new: '039_create_public_views_for_sqp_tables.sql' }
      ]);
    });

    it('should handle sub-lettered migrations', () => {
      const files = [
        '023_create_brand_optimization_indexes.sql',
        '023a_add_missing_columns_and_fix_indexes.sql',
        '023b_create_remaining_indexes.sql',
        '023c_create_brand_performance_views.sql'
      ];

      const result = renumberMigrations(files, 23);
      
      // Sub-lettered migrations should keep their sequence
      expect(result).toHaveLength(0); // No renumbering needed for properly sequenced sub-letters
    });
  });

  describe('validateMigrationContent', () => {
    it('should detect conflicting DDL statements', () => {
      const content = `
        CREATE TABLE test_table (id INT);
        DROP TABLE test_table;
        CREATE TABLE test_table (id BIGINT);
      `;

      const issues = validateMigrationContent(content);
      
      expect(issues).toContain('Multiple CREATE TABLE statements for test_table');
    });

    it('should detect missing IF NOT EXISTS clauses', () => {
      const content = `
        CREATE TABLE test_table (id INT);
        CREATE INDEX idx_test ON test_table(id);
      `;

      const issues = validateMigrationContent(content);
      
      expect(issues).toContain('CREATE TABLE without IF NOT EXISTS');
      expect(issues).toContain('CREATE INDEX without IF NOT EXISTS');
    });

    it('should validate clean migration content', () => {
      const content = `
        CREATE TABLE IF NOT EXISTS test_table (id INT);
        CREATE INDEX IF NOT EXISTS idx_test ON test_table(id);
      `;

      const issues = validateMigrationContent(content);
      
      expect(issues).toHaveLength(0);
    });
  });

  describe('mergeMigrationFiles', () => {
    it('should merge migration contents with proper sections', () => {
      const contents = [
        { file: '031_add_functions.sql', content: '-- Add functions\nCREATE FUNCTION test();' },
        { file: '031_add_tables.sql', content: '-- Add tables\nCREATE TABLE test();' }
      ];

      const merged = mergeMigrationFiles(contents);
      
      expect(merged).toContain('-- Section from: 031_add_functions.sql');
      expect(merged).toContain('-- Section from: 031_add_tables.sql');
      expect(merged).toContain('-- Add functions');
      expect(merged).toContain('-- Add tables');
    });

    it('should add header with consolidation info', () => {
      const contents = [
        { file: 'test1.sql', content: 'SELECT 1;' },
        { file: 'test2.sql', content: 'SELECT 2;' }
      ];

      const merged = mergeMigrationFiles(contents);
      
      expect(merged).toContain('-- Consolidated migration');
      expect(merged).toContain('-- Combined from:');
      expect(merged).toContain('--   - test1.sql');
      expect(merged).toContain('--   - test2.sql');
    });
  });
});