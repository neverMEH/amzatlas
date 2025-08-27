import { BigQuery, BigQueryOptions, Query, QueryRowsResponse } from '@google-cloud/bigquery';
import { 
  BigQueryError, 
  BigQueryAuthError, 
  BigQueryConnectionError,
  BigQueryQueryError,
  isRetryableError 
} from './errors';

export interface BigQueryConfig {
  projectId: string;
  dataset: string;
  location?: string;
  credentials?: object;
}

export interface BigQueryQueryOptions {
  timeoutMs?: number;
  maxRetries?: number;
  useLegacySql?: boolean;
}

export interface CostEstimate {
  estimatedBytes: number;
  estimatedCostUSD: number;
  cacheHit: boolean;
}

export class BigQueryClient {
  private client: BigQuery | null = null;
  private config: BigQueryConfig;
  private closed = false;

  constructor(config?: Partial<BigQueryConfig>) {
    this.config = this.loadConfiguration(config);
    this.initializeClient();
  }

  private loadConfiguration(config?: Partial<BigQueryConfig>): BigQueryConfig {
    // Load from environment variables
    const envCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!envCredentials && !config?.credentials) {
      throw new BigQueryAuthError(
        'Missing BigQuery credentials. Please set GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable.'
      );
    }

    let credentials: object | undefined;
    if (envCredentials) {
      try {
        credentials = JSON.parse(envCredentials);
      } catch (error) {
        throw new BigQueryAuthError('Invalid JSON in GOOGLE_APPLICATION_CREDENTIALS_JSON');
      }
    }

    return {
      projectId: config?.projectId || process.env.BIGQUERY_PROJECT_ID || '',
      dataset: config?.dataset || process.env.BIGQUERY_DATASET || '',
      location: config?.location || process.env.BIGQUERY_LOCATION || 'US',
      credentials: config?.credentials || credentials,
    };
  }

  private initializeClient(): void {
    try {
      const options: BigQueryOptions = {
        projectId: this.config.projectId,
        credentials: this.config.credentials,
        location: this.config.location,
      };

      this.client = new BigQuery(options);
    } catch (error) {
      throw new BigQueryAuthError(
        `Failed to initialize BigQuery client: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  public getClient(): BigQuery {
    if (this.closed) {
      throw new BigQueryConnectionError('BigQuery client has been closed');
    }
    if (!this.client) {
      throw new BigQueryConnectionError('BigQuery client not initialized');
    }
    return this.client;
  }

  public async testConnection(): Promise<boolean> {
    try {
      const client = this.getClient();
      await client.getDatasets();
      return true;
    } catch (error) {
      console.error('BigQuery connection test failed:', error);
      return false;
    }
  }

  public async query<T = any>(
    query: string,
    params?: Record<string, any>,
    options?: BigQueryQueryOptions
  ): Promise<T[]> {
    // Basic SQL validation
    if (!this.validateSQL(query)) {
      throw new BigQueryQueryError('Invalid SQL query');
    }

    const queryOptions: Query = {
      query,
      location: this.config.location,
      useLegacySql: options?.useLegacySql ?? false,
      ...(params && { params }),
      ...(options?.timeoutMs && { timeoutMs: options.timeoutMs }),
    };

    return this.executeWithRetry<T[]>(
      () => this.executeQuery<T>(queryOptions),
      options?.maxRetries ?? 3
    );
  }

  private async executeQuery<T>(queryOptions: Query): Promise<T[]> {
    try {
      const client = this.getClient();
      const [rows] = await client.query(queryOptions);
      return rows as T[];
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Permission denied')) {
          throw new BigQueryQueryError(`Permission denied: ${error.message}`);
        }
        throw new BigQueryQueryError(`Query execution failed: ${error.message}`);
      }
      throw error;
    }
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    currentRetry = 0
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Error && isRetryableError(error) && currentRetry < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, currentRetry), 10000); // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeWithRetry(operation, maxRetries, currentRetry + 1);
      }
      throw error;
    }
  }

  public async estimateQueryCost(query: string): Promise<CostEstimate> {
    try {
      const client = this.getClient();
      const [job] = await client.createQueryJob({
        query,
        location: this.config.location,
        dryRun: true,
        useLegacySql: false,
      });

      const [metadata] = await job.getMetadata();
      const statistics = metadata.statistics;

      if (!statistics?.query) {
        throw new BigQueryError('Unable to retrieve query statistics');
      }

      const totalBytes = parseInt(statistics.query.totalBytesBilled || '0', 10);
      const costPerTB = 5.0; // $5 per TB for on-demand pricing
      const costUSD = (totalBytes / (1024 ** 4)) * costPerTB;

      return {
        estimatedBytes: totalBytes,
        estimatedCostUSD: parseFloat(costUSD.toFixed(6)),
        cacheHit: statistics.query.cacheHit || false,
      };
    } catch (error) {
      throw new BigQueryError(
        `Failed to estimate query cost: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private validateSQL(query: string): boolean {
    // Basic SQL syntax validation
    const trimmedQuery = query.trim().toLowerCase();
    const validStartKeywords = ['select', 'with', 'insert', 'update', 'delete', 'create', 'drop', 'alter'];
    
    return validStartKeywords.some(keyword => trimmedQuery.startsWith(keyword));
  }

  public async getDataset(datasetId?: string): Promise<any> {
    const client = this.getClient();
    const dataset = client.dataset(datasetId || this.config.dataset);
    const [metadata] = await dataset.getMetadata();
    return metadata;
  }

  public async createDatasetIfNotExists(datasetId?: string): Promise<void> {
    const client = this.getClient();
    const targetDataset = datasetId || this.config.dataset;
    const dataset = client.dataset(targetDataset);

    try {
      const [exists] = await dataset.exists();
      if (!exists) {
        await dataset.create({
          location: this.config.location,
        });
        console.log(`Dataset ${targetDataset} created successfully`);
      }
    } catch (error) {
      throw new BigQueryError(
        `Failed to create dataset: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  public getRawClient(): BigQuery | null {
    return this.client;
  }

  public close(): void {
    this.closed = true;
    this.client = null;
  }
}

// Export a singleton instance for convenience
let defaultClient: BigQueryClient | null = null;

export const getDefaultClient = (config?: Partial<BigQueryConfig>): BigQueryClient => {
  if (!defaultClient) {
    defaultClient = new BigQueryClient(config);
  }
  return defaultClient;
};

export const closeDefaultClient = (): void => {
  if (defaultClient) {
    defaultClient.close();
    defaultClient = null;
  }
};