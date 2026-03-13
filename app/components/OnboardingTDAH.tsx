'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// =====================================================
// OnboardingTDAH — Overlay client-side (2 telas)
//
// Tela 1: Termo LGPD adaptado para profissionais de saúde
// Tela 2: Escolha — "Personalizar Clínica" ou "Cadastrar Paciente"
//
// Reutiliza APIs /api/aba/onboarding (profiles compartilhados)
// Cor: #0d7377 (TDAH green-teal)
// =====================================================

const TDAH_COLOR = '#0d7377'

const LGPD_TERMS = `TERMO DE CONSENTIMENTO E RESPONSABILIDADE PROFISSIONAL

Ao utilizar o AXIS TDAH, você, profissional responsável, declara estar ciente e de acordo com os seguintes termos:

1. NATUREZA DA PLATAFORMA
O AXIS TDAH é uma ferramenta de organização e documentação clínica para acompanhamento tricontextual (clínico, domiciliar e escolar) de pacientes com TDAH. Todas as decisões terapêuticas são de responsabilidade exclusiva do profissional responsável pelo caso. O sistema não substitui o julgamento clínico.

2. PROTEÇÃO DE DADOS (LGPD — Lei 13.709/2018)
Os dados inseridos na plataforma são tratados em conformidade com a Lei Geral de Proteção de Dados. Isso inclui:
• Dados de pacientes são armazenados com criptografia e acesso restrito
• O profissional é o controlador dos dados de seus pacientes
• O AXIS TDAH atua como operador, tratando dados apenas conforme as instruções do profissional
• Dados podem ser exportados ou excluídos a qualquer momento mediante solicitação

3. SIGILO PROFISSIONAL
Os dados clínicos inseridos no sistema são acessíveis apenas ao profissional responsável e a quem ele conceder acesso (supervisores, equipe multidisciplinar). O sigilo profissional previsto nos códigos de ética das respectivas categorias permanece sob responsabilidade do profissional.

4. MOTOR CSO-TDAH E SCORES
Os scores gerados pelo motor CSO-TDAH são indicadores de apoio à decisão clínica. Eles não constituem diagnóstico nem substituem avaliação profissional. Nunca devem ser compartilhados com famílias sem contexto clínico adequado.

5. RELATÓRIOS E DOCUMENTAÇÃO
Os relatórios gerados pelo sistema são modelos-base que devem ser revisados e validados pelo profissional antes de envio a famílias, escolas ou qualquer terceiro.

6. RESPONSABILIDADE
O profissional é responsável por:
• Verificar a veracidade dos dados inseridos
• Revisar e assinar os documentos gerados
• Obter consentimento dos responsáveis legais dos pacientes para uso do sistema
• Manter suas credenciais de acesso em segurança`

export default function OnboardingTDAH() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'show' | 'hidden'>('loading')
  const [step, setStep] = useState<1 | 2>(1)
  const [accepted, setAccepted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function check() {
      if (document.cookie.includes('axis_onboarding_done=1')) {
        if (!cancelled) setStatus('hidden')
        return
      }
      try {
        const res = await fetch('/api/aba/onboarding/progress')
        if (!res.ok) {
          console.warn('[Onboarding TDAH] API retornou erro, assumindo completo')
          if (!cancelled) setStatus('hidden')
          return
        }
        const data = await res.json()
        if (!cancelled) {
          if (data.completed) {
            document.cookie = 'axis_onboarding_done=1; path=/; max-age=31536000; SameSite=Lax'
          }
          setStatus(data.completed ? 'hidden' : 'show')
        }
      } catch {
        console.warn('[Onboarding TDAH] Falha de conexão, assumindo completo')
        if (!cancelled) setStatus('hidden')
      }
    }
    check()
    return () => { cancelled = true }
  }, [])

  const handleComplete = async (destination: 'clinica' | 'paciente') => {
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

      document.cookie = 'axis_onboarding_done=1; path=/; max-age=31536000; SameSite=Lax'
      setStatus('hidden')

      if (destination === 'clinica') {
        router.push('/tdah/configuracoes?welcome=1')
      } else {
        router.push('/tdah/pacientes?welcome=1')
      }
      router.refresh()
    } catch {
      setError('Erro de conexão. Verifique sua internet e tente novamente.')
      setSaving(false)
    }
  }

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

        {/* Progress: 2 bolinhas */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
            step >= 1 ? 'scale-110' : 'bg-slate-200'
          }`} style={step >= 1 ? { backgroundColor: TDAH_COLOR } : {}} />
          <div className={`w-8 h-0.5 rounded-full transition-all duration-300 ${
            step >= 2 ? '' : 'bg-slate-200'
          }`} style={step >= 2 ? { backgroundColor: TDAH_COLOR } : {}} />
          <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
            step >= 2 ? 'scale-110' : 'bg-slate-200'
          }`} style={step >= 2 ? { backgroundColor: TDAH_COLOR } : {}} />
        </div>

        {/* TELA 1: Termo LGPD */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-normal text-slate-800 mb-2">
                Bem-vindo ao AXIS TDAH
              </h1>
              <p className="text-sm text-slate-500">
                Antes de começar, leia o termo abaixo com atenção.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl px-5 py-4 mb-6 max-h-[45vh] overflow-y-auto border border-slate-100">
              <pre className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap font-sans">
                {LGPD_TERMS}
              </pre>
            </div>

            <label className="flex items-start gap-3 cursor-pointer group mb-2">
              <input
                type="checkbox"
                checked={accepted}
                onChange={e => setAccepted(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-slate-300 cursor-pointer"
                style={{ accentColor: TDAH_COLOR }}
              />
              <span className="text-sm text-slate-600 group-hover:text-slate-800 select-none">
                Li e aceito os termos de consentimento e responsabilidade profissional
              </span>
            </label>

            <button
              onClick={() => { if (accepted) setStep(2) }}
              disabled={!accepted}
              className={`w-full mt-6 px-6 py-3 text-sm font-medium rounded-xl shadow-sm transition-all active:scale-[0.98] ${
                accepted
                  ? 'text-white hover:opacity-90'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
              style={accepted ? { backgroundColor: TDAH_COLOR } : {}}
            >
              Confirmar e continuar
            </button>
          </div>
        )}

        {/* TELA 2: Escolha */}
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
              {/* Opção 1: Personalizar Clínica */}
              <button
                onClick={() => handleComplete('clinica')}
                disabled={saving}
                className="w-full text-left p-5 rounded-xl border-2 border-slate-100 hover:bg-slate-50 transition-all group disabled:opacity-50"
                style={{ borderColor: undefined }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = `${TDAH_COLOR}40`)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#f1f5f9')}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 mb-1">
                      Personalizar sua Clínica
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Defina o nome da sua clínica para aparecer nos relatórios e documentos.
                    </p>
                  </div>
                </div>
              </button>

              {/* Opção 2: Cadastrar Paciente */}
              <button
                onClick={() => handleComplete('paciente')}
                disabled={saving}
                className="w-full text-left p-5 rounded-xl border-2 border-slate-100 hover:bg-slate-50 transition-all group disabled:opacity-50"
                onMouseEnter={e => (e.currentTarget.style.borderColor = `${TDAH_COLOR}40`)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#f1f5f9')}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors" style={{ backgroundColor: `${TDAH_COLOR}10` }}>
                    <svg className="w-5 h-5" style={{ color: TDAH_COLOR }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 mb-1">
                      Cadastrar Primeiro Paciente
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Comece cadastrando um paciente para agendar sessões tricontextuais e acompanhar a evolução.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            {saving && (
              <div className="mt-4 text-center">
                <p className="text-sm text-slate-400 animate-pulse">Salvando...</p>
              </div>
            )}

            <button
              onClick={() => setStep(1)}
              disabled={saving}
              className="w-full mt-6 px-4 py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              ← Voltar ao termo
            </button>
          </div>
        )}

        <p className="text-center text-[10px] text-slate-300 mt-4">
          {step} de 2
        </p>
      </div>
    </div>
  )
}
