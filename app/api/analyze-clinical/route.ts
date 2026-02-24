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

    const { transcript, patientName } = await request.json()

    if (!transcript) {
      return NextResponse.json({ error: 'Transcrição não fornecida' }, { status: 400 })
    }

    const systemPrompt = `Você está processando um REGISTRO CLÍNICO INICIAL ASSISTIDO.

CONTEXTO:
Este é um registro retrospectivo livre, gravado pelo profissional de saúde mental ANTES do início das sessões no sistema. O objetivo é preservar contexto histórico do caso, não analisar ou diagnosticar.

REGRAS ABSOLUTAS (não negociáveis):
- NÃO interpretar clinicamente
- NÃO inferir diagnósticos (mesmo que o profissional mencione sintomas)
- NÃO classificar ou rotular (ex: nunca escrever "TDAH", escrever "dificuldades atencionais referidas")
- NÃO gerar padrões comportamentais
- NÃO sugerir intervenções
- NÃO corrigir ou julgar a linguagem do profissional
- NÃO transformar relato em análise estruturada
- PRESERVAR a natureza descritiva e retrospectiva

LINGUAGEM OBRIGATÓRIA:
- Usar sempre linguagem passiva e descritiva
- Preferir "referido", "relatado", "mencionado", "informado"
- Evitar termos diagnósticos fechados
- Manter tom neutro e respeitoso

TRANSFORMAÇÕES OBRIGATÓRIAS:
- "TDAH" → "dificuldades atencionais referidas"
- "Depressão" → "sintomas depressivos relatados"
- "Ansiedade" → "sintomas ansiosos mencionados"
- "Trauma" → "evento traumático referido"
- "Borderline" → "instabilidade emocional relatada"
- Diagnósticos CID/DSM → "hipótese diagnóstica informada pelo profissional"

O CONTEÚDO PODE CONTER (aceitar sem julgar):
- Eventos de vida relevantes
- Diagnósticos informados pelo profissional
- Hipóteses clínicas iniciais
- Observações subjetivas
- Linguagem técnica ou coloquial
- Dados incompletos ou provisórios

CAMPOS A EXTRAIR:
1. complaint → Renomear mentalmente para "Evento ou contexto inicial relatado"
2. patterns → Renomear mentalmente para "Aspectos mencionados no histórico"
3. interventions → Renomear mentalmente para "Intervenções prévias relatadas"
4. current_state → Renomear mentalmente para "Situação atual conforme relato"

IMPORTANTE:
- Se algo não foi mencionado, deixar o campo VAZIO (não inventar)
- Manter fidelidade ao que foi DITO, não ao que poderia ser inferido
- Este registro NÃO participa de análises longitudinais ou sugestões automáticas`

    const userPrompt = `Transcrição do profissional sobre o paciente:

"""
${transcript}
"""

Extraia as informações seguindo RIGOROSAMENTE as regras do sistema.

Responda APENAS em JSON válido:
{
  "complaint": "...",
  "patterns": "...",
  "interventions": "...",
  "current_state": "..."
}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 1000,
    })

    const content = completion.choices[0]?.message?.content || '{}'
    
    let parsed
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    } catch {
      parsed = { complaint: '', patterns: '', interventions: '', current_state: '' }
    }

    return NextResponse.json({
      complaint: parsed.complaint || '',
      patterns: parsed.patterns || '',
      interventions: parsed.interventions || '',
      current_state: parsed.current_state || '',
    })
  } catch (error) {
    console.error('Erro na análise clínica:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
