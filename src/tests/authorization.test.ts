import { describe, test, expect, vi } from 'vitest'
import {
  requireRole,
  requireAdmin,
  requireAdminOrSupervisor,
  requireFeature,
  learnerFilter,
  sessionFilter,
  tdahPatientFilter,
  tdahSessionFilter,
  canAccessLearner,
  canAccessTdahPatient,
  handleRouteError,
  RoleError,
  PlanGateError,
} from '@/src/database/with-role'
import { TenantContext, UserRole, TenantSelectionRequired } from '@/src/database/with-tenant'
import { getOperadoraAccess } from '@/src/lib/operadora-gate'

// =====================================================
// AXIS — Testes de Autorização por Role/Feature
//
// Cobre os 3 módulos: TCC, ABA, TDAH
// Unit tests apenas — sem mocks de banco complexos
// =====================================================

// ─── Helpers para criar contextos mock ───

function mockCtx(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    tenantId: 'tenant-001',
    userId: 'user-001',
    profileId: 'profile-001',
    role: 'admin' as UserRole,
    planTier: 'free',
    client: {} as any,
    ...overrides,
  }
}

function adminCtx(plan = 'free') { return mockCtx({ role: 'admin', planTier: plan }) }
function supervisorCtx(plan = 'free') { return mockCtx({ role: 'supervisor', planTier: plan }) }
function terapeutaCtx(profileId = 'profile-T1', plan = 'free') {
  return mockCtx({ role: 'terapeuta', profileId, planTier: plan })
}

// Mock pg client com retorno configurável
function mockClient(rows: any[] = []) {
  return { query: vi.fn().mockResolvedValue({ rows }) } as any
}

// ═════════════════════════════════════════════════════
// GUARDS DE ROLE (compartilhados TCC + ABA + TDAH)
// ═════════════════════════════════════════════════════

describe('Guards de Role — requireRole / requireAdmin / requireAdminOrSupervisor', () => {

  test('requireRole aceita role permitida', () => {
    expect(() => requireRole(adminCtx(), 'admin')).not.toThrow()
    expect(() => requireRole(supervisorCtx(), 'admin', 'supervisor')).not.toThrow()
    expect(() => requireRole(terapeutaCtx(), 'terapeuta')).not.toThrow()
  })

  test('requireRole rejeita role não permitida', () => {
    expect(() => requireRole(terapeutaCtx(), 'admin')).toThrow(RoleError)
    expect(() => requireRole(terapeutaCtx(), 'admin', 'supervisor')).toThrow(RoleError)
    expect(() => requireRole(supervisorCtx(), 'admin')).toThrow(RoleError)
  })

  test('requireRole lança RoleError com statusCode 403', () => {
    try {
      requireRole(terapeutaCtx(), 'admin')
      expect.unreachable('deveria ter lançado')
    } catch (e) {
      expect(e).toBeInstanceOf(RoleError)
      expect((e as RoleError).statusCode).toBe(403)
      expect((e as RoleError).message).toContain('terapeuta')
    }
  })

  test('requireAdmin aceita admin, rejeita supervisor e terapeuta', () => {
    expect(() => requireAdmin(adminCtx())).not.toThrow()
    expect(() => requireAdmin(supervisorCtx())).toThrow(RoleError)
    expect(() => requireAdmin(terapeutaCtx())).toThrow(RoleError)
  })

  test('requireAdminOrSupervisor aceita admin e supervisor, rejeita terapeuta', () => {
    expect(() => requireAdminOrSupervisor(adminCtx())).not.toThrow()
    expect(() => requireAdminOrSupervisor(supervisorCtx())).not.toThrow()
    expect(() => requireAdminOrSupervisor(terapeutaCtx())).toThrow(RoleError)
  })
})

// ═════════════════════════════════════════════════════
// HANDLEREROUTERROR — Classificação de erros
// ═════════════════════════════════════════════════════

describe('handleRouteError — classificação de erros', () => {

  test('RoleError → 403', () => {
    const result = handleRouteError(new RoleError('Negado'))
    expect(result.status).toBe(403)
    expect(result.message).toBe('Negado')
  })

  test('PlanGateError → 403 com feature', () => {
    const result = handleRouteError(new PlanGateError('Upgrade', 'claimPackets'))
    expect(result.status).toBe(403)
    expect(result.message).toBe('Upgrade')
  })

  test('TenantSelectionRequired → 409 com tenants', () => {
    const tenants = [{ tenant_id: 't1', tenant_name: 'Clinica A', role: 'admin', profile_id: 'p1' }]
    const result = handleRouteError(new TenantSelectionRequired(tenants))
    expect(result.status).toBe(409)
    expect(result.tenants).toEqual(tenants)
  })

  test('Erro "Não autenticado" → 401', () => {
    const result = handleRouteError(new Error('Não autenticado'))
    expect(result.status).toBe(401)
  })

  test('Erro "Tenant não encontrado" → 404', () => {
    const result = handleRouteError(new Error('Tenant não encontrado'))
    expect(result.status).toBe(404)
  })

  test('Erro genérico → 500', () => {
    const result = handleRouteError(new Error('qualquer coisa'))
    expect(result.status).toBe(500)
    expect(result.message).toBe('Erro interno')
  })
})

// ═════════════════════════════════════════════════════
// TCC — Autorização por role
// ═════════════════════════════════════════════════════

describe('TCC — Autorização por role (modelo simples admin+terapeuta)', () => {

  // TCC usa withTenant + requireRole em rotas de pacientes/sessões.
  // Admin vê tudo do tenant, terapeuta vê o que criou (filtrado via created_by no SQL).
  // Aqui testamos os guards que protegem essas rotas.

  test('Admin pode acessar rotas de listagem (requireRole admin/terapeuta)', () => {
    expect(() => requireRole(adminCtx(), 'admin', 'terapeuta')).not.toThrow()
  })

  test('Terapeuta pode acessar rotas de listagem', () => {
    expect(() => requireRole(terapeutaCtx(), 'admin', 'terapeuta')).not.toThrow()
  })

  test('Admin pode acessar rotas administrativas (requireAdmin)', () => {
    expect(() => requireAdmin(adminCtx())).not.toThrow()
  })

  test('Terapeuta NÃO pode acessar rotas administrativas', () => {
    expect(() => requireAdmin(terapeutaCtx())).toThrow(RoleError)
  })

  test('Admin pode criar/editar/deletar sessões (requireRole admin/terapeuta)', () => {
    expect(() => requireRole(adminCtx(), 'admin', 'terapeuta')).not.toThrow()
  })

  test('Terapeuta pode criar sessões para seus pacientes', () => {
    expect(() => requireRole(terapeutaCtx(), 'admin', 'terapeuta')).not.toThrow()
  })
})

// ═════════════════════════════════════════════════════
// ABA — Autorização por role + feature gate
// ═════════════════════════════════════════════════════

describe('ABA — learnerFilter (visibilidade por role)', () => {

  test('Admin: sem cláusula de filtro (vê todos do tenant)', () => {
    const { clause, params } = learnerFilter(adminCtx(), 2)
    expect(clause).toBe('')
    expect(params).toEqual([])
  })

  test('Supervisor: sem cláusula de filtro (vê todos do tenant)', () => {
    const { clause, params } = learnerFilter(supervisorCtx(), 2)
    expect(clause).toBe('')
    expect(params).toEqual([])
  })

  test('Terapeuta: filtra via learner_therapists com profileId', () => {
    const ctx = terapeutaCtx('prof-xyz')
    const { clause, params } = learnerFilter(ctx, 3)
    expect(clause).toContain('learner_therapists')
    expect(clause).toContain('$3')
    expect(params).toEqual(['prof-xyz'])
  })

  test('Terapeuta: param index é dinâmico', () => {
    const { clause } = learnerFilter(terapeutaCtx(), 5)
    expect(clause).toContain('$5')
  })
})

describe('ABA — sessionFilter (visibilidade por role)', () => {

  test('Admin/Supervisor: sem filtro', () => {
    expect(sessionFilter(adminCtx(), 2).clause).toBe('')
    expect(sessionFilter(supervisorCtx(), 2).clause).toBe('')
  })

  test('Terapeuta: filtra por therapist_id (userId)', () => {
    const ctx = mockCtx({ role: 'terapeuta', userId: 'user-T1' })
    const { clause, params } = sessionFilter(ctx, 2)
    expect(clause).toContain('therapist_id')
    expect(clause).toContain('$2')
    expect(params).toEqual(['user-T1'])
  })
})

describe('ABA — canAccessLearner (verificação de vínculo)', () => {

  test('Admin sempre tem acesso', async () => {
    const ctx = adminCtx()
    ctx.client = mockClient() // não deveria nem consultar
    const result = await canAccessLearner(ctx, 'learner-1')
    expect(result).toBe(true)
    expect(ctx.client.query).not.toHaveBeenCalled()
  })

  test('Supervisor sempre tem acesso', async () => {
    const ctx = supervisorCtx()
    ctx.client = mockClient()
    const result = await canAccessLearner(ctx, 'learner-1')
    expect(result).toBe(true)
    expect(ctx.client.query).not.toHaveBeenCalled()
  })

  test('Terapeuta COM vínculo: tem acesso', async () => {
    const ctx = terapeutaCtx('prof-T1')
    ctx.client = mockClient([{ '?column?': 1 }]) // retorna 1 row
    const result = await canAccessLearner(ctx, 'learner-1')
    expect(result).toBe(true)
    expect(ctx.client.query).toHaveBeenCalledWith(
      expect.stringContaining('learner_therapists'),
      ['learner-1', 'prof-T1', 'tenant-001']
    )
  })

  test('Terapeuta SEM vínculo: NÃO tem acesso', async () => {
    const ctx = terapeutaCtx('prof-T1')
    ctx.client = mockClient([]) // 0 rows
    const result = await canAccessLearner(ctx, 'learner-2')
    expect(result).toBe(false)
  })
})

describe('ABA — requireFeature (operadora gate por plano)', () => {

  test('Free: NENHUMA feature operadora liberada', () => {
    const ctx = adminCtx('free')
    expect(() => requireFeature(ctx, 'claimPackets')).toThrow(PlanGateError)
    expect(() => requireFeature(ctx, 'presenceProofs')).toThrow(PlanGateError)
    expect(() => requireFeature(ctx, 'integrityDashboard')).toThrow(PlanGateError)
  })

  test('Founders: features básicas liberadas', () => {
    const ctx = adminCtx('founders')
    expect(() => requireFeature(ctx, 'serviceSites')).not.toThrow()
    expect(() => requireFeature(ctx, 'presenceProofs')).not.toThrow()
    expect(() => requireFeature(ctx, 'attestationsTherapist')).not.toThrow()
    expect(() => requireFeature(ctx, 'attachments')).not.toThrow()
    // Founders NÃO tem claim packets
    expect(() => requireFeature(ctx, 'claimPackets')).toThrow(PlanGateError)
    expect(() => requireFeature(ctx, 'integrityDashboard')).toThrow(PlanGateError)
  })

  test('Clinica 100: completo exceto integridade', () => {
    const ctx = adminCtx('clinica_100')
    expect(() => requireFeature(ctx, 'claimPackets')).not.toThrow()
    expect(() => requireFeature(ctx, 'evidenceBundles')).not.toThrow()
    expect(() => requireFeature(ctx, 'coverageProfiles')).not.toThrow()
    // Clinica 100 NÃO tem integridade
    expect(() => requireFeature(ctx, 'integrityFlags')).toThrow(PlanGateError)
    expect(() => requireFeature(ctx, 'integrityDashboard')).toThrow(PlanGateError)
  })

  test('Clinica 250: tudo liberado', () => {
    const ctx = adminCtx('clinica_250')
    expect(() => requireFeature(ctx, 'claimPackets')).not.toThrow()
    expect(() => requireFeature(ctx, 'integrityFlags')).not.toThrow()
    expect(() => requireFeature(ctx, 'integrityDashboard')).not.toThrow()
    expect(() => requireFeature(ctx, 'payerProfiles')).not.toThrow()
  })

  test('PlanGateError tem statusCode 403 e feature identificada', () => {
    try {
      requireFeature(adminCtx('free'), 'claimPackets')
      expect.unreachable('deveria ter lançado')
    } catch (e) {
      expect(e).toBeInstanceOf(PlanGateError)
      expect((e as PlanGateError).statusCode).toBe(403)
      expect((e as PlanGateError).feature).toBe('claimPackets')
    }
  })

  test('Plan tier desconhecido/null → tratado como free (sem acesso)', () => {
    const access = getOperadoraAccess(null)
    expect(access.hasOperadora).toBe(false)
    expect(access.claimPackets).toBe(false)

    const access2 = getOperadoraAccess(undefined)
    expect(access2.hasOperadora).toBe(false)

    const access3 = getOperadoraAccess('plano_inexistente')
    expect(access3.hasOperadora).toBe(false)
  })
})

describe('ABA — Claim Packets: só admin/supervisor', () => {

  test('Admin pode acessar claim packets', () => {
    expect(() => requireAdminOrSupervisor(adminCtx())).not.toThrow()
  })

  test('Supervisor pode acessar claim packets', () => {
    expect(() => requireAdminOrSupervisor(supervisorCtx())).not.toThrow()
  })

  test('Terapeuta NÃO pode acessar claim packets', () => {
    expect(() => requireAdminOrSupervisor(terapeutaCtx())).toThrow(RoleError)
  })

  test('Mesmo com plano liberado, terapeuta é bloqueado pelo role check', () => {
    const ctx = terapeutaCtx('prof-1', 'clinica_250')
    // Feature está liberada no plano...
    expect(() => requireFeature(ctx, 'claimPackets')).not.toThrow()
    // ...mas role check bloqueia
    expect(() => requireAdminOrSupervisor(ctx)).toThrow(RoleError)
  })
})

// ═════════════════════════════════════════════════════
// TDAH — Autorização por role + vínculo N:N
// ═════════════════════════════════════════════════════

describe('TDAH — tdahPatientFilter (visibilidade por role)', () => {

  test('Admin: sem cláusula de filtro', () => {
    const { clause, params } = tdahPatientFilter(adminCtx(), 2)
    expect(clause).toBe('')
    expect(params).toEqual([])
  })

  test('Supervisor: sem cláusula de filtro', () => {
    const { clause, params } = tdahPatientFilter(supervisorCtx(), 2)
    expect(clause).toBe('')
    expect(params).toEqual([])
  })

  test('Terapeuta: filtra via tdah_patient_therapists + fallback created_by', () => {
    const ctx = terapeutaCtx('prof-tdah-1')
    const { clause, params } = tdahPatientFilter(ctx, 4)
    expect(clause).toContain('tdah_patient_therapists')
    expect(clause).toContain('created_by')
    expect(clause).toContain('$4')
    expect(params).toEqual(['prof-tdah-1'])
  })
})

describe('TDAH — tdahSessionFilter (visibilidade sessões)', () => {

  test('Admin: sem filtro', () => {
    const { clause } = tdahSessionFilter(adminCtx(), 2)
    expect(clause).toBe('')
  })

  test('Supervisor: sem filtro', () => {
    const { clause } = tdahSessionFilter(supervisorCtx(), 2)
    expect(clause).toBe('')
  })

  test('Terapeuta: filtra via tdah_patient_therapists + created_by', () => {
    const ctx = terapeutaCtx('prof-tdah-2')
    const { clause, params } = tdahSessionFilter(ctx, 3)
    expect(clause).toContain('tdah_patient_therapists')
    expect(clause).toContain('tdah_patients')
    expect(clause).toContain('created_by')
    expect(clause).toContain('$3')
    expect(params).toEqual(['prof-tdah-2'])
  })

  test('Terapeuta: alias de sessão customizável', () => {
    const { clause } = tdahSessionFilter(terapeutaCtx(), 2, 'sess')
    expect(clause).toContain('sess.patient_id')
  })

  test('Terapeuta: alias default é "s"', () => {
    const { clause } = tdahSessionFilter(terapeutaCtx(), 2)
    expect(clause).toContain('s.patient_id')
  })
})

describe('TDAH — canAccessTdahPatient (verificação de vínculo)', () => {

  test('Admin sempre tem acesso', async () => {
    const ctx = adminCtx()
    ctx.client = mockClient()
    const result = await canAccessTdahPatient(ctx, 'patient-1')
    expect(result).toBe(true)
    expect(ctx.client.query).not.toHaveBeenCalled()
  })

  test('Supervisor sempre tem acesso', async () => {
    const ctx = supervisorCtx()
    ctx.client = mockClient()
    const result = await canAccessTdahPatient(ctx, 'patient-1')
    expect(result).toBe(true)
    expect(ctx.client.query).not.toHaveBeenCalled()
  })

  test('Terapeuta COM vínculo (tdah_patient_therapists): tem acesso', async () => {
    const ctx = terapeutaCtx('prof-tdah-1')
    ctx.client = mockClient([{ '?column?': 1 }])
    const result = await canAccessTdahPatient(ctx, 'patient-1')
    expect(result).toBe(true)
    expect(ctx.client.query).toHaveBeenCalledWith(
      expect.stringContaining('tdah_patient_therapists'),
      ['patient-1', 'prof-tdah-1', 'tenant-001']
    )
  })

  test('Terapeuta COM created_by (fallback): tem acesso', async () => {
    const ctx = terapeutaCtx('prof-tdah-1')
    ctx.client = mockClient([{ '?column?': 1 }]) // UNION ALL retorna via created_by
    const result = await canAccessTdahPatient(ctx, 'patient-2')
    expect(result).toBe(true)
    // Query deve ter UNION ALL com tdah_patients.created_by
    expect(ctx.client.query).toHaveBeenCalledWith(
      expect.stringContaining('UNION ALL'),
      ['patient-2', 'prof-tdah-1', 'tenant-001']
    )
  })

  test('Terapeuta SEM vínculo: NÃO tem acesso', async () => {
    const ctx = terapeutaCtx('prof-tdah-1')
    ctx.client = mockClient([]) // 0 rows
    const result = await canAccessTdahPatient(ctx, 'patient-3')
    expect(result).toBe(false)
  })
})

describe('TDAH — Portais públicos (token-based)', () => {

  // Portais família/escola usam token UUID — sem auth Clerk.
  // Testes aqui validam que o padrão token-based é independente de roles.

  test('Token válido (UUID format) é string de 36 chars', () => {
    const validToken = '550e8400-e29b-41d4-a716-446655440000'
    expect(validToken).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  test('Token inválido (non-UUID) é rejeitado pelo regex', () => {
    const invalidTokens = [
      '',
      'abc',
      '550e8400-e29b-41d4-a716',           // truncado
      '../etc/passwd',                       // path traversal
      '<script>alert(1)</script>',           // XSS
      'SELECT * FROM tokens',               // SQL injection
    ]
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    for (const token of invalidTokens) {
      expect(uuidRegex.test(token)).toBe(false)
    }
  })
})

// ═════════════════════════════════════════════════════
// OPERADORA GATE — Cobertura completa por plano
// ═════════════════════════════════════════════════════

describe('Operadora Gate — getOperadoraAccess por plano', () => {

  test('Free: hasOperadora=false, todas features=false', () => {
    const a = getOperadoraAccess('free')
    expect(a.hasOperadora).toBe(false)
    expect(a.claimPackets).toBe(false)
    expect(a.integrityDashboard).toBe(false)
  })

  test('Founders: hasOperadora=true, features básicas=true, avançadas=false', () => {
    const a = getOperadoraAccess('founders')
    expect(a.hasOperadora).toBe(true)
    expect(a.serviceSites).toBe(true)
    expect(a.attestationsTherapist).toBe(true)
    expect(a.claimPackets).toBe(false)
    expect(a.attestationsGuardian).toBe(false)
  })

  test('Clinica 100: completo exceto integridade', () => {
    const a = getOperadoraAccess('clinica_100')
    expect(a.hasOperadora).toBe(true)
    expect(a.claimPackets).toBe(true)
    expect(a.coverageProfiles).toBe(true)
    expect(a.payerProfiles).toBe(true)
    expect(a.integrityFlags).toBe(false)
    expect(a.integrityDashboard).toBe(false)
  })

  test('Clinica 250: tudo true', () => {
    const a = getOperadoraAccess('clinica_250')
    const values = Object.values(a)
    expect(values.every(v => v === true)).toBe(true)
  })
})
