/**
 * Migration 024: session_summaries multi-módulo
 * Torna session_summaries compatível com TDAH (remove FK, add source_module)
 *
 * Uso:
 *   npx tsx scripts/run-migration-024.ts
 *
 * Ou na VPS (produção):
 *   DATABASE_HOST=localhost DATABASE_USER=axis DATABASE_PASSWORD=xxx npx tsx scripts/run-migration-024.ts
 */

import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  user: process.env.DATABASE_USER || 'axis',
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME || 'axis_tcc',
  connectionTimeoutMillis: 10000,
})

const STEPS = [
  {
    label: '1. Remover FK rígida session_id → sessions_aba',
    sql: `ALTER TABLE session_summaries DROP CONSTRAINT IF EXISTS session_summaries_session_id_fkey;`,
  },
  {
    label: '2. Adicionar coluna source_module',
    sql: `ALTER TABLE session_summaries ADD COLUMN IF NOT EXISTS source_module VARCHAR(10) DEFAULT 'aba';`,
  },
  {
    label: '3. Criar index source_module',
    sql: `CREATE INDEX IF NOT EXISTS idx_session_summaries_module ON session_summaries(source_module);`,
  },
]

async function run() {
  console.log('╔══════════════════════════════════════════════╗')
  console.log('║  Migration 024 — session_summaries multi-mod ║')
  console.log('╚══════════════════════════════════════════════╝')
  console.log()

  const client = await pool.connect()
  try {
    for (const step of STEPS) {
      console.log(`→ ${step.label}`)
      await client.query(step.sql)
      console.log(`  ✅ OK`)
    }

    // Verificação
    const check = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'session_summaries' AND column_name = 'source_module'
    `)

    if (check.rows.length > 0) {
      console.log()
      console.log(`✅ Migration 024 concluída com sucesso!`)
      console.log(`   source_module: ${check.rows[0].data_type}, default: ${check.rows[0].column_default}`)
    } else {
      console.error('❌ Coluna source_module não encontrada após migration')
      process.exit(1)
    }
  } catch (err: any) {
    console.error(`❌ Erro: ${err.message}`)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
