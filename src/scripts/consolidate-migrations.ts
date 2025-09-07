import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

interface ConsolidationResult {
  number: string;
  name: string;
  consolidatedContent: string;
  filesToRemove: string[];
  warnings: string[];
}

interface RenumberingPlan {
  old: string;
  new: string;
}

export async function consolidateMigrations(
  duplicates: Array<{ number: string; files: string[] }>,
  migrationsPath: string
): Promise<ConsolidationResult[]> {
  const results: ConsolidationResult[] = [];

  for (const dup of duplicates) {
    console.log(chalk.blue(`\n📦 Consolidating migration ${dup.number}...`));
    
    const contents: Array<{ file: string; content: string }> = [];
    const warnings: string[] = [];

    // Special handling for ASIN column fixes
    const asinFixes = dup.files.filter(f => f.includes('fix_asin_column'));
    if (asinFixes.length > 1) {
      console.log(chalk.yellow(`  ⚠️  Multiple ASIN column fixes found. Keeping only the latest.`));
      // Keep only the "final_safe" or "simple" version
      const keepFile = asinFixes.find(f => f.includes('final_safe')) || 
                      asinFixes.find(f => f.includes('simple')) || 
                      asinFixes[asinFixes.length - 1];
      
      // Read only the keeper
      const content = await fs.readFile(path.join(migrationsPath, keepFile), 'utf-8');
      contents.push({ file: keepFile, content });
      
      // Remove the others from processing
      dup.files = dup.files.filter(f => !asinFixes.includes(f) || f === keepFile);
    }

    // Read all remaining files
    for (const file of dup.files) {
      if (contents.some(c => c.file === file)) continue; // Skip if already processed
      
      try {
        const content = await fs.readFile(path.join(migrationsPath, file), 'utf-8');
        contents.push({ file, content });
        console.log(chalk.gray(`  ✓ Read ${file}`));
      } catch (error) {
        warnings.push(`Failed to read ${file}: ${error}`);
        console.log(chalk.red(`  ✗ Failed to read ${file}`));
      }
    }

    // Determine consolidated name
    let consolidatedName = '';
    if (dup.files.some(f => f.includes('refresh_infrastructure'))) {
      consolidatedName = `${dup.number}_consolidated_infrastructure.sql`;
    } else if (dup.files.some(f => f.includes('brand_dashboard'))) {
      consolidatedName = `${dup.number}_consolidated_brand_views.sql`;
    } else if (dup.files.some(f => f.includes('edge_function'))) {
      consolidatedName = `${dup.number}_consolidated_edge_functions.sql`;
    } else if (asinFixes.length > 0) {
      consolidatedName = `${dup.number}_fix_asin_column_consolidated.sql`;
    } else {
      consolidatedName = `${dup.number}_consolidated.sql`;
    }

    // Merge contents
    const consolidatedContent = mergeMigrationFiles(contents);
    
    // Validate merged content
    const validationIssues = validateMigrationContent(consolidatedContent);
    if (validationIssues.length > 0) {
      warnings.push(...validationIssues);
    }

    results.push({
      number: dup.number,
      name: consolidatedName,
      consolidatedContent,
      filesToRemove: dup.files.filter(f => f !== consolidatedName),
      warnings
    });
  }

  return results;
}

export function mergeMigrationFiles(contents: Array<{ file: string; content: string }>): string {
  const header = `-- Consolidated migration
-- Generated on: ${new Date().toISOString()}
-- Combined from:
${contents.map(c => `--   - ${c.file}`).join('\n')}

`;

  const sections = contents.map(({ file, content }) => {
    return `
-- ================================================================
-- Section from: ${file}
-- ================================================================

${content.trim()}
`;
  });

  return header + sections.join('\n\n');
}

export function validateMigrationContent(content: string): string[] {
  const issues: string[] = [];
  
  // Check for conflicting CREATE TABLE statements
  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\S+)/gi;
  const tables = new Map<string, number>();
  
  let match;
  while ((match = createTableRegex.exec(content)) !== null) {
    const tableName = match[1].toLowerCase();
    tables.set(tableName, (tables.get(tableName) || 0) + 1);
  }
  
  for (const [table, count] of tables) {
    if (count > 1) {
      issues.push(`Multiple CREATE TABLE statements for ${table}`);
    }
  }

  // Check for missing IF NOT EXISTS
  if (/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/i.test(content)) {
    issues.push('CREATE TABLE without IF NOT EXISTS');
  }
  
  if (/CREATE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/i.test(content)) {
    issues.push('CREATE INDEX without IF NOT EXISTS');
  }

  // Check for DROP followed by CREATE of same object
  const dropCreateRegex = /DROP\s+(\w+)\s+(?:IF\s+EXISTS\s+)?(\S+)[\s\S]*?CREATE\s+\1[^;]*?\2/gi;
  if (dropCreateRegex.test(content)) {
    issues.push('DROP followed by CREATE of same object - consider using CREATE OR REPLACE');
  }

  return issues;
}

export function renumberMigrations(files: string[], startNumber: number): RenumberingPlan[] {
  const plan: RenumberingPlan[] = [];
  const migrationGroups = new Map<string, string[]>();
  
  // Group files by base number
  files.forEach(file => {
    const match = file.match(/^(\d{3})[a-z]?_/);
    if (match) {
      const baseNum = match[1];
      if (!migrationGroups.has(baseNum)) {
        migrationGroups.set(baseNum, []);
      }
      migrationGroups.get(baseNum)!.push(file);
    }
  });

  let currentNumber = startNumber;
  
  // Process each group
  for (const [baseNum, groupFiles] of migrationGroups) {
    // Skip properly sequenced sub-lettered migrations (like 023, 023a, 023b, 023c)
    const hasSubLetters = groupFiles.some(f => /^\d{3}[a-z]_/.test(f));
    const hasBase = groupFiles.some(f => /^\d{3}_/.test(f) && !/^\d{3}[a-z]_/.test(f));
    
    if (hasSubLetters && hasBase && groupFiles.length > 1) {
      // This is a properly sequenced group, skip it
      console.log(chalk.gray(`  Skipping properly sequenced group: ${baseNum}`));
      continue;
    }

    // Renumber files that need it
    groupFiles.forEach(file => {
      const newNumber = String(currentNumber).padStart(3, '0');
      const newFile = file.replace(/^\d{3}/, newNumber);
      
      if (file !== newFile) {
        plan.push({ old: file, new: newFile });
      }
      currentNumber++;
    });
  }

  return plan;
}

// Main execution
if (require.main === module) {
  async function main() {
    console.log(chalk.blue('🔧 Consolidating Duplicate Migrations\n'));

    const migrationsPath = path.join(__dirname, '../lib/supabase/migrations');
    
    // Define duplicates to consolidate (from our analysis)
    const duplicatesToConsolidate = [
      {
        number: '031',
        files: [
          '031_add_keyword_analysis_functions.sql',
          '031_add_refresh_infrastructure.sql',
          '031_create_brand_dashboard_views.sql',
          '031_fix_asin_column_corrected.sql',
          '031_fix_asin_column_final_safe.sql',
          '031_fix_asin_column_simple.sql'
        ]
      },
      {
        number: '032',
        files: [
          '032_add_refresh_helper_functions.sql',
          '032_add_refresh_helper_functions_fixed.sql',
          '032_create_brand_dashboard_views_fixed.sql',
          '032_recreate_asin_performance_by_brand.sql'
        ]
      },
      {
        number: '033',
        files: [
          '033_create_daily_brand_metrics_view.sql',
          '033_create_minimal_public_views.sql',
          '033_create_public_brand_query_view.sql',
          '033_create_public_views_for_edge_functions.sql',
          '033_create_public_views_for_edge_functions_current.sql',
          '033_create_public_views_for_edge_functions_fixed.sql',
          '033_recreate_brand_search_query_metrics.sql'
        ]
      }
    ];

    // Perform consolidation
    const results = await consolidateMigrations(duplicatesToConsolidate, migrationsPath);
    
    // Write consolidated files
    for (const result of results) {
      const outputPath = path.join(migrationsPath, result.name);
      
      if (result.warnings.length > 0) {
        console.log(chalk.yellow(`\n⚠️  Warnings for ${result.number}:`));
        result.warnings.forEach(w => console.log(`   - ${w}`));
      }
      
      await fs.writeFile(outputPath, result.consolidatedContent);
      console.log(chalk.green(`\n✅ Created ${result.name}`));
      
      // Remove old files
      for (const fileToRemove of result.filesToRemove) {
        const filePath = path.join(migrationsPath, fileToRemove);
        try {
          await fs.unlink(filePath);
          console.log(chalk.gray(`   ✓ Removed ${fileToRemove}`));
        } catch (error) {
          console.log(chalk.red(`   ✗ Failed to remove ${fileToRemove}: ${error}`));
        }
      }
    }

    // Now handle renumbering of other duplicates
    console.log(chalk.blue('\n\n📝 Renumbering Remaining Duplicates...\n'));
    
    const filesToRenumber = [
      '025_add_post_sync_brand_extraction.sql',
      '025_create_rolling_average_views.sql',
      '026_create_anomaly_detection_functions.sql',
      '026_create_public_views_for_sqp_tables.sql',
      '027_add_automatic_brand_matching.sql',
      '027_add_brand_matching_functions.sql',
      '027_create_report_configuration_tables.sql',
      '027_create_trend_classification_functions.sql',
      '028_create_period_comparison_functions.sql',
      '028_create_period_comparison_public_views.sql',
      '029_create_public_rpc_wrappers.sql',
      '029_create_search_performance_summary_view.sql'
    ];

    const renumberingPlan = renumberMigrations(filesToRenumber, 36);
    
    // Execute renumbering
    for (const { old: oldFile, new: newFile } of renumberingPlan) {
      const oldPath = path.join(migrationsPath, oldFile);
      const newPath = path.join(migrationsPath, newFile);
      
      try {
        await fs.rename(oldPath, newPath);
        console.log(chalk.green(`✅ Renamed ${oldFile} → ${newFile}`));
      } catch (error) {
        console.log(chalk.red(`❌ Failed to rename ${oldFile}: ${error}`));
      }
    }

    console.log(chalk.green('\n\n✨ Migration consolidation complete!'));
    console.log(chalk.yellow('\n📋 Next steps:'));
    console.log('   1. Review consolidated migration files');
    console.log('   2. Update migration documentation');
    console.log('   3. Test migrations in development environment');
  }

  main().catch(console.error);
}