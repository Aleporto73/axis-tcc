# PLANO FINAL: Transcrição Assíncrona com Background Worker

**Data:** 2026-03-30
**Autor:** Claude Opus 4.6
**Status:** PARA APROVAÇÃO — v3 final

---

## Objetivo

Eliminar o processamento síncrono da transcrição no request HTTP. O profissional envia o áudio, recebe confirmação em < 1 segundo, e pode fechar a aba, navegar, deslogar. A transcrição acontece em background e aparece automaticamente quando pronta.

---

## Regras obrigatórias

- Não usar Redis agora
- Não usar BullMQ agora
- Não manter ASR dentro da rota HTTP
- Não depender da aba aberta
- Não depender do usuário permanecer logado
- Cada fase = 1 commit separado
- Manter compatibilidade com transcrições legadas (coluna `text`)
- Banco = índice/metadados. Disco = conteúdo pesado
- Polling: 5 segundos
- Limite FREE: 50 minutos (backend e frontend)
- Recovery de jobs travados: 20 minutos (baseado em heartbeat)
- Sem progresso falso (não simular 35%, 62% — usar estados reais)
- Máximo 1 job ativo por session_id
- Endpoint de status NÃO retorna texto completo (separação de responsabilidade)
- Storage paths via variáveis de ambiente (não fixar `/root/...`)
- Backup deve cobrir banco + diretório de transcripts

---

## Diagnóstico do código atual (5 problemas)

1. **Transcrição síncrona** — `POST /api/transcribe` espera o ASR terminar (até 30 min) antes de responder. Profissional fica preso.

2. **GET /api/sessions/[id] não retorna transcript** — A rota retorna apenas dados da sessão. O frontend tenta `data.transcript` mas sempre recebe `undefined`. Ao recarregar a página, a transcrição desaparece.

3. **Frontend tem código morto de SSE** — 50 linhas parseando `text/event-stream` que o backend não manda mais. Código morto.

4. **Áudio não é persistido** — Se o ASR falhar, o áudio é perdido. Sem retry possível.

5. **Limite FREE inconsistente** — Backend: 50 min. Frontend modal: 120 min.

---

## Arquitetura

```
ANTES (síncrono, bloqueante):
  Upload → transcribeLocal() [espera 10+ min] → INSERT text no banco → JSON

DEPOIS (assíncrono, banco leve):
  Upload → salva áudio em disco → INSERT job "pending" → JSON imediato (< 1s)
  Worker PM2 separado → pega job → transcreve → salva .txt em disco
       → INSERT metadados no banco (preview + path) → job "completed"
  Frontend → polling 5s → mostra estado real → exibe resultado
```

---

## Modelo de storage

| Dado | Onde | Exemplo de path |
|------|------|-----------------|
| Áudio bruto (.webm) | Disco | `$AUDIO_UPLOAD_DIR/{tenant_id}/{job_id}.webm` |
| Transcrição (.txt) | Disco | `$TRANSCRIPT_DIR/{tenant_id}/{transcript_id}.txt` |
| Metadados do job | PostgreSQL | tabela `transcription_jobs` |
| Referência + preview | PostgreSQL | tabela `transcripts` (path + 500 chars) |

**Variáveis de ambiente:**
```
AUDIO_UPLOAD_DIR=/var/lib/axis/audio-uploads
TRANSCRIPT_DIR=/var/lib/axis/transcripts
```

**Política de retenção:**

| Dado | Retenção | Limpeza |
|------|----------|---------|
| Áudio de jobs `completed` | 7 dias | Cron semanal |
| Áudio de jobs `failed` | 30 dias | Cron mensal |
| Transcrição `.txt` | Permanente | — |
| Jobs `completed` antigos no banco | 90 dias | Cron trimestral |

**Backup:** Backup do Postgres sozinho NÃO basta. Backup deve incluir banco + diretório `$TRANSCRIPT_DIR`. Restore precisa preservar coerência dos `transcript_path`.

---

## Entregáveis (13 fases, 13 commits)

---

### FASE 1: Migration 045

**Arquivo:** `scripts/migrations/045_transcription_jobs.sql`

**Cria:**

Tabela `transcription_jobs`:

| Coluna | Tipo | Notas |
|--------|------|-------|
| id | UUID PK | gen_random_uuid() |
| tenant_id | UUID NOT NULL FK | tenants(id) |
| session_id | UUID NOT NULL FK | sessions(id) |
| patient_id | UUID NOT NULL FK | patients(id) |
| status | TEXT NOT NULL | CHECK: pending, processing, completed, failed |
| progress | INTEGER DEFAULT 0 | CHECK: 0-100 |
| audio_path | TEXT NOT NULL | path no disco |
| original_filename | TEXT | nome original do upload |
| file_size_bytes | BIGINT | tamanho do áudio |
| transcript_id | UUID NULL FK | transcripts(id), preenchido ao completar |
| error_message | TEXT | mensagem de erro se failed |
| attempts | INTEGER DEFAULT 0 | tentativas realizadas |
| max_attempts | INTEGER DEFAULT 3 | limite de retries |
| locked_at | TIMESTAMPTZ | quando o worker pegou o job |
| worker_id | TEXT | identificador do worker |
| heartbeat_at | TIMESTAMPTZ | última atualização do worker durante processing |
| created_at | TIMESTAMPTZ DEFAULT NOW() | |
| started_at | TIMESTAMPTZ | quando começou a processar |
| finished_at | TIMESTAMPTZ | quando completou ou falhou |

**Índices:**
- Parcial em `(created_at) WHERE status = 'pending'` — otimizado para a query real do worker (busca apenas pending, ordenado por created_at)
- Parcial em `(locked_at) WHERE status = 'processing'` — para recovery de jobs travados
- Em `(session_id)` — para lookup por sessão

**Constraint de unicidade:**
- Índice parcial UNIQUE em `(session_id) WHERE status IN ('pending','processing')` — garante no máximo 1 job ativo por sessão

**RLS:** tenant_isolation igual às outras tabelas.

**ALTER em transcripts (existente):**
- ADD `transcript_path TEXT` — path do .txt no disco
- ADD `text_preview TEXT` — primeiros 500 chars
- ADD `char_count INTEGER DEFAULT 0` — tamanho total

Coluna `text` existente: NÃO remover. Mantida para compatibilidade com as 3 transcrições de fevereiro.

---

### FASE 2: Módulo `src/services/asr.ts`

Extrair `transcribeLocal()` do `route.ts` atual para módulo importável.

Exporta: `transcribeAudio(audioBuffer: Buffer, filename: string): Promise<string>`

Usa: `undici` com Agent (headersTimeout/bodyTimeout 30 min).

Importado por: worker (Fase 6). A rota HTTP (Fase 4) NÃO importa mais este módulo.

---

### FASE 3: Módulo `src/services/transcript-storage.ts`

Responsável por:
- `saveTranscript(tenantId, transcriptId, text)` → salva .txt, retorna path
- `readTranscript(transcriptPath)` → lê .txt do disco
- `readTranscriptSmart(row)` → se `transcript_path` existe, lê do disco; senão usa `text` legado
- `getPreview(text, maxLength=500)` → gera preview

Paths via `process.env.TRANSCRIPT_DIR`. Cria subdiretório por tenant automaticamente.

---

### FASE 4: Refatorar `POST /api/transcribe`

**Arquivo:** `app/api/transcribe/route.ts`

**Fluxo novo:**
1. Auth (Clerk)
2. Resolver tenant
3. Checar limite FREE (50 min)
4. Receber FormData: audio, session_id, patient_id
5. Verificar se já existe job ativo para esta session_id → se sim, retornar erro
6. Gerar job_id
7. Salvar áudio em disco: `$AUDIO_UPLOAD_DIR/{tenant_id}/{job_id}.webm`
8. INSERT em `transcription_jobs` com status `pending`
9. Responder:

```json
{ "success": true, "job_id": "uuid", "status": "pending" }
```

**NÃO faz:** chamar ASR, esperar transcrição, INSERT em transcripts, incrementar usage.

**Estimativa:** ~90 linhas. Responde em < 1 segundo.

---

### FASE 5: Endpoint `GET /api/transcribe/status/[jobId]`

**Arquivo novo:** `app/api/transcribe/status/[jobId]/route.ts`

Retorna APENAS estado do job. NÃO retorna texto completo.

```json
// pending/processing:
{ "job_id": "...", "status": "processing" }

// completed:
{ "job_id": "...", "status": "completed", "transcript_id": "uuid" }

// failed:
{ "job_id": "...", "status": "failed", "error_message": "..." }
```

Validação: auth + tenant do usuário deve ter acesso ao job (RLS ou check explícito).

---

### FASE 6: Worker `scripts/workers/transcription-worker.ts`

**Executável:** `npx tsx scripts/workers/transcription-worker.ts`
**PM2:** processo `axis-worker-transcribe`, separado do Next.js.

**Loop principal:**

```
1. SELECT job pendente mais antigo
   → FOR UPDATE SKIP LOCKED
   → Se não tem: sleep 5s, volta ao 1

2. UPDATE: status='processing', started_at, worker_id, locked_at, heartbeat_at

3. Ler áudio do disco (audio_path)

4. Chamar transcribeAudio() do src/services/asr.ts
   → Durante processamento: atualizar heartbeat_at a cada 60s
     (via setInterval paralelo ao await do ASR)

5. Se sucesso:
   a. Gerar transcript_id
   b. Salvar .txt via saveTranscript()
   c. INSERT em transcripts (transcript_path, text_preview, char_count)
      → withTenantClient para RLS
   d. UPDATE job: status='completed', transcript_id, progress=100, finished_at,
      locked_at=NULL, worker_id=NULL, heartbeat_at=NULL
   e. Se FREE: incrementar transcription_usage

6. Se falha:
   a. attempts++
   b. Se attempts < max_attempts → status='pending', locked_at=NULL,
      worker_id=NULL, heartbeat_at=NULL (retry)
   c. Se attempts >= max_attempts → status='failed', error_message, finished_at,
      locked_at=NULL, worker_id=NULL, heartbeat_at=NULL

**Regra explícita:** Ao concluir ou falhar definitivamente, o worker SEMPRE limpa
`locked_at`, `worker_id` e `heartbeat_at`. Nenhum job finalizado pode ficar com lock residual.

7. Voltar ao 1
```

**Heartbeat:** O worker atualiza `heartbeat_at` a cada 60 segundos enquanto processa. Isso permite recovery preciso.

**Recovery (a cada 5 iterações do loop):**
```sql
UPDATE transcription_jobs
SET status = 'pending', locked_at = NULL, worker_id = NULL,
    heartbeat_at = NULL, attempts = attempts + 1
WHERE status = 'processing'
  AND heartbeat_at < NOW() - INTERVAL '20 minutes'
  AND attempts < max_attempts
RETURNING id;
```

**Progresso:** Como o ASR não retorna progresso parcial, `progress` fica em 0 durante `processing` e pula para 100 em `completed`. Sem porcentagem fake.

**Logs:** job criado, job iniciado, job concluído, job falhou, duração total, tentativas, worker_id.

---

### FASE 7: Corrigir `GET /api/sessions/[id]`

**Arquivo:** `app/api/sessions/[id]/route.ts`

Adicionar após buscar sessão:

```sql
-- Transcript existente:
SELECT id, text_preview, transcript_path, char_count, created_at, processed
FROM transcripts
WHERE session_id = $1 AND tenant_id = $2
ORDER BY created_at DESC LIMIT 1

-- Job ativo:
SELECT id as job_id, status, progress, error_message, created_at
FROM transcription_jobs
WHERE session_id = $1 AND tenant_id = $2
ORDER BY created_at DESC LIMIT 1
```

**Resposta expandida:**
```json
{
  "session": { ... },
  "transcript": { "id", "text_preview", "created_at", "processed" },
  "transcription_job": { "job_id", "status", "progress" }
}
```

Retorna preview/metadados, NÃO texto completo. Compatibilidade legado: se `transcript_path` é null e `text` existe, usa `text` como `text_preview`.

---

### FASE 8: Endpoint de texto completo

**Arquivo novo:** `app/api/transcribe/text/[transcriptId]/route.ts`

**GET** — Retorna texto completo da transcrição.

Regra de leitura:
- Se `transcript_path` existe → `readFile` do disco
- Se `transcript_path` é null → usar coluna `text` legada

Validação: auth + RLS (transcript pertence ao tenant do usuário).

```json
{ "transcript_id": "...", "text": "texto completo..." }
```

Usado por: frontend (ao mostrar transcrição completa), e potencialmente por analyze-tcc.

---

### FASE 9: Ajustar `app/api/analyze-tcc/route.ts`

Atualmente recebe texto no body do request. Ajustar para:
1. Receber `transcript_id`
2. Buscar transcript no banco
3. Ler texto completo do disco via `readTranscriptSmart()`
4. Processar análise normalmente

Mantém compatibilidade: se frontend enviar `text` no body, usar direto (fallback).

---

### FASE 10: Ajustar `app/api/sessions/[id]/finish/route.ts`

Linha 56 atual faz `SELECT text FROM transcripts ...`. Ajustar para:
1. SELECT `text, transcript_path` FROM transcripts
2. Se `transcript_path` existe → ler do disco
3. Se não → usar `text` (legado)

Mesmo padrão via `readTranscriptSmart()`.

---

### FASE 11: Refatorar frontend `app/sessoes/[id]/page.tsx`

**Mudanças:**

1. **`sendAudio()`** simplificado:
   - POST → recebe `{ job_id, status: "pending" }`
   - Inicia polling
   - Remove todo código SSE (linhas 115-162)
   - Remove fallback "Resposta inesperada do servidor"

2. **Novo: `pollJobStatus(jobId)`**:
   - `setInterval` de 5 segundos
   - GET `/api/transcribe/status/{jobId}`
   - `processing` → mostrar estado visual indeterminado (sem % fake)
   - `completed` → GET `/api/transcribe/text/{transcriptId}` → setTranscript → parar polling
   - `failed` → mostrar erro → parar polling
   - Cleanup: `clearInterval` no return do `useEffect`

3. **`loadSession()` expandido:**
   - Se `data.transcription_job?.status === 'processing'` → iniciar polling
   - Se `data.transcription_job?.status === 'pending'` → iniciar polling
   - Se `data.transcript` → mostrar transcrição (buscar texto completo se necessário)
   - Se nenhum → mostrar botões upload/gravação

4. **UX durante processamento:**
   ```
   ┌─────────────────────────────────────────────────────┐
   │ ✓ Áudio enviado com sucesso                         │
   │                                                      │
   │ [═══════════ processando... ═══════════]             │
   │  (barra animada indeterminada, sem % fake)           │
   │                                                      │
   │ 🔒 Processamos as conversas em infraestrutura        │
   │ própria, com padrão de segurança hospitalar          │
   │ e proteção adicional além da LGPD.                   │
   │                                                      │
   │ Você pode continuar usando o sistema normalmente.    │
   │ A transcrição aparecerá automaticamente.             │
   └─────────────────────────────────────────────────────┘
   ```

5. **Se sair e voltar:** `loadSession()` reconstrói estado real via backend.

---

### FASE 12: Atualizar `ecosystem.config.cjs`

Adicionar worker como processo PM2 separado:

```javascript
{
  name: 'axis-worker-transcribe',
  script: 'npx',
  args: 'tsx scripts/workers/transcription-worker.ts',
  cwd: '/root/axis-tcc',
  instances: 1,
  autorestart: true,
  watch: false,
  max_memory_restart: '512M',
  env: { NODE_ENV: 'production', TZ: 'UTC' }
}
```

Next.js e worker em processos distintos. Restart isolado. Memória isolada.

---

### FASE 13: Fix limite FREE

**Arquivo:** `app/tcc/components/TranscriptionLimitModal.tsx`

Padronizar 50 minutos. Alinhar texto do modal com o valor real do backend.

---

## Critérios de aceite

| # | Cenário | Esperado |
|---|---------|----------|
| 1 | Upload de áudio | Responde em < 3 segundos com job_id |
| 2 | Fechar aba após upload | Job continua em background |
| 3 | Deslogar após upload | Job continua em background |
| 4 | Voltar à sessão depois | Estado real aparece (processando ou pronto) |
| 5 | Transcrição concluída | Texto aparece na tela via polling |
| 6 | ASR falha | Job registra erro, retry até max_attempts |
| 7 | Dois workers simultâneos | FOR UPDATE SKIP LOCKED impede conflito |
| 8 | Duplo upload na mesma sessão | Bloqueado (máx 1 job ativo por session) |
| 9 | Worker morre durante processamento | Recovery via heartbeat (20 min) |
| 10 | Limite FREE | 50 min em backend e frontend |
| 11 | Transcrições antigas (fevereiro) | Leitura legada via coluna `text` |
| 12 | Endpoint de status | NÃO retorna texto completo |
| 13 | Backup | Documentado: banco + diretório transcripts |

---

## Arquivos tocados (resumo)

| Arquivo | Ação | Fase |
|---------|------|------|
| `scripts/migrations/045_transcription_jobs.sql` | **NOVO** | 1 |
| `src/services/asr.ts` | **NOVO** | 2 |
| `src/services/transcript-storage.ts` | **NOVO** | 3 |
| `app/api/transcribe/route.ts` | **REESCREVER** | 4 |
| `app/api/transcribe/status/[jobId]/route.ts` | **NOVO** | 5 |
| `scripts/workers/transcription-worker.ts` | **NOVO** | 6 |
| `app/api/sessions/[id]/route.ts` | **EDITAR** | 7 |
| `app/api/transcribe/text/[transcriptId]/route.ts` | **NOVO** | 8 |
| `app/api/analyze-tcc/route.ts` | **EDITAR** | 9 |
| `app/api/sessions/[id]/finish/route.ts` | **EDITAR** | 10 |
| `app/sessoes/[id]/page.tsx` | **REESCREVER** | 11 |
| `ecosystem.config.cjs` | **EDITAR** | 12 |
| `app/tcc/components/TranscriptionLimitModal.tsx` | **EDITAR** | 13 |

---

## Escalabilidade futura (NÃO implementar agora)

| Quando | O que |
|--------|-------|
| 50+ profissionais | Redis como cache de status (reduz polling no banco) |
| 200+ profissionais | BullMQ + Redis para fila |
| 500+ profissionais | ASR em servidor separado (GPU dedicada) |
| 1000+ profissionais | MinIO/S3 no lugar do disco local |
| Quando quiser | Push notification quando transcrição concluir |

---

## Ordem de deploy na VPS

```bash
# 1. Criar diretórios
mkdir -p /var/lib/axis/audio-uploads
mkdir -p /var/lib/axis/transcripts

# 2. Adicionar ao .env
echo 'AUDIO_UPLOAD_DIR=/var/lib/axis/audio-uploads' >> .env
echo 'TRANSCRIPT_DIR=/var/lib/axis/transcripts' >> .env

# 3. Rodar migration
docker exec axis-postgres psql -U axis -d axis_tcc -f /dev/stdin < scripts/migrations/045_transcription_jobs.sql

# 4. Pull + build
git pull && rm -rf .next && npm run next:build

# 5. Reload app + start worker (NÃO usar pm2 delete all)
pm2 reload axis-tcc --update-env
pm2 start ecosystem.config.cjs --only axis-worker-transcribe
pm2 save
```

**IMPORTANTE:** Nunca usar `pm2 delete all` em produção. Usar reload/start direcionado apenas nos processos do AXIS.
