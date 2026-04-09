import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

// POST - Registrar evento de auditoria
export async function POST(request: NextRequest) {
  try {
    return await withTenant(async (ctx) => {
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
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata)
         VALUES ($1, $2, 'human', $3, $4, $5, $6)`,
        [ctx.tenantId, ctx.userId, action, entity_type || null, entity_id || null, safeMetadata ? JSON.stringify(safeMetadata) : null]
      )

      return NextResponse.json({ success: true })
    })
  } catch (error) {
    console.error('Erro ao registrar auditoria:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

// GET - Buscar logs de auditoria (para admin/compliance)
export async function GET(request: NextRequest) {
  try {
    return await withTenant(async (ctx) => {
      const { searchParams } = new URL(request.url)
      const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
      const action = searchParams.get('action')

      let query = `
        SELECT id, user_id, actor, action, entity_type, entity_id, metadata, axis_version, created_at
        FROM axis_audit_logs
        WHERE tenant_id = $1
      `
      const params: any[] = [ctx.tenantId]

      if (action) {
        query += ` AND action = $2`
        params.push(action)
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`
      params.push(limit)

      const result = await ctx.client.query(query, params)

      return NextResponse.json({ logs: result.rows })
    })
  } catch (error) {
    console.error('Erro ao buscar auditoria:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
