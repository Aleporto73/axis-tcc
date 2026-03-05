import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import pool from '@/src/database/db'

// =====================================================
// SEO — Landing Page AXIS ABA
//
// Se o usuário está logado E tem licença ABA ativa,
// redireciona direto para /aba/dashboard (não mostra
// página de vendas para quem já é cliente).
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

export default async function ProdutoABALayout({ children }: { children: React.ReactNode }) {
  // Se logado e tem licença ABA → vai direto pro dashboard
  try {
    const { userId } = await auth()

    if (userId) {
      // Buscar tenant via profiles
      const profileResult = await pool.query(
        'SELECT tenant_id FROM profiles WHERE clerk_user_id = $1 AND is_active = true LIMIT 1',
        [userId]
      )

      const tenantId = profileResult.rows[0]?.tenant_id

      if (tenantId) {
        // Verificar licença ABA ativa
        try {
          const licResult = await pool.query(
            'SELECT is_active FROM user_licenses WHERE tenant_id = $1 AND product_type = $2 AND is_active = true LIMIT 1',
            [tenantId, 'aba']
          )
          if (licResult.rows.length > 0) {
            redirect('/aba/dashboard')
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
