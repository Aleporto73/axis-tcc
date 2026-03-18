import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '../../guard'
import pool from '@/src/database/db'

// =====================================================
// GET  /api/admin/users/[tenantId]  — detalhes completos
// PATCH /api/admin/users/[tenantId] — ações (licença, max_patients)
// DELETE /api/admin/users/[tenantId] — LGPD delete
// =====================================================

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await verifyAdmin()
  if (!check.authorized) return check.response

  const { id: tenantId } = await params

  try {
    // Tenant + profile
    const tenantRes = await pool.query(
      `SELECT t.*, p.name AS profile_name, p.email AS profile_email,
              p.crp, p.crp_uf, p.role, p.clerk_user_id AS profile_clerk_id
       FROM tenants t
       LEFT JOIN profiles p ON p.tenant_id = t.id AND p.is_active = true
       WHERE t.id = $1`,
      [tenantId]
    )

    if (tenantRes.rows.length === 0) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })
    }

    // Licenças
    const licensesRes = await pool.query(
      `SELECT * FROM user_licenses WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    )

    // Audit logs (últimos 30)
    const logsRes = await pool.query(
      `SELECT action, entity_type, metadata, created_at, actor
       FROM axis_audit_logs
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [tenantId]
    )

    // Patient/learner counts
    const patientCount = await pool.query(
      `SELECT
        (SELECT COUNT(*)::int FROM patients WHERE tenant_id = $1 AND is_active = true) AS tcc_patients,
        (SELECT COUNT(*)::int FROM learners WHERE tenant_id = $1 AND is_active = true) AS aba_learners`,
      [tenantId]
    )

    return NextResponse.json({
      tenant: tenantRes.rows[0],
      licenses: licensesRes.rows,
      audit_logs: logsRes.rows,
      counts: patientCount.rows[0],
    })
  } catch (error) {
    console.error('[ADMIN USER DETAIL]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await verifyAdmin()
  if (!check.authorized) return check.response

  const { id: tenantId } = await params
  const body = await req.json()
  const { action } = body

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    if (action === 'update_license') {
      // Atualizar licença existente
      const { license_id, is_active, max_patients, hotmart_plan } = body
      if (!license_id) return NextResponse.json({ error: 'license_id obrigatório' }, { status: 400 })

      await client.query(
        `UPDATE user_licenses
         SET is_active = COALESCE($1, is_active),
             hotmart_plan = COALESCE($2, hotmart_plan),
             updated_at = NOW()
         WHERE id = $3 AND tenant_id = $4`,
        [is_active, hotmart_plan, license_id, tenantId]
      )

      if (max_patients !== undefined) {
        await client.query(
          `UPDATE tenants SET max_patients = $1, updated_at = NOW() WHERE id = $2`,
          [max_patients, tenantId]
        )
      }

      // Audit
      await client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
         VALUES ($1, $2, 'admin_panel', 'ADMIN_LICENSE_UPDATE', 'user_licenses', $3, NOW())`,
        [tenantId, check.userId, JSON.stringify({
          admin_email: check.email, license_id,
          changes: { is_active, max_patients, hotmart_plan },
        })]
      )

    } else if (action === 'activate_free') {
      // Criar licença FREE para produto específico
      const { product_type } = body
      if (!['tcc', 'aba', 'tdah'].includes(product_type)) {
        return NextResponse.json({ error: 'product_type inválido' }, { status: 400 })
      }

      const tenantRes = await client.query('SELECT clerk_user_id FROM tenants WHERE id = $1', [tenantId])
      if (tenantRes.rows.length === 0) return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })

      await client.query(
        `INSERT INTO user_licenses (
          tenant_id, clerk_user_id, product_type, is_active,
          valid_from, hotmart_event, created_at, updated_at
        ) VALUES ($1, $2, $3, true, NOW(), 'ADMIN_FREE_ACTIVATION', NOW(), NOW())
        ON CONFLICT ON CONSTRAINT uq_user_product
        DO UPDATE SET is_active = true, hotmart_event = 'ADMIN_FREE_ACTIVATION', updated_at = NOW()`,
        [tenantId, tenantRes.rows[0].clerk_user_id, product_type]
      )

      await client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
         VALUES ($1, $2, 'admin_panel', 'ADMIN_FREE_ACTIVATED', 'user_licenses', $3, NOW())`,
        [tenantId, check.userId, JSON.stringify({
          admin_email: check.email, product_type,
        })]
      )

    } else if (action === 'upgrade_manual') {
      const { product_type, plan_tier, max_patients } = body
      if (!product_type || !plan_tier) return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })

      const tenantRes = await client.query('SELECT clerk_user_id FROM tenants WHERE id = $1', [tenantId])
      if (tenantRes.rows.length === 0) return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 })

      await client.query(
        `INSERT INTO user_licenses (
          tenant_id, clerk_user_id, product_type, is_active,
          valid_from, hotmart_plan, hotmart_event, created_at, updated_at
        ) VALUES ($1, $2, $3, true, NOW(), $4, 'ADMIN_MANUAL_UPGRADE', NOW(), NOW())
        ON CONFLICT ON CONSTRAINT uq_user_product
        DO UPDATE SET is_active = true, hotmart_plan = $4, hotmart_event = 'ADMIN_MANUAL_UPGRADE', updated_at = NOW()`,
        [tenantId, tenantRes.rows[0].clerk_user_id, product_type, plan_tier]
      )

      if (max_patients) {
        await client.query(
          `UPDATE tenants SET plan_tier = $1, max_patients = $2, updated_at = NOW() WHERE id = $3`,
          [plan_tier, max_patients, tenantId]
        )
      }

      await client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
         VALUES ($1, $2, 'admin_panel', 'ADMIN_MANUAL_UPGRADE', 'user_licenses', $3, NOW())`,
        [tenantId, check.userId, JSON.stringify({
          admin_email: check.email, product_type, plan_tier, max_patients,
        })]
      )

    } else if (action === 'deactivate_all') {
      await client.query(
        `UPDATE user_licenses SET is_active = false, valid_until = NOW(), updated_at = NOW()
         WHERE tenant_id = $1 AND is_active = true`,
        [tenantId]
      )

      await client.query(
        `UPDATE tenants SET plan_tier = 'free', max_patients = 1, updated_at = NOW() WHERE id = $1`,
        [tenantId]
      )

      await client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
         VALUES ($1, $2, 'admin_panel', 'ADMIN_DEACTIVATE_ALL', 'user_licenses', $3, NOW())`,
        [tenantId, check.userId, JSON.stringify({ admin_email: check.email })]
      )

    } else {
      return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 })
    }

    await client.query('COMMIT')
    return NextResponse.json({ success: true, action })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[ADMIN USER ACTION]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  } finally {
    client.release()
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await verifyAdmin()
  if (!check.authorized) return check.response

  const { id: tenantId } = await params
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // LGPD: apagar dados clínicos em cascata
    // Ordem: dependentes → pai
    await client.query(`DELETE FROM axis_audit_logs WHERE tenant_id = $1`, [tenantId])
    await client.query(`DELETE FROM user_licenses WHERE tenant_id = $1`, [tenantId])

    // TCC clinical data
    await client.query(`DELETE FROM session_events WHERE session_id IN (SELECT id FROM sessions WHERE tenant_id = $1)`, [tenantId])
    await client.query(`DELETE FROM sessions WHERE tenant_id = $1`, [tenantId])
    await client.query(`DELETE FROM patients WHERE tenant_id = $1`, [tenantId])

    // ABA clinical data
    await client.query(`DELETE FROM trial_data WHERE session_id IN (SELECT id FROM aba_sessions WHERE tenant_id = $1)`, [tenantId])
    await client.query(`DELETE FROM aba_sessions WHERE tenant_id = $1`, [tenantId])
    await client.query(`DELETE FROM protocols WHERE tenant_id = $1`, [tenantId])
    await client.query(`DELETE FROM learners WHERE tenant_id = $1`, [tenantId])

    // Core
    await client.query(`DELETE FROM profiles WHERE tenant_id = $1`, [tenantId])
    await client.query(`DELETE FROM tenants WHERE id = $1`, [tenantId])

    await client.query('COMMIT')

    console.log('[ADMIN DELETE LGPD]', { tenantId, admin: check.email })

    return NextResponse.json({ success: true, deleted_tenant: tenantId })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[ADMIN DELETE]', error)
    return NextResponse.json({ error: 'Erro ao deletar. Verifique dependências.' }, { status: 500 })
  } finally {
    client.release()
  }
}
