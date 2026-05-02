'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts'

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

interface SignupDay {
  day: string
  count: number
}

interface Props {
  licensesByProduct: LicenseRow[]
  signupsByDay: SignupDay[]
}

export default function AdminCharts({ licensesByProduct, signupsByDay }: Props) {
  // Bar chart data: pagos vs free por produto
  const barData = licensesByProduct.map(r => ({
    name: r.product_type.toUpperCase(),
    Pagos: r.pagos || 0,
    Free: r.free || 0,
    Inativos: r.inativos || 0,
  }))

  // Pie chart data
  const pieData = licensesByProduct.map(r => ({
    name: `AXIS ${r.product_type.toUpperCase()}`,
    value: (r.pagos || 0) + (r.free || 0),
    color: PRODUCT_COLORS[r.product_type] || '#64748b',
  }))

  // Line chart data
  const lineData = signupsByDay.map(d => ({
    day: new Date(d.day).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    count: d.count,
  }))

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Signups por dia */}
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-3">Novos Usuários (30 dias)</h4>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={lineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="day" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Distribuição por produto */}
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-3">Distribuição por Produto</h4>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" outerRadius={65} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
              {pieData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Pagos vs Free */}
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-3">Pagos vs Free</h4>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={barData}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Bar dataKey="Pagos" fill="#16a34a" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Free" fill="#94a3b8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
