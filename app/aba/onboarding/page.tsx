import { redirect } from 'next/navigation'

// =====================================================
// /aba/onboarding → Redireciona para /aba/dashboard
//
// O onboarding agora é um overlay client-side (OnboardingABA)
// renderizado no layout. Esta page só existe para não dar 404
// se alguém tiver o link antigo bookmarkado.
// =====================================================

export default function OnboardingRedirect() {
  redirect('/aba/dashboard')
}
