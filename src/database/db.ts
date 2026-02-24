import { Pool } from 'pg'

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'axis',
  password: 'AxisTcc2026!',
  database: 'axis_tcc',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
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
