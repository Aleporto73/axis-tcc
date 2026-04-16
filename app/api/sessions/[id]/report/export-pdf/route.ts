import { NextRequest, NextResponse } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { handleRouteError } from '@/src/database/with-role'
import PDFDocument from 'pdfkit'

/**
 * POST /api/sessions/[id]/report/export-pdf
 * Gera PDF do relatorio clinico da sessao.
 * Usa pdfkit server-side com Helvetica (suporte a acentos PT-BR).
 * Ref: AXIS TCC Sessao v2 - Fase 5
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await withTenant<NextResponse>(async (ctx) => {
      const { client, tenantId, userId } = ctx

      // 1. Buscar sessao + paciente
      const sessionResult = await client.query(
        `SELECT s.id, s.session_number, s.session_type, s.scheduled_at,
                s.started_at, s.duration_minutes,
                p.name AS patient_name
         FROM sessions s
         JOIN patients p ON p.id = s.patient_id
         WHERE s.id = $1 AND s.tenant_id = $2`,
        [id, tenantId]
      )

      if (sessionResult.rows.length === 0) {
        return NextResponse.json({ error: 'Sessao nao encontrada' }, { status: 404 })
      }

      const session = sessionResult.rows[0]

      // 2. Buscar relatorio
      const reportResult = await client.query(
        `SELECT headline, objectives, summary, intervention,
                observations, closing, status, exported_at, export_count
         FROM session_reports
         WHERE session_id = $1 AND tenant_id = $2`,
        [id, tenantId]
      )

      if (reportResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Nenhum relatorio encontrado para esta sessao' },
          { status: 400 }
        )
      }

      const report = reportResult.rows[0]

      // 3. Buscar profissional (do perfil logado)
      const profileResult = await client.query(
        `SELECT name, crp, crp_uf FROM profiles
         WHERE clerk_user_id = $1 AND tenant_id = $2 AND is_active = true
         LIMIT 1`,
        [userId, tenantId]
      )

      const professional = profileResult.rows[0] || { name: 'Profissional', crp: '', crp_uf: '' }

      // 4. Gerar PDF
      const pdfBuffer = await generatePDF({
        professional,
        patient: { name: session.patient_name },
        session: {
          number: session.session_number,
          date: session.scheduled_at || session.started_at,
          duration: session.duration_minutes,
          type: session.session_type,
        },
        report,
      })

      // 5. Atualizar export_count e exported_at
      await client.query(
        `UPDATE session_reports
         SET exported_at = NOW(), export_count = COALESCE(export_count, 0) + 1, updated_at = NOW()
         WHERE session_id = $1 AND tenant_id = $2`,
        [id, tenantId]
      )

      // 6. Retornar PDF
      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="relatorio_sessao_${session.session_number || 'x'}_${formatDateFile(session.scheduled_at || session.started_at)}.pdf"`,
          'Content-Length': String(pdfBuffer.length),
        },
      })
    })

    return result
  } catch (error) {
    console.error('Erro ao exportar PDF:', error)
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

// --- Helpers ---

function formatDateBR(dateStr: string): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateFile(dateStr: string): string {
  if (!dateStr) return 'sem-data'
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateTimeBR(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  presencial: 'Presencial',
  online: 'Online',
  hibrida: 'H\u00edbrida',
}

interface PDFInput {
  professional: { name: string; crp: string | null; crp_uf: string | null }
  patient: { name: string }
  session: { number: number | null; date: string; duration: number | null; type: string | null }
  report: {
    headline: string | null
    objectives: string | null
    summary: string | null
    intervention: string | null
    observations: string | null
    closing: string | null
    status: string
  }
}

function generatePDF(input: PDFInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 56, bottom: 56, left: 56, right: 56 }, // ~20mm
      info: {
        Title: `Relat\u00f3rio de Sess\u00e3o - ${input.patient.name}`,
        Author: input.professional.name,
        Creator: 'AXIS Cl\u00ednico',
      },
    })

    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right

    // === HEADER ===
    doc.font('Helvetica-Bold').fontSize(16)
    doc.text('AXIS Cl\u00ednico', { align: 'center' })
    doc.fontSize(11).font('Helvetica')
    doc.text('Relat\u00f3rio de Sess\u00e3o', { align: 'center' })
    doc.moveDown(0.5)

    // Separator
    drawLine(doc, pageWidth)
    doc.moveDown(0.5)

    // === PROFESSIONAL ===
    doc.font('Helvetica').fontSize(10)
    doc.text(`Profissional: ${input.professional.name}`)
    if (input.professional.crp) {
      const crpText = input.professional.crp_uf
        ? `CRP: ${input.professional.crp}/${input.professional.crp_uf}`
        : `CRP: ${input.professional.crp}`
      doc.text(crpText)
    }
    doc.moveDown(0.3)

    // Thin separator
    drawThinLine(doc, pageWidth)
    doc.moveDown(0.3)

    // === SESSION INFO ===
    doc.text(`Paciente: ${input.patient.name}`)
    const sessionLabel = input.session.number
      ? `Sess\u00e3o: #${input.session.number} \u2014 ${formatDateBR(input.session.date)}`
      : `Sess\u00e3o: ${formatDateBR(input.session.date)}`
    doc.text(sessionLabel)
    if (input.session.duration) {
      doc.text(`Dura\u00e7\u00e3o: ${input.session.duration} minutos`)
    }
    if (input.session.type) {
      const typeLabel = SESSION_TYPE_LABELS[input.session.type] || input.session.type
      doc.text(`Modalidade: ${typeLabel}`)
    }
    doc.moveDown(0.5)

    // Separator
    drawLine(doc, pageWidth)
    doc.moveDown(0.5)

    // === HEADLINE ===
    if (input.report.headline && input.report.headline.trim()) {
      doc.font('Helvetica-Bold').fontSize(14)
      doc.text(input.report.headline.trim())
      doc.moveDown(0.5)
    }

    // === REPORT SECTIONS ===
    const sections = [
      { num: '1', title: 'OBJETIVOS DA SESS\u00c3O', content: input.report.objectives },
      { num: '2', title: 'RESUMO', content: input.report.summary },
      { num: '3', title: 'INTERVEN\u00c7\u00c3O DO PSIC\u00d3LOGO', content: input.report.intervention },
      { num: '4', title: 'OBSERVA\u00c7\u00d5ES CL\u00cdNICAS', content: input.report.observations },
      { num: '5', title: 'ENCERRAMENTO / TAREFA DE CASA', content: input.report.closing },
    ]

    for (const section of sections) {
      if (!section.content || !section.content.trim()) continue

      doc.font('Helvetica-Bold').fontSize(11)
      doc.text(`${section.num}. ${section.title}`)
      doc.moveDown(0.3)

      doc.font('Helvetica').fontSize(10)
      doc.text(section.content.trim(), { lineGap: 2 })
      doc.moveDown(0.8)
    }

    // === FOOTER ===
    doc.moveDown(1)
    drawLine(doc, pageWidth)
    doc.moveDown(0.5)

    doc.font('Helvetica-Oblique').fontSize(8)
    doc.text(
      'Relat\u00f3rio assistido por IA \u2014 conte\u00fado revisado e aprovado pelo profissional respons\u00e1vel.',
      { align: 'center' }
    )
    doc.moveDown(0.3)
    doc.text(
      `Exportado em: ${formatDateTimeBR(new Date())}`,
      { align: 'center' }
    )
    doc.text(
      'AXIS Cl\u00ednico \u2014 axisclinico.com',
      { align: 'center' }
    )

    doc.end()
  })
}

function drawLine(doc: PDFKit.PDFDocument, width: number) {
  const x = doc.page.margins.left
  const y = doc.y
  doc.moveTo(x, y).lineTo(x + width, y).lineWidth(1.5).strokeColor('#334155').stroke()
  doc.y = y + 2
}

function drawThinLine(doc: PDFKit.PDFDocument, width: number) {
  const x = doc.page.margins.left
  const y = doc.y
  doc.moveTo(x, y).lineTo(x + width, y).lineWidth(0.5).strokeColor('#94a3b8').stroke()
  doc.y = y + 2
}
