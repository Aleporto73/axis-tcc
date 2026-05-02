'use client'

const PRODUCT_COLORS: Record<string, string> = {
  tcc: '#1e3a5f',
  aba: '#B4532F',
  tdah: '#0d7377',
}

interface LicenseRow {
  product_type: string
  pagos: number
  free: number
  inativos: number
}

interface Props {
  tenantsTotal: number
  newToday: number
  webhookErrors: number
  licensesByProduct: LicenseRow[]
}

export default function AdminStats({ tenantsTotal, newToday, webhookErrors, licensesByProduct }: Props) {
  const totalPagos = licensesByProduct.reduce((s, r) => s + (r.pagos || 0), 0)
  const totalFree = licensesByProduct.reduce((s, r) => s + (r.free || 0), 0)

  return (
    <div className="space-y-4">
      {/* Row 1: Big numbers */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card label="Total Usuários" value={tenantsTotal} />
        <Card label="Licenças Pagas" value={totalPagos} color="#16a34a" />
        <Card label="Licenças FREE" value={totalFree} color="#6b7280" />
        <Card label="Novos (24h)" value={newToday} color="#2563eb" />
        <Card label="Webhook Erros (24h)" value={webhookErrors} color={webhookErrors > 0 ? '#dc2626' : '#6b7280'} alert={webhookErrors > 0} />
      </div>

      {/* Row 2: Per product */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['tcc', 'aba', 'tdah'].map(p => {
          const row = licensesByProduct.find(r => r.product_type === p)
          return (
            <div key={p} className="bg-white rounded-xl border border-slate-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PRODUCT_COLORS[p] }} />
                <span className="text-xs font-bold text-slate-500 uppercase">AXIS {p.toUpperCase()}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-green-600">{row?.pagos || 0}</p>
                  <p className="text-[10px] text-slate-400">Pagos</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-500">{row?.free || 0}</p>
                  <p className="text-[10px] text-slate-400">Free</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-red-400">{row?.inativos || 0}</p>
                  <p className="text-[10px] text-slate-400">Inativos</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Card({ label, value, color, alert }: { label: string; value: number; color?: string; alert?: boolean }) {
  return (
    <div className={`bg-white rounded-xl border p-4 ${alert ? 'border-red-300 bg-red-50' : 'border-slate-100'}`}>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: color || '#1e293b' }}>{value}</p>
    </div>
  )
}
