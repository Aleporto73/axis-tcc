'use client'

import { useState, useEffect, useCallback } from 'react'
import { MapPin, Plus, Pencil, Check, X, Building2, Home, GraduationCap, Monitor, Trees, MoreHorizontal } from 'lucide-react'
import { HelpTip } from '@/components/Tooltip'

// =====================================================
// AXIS ABA - Locais de Atendimento (service_sites)
// Ref: skill_axis_aba_v270.md — Sprint 0
//
// CRUD de locais onde ocorrem os atendimentos.
// Endereço criptografado (pgcrypto) — seguro por design.
// Admin/Supervisor podem criar e editar.
// Terapeuta vê a lista (para selecionar na sessão).
// =====================================================

interface ServiceSite {
  id: string
  site_name: string
  site_type: string
  address: string | null
  latitude: number | null
  longitude: number | null
  radius_meters: number
  is_active: boolean
  created_at: string
}

const SITE_TYPES = [
  { value: 'clinic', label: 'Clínica', icon: Building2, color: 'bg-blue-100 text-blue-700' },
  { value: 'home', label: 'Domicílio', icon: Home, color: 'bg-amber-100 text-amber-700' },
  { value: 'school', label: 'Escola', icon: GraduationCap, color: 'bg-green-100 text-green-700' },
  { value: 'telehealth', label: 'Telehealth', icon: Monitor, color: 'bg-purple-100 text-purple-700' },
  { value: 'community', label: 'Comunidade', icon: Trees, color: 'bg-teal-100 text-teal-700' },
  { value: 'other', label: 'Outro', icon: MoreHorizontal, color: 'bg-gray-100 text-gray-700' },
] as const

interface Props {
  canEdit: boolean // admin ou supervisor
}

export default function ServiceSitesManager({ canEdit }: Props) {
  const [sites, setSites] = useState<ServiceSite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    site_name: '',
    site_type: 'clinic' as string,
    address: '',
    latitude: '' as string,
    longitude: '' as string,
    radius_meters: '200',
  })

  // ─────────────────────────────────────────────────
  // Fetch sites
  // ─────────────────────────────────────────────────
  const fetchSites = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/aba/service-sites')
      if (!res.ok) throw new Error('Erro ao carregar locais')
      const data = await res.json()
      setSites(data.sites || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSites() }, [fetchSites])

  // ─────────────────────────────────────────────────
  // Reset form
  // ─────────────────────────────────────────────────
  const resetForm = () => {
    setForm({ site_name: '', site_type: 'clinic', address: '', latitude: '', longitude: '', radius_meters: '200' })
    setShowForm(false)
    setEditingId(null)
  }

  // ─────────────────────────────────────────────────
  // Open edit
  // ─────────────────────────────────────────────────
  const startEdit = (site: ServiceSite) => {
    setForm({
      site_name: site.site_name,
      site_type: site.site_type,
      address: site.address || '',
      latitude: site.latitude?.toString() || '',
      longitude: site.longitude?.toString() || '',
      radius_meters: site.radius_meters.toString(),
    })
    setEditingId(site.id)
    setShowForm(true)
  }

  // ─────────────────────────────────────────────────
  // Save (create or update)
  // ─────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.site_name.trim()) return

    try {
      setSaving(true)
      setError(null)

      const payload: Record<string, unknown> = {
        site_name: form.site_name.trim(),
        site_type: form.site_type,
        address: form.address.trim() || null,
        radius_meters: parseInt(form.radius_meters) || 200,
      }

      if (form.latitude) payload.latitude = parseFloat(form.latitude)
      if (form.longitude) payload.longitude = parseFloat(form.longitude)

      const url = editingId
        ? `/api/aba/service-sites/${editingId}`
        : '/api/aba/service-sites'

      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao salvar')
      }

      resetForm()
      await fetchSites()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  // ─────────────────────────────────────────────────
  // Toggle active/inactive
  // ─────────────────────────────────────────────────
  const toggleActive = async (site: ServiceSite) => {
    try {
      const res = await fetch(`/api/aba/service-sites/${site.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !site.is_active }),
      })
      if (!res.ok) throw new Error('Erro ao atualizar status')
      await fetchSites()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    }
  }

  // ─────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────
  const getSiteTypeInfo = (type: string) =>
    SITE_TYPES.find(t => t.value === type) || SITE_TYPES[5]

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-10 bg-gray-200 rounded w-1/3" />
        <div className="h-24 bg-gray-100 rounded" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-slate-600" />
          <h3 className="text-lg font-semibold text-slate-800">Locais de Atendimento</h3>
          <HelpTip tip="site_locais" />
        </div>
        {canEdit && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-coral-50 text-coral-700 rounded-lg hover:bg-coral-100 transition-colors border border-coral-200"
            style={{ backgroundColor: '#FFF5F0', color: '#C46A2F', borderColor: '#F0D0B8' }}
          >
            <Plus className="w-4 h-4" />
            Novo Local
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Fechar</button>
        </div>
      )}

      {/* Form */}
      {showForm && canEdit && (
        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nome do local *</label>
              <input
                type="text"
                value={form.site_name}
                onChange={e => setForm(f => ({ ...f, site_name: e.target.value }))}
                placeholder="Ex: Clínica AXIS Centro"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
              <select
                value={form.site_type}
                onChange={e => setForm(f => ({ ...f, site_type: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none bg-white"
              >
                {SITE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Endereço <span className="text-slate-400">(criptografado)</span>
            </label>
            <input
              type="text"
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="Rua, número, bairro, cidade"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Latitude</label>
              <input
                type="number"
                step="any"
                value={form.latitude}
                onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))}
                placeholder="-23.5505"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Longitude</label>
              <input
                type="number"
                step="any"
                value={form.longitude}
                onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))}
                placeholder="-46.6333"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Raio (metros)
                <HelpTip tip="site_raio" />
              </label>
              <input
                type="number"
                min="50"
                max="5000"
                value={form.radius_meters}
                onChange={e => setForm(f => ({ ...f, radius_meters: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving || !form.site_name.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 transition-colors"
              style={{ backgroundColor: '#C46A2F' }}
            >
              <Check className="w-4 h-4" />
              {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar Local'}
            </button>
            <button
              onClick={resetForm}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Sites list */}
      {sites.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <MapPin className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhum local cadastrado</p>
          {canEdit && (
            <p className="text-xs mt-1">Clique em &quot;Novo Local&quot; para começar</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {sites.map(site => {
            const typeInfo = getSiteTypeInfo(site.site_type)
            const Icon = typeInfo.icon
            return (
              <div
                key={site.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  site.is_active
                    ? 'bg-white border-slate-200 hover:border-slate-300'
                    : 'bg-slate-50 border-slate-100 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${typeInfo.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-slate-800 truncate">{site.site_name}</span>
                      {!site.is_active && (
                        <span className="text-xs px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded">Inativo</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span>{typeInfo.label}</span>
                      {site.address && (
                        <>
                          <span>·</span>
                          <span className="truncate max-w-[200px]">{site.address}</span>
                        </>
                      )}
                      {site.latitude && site.longitude && (
                        <>
                          <span>·</span>
                          <span>Raio: {site.radius_meters}m</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <button
                      onClick={() => startEdit(site)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => toggleActive(site)}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${
                        site.is_active
                          ? 'text-slate-500 hover:bg-red-50 hover:text-red-600'
                          : 'text-green-600 hover:bg-green-50'
                      }`}
                    >
                      {site.is_active ? 'Desativar' : 'Ativar'}
                    </button>
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
