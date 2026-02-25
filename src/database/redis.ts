import Redis from 'ioredis'

// =====================================================
// AXIS — Redis Client & Cache Helpers
//
// Conexão via REDIS_URL do .env.
// TTL padrão: 5 minutos (300s).
//
// Uso:
//   import { cache } from '@/src/database/redis'
//
//   await cache.set('dashboard:tenant123', data)
//   const hit = await cache.get<DashboardData>('dashboard:tenant123')
//   await cache.del('dashboard:tenant123')
//
// Singleton: mesma instância reutilizada em todo o app
// (compatível com hot-reload do Next.js dev).
// =====================================================

const DEFAULT_TTL = 300 // 5 minutos em segundos

// Singleton para evitar múltiplas conexões em dev (hot-reload)
const globalForRedis = globalThis as unknown as { redis?: Redis }

function createClient(): Redis {
  if (globalForRedis.redis) {
    return globalForRedis.redis
  }

  const url = process.env.REDIS_URL
  if (!url) {
    console.warn('[AXIS REDIS] REDIS_URL não configurada — cache desabilitado')
    // Retorna client "noop" que não conecta
    return new Redis({ lazyConnect: true, enableOfflineQueue: false })
  }

  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 5) return null // Para de reconectar após 5 tentativas
      return Math.min(times * 200, 2000)
    },
    enableReadyCheck: true,
    connectTimeout: 5000,
  })

  client.on('connect', () => {
    console.log('[AXIS REDIS] Conectado')
  })

  client.on('error', (err) => {
    console.error('[AXIS REDIS] Erro:', err.message)
  })

  if (process.env.NODE_ENV !== 'production') {
    globalForRedis.redis = client
  }

  return client
}

const redis = createClient()

// =====================================================
// Cache Helpers — API simples sobre o ioredis
// =====================================================

export const cache = {
  /**
   * Busca valor do cache. Retorna null se não existir ou Redis indisponível.
   * Deserializa JSON automaticamente.
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const raw = await redis.get(key)
      if (raw === null) return null
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  },

  /**
   * Salva valor no cache com TTL.
   * Serializa para JSON automaticamente.
   * @param key   Chave do cache
   * @param value Valor (será JSON.stringify)
   * @param ttl   TTL em segundos (padrão: 300 = 5 min)
   */
  async set(key: string, value: unknown, ttl: number = DEFAULT_TTL): Promise<void> {
    try {
      const serialized = JSON.stringify(value)
      await redis.set(key, serialized, 'EX', ttl)
    } catch {
      // Silencioso — cache é best-effort
    }
  },

  /**
   * Remove chave(s) do cache.
   * Aceita uma chave ou array de chaves.
   */
  async del(...keys: string[]): Promise<void> {
    try {
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } catch {
      // Silencioso
    }
  },

  /**
   * Verifica se chave existe no cache.
   */
  async exists(key: string): Promise<boolean> {
    try {
      return (await redis.exists(key)) === 1
    } catch {
      return false
    }
  },

  /**
   * Atualiza o TTL de uma chave existente.
   * @param key Chave do cache
   * @param ttl Novo TTL em segundos
   */
  async expire(key: string, ttl: number = DEFAULT_TTL): Promise<void> {
    try {
      await redis.expire(key, ttl)
    } catch {
      // Silencioso
    }
  },

  /**
   * Get-or-set: busca do cache, se não existir executa fn() e salva.
   * Padrão cache-aside (lazy population).
   *
   * Uso:
   *   const data = await cache.wrap('key', 60, async () => {
   *     return await db.query(...)
   *   })
   */
  async wrap<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T>
  async wrap<T>(key: string, fn: () => Promise<T>): Promise<T>
  async wrap<T>(
    key: string,
    ttlOrFn: number | (() => Promise<T>),
    maybeFn?: () => Promise<T>
  ): Promise<T> {
    const ttl = typeof ttlOrFn === 'number' ? ttlOrFn : DEFAULT_TTL
    const fn = typeof ttlOrFn === 'function' ? ttlOrFn : maybeFn!

    const cached = await this.get<T>(key)
    if (cached !== null) return cached

    const fresh = await fn()
    await this.set(key, fresh, ttl)
    return fresh
  },

  /** Referência direta ao cliente ioredis (para comandos avançados). */
  client: redis,

  /** TTL padrão em segundos. */
  DEFAULT_TTL,
}

export default redis
