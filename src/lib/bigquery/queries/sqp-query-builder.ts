import {
  QueryConfig,
  QueryFilters,
  DateRange,
  PaginationOptions,
  CompetitiveAnalysisParams,
  TrendAnalysisParams,
  KeywordDiscoveryParams,
} from '../types';

export class SQPQueryBuilder {
  private config: QueryConfig;
  public query: string = '';
  private parameters: Record<string, any> = {};
  private conditions: string[] = [];
  private defaultLimit = 10000;

  constructor(config: QueryConfig) {
    this.config = config;
  }

  // Base query methods
  buildSQPDataQuery(): SQPQueryBuilder {
    const tableName = `\`${this.config.projectId}.${this.config.dataset}.${this.config.tables.sqpRaw}\``;
    
    this.query = `SELECT
        query,
        asin,
        impressions,
        clicks,
        purchases,
        click_share,
        purchase_share,
        query_date,
        updated_at
      FROM ${tableName}`;
    
    return this;
  }

  buildAggregatedMetricsQuery(): string {
    const tableName = `\`${this.config.projectId}.${this.config.dataset}.${this.config.tables.sqpRaw}\``;
    
    return `
      SELECT
        query,
        asin,
        SUM(impressions) as total_impressions,
        SUM(clicks) as total_clicks,
        SUM(purchases) as total_purchases,
        SAFE_DIVIDE(SUM(clicks), SUM(impressions)) as ctr,
        SAFE_DIVIDE(SUM(purchases), SUM(clicks)) as cvr,
        AVG(click_share) as avg_click_share,
        AVG(purchase_share) as avg_purchase_share,
        COUNT(DISTINCT query_date) as days_active,
        MIN(query_date) as first_seen,
        MAX(query_date) as last_seen
      FROM ${tableName}
      WHERE TRUE
        ${this.conditions.length > 0 ? 'AND ' + this.conditions.join(' AND ') : ''}
      GROUP BY query, asin
      ORDER BY total_purchases DESC
      LIMIT ${this.defaultLimit}
    `;
  }

  buildKeywordPerformanceQuery(): string {
    const tableName = `\`${this.config.projectId}.${this.config.dataset}.${this.config.tables.sqpRaw}\``;
    
    return `
      WITH keyword_metrics AS (
        SELECT
          query,
          SUM(impressions) as impressions,
          SUM(clicks) as clicks,
          SUM(purchases) as purchases,
          SAFE_DIVIDE(SUM(clicks), SUM(impressions)) as ctr,
          SAFE_DIVIDE(SUM(purchases), SUM(clicks)) as cvr,
          SAFE_DIVIDE(
            SUM(purchases),
            SUM(SUM(purchases)) OVER (PARTITION BY query)
          ) as purchase_share
        FROM ${tableName}
        WHERE TRUE
          ${this.conditions.length > 0 ? 'AND ' + this.conditions.join(' AND ') : ''}
        GROUP BY query
      )
      SELECT
        *,
        purchases * cvr as performance_score,
        CASE
          WHEN cvr >= 0.10 THEN 'High'
          WHEN cvr >= 0.05 THEN 'Medium'
          ELSE 'Low'
        END as conversion_tier
      FROM keyword_metrics
      ORDER BY purchases DESC
      LIMIT ${this.defaultLimit}
    `;
  }

  // Parameterized query methods
  withDateRange(dateRange: DateRange): SQPQueryBuilder {
    this.validateDateRange(dateRange);
    
    this.conditions.push('query_date >= @startDate');
    this.conditions.push('query_date < @endDate');
    this.parameters.startDate = dateRange.startDate;
    this.parameters.endDate = dateRange.endDate;
    
    return this;
  }

  withASINs(asins: string[]): SQPQueryBuilder {
    if (asins.length === 0) return this;
    
    asins.forEach(asin => this.validateASIN(asin));
    
    this.conditions.push('asin IN UNNEST(@asins)');
    this.parameters.asins = asins;
    
    return this;
  }

  withKeywords(keywords: string[]): SQPQueryBuilder {
    if (keywords.length === 0) return this;
    
    this.conditions.push('query IN UNNEST(@keywords)');
    this.parameters.keywords = keywords;
    
    return this;
  }

  withMinImpressions(minImpressions: number): SQPQueryBuilder {
    this.conditions.push('impressions >= @minImpressions');
    this.parameters.minImpressions = minImpressions;
    
    return this;
  }

  withFilters(filters: QueryFilters): SQPQueryBuilder {
    if (filters.dateRange) {
      this.withDateRange(filters.dateRange);
    }
    if (filters.asins) {
      this.withASINs(filters.asins);
    }
    if (filters.keywords) {
      this.withKeywords(filters.keywords);
    }
    if (filters.minImpressions) {
      this.withMinImpressions(filters.minImpressions);
    }
    if (filters.minClicks) {
      this.conditions.push('clicks >= @minClicks');
      this.parameters.minClicks = filters.minClicks;
    }
    if (filters.minPurchases) {
      this.conditions.push('purchases >= @minPurchases');
      this.parameters.minPurchases = filters.minPurchases;
    }
    
    return this;
  }

  // Query optimization methods
  withPartitionPruning(): SQPQueryBuilder {
    if (this.parameters.startDate && this.parameters.endDate) {
      this.conditions.push('_PARTITIONDATE >= @startDate');
      this.conditions.push('_PARTITIONDATE < @endDate');
    }
    
    return this;
  }

  withClusteringHints(): SQPQueryBuilder {
    if (this.parameters.asins) {
      this.query = `/* +cluster_filter_on_asin */ ${this.query}`;
    }
    
    return this;
  }

  withLargeResultOptimization(): SQPQueryBuilder {
    // Use approximate aggregation for very large result sets
    this.query = this.query.replace(/COUNT\(/g, 'APPROX_COUNT_DISTINCT(');
    this.query = this.query.replace(/SUM\(/g, 'APPROX_TOP_COUNT(');
    
    return this;
  }

  // Incremental query methods
  buildIncrementalQuery(lastProcessedTime: string): SQPQueryBuilder {
    const tableName = `\`${this.config.projectId}.${this.config.dataset}.${this.config.tables.sqpRaw}\``;
    
    this.query = `
      SELECT *
      FROM ${tableName}
      WHERE updated_at > @lastProcessedTime
      ORDER BY updated_at ASC
      LIMIT ${this.defaultLimit}
    `;
    
    this.parameters.lastProcessedTime = lastProcessedTime;
    
    return this;
  }

  buildWatermarkQuery(watermark: { column: string; value: any }): SQPQueryBuilder {
    const tableName = `\`${this.config.projectId}.${this.config.dataset}.${this.config.tables.sqpRaw}\``;
    
    this.query = `
      SELECT *
      FROM ${tableName}
      WHERE ${watermark.column} > @watermarkValue
      ORDER BY ${watermark.column} ASC
      LIMIT ${this.defaultLimit}
    `;
    
    this.parameters.watermarkValue = watermark.value;
    
    return this;
  }

  // Pagination methods
  withPagination(options: PaginationOptions): SQPQueryBuilder {
    if (options.limit) {
      this.defaultLimit = options.limit;
    }
    
    if (options.offset) {
      this.query += ` OFFSET ${options.offset}`;
    }
    
    return this;
  }

  withCursor(cursor: string): SQPQueryBuilder {
    // Decode cursor to get the last ID
    const decodedCursor = JSON.parse(Buffer.from(cursor, 'base64').toString());
    
    this.conditions.push('id > @cursorId');
    this.parameters.cursorId = decodedCursor.last_id;
    this.query += ' ORDER BY id ASC';
    
    return this;
  }

  // Complex query methods
  buildCompetitiveAnalysisQuery(params: CompetitiveAnalysisParams): string {
    const tableName = `\`${this.config.projectId}.${this.config.dataset}.${this.config.tables.sqpRaw}\``;
    
    return `
      WITH competitor_metrics AS (
        SELECT
          query,
          asin,
          SUM(impressions) as impressions,
          SUM(clicks) as clicks,
          SUM(purchases) as purchases,
          SAFE_DIVIDE(SUM(clicks), SUM(impressions)) as ctr,
          SAFE_DIVIDE(SUM(purchases), SUM(clicks)) as cvr
        FROM ${tableName}
        WHERE query IN UNNEST(@keywords)
          AND asin IN UNNEST(@compareASINs)
          ${params.dateRange ? 'AND query_date >= @startDate AND query_date < @endDate' : ''}
        GROUP BY query, asin
      ),
      market_totals AS (
        SELECT
          query,
          SUM(purchases) as total_market_purchases
        FROM competitor_metrics
        GROUP BY query
      )
      SELECT
        cm.*,
        SAFE_DIVIDE(cm.purchases, mt.total_market_purchases) as market_share,
        RANK() OVER (PARTITION BY cm.query ORDER BY cm.purchases DESC) as rank,
        SAFE_DIVIDE(
          cm.purchases,
          FIRST_VALUE(cm.purchases) OVER (PARTITION BY cm.query ORDER BY cm.purchases DESC)
        ) as relative_performance
      FROM competitor_metrics cm
      JOIN market_totals mt ON cm.query = mt.query
      ORDER BY cm.query, rank
    `;
  }

  buildTrendAnalysisQuery(params: TrendAnalysisParams): string {
    const tableName = `\`${this.config.projectId}.${this.config.dataset}.${this.config.tables.sqpRaw}\``;
    
    const granularity = params.granularity === 'daily' ? 'DAY' : 
                       params.granularity === 'weekly' ? 'WEEK' : 'MONTH';
    
    return `
      WITH time_series AS (
        SELECT
          DATE_TRUNC(query_date, ${granularity}) as period,
          ${params.metrics.map(m => `SUM(${m}) as ${m}`).join(',\n          ')}
        FROM ${tableName}
        WHERE TRUE
          ${params.dateRange ? 'AND query_date >= @startDate AND query_date < @endDate' : ''}
        GROUP BY period
      )
      SELECT
        period,
        ${params.metrics.map(m => `
          ${m},
          LAG(${m}, 1) OVER (ORDER BY period) as ${m}_previous,
          ${m} - LAG(${m}, 1) OVER (ORDER BY period) as ${m}_change,
          SAFE_DIVIDE(
            ${m} - LAG(${m}, 1) OVER (ORDER BY period),
            LAG(${m}, 1) OVER (ORDER BY period)
          ) * 100 as ${m}_change_percent,
          AVG(${m}) OVER (
            ORDER BY period
            ROWS BETWEEN ${params.periods - 1} PRECEDING AND CURRENT ROW
          ) as ${m}_moving_avg,
          STDDEV(${m}) OVER (
            ORDER BY period
            ROWS BETWEEN ${params.periods - 1} PRECEDING AND CURRENT ROW
          ) as ${m}_stddev
        `).join(',\n        ')}
      FROM time_series
      ORDER BY period DESC
    `;
  }

  buildKeywordDiscoveryQuery(params: KeywordDiscoveryParams): string {
    const tableName = `\`${this.config.projectId}.${this.config.dataset}.${this.config.tables.sqpRaw}\``;
    
    return `
      WITH seed_pattern AS (
        SELECT LOWER(seed) as pattern
        FROM UNNEST(@seedKeywords) as seed
      ),
      discovered_keywords AS (
        SELECT
          query,
          SUM(impressions) as impressions,
          SUM(clicks) as clicks,
          SUM(purchases) as purchases,
          SAFE_DIVIDE(SUM(clicks), SUM(impressions)) as ctr,
          SAFE_DIVIDE(SUM(purchases), SUM(clicks)) as cvr
        FROM ${tableName}
        WHERE EXISTS (
          SELECT 1
          FROM seed_pattern sp
          WHERE REGEXP_CONTAINS(LOWER(query), sp.pattern)
        )
        GROUP BY query
        HAVING purchases >= @minPurchases
          AND cvr >= @minCVR
      )
      SELECT
        query as keyword,
        impressions,
        clicks,
        purchases,
        ctr,
        cvr,
        purchases * cvr as relevance_score
      FROM discovered_keywords
      ORDER BY relevance_score DESC
      LIMIT ${params.maxResults || 100}
    `;
  }

  // Build final query
  build(): string {
    if (this.conditions.length > 0) {
      // Check if WHERE already exists
      if (this.query.includes('WHERE')) {
        this.query += ` AND ${this.conditions.join(' AND ')}`;
      } else {
        this.query += ` WHERE ${this.conditions.join(' AND ')}`;
      }
    }
    
    // Add LIMIT if not already present
    if (!this.query.includes('LIMIT')) {
      this.query += ` LIMIT ${this.defaultLimit}`;
    }
    
    return this.query.trim();
  }

  getParameters(): Record<string, any> {
    return this.parameters;
  }

  // Validation methods
  private validateDateRange(dateRange: DateRange): void {
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    
    if (start >= end) {
      throw new Error('Invalid date range: start date must be before end date');
    }
  }

  private validateASIN(asin: string): void {
    if (!/^B[0-9A-Z]{9}$/.test(asin)) {
      throw new Error(`Invalid ASIN format: ${asin}`);
    }
  }

  // Reset builder for reuse
  reset(): SQPQueryBuilder {
    this.query = '';
    this.parameters = {};
    this.conditions = [];
    return this;
  }
}