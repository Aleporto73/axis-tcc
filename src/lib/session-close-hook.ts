// =====================================================
// AXIS ABA - Session Close Hook (v2.7.0 Sprint 1)
//
// Fluxo automático pós-fechamento de sessão:
//   1. Auto-atestação do terapeuta (zero cliques)
//   2. Magic link para atestação do responsável
//   3. Geração do pacote de evidência
//
// Bible v2.7.0:
//   - Terapeuta: attestation_method=system_login, auto-completed
//   - Responsável: magic_link_token, status=pending, prazo 72h
//   - Bundle: coleta todos componentes, gera SHA256 unificado
//   - Tudo é fire-and-forget (não bloqueia o close)
//
// Chamado pelo client após PATCH action=close retornar OK.
// =====================================================

interface SessionCloseHookParams {
  sessionId: string
  therapistName: string
  therapistId?: string
  learnerId: string
}

interface HookResult {
  attestation: boolean
  guardianMagicLink: boolean
  evidenceBundle: boolean
  errors: string[]
}

/**
 * Executa o fluxo pós-fechamento da sessão.
 * Fire-and-forget — erros são coletados mas não bloqueiam.
 */
export async function runSessionCloseHook(
  params: SessionCloseHookParams
): Promise<HookResult> {
  const result: HookResult = {
    attestation: false,
    guardianMagicLink: false,
    evidenceBundle: false,
    errors: [],
  }

  // 1. Auto-atestação do terapeuta
  try {
    const attestRes = await fetch('/api/aba/attestations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: params.sessionId,
        attestor_type: 'therapist',
        attestor_id: params.therapistId || null,
        attestor_name: params.therapistName,
        attestation_method: 'system_login',
      }),
    })
    if (attestRes.ok) {
      result.attestation = true
    } else {
      const data = await attestRes.json()
      result.errors.push(`Atestação terapeuta: ${data.error || 'erro desconhecido'}`)
    }
  } catch (err) {
    result.errors.push('Atestação terapeuta: falha de conexão')
  }

  // 2. Magic link para responsável(is)
  try {
    const guardiansRes = await fetch(`/api/aba/guardians?learner_id=${params.learnerId}`)
    if (guardiansRes.ok) {
      const guardiansData = await guardiansRes.json()
      const guardians = (guardiansData.guardians || []).filter(
        (g: { email: string | null }) => g.email
      )

      for (const guardian of guardians) {
        try {
          const guardianAttestRes = await fetch('/api/aba/attestations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: params.sessionId,
              attestor_type: 'guardian',
              attestor_id: guardian.id,
              attestor_name: guardian.name,
              attestation_method: 'magic_link',
              guardian_email: guardian.email,
              deadline_hours: 72,
            }),
          })
          if (guardianAttestRes.ok) {
            result.guardianMagicLink = true
            // TODO Sprint 2+: enviar email com magic_link via Resend
            // A atestação foi criada com status=pending e magic_link_token
          }
        } catch {
          // Não bloquear — responsável é opcional
        }
      }

      if (guardians.length === 0) {
        // Sem responsáveis com email — não é erro
        result.guardianMagicLink = true
      }
    }
  } catch {
    result.errors.push('Busca de responsáveis: falha de conexão')
  }

  // 3. Gerar pacote de evidência
  try {
    const bundleRes = await fetch('/api/aba/evidence-bundles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: params.sessionId,
        generated_by: 'session_close_hook',
      }),
    })
    if (bundleRes.ok) {
      result.evidenceBundle = true
    } else {
      const data = await bundleRes.json()
      result.errors.push(`Bundle: ${data.error || 'erro desconhecido'}`)
    }
  } catch {
    result.errors.push('Bundle: falha de conexão')
  }

  return result
}
