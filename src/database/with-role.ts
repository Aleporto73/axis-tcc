import { TenantContext, UserRole, TenantSelectionRequired } from './with-tenant'
import { getOperadoraAccess, OperadoraAccess, FEATURE_LABELS } from '@/src/lib/operadora-gate'

// =====================================================
// AXIS ABA - Authorization Helpers (Multi-Terapeuta)
// Conforme AXIS ABA Bible v2.6.1 + v2.7.0 Operadora Ready
// IA não decide — IA organiza. Roles são humanas.
// =====================================================

/**
 * Verifica se o contexto tem uma das roles permitidas.
 * Lança erro com status 403 se não autorizado.
 */
export function requireRole(ctx: TenantContext, ...allowedRoles: UserRole[]): void {
  if (!allowedRoles.includes(ctx.role)) {
    throw new RoleError(
      `Acesso negado. Role '${ctx.role}' não tem permissão para esta ação.`
    )
  }
}

/**
 * Atalho: exige admin ou supervisor.
 */
export function requireAdminOrSupervisor(ctx: TenantContext): void {
  requireRole(ctx, 'admin', 'supervisor')
}

/**
 * Atalho: exige admin.
 */
export function requireAdmin(ctx: TenantContext): void {
  requireRole(ctx, 'admin')
}

/**
 * Retorna cláusula SQL para filtrar aprendizes por terapeuta.
 * - admin/supervisor: sem filtro (vê todos do tenant)
 * - terapeuta: filtra via learner_therapists
 *
 * Uso:
 *   const { clause, params } = learnerFilter(ctx, startParamIndex)
 *   const query = `SELECT * FROM learners WHERE tenant_id = $1 ${clause}`
 */
export function learnerFilter(
  ctx: TenantContext,
  startParamIndex: number
): { clause: string; params: string[] } {
  if (ctx.role === 'admin' || ctx.role === 'supervisor') {
    return { clause: '', params: [] }
  }

  // Terapeuta: filtrar via learner_therapists
  return {
    clause: `AND id IN (
      SELECT learner_id FROM learner_therapists
      WHERE profile_id = $${startParamIndex} AND tenant_id = $1
    )`,
    params: [ctx.profileId]
  }
}

/**
 * Retorna cláusula SQL para filtrar sessões por terapeuta.
 * - admin/supervisor: sem filtro
 * - terapeuta: filtra por therapist_id (clerk_user_id) na sessions_aba
 */
export function sessionFilter(
  ctx: TenantContext,
  startParamIndex: number
): { clause: string; params: string[] } {
  if (ctx.role === 'admin' || ctx.role === 'supervisor') {
    return { clause: '', params: [] }
  }

  return {
    clause: `AND therapist_id = $${startParamIndex}`,
    params: [ctx.userId]
  }
}

/**
 * Verifica se terapeuta tem acesso a um aprendiz específico.
 * Admin/Supervisor sempre têm acesso.
 */
export async function canAccessLearner(
  ctx: TenantContext,
  learnerId: string
): Promise<boolean> {
  if (ctx.role === 'admin' || ctx.role === 'supervisor') {
    return true
  }

  const result = await ctx.client.query(
    `SELECT 1 FROM learner_therapists
     WHERE learner_id = $1 AND profile_id = $2 AND tenant_id = $3
     LIMIT 1`,
    [learnerId, ctx.profileId, ctx.tenantId]
  )

  return result.rows.length > 0
}

// =====================================================
// AXIS TDAH — Filtros de Vínculo Terapeuta-Paciente
// Migration 038: tdah_patient_therapists (N:N)
// =====================================================

/**
 * Retorna cláusula SQL para filtrar pacientes TDAH por terapeuta.
 * - admin/supervisor: sem filtro (vê todos do tenant)
 * - terapeuta: filtra via tdah_patient_therapists
 *
 * Uso:
 *   const { clause, params } = tdahPatientFilter(ctx, startParamIndex)
 *   const query = `SELECT * FROM tdah_patients p WHERE p.tenant_id = $1 ${clause}`
 *
 * Onda 5.3 (25/04/2026): removido fallback OR p.created_by — leak intra-tenant.
 * Vínculo terapeuta-paciente agora exige row explícita em tdah_patient_therapists.
 * Admin/supervisor não passam por aqui (early-return clause vazia, linhas 125-127).
 */
export function tdahPatientFilter(
  ctx: TenantContext,
  startParamIndex: number
): { clause: string; params: string[] } {
  if (ctx.role === 'admin' || ctx.role === 'supervisor') {
    return { clause: '', params: [] }
  }

  // Terapeuta: filtrar via tdah_patient_therapists (vínculo explícito N:N)
  return {
    clause: `AND p.id IN (
      SELECT patient_id FROM tdah_patient_therapists
      WHERE profile_id = $${startParamIndex} AND tenant_id = $1
    )`,
    params: [ctx.profileId]
  }
}

/**
 * Retorna cláusula SQL para filtrar sessões TDAH por pacientes do terapeuta.
 * Para uso em queries que não fazem JOIN direto com tdah_patients.
 *
 * Onda 5.3 (25/04/2026): removido UNION com tdah_patients.created_by — leak intra-tenant.
 */
export function tdahSessionFilter(
  ctx: TenantContext,
  startParamIndex: number,
  sessionAlias: string = 's'
): { clause: string; params: string[] } {
  if (ctx.role === 'admin' || ctx.role === 'supervisor') {
    return { clause: '', params: [] }
  }

  return {
    clause: `AND ${sessionAlias}.patient_id IN (
      SELECT patient_id FROM tdah_patient_therapists
      WHERE profile_id = $${startParamIndex} AND tenant_id = $1
    )`,
    params: [ctx.profileId]
  }
}

/**
 * Verifica se terapeuta tem acesso a um paciente TDAH específico.
 * Admin/Supervisor sempre têm acesso.
 *
 * Onda 5.3 (25/04/2026): removido UNION ALL com tdah_patients.created_by.
 * Acesso single-patient agora exige row explícita em tdah_patient_therapists.
 * Admin/supervisor têm early-return true (linhas 175-177), não passam por aqui.
 */
export async function canAccessTdahPatient(
  ctx: TenantContext,
  patientId: string
): Promise<boolean> {
  if (ctx.role === 'admin' || ctx.role === 'supervisor') {
    return true
  }

  const result = await ctx.client.query(
    `SELECT 1 FROM tdah_patient_therapists
     WHERE patient_id = $1 AND profile_id = $2 AND tenant_id = $3
     LIMIT 1`,
    [patientId, ctx.profileId, ctx.tenantId]
  )

  return result.rows.length > 0
}

// =====================================================
// Operadora Ready — Feature Gate (v2.7.0)
// =====================================================

/**
 * Verifica se o plano do tenant tem acesso a uma feature v2.7.0.
 * Lança PlanGateError (403) se não autorizado.
 *
 * Uso:
 *   requireFeature(ctx, 'presenceProofs')
 *   requireFeature(ctx, 'claimPackets')
 */
export function requireFeature(ctx: TenantContext, feature: keyof OperadoraAccess): void {
  const access = getOperadoraAccess(ctx.planTier)
  if (!access[feature]) {
    throw new PlanGateError(
      `Recurso "${FEATURE_LABELS[feature]}" não disponível no plano atual. Faça upgrade para acessar.`,
      feature
    )
  }
}

/**
 * Erro customizado para gate de plano — capturado nas rotas para retornar 403.
 */
export class PlanGateError extends Error {
  public statusCode = 403
  public feature: string

  constructor(message: string, feature: string) {
    super(message)
    this.name = 'PlanGateError'
    this.feature = feature
  }
}

/**
 * Erro customizado para autorização — capturado nas rotas para retornar 403.
 */
export class RoleError extends Error {
  public statusCode = 403

  constructor(message: string) {
    super(message)
    this.name = 'RoleError'
  }
}

/**
 * Handler padrão para erros em rotas API.
 * Detecta RoleError e retorna 403.
 */
export function handleRouteError(error: unknown): { message: string; status: number; tenants?: any[] } {
  if (error instanceof TenantSelectionRequired) {
    return { message: 'Seleção de clínica necessária', status: 409, tenants: error.tenants }
  }
  if (error instanceof PlanGateError) {
    return { message: error.message, status: 403 }
  }
  if (error instanceof RoleError) {
    return { message: error.message, status: 403 }
  }
  if (error instanceof Error && error.message === 'Não autenticado') {
    return { message: 'Não autenticado', status: 401 }
  }
  if (error instanceof Error && error.message === 'Tenant não encontrado') {
    return { message: 'Tenant não encontrado', status: 404 }
  }
  console.error('[AXIS] Erro:', error)
  return { message: 'Erro interno', status: 500 }
}
