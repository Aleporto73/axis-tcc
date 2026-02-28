# AXIS TCC — Documentação Técnica (Skill)

Última atualização: 2026-02-28
Versão do sistema: CSO-TCC v3.0.0

---

## 1. VISÃO GERAL

O AXIS TCC é um sistema de apoio à prática clínica em Terapia Cognitivo-Comportamental.

**Princípios:**
- IA NÃO decide, NÃO executa, NÃO substitui julgamento clínico
- Decisão final SEMPRE humana
- Dados append-only (nunca sobrescreve histórico)
- Toda ação é auditável

---

## 2. FLUXO DO SISTEMA

Sessão → Transcrição (opcional) → Eventos clínicos → CSO → Sugestão → Decisão humana

---

## 3. GRAVAÇÃO E TRANSCRIÇÃO

### Upload de áudio
- Aceita MP3, WAV, M4A
- Limite: 25MB
- Funciona com sessões de até 60+ minutos
- O profissional pode gravar no celular e subir depois
- NÃO precisa estar logado durante a sessão presencial

### Gravação no navegador
- Gravação via MediaRecorder API
- Formato WebM
- Timer visual e controles de parar/retomar
- Disponível na página do paciente e na página da sessão

### Transcrição
- Motor: OpenAI Whisper (modelo whisper-1)
- Idioma: português (pt)
- Áudios ≤5MB: transcrição direta
- Áudios >5MB: chunking automático (chunks de 5 min via FFmpeg)
- Áudios >5MB: streaming de progresso via SSE
- Endpoints: /api/transcribe (principal), /api/transcribe-audio (registros clínicos)

### Fluxo típico de sessão presencial
1. O profissional atende o paciente presencialmente
2. Grava a sessão no celular (qualquer app de gravação serve)
3. Depois do atendimento, acessa o AXIS TCC
4. Faz upload do áudio na página do paciente
5. O sistema transcreve e analisa tudo automaticamente

---

## 4. MOTOR CSO-TCC v3.0.0

### O que é
Clinical State Object — estado clínico calculado longitudinalmente.

### 4 Dimensões (escala 0 a 1)
1. **activation_level** — engajamento/ativação do paciente
2. **emotional_load** — carga emocional percebida
3. **task_adherence** — adesão às tarefas entre sessões
4. **cognitive_rigidity** — rigidez cognitiva (confrontações vs esquivas)

### Características técnicas
- Escala: 0 a 1 (normalizada com clamp)
- Anti-duplicidade: SHA256 hash nos eventos
- Append-only: nunca faz UPDATE, sempre INSERT
- Arquivo: src/engines/cso.ts

### Faixas de interpretação (para linguagem simplificada)
- 0.85–1.00: Excelente — evolução consistente
- 0.70–0.84: Bom — progresso adequado
- 0.50–0.69: Atenção — possível estagnação
- 0.00–0.49: Crítico — pouco progresso ou falta de dados

---

## 5. MICRO-EVENTOS

### 9 tipos validados na API (/api/events/create):
1. AVOIDANCE_OBSERVED — esquiva observada
2. CONFRONTATION_OBSERVED — confrontação/enfrentamento observado
3. ADJUSTMENT_OBSERVED — ajuste terapêutico
4. RECOVERY_OBSERVED — recuperação observada
5. SESSION_START — início da sessão
6. SESSION_END — fim da sessão
7. TASK_COMPLETED — tarefa concluída
8. TASK_INCOMPLETE — tarefa não concluída
9. MOOD_CHECK — check de humor (escala 0-10)

### Tipos adicionais no union type:
- EXPOSURE_ATTEMPT
- CRISIS_ALERT
- BRIDGE_RESPONSE
- HOMEWORK_REVIEW

### Estrutura do evento
- tenant_id, patient_id, event_type
- payload com intensity (0-1) e note
- Armazenado na tabela events

---

## 6. MOTOR DE SUGESTÕES v2.1

### Como funciona
- Analisa o CSO mais recente do paciente
- Máximo 1 sugestão por ciclo
- Avalia múltiplos candidatos e retorna só o top 1 por prioridade
- Se nenhuma regra é acionada, simplesmente não gera sugestão (não existe "gate de silêncio" explícito)

### 11 tipos de sugestão (com prioridade 0-10):
1. CRISIS_PROTOCOL (10) — protocolo de crise
2. PAUSE_EXPOSURE (9/8) — pausar exposição
3. CHECK_ADHERENCE (8) — verificar adesão
4. COGNITIVE_INTERVENTION (7) — intervenção cognitiva
5. SIMPLIFY_TASK (6) — simplificar tarefa
6. EMOTIONAL_REGULATION (6) — regulação emocional
7. CELEBRATE_PROGRESS (5/4) — celebrar progresso
8. ADJUST_PACE (5/4) — ajustar ritmo
9. BRIDGE_TO_LAST (4) — ponte para última sessão

### Decisão humana
O profissional pode: aprovar, editar ou ignorar.
Nenhuma ação é executada automaticamente.
Arquivo: src/engines/suggestion.ts

---

## 7. RELATÓRIOS

### Export PDF
- Rota: /relatorio/[patientId]/page.tsx
- Método: window.print() (print-to-PDF do navegador)
- Contém: evolução longitudinal, dimensões CSO, histórico de sessões

### Autenticidade
- Hash SHA256 nos eventos para garantir integridade
- Referência do hash exibida no rodapé do relatório
- Dados append-only garantem imutabilidade

---

## 8. O QUE O AXIS TCC NÃO FAZ

- NÃO diagnostica
- NÃO prescreve intervenções
- NÃO interpreta resultados automaticamente
- NÃO compartilha dados sem autorização
- NÃO gera laudos — gera relatórios estruturados
- NÃO executa ações automaticamente
- NÃO substitui o julgamento clínico do profissional

---

## 9. INTEGRAÇÕES

### Google Calendar
- Sync de sessões agendadas
- Configurável em Configurações → Integrações

### Clerk
- Autenticação de usuários
- Multi-tenant por profissional

### OpenAI
- Transcrição: Whisper (whisper-1)
- Chat Ana: GPT-4o-mini (assistente virtual)
- Análise TCC: extração de pensamentos automáticos e distorções cognitivas

---

## 10. TERMINOLOGIA

| Termo | Significado |
|-------|-------------|
| Paciente | Pessoa em atendimento terapêutico |
| Sessão | Encontro terapêutico registrado no sistema |
| Transcrição | Áudio da sessão convertido em texto (Whisper) |
| CSO | Clinical State Object — índice de evolução (0-1) |
| Micro-evento | Registro pontual durante/após sessão |
| Sugestão | Recomendação do sistema (decisão é humana) |
| Tarefa | Atividade para o paciente fazer entre sessões |
| Indicador | Cada uma das 4 dimensões do CSO |
| Histórico | Registro permanente e imutável de todas as sessões |
| Relatório | Documento exportável com resumo da evolução |
