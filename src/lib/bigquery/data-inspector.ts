import { BigQueryConnectionPool } from './connection-pool';
import { BigQueryClient } from './client';
import { format } from 'date-fns';
import {
  TableField,
  ASINDistribution,
  DataQualityComparison,
  SamplingStrategy,
  InspectionConfig,
  InspectionReport,
  DataStructureValidation,
  DataQualityMetrics,
} from './types';

export class BigQueryDataInspector {
  private pool: BigQueryConnectionPool;

  constructor(pool: BigQueryConnectionPool) {
    this.pool = pool;
  }

  /**
   * Inspect table schema
   */
  async inspectTableSchema(tableName: string): Promise<TableField[]> {
    const client = await this.pool.acquire();
    
    try {
      const [projectId, datasetId, tableId] = tableName.split('.');
      const dataset = client.dataset(datasetId);
      const table = dataset.table(tableId);
      
      const [metadata] = await table.getMetadata();
      return metadata.schema?.fields || [];
    } finally {
      this.pool.release(client);
    }
  }

  /**
   * Analyze ASIN distribution for a given query
   */
  async analyzeASINDistribution(
    tableName: string,
    query: string,
    startDate: Date,
    endDate: Date
  ): Promise<ASINDistribution> {
    const client = await this.pool.acquire();
    
    try {
      const dateStart = format(startDate, 'yyyy-MM-dd');
      const dateEnd = format(endDate, 'yyyy-MM-dd');
      
      const sql = `
        WITH asin_stats AS (
          SELECT
            asin,
            COUNT(*) as count,
            SUM(impressions) as impressions,
            SUM(clicks) as clicks,
            SUM(purchases) as purchases
          FROM \`${tableName}\`
          WHERE query = @query
            AND DATE(query_date) BETWEEN @startDate AND @endDate
          GROUP BY asin
          ORDER BY impressions DESC
        ),
        daily_stats AS (
          SELECT
            DATE(query_date) as date,
            COUNT(DISTINCT asin) as daily_asins
          FROM \`${tableName}\`
          WHERE query = @query
            AND DATE(query_date) BETWEEN @startDate AND @endDate
          GROUP BY date
        )
        SELECT
          (SELECT COUNT(DISTINCT asin) FROM asin_stats) as total_asins,
          (SELECT AVG(daily_asins) FROM daily_stats) as avg_asins_per_day,
          (SELECT APPROX_QUANTILES(impressions, 2)[OFFSET(1)] FROM asin_stats) as median_impressions,
          (SELECT SUM(impressions) FROM asin_stats) as total_impressions,
          (SELECT SUM(clicks) FROM asin_stats) as total_clicks,
          (SELECT SUM(purchases) FROM asin_stats) as total_purchases,
          ARRAY_AGG(
            STRUCT(
              asin,
              count,
              impressions,
              clicks,
              purchases,
              ROW_NUMBER() OVER (ORDER BY impressions DESC) as rank
            )
            ORDER BY impressions DESC
            LIMIT 100
          ) as top_asins
        FROM asin_stats
      `;

      const options = {
        query: sql,
        params: {
          query,
          startDate: dateStart,
          endDate: dateEnd,
        },
      };

      const [rows] = await client.query(options);
      const result = rows[0] || {};

      return {
        query,
        totalASINs: result.total_asins || 0,
        dateRange: { start: startDate, end: endDate },
        topASINs: (result.top_asins || []).map((asin: any) => ({
          asin: asin.asin,
          count: asin.count,
          impressions: asin.impressions,
          clicks: asin.clicks,
          purchases: asin.purchases,
          rank: asin.rank,
        })),
        metrics: {
          avgASINsPerDay: result.avg_asins_per_day || 0,
          medianImpressions: result.median_impressions || 0,
          totalImpressions: result.total_impressions || 0,
          totalClicks: result.total_clicks || 0,
          totalPurchases: result.total_purchases || 0,
        },
      };
    } finally {
      this.pool.release(client);
    }
  }

  /**
   * Compare data quality between BigQuery and Supabase
   */
  async compareDataQuality(
    bigqueryTable: string,
    supabaseData: { total_rows: number; distinct_queries: number; distinct_asins: number },
    startDate: Date,
    endDate: Date
  ): Promise<DataQualityComparison> {
    const client = await this.pool.acquire();
    
    try {
      const dateStart = format(startDate, 'yyyy-MM-dd');
      const dateEnd = format(endDate, 'yyyy-MM-dd');
      
      const sql = `
        SELECT
          COUNT(*) as total_rows,
          COUNT(DISTINCT query) as distinct_queries,
          COUNT(DISTINCT asin) as distinct_asins
        FROM \`${bigqueryTable}\`
        WHERE DATE(query_date) BETWEEN @startDate AND @endDate
      `;

      const options = {
        query: sql,
        params: {
          startDate: dateStart,
          endDate: dateEnd,
        },
      };

      const [rows] = await client.query(options);
      const bqData = rows[0] || { total_rows: 0, distinct_queries: 0, distinct_asins: 0 };

      const rowCountDiff = Math.abs(bqData.total_rows - supabaseData.total_rows);
      const asinCountDiff = Math.abs(bqData.distinct_asins - supabaseData.distinct_asins);

      return {
        bigquery: {
          totalRows: bqData.total_rows,
          distinctQueries: bqData.distinct_queries,
          distinctASINs: bqData.distinct_asins,
        },
        supabase: {
          totalRows: supabaseData.total_rows,
          distinctQueries: supabaseData.distinct_queries,
          distinctASINs: supabaseData.distinct_asins,
        },
        discrepancies: {
          rowCountDiff,
          rowCountDiffPercent: bqData.total_rows > 0 
            ? (rowCountDiff / bqData.total_rows) * 100 
            : 0,
          queryCountDiff: Math.abs(bqData.distinct_queries - supabaseData.distinct_queries),
          asinCountDiff,
          asinCountDiffPercent: bqData.distinct_asins > 0
            ? (asinCountDiff / bqData.distinct_asins) * 100
            : 0,
        },
        quality: {
          dataCompleteness: supabaseData.total_rows / bqData.total_rows * 100,
          schemaConsistency: true, // Would need actual schema comparison
          hasDiscrepancies: rowCountDiff > 0 || asinCountDiff > 0,
        },
      };
    } finally {
      this.pool.release(client);
    }
  }

  /**
   * Generate different sampling strategies
   */
  generateSamplingStrategies(distribution: ASINDistribution): Record<string, SamplingStrategy> {
    const { totalASINs, topASINs } = distribution;
    
    return {
      all: {
        name: 'All ASINs',
        description: `Include all ${totalASINs} ASINs`,
        estimatedRows: distribution.metrics.totalImpressions,
        asins: null,
      },
      top1: {
        name: 'Top ASIN Only',
        description: 'Only the #1 ASIN by impressions',
        estimatedRows: topASINs[0]?.impressions || 0,
        asins: topASINs.slice(0, 1).map(a => a.asin),
      },
      top5: {
        name: 'Top 5 ASINs',
        description: 'Top 5 ASINs by impressions',
        estimatedRows: topASINs.slice(0, 5).reduce((sum, a) => sum + a.impressions, 0),
        asins: topASINs.slice(0, 5).map(a => a.asin),
      },
      top10: {
        name: 'Top 10 ASINs',
        description: 'Top 10 ASINs by impressions',
        estimatedRows: topASINs.slice(0, 10).reduce((sum, a) => sum + a.impressions, 0),
        asins: topASINs.slice(0, 10).map(a => a.asin),
      },
      representative: {
        name: 'Representative Sample',
        description: 'Statistically representative sample (10%)',
        estimatedRows: Math.ceil(distribution.metrics.totalImpressions * 0.1),
        asins: this.selectRepresentativeSample(topASINs, Math.ceil(totalASINs * 0.1)),
      },
    };
  }

  /**
   * Generate comprehensive inspection report
   */
  async generateInspectionReport(config: InspectionConfig): Promise<InspectionReport> {
    const schemas: Record<string, TableField[]> = {};
    const distributions: Record<string, ASINDistribution> = {};
    const samplingStrategies: Record<string, Record<string, SamplingStrategy>> = {};
    const recommendations: string[] = [];

    // Inspect schemas
    for (const table of config.tables) {
      try {
        schemas[table] = await this.inspectTableSchema(table);
      } catch (error) {
        console.error(`Failed to inspect schema for ${table}:`, error);
        recommendations.push(`Unable to inspect schema for ${table}. Check table permissions.`);
      }
    }

    // Analyze distributions
    for (const query of config.queries) {
      const key = query.replace(/\s+/g, '_').toLowerCase();
      try {
        distributions[key] = await this.analyzeASINDistribution(
          config.tables[0], // Assuming first table is the main source
          query,
          config.dateRange.start,
          config.dateRange.end
        );
        
        samplingStrategies[key] = this.generateSamplingStrategies(distributions[key]);
        
        // Generate recommendations based on distribution
        if (distributions[key].totalASINs > 100) {
          recommendations.push(
            `Query "${query}" has ${distributions[key].totalASINs} ASINs. ` +
            `Consider using Top 10 or Representative sampling for efficient testing.`
          );
        }
        
        if (distributions[key].metrics.avgASINsPerDay < 1) {
          recommendations.push(
            `Query "${query}" has low daily ASIN coverage. ` +
            `Consider expanding date range for better representation.`
          );
        }
      } catch (error) {
        console.error(`Failed to analyze distribution for "${query}":`, error);
      }
    }

    return {
      timestamp: new Date(),
      config,
      schemas,
      distributions,
      samplingStrategies,
      recommendations,
    };
  }

  /**
   * Validate data structure between periods
   */
  async validateDataStructure(
    sourceTable: string,
    targetTable: string,
    query: string,
    startDate: Date,
    endDate: Date
  ): Promise<DataStructureValidation> {
    const client = await this.pool.acquire();
    
    try {
      const dateStart = format(startDate, 'yyyy-MM-dd');
      const dateEnd = format(endDate, 'yyyy-MM-dd');
      
      // Get source data summary
      const sourceSQL = `
        SELECT
          query,
          asin,
          SUM(total_impressions) as impressions
        FROM \`${sourceTable}\`
        WHERE query = @query
          AND period_start >= @startDate
          AND period_start <= @endDate
        GROUP BY query, asin
      `;

      // Get target data summary
      const targetSQL = `
        SELECT
          query,
          asin,
          SUM(total_impressions) as impressions
        FROM \`${targetTable}\`
        WHERE query = @query
          AND ((year = EXTRACT(YEAR FROM DATE(@startDate)) AND month >= EXTRACT(MONTH FROM DATE(@startDate)))
            OR (year = EXTRACT(YEAR FROM DATE(@endDate)) AND month <= EXTRACT(MONTH FROM DATE(@endDate))))
        GROUP BY query, asin
      `;

      const [sourceRows] = await client.query({
        query: sourceSQL,
        params: { query, startDate: dateStart, endDate: dateEnd },
      });

      const [targetRows] = await client.query({
        query: targetSQL,
        params: { query, startDate: dateStart, endDate: dateEnd },
      });

      // Compare results
      const sourceMap = new Map(
        sourceRows.map(r => [`${r.query}-${r.asin}`, r.impressions])
      );
      const targetMap = new Map(
        targetRows.map(r => [`${r.query}-${r.asin}`, r.impressions])
      );

      const issues: string[] = [];
      let matches = 0;
      let mismatches = 0;

      sourceMap.forEach((sourceValue, key) => {
        const targetValue = targetMap.get(key);
        if (!targetValue) {
          issues.push(`Missing in target: ${key}`);
          mismatches++;
        } else if (Math.abs(sourceValue - targetValue) > sourceValue * 0.01) { // 1% tolerance
          issues.push(`Value mismatch for ${key}: source=${sourceValue}, target=${targetValue}`);
          mismatches++;
        } else {
          matches++;
        }
      });

      targetMap.forEach((_, key) => {
        if (!sourceMap.has(key)) {
          issues.push(`Extra in target: ${key}`);
          mismatches++;
        }
      });

      const total = matches + mismatches;

      return {
        isValid: mismatches === 0,
        sourceTable,
        targetTable,
        issues: issues.slice(0, 10), // Limit to first 10 issues
        metrics: {
          matchRate: total > 0 ? (matches / total) * 100 : 0,
          discrepancyRate: total > 0 ? (mismatches / total) * 100 : 0,
        },
      };
    } finally {
      this.pool.release(client);
    }
  }

  /**
   * Helper method to select representative sample of ASINs
   */
  private selectRepresentativeSample(
    topASINs: Array<{ asin: string; impressions: number }>,
    sampleSize: number
  ): string[] {
    if (topASINs.length <= sampleSize) {
      return topASINs.map(a => a.asin);
    }

    // Use stratified sampling based on impression ranges
    const sorted = [...topASINs].sort((a, b) => b.impressions - a.impressions);
    const strataSize = Math.ceil(sorted.length / sampleSize);
    const sample: string[] = [];

    for (let i = 0; i < sampleSize && i * strataSize < sorted.length; i++) {
      const index = i * strataSize;
      sample.push(sorted[index].asin);
    }

    return sample;
  }

  /**
   * Analyze data completeness
   */
  async analyzeDataCompleteness(
    tableName: string,
    startDate: Date,
    endDate: Date
  ): Promise<DataQualityMetrics> {
    const client = await this.pool.acquire();
    
    try {
      const dateStart = format(startDate, 'yyyy-MM-dd');
      const dateEnd = format(endDate, 'yyyy-MM-dd');
      
      const sql = `
        SELECT
          COUNT(*) as total_records,
          COUNT(query) as non_null_query,
          COUNT(asin) as non_null_asin,
          COUNT(impressions) as non_null_impressions,
          COUNT(clicks) as non_null_clicks,
          COUNT(purchases) as non_null_purchases,
          COUNT(DISTINCT CONCAT(query, '-', asin, '-', DATE(query_date))) as unique_records
        FROM \`${tableName}\`
        WHERE DATE(query_date) BETWEEN @startDate AND @endDate
      `;

      const options = {
        query: sql,
        params: {
          startDate: dateStart,
          endDate: dateEnd,
        },
      };

      const [rows] = await client.query(options);
      const result = rows[0] || {};

      const totalFields = 5; // query, asin, impressions, clicks, purchases
      const totalPossibleValues = result.total_records * totalFields;
      const actualNonNullValues = 
        result.non_null_query +
        result.non_null_asin +
        result.non_null_impressions +
        result.non_null_clicks +
        result.non_null_purchases;

      return {
        completeness: totalPossibleValues > 0 
          ? actualNonNullValues / totalPossibleValues 
          : 0,
        nullValueCounts: {
          query: result.total_records - result.non_null_query,
          asin: result.total_records - result.non_null_asin,
          impressions: result.total_records - result.non_null_impressions,
          clicks: result.total_records - result.non_null_clicks,
          purchases: result.total_records - result.non_null_purchases,
        },
        duplicateCount: result.total_records - result.unique_records,
        uniqueRecords: result.unique_records,
      };
    } finally {
      this.pool.release(client);
    }
  }
}