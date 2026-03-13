'use client'

// =====================================================
// AXIS TDAH - Dashboard (Placeholder)
// Será expandido na Fase 3 com métricas reais
// =====================================================

export default function TDAHDashboard() {
  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">
          Painel TDAH
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Visão geral do módulo de intervenção comportamental em TDAH
        </p>
      </div>

      {/* Placeholder cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { label: 'Pacientes ativos', value: '—', desc: 'Em breve' },
          { label: 'Sessões este mês', value: '—', desc: 'Em breve' },
          { label: 'Protocolos ativos', value: '—', desc: 'Em breve' },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl border border-slate-100 p-6"
            style={{ borderTopColor: '#0d7377', borderTopWidth: '3px' }}
          >
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              {card.label}
            </p>
            <p className="text-3xl font-bold text-slate-800 mt-2">
              {card.value}
            </p>
            <p className="text-xs text-slate-400 mt-1">{card.desc}</p>
          </div>
        ))}
      </div>

      {/* Status card */}
      <div className="bg-white rounded-xl border border-slate-100 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: '#0d7377' }}
          />
          <h2 className="text-sm font-semibold text-slate-700">
            Módulo em construção
          </h2>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed">
          O AXIS TDAH está em fase de implementação. O motor CSO-TDAH v1.0 já está
          operacional com 3 blocos (Base, Executiva e AuDHD) e 46 protocolos clínicos
          cadastrados. As páginas de pacientes, sessões e relatórios serão habilitadas
          nas próximas fases.
        </p>
      </div>
    </div>
  )
}
