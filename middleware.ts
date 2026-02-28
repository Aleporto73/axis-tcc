import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/ativar-lembretes',
  // APIs internas - liberadas para desenvolvimento
  '/api/push/(.*)',
  '/api/cron/(.*)',
  '/api/patient/(.*)',
  '/api/sessions/(.*)/finish',
  // Google OAuth callback e webhook
  '/api/google/callback',
  '/api/google/webhook',
  // Hotmart webhook (postback — autenticado via hottok, não via Clerk)
  '/api/webhook/hotmart',
  // Páginas de produto (landing pages públicas)
  '/produto(.*)',
  // Demo público
  '/demo(.*)',
  '/api/demo/(.*)',
  '/portal/(.*)',
  '/api/portal/(.*)',
])
export default clerkMiddleware(async (auth, req) => {
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
