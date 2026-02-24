import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'
import { randomBytes } from 'crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE clerk_user_id = $1',
      [userId]
    )
    if (tenantResult.rows.length === 0) {
      return NextResponse.json({ error: 'Tenant nao encontrado' }, { status: 404 })
    }
    const tenantId = tenantResult.rows[0].id

    const { id: patientId } = await params

    // Verificar se paciente existe
    const patientResult = await pool.query(
      'SELECT id, full_name, push_auth_token FROM patients WHERE id = $1 AND tenant_id = $2',
      [patientId, tenantId]
    )
    if (patientResult.rows.length === 0) {
      return NextResponse.json({ error: 'Paciente nao encontrado' }, { status: 404 })
    }

    const patient = patientResult.rows[0]

    // Gerar novo token ou usar existente
    let authToken = patient.push_auth_token
    if (!authToken) {
      authToken = randomBytes(32).toString('hex')
      await pool.query(
        'UPDATE patients SET push_auth_token = $1 WHERE id = $2',
        [authToken, patientId]
      )
    }

    // Gerar link público
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://axistcc.com'
    const pushLink = `${baseUrl}/ativar-lembretes?token=${authToken}`

    return NextResponse.json({
      success: true,
      link: pushLink,
      patient_name: patient.full_name
    })

  } catch (error) {
    console.error('Erro ao gerar link push:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
