export class MetricsAggregator {
  /**
   * Aggregate multiple metrics efficiently
   */
  aggregateMetrics(metrics: Record<string, number[]>): Record<string, {
    sum: number;
    avg: number;
    min: number;
    max: number;
  }> {
    const result: Record<string, any> = {};
    
    for (const [metric, values] of Object.entries(metrics)) {
      result[metric] = {
        sum: this.sum(values),
        avg: this.average(values),
        min: Math.min(...values),
        max: Math.max(...values),
      };
    }
    
    return result;
  }

  /**
   * Calculate percentiles for a set of values
   */
  calculatePercentiles(values: number[]): Record<string, number> {
    if (values.length === 0) {
      return {
        p25: 0,
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
        p99: 0,
      };
    }
    
    const sorted = [...values].sort((a, b) => a - b);
    const percentiles = {
      p25: this.getPercentile(sorted, 25),
      p50: this.getPercentile(sorted, 50),
      p75: this.getPercentile(sorted, 75),
      p90: this.getPercentile(sorted, 90),
      p95: this.getPercentile(sorted, 95),
      p99: this.getPercentile(sorted, 99),
    };
    
    return percentiles;
  }

  /**
   * Calculate weighted average
   */
  weightedAverage(data: Array<{ value: number; weight: number }>): number {
    const totalWeight = data.reduce((sum, item) => sum + item.weight, 0);
    
    if (totalWeight === 0) return 0;
    
    const weightedSum = data.reduce(
      (sum, item) => sum + item.value * item.weight,
      0
    );
    
    return weightedSum / totalWeight;
  }

  /**
   * Calculate rolling aggregations
   */
  rollingAggregate(
    timeSeries: Array<{ date: string; value: number }>,
    windowSize: number
  ): Array<{
    date: string;
    value: number;
    rolling3DayAvg?: number;
    rolling3DaySum?: number;
  }> {
    const result = [...timeSeries];
    
    for (let i = windowSize - 1; i < timeSeries.length; i++) {
      const window = timeSeries.slice(i - windowSize + 1, i + 1);
      const values = window.map(w => w.value);
      
      result[i] = {
        ...result[i],
        [`rolling${windowSize}DayAvg`]: this.average(values),
        [`rolling${windowSize}DaySum`]: this.sum(values),
      };
    }
    
    return result;
  }

  /**
   * Calculate growth rates
   */
  calculateGrowthRates(
    values: number[],
    periods: number[] = [1, 7, 30]
  ): Record<string, number> {
    const rates: Record<string, number> = {};
    
    for (const period of periods) {
      if (values.length > period) {
        const current = values[values.length - 1];
        const previous = values[values.length - 1 - period];
        
        rates[`${period}d`] = previous > 0 
          ? ((current - previous) / previous) * 100 
          : 0;
      }
    }
    
    return rates;
  }

  /**
   * Detect outliers using IQR method
   */
  detectOutliers(values: number[]): {
    outliers: number[];
    indices: number[];
    bounds: { lower: number; upper: number };
  } {
    if (values.length < 4) {
      return { outliers: [], indices: [], bounds: { lower: 0, upper: 0 } };
    }
    
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = this.getPercentile(sorted, 25);
    const q3 = this.getPercentile(sorted, 75);
    const iqr = q3 - q1;
    
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    const outliers: number[] = [];
    const indices: number[] = [];
    
    values.forEach((value, index) => {
      if (value < lowerBound || value > upperBound) {
        outliers.push(value);
        indices.push(index);
      }
    });
    
    return {
      outliers,
      indices,
      bounds: { lower: lowerBound, upper: upperBound },
    };
  }

  /**
   * Calculate correlation between two metrics
   */
  calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;
    
    const n = x.length;
    const sumX = this.sum(x);
    const sumY = this.sum(y);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
    );
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Private helper methods
   */
  private sum(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0);
  }

  private average(values: number[]): number {
    return values.length > 0 ? this.sum(values) / values.length : 0;
  }

  private getPercentile(sorted: number[], percentile: number): number {
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    
    return lower === upper
      ? sorted[lower]
      : sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }
}