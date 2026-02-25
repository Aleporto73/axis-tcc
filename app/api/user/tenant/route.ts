import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import pool from '@/src/database/db'

// =====================================================
// AXIS - Resolver/Criar Tenant + Profile (Multi-Terapeuta)
// Fluxo:
//   1. Busca profile existente → retorna
//   2. Busca convite pendente (por email) → ativa profile
//   3. Nenhum → cria tenant + profile (admin) = primeiro login
// =====================================================

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // 1. Busca profile existente (ativo ou pendente com clerk_user_id já vinculado)
    const profileResult = await pool.query(
      `SELECT p.id AS profile_id, p.tenant_id, p.role, p.name, p.is_active,
              t.trial_status, t.is_admin, t.terms_accepted_at
       FROM profiles p
       JOIN tenants t ON t.id = p.tenant_id
       WHERE p.clerk_user_id = $1
       LIMIT 1`,
      [userId]
    )

    if (profileResult.rows.length > 0) {
      const row = profileResult.rows[0]
      return NextResponse.json({
        tenantId: row.tenant_id,
        profileId: row.profile_id,
        name: row.name,
        role: row.role,
        trialStatus: row.trial_status,
        isAdmin: row.is_admin || row.role === 'admin',
        termsAccepted: row.terms_accepted_at !== null,
        userId
      })
    }

    // 2. Busca convite pendente (profile sem clerk_user_id real, por email)
    const user = await currentUser()
    const email = user?.emailAddresses?.[0]?.emailAddress || ''

    if (email) {
      const pendingResult = await pool.query(
        `SELECT p.id AS profile_id, p.tenant_id, p.role, p.name,
                t.trial_status, t.is_admin, t.terms_accepted_at
         FROM profiles p
         JOIN tenants t ON t.id = p.tenant_id
         WHERE p.email = $1 AND p.is_active = false AND p.clerk_user_id LIKE 'pending_%'
         LIMIT 1`,
        [email]
      )

      if (pendingResult.rows.length > 0) {
        const row = pendingResult.rows[0]

        // Ativar profile com clerk_user_id real
        await pool.query(
          `UPDATE profiles SET clerk_user_id = $1, is_active = true, updated_at = NOW()
           WHERE id = $2`,
          [userId, row.profile_id]
        )

        // Audit log
        try {
          await pool.query(
            `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
             VALUES ($1, $2, $3, 'PROFILE_ACTIVATED', 'profile', $4, $5, NOW())`,
            [row.tenant_id, userId, userId, row.profile_id,
             JSON.stringify({ email, role: row.role, source: 'invite_activation' })]
          )
        } catch (_) { /* audit non-blocking */ }

        return NextResponse.json({
          tenantId: row.tenant_id,
          profileId: row.profile_id,
          name: row.name,
          role: row.role,
          trialStatus: row.trial_status,
          isAdmin: row.role === 'admin',
          termsAccepted: row.terms_accepted_at !== null,
          userId,
          isNew: true,
          source: 'invite'
        })
      }
    }

    // 3. Fallback: busca tenant legado (pré-migração) sem profile
    const legacyResult = await pool.query(
      'SELECT id as tenant_id, name, role, trial_status, is_admin, terms_accepted_at FROM tenants WHERE clerk_user_id = $1 LIMIT 1',
      [userId]
    )

    if (legacyResult.rows.length > 0) {
      const row = legacyResult.rows[0]
      return NextResponse.json({
        tenantId: row.tenant_id,
        name: row.name,
        role: row.role,
        trialStatus: row.trial_status,
        isAdmin: row.is_admin,
        termsAccepted: row.terms_accepted_at !== null,
        userId
      })
    }

    // 4. Nenhum encontrado → criar tenant + profile (admin)
    const name = user?.fullName || user?.firstName || 'Profissional'
    const now = new Date()
    const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 dias

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Criar tenant
      const tenantInsert = await client.query(
        `INSERT INTO tenants (name, email, clerk_user_id, role, trial_start, trial_end, trial_status, max_patients, max_sessions, is_admin)
         VALUES ($1, $2, $3, 'professional', $4, $5, 'trial', 5, 15, false)
         RETURNING id as tenant_id`,
        [name, email, userId, now, trialEnd]
      )

      const tenantId = tenantInsert.rows[0].tenant_id

      // Criar profile (admin do tenant)
      const profileInsert = await client.query(
        `INSERT INTO profiles (tenant_id, clerk_user_id, role, name, email, is_active)
         VALUES ($1, $2, 'admin', $3, $4, true)
         RETURNING id`,
        [tenantId, userId, name, email]
      )

      // Audit log
      try {
        await client.query(
          `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, entity_id, metadata, created_at)
           VALUES ($1, $2, $3, 'PROFILE_CREATED', 'profile', $4, $5, NOW())`,
          [tenantId, userId, userId, profileInsert.rows[0].id,
           JSON.stringify({ role: 'admin', source: 'first_login' })]
        )
      } catch (_) { /* audit non-blocking */ }

      await client.query('COMMIT')

      return NextResponse.json({
        tenantId,
        profileId: profileInsert.rows[0].id,
        name,
        role: 'admin',
        trialStatus: 'trial',
        isAdmin: true,
        termsAccepted: false,
        userId,
        isNew: true
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Erro ao buscar/criar tenant:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
