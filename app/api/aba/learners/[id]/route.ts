import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdminOrSupervisor, handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS ABA - API: Aprendiz [id] (atualização)
// admin/supervisor apenas. Whitelist: name, birth_date.
// =====================================================

// PATCH — Atualizar aprendiz (admin/supervisor apenas)
// Campos editáveis (whitelist): name (obrigatório, não-vazio), birth_date (opcional)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    // Whitelist explícita: só name e birth_date são aceitos. Qualquer outro campo é ignorado.
    const { name, birth_date } = body

    // Validação: name presente e não-vazio
    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'name é obrigatório e não pode ser vazio' },
        { status: 400 }
      )
    }

    // Validação: se birth_date vier, deve ser uma data válida (não-vazia)
    const hasBirthDate = birth_date !== undefined && birth_date !== null
    if (hasBirthDate) {
      if (typeof birth_date !== 'string' || !birth_date.trim() || isNaN(Date.parse(birth_date))) {
        return NextResponse.json(
          { error: 'birth_date inválido' },
          { status: 400 }
        )
      }
    }

    const result = await withTenant(async (ctx) => {
      // Terapeuta não pode editar aprendizes
      requireAdminOrSupervisor(ctx)

      // Monta SET dinâmico respeitando a whitelist.
      // $1 = id, $2 = tenantId (escopo de tenant), $3 = name, [$4 = birth_date]
      const sets = ['name = $3']
      const values: any[] = [id, ctx.tenantId, name.trim()]
      if (hasBirthDate) {
        sets.push(`birth_date = $4`)
        values.push(birth_date)
      }

      return await ctx.client.query(
        `UPDATE learners
         SET ${sets.join(', ')}, updated_at = now()
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
         RETURNING *`,
        values
      )
    })

    // 404 — id inexistente neste tenant (ou soft-deleted)
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Aprendiz não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ learner: result.rows[0] })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
