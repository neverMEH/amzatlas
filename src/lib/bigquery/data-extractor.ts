import { BigQueryClient } from './client';

export interface ExtractOptions {
  startDate: Date;
  endDate: Date;
  batchSize?: number;
  asins?: string[];
  keywords?: string[];
  incremental?: boolean;
}

export interface ExtractResult {
  data: any[];
  metadata: {
    recordCount: number;
    lastOffset?: number;
    lastDataTimestamp?: Date;
  };
}

export class DataExtractor {
  private client: BigQueryClient;

  constructor(client: BigQueryClient) {
    this.client = client;
  }

  async extract(options: ExtractOptions): Promise<ExtractResult> {
    const {
      startDate,
      endDate,
      batchSize = 5000,
      asins,
      keywords,
      incremental = false
    } = options;

    try {
      // Build the extraction query
      let query = `
        SELECT 
          date,
          asin,
          keyword,
          impressions,
          clicks,
          purchases,
          click_through_rate,
          conversion_rate
        FROM \`${process.env.BIGQUERY_PROJECT_ID}.${process.env.BIGQUERY_DATASET}.sqp_raw_data\`
        WHERE date >= @startDate
          AND date <= @endDate
      `;

      const queryParams: any = {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      };

      // Add ASIN filter if provided
      if (asins && asins.length > 0) {
        query += ` AND asin IN UNNEST(@asins)`;
        queryParams.asins = asins;
      }

      // Add keyword filter if provided
      if (keywords && keywords.length > 0) {
        query += ` AND LOWER(keyword) IN UNNEST(@keywords)`;
        queryParams.keywords = keywords.map(k => k.toLowerCase());
      }

      // Add ordering for consistent results
      query += ` ORDER BY date DESC, asin, keyword`;

      // Add limit for batch processing
      if (batchSize) {
        query += ` LIMIT ${batchSize}`;
      }

      // Execute the query
      const results = await this.client.query(query, queryParams);

      // Transform BigQuery results to our format
      const data = results.map(row => ({
        date: row.date,
        asin: row.asin,
        keyword: row.keyword,
        impressions: row.impressions || 0,
        clicks: row.clicks || 0,
        purchases: row.purchases || 0,
        click_through_rate: row.click_through_rate || 0,
        conversion_rate: row.conversion_rate || 0
      }));

      // Calculate metadata
      const timestamps = data
        .map(r => r.date)
        .filter(Boolean)
        .map(d => new Date(d));

      const lastDataTimestamp = timestamps.length > 0
        ? new Date(Math.max(...timestamps.map(t => t.getTime())))
        : undefined;

      return {
        data,
        metadata: {
          recordCount: data.length,
          lastDataTimestamp
        }
      };

    } catch (error) {
      console.error('Data extraction failed:', error);
      throw new Error(`Failed to extract data: ${(error as Error).message}`);
    }
  }

  async extractIncremental(lastTimestamp: Date, options: Omit<ExtractOptions, 'startDate'>): Promise<ExtractResult> {
    return this.extract({
      ...options,
      startDate: lastTimestamp,
      incremental: true
    });
  }
}