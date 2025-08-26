import {
  initializeBigQuery,
  SQPDataExtractor,
  DataValidator,
  getDefaultPool,
} from '@/lib/bigquery';

/**
 * Example: Extract SQP data with filters
 */
export async function extractFilteredData() {
  const pool = getDefaultPool();
  const extractor = new SQPDataExtractor(pool);
  
  try {
    // Extract data for specific date range and ASINs
    const result = await extractor.extractSQPData({
      dateRange: {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      },
      asins: ['B001234567', 'B007654321'],
      minImpressions: 1000,
      validateData: true,
    });
    
    console.log(`Extracted ${result.recordCount} records`);
    console.log(`Execution time: ${result.executionTimeMs}ms`);
    
    if (result.validationErrors && result.validationErrors.length > 0) {
      console.log(`Found ${result.validationErrors.length} validation errors`);
    }
    
    // Display sample data
    result.data.slice(0, 5).forEach(record => {
      console.log(`${record.query}: ${record.purchases} purchases (${record.impressions} impressions)`);
    });
    
  } catch (error) {
    console.error('Extraction failed:', error);
  }
}

/**
 * Example: Stream large dataset with progress tracking
 */
export async function streamLargeDataset() {
  const pool = getDefaultPool();
  const extractor = new SQPDataExtractor(pool);
  
  let totalProcessed = 0;
  const chunks: any[] = [];
  
  await extractor.streamSQPData(
    {
      dateRange: {
        startDate: '2024-01-01',
        endDate: '2024-03-31',
      },
      minImpressions: 100,
    },
    {
      onData: async (chunk) => {
        chunks.push(chunk);
        totalProcessed += chunk.length;
        console.log(`Processed batch: ${chunk.length} records`);
        
        // Process chunk here (e.g., write to file, insert to database)
        await processChunk(chunk);
      },
      onProgress: (progress) => {
        console.log(`Progress: ${progress.processed}/${progress.total} (${progress.percentage?.toFixed(2)}%)`);
      },
      onError: (error) => {
        console.error('Stream error:', error);
      },
      batchSize: 5000,
    }
  );
  
  console.log(`Total records processed: ${totalProcessed}`);
}

/**
 * Example: Incremental data extraction
 */
export async function runIncrementalExtraction() {
  const pool = getDefaultPool();
  const extractor = new SQPDataExtractor(pool);
  const extractionId = 'daily-sqp-sync';
  
  try {
    // Get last extraction state
    const state = await extractor.getExtractionState(extractionId);
    
    console.log('Last extraction:', state.lastRun);
    console.log('Last watermark:', state.lastWatermark);
    
    // Update state to running
    await extractor.updateExtractionState(extractionId, {
      status: 'running',
      lastRun: new Date(),
    });
    
    // Extract incremental data
    const result = await extractor.extractIncremental({
      lastProcessedTime: state.lastWatermark as string || '2024-01-01T00:00:00Z',
      column: 'updated_at',
    });
    
    console.log(`Extracted ${result.recordCount} new/updated records`);
    console.log(`New watermark: ${result.newWatermark}`);
    
    // Process the incremental data
    await processIncrementalData(result.data);
    
    // Update extraction state
    await extractor.updateExtractionState(extractionId, {
      status: 'completed',
      lastWatermark: result.newWatermark,
      recordsProcessed: state.recordsProcessed + result.recordCount,
    });
    
  } catch (error) {
    // Update state to failed
    await extractor.updateExtractionState(extractionId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Example: Competitive analysis
 */
export async function analyzeCompetition() {
  const pool = getDefaultPool();
  const extractor = new SQPDataExtractor(pool);
  
  try {
    const result = await extractor.extractCompetitiveAnalysis(
      ['yoga mat', 'exercise mat', 'workout mat'],
      ['B001234567', 'B007654321', 'B009876543'], // Your ASIN vs competitors
      {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      }
    );
    
    console.log('\nCompetitive Analysis Results:');
    console.log('================================');
    
    result.data.forEach(row => {
      console.log(`
Keyword: ${row.keyword}
ASIN: ${row.asin}
Rank: #${row.rank}
Market Share: ${(row.market_share * 100).toFixed(2)}%
Purchases: ${row.purchases}
CTR: ${(row.ctr * 100).toFixed(2)}%
CVR: ${(row.cvr * 100).toFixed(2)}%
Relative Performance: ${(row.relative_performance * 100).toFixed(0)}%
      `);
    });
    
  } catch (error) {
    console.error('Competitive analysis failed:', error);
  }
}

/**
 * Example: Trend analysis
 */
export async function analyzeTrends() {
  const pool = getDefaultPool();
  const extractor = new SQPDataExtractor(pool);
  
  try {
    const result = await extractor.extractTrendAnalysis(
      ['impressions', 'clicks', 'purchases'],
      'weekly',
      8, // 8-week moving average
      {
        startDate: '2023-10-01',
        endDate: '2024-01-31',
      }
    );
    
    console.log('\nWeekly Trend Analysis:');
    console.log('======================');
    
    result.data.forEach(row => {
      if (row.impressions_previous) {
        console.log(`
Week of ${row.period}:
  Impressions: ${row.impressions.toLocaleString()} (${row.impressions_change_percent > 0 ? '+' : ''}${row.impressions_change_percent?.toFixed(1)}%)
  Clicks: ${row.clicks.toLocaleString()} (${row.clicks_change_percent > 0 ? '+' : ''}${row.clicks_change_percent?.toFixed(1)}%)
  Purchases: ${row.purchases} (${row.purchases_change_percent > 0 ? '+' : ''}${row.purchases_change_percent?.toFixed(1)}%)
  8-Week Avg Purchases: ${row.purchases_moving_avg?.toFixed(1)}
        `);
      }
    });
    
  } catch (error) {
    console.error('Trend analysis failed:', error);
  }
}

/**
 * Example: Keyword discovery
 */
export async function discoverNewKeywords() {
  const pool = getDefaultPool();
  const extractor = new SQPDataExtractor(pool);
  
  try {
    const result = await extractor.discoverKeywords(
      ['yoga', 'pilates', 'exercise'],
      10, // Min 10 purchases
      0.05, // Min 5% CVR
      50 // Top 50 results
    );
    
    console.log('\nDiscovered Keywords:');
    console.log('===================');
    
    result.data.forEach((keyword, idx) => {
      console.log(`
${idx + 1}. "${keyword.keyword}"
   Relevance Score: ${keyword.relevance_score.toFixed(2)}
   Purchases: ${keyword.purchases}
   CVR: ${(keyword.cvr * 100).toFixed(2)}%
   CTR: ${(keyword.ctr * 100).toFixed(2)}%
      `);
    });
    
  } catch (error) {
    console.error('Keyword discovery failed:', error);
  }
}

/**
 * Example: Data validation
 */
export async function validateDataQuality() {
  const pool = getDefaultPool();
  const extractor = new SQPDataExtractor(pool);
  const validator = DataValidator.createHighValueValidator();
  
  try {
    // Extract data
    const result = await extractor.extractSQPData({
      dateRange: {
        startDate: '2024-01-01',
        endDate: '2024-01-07',
      },
    });
    
    // Run validation checks
    console.log('\nData Quality Report:');
    console.log('===================');
    
    // Check for duplicates
    const duplicates = validator.checkDuplicates(result.data);
    console.log(`Duplicate records: ${duplicates.hasDuplicates ? 'Yes' : 'No'}`);
    if (duplicates.hasDuplicates) {
      console.log(`Found ${duplicates.duplicateGroups.length} duplicate groups`);
    }
    
    // Detect anomalies
    const anomalies = validator.detectAnomalies(result.data);
    console.log(`\nAnomalies detected: ${anomalies.length}`);
    anomalies.forEach(anomaly => {
      console.log(`- ${anomaly.reason} (Severity: ${anomaly.severity})`);
    });
    
    // Check completeness
    const completeness = validator.checkCompleteness(result.data);
    console.log(`\nData completeness: ${(completeness.completenessScore * 100).toFixed(2)}%`);
    if (completeness.missingFields.length > 0) {
      console.log(`Missing optional fields: ${completeness.missingFields.join(', ')}`);
    }
    
    // Batch validation
    const batchValidation = validator.validateBatch(result.data);
    console.log(`\nValid records: ${batchValidation.validCount}`);
    console.log(`Invalid records: ${batchValidation.invalidCount}`);
    
  } catch (error) {
    console.error('Data validation failed:', error);
  }
}

/**
 * Helper functions
 */
async function processChunk(chunk: any[]): Promise<void> {
  // Simulate processing (e.g., write to file, insert to database)
  await new Promise(resolve => setTimeout(resolve, 100));
}

async function processIncrementalData(data: any[]): Promise<void> {
  // Process incremental data (e.g., update cache, send to downstream systems)
  console.log(`Processing ${data.length} incremental records...`);
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  // Initialize BigQuery
  initializeBigQuery();
  
  console.log('🚀 BigQuery Query Pipeline Examples\n');
  
  console.log('1. Extracting filtered data...');
  await extractFilteredData();
  
  console.log('\n2. Running incremental extraction...');
  await runIncrementalExtraction();
  
  console.log('\n3. Analyzing competition...');
  await analyzeCompetition();
  
  console.log('\n4. Analyzing trends...');
  await analyzeTrends();
  
  console.log('\n5. Discovering keywords...');
  await discoverNewKeywords();
  
  console.log('\n6. Validating data quality...');
  await validateDataQuality();
  
  console.log('\n✅ All examples completed');
}

// Run if executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}