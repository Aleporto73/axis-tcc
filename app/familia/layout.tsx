import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AXIS TDAH — Portal da Família',
  description: 'Portal de acompanhamento para responsáveis',
  robots: 'noindex, nofollow',
}

export default function FamiliaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
