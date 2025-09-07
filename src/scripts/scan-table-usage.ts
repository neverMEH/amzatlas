import { Glob } from 'glob';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

interface TableUsage {
  table: string;
  schema: string;
  references: Array<{
    file: string;
    line: number;
    context: string;
  }>;
}

const EMPTY_TABLES = [
  'brand_query_stats',
  'report_configurations',
  'report_recipients',
  'report_execution_history',
  'report_queue',
  'refresh_data_quality',
  'refresh_checkpoints',
  'webhook_deliveries'
];

async function scanTableUsage(): Promise<Map<string, TableUsage>> {
  const results = new Map<string, TableUsage>();
  
  // Initialize results for each table
  EMPTY_TABLES.forEach(table => {
    results.set(table, {
      table,
      schema: 'sqp',
      references: []
    });
  });

  console.log(chalk.blue('🔍 Scanning codebase for table references...\n'));

  // Define patterns to search for
  const searchPatterns = [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.test.ts',
    '!src/**/*.test.tsx',
    '!node_modules/**',
    '!.next/**'
  ];

  const files = await new Glob(searchPatterns[0], {
    ignore: searchPatterns.slice(1).filter(p => p.startsWith('!'))
  }).walk();

  let fileCount = 0;
  for await (const file of files) {
    fileCount++;
    const content = await fs.readFile(file, 'utf-8');
    const lines = content.split('\n');

    for (const table of EMPTY_TABLES) {
      lines.forEach((line, index) => {
        // Look for various patterns where table might be referenced
        const patterns = [
          new RegExp(`['"\`]${table}['"\`]`, 'i'),
          new RegExp(`\\.from\\(['"\`]${table}['"\`]\\)`, 'i'),
          new RegExp(`sqp\\.${table}`, 'i'),
          new RegExp(`table.*=.*['"\`]${table}['"\`]`, 'i')
        ];

        for (const pattern of patterns) {
          if (pattern.test(line)) {
            const usage = results.get(table)!;
            usage.references.push({
              file: path.relative(process.cwd(), file),
              line: index + 1,
              context: line.trim()
            });
            break;
          }
        }
      });
    }
  }

  console.log(chalk.green(`✅ Scanned ${fileCount} files\n`));

  return results;
}

async function generateUsageReport() {
  const usageMap = await scanTableUsage();
  
  console.log(chalk.yellow('📊 Table Usage Report'));
  console.log(chalk.gray('═'.repeat(60)));

  const unusedTables: string[] = [];
  const usedTables: string[] = [];

  for (const [table, usage] of usageMap) {
    if (usage.references.length === 0) {
      unusedTables.push(table);
    } else {
      usedTables.push(table);
      console.log(chalk.red(`\n⚠️  Table: sqp.${table} (${usage.references.length} references)`));
      
      // Group by file
      const byFile = new Map<string, typeof usage.references>();
      usage.references.forEach(ref => {
        if (!byFile.has(ref.file)) {
          byFile.set(ref.file, []);
        }
        byFile.get(ref.file)!.push(ref);
      });

      byFile.forEach((refs, file) => {
        console.log(chalk.gray(`\n  📄 ${file}:`));
        refs.forEach(ref => {
          console.log(`     Line ${ref.line}: ${chalk.gray(ref.context)}`);
        });
      });
    }
  }

  console.log(chalk.green(`\n\n✅ Unused Tables (${unusedTables.length}):`));
  unusedTables.forEach(table => {
    console.log(`   - sqp.${table}`);
  });

  if (usedTables.length > 0) {
    console.log(chalk.red(`\n⚠️  Tables with References (${usedTables.length}):`));
    usedTables.forEach(table => {
      console.log(`   - sqp.${table}`);
    });
  }

  // Generate SQL for dropping unused tables
  if (unusedTables.length > 0) {
    console.log(chalk.blue('\n\n📝 Generated DROP statements for unused tables:\n'));
    console.log(chalk.gray('-- Drop unused tables and their associated objects'));
    
    for (const table of unusedTables) {
      console.log(`\n-- Drop ${table} and related objects`);
      console.log(`DROP TABLE IF EXISTS sqp.${table} CASCADE;`);
      
      // Check for associated sequences
      if (['report_queue', 'brand_query_stats'].includes(table)) {
        console.log(`DROP SEQUENCE IF EXISTS sqp.${table}_id_seq CASCADE;`);
      }
    }
  }

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    totalTablesChecked: EMPTY_TABLES.length,
    unusedTables,
    usedTables: usedTables.map(t => ({
      table: t,
      referenceCount: usageMap.get(t)!.references.length
    })),
    dropStatements: unusedTables.map(t => `DROP TABLE IF EXISTS sqp.${t} CASCADE;`)
  };

  await fs.writeFile(
    'table-usage-report.json',
    JSON.stringify(report, null, 2)
  );

  console.log(chalk.green('\n\n✅ Report saved to table-usage-report.json'));
}

// Run the analysis
generateUsageReport().catch(console.error);