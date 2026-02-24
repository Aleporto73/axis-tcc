import pool from '../database/db'

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
 * Processa lembretes pendentes e envia push
 * REGRA: Lembretes de sessao vao para PACIENTE
 * REGRA: Conteudo apenas logistico (horario), nunca clinico
 */
export async function processScheduledReminders(): Promise<{ sent: number; failed: number }> {
  console.log('[SCHEDULER] Processando lembretes pendentes...')
  
  let sent = 0
  let failed = 0

  try {
    // Buscar lembretes pendentes (apenas para pacientes)
    const result = await pool.query(
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
      console.log('[SCHEDULER] Nenhum lembrete pendente')
      return { sent: 0, failed: 0 }
    }

    console.log(`[SCHEDULER] ${result.rows.length} lembretes para enviar`)

    const admin = await getFirebaseAdmin()
    if (!admin) {
      console.log('[SCHEDULER] Firebase nao configurado, marcando como enviados')
      for (const reminder of result.rows) {
        await pool.query(
          'UPDATE scheduled_reminders SET sent = true, sent_at = NOW() WHERE id = $1',
          [reminder.id]
        )
      }
      return { sent: 0, failed: result.rows.length }
    }

    for (const reminder of result.rows) {
      try {
        // Buscar tokens do PACIENTE (nao do profissional)
        const tokensResult = await pool.query(
          'SELECT fcm_token FROM patient_push_tokens WHERE patient_id = $1',
          [reminder.patient_id]
        )

        if (tokensResult.rows.length === 0) {
          console.log(`[SCHEDULER] Paciente ${reminder.patient_id} sem token - pulando`)
          await pool.query(
            'UPDATE scheduled_reminders SET sent = true, sent_at = NOW() WHERE id = $1',
            [reminder.id]
          )
          failed++
          continue
        }

        const tokens = tokensResult.rows.map(r => r.fcm_token)

        // Mensagem APENAS logistica - nunca clinica
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
        
        // Remover tokens invalidos
        const invalidTokens: string[] = []
        response.responses.forEach((resp: any, idx: number) => {
          if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
            invalidTokens.push(tokens[idx])
          }
        })

        if (invalidTokens.length > 0) {
          await pool.query(
            'DELETE FROM patient_push_tokens WHERE fcm_token = ANY($1)',
            [invalidTokens]
          )
        }

        // Marcar como enviado
        await pool.query(
          'UPDATE scheduled_reminders SET sent = true, sent_at = NOW() WHERE id = $1',
          [reminder.id]
        )

        if (response.successCount > 0) {
          sent++
          console.log(`[SCHEDULER] Lembrete ${reminder.id} enviado para paciente`)
        } else {
          failed++
          console.log(`[SCHEDULER] Lembrete ${reminder.id} falhou`)
        }

      } catch (err) {
        console.error(`[SCHEDULER] Erro no lembrete ${reminder.id}:`, err)
        failed++
      }
    }

  } catch (error) {
    console.error('[SCHEDULER] Erro geral:', error)
  }

  console.log(`[SCHEDULER] Concluido: ${sent} enviados, ${failed} falharam`)
  return { sent, failed }
}
