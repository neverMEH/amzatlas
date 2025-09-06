import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';

async function checkAppliedMigrations() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(chalk.red('Missing Supabase credentials'));
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(chalk.blue('🔍 Checking Applied Migrations...\n'));

  // Check if migration tracking table exists
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'schema_migrations');

  if (tablesError || !tables?.length) {
    console.log(chalk.yellow('⚠️  No schema_migrations table found. Checking actual database objects...\n'));
    
    // Check for existence of key tables to infer applied migrations
    const keyObjects = [
      { type: 'table', schema: 'sqp', name: 'brands', migration: '018' },
      { type: 'table', schema: 'sqp', name: 'asin_brand_mapping', migration: '018' },
      { type: 'table', schema: 'sqp', name: 'report_configurations', migration: '027' },
      { type: 'table', schema: 'sqp', name: 'refresh_config', migration: '031' },
      { type: 'table', schema: 'sqp', name: 'webhook_configs', migration: '034' },
    ];

    console.log(chalk.yellow('📋 Checking Key Database Objects:\n'));
    
    for (const obj of keyObjects) {
      const { data, error } = await supabase
        .from(`${obj.schema}.${obj.name}`)
        .select('*')
        .limit(1);

      if (!error) {
        console.log(chalk.green(`✅ ${obj.type} ${obj.schema}.${obj.name} exists (migration ${obj.migration}+)`));
      } else {
        console.log(chalk.red(`❌ ${obj.type} ${obj.schema}.${obj.name} not found`));
      }
    }
  } else {
    // Read from schema_migrations table
    const { data: migrations, error } = await supabase
      .from('schema_migrations')
      .select('*')
      .order('version');

    if (error) {
      console.error(chalk.red('Error reading schema_migrations:', error.message));
      return;
    }

    console.log(chalk.green('Applied Migrations:'));
    migrations?.forEach(m => {
      console.log(`  ✅ ${m.version}`);
    });
  }

  // Check for objects that shouldn't exist if migrations were properly managed
  console.log(chalk.yellow('\n\n🔍 Checking for Duplicate Objects:\n'));

  const duplicateChecks = [
    {
      query: `SELECT viewname, definition 
              FROM pg_views 
              WHERE schemaname = 'sqp' 
              AND viewname LIKE '%brand_search_query_metrics%'`,
      type: 'view'
    },
    {
      query: `SELECT tablename 
              FROM pg_tables 
              WHERE schemaname = 'sqp' 
              AND tablename IN ('refresh_config', 'refresh_audit_log')`,
      type: 'table'
    }
  ];

  for (const check of duplicateChecks) {
    const { data, error } = await supabase.rpc('run_query', { query: check.query });
    if (data && data.length > 1) {
      console.log(chalk.red(`⚠️  Possible duplicate ${check.type}s found!`));
    }
  }

  // List all current database objects
  console.log(chalk.blue('\n\n📊 Current Database State Summary:\n'));

  // Count tables
  const { count: tableCount } = await supabase
    .from('information_schema.tables')
    .select('*', { count: 'exact', head: true })
    .eq('table_schema', 'sqp')
    .eq('table_type', 'BASE TABLE');

  // Count views
  const { count: viewCount } = await supabase
    .from('information_schema.views')
    .select('*', { count: 'exact', head: true })
    .eq('table_schema', 'sqp');

  // Count functions
  const { data: functions } = await supabase.rpc('get_schema_info', { schema_name: 'sqp' });

  console.log(`📁 Tables in sqp schema: ${chalk.green(tableCount || 0)}`);
  console.log(`👁️  Views in sqp schema: ${chalk.green(viewCount || 0)}`);
  console.log(`🔧 Functions in sqp schema: ${chalk.green(functions?.length || 0)}`);

  // Check git status of migration files
  const migrationsPath = path.join(__dirname, '../lib/supabase/migrations');
  const gitStatus = await checkGitStatus(migrationsPath);
  
  if (gitStatus.untracked.length > 0) {
    console.log(chalk.yellow('\n\n⚠️  Untracked Migration Files:'));
    gitStatus.untracked.forEach(f => console.log(`   - ${f}`));
  }
}

async function checkGitStatus(migrationsPath: string): Promise<{ untracked: string[] }> {
  try {
    const { execSync } = require('child_process');
    const output = execSync('git status --porcelain', { cwd: process.cwd() }).toString();
    
    const untracked = output
      .split('\n')
      .filter(line => line.startsWith('??'))
      .map(line => line.substring(3))
      .filter(file => file.includes('migrations/031_fix_asin') || file.includes('MIGRATION_EXECUTION'));

    return { untracked };
  } catch {
    return { untracked: [] };
  }
}

// Add RPC function if it doesn't exist
async function ensureQueryFunction(supabase: any) {
  const functionDef = `
    CREATE OR REPLACE FUNCTION run_query(query text)
    RETURNS json
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      result json;
    BEGIN
      EXECUTE 'SELECT json_agg(row_to_json(t)) FROM (' || query || ') t' INTO result;
      RETURN result;
    END;
    $$;
  `;

  try {
    await supabase.rpc('run_query', { query: 'SELECT 1' });
  } catch {
    // Function doesn't exist, create it
    const { error } = await supabase.rpc('exec_sql', { sql: functionDef });
    if (error) {
      console.log(chalk.yellow('Note: Unable to create helper function for advanced checks'));
    }
  }
}

// Run the check
checkAppliedMigrations().catch(console.error);