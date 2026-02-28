import type { Metadata } from 'next'

// =====================================================
// SEO — Landing Page AXIS ABA
// Title: 50-60 chars, keyword no início
// Description: 150-160 chars com CTA
// OG completo + Canonical
// =====================================================

const title = 'Sistema ABA para Clínicas — Protocolos e Relatórios | AXIS'
const description =
  'Gestão de protocolos ABA, cálculo evolutivo CSO-ABA, generalização 3×2, manutenção e relatórios institucionais. Comece grátis com 1 aprendiz.'

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'sistema ABA',
    'software ABA',
    'análise do comportamento aplicada',
    'gestão clínica ABA',
    'registro de sessão ABA',
    'relatório ABA convênio',
    'protocolo ABA',
    'software clínica ABA',
    'prontuário ABA',
    'AXIS ABA',
    'terapia ABA sistema',
  ],
  alternates: {
    canonical: 'https://axisclinico.com/produto/aba',
  },
  openGraph: {
    title,
    description,
    url: 'https://axisclinico.com/produto/aba',
    siteName: 'AXIS Clínico',
    locale: 'pt_BR',
    type: 'website',
    images: [
      {
        url: 'https://axisclinico.com/axisaba.png',
        width: 1200,
        height: 630,
        alt: 'AXIS ABA — Sistema de gestão clínica para Análise do Comportamento Aplicada',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['https://axisclinico.com/axisaba.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function ProdutoABALayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
