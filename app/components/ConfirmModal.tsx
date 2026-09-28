'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

// A8: modal visual do projeto para substituir window.confirm / window.prompt no
// fluxo clinico ABA. Orientado a Promise para manter os handlers async lineares:
//   const { confirmed, reason } = await requestConfirm({ ... })
// Sem biblioteca nova, seguindo o padrao de modal inline do projeto (Tailwind + aba-500).

export type ConfirmTone = 'default' | 'danger'
export type ConfirmAccent = 'aba' | 'tcc'

export type ConfirmOptions = {
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  tone?: ConfirmTone
  requireReason?: boolean
  reasonLabel?: string
  reasonPlaceholder?: string
  // Opcionais; sem eles o modal fica como sempre foi (dois botões, cor ABA).
  singleButton?: boolean // aviso: só o botão de confirmar
  accent?: ConfirmAccent // cor do botão de confirmar quando tone não é 'danger'
}

const ACCENT_BUTTON: Record<ConfirmAccent, string> = {
  aba: 'bg-aba-500 hover:bg-aba-500/90',
  tcc: 'bg-tcc-accent hover:bg-tcc-accent/90',
}

export type ConfirmResult = {
  confirmed: boolean
  reason: string
}

export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [reason, setReason] = useState('')
  const resolverRef = useRef<((result: ConfirmResult) => void) | null>(null)

  const requestConfirm = useCallback((opts: ConfirmOptions): Promise<ConfirmResult> => {
    setReason('')
    setOptions(opts)
    return new Promise<ConfirmResult>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const settle = useCallback((result: ConfirmResult) => {
    const resolve = resolverRef.current
    resolverRef.current = null
    setOptions(null)
    setReason('')
    if (resolve) resolve(result)
  }, [])

  const handleCancel = useCallback(() => settle({ confirmed: false, reason: '' }), [settle])
  const handleConfirm = useCallback(() => settle({ confirmed: true, reason: reason.trim() }), [settle, reason])

  // ESC cancela (paridade com dialogo nativo).
  useEffect(() => {
    if (!options) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [options, handleCancel])

  const reasonMissing = !!options?.requireReason && reason.trim() === ''

  const confirmModal = options ? (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={handleCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-slate-800">{options.title}</h3>
        {options.message && (
          <p className="text-xs text-slate-500 mt-2 whitespace-pre-line">{options.message}</p>
        )}
        {options.requireReason && (
          <div className="mt-3">
            {options.reasonLabel && (
              <label className="block text-[11px] font-medium text-slate-600 mb-1">{options.reasonLabel}</label>
            )}
            <textarea
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={options.reasonPlaceholder || 'Descreva o motivo'}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-aba-500 resize-none"
            />
          </div>
        )}
        <div className="flex justify-end gap-2 mt-5">
          {!options.singleButton && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50"
            >
              {options.cancelText || 'Cancelar'}
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={reasonMissing}
            className={
              'px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 ' +
              (options.tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : ACCENT_BUTTON[options.accent ?? 'aba'])
            }
          >
            {options.confirmText || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { requestConfirm, confirmModal }
}
