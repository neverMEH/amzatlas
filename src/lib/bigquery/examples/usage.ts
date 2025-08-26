import { 
  initializeBigQuery, 
  executeQuery, 
  estimateQueryCost,
  getDefaultPermissionsManager,
  cleanupBigQuery 
} from '@/lib/bigquery';
import { getFullTableName } from '@/config/bigquery.config';

/**
 * Example: Initialize BigQuery and check permissions
 */
export async function checkSetup() {
  try {
    // Initialize BigQuery infrastructure
    const { pool, permissions } = initializeBigQuery();
    
    // Check dataset permissions
    const datasetPerms = await permissions.checkDatasetPermissions('sqp_data');
    console.log('Dataset permissions:', datasetPerms);
    
    // List accessible datasets
    const datasets = await permissions.listAccessibleDatasets();
    console.log('Accessible datasets:', datasets);
    
    // Get pool statistics
    const poolStats = pool.getPoolStats();
    console.log('Connection pool stats:', poolStats);
    
  } catch (error) {
    console.error('Setup check failed:', error);
  }
}

/**
 * Example: Query SQP data with cost estimation
 */
export async function querySQPData() {
  try {
    const tableName = getFullTableName('sqpRaw');
    const query = `
      SELECT 
        query,
        impressions,
        clicks,
        purchases,
        DATE(query_date) as date
      FROM \`${tableName}\`
      WHERE query_date >= @startDate
        AND query_date < @endDate
        AND impressions > @minImpressions
      ORDER BY purchases DESC
      LIMIT 100
    `;
    
    const params = {
      startDate: '2024-01-01',
      endDate: '2024-02-01',
      minImpressions: 1000,
    };
    
    // Estimate query cost
    const costEstimate = await estimateQueryCost(query);
    console.log('Query cost estimate:', {
      estimatedCostUSD: costEstimate.estimatedCostUSD,
      estimatedGB: (costEstimate.estimatedBytes / (1024 ** 3)).toFixed(2),
      cacheHit: costEstimate.cacheHit,
    });
    
    // Execute query
    const results = await executeQuery(query, params);
    console.log(`Found ${results.length} keywords`);
    
    // Display top 5 results
    results.slice(0, 5).forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.query}: ${row.purchases} purchases`);
    });
    
  } catch (error) {
    console.error('Query failed:', error);
  }
}

/**
 * Example: Calculate daily metrics
 */
export async function calculateDailyMetrics(date: string) {
  try {
    const sourceTable = getFullTableName('sqpRaw');
    const targetTable = getFullTableName('sqpProcessed');
    
    const query = `
      INSERT INTO \`${targetTable}\` (
        date,
        asin,
        keyword,
        impressions,
        clicks,
        purchases,
        ctr,
        cvr,
        purchase_share
      )
      SELECT
        @targetDate as date,
        asin,
        query as keyword,
        SUM(impressions) as impressions,
        SUM(clicks) as clicks,
        SUM(purchases) as purchases,
        SAFE_DIVIDE(SUM(clicks), SUM(impressions)) as ctr,
        SAFE_DIVIDE(SUM(purchases), SUM(clicks)) as cvr,
        SAFE_DIVIDE(
          SUM(purchases),
          SUM(SUM(purchases)) OVER (PARTITION BY query)
        ) as purchase_share
      FROM \`${sourceTable}\`
      WHERE DATE(query_date) = @targetDate
      GROUP BY asin, query
    `;
    
    await executeQuery(query, { targetDate: date });
    console.log(`Daily metrics calculated for ${date}`);
    
  } catch (error) {
    console.error('Failed to calculate daily metrics:', error);
  }
}

/**
 * Example: Validate table access
 */
export async function validateAccess() {
  try {
    const permissions = getDefaultPermissionsManager();
    
    const tables = [
      { dataset: 'sqp_data', table: 'sqp_raw' },
      { dataset: 'sqp_data', table: 'sqp_processed' },
      { dataset: 'sqp_data', table: 'sqp_metrics' },
    ];
    
    const validation = await permissions.validateTableAccess(tables);
    
    if (validation.valid) {
      console.log('✅ All tables accessible');
    } else {
      if (validation.missing.length > 0) {
        console.log('❌ Missing tables:', validation.missing);
      }
      if (validation.inaccessible.length > 0) {
        console.log('❌ Inaccessible tables:', validation.inaccessible);
      }
    }
    
  } catch (error) {
    console.error('Validation failed:', error);
  }
}

/**
 * Example: Run all examples
 */
export async function runExamples() {
  console.log('🚀 BigQuery Examples\n');
  
  console.log('1. Checking setup...');
  await checkSetup();
  
  console.log('\n2. Validating table access...');
  await validateAccess();
  
  console.log('\n3. Querying SQP data...');
  await querySQPData();
  
  console.log('\n4. Calculating daily metrics...');
  await calculateDailyMetrics('2024-01-15');
  
  // Cleanup
  cleanupBigQuery();
  console.log('\n✅ Examples completed');
}

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}