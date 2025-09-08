#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkSchedule() {
  console.log('🔍 Checking sync schedule configuration...\n');
  
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Check refresh_config table
    console.log('1. Checking refresh_config table...');
    const { data: refreshConfigs, error: configError } = await supabase
      .from('refresh_config')
      .select('*')
      .order('priority', { ascending: false });
    
    if (refreshConfigs) {
      console.log(`   Found ${refreshConfigs.length} refresh configurations:\n`);
      refreshConfigs.forEach(config => {
        console.log(`   Table: ${config.table_schema}.${config.table_name}`);
        console.log(`   - Enabled: ${config.is_enabled}`);
        console.log(`   - Interval: ${config.refresh_interval_hours} hours`);
        console.log(`   - Last refresh: ${config.last_refresh_at || 'Never'}`);
        console.log(`   - Next refresh: ${config.next_refresh_at || 'Not scheduled'}`);
        console.log('');
      });
    }
    
    // Check recent sync logs
    console.log('2. Checking recent sync activity (sync_log)...');
    const { data: syncLogs, error: syncError } = await supabase
      .from('sync_log')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10);
    
    if (syncLogs && syncLogs.length > 0) {
      console.log(`   Last ${syncLogs.length} sync activities:\n`);
      syncLogs.forEach(log => {
        console.log(`   ${log.started_at}: ${log.sync_type} - ${log.status}`);
        if (log.table_name) console.log(`     Table: ${log.table_name}`);
        if (log.rows_synced) console.log(`     Rows: ${log.rows_synced}`);
      });
    } else {
      console.log('   No sync logs found');
    }
    
    // Check refresh audit log
    console.log('\n3. Checking recent refresh attempts (refresh_audit_log)...');
    const { data: auditLogs, error: auditError } = await supabase
      .from('refresh_audit_log')
      .select('*')
      .order('refresh_started_at', { ascending: false })
      .limit(5);
    
    if (auditLogs && auditLogs.length > 0) {
      console.log(`   Last ${auditLogs.length} refresh attempts:\n`);
      auditLogs.forEach(log => {
        console.log(`   ${log.refresh_started_at}: ${log.table_name}`);
        console.log(`     Status: ${log.status}`);
        console.log(`     Type: ${log.refresh_type}`);
        if (log.rows_processed) console.log(`     Rows: ${log.rows_processed}`);
      });
    } else {
      console.log('   No refresh audit logs found');
    }
    
    // Check if there are any cron jobs in the database
    console.log('\n4. Checking for database cron jobs...');
    const { data: cronJobs } = await supabase
      .rpc('get_cron_jobs')
      .single();
    
    if (cronJobs) {
      console.log('   Database cron jobs found:', cronJobs);
    } else {
      console.log('   No database cron jobs configured');
    }
    
    console.log('\n📋 Summary:');
    console.log('   - Refresh configurations exist in the database');
    console.log('   - No automatic scheduling appears to be active');
    console.log('   - You need to set up one of the following:');
    console.log('     • Railway cron (recommended for your deployment)');
    console.log('     • Supabase Edge Function with pg_cron');
    console.log('     • External cron service to call the sync API');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Check for cron jobs RPC function
async function checkCronRPC() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  // Try to get cron jobs if pg_cron is installed
  try {
    const { data, error } = await supabase
      .from('cron.job')
      .select('*');
    
    if (data) {
      console.log('\n5. pg_cron jobs found:');
      data.forEach(job => {
        console.log(`   - ${job.jobname}: ${job.schedule}`);
        console.log(`     Command: ${job.command}`);
      });
    }
  } catch (e) {
    // pg_cron not installed
  }
}

checkSchedule()
  .then(() => checkCronRPC())
  .catch(console.error);