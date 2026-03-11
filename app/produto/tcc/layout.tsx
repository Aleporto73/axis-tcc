import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import pool from '@/src/database/db'

// =====================================================
// SEO — Landing Page AXIS TCC
//
// Se o usuário está logado E tem licença TCC ativa,
// redireciona direto para /dashboard (não mostra
// página de vendas para quem já é cliente).
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

export default async function ProdutoTCCLayout({ children }: { children: React.ReactNode }) {
  // Se logado e tem licença TCC → vai direto pro dashboard
  try {
    const { userId } = await auth()

    if (userId) {
      const profileResult = await pool.query(
        'SELECT tenant_id FROM profiles WHERE clerk_user_id = $1 AND is_active = true LIMIT 1',
        [userId]
      )

      const tenantId = profileResult.rows[0]?.tenant_id

      if (tenantId) {
        try {
          const licResult = await pool.query(
            'SELECT is_active FROM user_licenses WHERE tenant_id = $1 AND product_type = $2 AND is_active = true LIMIT 1',
            [tenantId, 'tcc']
          )
          if (licResult.rows.length > 0) {
            redirect('/dashboard')
          }
        } catch {
          // Tabela pode não existir — não redirecionar
        }
      }
    }
  } catch (err: any) {
    // Se redirect() foi chamado, ele faz throw — não capturar
    if (err?.digest?.startsWith('NEXT_REDIRECT')) throw err
    // Auth falhou ou DB falhou — não redirecionar, mostrar landing
  }

  return <>{children}</>
}
