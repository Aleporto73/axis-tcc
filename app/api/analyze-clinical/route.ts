import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import { rateLimit } from '@/src/middleware/rate-limit'
import { getAnalyzeUsage, recordAnalyzeUsage } from '@/src/services/analyze-limit'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// =====================================================
// AXIS Item 2 Onda 7 — Governance unificada para chamadas LLM analyze-*
//
// Pipeline (ordem importante):
//   1) Rate-limit IP (camada externa, antes de abrir conexao DB)
//   2) Validar body: transcript (string, <= 50K chars) + patient_id obrigatorios
//   3) withTenant (resolve tenant via cookie/profile)
//   4) Rate-limit por tenant (camada interna, mais permissiva que IP)
//   5) Validar patient_id pertence ao tenant (RLS + WHERE defensivo, gate of silence 404)
//   6) Quota check (getAnalyzeUsage, free 50/30d rolling) -> 402 LIMIT_REACHED
//   7) Log estruturado de inicio
//   8) AbortController + OpenAI (timeout 30s, response_format=json_object)
//   9) Apos sucesso: recordAnalyzeUsage + INSERT axis_audit_logs + log fim
//   10) Catch AbortError -> 504 GATEWAY_TIMEOUT
//   11) Catch geral -> handleRouteError
// =====================================================

// Rate limit por IP (camada externa)
const RATE_LIMIT_IP = { limit: 30, windowMs: 60_000, prefix: 'analyze-clinical-ip' }

// Rate limit por tenant (camada interna, mais permissiva)
const RATE_LIMIT_TENANT = { limit: 60, windowMs: 60_000, prefix: 'analyze-clinical-tenant' }

// Limite tamanho do transcript (50K chars ~ 12.5K tokens em GPT-4o-mini)
const MAX_TRANSCRIPT_LENGTH = 50_000

// Timeout OpenAI
const OPENAI_TIMEOUT_MS = 30_000

const SYSTEM_PROMPT = `Você está processando um REGISTRO CLÍNICO INICIAL ASSISTIDO.

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

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  try {
    // ── 1) Rate-limit IP (camada externa) ──
    const blockedIp = await rateLimit(request, RATE_LIMIT_IP)
    if (blockedIp) return blockedIp

    // ── 2) Validar body (G5 patient_id obrigatorio + G6 size cap) ──
    const body = await request.json()
    const { transcript, patient_id } = body as { transcript?: unknown; patient_id?: unknown }

    if (!patient_id || typeof patient_id !== 'string') {
      return NextResponse.json({ error: 'patient_id obrigatório' }, { status: 400 })
    }
    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json({ error: 'Transcrição não fornecida' }, { status: 400 })
    }
    if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
      return NextResponse.json({
        error: 'TRANSCRIPT_TOO_LARGE',
        message: `Transcrição excede ${MAX_TRANSCRIPT_LENGTH} caracteres.`,
        max_length: MAX_TRANSCRIPT_LENGTH,
        received_length: transcript.length,
      }, { status: 413 })
    }

    return await withTenant(async (ctx) => {
      const { client, tenantId, userId } = ctx

      // ── 4) Rate-limit por tenant (camada interna) ──
      const blockedTenant = await rateLimit(request, {
        ...RATE_LIMIT_TENANT,
        keyGenerator: () => tenantId,
      })
      if (blockedTenant) return blockedTenant

      // ── 5) Validar patient_id pertence ao tenant (RLS + WHERE defensivo) ──
      // Gate of silence: 404 ao invés de 403 — não vaza existência cross-tenant.
      const patientCheck = await client.query(
        'SELECT id FROM patients WHERE id = $1 AND tenant_id = $2',
        [patient_id, tenantId]
      )
      if (patientCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 })
      }

      // ── 6) Quota check (G2) ──
      const usage = await getAnalyzeUsage(client, tenantId)
      if (usage.limit_reached) {
        console.log(`[ANALYZE-CLINICAL] [tenant=${tenantId}] [user=${userId}] [patient=${patient_id}] LIMIT_REACHED requests_used=${usage.requests_used} limit=${usage.limit}`)
        return NextResponse.json({
          error: 'LIMIT_REACHED',
          message: `Limite gratuito de ${usage.limit} análises por mês atingido.`,
          requests_used: usage.requests_used,
          limit: usage.limit,
          upgrade_url: '/precos',
        }, { status: 402 })
      }

      // ── 7) Log estruturado de início (G8) ──
      console.log(`[ANALYZE-CLINICAL] [tenant=${tenantId}] [user=${userId}] [patient=${patient_id}] start transcript_length=${transcript.length} usage=${usage.requests_used}/${usage.limit ?? 'unlimited'}`)

      // ── 8) AbortController + OpenAI (G7 timeout, G9 json_object) ──
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS)

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

      let completion
      try {
        completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
          max_tokens: 1000,
          response_format: { type: 'json_object' },
        }, { signal: controller.signal })
      } finally {
        clearTimeout(timeoutId)
      }

      const content = (completion.choices[0]?.message?.content || '{}').slice(0, 5000)

      // G9: regex greedy como fallback defensivo (response_format=json_object
      // já garante JSON válido, mas mantemos try/catch).
      let parsed: { complaint?: string; patterns?: string; interventions?: string; current_state?: string }
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content)
      } catch {
        parsed = {}
      }

      // ── 9) Após sucesso: recordAnalyzeUsage + audit log + log fim ──
      const tokensUsed = completion.usage?.total_tokens ?? 0
      const elapsedMs = Date.now() - startedAt

      await recordAnalyzeUsage(client, {
        tenantId,
        userId,
        route: 'analyze-clinical',
        tokensUsed,
        model: 'gpt-4o-mini',
        patientId: patient_id,
        transcriptLength: transcript.length,
      })

      await client.query(
        `INSERT INTO axis_audit_logs
           (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
         VALUES ($1, $2, 'user', 'ANALYZE_CLINICAL_INVOKED', 'patient', $3, $4, NOW())`,
        [
          tenantId,
          userId,
          patient_id,
          JSON.stringify({
            route: 'analyze-clinical',
            model: 'gpt-4o-mini',
            tokens_used: tokensUsed,
            transcript_length: transcript.length,
            duration_ms: elapsedMs,
          }),
        ]
      )

      console.log(`[ANALYZE-CLINICAL] [tenant=${tenantId}] [user=${userId}] [patient=${patient_id}] ok tokens=${tokensUsed} duration_ms=${elapsedMs}`)

      return NextResponse.json({
        complaint: parsed.complaint || '',
        patterns: parsed.patterns || '',
        interventions: parsed.interventions || '',
        current_state: parsed.current_state || '',
      })
    }) // end withTenant
  } catch (error: any) {
    // ── 10) Catch AbortError (G7 timeout) ──
    if (error?.name === 'AbortError' || error?.code === 'ABORT_ERR' || error?.message?.includes('aborted')) {
      console.error(`[ANALYZE-CLINICAL] OpenAI timeout (${OPENAI_TIMEOUT_MS}ms)`)
      return NextResponse.json({
        error: 'OPENAI_TIMEOUT',
        message: `Análise demorou mais de ${OPENAI_TIMEOUT_MS / 1000}s. Tente novamente.`,
      }, { status: 504 })
    }

    // ── 11) Catch geral ──
    console.error('[ANALYZE-CLINICAL] error:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
