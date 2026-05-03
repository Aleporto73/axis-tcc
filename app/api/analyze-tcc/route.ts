import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import { readTranscriptSmart } from '@/src/services/transcript-storage'
import { rateLimit } from '@/src/middleware/rate-limit'
import { getAnalyzeUsage, recordAnalyzeUsage } from '@/src/services/analyze-limit'
import * as Sentry from '@sentry/nextjs'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// =====================================================
// AXIS Item 2 Onda 7 — Governance unificada para chamadas LLM analyze-*
//
// Pipeline (ordem importante):
//   1) Rate-limit IP (camada externa, antes de abrir conexao DB)
//   2) Validar body: patient_id + session_id obrigatorios; transcript_id OU text obrigatorio
//   3) withTenant (resolve tenant via cookie/profile)
//   4) Rate-limit por tenant (camada interna, mais permissiva que IP)
//   5) Resolver text: usar body.text OU lookup via transcript_id (com RLS)
//   6) Validar patient_id pertence ao tenant (RLS + WHERE defensivo, gate of silence 404)
//   7) Validar session_id pertence ao tenant + patient_id
//   8) Validar size cap (text.length <= 50K chars apos resolucao)
//   9) Quota check (getAnalyzeUsage, free 50/30d rolling) -> 402 LIMIT_REACHED
//   10) Log estruturado de inicio
//   11) AbortController + OpenAI (timeout 30s, response_format=json_object)
//   12) Parse JSON (greedy regex fallback)
//   13) INSERT tcc_analyses (persistencia existente)
//   14) UPDATE transcripts SET processed = true (existente)
//   15) recordAnalyzeUsage + INSERT axis_audit_logs + log fim
//   16) Catch AbortError -> 504 GATEWAY_TIMEOUT
//   17) Catch geral -> handleRouteError
// =====================================================

// Rate limit por IP (camada externa)
const RATE_LIMIT_IP = { limit: 30, windowMs: 60_000, prefix: 'analyze-tcc-ip' }

// Rate limit por tenant (camada interna, mais permissiva)
const RATE_LIMIT_TENANT = { limit: 60, windowMs: 60_000, prefix: 'analyze-tcc-tenant' }

// Limite tamanho do texto (50K chars ~ 12.5K tokens em GPT-4o-mini)
const MAX_TEXT_LENGTH = 50_000

// Timeout OpenAI
const OPENAI_TIMEOUT_MS = 30_000

const SYSTEM_PROMPT = 'Voce e um assistente clinico especializado em analise de sessoes de TCC. Responda apenas com JSON valido, sem texto adicional.'

/**
 * POST /api/analyze-tcc
 *
 * Extrai fatos, pensamentos, emocoes e comportamentos de uma transcricao TCC.
 * Conforme Documento Mestre v2.1: Camada 2 (texto deterministico automatizado).
 *
 * Item 2 Onda 7 — governance unificada (audit + quota + rate-limit + timeout).
 */
export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  try {
    // ── 1) Rate-limit IP (camada externa) ──
    const blockedIp = await rateLimit(request, RATE_LIMIT_IP)
    if (blockedIp) return blockedIp

    // ── 2) Body parse + validacoes basicas ──
    const body = await request.json()
    const {
      transcript_id,
      text: bodyText,
      session_id,
      patient_id,
    } = body as {
      transcript_id?: unknown
      text?: unknown
      session_id?: unknown
      patient_id?: unknown
    }

    if (!patient_id || typeof patient_id !== 'string') {
      return NextResponse.json({ error: 'patient_id obrigatório' }, { status: 400 })
    }
    if (!session_id || typeof session_id !== 'string') {
      return NextResponse.json({ error: 'session_id obrigatório' }, { status: 400 })
    }
    if (!transcript_id && !bodyText) {
      return NextResponse.json({ error: 'transcript_id ou text obrigatório' }, { status: 400 })
    }
    // Se bodyText vier, deve ser string razoavel (size cap depois)
    if (bodyText !== undefined && bodyText !== null && typeof bodyText !== 'string') {
      return NextResponse.json({ error: 'text deve ser string' }, { status: 400 })
    }

    return await withTenant(async (ctx) => {
      const { client, tenantId, userId } = ctx

      // ── 4) Rate-limit por tenant (camada interna) ──
      const blockedTenant = await rateLimit(request, {
        ...RATE_LIMIT_TENANT,
        keyGenerator: () => tenantId,
      })
      if (blockedTenant) return blockedTenant

      // ── 5) Resolver text: body.text se fornecido, senao lookup via transcript_id ──
      let text: string = typeof bodyText === 'string' ? bodyText : ''

      if (!text && typeof transcript_id === 'string') {
        const tResult = await client.query(
          `SELECT final_path, transcript_path, raw_path, text, text_preview
             FROM transcripts
            WHERE id = $1 AND tenant_id = $2`,
          [transcript_id, tenantId]
        )
        if (tResult.rows[0]) {
          try {
            text = await readTranscriptSmart(tResult.rows[0])
          } catch {
            // Fallback: se disco falhar, usar text ou text_preview
            text = tResult.rows[0].text || tResult.rows[0].text_preview || ''
          }
        }
      }

      if (!text) {
        return NextResponse.json({ error: 'Texto obrigatorio' }, { status: 400 })
      }

      // ── 6) Validar patient_id pertence ao tenant (RLS + WHERE defensivo) ──
      // Gate of silence: 404 ao invés de 403 — não vaza existência cross-tenant.
      const patientCheck = await client.query(
        'SELECT id FROM patients WHERE id = $1 AND tenant_id = $2',
        [patient_id, tenantId]
      )
      if (patientCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })
      }

      // ── 7) Validar session_id pertence ao tenant + patient_id ──
      const sessionCheck = await client.query(
        'SELECT id FROM sessions WHERE id = $1 AND patient_id = $2 AND tenant_id = $3',
        [session_id, patient_id, tenantId]
      )
      if (sessionCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
      }

      // ── 8) Validar size cap apos resolucao ──
      if (text.length > MAX_TEXT_LENGTH) {
        return NextResponse.json({
          error: 'TEXT_TOO_LARGE',
          message: `Texto excede ${MAX_TEXT_LENGTH} caracteres.`,
          max_length: MAX_TEXT_LENGTH,
          received_length: text.length,
        }, { status: 413 })
      }

      // ── 9) Quota check (G2) ──
      const usage = await getAnalyzeUsage(client, tenantId)
      if (usage.limit_reached) {
        console.log(`[ANALYZE-TCC] [tenant=${tenantId}] [user=${userId}] [patient=${patient_id}] [session=${session_id}] LIMIT_REACHED requests_used=${usage.requests_used} limit=${usage.limit}`)
        return NextResponse.json({
          error: 'LIMIT_REACHED',
          message: `Limite gratuito de ${usage.limit} análises por mês atingido.`,
          requests_used: usage.requests_used,
          limit: usage.limit,
          upgrade_url: '/precos',
        }, { status: 402 })
      }

      // ── 10) Log estruturado de início (G8) ──
      console.log(`[ANALYZE-TCC] [tenant=${tenantId}] [user=${userId}] [patient=${patient_id}] [session=${session_id}] start text_length=${text.length} usage=${usage.requests_used}/${usage.limit ?? 'unlimited'}`)

      // ── 11) AbortController + OpenAI (G7 timeout, G9 json_object) ──
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS)

      const userPrompt = `Voce e um assistente clinico especializado em Terapia Cognitivo-Comportamental (TCC), incluindo abordagens de 2a e 3a onda.

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
12. IGNORE hesitacoes e marcadores de incerteza como: "sei la", "nao sei", "acho que sim", "talvez", "de repente", "ne", "tipo". Eles NAO sao emocoes nem pensamentos - sao apenas preenchimento verbal.

EXTRAIA:

1. FATOS
   Eventos concretos, situacoes objetivas relatadas pelo paciente.
   Ex: "Briguei com meu chefe ontem", "Meu filho foi mal na escola"

2. PENSAMENTOS
   Pensamentos automaticos, crencas, interpretacoes em primeira pessoa.
   Ex: "Eu sempre estrago tudo", "Ninguem me entende"

3. EMOCOES
   Sentimentos claramente nomeados pelo paciente (substantivos ou adjetivos emocionais explicitos).
   SIM: "Fiquei com raiva", "Me senti ansioso", "Tive medo", "Estava triste", "Fiquei envergonhado"
   NAO: "Sei la", "Nao sei", "Estranho", "Diferente", "Meio assim" - sao hesitacoes ou descricoes vagas, NAO emocoes.

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

      let response
      try {
        response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
          max_tokens: 1500,
          response_format: { type: 'json_object' },
        }, { signal: controller.signal })
      } finally {
        clearTimeout(timeoutId)
      }

      // ── 12) Parse JSON (G9 greedy regex fallback) ──
      const content = response.choices[0]?.message?.content || '{}'
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

      let analysis: { fatos?: string[]; pensamentos?: string[]; emocoes?: string[]; comportamentos?: string[] }
      try {
        const jsonMatch = cleanContent.match(/\{[\s\S]*\}/)
        analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(cleanContent)
      } catch {
        analysis = { fatos: [], pensamentos: [], emocoes: [], comportamentos: [] }
      }

      // ── 13) INSERT tcc_analyses (persistência existente) ──
      await client.query(
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
          text,
        ]
      )

      // ── 14) UPDATE transcripts SET processed = true (existente) ──
      if (typeof transcript_id === 'string') {
        await client.query(
          'UPDATE transcripts SET processed = true WHERE id = $1 AND tenant_id = $2',
          [transcript_id, tenantId]
        )
      }

      // ── 15) Após sucesso: recordAnalyzeUsage + audit log + log fim ──
      const tokensUsed = response.usage?.total_tokens ?? 0
      const elapsedMs = Date.now() - startedAt

      await recordAnalyzeUsage(client, {
        tenantId,
        userId,
        route: 'analyze-tcc',
        tokensUsed,
        model: 'gpt-4o-mini',
        patientId: patient_id,
        transcriptLength: text.length,
      })

      await client.query(
        `INSERT INTO axis_audit_logs
           (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, $2, 'user', 'ANALYZE_TCC_INVOKED', 'session', $3, $4, NOW())`,
        [
          tenantId,
          userId,
          session_id,
          JSON.stringify({
            route: 'analyze-tcc',
            model: 'gpt-4o-mini',
            tokens_used: tokensUsed,
            transcript_length: text.length,
            patient_id,
            transcript_id: typeof transcript_id === 'string' ? transcript_id : null,
            duration_ms: elapsedMs,
          }),
        ]
      )

      console.log(`[ANALYZE-TCC] [tenant=${tenantId}] [user=${userId}] [patient=${patient_id}] [session=${session_id}] ok tokens=${tokensUsed} duration_ms=${elapsedMs}`)

      return NextResponse.json({
        success: true,
        analysis,
        tokens: tokensUsed,
      })
    }) // end withTenant
  } catch (error: any) {
    // ── 16) Catch AbortError (G7 timeout) ──
    if (error?.name === 'AbortError' || error?.code === 'ABORT_ERR' || error?.message?.includes('aborted')) {
      Sentry.captureMessage('[ANALYZE-TCC] OpenAI timeout', { level: 'error', tags: { provider: 'openai', operation: 'analyze-tcc', timeout_ms: OPENAI_TIMEOUT_MS } })
      console.error(`[ANALYZE-TCC] OpenAI timeout (${OPENAI_TIMEOUT_MS}ms)`)
      return NextResponse.json({
        error: 'OPENAI_TIMEOUT',
        message: `Análise demorou mais de ${OPENAI_TIMEOUT_MS / 1000}s. Tente novamente.`,
      }, { status: 504 })
    }

    // ── 17) Catch geral ──
    console.error('[ANALYZE-TCC] error:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
