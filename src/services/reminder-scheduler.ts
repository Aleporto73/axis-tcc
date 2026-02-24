import pool from '../database/db.js'
import { sendPushNotification } from './push-sender.js'

export async function checkAndSendReminders() {
  try {
    const result = await pool.query(
      `SELECT r.id, r.message, p.endpoint 
       FROM scheduled_reminders r
       JOIN push_subscriptions p ON r.tenant_id = p.tenant_id AND r.patient_id::text = p.user_id
       WHERE r.scheduled_time <= NOW() AND r.sent = FALSE
       LIMIT 10`
    )

    for (const row of result.rows) {
      const sent = await sendPushNotification(
        row.endpoint,
        'Lembrete AXIS TCC',
        row.message
      )

      if (sent) {
        await pool.query(
          'UPDATE scheduled_reminders SET sent = TRUE, sent_at = NOW() WHERE id = $1',
          [row.id]
        )
      }
    }

    console.log(`Processados ${result.rows.length} lembretes`)
  } catch (error) {
    console.error('Erro ao processar lembretes:', error)
  }
}

setInterval(checkAndSendReminders, 60000)
