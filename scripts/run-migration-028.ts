import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })

  try {
    const sql = fs.readFileSync(
      path.join(__dirname, 'migrations/028_fix_license_gate.sql'),
      'utf-8'
    )
    await pool.query(sql)
    console.log('✅ Migration 028 applied: license gate fix (CHECK tdah, desativar free tier, uq_user_product)')
  } catch (err) {
    console.error('❌ Migration 028 failed:', err)
    throw err
  } finally {
    await pool.end()
  }
}

run()
