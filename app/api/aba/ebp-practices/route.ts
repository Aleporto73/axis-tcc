import { NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

export async function GET() {
  try {
    const result = await withTenant(async ({ client }) => {
      const res = await client.query('SELECT id, name, description FROM ebp_practices ORDER BY id')
      return res.rows
    })

    return NextResponse.json({ practices: result })
  } catch (error: any) {
    console.error('[EBP Practices GET]', error)
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
  }
}
