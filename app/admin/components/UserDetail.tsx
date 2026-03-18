'use client'

import { useState, useEffect } from 'react'

interface License {
  id: string
  product_type: string
  is_active: boolean
  hotmart_plan: string | null
  hotmart_transaction: string | null
  hotmart_offer: string | null
  hotmart_event: string | null
  buyer_email: string | null
  valid_from: string
  valid_until: string | null
  created_at: string
}

interface AuditLog {
  action: string
  entity_type: string
  metadata: string
  created_at: string
  actor: string
}

interface TenantDetail {
  id: string
  name: string
  email: string
  clerk_user_id: string
  plan_tier: string
  max_patients: number
  created_at: string
  profile_name: string | null
  profile_email: string | null
  crp: string | null
  crp_uf: string | null
  role: string | null
}

interface Props {
  tenantId: string
  onClose: () => void
  onRefresh: () => void
}

export default function UserDetail({ tenantId, onClose, onRefresh }: Props) {
  const [loading, setLoading] = useState(true)
  const [tenant, setTenant] = useState<TenantDetail | null>(null)
  const [licenses, setLicenses] = useState<License[]>([])
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [counts, setCounts] = useState<{ tcc_patients: number; aba_learners: number } | null>(null)
  const [actionLoading, setActionLoading] = useState('')
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')

  // Ações
  const [freeProduct, setFreeProduct] = useState('tdah')
  const [upgradeProduct, setUpgradeProduct] = useState('tdah')
  const [upgradePlan, setUpgradePlan] = useState('founders')
  const [upgradeMax, setUpgradeMax] = useState(50)

  // Delete confirmation
  const [deleteStep, setDeleteStep] = useState(0)

  useEffect(() => { fetchDetail() }, [tenantId])

  const fetchDetail = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${tenantId}`)
      if (res.ok) {
        const data = await res.json()
        setTenant(data.tenant)
        setLicenses(data.licenses || [])
        setLogs(data.audit_logs || [])
        setCounts(data.counts || null)
      }
    } catch { /* silent */ }
    setLoading(false)
  }

  const doAction = async (action: string, body: Record<string, any>) => {
    setActionLoading(action)
    setError('')
    try {
      const res = await fetch(`/api/admin/users/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      })
      if (res.ok) {
        setToast(`${action} executado com sucesso`)
        setTimeout(() => setToast(''), 3000)
        fetchDetail()
        onRefresh()
      } else {
        const data = await res.json()
        setError(data.error || 'Erro')
      }
    } catch { setError('Erro de conexão') }
    setActionLoading('')
  }

  const doDelete = async () => {
    setActionLoading('delete')
    try {
      const res = await fetch(`/api/admin/users/${tenantId}`, { method: 'DELETE' })
      if (res.ok) {
        setToast('Conta deletada (LGPD)')
        setTimeout(() => { onClose(); onRefresh() }, 1500)
      } else {
        const data = await res.json()
        setError(data.error || 'Erro ao deletar')
      }
    } catch { setError('Erro de conexão') }
    setActionLoading('')
  }

  const toggleLicense = (lic: License) => {
    doAction('update_license', { license_id: lic.id, is_active: !lic.is_active })
  }

  if (loading) {
    return (
      <Modal onClose={onClose}>
        <div className="animate-pulse space-y-4 p-6">
          <div className="h-6 bg-slate-100 rounded w-1/3" />
          <div className="h-32 bg-slate-50 rounded-xl" />
        </div>
      </Modal>
    )
  }

  if (!tenant) {
    return <Modal onClose={onClose}><p className="p-6 text-red-500">Tenant não encontrado</p></Modal>
  }

  return (
    <Modal onClose={onClose}>
      <div className="p-6 max-h-[85vh] overflow-y-auto">
        {/* Toast */}
        {toast && <div className="mb-4 px-4 py-2 bg-green-50 text-green-700 text-xs font-medium rounded-lg">{toast}</div>}
        {error && <div className="mb-4 px-4 py-2 bg-red-50 text-red-600 text-xs font-medium rounded-lg">{error}</div>}

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-slate-800">{tenant.profile_name || tenant.name}</h2>
          <p className="text-sm text-slate-500">{tenant.profile_email || tenant.email}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-400">
            <div>Tenant: <span className="font-mono text-slate-600">{tenant.id.substring(0, 8)}...</span></div>
            <div>Clerk: <span className="font-mono text-slate-600">{tenant.clerk_user_id?.substring(0, 12)}...</span></div>
            <div>Registro: <span className="text-slate-600">{tenant.crp_uf && tenant.crp ? `${tenant.crp_uf}/${tenant.crp}` : tenant.crp || '—'}</span></div>
            <div>Criado: <span className="text-slate-600">{new Date(tenant.created_at).toLocaleDateString('pt-BR')}</span></div>
            <div>Plano tenant: <span className="text-slate-600">{tenant.plan_tier}</span></div>
            <div>Max pacientes: <span className="text-slate-600">{tenant.max_patients}</span></div>
          </div>
          {counts && (
            <div className="mt-2 flex gap-4 text-xs">
              <span className="text-slate-400">Pacientes TCC: <strong className="text-slate-600">{counts.tcc_patients}</strong></span>
              <span className="text-slate-400">Aprendizes ABA: <strong className="text-slate-600">{counts.aba_learners}</strong></span>
            </div>
          )}
        </div>

        {/* Licenças */}
        <div className="mb-6">
          <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Licenças</h3>
          {licenses.length === 0 ? (
            <p className="text-xs text-slate-400">Nenhuma licença</p>
          ) : (
            <div className="space-y-2">
              {licenses.map(lic => (
                <div key={lic.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase">{lic.product_type}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${lic.is_active ? (lic.hotmart_plan ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600') : 'bg-red-100 text-red-600'}`}>
                        {lic.is_active ? (lic.hotmart_plan || 'Free') : 'Inativo'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {lic.hotmart_transaction && <span>TX: {lic.hotmart_transaction.substring(0, 16)} · </span>}
                      {lic.hotmart_event && <span>{lic.hotmart_event} · </span>}
                      {new Date(lic.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleLicense(lic)}
                    disabled={actionLoading === 'update_license'}
                    className={`px-3 py-1 text-xs font-medium rounded-lg ${lic.is_active ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}
                  >
                    {lic.is_active ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="mb-6 space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Ações</h3>

          {/* Ativar FREE */}
          <div className="flex items-center gap-2">
            <select value={freeProduct} onChange={e => setFreeProduct(e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded text-xs">
              <option value="tcc">TCC</option>
              <option value="aba">ABA</option>
              <option value="tdah">TDAH</option>
            </select>
            <button
              onClick={() => doAction('activate_free', { product_type: freeProduct })}
              disabled={!!actionLoading}
              className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50"
            >
              Ativar FREE
            </button>
          </div>

          {/* Upgrade manual */}
          <div className="flex items-center gap-2 flex-wrap">
            <select value={upgradeProduct} onChange={e => setUpgradeProduct(e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded text-xs">
              <option value="tcc">TCC</option>
              <option value="aba">ABA</option>
              <option value="tdah">TDAH</option>
            </select>
            <select value={upgradePlan} onChange={e => setUpgradePlan(e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded text-xs">
              <option value="founders">Founders</option>
              <option value="clinica_100">Clínica 100</option>
              <option value="clinica_250">Clínica 250</option>
            </select>
            <input type="number" value={upgradeMax} onChange={e => setUpgradeMax(parseInt(e.target.value) || 0)} className="px-2 py-1.5 border border-slate-200 rounded text-xs w-20" placeholder="Max" />
            <button
              onClick={() => doAction('upgrade_manual', { product_type: upgradeProduct, plan_tier: upgradePlan, max_patients: upgradeMax })}
              disabled={!!actionLoading}
              className="px-3 py-1.5 text-xs font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50"
            >
              Upgrade Manual
            </button>
          </div>

          {/* Desativar todas */}
          <button
            onClick={() => doAction('deactivate_all', {})}
            disabled={!!actionLoading}
            className="px-3 py-1.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 disabled:opacity-50"
          >
            Desativar Todas as Licenças
          </button>

          {/* Delete LGPD */}
          <div className="pt-3 border-t border-slate-100">
            {deleteStep === 0 && (
              <button onClick={() => setDeleteStep(1)} className="px-3 py-1.5 text-xs font-medium bg-red-100 text-red-600 rounded-lg hover:bg-red-200">
                Deletar Conta (LGPD)
              </button>
            )}
            {deleteStep === 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 font-medium">Tem certeza? Isso é irreversível.</span>
                <button onClick={() => setDeleteStep(2)} className="px-3 py-1.5 text-xs font-bold bg-red-500 text-white rounded-lg">
                  Confirmar
                </button>
                <button onClick={() => setDeleteStep(0)} className="px-3 py-1.5 text-xs text-slate-500">
                  Cancelar
                </button>
              </div>
            )}
            {deleteStep === 2 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-700 font-bold">ÚLTIMA CONFIRMAÇÃO — todos os dados serão apagados!</span>
                <button onClick={doDelete} disabled={actionLoading === 'delete'} className="px-3 py-1.5 text-xs font-bold bg-red-600 text-white rounded-lg">
                  {actionLoading === 'delete' ? 'Deletando...' : 'DELETAR PERMANENTEMENTE'}
                </button>
                <button onClick={() => setDeleteStep(0)} className="px-3 py-1.5 text-xs text-slate-500">
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Audit Log */}
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">Histórico ({logs.length})</h3>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {logs.length === 0 && <p className="text-xs text-slate-400">Nenhum log</p>}
            {logs.map((log, i) => (
              <div key={i} className="flex items-start gap-2 py-1.5 border-b border-slate-50 last:border-0">
                <span className="text-[10px] text-slate-400 whitespace-nowrap mt-0.5">
                  {new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-[10px] text-slate-400 whitespace-nowrap mt-0.5">{log.actor}</span>
                <span className="text-xs text-slate-600 font-medium">{log.action}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-10">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        {children}
      </div>
    </div>
  )
}
