'use client'

import { useState, useRef, useCallback, useEffect, ReactNode } from 'react'
import { TOOLTIPS_TDAH, TooltipTDAHKey } from '@/lib/tooltips-tdah'

// =====================================================
// AXIS TDAH — Tooltip Educativo
// Espelho do Tooltip ABA, com paleta teal (#0d7377).
// Delay 300ms, posição auto (top/bottom), seta, ícone ?.
// =====================================================

interface TooltipTDAHProps {
  /** Chave do texto em lib/tooltips-tdah.ts */
  tip: TooltipTDAHKey
  /** Elemento filho que recebe o tooltip no hover */
  children: ReactNode
  /** Mostrar ícone ? ao lado do children (default: false) */
  icon?: boolean
  /** Posição forçada (default: auto) */
  position?: 'top' | 'bottom'
}

export default function TooltipTDAH({ tip, children, icon = false, position }: TooltipTDAHProps) {
  const text = TOOLTIPS_TDAH[tip]
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState<'top' | 'bottom'>(position || 'top')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLSpanElement>(null)

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      if (!position && wrapRef.current) {
        const rect = wrapRef.current.getBoundingClientRect()
        setPos(rect.top < 80 ? 'bottom' : 'top')
      }
      setVisible(true)
    }, 300)
  }, [position])

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisible(false)
  }, [])

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex items-center gap-0.5"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {icon && (
        <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-teal-100/70 text-teal-600 text-[9px] font-bold leading-none cursor-help shrink-0 ml-0.5">
          ?
        </span>
      )}
      {visible && (
        <div
          role="tooltip"
          className={`
            absolute z-50 px-3 py-2 text-[11px] leading-relaxed font-normal
            max-w-[280px] w-max rounded-md
            bg-[#E0F2F1] text-[#004D40] border border-[#80CBC4]
            shadow-[0_2px_8px_rgba(0,0,0,0.1)]
            pointer-events-none
            ${pos === 'top'
              ? 'bottom-full left-1/2 -translate-x-1/2 mb-2'
              : 'top-full left-1/2 -translate-x-1/2 mt-2'
            }
          `}
        >
          {text}
          {/* Seta */}
          <span
            className={`
              absolute left-1/2 -translate-x-1/2 w-2 h-2
              bg-[#E0F2F1] border-[#80CBC4] rotate-45
              ${pos === 'top'
                ? 'top-full -mt-1 border-r border-b'
                : 'bottom-full -mb-1 border-l border-t'
              }
            `}
          />
        </div>
      )}
    </span>
  )
}

/**
 * Ícone ? standalone para uso inline.
 * Uso: <HelpTipTDAH tip="sas" />
 */
export function HelpTipTDAH({
  tip,
  className,
}: {
  tip: TooltipTDAHKey
  className?: string
}) {
  return (
    <TooltipTDAH tip={tip}>
      <span
        className={`inline-flex items-center justify-center w-4 h-4 rounded-full bg-teal-100/70 text-teal-600 text-[10px] font-bold leading-none cursor-help ${className || ''}`}
      >
        ?
      </span>
    </TooltipTDAH>
  )
}
