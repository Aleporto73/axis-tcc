'use client'

const STATUS_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  pago: { label: 'Pago', bg: '#dcfce7', text: '#16a34a' },
  free: { label: 'Free', bg: '#f1f5f9', text: '#64748b' },
  inativo: { label: 'Inativo', bg: '#fef2f2', text: '#dc2626' },
}

const PRODUCT_COLORS: Record<string, string> = {
  tcc: '#1e3a5f',
  aba: '#B4532F',
  tdah: '#0d7377',
}

export interface LicenseRow {
  tenant_id: string
  name: string
  email: string
  plan_tier: string
  max_patients: number
  license_id: string
  product_type: string
  is_active: boolean
  hotmart_plan: string | null
  hotmart_transaction: string | null
  hotmart_event: string | null
  license_created: string
}

interface Props {
  rows: LicenseRow[]
  total: number
  page: number
  totalPages: number
  loading: boolean
  error: string
  onPageChange: (page: number) => void
  onViewUser: (tenantId: string) => void
  filters: { search: string; product: string; status: string }
  onFilterChange: (f: Partial<Props['filters']>) => void
}

function getStatus(row: LicenseRow): string {
  if (!row.is_active) return 'inativo'
  if (row.hotmart_plan && row.hotmart_plan !== '') return 'pago'
  return 'free'
}

export default function UserTable({ rows, total, page, totalPages, loading, error, onPageChange, onViewUser, filters, onFilterChange }: Props) {
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
        <select value={filters.product} onChange={e => onFilterChange({ product: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none">
          <option value="">Todos produtos</option>
          <option value="tcc">TCC</option>
          <option value="aba">ABA</option>
          <option value="tdah">TDAH</option>
        </select>
        <select value={filters.status} onChange={e => onFilterChange({ status: e.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none">
          <option value="">Todos status</option>
          <option value="pago">Pago</option>
          <option value="free">Free</option>
          <option value="inativo">Inativo</option>
        </select>
        <span className="text-xs text-slate-400 ml-auto">{total} licença{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 text-red-600 text-sm font-medium">{error}</div>
      )}

      {/* Loading */}
      {loading && rows.length === 0 && (
        <div className="p-8"><div className="animate-pulse space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-slate-50 rounded" />)}</div></div>
      )}

      {/* Table */}
      {!loading && rows.length === 0 && !error && (
        <div className="p-8 text-center text-slate-400 text-sm">Nenhum resultado</div>
      )}

      {rows.length > 0 && (
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
              {rows.map(row => {
                const statusKey = getStatus(row)
                const badge = STATUS_BADGE[statusKey]
                return (
                  <tr key={row.license_id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-slate-700 font-medium">{row.email}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold uppercase" style={{ color: PRODUCT_COLORS[row.product_type] || '#64748b' }}>
                        {row.product_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: badge.bg, color: badge.text }}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{row.hotmart_plan || (row.is_active ? 'Free' : '—')}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{row.max_patients}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                      {row.hotmart_transaction ? row.hotmart_transaction.substring(0, 14) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {row.license_created ? new Date(row.license_created).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => onViewUser(row.tenant_id)} className="text-xs font-medium text-blue-600 hover:text-blue-800">
                        Ver
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 flex items-center justify-between">
          <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg disabled:opacity-30">
            Anterior
          </button>
          <span className="text-xs text-slate-400">Página {page} de {totalPages}</span>
          <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg disabled:opacity-30">
            Próxima
          </button>
        </div>
      )}
    </div>
  )
}
