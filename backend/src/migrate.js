require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./config/database');

/**
 * Run database migrations
 */
async function runMigrations() {
  const migrationsDir = path.join(__dirname, '../migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  console.log('Starting database migrations...');
  console.log(`Found ${migrationFiles.length} migration files`);

  for (const file of migrationFiles) {
    console.log(`\nRunning migration: ${file}`);
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    try {
      await pool.query(sql);
      console.log(`✓ ${file} completed successfully`);
    } catch (error) {
      console.error(`✗ ${file} failed:`, error.message);
      throw error;
    }
  }

  console.log('\n✓ All migrations completed successfully!');
}

// Run migrations
runMigrations()
  .then(() => {
    console.log('\nMigration script finished. Exiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Migration failed:', error);
    process.exit(1);
  });
