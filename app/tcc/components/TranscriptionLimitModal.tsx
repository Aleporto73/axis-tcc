'use client'

import { useState } from 'react'

// =====================================================
// Modal de limite de transcrição atingido
// Aparece quando FREE atinge 50 min/mês
// =====================================================

const TCC_COLOR = '#1e3a5f'
const HOTMART_URL = 'https://pay.hotmart.com/YOUR_TCC_OFFER_CODE'

interface Props {
  onClose: () => void
}

export default function TranscriptionLimitModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* Icon */}
        <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-red-50 flex items-center justify-center">
          <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h2 className="text-lg font-semibold text-slate-800 text-center mb-2">
          Limite de transcrição atingido
        </h2>
        <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">
          Você utilizou seus 50 minutos gratuitos de transcrição este mês. Para continuar transcrevendo sessões, assine o AXIS TCC.
        </p>

        {/* CTA */}
        <a
          href={HOTMART_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-3 px-4 text-center text-sm font-semibold text-white rounded-xl transition-all hover:opacity-90"
          style={{ backgroundColor: TCC_COLOR }}
        >
          Assinar AXIS TCC
        </a>

        <button
          onClick={onClose}
          className="w-full mt-3 py-2 px-4 text-sm text-slate-400 hover:text-slate-600 transition-colors text-center"
        >
          Continuar no plano atual
        </button>

        <p className="text-[10px] text-slate-300 text-center mt-4">
          Seu limite renova no primeiro dia do próximo mês.
        </p>
      </div>
    </div>
  )
}
