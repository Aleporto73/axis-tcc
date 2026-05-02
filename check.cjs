require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
})

async function check() {
  const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'calendar_connections'")
  console.log('Colunas calendar_connections:', cols.rows.map(r => r.column_name))
  
  const conn = await pool.query('SELECT * FROM calendar_connections LIMIT 1')
  console.log('Connection:', conn.rows[0])
  
  pool.end()
}

check()
