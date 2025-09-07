import { describe, it, expect, beforeEach } from 'vitest';
import { SQPQueryBuilder } from '../queries/sqp-query-builder';
import { DateRange, QueryFilters } from '../types';

describe('SQPQueryBuilder', () => {
  const mockConfig = {
    projectId: 'test-project',
    dataset: 'test_dataset',
    tables: {
      sqpRaw: 'sqp_raw',
      sqpProcessed: 'sqp_processed',
      sqpMetrics: 'sqp_metrics',
    },
  };

  let queryBuilder: SQPQueryBuilder;

  beforeEach(() => {
    queryBuilder = new SQPQueryBuilder(mockConfig);
  });

  describe('Base Queries', () => {
    it('should build basic SQP data query', () => {
      const query = queryBuilder.buildSQPDataQuery().build();
      
      expect(query).toContain('SELECT');
      expect(query).toContain('FROM `test-project.test_dataset.sqp_raw`');
      expect(query).toContain('query');
      expect(query).toContain('impressions');
      expect(query).toContain('clicks');
      expect(query).toContain('purchases');
    });

    it('should build aggregated metrics query', () => {
      const query = queryBuilder.buildAggregatedMetricsQuery();
      
      expect(query).toContain('SUM(impressions)');
      expect(query).toContain('SUM(clicks)');
      expect(query).toContain('SUM(purchases)');
      expect(query).toContain('GROUP BY');
    });

    it('should build keyword performance query', () => {
      const query = queryBuilder.buildKeywordPerformanceQuery();
      
      expect(query).toContain('SAFE_DIVIDE');
      expect(query).toContain('ctr');
      expect(query).toContain('cvr');
      expect(query).toContain('purchase_share');
    });
  });

  describe('Parameterized Queries', () => {
    it('should add date range filters', () => {
      const dateRange: DateRange = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };
      
      const query = queryBuilder
        .buildSQPDataQuery()
        .withDateRange(dateRange)
        .build();
      
      expect(query).toContain('WHERE query_date >= @startDate');
      expect(query).toContain('AND query_date < @endDate');
    });

    it('should add ASIN filters', () => {
      const asins = ['B001234567', 'B007654321'];
      
      const query = queryBuilder
        .buildSQPDataQuery()
        .withASINs(asins)
        .build();
      
      expect(query).toContain('asin IN UNNEST(@asins)');
    });

    it('should add keyword filters', () => {
      const keywords = ['yoga mat', 'exercise mat'];
      
      const query = queryBuilder
        .buildSQPDataQuery()
        .withKeywords(keywords)
        .build();
      
      expect(query).toContain('query IN UNNEST(@keywords)');
    });

    it('should combine multiple filters', () => {
      const filters: QueryFilters = {
        dateRange: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
        asins: ['B001234567'],
        keywords: ['yoga mat'],
        minImpressions: 1000,
      };
      
      const query = queryBuilder
        .buildSQPDataQuery()
        .withFilters(filters)
        .build();
      
      expect(query).toContain('query_date >= @startDate');
      expect(query).toContain('asin IN UNNEST(@asins)');
      expect(query).toContain('query IN UNNEST(@keywords)');
      expect(query).toContain('impressions >= @minImpressions');
    });
  });

  describe('Query Optimization', () => {
    it('should add partition pruning hints', () => {
      const dateRange: DateRange = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };
      
      const query = queryBuilder
        .buildSQPDataQuery()
        .withDateRange(dateRange)
        .withPartitionPruning()
        .build();
      
      expect(query).toContain('_PARTITIONDATE');
    });

    it('should add clustering hints for ASIN queries', () => {
      const query = queryBuilder
        .buildSQPDataQuery()
        .withASINs(['B001234567'])
        .withClusteringHints()
        .build();
      
      expect(query).toContain('/* +cluster_filter_on_asin */');
    });

    it('should optimize for large result sets', () => {
      // Build a query with aggregation functions first
      queryBuilder.reset();
      queryBuilder.query = `
        SELECT query, COUNT(*) as count, SUM(impressions) as total
        FROM test_table
        GROUP BY query
      `;
      
      const query = queryBuilder.withLargeResultOptimization().build();
      
      expect(query).toContain('APPROX_COUNT_DISTINCT');
      expect(query).toContain('APPROX_TOP_COUNT');
    });
  });

  describe('Incremental Queries', () => {
    it('should build incremental extraction query', () => {
      const lastProcessedTime = '2024-01-15T10:00:00Z';
      
      const query = queryBuilder
        .buildIncrementalQuery(lastProcessedTime)
        .build();
      
      expect(query).toContain('WHERE updated_at > @lastProcessedTime');
      expect(query).toContain('ORDER BY updated_at ASC');
    });

    it('should handle watermark-based incremental extraction', () => {
      const watermark = {
        column: 'query_date',
        value: '2024-01-15',
      };
      
      const query = queryBuilder
        .buildWatermarkQuery(watermark)
        .build();
      
      expect(query).toContain('WHERE query_date > @watermarkValue');
    });
  });

  describe('Pagination', () => {
    it('should add limit and offset for pagination', () => {
      const query = queryBuilder
        .buildSQPDataQuery()
        .withPagination({ limit: 1000, offset: 5000 })
        .build();
      
      expect(query).toContain('LIMIT 1000');
      expect(query).toContain('OFFSET 5000');
    });

    it('should use cursor-based pagination', () => {
      const cursor = 'eyJsYXN0X2lkIjoxMjM0NX0=';
      
      const query = queryBuilder
        .buildSQPDataQuery()
        .withCursor(cursor)
        .build();
      
      expect(query).toContain('WHERE id > @cursorId');
      expect(query).toContain('ORDER BY id ASC');
    });
  });

  describe('Complex Queries', () => {
    it('should build competitive analysis query', () => {
      const query = queryBuilder.buildCompetitiveAnalysisQuery({
        keywords: ['yoga mat'],
        compareASINs: ['B001234567', 'B007654321'],
      });
      
      expect(query).toContain('RANK() OVER');
      expect(query).toContain('market_share');
      expect(query).toContain('relative_performance');
    });

    it('should build trend analysis query', () => {
      const query = queryBuilder.buildTrendAnalysisQuery({
        metrics: ['impressions', 'clicks', 'purchases'],
        granularity: 'daily',
        periods: 30,
      });
      
      expect(query).toContain('LAG(');
      expect(query).toContain('AVG(impressions) OVER');
      expect(query).toContain('STDDEV(impressions) OVER');
    });

    it('should build keyword discovery query', () => {
      const query = queryBuilder.buildKeywordDiscoveryQuery({
        seedKeywords: ['yoga'],
        minPurchases: 10,
        minCVR: 0.05,
      });
      
      expect(query).toContain('REGEXP_CONTAINS');
      expect(query).toContain('HAVING');
      expect(query).toContain('cvr >= @minCVR');
    });
  });

  describe('Query Validation', () => {
    it('should validate date ranges', () => {
      expect(() =>
        queryBuilder
          .buildSQPDataQuery()
          .withDateRange({
            startDate: '2024-01-31',
            endDate: '2024-01-01', // End before start
          })
          .build()
      ).toThrow('Invalid date range');
    });

    it('should validate ASIN format', () => {
      expect(() =>
        queryBuilder
          .buildSQPDataQuery()
          .withASINs(['invalid-asin'])
          .build()
      ).toThrow('Invalid ASIN format');
    });

    it('should limit result size for safety', () => {
      const query = queryBuilder
        .buildSQPDataQuery()
        .build();
      
      // Should have a default LIMIT if none specified
      expect(query).toMatch(/LIMIT \d+/);
    });
  });
});