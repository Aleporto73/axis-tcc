'use client'

import { useState } from 'react'

const STATUS_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  pago: { label: 'Pago', bg: '#dcfce7', text: '#16a34a' },
  free: { label: 'Free', bg: '#f1f5f9', text: '#64748b' },
  inativo: { label: 'Inativo', bg: '#fef2f2', text: '#dc2626' },
}

interface License {
  id: string
  product_type: string
  is_active: boolean
  hotmart_plan: string | null
  hotmart_transaction: string | null
  hotmart_offer: string | null
  buyer_email: string | null
  created_at: string
}

interface User {
  tenant_id: string
  tenant_name: string
  tenant_email: string
  profile_name: string | null
  profile_email: string | null
  plan_tier: string
  max_patients: number
  tenant_created: string
  licenses: License[] | null
}

interface Props {
  users: User[]
  total: number
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  onViewUser: (tenantId: string) => void
  filters: { search: string; product: string; status: string }
  onFilterChange: (f: Partial<Props['filters']>) => void
}

export default function UserTable({ users, total, page, totalPages, onPageChange, onViewUser, filters, onFilterChange }: Props) {
  // Flatten: one row per license
  const rows: Array<{ user: User; license: License | null }> = []
  for (const user of users) {
    if (user.licenses && user.licenses.length > 0) {
      for (const lic of user.licenses) {
        rows.push({ user, license: lic })
      }
    } else {
      rows.push({ user, license: null })
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100">
      {/* Filters */}
      <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Buscar por email..."
          value={filters.search}
          onChange={e => onFilterChange({ search: e.target.value })}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-64 focus:outline-none focus:border-slate-400"
        />
        <select
          value={filters.product}
          onChange={e => onFilterChange({ product: e.target.value })}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
        >
          <option value="">Todos produtos</option>
          <option value="tcc">TCC</option>
          <option value="aba">ABA</option>
          <option value="tdah">TDAH</option>
        </select>
        <select
          value={filters.status}
          onChange={e => onFilterChange({ status: e.target.value })}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
        >
          <option value="">Todos status</option>
          <option value="pago">Pago</option>
          <option value="free">Free</option>
          <option value="inativo">Inativo</option>
        </select>
        <span className="text-xs text-slate-400 ml-auto">{total} resultado{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left">
              <th className="px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase">Email</th>
              <th className="px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase">Produto</th>
              <th className="px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase">Status</th>
              <th className="px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase">Plano</th>
              <th className="px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase">Limite</th>
              <th className="px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase">Transação</th>
              <th className="px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase">Criado</th>
              <th className="px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Nenhum resultado</td></tr>
            )}
            {rows.map((row, i) => {
              const lic = row.license
              const statusKey = lic ? (lic.is_active ? (lic.hotmart_plan ? 'pago' : 'free') : 'inativo') : 'inativo'
              const badge = STATUS_BADGE[statusKey]
              return (
                <tr key={`${row.user.tenant_id}-${lic?.id || i}`} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-slate-700 font-medium">{row.user.profile_email || row.user.tenant_email}</td>
                  <td className="px-4 py-3">
                    {lic ? (
                      <span className="text-xs font-bold uppercase">{lic.product_type}</span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: badge.bg, color: badge.text }}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{lic?.hotmart_plan || (lic?.is_active ? 'Free' : '—')}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{row.user.max_patients}</td>
                  <td className="px-4 py-3 text-xs text-slate-400 font-mono">{lic?.hotmart_transaction ? lic.hotmart_transaction.substring(0, 12) + '...' : '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{lic?.created_at ? new Date(lic.created_at).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onViewUser(row.user.tenant_id)}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg disabled:opacity-30"
          >
            Anterior
          </button>
          <span className="text-xs text-slate-400">Página {page} de {totalPages}</span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg disabled:opacity-30"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  )
}
