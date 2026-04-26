# AXIS — Onda 5.3 Changelog

**Data:** 25/04/2026
**Status:** Staging aplicado e estável. PROD pendente (programado pra 26/04/2026).
**Commit prod target:** TBD (será criado após apply prod)

---

## §1. Resumo executivo

Onda 5.3 removeu o fallback `OR created_by` em 3 helpers TDAH e 1 rota inline, fechando vazamento intra-tenant onde terapeuta podia ver paciente que ele criou mesmo sem vínculo formal em `tdah_patient_therapists`.

**Impacto real em prod:** ZERO usuários afetados. Q9 confirmou: dos 5 leaks "nominais" no banco, 100% têm role=admin (que tem acesso total por outras vias). Zero terapeutas reais com acesso via fallback.

**Patch é virtual:** corrige a classe de bug, não muda comportamento perceptível pra nenhum usuário real.

---

## §2. Patches aplicados (Variante B — LIMIT 1 conservador)

5 arquivos, +75 / -48 linhas, +24 net.

| Patch | Arquivo | Mudança | SHA POS |
|---|---|---|---|
| 1 | `src/database/with-role.ts` | 3 helpers (tdahPatientFilter, tdahSessionFilter, canAccessTdahPatient): remove OR/UNION/UNION ALL com created_by | `b3069b8f0f9719850610862dc6d2b9c8e9227b56c51f234548f9208e9beb6b85` |
| 2 | `app/api/tdah/plans/route.ts` | Inline OR tp.created_by removido | `e4ee943033da3591b50a900f2aba9cbd3a3abf330c01f4945a7ff2bdf10f573f` |
| 3 | `src/tests/tdah-isolation.test.ts` | 4 blocos (2 invertidos + 2 ajustados) | `41a892438c45445743ecb8c77471431e48215f9cd81ca7675000a11040024ed9` |
| 4 | `src/tests/authorization.test.ts` | 3 blocos (1 invertido + 2 ajustados) | `4a1d271cd6bc780a5d0eec6003fa9560e6f1b1acf3902ca6e81129a3e3842fa6` |
| 5 | `docs/MATRIZ_ACESSO_TDAH.md` | Header + tabela role + helpers + Changelog novo | `23cc420d31a80539863deedd90ed412174322b633094225fbb2a05a09d6410fb` |

**Combined patch SHA:** `22fac921f223d6762b52d81e0c5dd03428d7ae7f7d8a168a8be68ac90e0f7f56`

---

## §3. Validação em staging

| Camada | Resultado |
|---|---|
| typecheck (`tsc --noEmit`) | ✅ EXIT=0 |
| vitest focused (tdah-isolation + authorization) | ✅ 72/72 passed |
| vitest full | ✅ 489/489 passed (14 test files) |
| next:build | ✅ Compiled em 38.5s, 154 páginas geradas |
| pm2 restart axis-staging | ✅ online, Ready in 3.4s |
| smoke HTTP /api/health | ✅ 200, db:ok |
| smoke HTTP /api/tdah/* | ⚠️ 404 (comportamento Clerk+Next 16, não regressão — confirmado idêntico em prod sem Onda 5.3) |

**TS_VPS aplicação:** `20260425_100708`
**Backup:** `/root/axis-backups/onda5.3_staging_20260425_100708/`

---

## §4. Decisões registradas

- **D1: Variante B (LIMIT 1 conservador).** `canAccessTdahPatient` mantém `SELECT 1 ... LIMIT 1 + result.rows.length > 0`. Apenas remove o `UNION ALL ... created_by`. Razão: menor superfície de mudança vs Variante A (EXISTS), mantém forma do código atual, eliminou 1 ajuste em test (4 blocos vs 5 da Variante A).
- **D2: Varredura authorization.test.ts antes da proposta consolidada.** Resultou em 3 blocos adicionais (1 invertido + 2 ajustados) que não foram detectados na auditoria v1 inicial.
- **D3: docs/NOTE_TDAH.md NÃO entra na Onda 5.3.** Vai pra Item 15 do backlog Onda 7. Razão: escopo da onda restrito a MATRIZ_ACESSO_TDAH.md.
- **Sem pre-patch / sem cleanup retroativo.** Q9 confirmou zero terapeutas com leak ativo. Patch é virtual em prod.

---

## §5. Surpresas e aprendizados desta sessão

1. **Mirror local desatualizado:** branch staging local em HEAD `6454407` (20/04, pré-Onda 1). VPS staging idêntico (também `6454407`) com 13 modificações M não-commitadas correspondentes às Ondas 1-4 aplicadas manualmente. Reconciliação pendente — Item 13 do backlog.
2. **3 migrations órfãs no mirror:** 054 (transcripts_audio_duration), 055 (drop_profiles_cpf, JÁ APLICADA em staging+prod), 056 (create_orphan_tables). Conteúdo de 054/056 não inspecionado nesta sessão — Item 14 do backlog. Migration 055 confirmada como aplicada via `psql \d profiles` — Item 16 do backlog (housekeeping: commit em origin/main).
3. **Bug colateral team/route.ts UUID=TEXT:** JOIN `pc.created_by = p.clerk_user_id` compara UUID com TEXT, contadores zerados na UI admin TDAH "Equipe". Não é regressão da Onda 5.3, foi descoberto durante auditoria. Item 12 do backlog.
4. **Comportamento Clerk + Next 16:** rotas autenticadas retornam HTML 404 sem cookie de sessão (não JSON 401 como esperado). Validado em staging E prod (mesmo comportamento). Não é regressão, é o framework. Documentado nas Notas operacionais do backlog Onda 7.
5. **Ambiente CC do chat novo é Cowork sandboxed:** sem SSH allowlisted ao VPS Contabo. Forçou Modelo A (CC edita mirror local + Alê executa no VPS via copy-paste). Round-trip extra mas mantém Alê no controle (apropriado pra dados clínicos LGPD).
6. **Validação SHA cruzada mirror↔VPS:** introduzida nesta onda. Cada arquivo tem SHA PRE/POS conferido em ambos os lados. Padrão a manter nas próximas ondas.

---

## §6. Status final

- ✅ Mirror local: 5 patches aplicados
- ✅ VPS staging: 5 patches aplicados, validados em 5 camadas (typecheck, vitest, build, runtime, smoke HTTP)
- 🟡 VPS prod: INTOCADA, HEAD `9dd7bbf` (Onda 4)
- 🟡 Commit/push origin/main: NÃO feito ainda
- ✅ Backlog Onda 7: criado com 16 itens (5 novos da sessão + 11 do handoff Onda 4)

---

## §7. Próximos passos

1. **PROD apply (programado 26/04/2026):**
   - Backup `/root/axis-backups/onda5.3_prod_<TS>/`
   - `git apply` dos 5 patches em `/root/axis-tcc/`
   - Pré-flight: typecheck + vitest full + build
   - `pm2 restart axis-tcc axis-worker-transcribe`
   - Smoke HTTP /api/health
2. **Commit + push origin/main** (mensagem já preparada no plano consolidado da Onda 5.3 §6.1).
3. **Item 13 (reconciliação staging):** após prod fechar, `git checkout .` + `git pull origin main` no `/root/axis-tcc-staging/`.
4. **Item 16 (commit migration 055):** junto com reconciliação Item 13.
5. **Demais itens backlog Onda 7:** quando fizer sentido (P1 primeiro).
