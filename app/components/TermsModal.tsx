'use client'

import { useState } from 'react'
import { FileText, CheckCircle, Shield } from 'lucide-react'

interface TermsModalProps {
  onAccept: () => void
  loading?: boolean
}

export default function TermsModal({ onAccept, loading }: TermsModalProps) {
  const [checked, setChecked] = useState(false)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Termo de Uso</h2>
              <p className="text-blue-100 text-sm">AXIS TCC - Sistema de Apoio Clínico</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[50vh] overflow-y-auto">
          <div className="space-y-5 text-sm text-slate-600">
            <div className="flex gap-3">
              <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-slate-800 mb-1">Natureza do Sistema</p>
                <p>O AXIS TCC é uma ferramenta digital de apoio à organização e registro da prática clínica. O sistema processa dados inseridos pelo profissional e pode utilizar recursos automatizados para estruturar informações. Não realiza diagnóstico, não emite parecer clínico e não substitui a avaliação profissional.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-slate-800 mb-1">Responsabilidade Profissional</p>
                <p>Todas as decisões clínicas, diagnósticos e condutas terapêuticas são de responsabilidade exclusiva do psicólogo usuário, conforme o Código de Ética Profissional do Psicólogo.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-slate-800 mb-1">Dados e Privacidade</p>
                <p className="mb-2">Os dados inseridos são de responsabilidade do profissional. O AXIS TCC adota medidas técnicas de segurança e mantém separação clara entre registros de autoria do profissional e cálculos automatizados do sistema.</p>
                <p className="mb-2">O sistema não concede acesso a terceiros; o eventual compartilhamento de relatórios é decisão exclusiva do profissional responsável.</p>
                <p>O tratamento das informações observa a LGPD e a Resolução CFP nº 06/2019.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-slate-800 mb-1">Cálculos e Indicadores</p>
                <p>Os indicadores e métricas exibidos são cálculos automáticos baseados nos dados informados. Não constituem avaliação clínica e devem ser interpretados exclusivamente pelo profissional.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-6 bg-slate-50">
          <label className="flex items-start gap-3 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-1 w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700">
              Declaro que compreendo que o AXIS TCC é uma ferramenta de apoio técnico e que todas as decisões clínicas são de minha exclusiva responsabilidade profissional.
            </span>
          </label>

          <button
            onClick={onAccept}
            disabled={!checked || loading}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2
              ${checked && !loading
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Aceitar e Continuar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
