/**
 * Env validation centralizada — Onda 8 Sessão 3
 *
 * Valida envs essenciais no boot. Falha rápido se variável obrigatória
 * estiver faltando ou inválida em produção.
 *
 * Uso: import { env } from '@/src/lib/env'; const url = env.DATABASE_URL
 *
 * Em desenvolvimento, fallbacks dev-friendly continuam funcionando.
 * Em produção (NODE_ENV=production), envs sem fallback fazem boot falhar.
 */
import { z } from 'zod'

const isProd = process.env.NODE_ENV === 'production'

// Schema declarativo
const envSchema = z.object({
  // Node
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database (Postgres app user — axis_app)
  DATABASE_HOST: z.string().default('localhost'),
  DATABASE_PORT: z.string().default('5432'),
  DATABASE_USER: z.string().default('axis'),
  DATABASE_NAME: z.string().default('axis_tcc'),
  DATABASE_PASSWORD: isProd ? z.string().min(8) : z.string().default('AxisTcc2026!'),

  // Clerk Auth (obrigatório em prod)
  CLERK_SECRET_KEY: isProd ? z.string().startsWith('sk_') : z.string().default('sk_test_placeholder'),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: isProd ? z.string().startsWith('pk_') : z.string().default('pk_test_placeholder'),
  // Híbrido (Onda 8): opcional. Endurecer em Onda 9+ após confirmar setado na VPS.
  CLERK_WEBHOOK_SECRET: z.string().optional(),

  // Google OAuth (obrigatório em prod)
  GOOGLE_CLIENT_ID: isProd ? z.string().min(20) : z.string().default(''),
  GOOGLE_CLIENT_SECRET: isProd ? z.string().min(20) : z.string().default(''),

  // External APIs (opcional em dev)
  // Híbrido (Onda 8): opcional. Endurecer em Onda 9+ após confirmar setado na VPS.
  OPENAI_API_KEY: z.string().optional(),
  // Híbrido (Onda 8): opcional. Endurecer em Onda 9+ após confirmar setado na VPS.
  RESEND_API_KEY: z.string().optional(),

  // Cron (obrigatório em prod) + Internal (opcional, ver comentário abaixo)
  CRON_SECRET: isProd ? z.string().min(32) : z.string().default('dev-cron-secret-change-me'),
  // Híbrido (Onda 8): opcional. Endurecer em Onda 9+ após confirmar setado na VPS.
  INTERNAL_API_KEY: z.string().optional(),

  // Hotmart (opcional em dev)
  // Híbrido (Onda 8): opcional. Endurecer em Onda 9+ após confirmar setado na VPS.
  HOTMART_HOTTOK: z.string().optional(),

  // Sentry (opcional)
  SENTRY_DSN: z.string().optional(),
  SENTRY_ORG: z.string().default('psiform'),
  SENTRY_PROJECT: z.string().default('axis-tcc'),

  // ASR
  ASR_SERVICE_URL: z.string().url().default('http://localhost:8000/v1/audio/transcriptions'),
  TRANSCRIPT_DIR: z.string().default('/var/lib/axis/transcripts'),

  // App URL
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  // Cache (opcional — fallback em memória se ausente)
  REDIS_URL: z.string().optional(),
})

// Validação fail-fast
const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const errors = parsed.error.flatten().fieldErrors
  console.error('❌ Env validation failed:')
  for (const [key, messages] of Object.entries(errors)) {
    console.error(`  ${key}: ${messages?.join(', ')}`)
  }
  if (isProd) {
    throw new Error('Env validation failed in production. Check logs above.')
  } else {
    console.warn('⚠️  Continuing in development mode despite env errors.')
  }
}

export const env = parsed.success ? parsed.data : (process.env as any)

// Helper para code review
export type Env = z.infer<typeof envSchema>
