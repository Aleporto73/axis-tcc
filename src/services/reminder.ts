import pool from '../database/db'

interface ScheduleReminderParams {
  tenant_id: string
  session_id: string
  patient_id: string
  scheduled_at: Date
  patient_name: string
}

/**
 * Agenda lembretes para uma sessão
 * REGRA: Lembretes vão para o PACIENTE, não para o profissional
 * REGRA: Máximo 2 lembretes (24h antes + 10min antes)
 * REGRA: Só agenda se paciente autorizou push
 */
export async function scheduleSessionReminders(params: ScheduleReminderParams): Promise<boolean> {
  const { tenant_id, session_id, patient_id, scheduled_at, patient_name } = params

  // Verificar se paciente autorizou push
  const tokenResult = await pool.query(
    'SELECT id FROM patient_push_tokens WHERE patient_id = $1 LIMIT 1',
    [patient_id]
  )

  if (tokenResult.rows.length === 0) {
    console.log(`[REMINDER] Paciente ${patient_id} nao autorizou push - lembretes NAO agendados`)
    return false
  }

  // Limpar lembretes anteriores desta sessão (caso reagende)
  await pool.query(
    'DELETE FROM scheduled_reminders WHERE session_id = $1',
    [session_id]
  )

  const sessionDate = new Date(scheduled_at)
  const now = new Date()
  let remindersScheduled = 0

  // Lembrete 1: 24 horas antes
  const reminder24h = new Date(sessionDate.getTime() - 24 * 60 * 60 * 1000)
  if (reminder24h > now) {
    await pool.query(
      `INSERT INTO scheduled_reminders 
       (tenant_id, session_id, patient_id, recipient_type, recipient_id, scheduled_time, title, message, reminder_type)
       VALUES ($1, $2, $3, 'patient', $3, $4, $5, $6, '24h')`,
      [
        tenant_id,
        session_id,
        patient_id,
        reminder24h,
        'Lembrete de Sessao',
        `Voce tem uma sessao amanha`
      ]
    )
    remindersScheduled++
  }

  // Lembrete 2: 10 minutos antes
  const reminder10m = new Date(sessionDate.getTime() - 10 * 60 * 1000)
  if (reminder10m > now) {
    await pool.query(
      `INSERT INTO scheduled_reminders 
       (tenant_id, session_id, patient_id, recipient_type, recipient_id, scheduled_time, title, message, reminder_type)
       VALUES ($1, $2, $3, 'patient', $3, $4, $5, $6, '10m')`,
      [
        tenant_id,
        session_id,
        patient_id,
        reminder10m,
        'Sessao em 10 minutos',
        `Sua sessao comeca em breve`
      ]
    )
    remindersScheduled++
  }

  console.log(`[REMINDER] ${remindersScheduled} lembretes agendados para paciente ${patient_id} (sessao ${session_id})`)
  return remindersScheduled > 0
}

/**
 * Cancela lembretes de uma sessão
 */
export async function cancelSessionReminders(session_id: string): Promise<void> {
  await pool.query(
    'DELETE FROM scheduled_reminders WHERE session_id = $1',
    [session_id]
  )
  console.log(`[REMINDER] Lembretes cancelados para sessao ${session_id}`)
}

/**
 * Busca lembretes pendentes que devem ser enviados agora
 */
export async function getPendingReminders(): Promise<any[]> {
  const result = await pool.query(
    `SELECT sr.*, p.full_name as patient_name
     FROM scheduled_reminders sr
     JOIN patients p ON p.id = sr.patient_id
     WHERE sr.sent = false 
       AND sr.scheduled_time <= NOW()
     ORDER BY sr.scheduled_time ASC
     LIMIT 50`
  )
  return result.rows
}

/**
 * Marca lembrete como enviado
 */
export async function markReminderSent(reminder_id: string): Promise<void> {
  await pool.query(
    'UPDATE scheduled_reminders SET sent = true, sent_at = NOW() WHERE id = $1',
    [reminder_id]
  )
}
