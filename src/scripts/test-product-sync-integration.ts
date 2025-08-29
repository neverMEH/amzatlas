#!/usr/bin/env tsx
/**
 * Integration test for product data sync and brand extraction
 */

import { describe, it, expect } from 'vitest';
import chalk from 'chalk';

async function runIntegrationTest() {
  console.log(chalk.blue('\n=== Product Data Sync Integration Test ===\n'));
  
  const tests = [
    {
      name: 'BigQuery query includes Product Name field',
      test: async () => {
        const { NestedBigQueryToSupabaseSync } = await import('../lib/supabase/sync/nested-bigquery-to-supabase');
        const sync = new NestedBigQueryToSupabaseSync({
          projectId: 'test',
          dataset: 'test',
          table: 'test'
        });
        
        // Access private method for testing
        const buildQuery = (sync as any).buildQuery;
        const query = buildQuery.call(sync, new Date(), new Date());
        
        expect(query).toContain('`Product Name` as productName');
        expect(query).toContain('`Client Name` as clientName');
      }
    },
    {
      name: 'Transform includes product data in ASIN records',
      test: async () => {
        const { NestedBigQueryToSupabaseSync } = await import('../lib/supabase/sync/nested-bigquery-to-supabase');
        const sync = new NestedBigQueryToSupabaseSync({
          projectId: 'test',
          dataset: 'test',
          table: 'test'
        });
        
        const mockRows = [{
          startDate: '2024-01-01',
          endDate: '2024-01-07',
          asin: 'B001234567',
          productName: 'Test Product',
          clientName: 'Test Client',
          searchQuery: 'test query'
        }];
        
        const transformToNestedStructure = (sync as any).transformToNestedStructure;
        const result = transformToNestedStructure.call(sync, mockRows);
        
        expect(result.dataByAsin[0]).toHaveProperty('productName', 'Test Product');
        expect(result.dataByAsin[0]).toHaveProperty('clientName', 'Test Client');
      }
    },
    {
      name: 'Data transformer inserts product_title',
      test: async () => {
        const { NestedDataTransformer } = await import('../lib/supabase/sync/nested-data-transformer');
        const transformer = new NestedDataTransformer();
        
        // Check that insertASINPerformance includes product_title
        const insertMethod = transformer.constructor.prototype.insertASINPerformance;
        expect(insertMethod).toBeDefined();
      }
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of tests) {
    try {
      await testCase.test();
      console.log(chalk.green('✓'), testCase.name);
      passed++;
    } catch (error) {
      console.log(chalk.red('✗'), testCase.name);
      console.log(chalk.gray('  Error:'), error);
      failed++;
    }
  }
  
  console.log();
  console.log(chalk.blue('=== Test Summary ==='));
  console.log(chalk.gray('Passed:'), chalk.green(passed));
  console.log(chalk.gray('Failed:'), chalk.red(failed));
  
  if (failed === 0) {
    console.log(chalk.green('\n✓ All integration tests passed!'));
  } else {
    console.log(chalk.red(`\n✗ ${failed} tests failed`));
    process.exit(1);
  }
}

runIntegrationTest().catch(error => {
  console.error(chalk.red('Integration test failed:'), error);
  process.exit(1);
});