'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// =====================================================
// Anexo D — Onboarding Light Wizard (8 passos)
//
// Passo 0: Boas-vindas
// Passo 1: Dados da clínica (Lacuna 1)
// Passo 2: Responsável técnico — CRP/UF (Lacuna 2)
// Passo 3: Convite de equipe (Lacuna 3)
// Passo 4: Seleção de plano (Lacuna 4)
// Passo 5: Upload de documentos (Lacuna 5)
// Passo 6: Conformidade regulatória (Lacuna 6)
// Passo 7: Protocolos-modelo + conclusão (Lacuna 7)
//
// Persistência server-side via /api/aba/onboarding/progress (Lacuna 9)
// Submissão final via /api/aba/onboarding/setup (Lacuna 8)
// =====================================================

const STEP_IDS = ['welcome','clinic','rt','team','plan','documents','compliance','protocols'] as const

const COMPLIANCE_ITEMS = [
  { item_key: 'lgpd_saude', label: 'Li e aceito a Política de Privacidade e tratamento de dados em saúde (LGPD)' },
  { item_key: 'consentimento_informado', label: 'Utilizarei Termo de Consentimento Informado com todos os responsáveis' },
  { item_key: 'sigilo_profissional', label: 'Comprometo-me com o sigilo profissional conforme Código de Ética (CRP/CFF)' },
  { item_key: 'registro_ativo', label: 'Declaro possuir registro ativo no conselho profissional competente' },
]

const PLAN_OPTIONS = [
  { tier: 'trial' as const, name: 'Trial', patients: 5, sessions: 15, price: 'Grátis por 30 dias' },
  { tier: 'starter' as const, name: 'Starter', patients: 15, sessions: 60, price: 'R$ 97/mês' },
  { tier: 'professional' as const, name: 'Professional', patients: 50, sessions: 200, price: 'R$ 197/mês' },
  { tier: 'clinic' as const, name: 'Clínica', patients: 999, sessions: 9999, price: 'R$ 497/mês' },
]

const UF_OPTIONS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'
]

interface ClinicData {
  clinic_name: string; cnpj: string; phone: string
  address_street: string; address_city: string; address_state: string; address_zip: string
}
interface RtData { name: string; crp: string; crp_uf: string; specialty: string }
interface TeamInvite { email: string; role: 'supervisor' | 'terapeuta'; name: string }
interface ProtocolModel { id: string; title: string; domain: string; objective: string; ebp_practice_name: string; difficulty_level: number; tags: string[] }

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Passo 1: Clínica
  const [clinic, setClinic] = useState<ClinicData>({ clinic_name:'', cnpj:'', phone:'', address_street:'', address_city:'', address_state:'', address_zip:'' })

  // Passo 2: RT
  const [rt, setRt] = useState<RtData>({ name:'', crp:'', crp_uf:'', specialty:'' })

  // Passo 3: Equipe
  const [invites, setInvites] = useState<TeamInvite[]>([])
  const [newInvite, setNewInvite] = useState<TeamInvite>({ email:'', role:'terapeuta', name:'' })

  // Passo 4: Plano
  const [planTier, setPlanTier] = useState<'trial'|'starter'|'professional'|'clinic'>('trial')

  // Passo 5: Documentos
  const [documents, setDocuments] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)

  // Passo 6: Compliance
  const [compliance, setCompliance] = useState<Record<string,boolean>>(
    Object.fromEntries(COMPLIANCE_ITEMS.map(c => [c.item_key, false]))
  )

  // Passo 7: Protocolos
  const [protocolLibrary, setProtocolLibrary] = useState<ProtocolModel[]>([])
  const [selectedProtocols, setSelectedProtocols] = useState<string[]>([])

  // ── Carregar estado do servidor ao montar ──
  useEffect(() => {
    async function loadProgress() {
      try {
        const res = await fetch('/api/aba/onboarding/progress')
        if (!res.ok) { setLoading(false); return }
        const data = await res.json()

        if (data.completed) { router.push('/aba'); return }

        if (data.progress) setStep(data.progress.current_step || 0)
        if (data.tenant) {
          setClinic({
            clinic_name: data.tenant.clinic_name || '',
            cnpj: data.tenant.cnpj || '',
            phone: data.tenant.phone || '',
            address_street: data.tenant.address_street || '',
            address_city: data.tenant.address_city || '',
            address_state: data.tenant.address_state || '',
            address_zip: data.tenant.address_zip || '',
          })
          setPlanTier(data.tenant.plan_tier || 'trial')
        }
        if (data.profile) {
          setRt({
            name: data.profile.name || '',
            crp: data.profile.crp || '',
            crp_uf: data.profile.crp_uf || '',
            specialty: data.profile.specialty || '',
          })
        }
        if (data.documents) setDocuments(data.documents)
        if (data.compliance) {
          const map: Record<string,boolean> = { ...compliance }
          data.compliance.forEach((c: any) => { map[c.item_key] = c.accepted })
          setCompliance(map)
        }
        if (data.protocol_library) setProtocolLibrary(data.protocol_library)
        if (data.pending_invites) {
          setInvites(data.pending_invites.map((i: any) => ({ email: i.email, role: i.role, name: i.name || '' })))
        }
      } catch { /* first load, ignore */ }
      setLoading(false)
    }
    loadProgress()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Salvar progresso parcial no servidor ──
  const saveProgress = useCallback(async (nextStep: number, stepId: string) => {
    try {
      await fetch('/api/aba/onboarding/progress', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_step: nextStep,
          step_id: stepId,
          clinic_data: clinic,
          rt_data: rt,
          plan_data: { tier: planTier },
          compliance_data: compliance,
        }),
      })
    } catch { /* non-blocking */ }
  }, [clinic, rt, planTier, compliance])

  // ── Navegação ──
  const goNext = async () => {
    setError('')
    // Validações por passo
    if (step === 1 && !clinic.clinic_name.trim()) { setError('Nome da clínica é obrigatório'); return }
    if (step === 2 && (!rt.crp.trim() || !rt.crp_uf)) { setError('CRP e UF são obrigatórios'); return }

    if (step === STEP_IDS.length - 1) {
      await handleFinish()
      return
    }

    const nextStep = step + 1
    await saveProgress(nextStep, STEP_IDS[step])
    setStep(nextStep)
  }

  const goBack = () => { setError(''); setStep(step - 1) }

  // ── Upload de documento ──
  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('doc_type', docType)
      const res = await fetch('/api/aba/onboarding/documents', { method: 'POST', body: form })
      if (!res.ok) { const d = await res.json(); setError(d.error); return }
      const data = await res.json()
      setDocuments(prev => [...prev, data.document])
    } catch { setError('Erro ao enviar arquivo') }
    finally { setUploading(false) }
  }

  // ── Adicionar convite ──
  const addInvite = () => {
    if (!newInvite.email.trim() || !newInvite.email.includes('@')) return
    if (invites.length >= 10) { setError('Máximo 10 convites'); return }
    setInvites(prev => [...prev, { ...newInvite }])
    setNewInvite({ email:'', role:'terapeuta', name:'' })
  }

  // ── Submissão final (Lacuna 8) ──
  const handleFinish = async () => {
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/aba/onboarding/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinic,
          rt,
          team_invites: invites,
          plan_tier: planTier,
          compliance_items: COMPLIANCE_ITEMS.map(c => ({ ...c, accepted: compliance[c.item_key] })),
          selected_protocol_ids: selectedProtocols,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erro ao finalizar')
        setSaving(false)
        return
      }

      router.push('/aba')
    } catch {
      setError('Erro de conexão')
      setSaving(false)
    }
  }

  const handleSkip = async () => {
    try {
      await fetch('/api/aba/onboarding/progress', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_step: step, skipped: true }),
      })
    } catch { /* non-blocking */ }
    router.push('/aba')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="text-slate-400 text-sm">Carregando...</div>
      </div>
    )
  }

  // ── Input helper ──
  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-aba-500/30 focus:border-aba-400'
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1'

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress bar */}
        <div className="flex gap-1.5 mb-8 justify-center">
          {STEP_IDS.map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-all ${i <= step ? 'bg-aba-500 w-8' : 'bg-slate-200 w-4'}`} />
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">

          {/* ── Passo 0: Boas-vindas ── */}
          {step === 0 && (
            <div className="text-center">
              <div className="text-4xl mb-4">🧠</div>
              <h1 className="text-xl font-normal text-slate-800 mb-1">Bem-vindo ao AXIS Clínico</h1>
              <p className="text-sm text-aba-500 font-medium mb-4">Configure sua clínica em poucos minutos</p>
              <p className="text-sm text-slate-500 leading-relaxed">
                Vamos configurar os dados da sua clínica, equipe e preferências.
                Você pode pular e completar depois nas configurações.
              </p>
            </div>
          )}

          {/* ── Passo 1: Dados da clínica (Lacuna 1) ── */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-normal text-slate-800 mb-1">Dados da Clínica</h2>
              <p className="text-xs text-slate-400 mb-6">Informações do estabelecimento</p>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Nome Fantasia *</label>
                  <input className={inputCls} value={clinic.clinic_name} onChange={e => setClinic({...clinic, clinic_name: e.target.value})} placeholder="Nome da clínica" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>CNPJ</label>
                    <input className={inputCls} value={clinic.cnpj} onChange={e => setClinic({...clinic, cnpj: e.target.value})} placeholder="00.000.000/0000-00" />
                  </div>
                  <div>
                    <label className={labelCls}>Telefone</label>
                    <input className={inputCls} value={clinic.phone} onChange={e => setClinic({...clinic, phone: e.target.value})} placeholder="(00) 00000-0000" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Endereço</label>
                  <input className={inputCls} value={clinic.address_street} onChange={e => setClinic({...clinic, address_street: e.target.value})} placeholder="Rua, número" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Cidade</label>
                    <input className={inputCls} value={clinic.address_city} onChange={e => setClinic({...clinic, address_city: e.target.value})} />
                  </div>
                  <div>
                    <label className={labelCls}>UF</label>
                    <select className={inputCls} value={clinic.address_state} onChange={e => setClinic({...clinic, address_state: e.target.value})}>
                      <option value="">--</option>
                      {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>CEP</label>
                    <input className={inputCls} value={clinic.address_zip} onChange={e => setClinic({...clinic, address_zip: e.target.value})} placeholder="00000-000" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Passo 2: Responsável Técnico (Lacuna 2) ── */}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-normal text-slate-800 mb-1">Responsável Técnico</h2>
              <p className="text-xs text-slate-400 mb-6">Dados profissionais do RT da clínica</p>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Nome Completo *</label>
                  <input className={inputCls} value={rt.name} onChange={e => setRt({...rt, name: e.target.value})} placeholder="Nome do responsável técnico" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>CRP *</label>
                    <input className={inputCls} value={rt.crp} onChange={e => setRt({...rt, crp: e.target.value})} placeholder="00/00000" />
                  </div>
                  <div>
                    <label className={labelCls}>UF do CRP *</label>
                    <select className={inputCls} value={rt.crp_uf} onChange={e => setRt({...rt, crp_uf: e.target.value})}>
                      <option value="">Selecione</option>
                      {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Especialidade</label>
                  <select className={inputCls} value={rt.specialty} onChange={e => setRt({...rt, specialty: e.target.value})}>
                    <option value="">Selecione</option>
                    <option value="ABA">Análise do Comportamento Aplicada (ABA)</option>
                    <option value="TCC">Terapia Cognitivo-Comportamental (TCC)</option>
                    <option value="Neuro">Neuropsicologia</option>
                    <option value="Fono">Fonoaudiologia</option>
                    <option value="TO">Terapia Ocupacional</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ── Passo 3: Convite de equipe (Lacuna 3) ── */}
          {step === 3 && (
            <div>
              <h2 className="text-lg font-normal text-slate-800 mb-1">Convide sua Equipe</h2>
              <p className="text-xs text-slate-400 mb-6">Adicione terapeutas e supervisores (opcional, até 10)</p>
              <div className="space-y-3 mb-4">
                <div className="grid grid-cols-5 gap-2">
                  <div className="col-span-2">
                    <input className={inputCls} value={newInvite.email} onChange={e => setNewInvite({...newInvite, email: e.target.value})} placeholder="email@exemplo.com" />
                  </div>
                  <div>
                    <input className={inputCls} value={newInvite.name} onChange={e => setNewInvite({...newInvite, name: e.target.value})} placeholder="Nome" />
                  </div>
                  <div>
                    <select className={inputCls} value={newInvite.role} onChange={e => setNewInvite({...newInvite, role: e.target.value as any})}>
                      <option value="terapeuta">Terapeuta</option>
                      <option value="supervisor">Supervisor</option>
                    </select>
                  </div>
                  <button onClick={addInvite} className="px-3 py-2 bg-aba-500 text-white text-xs rounded-lg hover:bg-aba-600">+</button>
                </div>
              </div>
              {invites.length > 0 && (
                <div className="space-y-2">
                  {invites.map((inv, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
                      <span className="text-slate-700">{inv.name || inv.email}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">{inv.role}</span>
                        <button onClick={() => setInvites(prev => prev.filter((_,j) => j !== i))} className="text-xs text-red-400 hover:text-red-600">remover</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {invites.length === 0 && <p className="text-xs text-slate-300 text-center">Nenhum convite adicionado ainda</p>}
            </div>
          )}

          {/* ── Passo 4: Seleção de plano (Lacuna 4) ── */}
          {step === 4 && (
            <div>
              <h2 className="text-lg font-normal text-slate-800 mb-1">Escolha seu Plano</h2>
              <p className="text-xs text-slate-400 mb-6">Você pode alterar depois nas configurações</p>
              <div className="space-y-2">
                {PLAN_OPTIONS.map(plan => (
                  <button key={plan.tier} onClick={() => setPlanTier(plan.tier)}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                      planTier === plan.tier ? 'border-aba-500 bg-aba-50' : 'border-slate-100 hover:border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-slate-700">{plan.name}</span>
                        <p className="text-xs text-slate-400">{plan.patients} aprendizes, {plan.sessions} sessões/mês</p>
                      </div>
                      <span className="text-sm font-medium text-aba-600">{plan.price}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Passo 5: Upload de documentos (Lacuna 5) ── */}
          {step === 5 && (
            <div>
              <h2 className="text-lg font-normal text-slate-800 mb-1">Documentos da Clínica</h2>
              <p className="text-xs text-slate-400 mb-6">Opcional — PDF ou imagem, até 10MB cada</p>
              <div className="space-y-3">
                {[
                  { type: 'alvara', label: 'Alvará de Funcionamento' },
                  { type: 'crp_rt', label: 'CRP do Responsável Técnico' },
                  { type: 'certificacao', label: 'Certificação ABA / Especialização' },
                  { type: 'contrato_social', label: 'Contrato Social' },
                ].map(doc => {
                  const uploaded = documents.find((d: any) => d.doc_type === doc.type)
                  return (
                    <div key={doc.type} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
                      <div>
                        <p className="text-sm text-slate-700">{doc.label}</p>
                        {uploaded && <p className="text-xs text-green-600">{uploaded.filename}</p>}
                      </div>
                      {uploaded ? (
                        <span className="text-xs text-green-500 font-medium">Enviado</span>
                      ) : (
                        <label className="px-3 py-1.5 bg-white border border-slate-200 text-xs text-slate-600 rounded-lg cursor-pointer hover:bg-slate-50">
                          {uploading ? '...' : 'Enviar'}
                          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp"
                            onChange={e => handleDocUpload(e, doc.type)} disabled={uploading} />
                        </label>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Passo 6: Conformidade regulatória (Lacuna 6) ── */}
          {step === 6 && (
            <div>
              <h2 className="text-lg font-normal text-slate-800 mb-1">Conformidade Regulatória</h2>
              <p className="text-xs text-slate-400 mb-6">Declarações obrigatórias para operação clínica</p>
              <div className="space-y-3">
                {COMPLIANCE_ITEMS.map(item => (
                  <label key={item.item_key} className="flex items-start gap-3 cursor-pointer group">
                    <input type="checkbox" checked={compliance[item.item_key]}
                      onChange={e => setCompliance(prev => ({...prev, [item.item_key]: e.target.checked}))}
                      className="mt-0.5 rounded border-slate-300 text-aba-500 focus:ring-aba-500/30" />
                    <span className="text-sm text-slate-600 leading-snug group-hover:text-slate-800">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ── Passo 7: Protocolos-modelo + conclusão (Lacuna 7) ── */}
          {step === 7 && (
            <div>
              <h2 className="text-lg font-normal text-slate-800 mb-1">Protocolos-Modelo</h2>
              <p className="text-xs text-slate-400 mb-6">Selecione modelos para importar na sua biblioteca (opcional)</p>
              {protocolLibrary.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {protocolLibrary.map(p => (
                    <label key={p.id} className="flex items-start gap-3 cursor-pointer bg-slate-50 rounded-lg px-3 py-2 hover:bg-slate-100">
                      <input type="checkbox" checked={selectedProtocols.includes(p.id)}
                        onChange={e => {
                          if (e.target.checked) setSelectedProtocols(prev => [...prev, p.id])
                          else setSelectedProtocols(prev => prev.filter(id => id !== p.id))
                        }}
                        className="mt-0.5 rounded border-slate-300 text-aba-500 focus:ring-aba-500/30" />
                      <div>
                        <span className="text-sm text-slate-700">{p.title}</span>
                        <p className="text-xs text-slate-400">{p.domain} — {p.ebp_practice_name}</p>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-300 text-center py-4">Nenhum protocolo-modelo disponível</p>
              )}
              <div className="mt-6 p-4 bg-aba-50 rounded-xl text-center">
                <p className="text-sm text-aba-700 font-medium">Tudo pronto!</p>
                <p className="text-xs text-aba-500 mt-1">Clique em "Finalizar" para salvar todas as configurações.</p>
              </div>
            </div>
          )}

          {/* ── Erro ── */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {/* ── Navegação ── */}
          <div className="flex items-center justify-between mt-6">
            {step > 0 ? (
              <button onClick={goBack} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-600">
                ← Anterior
              </button>
            ) : <div />}
            <button onClick={goNext} disabled={saving}
              className="px-6 py-2.5 bg-aba-500 text-white text-sm font-medium rounded-xl hover:bg-aba-600 shadow-sm disabled:opacity-50">
              {saving ? 'Salvando...' : step === STEP_IDS.length - 1 ? 'Finalizar' : 'Próximo →'}
            </button>
          </div>
        </div>

        {/* Skip */}
        {step < STEP_IDS.length - 1 && (
          <p className="text-center mt-4">
            <button onClick={handleSkip} className="text-xs text-slate-300 hover:text-slate-500">
              Pular e completar depois
            </button>
          </p>
        )}

        <p className="text-center text-[10px] text-slate-300 mt-3">{step + 1} de {STEP_IDS.length}</p>
      </div>
    </div>
  )
}
