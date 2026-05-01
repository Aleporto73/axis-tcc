import pool from '../database/db'
import type { PoolClient } from 'pg'

let adminInitialized = false
let adminInstance: any = null

async function getFirebaseAdmin() {
  if (adminInitialized && adminInstance) {
    return adminInstance
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL

  if (!privateKey || !clientEmail || privateKey.includes('SUA_CHAVE_AQUI')) {
    console.log('[SCHEDULER] Firebase Admin nao configurado')
    return null
  }

  const admin = await import('firebase-admin')

  if (!admin.default.apps.length) {
    admin.default.initializeApp({
      credential: admin.default.credential.cert({
        projectId: 'axis-tcc',
        clientEmail,
        privateKey
      })
    })
  }

  adminInitialized = true
  adminInstance = admin.default
  return adminInstance
}

/**
 * Helper RLS local (cron context, sem auth Clerk).
 *
 * BEGIN + set_config('app.tenant_id', tenantId, true) + callback + COMMIT.
 * Mesmo padrao de scripts/workers/transcription-worker.ts. Necessario porque
 * tabelas como `patients` tem RLS forced+enabled com policy
 * `tenant_id = app_tenant_id()` (migration 063, Item 11E) - sem GUC, queries
 * lancam `[AXIS RLS] app.tenant_id nao definido na sessao`.
 *
 * Caller cross-tenant (cron `reminders`) e o motivo do Item 11F: sem este
 * wrap, scheduler explodia a cada minuto apos a 063 ser aplicada em prod.
 *
 * Pattern S3 (igual scan-integrity, mas com set_config explicito):
 *   1. Query 0 (sem GUC) descobre tenants com trabalho pendente em tabela
 *      sem RLS (scheduled_reminders).
 *   2. Loop por tenant: withTenantClient seta o GUC, callback executa
 *      queries que tocam tabelas RLS-protegidas.
 */
async function withTenantClient<T>(
  tenantId: string,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId])
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Processa lembretes pendentes e envia push.
 *
 * REGRA: Lembretes de sessao vao para PACIENTE (nao para o profissional).
 * REGRA: Conteudo apenas logistico (horario), nunca clinico (Bible).
 *
 * Pattern S3 cross-tenant:
 *   1. Query 0 descobre tenants com lembretes pendentes (scheduled_reminders
 *      sem RLS, cross-tenant OK).
 *   2. Loop por tenant: withTenantClient seta GUC `app.tenant_id`, callback
 *      processa lembretes daquele tenant (JOIN com patients respeita RLS).
 *
 * Best-effort por tenant: erro fatal num tenant nao bloqueia outros.
 */
export async function processScheduledReminders(): Promise<{ sent: number; failed: number }> {
  console.log('[SCHEDULER] Processando lembretes pendentes...')

  let totalSent = 0
  let totalFailed = 0

  try {
    // Query 0: descobrir tenants com lembretes pendentes.
    // scheduled_reminders sem RLS - cross-tenant OK aqui.
    const tenantsResult = await pool.query(
      `SELECT DISTINCT tenant_id
         FROM scheduled_reminders
        WHERE sent = false
          AND recipient_type = 'patient'
          AND scheduled_time <= NOW()`
    )

    if (tenantsResult.rows.length === 0) {
      console.log('[SCHEDULER] Nenhum tenant com lembretes pendentes')
      return { sent: 0, failed: 0 }
    }

    console.log(`[SCHEDULER] ${tenantsResult.rows.length} tenant(s) com lembretes pendentes`)

    // Inicializa Firebase 1x (singleton). Pode ser null se nao configurado.
    const admin = await getFirebaseAdmin()

    // Loop por tenant: cada um seta seu GUC via withTenantClient.
    for (const { tenant_id } of tenantsResult.rows) {
      try {
        const result = await withTenantClient(tenant_id, async (client) => {
          return await processRemindersForTenant(client, tenant_id, admin)
        })
        totalSent += result.sent
        totalFailed += result.failed
      } catch (err) {
        console.error(`[SCHEDULER] [${tenant_id}] Erro fatal no tenant:`, err)
        // best-effort: continua para os proximos tenants. Nao soma a
        // totalFailed porque nao sabemos quantos lembretes havia neste
        // tenant - log do erro e segue.
      }
    }
  } catch (error) {
    console.error('[SCHEDULER] Erro geral:', error)
  }

  console.log(`[SCHEDULER] Concluido: ${totalSent} enviados, ${totalFailed} falharam`)
  return { sent: totalSent, failed: totalFailed }
}

/**
 * Processa lembretes de UM tenant especifico.
 *
 * Roda dentro de withTenantClient -> client tem `app.tenant_id` setado ->
 * RLS em patients (e qualquer tabela JOIN-ada com policy `app_tenant_id()`)
 * e satisfeito.
 *
 * Logs prefixados com `[SCHEDULER] [<tenantId>]` para debug por tenant.
 */
async function processRemindersForTenant(
  client: PoolClient,
  tenantId: string,
  admin: any | null
): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0

  // JOIN com patients funciona porque app_tenant_id() = tenantId no GUC.
  const result = await client.query(
    `SELECT sr.*, p.full_name as patient_name
       FROM scheduled_reminders sr
       JOIN patients p ON p.id = sr.patient_id
      WHERE sr.sent = false
        AND sr.recipient_type = 'patient'
        AND sr.scheduled_time <= NOW()
      ORDER BY sr.scheduled_time ASC
      LIMIT 50`
  )

  if (result.rows.length === 0) {
    // Race com outra instancia do scheduler entre Query 0 e Query 1 -
    // best-effort, retorna 0. Sem warning porque e legitimo.
    return { sent: 0, failed: 0 }
  }

  console.log(`[SCHEDULER] [${tenantId}] ${result.rows.length} lembretes para enviar`)

  if (!admin) {
    console.log(`[SCHEDULER] [${tenantId}] Firebase nao configurado, marcando como enviados`)
    for (const reminder of result.rows) {
      await client.query(
        'UPDATE scheduled_reminders SET sent = true, sent_at = NOW() WHERE id = $1',
        [reminder.id]
      )
    }
    return { sent: 0, failed: result.rows.length }
  }

  for (const reminder of result.rows) {
    try {
      // patient_push_tokens sem RLS, mas usar client (com GUC) por
      // consistencia - se a tabela receber RLS no futuro, ja fica isolada.
      const tokensResult = await client.query(
        'SELECT fcm_token FROM patient_push_tokens WHERE patient_id = $1',
        [reminder.patient_id]
      )

      if (tokensResult.rows.length === 0) {
        console.log(`[SCHEDULER] [${tenantId}] Paciente ${reminder.patient_id} sem token - pulando`)
        await client.query(
          'UPDATE scheduled_reminders SET sent = true, sent_at = NOW() WHERE id = $1',
          [reminder.id]
        )
        failed++
        continue
      }

      const tokens = tokensResult.rows.map(r => r.fcm_token)

      // Mensagem APENAS logistica - regra Bible (nunca clinica).
      const message = {
        notification: {
          title: reminder.title || 'Lembrete de Sessao',
          body: reminder.message || 'Voce tem uma sessao agendada'
        },
        data: {
          type: 'session_reminder',
          session_id: reminder.session_id || ''
        },
        tokens
      }

      const response = await admin.messaging().sendEachForMulticast(message)

      // Remover tokens invalidos.
      const invalidTokens: string[] = []
      response.responses.forEach((resp: any, idx: number) => {
        if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
          invalidTokens.push(tokens[idx])
        }
      })

      if (invalidTokens.length > 0) {
        await client.query(
          'DELETE FROM patient_push_tokens WHERE fcm_token = ANY($1)',
          [invalidTokens]
        )
      }

      // Marcar como enviado.
      await client.query(
        'UPDATE scheduled_reminders SET sent = true, sent_at = NOW() WHERE id = $1',
        [reminder.id]
      )

      if (response.successCount > 0) {
        sent++
        console.log(`[SCHEDULER] [${tenantId}] Lembrete ${reminder.id} enviado para paciente`)
      } else {
        failed++
        console.log(`[SCHEDULER] [${tenantId}] Lembrete ${reminder.id} falhou`)
      }
    } catch (err) {
      console.error(`[SCHEDULER] [${tenantId}] Erro no lembrete ${reminder.id}:`, err)
      failed++
    }
  }

  return { sent, failed }
}
