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
  DATABASE_USER: z.string().default('axis_app'),
  DATABASE_NAME: z.string().default('axis_tcc'),
  DATABASE_PASSWORD: isProd ? z.string().min(8) : z.string().default('AxisTcc2026!'),

  // Tenant fallback (rota /api/demo)
  DEFAULT_TENANT_ID: z.string().optional(),

  // Pgcrypto encryption key (server-side, criptografia em tabelas)
  AXIS_ENCRYPTION_KEY: isProd ? z.string().min(20) : z.string().optional(),

  // Clerk Auth (obrigatório em prod)
  CLERK_SECRET_KEY: isProd ? z.string().startsWith('sk_') : z.string().default('sk_test_placeholder'),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: isProd ? z.string().startsWith('pk_') : z.string().default('pk_test_placeholder'),
  // Endurecido (Onda 9): confirmado em prod (38 chars, prefix whse_).
  CLERK_WEBHOOK_SECRET: isProd ? z.string().min(20) : z.string().optional(),

  // Google OAuth (obrigatório em prod)
  GOOGLE_CLIENT_ID: isProd ? z.string().min(20) : z.string().default(''),
  GOOGLE_CLIENT_SECRET: isProd ? z.string().min(20) : z.string().default(''),
  // Google OAuth — redirect/webhook URLs
  GOOGLE_REDIRECT_URI: isProd ? z.string().url() : z.string().optional(),
  GOOGLE_REDIRECT_URI_ABA: z.string().url().optional(),
  GOOGLE_WEBHOOK_URL_ABA: z.string().url().optional(),

  // External APIs (opcional em dev)
  // Endurecido (Onda 9): confirmado em prod (164 chars, prefix sk-p...).
  OPENAI_API_KEY: isProd ? z.string().startsWith('sk-') : z.string().optional(),
  // Endurecido (Onda 9): confirmado em prod (36 chars, prefix re_).
  RESEND_API_KEY: isProd ? z.string().startsWith('re_') : z.string().optional(),
  // Resend — display names + admin email (opcionais; código tem fallbacks)
  RESEND_FROM: z.string().optional(),
  RESEND_FROM_TCC: z.string().optional(),
  RESEND_FROM_TDAH: z.string().optional(),
  RESEND_ADMIN_EMAIL: isProd ? z.string().email().optional() : z.string().optional(),

  // Cron (obrigatório em prod) + Internal (opcional, ver comentário abaixo)
  CRON_SECRET: isProd ? z.string().min(32) : z.string().default('dev-cron-secret-change-me'),
  // Cron secret antigo (durante rotação)
  CRON_SECRET_OLD: z.string().optional(),
  // Endurecido (Onda 9): confirmado em prod (26 chars). min(20) escolhido por chave real ter 26 chars.
  INTERNAL_API_KEY: isProd ? z.string().min(20) : z.string().optional(),

  // Hotmart (opcional em dev)
  // Endurecido (Onda 9): confirmado em prod (66 chars).
  HOTMART_HOTTOK: isProd ? z.string().min(8) : z.string().optional(),

  // Firebase Admin SDK (server-side, push notifications)
  FIREBASE_PRIVATE_KEY: isProd ? z.string().min(20) : z.string().optional(),
  FIREBASE_CLIENT_EMAIL: isProd ? z.string().email() : z.string().optional(),

  // Sentry (opcional)
  SENTRY_DSN: z.string().optional(),
  SENTRY_ORG: z.string().default('psiform'),
  SENTRY_PROJECT: z.string().default('axis-tcc'),

  // ASR
  ASR_SERVICE_URL: z.string().url().default('http://localhost:8000/v1/audio/transcriptions'),
  TRANSCRIPT_DIR: z.string().default('/var/lib/axis/transcripts'),
  // Diretório de uploads de áudio (server-side)
  AUDIO_UPLOAD_DIR: z.string().default('/var/lib/axis/audio'),

  // App URL
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  // Cache (opcional — fallback em memória se ausente)
  REDIS_URL: z.string().optional(),

  // Maintenance mode (F3 — middleware lê process.env DIRETO, não este snapshot; toggle exige restart PM2)
  MAINTENANCE_MODE: z.string().optional(),
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
