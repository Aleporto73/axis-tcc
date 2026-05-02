require('dotenv').config()
const { Pool } = require('pg')
const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
})
pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'tcc_analyses'").then(r => {
  console.log('Colunas:', r.rows.map(x => x.column_name))
  pool.end()
})
