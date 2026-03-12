'use client'

import Link from 'next/link'

export default function ObrigadoPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="bg-tcc-700 px-6 py-8">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white">Compra confirmada!</h1>
            <p className="text-white/80 text-sm mt-1">Bem-vindo ao AXIS</p>
          </div>

          {/* Conteúdo */}
          <div className="px-6 py-8 space-y-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3 text-left">
                <div className="w-7 h-7 rounded-full bg-tcc-700/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-tcc-700 text-xs font-bold">1</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Verifique seu email</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enviamos as instruções de acesso para o email da sua compra.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-left">
                <div className="w-7 h-7 rounded-full bg-tcc-700/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-tcc-700 text-xs font-bold">2</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Acesse sua conta</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Já usa o AXIS? Clique no botão abaixo. Primeira vez? Verifique seu email e aceite o convite.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-left">
                <div className="w-7 h-7 rounded-full bg-tcc-700/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-tcc-700 text-xs font-bold">3</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Comece a usar</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Seu plano já está ativo. Cadastre pacientes e comece suas sessões.
                  </p>
                </div>
              </div>
            </div>

            <Link
              href="/hub"
              className="inline-flex items-center justify-center w-full px-6 py-3 bg-tcc-700 text-white text-sm font-medium rounded-lg hover:bg-tcc-600 transition-colors"
            >
              Acessar AXIS
            </Link>

            <p className="text-[11px] text-slate-400">
              Dúvidas? Entre em contato pelo email <a href="mailto:contato@psiform.com.br" className="text-tcc-700 hover:underline">contato@psiform.com.br</a>
            </p>
          </div>
        </div>

        <p className="text-[10px] text-slate-300 mt-6">AXIS · Psiform Tecnologia · axisclinico.com</p>
      </div>
    </div>
  )
}
