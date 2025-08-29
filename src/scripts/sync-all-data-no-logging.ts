#!/usr/bin/env node

import { config } from 'dotenv';
import { getBigQueryConfig, getTableNames } from '../config/bigquery.config';
import { BigQuery } from '@google-cloud/bigquery';
import { getSupabaseClient } from '../config/supabase.config';
import { NestedDataTransformer } from '../lib/supabase/sync/nested-data-transformer';

// Load environment variables
config();

async function syncWeek(startDate: Date, endDate: Date) {
  console.log(`\nSyncing week: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
  
  try {
    // Initialize BigQuery
    const bigqueryConfig = getBigQueryConfig();
    const tables = getTableNames();
    
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    let credentials;
    if (credentialsJson) {
      try {
        credentials = JSON.parse(credentialsJson);
      } catch (error) {
        console.error('Failed to parse Google credentials:', error);
        return { success: false, recordsProcessed: 0, errors: [error] };
      }
    }

    const bigquery = new BigQuery({
      projectId: bigqueryConfig.projectId,
      credentials: credentials,
    });

    // Build query
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const query = `
      SELECT 
        Date as startDate,
        Date as endDate,
        \`Child ASIN\` as asin,
        \`Product Name\` as productName,
        \`Client Name\` as clientName,
        \`Search Query\` as searchQuery,
        \`Search Query Score\` as searchQueryScore,
        \`Search Query Volume\` as searchQueryVolume,
        -- Impression metrics
        \`Total Query Impression Count\` as totalQueryImpressionCount,
        \`ASIN Impression Count\` as asinImpressionCount,
        \`ASIN Impression Share\` / 100 as asinImpressionShare,
        -- Click metrics
        \`Total Click Count\` as totalClickCount,
        \`Total Click Rate\` / 100 as totalClickRate,
        \`ASIN Click Count\` as asinClickCount,
        \`ASIN Click Share\` / 100 as asinClickShare,
        \`Total Median Click Price Amount\` as totalMedianClickPrice,
        \`ASIN Median Click Price Amount\` as asinMedianClickPrice,
        \`Total Same Day Shipping Click Count\` as totalSameDayShippingClickCount,
        \`Total One Day Shipping Click Count\` as totalOneDayShippingClickCount,
        \`Total Two Day Shipping Click Count\` as totalTwoDayShippingClickCount,
        -- Cart Add metrics
        \`Total Cart Add Count\` as totalCartAddCount,
        \`Total Cart Add Rate\` / 100 as totalCartAddRate,
        \`ASIN Cart Add Count\` as asinCartAddCount,
        \`ASIN Cart Add Share\` / 100 as asinCartAddShare,
        \`Total Median Cart Add Price Amount\` as totalMedianCartAddPrice,
        \`ASIN Median Cart Add Price Amount\` as asinMedianCartAddPrice,
        \`Total Same Day Shipping Cart Add Count\` as totalSameDayShippingCartAddCount,
        \`Total One Day Shipping Cart Add Count\` as totalOneDayShippingCartAddCount,
        \`Total Two Day Shipping Cart Add Count\` as totalTwoDayShippingCartAddCount,
        -- Purchase metrics
        \`Total Purchase Count\` as totalPurchaseCount,
        \`Total Purchase Rate\` / 100 as totalPurchaseRate,
        \`ASIN Purchase Count\` as asinPurchaseCount,
        \`ASIN Purchase Share\` / 100 as asinPurchaseShare,
        \`Total Median Purchase Price Amount\` as totalMedianPurchasePrice,
        \`ASIN Median Purchase Price Amount\` as asinMedianPurchasePrice,
        \`Total Same Day Shipping Purchase Count\` as totalSameDayShippingPurchaseCount,
        \`Total One Day Shipping Purchase Count\` as totalOneDayShippingPurchaseCount,
        \`Total Two Day Shipping Purchase Count\` as totalTwoDayShippingPurchaseCount
      FROM \`${bigqueryConfig.projectId}.${bigqueryConfig.dataset}.${tables.sqpRaw}\`
      WHERE Date >= '${startDateStr}'
        AND Date <= '${endDateStr}'
      ORDER BY Date, \`Child ASIN\`
    `;

    console.log('Querying BigQuery...');
    const [job] = await bigquery.createQueryJob({ query });
    const [rows] = await job.getQueryResults();

    if (!rows || rows.length === 0) {
      console.log('No data found for this week');
      return { success: true, recordsProcessed: 0, errors: [] };
    }

    console.log(`Found ${rows.length} rows to process`);

    // Transform rows into nested structure
    const asinMap = new Map<string, any>();

    for (const row of rows) {
      // Handle BigQuery date format
      const startDate = typeof row.startDate === 'object' && row.startDate.value 
        ? row.startDate.value.split('T')[0] 
        : row.startDate;
      const endDate = typeof row.endDate === 'object' && row.endDate.value 
        ? row.endDate.value.split('T')[0] 
        : row.endDate;

      const key = `${startDate}_${endDate}_${row.asin}`;
      
      if (!asinMap.has(key)) {
        asinMap.set(key, {
          startDate: startDate,
          endDate: endDate,
          asin: row.asin,
          productName: row.productName,
          clientName: row.clientName,
          searchQueryData: []
        });
      }

      asinMap.get(key)!.searchQueryData.push({
        searchQuery: row.searchQuery,
        searchQueryScore: row.searchQueryScore,
        searchQueryVolume: row.searchQueryVolume,
        impressionData: {
          totalQueryImpressionCount: row.totalQueryImpressionCount,
          asinImpressionCount: row.asinImpressionCount,
          asinImpressionShare: row.asinImpressionShare
        },
        clickData: {
          totalClickCount: row.totalClickCount,
          totalClickRate: row.totalClickRate,
          asinClickCount: row.asinClickCount,
          asinClickShare: row.asinClickShare,
          totalMedianClickPrice: row.totalMedianClickPrice,
          asinMedianClickPrice: row.asinMedianClickPrice,
          totalSameDayShippingClickCount: row.totalSameDayShippingClickCount,
          totalOneDayShippingClickCount: row.totalOneDayShippingClickCount,
          totalTwoDayShippingClickCount: row.totalTwoDayShippingClickCount
        },
        cartAddData: {
          totalCartAddCount: row.totalCartAddCount,
          totalCartAddRate: row.totalCartAddRate,
          asinCartAddCount: row.asinCartAddCount,
          asinCartAddShare: row.asinCartAddShare,
          totalMedianCartAddPrice: row.totalMedianCartAddPrice,
          asinMedianCartAddPrice: row.asinMedianCartAddPrice,
          totalSameDayShippingCartAddCount: row.totalSameDayShippingCartAddCount,
          totalOneDayShippingCartAddCount: row.totalOneDayShippingCartAddCount,
          totalTwoDayShippingCartAddCount: row.totalTwoDayShippingCartAddCount
        },
        purchaseData: {
          totalPurchaseCount: row.totalPurchaseCount,
          totalPurchaseRate: row.totalPurchaseRate,
          asinPurchaseCount: row.asinPurchaseCount,
          asinPurchaseShare: row.asinPurchaseShare,
          totalMedianPurchasePrice: row.totalMedianPurchasePrice,
          asinMedianPurchasePrice: row.asinMedianPurchasePrice,
          totalSameDayShippingPurchaseCount: row.totalSameDayShippingPurchaseCount,
          totalOneDayShippingPurchaseCount: row.totalOneDayShippingPurchaseCount,
          totalTwoDayShippingPurchaseCount: row.totalTwoDayShippingPurchaseCount
        }
      });
    }

    const nestedResponse = {
      dataByAsin: Array.from(asinMap.values())
    };

    // Transform and sync data
    console.log(`Processing ${nestedResponse.dataByAsin.length} ASINs...`);
    const transformer = new NestedDataTransformer();
    const results = await transformer.transformAndSync(nestedResponse);

    console.log(`Week sync completed:`, {
      success: results.errors.length === 0,
      asinRecords: results.asinRecords,
      queryRecords: results.queryRecords,
      errors: results.errors.length
    });
    
    return results;
  } catch (error) {
    console.error(`Failed to sync week:`, error);
    return { success: false, recordsProcessed: 0, errors: [error] };
  }
}

async function main() {
  console.log('Starting full data sync (without logging)...');

  // Define date range
  const startDate = new Date('2024-08-18');
  const endDate = new Date('2025-08-10');
  
  let totalRecords = 0;
  let totalErrors = 0;
  let successfulWeeks = 0;
  let failedWeeks = 0;

  // Sync week by week
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const weekStart = new Date(currentDate);
    const weekEnd = new Date(currentDate);
    weekEnd.setDate(weekEnd.getDate() + 6); // Add 6 days to get a full week
    
    // Don't go past the end date
    if (weekEnd > endDate) {
      weekEnd.setTime(endDate.getTime());
    }

    const result = await syncWeek(weekStart, weekEnd);
    
    if (result.success !== false) {
      successfulWeeks++;
      totalRecords += (result.asinRecords || 0) + (result.queryRecords || 0);
    } else {
      failedWeeks++;
    }
    
    totalErrors += result.errors?.length || 0;

    // Move to next week
    currentDate.setDate(currentDate.getDate() + 7);
    
    // Small delay between weeks to avoid overloading
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n=== FULL SYNC COMPLETE ===');
  console.log(`Total records processed: ${totalRecords}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log(`Successful weeks: ${successfulWeeks}`);
  console.log(`Failed weeks: ${failedWeeks}`);

  // Query final stats
  try {
    const supabase = getSupabaseClient();
    
    const { count: asinCount } = await supabase
      .from('asin_performance_data')
      .select('*', { count: 'exact', head: true });
      
    console.log(`\nTotal ASINs in database: ${asinCount}`);

    const { count: queryCount } = await supabase
      .from('search_query_performance')
      .select('*', { count: 'exact', head: true });
      
    console.log(`Total search queries in database: ${queryCount}`);

    // Check product titles
    const { data: productTitleStats, error } = await supabase.rpc('get_product_title_stats');
    if (!error && productTitleStats) {
      console.log(`\nProduct title statistics:`, productTitleStats);
    }
  } catch (err) {
    console.log('\nCould not get final stats');
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});