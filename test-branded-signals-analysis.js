#!/usr/bin/env node
require('dotenv').config();

const { BigQuery } = require('@google-cloud/bigquery');
const { format } = require('date-fns');

async function runBrandedSignalsAnalysis() {
  console.log('Enhanced Branded Keyword Signals Analysis\n');
  console.log('=========================================\n');
  console.log(`Report Date: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}\n`);
  
  try {
    // BigQuery setup
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    const projectId = process.env.BIGQUERY_PROJECT_ID || 'amazon-sp-report-loader';
    const datasetId = process.env.BIGQUERY_DATASET || 'dataclient_amzatlas_agency_85';
    
    const bigquery = new BigQuery({ projectId, credentials });
    
    // Define analysis period
    const endDate = '2025-08-10';
    const startDate = '2025-07-11';
    
    console.log(`Analysis Period: ${startDate} to ${endDate}\n`);
    console.log('=' .repeat(70) + '\n');
    
    // 1. BRANDED KEYWORD PATTERN ANALYSIS
    console.log('1. BRANDED KEYWORD PATTERN ANALYSIS\n');
    
    const brandPatternQuery = `
      WITH branded_patterns AS (
        SELECT 
          \`Search Query\` as keyword,
          SUM(\`ASIN Impression Count\`) as impressions,
          SUM(\`ASIN Click Count\`) as clicks,
          SUM(\`ASIN Purchase Count\`) as purchases,
          ROUND(SAFE_DIVIDE(SUM(\`ASIN Click Count\`), SUM(\`ASIN Impression Count\`)) * 100, 2) as ctr,
          ROUND(SAFE_DIVIDE(SUM(\`ASIN Purchase Count\`), SUM(\`ASIN Click Count\`)) * 100, 2) as cvr,
          
          -- Detailed brand signal detection
          CASE 
            WHEN LOWER(\`Search Query\`) = 'work sharp' THEN 'exact_brand'
            WHEN LOWER(\`Search Query\`) = 'worksharp' THEN 'exact_brand_variant'
            WHEN LOWER(\`Search Query\`) LIKE 'work sharp %' THEN 'brand_prefix'
            WHEN LOWER(\`Search Query\`) LIKE 'worksharp %' THEN 'brand_variant_prefix'
            WHEN LOWER(\`Search Query\`) LIKE '% work sharp' THEN 'brand_suffix'
            WHEN LOWER(\`Search Query\`) LIKE '% worksharp' THEN 'brand_variant_suffix'
            WHEN LOWER(\`Search Query\`) LIKE '% work sharp %' THEN 'brand_middle'
            WHEN LOWER(\`Search Query\`) LIKE '% worksharp %' THEN 'brand_variant_middle'
            WHEN LOWER(\`Search Query\`) LIKE '%work%sharp%' THEN 'brand_fuzzy'
            ELSE 'non_branded'
          END as brand_pattern,
          
          -- Product line detection
          CASE
            WHEN LOWER(\`Search Query\`) LIKE '%ken onion%' THEN 'ken_onion_line'
            WHEN LOWER(\`Search Query\`) LIKE '%precision adjust%' THEN 'precision_adjust_line'
            WHEN LOWER(\`Search Query\`) LIKE '%guided field%' THEN 'guided_field_line'
            WHEN LOWER(\`Search Query\`) LIKE '%mk2%' OR LOWER(\`Search Query\`) LIKE '%mk 2%' THEN 'mk2_line'
            WHEN LOWER(\`Search Query\`) LIKE '%belt%' THEN 'belts_accessories'
            WHEN LOWER(\`Search Query\`) LIKE '%benchstone%' THEN 'benchstone_line'
            WHEN LOWER(\`Search Query\`) LIKE '%electric%' THEN 'electric_line'
            ELSE 'general'
          END as product_line
          
        FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
        WHERE DATE(Date) BETWEEN @start_date AND @end_date
          AND (LOWER(\`Search Query\`) LIKE '%work%sharp%' OR LOWER(\`Search Query\`) LIKE '%worksharp%')
        GROUP BY keyword
      )
      SELECT 
        brand_pattern,
        COUNT(DISTINCT keyword) as unique_keywords,
        SUM(impressions) as total_impressions,
        SUM(clicks) as total_clicks,
        SUM(purchases) as total_purchases,
        ROUND(SAFE_DIVIDE(SUM(clicks), SUM(impressions)) * 100, 2) as avg_ctr,
        ROUND(SAFE_DIVIDE(SUM(purchases), SUM(clicks)) * 100, 2) as avg_cvr,
        ROUND(SAFE_DIVIDE(SUM(impressions), 
          SUM(SUM(impressions)) OVER()) * 100, 1) as impression_share
      FROM branded_patterns
      GROUP BY brand_pattern
      ORDER BY total_impressions DESC
    `;
    
    const [brandPatterns] = await bigquery.query({
      query: brandPatternQuery,
      params: { start_date: startDate, end_date: endDate }
    });
    
    console.log('Brand Pattern         | Keywords | Impressions  | Share % | CTR % | CVR % | Purchases');
    console.log('----------------------|----------|--------------|---------|-------|-------|----------');
    
    brandPatterns.forEach(row => {
      const pattern = row.brand_pattern.padEnd(21);
      const keywords = row.unique_keywords.toString().padStart(8);
      const impressions = row.total_impressions.toLocaleString().padStart(13);
      const share = row.impression_share.toFixed(1).padStart(6);
      const ctr = row.avg_ctr.toFixed(2).padStart(5);
      const cvr = row.avg_cvr.toFixed(2).padStart(5);
      const purchases = row.total_purchases.toLocaleString().padStart(9);
      
      console.log(`${pattern} | ${keywords} | ${impressions} | ${share}% | ${ctr} | ${cvr} | ${purchases}`);
    });
    
    // 2. PRODUCT LINE PERFORMANCE
    console.log('\n\n2. WORK SHARP PRODUCT LINE ANALYSIS\n');
    
    const productLineQuery = `
      WITH product_lines AS (
        SELECT 
          CASE
            WHEN LOWER(\`Search Query\`) LIKE '%ken onion%' THEN 'Ken Onion Series'
            WHEN LOWER(\`Search Query\`) LIKE '%precision adjust%' THEN 'Precision Adjust'
            WHEN LOWER(\`Search Query\`) LIKE '%guided field%' THEN 'Guided Field'
            WHEN LOWER(\`Search Query\`) LIKE '%mk2%' OR LOWER(\`Search Query\`) LIKE '%mk 2%' THEN 'MK2 Series'
            WHEN LOWER(\`Search Query\`) LIKE '%belt%' THEN 'Belts & Accessories'
            WHEN LOWER(\`Search Query\`) LIKE '%benchstone%' THEN 'Benchstone'
            WHEN LOWER(\`Search Query\`) LIKE '%electric%' THEN 'Electric Sharpeners'
            WHEN LOWER(\`Search Query\`) LIKE '%combo%' THEN 'Combo Kits'
            ELSE 'General Work Sharp'
          END as product_line,
          SUM(\`ASIN Impression Count\`) as impressions,
          SUM(\`ASIN Click Count\`) as clicks,
          SUM(\`ASIN Purchase Count\`) as purchases,
          COUNT(DISTINCT \`Search Query\`) as unique_queries,
          COUNT(DISTINCT \`Child ASIN\`) as unique_asins
        FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
        WHERE DATE(Date) BETWEEN @start_date AND @end_date
          AND (LOWER(\`Search Query\`) LIKE '%work%sharp%' OR LOWER(\`Search Query\`) LIKE '%worksharp%')
        GROUP BY product_line
      )
      SELECT 
        product_line,
        impressions,
        clicks,
        purchases,
        unique_queries,
        unique_asins,
        ROUND(SAFE_DIVIDE(clicks, impressions) * 100, 2) as ctr,
        ROUND(SAFE_DIVIDE(purchases, clicks) * 100, 2) as cvr,
        ROUND(SAFE_DIVIDE(purchases, impressions) * 1000, 1) as purchases_per_1k_imp
      FROM product_lines
      ORDER BY impressions DESC
    `;
    
    const [productLines] = await bigquery.query({
      query: productLineQuery,
      params: { start_date: startDate, end_date: endDate }
    });
    
    console.log('Product Line         | Impressions  | Clicks | CTR % | Purchases | CVR % | P/1K Imp | Queries | ASINs');
    console.log('---------------------|--------------|--------|-------|-----------|-------|----------|---------|-------');
    
    productLines.forEach(row => {
      const line = row.product_line.length > 20 ? 
        row.product_line.substring(0, 17) + '...' : row.product_line.padEnd(20);
      const impressions = row.impressions.toLocaleString().padStart(13);
      const clicks = row.clicks.toLocaleString().padStart(6);
      const ctr = row.ctr.toFixed(2).padStart(5);
      const purchases = row.purchases.toLocaleString().padStart(9);
      const cvr = row.cvr.toFixed(2).padStart(5);
      const p1k = row.purchases_per_1k_imp.toFixed(1).padStart(8);
      const queries = row.unique_queries.toString().padStart(7);
      const asins = row.unique_asins.toString().padStart(5);
      
      console.log(`${line} | ${impressions} | ${clicks} | ${ctr} | ${purchases} | ${cvr} | ${p1k} | ${queries} | ${asins}`);
    });
    
    // 3. COMPETITIVE BRAND SIGNALS
    console.log('\n\n3. COMPETITIVE LANDSCAPE ANALYSIS\n');
    
    const competitiveQuery = `
      WITH competitive_brands AS (
        SELECT 
          \`Search Query\` as keyword,
          SUM(\`ASIN Impression Count\`) as impressions,
          CASE 
            WHEN LOWER(\`Search Query\`) LIKE '%work%sharp%' OR LOWER(\`Search Query\`) LIKE '%worksharp%' THEN 'Work Sharp'
            WHEN LOWER(\`Search Query\`) LIKE '%wicked edge%' THEN 'Wicked Edge'
            WHEN LOWER(\`Search Query\`) LIKE '%lansky%' THEN 'Lansky'
            WHEN LOWER(\`Search Query\`) LIKE '%spyderco%' THEN 'Spyderco'
            WHEN LOWER(\`Search Query\`) LIKE '%chef%choice%' OR LOWER(\`Search Query\`) LIKE '%chefs choice%' THEN 'Chefs Choice'
            WHEN LOWER(\`Search Query\`) LIKE '%smiths%' THEN 'Smiths'
            WHEN LOWER(\`Search Query\`) LIKE '%sharpal%' THEN 'Sharpal'
            ELSE 'Generic/Other'
          END as brand_detected
        FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
        WHERE DATE(Date) BETWEEN @start_date AND @end_date
          AND \`Search Query\` LIKE '%sharpener%'
        GROUP BY keyword
      )
      SELECT 
        brand_detected,
        unique_keywords,
        total_impressions,
        ROUND(SAFE_DIVIDE(total_impressions, 
          SUM(total_impressions) OVER()) * 100, 1) as brand_market_share
      FROM (
        SELECT 
          brand_detected,
          COUNT(DISTINCT keyword) as unique_keywords,
          SUM(impressions) as total_impressions
        FROM competitive_brands
        WHERE brand_detected != 'Generic/Other'
        GROUP BY brand_detected
      )
      ORDER BY total_impressions DESC
    `;
    
    const [competitive] = await bigquery.query({
      query: competitiveQuery,
      params: { start_date: startDate, end_date: endDate }
    });
    
    console.log('Brand           | Keywords | Impressions  | Market Share %');
    console.log('----------------|----------|--------------|---------------');
    
    competitive.forEach(row => {
      const brand = row.brand_detected.padEnd(15);
      const keywords = row.unique_keywords.toString().padStart(8);
      const impressions = row.total_impressions.toLocaleString().padStart(13);
      const share = row.brand_market_share ? row.brand_market_share.toFixed(1).padStart(13) : '           N/A';
      
      console.log(`${brand} | ${keywords} | ${impressions} | ${share}`);
    });
    
    // 4. BRANDED QUERY INTENT ANALYSIS
    console.log('\n\n4. BRANDED QUERY INTENT ANALYSIS\n');
    
    const intentQuery = `
      WITH query_intent AS (
        SELECT 
          \`Search Query\` as keyword,
          SUM(\`ASIN Impression Count\`) as impressions,
          SUM(\`ASIN Click Count\`) as clicks,
          SUM(\`ASIN Purchase Count\`) as purchases,
          
          CASE
            WHEN LOWER(\`Search Query\`) LIKE '%belt%' THEN 'Replacement Parts'
            WHEN LOWER(\`Search Query\`) LIKE '%how to%' OR LOWER(\`Search Query\`) LIKE '%guide%' THEN 'Educational'
            WHEN LOWER(\`Search Query\`) LIKE '%vs%' OR LOWER(\`Search Query\`) LIKE '%versus%' OR LOWER(\`Search Query\`) LIKE '%compare%' THEN 'Comparison'
            WHEN LOWER(\`Search Query\`) LIKE '%review%' OR LOWER(\`Search Query\`) LIKE '%best%' THEN 'Research'
            WHEN LOWER(\`Search Query\`) LIKE '%electric%' OR LOWER(\`Search Query\`) LIKE '%manual%' THEN 'Type Specific'
            WHEN LOWER(\`Search Query\`) LIKE '%professional%' OR LOWER(\`Search Query\`) LIKE '%commercial%' THEN 'Professional'
            WHEN LOWER(\`Search Query\`) LIKE '%kit%' OR LOWER(\`Search Query\`) LIKE '%set%' OR LOWER(\`Search Query\`) LIKE '%combo%' THEN 'Bundle Seeking'
            WHEN LOWER(\`Search Query\`) LIKE '%cheap%' OR LOWER(\`Search Query\`) LIKE '%budget%' OR LOWER(\`Search Query\`) LIKE '%affordable%' THEN 'Price Conscious'
            ELSE 'Direct Purchase Intent'
          END as query_intent
          
        FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
        WHERE DATE(Date) BETWEEN @start_date AND @end_date
          AND (LOWER(\`Search Query\`) LIKE '%work%sharp%' OR LOWER(\`Search Query\`) LIKE '%worksharp%')
        GROUP BY keyword
      )
      SELECT 
        query_intent,
        COUNT(DISTINCT keyword) as unique_queries,
        SUM(impressions) as total_impressions,
        SUM(clicks) as total_clicks,
        SUM(purchases) as total_purchases,
        ROUND(SAFE_DIVIDE(SUM(clicks), SUM(impressions)) * 100, 2) as avg_ctr,
        ROUND(SAFE_DIVIDE(SUM(purchases), SUM(clicks)) * 100, 2) as avg_cvr
      FROM query_intent
      GROUP BY query_intent
      ORDER BY total_impressions DESC
    `;
    
    const [queryIntents] = await bigquery.query({
      query: intentQuery,
      params: { start_date: startDate, end_date: endDate }
    });
    
    console.log('Query Intent           | Queries | Impressions  | Clicks | CTR % | Purchases | CVR %');
    console.log('-----------------------|---------|--------------|--------|-------|-----------|-------');
    
    queryIntents.forEach(row => {
      const intent = String(row.query_intent || 'Unknown').padEnd(22);
      const queries = String(row.unique_queries || 0).padStart(7);
      const impressions = (row.total_impressions || 0).toLocaleString().padStart(13);
      const clicks = (row.total_clicks || 0).toLocaleString().padStart(6);
      const ctr = (row.avg_ctr || 0).toFixed(2).padStart(5);
      const purchases = (row.total_purchases || 0).toLocaleString().padStart(9);
      const cvr = (row.avg_cvr || 0).toFixed(2).padStart(5);
      
      console.log(`${intent} | ${queries} | ${impressions} | ${clicks} | ${ctr} | ${purchases} | ${cvr}`);
    });
    
    // 5. BRAND + MODIFIER ANALYSIS
    console.log('\n\n5. BRAND + MODIFIER COMBINATIONS\n');
    
    const modifierQuery = `
      SELECT 
        CASE
          WHEN LOWER(\`Search Query\`) LIKE '%work sharp knife sharpener%' THEN 'work sharp knife sharpener'
          WHEN LOWER(\`Search Query\`) LIKE '%worksharp knife sharpener%' THEN 'worksharp knife sharpener'
          WHEN LOWER(\`Search Query\`) LIKE '%work sharp electric%' THEN 'work sharp + electric'
          WHEN LOWER(\`Search Query\`) LIKE '%work sharp manual%' THEN 'work sharp + manual'
          WHEN LOWER(\`Search Query\`) LIKE '%work sharp belt%' THEN 'work sharp + belt'
          WHEN LOWER(\`Search Query\`) LIKE '%work sharp combo%' THEN 'work sharp + combo'
          WHEN LOWER(\`Search Query\`) LIKE '%work sharp ken onion%' THEN 'work sharp ken onion'
          WHEN LOWER(\`Search Query\`) LIKE '%work sharp precision%' THEN 'work sharp precision'
          WHEN LOWER(\`Search Query\`) LIKE '%work sharp guided%' THEN 'work sharp guided'
          WHEN LOWER(\`Search Query\`) LIKE '%work sharp mk2%' THEN 'work sharp mk2'
          ELSE 'other combinations'
        END as brand_modifier,
        COUNT(DISTINCT \`Search Query\`) as variations,
        SUM(\`ASIN Impression Count\`) as impressions,
        SUM(\`ASIN Click Count\`) as clicks,
        SUM(\`ASIN Purchase Count\`) as purchases,
        ROUND(SAFE_DIVIDE(SUM(\`ASIN Click Count\`), SUM(\`ASIN Impression Count\`)) * 100, 2) as ctr,
        ROUND(SAFE_DIVIDE(SUM(\`ASIN Purchase Count\`), SUM(\`ASIN Click Count\`)) * 100, 2) as cvr
      FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
      WHERE DATE(Date) BETWEEN @start_date AND @end_date
        AND (LOWER(\`Search Query\`) LIKE '%work%sharp%' OR LOWER(\`Search Query\`) LIKE '%worksharp%')
      GROUP BY brand_modifier
      HAVING impressions > 5000
      ORDER BY impressions DESC
      LIMIT 15
    `;
    
    const [modifiers] = await bigquery.query({
      query: modifierQuery,
      params: { start_date: startDate, end_date: endDate }
    });
    
    console.log('Brand + Modifier              | Variations | Impressions  | Clicks | CTR % | Purchases | CVR %');
    console.log('------------------------------|------------|--------------|--------|-------|-----------|-------');
    
    modifiers.forEach(row => {
      const modifier = row.brand_modifier.length > 29 ? 
        row.brand_modifier.substring(0, 26) + '...' : row.brand_modifier.padEnd(29);
      const variations = row.variations.toString().padStart(11);
      const impressions = row.impressions.toLocaleString().padStart(13);
      const clicks = row.clicks.toLocaleString().padStart(6);
      const ctr = row.ctr.toFixed(2).padStart(5);
      const purchases = row.purchases.toLocaleString().padStart(9);
      const cvr = row.cvr.toFixed(2).padStart(5);
      
      console.log(`${modifier} | ${variations} | ${impressions} | ${clicks} | ${ctr} | ${purchases} | ${cvr}`);
    });
    
    // 6. KEY INSIGHTS SUMMARY
    console.log('\n\n6. KEY BRANDED SEARCH INSIGHTS\n');
    console.log('=' .repeat(70));
    
    // Calculate some key metrics
    const summaryQuery = `
      SELECT 
        COUNT(DISTINCT CASE WHEN LOWER(\`Search Query\`) LIKE '%work%sharp%' OR LOWER(\`Search Query\`) LIKE '%worksharp%' THEN \`Search Query\` END) as branded_keywords,
        COUNT(DISTINCT CASE WHEN LOWER(\`Search Query\`) NOT LIKE '%work%sharp%' AND LOWER(\`Search Query\`) NOT LIKE '%worksharp%' THEN \`Search Query\` END) as non_branded_keywords,
        
        SUM(CASE WHEN LOWER(\`Search Query\`) LIKE '%work%sharp%' OR LOWER(\`Search Query\`) LIKE '%worksharp%' THEN \`ASIN Impression Count\` END) as branded_impressions,
        SUM(CASE WHEN LOWER(\`Search Query\`) NOT LIKE '%work%sharp%' AND LOWER(\`Search Query\`) NOT LIKE '%worksharp%' THEN \`ASIN Impression Count\` END) as non_branded_impressions,
        
        SAFE_DIVIDE(
          SUM(CASE WHEN LOWER(\`Search Query\`) LIKE '%work%sharp%' OR LOWER(\`Search Query\`) LIKE '%worksharp%' THEN \`ASIN Purchase Count\` END),
          SUM(CASE WHEN LOWER(\`Search Query\`) LIKE '%work%sharp%' OR LOWER(\`Search Query\`) LIKE '%worksharp%' THEN \`ASIN Impression Count\` END)
        ) * 100 as branded_conversion_rate,
        
        SAFE_DIVIDE(
          SUM(CASE WHEN LOWER(\`Search Query\`) NOT LIKE '%work%sharp%' AND LOWER(\`Search Query\`) NOT LIKE '%worksharp%' THEN \`ASIN Purchase Count\` END),
          SUM(CASE WHEN LOWER(\`Search Query\`) NOT LIKE '%work%sharp%' AND LOWER(\`Search Query\`) NOT LIKE '%worksharp%' THEN \`ASIN Impression Count\` END)
        ) * 100 as non_branded_conversion_rate
        
      FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
      WHERE DATE(Date) BETWEEN @start_date AND @end_date
    `;
    
    const [summary] = await bigquery.query({
      query: summaryQuery,
      params: { start_date: startDate, end_date: endDate }
    });
    
    if (summary.length > 0) {
      const s = summary[0];
      console.log('\nBranded Search Performance:');
      console.log(`  • Total branded keyword variations: ${s.branded_keywords.toLocaleString()}`);
      console.log(`  • Branded impressions: ${s.branded_impressions.toLocaleString()}`);
      console.log(`  • Branded conversion rate: ${s.branded_conversion_rate.toFixed(3)}%`);
      console.log(`  • Non-branded conversion rate: ${s.non_branded_conversion_rate.toFixed(3)}%`);
      console.log(`  • Conversion lift from branding: ${((s.branded_conversion_rate / s.non_branded_conversion_rate - 1) * 100).toFixed(1)}%`);
    }
    
    console.log('\n✅ Enhanced branded signals analysis complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.errors && error.errors[0]) {
      console.error('   Details:', error.errors[0].message);
    }
  }
}

// Run the analysis
runBrandedSignalsAnalysis();