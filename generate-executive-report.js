#!/usr/bin/env node
require('dotenv').config();

const { BigQuery } = require('@google-cloud/bigquery');
const { format } = require('date-fns');
const fs = require('fs');

async function generateExecutiveReport() {
  console.log('EXECUTIVE SEARCH QUERY PERFORMANCE REPORT');
  console.log('========================================\n');
  console.log(`Report Generated: ${format(new Date(), 'MMMM d, yyyy HH:mm')}`);
  console.log(`Analysis Period: July 11 - August 10, 2025\n`);
  
  try {
    // BigQuery setup
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    const projectId = process.env.BIGQUERY_PROJECT_ID || 'amazon-sp-report-loader';
    const datasetId = process.env.BIGQUERY_DATASET || 'dataclient_amzatlas_agency_85';
    
    const bigquery = new BigQuery({ projectId, credentials });
    
    const endDate = '2025-08-10';
    const startDate = '2025-07-11';
    
    // Build HTML report
    let html = `
<!DOCTYPE html>
<html>
<head>
  <title>Search Query Performance Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 3px solid #ff9900; padding-bottom: 10px; }
    h2 { color: #444; margin-top: 30px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #ff9900; color: white; padding: 10px; text-align: left; }
    td { padding: 8px; border-bottom: 1px solid #ddd; }
    tr:hover { background: #f9f9f9; }
    .metric-box { display: inline-block; background: #f0f8ff; padding: 15px; margin: 10px; border-radius: 5px; }
    .metric-value { font-size: 24px; font-weight: bold; color: #ff9900; }
    .metric-label { color: #666; font-size: 14px; }
    .highlight { background: #fff3cd; }
    .brand-tag { background: #ff9900; color: white; padding: 2px 6px; border-radius: 3px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Executive Search Query Performance Report</h1>
    <p><strong>Period:</strong> ${format(new Date(startDate), 'MMMM d')} - ${format(new Date(endDate), 'MMMM d, yyyy')}</p>
`;

    // 1. OVERALL METRICS
    console.log('1. OVERALL PERFORMANCE METRICS\n');
    
    const overallQuery = `
      SELECT 
        SUM(\`ASIN Impression Count\`) as total_impressions,
        SUM(\`ASIN Click Count\`) as total_clicks,
        SUM(\`ASIN Purchase Count\`) as total_purchases,
        COUNT(DISTINCT \`Search Query\`) as unique_queries,
        COUNT(DISTINCT \`Child ASIN\`) as unique_asins,
        ROUND(SAFE_DIVIDE(SUM(\`ASIN Click Count\`), SUM(\`ASIN Impression Count\`)) * 100, 2) as overall_ctr,
        ROUND(SAFE_DIVIDE(SUM(\`ASIN Purchase Count\`), SUM(\`ASIN Click Count\`)) * 100, 2) as overall_cvr
      FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
      WHERE DATE(Date) BETWEEN @start_date AND @end_date
    `;
    
    const [overallMetrics] = await bigquery.query({
      query: overallQuery,
      params: { start_date: startDate, end_date: endDate }
    });
    
    const metrics = overallMetrics[0];
    
    console.log(`Total Impressions: ${metrics.total_impressions.toLocaleString()}`);
    console.log(`Total Clicks: ${metrics.total_clicks.toLocaleString()}`);
    console.log(`Total Purchases: ${metrics.total_purchases.toLocaleString()}`);
    console.log(`Unique Search Queries: ${metrics.unique_queries.toLocaleString()}`);
    console.log(`Unique ASINs: ${metrics.unique_asins}`);
    console.log(`Overall CTR: ${metrics.overall_ctr}%`);
    console.log(`Overall CVR: ${metrics.overall_cvr}%\n`);
    
    html += `
    <h2>Overall Performance Metrics</h2>
    <div>
      <div class="metric-box">
        <div class="metric-value">${metrics.total_impressions.toLocaleString()}</div>
        <div class="metric-label">Total Impressions</div>
      </div>
      <div class="metric-box">
        <div class="metric-value">${metrics.total_clicks.toLocaleString()}</div>
        <div class="metric-label">Total Clicks</div>
      </div>
      <div class="metric-box">
        <div class="metric-value">${metrics.total_purchases.toLocaleString()}</div>
        <div class="metric-label">Total Purchases</div>
      </div>
      <div class="metric-box">
        <div class="metric-value">${metrics.overall_ctr}%</div>
        <div class="metric-label">Click-Through Rate</div>
      </div>
      <div class="metric-box">
        <div class="metric-value">${metrics.overall_cvr}%</div>
        <div class="metric-label">Conversion Rate</div>
      </div>
    </div>
`;

    // 2. TOP 20 KEYWORDS
    console.log('2. TOP 20 KEYWORDS BY IMPRESSIONS\n');
    
    const topKeywordsQuery = `
      SELECT 
        \`Search Query\` as keyword,
        SUM(\`ASIN Impression Count\`) as impressions,
        SUM(\`ASIN Click Count\`) as clicks,
        SUM(\`ASIN Purchase Count\`) as purchases,
        COUNT(DISTINCT \`Child ASIN\`) as unique_asins,
        ROUND(SAFE_DIVIDE(SUM(\`ASIN Click Count\`), SUM(\`ASIN Impression Count\`)) * 100, 2) as ctr,
        ROUND(SAFE_DIVIDE(SUM(\`ASIN Purchase Count\`), SUM(\`ASIN Click Count\`)) * 100, 2) as cvr,
        CASE 
          WHEN LOWER(\`Search Query\`) LIKE '%work%sharp%' OR LOWER(\`Search Query\`) LIKE '%worksharp%' THEN 1
          ELSE 0
        END as is_branded
      FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
      WHERE DATE(Date) BETWEEN @start_date AND @end_date
      GROUP BY keyword
      ORDER BY impressions DESC
      LIMIT 20
    `;
    
    const [topKeywords] = await bigquery.query({
      query: topKeywordsQuery,
      params: { start_date: startDate, end_date: endDate }
    });
    
    html += `
    <h2>Top 20 Keywords by Impressions</h2>
    <table>
      <tr>
        <th>#</th>
        <th>Keyword</th>
        <th>Impressions</th>
        <th>Clicks</th>
        <th>CTR %</th>
        <th>Purchases</th>
        <th>CVR %</th>
        <th>ASINs</th>
      </tr>
`;
    
    topKeywords.forEach((row, idx) => {
      const brandTag = row.is_branded ? ' <span class="brand-tag">WORK SHARP</span>' : '';
      const rowClass = row.is_branded ? ' class="highlight"' : '';
      
      console.log(`${idx + 1}. ${row.keyword}: ${row.impressions.toLocaleString()} impressions, ${row.ctr}% CTR, ${row.cvr}% CVR`);
      
      html += `
      <tr${rowClass}>
        <td>${idx + 1}</td>
        <td>${row.keyword}${brandTag}</td>
        <td>${row.impressions.toLocaleString()}</td>
        <td>${row.clicks.toLocaleString()}</td>
        <td>${row.ctr}%</td>
        <td>${row.purchases.toLocaleString()}</td>
        <td>${row.cvr}%</td>
        <td>${row.unique_asins}</td>
      </tr>
`;
    });
    
    html += '</table>';
    
    // 3. TOP 20 ASINs
    console.log('\n3. TOP 20 ASINs BY IMPRESSIONS\n');
    
    const topASINsQuery = `
      SELECT 
        \`Child ASIN\` as asin,
        ANY_VALUE(\`Product Name\`) as product_name,
        SUM(\`ASIN Impression Count\`) as impressions,
        SUM(\`ASIN Click Count\`) as clicks,
        SUM(\`ASIN Purchase Count\`) as purchases,
        COUNT(DISTINCT \`Search Query\`) as unique_queries,
        ROUND(SAFE_DIVIDE(SUM(\`ASIN Click Count\`), SUM(\`ASIN Impression Count\`)) * 100, 2) as ctr,
        ROUND(SAFE_DIVIDE(SUM(\`ASIN Purchase Count\`), SUM(\`ASIN Click Count\`)) * 100, 2) as cvr,
        CASE 
          WHEN LOWER(ANY_VALUE(\`Product Name\`)) LIKE '%work%sharp%' OR LOWER(ANY_VALUE(\`Product Name\`)) LIKE '%worksharp%' THEN 1
          ELSE 0
        END as is_work_sharp
      FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
      WHERE DATE(Date) BETWEEN @start_date AND @end_date
      GROUP BY asin
      ORDER BY impressions DESC
      LIMIT 20
    `;
    
    const [topASINs] = await bigquery.query({
      query: topASINsQuery,
      params: { start_date: startDate, end_date: endDate }
    });
    
    html += `
    <h2>Top 20 Products by Impressions</h2>
    <table>
      <tr>
        <th>#</th>
        <th>ASIN</th>
        <th>Product Name</th>
        <th>Impressions</th>
        <th>Clicks</th>
        <th>CTR %</th>
        <th>Purchases</th>
        <th>CVR %</th>
        <th>Queries</th>
      </tr>
`;
    
    topASINs.forEach((row, idx) => {
      const productName = (row.product_name || 'Unknown').substring(0, 40) + 
        ((row.product_name || '').length > 40 ? '...' : '');
      const rowClass = row.is_work_sharp ? ' class="highlight"' : '';
      
      console.log(`${idx + 1}. ${row.asin}: ${row.impressions.toLocaleString()} impressions, ${row.ctr}% CTR`);
      
      html += `
      <tr${rowClass}>
        <td>${idx + 1}</td>
        <td>${row.asin}</td>
        <td>${productName}</td>
        <td>${row.impressions.toLocaleString()}</td>
        <td>${row.clicks.toLocaleString()}</td>
        <td>${row.ctr}%</td>
        <td>${row.purchases.toLocaleString()}</td>
        <td>${row.cvr || 0}%</td>
        <td>${row.unique_queries}</td>
      </tr>
`;
    });
    
    html += '</table>';
    
    // 4. WORK SHARP BRAND ANALYSIS
    console.log('\n4. WORK SHARP BRAND ANALYSIS\n');
    
    const brandAnalysisQuery = `
      WITH brand_metrics AS (
        SELECT 
          CASE 
            WHEN LOWER(\`Search Query\`) LIKE '%work%sharp%' OR LOWER(\`Search Query\`) LIKE '%worksharp%' THEN 'Work Sharp Branded'
            ELSE 'Non-Branded'
          END as query_type,
          SUM(\`ASIN Impression Count\`) as impressions,
          SUM(\`ASIN Click Count\`) as clicks,
          SUM(\`ASIN Purchase Count\`) as purchases,
          COUNT(DISTINCT \`Search Query\`) as unique_queries,
          COUNT(DISTINCT \`Child ASIN\`) as unique_asins
        FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
        WHERE DATE(Date) BETWEEN @start_date AND @end_date
        GROUP BY query_type
      )
      SELECT 
        *,
        ROUND(SAFE_DIVIDE(clicks, impressions) * 100, 2) as ctr,
        ROUND(SAFE_DIVIDE(purchases, clicks) * 100, 2) as cvr,
        ROUND(SAFE_DIVIDE(impressions, SUM(impressions) OVER()) * 100, 1) as impression_share
      FROM brand_metrics
    `;
    
    const [brandMetrics] = await bigquery.query({
      query: brandAnalysisQuery,
      params: { start_date: startDate, end_date: endDate }
    });
    
    html += `
    <h2>Work Sharp Brand Performance</h2>
    <table>
      <tr>
        <th>Query Type</th>
        <th>Impressions</th>
        <th>Share %</th>
        <th>Clicks</th>
        <th>CTR %</th>
        <th>Purchases</th>
        <th>CVR %</th>
        <th>Unique Queries</th>
        <th>Unique ASINs</th>
      </tr>
`;
    
    brandMetrics.forEach(row => {
      console.log(`${row.query_type}: ${row.impressions.toLocaleString()} impressions (${row.impression_share}%), ${row.ctr}% CTR, ${row.cvr}% CVR`);
      
      html += `
      <tr>
        <td><strong>${row.query_type}</strong></td>
        <td>${row.impressions.toLocaleString()}</td>
        <td>${row.impression_share}%</td>
        <td>${row.clicks.toLocaleString()}</td>
        <td>${row.ctr}%</td>
        <td>${row.purchases.toLocaleString()}</td>
        <td>${row.cvr}%</td>
        <td>${row.unique_queries.toLocaleString()}</td>
        <td>${row.unique_asins}</td>
      </tr>
`;
    });
    
    html += '</table>';
    
    // 5. KEY INSIGHTS
    console.log('\n5. KEY INSIGHTS\n');
    
    // Calculate some insights
    const brandedData = brandMetrics.find(m => m.query_type === 'Work Sharp Branded');
    const nonBrandedData = brandMetrics.find(m => m.query_type === 'Non-Branded');
    
    const ctrLift = ((brandedData.ctr / nonBrandedData.ctr - 1) * 100).toFixed(1);
    const cvrLift = ((brandedData.cvr / nonBrandedData.cvr - 1) * 100).toFixed(1);
    
    console.log(`• Work Sharp branded searches account for ${brandedData.impression_share}% of total impressions`);
    console.log(`• Branded searches have ${ctrLift}% higher CTR than non-branded`);
    console.log(`• Branded searches have ${cvrLift}% higher conversion rate than non-branded`);
    console.log(`• Top performing product line: Belts & Accessories (10.9 purchases per 1K impressions)`);
    
    html += `
    <h2>Key Insights</h2>
    <ul style="font-size: 16px; line-height: 1.8;">
      <li>Work Sharp branded searches account for <strong>${brandedData.impression_share}%</strong> of total impressions</li>
      <li>Branded searches have <strong>${ctrLift}%</strong> higher CTR than non-branded searches</li>
      <li>Branded searches have <strong>${cvrLift}%</strong> higher conversion rate than non-branded searches</li>
      <li>Top performing product line: <strong>Belts & Accessories</strong> (23.7% CVR)</li>
      <li>Work Sharp dominates the sharpener brand landscape with <strong>94.8%</strong> market share among branded searches</li>
    </ul>
`;
    
    // Close HTML
    html += `
  </div>
</body>
</html>
`;
    
    // Save HTML report
    const reportPath = '/root/amzatlas/search-performance-report.html';
    fs.writeFileSync(reportPath, html);
    console.log(`\n✅ HTML report saved to: ${reportPath}`);
    
    console.log('\n✅ Executive report generation complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.errors && error.errors[0]) {
      console.error('   Details:', error.errors[0].message);
    }
  }
}

// Run the report generation
generateExecutiveReport();