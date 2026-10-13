import type { PlanKey } from '@/src/billing/plans'

// =====================================================
// AXIS ABA v2.7.0 — Operadora Feature Gate
//
// Desde o pagamento P2 (opção B, decidida pela espinha em 13/10/2026) quem
// decide é a LICENÇA ABA ATIVA (plan_key, regra de src/billing/license-rules.ts),
// não tenants.plan_tier. Cortesia segue a chave dela.
// Ref: skill_axis_aba_v270.md — Pricing
//
// | Licença ABA ativa          | Nível (recursos)                               |
// |----------------------------|------------------------------------------------|
// | grátis / nenhuma / outra   | nenhum                                         |
// | aba_50                     | founders: básico (geo light + atestação), 6     |
// | aba_100                    | clinica_100: completo + claim packets, 10       |
// | aba_250                    | clinica_250: completo + integridade, 12         |
//
// Uso server-side (API routes): requireFeature(ctx, 'presenceProofs')
//   (src/database/with-role.ts; ctx.abaPlanKey vem do withTenant)
//
// Uso client-side (componentes):
//   const access = getOperadoraAccess(profile?.product_limits?.aba?.plan_key)
//   {access.integrityDashboard && <IntegrityDashboard />}
// =====================================================

/** Pacote de recursos. Os nomes são os dos planos antigos; quem escolhe o pacote é a chave ABA. */
export type OperadoraLevel = 'founders' | 'clinica_100' | 'clinica_250'

const LEVEL_BY_ABA_PLAN_KEY: Partial<Record<PlanKey, OperadoraLevel>> = {
  aba_50: 'founders',
  aba_100: 'clinica_100',
  aba_250: 'clinica_250',
}

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
  evidenceBundles: true, // Decisão 6 (ABA v9): evidence bundles para todos — padrão único
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

const ACCESS_MAP: Record<OperadoraLevel, OperadoraAccess> = {
  founders: FOUNDERS_ACCESS,
  clinica_100: CLINICA_100_ACCESS,
  clinica_250: CLINICA_250_ACCESS,
}

/** Nível pela chave da licença ABA ativa. null = nenhum recurso. */
export function operadoraLevel(abaPlanKey?: string | null): OperadoraLevel | null {
  if (!abaPlanKey) return null
  return LEVEL_BY_ABA_PLAN_KEY[abaPlanKey as PlanKey] ?? null
}

/**
 * Permissões das features v2.7.0 pela chave da licença ABA ATIVA.
 * null/undefined (ABA grátis ou sem licença ABA) ou chave que não é ABA → nenhum recurso.
 */
export function getOperadoraAccess(abaPlanKey?: string | null): OperadoraAccess {
  const level = operadoraLevel(abaPlanKey)
  return level ? ACCESS_MAP[level] : FREE_ACCESS
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
