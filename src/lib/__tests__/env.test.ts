import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('env validation — Onda 8 Sessão 3', () => {
  const originalEnv = process.env
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>
  let mutEnv: Record<string, string | undefined>

  beforeEach(() => {
    process.env = { ...originalEnv }
    mutEnv = process.env as Record<string, string | undefined>
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.resetModules()
  })

  afterEach(() => {
    process.env = originalEnv
    consoleErrorSpy.mockRestore()
    consoleWarnSpy.mockRestore()
  })

  // Bloco 1: Defaults em desenvolvimento
  describe('defaults dev-friendly', () => {
    it('aplica DATABASE_HOST=localhost se ausente em dev', async () => {
      mutEnv.NODE_ENV = 'development'
      delete mutEnv.DATABASE_HOST
      const { env } = await import('../env')
      expect(env.DATABASE_HOST).toBe('localhost')
    })

    it('aplica SENTRY_ORG=psiform por default', async () => {
      mutEnv.NODE_ENV = 'development'
      delete mutEnv.SENTRY_ORG
      const { env } = await import('../env')
      expect(env.SENTRY_ORG).toBe('psiform')
    })

    it('aplica SENTRY_PROJECT=axis-tcc por default', async () => {
      mutEnv.NODE_ENV = 'development'
      delete mutEnv.SENTRY_PROJECT
      const { env } = await import('../env')
      expect(env.SENTRY_PROJECT).toBe('axis-tcc')
    })

    it('aplica NODE_ENV=development se ausente', async () => {
      delete mutEnv.NODE_ENV
      const { env } = await import('../env')
      expect(env.NODE_ENV).toBe('development')
    })

    it('aplica ASR_SERVICE_URL default', async () => {
      mutEnv.NODE_ENV = 'development'
      delete mutEnv.ASR_SERVICE_URL
      const { env } = await import('../env')
      expect(env.ASR_SERVICE_URL).toBe('http://localhost:8000/v1/audio/transcriptions')
    })
  })

  // Bloco 2: Envs válidas em desenvolvimento
  describe('parse envs válidas', () => {
    it('parses envs válidas em development', async () => {
      mutEnv.NODE_ENV = 'development'
      mutEnv.DATABASE_HOST = 'db.local'
      mutEnv.SENTRY_ORG = 'custom-org'
      const { env } = await import('../env')
      expect(env.DATABASE_HOST).toBe('db.local')
      expect(env.SENTRY_ORG).toBe('custom-org')
    })

    it('aceita REDIS_URL como opcional', async () => {
      mutEnv.NODE_ENV = 'development'
      delete mutEnv.REDIS_URL
      const { env } = await import('../env')
      expect(env.REDIS_URL).toBeUndefined()
    })
  })

  // Bloco 3: Validação rigorosa em produção
  describe('validação rigorosa em prod', () => {
    it('falha em prod sem CLERK_SECRET_KEY', async () => {
      mutEnv.NODE_ENV = 'production'
      delete mutEnv.CLERK_SECRET_KEY
      mutEnv.DATABASE_PASSWORD = 'AxisTcc2026!'
      mutEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_live_abc123'
      mutEnv.GOOGLE_CLIENT_ID = 'a-very-long-google-client-id-string'
      mutEnv.GOOGLE_CLIENT_SECRET = 'a-very-long-google-client-secret-string'
      mutEnv.CRON_SECRET = 'a'.repeat(32)
      await expect(import('../env')).rejects.toThrow(/Env validation failed in production/)
    })

    it('falha em prod com CLERK_SECRET_KEY sem prefix sk_', async () => {
      mutEnv.NODE_ENV = 'production'
      mutEnv.CLERK_SECRET_KEY = 'invalid_no_prefix'
      mutEnv.DATABASE_PASSWORD = 'AxisTcc2026!'
      mutEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_live_abc123'
      mutEnv.GOOGLE_CLIENT_ID = 'a-very-long-google-client-id-string'
      mutEnv.GOOGLE_CLIENT_SECRET = 'a-very-long-google-client-secret-string'
      mutEnv.CRON_SECRET = 'a'.repeat(32)
      await expect(import('../env')).rejects.toThrow(/Env validation failed in production/)
    })

    it('falha em prod sem GOOGLE_CLIENT_ID', async () => {
      mutEnv.NODE_ENV = 'production'
      delete mutEnv.GOOGLE_CLIENT_ID
      mutEnv.DATABASE_PASSWORD = 'AxisTcc2026!'
      mutEnv.CLERK_SECRET_KEY = 'sk_live_abc123'
      mutEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_live_abc123'
      mutEnv.GOOGLE_CLIENT_SECRET = 'a-very-long-google-client-secret-string'
      mutEnv.CRON_SECRET = 'a'.repeat(32)
      await expect(import('../env')).rejects.toThrow(/Env validation failed in production/)
    })

    it('falha em prod com CRON_SECRET menor que 32 chars', async () => {
      mutEnv.NODE_ENV = 'production'
      mutEnv.CRON_SECRET = 'short'
      mutEnv.DATABASE_PASSWORD = 'AxisTcc2026!'
      mutEnv.CLERK_SECRET_KEY = 'sk_live_abc123'
      mutEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_live_abc123'
      mutEnv.GOOGLE_CLIENT_ID = 'a-very-long-google-client-id-string'
      mutEnv.GOOGLE_CLIENT_SECRET = 'a-very-long-google-client-secret-string'
      await expect(import('../env')).rejects.toThrow(/Env validation failed in production/)
    })

    it('parses envs válidas em production', async () => {
      mutEnv.NODE_ENV = 'production'
      mutEnv.DATABASE_PASSWORD = 'StrongPasswd2026!'
      mutEnv.CLERK_SECRET_KEY = 'sk_live_abc123def456'
      mutEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_live_abc123def456'
      mutEnv.CLERK_WEBHOOK_SECRET = 'whsec_a_secret_with_more_than_20_chars'
      mutEnv.GOOGLE_CLIENT_ID = 'a-very-long-google-client-id-string'
      mutEnv.GOOGLE_CLIENT_SECRET = 'a-very-long-google-client-secret-string'
      mutEnv.OPENAI_API_KEY = 'sk-openai-key-example'
      mutEnv.RESEND_API_KEY = 're_resend-key-example'
      mutEnv.CRON_SECRET = 'a'.repeat(32)
      mutEnv.INTERNAL_API_KEY = 'b'.repeat(32)
      mutEnv.HOTMART_HOTTOK = 'hottok-min-8'
      const { env } = await import('../env')
      expect(env.NODE_ENV).toBe('production')
      expect(env.DATABASE_PASSWORD).toBe('StrongPasswd2026!')
    })
  })
})
