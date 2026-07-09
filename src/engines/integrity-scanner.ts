// =====================================================
// AXIS ABA - Integrity Scanner Engine (v2.7.0 Sprint 3)
//
// Motor de detecção de flags de integridade.
// DETERMINÍSTICO — mesma base, mesmos flags, sempre.
//
// Executa regras SQL e produz flags para UPSERT.
// Cada regra é independente e idempotente.
//
// Regras implementadas (Bible v2.7.0):
//   1. OVERLAP_SESSIONS (critical)
//   2. EXCESSIVE_DURATION (warning)
//   3. RECURRENT_EXCEPTION (warning)
//   4. EXPIRED_COUNCIL (warning)
//   5. EXPIRED_COVERAGE (warning)
//   6. DUPLICATE_PHOTO (critical)
//   7. MISSING_GEO_REQUIRED (warning)
//   8. NO_ATTESTATION (info)
//   9. HOURS_EXCEEDED (warning)
//  10. INCOMPLETE_PACKET (warning)
//
// Regras que dependem de dados realtime (IMPOSSIBLE_TRAVEL,
// UNEXPECTED_LOCATION, RETROEDIT_ATTEMPT, INACTIVE_PROVIDER)
// são detectadas inline nos respectivos endpoints.
// =====================================================

import type { PoolClient } from 'pg'

export interface IntegrityFlag {
  entity_type: string
  entity_id: string
  rule_code: string
  severity: 'info' | 'warning' | 'critical'
  description: string
  metadata?: Record<string, unknown>
}

export type ScanRule = (
  client: PoolClient,
  tenantId: string
) => Promise<IntegrityFlag[]>

// Deploy do Bloco 9 (re-link close_session_aba). Sessões fechadas ANTES disso são
// lacuna histórica conhecida (Decisão 5b) — nunca flagar. Instante fixo em UTC.
const CSO_SNAPSHOT_CUTOFF = '2026-07-09T16:16:05Z'

// ─────────────────────────────────────────────────────
// Regra 1: OVERLAP_SESSIONS (critical)
// 2 sessões simultâneas do mesmo terapeuta
// ─────────────────────────────────────────────────────
export const scanOverlapSessions: ScanRule = async (client, tenantId) => {
  const flags: IntegrityFlag[] = []

  const result = await client.query(`
    SELECT
      s1.id as session1_id,
      s2.id as session2_id,
      s1.applied_by as therapist_id,
      p.name as therapist_name,
      s1.started_at as s1_start,
      s1.ended_at as s1_end,
      s2.started_at as s2_start
    FROM sessions_aba s1
    JOIN sessions_aba s2 ON s1.applied_by = s2.applied_by
      AND s1.id < s2.id
      AND s1.tenant_id = s2.tenant_id
      AND s2.started_at < COALESCE(s1.ended_at, NOW())
      AND s1.started_at < COALESCE(s2.ended_at, NOW())
    LEFT JOIN profiles p ON p.id = s1.applied_by
    WHERE s1.tenant_id = $1
      AND s1.status IN ('in_progress', 'completed')
      AND s2.status IN ('in_progress', 'completed')
      AND s1.applied_by IS NOT NULL
      AND s1.started_at > NOW() - interval '30 days'
  `, [tenantId])

  for (const row of result.rows) {
    flags.push({
      entity_type: 'session',
      entity_id: row.session1_id,
      rule_code: 'OVERLAP_SESSIONS',
      severity: 'critical',
      description: `Sobreposição: sessões simultâneas do terapeuta ${row.therapist_name || 'desconhecido'}`,
      metadata: {
        session2_id: row.session2_id,
        therapist_id: row.therapist_id,
      },
    })
  }

  return flags
}

// ─────────────────────────────────────────────────────
// Regra 2: EXCESSIVE_DURATION (warning)
// Sessão > 6 horas
// ─────────────────────────────────────────────────────
export const scanExcessiveDuration: ScanRule = async (client, tenantId) => {
  const flags: IntegrityFlag[] = []

  const result = await client.query(`
    SELECT
      s.id, s.learner_id, l.name as learner_name,
      s.started_at, s.ended_at,
      EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 3600.0 as hours
    FROM sessions_aba s
    JOIN learners l ON l.id = s.learner_id
    WHERE s.tenant_id = $1
      AND s.status = 'completed'
      AND s.ended_at IS NOT NULL
      AND s.started_at IS NOT NULL
      AND EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) > 21600
      AND s.started_at > NOW() - interval '30 days'
  `, [tenantId])

  for (const row of result.rows) {
    flags.push({
      entity_type: 'session',
      entity_id: row.id,
      rule_code: 'EXCESSIVE_DURATION',
      severity: 'warning',
      description: `Sessão com ${Math.round(row.hours * 10) / 10}h de duração (${row.learner_name})`,
      metadata: { hours: Math.round(row.hours * 10) / 10 },
    })
  }

  return flags
}

// ─────────────────────────────────────────────────────
// Regra 3: RECURRENT_EXCEPTION (warning)
// >30% exceções GPS no mês
// ─────────────────────────────────────────────────────
export const scanRecurrentException: ScanRule = async (client, tenantId) => {
  const flags: IntegrityFlag[] = []

  const result = await client.query(`
    WITH provider_stats AS (
      SELECT
        pp.captured_by as provider_id,
        p.name as provider_name,
        COUNT(*) as total_proofs,
        COUNT(*) FILTER (WHERE pp.confidence_status = 'exception') as exceptions
      FROM session_presence_proofs pp
      LEFT JOIN profiles p ON p.id = pp.captured_by
      WHERE pp.tenant_id = $1
        AND pp.captured_at > NOW() - interval '30 days'
      GROUP BY pp.captured_by, p.name
      HAVING COUNT(*) >= 5
    )
    SELECT * FROM provider_stats
    WHERE exceptions::float / total_proofs > 0.3
  `, [tenantId])

  for (const row of result.rows) {
    const pct = Math.round((row.exceptions / row.total_proofs) * 100)
    flags.push({
      entity_type: 'provider',
      entity_id: row.provider_id || tenantId,
      rule_code: 'RECURRENT_EXCEPTION',
      severity: 'warning',
      description: `${row.provider_name || 'Profissional'}: ${pct}% de exceções GPS no mês (${row.exceptions}/${row.total_proofs})`,
      metadata: { total: row.total_proofs, exceptions: row.exceptions, pct },
    })
  }

  return flags
}

// ─────────────────────────────────────────────────────
// Regra 4: EXPIRED_COUNCIL (warning)
// Conselho profissional vencido ou vencendo em 30 dias
// ─────────────────────────────────────────────────────
export const scanExpiredCouncil: ScanRule = async (client, tenantId) => {
  const flags: IntegrityFlag[] = []

  const result = await client.query(`
    SELECT
      pc.id, pc.profile_id, pc.full_name,
      pc.council_type, pc.council_number, pc.council_uf,
      pc.council_valid_until,
      CASE
        WHEN pc.council_valid_until < NOW() THEN 'expired'
        ELSE 'expiring'
      END as status
    FROM provider_credentials pc
    WHERE pc.tenant_id = $1
      AND pc.council_valid_until IS NOT NULL
      AND pc.council_valid_until < NOW() + interval '30 days'
      AND pc.credential_status != 'blocked'
  `, [tenantId])

  for (const row of result.rows) {
    const isExpired = row.status === 'expired'
    flags.push({
      entity_type: 'provider',
      entity_id: row.profile_id,
      rule_code: 'EXPIRED_COUNCIL',
      severity: 'warning',
      description: `${row.full_name}: ${row.council_type} ${row.council_number}/${row.council_uf} ${isExpired ? 'VENCIDO' : 'vencendo em breve'}`,
      metadata: {
        credential_id: row.id,
        valid_until: row.council_valid_until,
        council: `${row.council_type} ${row.council_number}/${row.council_uf}`,
      },
    })
  }

  return flags
}

// ─────────────────────────────────────────────────────
// Regra 5: EXPIRED_COVERAGE (warning)
// Cobertura expirada mas ainda 'active'
// ─────────────────────────────────────────────────────
export const scanExpiredCoverage: ScanRule = async (client, tenantId) => {
  const flags: IntegrityFlag[] = []

  const result = await client.query(`
    SELECT
      cp.id, cp.learner_id, cp.payer_name, cp.end_date,
      l.name as learner_name
    FROM learner_coverage_profiles cp
    JOIN learners l ON l.id = cp.learner_id
    WHERE cp.tenant_id = $1
      AND cp.status = 'active'
      AND cp.end_date IS NOT NULL
      AND cp.end_date < NOW()
  `, [tenantId])

  for (const row of result.rows) {
    flags.push({
      entity_type: 'coverage',
      entity_id: row.id,
      rule_code: 'EXPIRED_COVERAGE',
      severity: 'warning',
      description: `Cobertura ${row.payer_name} de ${row.learner_name} expirada em ${new Date(row.end_date).toLocaleDateString('pt-BR')}`,
      metadata: { learner_id: row.learner_id, payer_name: row.payer_name },
    })
  }

  return flags
}

// ─────────────────────────────────────────────────────
// Regra 6: DUPLICATE_PHOTO (critical)
// Mesmo hash de arquivo em sessões diferentes
// ─────────────────────────────────────────────────────
export const scanDuplicatePhoto: ScanRule = async (client, tenantId) => {
  const flags: IntegrityFlag[] = []

  const result = await client.query(`
    SELECT
      a1.id as att1_id, a1.session_id as session1_id,
      a2.id as att2_id, a2.session_id as session2_id,
      a1.file_hash, a1.file_name
    FROM session_attachments a1
    JOIN session_attachments a2
      ON a1.file_hash = a2.file_hash
      AND a1.tenant_id = a2.tenant_id
      AND a1.session_id < a2.session_id
    WHERE a1.tenant_id = $1
      AND a1.mime_type IN ('image/jpeg', 'image/png')
      AND a1.uploaded_at > NOW() - interval '90 days'
  `, [tenantId])

  for (const row of result.rows) {
    flags.push({
      entity_type: 'session',
      entity_id: row.session1_id,
      rule_code: 'DUPLICATE_PHOTO',
      severity: 'critical',
      description: `Foto duplicada "${row.file_name}" compartilhada entre sessões distintas`,
      metadata: {
        session2_id: row.session2_id,
        file_hash: row.file_hash,
      },
    })
  }

  return flags
}

// ─────────────────────────────────────────────────────
// Regra 7: HOURS_EXCEEDED (warning)
// Horas realizadas > autorizadas na cobertura
// ─────────────────────────────────────────────────────
export const scanHoursExceeded: ScanRule = async (client, tenantId) => {
  const flags: IntegrityFlag[] = []

  const result = await client.query(`
    WITH weekly_hours AS (
      SELECT
        s.learner_id,
        l.name as learner_name,
        cp.id as coverage_id,
        cp.payer_name,
        cp.authorized_hours_week,
        date_trunc('week', s.scheduled_at) as week_start,
        SUM(
          COALESCE(
            s.duration_minutes_override,
            EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 60.0
          )
        ) / 60.0 as actual_hours
      FROM sessions_aba s
      JOIN learners l ON l.id = s.learner_id
      JOIN learner_coverage_profiles cp
        ON cp.learner_id = s.learner_id AND cp.tenant_id = s.tenant_id
        AND cp.status = 'active'
        AND cp.authorized_hours_week IS NOT NULL
      WHERE s.tenant_id = $1
        AND s.status = 'completed'
        AND s.started_at > NOW() - interval '30 days'
      GROUP BY s.learner_id, l.name, cp.id, cp.payer_name, cp.authorized_hours_week,
        date_trunc('week', s.scheduled_at)
    )
    SELECT * FROM weekly_hours
    WHERE actual_hours > authorized_hours_week
  `, [tenantId])

  for (const row of result.rows) {
    flags.push({
      entity_type: 'learner',
      entity_id: row.learner_id,
      rule_code: 'HOURS_EXCEEDED',
      severity: 'warning',
      description: `${row.learner_name}: ${Math.round(row.actual_hours * 10) / 10}h realizadas vs ${row.authorized_hours_week}h autorizadas (${row.payer_name})`,
      metadata: {
        coverage_id: row.coverage_id,
        actual: Math.round(row.actual_hours * 10) / 10,
        authorized: row.authorized_hours_week,
        week_start: row.week_start,
      },
    })
  }

  return flags
}

// ─────────────────────────────────────────────────────
// Regra 8: INCOMPLETE_PACKET (warning)
// Pacote com itens 'missing' ou status 'draft' há >7 dias
// ─────────────────────────────────────────────────────
export const scanIncompletePacket: ScanRule = async (client, tenantId) => {
  const flags: IntegrityFlag[] = []

  const result = await client.query(`
    SELECT
      cp.id, cp.learner_id, cp.packet_status,
      cp.completeness_pct, cp.period_start, cp.period_end,
      l.name as learner_name,
      lcp.payer_name
    FROM claim_packets cp
    JOIN learners l ON l.id = cp.learner_id
    LEFT JOIN learner_coverage_profiles lcp ON lcp.id = cp.coverage_id
    WHERE cp.tenant_id = $1
      AND cp.packet_status = 'draft'
      AND cp.created_at < NOW() - interval '7 days'
  `, [tenantId])

  for (const row of result.rows) {
    flags.push({
      entity_type: 'packet',
      entity_id: row.id,
      rule_code: 'INCOMPLETE_PACKET',
      severity: 'warning',
      description: `Pacote ${row.payer_name || ''} de ${row.learner_name} em rascunho há mais de 7 dias (${row.completeness_pct || 0}% completo)`,
      metadata: {
        learner_id: row.learner_id,
        completeness_pct: row.completeness_pct,
      },
    })
  }

  return flags
}

// ─────────────────────────────────────────────────────
// Regra 9: MISSING_CSO_SNAPSHOT (warning)
// Sessão concluída sem snapshot/CSO — só APÓS o cutoff do Bloco 9.
// As 20 órfãs históricas (pré-cutoff) nunca entram (Decisão 5b).
// ─────────────────────────────────────────────────────
export const scanCompletedWithoutSnapshot: ScanRule = async (client, tenantId) => {
  const flags: IntegrityFlag[] = []

  const result = await client.query(`
    SELECT
      s.id,
      s.learner_id,
      l.name AS learner_name,
      s.ended_at
    FROM sessions_aba s
    JOIN learners l
      ON l.id = s.learner_id
     AND l.tenant_id = s.tenant_id
    LEFT JOIN session_snapshots ss
      ON ss.session_id = s.id
     AND ss.tenant_id = s.tenant_id
    WHERE s.tenant_id = $1
      AND s.status = 'completed'
      AND s.ended_at IS NOT NULL
      AND s.ended_at >= $2::timestamptz
      AND ss.id IS NULL
  `, [tenantId, CSO_SNAPSHOT_CUTOFF])

  for (const row of result.rows) {
    flags.push({
      entity_type: 'session',
      entity_id: row.id,
      rule_code: 'MISSING_CSO_SNAPSHOT',
      severity: 'warning',
      description: `Sessão concluída sem CSO/snapshot (${row.learner_name}) — o motor não gerou o estado clínico`,
      metadata: {
        learner_id: row.learner_id,
        learner_name: row.learner_name,
        ended_at: row.ended_at,
        cutoff: CSO_SNAPSHOT_CUTOFF,
      },
    })
  }

  return flags
}

// ─────────────────────────────────────────────────────
// UPSERT de flags no banco
// ─────────────────────────────────────────────────────
export async function upsertFlags(
  client: PoolClient,
  tenantId: string,
  flags: IntegrityFlag[]
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0
  let updated = 0

  for (const flag of flags) {
    const result = await client.query(`
      INSERT INTO integrity_flags (
        tenant_id, entity_type, entity_id, rule_code,
        severity, description, metadata,
        first_detected_at, last_detected_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        NOW(), NOW()
      )
      ON CONFLICT (tenant_id, entity_type, entity_id, rule_code)
        WHERE status IN ('open', 'reviewing')
      DO UPDATE SET
        last_detected_at = NOW(),
        description = EXCLUDED.description,
        metadata = EXCLUDED.metadata
      RETURNING (xmax = 0) as is_insert
    `, [
      tenantId,
      flag.entity_type,
      flag.entity_id,
      flag.rule_code,
      flag.severity,
      flag.description,
      flag.metadata ? JSON.stringify(flag.metadata) : null,
    ])

    if (result.rows[0]?.is_insert) {
      inserted++
    } else {
      updated++
    }
  }

  return { inserted, updated }
}

// ─────────────────────────────────────────────────────
// Auto-resolver flags que não são mais detectadas
// ─────────────────────────────────────────────────────
export async function autoResolveStaleFlags(
  client: PoolClient,
  tenantId: string,
  currentFlagKeys: Set<string>,
  ruleCodes: string[]
): Promise<number> {
  // Buscar flags open/reviewing para as regras escaneadas
  const existing = await client.query(`
    SELECT id, entity_type, entity_id, rule_code
    FROM integrity_flags
    WHERE tenant_id = $1
      AND status IN ('open', 'reviewing')
      AND rule_code = ANY($2)
  `, [tenantId, ruleCodes])

  let resolved = 0

  for (const row of existing.rows) {
    const key = `${row.entity_type}:${row.entity_id}:${row.rule_code}`
    if (!currentFlagKeys.has(key)) {
      await client.query(`
        UPDATE integrity_flags
        SET status = 'resolved', auto_resolved = true, reviewed_at = NOW()
        WHERE id = $1
      `, [row.id])
      resolved++
    }
  }

  return resolved
}

// ─────────────────────────────────────────────────────
// Orquestrador principal
// ─────────────────────────────────────────────────────
export const ALL_SCAN_RULES: Array<{ rule: ScanRule; codes: string[] }> = [
  { rule: scanOverlapSessions, codes: ['OVERLAP_SESSIONS'] },
  { rule: scanExcessiveDuration, codes: ['EXCESSIVE_DURATION'] },
  { rule: scanRecurrentException, codes: ['RECURRENT_EXCEPTION'] },
  { rule: scanExpiredCouncil, codes: ['EXPIRED_COUNCIL'] },
  { rule: scanExpiredCoverage, codes: ['EXPIRED_COVERAGE'] },
  { rule: scanDuplicatePhoto, codes: ['DUPLICATE_PHOTO'] },
  { rule: scanHoursExceeded, codes: ['HOURS_EXCEEDED'] },
  { rule: scanIncompletePacket, codes: ['INCOMPLETE_PACKET'] },
  { rule: scanCompletedWithoutSnapshot, codes: ['MISSING_CSO_SNAPSHOT'] },
]

export interface ScanResult {
  total_flags: number
  inserted: number
  updated: number
  auto_resolved: number
  by_severity: { critical: number; warning: number; info: number }
  duration_ms: number
}

export async function runFullScan(
  client: PoolClient,
  tenantId: string
): Promise<ScanResult> {
  const start = Date.now()
  const allFlags: IntegrityFlag[] = []
  const allCodes: string[] = []

  for (const { rule, codes } of ALL_SCAN_RULES) {
    try {
      const flags = await rule(client, tenantId)
      allFlags.push(...flags)
      allCodes.push(...codes)
    } catch (err) {
      console.warn(`[integrity-scanner] rule ${codes.join(',')} failed:`, err)
    }
  }

  // Upsert
  const { inserted, updated } = await upsertFlags(client, tenantId, allFlags)

  // Auto-resolve stale
  const currentKeys = new Set(
    allFlags.map(f => `${f.entity_type}:${f.entity_id}:${f.rule_code}`)
  )
  const autoResolved = await autoResolveStaleFlags(client, tenantId, currentKeys, allCodes)

  // Stats by severity
  const bySeverity = { critical: 0, warning: 0, info: 0 }
  for (const f of allFlags) {
    bySeverity[f.severity]++
  }

  return {
    total_flags: allFlags.length,
    inserted,
    updated,
    auto_resolved: autoResolved,
    by_severity: bySeverity,
    duration_ms: Date.now() - start,
  }
}
