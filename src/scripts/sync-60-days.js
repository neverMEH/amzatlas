#!/usr/bin/env node

/**
 * 60-Day BigQuery to Supabase Sync Script (Fixed Version)
 * Syncs the last 60 days of data from BigQuery to Supabase
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
  // dotenv might not be available
}

// Configuration
const CONFIG = {
  batchSize: parseInt(process.env.SYNC_BATCH_SIZE) || 5000,
  daysToSync: 60,
  maxRetries: 3,
  retryDelay: 5000
};

class SixtyDaySync {
  constructor() {
    this.logger = this.createLogger();
    this.credentialsPath = null;
  }

  createLogger() {
    return {
      info: (msg, data) => {
        console.log(`[${new Date().toISOString()}] INFO: ${msg}`);
        if (data) console.log(JSON.stringify(data, null, 2));
      },
      error: (msg, data) => {
        console.error(`[${new Date().toISOString()}] ERROR: ${msg}`);
        if (data) console.error(JSON.stringify(data, null, 2));
      }
    };
  }

  async setupCredentials() {
    // Parse BigQuery credentials
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
    
    // Write credentials to temp file
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-60-'));
    this.credentialsPath = path.join(tempDir, 'credentials.json');
    fs.writeFileSync(this.credentialsPath, JSON.stringify(credentials, null, 2));
    
    return credentials;
  }

  async run() {
    const startTime = Date.now();
    let syncStats = {
      success: false,
      parentRecordsInserted: 0,
      searchQueriesInserted: 0,
      errors: []
    };
    let syncLogId = null;
    let supabase = null;

    try {
      this.logger.info('Starting 60-day BigQuery to Supabase sync');

      // Setup credentials
      const credentials = await this.setupCredentials();

      // Initialize clients
      const projectId = process.env.BIGQUERY_PROJECT_ID || credentials.project_id;
      const dataset = process.env.BIGQUERY_DATASET || 'dataclient_amzatlas_agency_85';
      
      // Remove trailing dot if present
      const cleanDataset = dataset.replace(/\.$/, '');
      
      const bigquery = new BigQuery({
        projectId: projectId,
        keyFilename: this.credentialsPath
      });
      
      supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      this.logger.info('Connected to services', {
        bigQueryProject: projectId,
        bigQueryDataset: cleanDataset
      });

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - CONFIG.daysToSync);

      this.logger.info('Date range for sync', {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        days: CONFIG.daysToSync
      });

      // Step 1: Analyze data to sync
      this.logger.info('Analyzing BigQuery data for 60-day period');
      const statsQuery = `
        SELECT 
          COUNT(*) as total_rows,
          MIN(Date) as earliest_date,
          MAX(Date) as latest_date,
          COUNT(DISTINCT "Parent ASIN") as unique_asins,
          COUNT(DISTINCT "Child ASIN") as unique_child_asins
        FROM \`${projectId}.${cleanDataset}.seller-search_query_performance\`
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
        uniqueParentAsins: dataStats.unique_asins,
        uniqueChildAsins: dataStats.unique_child_asins,
        dateRange: `${dataStats.earliest_date?.value || 'N/A'} to ${dataStats.latest_date?.value || 'N/A'}`
      });

      if (dataStats.total_rows === 0) {
        this.logger.info('No data found in BigQuery for the specified date range');
        return syncStats;
      }

      // Step 2: Create sync log entry
      const { data: syncLog } = await supabase
        .from('sync_log')
        .insert({
          sync_type: '60-day-update',
          table_name: 'asin_performance_data',
          status: 'in_progress',
          started_at: new Date().toISOString(),
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

      // Step 3: Sync parent ASIN records first
      this.logger.info('Syncing parent ASIN records');
      
      // Get unique parent ASINs and dates
      const parentQuery = `
        SELECT DISTINCT
          "Parent ASIN" as asin,
          "Product Name" as product_title,
          DATE(Date) as date
        FROM \`${projectId}.${cleanDataset}.seller-search_query_performance\`
        WHERE Date >= TIMESTAMP(@startDate)
          AND Date <= TIMESTAMP(@endDate)
          AND "Parent ASIN" IS NOT NULL
        ORDER BY date, asin
      `;

      const [parentRows] = await bigquery.query({
        query: parentQuery,
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        }
      });

      this.logger.info(`Found ${parentRows.length} parent ASIN/date combinations`);

      // Insert parent records in batches
      const parentBatchSize = 100;
      for (let i = 0; i < parentRows.length; i += parentBatchSize) {
        const batch = parentRows.slice(i, i + parentBatchSize).map(row => ({
          asin: row.asin,
          product_title: row.product_title,
          start_date: row.date.value?.split('T')[0] || row.date,
          end_date: row.date.value?.split('T')[0] || row.date
        }));

        const { error } = await supabase
          .from('asin_performance_data')
          .upsert(batch, {
            onConflict: 'asin,start_date,end_date'
          });

        if (error) {
          this.logger.error(`Error upserting parent batch ${Math.floor(i / parentBatchSize) + 1}`, error);
          throw error;
        }

        syncStats.parentRecordsInserted += batch.length;
        this.logger.info(`Processed ${i + batch.length} of ${parentRows.length} parent records`);
      }

      // Step 4: Get parent record IDs for foreign key references
      this.logger.info('Fetching parent record IDs');
      const { data: parentData } = await supabase
        .from('asin_performance_data')
        .select('id, asin, start_date')
        .gte('start_date', startDate.toISOString().split('T')[0])
        .lte('start_date', endDate.toISOString().split('T')[0]);

      const parentLookup = new Map();
      parentData?.forEach(p => {
        parentLookup.set(`${p.asin}_${p.start_date}`, p.id);
      });

      this.logger.info(`Created lookup map with ${parentLookup.size} parent records`);

      // Step 5: Sync search query data
      this.logger.info('Syncing search query data');
      let offset = 0;
      let hasMore = true;

      while (hasMore && offset < dataStats.total_rows) {
        const searchQuery = `
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
          FROM \`${projectId}.${cleanDataset}.seller-search_query_performance\`
          WHERE Date >= TIMESTAMP(@startDate)
            AND Date <= TIMESTAMP(@endDate)
            AND "Parent ASIN" IS NOT NULL
            AND "Search Query" IS NOT NULL
          ORDER BY Date DESC
          LIMIT ${CONFIG.batchSize}
          OFFSET ${offset}
        `;

        const [searchRows] = await bigquery.query({
          query: searchQuery,
          params: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          }
        });

        if (searchRows.length === 0) {
          hasMore = false;
          break;
        }

        this.logger.info(`Processing search query batch: ${searchRows.length} rows (offset: ${offset})`);

        // Transform and prepare records for insertion
        const searchRecords = [];
        for (const row of searchRows) {
          const dateStr = row.Date.value ? row.Date.value.split('T')[0] : row.Date.split('T')[0];
          const parentId = parentLookup.get(`${row.parent_asin}_${dateStr}`);

          if (!parentId) {
            this.logger.error(`Parent ID not found for ${row.parent_asin} on ${dateStr}`);
            continue;
          }

          searchRecords.push({
            asin_performance_id: parentId,
            search_query: row.search_query,
            search_query_score: parseInt(row.search_query_score) || 0,
            search_query_volume: parseInt(row.search_query_volume) || 0,
            // Using total and ASIN counts from BigQuery
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
          // Insert in smaller batches to avoid conflicts
          const insertBatchSize = 500;
          for (let i = 0; i < searchRecords.length; i += insertBatchSize) {
            const insertBatch = searchRecords.slice(i, i + insertBatchSize);
            
            const { error } = await supabase
              .from('search_query_performance')
              .upsert(insertBatch, {
                onConflict: 'asin_performance_id,search_query'
              });

            if (error) {
              this.logger.error('Error inserting search query batch', error);
              // Continue with next batch instead of failing completely
              syncStats.errors.push(error.message);
            } else {
              syncStats.searchQueriesInserted += insertBatch.length;
            }
          }
        }

        offset += CONFIG.batchSize;
        this.logger.info(`Progress: ${offset} of ${dataStats.total_rows} rows processed`);
      }

      // Step 6: Update sync log
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
              duration: Date.now() - startTime,
              errors: syncStats.errors
            }
          })
          .eq('id', syncLogId);
      }

      syncStats.success = true;
      this.logger.info('60-day sync completed successfully', {
        totalParentRecords: syncStats.parentRecordsInserted,
        totalSearchQueries: syncStats.searchQueriesInserted,
        duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`
      });

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
            error_message: error.message
          })
          .eq('id', syncLogId);
      }
      
      throw error;
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
  const sync = new SixtyDaySync();
  sync.run()
    .then(stats => {
      console.log('\n✅ 60-day sync completed:', stats);
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ 60-day sync failed:', error);
      process.exit(1);
    });
}

module.exports = SixtyDaySync;