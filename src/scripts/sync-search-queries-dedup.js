#!/usr/bin/env node

/**
 * Search Query Sync with De-duplication
 * Syncs search query data from BigQuery to Supabase with proper handling of duplicates
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { BigQuery } = require('@google-cloud/bigquery');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

class SearchQuerySync {
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
    let credsString = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!credsString) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON not found');
    }
    
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
    
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-sq-'));
    this.credentialsPath = path.join(tempDir, 'credentials.json');
    fs.writeFileSync(this.credentialsPath, JSON.stringify(credentials, null, 2));
    
    return credentials;
  }

  async run() {
    const startTime = Date.now();
    let syncStats = {
      success: false,
      totalProcessed: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0
    };

    try {
      this.logger.info('Starting Search Query Sync with De-duplication');

      const credentials = await this.setupCredentials();
      const projectId = process.env.BIGQUERY_PROJECT_ID || credentials.project_id;
      const dataset = process.env.BIGQUERY_DATASET?.replace(/\.$/, '') || 'dataclient_amzatlas_agency_85';
      
      const bigquery = new BigQuery({
        projectId: projectId,
        keyFilename: this.credentialsPath
      });
      
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      this.logger.info('Connected to services', {
        bigQueryProject: projectId,
        bigQueryDataset: dataset
      });

      // Step 1: Get parent record IDs
      this.logger.info('Fetching parent record IDs from Supabase');
      const { data: parentData } = await supabase
        .from('asin_performance_data')
        .select('id, asin, start_date')
        .order('start_date', { ascending: false });

      const parentLookup = new Map();
      parentData?.forEach(p => {
        parentLookup.set(`${p.asin}_${p.start_date}`, p.id);
      });

      this.logger.info(`Created lookup map with ${parentLookup.size} parent records`);

      // Step 2: Get existing search queries to avoid duplicates
      this.logger.info('Fetching existing search queries');
      const { data: existingQueries } = await supabase
        .from('search_query_performance')
        .select('asin_performance_id, search_query')
        .limit(50000);

      const existingKeys = new Set();
      existingQueries?.forEach(q => {
        existingKeys.add(`${q.asin_performance_id}_${q.search_query}`);
      });

      this.logger.info(`Found ${existingKeys.size} existing search query records`);

      // Step 3: Query BigQuery with de-duplication
      this.logger.info('Fetching search query data from BigQuery');
      
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
          WHERE "Parent ASIN" IS NOT NULL
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
        ORDER BY Date DESC, parent_asin, search_query
      `;

      const [searchRows] = await bigquery.query({ query: searchQuery });
      this.logger.info(`Retrieved ${searchRows.length} unique search queries from BigQuery`);

      // Step 4: Process in batches
      const batchSize = 100;
      const recordsToInsert = [];

      for (const row of searchRows) {
        const dateStr = row.Date.value ? row.Date.value.split('T')[0] : row.Date.split('T')[0];
        const parentId = parentLookup.get(`${row.parent_asin}_${dateStr}`);

        if (!parentId) {
          syncStats.skipped++;
          continue;
        }

        const key = `${parentId}_${row.search_query}`;
        if (existingKeys.has(key)) {
          syncStats.skipped++;
          continue;
        }

        const record = {
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
        };

        recordsToInsert.push(record);
        syncStats.totalProcessed++;

        // Insert in batches
        if (recordsToInsert.length >= batchSize) {
          const { error } = await supabase
            .from('search_query_performance')
            .insert(recordsToInsert);

          if (error) {
            this.logger.error(`Error inserting batch: ${error.message}`);
            syncStats.errors += recordsToInsert.length;
          } else {
            syncStats.inserted += recordsToInsert.length;
            this.logger.info(`Inserted batch of ${recordsToInsert.length} records. Total inserted: ${syncStats.inserted}`);
          }

          recordsToInsert.length = 0;
        }
      }

      // Insert remaining records
      if (recordsToInsert.length > 0) {
        const { error } = await supabase
          .from('search_query_performance')
          .insert(recordsToInsert);

        if (error) {
          this.logger.error(`Error inserting final batch: ${error.message}`);
          syncStats.errors += recordsToInsert.length;
        } else {
          syncStats.inserted += recordsToInsert.length;
          this.logger.info(`Inserted final batch of ${recordsToInsert.length} records`);
        }
      }

      // Step 5: Update sync log
      const { error: logError } = await supabase
        .from('sync_log')
        .insert({
          sync_type: 'search-query-dedup',
          table_name: 'search_query_performance',
          status: 'completed',
          started_at: new Date(startTime).toISOString(),
          completed_at: new Date().toISOString(),
          rows_synced: syncStats.inserted,
          metadata: {
            totalProcessed: syncStats.totalProcessed,
            inserted: syncStats.inserted,
            skipped: syncStats.skipped,
            errors: syncStats.errors,
            duration: Date.now() - startTime
          }
        });

      if (logError) {
        this.logger.error('Failed to update sync log', logError);
      }

      syncStats.success = true;
      this.logger.info('Search query sync completed successfully', {
        ...syncStats,
        duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`
      });

    } catch (error) {
      this.logger.error('Sync failed', { 
        error: error.message,
        stack: error.stack 
      });
      throw error;
    } finally {
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
  const sync = new SearchQuerySync();
  sync.run()
    .then(stats => {
      console.log('\n✅ Search query sync completed:', stats);
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Search query sync failed:', error);
      process.exit(1);
    });
}

module.exports = SearchQuerySync;