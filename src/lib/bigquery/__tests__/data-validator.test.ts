import { describe, it, expect } from 'vitest';
import { DataValidator } from '../validators/data-validator';
import { SQPRecord, ValidationResult } from '../types';

describe('DataValidator', () => {
  let validator: DataValidator;

  beforeEach(() => {
    validator = new DataValidator();
  });

  describe('SQP Record Validation', () => {
    it('should validate a valid SQP record', () => {
      const record: SQPRecord = {
        query: 'yoga mat',
        asin: 'B001234567',
        impressions: 1000,
        clicks: 50,
        purchases: 5,
        query_date: '2024-01-15',
        updated_at: '2024-01-15T10:00:00Z',
      };

      const result = validator.validateSQPRecord(record);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject records with missing required fields', () => {
      const record: Partial<SQPRecord> = {
        query: 'yoga mat',
        impressions: 1000,
        // Missing: asin, clicks, purchases, query_date
      };

      const result = validator.validateSQPRecord(record as SQPRecord);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: asin');
      expect(result.errors).toContain('Missing required field: clicks');
    });

    it('should reject records with invalid ASIN format', () => {
      const record: SQPRecord = {
        query: 'yoga mat',
        asin: 'invalid-asin',
        impressions: 1000,
        clicks: 50,
        purchases: 5,
        query_date: '2024-01-15',
      };

      const result = validator.validateSQPRecord(record);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid ASIN format: invalid-asin');
    });

    it('should reject records with negative metrics', () => {
      const record: SQPRecord = {
        query: 'yoga mat',
        asin: 'B001234567',
        impressions: -100,
        clicks: 50,
        purchases: -5,
        query_date: '2024-01-15',
      };

      const result = validator.validateSQPRecord(record);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Negative value for impressions: -100');
      expect(result.errors).toContain('Negative value for purchases: -5');
    });

    it('should reject records with illogical metrics', () => {
      const record: SQPRecord = {
        query: 'yoga mat',
        asin: 'B001234567',
        impressions: 100,
        clicks: 150, // More clicks than impressions
        purchases: 200, // More purchases than clicks
        query_date: '2024-01-15',
      };

      const result = validator.validateSQPRecord(record);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Clicks (150) cannot exceed impressions (100)');
      expect(result.errors).toContain('Purchases (200) cannot exceed clicks (150)');
    });

    it('should reject records with empty query', () => {
      const record: SQPRecord = {
        query: '',
        asin: 'B001234567',
        impressions: 1000,
        clicks: 50,
        purchases: 5,
        query_date: '2024-01-15',
      };

      const result = validator.validateSQPRecord(record);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Empty query string');
    });

    it('should validate date format', () => {
      const record: SQPRecord = {
        query: 'yoga mat',
        asin: 'B001234567',
        impressions: 1000,
        clicks: 50,
        purchases: 5,
        query_date: 'invalid-date',
      };

      const result = validator.validateSQPRecord(record);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid date format for query_date: invalid-date');
    });
  });

  describe('Batch Validation', () => {
    it('should validate a batch of records', () => {
      const records: SQPRecord[] = [
        {
          query: 'yoga mat',
          asin: 'B001234567',
          impressions: 1000,
          clicks: 50,
          purchases: 5,
          query_date: '2024-01-15',
        },
        {
          query: 'exercise mat',
          asin: 'B007654321',
          impressions: 500,
          clicks: 25,
          purchases: 2,
          query_date: '2024-01-15',
        },
      ];

      const result = validator.validateBatch(records);
      
      expect(result.valid).toBe(true);
      expect(result.validCount).toBe(2);
      expect(result.invalidCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should report errors for invalid records in batch', () => {
      const records: SQPRecord[] = [
        {
          query: 'yoga mat',
          asin: 'B001234567',
          impressions: 1000,
          clicks: 50,
          purchases: 5,
          query_date: '2024-01-15',
        },
        {
          query: '',
          asin: 'invalid',
          impressions: -100,
          clicks: 50,
          purchases: 5,
          query_date: '2024-01-15',
        },
      ];

      const result = validator.validateBatch(records);
      
      expect(result.valid).toBe(false);
      expect(result.validCount).toBe(1);
      expect(result.invalidCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].index).toBe(1);
      expect(result.errors[0].errors).toContain('Empty query string');
    });
  });

  describe('Custom Validation Rules', () => {
    it('should apply custom validation rules', () => {
      const customValidator = new DataValidator({
        customRules: [
          {
            name: 'minimum_ctr',
            validate: (record: SQPRecord) => {
              const ctr = record.clicks / record.impressions;
              return ctr >= 0.001 ? null : 'CTR below minimum threshold';
            },
          },
        ],
      });

      const record: SQPRecord = {
        query: 'yoga mat',
        asin: 'B001234567',
        impressions: 10000,
        clicks: 5, // CTR = 0.0005
        purchases: 0,
        query_date: '2024-01-15',
      };

      const result = customValidator.validateSQPRecord(record);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('CTR below minimum threshold');
    });

    it('should validate business logic rules', () => {
      const businessValidator = new DataValidator({
        businessRules: {
          maxCTR: 0.5, // 50% max CTR
          maxCVR: 0.3, // 30% max CVR
          minQueryLength: 3,
        },
      });

      const record: SQPRecord = {
        query: 'ab', // Too short
        asin: 'B001234567',
        impressions: 100,
        clicks: 60, // 60% CTR - too high
        purchases: 30, // 50% CVR - too high
        query_date: '2024-01-15',
      };

      const result = businessValidator.validateSQPRecord(record);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Query too short (minimum 3 characters)');
      expect(result.errors).toContain('CTR (0.6) exceeds maximum allowed (0.5)');
      expect(result.errors).toContain('CVR (0.5) exceeds maximum allowed (0.3)');
    });
  });

  describe('Data Quality Checks', () => {
    it('should check for duplicate records', () => {
      const records: SQPRecord[] = [
        {
          query: 'yoga mat',
          asin: 'B001234567',
          impressions: 1000,
          clicks: 50,
          purchases: 5,
          query_date: '2024-01-15',
        },
        {
          query: 'yoga mat',
          asin: 'B001234567',
          impressions: 1000,
          clicks: 50,
          purchases: 5,
          query_date: '2024-01-15',
        },
      ];

      const result = validator.checkDuplicates(records);
      
      expect(result.hasDuplicates).toBe(true);
      expect(result.duplicateGroups).toHaveLength(1);
      expect(result.duplicateGroups[0].indices).toEqual([0, 1]);
    });

    it('should detect anomalies in data', () => {
      const records: SQPRecord[] = [
        { query: 'yoga mat', impressions: 1000, clicks: 50, purchases: 5, asin: 'B001', query_date: '2024-01-15' },
        { query: 'yoga mat', impressions: 1100, clicks: 55, purchases: 6, asin: 'B001', query_date: '2024-01-16' },
        { query: 'yoga mat', impressions: 50000, clicks: 2500, purchases: 250, asin: 'B001', query_date: '2024-01-17' }, // Anomaly
      ];

      const anomalies = validator.detectAnomalies(records);
      
      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].index).toBe(2);
      expect(anomalies[0].reason).toContain('Unusual spike in impressions');
    });

    it('should validate data completeness', () => {
      const records: SQPRecord[] = [
        {
          query: 'yoga mat',
          asin: 'B001234567',
          impressions: 1000,
          clicks: 50,
          purchases: 5,
          query_date: '2024-01-15',
          // Missing optional fields
        },
      ];

      const completeness = validator.checkCompleteness(records);
      
      expect(completeness.missingFields).toContain('updated_at');
      expect(completeness.completenessScore).toBeLessThan(1);
    });
  });

  describe('Performance', () => {
    it('should validate large batches efficiently', () => {
      const largeRecords = new Array(10000).fill(0).map((_, i) => ({
        query: `keyword ${i}`,
        asin: 'B001234567',
        impressions: 1000 + i,
        clicks: 50,
        purchases: 5,
        query_date: '2024-01-15',
      }));

      const start = Date.now();
      const result = validator.validateBatch(largeRecords);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(1000); // Should process 10k records in under 1 second
      expect(result.validCount).toBe(10000);
    });
  });
});