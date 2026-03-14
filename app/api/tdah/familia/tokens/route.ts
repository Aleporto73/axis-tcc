import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import { randomBytes } from 'crypto'

// =====================================================
// AXIS TDAH — API: Family Portal Tokens
// GET — Lista tokens por paciente (admin/supervisor)
// POST — Gerar token para responsável
// Visibilidade família: progresso resumido, DRC, sessões
// ❌ Scores CSO, ❌ snapshots, ❌ layer AuDHD
// =====================================================

const DEFAULT_EXPIRY_DAYS = 90

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patient_id')

    const result = await withTenant(async (ctx) => {
      if (ctx.role === 'terapeuta') {
        const err = new Error('Apenas admin/supervisor pode gerenciar tokens de família') as any
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
          g.name as guardian_name_ref,
          cr.first_name || ' ' || cr.last_name as created_by_name,
          (SELECT COUNT(*) FROM tdah_family_access_log WHERE token_id = t.id) as access_count
        FROM tdah_family_tokens t
        JOIN tdah_patients p ON p.id = t.patient_id
        LEFT JOIN tdah_guardians g ON g.id = t.guardian_id
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
    const { patient_id, guardian_id, guardian_name, guardian_email, relationship, expires_days } = body

    if (!patient_id || !guardian_name) {
      return NextResponse.json(
        { error: 'patient_id e guardian_name são obrigatórios' },
        { status: 400 }
      )
    }

    const result = await withTenant(async (ctx) => {
      if (ctx.role === 'terapeuta') {
        const err = new Error('Apenas admin/supervisor pode criar tokens de família') as any
        err.statusCode = 403
        throw err
      }

      // Verificar paciente
      const patient = await ctx.client.query(
        'SELECT id FROM tdah_patients WHERE id = $1 AND tenant_id = $2',
        [patient_id, ctx.tenantId]
      )
      if (patient.rows.length === 0) {
        const err = new Error('Paciente não encontrado') as any
        err.statusCode = 404
        throw err
      }

      // Se guardian_id, verificar pertence ao paciente
      if (guardian_id) {
        const g = await ctx.client.query(
          'SELECT id FROM tdah_guardians WHERE id = $1 AND patient_id = $2 AND tenant_id = $3 AND is_active = true',
          [guardian_id, patient_id, ctx.tenantId]
        )
        if (g.rows.length === 0) {
          const err = new Error('Responsável não encontrado') as any
          err.statusCode = 404
          throw err
        }

        // Verificar se já existe token ativo para este guardian
        const existing = await ctx.client.query(
          `SELECT id, token FROM tdah_family_tokens
           WHERE guardian_id = $1 AND patient_id = $2 AND tenant_id = $3
             AND is_active = true AND (expires_at IS NULL OR expires_at > NOW())`,
          [guardian_id, patient_id, ctx.tenantId]
        )
        if (existing.rows.length > 0) {
          return { ...existing.rows[0], reused: true }
        }
      }

      const token = randomBytes(32).toString('hex')
      const days = expires_days || DEFAULT_EXPIRY_DAYS
      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

      const res = await ctx.client.query(
        `INSERT INTO tdah_family_tokens
          (tenant_id, patient_id, guardian_id, token, guardian_name, guardian_email, relationship, expires_at, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          ctx.tenantId, patient_id,
          guardian_id || null,
          token,
          guardian_name,
          guardian_email || null,
          relationship || null,
          expiresAt,
          ctx.profileId,
        ]
      )

      // Audit log
      try {
        await ctx.client.query(
          `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
           VALUES ($1, $2, 'user', 'TDAH_FAMILY_TOKEN_CREATED', 'tdah_family_tokens',
           jsonb_build_object('token_id', $3::text, 'patient_id', $4::text, 'guardian_name', $5::text), NOW())`,
          [ctx.tenantId, ctx.userId || 'system', res.rows[0].id, patient_id, guardian_name]
        )
      } catch (_) { /* non-blocking */ }

      return { ...res.rows[0], reused: false }
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
