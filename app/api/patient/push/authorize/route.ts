import { NextRequest, NextResponse } from 'next/server'
import pool from '@/src/database/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { patient_token, fcm_token, device_info } = body

    if (!patient_token || !fcm_token) {
      return NextResponse.json({ error: 'Token obrigatorio' }, { status: 400 })
    }

    const patientResult = await pool.query(
      'SELECT id, tenant_id, full_name FROM patients WHERE push_auth_token = $1',
      [patient_token]
    )

    if (patientResult.rows.length === 0) {
      return NextResponse.json({ error: 'Link invalido ou expirado' }, { status: 404 })
    }

    const patient = patientResult.rows[0]

    await pool.query(
      `INSERT INTO patient_push_tokens (tenant_id, patient_id, fcm_token, device_info, consent_given_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (patient_id, fcm_token)
       DO UPDATE SET updated_at = NOW(), device_info = EXCLUDED.device_info`,
      [patient.tenant_id, patient.id, fcm_token, device_info || null]
    )

    await pool.query(
      `INSERT INTO audit_logs (tenant_id, table_name, record_id, action, new_values, created_at)
       VALUES ($1, 'patient_push_tokens', $2, 'PUSH_CONSENT_GIVEN', $3, NOW())`,
      [patient.tenant_id, patient.id, JSON.stringify({ device_info, timestamp: new Date().toISOString() })]
    )

    return NextResponse.json({
      success: true,
      message: 'Notificacoes ativadas com sucesso',
      patient_name: patient.full_name
    })
  } catch (error) {
    console.error('Erro ao autorizar push paciente:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
