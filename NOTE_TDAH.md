# NOTE_TDAH.md — Diário de Desenvolvimento

## Documento de Referência
- AXIS_TDAH_BIBLE_v2.5 (baseline congelado)
- PLANO_TDAH.md (arquitetura e fases)

---

## STATUS ATUAL

### ✅ CONCLUÍDO

| Data | Item | Arquivos |
|------|------|----------|
| 13/03/2026 | Motor CSO-TDAH v1.0 | `src/engines/cso-tdah.ts` |
| 13/03/2026 | Testes do motor (71 verdes) | `src/engines/__tests__/cso-tdah.test.ts` |
| 13/03/2026 | PLANO_TDAH.md | raiz |
| 13/03/2026 | Migration 022 (schema completo) | `scripts/migrations/022_full_tdah_setup.sql` |
| 13/03/2026 | Seed engine_versions CSO-TDAH v1.0.0 | dentro da migration 022 |
| 13/03/2026 | Seed protocol_library (12 P1 + 2 P1.1) | dentro da migration 022 |

### 🔄 EM ANDAMENTO

| Item | Status | Bloqueio |
|------|--------|----------|
| - | - | - |

### ❌ PRÓXIMOS (Fase 1)

| # | Item | Dependência |
|---|------|-------------|
| 1 | Hub card TDAH | - |
| 2 | License gate TDAH | Migration 022 aplicada |

---

## DECISÕES TOMADAS

| Data | Decisão | Impacto |
|------|---------|---------|
| 13/03/2026 | Multi-terapeuta (como ABA) | Arquitetura de perfis e permissões |
| 13/03/2026 | Cor verde (#0d7377) | Branding, UI |
| 13/03/2026 | 3 blocos desde v1.0 | Motor completo desde início |
| 13/03/2026 | Pesos configuráveis via engine_versions | Flexibilidade pós-piloto |

---

## DECISÕES PENDENTES

| # | Decisão | Impacto | Quem decide |
|---|---------|---------|-------------|
| 1 | Logo TDAH (axistdah.png) | Hub, landing | Alê |
| 2 | Pricing TDAH (R$?/mês) | Webhook, modal | Alê |
| 3 | Hotmart product_id TDAH | Webhook | Alê |
| 4 | v1.0 com ou sem módulo escola? | Escopo beta | Alê |
| 5 | v1.0 com ou sem portal família? | Escopo beta | Alê |

---

## LOG DE SESSÕES

### 13/03/2026 — Sessão 1
- Criado motor CSO-TDAH v1.0 (530 linhas, 3 blocos)
- Criados 71 testes (todos passando)
- Criado PLANO_TDAH.md com arquitetura completa
- Decisões: multi-terapeuta, cor verde, 3 blocos, pesos configuráveis
- Push feito

### 13/03/2026 — Sessão 2
- Criada migration 022_full_tdah_setup.sql (726 linhas)
- 5 ENUMs, 14 tabelas, 25 índices, 2 constraints nomeadas
- Seed engine_versions: CSO-TDAH v1.0.0 com pesos JSONB
- Seed protocol_library: 12 P1 + 2 P1.1 candidatos (Bible Anexo B)
- 6 melhorias sobre comando do 4.5: IF NOT EXISTS, sem RLS policy, schema engine_versions correto, colunas úteis extras, seeds completos, tdah_guardians separada
- Aguardando push + aplicação no VPS

---

## REGRAS IMUTÁVEIS (da BIBLE v2.5)

1. Backbone compartilhado. Motor clínico derivado.
2. AuDHD NÃO é produto separado — é layer dentro do TDAH
3. RIG é categórico (4 estados), NUNCA escala linear
4. MSK é campo opcional até validação operacional
5. Snapshot registra estado da layer no momento
6. Desativação de layer preserva histórico (append-only)
7. Missing data NUNCA é tratado como melhora
8. Sessão fechada é imutável
9. Julgamento clínico permanece humano
