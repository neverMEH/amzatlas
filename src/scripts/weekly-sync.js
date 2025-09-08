#!/usr/bin/env node

/**
 * Weekly 60-Day Rolling BigQuery to Supabase Sync Script
 * Designed to run once a week via Railway cron
 * Syncs the last 60 days of data to ensure no gaps
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { BigQuery } = require('@google-cloud/bigquery');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
try {
  require('dotenv').config();
} catch (e) {
  // dotenv might not be available in production
}

// Configuration
const CONFIG = {
  batchSize: parseInt(process.env.SYNC_BATCH_SIZE) || 5000,
  daysToSync: parseInt(process.env.SYNC_DAYS) || 60,
  maxRetries: 3,
  retryDelay: 5000
};

class WeeklySync {
  constructor() {
    this.logger = this.createLogger();
    this.credentialsPath = null;
    this.startTime = Date.now();
  }

  createLogger() {
    return {
      info: (msg, data) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] INFO: ${msg}`);
        if (data) console.log(JSON.stringify(data, null, 2));
      },
      error: (msg, data) => {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] ERROR: ${msg}`);
        if (data) console.error(JSON.stringify(data, null, 2));
      }
    };
  }

  async setupCredentials() {
    // Parse BigQuery credentials from environment
    let credsString = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!credsString) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON not found');
    }
    
    // Clean up credentials string
    if (credsString.startsWith("'")) credsString = credsString.slice(1, -1);
    
    let credentials;
    try {
      credentials = JSON.parse(credsString);
    } catch (e) {
      // Try unescaping if direct parse fails
      credsString = credsString.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      credentials = JSON.parse(credsString);
    }
    
    // Fix newlines in private key
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    
    // Write credentials to temp file for BigQuery client
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'weekly-sync-'));
    this.credentialsPath = path.join(tempDir, 'credentials.json');
    fs.writeFileSync(this.credentialsPath, JSON.stringify(credentials, null, 2));
    
    return credentials;
  }

  async run() {
    let syncStats = {
      success: false,
      parentRecordsInserted: 0,
      searchQueriesInserted: 0,
      totalRowsProcessed: 0,
      errors: []
    };
    let syncLogId = null;
    let supabase = null;
    let bigquery = null;

    try {
      this.logger.info('Starting Weekly 60-Day Rolling Sync');

      // Setup credentials
      const credentials = await this.setupCredentials();

      // Initialize clients
      const projectId = process.env.BIGQUERY_PROJECT_ID || credentials.project_id;
      const dataset = (process.env.BIGQUERY_DATASET || 'dataclient_amzatlas_agency_85').replace(/\.$/, '');
      
      bigquery = new BigQuery({
        projectId: projectId,
        keyFilename: this.credentialsPath
      });
      
      supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      this.logger.info('Connected to services', {
        bigQueryProject: projectId,
        bigQueryDataset: dataset
      });

      // Calculate date range (60 days rolling window)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - CONFIG.daysToSync);

      this.logger.info('Date range for sync', {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        days: CONFIG.daysToSync
      });

      // Step 1: Check what data is available in BigQuery
      this.logger.info('Analyzing BigQuery data availability');
      const statsQuery = `
        SELECT 
          COUNT(*) as total_rows,
          MIN(Date) as earliest_date,
          MAX(Date) as latest_date,
          COUNT(DISTINCT "Parent ASIN") as unique_asins,
          COUNT(DISTINCT DATE(Date)) as unique_days
        FROM \`${projectId}.${dataset}.seller-search_query_performance\`
        WHERE Date >= TIMESTAMP(@startDate)
          AND Date <= TIMESTAMP(@endDate)
          AND "Parent ASIN" IS NOT NULL
      `;
      
      const [stats] = await bigquery.query({
        query: statsQuery,
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      });
      
      const dataStats = stats[0];
      
      this.logger.info('Data analysis complete', {
        rowsToSync: dataStats.total_rows,
        uniqueAsins: dataStats.unique_asins,
        uniqueDays: dataStats.unique_days,
        dateRange: `${dataStats.earliest_date?.value || 'N/A'} to ${dataStats.latest_date?.value || 'N/A'}`
      });

      if (dataStats.total_rows === 0) {
        this.logger.info('No data found in BigQuery for the specified date range');
        
        // Still create a sync log entry for tracking
        await supabase
          .from('sync_log')
          .insert({
            sync_type: 'weekly-60-day',
            table_name: 'asin_performance_data',
            status: 'completed',
            started_at: new Date(this.startTime).toISOString(),
            completed_at: new Date().toISOString(),
            rows_synced: 0,
            metadata: {
              message: 'No data found in date range',
              dateRange: {
                start: startDate.toISOString().split('T')[0],
                end: endDate.toISOString().split('T')[0]
              }
            }
          });
          
        return syncStats;
      }

      // Step 2: Create sync log entry
      const { data: syncLog } = await supabase
        .from('sync_log')
        .insert({
          sync_type: 'weekly-60-day',
          table_name: 'asin_performance_data',
          status: 'in_progress',
          started_at: new Date(this.startTime).toISOString(),
          metadata: {
            source: 'bigquery',
            target: 'supabase',
            dateRange: {
              start: startDate.toISOString().split('T')[0],
              end: endDate.toISOString().split('T')[0]
            },
            estimatedRows: dataStats.total_rows,
            batchSize: CONFIG.batchSize
          }
        })
        .select()
        .single();

      syncLogId = syncLog?.id;
      this.logger.info('Created sync log entry', { syncLogId });

      // Step 3: Sync parent ASIN records
      this.logger.info('Syncing parent ASIN records');
      
      const parentQuery = `
        SELECT DISTINCT
          "Parent ASIN" as asin,
          "Product Name" as product_title,
          DATE(Date) as date
        FROM \`${projectId}.${dataset}.seller-search_query_performance\`
        WHERE Date >= TIMESTAMP(@startDate)
          AND Date <= TIMESTAMP(@endDate)
          AND "Parent ASIN" IS NOT NULL
        ORDER BY date DESC, asin
      `;

      const [parentRows] = await bigquery.query({
        query: parentQuery,
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      });

      this.logger.info(`Found ${parentRows.length} unique parent ASIN/date combinations`);

      // Process parent records efficiently
      const parentBatchSize = 100;
      for (let i = 0; i < parentRows.length; i += parentBatchSize) {
        const batch = parentRows.slice(i, i + parentBatchSize).map(row => ({
          asin: row.asin,
          product_title: row.product_title || null,
          start_date: row.date.value?.split('T')[0] || row.date,
          end_date: row.date.value?.split('T')[0] || row.date
        }));

        const { error } = await supabase
          .from('asin_performance_data')
          .upsert(batch, {
            onConflict: 'asin,start_date,end_date',
            ignoreDuplicates: false
          });

        if (error) {
          this.logger.error(`Error upserting parent batch ${Math.floor(i / parentBatchSize) + 1}`, error);
          syncStats.errors.push(error.message);
        } else {
          syncStats.parentRecordsInserted += batch.length;
          this.logger.info(`Processed ${i + batch.length} of ${parentRows.length} parent records`);
        }
      }

      // Step 4: Get parent record IDs for foreign key references
      this.logger.info('Fetching parent record IDs');
      const { data: parentData } = await supabase
        .from('asin_performance_data')
        .select('id, asin, start_date')
        .gte('start_date', startDate.toISOString().split('T')[0]);

      const parentLookup = new Map();
      parentData?.forEach(p => {
        parentLookup.set(`${p.asin}_${p.start_date}`, p.id);
      });

      this.logger.info(`Created lookup map with ${parentLookup.size} parent records`);

      // Step 5: Sync search query data using de-duplication approach
      this.logger.info('Syncing search query data with de-duplication');
      
      const searchQuery = `
        WITH raw_data AS (
          SELECT 
            Date,
            "Parent ASIN" as parent_asin,
            "Child ASIN" as child_asin,
            "Search Query" as search_query,
            "Search Query Score" as search_query_score,
            "Search Query Volume" as search_query_volume,
            "ASIN Impression Count" as impressions,
            "ASIN Click Count" as clicks,
            "ASIN Cart Add Count" as cart_adds,
            "ASIN Purchase Count" as purchases,
            "ASIN Impression Share" as impression_share,
            "ASIN Click Share" as click_share,
            "ASIN Cart Add Share" as cart_add_share,
            "ASIN Purchase Share" as purchase_share
          FROM \`${projectId}.${dataset}.seller-search_query_performance\`
          WHERE Date >= TIMESTAMP(@startDate)
            AND Date <= TIMESTAMP(@endDate)
            AND "Parent ASIN" IS NOT NULL
            AND "Search Query" IS NOT NULL
        ),
        deduplicated_data AS (
          SELECT 
            Date,
            parent_asin,
            child_asin,
            search_query,
            MAX(search_query_score) as search_query_score,
            MAX(search_query_volume) as search_query_volume,
            MAX(impressions) as impressions,
            MAX(clicks) as clicks,
            MAX(cart_adds) as cart_adds,
            MAX(purchases) as purchases,
            MAX(impression_share) as impression_share,
            MAX(click_share) as click_share,
            MAX(cart_add_share) as cart_add_share,
            MAX(purchase_share) as purchase_share,
            ROW_NUMBER() OVER (
              PARTITION BY Date, parent_asin, search_query 
              ORDER BY MAX(search_query_score) DESC
            ) as row_num
          FROM raw_data
          GROUP BY Date, parent_asin, child_asin, search_query
        )
        SELECT * FROM deduplicated_data
        WHERE row_num = 1
        ORDER BY Date DESC
      `;

      const [searchRows] = await bigquery.query({
        query: searchQuery,
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      });

      this.logger.info(`Retrieved ${searchRows.length} unique search queries from BigQuery`);

      // Process search queries in batches
      const searchBatchSize = 500;
      let processedCount = 0;

      for (let i = 0; i < searchRows.length; i += searchBatchSize) {
        const batch = searchRows.slice(i, i + searchBatchSize);
        const searchRecords = [];

        for (const row of batch) {
          const dateStr = row.Date.value ? row.Date.value.split('T')[0] : row.Date.split('T')[0];
          const parentId = parentLookup.get(`${row.parent_asin}_${dateStr}`);

          if (!parentId) {
            continue; // Skip if parent record not found
          }

          searchRecords.push({
            asin_performance_id: parentId,
            search_query: row.search_query,
            search_query_score: parseInt(row.search_query_score) || 0,
            search_query_volume: parseInt(row.search_query_volume) || 0,
            total_query_impression_count: parseInt(row.impressions) || 0,
            asin_impression_count: parseInt(row.impressions) || 0,
            asin_impression_share: parseFloat(row.impression_share) || 0,
            total_click_count: parseInt(row.clicks) || 0,
            asin_click_count: parseInt(row.clicks) || 0,
            asin_click_share: parseFloat(row.click_share) || 0,
            total_cart_add_count: parseInt(row.cart_adds) || 0,
            asin_cart_add_count: parseInt(row.cart_adds) || 0,
            asin_cart_add_share: parseFloat(row.cart_add_share) || 0,
            total_purchase_count: parseInt(row.purchases) || 0,
            asin_purchase_count: parseInt(row.purchases) || 0,
            asin_purchase_share: parseFloat(row.purchase_share) || 0
          });
        }

        if (searchRecords.length > 0) {
          // Use insert with ON CONFLICT DO NOTHING to avoid duplicates
          const { count, error } = await supabase
            .from('search_query_performance')
            .upsert(searchRecords, {
              onConflict: 'asin_performance_id,search_query',
              ignoreDuplicates: true,
              count: 'exact'
            });

          if (error) {
            this.logger.error(`Error inserting search query batch ${Math.floor(i / searchBatchSize) + 1}`, error);
            syncStats.errors.push(error.message);
          } else {
            syncStats.searchQueriesInserted += count || 0;
            processedCount += searchRecords.length;
            this.logger.info(`Processed ${processedCount} of ${searchRows.length} search queries. Inserted: ${count || 0}`);
          }
        }
      }

      syncStats.totalRowsProcessed = processedCount;

      // Step 6: Update sync log with results
      if (syncLogId) {
        await supabase
          .from('sync_log')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            rows_synced: syncStats.searchQueriesInserted,
            metadata: {
              parentRecordsInserted: syncStats.parentRecordsInserted,
              searchQueriesInserted: syncStats.searchQueriesInserted,
              totalRowsProcessed: syncStats.totalRowsProcessed,
              duration: Date.now() - this.startTime,
              errors: syncStats.errors,
              dateRange: {
                start: startDate.toISOString().split('T')[0],
                end: endDate.toISOString().split('T')[0]
              }
            }
          })
          .eq('id', syncLogId);
      }

      syncStats.success = true;
      this.logger.info('Weekly sync completed successfully', {
        ...syncStats,
        duration: `${((Date.now() - this.startTime) / 1000).toFixed(2)}s`
      });

      // Health check support for Railway
      if (process.env.RAILWAY_ENVIRONMENT) {
        this.logger.info('Railway environment detected - sync healthy');
      }

    } catch (error) {
      this.logger.error('Sync failed', { 
        error: error.message,
        stack: error.stack 
      });
      syncStats.errors.push(error.message);
      
      // Update sync log with failure
      if (syncLogId && supabase) {
        await supabase
          .from('sync_log')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error.message,
            metadata: {
              errors: syncStats.errors,
              duration: Date.now() - this.startTime
            }
          })
          .eq('id', syncLogId);
      }
      
      // Exit with error code for Railway monitoring
      process.exit(1);
    } finally {
      // Clean up credentials file
      if (this.credentialsPath && fs.existsSync(this.credentialsPath)) {
        fs.unlinkSync(this.credentialsPath);
        const tempDir = path.dirname(this.credentialsPath);
        fs.rmdirSync(tempDir);
      }
    }

    return syncStats;
  }
}

// Run the sync
if (require.main === module) {
  const sync = new WeeklySync();
  sync.run()
    .then(stats => {
      console.log('\n✅ Weekly 60-day rolling sync completed');
      console.log(`Parent records: ${stats.parentRecordsInserted}`);
      console.log(`Search queries: ${stats.searchQueriesInserted}`);
      console.log(`Total processed: ${stats.totalRowsProcessed}`);
      if (stats.errors.length > 0) {
        console.log(`Errors encountered: ${stats.errors.length}`);
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Weekly sync failed:', error);
      process.exit(1);
    });
}

module.exports = WeeklySync;