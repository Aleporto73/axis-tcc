// =====================================================
// AXIS ABA v2.7.0 — Operadora Feature Gate
//
// Controla acesso às features v2.7.0 por plan_tier.
// Ref: skill_axis_aba_v270.md — Pricing
//
// | Plano       | Operadora Ready?                              |
// |-------------|-----------------------------------------------|
// | Free        | Não                                           |
// | Founders    | Básico (geo light + atestação terapeuta)       |
// | Clínica 100 | Completo (geo + atestação + claim packets)     |
// | Clínica 250 | Completo + integridade + dashboards            |
//
// Uso server-side (API routes):
//   const access = getOperadoraAccess(plan_tier)
//   if (!access.presenceProofs) return 403
//
// Uso client-side (componentes):
//   const access = getOperadoraAccess(profile?.tenant_plan)
//   {access.integrityDashboard && <IntegrityDashboard />}
// =====================================================

export type PlanTier = 'free' | 'founders' | 'clinica_100' | 'clinica_250'

export interface OperadoraAccess {
  /** Plano tem algum acesso operadora */
  hasOperadora: boolean
  /** Locais de atendimento (Sprint 0) */
  serviceSites: boolean
  /** Check-in/out GPS (Sprint 1) */
  presenceProofs: boolean
  /** Atestações de terapeuta (Sprint 1) */
  attestationsTherapist: boolean
  /** Atestações de responsável/guardian (Sprint 1) */
  attestationsGuardian: boolean
  /** Bundles de evidência (Sprint 1) */
  evidenceBundles: boolean
  /** Anexos de sessão (Sprint 1) */
  attachments: boolean
  /** Perfis de cobertura (Sprint 2) */
  coverageProfiles: boolean
  /** Pacotes de faturamento (Sprint 2) */
  claimPackets: boolean
  /** Credenciais profissionais (Sprint 2) */
  providerCredentials: boolean
  /** Flags de integridade + scan (Sprint 3) */
  integrityFlags: boolean
  /** Dashboard de compliance (Sprint 3) */
  integrityDashboard: boolean
  /** Perfis de pagador (Sprint 4) */
  payerProfiles: boolean
}

const FREE_ACCESS: OperadoraAccess = {
  hasOperadora: false,
  serviceSites: false,
  presenceProofs: false,
  attestationsTherapist: false,
  attestationsGuardian: false,
  evidenceBundles: false,
  attachments: false,
  coverageProfiles: false,
  claimPackets: false,
  providerCredentials: false,
  integrityFlags: false,
  integrityDashboard: false,
  payerProfiles: false,
}

const FOUNDERS_ACCESS: OperadoraAccess = {
  hasOperadora: true,
  serviceSites: true,
  presenceProofs: true,
  attestationsTherapist: true,
  attestationsGuardian: false,
  evidenceBundles: false,
  attachments: true,
  coverageProfiles: false,
  claimPackets: false,
  providerCredentials: true,
  integrityFlags: false,
  integrityDashboard: false,
  payerProfiles: false,
}

const CLINICA_100_ACCESS: OperadoraAccess = {
  hasOperadora: true,
  serviceSites: true,
  presenceProofs: true,
  attestationsTherapist: true,
  attestationsGuardian: true,
  evidenceBundles: true,
  attachments: true,
  coverageProfiles: true,
  claimPackets: true,
  providerCredentials: true,
  integrityFlags: false,
  integrityDashboard: false,
  payerProfiles: true,
}

const CLINICA_250_ACCESS: OperadoraAccess = {
  hasOperadora: true,
  serviceSites: true,
  presenceProofs: true,
  attestationsTherapist: true,
  attestationsGuardian: true,
  evidenceBundles: true,
  attachments: true,
  coverageProfiles: true,
  claimPackets: true,
  providerCredentials: true,
  integrityFlags: true,
  integrityDashboard: true,
  payerProfiles: true,
}

const ACCESS_MAP: Record<PlanTier, OperadoraAccess> = {
  free: FREE_ACCESS,
  founders: FOUNDERS_ACCESS,
  clinica_100: CLINICA_100_ACCESS,
  clinica_250: CLINICA_250_ACCESS,
}

/**
 * Retorna as permissões de features v2.7.0 para o plano.
 * Se plan_tier for null/undefined/desconhecido, retorna FREE (sem acesso).
 */
export function getOperadoraAccess(planTier?: string | null): OperadoraAccess {
  if (!planTier) return FREE_ACCESS
  return ACCESS_MAP[planTier as PlanTier] ?? FREE_ACCESS
}

/**
 * Mapa de feature → chave para mensagens de erro nas APIs.
 */
export const FEATURE_LABELS: Record<keyof OperadoraAccess, string> = {
  hasOperadora: 'Operadora Ready',
  serviceSites: 'Locais de Atendimento',
  presenceProofs: 'Presença GPS',
  attestationsTherapist: 'Atestações Terapeuta',
  attestationsGuardian: 'Atestações Responsável',
  evidenceBundles: 'Bundles de Evidência',
  attachments: 'Anexos de Sessão',
  coverageProfiles: 'Perfis de Cobertura',
  claimPackets: 'Pacotes de Faturamento',
  providerCredentials: 'Credenciais Profissionais',
  integrityFlags: 'Flags de Integridade',
  integrityDashboard: 'Dashboard de Compliance',
  payerProfiles: 'Perfis de Pagador',
}
