import { DataValidator } from '@/lib/validation/data-validator';
import { format } from 'date-fns';

export interface ComparisonConfig {
  keyFields: string[];
  valueFields: string[];
  tolerance?: number; // Percentage tolerance for numeric comparisons
  ignoreCase?: boolean;
  ignoreWhitespace?: boolean;
}

export interface ComparisonResult {
  identical: boolean;
  totalRecords: {
    source: number;
    target: number;
  };
  matches: number;
  mismatches: number;
  missingInTarget: number;
  extraInTarget: number;
  details: ComparisonDetail[];
}

export interface ComparisonDetail {
  type: 'match' | 'mismatch' | 'missing' | 'extra';
  key: string;
  source?: any;
  target?: any;
  differences?: FieldDifference[];
}

export interface FieldDifference {
  field: string;
  sourceValue: any;
  targetValue: any;
  percentDiff?: number;
}

export interface DatasetComparison {
  sourceTable: string;
  targetTable: string;
  period: string;
  comparisonDate: Date;
  summary: ComparisonSummary;
  sampleDifferences: ComparisonDetail[];
}

export interface ComparisonSummary {
  recordCounts: {
    source: number;
    target: number;
    difference: number;
    percentDiff: number;
  };
  fieldMatches: {
    [field: string]: {
      matches: number;
      mismatches: number;
      matchRate: number;
    };
  };
  overallMatchRate: number;
  dataQuality: {
    source: number;
    target: number;
  };
}

export class DataComparator {
  private validator: DataValidator;

  constructor() {
    this.validator = new DataValidator();
  }

  /**
   * Compare two datasets
   */
  compareDatasets(
    sourceData: any[],
    targetData: any[],
    config: ComparisonConfig
  ): ComparisonResult {
    const sourceMap = this.buildKeyMap(sourceData, config.keyFields);
    const targetMap = this.buildKeyMap(targetData, config.keyFields);
    
    const details: ComparisonDetail[] = [];
    let matches = 0;
    let mismatches = 0;
    let missingInTarget = 0;
    let extraInTarget = 0;

    // Check source records
    sourceMap.forEach((sourceRecord, key) => {
      const targetRecord = targetMap.get(key);
      
      if (!targetRecord) {
        missingInTarget++;
        details.push({
          type: 'missing',
          key,
          source: sourceRecord,
        });
      } else {
        const differences = this.compareRecords(
          sourceRecord,
          targetRecord,
          config.valueFields,
          config.tolerance
        );
        
        if (differences.length === 0) {
          matches++;
          if (details.length < 100) { // Limit details for performance
            details.push({
              type: 'match',
              key,
              source: sourceRecord,
              target: targetRecord,
            });
          }
        } else {
          mismatches++;
          if (details.length < 100) {
            details.push({
              type: 'mismatch',
              key,
              source: sourceRecord,
              target: targetRecord,
              differences,
            });
          }
        }
      }
    });

    // Check for extra records in target
    targetMap.forEach((targetRecord, key) => {
      if (!sourceMap.has(key)) {
        extraInTarget++;
        if (details.length < 100) {
          details.push({
            type: 'extra',
            key,
            target: targetRecord,
          });
        }
      }
    });

    return {
      identical: mismatches === 0 && missingInTarget === 0 && extraInTarget === 0,
      totalRecords: {
        source: sourceData.length,
        target: targetData.length,
      },
      matches,
      mismatches,
      missingInTarget,
      extraInTarget,
      details: details.slice(0, 100), // Limit to first 100 details
    };
  }

  /**
   * Compare two records field by field
   */
  private compareRecords(
    source: any,
    target: any,
    fields: string[],
    tolerance?: number
  ): FieldDifference[] {
    const differences: FieldDifference[] = [];

    fields.forEach(field => {
      const sourceValue = source[field];
      const targetValue = target[field];
      
      if (!this.valuesMatch(sourceValue, targetValue, tolerance)) {
        const diff: FieldDifference = {
          field,
          sourceValue,
          targetValue,
        };
        
        // Calculate percentage difference for numbers
        if (typeof sourceValue === 'number' && typeof targetValue === 'number') {
          if (sourceValue !== 0) {
            diff.percentDiff = Math.abs((targetValue - sourceValue) / sourceValue) * 100;
          }
        }
        
        differences.push(diff);
      }
    });

    return differences;
  }

  /**
   * Check if two values match within tolerance
   */
  private valuesMatch(sourceValue: any, targetValue: any, tolerance?: number): boolean {
    // Handle null/undefined
    if (sourceValue === null || sourceValue === undefined) {
      return targetValue === null || targetValue === undefined;
    }
    
    // Handle numbers with tolerance
    if (typeof sourceValue === 'number' && typeof targetValue === 'number') {
      if (tolerance && tolerance > 0) {
        const percentDiff = sourceValue === 0 
          ? Math.abs(targetValue) 
          : Math.abs((targetValue - sourceValue) / sourceValue) * 100;
        return percentDiff <= tolerance;
      }
      return sourceValue === targetValue;
    }
    
    // Handle other types
    return sourceValue === targetValue;
  }

  /**
   * Build a map of records by key
   */
  private buildKeyMap(data: any[], keyFields: string[]): Map<string, any> {
    const map = new Map<string, any>();
    
    data.forEach(record => {
      const key = keyFields.map(field => {
        const value = record[field];
        return value !== null && value !== undefined ? String(value) : '';
      }).join('-');
      
      map.set(key, record);
    });
    
    return map;
  }

  /**
   * Compare datasets with summary statistics
   */
  compareWithSummary(
    sourceData: any[],
    targetData: any[],
    config: ComparisonConfig & { sourceTable: string; targetTable: string; period: string }
  ): DatasetComparison {
    const comparisonResult = this.compareDatasets(sourceData, targetData, config);
    
    // Calculate field-level match rates
    const fieldMatches: Record<string, any> = {};
    config.valueFields.forEach(field => {
      fieldMatches[field] = {
        matches: 0,
        mismatches: 0,
        matchRate: 0,
      };
    });
    
    // Analyze differences by field
    comparisonResult.details.forEach(detail => {
      if (detail.type === 'mismatch' && detail.differences) {
        detail.differences.forEach(diff => {
          fieldMatches[diff.field].mismatches++;
        });
      } else if (detail.type === 'match') {
        config.valueFields.forEach(field => {
          fieldMatches[field].matches++;
        });
      }
    });
    
    // Calculate match rates
    Object.keys(fieldMatches).forEach(field => {
      const total = fieldMatches[field].matches + fieldMatches[field].mismatches;
      fieldMatches[field].matchRate = total > 0 
        ? (fieldMatches[field].matches / total) * 100 
        : 100;
    });
    
    // Calculate data quality scores
    const sourceQuality = this.validator.calculateQualityMetrics(sourceData);
    const targetQuality = this.validator.calculateQualityMetrics(targetData);
    
    const summary: ComparisonSummary = {
      recordCounts: {
        source: sourceData.length,
        target: targetData.length,
        difference: Math.abs(sourceData.length - targetData.length),
        percentDiff: sourceData.length > 0 
          ? Math.abs(sourceData.length - targetData.length) / sourceData.length * 100 
          : 0,
      },
      fieldMatches,
      overallMatchRate: comparisonResult.totalRecords.source > 0
        ? (comparisonResult.matches / comparisonResult.totalRecords.source) * 100
        : 0,
      dataQuality: {
        source: sourceQuality.completeness * 100,
        target: targetQuality.completeness * 100,
      },
    };
    
    return {
      sourceTable: config.sourceTable,
      targetTable: config.targetTable,
      period: config.period,
      comparisonDate: new Date(),
      summary,
      sampleDifferences: comparisonResult.details.filter(d => d.type !== 'match').slice(0, 20),
    };
  }

  /**
   * Generate comparison report
   */
  generateComparisonReport(comparisons: DatasetComparison[]): string {
    let report = '# Data Comparison Report\n\n';
    report += `Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}\n\n`;
    
    comparisons.forEach(comparison => {
      report += `## ${comparison.sourceTable} vs ${comparison.targetTable}\n`;
      report += `Period: ${comparison.period}\n\n`;
      
      // Summary statistics
      report += '### Summary\n';
      report += `- Record Count Difference: ${comparison.summary.recordCounts.difference} (${comparison.summary.recordCounts.percentDiff.toFixed(2)}%)\n`;
      report += `- Overall Match Rate: ${comparison.summary.overallMatchRate.toFixed(2)}%\n`;
      report += `- Data Quality: Source=${comparison.summary.dataQuality.source.toFixed(2)}%, Target=${comparison.summary.dataQuality.target.toFixed(2)}%\n\n`;
      
      // Field-level statistics
      report += '### Field Match Rates\n';
      Object.entries(comparison.summary.fieldMatches).forEach(([field, stats]) => {
        report += `- ${field}: ${stats.matchRate.toFixed(2)}% (${stats.matches} matches, ${stats.mismatches} mismatches)\n`;
      });
      report += '\n';
      
      // Sample differences
      if (comparison.sampleDifferences.length > 0) {
        report += '### Sample Differences\n';
        comparison.sampleDifferences.slice(0, 5).forEach(diff => {
          report += `- Type: ${diff.type}, Key: ${diff.key}\n`;
          if (diff.differences) {
            diff.differences.forEach(fieldDiff => {
              report += `  - ${fieldDiff.field}: ${fieldDiff.sourceValue} → ${fieldDiff.targetValue}`;
              if (fieldDiff.percentDiff) {
                report += ` (${fieldDiff.percentDiff.toFixed(2)}% diff)`;
              }
              report += '\n';
            });
          }
        });
        report += '\n';
      }
    });
    
    return report;
  }

  /**
   * Compare multiple periods
   */
  async compareMultiplePeriods(
    periods: Array<{
      sourceData: any[];
      targetData: any[];
      period: string;
    }>,
    config: ComparisonConfig
  ): Promise<{
    periodComparisons: DatasetComparison[];
    trends: {
      matchRateTrend: number[];
      recordCountTrend: {
        source: number[];
        target: number[];
      };
    };
  }> {
    const periodComparisons: DatasetComparison[] = [];
    const matchRateTrend: number[] = [];
    const recordCountTrend = {
      source: [] as number[],
      target: [] as number[],
    };
    
    for (const periodData of periods) {
      const comparison = this.compareWithSummary(
        periodData.sourceData,
        periodData.targetData,
        {
          ...config,
          sourceTable: 'source',
          targetTable: 'target',
          period: periodData.period,
        }
      );
      
      periodComparisons.push(comparison);
      matchRateTrend.push(comparison.summary.overallMatchRate);
      recordCountTrend.source.push(comparison.summary.recordCounts.source);
      recordCountTrend.target.push(comparison.summary.recordCounts.target);
    }
    
    return {
      periodComparisons,
      trends: {
        matchRateTrend,
        recordCountTrend,
      },
    };
  }
}