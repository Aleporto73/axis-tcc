import { Metadata } from 'next'

// =====================================================
// Layout para Portal do Professor — SEM Clerk auth
// Rota pública: /escola/[token]
// Bible §14: Perfil professor (acesso simplificado)
// =====================================================

export const metadata: Metadata = {
  title: 'AXIS TDAH — Portal do Professor',
  description: 'Portal de registro DRC para professores',
  robots: 'noindex, nofollow',
}

export default function EscolaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
