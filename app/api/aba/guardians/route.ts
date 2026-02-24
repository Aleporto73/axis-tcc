import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const learner_id = searchParams.get('learner_id')
    if (!learner_id) return NextResponse.json({ error: 'learner_id obrigatório' }, { status: 400 })
    const result = await withTenant(async ({ client, tenantId }) => {
      const res = await client.query(
        'SELECT * FROM guardians WHERE learner_id = $1 AND tenant_id = $2 AND is_active = true ORDER BY created_at ASC',
        [learner_id, tenantId]
      )
      return { guardians: res.rows }
    })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { learner_id, name, email, phone, relationship } = await req.json()
    if (!learner_id || !name) return NextResponse.json({ error: 'learner_id e name obrigatórios' }, { status: 400 })
    const result = await withTenant(async ({ client, tenantId }) => {
      const res = await client.query(
        `INSERT INTO guardians (id, tenant_id, learner_id, name, email, phone, relationship, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, true, NOW(), NOW()) RETURNING *`,
        [tenantId, learner_id, name, email || null, phone || null, relationship || null]
      )
      return { guardian: res.rows[0] }
    })
    return NextResponse.json(result, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
    await withTenant(async ({ client, tenantId }) => {
      await client.query(
        'UPDATE guardians SET is_active = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      )
    })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
