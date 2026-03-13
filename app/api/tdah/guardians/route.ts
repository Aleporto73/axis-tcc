import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS TDAH - API: Responsáveis (Guardians)
// GET — Lista responsáveis de um paciente
// POST — Adiciona responsável
// Bible §18, §27: dados de família
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const result = await withTenant(async (ctx) => {
      const { searchParams } = new URL(request.url)
      const patientId = searchParams.get('patient_id')

      if (!patientId) {
        const err = new Error('patient_id é obrigatório') as any
        err.statusCode = 400
        throw err
      }

      // Verificar acesso ao paciente
      let roleClause = ''
      const params: any[] = [patientId, ctx.tenantId]
      if (ctx.role === 'terapeuta') {
        params.push(ctx.profileId)
        roleClause = `AND p.created_by = $${params.length}`
      }

      const patientCheck = await ctx.client.query(
        `SELECT id FROM tdah_patients p WHERE p.id = $1 AND p.tenant_id = $2 ${roleClause}`,
        params
      )
      if (patientCheck.rows.length === 0) {
        const err = new Error('Paciente não encontrado') as any
        err.statusCode = 404
        throw err
      }

      return await ctx.client.query(
        `SELECT * FROM tdah_guardians
         WHERE patient_id = $1 AND tenant_id = $2 AND is_active = true
         ORDER BY is_primary DESC, name`,
        [patientId, ctx.tenantId]
      )
    })

    return NextResponse.json({ guardians: result.rows })
  } catch (error: any) {
    if (error?.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { patient_id, name, email, phone, relationship, is_primary } = body

    if (!patient_id || !name?.trim()) {
      return NextResponse.json(
        { error: 'patient_id e name são obrigatórios' },
        { status: 400 }
      )
    }

    const result = await withTenant(async (ctx) => {
      // Verificar paciente
      const patientCheck = await ctx.client.query(
        `SELECT id FROM tdah_patients WHERE id = $1 AND tenant_id = $2`,
        [patient_id, ctx.tenantId]
      )
      if (patientCheck.rows.length === 0) {
        const err = new Error('Paciente não encontrado') as any
        err.statusCode = 404
        throw err
      }

      // Se is_primary, remover primary dos outros
      if (is_primary) {
        await ctx.client.query(
          `UPDATE tdah_guardians SET is_primary = false WHERE patient_id = $1 AND tenant_id = $2`,
          [patient_id, ctx.tenantId]
        )
      }

      return await ctx.client.query(
        `INSERT INTO tdah_guardians (tenant_id, patient_id, name, email, phone, relationship, is_primary)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [ctx.tenantId, patient_id, name.trim(), email?.trim() || null, phone?.trim() || null, relationship || null, is_primary || false]
      )
    })

    return NextResponse.json({ guardian: result.rows[0] }, { status: 201 })
  } catch (error: any) {
    if (error?.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
