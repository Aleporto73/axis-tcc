// =====================================================
// AXIS — Página de manutenção (MAINTENANCE_MODE)
// Estática, sem auth, sem fetch. Servida via rewrite do
// middleware.ts quando MAINTENANCE_MODE=true.
// Ref: F3 — janela de rotação de segredos (NOTE_ABA).
// =====================================================

export const metadata = {
  title: 'AXIS — Em manutenção',
}

export default function ManutencaoPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="max-w-md w-full text-center">
        <div className="text-5xl mb-6" aria-hidden="true">
          🛠️
        </div>
        <h1 className="text-2xl font-semibold text-slate-800 mb-3">
          Sistema em manutenção
        </h1>
        <p className="text-slate-600 leading-relaxed">
          O AXIS está passando por uma manutenção programada e volta em
          alguns minutos. Nenhum dado clínico é afetado.
        </p>
        <p className="text-sm text-slate-400 mt-6">
          Se a manutenção demorar mais que o esperado, entre em contato
          com o suporte.
        </p>
      </div>
    </main>
  )
}
