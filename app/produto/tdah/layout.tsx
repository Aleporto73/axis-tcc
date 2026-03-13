import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import pool from '@/src/database/db'

// =====================================================
// SEO — Landing Page AXIS TDAH
//
// Se o usuário está logado E tem licença TDAH ativa,
// redireciona direto para /tdah/dashboard.
// =====================================================

const title = 'Sistema TDAH para Clínicas — Protocolos, DRC e Motor CSO | AXIS'
const description =
  'Gestão de intervenção comportamental TDAH com sessões tricontextuais, Daily Report Card escolar, Layer AuDHD e motor CSO-TDAH. Comece grátis com 1 paciente.'

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    'sistema TDAH',
    'software TDAH',
    'intervenção comportamental TDAH',
    'gestão clínica TDAH',
    'DRC Daily Report Card',
    'relatório TDAH escola',
    'protocolo TDAH',
    'AuDHD layer',
    'AXIS TDAH',
    'terapia TDAH sistema',
    'tricontextual TDAH',
  ],
  alternates: {
    canonical: 'https://axisclinico.com/produto/tdah',
  },
  openGraph: {
    title,
    description,
    url: 'https://axisclinico.com/produto/tdah',
    siteName: 'AXIS Clínico',
    locale: 'pt_BR',
    type: 'website',
    images: [
      {
        url: 'https://axisclinico.com/axisTDAH.png',
        width: 1200,
        height: 630,
        alt: 'AXIS TDAH — Sistema de gestão clínica para intervenção comportamental em TDAH',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['https://axisclinico.com/axisTDAH.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default async function ProdutoTDAHLayout({ children }: { children: React.ReactNode }) {
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
            [tenantId, 'tdah']
          )
          if (licResult.rows.length > 0) {
            redirect('/tdah/dashboard')
          }
        } catch {
          // Tabela pode não existir — não redirecionar
        }
      }
    }
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_REDIRECT')) throw err
  }

  return <>{children}</>
}
