'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// =====================================================
// OnboardingTCC — Overlay client-side (3 telas)
//
// Tela 1: Termo LGPD para psicólogos
// Tela 2: CPF + CRP obrigatórios
// Tela 3: Escolha — Clínica / Paciente / Ajuda
//
// Usa API /api/tcc/onboarding (GET/POST)
// Cor: #1e3a5f (azul TCC)
// =====================================================

const TCC_COLOR = '#1e3a5f'

const LGPD_TERMS = `TERMO DE CONSENTIMENTO E RESPONSABILIDADE PROFISSIONAL

Ao utilizar o AXIS TCC, você, psicólogo(a) responsável, declara estar ciente e de acordo com os seguintes termos:

1. NATUREZA DA PLATAFORMA
O AXIS TCC é uma ferramenta de organização e documentação clínica para Terapia Cognitivo-Comportamental. Todas as decisões terapêuticas são de responsabilidade exclusiva do psicólogo responsável pelo caso. O sistema não substitui o julgamento clínico.

2. PROTEÇÃO DE DADOS (LGPD — Lei 13.709/2018)
Os dados inseridos na plataforma são tratados em conformidade com a Lei Geral de Proteção de Dados. Isso inclui:
• Dados de pacientes são armazenados com criptografia e acesso restrito
• O profissional é o controlador dos dados de seus pacientes
• O AXIS TCC atua como operador, tratando dados apenas conforme as instruções do profissional
• Dados podem ser exportados ou excluídos a qualquer momento mediante solicitação

3. SIGILO PROFISSIONAL
Os dados clínicos inseridos no sistema são acessíveis apenas ao psicólogo responsável e a quem ele conceder acesso. O sigilo profissional previsto no Código de Ética do Psicólogo (CFP) permanece sob responsabilidade do profissional.

4. MOTOR CSO-TCC E INDICADORES
Os indicadores gerados pelo motor CSO-TCC são ferramentas de apoio à decisão clínica. Eles não constituem diagnóstico nem substituem avaliação profissional.

5. TRANSCRIÇÃO DE SESSÕES
O AXIS TCC oferece transcrição de áudio de sessões. O áudio é processado de forma segura e não é armazenado após a transcrição. O profissional é responsável por obter consentimento do paciente para gravação.

6. RELATÓRIOS E DOCUMENTAÇÃO
Os relatórios gerados pelo sistema são modelos-base que devem ser revisados e validados pelo profissional antes de envio a qualquer terceiro.

7. RESPONSABILIDADE
O profissional é responsável por:
• Verificar a veracidade dos dados inseridos
• Revisar e assinar os documentos gerados
• Obter consentimento dos pacientes para uso do sistema e gravação de sessões
• Manter suas credenciais de acesso em segurança`

function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

export default function OnboardingTCC() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'show' | 'hidden'>('loading')
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [accepted, setAccepted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // CPF/CRP
  const [cpf, setCpf] = useState('')
  const [crp, setCrp] = useState('')

  // Check progress
  useEffect(() => {
    let cancelled = false
    async function check() {
      if (document.cookie.includes('axis_tcc_onboarding_done=1')) {
        if (!cancelled) setStatus('hidden')
        return
      }
      try {
        const res = await fetch('/api/tcc/onboarding')
        if (!res.ok) {
          console.warn('[Onboarding TCC] API erro, assumindo completo')
          if (!cancelled) setStatus('hidden')
          return
        }
        const data = await res.json()
        if (!cancelled) {
          if (data.completed) {
            document.cookie = 'axis_tcc_onboarding_done=1; path=/; max-age=31536000; SameSite=Lax'
          }
          setStatus(data.completed ? 'hidden' : 'show')
          if (data.cpf) setCpf(formatCPF(data.cpf))
          if (data.crp) setCrp(data.crp)
        }
      } catch {
        console.warn('[Onboarding TCC] Falha de conexão, assumindo completo')
        if (!cancelled) setStatus('hidden')
      }
    }
    check()
    return () => { cancelled = true }
  }, [])

  const handleSaveCpfCrp = async () => {
    setSaving(true)
    setError('')

    const cpfClean = cpf.replace(/\D/g, '')
    if (cpfClean.length !== 11) {
      setError('CPF deve ter 11 dígitos')
      setSaving(false)
      return
    }
    if (!crp.trim()) {
      setError('CRP é obrigatório')
      setSaving(false)
      return
    }

    try {
      const res = await fetch('/api/tcc/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cpfClean, crp: crp.trim() }),
      })
      const data = await res.json()

      if (res.ok) {
        document.cookie = 'axis_tcc_onboarding_done=1; path=/; max-age=31536000; SameSite=Lax'
        setStep(3)
      } else {
        setError(data.error || 'Erro ao salvar')
      }
    } catch {
      setError('Erro de conexão')
    }
    setSaving(false)
  }

  const handleChoose = (destination: 'clinica' | 'paciente' | 'ajuda') => {
    setStatus('hidden')
    if (destination === 'clinica') {
      router.push('/configuracoes?welcome=1')
    } else if (destination === 'ajuda') {
      router.push('/ajuda?welcome=1')
    } else {
      router.push('/pacientes?welcome=1')
    }
    router.refresh()
  }

  if (status === 'hidden') return null
  if (status === 'loading') {
    return (
      <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">Preparando tudo pra você...</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg my-8">

        {/* Progress: 3 bolinhas */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full transition-all duration-300 ${step >= s ? 'scale-110' : 'bg-slate-200'}`}
                style={step >= s ? { backgroundColor: TCC_COLOR } : {}}
              />
              {s < 3 && (
                <div
                  className={`w-6 h-0.5 rounded-full transition-all duration-300 ${step > s ? '' : 'bg-slate-200'}`}
                  style={step > s ? { backgroundColor: TCC_COLOR } : {}}
                />
              )}
            </div>
          ))}
        </div>

        {/* ══════════ TELA 1: Termo LGPD ══════════ */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-normal text-slate-800 mb-2">Bem-vindo ao AXIS TCC</h1>
              <p className="text-sm text-slate-500">Antes de começar, leia o termo abaixo com atenção.</p>
            </div>

            <div className="bg-slate-50 rounded-xl px-5 py-4 mb-6 max-h-[45vh] overflow-y-auto border border-slate-100">
              <pre className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap font-sans">{LGPD_TERMS}</pre>
            </div>

            <label className="flex items-start gap-3 cursor-pointer group mb-2">
              <input
                type="checkbox" checked={accepted}
                onChange={e => setAccepted(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-slate-300 cursor-pointer"
                style={{ accentColor: TCC_COLOR }}
              />
              <span className="text-sm text-slate-600 group-hover:text-slate-800 select-none">
                Li e aceito os termos de consentimento e responsabilidade profissional
              </span>
            </label>

            <button
              onClick={() => { if (accepted) setStep(2) }}
              disabled={!accepted}
              className={`w-full mt-6 px-6 py-3 text-sm font-medium rounded-xl shadow-sm transition-all active:scale-[0.98] ${
                accepted ? 'text-white hover:opacity-90' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
              style={accepted ? { backgroundColor: TCC_COLOR } : {}}
            >
              Confirmar e continuar
            </button>
          </div>
        )}

        {/* ══════════ TELA 2: CPF + CRP ══════════ */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-normal text-slate-800 mb-2">Dados Profissionais</h1>
              <p className="text-sm text-slate-500">O AXIS TCC é de uso exclusivo para Psicólogos</p>
              <p className="text-xs text-slate-400 mt-2">O plano gratuito inclui 1 paciente e 120 minutos de transcrição por mês.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">CPF</label>
                <input
                  type="text"
                  value={cpf}
                  onChange={e => setCpf(formatCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#1e3a5f] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">CRP</label>
                <input
                  type="text"
                  value={crp}
                  onChange={e => setCrp(e.target.value)}
                  placeholder="Ex: 06/12345"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#1e3a5f] transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            <button
              onClick={handleSaveCpfCrp}
              disabled={saving || !cpf || !crp}
              className={`w-full mt-6 px-6 py-3 text-sm font-medium rounded-xl shadow-sm transition-all active:scale-[0.98] ${
                !saving && cpf && crp ? 'text-white hover:opacity-90' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
              style={!saving && cpf && crp ? { backgroundColor: TCC_COLOR } : {}}
            >
              {saving ? 'Salvando...' : 'Confirmar dados'}
            </button>

            <button onClick={() => setStep(1)} disabled={saving} className="w-full mt-3 px-4 py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors">
              ← Voltar ao termo
            </button>
          </div>
        )}

        {/* ══════════ TELA 3: Escolha ══════════ */}
        {step === 3 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-normal text-slate-800 mb-2">Por onde quer começar?</h1>
              <p className="text-sm text-slate-500">Escolha uma opção. Você pode fazer as outras depois!</p>
            </div>

            <div className="space-y-4">
              {/* Opção 1: Personalizar Clínica */}
              <button
                onClick={() => handleChoose('clinica')}
                className="w-full text-left p-5 rounded-xl border-2 border-slate-100 hover:bg-slate-50 transition-all group"
                onMouseEnter={e => (e.currentTarget.style.borderColor = `${TCC_COLOR}40`)}
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
                    <h3 className="text-sm font-semibold text-slate-800 mb-1">Personalizar sua Clínica</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">Defina o nome da sua clínica para aparecer nos relatórios e documentos.</p>
                  </div>
                </div>
              </button>

              {/* Opção 2: Cadastrar Paciente */}
              <button
                onClick={() => handleChoose('paciente')}
                className="w-full text-left p-5 rounded-xl border-2 border-slate-100 hover:bg-slate-50 transition-all group"
                onMouseEnter={e => (e.currentTarget.style.borderColor = `${TCC_COLOR}40`)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#f1f5f9')}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors" style={{ backgroundColor: `${TCC_COLOR}10` }}>
                    <svg className="w-5 h-5" style={{ color: TCC_COLOR }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 mb-1">Cadastrar Primeiro Paciente</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">Comece cadastrando um paciente para registrar sessões e acompanhar a evolução.</p>
                  </div>
                </div>
              </button>

              {/* Opção 3: Ver como funciona */}
              <button
                onClick={() => handleChoose('ajuda')}
                className="w-full text-left p-5 rounded-xl border-2 border-slate-100 hover:bg-slate-50 transition-all group"
                onMouseEnter={e => (e.currentTarget.style.borderColor = `${TCC_COLOR}40`)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#f1f5f9')}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 transition-colors">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 mb-1">Ver como funciona</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">Conheça o sistema passo a passo com ajuda da Ana, sua assistente virtual.</p>
                  </div>
                </div>
              </button>
            </div>

            <button onClick={() => setStep(2)} className="w-full mt-6 px-4 py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors">
              ← Voltar
            </button>
          </div>
        )}

        <p className="text-center text-[10px] text-slate-300 mt-4">{step} de 3</p>
      </div>
    </div>
  )
}
