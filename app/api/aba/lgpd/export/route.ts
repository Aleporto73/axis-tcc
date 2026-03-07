import { NextResponse, NextRequest } from 'next/server'
import { withTenant } from '@/src/database/with-tenant'
import { requireAdminOrSupervisor, handleRouteError } from '@/src/database/with-role'
import { PoolClient } from 'pg'
import ExcelJS from 'exceljs'

// =====================================================
// AXIS ABA — Exportação LGPD (Art. 18, Lei 13.709/2018)
// Conforme AXIS ABA Bible v2.6.1
// Acesso: admin ou supervisor
//
// v3.0: Exportação em Excel (.xlsx) com abas organizadas
//       Cabeçalhos em português, datas formatadas dd/mm/yyyy
//       ?format=json mantém opção técnica (JSON)
// =====================================================

// Helper: query resiliente com SAVEPOINT
let _spCounter = 0
async function safeQuery(client: PoolClient, query: string, params: any[], label: string) {
  const sp = `sp_${label.replace(/[^a-z0-9_]/gi, '_')}_${++_spCounter}`
  try {
    await client.query(`SAVEPOINT ${sp}`)
    const res = await client.query(query, params)
    await client.query(`RELEASE SAVEPOINT ${sp}`)
    return res.rows
  } catch (err: any) {
    console.warn(`[LGPD Export] Falha em ${label}: ${err.message}`)
    try { await client.query(`ROLLBACK TO SAVEPOINT ${sp}`) } catch {}
    return []
  }
}

// Helper: formatar data para dd/mm/yyyy HH:mm
function fmtDate(val: any): string {
  if (!val) return ''
  const d = new Date(val)
  if (isNaN(d.getTime())) return String(val)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

function fmtDateShort(val: any): string {
  if (!val) return ''
  const d = new Date(val)
  if (isNaN(d.getTime())) return String(val)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

// Estilos comuns
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A5276' } }
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Arial' }
const DATA_FONT: Partial<ExcelJS.Font> = { size: 10, name: 'Arial' }
const TITLE_FONT: Partial<ExcelJS.Font> = { bold: true, size: 14, name: 'Arial', color: { argb: 'FF1A5276' } }
const SUBTITLE_FONT: Partial<ExcelJS.Font> = { size: 11, name: 'Arial', color: { argb: 'FF555555' } }

function addHeaderRow(ws: ExcelJS.Worksheet, headers: string[]) {
  const row = ws.addRow(headers)
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF999999' } },
    }
  })
  row.height = 24
}

function styleDataRows(ws: ExcelJS.Worksheet, startRow: number) {
  for (let i = startRow; i <= ws.rowCount; i++) {
    const row = ws.getRow(i)
    row.eachCell((cell) => {
      cell.font = DATA_FONT
      cell.alignment = { vertical: 'middle', wrapText: true }
    })
    if (i % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F8FA' } }
      })
    }
  }
}

function autoWidth(ws: ExcelJS.Worksheet) {
  ws.columns.forEach((col) => {
    let max = 12
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0
      if (len > max) max = len
    })
    col.width = Math.min(max + 2, 50)
  })
}

// =====================================================
// Buscar todos os dados do tenant
// =====================================================
async function fetchAllData(client: PoolClient, tenantId: string) {
  const tenant = await safeQuery(client,
    `SELECT * FROM tenants WHERE id = $1`, [tenantId], 'tenants')

  const profiles = await safeQuery(client,
    `SELECT id, role, name, email, specialty, is_active, created_at, updated_at
     FROM profiles WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'profiles')

  const learners = await safeQuery(client,
    `SELECT id, name, birth_date, diagnosis, cid_code, cid_system, cid_label, support_level,
            notes, is_active, created_at, updated_at
     FROM learners WHERE tenant_id = $1 ORDER BY name`, [tenantId], 'learners')

  const assignments = await safeQuery(client,
    `SELECT lt.id, lt.learner_id, lt.profile_id, lt.is_primary, lt.assigned_at,
            p.name AS therapist_name, l.name AS learner_name
     FROM learner_therapists lt
     JOIN profiles p ON p.id = lt.profile_id
     JOIN learners l ON l.id = lt.learner_id
     WHERE lt.tenant_id = $1 ORDER BY lt.assigned_at`, [tenantId], 'learner_therapists')

  const guardians = await safeQuery(client,
    `SELECT id, learner_id, name, relationship, email, phone, is_active, created_at
     FROM guardians WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'guardians')

  const consents = await safeQuery(client,
    `SELECT id, guardian_id, learner_id, consent_type, consent_version,
            ip_address, accepted_at, revoked_at
     FROM guardian_consents WHERE tenant_id = $1 ORDER BY accepted_at`, [tenantId], 'guardian_consents')

  const peiPlans = await safeQuery(client,
    `SELECT id, learner_id, title, period_start, period_end, status, created_at
     FROM pei_plans WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'pei_plans')

  const peiGoals = await safeQuery(client,
    `SELECT id, pei_plan_id, title, domain, description, status, created_at
     FROM pei_goals WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'pei_goals')

  const protocols = await safeQuery(client,
    `SELECT lp.id, lp.learner_id, lp.title, lp.domain, lp.objective,
            lp.status, lp.ebp_practice_id, ep.name AS ebp_name,
            lp.mastery_criteria_pct, lp.generalization_status, lp.regression_count,
            lp.activated_at, lp.mastered_at, lp.created_at
     FROM learner_protocols lp
     LEFT JOIN ebp_practices ep ON ep.id = lp.ebp_practice_id
     WHERE lp.tenant_id = $1 ORDER BY lp.created_at`, [tenantId], 'learner_protocols')

  const sessions = await safeQuery(client,
    `SELECT sa.id, sa.learner_id, sa.therapist_id, sa.scheduled_at,
            sa.started_at, sa.ended_at, sa.status, sa.location,
            sa.duration_minutes, sa.notes, sa.created_at,
            l.name AS learner_name, p.name AS therapist_name
     FROM sessions_aba sa
     LEFT JOIN learners l ON l.id = sa.learner_id
     LEFT JOIN profiles p ON p.id = sa.therapist_id
     WHERE sa.tenant_id = $1 ORDER BY sa.scheduled_at`, [tenantId], 'sessions_aba')

  const targets = await safeQuery(client,
    `SELECT id, session_id, protocol_id, target_name,
            trials_correct, trials_total, prompt_level, score_pct,
            notes, created_at
     FROM session_targets WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'session_targets')

  const behaviors = await safeQuery(client,
    `SELECT id, session_id, behavior_type, antecedent, behavior, consequence,
            intensity, duration_seconds, recorded_at, created_at
     FROM session_behaviors WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'session_behaviors')

  const snapshots = await safeQuery(client,
    `SELECT id, session_id, learner_id, cso_aba, sas, pis, bss, tcm,
            cso_band, engine_version, created_at
     FROM session_snapshots WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'session_snapshots')

  const clinicalStates = await safeQuery(client,
    `SELECT id, learner_id, cso_aba, sas, pis, bss, tcm,
            cso_band, engine_version, created_at
     FROM clinical_states_aba WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'clinical_states_aba')

  const genProbes = await safeQuery(client,
    `SELECT * FROM generalization_probes WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'generalization_probes')

  const maintProbes = await safeQuery(client,
    `SELECT * FROM maintenance_probes WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'maintenance_probes')

  const summaries = await safeQuery(client,
    `SELECT id, session_id, learner_id, content, status,
            approved_by, approved_at, sent_at, created_at
     FROM session_summaries WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'session_summaries')

  const reports = await safeQuery(client,
    `SELECT * FROM report_snapshots WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'report_snapshots')

  const portalAccess = await safeQuery(client,
    `SELECT * FROM family_portal_access WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'family_portal_access')

  const emailLogs = await safeQuery(client,
    `SELECT * FROM email_logs WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'email_logs')

  const notifications = await safeQuery(client,
    `SELECT * FROM notifications WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'notifications')

  const auditLogs = await safeQuery(client,
    `SELECT id, user_id, actor, action, entity_type, entity_id, metadata, created_at
     FROM axis_audit_logs WHERE tenant_id = $1 ORDER BY created_at`, [tenantId], 'axis_audit_logs')

  return {
    tenant: tenant[0] || null,
    profiles, learners, assignments, guardians, consents,
    peiPlans, peiGoals, protocols, sessions, targets, behaviors,
    snapshots, clinicalStates, genProbes, maintProbes,
    summaries, reports, portalAccess, emailLogs, notifications, auditLogs,
  }
}

// =====================================================
// Gerar workbook Excel formatado
// =====================================================
async function buildExcelWorkbook(data: any, meta: { profileId: string; role: string; userId: string }) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'AXIS ABA'
  wb.created = new Date()

  const clinicName = data.tenant?.name || 'Clínica'

  // ── ABA 1: RESUMO ──
  const wsResumo = wb.addWorksheet('Resumo', { properties: { tabColor: { argb: 'FF1A5276' } } })

  wsResumo.mergeCells('A1:D1')
  const titleCell = wsResumo.getCell('A1')
  titleCell.value = `Exportação de Dados — ${clinicName}`
  titleCell.font = TITLE_FONT
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' }
  wsResumo.getRow(1).height = 30

  wsResumo.mergeCells('A2:D2')
  const subtitleCell = wsResumo.getCell('A2')
  subtitleCell.value = 'Conforme Art. 18 da Lei 13.709/2018 (LGPD) — Direito de Portabilidade'
  subtitleCell.font = SUBTITLE_FONT

  wsResumo.addRow([])

  const infoRows = [
    ['Data da Exportação', fmtDate(new Date())],
    ['Clínica (Controlador)', clinicName],
    ['Operador', 'Psiform Tecnologia (AXIS ABA)'],
    ['Motor Clínico', 'CSO-ABA v2.6.1'],
    ['Base Legal', 'Art. 18, Lei 13.709/2018 (LGPD)'],
    ['Finalidade', 'Portabilidade de dados mediante solicitação do titular'],
    [],
    ['Contagem de Registros', ''],
    ['Profissionais', String(data.profiles.length)],
    ['Aprendizes', String(data.learners.length)],
    ['Responsáveis', String(data.guardians.length)],
    ['Protocolos', String(data.protocols.length)],
    ['Sessões', String(data.sessions.length)],
    ['Alvos/Trials', String(data.targets.length)],
    ['Comportamentos', String(data.behaviors.length)],
    ['Snapshots Clínicos', String(data.snapshots.length)],
    ['Estados Clínicos', String(data.clinicalStates.length)],
    ['Resumos de Sessão', String(data.summaries.length)],
    ['Logs de Auditoria', String(data.auditLogs.length)],
    [],
    ['Política de Retenção', ''],
    ['Dados clínicos', '7 anos (CFM/CRP)'],
    ['Relatórios gerados', '7 anos (CFM/CRP)'],
    ['Logs de auditoria', '5 anos (Compliance)'],
    ['Portal família', 'Enquanto vínculo ativo (Consentimento)'],
    ['E-mail logs', '5 anos (Compliance)'],
    ['Notificações', '1 ano (Operacional)'],
  ]

  for (const row of infoRows) {
    const r = wsResumo.addRow(row)
    if (row.length === 0) continue
    r.getCell(1).font = { ...DATA_FONT, bold: true }
    r.getCell(2).font = DATA_FONT
  }

  wsResumo.getColumn(1).width = 30
  wsResumo.getColumn(2).width = 50

  // ── ABA 2: APRENDIZES ──
  if (data.learners.length > 0) {
    const ws = wb.addWorksheet('Aprendizes', { properties: { tabColor: { argb: 'FF27AE60' } } })
    addHeaderRow(ws, ['Nome', 'Data Nasc.', 'Diagnóstico', 'CID', 'Nível Suporte', 'Notas', 'Ativo', 'Cadastrado em'])
    for (const l of data.learners) {
      ws.addRow([
        l.name, fmtDateShort(l.birth_date), l.diagnosis || '', l.cid_code || '',
        l.support_level || '', l.notes || '', l.is_active ? 'Sim' : 'Não', fmtDate(l.created_at),
      ])
    }
    styleDataRows(ws, 2)
    autoWidth(ws)
  }

  // ── ABA 3: RESPONSÁVEIS ──
  if (data.guardians.length > 0) {
    const ws = wb.addWorksheet('Responsáveis', { properties: { tabColor: { argb: 'FF8E44AD' } } })
    addHeaderRow(ws, ['Nome', 'Parentesco', 'Email', 'Telefone', 'Ativo', 'Cadastrado em'])
    for (const g of data.guardians) {
      ws.addRow([
        g.name, g.relationship || '', g.email || '', g.phone || '',
        g.is_active ? 'Sim' : 'Não', fmtDate(g.created_at),
      ])
    }
    styleDataRows(ws, 2)
    autoWidth(ws)
  }

  // ── ABA 4: PROFISSIONAIS ──
  if (data.profiles.length > 0) {
    const ws = wb.addWorksheet('Profissionais', { properties: { tabColor: { argb: 'FF2980B9' } } })
    addHeaderRow(ws, ['Nome', 'Email', 'Cargo', 'Especialidade', 'Ativo', 'Cadastrado em'])
    for (const p of data.profiles) {
      ws.addRow([
        p.name, p.email || '', p.role || '', p.specialty || '',
        p.is_active ? 'Sim' : 'Não', fmtDate(p.created_at),
      ])
    }
    styleDataRows(ws, 2)
    autoWidth(ws)
  }

  // ── ABA 5: PROTOCOLOS ──
  if (data.protocols.length > 0) {
    const ws = wb.addWorksheet('Protocolos', { properties: { tabColor: { argb: 'FFE67E22' } } })
    addHeaderRow(ws, ['Título', 'Domínio', 'Objetivo', 'Prática EBP', 'Status', 'Critério Maestria %', 'Generalização', 'Regressões', 'Ativado em', 'Maestria em', 'Criado em'])
    for (const p of data.protocols) {
      ws.addRow([
        p.title, p.domain || '', p.objective || '', p.ebp_name || '',
        p.status || '', p.mastery_criteria_pct != null ? `${p.mastery_criteria_pct}%` : '',
        p.generalization_status || '', p.regression_count ?? '',
        fmtDate(p.activated_at), fmtDate(p.mastered_at), fmtDate(p.created_at),
      ])
    }
    styleDataRows(ws, 2)
    autoWidth(ws)
  }

  // ── ABA 6: SESSÕES ──
  if (data.sessions.length > 0) {
    const ws = wb.addWorksheet('Sessões', { properties: { tabColor: { argb: 'FF16A085' } } })
    addHeaderRow(ws, ['Aprendiz', 'Terapeuta', 'Agendada', 'Início', 'Fim', 'Duração (min)', 'Status', 'Local', 'Notas'])
    for (const s of data.sessions) {
      ws.addRow([
        s.learner_name || '', s.therapist_name || '',
        fmtDate(s.scheduled_at), fmtDate(s.started_at), fmtDate(s.ended_at),
        s.duration_minutes ?? '', s.status || '', s.location || '', s.notes || '',
      ])
    }
    styleDataRows(ws, 2)
    autoWidth(ws)
  }

  // ── ABA 7: ALVOS (TRIALS) ──
  if (data.targets.length > 0) {
    const ws = wb.addWorksheet('Alvos e Trials', { properties: { tabColor: { argb: 'FFC0392B' } } })
    addHeaderRow(ws, ['Sessão ID', 'Nome do Alvo', 'Acertos', 'Total Trials', '% Acerto', 'Nível Dica', 'Notas', 'Registrado em'])
    for (const t of data.targets) {
      ws.addRow([
        t.session_id || '', t.target_name || '',
        t.trials_correct ?? '', t.trials_total ?? '',
        t.score_pct != null ? `${t.score_pct}%` : '',
        t.prompt_level || '', t.notes || '', fmtDate(t.created_at),
      ])
    }
    styleDataRows(ws, 2)
    autoWidth(ws)
  }

  // ── ABA 8: COMPORTAMENTOS ──
  if (data.behaviors.length > 0) {
    const ws = wb.addWorksheet('Comportamentos', { properties: { tabColor: { argb: 'FFD35400' } } })
    addHeaderRow(ws, ['Sessão ID', 'Tipo', 'Antecedente', 'Comportamento', 'Consequência', 'Intensidade', 'Duração (s)', 'Registrado em'])
    for (const b of data.behaviors) {
      ws.addRow([
        b.session_id || '', b.behavior_type || '',
        b.antecedent || '', b.behavior || '', b.consequence || '',
        b.intensity || '', b.duration_seconds ?? '', fmtDate(b.recorded_at || b.created_at),
      ])
    }
    styleDataRows(ws, 2)
    autoWidth(ws)
  }

  // ── ABA 9: SNAPSHOTS CLÍNICOS ──
  if (data.snapshots.length > 0) {
    const ws = wb.addWorksheet('Snapshots Clínicos', { properties: { tabColor: { argb: 'FF7D3C98' } } })
    addHeaderRow(ws, ['Sessão ID', 'Aprendiz ID', 'CSO-ABA', 'SAS', 'PIS', 'BSS', 'TCM', 'Banda', 'Versão Motor', 'Data'])
    for (const s of data.snapshots) {
      ws.addRow([
        s.session_id || '', s.learner_id || '',
        s.cso_aba ?? '', s.sas ?? '', s.pis ?? '', s.bss ?? '', s.tcm ?? '',
        s.cso_band || '', s.engine_version || '', fmtDate(s.created_at),
      ])
    }
    styleDataRows(ws, 2)
    autoWidth(ws)
  }

  // ── ABA 10: ESTADOS CLÍNICOS ──
  if (data.clinicalStates.length > 0) {
    const ws = wb.addWorksheet('Estados Clínicos', { properties: { tabColor: { argb: 'FF1ABC9C' } } })
    addHeaderRow(ws, ['Aprendiz ID', 'CSO-ABA', 'SAS', 'PIS', 'BSS', 'TCM', 'Banda', 'Versão Motor', 'Data'])
    for (const cs of data.clinicalStates) {
      ws.addRow([
        cs.learner_id || '', cs.cso_aba ?? '', cs.sas ?? '', cs.pis ?? '',
        cs.bss ?? '', cs.tcm ?? '', cs.cso_band || '', cs.engine_version || '', fmtDate(cs.created_at),
      ])
    }
    styleDataRows(ws, 2)
    autoWidth(ws)
  }

  // ── ABA 11: PEI (PLANOS + METAS) ──
  if (data.peiPlans.length > 0 || data.peiGoals.length > 0) {
    const ws = wb.addWorksheet('PEI Planos e Metas', { properties: { tabColor: { argb: 'FF2ECC71' } } })

    if (data.peiPlans.length > 0) {
      ws.addRow(['PLANOS EDUCACIONAIS INDIVIDUALIZADOS']).getCell(1).font = { ...DATA_FONT, bold: true, size: 12 }
      ws.addRow([])
      addHeaderRow(ws, ['Título', 'Período Início', 'Período Fim', 'Status', 'Criado em'])
      for (const p of data.peiPlans) {
        ws.addRow([p.title, fmtDateShort(p.period_start), fmtDateShort(p.period_end), p.status || '', fmtDate(p.created_at)])
      }
      styleDataRows(ws, 4)
    }

    if (data.peiGoals.length > 0) {
      ws.addRow([])
      ws.addRow(['METAS DO PEI']).getCell(1).font = { ...DATA_FONT, bold: true, size: 12 }
      ws.addRow([])
      const goalHeaderRow = ws.rowCount + 1
      addHeaderRow(ws, ['Título', 'Domínio', 'Descrição', 'Status', 'Criado em'])
      for (const g of data.peiGoals) {
        ws.addRow([g.title, g.domain || '', g.description || '', g.status || '', fmtDate(g.created_at)])
      }
      styleDataRows(ws, goalHeaderRow + 1)
    }

    autoWidth(ws)
  }

  // ── ABA 12: RESUMOS DE SESSÃO ──
  if (data.summaries.length > 0) {
    const ws = wb.addWorksheet('Resumos', { properties: { tabColor: { argb: 'FF3498DB' } } })
    addHeaderRow(ws, ['Sessão ID', 'Aprendiz ID', 'Conteúdo', 'Status', 'Aprovado em', 'Enviado em', 'Criado em'])
    for (const s of data.summaries) {
      ws.addRow([
        s.session_id || '', s.learner_id || '', s.content || '',
        s.status || '', fmtDate(s.approved_at), fmtDate(s.sent_at), fmtDate(s.created_at),
      ])
    }
    styleDataRows(ws, 2)
    autoWidth(ws)
  }

  // ── ABA 13: CONSENTIMENTOS ──
  if (data.consents.length > 0) {
    const ws = wb.addWorksheet('Consentimentos', { properties: { tabColor: { argb: 'FF9B59B6' } } })
    addHeaderRow(ws, ['Tipo', 'Versão', 'Aceito em', 'Revogado em', 'IP'])
    for (const c of data.consents) {
      ws.addRow([
        c.consent_type || '', c.consent_version || '',
        fmtDate(c.accepted_at), fmtDate(c.revoked_at), c.ip_address || '',
      ])
    }
    styleDataRows(ws, 2)
    autoWidth(ws)
  }

  // ── ABA 14: AUDITORIA ──
  if (data.auditLogs.length > 0) {
    const ws = wb.addWorksheet('Auditoria', { properties: { tabColor: { argb: 'FF95A5A6' } } })
    addHeaderRow(ws, ['Ação', 'Tipo Entidade', 'Entidade ID', 'Ator', 'Data', 'Metadados'])
    for (const a of data.auditLogs) {
      ws.addRow([
        a.action || '', a.entity_type || '', a.entity_id || '',
        a.actor || '', fmtDate(a.created_at),
        a.metadata ? JSON.stringify(a.metadata) : '',
      ])
    }
    styleDataRows(ws, 2)
    autoWidth(ws)
  }

  return wb
}

// =====================================================
// GET — Exportação LGPD
// Default: Excel (.xlsx)
// ?format=json para formato técnico JSON
// =====================================================
export async function GET(request: NextRequest) {
  try {
    const format = request.nextUrl.searchParams.get('format') || 'xlsx'

    const data = await withTenant(async (ctx) => {
      requireAdminOrSupervisor(ctx)
      const { client, tenantId, userId, profileId, role } = ctx

      // Audit log
      try {
        await client.query(
          `INSERT INTO axis_audit_logs
            (tenant_id, user_id, actor, action, entity_type, metadata, created_at)
           VALUES ($1, $2, $3, 'LGPD_EXPORT_REQUESTED', 'tenant', $4, NOW())`,
          [tenantId, userId, userId, JSON.stringify({ requested_by_profile: profileId, requested_by_role: role, export_version: '3.0', format })]
        )
      } catch { /* non-critical */ }

      const allData = await fetchAllData(client, tenantId)
      return { allData, meta: { profileId, role, userId } }
    })

    const dateStr = new Date().toISOString().split('T')[0]

    // Formato JSON (opção técnica)
    if (format === 'json') {
      const { allData, meta } = data
      const clinicName = allData.tenant?.name || 'Clínica'

      const jsonResult = {
        _meta: {
          export_version: '3.0',
          exported_at: new Date().toISOString(),
          exported_by: { profile_id: meta.profileId, role: meta.role, clerk_user_id: meta.userId },
          engine: 'axis_aba',
          bible_version: '2.6.1',
          lgpd: {
            base_legal: 'Art. 18, Lei 13.709/2018 (LGPD)',
            controlador: clinicName,
            operador: 'Psiform Tecnologia (AXIS ABA)',
            finalidade: 'Portabilidade de dados mediante solicitação do titular',
          },
        },
        ...allData,
      }

      const filename = `axis_aba_export_${dateStr}.json`
      return new NextResponse(JSON.stringify(jsonResult, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
          'X-AXIS-Export-Version': '3.0',
        },
      })
    }

    // Formato Excel (default)
    const { allData, meta } = data
    const wb = await buildExcelWorkbook(allData, meta)

    const excelBuffer = await wb.xlsx.writeBuffer()
    const uint8 = new Uint8Array(excelBuffer as ArrayBuffer)
    const filename = `axis_aba_export_${dateStr}.xlsx`

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
        'X-AXIS-Export-Version': '3.0',
      },
    })
  } catch (error) {
    const { message, status } = handleRouteError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
