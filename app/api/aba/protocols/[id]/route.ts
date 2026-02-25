import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, discontinuation_reason, pei_goal_id } = body

    if (!status && pei_goal_id === undefined) return NextResponse.json({ error: 'status ou pei_goal_id é obrigatório' }, { status: 400 })

    const result = await withTenant(async ({ client, tenantId, userId }) => {
      const sets: string[] = ['updated_at = NOW()']
      const p: any[] = []

      if (status) {
        p.push(status); sets.push(`status = $${p.length}`)
        const ts: Record<string,string> = {
          active: 'activated_at',
          mastered: 'mastered_at',
          generalization: 'generalized_at',
          mastered_validated: 'mastered_validated_at',
          maintained: 'maintained_at',
          suspended: 'suspended_at',
          discontinued: 'discontinued_at',
          archived: 'archived_at',
        }
        if (ts[status]) { p.push(new Date().toISOString()); sets.push(`${ts[status]} = $${p.length}`) }
        if (status === 'discontinued' && discontinuation_reason) { p.push(discontinuation_reason); sets.push(`discontinuation_reason = $${p.length}`) }
      }

      if (pei_goal_id !== undefined) {
        p.push(pei_goal_id || null); sets.push(`pei_goal_id = $${p.length}`)
      }

      p.push(id, tenantId)
      const q = `UPDATE learner_protocols SET ${sets.join(', ')} WHERE id = $${p.length-1} AND tenant_id = $${p.length} RETURNING *`
      const updated = await client.query(q, p)
      if (updated.rows.length === 0) return { protocol: null, maintenance_probes: [] }

      const protocol = updated.rows[0]

      // ─── Bible S3: Auto-criar 3 sondas de manutenção ao atingir "mastered" ───
      // Sondas agendadas em 2, 6 e 12 semanas a partir da data de mastered_at.
      // Idempotente: pula sondas já existentes (mesmo week_number).
      let maintenanceProbes: any[] = []
      if (status === 'mastered') {
        const baseDate = protocol.mastered_at || new Date()
        const schedules = [
          { weeks: 2,  label: 'Sonda 2 semanas' },
          { weeks: 6,  label: 'Sonda 6 semanas' },
          { weeks: 12, label: 'Sonda 12 semanas' },
        ]

        for (const s of schedules) {
          const scheduledAt = new Date(baseDate)
          scheduledAt.setDate(scheduledAt.getDate() + s.weeks * 7)

          // Idempotência: não duplicar sondas para mesmo protocolo + week_number
          const existing = await client.query(
            'SELECT id FROM maintenance_probes WHERE protocol_id = $1 AND tenant_id = $2 AND week_number = $3',
            [id, tenantId, s.weeks])
          if (existing.rows.length > 0) continue

          const ins = await client.query(
            `INSERT INTO maintenance_probes (tenant_id, protocol_id, learner_id, week_number, label, scheduled_at, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
            [tenantId, id, protocol.learner_id, s.weeks, s.label, scheduledAt])
          maintenanceProbes.push(ins.rows[0])
        }

        // Audit log
        if (maintenanceProbes.length > 0) {
          await client.query(
            `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
             VALUES ($1, $2, 'system', 'MAINTENANCE_PROBES_AUTO_CREATED', 'maintenance_probes',
             jsonb_build_object('protocol_id', $3, 'probes_created', $4, 'weeks', ARRAY[2,6,12]::int[]), NOW())`,
            [tenantId, userId || 'system', id, maintenanceProbes.length])
        }
      }

      return { protocol, maintenance_probes: maintenanceProbes }
    })

    if (!result.protocol) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    return NextResponse.json(result)
  } catch (error: any) {
    if (error.message === 'Não autenticado') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    console.error("PATCH protocol error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
