import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import pool from '@/src/database/db'

export async function GET() {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const result = await pool.query(
      'SELECT name, crp, crp_uf, email, phone FROM tenants WHERE clerk_user_id = $1 LIMIT 1',
      [userId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
    }

    // Monta o CRP formatado
    const row = result.rows[0]
    const crpFormatted = row.crp_uf && row.crp ? `${row.crp_uf}/${row.crp}` : row.crp || ''

    return NextResponse.json({
      name: row.name || '',
      crp: crpFormatted,
      email: row.email || '',
      phone: row.phone || ''
    })

  } catch (error) {
    console.error('Erro ao buscar perfil:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, crp } = body

    // Parse CRP (formato: 00/00000 ou apenas número)
    let crpNumber = crp || ''
    let crpUf = ''
    
    if (crp && crp.includes('/')) {
      const parts = crp.split('/')
      crpUf = parts[0]
      crpNumber = parts[1] || ''
    }

    const result = await pool.query(
      `UPDATE tenants 
       SET name = $1, crp = $2, crp_uf = $3
       WHERE clerk_user_id = $4
       RETURNING id, name, crp, crp_uf`,
      [name || '', crpNumber, crpUf, userId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true,
      profile: result.rows[0]
    })

  } catch (error) {
    console.error('Erro ao atualizar perfil:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
