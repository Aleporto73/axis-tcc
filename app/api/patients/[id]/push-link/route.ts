import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { randomBytes } from 'crypto'
import { env } from '@/src/lib/env'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patientId } = await params

    return await withTenant(async (ctx) => {
      // Verificar se paciente existe
      const patientResult = await ctx.client.query(
        'SELECT id, full_name, push_auth_token, push_auth_token_expires_at FROM patients WHERE id = $1 AND tenant_id = $2',
        [patientId, ctx.tenantId]
      )
      if (patientResult.rows.length === 0) {
        return NextResponse.json({ error: 'Paciente nao encontrado' }, { status: 404 })
      }

      const patient = patientResult.rows[0]

      // Reusa token existente se ainda valido; senao gera novo (TTL 30 dias)
      const tokenExpired =
        patient.push_auth_token_expires_at &&
        new Date(patient.push_auth_token_expires_at) < new Date()
      let authToken = patient.push_auth_token
      if (!authToken || tokenExpired) {
        authToken = randomBytes(32).toString('hex')
        await ctx.client.query(
          `UPDATE patients
           SET push_auth_token = $1,
               push_auth_token_expires_at = NOW() + INTERVAL '30 days'
           WHERE id = $2`,
          [authToken, patientId]
        )
      }

      // Gerar link público
      const baseUrl = env.NEXT_PUBLIC_APP_URL || 'https://axisclinico.com'
      const pushLink = `${baseUrl}/ativar-lembretes?token=${authToken}`

      return NextResponse.json({
        success: true,
        link: pushLink,
        patient_name: patient.full_name
      })
    })

  } catch (error) {
    console.error('Erro ao gerar link push:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
