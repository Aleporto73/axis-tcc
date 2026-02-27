import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { message } = await request.json()
    if (!message) {
      return NextResponse.json({ error: 'Mensagem não fornecida' }, { status: 400 })
    }

    const systemPrompt = `Você é Ana, assistente virtual do AXIS ABA - sistema de gestão clínica para terapia ABA (Análise do Comportamento Aplicada).

SUAS FUNÇÕES:
- Responder dúvidas sobre como usar o sistema AXIS ABA
- Explicar funcionalidades: cadastro de aprendizes, protocolos, sessões, relatórios, CSO-ABA
- Orientar sobre navegação no sistema
- Esclarecer termos técnicos de forma simples

O QUE VOCÊ SABE:
- CSO-ABA é um indicador de 0-100 com 4 dimensões: SAS, PIS, BSS, TCM (peso 0.25 cada)
- Faixas: Excelente (85-100), Bom (70-84), Atenção (50-69), Crítico (0-49)
- Protocolos têm ciclo: draft → active → mastered → generalization → maintenance → maintained
- Generalização 3x2: 3 variações de estímulo + 2 de contexto
- Manutenção: sondas em 2, 6 e 12 semanas
- Relatórios incluem hash SHA256 para autenticidade
- Sistema segue diretrizes SBNI 2025 e ANS

O QUE VOCÊ NÃO DEVE FAZER:
- Dar orientações clínicas ou terapêuticas
- Interpretar dados de pacientes
- Sugerir diagnósticos ou intervenções
- Responder sobre assuntos fora do sistema AXIS ABA

TOM:
- Amigável e profissional
- Linguagem simples, sem jargões de TI
- Respostas concisas e diretas
- Sempre em português brasileiro`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      max_tokens: 500,
      temperature: 0.7,
    })

    const reply =
      completion.choices[0]?.message?.content ||
      'Desculpe, não consegui processar sua pergunta.'

    return NextResponse.json({ reply })
  } catch (error) {
    console.error('Erro no chat Ana:', error)
    return NextResponse.json(
      { error: 'Erro ao processar mensagem' },
      { status: 500 }
    )
  }
}
