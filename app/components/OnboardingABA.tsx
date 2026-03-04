'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// =====================================================
// OnboardingABA — Overlay client-side (2 telas)
//
// Tela 1: Termo LGPD adaptado para profissionais de saúde
// Tela 2: Escolha — "Gerar Relatório" ou "Cadastrar Aprendiz"
//
// Checa /api/aba/onboarding/progress na montagem.
// Se já completou → não renderiza nada.
// Se não completou → overlay cobrindo tudo.
// Ao finalizar → chama setup API → redireciona.
// =====================================================

const LGPD_TERMS = `TERMO DE CONSENTIMENTO E RESPONSABILIDADE PROFISSIONAL

Ao utilizar o AXIS ABA, você, profissional responsável, declara estar ciente e de acordo com os seguintes termos:

1. NATUREZA DA PLATAFORMA
O AXIS ABA é uma ferramenta de organização e documentação clínica. Todas as decisões terapêuticas são de responsabilidade exclusiva do profissional responsável pelo caso. O sistema não substitui o julgamento clínico.

2. PROTEÇÃO DE DADOS (LGPD — Lei 13.709/2018)
Os dados inseridos na plataforma são tratados em conformidade com a Lei Geral de Proteção de Dados. Isso inclui:
• Dados de aprendizes/pacientes são armazenados com criptografia e acesso restrito
• O profissional é o controlador dos dados de seus pacientes
• O AXIS ABA atua como operador, tratando dados apenas conforme as instruções do profissional
• Dados podem ser exportados ou excluídos a qualquer momento mediante solicitação

3. SIGILO PROFISSIONAL
Os dados clínicos inseridos no sistema são acessíveis apenas ao profissional responsável e a quem ele conceder acesso (supervisores, equipe multidisciplinar). O sigilo profissional previsto nos códigos de ética das respectivas categorias permanece sob responsabilidade do profissional.

4. RELATÓRIOS E DOCUMENTAÇÃO
Os relatórios gerados pelo sistema são modelos-base que devem ser revisados e validados pelo profissional antes de envio a operadoras de saúde, famílias ou qualquer terceiro.

5. RESPONSABILIDADE
O profissional é responsável por:
• Verificar a veracidade dos dados inseridos
• Revisar e assinar os documentos gerados
• Obter consentimento dos responsáveis legais dos pacientes para uso do sistema
• Manter suas credenciais de acesso em segurança`

export default function OnboardingABA() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'show' | 'hidden'>('loading')
  const [step, setStep] = useState<1 | 2>(1)
  const [accepted, setAccepted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // ── Checar status na montagem ──
  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const res = await fetch('/api/aba/onboarding/progress')
        if (!res.ok) { setStatus('show'); return }
        const data = await res.json()
        if (!cancelled) {
          setStatus(data.completed ? 'hidden' : 'show')
        }
      } catch {
        // Se API falhar, mostrar onboarding (seguro)
        if (!cancelled) setStatus('show')
      }
    }
    check()
    return () => { cancelled = true }
  }, [])

  // ── Finalizar: marca onboarding + redireciona ──
  const handleComplete = async (destination: 'relatorio' | 'aprendiz') => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/aba/onboarding/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '', specialty: '' }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erro ao finalizar. Tente novamente.')
        setSaving(false)
        return
      }

      // Esconder overlay
      setStatus('hidden')

      // Redirecionar conforme escolha
      if (destination === 'relatorio') {
        router.push('/aba/relatorios?welcome=1')
      } else {
        router.push('/aba/aprendizes?welcome=1')
      }
      router.refresh() // Força re-render do layout server component
    } catch {
      setError('Erro de conexão. Verifique sua internet e tente novamente.')
      setSaving(false)
    }
  }

  // ── Não renderizar nada se já completou ou carregando ──
  if (status === 'hidden') return null
  if (status === 'loading') {
    return (
      <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">
          Preparando tudo pra você...
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg my-8">

        {/* ── Progress: 2 bolinhas ── */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
            step >= 1 ? 'bg-[#c46a50] scale-110' : 'bg-slate-200'
          }`} />
          <div className={`w-8 h-0.5 rounded-full transition-all duration-300 ${
            step >= 2 ? 'bg-[#c46a50]' : 'bg-slate-200'
          }`} />
          <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
            step >= 2 ? 'bg-[#c46a50] scale-110' : 'bg-slate-200'
          }`} />
        </div>

        {/* ══════════ TELA 1: Termo LGPD ══════════ */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-normal text-slate-800 mb-2">
                Bem-vindo ao AXIS ABA
              </h1>
              <p className="text-sm text-slate-500">
                Antes de começar, leia o termo abaixo com atenção.
              </p>
            </div>

            {/* Termo scrollável */}
            <div className="bg-slate-50 rounded-xl px-5 py-4 mb-6 max-h-[45vh] overflow-y-auto border border-slate-100">
              <pre className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap font-sans">
                {LGPD_TERMS}
              </pre>
            </div>

            {/* Checkbox */}
            <label className="flex items-start gap-3 cursor-pointer group mb-2">
              <input
                type="checkbox"
                checked={accepted}
                onChange={e => setAccepted(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-slate-300 text-[#c46a50] focus:ring-[#c46a50]/30 cursor-pointer"
              />
              <span className="text-sm text-slate-600 group-hover:text-slate-800 select-none">
                Li e aceito os termos de consentimento e responsabilidade profissional
              </span>
            </label>

            {/* Botão */}
            <button
              onClick={() => { if (accepted) setStep(2) }}
              disabled={!accepted}
              className={`w-full mt-6 px-6 py-3 text-sm font-medium rounded-xl shadow-sm transition-all active:scale-[0.98] ${
                accepted
                  ? 'bg-[#c46a50] text-white hover:bg-[#b35d45]'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              Confirmar e continuar
            </button>
          </div>
        )}

        {/* ══════════ TELA 2: Escolha ══════════ */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-normal text-slate-800 mb-2">
                Por onde quer começar?
              </h1>
              <p className="text-sm text-slate-500">
                Escolha uma opção. Você pode fazer as duas depois!
              </p>
            </div>

            <div className="space-y-4">
              {/* Opção 1: Relatório para Convênio */}
              <button
                onClick={() => handleComplete('relatorio')}
                disabled={saving}
                className="w-full text-left p-5 rounded-xl border-2 border-slate-100 hover:border-[#c46a50]/40 hover:bg-[#c46a50]/5 transition-all group disabled:opacity-50"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 mb-1">
                      Gerar Relatório para Convênio
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Monte um relatório de evolução com base no Motor CSO-ABA para enviar à operadora de saúde.
                    </p>
                  </div>
                </div>
              </button>

              {/* Opção 2: Cadastrar Aprendiz */}
              <button
                onClick={() => handleComplete('aprendiz')}
                disabled={saving}
                className="w-full text-left p-5 rounded-xl border-2 border-slate-100 hover:border-[#c46a50]/40 hover:bg-[#c46a50]/5 transition-all group disabled:opacity-50"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-100 transition-colors">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 mb-1">
                      Cadastrar Primeiro Aprendiz
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Comece cadastrando um aprendiz para registrar sessões e acompanhar a evolução.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {/* Erro */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            {/* Saving indicator */}
            {saving && (
              <div className="mt-4 text-center">
                <p className="text-sm text-slate-400 animate-pulse">Salvando...</p>
              </div>
            )}

            {/* Voltar */}
            <button
              onClick={() => setStep(1)}
              disabled={saving}
              className="w-full mt-6 px-4 py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              ← Voltar ao termo
            </button>
          </div>
        )}

        {/* Rodapé */}
        <p className="text-center text-[10px] text-slate-300 mt-4">
          {step} de 2
        </p>
      </div>
    </div>
  )
}
