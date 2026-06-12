import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/ativar-lembretes',
  // Health check (público, sem auth)
  '/api/health',
  // Sentry tunnelRoute (configurado em next.config.ts) - rota de proxy ingest sem Clerk auth
  '/monitoring(.*)',
  // APIs com auth interna (Clerk via withTenant, CRON_SECRET, ou push_auth_token)
  '/api/push/(.*)',
  '/api/cron/(.*)',
  '/api/patient/(.*)',
  // Google OAuth callback e webhook
  '/api/google/callback',
  '/api/google/webhook',
  // Hotmart webhook (postback — autenticado via hottok, não via Clerk)
  '/api/webhook/hotmart',
  // Clerk webhook (autenticado via Svix signature, não via Clerk auth)
  '/api/webhook/clerk',
  // Página de obrigado pós-compra
  '/obrigado',
  // Páginas de produto (landing pages públicas)
  '/produto(.*)',
  // Páginas legais
  '/termos',
  '/privacidade',
  // Demo público
  '/demo(.*)',
  '/api/demo/(.*)',
  '/portal/(.*)',
  '/api/portal/(.*)',
  // Portal do professor (TDAH escola — acesso via token, sem Clerk)
  '/escola(.*)',
  '/api/escola/(.*)',
  // Portal da família (TDAH — acesso via token, sem Clerk)
  '/familia(.*)',
  '/api/familia/(.*)',
  // Página de manutenção (estática, sem auth — ver gate MAINTENANCE_MODE abaixo)
  '/manutencao',
])
export default clerkMiddleware(async (auth, req: NextRequest) => {
  // ── MAINTENANCE_MODE (F3 — janela de rotação de segredos) ──
  // Lê process.env DIRETO (não via env.ts — snapshot estático no module load).
  // Toggle: setar MAINTENANCE_MODE=true no .env + restart PM2; remover + restart para desativar.
  // Allowlist: /api/health (monitoramento) e /manutencao (a própria página).
  // Assets estáticos já estão fora do matcher (config abaixo).
  if (process.env.MAINTENANCE_MODE === 'true') {
    const { pathname } = req.nextUrl
    const isMaintenanceAllowed = pathname === '/api/health' || pathname === '/manutencao'
    if (!isMaintenanceAllowed) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Em manutenção' }, { status: 503 })
      }
      return NextResponse.rewrite(new URL('/manutencao', req.url))
    }
  }

  if (!isPublicRoute(req)) {
    await auth.protect()
  }

  // Injetar pathname nos headers para uso em server components (layouts)
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-pathname', req.nextUrl.pathname)

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
})
export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
