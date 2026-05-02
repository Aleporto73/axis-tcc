require('dotenv').config()
const { Pool } = require('pg')
const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
})
pool.query("ALTER TABLE tcc_analyses ADD COLUMN IF NOT EXISTS behaviors JSONB DEFAULT '[]'").then(() => {
  console.log('Coluna behaviors adicionada!')
  pool.end()
}).catch(e => {
  console.error('Erro:', e.message)
  pool.end()
})
