#!/usr/bin/env node

import { config } from 'dotenv';
import { getSupabaseAdminClient } from '../config/supabase.config';
import fs from 'fs/promises';
import path from 'path';

// Load environment variables
config();

async function addMissingColumns() {
  console.log('Adding missing columns to weekly_summary table...\n');
  
  const supabase = getSupabaseAdminClient();
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../lib/supabase/migrations/015_add_missing_weekly_summary_columns.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    console.log('Running migration SQL...');
    
    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      console.error('❌ Migration failed:', error);
      console.log('\nPlease run the migration manually in Supabase SQL editor:');
      console.log(migrationPath);
    } else {
      console.log('✅ Migration completed successfully!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nAlternative: Please run this SQL manually in your Supabase SQL editor:');
    
    const sql = `
-- Add missing columns to weekly_summary table
ALTER TABLE sqp.weekly_summary 
    ADD COLUMN IF NOT EXISTS search_query_score DECIMAL(10, 6),
    ADD COLUMN IF NOT EXISTS search_query_volume BIGINT,
    ADD COLUMN IF NOT EXISTS cart_adds INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cart_add_rate DECIMAL(10, 6) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cart_add_share DECIMAL(10, 6) DEFAULT 0;

-- Update the public view
CREATE OR REPLACE VIEW public.weekly_summary AS
SELECT * FROM sqp.weekly_summary;
`;
    console.log(sql);
  }
}

addMissingColumns().catch(console.error);