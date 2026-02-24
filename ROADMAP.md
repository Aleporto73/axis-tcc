# AXIS ABA — ROADMAP COMPLETO
## Atualizado: 23/02/2026

## ESTADO ATUAL

| Area | Status |
|---|---|
| Motor CSO-ABA | 100% |
| Schema/Triggers | 95% |
| UI funcional | 85% |
| UI polida | 85% |
| Features completas | 50% |
| Production-ready | 30% |
| Comercial | 10% |

## COMPLETADO HOJE (23/02)

- Logo AXIS no PDF
- Status pt-BR no relatorio
- Banda CSO com acento
- Alta parcial X/Y criterios
- PDF com acentos
- EBP 28 praticas no modal sessao
- Empty states melhorados
- PEI tela completa + API + dados demo + sidebar
- 3 narrativas demo (Joao Paulo, Laura, Miguel)
- Grafico evolucao CSO (SVG inline)
- Alertas regressao no dashboard + API
- Limpeza dados teste + acentos dominios

## FASE 2 — Funcionalidades (1-2 semanas)

1. Portal do Responsavel (login, evolucao, assinatura) — 2-3 dias — ALTA
2. Notificacoes (lembrete sessao, sonda, regressao) — 1 dia — MEDIA
3. Dashboard ABA completo (KPIs, metricas) — 1 dia — MEDIA
4. Graficos no PDF (CSO embutido) — 0.5 dia — MEDIA
5. Vinculo PEI-Protocolo pela UI — 0.5 dia — ALTA
6. Modal protocolo no aprendiz - fix EBP select — 15min — QUICK FIX
7. Tela de Generalizacao — 1 dia — MEDIA
8. Tela de Manutencao/Sondas — 0.5 dia — MEDIA

## FASE 3 — Producao (2-3 semanas)

9. Multi-terapeuta (roles, permissoes) — 2-3 dias — ALTA
10. LGPD compliance — 2 dias — ALTA
11. Backup automatizado — 0.5 dia — ALTA
12. Testes automatizados — 2-3 dias — MEDIA
13. Migracao formal schema — 1 dia — MEDIA
14. Performance (indices, cache) — 1 dia — MEDIA
15. Mobile responsivo — 1-2 dias — MEDIA
16. Tratamento de erros robusto — 1 dia — MEDIA

## FASE 4 — Comercial

17. Landing page — 1 dia — ALTA
18. Onboarding clinica (multi-tenant wizard) — 2 dias — ALTA
19. Billing (Stripe) — 2-3 dias — ALTA
20. Dominio proprio por clinica — 0.5 dia — BAIXA
21. Documentacao (manual terapeuta) — 1 dia — MEDIA

## PLANO AMANHA (24/02)

1. Fix modal protocolo aprendiz EBP — 15min
2. Vinculo PEI-Protocolo UI — 30min
3. Grafico CSO no PDF — 30min
4. Dashboard KPIs — 45min
5. Portal Responsavel v1 — 2-3h

## REGRAS CRITICAS

- Tenant: 123e4567-e89b-12d3-a456-426614174000
- Triggers imutabilidade: session_snapshots, clinical_states_aba, report_snapshots
- Bible v2.6.1 transicoes validadas por trigger
- audit_logs: metadata (JSONB), user_id, actor
- learner_protocols usa title nao name
- Import: @/src/database/with-tenant
- Build: cd /root/axis-tcc && npm run next:build && pm2 restart all
- Cor ABA: #C46A2F

## IDS APRENDIZES

- Joao Paulo: be7bb2ec-a4e2-4609-894c-1577655e23df (Nivel 2)
- Laura Oliveira: a2222222-2222-2222-2222-222222222222 (Nivel 2)
- Miguel Santos: a1111111-1111-1111-1111-111111111111 (Nivel 1)
