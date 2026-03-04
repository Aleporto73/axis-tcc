'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// =====================================================
// Onboarding Light — 2 etapas, tom acolhedor
//
// Etapa 1: Boas-vindas (nome + área)
// Etapa 2: Termos simplificados + aceite
//
// Após concluir: salva profile, marca onboarding_completed_at,
// redireciona para /aba/dashboard com toast de boas-vindas.
// =====================================================

const AREAS = [
  { value: '', label: 'Selecione (opcional)' },
  { value: 'ABA', label: 'ABA — Análise do Comportamento' },
  { value: 'Psicologia', label: 'Psicologia' },
  { value: 'Fono', label: 'Fonoaudiologia' },
  { value: 'TO', label: 'Terapia Ocupacional' },
  { value: 'Outro', label: 'Outro' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Etapa 1
  const [name, setName] = useState('')
  const [area, setArea] = useState('')

  // Etapa 2
  const [accepted, setAccepted] = useState(false)

  // ── Verificar se já completou onboarding ──
  useEffect(() => {
    async function checkProgress() {
      try {
        const res = await fetch('/api/aba/onboarding/progress')
        if (!res.ok) { setLoading(false); return }
        const data = await res.json()
        if (data.completed) { router.push('/aba/dashboard'); return }
        // Preencher nome se já existir no profile
        if (data.profile?.name) setName(data.profile.name)
        if (data.profile?.specialty) setArea(data.profile.specialty)
      } catch { /* primeiro acesso */ }
      setLoading(false)
    }
    checkProgress()
  }, [router])

  // ── Finalizar onboarding ──
  const handleFinish = async () => {
    if (!accepted) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/aba/onboarding/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          specialty: area,
          // Campos mínimos para manter compatibilidade com o backend
          clinic: { clinic_name: '' },
          rt: { name: name.trim(), crp: '', crp_uf: '', specialty: area },
          team_invites: [],
          plan_tier: 'free',
          compliance_items: [],
          selected_protocol_ids: [],
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erro ao finalizar. Tente novamente.')
        setSaving(false)
        return
      }

      // Redirecionar com flag de toast
      router.push('/aba/dashboard?welcome=1')
    } catch {
      setError('Erro de conexão. Verifique sua internet e tente novamente.')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">Preparando tudo pra você...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* ── Progress: 2 bolinhas ── */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
            step >= 0 ? 'bg-[#c46a50] scale-110' : 'bg-slate-200'
          }`} />
          <div className={`w-8 h-0.5 rounded-full transition-all duration-300 ${
            step >= 1 ? 'bg-[#c46a50]' : 'bg-slate-200'
          }`} />
          <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
            step >= 1 ? 'bg-[#c46a50] scale-110' : 'bg-slate-200'
          }`} />
        </div>

        {/* ── Card único ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10">

          {/* ════════════ ETAPA 1: Boas-vindas ════════════ */}
          {step === 0 && (
            <div>
              <div className="text-center mb-8">
                <h1 className="text-2xl font-normal text-slate-800 mb-2">
                  Bem-vindo ao AXIS ABA! 🎉
                </h1>
                <p className="text-sm text-slate-500">
                  Relaxa. Em 30 segundos você já vai estar usando.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1.5">
                    Como podemos te chamar?
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c46a50]/30 focus:border-[#c46a50] transition-all"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-600 mb-1.5">
                    Qual sua área?
                  </label>
                  <select
                    value={area}
                    onChange={e => setArea(e.target.value)}
                    className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#c46a50]/30 focus:border-[#c46a50] transition-all bg-white"
                  >
                    {AREAS.map(a => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dica amigável */}
              <div className="mt-6 flex items-start gap-2 bg-amber-50/60 rounded-xl px-4 py-3">
                <span className="text-base leading-none mt-0.5">💡</span>
                <p className="text-xs text-amber-700 leading-relaxed">
                  <strong>Dica:</strong> Clique no ícone <span className="font-medium">(?)</span> na lateral esquerda a qualquer momento. A Ana, nossa IA, está lá pra te ajudar.
                </p>
              </div>

              {/* Botão */}
              <button
                onClick={() => setStep(1)}
                className="w-full mt-8 px-6 py-3 bg-[#c46a50] text-white text-sm font-medium rounded-xl hover:bg-[#b35d45] shadow-sm transition-all active:scale-[0.98]"
              >
                Próximo →
              </button>
            </div>
          )}

          {/* ════════════ ETAPA 2: Termos ════════════ */}
          {step === 1 && (
            <div>
              <div className="text-center mb-6">
                <h1 className="text-2xl font-normal text-slate-800 mb-2">
                  Só mais uma coisinha
                </h1>
              </div>

              {/* Texto claro, sem juridiquês */}
              <div className="bg-slate-50 rounded-xl px-5 py-4 mb-6">
                <p className="text-sm text-slate-600 leading-relaxed">
                  O AXIS ABA organiza seus registros clínicos. Ele <strong>não faz diagnóstico</strong> nem substitui seu julgamento profissional — isso é <strong>100% seu</strong>. Seus dados ficam seguros com a gente (LGPD).
                </p>
              </div>

              {/* Checkbox */}
              <label className="flex items-center gap-3 cursor-pointer group mb-2">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={e => setAccepted(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#c46a50] focus:ring-[#c46a50]/30 cursor-pointer"
                />
                <span className="text-sm text-slate-600 group-hover:text-slate-800 select-none">
                  Entendi e aceito
                </span>
              </label>

              {/* Erro */}
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl">
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}

              {/* Navegação */}
              <div className="flex items-center gap-3 mt-8">
                <button
                  onClick={() => setStep(0)}
                  className="px-4 py-3 text-sm text-slate-400 hover:text-slate-600 transition-colors"
                >
                  ← Voltar
                </button>
                <button
                  onClick={handleFinish}
                  disabled={!accepted || saving}
                  className={`flex-1 px-6 py-3 text-sm font-medium rounded-xl shadow-sm transition-all active:scale-[0.98] ${
                    accepted && !saving
                      ? 'bg-[#c46a50] text-white hover:bg-[#b35d45]'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {saving ? 'Finalizando...' : 'Começar a usar →'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <p className="text-center text-[10px] text-slate-300 mt-4">
          {step === 0 ? '1' : '2'} de 2
        </p>
      </div>
    </div>
  )
}
