export interface TransformOptions {
  aggregationLevel?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  calculateTrends?: boolean;
  calculateMarketShare?: boolean;
  includeMetrics?: string[];
}

export interface TransformResult {
  data: any[];
  metadata: {
    recordCount: number;
    aggregationLevel?: string;
    metrics?: string[];
  };
}

export class DataTransformer {
  async transform(inputData: any[], options: TransformOptions = {}): Promise<TransformResult> {
    const {
      aggregationLevel = 'daily',
      calculateTrends = true,
      calculateMarketShare = false
    } = options;

    if (!inputData || inputData.length === 0) {
      return {
        data: [],
        metadata: {
          recordCount: 0,
          aggregationLevel
        }
      };
    }

    try {
      // Group data by ASIN and keyword for aggregation
      const groupedData = this.groupByAsinKeyword(inputData);

      // Perform aggregation based on level
      const aggregatedData = this.aggregate(groupedData, aggregationLevel);

      // Calculate additional metrics
      let transformedData = aggregatedData;

      if (calculateTrends) {
        transformedData = this.calculateTrends(transformedData);
      }

      if (calculateMarketShare) {
        transformedData = this.calculateMarketShare(transformedData);
      }

      // Calculate derived metrics
      transformedData = transformedData.map(record => ({
        ...record,
        ctr: record.clicks > 0 ? record.clicks / record.impressions : 0,
        cvr: record.clicks > 0 ? record.purchases / record.clicks : 0,
        purchase_rate: record.impressions > 0 ? record.purchases / record.impressions : 0
      }));

      return {
        data: transformedData,
        metadata: {
          recordCount: transformedData.length,
          aggregationLevel,
          metrics: ['impressions', 'clicks', 'purchases', 'ctr', 'cvr', 'purchase_rate']
        }
      };

    } catch (error) {
      console.error('Data transformation failed:', error);
      throw new Error(`Failed to transform data: ${(error as Error).message}`);
    }
  }

  private groupByAsinKeyword(data: any[]): Map<string, any[]> {
    const grouped = new Map<string, any[]>();

    for (const record of data) {
      const key = `${record.asin}_${record.keyword}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(record);
    }

    return grouped;
  }

  private aggregate(groupedData: Map<string, any[]>, level: string): any[] {
    const results: any[] = [];

    for (const [key, records] of groupedData) {
      const [asin, ...keywordParts] = key.split('_');
      const keyword = keywordParts.join('_');

      // Aggregate metrics
      const aggregated = {
        asin,
        keyword,
        period_start: this.getPeriodStart(records[0].date, level),
        period_end: this.getPeriodEnd(records[0].date, level),
        impressions: records.reduce((sum, r) => sum + (r.impressions || 0), 0),
        clicks: records.reduce((sum, r) => sum + (r.clicks || 0), 0),
        purchases: records.reduce((sum, r) => sum + (r.purchases || 0), 0),
        days_in_period: records.length
      };

      results.push(aggregated);
    }

    return results;
  }

  private getPeriodStart(date: string, level: string): string {
    const d = new Date(date);

    switch (level) {
      case 'weekly':
        const dayOfWeek = d.getDay();
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        d.setDate(d.getDate() - diff);
        break;
      case 'monthly':
        d.setDate(1);
        break;
      case 'quarterly':
        const quarter = Math.floor(d.getMonth() / 3);
        d.setMonth(quarter * 3);
        d.setDate(1);
        break;
      case 'yearly':
        d.setMonth(0);
        d.setDate(1);
        break;
    }

    return d.toISOString().split('T')[0];
  }

  private getPeriodEnd(date: string, level: string): string {
    const d = new Date(date);

    switch (level) {
      case 'weekly':
        const dayOfWeek = d.getDay();
        const diff = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
        d.setDate(d.getDate() + diff);
        break;
      case 'monthly':
        d.setMonth(d.getMonth() + 1);
        d.setDate(0); // Last day of month
        break;
      case 'quarterly':
        const quarter = Math.floor(d.getMonth() / 3);
        d.setMonth((quarter + 1) * 3);
        d.setDate(0);
        break;
      case 'yearly':
        d.setFullYear(d.getFullYear() + 1);
        d.setMonth(0);
        d.setDate(0);
        break;
    }

    return d.toISOString().split('T')[0];
  }

  private calculateTrends(data: any[]): any[] {
    // Sort by period for trend calculation
    const sorted = [...data].sort((a, b) => 
      new Date(a.period_start).getTime() - new Date(b.period_start).getTime()
    );

    // Group by ASIN-keyword for trend calculation
    const groups = new Map<string, any[]>();
    for (const record of sorted) {
      const key = `${record.asin}_${record.keyword}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(record);
    }

    // Calculate trends
    const results: any[] = [];
    for (const [_, records] of groups) {
      for (let i = 0; i < records.length; i++) {
        const current = records[i];
        const previous = i > 0 ? records[i - 1] : null;

        const trend = {
          ...current,
          impressions_change: previous ? current.impressions - previous.impressions : 0,
          clicks_change: previous ? current.clicks - previous.clicks : 0,
          purchases_change: previous ? current.purchases - previous.purchases : 0,
          impressions_change_pct: previous && previous.impressions > 0
            ? (current.impressions - previous.impressions) / previous.impressions
            : 0,
          clicks_change_pct: previous && previous.clicks > 0
            ? (current.clicks - previous.clicks) / previous.clicks
            : 0,
          purchases_change_pct: previous && previous.purchases > 0
            ? (current.purchases - previous.purchases) / previous.purchases
            : 0
        };

        results.push(trend);
      }
    }

    return results;
  }

  private calculateMarketShare(data: any[]): any[] {
    // Group by period and keyword to calculate market share
    const periodGroups = new Map<string, any[]>();
    
    for (const record of data) {
      const key = `${record.period_start}_${record.keyword}`;
      if (!periodGroups.has(key)) {
        periodGroups.set(key, []);
      }
      periodGroups.get(key)!.push(record);
    }

    // Calculate market share within each period-keyword group
    const results: any[] = [];
    
    for (const [_, group] of periodGroups) {
      const totalImpressions = group.reduce((sum, r) => sum + r.impressions, 0);
      const totalClicks = group.reduce((sum, r) => sum + r.clicks, 0);
      const totalPurchases = group.reduce((sum, r) => sum + r.purchases, 0);

      for (const record of group) {
        results.push({
          ...record,
          impression_share: totalImpressions > 0 ? record.impressions / totalImpressions : 0,
          click_share: totalClicks > 0 ? record.clicks / totalClicks : 0,
          purchase_share: totalPurchases > 0 ? record.purchases / totalPurchases : 0,
          competitors_count: group.length - 1
        });
      }
    }

    return results;
  }
}