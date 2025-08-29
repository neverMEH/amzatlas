#!/usr/bin/env node

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';

// Load environment variables
config();

async function runMigration() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  console.log('Connecting to Supabase...');
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Read migration file
  const migrationPath = path.join(__dirname, '..', 'lib', 'supabase', 'migrations', '026_create_public_views_for_sqp_tables.sql');
  const sql = await fs.readFile(migrationPath, 'utf-8');

  console.log('Running migration 026_create_public_views_for_sqp_tables...');
  
  // Execute the SQL directly using the Supabase SQL editor API
  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      query: sql
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Migration failed:', error);
    process.exit(1);
  }

  console.log('Migration completed successfully!');
}

runMigration().catch((error) => {
  console.error('Error running migration:', error);
  process.exit(1);
});