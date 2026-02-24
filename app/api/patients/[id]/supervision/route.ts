import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const params = await context.params
    const patientId = params.id

    const tenant = await pool.query('SELECT id FROM tenants WHERE clerk_user_id = $1', [userId])
    if (tenant.rows.length === 0) return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })

    const result = await pool.query(
      'SELECT supervision_context FROM patients WHERE id = $1 AND tenant_id = $2',
      [patientId, tenant.rows[0].id]
    )

    return NextResponse.json({
      context: result.rows[0]?.supervision_context || ''
    })
  } catch (error) {
    console.error('Erro ao buscar contexto supervisão:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const params = await context.params
    const patientId = params.id
    const body = await request.json()
    const { context: supervisionContext } = body

    if (typeof supervisionContext !== 'string' || supervisionContext.length > 800) {
      return NextResponse.json({ error: 'Texto inválido (máx 800 caracteres)' }, { status: 400 })
    }

    const tenant = await pool.query('SELECT id FROM tenants WHERE clerk_user_id = $1', [userId])
    if (tenant.rows.length === 0) return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })

    await pool.query(
      'UPDATE patients SET supervision_context = $1 WHERE id = $2 AND tenant_id = $3',
      [supervisionContext || null, patientId, tenant.rows[0].id]
    )

    await pool.query(
      `INSERT INTO axis_audit_logs (tenant_id, action, metadata)
       VALUES ($1, 'SUPERVISION_CONTEXT_SAVED', $2)`,
      [tenant.rows[0].id, JSON.stringify({ patient_id: patientId, length: supervisionContext.length })]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao salvar contexto supervisão:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
