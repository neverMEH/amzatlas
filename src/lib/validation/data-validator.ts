export interface ValidationRule {
  name: string;
  validate: (record: any) => boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
  }>;
}

export interface DataQualityMetrics {
  completeness: number;
  nullValueCounts: Record<string, number>;
  duplicateCount?: number;
  uniqueRecords?: number;
  coverage?: number;
}

export interface ValidationSchema {
  [field: string]: {
    type: 'string' | 'number' | 'boolean' | 'date';
    required: boolean;
    min?: number;
    max?: number;
    pattern?: RegExp;
  };
}

export interface BusinessRuleViolation {
  violations: Array<{
    recordIndex: number;
    rule: string;
    value: any;
  }>;
  violationRate: number;
  violationsByRule: Record<string, number>;
}

export interface PeriodConsistencyResult {
  isConsistent: boolean;
  sourceTotal: number;
  targetTotal: number;
  difference: number;
  differencePercent: number;
}

export interface OutlierInfo {
  index: number;
  field: string;
  value: number;
  mean: number;
  stdDev: number;
  reason: string;
}

export interface DistributionAnalysis {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  skewness: number;
}

export interface ReferentialIntegrityResult {
  isValid: boolean;
  missingInTarget: any[];
  extraInTarget: any[];
}

export interface ValidationReport {
  summary: {
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    validationScore: number;
  };
  completeness: DataQualityMetrics;
  duplicates: {
    hasDuplicates: boolean;
    duplicateCount: number;
    duplicateGroups: any[];
  };
  outliers: OutlierInfo[];
  ruleViolations: Array<{
    rule: string;
    violations: number;
  }>;
  timestamp: Date;
}

export class DataValidator {
  /**
   * Validate data against a schema
   */
  validateSchema(data: any, schema: ValidationSchema): ValidationResult {
    const errors: Array<{ field: string; message: string }> = [];

    // Check required fields
    Object.keys(schema).forEach(field => {
      if (schema[field].required && (data[field] === undefined || data[field] === null)) {
        errors.push({
          field,
          message: 'Required field missing',
        });
      }
    });

    // Check types and constraints
    Object.keys(data).forEach(field => {
      if (schema[field]) {
        const value = data[field];
        const fieldSchema = schema[field];

        // Type validation
        if (value !== null && value !== undefined) {
          const actualType = typeof value;
          const expectedType = fieldSchema.type;

          if (expectedType === 'date' && !(value instanceof Date)) {
            errors.push({
              field,
              message: 'Type mismatch: expected date',
            });
          } else if (expectedType !== 'date' && actualType !== expectedType) {
            errors.push({
              field,
              message: `Type mismatch: expected ${expectedType}, got ${actualType}`,
            });
          }

          // Numeric constraints
          if (fieldSchema.type === 'number' && typeof value === 'number') {
            if (fieldSchema.min !== undefined && value < fieldSchema.min) {
              errors.push({
                field,
                message: `Value ${value} is below minimum of ${fieldSchema.min}`,
              });
            }
            if (fieldSchema.max !== undefined && value > fieldSchema.max) {
              errors.push({
                field,
                message: `Value ${value} exceeds maximum of ${fieldSchema.max}`,
              });
            }
          }

          // Pattern validation
          if (fieldSchema.pattern && typeof value === 'string') {
            if (!fieldSchema.pattern.test(value)) {
              errors.push({
                field,
                message: 'Value does not match required pattern',
              });
            }
          }
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculate data quality metrics
   */
  calculateQualityMetrics(
    records: any[],
    options?: { uniqueKeys?: string[] }
  ): DataQualityMetrics {
    if (records.length === 0) {
      return {
        completeness: 0,
        nullValueCounts: {},
        duplicateCount: 0,
        uniqueRecords: 0,
      };
    }

    // Calculate null counts
    const nullCounts: Record<string, number> = {};
    const fields = Object.keys(records[0]);
    let totalFields = 0;
    let nonNullValues = 0;

    records.forEach(record => {
      fields.forEach(field => {
        totalFields++;
        if (record[field] === null || record[field] === undefined) {
          nullCounts[field] = (nullCounts[field] || 0) + 1;
        } else {
          nonNullValues++;
        }
      });
    });

    // Calculate duplicates
    let duplicateCount = 0;
    let uniqueRecords = records.length;

    if (options?.uniqueKeys) {
      const seen = new Set<string>();
      records.forEach(record => {
        const key = options.uniqueKeys!.map(k => record[k]).join('-');
        if (seen.has(key)) {
          duplicateCount++;
        } else {
          seen.add(key);
        }
      });
      uniqueRecords = seen.size;
    }

    return {
      completeness: totalFields > 0 ? nonNullValues / totalFields : 0,
      nullValueCounts: nullCounts,
      duplicateCount,
      uniqueRecords,
    };
  }

  /**
   * Validate business rules
   */
  validateBusinessRules(
    records: any[],
    rules: ValidationRule[]
  ): BusinessRuleViolation {
    const violations: Array<{
      recordIndex: number;
      rule: string;
      value: any;
    }> = [];
    const violationsByRule: Record<string, number> = {};

    records.forEach((record, index) => {
      rules.forEach(rule => {
        if (!rule.validate(record)) {
          violations.push({
            recordIndex: index,
            rule: rule.name,
            value: record,
          });
          violationsByRule[rule.name] = (violationsByRule[rule.name] || 0) + 1;
        }
      });
    });

    return {
      violations,
      violationRate: records.length > 0 ? violations.length / records.length : 0,
      violationsByRule,
    };
  }

  /**
   * Validate period aggregation consistency
   */
  validatePeriodConsistency(
    sourceData: any[],
    targetData: any[],
    config: {
      sourceField: string;
      targetField: string;
      aggregation: 'sum' | 'avg' | 'count';
    }
  ): PeriodConsistencyResult {
    let sourceTotal = 0;
    let targetTotal = 0;

    if (config.aggregation === 'sum') {
      sourceTotal = sourceData.reduce((sum, r) => sum + (r[config.sourceField] || 0), 0);
      targetTotal = targetData.reduce((sum, r) => sum + (r[config.targetField] || 0), 0);
    } else if (config.aggregation === 'avg') {
      sourceTotal = sourceData.reduce((sum, r) => sum + (r[config.sourceField] || 0), 0) / sourceData.length;
      targetTotal = targetData.reduce((sum, r) => sum + (r[config.targetField] || 0), 0) / targetData.length;
    } else if (config.aggregation === 'count') {
      sourceTotal = sourceData.length;
      targetTotal = targetData.length;
    }

    const difference = Math.abs(sourceTotal - targetTotal);
    const differencePercent = sourceTotal > 0 ? (difference / sourceTotal) * 100 : 0;

    return {
      isConsistent: difference < 0.01, // Allow small floating point differences
      sourceTotal,
      targetTotal,
      difference,
      differencePercent,
    };
  }

  /**
   * Detect outliers in numeric data
   */
  detectOutliers(
    records: any[],
    field: string,
    options: {
      method: 'iqr' | 'zscore';
      threshold: number;
    }
  ): OutlierInfo[] {
    const values = records
      .map((r, i) => ({ index: i, value: r[field] }))
      .filter(v => typeof v.value === 'number');

    if (values.length === 0) return [];

    const numbers = values.map(v => v.value);
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const stdDev = Math.sqrt(
      numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / numbers.length
    );

    const outliers: OutlierInfo[] = [];

    if (options.method === 'zscore') {
      values.forEach(({ index, value }) => {
        const zScore = Math.abs((value - mean) / stdDev);
        if (zScore > options.threshold) {
          outliers.push({
            index,
            field,
            value,
            mean,
            stdDev,
            reason: `Z-score ${zScore.toFixed(2)} exceeds threshold ${options.threshold}`,
          });
        }
      });
    } else if (options.method === 'iqr') {
      const sorted = [...numbers].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const iqr = q3 - q1;
      const lowerBound = q1 - options.threshold * iqr;
      const upperBound = q3 + options.threshold * iqr;

      values.forEach(({ index, value }) => {
        if (value < lowerBound || value > upperBound) {
          outliers.push({
            index,
            field,
            value,
            mean,
            stdDev,
            reason: `Value outside IQR bounds [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}]`,
          });
        }
      });
    }

    return outliers;
  }

  /**
   * Analyze data distribution
   */
  analyzeDistribution(records: any[], field: string): DistributionAnalysis {
    const values = records
      .map(r => r[field])
      .filter(v => typeof v === 'number')
      .sort((a, b) => a - b);

    if (values.length === 0) {
      return {
        mean: 0,
        median: 0,
        stdDev: 0,
        min: 0,
        max: 0,
        q1: 0,
        q3: 0,
        skewness: 0,
      };
    }

    const mean = values.reduce((sum, n) => sum + n, 0) / values.length;
    const median = values[Math.floor(values.length / 2)];
    const stdDev = Math.sqrt(
      values.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / values.length
    );

    const q1 = values[Math.floor(values.length * 0.25)];
    const q3 = values[Math.floor(values.length * 0.75)];

    // Calculate skewness
    const skewness = values.reduce((sum, n) => {
      return sum + Math.pow((n - mean) / stdDev, 3);
    }, 0) / values.length;

    return {
      mean,
      median,
      stdDev,
      min: values[0],
      max: values[values.length - 1],
      q1,
      q3,
      skewness,
    };
  }

  /**
   * Validate referential integrity
   */
  validateReferentialIntegrity(
    sourceData: any[],
    targetData: any[],
    keyFields: string[]
  ): ReferentialIntegrityResult {
    const sourceKeys = new Set(
      sourceData.map(r => keyFields.map(k => r[k]).join('-'))
    );
    const targetKeys = new Set(
      targetData.map(r => keyFields.map(k => r[k]).join('-'))
    );

    const missingInTarget: any[] = [];
    const extraInTarget: any[] = [];

    sourceData.forEach(record => {
      const key = keyFields.map(k => record[k]).join('-');
      if (!targetKeys.has(key)) {
        const keyObj: any = {};
        keyFields.forEach(k => {
          keyObj[k] = record[k];
        });
        missingInTarget.push(keyObj);
      }
    });

    targetData.forEach(record => {
      const key = keyFields.map(k => record[k]).join('-');
      if (!sourceKeys.has(key)) {
        const keyObj: any = {};
        keyFields.forEach(k => {
          keyObj[k] = record[k];
        });
        extraInTarget.push(keyObj);
      }
    });

    return {
      isValid: missingInTarget.length === 0 && extraInTarget.length === 0,
      missingInTarget,
      extraInTarget,
    };
  }

  /**
   * Generate comprehensive validation report
   */
  generateValidationReport(
    data: any[],
    options: {
      checkCompleteness?: boolean;
      checkDuplicates?: boolean;
      checkOutliers?: boolean;
      outlierFields?: string[];
      customRules?: ValidationRule[];
      uniqueKeys?: string[];
    }
  ): ValidationReport {
    let validRecords = data.length;
    const ruleViolations: Array<{ rule: string; violations: number }> = [];

    // Check completeness
    const completeness = options.checkCompleteness
      ? this.calculateQualityMetrics(data, { uniqueKeys: options.uniqueKeys })
      : { completeness: 1, nullValueCounts: {} };

    // Check duplicates
    const duplicates = options.checkDuplicates
      ? this.checkDuplicates(data, options.uniqueKeys)
      : { hasDuplicates: false, duplicateCount: 0, duplicateGroups: [] };

    // Check outliers
    const outliers: OutlierInfo[] = [];
    if (options.checkOutliers && options.outlierFields) {
      options.outlierFields.forEach(field => {
        const fieldOutliers = this.detectOutliers(data, field, {
          method: 'iqr',
          threshold: 1.5,
        });
        outliers.push(...fieldOutliers);
      });
    }

    // Check custom rules
    if (options.customRules) {
      const violations = this.validateBusinessRules(data, options.customRules);
      validRecords -= violations.violations.length;
      
      Object.entries(violations.violationsByRule).forEach(([rule, count]) => {
        ruleViolations.push({ rule, violations: count });
      });
    }

    const invalidRecords = data.length - validRecords;

    return {
      summary: {
        totalRecords: data.length,
        validRecords,
        invalidRecords,
        validationScore: data.length > 0 ? (validRecords / data.length) * 100 : 0,
      },
      completeness,
      duplicates,
      outliers,
      ruleViolations,
      timestamp: new Date(),
    };
  }

  /**
   * Check for duplicate records
   */
  private checkDuplicates(
    data: any[],
    uniqueKeys?: string[]
  ): { hasDuplicates: boolean; duplicateCount: number; duplicateGroups: any[] } {
    if (!uniqueKeys || uniqueKeys.length === 0) {
      return { hasDuplicates: false, duplicateCount: 0, duplicateGroups: [] };
    }

    const groups = new Map<string, any[]>();
    
    data.forEach((record, index) => {
      const key = uniqueKeys.map(k => record[k]).join('-');
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push({ ...record, _index: index });
    });

    const duplicateGroups: any[] = [];
    let duplicateCount = 0;

    groups.forEach((group, key) => {
      if (group.length > 1) {
        duplicateGroups.push({
          key,
          count: group.length,
          records: group,
        });
        duplicateCount += group.length - 1;
      }
    });

    return {
      hasDuplicates: duplicateGroups.length > 0,
      duplicateCount,
      duplicateGroups: duplicateGroups.slice(0, 10), // Limit to first 10 groups
    };
  }
}