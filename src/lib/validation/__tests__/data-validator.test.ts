import { describe, it, expect, beforeEach } from 'vitest';
import { DataValidator, ValidationRule, ValidationResult, DataQualityMetrics } from '../data-validator';

describe('DataValidator', () => {
  let validator: DataValidator;

  beforeEach(() => {
    validator = new DataValidator();
  });

  describe('Schema Validation', () => {
    it('should validate data against expected schema', () => {
      const schema = {
        query: { type: 'string', required: true },
        asin: { type: 'string', required: true },
        total_impressions: { type: 'number', required: true, min: 0 },
        total_clicks: { type: 'number', required: true, min: 0 },
        total_purchases: { type: 'number', required: true, min: 0 },
      };

      const validData = {
        query: 'laptop stand',
        asin: 'B001',
        total_impressions: 1000,
        total_clicks: 50,
        total_purchases: 5,
      };

      const result = validator.validateSchema(validData, schema);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const schema = {
        query: { type: 'string', required: true },
        asin: { type: 'string', required: true },
      };

      const invalidData = {
        query: 'laptop stand',
        // missing asin
      };

      const result = validator.validateSchema(invalidData, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'asin',
        message: 'Required field missing',
      });
    });

    it('should detect type mismatches', () => {
      const schema = {
        total_impressions: { type: 'number', required: true },
      };

      const invalidData = {
        total_impressions: '1000', // string instead of number
      };

      const result = validator.validateSchema(invalidData, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'total_impressions',
        message: 'Type mismatch: expected number, got string',
      });
    });

    it('should validate numeric constraints', () => {
      const schema = {
        ctr: { type: 'number', required: true, min: 0, max: 1 },
      };

      const invalidData = {
        ctr: 1.5, // exceeds max
      };

      const result = validator.validateSchema(invalidData, schema);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'ctr',
        message: 'Value 1.5 exceeds maximum of 1',
      });
    });
  });

  describe('Data Quality Validation', () => {
    it('should calculate completeness metrics', () => {
      const records = [
        { query: 'laptop stand', asin: 'B001', impressions: 1000, clicks: 50 },
        { query: 'laptop stand', asin: 'B002', impressions: 500, clicks: null },
        { query: 'laptop stand', asin: 'B003', impressions: 300, clicks: 10 },
      ];

      const metrics = validator.calculateQualityMetrics(records);
      
      expect(metrics.completeness).toBeCloseTo(0.917); // 11 non-null out of 12 fields
      expect(metrics.nullValueCounts).toEqual({
        clicks: 1,
      });
    });

    it('should detect duplicate records', () => {
      const records = [
        { query: 'laptop stand', asin: 'B001', date: '2024-01-01' },
        { query: 'laptop stand', asin: 'B001', date: '2024-01-01' }, // duplicate
        { query: 'laptop stand', asin: 'B002', date: '2024-01-01' },
      ];

      const metrics = validator.calculateQualityMetrics(records, {
        uniqueKeys: ['query', 'asin', 'date'],
      });

      expect(metrics.duplicateCount).toBe(1);
      expect(metrics.uniqueRecords).toBe(2);
    });

    it('should validate business rules', () => {
      const rules: ValidationRule[] = [
        {
          name: 'CTR cannot exceed 1',
          validate: (record) => {
            const ctr = record.clicks / record.impressions;
            return ctr <= 1;
          },
        },
        {
          name: 'Purchases cannot exceed clicks',
          validate: (record) => record.purchases <= record.clicks,
        },
      ];

      const records = [
        { impressions: 1000, clicks: 50, purchases: 5 }, // valid
        { impressions: 100, clicks: 150, purchases: 10 }, // invalid CTR
        { impressions: 1000, clicks: 50, purchases: 100 }, // invalid purchases
      ];

      const result = validator.validateBusinessRules(records, rules);
      
      expect(result.violations).toHaveLength(2);
      expect(result.violationRate).toBeCloseTo(0.667);
      expect(result.violationsByRule).toEqual({
        'CTR cannot exceed 1': 1,
        'Purchases cannot exceed clicks': 1,
      });
    });
  });

  describe('Period Data Validation', () => {
    it('should validate period aggregation consistency', () => {
      const weeklyData = [
        { week: '2024-W01', query: 'laptop', asin: 'B001', impressions: 1000 },
        { week: '2024-W02', query: 'laptop', asin: 'B001', impressions: 1200 },
        { week: '2024-W03', query: 'laptop', asin: 'B001', impressions: 800 },
        { week: '2024-W04', query: 'laptop', asin: 'B001', impressions: 1000 },
      ];

      const monthlyData = [
        { month: '2024-01', query: 'laptop', asin: 'B001', impressions: 4000 },
      ];

      const result = validator.validatePeriodConsistency(weeklyData, monthlyData, {
        sourceField: 'impressions',
        targetField: 'impressions',
        aggregation: 'sum',
      });

      expect(result.isConsistent).toBe(true);
      expect(result.sourceTotal).toBe(4000);
      expect(result.targetTotal).toBe(4000);
      expect(result.difference).toBe(0);
    });

    it('should detect period aggregation discrepancies', () => {
      const weeklyData = [
        { week: '2024-W01', query: 'laptop', asin: 'B001', impressions: 1000 },
        { week: '2024-W02', query: 'laptop', asin: 'B001', impressions: 1200 },
      ];

      const monthlyData = [
        { month: '2024-01', query: 'laptop', asin: 'B001', impressions: 2500 }, // should be 2200
      ];

      const result = validator.validatePeriodConsistency(weeklyData, monthlyData, {
        sourceField: 'impressions',
        targetField: 'impressions',
        aggregation: 'sum',
      });

      expect(result.isConsistent).toBe(false);
      expect(result.difference).toBe(300);
      expect(result.differencePercent).toBeCloseTo(13.64);
    });
  });

  describe('Statistical Validation', () => {
    it('should detect outliers in numeric data', () => {
      const records = [
        { impressions: 1000 },
        { impressions: 1200 },
        { impressions: 900 },
        { impressions: 1100 },
        { impressions: 10000 }, // outlier
        { impressions: 950 },
      ];

      const outliers = validator.detectOutliers(records, 'impressions', {
        method: 'iqr',
        threshold: 1.5,
      });

      expect(outliers).toHaveLength(1);
      expect(outliers[0].value).toBe(10000);
      expect(outliers[0].reason).toContain('IQR');
    });

    it('should validate data distribution', () => {
      const records = Array(100).fill(null).map((_, i) => ({
        impressions: Math.floor(Math.random() * 1000) + 500,
      }));

      const distribution = validator.analyzeDistribution(records, 'impressions');

      expect(distribution).toMatchObject({
        mean: expect.any(Number),
        median: expect.any(Number),
        stdDev: expect.any(Number),
        min: expect.any(Number),
        max: expect.any(Number),
        q1: expect.any(Number),
        q3: expect.any(Number),
        skewness: expect.any(Number),
      });
    });
  });

  describe('Cross-Table Validation', () => {
    it('should validate referential integrity', () => {
      const sourceData = [
        { query: 'laptop', asin: 'B001' },
        { query: 'laptop', asin: 'B002' },
        { query: 'monitor', asin: 'B003' },
      ];

      const targetData = [
        { query: 'laptop', asin: 'B001', impressions: 1000 },
        { query: 'laptop', asin: 'B002', impressions: 500 },
        // B003 is missing - referential integrity violation
      ];

      const result = validator.validateReferentialIntegrity(
        sourceData,
        targetData,
        ['query', 'asin']
      );

      expect(result.isValid).toBe(false);
      expect(result.missingInTarget).toHaveLength(1);
      expect(result.missingInTarget[0]).toEqual({ query: 'monitor', asin: 'B003' });
    });
  });

  describe('Validation Report Generation', () => {
    it('should generate comprehensive validation report', () => {
      const data = [
        { query: 'laptop', asin: 'B001', impressions: 1000, clicks: 50 },
        { query: 'laptop', asin: 'B002', impressions: null, clicks: 20 },
      ];

      const report = validator.generateValidationReport(data, {
        checkCompleteness: true,
        checkDuplicates: true,
        checkOutliers: true,
        customRules: [
          {
            name: 'Positive impressions',
            validate: (r) => !r.impressions || r.impressions > 0,
          },
        ],
      });

      expect(report).toMatchObject({
        summary: {
          totalRecords: 2,
          validRecords: expect.any(Number),
          invalidRecords: expect.any(Number),
          validationScore: expect.any(Number),
        },
        completeness: expect.any(Object),
        duplicates: expect.any(Object),
        outliers: expect.any(Object),
        ruleViolations: expect.any(Array),
        timestamp: expect.any(Date),
      });
    });
  });
});