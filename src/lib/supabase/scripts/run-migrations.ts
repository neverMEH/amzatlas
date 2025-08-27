#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join } from 'path';
import { getSupabaseAdminClient } from '@/config/supabase.config';

/**
 * Run Supabase migrations
 * This script should be run with admin privileges
 */
async function runMigrations() {
  console.log('🚀 Starting Supabase migration runner...\n');

  try {
    // Check for required environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        'Missing required environment variables:\n' +
        '- SUPABASE_URL\n' +
        '- SUPABASE_SERVICE_ROLE_KEY\n\n' +
        'Please set these in your .env file'
      );
    }

    const client = getSupabaseAdminClient();
    const migrationsDir = join(__dirname, '../migrations');

    // List of migration files in order
    const migrations = [
      '001_create_sqp_tables.sql',
      '002_create_sqp_views.sql',
    ];

    console.log(`Found ${migrations.length} migration files to run\n`);

    for (const migrationFile of migrations) {
      console.log(`📄 Running migration: ${migrationFile}`);
      
      try {
        const sqlPath = join(migrationsDir, migrationFile);
        const sql = readFileSync(sqlPath, 'utf8');

        // Split SQL into individual statements (basic split on semicolons)
        // Note: This is a simple implementation. For production, use a proper SQL parser
        const statements = sql
          .split(/;\s*$/m)
          .filter(stmt => stmt.trim().length > 0)
          .map(stmt => stmt.trim() + ';');

        console.log(`   Found ${statements.length} SQL statements`);

        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i];
          
          // Skip comments
          if (statement.trim().startsWith('--')) continue;

          // Get first few words of statement for logging
          const statementPreview = statement
            .replace(/\s+/g, ' ')
            .substring(0, 50) + '...';

          process.stdout.write(`   [${i + 1}/${statements.length}] ${statementPreview}`);

          try {
            // Execute raw SQL using Supabase's RPC function
            // Note: You need to create this function in Supabase first
            const { error } = await client.rpc('execute_sql', {
              sql: statement,
            });

            if (error) {
              console.log(' ❌');
              throw error;
            }

            console.log(' ✅');
          } catch (error) {
            console.log(' ❌');
            console.error(`\n   Error executing statement: ${error instanceof Error ? error.message : String(error)}`);
            
            // Continue with next statement or abort?
            const shouldContinue = process.argv.includes('--continue-on-error');
            if (!shouldContinue) {
              throw error;
            }
          }
        }

        console.log(`✅ Migration ${migrationFile} completed successfully\n`);
      } catch (error) {
        console.error(`❌ Failed to run migration ${migrationFile}:`, error);
        throw error;
      }
    }

    console.log('🎉 All migrations completed successfully!');
    
    // Refresh materialized views
    console.log('\n🔄 Refreshing materialized views...');
    try {
      await client.rpc('refresh_all_views');
      console.log('✅ Materialized views refreshed successfully');
    } catch (error) {
      console.warn('⚠️  Could not refresh materialized views:', error instanceof Error ? error.message : String(error));
    }

  } catch (error) {
    console.error('\n❌ Migration runner failed:', error);
    process.exit(1);
  }
}

// Alternative: Use Supabase CLI approach
function printSupabaseCLIInstructions() {
  console.log('\n📚 Alternative: Using Supabase CLI (Recommended)\n');
  console.log('1. Install Supabase CLI:');
  console.log('   brew install supabase/tap/supabase\n');
  
  console.log('2. Link your project:');
  console.log('   supabase link --project-ref your-project-ref\n');
  
  console.log('3. Run migrations:');
  console.log('   supabase db push\n');
  
  console.log('4. Or apply SQL files directly:');
  console.log('   supabase db execute -f src/lib/supabase/migrations/001_create_sqp_tables.sql');
  console.log('   supabase db execute -f src/lib/supabase/migrations/002_create_sqp_views.sql\n');
}

// Check if running directly
if (require.main === module) {
  const showCLIInstructions = process.argv.includes('--show-cli-instructions');
  
  if (showCLIInstructions) {
    printSupabaseCLIInstructions();
  } else {
    console.log('Note: For production use, we recommend using Supabase CLI.');
    console.log('Run with --show-cli-instructions to see how.\n');
    
    runMigrations().catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
  }
}

export { runMigrations };