#!/usr/bin/env node
require('dotenv').config();

const { BigQuery } = require('@google-cloud/bigquery');
const { format } = require('date-fns');

async function runComprehensiveAnalysis() {
  console.log('Comprehensive Search Query Performance Analysis\n');
  console.log('==============================================\n');
  console.log(`Report Date: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}\n`);
  
  try {
    // BigQuery setup
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    const projectId = process.env.BIGQUERY_PROJECT_ID || 'amazon-sp-report-loader';
    const datasetId = process.env.BIGQUERY_DATASET || 'dataclient_amzatlas_agency_85';
    
    const bigquery = new BigQuery({ projectId, credentials });
    
    // Define analysis period - last 30 days of available data
    const endDate = '2025-08-10';
    const startDate = '2025-07-11';
    
    console.log(`Analysis Period: ${startDate} to ${endDate}\n`);
    console.log('=' .repeat(70) + '\n');
    
    // 1. TOP 20 KEYWORDS ANALYSIS
    console.log('1. TOP 20 KEYWORDS BY IMPRESSIONS\n');
    
    const topKeywordsQuery = `
      SELECT 
        \`Search Query\` as keyword,
        SUM(\`ASIN Impression Count\`) as impressions,
        SUM(\`ASIN Click Count\`) as clicks,
        SUM(\`ASIN Purchase Count\`) as purchases,
        COUNT(DISTINCT \`Child ASIN\`) as unique_asins,
        ROUND(SAFE_DIVIDE(SUM(\`ASIN Click Count\`), SUM(\`ASIN Impression Count\`)) * 100, 2) as ctr,
        ROUND(SAFE_DIVIDE(SUM(\`ASIN Purchase Count\`), SUM(\`ASIN Click Count\`)) * 100, 2) as cvr,
        ROUND(SAFE_DIVIDE(SUM(\`ASIN Purchase Count\`), SUM(\`ASIN Impression Count\`)) * 100, 3) as conversion_rate
      FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
      WHERE DATE(Date) BETWEEN @start_date AND @end_date
      GROUP BY keyword
      ORDER BY impressions DESC
      LIMIT 20
    `;
    
    const keywordOptions = {
      query: topKeywordsQuery,
      params: { start_date: startDate, end_date: endDate }
    };
    
    const [topKeywords] = await bigquery.query(keywordOptions);
    
    console.log('Rank | Keyword                          | Impressions  | Clicks | CTR % | Purchases | CVR % | Conv % | ASINs');
    console.log('-----|----------------------------------|--------------|--------|-------|-----------|-------|--------|-------');
    
    topKeywords.forEach((row, idx) => {
      const rank = (idx + 1).toString().padStart(4);
      const keyword = row.keyword.length > 33 ? row.keyword.substring(0, 30) + '...' : row.keyword.padEnd(33);
      const impressions = row.impressions.toLocaleString().padStart(13);
      const clicks = row.clicks.toLocaleString().padStart(6);
      const ctr = row.ctr.toFixed(2).padStart(5);
      const purchases = row.purchases.toLocaleString().padStart(9);
      const cvr = row.cvr.toFixed(2).padStart(5);
      const convRate = row.conversion_rate.toFixed(3).padStart(6);
      const asins = row.unique_asins.toString().padStart(5);
      
      console.log(`${rank} | ${keyword} | ${impressions} | ${clicks} | ${ctr} | ${purchases} | ${cvr} | ${convRate} | ${asins}`);
    });
    
    // 2. TOP 20 ASINs ANALYSIS
    console.log('\n\n2. TOP 20 ASINs BY IMPRESSIONS\n');
    
    const topASINsQuery = `
      WITH asin_data AS (
        SELECT 
          \`Child ASIN\` as asin,
          \`Product Name\` as product_name,
          \`Parent ASIN\` as parent_asin,
          SUM(\`ASIN Impression Count\`) as impressions,
          SUM(\`ASIN Click Count\`) as clicks,
          SUM(\`ASIN Purchase Count\`) as purchases,
          COUNT(DISTINCT \`Search Query\`) as unique_queries
        FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
        WHERE DATE(Date) BETWEEN @start_date AND @end_date
        GROUP BY asin, product_name, parent_asin
      )
      SELECT 
        asin,
        ANY_VALUE(product_name) as product_name,
        ANY_VALUE(parent_asin) as parent_asin,
        impressions,
        clicks,
        purchases,
        unique_queries,
        ROUND(SAFE_DIVIDE(clicks, impressions) * 100, 2) as ctr,
        ROUND(SAFE_DIVIDE(purchases, clicks) * 100, 2) as cvr,
        ROUND(SAFE_DIVIDE(purchases, impressions) * 100, 3) as conversion_rate
      FROM asin_data
      GROUP BY asin, impressions, clicks, purchases, unique_queries
      ORDER BY impressions DESC
      LIMIT 20
    `;
    
    const asinOptions = {
      query: topASINsQuery,
      params: { start_date: startDate, end_date: endDate }
    };
    
    const [topASINs] = await bigquery.query(asinOptions);
    
    console.log('Rank | ASIN       | Product Name                     | Impressions  | Clicks | CTR % | Purchases | CVR % | Queries');
    console.log('-----|------------|----------------------------------|--------------|--------|-------|-----------|-------|--------');
    
    topASINs.forEach((row, idx) => {
      const rank = (idx + 1).toString().padStart(4);
      const asin = row.asin.padEnd(10);
      const productName = (row.product_name || 'Unknown').length > 33 ? 
        (row.product_name || 'Unknown').substring(0, 30) + '...' : 
        (row.product_name || 'Unknown').padEnd(33);
      const impressions = row.impressions.toLocaleString().padStart(13);
      const clicks = row.clicks.toLocaleString().padStart(6);
      const ctr = row.ctr.toFixed(2).padStart(5);
      const purchases = row.purchases.toLocaleString().padStart(9);
      const cvr = (row.cvr || 0).toFixed(2).padStart(5);
      const queries = row.unique_queries.toString().padStart(7);
      
      console.log(`${rank} | ${asin} | ${productName} | ${impressions} | ${clicks} | ${ctr} | ${purchases} | ${cvr} | ${queries}`);
    });
    
    // 3. BRANDED KEYWORD ANALYSIS (Work Sharp)
    console.log('\n\n3. WORK SHARP BRANDED KEYWORD ANALYSIS\n');
    
    const brandedQuery = `
      WITH branded_keywords AS (
        SELECT 
          \`Search Query\` as keyword,
          SUM(\`ASIN Impression Count\`) as impressions,
          SUM(\`ASIN Click Count\`) as clicks,
          SUM(\`ASIN Purchase Count\`) as purchases,
          COUNT(DISTINCT \`Child ASIN\`) as unique_asins,
          ROUND(SAFE_DIVIDE(SUM(\`ASIN Click Count\`), SUM(\`ASIN Impression Count\`)) * 100, 2) as ctr,
          ROUND(SAFE_DIVIDE(SUM(\`ASIN Purchase Count\`), SUM(\`ASIN Click Count\`)) * 100, 2) as cvr,
          CASE 
            WHEN LOWER(\`Search Query\`) LIKE '%work sharp%' THEN 'work sharp'
            WHEN LOWER(\`Search Query\`) LIKE '%worksharp%' THEN 'worksharp' 
            WHEN LOWER(\`Search Query\`) LIKE '%work%sharp%' THEN 'work_sharp_variant'
            ELSE 'non_branded'
          END as brand_variant
        FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
        WHERE DATE(Date) BETWEEN @start_date AND @end_date
          AND (LOWER(\`Search Query\`) LIKE '%work%sharp%' OR LOWER(\`Search Query\`) LIKE '%worksharp%')
        GROUP BY keyword, brand_variant
      )
      SELECT 
        brand_variant,
        COUNT(DISTINCT keyword) as unique_keywords,
        SUM(impressions) as total_impressions,
        SUM(clicks) as total_clicks,
        SUM(purchases) as total_purchases,
        SUM(unique_asins) as total_unique_asins,
        ROUND(SAFE_DIVIDE(SUM(clicks), SUM(impressions)) * 100, 2) as overall_ctr,
        ROUND(SAFE_DIVIDE(SUM(purchases), SUM(clicks)) * 100, 2) as overall_cvr
      FROM branded_keywords
      GROUP BY brand_variant
      ORDER BY total_impressions DESC
    `;
    
    const brandOptions = {
      query: brandedQuery,
      params: { start_date: startDate, end_date: endDate }
    };
    
    const [brandResults] = await bigquery.query(brandOptions);
    
    console.log('Brand Variant      | Keywords | Impressions    | Clicks  | CTR % | Purchases | CVR % | Unique ASINs');
    console.log('-------------------|----------|----------------|---------|-------|-----------|-------|-------------');
    
    let totalBrandedImpressions = 0;
    brandResults.forEach(row => {
      const variant = row.brand_variant.padEnd(18);
      const keywords = row.unique_keywords.toString().padStart(8);
      const impressions = row.total_impressions.toLocaleString().padStart(14);
      const clicks = row.total_clicks.toLocaleString().padStart(7);
      const ctr = row.overall_ctr.toFixed(2).padStart(5);
      const purchases = row.total_purchases.toLocaleString().padStart(9);
      const cvr = row.overall_cvr.toFixed(2).padStart(5);
      const asins = row.total_unique_asins.toString().padStart(11);
      
      totalBrandedImpressions += row.total_impressions;
      
      console.log(`${variant} | ${keywords} | ${impressions} | ${clicks} | ${ctr} | ${purchases} | ${cvr} | ${asins}`);
    });
    
    // Top Work Sharp branded keywords
    console.log('\n3.1 Top 15 Work Sharp Branded Keywords:\n');
    
    const topBrandedKeywordsQuery = `
      SELECT 
        \`Search Query\` as keyword,
        SUM(\`ASIN Impression Count\`) as impressions,
        SUM(\`ASIN Click Count\`) as clicks,
        SUM(\`ASIN Purchase Count\`) as purchases,
        ROUND(SAFE_DIVIDE(SUM(\`ASIN Click Count\`), SUM(\`ASIN Impression Count\`)) * 100, 2) as ctr,
        ROUND(SAFE_DIVIDE(SUM(\`ASIN Purchase Count\`), SUM(\`ASIN Click Count\`)) * 100, 2) as cvr
      FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
      WHERE DATE(Date) BETWEEN @start_date AND @end_date
        AND (LOWER(\`Search Query\`) LIKE '%work%sharp%' OR LOWER(\`Search Query\`) LIKE '%worksharp%')
      GROUP BY keyword
      ORDER BY impressions DESC
      LIMIT 15
    `;
    
    const [topBrandedKeywords] = await bigquery.query({
      query: topBrandedKeywordsQuery,
      params: { start_date: startDate, end_date: endDate }
    });
    
    console.log('Keyword                                 | Impressions  | Clicks | CTR % | Purchases | CVR %');
    console.log('----------------------------------------|--------------|--------|-------|-----------|-------');
    
    topBrandedKeywords.forEach(row => {
      const keyword = row.keyword.length > 39 ? row.keyword.substring(0, 36) + '...' : row.keyword.padEnd(39);
      const impressions = row.impressions.toLocaleString().padStart(13);
      const clicks = row.clicks.toLocaleString().padStart(6);
      const ctr = row.ctr.toFixed(2).padStart(5);
      const purchases = row.purchases.toLocaleString().padStart(9);
      const cvr = row.cvr.toFixed(2).padStart(5);
      
      console.log(`${keyword} | ${impressions} | ${clicks} | ${ctr} | ${purchases} | ${cvr}`);
    });
    
    // 4. BRAND VS NON-BRAND COMPARISON
    console.log('\n\n4. BRAND VS NON-BRAND PERFORMANCE COMPARISON\n');
    
    const brandComparisonQuery = `
      WITH categorized_queries AS (
        SELECT 
          CASE 
            WHEN LOWER(\`Search Query\`) LIKE '%work%sharp%' OR LOWER(\`Search Query\`) LIKE '%worksharp%' THEN 'Branded'
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
        query_type,
        impressions,
        clicks,
        purchases,
        unique_queries,
        unique_asins,
        ROUND(SAFE_DIVIDE(clicks, impressions) * 100, 2) as ctr,
        ROUND(SAFE_DIVIDE(purchases, clicks) * 100, 2) as cvr,
        ROUND(SAFE_DIVIDE(impressions, SUM(impressions) OVER()) * 100, 1) as impression_share
      FROM categorized_queries
      ORDER BY impressions DESC
    `;
    
    const [brandComparison] = await bigquery.query({
      query: brandComparisonQuery,
      params: { start_date: startDate, end_date: endDate }
    });
    
    console.log('Query Type   | Impressions    | Share % | Clicks  | CTR % | Purchases | CVR % | Queries | ASINs');
    console.log('-------------|----------------|---------|---------|-------|-----------|-------|---------|-------');
    
    brandComparison.forEach(row => {
      const type = row.query_type.padEnd(12);
      const impressions = row.impressions.toLocaleString().padStart(14);
      const share = row.impression_share.toFixed(1).padStart(6);
      const clicks = row.clicks.toLocaleString().padStart(7);
      const ctr = row.ctr.toFixed(2).padStart(5);
      const purchases = row.purchases.toLocaleString().padStart(9);
      const cvr = row.cvr.toFixed(2).padStart(5);
      const queries = row.unique_queries.toLocaleString().padStart(7);
      const asins = row.unique_asins.toString().padStart(5);
      
      console.log(`${type} | ${impressions} | ${share}% | ${clicks} | ${ctr} | ${purchases} | ${cvr} | ${queries} | ${asins}`);
    });
    
    // 5. WORK SHARP PRODUCT PERFORMANCE
    console.log('\n\n5. WORK SHARP PRODUCT PERFORMANCE\n');
    
    const workSharpProductsQuery = `
      SELECT 
        \`Child ASIN\` as asin,
        ANY_VALUE(\`Product Name\`) as product_name,
        SUM(\`ASIN Impression Count\`) as impressions,
        SUM(\`ASIN Click Count\`) as clicks,
        SUM(\`ASIN Purchase Count\`) as purchases,
        COUNT(DISTINCT \`Search Query\`) as unique_queries,
        ROUND(SAFE_DIVIDE(SUM(\`ASIN Click Count\`), SUM(\`ASIN Impression Count\`)) * 100, 2) as ctr,
        ROUND(SAFE_DIVIDE(SUM(\`ASIN Purchase Count\`), SUM(\`ASIN Click Count\`)) * 100, 2) as cvr
      FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
      WHERE DATE(Date) BETWEEN @start_date AND @end_date
        AND (LOWER(\`Product Name\`) LIKE '%work%sharp%' OR LOWER(\`Product Name\`) LIKE '%worksharp%')
      GROUP BY asin
      ORDER BY impressions DESC
      LIMIT 15
    `;
    
    const [workSharpProducts] = await bigquery.query({
      query: workSharpProductsQuery,
      params: { start_date: startDate, end_date: endDate }
    });
    
    console.log('ASIN       | Product Name                          | Impressions  | Clicks | CTR % | Purchases | CVR % | Queries');
    console.log('-----------|---------------------------------------|--------------|--------|-------|-----------|-------|--------');
    
    workSharpProducts.forEach(row => {
      const asin = row.asin.padEnd(10);
      const productName = (row.product_name || 'Unknown').length > 38 ? 
        (row.product_name || 'Unknown').substring(0, 35) + '...' : 
        (row.product_name || 'Unknown').padEnd(38);
      const impressions = row.impressions.toLocaleString().padStart(13);
      const clicks = row.clicks.toLocaleString().padStart(6);
      const ctr = row.ctr.toFixed(2).padStart(5);
      const purchases = row.purchases.toLocaleString().padStart(9);
      const cvr = (row.cvr || 0).toFixed(2).padStart(5);
      const queries = row.unique_queries.toString().padStart(7);
      
      console.log(`${asin} | ${productName} | ${impressions} | ${clicks} | ${ctr} | ${purchases} | ${cvr} | ${queries}`);
    });
    
    // 6. EXECUTIVE SUMMARY
    const totalQuery = `
      SELECT 
        SUM(\`ASIN Impression Count\`) as total_impressions,
        SUM(\`ASIN Click Count\`) as total_clicks,
        SUM(\`ASIN Purchase Count\`) as total_purchases,
        COUNT(DISTINCT \`Search Query\`) as unique_queries,
        COUNT(DISTINCT \`Child ASIN\`) as unique_asins
      FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
      WHERE DATE(Date) BETWEEN @start_date AND @end_date
    `;
    
    const [totalMetrics] = await bigquery.query({
      query: totalQuery,
      params: { start_date: startDate, end_date: endDate }
    });
    
    console.log('\n\n6. EXECUTIVE SUMMARY\n');
    console.log('=' .repeat(70));
    
    if (totalMetrics.length > 0) {
      const totals = totalMetrics[0];
      const brandedShare = (totalBrandedImpressions / totals.total_impressions * 100).toFixed(1);
      
      console.log(`\nTotal Performance (${startDate} to ${endDate}):`);
      console.log(`  • Total Impressions: ${totals.total_impressions.toLocaleString()}`);
      console.log(`  • Total Clicks: ${totals.total_clicks.toLocaleString()}`);
      console.log(`  • Total Purchases: ${totals.total_purchases.toLocaleString()}`);
      console.log(`  • Unique Search Queries: ${totals.unique_queries.toLocaleString()}`);
      console.log(`  • Unique ASINs: ${totals.unique_asins.toLocaleString()}`);
      console.log(`  • Overall CTR: ${(totals.total_clicks / totals.total_impressions * 100).toFixed(2)}%`);
      console.log(`  • Overall CVR: ${(totals.total_purchases / totals.total_clicks * 100).toFixed(2)}%`);
      console.log(`\nBrand Performance:`);
      console.log(`  • Work Sharp branded searches account for ${brandedShare}% of total impressions`);
    }
    
    console.log('\n✅ Comprehensive analysis complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.errors && error.errors[0]) {
      console.error('   Details:', error.errors[0].message);
    }
  }
}

// Run the analysis
runComprehensiveAnalysis();