import { ClerkProvider } from '@clerk/nextjs'
import { ptBR } from '@clerk/localizations'
import './styles/globals.css'
import type { Metadata } from 'next'
import PushNotificationSetup from './components/PushNotificationSetup'
import { Onboarding } from './components/Onboarding'

const title = 'AXIS Clínico — Sistema para Psicólogos e Clínicas ABA | Psiform'
const description =
  'Plataforma clínica para psicólogos TCC e clínicas ABA. Registro estruturado de sessões, relatórios para convênio e monitoramento evolutivo. Comece grátis.'

export const metadata: Metadata = {
  title: {
    default: title,
    template: '%s | AXIS Clínico',
  },
  description,
  keywords: [
    'sistema clínico psicologia',
    'software para psicólogo',
    'sistema TCC',
    'sistema ABA',
    'relatório para convênio',
    'documentação clínica',
    'prontuário eletrônico psicologia',
    'gestão clínica saúde mental',
    'AXIS Clínico',
    'Psiform',
  ],
  metadataBase: new URL('https://axisclinico.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title,
    description,
    url: 'https://axisclinico.com',
    siteName: 'AXIS Clínico',
    locale: 'pt_BR',
    type: 'website',
    images: [
      {
        url: '/axis.png',
        width: 1200,
        height: 630,
        alt: 'AXIS — Plataforma clínica para profissionais de saúde mental',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/axis.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider localization={ptBR}>
      <html lang="pt-BR">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
          <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;1,6..72,300;1,6..72,400&display=swap" rel="stylesheet" />
        </head>
        <body className="font-sans antialiased min-h-screen flex flex-col">
          <main className="flex-1">
            {children}
          </main>
          <footer className="bg-slate-50 border-t border-slate-200 py-3 px-4">
            <p className="text-xs text-slate-500 text-center max-w-4xl mx-auto">
              Este sistema é uma ferramenta de apoio e organização. Não substitui o julgamento clínico do profissional. 
              Todas as decisões terapêuticas são de responsabilidade exclusiva do psicólogo responsável.
            </p>
          </footer>
          <Onboarding />
          <PushNotificationSetup />
        </body>
      </html>
    </ClerkProvider>
  )
}
