import {
  SQPRecord,
  ValidationResult,
  ValidationError,
  BatchValidationResult,
  DuplicateCheckResult,
  AnomalyDetectionResult,
  CompletenessResult,
  ValidatorConfig,
  BusinessRules,
} from '../types';

export class DataValidator {
  private config: ValidatorConfig;
  
  constructor(config?: ValidatorConfig) {
    this.config = config || {
      businessRules: {
        maxCTR: 1.0, // 100% CTR is technically possible but suspicious
        maxCVR: 1.0, // 100% CVR is technically possible but suspicious
        minQueryLength: 2,
      },
    };
  }

  /**
   * Validate a single SQP record
   */
  validateSQPRecord(record: Partial<SQPRecord>): ValidationResult {
    const errors: string[] = [];
    
    // Check required fields
    const requiredFields: (keyof SQPRecord)[] = [
      'query', 'asin', 'impressions', 'clicks', 'purchases', 'query_date'
    ];
    
    for (const field of requiredFields) {
      if (record[field] === undefined || record[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    // If missing required fields, return early
    if (errors.length > 0) {
      return { valid: false, errors };
    }
    
    // Validate ASIN format
    if (!this.isValidASIN(record.asin!)) {
      errors.push(`Invalid ASIN format: ${record.asin}`);
    }
    
    // Validate query
    if (record.query === '') {
      errors.push('Empty query string');
    } else if (record.query!.length < (this.config.businessRules?.minQueryLength || 2)) {
      errors.push(`Query too short (minimum ${this.config.businessRules?.minQueryLength} characters)`);
    }
    
    // Validate numeric values
    if (record.impressions! < 0) {
      errors.push(`Negative value for impressions: ${record.impressions}`);
    }
    if (record.clicks! < 0) {
      errors.push(`Negative value for clicks: ${record.clicks}`);
    }
    if (record.purchases! < 0) {
      errors.push(`Negative value for purchases: ${record.purchases}`);
    }
    
    // Validate logical relationships
    if (record.clicks! > record.impressions!) {
      errors.push(`Clicks (${record.clicks}) cannot exceed impressions (${record.impressions})`);
    }
    if (record.purchases! > record.clicks!) {
      errors.push(`Purchases (${record.purchases}) cannot exceed clicks (${record.clicks})`);
    }
    
    // Validate business rules
    if (record.impressions! > 0) {
      const ctr = record.clicks! / record.impressions!;
      const maxCTR = this.config.businessRules?.maxCTR || 1.0;
      
      if (ctr > maxCTR) {
        errors.push(`CTR (${ctr.toFixed(1)}) exceeds maximum allowed (${maxCTR})`);
      }
    }
    
    if (record.clicks! > 0) {
      const cvr = record.purchases! / record.clicks!;
      const maxCVR = this.config.businessRules?.maxCVR || 1.0;
      
      if (cvr > maxCVR) {
        errors.push(`CVR (${cvr.toFixed(1)}) exceeds maximum allowed (${maxCVR})`);
      }
    }
    
    // Validate date format
    if (!this.isValidDate(record.query_date!)) {
      errors.push(`Invalid date format for query_date: ${record.query_date}`);
    }
    
    // Apply custom validation rules
    if (this.config.customRules) {
      for (const rule of this.config.customRules) {
        const error = rule.validate(record as SQPRecord);
        if (error) {
          errors.push(error);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validate a batch of records
   */
  validateBatch(records: SQPRecord[]): BatchValidationResult {
    const errors: ValidationError[] = [];
    let validCount = 0;
    let invalidCount = 0;
    
    records.forEach((record, index) => {
      const result = this.validateSQPRecord(record);
      
      if (result.valid) {
        validCount++;
      } else {
        invalidCount++;
        errors.push({
          index,
          record,
          errors: result.errors!,
        });
      }
    });
    
    return {
      valid: invalidCount === 0,
      validCount,
      invalidCount,
      errors,
    };
  }

  /**
   * Check for duplicate records
   */
  checkDuplicates(records: SQPRecord[]): DuplicateCheckResult {
    const duplicateMap = new Map<string, number[]>();
    
    records.forEach((record, index) => {
      // Create a unique key based on query, asin, and date
      const key = `${record.query}|${record.asin}|${record.query_date}`;
      
      if (!duplicateMap.has(key)) {
        duplicateMap.set(key, []);
      }
      duplicateMap.get(key)!.push(index);
    });
    
    const duplicateGroups = Array.from(duplicateMap.entries())
      .filter(([_, indices]) => indices.length > 1)
      .map(([key, indices]) => ({
        key,
        indices,
        count: indices.length,
      }));
    
    return {
      hasDuplicates: duplicateGroups.length > 0,
      duplicateGroups,
    };
  }

  /**
   * Detect anomalies in data
   */
  detectAnomalies(records: SQPRecord[]): AnomalyDetectionResult[] {
    const anomalies: AnomalyDetectionResult[] = [];
    
    if (records.length < 2) return anomalies;
    
    // Group by query-asin combination
    const groups = this.groupRecords(records);
    
    for (const [key, groupRecords] of groups) {
      // Sort by date
      const sorted = groupRecords.sort((a, b) => 
        a.record.query_date.localeCompare(b.record.query_date)
      );
      
      // Check for spikes
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1].record;
        const curr = sorted[i].record;
        
        // Check impression spike
        if (prev.impressions > 0) {
          const impressionChange = curr.impressions / prev.impressions;
          if (impressionChange > 10) {
            anomalies.push({
              index: sorted[i].index,
              record: curr,
              reason: `Unusual spike in impressions (${impressionChange.toFixed(1)}x increase)`,
              severity: impressionChange > 50 ? 'high' : 'medium',
            });
          }
        }
        
        // Check CTR anomaly
        const prevCTR = prev.impressions > 0 ? prev.clicks / prev.impressions : 0;
        const currCTR = curr.impressions > 0 ? curr.clicks / curr.impressions : 0;
        
        if (prevCTR > 0 && Math.abs(currCTR - prevCTR) / prevCTR > 2) {
          anomalies.push({
            index: sorted[i].index,
            record: curr,
            reason: `Unusual CTR change (from ${(prevCTR * 100).toFixed(1)}% to ${(currCTR * 100).toFixed(1)}%)`,
            severity: 'medium',
          });
        }
      }
    }
    
    // Check for statistical outliers
    const impressions = records.map(r => r.impressions);
    const outlierIndices = this.findOutliers(impressions);
    
    for (const index of outlierIndices) {
      anomalies.push({
        index,
        record: records[index],
        reason: 'Statistical outlier in impressions',
        severity: 'low',
      });
    }
    
    return anomalies;
  }

  /**
   * Check data completeness
   */
  checkCompleteness(records: SQPRecord[]): CompletenessResult {
    const optionalFields: (keyof SQPRecord)[] = [
      'updated_at', 'click_share', 'purchase_share'
    ];
    
    const missingFieldCounts: Record<string, number> = {};
    let recordsWithMissingFields = 0;
    
    for (const record of records) {
      let hasMissing = false;
      
      for (const field of optionalFields) {
        if (record[field] === undefined || record[field] === null) {
          missingFieldCounts[field] = (missingFieldCounts[field] || 0) + 1;
          hasMissing = true;
        }
      }
      
      if (hasMissing) {
        recordsWithMissingFields++;
      }
    }
    
    const totalFields = records.length * optionalFields.length;
    const missingCount = Object.values(missingFieldCounts).reduce((sum, count) => sum + count, 0);
    const completenessScore = 1 - (missingCount / totalFields);
    
    return {
      completenessScore,
      missingFields: Object.keys(missingFieldCounts),
      recordsWithMissingFields,
    };
  }

  /**
   * Private helper methods
   */
  private isValidASIN(asin: string): boolean {
    return /^B[0-9A-Z]{9}$/.test(asin);
  }

  private isValidDate(date: string): boolean {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }

  private groupRecords(
    records: SQPRecord[]
  ): Map<string, Array<{ record: SQPRecord; index: number }>> {
    const groups = new Map<string, Array<{ record: SQPRecord; index: number }>>();
    
    records.forEach((record, index) => {
      const key = `${record.query}|${record.asin}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push({ record, index });
    });
    
    return groups;
  }

  private findOutliers(values: number[]): number[] {
    if (values.length < 4) return [];
    
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(values.length * 0.25)];
    const q3 = sorted[Math.floor(values.length * 0.75)];
    const iqr = q3 - q1;
    
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    const outlierIndices: number[] = [];
    values.forEach((value, index) => {
      if (value < lowerBound || value > upperBound) {
        outlierIndices.push(index);
      }
    });
    
    return outlierIndices;
  }

  /**
   * Create custom validator with specific rules
   */
  static createWithBusinessRules(rules: BusinessRules): DataValidator {
    return new DataValidator({
      businessRules: rules,
    });
  }

  /**
   * Create validator for high-value keywords
   */
  static createHighValueValidator(): DataValidator {
    return new DataValidator({
      businessRules: {
        maxCTR: 0.3, // 30% max CTR for high-value keywords
        maxCVR: 0.2, // 20% max CVR
        minQueryLength: 3,
      },
      customRules: [
        {
          name: 'minimum_impressions',
          validate: (record) => {
            return record.impressions < 100 
              ? 'High-value keywords should have at least 100 impressions' 
              : null;
          },
        },
        {
          name: 'purchase_quality',
          validate: (record) => {
            if (record.purchases > 0 && record.clicks < 5) {
              return 'Suspicious: purchases with very few clicks';
            }
            return null;
          },
        },
      ],
    });
  }
}