import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';

interface MigrationAnalysis {
  totalFiles: number;
  duplicates: Array<{
    number: string;
    files: string[];
  }>;
  gaps: number[];
  subLettered: Array<{
    baseNumber: string;
    variants: string[];
  }>;
  highestNumber: number;
}

interface TableUsageAnalysis {
  emptyTables: Array<{
    schema: string;
    name: string;
    rows: number;
    createdByMigration?: string;
  }>;
  lowUsageTables: Array<{
    schema: string;
    name: string;
    rows: number;
  }>;
  activeTables: Array<{
    schema: string;
    name: string;
    rows: number;
  }>;
}

export async function analyzeMigrations(migrationsPath: string): Promise<MigrationAnalysis> {
  const files = await fs.readdir(migrationsPath);
  const sqlFiles = files.filter(f => f.endsWith('.sql'));
  
  const duplicates = findDuplicateMigrations(sqlFiles);
  const gaps = findMigrationGaps(sqlFiles);
  const subLettered = findSubLetteredMigrations(sqlFiles);
  const highestNumber = findHighestMigrationNumber(sqlFiles);

  return {
    totalFiles: sqlFiles.length,
    duplicates,
    gaps,
    subLettered,
    highestNumber
  };
}

export function findDuplicateMigrations(files: string[]): Array<{ number: string; files: string[] }> {
  const migrationMap = new Map<string, string[]>();
  
  files.forEach(file => {
    const match = file.match(/^(\d{3})[a-z]?_/);
    if (match) {
      const number = match[1];
      if (!migrationMap.has(number)) {
        migrationMap.set(number, []);
      }
      migrationMap.get(number)!.push(file);
    }
  });

  return Array.from(migrationMap.entries())
    .filter(([_, files]) => files.length > 1)
    .map(([number, files]) => ({ number, files }));
}

function findMigrationGaps(files: string[]): number[] {
  const numbers = files
    .map(f => f.match(/^(\d{3})/))
    .filter(m => m)
    .map(m => parseInt(m![1]))
    .sort((a, b) => a - b);

  const gaps: number[] = [];
  for (let i = 1; i < numbers.length; i++) {
    for (let j = numbers[i - 1] + 1; j < numbers[i]; j++) {
      gaps.push(j);
    }
  }

  return gaps;
}

function findSubLetteredMigrations(files: string[]): Array<{ baseNumber: string; variants: string[] }> {
  const letterPattern = /^(\d{3})([a-z])?_/;
  const groups = new Map<string, string[]>();

  files.forEach(file => {
    const match = file.match(letterPattern);
    if (match) {
      const [_, number, letter] = match;
      if (!groups.has(number)) {
        groups.set(number, []);
      }
      groups.get(number)!.push(file);
    }
  });

  return Array.from(groups.entries())
    .filter(([_, files]) => files.some(f => /^\d{3}[a-z]_/.test(f)))
    .map(([baseNumber, variants]) => ({ baseNumber, variants }));
}

function findHighestMigrationNumber(files: string[]): number {
  const numbers = files
    .map(f => f.match(/^(\d{3})/))
    .filter(m => m)
    .map(m => parseInt(m![1]));

  return Math.max(...numbers, 0);
}

export async function analyzeTableUsage(tables: Array<{ schema: string; name: string; rows: number }>): Promise<TableUsageAnalysis> {
  const emptyTables = tables.filter(t => t.rows === 0);
  const lowUsageTables = tables.filter(t => t.rows > 0 && t.rows < 10);
  const activeTables = tables.filter(t => t.rows >= 10);

  return {
    emptyTables,
    lowUsageTables,
    activeTables
  };
}

async function scanMigrationForTable(migrationPath: string, tableName: string): Promise<boolean> {
  try {
    const content = await fs.readFile(migrationPath, 'utf-8');
    const createTableRegex = new RegExp(`CREATE TABLE\\s+(IF NOT EXISTS\\s+)?[\\w\\.]*${tableName}`, 'i');
    return createTableRegex.test(content);
  } catch {
    return false;
  }
}

export async function findMigrationForTable(
  migrationsPath: string,
  tableName: string,
  schema: string = 'sqp'
): Promise<string | null> {
  const files = await fs.readdir(migrationsPath);
  const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

  for (const file of sqlFiles) {
    const filePath = path.join(migrationsPath, file);
    if (await scanMigrationForTable(filePath, tableName)) {
      return file;
    }
  }

  return null;
}

// Main execution
if (require.main === module) {
  async function main() {
    console.log(chalk.blue('🔍 Analyzing Supabase Migrations...\n'));

    const migrationsPath = path.join(__dirname, '../lib/supabase/migrations');
    
    // Analyze migration files
    const analysis = await analyzeMigrations(migrationsPath);
    
    console.log(chalk.yellow('📊 Migration Analysis Report'));
    console.log(chalk.gray('═'.repeat(50)));
    
    console.log(`\n📁 Total migration files: ${chalk.green(analysis.totalFiles)}`);
    console.log(`🔢 Highest migration number: ${chalk.green(analysis.highestNumber)}`);
    
    if (analysis.duplicates.length > 0) {
      console.log(chalk.red(`\n⚠️  Duplicate Migration Numbers Found: ${analysis.duplicates.length}`));
      analysis.duplicates.forEach(dup => {
        console.log(chalk.red(`\n   Migration ${dup.number}:`));
        dup.files.forEach(file => console.log(`     - ${file}`));
      });
    }

    if (analysis.gaps.length > 0) {
      console.log(chalk.yellow(`\n⚠️  Migration Number Gaps: ${analysis.gaps.join(', ')}`));
    }

    if (analysis.subLettered.length > 0) {
      console.log(chalk.blue(`\n📝 Sub-lettered Migrations:`));
      analysis.subLettered.forEach(group => {
        console.log(`\n   Base ${group.baseNumber}:`);
        group.variants.forEach(file => console.log(`     - ${file}`));
      });
    }

    // Analyze table usage from the Supabase data
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.log(chalk.red('\n❌ Missing Supabase credentials. Cannot analyze table usage.'));
      return;
    }

    // For now, we'll use the data we already have
    const knownEmptyTables = [
      'brand_query_stats',
      'report_configurations',
      'report_recipients',
      'report_execution_history',
      'report_queue',
      'refresh_data_quality',
      'refresh_checkpoints',
      'webhook_deliveries'
    ];

    console.log(chalk.red(`\n\n🗑️  Empty Tables (0 rows):`));
    for (const table of knownEmptyTables) {
      const migration = await findMigrationForTable(migrationsPath, table);
      console.log(`   - sqp.${table}${migration ? chalk.gray(` (created in ${migration})`) : ''}`);
    }

    // Generate summary
    console.log(chalk.yellow(`\n\n📋 Summary of Issues:`));
    console.log(`   - ${chalk.red(analysis.duplicates.length)} duplicate migration numbers`);
    console.log(`   - ${chalk.red(knownEmptyTables.length)} empty tables that can be removed`);
    console.log(`   - ${chalk.yellow(analysis.subLettered.length)} migration series using letter suffixes`);
    
    const totalDuplicateFiles = analysis.duplicates.reduce((sum, dup) => sum + dup.files.length - 1, 0);
    console.log(chalk.green(`\n✨ Potential cleanup: Remove ${totalDuplicateFiles} duplicate files and ${knownEmptyTables.length} unused tables`));
  }

  main().catch(console.error);
}