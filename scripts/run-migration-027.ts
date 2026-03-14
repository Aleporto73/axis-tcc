import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })

  try {
    const sql = fs.readFileSync(
      path.join(__dirname, 'migrations/027_tdah_token_economy.sql'),
      'utf-8'
    )
    await pool.query(sql)
    console.log('✅ Migration 027 applied: tdah_token_economy + tdah_token_transactions')
  } catch (err) {
    console.error('❌ Migration 027 failed:', err)
    throw err
  } finally {
    await pool.end()
  }
}

run()
