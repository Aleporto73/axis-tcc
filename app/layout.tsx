import { ClerkProvider } from '@clerk/nextjs'
import { ptBR } from '@clerk/localizations'
import './styles/globals.css'
import type { Metadata } from 'next'
import PushNotificationSetup from './components/PushNotificationSetup'
import { Onboarding } from './components/Onboarding'

export const metadata: Metadata = {
  title: 'AXIS TCC - Sistema de Apoio Clínico',
  description: 'Sistema inteligente de apoio à prática clínica TCC',
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
