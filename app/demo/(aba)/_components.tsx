'use client'

import { useState } from 'react'
import Link from 'next/link'

// =====================================================
// Shared components for Demo pages
// =====================================================

export function DemoNav({ active }: { active: 'dashboard' | 'aprendizes' | 'sessoes' | 'relatorios' }) {
  const items = [
    { key: 'dashboard', label: 'Painel', href: '/demo/dashboard' },
    { key: 'aprendizes', label: 'Aprendizes', href: '/demo/aprendizes' },
    { key: 'sessoes', label: 'Sessões', href: '/demo/sessoes' },
    { key: 'relatorios', label: 'Relatórios', href: '/demo/relatorios' },
  ] as const

  return (
    <div className="flex justify-center pt-5 md:pt-6 mb-6 md:mb-8 px-4">
      <nav className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full px-3 md:px-5 py-1.5 shadow-sm">
        {items.map((item, i) => (
          <span key={item.key} className="contents">
            {i > 0 && <span className="text-slate-300 text-xs">·</span>}
            <Link
              href={item.href}
              className={`px-3 py-1 text-sm font-medium transition-colors ${
                active === item.key ? 'text-aba-500' : 'text-slate-400 hover:text-slate-600'
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

export function LockButton({ label }: { label: string }) {
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
