import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import { randomBytes } from 'crypto'

// =====================================================
// AXIS TDAH — API: Teacher Access Tokens
// GET — Lista tokens por paciente (admin/supervisor)
// POST — Gerar novo token para professor
// Bible §14: Perfil professor (acesso simplificado)
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patient_id')

    const result = await withTenant(async (ctx) => {
      // Só admin/supervisor pode gerenciar tokens
      if (ctx.role === 'terapeuta') {
        const err = new Error('Apenas admin/supervisor pode gerenciar tokens de professor') as any
        err.statusCode = 403
        throw err
      }

      const params: any[] = [ctx.tenantId]
      let filter = ''

      if (patientId) {
        params.push(patientId)
        filter = ` AND t.patient_id = $${params.length}`
      }

      return await ctx.client.query(
        `SELECT t.*,
          p.name as patient_name,
          cr.first_name || ' ' || cr.last_name as created_by_name,
          (SELECT COUNT(*) FROM tdah_teacher_access_log WHERE token_id = t.id) as access_count
        FROM tdah_teacher_tokens t
        JOIN tdah_patients p ON p.id = t.patient_id
        LEFT JOIN profiles cr ON cr.id = t.created_by
        WHERE t.tenant_id = $1 ${filter}
        ORDER BY t.created_at DESC`,
        params
      )
    })

    return NextResponse.json({ tokens: result.rows })
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
    const { patient_id, teacher_name, teacher_email, school_name, expires_days } = body

    if (!patient_id || !teacher_name) {
      return NextResponse.json(
        { error: 'patient_id e teacher_name são obrigatórios' },
        { status: 400 }
      )
    }

    const result = await withTenant(async (ctx) => {
      // Só admin/supervisor
      if (ctx.role === 'terapeuta') {
        const err = new Error('Apenas admin/supervisor pode criar tokens de professor') as any
        err.statusCode = 403
        throw err
      }

      // Verificar paciente
      const patient = await ctx.client.query(
        'SELECT id, name FROM tdah_patients WHERE id = $1 AND tenant_id = $2',
        [patient_id, ctx.tenantId]
      )
      if (patient.rows.length === 0) {
        const err = new Error('Paciente não encontrado') as any
        err.statusCode = 404
        throw err
      }

      // Gerar token seguro (32 bytes = 64 hex chars)
      const token = randomBytes(32).toString('hex')

      // Calcular expiração se especificada
      let expiresAt = null
      if (expires_days && expires_days > 0) {
        const d = new Date()
        d.setDate(d.getDate() + expires_days)
        expiresAt = d.toISOString()
      }

      const res = await ctx.client.query(
        `INSERT INTO tdah_teacher_tokens
          (tenant_id, patient_id, token, teacher_name, teacher_email, school_name, expires_at, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          ctx.tenantId, patient_id, token,
          teacher_name,
          teacher_email || null,
          school_name || null,
          expiresAt,
          ctx.profileId
        ]
      )

      // Atualizar campos escola no paciente se fornecidos
      if (teacher_name || teacher_email || school_name) {
        const sets: string[] = ['updated_at = NOW()']
        const p: any[] = [patient_id, ctx.tenantId]
        if (teacher_name) { p.push(teacher_name); sets.push(`teacher_name = $${p.length}`) }
        if (teacher_email) { p.push(teacher_email); sets.push(`teacher_email = $${p.length}`) }
        if (school_name) { p.push(school_name); sets.push(`school_name = $${p.length}`) }
        await ctx.client.query(
          `UPDATE tdah_patients SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2`,
          p
        )
      }

      // Audit log
      try {
        await ctx.client.query(
          `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
           VALUES ($1, $2, 'user', 'TDAH_TEACHER_TOKEN_CREATED', 'tdah_teacher_tokens',
           jsonb_build_object('token_id', $3::text, 'patient_id', $4::text, 'teacher_name', $5::text), NOW())`,
          [ctx.tenantId, ctx.userId || 'system', res.rows[0].id, patient_id, teacher_name]
        )
      } catch (_) { /* audit non-blocking */ }

      return res.rows[0]
    })

    return NextResponse.json({ token: result }, { status: 201 })
  } catch (error: any) {
    if (error?.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
