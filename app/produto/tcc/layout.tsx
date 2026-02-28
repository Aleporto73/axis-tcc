import type { Metadata } from 'next'

// =====================================================
// SEO — Landing Page AXIS TCC
// Title: 50-60 chars, keyword no início
// Description: 150-160 chars com CTA
// OG completo + Canonical
// =====================================================

const title = 'Sistema TCC para Psicólogos — Registro e Relatório | AXIS'
const description =
  'Registro estruturado de sessões TCC, conceitualização cognitiva, monitoramento evolutivo e relatórios para convênio. Comece grátis com 1 paciente.'

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'sistema TCC',
    'software psicologia',
    'terapia cognitivo-comportamental',
    'registro de sessão TCC',
    'relatório para convênio',
    'conceitualização cognitiva',
    'software clínico psicologia',
    'prontuário eletrônico psicólogo',
    'AXIS TCC',
    'gestão clínica TCC',
  ],
  alternates: {
    canonical: 'https://axisclinico.com/produto/tcc',
  },
  openGraph: {
    title,
    description,
    url: 'https://axisclinico.com/produto/tcc',
    siteName: 'AXIS Clínico',
    locale: 'pt_BR',
    type: 'website',
    images: [
      {
        url: 'https://axisclinico.com/axistcc.png',
        width: 1200,
        height: 630,
        alt: 'AXIS TCC — Sistema de apoio clínico para Terapia Cognitivo-Comportamental',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['https://axisclinico.com/axistcc.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function ProdutoTCCLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
