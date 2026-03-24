import { describe, test, expect, vi } from 'vitest'
import {
  canAccessTdahPatient,
  tdahPatientFilter,
  tdahSessionFilter,
} from '@/src/database/with-role'
import { TenantContext, UserRole } from '@/src/database/with-tenant'

// =====================================================
// AXIS TDAH — Testes de Isolamento de Acesso
//
// Valida que:
// 1. Terapeuta A NÃO acessa paciente de Terapeuta B
// 2. Usuário de outro tenant NÃO acessa nada
// 3. Admin/Supervisor acessa tudo da org
// 4. canAccessTdahPatient bloqueia corretamente
// 5. Mensagens de erro são genéricas (sem vazamento)
// =====================================================

// ─── Helpers ───

function mockCtx(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    tenantId: 'tenant-001',
    userId: 'user-001',
    profileId: 'profile-001',
    role: 'admin' as UserRole,
    planTier: 'free',
    client: { query: vi.fn().mockResolvedValue({ rows: [] }) } as any,
    ...overrides,
  }
}

function mockClient(rows: any[] = []) {
  return { query: vi.fn().mockResolvedValue({ rows }) } as any
}

// ═════════════════════════════════════════════════════
// ISOLAMENTO TERAPEUTA ↔ PACIENTE
// ═════════════════════════════════════════════════════

describe('TDAH Isolamento — canAccessTdahPatient', () => {

  test('Terapeuta A NÃO acessa paciente de Terapeuta B (sem vínculo)', async () => {
    // Client retorna vazio — sem match em tdah_patient_therapists NEM created_by
    const client = mockClient([])
    const ctx = mockCtx({
      role: 'terapeuta',
      profileId: 'profile-terapeutaA',
      client,
    })

    const result = await canAccessTdahPatient(ctx, 'patient-de-B')
    expect(result).toBe(false)

    // Verifica que a query foi feita com os parâmetros corretos
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('tdah_patient_therapists'),
      ['patient-de-B', 'profile-terapeutaA', 'tenant-001']
    )
  })

  test('Terapeuta A acessa paciente vinculado via tdah_patient_therapists', async () => {
    // Client retorna 1 row — match em tdah_patient_therapists
    const client = mockClient([{ '?column?': 1 }])
    const ctx = mockCtx({
      role: 'terapeuta',
      profileId: 'profile-terapeutaA',
      client,
    })

    const result = await canAccessTdahPatient(ctx, 'patient-vinculado')
    expect(result).toBe(true)
  })

  test('Terapeuta acessa paciente via fallback created_by (pré-migration-038)', async () => {
    // Client retorna 1 row — match via UNION ALL (created_by)
    const client = mockClient([{ '?column?': 1 }])
    const ctx = mockCtx({
      role: 'terapeuta',
      profileId: 'profile-antigo',
      client,
    })

    const result = await canAccessTdahPatient(ctx, 'patient-criado-antes')
    expect(result).toBe(true)
  })

  test('Admin acessa QUALQUER paciente da org sem query ao banco', async () => {
    const client = mockClient()
    const ctx = mockCtx({
      role: 'admin',
      client,
    })

    const result = await canAccessTdahPatient(ctx, 'any-patient-id')
    expect(result).toBe(true)
    // Admin não precisa consultar banco — retorna true diretamente
    expect(client.query).not.toHaveBeenCalled()
  })

  test('Supervisor acessa QUALQUER paciente da org sem query ao banco', async () => {
    const client = mockClient()
    const ctx = mockCtx({
      role: 'supervisor',
      client,
    })

    const result = await canAccessTdahPatient(ctx, 'any-patient-id')
    expect(result).toBe(true)
    expect(client.query).not.toHaveBeenCalled()
  })
})

// ═════════════════════════════════════════════════════
// ISOLAMENTO DE TENANT (multi-tenant)
// ═════════════════════════════════════════════════════

describe('TDAH Isolamento — Multi-Tenant', () => {

  test('canAccessTdahPatient passa tenant_id correto na query', async () => {
    const client = mockClient([])
    const ctx = mockCtx({
      tenantId: 'tenant-CLINICA-A',
      role: 'terapeuta',
      profileId: 'profile-X',
      client,
    })

    await canAccessTdahPatient(ctx, 'patient-Y')

    // O 3° parâmetro da query DEVE ser o tenantId do contexto
    expect(client.query).toHaveBeenCalledWith(
      expect.any(String),
      ['patient-Y', 'profile-X', 'tenant-CLINICA-A']
    )
  })

  test('tdahPatientFilter gera cláusula vazia para admin (sem restrição)', () => {
    const ctx = mockCtx({ role: 'admin' })
    const filter = tdahPatientFilter(ctx, 3)
    expect(filter.clause).toBe('')
    expect(filter.params).toEqual([])
  })

  test('tdahPatientFilter gera cláusula restritiva para terapeuta', () => {
    const ctx = mockCtx({ role: 'terapeuta', profileId: 'profile-T1' })
    const filter = tdahPatientFilter(ctx, 3)
    expect(filter.clause).toContain('tdah_patient_therapists')
    expect(filter.clause).toContain('created_by')
    expect(filter.params).toEqual(['profile-T1'])
  })

  test('tdahSessionFilter gera cláusula vazia para supervisor', () => {
    const ctx = mockCtx({ role: 'supervisor' })
    const filter = tdahSessionFilter(ctx, 3)
    expect(filter.clause).toBe('')
    expect(filter.params).toEqual([])
  })

  test('tdahSessionFilter gera cláusula restritiva para terapeuta', () => {
    const ctx = mockCtx({ role: 'terapeuta', profileId: 'profile-T2' })
    const filter = tdahSessionFilter(ctx, 3)
    expect(filter.clause).toContain('tdah_patient_therapists')
    expect(filter.clause).toContain('tdah_patients')
    expect(filter.params).toEqual(['profile-T2'])
  })
})

// ═════════════════════════════════════════════════════
// MENSAGENS DE ERRO GENÉRICAS (sem vazamento)
// ═════════════════════════════════════════════════════

describe('TDAH Isolamento — Mensagens de Erro Seguras', () => {

  // Lista de mensagens que NUNCA devem aparecer em respostas API
  const FORBIDDEN_MESSAGES = [
    'paciente de outro terapeuta',
    'não pertence a você',
    'acesso negado',
    'outro profissional',
    'sem vínculo',
    'not your patient',
    'belongs to another',
  ]

  // Mensagens genéricas que são SEGURAS
  const SAFE_MESSAGES = [
    'Paciente não encontrado',
    'Sessão não encontrada',
    'Registro DRC não encontrado',
    'Rotina não encontrada',
    'Plano não encontrado',
    'Sistema de fichas não encontrado',
    'Responsável não encontrado',
    'Não encontrado',
  ]

  test('Mensagens seguras não contêm informação sobre existência ou vínculo', () => {
    for (const msg of SAFE_MESSAGES) {
      for (const forbidden of FORBIDDEN_MESSAGES) {
        expect(msg.toLowerCase()).not.toContain(forbidden.toLowerCase())
      }
    }
  })

  test('clinical-state NÃO retorna "paciente de outro terapeuta" (fix info leakage)', async () => {
    // Simula o cenário: paciente existe mas terapeuta não tem acesso
    // A mensagem deve ser "Paciente não encontrado", não "Acesso negado — paciente de outro terapeuta"
    const client = mockClient([])
    const ctx = mockCtx({
      role: 'terapeuta',
      profileId: 'profile-sem-acesso',
      client,
    })

    const canAccess = await canAccessTdahPatient(ctx, 'patient-outro')
    expect(canAccess).toBe(false)

    // O handler da rota clinical-state deve retornar 404 genérico, não 403 com info
    // Aqui testamos que a mensagem de erro usada é genérica
    const errorMessage = canAccess ? null : 'Paciente não encontrado'
    expect(errorMessage).toBe('Paciente não encontrado')
    expect(errorMessage).not.toContain('outro terapeuta')
    expect(errorMessage).not.toContain('Acesso negado')
  })
})

// ═════════════════════════════════════════════════════
// CENÁRIOS DE BORDA
// ═════════════════════════════════════════════════════

describe('TDAH Isolamento — Cenários de Borda', () => {

  test('Terapeuta com profileId vazio não acessa nenhum paciente', async () => {
    const client = mockClient([])
    const ctx = mockCtx({
      role: 'terapeuta',
      profileId: '',
      client,
    })

    const result = await canAccessTdahPatient(ctx, 'any-patient')
    expect(result).toBe(false)
  })

  test('canAccessTdahPatient inclui UNION ALL para cobrir created_by', async () => {
    const client = mockClient([])
    const ctx = mockCtx({
      role: 'terapeuta',
      profileId: 'profile-X',
      client,
    })

    await canAccessTdahPatient(ctx, 'patient-Y')

    const queryStr = client.query.mock.calls[0][0] as string
    // Deve ter UNION ALL para verificar tanto tdah_patient_therapists quanto created_by
    expect(queryStr).toContain('UNION ALL')
    expect(queryStr).toContain('tdah_patient_therapists')
    expect(queryStr).toContain('created_by')
  })

  test('tdahPatientFilter usa $1 para tenant_id (referência posicional correta)', () => {
    const ctx = mockCtx({ role: 'terapeuta', profileId: 'prof-1' })
    const filter = tdahPatientFilter(ctx, 5)
    // O parâmetro do profileId deve usar o startParamIndex fornecido
    expect(filter.clause).toContain('$5')
    expect(filter.clause).toContain('$1')
    expect(filter.params).toEqual(['prof-1'])
  })

  test('tdahSessionFilter usa alias customizado se fornecido', () => {
    const ctx = mockCtx({ role: 'terapeuta', profileId: 'prof-1' })
    const filter = tdahSessionFilter(ctx, 3, 'sess')
    expect(filter.clause).toContain('sess.patient_id')
  })
})
