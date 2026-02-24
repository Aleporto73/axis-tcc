import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import OpenAI from 'openai'
import pool from '@/src/database/db'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE clerk_user_id = $1',
      [userId]
    )
    if (tenantResult.rows.length === 0) {
      return NextResponse.json({ error: 'Tenant nao encontrado' }, { status: 404 })
    }
    const tenantId = tenantResult.rows[0].id

    const { transcript_id, text, session_id, patient_id } = await request.json()
    if (!text) {
      return NextResponse.json({ error: 'Texto obrigatorio' }, { status: 400 })
    }

    const prompt = `Voce e um assistente clinico especializado em Terapia Cognitivo-Comportamental (TCC), incluindo abordagens de 2a e 3a onda.

CONTEXTO:
A transcricao abaixo e de uma sessao entre um PSICOLOGO e um PACIENTE.
- Perguntas, reflexoes, intervencoes tecnicas e hipoteses = PSICOLOGO
- Relatos pessoais, narrativas, pensamentos, emocoes e descricoes de situacoes = PACIENTE

TAREFA:
Analise APENAS as falas do PACIENTE e extraia informacoes EXPLICITAMENTE verbalizadas.

REGRAS OBRIGATORIAS:
1. NAO invente informacoes
2. NAO deduza crencas ou emocoes nao verbalizadas
3. NAO interprete - apenas classifique o que foi dito
4. IGNORE completamente as falas do psicologo
5. Se algo nao estiver claro ou explicito, NAO inclua
6. Use as palavras do proprio paciente sempre que possivel
7. Evite reformular com linguagem tecnica - preserve o significado literal
8. Se o paciente apenas concordar parcialmente com hipotese do psicologo, NAO classifique como pensamento proprio
9. Se houver ambiguidade, omita
10. Maximo 5 itens por categoria - priorize os mais relevantes
11. Nao repita a mesma informacao em categorias diferentes

EXTRAIA:

1. FATOS
   Eventos concretos, situacoes objetivas relatadas pelo paciente.
   Ex: "Briguei com meu chefe ontem", "Meu filho foi mal na escola"

2. PENSAMENTOS
   Pensamentos automaticos, crencas, interpretacoes em primeira pessoa.
   Ex: "Eu sempre estrago tudo", "Ninguem me entende"

3. EMOCOES
   Sentimentos claramente nomeados pelo paciente.
   Ex: "Fiquei com raiva", "Me senti ansioso", "Tive medo"

4. COMPORTAMENTOS
   Acoes ou reacoes do paciente diante das situacoes.
   Ex: "Sai da sala", "Fiquei calado", "Evitei falar com ele"

FORMATO (JSON valido, sem texto adicional):

{
  "fatos": [],
  "pensamentos": [],
  "emocoes": [],
  "comportamentos": []
}

TEXTO DA SESSAO:
${text}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Voce e um assistente clinico especializado em analise de sessoes de TCC. Responda apenas com JSON valido, sem texto adicional.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 1500
    })

    const content = response.choices[0].message.content || '{}'
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    
    let analysis
    try {
      analysis = JSON.parse(cleanContent)
    } catch {
      analysis = { fatos: [], pensamentos: [], emocoes: [], comportamentos: [] }
    }

    if (session_id && patient_id) {
      await pool.query(
        `INSERT INTO tcc_analyses (tenant_id, patient_id, session_id, facts, thoughts, emotions, behaviors, raw_transcription)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          tenantId,
          patient_id,
          session_id,
          JSON.stringify(analysis.fatos || []),
          JSON.stringify(analysis.pensamentos || []),
          JSON.stringify(analysis.emocoes || []),
          JSON.stringify(analysis.comportamentos || []),
          text
        ]
      )
      console.log('[TCC] Analise salva no banco para sessao:', session_id)
    }

    if (transcript_id) {
      await pool.query(
        'UPDATE transcripts SET processed = true WHERE id = $1',
        [transcript_id]
      )
    }

    return NextResponse.json({
      success: true,
      analysis,
      tokens: response.usage?.total_tokens
    })

  } catch (error) {
    console.error('Erro ao analisar TCC:', error)
    return NextResponse.json({ error: 'Erro ao analisar' }, { status: 500 })
  }
}
