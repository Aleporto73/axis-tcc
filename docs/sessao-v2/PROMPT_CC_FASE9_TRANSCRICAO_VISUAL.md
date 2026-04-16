# FASE 9 — TRANSCRIÇÃO VISUAL PREMIUM (AXIS TCC)

## CONTEXTO
Uma cliente comparou o AXIS com concorrente e mencionou a transcrição
como problema (parede de texto, parece amadora). Esta fase resolve a
primeira impressão visual da transcrição sem quebrar a essência do produto.

## REGRA GERAL — NÃO FAZER ANTES DE CONFIRMAR
Leia este documento inteiro ANTES de tocar em qualquer arquivo.
Quando terminar de ler, responda: "Lido. Posso começar?" e AGUARDE
minha aprovação antes de rodar qualquer comando.

NÃO commitar, NÃO fazer push, NÃO rodar build sem eu dizer "vai".

---

## OBJETIVO

Transformar a tela de transcrição de parede de texto corrida em
blocos legíveis por segmento, com timestamps e estrutura visual
profissional. Adicionar abas para navegação entre Transcrição,
Relatório e Anotações.

---

## PRÉ-CHECK (rodar antes de começar)

Confirmar o número correto da migration e o path do worker:

```bash
ls /root/axis-tcc/scripts/migrations/ | tail -5
ls /root/axis-tcc/scripts/workers/ 2>/dev/null || ls /root/axis-tcc/src/workers/ 2>/dev/null
```

**Regra:**
- Se a última migration for 049 → usar **050** nesta fase
- Se já houver 050 em uso → usar **051**
- Se o worker estiver em caminho diferente de `scripts/workers/transcribe-worker.ts` → adaptar o path

Me reportar o resultado do pré-check antes de avançar.

---

## NOTA SOBRE IDENTIFICAÇÃO DE FALAS

Nesta fase **NÃO** haverá identificação "T:" / "P:" (terapeuta/paciente).
O psicólogo distingue pelas falas pelo contexto. Motivo:

- Diarização real exige lib adicional (pyannote.audio) e CPU pesada
- Hoje a transcrição de 50min já leva 20-30min — adicionar diarização pode dobrar esse tempo
- Risco de UX ruim (usuário esperando mais)

Se isso gerar feedback negativo em produção, reabrir discussão de
diarização como Fase 12+ experimental.

---

## O QUE ENTREGAR

### 1. Armazenamento de segments do faster-whisper

**Problema atual:** o faster-whisper retorna `segments` com timestamps
(start, end, text) mas o worker descarta essa estrutura e salva só o
texto concatenado em `transcripts.text`.

**Fix:** armazenar os segments no banco.

Criar migration `050_transcript_segments.sql` (ou 051 se 050 já existir):

```sql
CREATE TABLE IF NOT EXISTS transcript_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id UUID NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  segment_index INTEGER NOT NULL,
  start_seconds NUMERIC(10,3) NOT NULL,
  end_seconds NUMERIC(10,3) NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_transcript_segments_transcript
  ON transcript_segments(transcript_id, segment_index);
CREATE INDEX idx_transcript_segments_tenant
  ON transcript_segments(tenant_id);

ALTER TABLE transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_segments FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON transcript_segments
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY worker_access ON transcript_segments
  USING (current_setting('app.worker_mode', true) = 'true')
  WITH CHECK (current_setting('app.worker_mode', true) = 'true');
```

### 2. Atualizar worker para gravar segments

Arquivo provável: `scripts/workers/transcribe-worker.ts` 
(confirmar no pré-check antes de mexer)

Onde hoje salva só o texto concatenado, adicionar INSERT em lote
dos segments retornados pelo faster-whisper.

Pseudo:

```javascript
// depois de criar o transcript
const segments = asrResponse.segments; // já vem do faster-whisper
if (segments && segments.length > 0) {
  const values = segments.map((s, idx) => [
    transcriptId, tenantId, idx, s.start, s.end, s.text.trim()
  ]);
  // INSERT em batch via pg-format ou unnest
}
```

**Importante:**
- NÃO mexer na lógica do ASR worker em si
- NÃO mexer no pós-processamento (SAFE_CORRECTIONS)
- Só ADICIONAR o salvamento dos segments
- Se o INSERT dos segments falhar, NÃO deve quebrar o job
  (try/catch e log, mas job continua como completed)

### 3. Endpoint para buscar segments

Criar rota `GET /api/transcribe/segments/[transcriptId]`

Padrão: `withTenant()` (conforme matriz de acesso)

Retorna:

```json
{
  "segments": [
    { "index": 0, "start": 0.0, "end": 3.2, "text": "..." },
    { "index": 1, "start": 3.2, "end": 8.7, "text": "..." }
  ]
}
```

Se não houver segments salvos (transcrição antiga), retornar array
vazio e o frontend fará fallback para o texto plano.

### 4. Componente TranscriptView.tsx

Localização: `app/sessoes/[id]/components/TranscriptView.tsx`

Props:
- `transcriptId: string`
- `fallbackText?: string` (quando não houver segments)

Comportamento:
1. Ao montar, buscar `/api/transcribe/segments/[transcriptId]`
2. Se retornar segments → renderizar em blocos
3. Se retornar vazio → renderizar `fallbackText` como parágrafo único

Visual dos blocos (agrupamento de 30 em 30 segundos):

```
00:18:00  ────────────────────────────────────────
│ Ela gosta muito de ver televisão, eu também amo
│ ver televisão, e a gente vê séries juntas, né?
│
│ A gente joga aqueles joguinhos lá que eu sempre
│ confundo os jogos pra ela, ela adora.

00:18:30  ────────────────────────────────────────
│ Arrumava ouça, ah, me ajuda a estender roupa,
│ para arrumar a cama dela, e tal.
```

Classes Tailwind:
- Container: `space-y-6`
- Timestamp: `flex items-center gap-3 text-xs text-slate-500 font-mono`
- Linha separadora: `flex-1 border-t border-slate-200`
- Bloco de texto: `border-l-2 border-slate-200 pl-4 space-y-2 text-sm text-slate-700 leading-relaxed`
- Cada parágrafo (segment): `block`

Formato do timestamp: HH:MM:SS (não mostrar milissegundos).
Helper `formatTime(seconds)` já deve existir no projeto; se não, criar.

Agrupamento de 30 em 30 segundos:
- Todos os segments cujo `start` cai no mesmo bloco de 30s ficam juntos
- Block 00:00:00 = segments com start em [0, 30)
- Block 00:00:30 = segments com start em [30, 60)
- Block 00:01:00 = segments com start em [60, 90)
- etc.

### 5. Abas na página da sessão

Arquivo: `app/sessoes/[id]/page.tsx`

Adicionar componente Tabs com 3 abas:
- **Transcrição** (default quando existe transcrição)
- **Relatório** (default quando NÃO existe transcrição)
- **Anotações**

Regras de default:
- Se sessão tem transcrição completa → abre em "Transcrição"
- Se sessão não tem transcrição → abre em "Relatório"
- Se usuário já estava em outra aba → manter (localStorage por sessionId)

Visual:
- Tabs horizontais no topo do conteúdo da sessão
- Tab ativa: `border-b-2 border-[cor-tcc] text-slate-900 font-medium`
- Tab inativa: `text-slate-500 hover:text-slate-700`
- Gap entre tabs: `gap-6`
- Padding vertical: `py-3`

Conteúdo de cada aba:
- **Transcrição:** componente `TranscriptView` (novo)
- **Relatório:** tudo que já existe hoje (ClinicalReport + InsightsPanel + estrutura analítica colapsada)
- **Anotações:** componente `NotesEditor` (se já existe); se não existir, criar placeholder "Funcionalidade em breve"

### 6. NÃO FAZER NESTA FASE

- ❌ Ícone de balão 💬 por fala (decisão: não imitar o concorrente)
- ❌ Indicador "Neutralidade %" (decisão: cosmético sem ancoragem clínica)
- ❌ Highlight regex de palavras-chave (Fase 12+ experimental)
- ❌ Diarização T: / P: (ver NOTA SOBRE IDENTIFICAÇÃO DE FALAS acima)
- ❌ Export PDF da transcrição (já existe do relatório)

---

## CHECKLIST DE EXECUÇÃO

**Pré-check (imediato):**
0. [ ] Rodar comandos de pré-check e reportar resultado

**Fase A — Backend (depois da minha aprovação):**
1. [ ] Criar migration (050 ou 051 conforme pré-check) e aplicar no banco
2. [ ] Atualizar worker para salvar segments (path confirmado no pré-check)
3. [ ] Criar rota GET /api/transcribe/segments/[transcriptId]
4. [ ] Testar com uma transcrição existente (deve retornar array vazio)
5. [ ] Gerar uma transcrição nova e testar (deve retornar segments)

**CHECKPOINT A:** me manda o resultado antes de seguir.

**Fase B — Frontend (depois do checkpoint A):**
6. [ ] Criar TranscriptView.tsx com fallback
7. [ ] Integrar em /sessoes/[id] com Tabs
8. [ ] Testar com sessão antiga (fallback texto plano)
9. [ ] Testar com sessão nova (blocos por 30s)
10. [ ] Build local + validar que nada quebrou

**CHECKPOINT B:** me manda screenshot da tela antes de deploy.

**Fase C — Deploy (depois do checkpoint B):**
11. [ ] git add + commit + push (mensagem: "feat(tcc): Fase 9 - transcrição visual com segments e abas")
12. [ ] Na VPS: git pull && rm -rf .next && npm run next:build && pm2 restart all
13. [ ] Validar em produção com sessão real

---

## FALLBACKS OBRIGATÓRIOS

| Situação | Comportamento |
|---|---|
| Transcript sem segments salvos (legado) | Mostra texto plano em parágrafo único dentro do mesmo visual (border-left) |
| Segments com erro de parsing | Loga erro, cai no fallback texto plano |
| Transcript vazio | "Esta sessão não tem transcrição" centralizado |
| Erro na rota /segments | Cai no fallback com texto plano, não bloqueia a tela |

---

## REGRA DE OURO

Se qualquer passo quebrar algo que já funciona em produção
(análise TCC, relatório, insights, export PDF), REVERTER
imediatamente e me avisar. Não empilhar tentativas de fix
em cima de bug introduzido nesta fase.

---

Quando terminar de ler, responde: "Lido. Posso começar?"
