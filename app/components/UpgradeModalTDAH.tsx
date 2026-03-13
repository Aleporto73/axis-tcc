'use client'

// =====================================================
// AXIS TDAH - Modal de Upgrade (Free Tier Gate)
// Exibido quando o limite de pacientes é atingido.
// Hotmart product_id: 7380571
// =====================================================

const TDAH_COLOR = '#0d7377'

interface UpgradeModalTDAHProps {
  open: boolean
  onClose: () => void
}

const Check = () => (
  <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
)

export default function UpgradeModalTDAH({ open, onClose }: UpgradeModalTDAHProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${TDAH_COLOR}15` }}>
            <svg className="w-6 h-6" style={{ color: TDAH_COLOR }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900">
            Seu plano atual permite 1 paciente
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Para adicionar mais pacientes, faça upgrade para um plano pago
          </p>
        </div>

        {/* Plan Card — Founders (melhor custo-benefício) */}
        <div className="rounded-xl border-2 p-5" style={{ borderColor: TDAH_COLOR }}>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">AXIS TDAH Founders</h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: TDAH_COLOR }}>
              Recomendado
            </span>
          </div>

          <p className="mt-1 text-sm text-slate-500">
            <span className="text-2xl font-bold text-slate-900">R$97</span>
            <span className="text-xs text-slate-400">/mês</span>
            <span className="ml-2 text-xs text-slate-400">· até 50 pacientes</span>
          </p>

          <ul className="mt-4 space-y-2">
            {[
              'Até 50 pacientes ativos',
              'Multi-terapeuta',
              'Layer AuDHD completa',
              'DRC escolar',
              'Motor CSO-TDAH v1.0',
              'Suporte prioritário',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-xs text-slate-600">
                <Check />
                {item}
              </li>
            ))}
          </ul>

          <a
            href="https://pay.hotmart.com/F104897641O?off=xqzgdn1i"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 block w-full py-2 rounded-lg text-white text-sm font-medium text-center transition-opacity hover:opacity-90"
            style={{ backgroundColor: TDAH_COLOR }}
          >
            Assinar Founders — R$97/mês
          </a>
        </div>

        {/* Other plans link */}
        <a
          href="/tdah/precos"
          className="mt-4 block w-full text-center py-2 text-sm font-medium transition-colors hover:underline"
          style={{ color: TDAH_COLOR }}
        >
          Ver todos os planos (Clínica 100, Clínica 250)
        </a>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full text-center py-2.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          Continuar no plano atual
        </button>
      </div>
    </div>
  )
}
