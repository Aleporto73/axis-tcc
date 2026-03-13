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

### 🔄 EM ANDAMENTO

| Item | Status | Bloqueio |
|------|--------|----------|
| - | - | - |

### ❌ PRÓXIMOS (Fase 1)

| # | Item | Dependência |
|---|------|-------------|
| 1 | Migration 022 (schema TDAH) | - |
| 2 | Seed engine_versions (CSO-TDAH v1.0.0) | Migration 022 |
| 3 | Seed protocol_library TDAH (12 P1) | Migration 022 |
| 4 | Hub card TDAH | - |
| 5 | License gate TDAH | Migration 022 |

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
