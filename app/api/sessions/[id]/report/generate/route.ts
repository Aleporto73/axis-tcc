import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import crypto from 'crypto'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import { readTranscriptSmart } from '@/src/services/transcript-storage'
import { getTranscriptionUsage } from '@/src/services/transcription-limit'
import { getAnalyzeUsage, recordAnalyzeUsage } from '@/src/services/analyze-limit'
import { env } from '@/src/lib/env'
import type { PoolClient } from 'pg'
import * as Sentry from '@sentry/nextjs'

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
})

/**
 * POST /api/sessions/[id]/report/generate
 * Gera relatorio clinico + insights via IA (GPT-4o-mini).
 * Auto-analise: se nao existir analise TCC, roda internamente.
 * Ref: AXIS TCC Sessao v2 - Fase 1
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params

    const result = await withTenant(async (ctx) => {
      const { client, tenantId } = ctx

      // Fase 12.2: bloquear geracao se limite FREE atingido (antes de qualquer OpenAI call)
      const usage = await getTranscriptionUsage(client, tenantId)
      if (usage.limit_reached) {
        return NextResponse.json({
          error: 'LIMIT_REACHED',
          message: 'Voce atingiu o limite gratuito de 300 minutos de transcricao. Faca upgrade para gerar relatorios.',
          minutes_used: usage.minutes_used,
          limit: usage.limit,
        }, { status: 402 })
      }

      // 1. Buscar sessao + paciente
      const sessionResult = await client.query(
        `SELECT s.id, s.patient_id, s.session_number, s.session_type,
                s.scheduled_at, s.started_at, s.duration_minutes, s.status,
                p.full_name as patient_name
         FROM sessions s
         JOIN patients p ON p.id = s.patient_id
         WHERE s.id = $1 AND s.tenant_id = $2`,
        [sessionId, tenantId]
      )

      if (sessionResult.rows.length === 0) {
        return NextResponse.json({ error: 'Sessao nao encontrada' }, { status: 404 })
      }

      const session = sessionResult.rows[0]

      // 2. Buscar transcricao completa
      const transcriptResult = await client.query(
        `SELECT id, final_path, transcript_path, raw_path, text, text_preview
         FROM transcripts
         WHERE session_id = $1 AND tenant_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [sessionId, tenantId]
      )

      let transcriptionText = ''
      if (transcriptResult.rows[0]) {
        try {
          transcriptionText = await readTranscriptSmart(transcriptResult.rows[0])
        } catch {
          transcriptionText = transcriptResult.rows[0].text
            || transcriptResult.rows[0].text_preview
            || ''
        }
      }

      // 3. Buscar analise TCC existente — se nao existir, rodar internamente
      let analysisData: AnalysisData = { fatos: [], pensamentos: [], emocoes: [], comportamentos: [] }
      const analysisResult = await client.query(
        `SELECT facts, thoughts, emotions, behaviors
         FROM tcc_analyses
         WHERE session_id = $1 AND tenant_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [sessionId, tenantId]
      )

      if (analysisResult.rows.length > 0) {
        const row = analysisResult.rows[0]
        analysisData = {
          fatos: safeParseJson(row.facts, []),
          pensamentos: safeParseJson(row.thoughts, []),
          emocoes: safeParseJson(row.emotions, []),
          comportamentos: safeParseJson(row.behaviors, []),
        }
      } else if (transcriptionText) {
        // Auto-analise: rodar analise TCC internamente
        // Item 2 Onda 7: governance unificada (quota, audit, timeout) - mesmo
        // pattern de /api/analyze-tcc mas chamado server-side sem fetch.
        analysisData = await runTccAnalysis(client, {
          tenantId,
          userId: ctx.userId,
          sessionId,
          patientId: session.patient_id,
          text: transcriptionText,
        })

        // Persistir analise para nao recalcular
        if (session.patient_id) {
          await client.query(
            `INSERT INTO tcc_analyses (tenant_id, patient_id, session_id, facts, thoughts, emotions, behaviors, raw_transcription)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              tenantId,
              session.patient_id,
              sessionId,
              JSON.stringify(analysisData.fatos),
              JSON.stringify(analysisData.pensamentos),
              JSON.stringify(analysisData.emocoes),
              JSON.stringify(analysisData.comportamentos),
              transcriptionText
            ]
          )
        }
      }

      // 4. Buscar micro-eventos da sessao
      const eventsResult = await client.query(
        `SELECT event_type, payload, created_at
         FROM events
         WHERE related_entity_id = $1 AND tenant_id = $2
         AND event_type IN (
           'AVOIDANCE_OBSERVED', 'CONFRONTATION_OBSERVED',
           'ADJUSTMENT_OBSERVED', 'RECOVERY_OBSERVED',
           'TASK_COMPLETED', 'TASK_INCOMPLETE', 'MOOD_CHECK'
         )
         ORDER BY created_at`,
        [sessionId, tenantId]
      )

      const microEvents = eventsResult.rows.map((e: { event_type: string; payload: unknown }) => (
        `${e.event_type}${e.payload ? ` (${JSON.stringify(e.payload)})` : ''}`
      ))

      // 5. Buscar resumo da sessao anterior
      let previousSummary = ''
      const prevResult = await client.query(
        `SELECT sr.summary, sr.headline
         FROM session_reports sr
         JOIN sessions s ON s.id = sr.session_id
         WHERE s.patient_id = $1 AND s.tenant_id = $2
           AND s.session_number < $3
         ORDER BY s.session_number DESC LIMIT 1`,
        [session.patient_id, tenantId, session.session_number || 999]
      )

      if (prevResult.rows.length > 0) {
        const prev = prevResult.rows[0]
        previousSummary = prev.headline
          ? `${prev.headline}\n${prev.summary || ''}`
          : prev.summary || ''
      }

      // 6. Verificar se temos conteudo suficiente
      if (!transcriptionText && analysisData.fatos.length === 0) {
        return NextResponse.json(
          { error: 'Sem transcricao ou analise TCC para gerar relatorio' },
          { status: 400 }
        )
      }

      // 7. Montar prompt
      const sessionDate = session.started_at || session.scheduled_at || ''
      const formattedDate = sessionDate
        ? new Date(sessionDate).toLocaleDateString('pt-BR')
        : 'N/A'

      const prompt = buildReportPrompt({
        patientName: session.patient_name,
        sessionNumber: session.session_number,
        sessionDate: formattedDate,
        duration: session.duration_minutes,
        sessionType: session.session_type,
        transcription: transcriptionText,
        analysis: analysisData,
        microEvents,
        previousSummary,
      })

      // 8. Chamar OpenAI
      const promptHash = crypto.createHash('sha256').update(prompt).digest('hex')

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Voce e um assistente clinico que gera relatorios de sessoes de TCC. Responda APENAS com JSON valido, sem markdown, sem texto adicional.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      })

      const content = response.choices[0].message.content || '{}'

      let reportData: ReportGeneration
      try {
        reportData = JSON.parse(content)
      } catch {
        return NextResponse.json(
          { error: 'Falha ao parsear resposta da IA' },
          { status: 500 }
        )
      }

      // 9. Validar headline
      if (reportData.headline && reportData.headline.length > 120) {
        reportData.headline = reportData.headline.slice(0, 120)
      }

      // 10. UPSERT na session_reports
      const existing = await client.query(
        'SELECT id FROM session_reports WHERE session_id = $1 AND tenant_id = $2',
        [sessionId, tenantId]
      )

      let report
      const insightsJson = JSON.stringify(reportData.insights || {})

      if (existing.rows.length > 0) {
        // Regeneracao: UPDATE
        const updateResult = await client.query(
          `UPDATE session_reports
           SET headline = $1, objectives = $2, summary = $3,
               intervention = $4, observations = $5, closing = $6,
               insights = $7::jsonb, status = 'draft', generated_by = 'ai',
               ai_model = 'gpt-4o-mini', generation_prompt_hash = $8,
               updated_at = NOW()
           WHERE session_id = $9 AND tenant_id = $10
           RETURNING id, session_id, headline, objectives, summary,
                     intervention, observations, closing, insights,
                     status, generated_by, ai_model,
                     created_at, updated_at, exported_at, export_count`,
          [
            reportData.headline || null,
            reportData.objectives || '',
            reportData.summary || '',
            reportData.intervention || '',
            reportData.observations || null,
            reportData.closing || null,
            insightsJson,
            promptHash,
            sessionId,
            tenantId,
          ]
        )
        report = updateResult.rows[0]
      } else {
        // Primeira geracao: INSERT
        const insertResult = await client.query(
          `INSERT INTO session_reports (
             session_id, tenant_id, headline, objectives, summary,
             intervention, observations, closing, insights,
             status, generated_by, ai_model, generation_prompt_hash
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, 'draft', 'ai', 'gpt-4o-mini', $10)
           RETURNING id, session_id, headline, objectives, summary,
                     intervention, observations, closing, insights,
                     status, generated_by, ai_model,
                     created_at, updated_at, exported_at, export_count`,
          [
            sessionId,
            tenantId,
            reportData.headline || null,
            reportData.objectives || '',
            reportData.summary || '',
            reportData.intervention || '',
            reportData.observations || null,
            reportData.closing || null,
            insightsJson,
            promptHash,
          ]
        )
        report = insertResult.rows[0]
      }

      return NextResponse.json({
        report,
        tokens: response.usage?.total_tokens,
      })
    })

    return result
  } catch (error) {
    Sentry.captureException(error)
    console.error('Erro ao gerar relatorio:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

// =====================================================
// Tipos
// =====================================================

interface ReportGeneration {
  headline: string
  objectives: string
  summary: string
  intervention: string
  observations: string
  closing: string
  insights: {
    emotions: Array<{ name: string; intensity: number }>
    topics: string[]
    distortions: Array<{ type: string; label: string; example: string }>
    techniques_identified: string[]
  }
}

interface AnalysisData {
  fatos: string[]
  pensamentos: string[]
  emocoes: string[]
  comportamentos: string[]
}

interface PromptInput {
  patientName: string
  sessionNumber: number | null
  sessionDate: string
  duration: number | null
  sessionType: string | null
  transcription: string
  analysis: AnalysisData
  microEvents: string[]
  previousSummary: string
}

// =====================================================
// Helpers
// =====================================================

function safeParseJson<T>(value: unknown, fallback: T): T {
  if (Array.isArray(value)) return value as T
  if (typeof value === 'string') {
    try { return JSON.parse(value) } catch { return fallback }
  }
  return fallback
}


// Limite tamanho do texto (50K chars ~ 12.5K tokens em GPT-4o-mini)
const RUN_TCC_MAX_TEXT_LENGTH = 50_000
// Timeout OpenAI
const RUN_TCC_TIMEOUT_MS = 30_000

interface RunTccAnalysisParams {
  tenantId: string
  userId: string
  sessionId: string
  patientId: string | null
  text: string
}

/**
 * Auto-analise TCC: roda a mesma logica do /api/analyze-tcc mas server-side,
 * sem fetch HTTP para si mesmo.
 *
 * Item 2 Onda 7 (Opcao B): governance unificada igual ao endpoint publico —
 * size cap, quota check (getAnalyzeUsage), AbortController timeout 30s,
 * recordAnalyzeUsage + INSERT axis_audit_logs apos sucesso. Logs com
 * subprefixo [ANALYZE-TCC-AUTO] pra distinguir de /api/analyze-tcc.
 *
 * Em qualquer falha (size cap, quota, timeout, OpenAI error, parse error),
 * retorna fallback vazio. Callsite trata graciosamente: persiste analise
 * vazia em tcc_analyses, relatorio segue sem auto-analise.
 */
async function runTccAnalysis(
  client: PoolClient,
  params: RunTccAnalysisParams,
): Promise<AnalysisData> {
  const fallback: AnalysisData = { fatos: [], pensamentos: [], emocoes: [], comportamentos: [] }
  const { tenantId, userId, sessionId, patientId, text } = params
  const startedAt = Date.now()
  const logCtx = `[tenant=${tenantId}] [user=${userId}] [patient=${patientId ?? 'null'}] [session=${sessionId}]`

  // Size cap (G6)
  if (text.length > RUN_TCC_MAX_TEXT_LENGTH) {
    console.warn(`[ANALYZE-TCC-AUTO] ${logCtx} skip TEXT_TOO_LARGE length=${text.length} max=${RUN_TCC_MAX_TEXT_LENGTH}`)
    return fallback
  }

  // Quota check (G2) — funcao interna nao retorna 402, retorna fallback
  const usage = await getAnalyzeUsage(client, tenantId)
  if (usage.limit_reached) {
    console.warn(`[ANALYZE-TCC-AUTO] ${logCtx} skip LIMIT_REACHED requests_used=${usage.requests_used} limit=${usage.limit}`)
    return fallback
  }

  console.log(`[ANALYZE-TCC-AUTO] ${logCtx} start text_length=${text.length} usage=${usage.requests_used}/${usage.limit ?? 'unlimited'}`)

  // AbortController + OpenAI (G7 timeout, G9 json_object - ja existia)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), RUN_TCC_TIMEOUT_MS)

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Voce e um assistente clinico especializado em analise de sessoes de TCC. Responda apenas com JSON valido, sem texto adicional.'
        },
        {
          role: 'user',
          content: `Voce e um assistente clinico especializado em TCC.

TAREFA: Analise APENAS as falas do PACIENTE e extraia informacoes EXPLICITAMENTE verbalizadas.

REGRAS:
1. NAO invente informacoes
2. NAO deduza crencas ou emocoes nao verbalizadas
3. NAO interprete - apenas classifique o que foi dito
4. Use as palavras do proprio paciente quando possivel
5. Maximo 5 itens por categoria
6. Se houver ambiguidade, omita

EXTRAIA:
1. FATOS - Eventos concretos relatados
2. PENSAMENTOS - Pensamentos automaticos em primeira pessoa
3. EMOCOES - Sentimentos nomeados
4. COMPORTAMENTOS - Acoes ou reacoes

Responda APENAS com JSON:
{"fatos":[],"pensamentos":[],"emocoes":[],"comportamentos":[]}

TEXTO:
${text}`
        }
      ],
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    }, { signal: controller.signal })

    clearTimeout(timeoutId)

    const content = response.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(content)
    const result: AnalysisData = {
      fatos: parsed.fatos || [],
      pensamentos: parsed.pensamentos || [],
      emocoes: parsed.emocoes || [],
      comportamentos: parsed.comportamentos || [],
    }

    // G1 audit + G2 record (apos sucesso)
    const tokensUsed = response.usage?.total_tokens ?? 0
    const elapsedMs = Date.now() - startedAt

    try {
      await recordAnalyzeUsage(client, {
        tenantId,
        userId,
        route: 'analyze-tcc',
        tokensUsed,
        model: 'gpt-4o-mini',
        patientId,
        transcriptLength: text.length,
      })

      await client.query(
        `INSERT INTO axis_audit_logs
           (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, $2, 'system', 'ANALYZE_TCC_INVOKED', 'session', $3, $4, NOW())`,
        [
          tenantId,
          userId,
          sessionId,
          JSON.stringify({
            route: 'analyze-tcc',
            source: 'report-generate-auto',
            model: 'gpt-4o-mini',
            tokens_used: tokensUsed,
            transcript_length: text.length,
            patient_id: patientId,
            duration_ms: elapsedMs,
          }),
        ]
      )
    } catch (auditErr) {
      // Audit/record falha NAO invalida o resultado da analise
      Sentry.captureException(auditErr)
      console.error(`[ANALYZE-TCC-AUTO] ${logCtx} audit/record falhou:`, auditErr)
    }

    console.log(`[ANALYZE-TCC-AUTO] ${logCtx} ok tokens=${tokensUsed} duration_ms=${elapsedMs}`)

    return result
  } catch (err: any) {
    clearTimeout(timeoutId)

    if (err?.name === 'AbortError' || err?.code === 'ABORT_ERR' || err?.message?.includes('aborted')) {
      Sentry.captureMessage('[ANALYZE-TCC-AUTO] OpenAI timeout', { level: 'error', tags: { provider: 'openai', operation: 'report-generate-auto', timeout_ms: RUN_TCC_TIMEOUT_MS } })
      console.error(`[ANALYZE-TCC-AUTO] ${logCtx} OpenAI timeout (${RUN_TCC_TIMEOUT_MS}ms)`)
    } else {
      Sentry.captureException(err)
      console.error(`[ANALYZE-TCC-AUTO] ${logCtx} Auto-analise TCC falhou:`, err)
    }
    return fallback
  }
}

/**
 * Monta o prompt completo para geracao do relatorio clinico.
 * Conforme spec AXIS TCC Sessao v2 - regras anti-alucinacao e anti-generico.
 */
function buildReportPrompt(input: PromptInput): string {
  const sections: string[] = []

  sections.push(`Voce e um assistente que gera relatorios clinicos para sessoes de Terapia Cognitivo-Comportamental.

REGRAS OBRIGATORIAS:
- Use APENAS informacoes presentes na transcricao fornecida
- NAO invente diagnosticos ou medicamentos
- Use linguagem descritiva, 3a pessoa
- Frases curtas e objetivas
- Padrao CFP/CRP

REGRAS ANTI-GENERICO:
- Cada secao DEVE conter pelo menos 1 elemento concreto da sessao (nome, situacao, comportamento especifico)
- PROIBIDO frases vazias como: "foram discutidos temas importantes", "a sessao abordou aspectos relevantes", "questoes emocionais foram trabalhadas", "diversos assuntos foram mencionados", "a paciente relatou suas dificuldades"
- Se nao houver conteudo suficiente para ser concreto, escreva menos - NUNCA preencha com texto generico

REGRA HEADLINE:
- Deve conter pelo menos 1 elemento concreto da sessao
- Maximo 120 caracteres
- Se a transcricao nao tiver padrao claro suficiente, retorne headline como string vazia ""
- NUNCA invente sintese generica tipo "Sessao produtiva com bons avancos"

REGRA TECNICAS:
- techniques_identified: SOMENTE tecnicas que aparecem EXPLICITAMENTE na transcricao como acoes realizadas na sessao
- Use linguagem neutra ("identificadas na sessao"), NAO avaliativa ("utilizadas pelo profissional")
- NAO sugira tecnicas para proxima sessao - sugestoes vem de outro sistema

REGRA DISTORCOES:
- Distorcoes sao POSSIBILIDADES baseadas na transcricao, nao afirmacoes
- Sempre inclua um exemplo concreto extraido da transcricao
- O frontend exibira com disclaimer "requer validacao do profissional"`)

  sections.push(`DADOS DA SESSAO:
- Paciente: ${input.patientName}
- Sessao #${input.sessionNumber || 'N/A'} - ${input.sessionDate}
- Duracao: ${input.duration || 'N/A'} minutos
- Tipo: ${input.sessionType || 'Individual'}`)

  if (input.transcription) {
    sections.push(`TRANSCRICAO:\n${input.transcription}`)
  }

  if (input.analysis.fatos.length > 0 || input.analysis.pensamentos.length > 0) {
    sections.push(`ANALISE TCC:
Fatos: ${JSON.stringify(input.analysis.fatos)}
Pensamentos: ${JSON.stringify(input.analysis.pensamentos)}
Emocoes: ${JSON.stringify(input.analysis.emocoes)}
Comportamentos: ${JSON.stringify(input.analysis.comportamentos)}`)
  }

  if (input.microEvents.length > 0) {
    sections.push(`MICRO-EVENTOS:\n${input.microEvents.join('\n')}`)
  }

  if (input.previousSummary) {
    sections.push(`SESSAO ANTERIOR:\n${input.previousSummary}`)
  }

  sections.push(`Responda APENAS com JSON valido, sem markdown:
{
  "headline": "1 frase-sintese da sessao, max 120 chars. Se nao houver padrao claro, retorne string vazia.",
  "objectives": "objetivos abordados na sessao",
  "summary": "resumo narrativo da sessao",
  "intervention": "intervencoes e estrategias identificadas na sessao",
  "observations": "observacoes clinicas relevantes (comportamentos, padroes, sinais)",
  "closing": "encerramento, tarefa de casa, plano de continuidade",
  "insights": {
    "emotions": [{"name": "nome da emocao em portugues", "intensity": 0.0}],
    "topics": ["topico1", "topico2"],
    "distortions": [{"type": "tipo_em_ingles", "label": "Nome em portugues", "example": "frase exemplo da sessao"}],
    "techniques_identified": ["tecnica identificada na sessao"]
  }
}`)

  return sections.join('\n\n')
}
