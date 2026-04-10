# Migration Gaps — Documentação

Arquivos de migração seguem numeração sequencial: `001_`, `002_`, ..., `048_`.

## Gaps identificados

| Número | Status | Motivo |
|--------|--------|--------|
| 008 | Ausente | Removido durante consolidação de migrações (pré-007 full repair) |
| 009 | Ausente | Removido durante consolidação de migrações (pré-007 full repair) |
| 010 | Ausente | Removido durante consolidação de migrações (pré-007 full repair) |
| 041 | Ausente | Removido/pulado durante desenvolvimento (entre 040_system_alerts e 042_aba_domain_functions) |

## Regra

Gaps de numeração NÃO afetam a execução. As migrações são aplicadas manualmente em ordem.
Novos arquivos devem continuar a partir do último número existente (atualmente 048).

## Próxima migração disponível: 049

---

Documentado em: 2026-04-10
