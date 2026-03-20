import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'

// =====================================================
// AXIS ABA - API: Anexos de Sessão (session_attachments)
// Ref: skill_axis_aba_v270.md — Sprint 1
//
// POST — Registrar metadata de anexo (upload real via storage separado)
// GET  — Listar anexos de uma sessão
//
// Bible v2.7.0:
//   - EXIF bruto NUNCA armazenado
//   - Hash detecta duplicatas (DUPLICATE_PHOTO flag)
//   - Max 10MB. Formatos: JPG, PNG, PDF
//   - IMUTÁVEL após upload
// =====================================================

export const dynamic = 'force-dynamic'

const VALID_TYPES = ['photo_checkin', 'photo_checkout', 'document', 'prescription', 'other'] as const
const VALID_MIMES = ['image/jpeg', 'image/png', 'application/pdf'] as const
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

// ─────────────────────────────────────────────────────
// GET — Listar anexos de uma sessão
// ─────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id')
    if (!sessionId) {
      return NextResponse.json({ error: 'session_id obrigatório' }, { status: 400 })
    }

    const result = await withTenant(async (ctx) => {
      const attachments = await ctx.client.query(
        `SELECT
          id, session_id, attachment_type, file_name, file_hash,
          file_size_bytes, mime_type, storage_path,
          uploaded_by, uploaded_at, created_at
        FROM session_attachments
        WHERE session_id = $1 AND tenant_id = $2
        ORDER BY uploaded_at ASC`,
        [sessionId, ctx.tenantId]
      )
      return attachments
    })

    return NextResponse.json({ attachments: result.rows })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

// ─────────────────────────────────────────────────────
// POST — Registrar metadata de anexo
// O upload real do arquivo é feito via storage separado.
// Esta API registra os metadados + hash para integridade.
// ─────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      session_id,
      attachment_type,
      file_name,
      file_hash,
      file_size_bytes,
      mime_type,
      storage_path,
    } = body

    // Validações
    if (!session_id) {
      return NextResponse.json({ error: 'session_id obrigatório' }, { status: 400 })
    }
    if (!attachment_type || !VALID_TYPES.includes(attachment_type)) {
      return NextResponse.json(
        { error: `attachment_type inválido. Permitidos: ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      )
    }
    if (!file_name?.trim()) {
      return NextResponse.json({ error: 'file_name obrigatório' }, { status: 400 })
    }
    if (!mime_type || !VALID_MIMES.includes(mime_type)) {
      return NextResponse.json(
        { error: `mime_type inválido. Permitidos: ${VALID_MIMES.join(', ')}` },
        { status: 400 }
      )
    }
    if (!file_size_bytes || file_size_bytes <= 0 || file_size_bytes > MAX_SIZE) {
      return NextResponse.json({ error: 'Arquivo deve ter entre 1 byte e 10MB' }, { status: 400 })
    }
    if (!storage_path?.trim()) {
      return NextResponse.json({ error: 'storage_path obrigatório' }, { status: 400 })
    }

    // Se hash não fornecido, gerar a partir do nome+tamanho (placeholder)
    const hash = file_hash || crypto
      .createHash('sha256')
      .update(`${file_name}:${file_size_bytes}:${Date.now()}`)
      .digest('hex')

    const result = await withTenant(async (ctx) => {
      // Verificar sessão
      const sessionCheck = await ctx.client.query(
        `SELECT id FROM sessions_aba WHERE id = $1 AND tenant_id = $2`,
        [session_id, ctx.tenantId]
      )
      if (sessionCheck.rows.length === 0) {
        throw Object.assign(new Error('Sessão não encontrada'), { statusCode: 404 })
      }

      // Verificar duplicata por hash (flag DUPLICATE_PHOTO)
      const duplicate = await ctx.client.query(
        `SELECT id, session_id FROM session_attachments
        WHERE tenant_id = $1 AND file_hash = $2 AND session_id != $3`,
        [ctx.tenantId, hash, session_id]
      )
      const isDuplicate = duplicate.rows.length > 0

      // Inserir
      const inserted = await ctx.client.query(
        `INSERT INTO session_attachments (
          session_id, tenant_id, attachment_type,
          file_name, file_hash, file_size_bytes, mime_type, storage_path,
          uploaded_by, uploaded_at
        ) VALUES (
          $1, $2, $3,
          $4, $5, $6, $7, $8,
          $9, NOW()
        )
        RETURNING id, attachment_type, file_name, file_hash, file_size_bytes,
          mime_type, uploaded_at`,
        [
          session_id, ctx.tenantId, attachment_type,
          file_name.trim(), hash, file_size_bytes, mime_type, storage_path.trim(),
          ctx.profileId,
        ]
      )

      // Audit log
      await ctx.client.query(
        `INSERT INTO axis_audit_logs (tenant_id, action, category, actor_id, metadata)
        VALUES ($1, 'ATTACHMENT_UPLOADED', 'operational', $2,
          jsonb_build_object(
            'session_id', $3::text,
            'attachment_id', $4::text,
            'type', $5::text,
            'is_duplicate', $6::text
          )
        )`,
        [
          ctx.tenantId, ctx.profileId, session_id,
          inserted.rows[0].id, attachment_type, String(isDuplicate),
        ]
      )

      return {
        attachment: inserted.rows[0],
        is_duplicate: isDuplicate,
        duplicate_in_session: isDuplicate ? duplicate.rows[0].session_id : null,
      }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
