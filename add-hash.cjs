require('dotenv').config()
const { Pool } = require('pg')
const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
})
pool.query("ALTER TABLE clinical_states ADD COLUMN IF NOT EXISTS event_hash VARCHAR(64)").then(() => {
  console.log('Coluna event_hash adicionada!')
  return pool.query("CREATE INDEX IF NOT EXISTS idx_clinical_states_event_hash ON clinical_states(event_hash)")
}).then(() => {
  console.log('Índice criado!')
  pool.end()
}).catch(e => {
  console.error('Erro:', e.message)
  pool.end()
})
