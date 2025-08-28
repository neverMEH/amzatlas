#!/usr/bin/env node

import { config } from 'dotenv';
import { getSupabaseClient } from '../config/supabase.config';

// Load environment variables
config();

async function verifySchema() {
  console.log('Verifying BigQuery schema migration...\n');
  
  const supabase = getSupabaseClient();
  
  // Tables to check
  const tablesToCheck = [
    'asin_performance_data',
    'search_query_performance',
    'weekly_summary',
    'monthly_summary',
    'quarterly_summary',
    'yearly_summary'
  ];
  
  // Views to check
  const viewsToCheck = [
    'search_performance_summary',
    'period_comparisons'
  ];
  
  // Check tables
  console.log('Checking tables:');
  for (const table of tablesToCheck) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(0);
    
    if (error && error.code === '42P01') {
      console.log(`❌ Table '${table}' does not exist`);
    } else if (error) {
      console.log(`⚠️  Table '${table}' exists but has error: ${error.message}`);
    } else {
      console.log(`✅ Table '${table}' exists`);
    }
  }
  
  console.log('\nChecking views:');
  for (const view of viewsToCheck) {
    const { data, error } = await supabase
      .from(view)
      .select('*')
      .limit(0);
    
    if (error && error.code === '42P01') {
      console.log(`❌ View '${view}' does not exist`);
    } else if (error) {
      console.log(`⚠️  View '${view}' exists but has error: ${error.message}`);
    } else {
      console.log(`✅ View '${view}' exists`);
    }
  }
  
  // Check if new columns exist in weekly_summary (try both public and sqp schemas)
  console.log('\nChecking new columns in weekly_summary:');
  
  // Try public schema first
  let { data: sample, error: sampleError } = await supabase
    .from('weekly_summary')
    .select('cart_adds, cart_add_rate, cart_add_share, search_query_score, search_query_volume')
    .limit(1);
  
  // If that fails, try with a simple query to see what columns exist
  if (sampleError) {
    console.log(`⚠️  New columns check in public.weekly_summary failed: ${sampleError.message}`);
    
    // Try to get any row to see the schema
    const { data: anyData, error: anyError } = await supabase
      .from('weekly_summary')
      .select('*')
      .limit(1);
    
    if (!anyError && anyData && anyData.length > 0) {
      const columns = Object.keys(anyData[0]);
      const hasNewColumns = ['cart_adds', 'cart_add_rate', 'search_query_score', 'search_query_volume']
        .some(col => columns.includes(col));
      
      if (hasNewColumns) {
        console.log('✅ Some new columns exist in weekly_summary');
        console.log('Available columns:', columns.slice(0, 10).join(', '), '...');
      } else {
        console.log('❌ New columns not found in weekly_summary');
        console.log('Available columns:', columns.slice(0, 10).join(', '), '...');
      }
    } else {
      console.log('❌ Could not check weekly_summary schema');
    }
  } else {
    console.log('✅ New columns exist in weekly_summary');
  }
  
  console.log('\nSchema verification complete!');
}

verifySchema().catch(console.error);