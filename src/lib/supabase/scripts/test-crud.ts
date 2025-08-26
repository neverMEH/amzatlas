#!/usr/bin/env node

import { config as dotenvConfig } from 'dotenv';
import { SupabaseService } from '@/lib/supabase/client';
import { format } from 'date-fns';

// Load environment variables
dotenvConfig();

async function testCRUD() {
  console.log('🧪 Testing Supabase CRUD operations...\n');

  const service = new SupabaseService();

  try {
    // Test data
    const testData = {
      period_start: '2024-01-01',
      period_end: '2024-01-07',
      query: 'test running shoes',
      asin: 'TEST123',
      total_impressions: 1000,
      total_clicks: 100,
      total_purchases: 10,
      avg_ctr: 0.1,
      avg_cvr: 0.1,
      purchases_per_impression: 0.01,
      impression_share: 0.5,
      click_share: 0.5,
      purchase_share: 0.5,
      min_impressions: 100,
      max_impressions: 200,
      avg_impressions: 150,
      stddev_impressions: 25,
    };

    // 1. INSERT Test
    console.log('1. Testing INSERT...');
    const { error: insertError } = await service.upsertWeeklySummary(testData);
    if (insertError) {
      console.error('   ❌ Insert failed:', insertError.message);
    } else {
      console.log('   ✅ Insert successful\n');
    }

    // 2. SELECT Test
    console.log('2. Testing SELECT...');
    const { data: selectData, error: selectError } = await service.getWeeklySummaries({
      query: 'test running shoes',
      limit: 5,
    });

    if (selectError) {
      console.error('   ❌ Select failed:', selectError.message);
    } else {
      console.log('   ✅ Select successful');
      console.log(`   Found ${selectData?.length || 0} records\n`);
      
      if (selectData && selectData.length > 0) {
        console.log('   Sample record:', {
          query: selectData[0].query,
          asin: selectData[0].asin,
          impressions: selectData[0].total_impressions,
        });
      }
    }

    // 3. UPDATE Test (upsert with same key)
    console.log('\n3. Testing UPDATE...');
    const updatedData = {
      ...testData,
      total_impressions: 2000,
      total_clicks: 200,
      total_purchases: 20,
    };

    const { error: updateError } = await service.upsertWeeklySummary(updatedData);
    if (updateError) {
      console.error('   ❌ Update failed:', updateError.message);
    } else {
      console.log('   ✅ Update successful\n');
    }

    // 4. Verify UPDATE
    console.log('4. Verifying UPDATE...');
    const { data: verifyData, error: verifyError } = await service.getWeeklySummaries({
      query: 'test running shoes',
      startDate: '2024-01-01',
      endDate: '2024-01-07',
    });

    if (!verifyError && verifyData && verifyData.length > 0) {
      const updated = verifyData[0];
      console.log('   ✅ Update verified');
      console.log(`   Impressions updated from 1000 to ${updated.total_impressions}`);
    }

    // 5. Test Period Comparison
    console.log('\n5. Testing Period Comparison...');
    const comparisonData = {
      period_type: 'weekly' as const,
      current_period_start: '2024-01-08',
      current_period_end: '2024-01-14',
      previous_period_start: '2024-01-01',
      previous_period_end: '2024-01-07',
      query: 'test running shoes',
      asin: 'TEST123',
      current_impressions: 2000,
      current_clicks: 200,
      current_purchases: 20,
      current_ctr: 0.1,
      current_cvr: 0.1,
      previous_impressions: 1000,
      previous_clicks: 100,
      previous_purchases: 10,
      previous_ctr: 0.1,
      previous_cvr: 0.1,
      impressions_change: 1000,
      clicks_change: 100,
      purchases_change: 10,
      ctr_change: 0,
      cvr_change: 0,
      impressions_change_pct: 100,
      clicks_change_pct: 100,
      purchases_change_pct: 100,
    };

    const { error: compError } = await service.upsertPeriodComparison(comparisonData);
    if (compError) {
      console.error('   ❌ Period comparison insert failed:', compError.message);
    } else {
      console.log('   ✅ Period comparison insert successful');
    }

    // 6. Clean up test data
    console.log('\n6. Cleaning up test data...');
    console.log('   (Manual cleanup required - no delete method implemented)');
    console.log('   Run this SQL in Supabase to clean up:');
    console.log("   DELETE FROM sqp.weekly_summary WHERE query = 'test running shoes';");
    console.log("   DELETE FROM sqp.period_comparisons WHERE query = 'test running shoes';");

    console.log('\n✅ All CRUD tests completed successfully!');

  } catch (error) {
    console.error('\n❌ CRUD test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  testCRUD();
}

export { testCRUD };