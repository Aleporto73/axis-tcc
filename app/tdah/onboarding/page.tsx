import { redirect } from 'next/navigation'

// =====================================================
// /tdah/onboarding → Redireciona para /tdah/dashboard
//
// O onboarding é um overlay client-side (OnboardingTDAH)
// renderizado no layout. Esta page só existe para não dar 404.
// =====================================================

export default function OnboardingRedirect() {
  redirect('/tdah/dashboard')
}
