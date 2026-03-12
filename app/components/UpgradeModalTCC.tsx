'use client'

interface UpgradeModalTCCProps {
  open: boolean
  onClose: () => void
}

const Check = () => (
  <svg className="w-4 h-4 text-tcc-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
)

export default function UpgradeModalTCC({ open, onClose }: UpgradeModalTCCProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-tcc-accent/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-tcc-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900">
            Seu plano atual permite 1 paciente
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Para adicionar mais pacientes, assine o plano Profissional
          </p>
        </div>

        {/* Plan */}
        <div className="relative rounded-xl border-2 border-tcc-accent p-6">
          <span className="absolute -top-2.5 left-4 bg-tcc-accent text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
            Recomendado
          </span>

          <h3 className="text-lg font-semibold text-tcc-700">Profissional</h3>

          <div className="mt-3">
            <span className="text-3xl font-bold text-slate-900">R$59</span>
            <span className="text-sm text-slate-500">/mês</span>
          </div>

          <ul className="mt-5 space-y-3">
            {[
              'Pacientes ilimitados',
              'Motor CSO-TCC completo',
              'Transcrição integrada',
              'Relatórios de evolução',
              'Google Calendar (em breve)',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                <Check />
                {item}
              </li>
            ))}
          </ul>

          <a
            href="https://pay.hotmart.com/J104687347A?off=sn8ebdqc"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 block w-full py-2.5 rounded-lg bg-tcc-700 text-white text-sm font-medium text-center hover:bg-tcc-600 transition-colors"
          >
            Assinar Profissional
          </a>
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
