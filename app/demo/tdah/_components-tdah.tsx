'use client'

import { useState } from 'react'
import Link from 'next/link'

// =====================================================
// Shared components for TDAH Demo pages
// Paleta: #0d7377 (teal TDAH)
// =====================================================

const teal = '#0d7377'

export function DemoNavTDAH({ active }: { active: 'dashboard' | 'pacientes' | 'sessoes' | 'relatorios' }) {
  const items = [
    { key: 'dashboard', label: 'Painel', href: '/demo/tdah/dashboard' },
    { key: 'pacientes', label: 'Pacientes', href: '/demo/tdah/pacientes' },
    { key: 'sessoes', label: 'Sessões', href: '/demo/tdah/sessoes' },
    { key: 'relatorios', label: 'Relatórios', href: '/demo/tdah/relatorios' },
  ] as const

  return (
    <div className="flex justify-center pt-5 md:pt-6 mb-6 md:mb-8 px-4">
      <nav className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-3 md:px-5 py-1.5 shadow-sm">
        {items.map((item, i) => (
          <span key={item.key} className="contents">
            {i > 0 && <span className="text-slate-300 text-xs">&middot;</span>}
            <Link
              href={item.href}
              className={`px-3 py-1 text-sm font-medium transition-colors ${
                active === item.key ? 'text-[#0d7377]' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {item.label}
            </Link>
          </span>
        ))}
      </nav>
    </div>
  )
}

export function LockButtonTDAH({ label }: { label: string }) {
  const [tip, setTip] = useState(false)
  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setTip(true)}
        onMouseLeave={() => setTip(false)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 border border-slate-200 rounded-lg bg-slate-50 cursor-not-allowed"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        {label}
      </button>
      {tip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[11px] text-center rounded-lg shadow-xl z-50 pointer-events-none">
          Disponível na versão completa
        </div>
      )}
    </div>
  )
}

/* ─── Context badge ─── */
const ctxBg: Record<string, string> = {
  clinical: 'bg-[#0d7377]/10 text-[#0d7377]',
  home: 'bg-purple-50 text-purple-600',
  school: 'bg-blue-50 text-blue-600',
}
const ctxLabel: Record<string, string> = {
  clinical: 'Clínico',
  home: 'Domiciliar',
  school: 'Escolar',
}
export function ContextBadge({ context }: { context: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${ctxBg[context] || 'bg-slate-100 text-slate-500'}`}>
      {ctxLabel[context] || context}
    </span>
  )
}

/* ─── AuDHD badge ─── */
export function AuDHDBadge({ layer }: { layer: string }) {
  if (layer === 'off') return null
  const label = layer === 'active_core' ? 'AuDHD Core' : 'AuDHD Full'
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-600 border border-purple-200">
      {label}
    </span>
  )
}
