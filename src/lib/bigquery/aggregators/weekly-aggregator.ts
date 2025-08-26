import { WeeklyTrend } from '../types';

export class WeeklyAggregator {
  constructor(private pool: any) {}

  /**
   * Aggregate data by ISO week
   */
  async aggregateByWeek(data: any[]): Promise<Record<string, any>> {
    const aggregated: Record<string, any> = {};
    
    for (const record of data) {
      const week = this.getISOWeek(record.date);
      
      if (!aggregated[week]) {
        aggregated[week] = {
          impressions: 0,
          clicks: 0,
          purchases: 0,
          recordCount: 0,
        };
      }
      
      aggregated[week].impressions += record.impressions || 0;
      aggregated[week].clicks += record.clicks || 0;
      aggregated[week].purchases += record.purchases || 0;
      aggregated[week].recordCount += 1;
    }
    
    return aggregated;
  }

  /**
   * Calculate week-over-week changes
   */
  calculateWeekOverWeek(weeklyData: Record<string, any>): Record<string, any> {
    const weeks = Object.keys(weeklyData).sort();
    const trends: Record<string, any> = {};
    
    for (let i = 0; i < weeks.length; i++) {
      const currentWeek = weeks[i];
      const previousWeek = i > 0 ? weeks[i - 1] : null;
      const current = weeklyData[currentWeek];
      
      trends[currentWeek] = {
        impressions: {
          value: current.impressions,
          change: 0,
          changePercent: 0,
        },
        clicks: {
          value: current.clicks,
          change: 0,
          changePercent: 0,
        },
        purchases: {
          value: current.purchases,
          change: 0,
          changePercent: 0,
        },
      };
      
      if (previousWeek) {
        const previous = weeklyData[previousWeek];
        
        // Calculate changes for each metric
        for (const metric of ['impressions', 'clicks', 'purchases']) {
          const currentValue = current[metric];
          const previousValue = previous[metric];
          const change = currentValue - previousValue;
          const changePercent = previousValue > 0 ? (change / previousValue) * 100 : 0;
          
          trends[currentWeek][metric] = {
            value: currentValue,
            change,
            changePercent,
          };
        }
      }
    }
    
    return trends;
  }

  /**
   * Detect seasonal patterns in yearly data
   */
  async detectSeasonalPatterns(yearData: Record<string, any>): Promise<{
    weeklySeasonality: number[];
    monthlySeasonality: number[];
    peakWeeks: string[];
    lowWeeks: string[];
  }> {
    const weeks = Object.keys(yearData).sort();
    const values = weeks.map(week => yearData[week].purchases || 0);
    
    // Calculate average
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    // Find peaks and lows (weeks with values > 1.5x average or < 0.5x average)
    const peakWeeks: string[] = [];
    const lowWeeks: string[] = [];
    
    weeks.forEach((week, index) => {
      const value = values[index];
      if (value > avg * 1.5) {
        peakWeeks.push(week);
      } else if (value < avg * 0.5) {
        lowWeeks.push(week);
      }
    });
    
    // Calculate seasonality indices
    const weeklySeasonality = this.calculateSeasonalityIndices(values, 52);
    const monthlySeasonality = this.calculateSeasonalityIndices(values, 12);
    
    return {
      weeklySeasonality,
      monthlySeasonality,
      peakWeeks,
      lowWeeks,
    };
  }

  /**
   * Calculate moving averages for trend smoothing
   */
  calculateMovingAverage(
    data: WeeklyTrend[],
    period: number
  ): WeeklyTrend[] {
    const result = [...data];
    
    for (let i = period - 1; i < data.length; i++) {
      const windowData = data.slice(i - period + 1, i + 1);
      
      result[i].purchasesMA = this.average(windowData.map(d => d.purchases));
      result[i].ctrMA = this.average(windowData.map(d => d.clicks / d.impressions));
      result[i].cvrMA = this.average(windowData.map(d => d.purchases / d.clicks));
    }
    
    return result;
  }

  /**
   * Identify trend direction based on recent changes
   */
  identifyTrendDirection(recentChanges: number[]): 'growing' | 'declining' | 'stable' {
    const avgChange = this.average(recentChanges);
    
    if (avgChange > 10) return 'growing';
    if (avgChange < -10) return 'declining';
    return 'stable';
  }

  /**
   * Private helper methods
   */
  private getISOWeek(dateStr: string): string {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const weekNum = this.getWeekNumber(date);
    
    return `${year}-W${weekNum.toString().padStart(2, '0')}`;
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  private calculateSeasonalityIndices(values: number[], periods: number): number[] {
    const indices: number[] = [];
    const periodSize = Math.floor(values.length / periods);
    
    for (let p = 0; p < periods; p++) {
      const periodValues = values.slice(p * periodSize, (p + 1) * periodSize);
      const periodAvg = this.average(periodValues);
      const overallAvg = this.average(values);
      
      indices.push(overallAvg > 0 ? periodAvg / overallAvg : 1);
    }
    
    return indices;
  }

  private average(values: number[]): number {
    return values.length > 0 
      ? values.reduce((sum, val) => sum + val, 0) / values.length 
      : 0;
  }
}