#!/usr/bin/env node

/**
 * Daily BigQuery to Supabase Sync Script
 * This script runs daily to sync data from BigQuery to Supabase
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { BigQuery } = require('@google-cloud/bigquery');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const CONFIG = {
  batchSize: parseInt(process.env.SYNC_BATCH_SIZE) || 5000,
  maxRetries: 3,
  retryDelay: 5000, // 5 seconds
  logFile: process.env.SYNC_LOG_FILE || '/tmp/daily-sync.log'
};

// Logger
class Logger {
  constructor(logFile) {
    this.logFile = logFile;
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data
    };
    
    // Console output
    console.log(`[${timestamp}] ${level}: ${message}`);
    if (data) console.log(JSON.stringify(data, null, 2));
    
    // File output
    try {
      fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
    } catch (e) {
      // Ignore file write errors
    }
  }

  info(message, data) { this.log('INFO', message, data); }
  error(message, data) { this.log('ERROR', message, data); }
  success(message, data) { this.log('SUCCESS', message, data); }
}

const logger = new Logger(CONFIG.logFile);

// Main sync function
async function runDailySync() {
  logger.info('Starting daily BigQuery to Supabase sync', { 
    batchSize: CONFIG.batchSize,
    startTime: new Date().toISOString() 
  });
  
  let credentialsPath = null;
  let syncStats = {
    startTime: Date.now(),
    endTime: null,
    totalRows: 0,
    parentRecordsInserted: 0,
    searchQueriesInserted: 0,
    errors: []
  };
  
  try {
    // Load environment variables
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      // Try to load from .env file if not in environment
      try {
        require('dotenv').config();
      } catch (e) {
        // dotenv might not be available in production
      }
    }
    
    // Validate required environment variables
    const required = [
      'GOOGLE_APPLICATION_CREDENTIALS_JSON',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'BIGQUERY_PROJECT_ID',
      'BIGQUERY_DATASET'
    ];
    
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    // Setup BigQuery credentials
    logger.info('Setting up BigQuery credentials');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcp-sync-'));
    credentialsPath = path.join(tempDir, 'credentials.json');
    
    let credsString = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (credsString.startsWith("'")) credsString = credsString.slice(1, -1);
    
    let credentials;
    try {
      credentials = JSON.parse(credsString);
    } catch (e) {
      credsString = credsString.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      credentials = JSON.parse(credsString);
    }
    
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    
    fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
    
    // Initialize clients
    const projectId = process.env.BIGQUERY_PROJECT_ID || credentials.project_id;
    const dataset = process.env.BIGQUERY_DATASET || 'dataclient_amzatlas_agency_85';
    
    const bigquery = new BigQuery({
      projectId: projectId,
      keyFilename: credentialsPath
    });
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    logger.info('Connected to services', {
      bigQueryProject: projectId,
      bigQueryDataset: dataset,
      supabaseUrl: process.env.SUPABASE_URL
    });
    
    // Step 1: Analyze data to sync
    logger.info('Analyzing BigQuery data');
    const statsQuery = `
      SELECT 
        COUNT(*) as total_rows,
        MIN(Date) as earliest_date,
        MAX(Date) as latest_date,
        COUNT(DISTINCT "Parent ASIN") as unique_asins
      FROM \`${projectId}.${dataset}.seller-search_query_performance\`
      WHERE Date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
        AND "Parent ASIN" IS NOT NULL
    `;
    
    const [stats] = await bigquery.query({ query: statsQuery });
    const dataStats = stats[0];
    
    logger.info('Data analysis complete', {
      rowsToSync: dataStats.total_rows,
      uniqueAsins: dataStats.unique_asins,
      dateRange: `${dataStats.earliest_date?.value} to ${dataStats.latest_date?.value}`
    });
    
    if (dataStats.total_rows === 0) {
      logger.info('No new data to sync');
      return syncStats;
    }
    
    // Step 2: Create sync log entry
    const { data: syncLog } = await supabase
      .from('sync_log')
      .insert({
        sync_type: 'daily',
        status: 'in_progress',
        started_at: new Date().toISOString(),
        metadata: {
          source: 'bigquery',
          target: 'supabase',
          batchSize: CONFIG.batchSize
        }
      })
      .select()
      .single();
    
    const syncLogId = syncLog?.id;
    
    // Step 3: Sync parent records (asin_performance_data)
    logger.info('Syncing parent ASIN records');
    const parentQuery = `
      SELECT DISTINCT
        "Parent ASIN" as asin,
        DATE(Date) as date
      FROM \`${projectId}.${dataset}.seller-search_query_performance\`
      WHERE Date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
        AND "Parent ASIN" IS NOT NULL
    `;
    
    const [parentRows] = await bigquery.query({ query: parentQuery });
    logger.info(`Found ${parentRows.length} unique ASIN/date combinations`);
    
    // Process parent records in batches
    const parentBatchSize = 100;
    for (let i = 0; i < parentRows.length; i += parentBatchSize) {
      const batch = parentRows.slice(i, i + parentBatchSize);
      const records = batch.map(row => ({
        asin: row.asin,
        start_date: row.date.value || row.date,
        end_date: row.date.value || row.date
      }));
      
      // Check existing
      const asins = records.map(r => r.asin);
      const dates = records.map(r => r.start_date);
      
      const { data: existing } = await supabase
        .from('asin_performance_data')
        .select('asin, start_date, end_date')
        .in('asin', asins)
        .in('start_date', dates);
      
      const existingKeys = new Set(
        (existing || []).map(e => `${e.asin}_${e.start_date}_${e.end_date}`)
      );
      
      const newRecords = records.filter(r => 
        !existingKeys.has(`${r.asin}_${r.start_date}_${r.end_date}`)
      );
      
      if (newRecords.length > 0) {
        const { error } = await supabase
          .from('asin_performance_data')
          .insert(newRecords);
        
        if (!error) {
          syncStats.parentRecordsInserted += newRecords.length;
          logger.info(`Inserted ${newRecords.length} parent records (batch ${Math.floor(i/parentBatchSize) + 1})`);
        } else {
          logger.error(`Error inserting parent batch: ${error.message}`);
          syncStats.errors.push(error.message);
        }
      }
    }
    
    // Step 4: Get parent IDs
    logger.info('Fetching parent record IDs');
    const { data: parentData } = await supabase
      .from('asin_performance_data')
      .select('id, asin, start_date')
      .order('created_at', { ascending: false })
      .limit(5000);
    
    const parentLookup = new Map();
    parentData?.forEach(p => {
      parentLookup.set(`${p.asin}_${p.start_date}`, p.id);
    });
    
    // Step 5: Sync search query data
    logger.info('Syncing search query data');
    let offset = 0;
    let hasMore = true;
    
    while (hasMore && offset < dataStats.total_rows) {
      const searchQuery = `
        SELECT 
          Date,
          "Parent ASIN" as asin,
          "Search Query" as search_query,
          "Search Query Score" as score,
          "Search Query Volume" as volume,
          "ASIN Impression Count" as impressions,
          "ASIN Click Count" as clicks,
          "ASIN Cart Add Count" as cart_adds,
          "ASIN Purchase Count" as purchases,
          "ASIN Impression Share" as impression_share,
          "ASIN Click Share" as click_share,
          "ASIN Cart Add Share" as cart_add_share,
          "ASIN Purchase Share" as purchase_share
        FROM \`${projectId}.${dataset}.seller-search_query_performance\`
        WHERE Date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
          AND "Parent ASIN" IS NOT NULL
        ORDER BY Date DESC
        LIMIT ${CONFIG.batchSize}
        OFFSET ${offset}
      `;
      
      const [searchRows] = await bigquery.query({ query: searchQuery });
      
      if (searchRows.length === 0) {
        hasMore = false;
        break;
      }
      
      syncStats.totalRows += searchRows.length;
      
      // Transform and insert
      const searchRecords = searchRows
        .map(row => {
          const dateStr = row.Date.value ? row.Date.value.split('T')[0] : row.Date.split('T')[0];
          const parentId = parentLookup.get(`${row.asin}_${dateStr}`);
          
          if (!parentId) return null;
          
          return {
            asin_performance_id: parentId,
            search_query: row.search_query || '',
            search_query_score: parseInt(row.score) || 0,
            search_query_volume: parseInt(row.volume) || 0,
            asin_impression_count: parseInt(row.impressions) || 0,
            asin_click_count: parseInt(row.clicks) || 0,
            asin_cart_add_count: parseInt(row.cart_adds) || 0,
            asin_purchase_count: parseInt(row.purchases) || 0,
            asin_impression_share: parseFloat(row.impression_share) || 0,
            asin_click_share: parseFloat(row.click_share) || 0,
            asin_cart_add_share: parseFloat(row.cart_add_share) || 0,
            asin_purchase_share: parseFloat(row.purchase_share) || 0
          };
        })
        .filter(r => r !== null);
      
      if (searchRecords.length > 0) {
        const { data, error } = await supabase
          .from('search_query_performance')
          .insert(searchRecords)
          .select();
        
        if (!error) {
          syncStats.searchQueriesInserted += data.length;
          logger.info(`Inserted ${data.length} search queries (offset ${offset})`);
        } else if (!error.message.includes('duplicate')) {
          logger.error(`Error inserting search queries: ${error.message}`);
          syncStats.errors.push(error.message);
        }
      }
      
      offset += CONFIG.batchSize;
    }
    
    // Step 6: Update sync log
    if (syncLogId) {
      await supabase
        .from('sync_log')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          rows_synced: syncStats.totalRows,
          metadata: {
            parentRecordsInserted: syncStats.parentRecordsInserted,
            searchQueriesInserted: syncStats.searchQueriesInserted,
            errors: syncStats.errors
          }
        })
        .eq('id', syncLogId);
    }
    
    // Update refresh config
    await supabase
      .from('refresh_config')
      .update({
        last_refresh_at: new Date().toISOString(),
        next_refresh_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
      .in('table_name', ['asin_performance_data', 'search_query_performance']);
    
    syncStats.endTime = Date.now();
    const duration = (syncStats.endTime - syncStats.startTime) / 1000;
    
    logger.success('Daily sync completed successfully', {
      duration: `${duration} seconds`,
      parentRecordsInserted: syncStats.parentRecordsInserted,
      searchQueriesInserted: syncStats.searchQueriesInserted,
      totalRows: syncStats.totalRows,
      errors: syncStats.errors.length
    });
    
    return syncStats;
    
  } catch (error) {
    logger.error('Fatal error during sync', {
      error: error.message,
      stack: error.stack
    });
    
    // Update sync log if exists
    if (syncStats.syncLogId) {
      await supabase
        .from('sync_log')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error.message
        })
        .eq('id', syncStats.syncLogId);
    }
    
    throw error;
    
  } finally {
    // Cleanup
    if (credentialsPath && fs.existsSync(credentialsPath)) {
      fs.unlinkSync(credentialsPath);
      const tempDir = path.dirname(credentialsPath);
      fs.rmdirSync(tempDir);
      logger.info('Cleaned up temporary files');
    }
  }
}

// Health check endpoint for monitoring
if (process.argv.includes('--health-check')) {
  console.log('OK');
  process.exit(0);
}

// Run the sync
if (require.main === module) {
  runDailySync()
    .then(stats => {
      logger.info('Sync process completed', stats);
      process.exit(0);
    })
    .catch(error => {
      logger.error('Sync process failed', { error: error.message });
      process.exit(1);
    });
}

module.exports = { runDailySync };