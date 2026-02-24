import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  user: process.env.DATABASE_USER || 'axis',
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME || 'axis_tcc',
  max: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '10'),
  idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT_MS || '30000'),
  connectionTimeoutMillis: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT_MS || '5000'),
})

pool.on('error', (err) => {
  console.error('[AXIS POOL] Erro inesperado:', err.message)
})

export async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()')
    console.log('✅ Conexão com PostgreSQL funcionando!')
    console.log('⏰ Hora no servidor:', result.rows[0].now)
    return true
  } catch (error) {
    console.error('❌ Erro ao conectar:', error)
    return false
  }
}

export default pool
