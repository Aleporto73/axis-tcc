import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

// =====================================================
// Anexo D — Upload de Documentos Obrigatórios (Lacuna 5)
//
// POST: Upload de documento (alvará, CRP RT, certificação, etc.)
// GET:  Lista documentos do tenant
// DELETE: Remove documento por ID
// =====================================================

const VALID_DOC_TYPES = ['alvara', 'crp_rt', 'certificacao', 'contrato_social', 'outro'] as const
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

export async function GET() {
  try {
    const result = await withTenant(async ({ client, tenantId }) => {
      return await client.query(
        `SELECT id, doc_type, filename, file_size_bytes, mime_type, verified, verified_at, created_at
         FROM clinic_documents WHERE tenant_id = $1
         ORDER BY created_at DESC`,
        [tenantId]
      )
    })
    return NextResponse.json({ documents: result.rows })
  } catch (error: any) {
    if (error.message === 'Não autenticado') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const docType = formData.get('doc_type') as string | null

    if (!file) return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 })
    if (!docType || !VALID_DOC_TYPES.includes(docType as any)) {
      return NextResponse.json({ error: `doc_type inválido. Válidos: ${VALID_DOC_TYPES.join(', ')}` }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Arquivo excede 10MB' }, { status: 400 })
    }
    if (!ALLOWED_MIMES.includes(file.type)) {
      return NextResponse.json({ error: `Tipo não permitido. Aceitos: ${ALLOWED_MIMES.join(', ')}` }, { status: 400 })
    }

    const result = await withTenant(async ({ client, tenantId, userId }) => {
      // Criar diretório do tenant
      const uploadDir = path.join(process.cwd(), 'uploads', 'clinic-docs', tenantId)
      await mkdir(uploadDir, { recursive: true })

      // Salvar arquivo com nome único
      const ext = path.extname(file.name) || '.pdf'
      const safeName = `${docType}_${Date.now()}${ext}`
      const filePath = path.join(uploadDir, safeName)
      const buffer = Buffer.from(await file.arrayBuffer())
      await writeFile(filePath, buffer)

      // Registrar no banco
      const relativePath = `uploads/clinic-docs/${tenantId}/${safeName}`
      const ins = await client.query(
        `INSERT INTO clinic_documents (tenant_id, doc_type, filename, file_path, file_size_bytes, mime_type, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [tenantId, docType, file.name, relativePath, file.size, file.type, userId]
      )

      // Audit log
      await client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
         VALUES ($1, $2, $3, 'CLINIC_DOCUMENT_UPLOADED', 'clinic_documents',
         jsonb_build_object('doc_type', $4, 'filename', $5, 'size_bytes', $6), NOW())`,
        [tenantId, userId, userId, docType, file.name, file.size]
      )

      return ins.rows[0]
    })

    return NextResponse.json({ document: result }, { status: 201 })
  } catch (error: any) {
    if (error.message === 'Não autenticado') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    console.error('Document upload error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const docId = searchParams.get('id')
    if (!docId) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

    const result = await withTenant(async ({ client, tenantId, userId }) => {
      const deleted = await client.query(
        'DELETE FROM clinic_documents WHERE id = $1 AND tenant_id = $2 RETURNING id, doc_type, filename',
        [docId, tenantId]
      )
      if (deleted.rows.length === 0) return null

      await client.query(
        `INSERT INTO axis_audit_logs (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
         VALUES ($1, $2, $3, 'CLINIC_DOCUMENT_DELETED', 'clinic_documents',
         jsonb_build_object('doc_id', $4, 'doc_type', $5), NOW())`,
        [tenantId, userId, userId, docId, deleted.rows[0].doc_type]
      )

      return deleted.rows[0]
    })

    if (!result) return NextResponse.json({ error: 'Documento não encontrado' }, { status: 404 })
    return NextResponse.json({ deleted: result })
  } catch (error: any) {
    if (error.message === 'Não autenticado') return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
