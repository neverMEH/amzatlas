#!/usr/bin/env tsx
/**
 * Database seeding script
 * Run with: npm run seed:db
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables
dotenv.config();

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check required environment variables
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please ensure your .env file contains all required variables.');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function seedDatabase() {
  console.log('🌱 Starting database seeding...\n');

  try {
    // Read the seed SQL file
    const seedFilePath = path.join(__dirname, '..', 'src', 'lib', 'supabase', 'seed', '001_seed_sqp_data.sql');
    const seedSQL = fs.readFileSync(seedFilePath, 'utf-8');

    console.log('📝 Executing seed script...');
    
    // Execute the seed SQL
    const { error } = await supabase.rpc('exec_sql', {
      sql: seedSQL
    });

    if (error) {
      // If exec_sql doesn't exist, try direct query approach
      console.log('⚠️  exec_sql function not found, trying alternative approach...');
      
      // Split the SQL into individual statements
      const statements = seedSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      let successCount = 0;
      let errorCount = 0;

      for (const statement of statements) {
        try {
          // Skip certain statements that might not work through the API
          if (statement.includes('TRUNCATE') || statement.includes('CASCADE')) {
            console.log('⏭️  Skipping TRUNCATE statement (handle manually if needed)');
            continue;
          }

          const { error: stmtError } = await supabase.rpc('query', { 
            query_text: statement + ';' 
          });

          if (stmtError) {
            console.error(`❌ Error executing statement: ${stmtError.message}`);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (err: any) {
          console.error(`❌ Error: ${err.message}`);
          errorCount++;
        }
      }

      console.log(`\n✅ Executed ${successCount} statements successfully`);
      if (errorCount > 0) {
        console.log(`⚠️  ${errorCount} statements failed`);
      }
    }

    // Verify data was inserted
    console.log('\n📊 Verifying seeded data...');
    
    const { count: dailyCount } = await supabase
      .from('daily_sqp_data')
      .select('*', { count: 'exact', head: true });
    
    const { count: weeklyCount } = await supabase
      .from('weekly_summary')
      .select('*', { count: 'exact', head: true });
    
    console.log(`  - Daily SQP Data: ${dailyCount || 0} records`);
    console.log(`  - Weekly Summary: ${weeklyCount || 0} records`);

    console.log('\n✅ Database seeding completed!');
    
    // Provide instructions for manual steps if needed
    console.log('\n📌 Next steps:');
    console.log('1. If TRUNCATE statements were skipped, you may need to clear existing data manually');
    console.log('2. Run the following in Supabase SQL editor to refresh materialized views:');
    console.log('   SELECT sqp.refresh_all_views();');
    console.log('3. Verify the data in your dashboard');

  } catch (error: any) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

// Alternative: Generate TypeScript-based seed data
async function generateSeedData() {
  console.log('\n🔧 Generating seed data using TypeScript...\n');

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 365); // 1 year ago
  
  const endDate = new Date();
  
  const asins = [
    { asin: 'B08N5WRWNW', name: 'Echo Dot (4th Gen)', quality: 0.9 },
    { asin: 'B07FZ8S74R', name: 'Echo Show 8', quality: 0.8 },
    { asin: 'B08KJN3333', name: 'Fire TV Stick 4K', quality: 0.85 },
    { asin: 'B08MQZXN1X', name: 'Fire HD 10 Tablet', quality: 0.75 },
    { asin: 'B08F6PHTJ4', name: 'Kindle Paperwhite', quality: 0.7 }
  ];

  const keywords = [
    { keyword: 'alexa devices', popularity: 0.9 },
    { keyword: 'smart speaker', popularity: 0.85 },
    { keyword: 'echo dot', popularity: 0.95 },
    { keyword: 'fire tv', popularity: 0.85 },
    { keyword: 'kindle', popularity: 0.85 }
  ];

  const batchSize = 100;
  let batch: any[] = [];
  let totalInserted = 0;

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    for (const keyword of keywords) {
      for (const asin of asins) {
        // Generate realistic metrics
        const weekNumber = Math.floor((d.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
        const seasonalFactor = 1 + 0.3 * Math.sin((2 * Math.PI * weekNumber) / 52);
        const trendFactor = 1 + weekNumber * 0.005;
        const randomFactor = 0.8 + Math.random() * 0.4;
        
        const impressions = Math.round(1000 * seasonalFactor * trendFactor * randomFactor * keyword.popularity);
        const ctr = 0.02 + 0.06 * asin.quality * (0.8 + Math.random() * 0.4);
        const clicks = Math.round(impressions * ctr);
        const cvr = 0.05 + 0.10 * asin.quality * (0.8 + Math.random() * 0.4);
        const purchases = Math.round(clicks * cvr);
        const spend = Math.round(clicks * (0.3 + Math.random() * 0.7) * 100) / 100;
        const sales = Math.round(purchases * (20 + Math.random() * 80) * 100) / 100;

        batch.push({
          date: d.toISOString().split('T')[0],
          query: keyword.keyword,
          asin: asin.asin,
          impressions,
          clicks,
          purchases,
          spend,
          sales,
          organic_rank: Math.floor(5 + Math.random() * 45),
          ad_rank: Math.floor(1 + Math.random() * 20),
          click_through_rate: Math.round(ctr * 10000) / 10000,
          conversion_rate: Math.round(cvr * 10000) / 10000,
          cost_per_click: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0,
          acos: purchases > 0 ? Math.round((spend / sales) * 10000) / 100 : 0
        });

        // Insert in batches
        if (batch.length >= batchSize) {
          const { error } = await supabase
            .from('daily_sqp_data')
            .insert(batch);

          if (error) {
            console.error('❌ Error inserting batch:', error.message);
          } else {
            totalInserted += batch.length;
            console.log(`✅ Inserted ${totalInserted} records...`);
          }

          batch = [];
        }
      }
    }
  }

  // Insert remaining records
  if (batch.length > 0) {
    const { error } = await supabase
      .from('daily_sqp_data')
      .insert(batch);

    if (error) {
      console.error('❌ Error inserting final batch:', error.message);
    } else {
      totalInserted += batch.length;
    }
  }

  console.log(`\n✅ Successfully inserted ${totalInserted} daily records!`);
}

// Main execution
(async () => {
  const args = process.argv.slice(2);
  
  if (args.includes('--typescript') || args.includes('-t')) {
    // Use TypeScript-based seeding
    await generateSeedData();
  } else {
    // Use SQL-based seeding (default)
    await seedDatabase();
  }
})();