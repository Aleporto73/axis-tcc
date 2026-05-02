import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

// GET — Listar notificações do usuário
export async function GET(request: NextRequest) {
  try {
    const result = await withTenant(async ({ client, tenantId, userId }) => {
      const { searchParams } = new URL(request.url)
      const status = searchParams.get('status')

      let query = `
        SELECT * FROM notifications
        WHERE tenant_id = $1 AND recipient_id = $2
      `
      const params: any[] = [tenantId, userId]

      if (status) {
        params.push(status)
        query += ` AND status = $${params.length}`
      }

      query += ` ORDER BY created_at DESC LIMIT 50`

      return await client.query(query, params)
    })

    return NextResponse.json({ notifications: result.rows })
  } catch (error: any) {
    console.error('Erro ao listar notificações:', error)
    if (error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — Disparar verificações de notificação ou marcar como lida
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (!action || !['check_maintenance', 'check_regression', 'mark_read'].includes(action)) {
      return NextResponse.json(
        { error: 'action deve ser "check_maintenance", "check_regression" ou "mark_read"' },
        { status: 400 }
      )
    }

    if (action === 'check_maintenance') {
      const result = await withTenant(async ({ client, tenantId }) => {
        return await client.query(
          'SELECT notify_maintenance_due($1) as count',
          [tenantId]
        )
      })

      return NextResponse.json({ notifications_created: result.rows[0]?.count || 0 })
    }

    if (action === 'check_regression') {
      const { protocol_id } = body

      if (!protocol_id) {
        return NextResponse.json(
          { error: 'protocol_id é obrigatório para check_regression' },
          { status: 400 }
        )
      }

      await withTenant(async ({ client, tenantId }) => {
        await client.query(
          'SELECT notify_regression_detected($1, $2)',
          [protocol_id, tenantId]
        )
      })

      return NextResponse.json({ checked: true })
    }

    if (action === 'mark_read') {
      const { notification_id } = body

      if (!notification_id) {
        return NextResponse.json(
          { error: 'notification_id é obrigatório' },
          { status: 400 }
        )
      }

      await withTenant(async ({ client, tenantId }) => {
        const result = await client.query(
          `UPDATE notifications SET status = 'read', read_at = NOW()
           WHERE id = $1 AND tenant_id = $2 AND status = 'pending'`,
          [notification_id, tenantId]
        )

        if (result.rowCount === 0) {
          throw new Error('Notificação não encontrada ou já lida')
        }
      })

      return NextResponse.json({ read: true })
    }
  } catch (error: any) {
    console.error('Erro ao gerenciar notificações:', error)
    if (error.message === 'Não autenticado') {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (error.message?.includes('[AXIS ABA]') || error.message?.includes('não encontrada')) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
