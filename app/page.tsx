'use client'

import { SignedIn, SignedOut } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Brain, ClipboardList, ArrowRight } from 'lucide-react'

/* ═══════════════════════ LANDING INSTITUCIONAL AXIS ═══════════════════════ */

export default function Home() {
  return (
    <>
      <SignedIn>
        <RedirectToHub />
      </SignedIn>

      <SignedOut>
        <div className="min-h-screen bg-white text-slate-800 flex flex-col">
          {/* ─── HEADER ─── */}
          <header className="border-b border-slate-100 bg-white/80 backdrop-blur-sm">
            <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2">
                <Image src="/axis.png" alt="AXIS" width={100} height={32} className="h-8 w-auto" priority />
              </Link>
              <Link
                href="/sign-in"
                className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
              >
                Entrar
              </Link>
            </div>
          </header>

          {/* ─── HERO ─── */}
          <section className="flex-1 flex items-center">
            <div className="max-w-4xl mx-auto px-6 py-20 md:py-32 text-center w-full">
              <h1 className="text-3xl md:text-5xl font-bold text-slate-900 leading-tight">
                Plataforma clínica para profissionais de saúde mental
              </h1>
              <p className="mt-6 text-lg md:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
                Organização, governança e documentação estruturada para sua prática.
              </p>

              {/* ─── Cards dos produtos ─── */}
              <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                {/* Card TCC */}
                <div className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all p-8 text-left flex flex-col">
                  <div className="w-12 h-12 rounded-2xl bg-pink-50 flex items-center justify-center mb-5">
                    <Brain className="w-6 h-6 text-pink-500" />
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900">AXIS TCC</h2>
                  <p className="mt-2 text-sm text-slate-500 leading-relaxed flex-1">
                    Sistema para Terapia Cognitivo-Comportamental
                  </p>
                  <Link
                    href="#"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-400 group-hover:text-pink-500 transition-colors"
                  >
                    Conhecer
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>

                {/* Card ABA */}
                <div className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-[#c46a50]/40 transition-all p-8 text-left flex flex-col">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: '#f5ebe7' }}>
                    <ClipboardList className="w-6 h-6" style={{ color: '#c46a50' }} />
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900">AXIS ABA</h2>
                  <p className="mt-2 text-sm text-slate-500 leading-relaxed flex-1">
                    Sistema para Análise do Comportamento Aplicada
                  </p>
                  <Link
                    href="/produto/aba"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-400 group-hover:text-[#c46a50] transition-colors"
                  >
                    Conhecer
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </section>

          {/* ─── FOOTER ─── */}
          <footer className="border-t border-slate-100 bg-white py-6">
            <div className="max-w-5xl mx-auto px-6 text-center">
              <p className="text-sm text-slate-400">
                © 2026 AXIS. Psiform Tecnologia.
              </p>
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-400 mx-auto mb-4" aria-label="Carregando"></div>
        <p className="text-base text-slate-500">Carregando...</p>
      </div>
    </div>
  )
}
