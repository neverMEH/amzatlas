#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

async function backupMigrations() {
  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '_');
  const backupDir = path.join(process.cwd(), `migrations_backup_${timestamp}`);
  const migrationsDir = path.join(__dirname, '../lib/supabase/migrations');

  console.log(chalk.blue('🔐 Creating Migration Backup...\n'));

  try {
    // Create backup directory
    await fs.mkdir(backupDir, { recursive: true });
    console.log(chalk.green(`✅ Created backup directory: ${backupDir}`));

    // Copy all migration files
    const files = await fs.readdir(migrationsDir);
    let copiedCount = 0;

    for (const file of files) {
      if (file.endsWith('.sql') || file.endsWith('.md') || file.endsWith('.ts')) {
        const sourcePath = path.join(migrationsDir, file);
        const destPath = path.join(backupDir, file);
        
        await fs.copyFile(sourcePath, destPath);
        copiedCount++;
      }
    }

    console.log(chalk.green(`✅ Backed up ${copiedCount} files`));

    // Create backup manifest
    const manifest = {
      timestamp: new Date().toISOString(),
      totalFiles: copiedCount,
      backupPath: backupDir,
      files: files.filter(f => f.endsWith('.sql') || f.endsWith('.md') || f.endsWith('.ts'))
    };

    await fs.writeFile(
      path.join(backupDir, 'backup-manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    console.log(chalk.green('✅ Created backup manifest'));

    // Create restore script
    const restoreScript = `#!/usr/bin/env node
// Restore script for migrations backup ${timestamp}

const fs = require('fs');
const path = require('path');

const backupDir = __dirname;
const targetDir = path.join(process.cwd(), 'src/lib/supabase/migrations');

console.log('Restoring migrations from backup...');

const manifest = JSON.parse(fs.readFileSync(path.join(backupDir, 'backup-manifest.json'), 'utf-8'));

manifest.files.forEach(file => {
  const sourcePath = path.join(backupDir, file);
  const destPath = path.join(targetDir, file);
  
  fs.copyFileSync(sourcePath, destPath);
  console.log(\`Restored: \${file}\`);
});

console.log(\`✅ Restored \${manifest.files.length} files\`);
`;

    await fs.writeFile(
      path.join(backupDir, 'restore.js'),
      restoreScript,
      { mode: 0o755 }
    );

    console.log(chalk.green('✅ Created restore script'));
    console.log(chalk.blue(`\n📁 Backup location: ${backupDir}`));
    console.log(chalk.yellow('💡 To restore: node migrations_backup_${timestamp}/restore.js\n'));

    return backupDir;
  } catch (error) {
    console.error(chalk.red('❌ Backup failed:'), error);
    throw error;
  }
}

// Execute if run directly
if (require.main === module) {
  backupMigrations().catch(console.error);
}

export { backupMigrations };