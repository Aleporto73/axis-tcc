'use client'

import { useState, useEffect, useCallback } from 'react'
import { ClipboardList, Plus, Pencil, Check, X, ChevronDown, ChevronUp } from 'lucide-react'
import { HelpTip } from '@/components/Tooltip'

// =====================================================
// AXIS ABA - Perfis de Pagador (payer_requirement_profiles)
// Ref: skill_axis_aba_v270.md — Sprint 4
//
// CRUD de requisitos por operadora de saúde.
// Define o que cada pagador exige: GPS, atestação,
// foto, cobertura, relatórios, etc.
//
// Admin/Supervisor podem criar e editar.
// =====================================================

interface PayerProfile {
  id: string
  payer_name: string
  payer_code: string | null
  requires_geo: boolean
  geo_level: string
  requires_guardian_attestation: boolean
  guardian_attestation_deadline_hours: number
  requires_photo: boolean
  requires_attachment_per_guide: boolean
  report_frequency_days: number
  report_template: string
  requires_team_roster: boolean
  requires_prescription: boolean
  requires_pei: boolean
  requires_coverage_auth: boolean
  cid_version: string
  max_file_size_mb: number
  accepted_formats: string[]
  checklist_items: unknown | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface FormData {
  payer_name: string
  payer_code: string
  requires_geo: boolean
  geo_level: string
  requires_guardian_attestation: boolean
  guardian_attestation_deadline_hours: number
  requires_photo: boolean
  requires_attachment_per_guide: boolean
  report_frequency_days: number
  report_template: string
  requires_team_roster: boolean
  requires_prescription: boolean
  requires_pei: boolean
  requires_coverage_auth: boolean
  cid_version: string
  max_file_size_mb: number
  accepted_formats: string[]
  notes: string
}

const EMPTY_FORM: FormData = {
  payer_name: '',
  payer_code: '',
  requires_geo: false,
  geo_level: 'none',
  requires_guardian_attestation: false,
  guardian_attestation_deadline_hours: 72,
  requires_photo: false,
  requires_attachment_per_guide: false,
  report_frequency_days: 90,
  report_template: 'standard',
  requires_team_roster: true,
  requires_prescription: true,
  requires_pei: false,
  requires_coverage_auth: false,
  cid_version: 'CID-10',
  max_file_size_mb: 10,
  accepted_formats: ['pdf', 'jpg', 'png'],
  notes: '',
}

const GEO_LEVELS = [
  { value: 'none', label: 'Nenhum', desc: 'GPS não exigido' },
  { value: 'light', label: 'Leve', desc: 'Registro, sem validação de distância' },
  { value: 'standard', label: 'Padrão', desc: 'Check-in/out com raio de validação' },
  { value: 'strict', label: 'Rigoroso', desc: 'GPS obrigatório, exceção gera flag' },
] as const

const CID_VERSIONS = [
  { value: 'CID-10', label: 'CID-10' },
  { value: 'CID-11', label: 'CID-11' },
  { value: 'both', label: 'Ambos' },
] as const

interface Props {
  canEdit: boolean
}

export default function PayerRequirementsManager({ canEdit }: Props) {
  const [profiles, setProfiles] = useState<PayerProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchProfiles = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/aba/payer-profiles?active=false')
      if (!res.ok) throw new Error('Erro ao carregar perfis')
      const data = await res.json()
      setProfiles(data.profiles || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchProfiles() }, [fetchProfiles])

  const openNew = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(true)
  }

  const openEdit = (p: PayerProfile) => {
    setForm({
      payer_name: p.payer_name,
      payer_code: p.payer_code || '',
      requires_geo: p.requires_geo,
      geo_level: p.geo_level,
      requires_guardian_attestation: p.requires_guardian_attestation,
      guardian_attestation_deadline_hours: p.guardian_attestation_deadline_hours,
      requires_photo: p.requires_photo,
      requires_attachment_per_guide: p.requires_attachment_per_guide,
      report_frequency_days: p.report_frequency_days,
      report_template: p.report_template,
      requires_team_roster: p.requires_team_roster,
      requires_prescription: p.requires_prescription,
      requires_pei: p.requires_pei,
      requires_coverage_auth: p.requires_coverage_auth,
      cid_version: p.cid_version,
      max_file_size_mb: p.max_file_size_mb,
      accepted_formats: p.accepted_formats || ['pdf', 'jpg', 'png'],
      notes: p.notes || '',
    })
    setEditingId(p.id)
    setShowForm(true)
  }

  const cancel = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const handleSave = async () => {
    if (!form.payer_name.trim()) {
      setError('Nome do pagador é obrigatório')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        ...form,
        payer_name: form.payer_name.trim(),
        payer_code: form.payer_code.trim() || null,
        notes: form.notes.trim() || null,
      }

      const url = editingId
        ? `/api/aba/payer-profiles/${editingId}`
        : '/api/aba/payer-profiles'
      const method = editingId ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao salvar')
      }
      cancel()
      await fetchProfiles()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (p: PayerProfile) => {
    try {
      const res = await fetch(`/api/aba/payer-profiles/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !p.is_active }),
      })
      if (!res.ok) throw new Error('Erro ao atualizar')
      await fetchProfiles()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    }
  }

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const reqCount = (p: PayerProfile) => {
    let count = 0
    if (p.requires_geo) count++
    if (p.requires_guardian_attestation) count++
    if (p.requires_photo) count++
    if (p.requires_attachment_per_guide) count++
    if (p.requires_team_roster) count++
    if (p.requires_prescription) count++
    if (p.requires_pei) count++
    if (p.requires_coverage_auth) count++
    return count
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-aba-500/10 flex items-center justify-center">
            <ClipboardList className="w-6 h-6 text-aba-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-800">Perfis de Pagador</h2>
              <HelpTip tip="perfil_pagador" className="w-4 h-4 text-[10px]" />
            </div>
            <p className="text-sm text-slate-500">
              Requisitos exigidos por cada operadora de saúde
            </p>
          </div>
        </div>
        {canEdit && !showForm && (
          <button
            onClick={openNew}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-aba-500 text-white text-xs font-medium rounded-lg hover:bg-aba-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Novo Perfil
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-[11px] text-red-500 bg-red-50 p-2 rounded">{error}</p>
      )}

      {/* Form */}
      {showForm && (
        <div className="border border-aba-500/30 rounded-lg p-4 bg-aba-500/5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">
            {editingId ? 'Editar Perfil' : 'Novo Perfil de Pagador'}
          </h3>

          {/* Identificação */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Nome do pagador *</label>
              <input
                type="text"
                value={form.payer_name}
                onChange={e => updateField('payer_name', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500"
                placeholder="Ex: Unimed, SulAmérica..."
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Código</label>
              <input
                type="text"
                value={form.payer_code}
                onChange={e => updateField('payer_code', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500"
                placeholder="Código interno ou ANS"
              />
            </div>
          </div>

          {/* Presença */}
          <div>
            <h4 className="text-xs font-semibold text-slate-600 mb-2">Presença e GPS</h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.requires_geo}
                  onChange={e => updateField('requires_geo', e.target.checked)}
                  className="rounded border-slate-300 text-aba-500 focus:ring-aba-500"
                />
                <span className="text-sm text-slate-600">Exige geolocalização</span>
              </label>
              {form.requires_geo && (
                <div className="ml-6">
                  <label className="block text-[11px] text-slate-500 mb-1">Nível de exigência GPS</label>
                  <select
                    value={form.geo_level}
                    onChange={e => updateField('geo_level', e.target.value)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-aba-500"
                  >
                    {GEO_LEVELS.map(g => (
                      <option key={g.value} value={g.value}>{g.label} — {g.desc}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Atestação */}
          <div>
            <h4 className="text-xs font-semibold text-slate-600 mb-2">Atestação</h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.requires_guardian_attestation}
                  onChange={e => updateField('requires_guardian_attestation', e.target.checked)}
                  className="rounded border-slate-300 text-aba-500 focus:ring-aba-500"
                />
                <span className="text-sm text-slate-600">Exige atestação do responsável</span>
              </label>
              {form.requires_guardian_attestation && (
                <div className="ml-6">
                  <label className="block text-[11px] text-slate-500 mb-1">Prazo (horas)</label>
                  <input
                    type="number"
                    value={form.guardian_attestation_deadline_hours}
                    onChange={e => updateField('guardian_attestation_deadline_hours', parseInt(e.target.value, 10) || 72)}
                    className="w-24 px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-aba-500"
                    min={1}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Evidências */}
          <div>
            <h4 className="text-xs font-semibold text-slate-600 mb-2">Evidências</h4>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.requires_photo}
                  onChange={e => updateField('requires_photo', e.target.checked)}
                  className="rounded border-slate-300 text-aba-500 focus:ring-aba-500"
                />
                <span className="text-sm text-slate-600">Exige foto</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.requires_attachment_per_guide}
                  onChange={e => updateField('requires_attachment_per_guide', e.target.checked)}
                  className="rounded border-slate-300 text-aba-500 focus:ring-aba-500"
                />
                <span className="text-sm text-slate-600">Anexo por guia</span>
              </label>
            </div>
          </div>

          {/* Documentação */}
          <div>
            <h4 className="text-xs font-semibold text-slate-600 mb-2">Documentação Obrigatória</h4>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.requires_team_roster}
                  onChange={e => updateField('requires_team_roster', e.target.checked)}
                  className="rounded border-slate-300 text-aba-500 focus:ring-aba-500"
                />
                <span className="text-sm text-slate-600">Quadro de equipe</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.requires_prescription}
                  onChange={e => updateField('requires_prescription', e.target.checked)}
                  className="rounded border-slate-300 text-aba-500 focus:ring-aba-500"
                />
                <span className="text-sm text-slate-600">Prescrição médica</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.requires_pei}
                  onChange={e => updateField('requires_pei', e.target.checked)}
                  className="rounded border-slate-300 text-aba-500 focus:ring-aba-500"
                />
                <span className="text-sm text-slate-600">PEI (Plano Ed. Ind.)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.requires_coverage_auth}
                  onChange={e => updateField('requires_coverage_auth', e.target.checked)}
                  className="rounded border-slate-300 text-aba-500 focus:ring-aba-500"
                />
                <span className="text-sm text-slate-600">Autorização cobertura</span>
              </label>
            </div>
          </div>

          {/* Relatórios e Padrões */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Frequência relatório (dias)</label>
              <input
                type="number"
                value={form.report_frequency_days}
                onChange={e => updateField('report_frequency_days', parseInt(e.target.value, 10) || 90)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-aba-500"
                min={1}
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Versão CID</label>
              <select
                value={form.cid_version}
                onChange={e => updateField('cid_version', e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-aba-500"
              >
                {CID_VERSIONS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Tamanho máx. arquivo (MB)</label>
              <input
                type="number"
                value={form.max_file_size_mb}
                onChange={e => updateField('max_file_size_mb', parseInt(e.target.value, 10) || 10)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-aba-500"
                min={1}
                max={100}
              />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Observações</label>
            <textarea
              value={form.notes}
              onChange={e => updateField('notes', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500"
              rows={2}
              placeholder="Observações internas sobre este pagador..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-aba-500 text-white text-xs font-medium rounded-lg hover:bg-aba-600 transition-colors disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Criar Perfil'}
            </button>
            <button
              onClick={cancel}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-slate-600 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Profiles list */}
      {loading ? (
        <div className="text-sm text-slate-400 animate-pulse">Carregando perfis...</div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-400">
          Nenhum perfil de pagador cadastrado
        </div>
      ) : (
        <div className="space-y-2">
          {profiles.map(p => {
            const isExpanded = expandedId === p.id
            const reqs = reqCount(p)

            return (
              <div key={p.id} className={`border rounded-lg transition-colors ${
                !p.is_active ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-slate-200 hover:border-slate-300'
              }`}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  className="w-full flex items-center justify-between p-3 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      p.is_active ? 'bg-aba-500/10' : 'bg-slate-100'
                    }`}>
                      <ClipboardList className={`w-4 h-4 ${p.is_active ? 'text-aba-500' : 'text-slate-400'}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700">{p.payer_name}</span>
                        {p.payer_code && (
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            {p.payer_code}
                          </span>
                        )}
                        {!p.is_active && (
                          <span className="text-[10px] text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">
                            Inativo
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {reqs} requisito{reqs !== 1 ? 's' : ''} · GPS {p.requires_geo ? p.geo_level : 'não exigido'}
                        {' · '}{p.cid_version} · Relatório a cada {p.report_frequency_days}d
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {canEdit && (
                      <button
                        onClick={e => { e.stopPropagation(); openEdit(p) }}
                        className="p-1.5 text-slate-400 hover:text-aba-500 hover:bg-aba-500/10 rounded transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-slate-100 pt-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                      <ReqBadge label="GPS" active={p.requires_geo} detail={p.geo_level} />
                      <ReqBadge label="Atestação responsável" active={p.requires_guardian_attestation} detail={`${p.guardian_attestation_deadline_hours}h`} />
                      <ReqBadge label="Foto" active={p.requires_photo} />
                      <ReqBadge label="Anexo por guia" active={p.requires_attachment_per_guide} />
                      <ReqBadge label="Quadro de equipe" active={p.requires_team_roster} />
                      <ReqBadge label="Prescrição" active={p.requires_prescription} />
                      <ReqBadge label="PEI" active={p.requires_pei} />
                      <ReqBadge label="Autorização cobertura" active={p.requires_coverage_auth} />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-3 text-[11px]">
                      <div>
                        <span className="text-slate-400 block">Relatório</span>
                        <span className="text-slate-600">A cada {p.report_frequency_days} dias ({p.report_template})</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">CID</span>
                        <span className="text-slate-600">{p.cid_version}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Arquivos</span>
                        <span className="text-slate-600">Máx {p.max_file_size_mb}MB · {(p.accepted_formats || []).join(', ')}</span>
                      </div>
                    </div>
                    {p.notes && (
                      <div className="mt-2 text-[11px] text-slate-400 italic">{p.notes}</div>
                    )}
                    {canEdit && (
                      <div className="mt-3">
                        <button
                          onClick={() => toggleActive(p)}
                          className={`text-[11px] px-2.5 py-1 rounded transition-colors ${
                            p.is_active
                              ? 'text-red-500 hover:bg-red-50'
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                        >
                          {p.is_active ? 'Desativar perfil' : 'Reativar perfil'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Sub-component ───
function ReqBadge({ label, active, detail }: { label: string; active: boolean; detail?: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${
      active ? 'bg-green-50 text-green-700' : 'bg-slate-50 text-slate-400'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-500' : 'bg-slate-300'}`} />
      <span>{label}</span>
      {active && detail && <span className="text-[10px] opacity-70">({detail})</span>}
    </div>
  )
}
