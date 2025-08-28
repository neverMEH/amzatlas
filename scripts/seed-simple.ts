#!/usr/bin/env tsx
/**
 * Simple database seeding script using direct inserts
 * Run with: npm run seed:simple
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Check required environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// Initialize Supabase client (using default public schema)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Test data configuration
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
  { keyword: 'kindle', popularity: 0.85 },
  { keyword: 'smart home', popularity: 0.8 },
  { keyword: '4k streaming', popularity: 0.7 },
  { keyword: 'tablet', popularity: 0.8 }
];

async function clearExistingData() {
  console.log('🗑️  Clearing existing data...');
  
  // Delete in reverse order of dependencies
  const tables = [
    'yearly_summary',
    'monthly_summary', 
    'weekly_summary',
    'daily_sqp_data'
  ];

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .gte('id', 0); // Delete all rows
    
    if (error) {
      console.error(`⚠️  Error clearing ${table}:`, error.message);
    } else {
      console.log(`✅ Cleared ${table}`);
    }
  }
}

async function generateDailyData() {
  console.log('\n📊 Generating daily data...');
  
  const batchSize = 100;
  let batch: any[] = [];
  let totalInserted = 0;
  
  // Generate data for the last 90 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const weekNumber = Math.floor((d.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    
    for (const keyword of keywords) {
      for (const asin of asins) {
        // Skip some combinations for more realistic data
        if (!shouldIncludeCombination(keyword.keyword, asin.name)) {
          continue;
        }
        
        // Generate realistic metrics
        const metrics = generateMetrics(weekNumber, keyword.popularity, asin.quality);
        
        batch.push({
          date: d.toISOString().split('T')[0],
          query: keyword.keyword,
          asin: asin.asin,
          impressions: metrics.impressions,
          clicks: metrics.clicks,
          purchases: metrics.purchases,
          spend: metrics.spend,
          sales: metrics.sales,
          organic_rank: Math.floor(5 + Math.random() * 45),
          ad_rank: Math.floor(1 + Math.random() * 20),
          click_through_rate: metrics.ctr,
          conversion_rate: metrics.cvr,
          cost_per_click: metrics.cpc,
          acos: metrics.acos,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
        // Insert in batches
        if (batch.length >= batchSize) {
          const { error } = await supabase
            .from('daily_sqp_data')
            .insert(batch);
          
          if (error) {
            console.error('❌ Error inserting batch:', error.message);
            console.error('Sample row:', batch[0]);
          } else {
            totalInserted += batch.length;
            process.stdout.write(`\r✅ Inserted ${totalInserted} daily records...`);
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
    
    if (!error) {
      totalInserted += batch.length;
    }
  }
  
  console.log(`\n✅ Inserted ${totalInserted} total daily records`);
  return totalInserted;
}

function shouldIncludeCombination(keyword: string, productName: string): boolean {
  // Smart matching logic
  if (keyword.includes('echo') && productName.includes('Echo')) return true;
  if (keyword.includes('alexa') && productName.includes('Echo')) return true;
  if (keyword.includes('fire') && productName.includes('Fire')) return true;
  if (keyword.includes('streaming') && productName.includes('Fire TV')) return true;
  if (keyword.includes('kindle') && productName.includes('Kindle')) return true;
  if (keyword.includes('tablet') && productName.includes('Tablet')) return true;
  if (keyword.includes('smart') && productName.includes('Echo')) return true;
  
  // Random 20% chance for other combinations
  return Math.random() < 0.2;
}

function generateMetrics(weekNumber: number, popularity: number, quality: number) {
  // Seasonal factor (higher in Q4)
  const seasonalFactor = 1 + 0.3 * Math.sin((2 * Math.PI * weekNumber) / 52);
  
  // Trend factor (gradual growth)
  const trendFactor = 1 + weekNumber * 0.01;
  
  // Random variation
  const randomFactor = 0.8 + Math.random() * 0.4;
  
  // Calculate impressions
  const baseImpressions = 500 + Math.random() * 2000;
  const impressions = Math.round(baseImpressions * seasonalFactor * trendFactor * randomFactor * popularity);
  
  // CTR between 2-8% based on quality
  const ctr = 0.02 + 0.06 * quality * (0.8 + Math.random() * 0.4);
  const clicks = Math.round(impressions * ctr);
  
  // CVR between 5-15% based on quality
  const cvr = 0.05 + 0.10 * quality * (0.8 + Math.random() * 0.4);
  const purchases = Math.round(clicks * cvr);
  
  // Financial metrics
  const cpc = 0.30 + Math.random() * 0.70;
  const spend = Math.round(clicks * cpc * 100) / 100;
  const aov = 20 + Math.random() * 80;
  const sales = Math.round(purchases * aov * 100) / 100;
  const acos = purchases > 0 ? Math.round((spend / sales) * 10000) / 100 : 0;
  
  return {
    impressions,
    clicks,
    purchases,
    spend,
    sales,
    ctr: Math.round(ctr * 10000) / 10000,
    cvr: Math.round(cvr * 10000) / 10000,
    cpc: Math.round(cpc * 100) / 100,
    acos
  };
}

async function verifyData() {
  console.log('\n📊 Verifying seeded data...');
  
  // Check daily data
  const { count: dailyCount } = await supabase
    .from('daily_sqp_data')
    .select('*', { count: 'exact', head: true });
  
  console.log(`  - Daily SQP Data: ${dailyCount || 0} records`);
  
  // Check if triggers populated summary tables
  const { count: weeklyCount } = await supabase
    .from('weekly_summary')
    .select('*', { count: 'exact', head: true });
  
  const { count: monthlyCount } = await supabase
    .from('monthly_summary')
    .select('*', { count: 'exact', head: true });
  
  console.log(`  - Weekly Summary: ${weeklyCount || 0} records`);
  console.log(`  - Monthly Summary: ${monthlyCount || 0} records`);
  
  // Sample some data
  const { data: sampleData } = await supabase
    .from('daily_sqp_data')
    .select('*')
    .limit(5);
  
  if (sampleData && sampleData.length > 0) {
    console.log('\n📌 Sample data:');
    console.table(sampleData.map(row => ({
      date: row.date,
      query: row.query,
      impressions: row.impressions,
      clicks: row.clicks,
      purchases: row.purchases,
      cvr: row.conversion_rate
    })));
  }
}

// Main execution
async function main() {
  console.log('🌱 Starting simple database seeding...\n');
  
  try {
    // Clear existing data
    await clearExistingData();
    
    // Generate and insert daily data
    const count = await generateDailyData();
    
    if (count > 0) {
      console.log('\n⏳ Waiting for triggers to populate summary tables...');
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      // Verify the data
      await verifyData();
      
      console.log('\n✅ Database seeding completed successfully!');
      console.log('\n📌 Next steps:');
      console.log('1. Check your Supabase dashboard to verify the data');
      console.log('2. If summary tables are empty, run the following in SQL editor:');
      console.log('   SELECT sqp.refresh_all_views();');
      console.log('3. Test your dashboard to ensure data is displaying correctly');
    }
  } catch (error: any) {
    console.error('\n❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

main();