#!/usr/bin/env node
/**
 * Clear all annotations from the database
 * Usage: node clear-data.js
 */

require('dotenv').config();
const { Pool } = require('pg');

async function clearDatabase() {
  // Connect to Railway database
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
    // Railway handles SSL automatically, don't need to specify it
  });

  try {
    console.log('Connecting to database...');

    // Count current data
    const sharesCount = await pool.query('SELECT COUNT(*) FROM shares');
    const usersCount = await pool.query('SELECT COUNT(*) FROM users');

    console.log(`\nCurrent data:`);
    console.log(`- Shares: ${sharesCount.rows[0].count}`);
    console.log(`- Users: ${usersCount.rows[0].count}`);

    // Clear shares
    console.log('\nDeleting all shares...');
    await pool.query('DELETE FROM shares');

    // Uncomment the line below to also delete all users (complete wipe)
	// await pool.query('DELETE FROM users');

    // Verify
    const newSharesCount = await pool.query('SELECT COUNT(*) FROM shares');
    const newUsersCount = await pool.query('SELECT COUNT(*) FROM users');

    console.log(`\n✅ Database cleared!`);
    console.log(`- Shares remaining: ${newSharesCount.rows[0].count}`);
    console.log(`- Users remaining: ${newUsersCount.rows[0].count}`);

  } catch (error) {
    console.error('❌ Error clearing database:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

clearDatabase();
