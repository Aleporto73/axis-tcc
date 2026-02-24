'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const steps = [
  { title:'Bem-vindo ao AXIS Clínico', subtitle:'Plataforma clínica inteligente para ABA e TCC', description:'AXIS combina rigor científico com tecnologia para otimizar seu trabalho clínico.', icon:'🧠' },
  { title:'Cadastre seu primeiro aprendiz', subtitle:'O ponto de partida de todo tratamento', description:'Registre dados demográficos, diagnóstico (CID), nível de suporte e informações do responsável.', icon:'👤' },
  { title:'Crie protocolos baseados em evidência', subtitle:'28 práticas FPG disponíveis', description:'Cada protocolo segue um ciclo: Rascunho → Ativo → Dominado → Generalização (3×2) → Mantido → Arquivado.', icon:'📋' },
  { title:'Execute sessões em tempo real', subtitle:'DTT e Comportamento ABC', description:'Registre trials por alvo com nível de dica e percentual automático. Documente comportamentos A-B-C.', icon:'⏱️' },
  { title:'Acompanhe com CSO-ABA', subtitle:'Índice Composto com 4 dimensões', description:'Ao finalizar cada sessão, o motor calcula SAS, PIS, BSS e TCM — gerando o CSO-ABA automaticamente.', icon:'📊' },
  { title:'Relatórios para convênio', subtitle:'Conforme SBNI, RN 469, RN 541, RN 539', description:'Relatórios estruturados com dados clínicos reais e fundamentação legal. Pronto para o plano de saúde.', icon:'📄' },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(0); const router = useRouter()
  const current = steps[step]; const isLast = step === steps.length - 1
  const handleNext = () => { if (isLast) { localStorage.setItem('axis_onboarding_complete','true'); router.push('/aba') } else setStep(step+1) }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex gap-1.5 mb-8 justify-center">{steps.map((_,i) => <div key={i} className={`h-1 rounded-full transition-all ${i<=step ? 'bg-aba-500 w-8' : 'bg-slate-200 w-4'}`} />)}</div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
          <div className="text-4xl mb-4">{current.icon}</div>
          <h1 className="text-xl font-normal text-slate-800 mb-1">{current.title}</h1>
          <p className="text-sm text-aba-500 font-medium mb-4">{current.subtitle}</p>
          <p className="text-sm text-slate-500 leading-relaxed mb-8">{current.description}</p>
          <div className="flex items-center justify-between">
            {step > 0 ? <button onClick={() => setStep(step-1)} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-600">← Anterior</button> : <div />}
            <button onClick={handleNext} className="px-6 py-2.5 bg-aba-500 text-white text-sm font-medium rounded-xl hover:bg-aba-600 shadow-sm">{isLast ? 'Começar a usar →' : 'Próximo →'}</button>
          </div>
        </div>
        {!isLast && <p className="text-center mt-4"><button onClick={() => { localStorage.setItem('axis_onboarding_complete','true'); router.push('/aba') }} className="text-xs text-slate-300 hover:text-slate-500">Pular introdução</button></p>}
        <p className="text-center text-[10px] text-slate-300 mt-3">{step+1} de {steps.length}</p>
      </div>
    </div>
  )
}
