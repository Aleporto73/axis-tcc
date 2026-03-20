'use client'

import { useState, useEffect, useCallback } from 'react'
import { CreditCard, Plus, Pencil, Check, X } from 'lucide-react'
import { HelpTip } from '@/components/Tooltip'

// =====================================================
// AXIS ABA - Coberturas por Pagador (v2.7.0 Sprint 2)
//
// Gerencia coberturas de convênio/operadora por aprendiz.
// Multi-cobertura: mesmo aprendiz, múltiplos pagadores.
// Admin/Supervisor podem criar e editar.
//
// Integra com: GET/POST /api/aba/coverage-profiles
//              PATCH /api/aba/coverage-profiles/[id]
// =====================================================

interface CoverageProfile {
  id: string
  learner_id: string
  learner_name: string
  payer_name: string
  authorization_code: string | null
  authorized_hours_week: number | null
  start_date: string
  end_date: string | null
  status: string
  notes: string | null
  created_at: string
}

interface Props {
  learnerId?: string  // se null, mostra todos
  learnerName?: string
  canEdit: boolean
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-green-50', text: 'text-green-700', label: 'Ativa' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pendente' },
  expired: { bg: 'bg-red-50', text: 'text-red-700', label: 'Expirada' },
  suspended: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Suspensa' },
}

export default function CoverageProfilesManager({ learnerId, learnerName, canEdit }: Props) {
  const [coverages, setCoverages] = useState<CoverageProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    payer_name: '',
    authorization_code: '',
    authorized_hours_week: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    status: 'active',
    notes: '',
  })

  const fetchCoverages = useCallback(async () => {
    try {
      setLoading(true)
      const url = learnerId
        ? `/api/aba/coverage-profiles?learner_id=${learnerId}`
        : '/api/aba/coverage-profiles'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Erro ao carregar coberturas')
      const data = await res.json()
      setCoverages(data.coverages || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [learnerId])

  useEffect(() => { fetchCoverages() }, [fetchCoverages])

  const resetForm = () => {
    setForm({
      payer_name: '', authorization_code: '', authorized_hours_week: '',
      start_date: new Date().toISOString().split('T')[0], end_date: '',
      status: 'active', notes: '',
    })
    setEditingId(null)
    setShowForm(false)
    setError(null)
  }

  const startEdit = (cov: CoverageProfile) => {
    setForm({
      payer_name: cov.payer_name,
      authorization_code: cov.authorization_code || '',
      authorized_hours_week: cov.authorized_hours_week?.toString() || '',
      start_date: cov.start_date.split('T')[0],
      end_date: cov.end_date?.split('T')[0] || '',
      status: cov.status,
      notes: cov.notes || '',
    })
    setEditingId(cov.id)
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!form.payer_name.trim()) { setError('Nome do pagador obrigatório'); return }
    if (!form.start_date) { setError('Data de início obrigatória'); return }

    setSaving(true)
    setError(null)

    try {
      const payload = {
        learner_id: learnerId,
        payer_name: form.payer_name.trim(),
        authorization_code: form.authorization_code.trim() || null,
        authorized_hours_week: form.authorized_hours_week ? parseFloat(form.authorized_hours_week) : null,
        start_date: form.start_date,
        end_date: form.end_date || null,
        status: form.status,
        notes: form.notes.trim() || null,
      }

      const url = editingId
        ? `/api/aba/coverage-profiles/${editingId}`
        : '/api/aba/coverage-profiles'
      const method = editingId ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Erro ao salvar')
        setSaving(false)
        return
      }

      resetForm()
      await fetchCoverages()
    } catch {
      setError('Falha de conexão')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-aba-500/10 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-aba-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-800">
                {learnerId ? 'Coberturas' : 'Coberturas por Pagador'}
              </h2>
              <HelpTip tip="cobertura_pagador" className="w-4 h-4 text-[10px]" />
            </div>
            <p className="text-sm text-slate-500">
              {learnerId
                ? `Convênios e autorizações de ${learnerName || 'aprendiz'}`
                : 'Vínculos com operadoras de saúde'
              }
            </p>
          </div>
        </div>
        {canEdit && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-aba-500 text-white text-xs font-medium rounded-lg hover:bg-aba-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Cobertura
          </button>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-sm text-slate-400 animate-pulse">Carregando coberturas...</div>
      ) : coverages.length === 0 && !showForm ? (
        <div className="text-center py-6 text-sm text-slate-400">
          Nenhuma cobertura cadastrada
        </div>
      ) : (
        <div className="space-y-2">
          {coverages.map(cov => {
            const statusCfg = STATUS_CONFIG[cov.status] || STATUS_CONFIG.pending
            const isExpired = cov.end_date && new Date(cov.end_date) < new Date()

            return (
              <div key={cov.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-700">{cov.payer_name}</p>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${statusCfg.bg} ${statusCfg.text}`}>
                      {statusCfg.label}
                    </span>
                    {isExpired && cov.status === 'active' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-600">Expirada</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                    {!learnerId && <span>{cov.learner_name}</span>}
                    {cov.authorization_code && (
                      <><span>·</span><span>Guia: {cov.authorization_code}</span></>
                    )}
                    {cov.authorized_hours_week && (
                      <><span>·</span><span>{cov.authorized_hours_week}h/sem</span></>
                    )}
                    <span>·</span>
                    <span>
                      {new Date(cov.start_date).toLocaleDateString('pt-BR')}
                      {cov.end_date ? ` — ${new Date(cov.end_date).toLocaleDateString('pt-BR')}` : ' — sem prazo'}
                    </span>
                  </div>
                </div>
                {canEdit && (
                  <button onClick={() => startEdit(cov)} className="p-1 text-slate-300 hover:text-aba-500 transition-colors flex-shrink-0">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Formulário */}
      {showForm && (
        <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
          <h3 className="text-xs font-medium text-slate-600">
            {editingId ? 'Editar Cobertura' : 'Nova Cobertura'}
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Pagador / Operadora *</label>
              <input type="text" value={form.payer_name} onChange={e => setForm({ ...form, payer_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500"
                placeholder="Ex: Unimed, SulAmérica, Particular" />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Código autorização / Guia</label>
              <input type="text" value={form.authorization_code} onChange={e => setForm({ ...form, authorization_code: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500"
                placeholder="Ex: GIX-2026-001234" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Horas autorizadas / semana</label>
              <input type="number" min="0" max="60" step="0.5" value={form.authorized_hours_week}
                onChange={e => setForm({ ...form, authorized_hours_week: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" placeholder="20" />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Início *</label>
              <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Término</label>
              <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500 bg-white">
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Observações</label>
              <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-aba-500"
                placeholder="Observações internas" />
            </div>
          </div>

          {error && <p className="text-[11px] text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={handleSubmit} disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-aba-500 text-white text-xs font-medium rounded-lg hover:bg-aba-600 transition-colors disabled:opacity-50">
              {saving ? 'Salvando...' : <><Check className="w-3.5 h-3.5" /> Salvar</>}
            </button>
            <button onClick={resetForm}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-slate-400 text-xs hover:text-slate-600">
              <X className="w-3.5 h-3.5" /> Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
