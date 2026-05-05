import { Pool } from 'pg'
import * as Sentry from '@sentry/nextjs'
import { env } from '@/src/lib/env'

const pool = new Pool({
  host: env.DATABASE_HOST || 'localhost',
  port: parseInt(env.DATABASE_PORT || '5432'),
  user: env.DATABASE_USER || 'axis',
  password: env.DATABASE_PASSWORD,
  database: env.DATABASE_NAME || 'axis_tcc',
  max: parseInt(env.DATABASE_MAX_CONNECTIONS || '10'),
  idleTimeoutMillis: parseInt(env.DATABASE_IDLE_TIMEOUT_MS || '30000'),
  connectionTimeoutMillis: parseInt(env.DATABASE_CONNECTION_TIMEOUT_MS || '5000'),
})

pool.on('error', (err) => {
  Sentry.captureException(err, { tags: { infra: 'pool' } })
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
