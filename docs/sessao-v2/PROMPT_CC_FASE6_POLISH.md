# PROMPT CC — AXIS TCC Sessão v2 — FASE 6: Polish Final

## CONTEXTO

FASES 1-5 concluídas. Tudo funcional. Agora: refinamento de UX e teste final.

**Projeto:** `/root/axis-tcc`

---

## PASSO 1 — Tooltips explicativos

Adicionar `title` (tooltip nativo) nos seguintes elementos:

| Componente | Elemento | Tooltip |
|------------|----------|---------|
| ClinicalReport | Header "Relatório Clínico" | "Relatório narrativo gerado por IA a partir da transcrição. Editável e exportável em PDF." |
| ClinicalReport | Badge "DRAFT" | "Rascunho — ainda não aprovado pelo profissional" |
| ClinicalReport | Badge "FINAL" | "Aprovado pelo profissional" |
| ClinicalReport | Botão "Regenerar" | "Gerar novamente usando IA. O conteúdo atual será substituído." |
| SignalsPreview | Container | "Indicadores-chave extraídos automaticamente desta sessão" |
| InsightsPanel | Header "Insights AXIS" | "Análise inteligente extraída da transcrição. Diferencial exclusivo AXIS." |
| InsightsPanel | Seção "Sugestões próxima sessão" | "Baseado nos padrões observados nesta e em sessões anteriores" |
| AnalyticalStructure | Header | "Dados extraídos pela IA a partir da transcrição. Útil para revisão detalhada ou supervisão." |

---

## PASSO 2 — Loading states com skeleton

Verificar que os seguintes estados de loading usam skeleton (não spinner):

1. **ClinicalReport gerando:** 5 blocos retangulares cinza pulsando (`animate-pulse bg-slate-200 rounded`)
2. **ClinicalReport salvando:** botão disabled + texto "Salvando..."
3. **ClinicalReport exportando PDF:** botão disabled + texto "Gerando PDF..."
4. **InsightsPanel carregando:** 3 linhas skeleton dentro do accordion

Se algum usa spinner (`animate-spin border-...`), trocar para skeleton.

---

## PASSO 3 — Mensagem de segurança

Verificar que o footer está presente em TODOS os estados do ClinicalReport (draft e final):

```
"Relatório assistido por IA — conteúdo revisado e aprovado pelo profissional responsável"
```

- Estilo: `text-xs text-slate-400 italic`
- Posição: abaixo dos campos, acima dos botões
- Sempre visível (não esconder em modo edição)

---

## PASSO 4 — Auditoria

Adicionar audit log nas ações críticas (usar o padrão existente — verificar como `SessionReport.tsx` faz):

```typescript
// Após gerar relatório
fetch('/api/audit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'REPORT_GENERATE',
    entity_type: 'session_report',
    entity_id: reportId,
    metadata: { session_id: sessionId, ai_model: 'gpt-4o-mini' }
  })
})

// Após salvar edição
action: 'REPORT_EDIT'

// Após aprovar (draft → final)
action: 'REPORT_APPROVE'

// Após exportar PDF
action: 'REPORT_EXPORT'
```

---

## PASSO 5 — Build final + teste end-to-end

```bash
cd /root/axis-tcc && npm run next:build 2>&1 | tail -20
```

Build OK → `pm2 restart axis-tcc`

**Teste end-to-end completo (me confirme cada item):**

1. ☐ Abrir sessão SEM transcrição → botão "Gerar Relatório" NÃO aparece
2. ☐ Fazer upload de áudio → transcrição aparece
3. ☐ Clicar "Analisar TCC" → fatos/pensamentos/emoções aparecem em "Ver estrutura da análise"
4. ☐ Clicar "Gerar Relatório" → loading skeleton → relatório aparece com headline + 5 campos
5. ☐ Headline: se não vazio, aparece no topo. Se vazio, aparece "+ Adicionar insight principal"
6. ☐ Preview de sinais: chips visíveis com thresholds respeitados
7. ☐ Clicar em chip → accordion de Insights abre na seção correspondente
8. ☐ Insights panel: emoções, tópicos, distorções, técnicas usadas, técnicas sugeridas
9. ☐ Clicar "Editar" → campos viram textarea → editar headline e resumo
10. ☐ Clicar "Salvar" → dados persistem (recarregar página e conferir)
11. ☐ Clicar "Aprovar" → status muda para FINAL (badge verde)
12. ☐ Clicar "Exportar PDF" → PDF baixa com acentos corretos e layout limpo
13. ☐ Pipeline Result NÃO aparece em nenhum lugar da UI
14. ☐ Marcar micro-eventos → aparecem no accordion de Insights
15. ☐ Finalizar sessão → CSO roda normalmente (verificar logs)

Me confirme cada item com ✅ ou ❌.

---

## PASSO 6 — CI/Testes

```bash
cd /root/axis-tcc && npm test 2>&1 | tail -20
```

Se houver testes falhando por causa das mudanças, ajustar.
Target: manter o score 480+ testes passando.

Me mostre o output.
