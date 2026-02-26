'use client'

interface UpgradeModalProps {
  open: boolean
  onClose: () => void
}

const Check = () => (
  <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
)

export default function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center">
            <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900">
            Seu plano atual permite 1 aprendiz
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Para adicionar mais aprendizes, escolha um plano
          </p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* AXIS Clínica 100 */}
          <div className="relative rounded-xl border-2 border-orange-400 p-5">
            <span className="absolute -top-2.5 left-4 bg-orange-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
              Fundadores
            </span>

            <h3 className="text-base font-semibold text-slate-900">AXIS Clínica 100</h3>

            <div className="mt-3">
              <span className="text-sm text-slate-400 line-through mr-1">R$297</span>
              <span className="text-2xl font-bold text-slate-900">R$147</span>
              <span className="text-sm text-slate-500">/mês</span>
            </div>

            <ul className="mt-4 space-y-2">
              {['Até 100 aprendizes', 'Multi-terapeuta', 'Motor CSO-ABA completo', 'Suporte prioritário'].map((item) => (
                <li key={item} className="flex items-center gap-2 text-xs text-slate-600">
                  <Check />
                  {item}
                </li>
              ))}
            </ul>

            <button
              type="button"
              className="mt-5 w-full py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors cursor-default"
            >
              Quero ser Fundador
            </button>
          </div>

          {/* AXIS Clínica 250 */}
          <div className="rounded-xl border border-slate-200 p-5">
            <h3 className="text-base font-semibold text-slate-900">AXIS Clínica 250</h3>

            <div className="mt-3">
              <span className="text-2xl font-bold text-slate-900">R$497</span>
              <span className="text-sm text-slate-500">/mês</span>
            </div>

            <ul className="mt-4 space-y-2">
              {['Até 250 aprendizes', 'Múltiplas unidades', 'Relatórios consolidados', 'Onboarding dedicado'].map((item) => (
                <li key={item} className="flex items-center gap-2 text-xs text-slate-600">
                  <Check />
                  {item}
                </li>
              ))}
            </ul>

            <button
              type="button"
              className="mt-5 w-full py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors cursor-default"
            >
              Falar com consultor
            </button>
          </div>
        </div>

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full text-center py-2.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          Continuar no plano atual
        </button>
      </div>
    </div>
  )
}
