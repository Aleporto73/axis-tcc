import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })

  try {
    const sql = fs.readFileSync(
      path.join(__dirname, 'migrations/026_tdah_family_tokens.sql'),
      'utf-8'
    )
    await pool.query(sql)
    console.log('✅ Migration 026 applied: tdah_family_tokens + tdah_family_access_log')
  } catch (err) {
    console.error('❌ Migration 026 failed:', err)
    throw err
  } finally {
    await pool.end()
  }
}

run()
