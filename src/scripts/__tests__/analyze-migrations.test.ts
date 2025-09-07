import { describe, it, expect, beforeAll, vi } from 'vitest';
import { analyzeMigrations, findDuplicateMigrations, analyzeTableUsage } from '../analyze-migrations';
import fs from 'fs/promises';
import path from 'path';

// Mock the file system
vi.mock('fs/promises');

describe('Migration Analysis', () => {
  describe('analyzeMigrations', () => {
    it('should identify duplicate migration numbers', async () => {
      const mockFiles = [
        '001_create_tables.sql',
        '002_add_indexes.sql',
        '031_add_functions.sql',
        '031_fix_columns.sql',
        '031_add_views.sql',
        '032_update_data.sql'
      ];

      vi.mocked(fs.readdir).mockResolvedValue(mockFiles as any);

      const result = await analyzeMigrations('/mock/path');
      
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].number).toBe('031');
      expect(result.duplicates[0].files).toHaveLength(3);
    });

    it('should detect migration gaps', async () => {
      const mockFiles = [
        '001_create_tables.sql',
        '003_add_indexes.sql',
        '005_add_views.sql'
      ];

      vi.mocked(fs.readdir).mockResolvedValue(mockFiles as any);

      const result = await analyzeMigrations('/mock/path');
      
      expect(result.gaps).toContain(2);
      expect(result.gaps).toContain(4);
    });

    it('should identify sub-lettered migrations', async () => {
      const mockFiles = [
        '023_create_indexes.sql',
        '023a_add_columns.sql',
        '023b_fix_constraints.sql',
        '023c_add_views.sql'
      ];

      vi.mocked(fs.readdir).mockResolvedValue(mockFiles as any);

      const result = await analyzeMigrations('/mock/path');
      
      expect(result.subLettered).toHaveLength(1);
      expect(result.subLettered[0].baseNumber).toBe('023');
      expect(result.subLettered[0].variants).toHaveLength(4);
    });
  });

  describe('findDuplicateMigrations', () => {
    it('should group migrations by number', () => {
      const files = [
        '001_init.sql',
        '002_tables.sql',
        '002_views.sql',
        '003_functions.sql'
      ];

      const duplicates = findDuplicateMigrations(files);
      
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].number).toBe('002');
      expect(duplicates[0].files).toContain('002_tables.sql');
      expect(duplicates[0].files).toContain('002_views.sql');
    });
  });

  describe('analyzeTableUsage', () => {
    it('should identify tables with no data', async () => {
      const mockTables = [
        { schema: 'sqp', name: 'brands', rows: 10 },
        { schema: 'sqp', name: 'report_queue', rows: 0 },
        { schema: 'sqp', name: 'webhook_deliveries', rows: 0 }
      ];

      const result = await analyzeTableUsage(mockTables);
      
      expect(result.emptyTables).toHaveLength(2);
      expect(result.emptyTables).toContainEqual({
        schema: 'sqp',
        name: 'report_queue',
        rows: 0
      });
    });

    it('should categorize tables by usage', async () => {
      const mockTables = [
        { schema: 'sqp', name: 'brands', rows: 100 },
        { schema: 'sqp', name: 'asin_brand_mapping', rows: 83 },
        { schema: 'sqp', name: 'report_templates', rows: 3 },
        { schema: 'sqp', name: 'webhook_configs', rows: 1 }
      ];

      const result = await analyzeTableUsage(mockTables);
      
      expect(result.lowUsageTables).toHaveLength(2); // templates and configs
      expect(result.activeTables).toHaveLength(2); // brands and mappings
    });
  });
});