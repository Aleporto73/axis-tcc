import { NextRequest, NextResponse } from 'next/server'

// =====================================================
// AXIS ABA — Rate Limiting Middleware
//
// Sliding-window rate limiter reutilizável.
// Usa Redis quando disponível (distribuído),
// fallback para Map em memória (single-instance).
//
// Uso nas API routes:
//
//   import { rateLimit, withRateLimit } from '@/src/middleware/rate-limit'
//
//   // Opção 1 — wrapper (recomendado):
//   export const POST = withRateLimit(handler, { limit: 100, windowMs: 60_000 })
//
//   // Opção 2 — check manual:
//   export async function POST(req: NextRequest) {
//     const blocked = await rateLimit(req, { limit: 100, windowMs: 60_000 })
//     if (blocked) return blocked
//     ...
//   }
//
// Headers retornados:
//   X-RateLimit-Limit     — máximo de requests na janela
//   X-RateLimit-Remaining — requests restantes
//   X-RateLimit-Reset     — timestamp (s) de quando a janela reseta
//   Retry-After           — segundos até poder tentar (só no 429)
// =====================================================

export interface RateLimitOptions {
  /** Máximo de requests por janela. Default: 100 */
  limit?: number
  /** Duração da janela em ms. Default: 60_000 (1 minuto) */
  windowMs?: number
  /** Prefixo para a chave no store. Default: 'rl' */
  prefix?: string
  /** Extrair identificador customizado do request. Default: IP */
  keyGenerator?: (req: NextRequest) => string
}

const DEFAULT_LIMIT = 100
const DEFAULT_WINDOW_MS = 60_000

// ─── Extrair IP do request ───────────────────────────
function getIP(req: NextRequest): string {
  // Vercel / proxies populam x-forwarded-for
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  // x-real-ip (nginx, Cloudflare)
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  // Fallback
  return '127.0.0.1'
}

// ─── Store Interface ─────────────────────────────────
interface RateLimitResult {
  allowed: boolean
  current: number
  limit: number
  resetAt: number // timestamp em segundos
}

// ─── In-Memory Store (fallback) ──────────────────────
interface MemoryEntry {
  count: number
  resetAt: number // timestamp em ms
}

const memoryStore = new Map<string, MemoryEntry>()

// Limpeza periódica de entradas expiradas (a cada 60s)
let cleanupInterval: ReturnType<typeof setInterval> | null = null

function ensureCleanup() {
  if (cleanupInterval) return
  cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of memoryStore) {
      if (entry.resetAt <= now) {
        memoryStore.delete(key)
      }
    }
  }, 60_000)
  // Não impedir shutdown do processo
  if (cleanupInterval && typeof cleanupInterval === 'object' && 'unref' in cleanupInterval) {
    cleanupInterval.unref()
  }
}

async function checkMemory(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  ensureCleanup()
  const now = Date.now()
  const entry = memoryStore.get(key)

  if (!entry || entry.resetAt <= now) {
    // Nova janela
    const resetAt = now + windowMs
    memoryStore.set(key, { count: 1, resetAt })
    return { allowed: true, current: 1, limit, resetAt: Math.ceil(resetAt / 1000) }
  }

  entry.count++
  memoryStore.set(key, entry)

  return {
    allowed: entry.count <= limit,
    current: entry.count,
    limit,
    resetAt: Math.ceil(entry.resetAt / 1000),
  }
}

// ─── Redis Store ─────────────────────────────────────
let redisClient: any = null
let redisAvailable: boolean | null = null

async function getRedis() {
  if (redisAvailable === false) return null
  if (redisClient) return redisClient

  try {
    // Dynamic import para não crashar se Redis não estiver configurado
    const { cache } = await import('@/src/database/redis')
    // Testar se o client interno está vivo
    const client = (cache as any).client
    if (client && typeof client.ping === 'function') {
      await client.ping()
      redisClient = client
      redisAvailable = true
      return client
    }
    redisAvailable = false
    return null
  } catch {
    redisAvailable = false
    return null
  }
}

async function checkRedis(key: string, limit: number, windowMs: number): Promise<RateLimitResult | null> {
  const redis = await getRedis()
  if (!redis) return null

  try {
    const windowSec = Math.ceil(windowMs / 1000)
    // INCR atômico + TTL no primeiro set
    const current = await redis.incr(key)
    if (current === 1) {
      await redis.expire(key, windowSec)
    }
    const ttl = await redis.ttl(key)
    const resetAt = Math.ceil(Date.now() / 1000) + Math.max(ttl, 0)

    return {
      allowed: current <= limit,
      current,
      limit,
      resetAt,
    }
  } catch {
    // Redis falhou — fallback para memory
    return null
  }
}

// ─── Core: Check Rate Limit ──────────────────────────
async function check(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  // Tentar Redis primeiro
  const redisResult = await checkRedis(key, limit, windowMs)
  if (redisResult) return redisResult

  // Fallback para memória
  return checkMemory(key, limit, windowMs)
}

// ─── Public API ──────────────────────────────────────

/**
 * Verifica rate limit para o request.
 * Retorna `null` se permitido, ou uma `NextResponse 429` se bloqueado.
 */
export async function rateLimit(
  req: NextRequest,
  options: RateLimitOptions = {}
): Promise<NextResponse | null> {
  const {
    limit = DEFAULT_LIMIT,
    windowMs = DEFAULT_WINDOW_MS,
    prefix = 'rl',
    keyGenerator,
  } = options

  const identifier = keyGenerator ? keyGenerator(req) : getIP(req)
  const key = `${prefix}:${identifier}`

  const result = await check(key, limit, windowMs)

  // Headers de rate limit (sempre presentes, mesmo quando permitido)
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(Math.max(0, limit - result.current)),
    'X-RateLimit-Reset': String(result.resetAt),
  }

  if (!result.allowed) {
    const retryAfter = Math.max(1, result.resetAt - Math.ceil(Date.now() / 1000))
    return NextResponse.json(
      {
        error: 'Too Many Requests',
        message: `Rate limit excedido. Tente novamente em ${retryAfter}s.`,
        retry_after: retryAfter,
      },
      {
        status: 429,
        headers: {
          ...headers,
          'Retry-After': String(retryAfter),
        },
      }
    )
  }

  // null = permitido (headers serão adicionados pelo wrapper se usado)
  return null
}

/**
 * HOF que envolve um handler com rate limiting.
 * Headers de rate limit são incluídos em todas as respostas.
 */
export function withRateLimit(
  handler: (req: NextRequest, ctx?: any) => Promise<NextResponse>,
  options: RateLimitOptions = {}
) {
  return async function rateLimitedHandler(req: NextRequest, ctx?: any): Promise<NextResponse> {
    const {
      limit = DEFAULT_LIMIT,
      windowMs = DEFAULT_WINDOW_MS,
      prefix = 'rl',
      keyGenerator,
    } = options

    const identifier = keyGenerator ? keyGenerator(req) : getIP(req)
    const key = `${prefix}:${identifier}`

    const result = await check(key, limit, windowMs)

    const rateLimitHeaders: Record<string, string> = {
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': String(Math.max(0, limit - result.current)),
      'X-RateLimit-Reset': String(result.resetAt),
    }

    if (!result.allowed) {
      const retryAfter = Math.max(1, result.resetAt - Math.ceil(Date.now() / 1000))
      return NextResponse.json(
        {
          error: 'Too Many Requests',
          message: `Rate limit excedido. Tente novamente em ${retryAfter}s.`,
          retry_after: retryAfter,
        },
        {
          status: 429,
          headers: {
            ...rateLimitHeaders,
            'Retry-After': String(retryAfter),
          },
        }
      )
    }

    // Executar handler original
    const response = await handler(req, ctx)

    // Adicionar headers de rate limit à resposta
    const newHeaders = new Headers(response.headers)
    Object.entries(rateLimitHeaders).forEach(([k, v]) => newHeaders.set(k, v))

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    })
  }
}
