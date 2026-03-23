import pool from '@/src/database/db'

// =====================================================
// AXIS — Helper para alertas de sistema
// Migration 040: system_alerts
//
// Uso:
//   await createSystemAlert({
//     module: 'axis-aba',
//     severity: 'critical',
//     source: 'webhook/hotmart',
//     code: 'HOTTOK_INVALID',
//     message: 'Hottok validation failed',
//     context: { ip: '...' }
//   })
//
// REGRAS:
//   - Nunca logar PII (nome, email, CPF, CRP)
//   - Nunca logar texto clínico (transcrição, notas)
//   - Context aceita IDs de referência (tenant_id, session_id)
//   - Fire-and-forget: não bloqueia a rota se falhar
// =====================================================

export type AlertModule = 'axis-tcc' | 'axis-aba' | 'axis-tdah' | 'shared'
export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface SystemAlertInput {
  module: AlertModule
  severity: AlertSeverity
  source: string
  code?: string
  message: string
  context?: Record<string, unknown>
}

/**
 * Grava um alerta de sistema na tabela system_alerts.
 * Fire-and-forget: erros de gravação são logados mas não propagados.
 */
export async function createSystemAlert(input: SystemAlertInput): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO system_alerts (module, severity, source, code, message, context)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        input.module,
        input.severity,
        input.source,
        input.code || null,
        input.message,
        JSON.stringify(input.context || {}),
      ]
    )
  } catch (err) {
    // Fire-and-forget: não propagamos erro para não derrubar a rota
    console.error('[SYSTEM_ALERT] Falha ao gravar alerta:', err)
  }
}
