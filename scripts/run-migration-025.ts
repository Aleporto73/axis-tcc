import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })

  try {
    const sql = fs.readFileSync(
      path.join(__dirname, 'migrations/025_tdah_teacher_tokens.sql'),
      'utf-8'
    )
    await pool.query(sql)
    console.log('✅ Migration 025 applied: tdah_teacher_tokens + tdah_teacher_access_log')
  } catch (err) {
    console.error('❌ Migration 025 failed:', err)
    throw err
  } finally {
    await pool.end()
  }
}

run()
