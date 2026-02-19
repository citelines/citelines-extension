#!/usr/bin/env node
/**
 * One-off migration: strip " - Annotations" suffix from share titles.
 * Usage: DATABASE_URL=<url> node backend/scripts/strip-annotations-suffix.js
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const result = await pool.query(
    `UPDATE shares
     SET title = LEFT(title, LENGTH(title) - LENGTH(' - Annotations'))
     WHERE title LIKE '% - Annotations'
     RETURNING share_token, title`
  );
  console.log(`Updated ${result.rowCount} shares:`);
  for (const row of result.rows) {
    console.log(`  ${row.share_token}: "${row.title}"`);
  }
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
