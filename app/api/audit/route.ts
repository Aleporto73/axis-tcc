import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'

// POST - Registrar evento de auditoria
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { action, entity_type, entity_id, metadata } = body

    // Validar action
    const allowedActions = [
      'SESSION_CREATE',
      'SESSION_START',
      'SESSION_FINISH',
      'EVENT_MARK',
      'REPORT_VIEW',
      'REPORT_EXPORT',
      'SUPERVISION_CONTEXT_ADD',
      'PATIENT_CREATE',
      'PATIENT_UPDATE',
      'SUGGESTION_ACCEPT',
      'SUGGESTION_REJECT'
    ]

    if (!allowedActions.includes(action)) {
      return NextResponse.json({ error: 'Acao invalida' }, { status: 400 })
    }

    // Buscar tenant
    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE clerk_user_id = $1',
      [userId]
    )
    if (tenantResult.rows.length === 0) {
      return NextResponse.json({ error: 'Tenant nao encontrado' }, { status: 404 })
    }
    const tenantId = tenantResult.rows[0].id

    // Sanitizar metadata - remover qualquer conteudo clinico
    const safeMetadata = metadata ? {
      ...metadata,
      // Nunca logar conteudo de texto clinico
      text: undefined,
      content: undefined,
      transcription: undefined,
      notes: undefined,
      context: undefined
    } : null

    // Inserir log
    await pool.query(
      `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, 'human', $3, $4, $5, $6)`,
      [tenantId, userId, action, entity_type || null, entity_id || null, safeMetadata ? JSON.stringify(safeMetadata) : null]
    )

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Erro ao registrar auditoria:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// GET - Buscar logs de auditoria (para admin/compliance)
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const action = searchParams.get('action')

    let query = `
      SELECT id, user_id, actor, action, entity_type, entity_id, metadata, axis_version, created_at
      FROM axis_audit_logs
      WHERE tenant_id = $1
    `
    const params: any[] = [tenantId]

    if (action) {
      query += ` AND action = $2`
      params.push(action)
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`
    params.push(limit)

    const result = await pool.query(query, params)

    return NextResponse.json({ logs: result.rows })

  } catch (error) {
    console.error('Erro ao buscar auditoria:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
