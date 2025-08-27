import { format } from 'date-fns';
import {
  InspectionReport,
  ASINDistribution,
  SamplingStrategy,
  TableField,
  DataQualityComparison,
  DataStructureValidation,
} from '@/lib/bigquery/types';
import { ComparisonResult } from '@/lib/comparison/data-comparator';
import { ValidationReport } from '@/lib/validation/data-validator';

export interface ReportOptions {
  format: 'markdown' | 'html' | 'json';
  includeCharts?: boolean;
  includeSamples?: boolean;
  maxSampleSize?: number;
}

export interface InspectionReportData {
  inspection?: InspectionReport;
  qualityComparison?: DataQualityComparison;
  validationReport?: ValidationReport;
  comparisonResults?: ComparisonResult[];
  structureValidation?: DataStructureValidation;
}

export class InspectionReportGenerator {
  /**
   * Generate a comprehensive inspection report
   */
  generateReport(
    data: InspectionReportData,
    options: ReportOptions
  ): string {
    switch (options.format) {
      case 'markdown':
        return this.generateMarkdownReport(data, options);
      case 'html':
        return this.generateHTMLReport(data, options);
      case 'json':
        return JSON.stringify(data, null, 2);
      default:
        return this.generateMarkdownReport(data, options);
    }
  }

  /**
   * Generate Markdown format report
   */
  private generateMarkdownReport(
    data: InspectionReportData,
    options: ReportOptions
  ): string {
    let report = '# BigQuery to Supabase Data Inspection Report\n\n';
    report += `Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}\n\n`;

    // Table of Contents
    report += '## Table of Contents\n\n';
    report += '1. [Executive Summary](#executive-summary)\n';
    report += '2. [Schema Analysis](#schema-analysis)\n';
    report += '3. [ASIN Distribution Analysis](#asin-distribution-analysis)\n';
    report += '4. [Sampling Strategies](#sampling-strategies)\n';
    report += '5. [Data Quality Comparison](#data-quality-comparison)\n';
    report += '6. [Validation Results](#validation-results)\n';
    report += '7. [Recommendations](#recommendations)\n\n';

    // Executive Summary
    report += '## Executive Summary\n\n';
    report += this.generateExecutiveSummary(data);

    // Schema Analysis
    if (data.inspection?.schemas) {
      report += '## Schema Analysis\n\n';
      report += this.generateSchemaAnalysis(data.inspection.schemas);
    }

    // ASIN Distribution Analysis
    if (data.inspection?.distributions) {
      report += '## ASIN Distribution Analysis\n\n';
      report += this.generateDistributionAnalysis(data.inspection.distributions, options);
    }

    // Sampling Strategies
    if (data.inspection?.samplingStrategies) {
      report += '## Sampling Strategies\n\n';
      report += this.generateSamplingStrategies(data.inspection.samplingStrategies);
    }

    // Data Quality Comparison
    if (data.qualityComparison) {
      report += '## Data Quality Comparison\n\n';
      report += this.generateQualityComparison(data.qualityComparison);
    }

    // Validation Results
    if (data.validationReport) {
      report += '## Validation Results\n\n';
      report += this.generateValidationResults(data.validationReport);
    }

    // Recommendations
    report += '## Recommendations\n\n';
    report += this.generateRecommendations(data);

    return report;
  }

  /**
   * Generate HTML format report
   */
  private generateHTMLReport(
    data: InspectionReportData,
    options: ReportOptions
  ): string {
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BigQuery to Supabase Data Inspection Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        h1, h2, h3 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .metric { display: inline-block; margin: 10px 20px; }
        .metric-label { font-weight: bold; }
        .metric-value { font-size: 1.2em; color: #0066cc; }
        .warning { color: #ff6600; }
        .success { color: #00cc00; }
        .error { color: #cc0000; }
    </style>
</head>
<body>
    <h1>BigQuery to Supabase Data Inspection Report</h1>
    <p>Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}</p>
`;

    // Add content sections
    html += '<h2>Executive Summary</h2>';
    html += `<div>${this.generateExecutiveSummary(data).replace(/\n/g, '<br>')}</div>`;

    if (data.inspection?.schemas) {
      html += '<h2>Schema Analysis</h2>';
      html += this.generateSchemaHTML(data.inspection.schemas);
    }

    if (data.inspection?.distributions) {
      html += '<h2>ASIN Distribution Analysis</h2>';
      html += this.generateDistributionHTML(data.inspection.distributions);
    }

    if (data.qualityComparison) {
      html += '<h2>Data Quality Comparison</h2>';
      html += this.generateQualityComparisonHTML(data.qualityComparison);
    }

    html += `</body></html>`;
    return html;
  }

  /**
   * Generate executive summary
   */
  private generateExecutiveSummary(data: InspectionReportData): string {
    let summary = '';
    
    // Key metrics
    if (data.inspection) {
      const totalQueries = Object.keys(data.inspection.distributions || {}).length;
      summary += `- **Queries Analyzed**: ${totalQueries}\n`;
      summary += `- **Date Range**: ${format(data.inspection.config.dateRange.start, 'yyyy-MM-dd')} to ${format(data.inspection.config.dateRange.end, 'yyyy-MM-dd')}\n`;
    }

    if (data.qualityComparison) {
      const completeness = data.qualityComparison.quality.dataCompleteness;
      summary += `- **Data Completeness**: ${completeness.toFixed(2)}%\n`;
      summary += `- **Schema Consistency**: ${data.qualityComparison.quality.schemaConsistency ? '✓ Consistent' : '✗ Inconsistent'}\n`;
    }

    if (data.validationReport) {
      const score = data.validationReport.summary.validationScore;
      summary += `- **Validation Score**: ${score.toFixed(2)}%\n`;
    }

    summary += '\n';
    return summary;
  }

  /**
   * Generate schema analysis section
   */
  private generateSchemaAnalysis(schemas: Record<string, TableField[]>): string {
    let analysis = '';

    Object.entries(schemas).forEach(([tableName, fields]) => {
      analysis += `### ${tableName}\n\n`;
      analysis += '| Field | Type | Mode | Description |\n';
      analysis += '|-------|------|------|-------------|\n';
      
      fields.forEach(field => {
        analysis += `| ${field.name} | ${field.type} | ${field.mode || 'NULLABLE'} | ${field.description || '-'} |\n`;
      });
      
      analysis += '\n';
    });

    return analysis;
  }

  /**
   * Generate distribution analysis section
   */
  private generateDistributionAnalysis(
    distributions: Record<string, ASINDistribution>,
    options: ReportOptions
  ): string {
    let analysis = '';

    Object.entries(distributions).forEach(([queryKey, distribution]) => {
      analysis += `### Query: "${distribution.query}"\n\n`;
      
      // Summary metrics
      analysis += '#### Summary Metrics\n\n';
      analysis += `- **Total ASINs**: ${distribution.totalASINs}\n`;
      analysis += `- **Average ASINs per Day**: ${distribution.metrics.avgASINsPerDay.toFixed(2)}\n`;
      analysis += `- **Total Impressions**: ${distribution.metrics.totalImpressions.toLocaleString()}\n`;
      analysis += `- **Total Clicks**: ${distribution.metrics.totalClicks.toLocaleString()}\n`;
      analysis += `- **Total Purchases**: ${distribution.metrics.totalPurchases.toLocaleString()}\n`;
      analysis += '\n';

      // Top ASINs
      if (options.includeSamples && distribution.topASINs.length > 0) {
        analysis += '#### Top ASINs by Impressions\n\n';
        analysis += '| Rank | ASIN | Impressions | Clicks | Purchases | CTR | CVR |\n';
        analysis += '|------|------|-------------|--------|-----------|-----|-----|\n';
        
        const sampleSize = options.maxSampleSize || 10;
        distribution.topASINs.slice(0, sampleSize).forEach(asin => {
          const ctr = asin.impressions > 0 ? (asin.clicks / asin.impressions * 100).toFixed(2) : '0.00';
          const cvr = asin.clicks > 0 ? (asin.purchases / asin.clicks * 100).toFixed(2) : '0.00';
          
          analysis += `| ${asin.rank} | ${asin.asin} | ${asin.impressions.toLocaleString()} | ${asin.clicks.toLocaleString()} | ${asin.purchases.toLocaleString()} | ${ctr}% | ${cvr}% |\n`;
        });
        
        analysis += '\n';
      }
    });

    return analysis;
  }

  /**
   * Generate sampling strategies section
   */
  private generateSamplingStrategies(
    strategies: Record<string, Record<string, SamplingStrategy>>
  ): string {
    let section = '';

    Object.entries(strategies).forEach(([queryKey, queryStrategies]) => {
      section += `### Strategies for Query: "${queryKey}"\n\n`;
      section += '| Strategy | Description | Estimated Rows | ASINs |\n';
      section += '|----------|-------------|----------------|-------|\n';
      
      Object.entries(queryStrategies).forEach(([strategyName, strategy]) => {
        const asinsDisplay = strategy.asins 
          ? `${strategy.asins.length} specific` 
          : 'All';
          
        section += `| ${strategy.name} | ${strategy.description} | ${strategy.estimatedRows.toLocaleString()} | ${asinsDisplay} |\n`;
      });
      
      section += '\n';
    });

    return section;
  }

  /**
   * Generate data quality comparison section
   */
  private generateQualityComparison(comparison: DataQualityComparison): string {
    let section = '### Row Count Comparison\n\n';
    
    section += '| Metric | BigQuery | Supabase | Difference | % Diff |\n';
    section += '|--------|----------|----------|------------|--------|\n';
    section += `| Total Rows | ${comparison.bigquery.totalRows.toLocaleString()} | ${comparison.supabase.totalRows.toLocaleString()} | ${comparison.discrepancies.rowCountDiff.toLocaleString()} | ${comparison.discrepancies.rowCountDiffPercent.toFixed(2)}% |\n`;
    section += `| Distinct Queries | ${comparison.bigquery.distinctQueries.toLocaleString()} | ${comparison.supabase.distinctQueries.toLocaleString()} | ${comparison.discrepancies.queryCountDiff.toLocaleString()} | - |\n`;
    section += `| Distinct ASINs | ${comparison.bigquery.distinctASINs.toLocaleString()} | ${comparison.supabase.distinctASINs.toLocaleString()} | ${comparison.discrepancies.asinCountDiff.toLocaleString()} | ${comparison.discrepancies.asinCountDiffPercent.toFixed(2)}% |\n`;
    
    section += '\n### Quality Metrics\n\n';
    section += `- **Data Completeness**: ${comparison.quality.dataCompleteness.toFixed(2)}%\n`;
    section += `- **Schema Consistency**: ${comparison.quality.schemaConsistency ? 'Yes' : 'No'}\n`;
    section += `- **Has Discrepancies**: ${comparison.quality.hasDiscrepancies ? 'Yes' : 'No'}\n`;
    
    section += '\n';
    return section;
  }

  /**
   * Generate validation results section
   */
  private generateValidationResults(validation: ValidationReport): string {
    let section = '### Validation Summary\n\n';
    
    section += `- **Total Records**: ${validation.summary.totalRecords.toLocaleString()}\n`;
    section += `- **Valid Records**: ${validation.summary.validRecords.toLocaleString()}\n`;
    section += `- **Invalid Records**: ${validation.summary.invalidRecords.toLocaleString()}\n`;
    section += `- **Validation Score**: ${validation.summary.validationScore.toFixed(2)}%\n`;
    
    section += '\n### Data Completeness\n\n';
    section += `- **Completeness Score**: ${(validation.completeness.completeness * 100).toFixed(2)}%\n`;
    
    if (validation.completeness.nullValueCounts) {
      section += '\n**Null Value Counts by Field**:\n\n';
      Object.entries(validation.completeness.nullValueCounts).forEach(([field, count]) => {
        if (count > 0) {
          section += `- ${field}: ${count} nulls\n`;
        }
      });
    }
    
    if (validation.duplicates.hasDuplicates) {
      section += '\n### Duplicates Found\n\n';
      section += `- **Duplicate Records**: ${validation.duplicates.duplicateCount}\n`;
      section += `- **Duplicate Groups**: ${validation.duplicates.duplicateGroups.length}\n`;
    }
    
    if (validation.outliers.length > 0) {
      section += '\n### Outliers Detected\n\n';
      section += `Found ${validation.outliers.length} outliers in the data.\n`;
    }
    
    section += '\n';
    return section;
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(data: InspectionReportData): string {
    const recommendations: string[] = [];
    
    // Add predefined recommendations from inspection
    if (data.inspection?.recommendations) {
      recommendations.push(...data.inspection.recommendations);
    }
    
    // Add recommendations based on quality comparison
    if (data.qualityComparison) {
      if (data.qualityComparison.discrepancies.rowCountDiffPercent > 5) {
        recommendations.push(
          `⚠️ Significant row count difference (${data.qualityComparison.discrepancies.rowCountDiffPercent.toFixed(2)}%) detected between BigQuery and Supabase. Investigate data sync process.`
        );
      }
      
      if (data.qualityComparison.quality.dataCompleteness < 95) {
        recommendations.push(
          `⚠️ Data completeness is ${data.qualityComparison.quality.dataCompleteness.toFixed(2)}%. Consider implementing retry mechanisms for failed syncs.`
        );
      }
    }
    
    // Add recommendations based on validation
    if (data.validationReport) {
      if (data.validationReport.summary.validationScore < 90) {
        recommendations.push(
          `⚠️ Low validation score (${data.validationReport.summary.validationScore.toFixed(2)}%). Review data quality rules and fix validation errors.`
        );
      }
      
      if (data.validationReport.duplicates.hasDuplicates) {
        recommendations.push(
          `⚠️ Found ${data.validationReport.duplicates.duplicateCount} duplicate records. Implement deduplication in sync process.`
        );
      }
    }
    
    // Format recommendations
    let section = '';
    if (recommendations.length === 0) {
      section += '✅ No critical issues found. Data sync appears to be functioning correctly.\n';
    } else {
      recommendations.forEach((rec, index) => {
        section += `${index + 1}. ${rec}\n`;
      });
    }
    
    return section;
  }

  /**
   * Generate schema HTML table
   */
  private generateSchemaHTML(schemas: Record<string, TableField[]>): string {
    let html = '';
    
    Object.entries(schemas).forEach(([tableName, fields]) => {
      html += `<h3>${tableName}</h3>`;
      html += '<table>';
      html += '<tr><th>Field</th><th>Type</th><th>Mode</th><th>Description</th></tr>';
      
      fields.forEach(field => {
        html += `<tr>`;
        html += `<td>${field.name}</td>`;
        html += `<td>${field.type}</td>`;
        html += `<td>${field.mode || 'NULLABLE'}</td>`;
        html += `<td>${field.description || '-'}</td>`;
        html += `</tr>`;
      });
      
      html += '</table>';
    });
    
    return html;
  }

  /**
   * Generate distribution HTML
   */
  private generateDistributionHTML(distributions: Record<string, ASINDistribution>): string {
    let html = '';
    
    Object.entries(distributions).forEach(([queryKey, distribution]) => {
      html += `<h3>Query: "${distribution.query}"</h3>`;
      
      html += '<div class="metrics">';
      html += `<div class="metric"><span class="metric-label">Total ASINs:</span> <span class="metric-value">${distribution.totalASINs}</span></div>`;
      html += `<div class="metric"><span class="metric-label">Total Impressions:</span> <span class="metric-value">${distribution.metrics.totalImpressions.toLocaleString()}</span></div>`;
      html += `<div class="metric"><span class="metric-label">Total Clicks:</span> <span class="metric-value">${distribution.metrics.totalClicks.toLocaleString()}</span></div>`;
      html += `<div class="metric"><span class="metric-label">Total Purchases:</span> <span class="metric-value">${distribution.metrics.totalPurchases.toLocaleString()}</span></div>`;
      html += '</div>';
      
      if (distribution.topASINs.length > 0) {
        html += '<h4>Top 10 ASINs</h4>';
        html += '<table>';
        html += '<tr><th>Rank</th><th>ASIN</th><th>Impressions</th><th>Clicks</th><th>Purchases</th></tr>';
        
        distribution.topASINs.slice(0, 10).forEach(asin => {
          html += `<tr>`;
          html += `<td>${asin.rank}</td>`;
          html += `<td>${asin.asin}</td>`;
          html += `<td>${asin.impressions.toLocaleString()}</td>`;
          html += `<td>${asin.clicks.toLocaleString()}</td>`;
          html += `<td>${asin.purchases.toLocaleString()}</td>`;
          html += `</tr>`;
        });
        
        html += '</table>';
      }
    });
    
    return html;
  }

  /**
   * Generate quality comparison HTML
   */
  private generateQualityComparisonHTML(comparison: DataQualityComparison): string {
    let html = '<table>';
    html += '<tr><th>Metric</th><th>BigQuery</th><th>Supabase</th><th>Difference</th></tr>';
    
    html += `<tr>`;
    html += `<td>Total Rows</td>`;
    html += `<td>${comparison.bigquery.totalRows.toLocaleString()}</td>`;
    html += `<td>${comparison.supabase.totalRows.toLocaleString()}</td>`;
    html += `<td class="${comparison.discrepancies.rowCountDiff > 0 ? 'warning' : 'success'}">${comparison.discrepancies.rowCountDiff.toLocaleString()} (${comparison.discrepancies.rowCountDiffPercent.toFixed(2)}%)</td>`;
    html += `</tr>`;
    
    html += `<tr>`;
    html += `<td>Distinct Queries</td>`;
    html += `<td>${comparison.bigquery.distinctQueries.toLocaleString()}</td>`;
    html += `<td>${comparison.supabase.distinctQueries.toLocaleString()}</td>`;
    html += `<td class="${comparison.discrepancies.queryCountDiff > 0 ? 'warning' : 'success'}">${comparison.discrepancies.queryCountDiff.toLocaleString()}</td>`;
    html += `</tr>`;
    
    html += `<tr>`;
    html += `<td>Distinct ASINs</td>`;
    html += `<td>${comparison.bigquery.distinctASINs.toLocaleString()}</td>`;
    html += `<td>${comparison.supabase.distinctASINs.toLocaleString()}</td>`;
    html += `<td class="${comparison.discrepancies.asinCountDiff > 0 ? 'warning' : 'success'}">${comparison.discrepancies.asinCountDiff.toLocaleString()} (${comparison.discrepancies.asinCountDiffPercent.toFixed(2)}%)</td>`;
    html += `</tr>`;
    
    html += '</table>';
    
    return html;
  }
}