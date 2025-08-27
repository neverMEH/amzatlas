import { BigQueryConnectionPool } from '../connection-pool';
import { SQPQueryBuilder } from '../queries/sqp-query-builder';
import { DataValidator } from '../validators/data-validator';
import {
  SQPRecord,
  ExtractionResult,
  QueryFilters,
  StreamingOptions,
  IncrementalOptions,
  WatermarkOptions,
  ExtractionState,
  QueryOptions,
  DateRange,
  ProgressInfo,
} from '../types';
import { CostEstimate } from '../client';
import { getBigQueryConfig, getTableNames, getFullTableName } from '@/config/bigquery.config';
import { BigQueryError } from '../errors';

export class SQPDataExtractor {
  private pool: BigQueryConnectionPool;
  private queryBuilder: SQPQueryBuilder;
  private validator: DataValidator;
  private extractionStates: Map<string, ExtractionState> = new Map();
  
  constructor(pool: BigQueryConnectionPool) {
    this.pool = pool;
    const bigqueryConfig = getBigQueryConfig();
    const tables = getTableNames();
    this.queryBuilder = new SQPQueryBuilder({
      projectId: bigqueryConfig.projectId,
      dataset: bigqueryConfig.dataset,
      tables: {
        sqpRaw: tables.sqpRaw,
        sqpProcessed: tables.sqpProcessed,
        sqpMetrics: tables.sqpMetrics,
      },
    });
    this.validator = new DataValidator();
  }

  /**
   * Extract SQP data with filters
   */
  async extractSQPData(
    filters: QueryFilters & QueryOptions = {}
  ): Promise<ExtractionResult<SQPRecord>> {
    const startTime = Date.now();
    const errors: any[] = [];
    
    try {
      // Build query
      const query = this.queryBuilder
        .reset()
        .buildSQPDataQuery()
        .withFilters(filters)
        .build();
      
      const parameters = this.queryBuilder.getParameters();
      
      // Execute query
      const data = await this.pool.withClient(async (client) => {
        return client.query<SQPRecord>(query, parameters);
      });
      
      // Validate data if requested
      let validatedData = data;
      let validationErrors: any[] = [];
      
      if (filters.validateData) {
        const validationResult = this.validator.validateBatch(data);
        validationErrors = validationResult.errors;
        
        if (filters.strictValidation) {
          // Filter out invalid records
          validatedData = data.filter((_, index) => 
            !validationResult.errors.some(error => error.index === index)
          );
        }
      }
      
      return {
        data: validatedData,
        recordCount: validatedData.length,
        executionTimeMs: Date.now() - startTime,
        validationErrors,
        metadata: {
          query,
          parameters,
          originalCount: data.length,
        },
      };
    } catch (error) {
      throw this.enhanceError(error as Error, {
        operation: 'extractSQPData',
        filters,
      });
    }
  }

  /**
   * Stream large datasets with progress tracking
   */
  async streamSQPData(
    filters: QueryFilters,
    options: StreamingOptions
  ): Promise<void> {
    const batchSize = options.batchSize || 1000;
    let offset = 0;
    let hasMore = true;
    let totalProcessed = 0;
    let totalEstimate = await this.estimateRecordCount(filters);
    
    try {
      while (hasMore) {
        const batchResult = await this.extractSQPData({
          ...filters,
          pagination: { limit: batchSize, offset },
        });
        
        if (batchResult.data.length === 0) {
          hasMore = false;
          break;
        }
        
        // Process batch
        try {
          await options.onData(batchResult.data);
        } catch (error) {
          if (options.onError) {
            options.onError(error as Error);
          } else {
            throw error;
          }
        }
        
        totalProcessed += batchResult.data.length;
        offset += batchSize;
        
        // Report progress
        if (options.onProgress) {
          const progress: ProgressInfo = {
            processed: totalProcessed,
            total: totalEstimate,
            percentage: totalEstimate > 0 ? (totalProcessed / totalEstimate) * 100 : 0,
            currentBatch: Math.floor(totalProcessed / batchSize),
          };
          options.onProgress(progress);
        }
        
        // Check if we got a full batch
        hasMore = batchResult.data.length === batchSize;
      }
    } catch (error) {
      if (options.onError) {
        options.onError(error as Error);
      } else {
        throw error;
      }
    }
  }

  /**
   * Extract data incrementally based on timestamp
   */
  async extractIncremental(
    options: IncrementalOptions
  ): Promise<ExtractionResult<SQPRecord> & { newWatermark?: string }> {
    const column = options.column || 'updated_at';
    
    try {
      const query = this.queryBuilder
        .reset()
        .buildIncrementalQuery(options.lastProcessedTime!)
        .build();
      
      const parameters = this.queryBuilder.getParameters();
      
      const data = await this.pool.withClient(async (client) => {
        return client.query<SQPRecord>(query, parameters);
      });
      
      // Calculate new watermark
      let newWatermark: string | undefined;
      if (data.length > 0) {
        const timestamps = data.map(record => record[column as keyof SQPRecord]);
        newWatermark = timestamps.sort().pop() as string;
      }
      
      return {
        data,
        recordCount: data.length,
        newWatermark,
        metadata: {
          incrementalColumn: column,
          lastProcessedTime: options.lastProcessedTime,
        },
      };
    } catch (error) {
      throw this.enhanceError(error as Error, {
        operation: 'extractIncremental',
        options,
      });
    }
  }

  /**
   * Extract data using watermark
   */
  async extractWithWatermark(
    options: WatermarkOptions
  ): Promise<ExtractionResult<SQPRecord>> {
    try {
      const query = this.queryBuilder
        .reset()
        .buildWatermarkQuery({
          column: options.watermarkColumn,
          value: options.lastWatermark,
        })
        .build();
      
      const parameters = this.queryBuilder.getParameters();
      
      const data = await this.pool.withClient(async (client) => {
        return client.query<SQPRecord>(query, parameters);
      });
      
      return {
        data,
        recordCount: data.length,
        metadata: {
          watermarkColumn: options.watermarkColumn,
          lastWatermark: options.lastWatermark,
        },
      };
    } catch (error) {
      throw this.enhanceError(error as Error, {
        operation: 'extractWithWatermark',
        options,
      });
    }
  }

  /**
   * Get extraction state for tracking
   */
  async getExtractionState(extractionId: string): Promise<ExtractionState> {
    // In a real implementation, this would be persisted to a database
    const state = this.extractionStates.get(extractionId);
    
    if (!state) {
      return {
        id: extractionId,
        recordsProcessed: 0,
        status: 'idle',
      };
    }
    
    return state;
  }

  /**
   * Update extraction state
   */
  async updateExtractionState(
    extractionId: string,
    updates: Partial<ExtractionState>
  ): Promise<void> {
    const currentState = await this.getExtractionState(extractionId);
    
    this.extractionStates.set(extractionId, {
      ...currentState,
      ...updates,
      id: extractionId,
    });
  }

  /**
   * Estimate extraction cost
   */
  async estimateExtractionCost(
    filters: QueryFilters
  ): Promise<CostEstimate & { estimatedRecords: number }> {
    try {
      const query = this.queryBuilder
        .reset()
        .buildSQPDataQuery()
        .withFilters(filters)
        .build();
      
      const costEstimate = await this.pool.withClient(async (client) => {
        return client.estimateQueryCost(query);
      });
      
      // Estimate record count based on bytes
      const avgBytesPerRecord = 200; // Approximate
      const estimatedRecords = Math.floor(costEstimate.estimatedBytes / avgBytesPerRecord);
      
      return {
        ...costEstimate,
        estimatedRecords,
      };
    } catch (error) {
      throw this.enhanceError(error as Error, {
        operation: 'estimateExtractionCost',
        filters,
      });
    }
  }

  /**
   * Extract data for multiple ASINs in batches
   */
  async extractBatchedASINs(
    asins: string[],
    dateRange: DateRange,
    batchSize = 50
  ): Promise<ExtractionResult<SQPRecord>> {
    const results: SQPRecord[] = [];
    const errors: any[] = [];
    let totalBytes = 0;
    const startTime = Date.now();
    
    // Process ASINs in batches
    for (let i = 0; i < asins.length; i += batchSize) {
      const batch = asins.slice(i, i + batchSize);
      
      try {
        const batchResult = await this.extractSQPData({
          dateRange,
          asins: batch,
          optimizePartitions: true,
        });
        
        results.push(...batchResult.data);
        totalBytes += batchResult.bytesProcessed || 0;
      } catch (error) {
        errors.push({
          batch: i / batchSize,
          asins: batch,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    return {
      data: results,
      recordCount: results.length,
      executionTimeMs: Date.now() - startTime,
      bytesProcessed: totalBytes,
      metadata: {
        totalBatches: Math.ceil(asins.length / batchSize),
        errors,
      },
    };
  }

  /**
   * Perform competitive analysis extraction
   */
  async extractCompetitiveAnalysis(
    keywords: string[],
    compareASINs: string[],
    dateRange?: DateRange
  ): Promise<ExtractionResult<any>> {
    try {
      const query = this.queryBuilder
        .reset()
        .buildCompetitiveAnalysisQuery({
          keywords,
          compareASINs,
          dateRange,
        });
      
      const parameters = {
        keywords,
        compareASINs,
        ...(dateRange && {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }),
      };
      
      const data = await this.pool.withClient(async (client) => {
        return client.query(query, parameters);
      });
      
      return {
        data,
        recordCount: data.length,
        metadata: {
          analysisType: 'competitive',
          keywords,
          compareASINs,
        },
      };
    } catch (error) {
      throw this.enhanceError(error as Error, {
        operation: 'extractCompetitiveAnalysis',
        keywords,
        compareASINs,
      });
    }
  }

  /**
   * Extract trend analysis data
   */
  async extractTrendAnalysis(
    metrics: string[],
    granularity: 'daily' | 'weekly' | 'monthly',
    periods = 30,
    dateRange?: DateRange
  ): Promise<ExtractionResult<any>> {
    try {
      const query = this.queryBuilder
        .reset()
        .buildTrendAnalysisQuery({
          metrics,
          granularity,
          periods,
          dateRange,
        });
      
      const parameters = dateRange ? {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      } : {};
      
      const data = await this.pool.withClient(async (client) => {
        return client.query(query, parameters);
      });
      
      return {
        data,
        recordCount: data.length,
        metadata: {
          analysisType: 'trend',
          metrics,
          granularity,
          periods,
        },
      };
    } catch (error) {
      throw this.enhanceError(error as Error, {
        operation: 'extractTrendAnalysis',
        metrics,
        granularity,
      });
    }
  }

  /**
   * Discover related keywords
   */
  async discoverKeywords(
    seedKeywords: string[],
    minPurchases = 10,
    minCVR = 0.05,
    maxResults = 100
  ): Promise<ExtractionResult<any>> {
    try {
      const query = this.queryBuilder
        .reset()
        .buildKeywordDiscoveryQuery({
          seedKeywords,
          minPurchases,
          minCVR,
          maxResults,
        });
      
      const parameters = {
        seedKeywords,
        minPurchases,
        minCVR,
      };
      
      const data = await this.pool.withClient(async (client) => {
        return client.query(query, parameters);
      });
      
      return {
        data,
        recordCount: data.length,
        metadata: {
          discoveryType: 'keyword',
          seedKeywords,
          filters: { minPurchases, minCVR },
        },
      };
    } catch (error) {
      throw this.enhanceError(error as Error, {
        operation: 'discoverKeywords',
        seedKeywords,
      });
    }
  }

  /**
   * Private helper methods
   */
  private async estimateRecordCount(filters: QueryFilters): Promise<number> {
    try {
      const countQuery = `
        SELECT COUNT(*) as count
        FROM ${getFullTableName('sqpRaw')}
        WHERE TRUE
          ${filters.dateRange ? 'AND query_date >= @startDate AND query_date < @endDate' : ''}
          ${filters.asins ? 'AND asin IN UNNEST(@asins)' : ''}
          ${filters.keywords ? 'AND query IN UNNEST(@keywords)' : ''}
      `;
      
      const result = await this.pool.withClient(async (client) => {
        return client.query<{ count: number }>(countQuery, this.queryBuilder.getParameters());
      });
      
      return result[0]?.count || 0;
    } catch (error) {
      // If count fails, return 0 (unknown)
      return 0;
    }
  }

  private enhanceError(error: Error, context: any): BigQueryError {
    const enhancedError = new BigQueryError(
      error.message,
      'EXTRACTION_ERROR',
      {
        originalError: error,
        context,
        timestamp: new Date().toISOString(),
      }
    );
    
    // Extract query error details if available
    if (error.message.includes('at line')) {
      const match = error.message.match(/at line (\d+)/);
      if (match) {
        enhancedError.details.line = parseInt(match[1], 10);
      }
    }
    
    return enhancedError;
  }
}