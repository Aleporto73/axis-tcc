'use client'

import { SignInButton, SignedIn, SignedOut } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Home() {
  return (
    <>
      <SignedIn>
        <RedirectToHub />
      </SignedIn>
      
      <SignedOut>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-neutral-50 flex flex-col">
          <header className="border-b border-neutral-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-2xl" aria-hidden="true">⚕️</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-blue-600">
                    AXI Clínico
                  </h1>
                  <p className="text-xs text-neutral-500 uppercase tracking-wider">
                    Padrão Ouro em Prática Clínica Digital
                  </p>
                </div>
              </div>
              
              <SignInButton mode="modal">
                <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 text-base font-medium shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 focus-visible:ring-offset-4 min-h-[48px]">
                  Entrar no Sistema
                </button>
              </SignInButton>
            </div>
          </header>

          <main className="flex-1 flex items-center">
            <div className="max-w-7xl mx-auto px-6 py-20">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-full text-sm font-medium mb-6">
                  <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
                  Sistema Validado Clinicamente
                </div>

                <h1 className="text-5xl text-neutral-900 font-bold mb-6 leading-tight">
                  Ecossistema Inteligente para{' '}
                  <span className="text-blue-600">
                    Prática Clínica Digital
                  </span>
                </h1>

                <p className="text-xl text-neutral-600 mb-8 leading-relaxed font-normal">
                  AXI Clínico é a plataforma modular que organiza sua prática com{' '}
                  <strong className="text-neutral-900 font-semibold">
                    governança clínica, rastreabilidade científica e IA ética
                  </strong>.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                  <div className="flex items-start gap-3 bg-white p-4 rounded-lg shadow-sm border border-neutral-100">
                    <span className="text-2xl" aria-hidden="true">🧠</span>
                    <div>
                      <h3 className="text-base font-semibold text-neutral-900 mb-1">
                        AXIS TCC
                      </h3>
                      <p className="text-sm text-neutral-600">
                        Terapia Cognitivo-Comportamental
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-white p-4 rounded-lg shadow-sm border border-neutral-100">
                    <span className="text-2xl" aria-hidden="true">🧩</span>
                    <div>
                      <h3 className="text-base font-semibold text-neutral-900 mb-1">
                        AXIS ABA
                      </h3>
                      <p className="text-sm text-neutral-600">
                        Análise do Comportamento Aplicada
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-white p-4 rounded-lg shadow-sm border border-neutral-100">
                    <span className="text-2xl" aria-hidden="true">✓</span>
                    <div>
                      <h3 className="text-base font-semibold text-neutral-900 mb-1">
                        IA Clínica Ética
                      </h3>
                      <p className="text-sm text-neutral-600">
                        A IA calcula, o humano decide
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-white p-4 rounded-lg shadow-sm border border-neutral-100">
                    <span className="text-2xl" aria-hidden="true">🔒</span>
                    <div>
                      <h3 className="text-base font-semibold text-neutral-900 mb-1">
                        Multi-Tenant Seguro
                      </h3>
                      <p className="text-sm text-neutral-600">
                        Isolamento total de dados clínicos
                      </p>
                    </div>
                  </div>
                </div>

                <SignInButton mode="modal">
                  <button className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-all duration-200 text-lg font-medium shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 focus-visible:ring-offset-4">
                    Acessar Sistema →
                  </button>
                </SignInButton>

                <p className="text-sm text-neutral-500 italic mt-6">
                  Medical Device Class I Software • Validação Clínica Ativa
                </p>
              </div>
            </div>
          </main>

          <footer className="border-t border-neutral-200 bg-white">
            <div className="max-w-7xl mx-auto px-6 py-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-neutral-600">
                  © 2026 AXI Clínico. Plataforma Clínica Profissional.
                </p>
                <p className="text-xs text-neutral-500 uppercase tracking-wider">
                  Enterprise Healthcare Grade
                </p>
              </div>
            </div>
          </footer>
        </div>
      </SignedOut>
    </>
  )
}

function RedirectToHub() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/hub')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" aria-label="Carregando"></div>
        <p className="text-base text-neutral-600">
          Carregando módulos...
        </p>
      </div>
    </div>
  )
}
