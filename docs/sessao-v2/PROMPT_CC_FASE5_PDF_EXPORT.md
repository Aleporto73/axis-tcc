# PROMPT CC — AXIS TCC Sessão v2 — FASE 5: Exportação PDF

## CONTEXTO

FASES 1-4 concluídas. Tudo funcionando. Agora: exportar relatório clínico como PDF.

**Projeto:** `/root/axis-tcc`
**Referência:** O projeto já tem experiência com PDF (relatório longitudinal usa jsPDF ou similar). Verificar qual lib já está instalada.

---

## PASSO 1 — Verificar lib PDF existente

```bash
grep -r "jspdf\|pdfkit\|puppeteer\|@react-pdf\|html2pdf\|pdfmake" /root/axis-tcc/package.json
```

Me mostre o resultado. Vamos usar a lib que já está no projeto.

---

## PASSO 2 — API POST /api/sessions/[id]/report/export-pdf

Criar arquivo: `app/api/sessions/[id]/report/export-pdf/route.ts`

**Fluxo:**
1. `withTenant()` → verificar sessão pertence ao tenant
2. Buscar `session_reports` WHERE session_id
3. Se não existe ou status = 'draft' → retornar erro 400 "Relatório precisa estar aprovado"
   - **DECISÃO:** permitir exportar draft também? Se sim, remover essa regra. Recomendo permitir draft e final.
4. Buscar dados do profissional (nome, CRP) da tabela `tenants`
5. Buscar dados do paciente (nome) da tabela `patients` via `sessions`
6. Buscar dados da sessão (data, número, duração, tipo)
7. Gerar PDF com template abaixo
8. Atualizar `exported_at = NOW()` e `export_count = export_count + 1`
9. Retornar PDF como response com `Content-Type: application/pdf`

**Template do PDF:**

```
═══════════════════════════════════════════════
  AXIS Clínico — Relatório de Sessão
═══════════════════════════════════════════════

Profissional: {nome_profissional}
CRP: {crp}/{crp_uf}

───────────────────────────────────────────────

Paciente: {nome_paciente}
Sessão: #{numero} — {data}
Duração: {duracao} minutos
Modalidade: {tipo}

═══════════════════════════════════════════════

{headline}  ← (se não vazio, em destaque/bold)

1. OBJETIVOS DA SESSÃO
{objectives}

2. RESUMO
{summary}

3. INTERVENÇÃO DO PSICÓLOGO
{intervention}

4. OBSERVAÇÕES CLÍNICAS
{observations}

5. ENCERRAMENTO / TAREFA DE CASA
{closing}

═══════════════════════════════════════════════

Relatório assistido por IA — conteúdo revisado 
e aprovado pelo profissional responsável.

Exportado em: {data_exportacao}
AXIS Clínico — axisclinico.com
═══════════════════════════════════════════════
```

**Regras do PDF:**
- A4 (210 x 297 mm)
- Fonte: DejaVu Sans (já existe no projeto para suporte a acentos PT-BR — verificar em `/root/axis-tcc/fonts/` ou similar)
- Se DejaVu Sans não estiver disponível, usar Helvetica
- Margens: 20mm
- Headline em bold, tamanho 14
- Títulos de seção em bold, tamanho 11
- Texto em regular, tamanho 10
- Rodapé em italic, tamanho 8
- NÃO incluir insights, distorções, técnicas, CSO — apenas o relatório narrativo

---

## PASSO 3 — Botão Exportar no frontend

No componente `ClinicalReport.tsx`, o botão "Exportar PDF" já deveria estar previsto.

Verificar se está implementado. Se não:
- Adicionar botão com ícone Lucide `Download`
- onClick: `fetch POST /api/sessions/${sessionId}/report/export-pdf`
- Receber blob → criar URL → trigger download
- Nome do arquivo: `relatorio_sessao_{numero}_{data}.pdf`

```typescript
const exportPDF = async () => {
  const res = await fetch(`/api/sessions/${sessionId}/report/export-pdf`, { method: 'POST' })
  if (!res.ok) { alert('Erro ao exportar'); return }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `relatorio_sessao_${sessionNumber}_${sessionDate}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
```

---

## PASSO 4 — Build + teste

```bash
cd /root/axis-tcc && npm run next:build 2>&1 | tail -20
```

Build OK → `pm2 restart axis-tcc`

**Teste:**
1. Abrir sessão com relatório salvo
2. Clicar "Exportar PDF"
3. Verificar que PDF baixa com:
   - Acentos PT-BR corretos
   - Layout limpo
   - Sem insights/CSO/pipeline
   - Rodapé com disclaimer IA

Me mostre print do PDF gerado ou confirme os 4 itens.
