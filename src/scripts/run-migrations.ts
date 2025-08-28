#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { program } from 'commander';

// Define migration info
interface Migration {
  file: string;
  name: string;
  executed?: boolean;
}

class MigrationRunner {
  private supabase: any;
  private migrationsDir: string;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.migrationsDir = path.join(__dirname, '..', 'lib', 'supabase', 'migrations');
  }

  async getMigrationFiles(): Promise<Migration[]> {
    const files = await fs.readdir(this.migrationsDir);
    const sqlFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort(); // Ensure migrations run in order

    return sqlFiles.map(file => ({
      file,
      name: file.replace('.sql', '')
    }));
  }

  async createMigrationsTable(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Note: This requires a custom RPC function 'exec_sql' to be available
    // Alternatively, you can run migrations directly using Supabase CLI or dashboard
    const { error } = await this.supabase.rpc('exec_sql', { sql: createTableSQL })
      .catch(async (err: any) => {
        // Fallback: try to check if table exists
        const { data } = await this.supabase
          .from('schema_migrations')
          .select('version')
          .limit(1);
        
        if (!data && err.message.includes('relation')) {
          throw new Error('schema_migrations table does not exist. Please create it manually or use Supabase CLI.');
        }
        return { error: null };
      });
    if (error) {
      throw new Error(`Failed to create migrations table: ${error.message}`);
    }
  }

  async getExecutedMigrations(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('schema_migrations')
      .select('version')
      .order('version');

    if (error) {
      // Table might not exist yet
      return [];
    }

    return data.map((row: any) => row.version);
  }

  async executeMigration(migration: Migration): Promise<void> {
    const filePath = path.join(this.migrationsDir, migration.file);
    const sql = await fs.readFile(filePath, 'utf-8');

    console.log(`Executing migration: ${migration.name}`);

    try {
      // Execute the migration SQL
      const { error } = await this.supabase.rpc('exec_sql', { sql });
      if (error) {
        throw error;
      }

      // Record the migration as executed
      const { error: recordError } = await this.supabase
        .from('schema_migrations')
        .insert({ version: migration.name });

      if (recordError) {
        throw recordError;
      }

      console.log(`✓ Migration ${migration.name} completed successfully`);
    } catch (error) {
      console.error(`✗ Migration ${migration.name} failed:`, error);
      throw error;
    }
  }

  async runPendingMigrations(): Promise<void> {
    // Ensure migrations table exists
    await this.createMigrationsTable();

    // Get all migrations
    const allMigrations = await this.getMigrationFiles();
    const executedMigrations = await this.getExecutedMigrations();

    // Find pending migrations
    const pendingMigrations = allMigrations.filter(
      m => !executedMigrations.includes(m.name)
    );

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations to run.');
      return;
    }

    console.log(`Found ${pendingMigrations.length} pending migrations`);

    // Execute pending migrations in order
    for (const migration of pendingMigrations) {
      await this.executeMigration(migration);
    }

    console.log('\nAll migrations completed successfully!');
  }

  async runSpecificMigration(migrationName: string): Promise<void> {
    const allMigrations = await this.getMigrationFiles();
    const migration = allMigrations.find(m => m.name === migrationName);

    if (!migration) {
      throw new Error(`Migration ${migrationName} not found`);
    }

    await this.executeMigration(migration);
  }

  async getMigrationStatus(): Promise<void> {
    const allMigrations = await this.getMigrationFiles();
    const executedMigrations = await this.getExecutedMigrations();

    console.log('Migration Status:');
    console.log('=================');

    for (const migration of allMigrations) {
      const status = executedMigrations.includes(migration.name) ? '✓' : '○';
      console.log(`${status} ${migration.name}`);
    }
  }
}

// CLI setup
program
  .name('run-migrations')
  .description('Run Supabase database migrations')
  .version('1.0.0');

program
  .command('up')
  .description('Run all pending migrations')
  .option('-u, --url <url>', 'Supabase URL')
  .option('-k, --key <key>', 'Supabase service role key')
  .action(async (options) => {
    const url = options.url || process.env.SUPABASE_URL;
    const key = options.key || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      console.error('Error: Supabase URL and service role key are required');
      console.error('Provide them via --url and --key options or SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars');
      process.exit(1);
    }

    const runner = new MigrationRunner(url, key);
    try {
      await runner.runPendingMigrations();
    } catch (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
  });

program
  .command('run <migration>')
  .description('Run a specific migration')
  .option('-u, --url <url>', 'Supabase URL')
  .option('-k, --key <key>', 'Supabase service role key')
  .action(async (migration, options) => {
    const url = options.url || process.env.SUPABASE_URL;
    const key = options.key || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      console.error('Error: Supabase URL and service role key are required');
      process.exit(1);
    }

    const runner = new MigrationRunner(url, key);
    try {
      await runner.runSpecificMigration(migration);
    } catch (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show migration status')
  .option('-u, --url <url>', 'Supabase URL')
  .option('-k, --key <key>', 'Supabase service role key')
  .action(async (options) => {
    const url = options.url || process.env.SUPABASE_URL;
    const key = options.key || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      console.error('Error: Supabase URL and service role key are required');
      process.exit(1);
    }

    const runner = new MigrationRunner(url, key);
    try {
      await runner.getMigrationStatus();
    } catch (error) {
      console.error('Error checking migration status:', error);
      process.exit(1);
    }
  });

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}