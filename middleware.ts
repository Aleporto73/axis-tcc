import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
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
})
export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
