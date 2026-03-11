# AXIS TCC — Referencia Consolidada para Desenvolvimento

Fonte: Documento Mestre v2.1 + Declaracao Arquitetural v1.0.0 + Documento Mestre Clinica
Atualizado: 2026-03-11

---

## 1. MODELO DE NEGOCIO

### v1.x — Solo Profissional (VERSAO ATUAL)
- 1 psicologo por tenant
- Sem multi-usuario
- Sem niveis de permissao internos
- Sem supervisao hierarquica
- Sem diferenciacao de papeis clinicos
- Baseline CONGELADA — alteracoes estruturais so em v2.x

### v2.x — Clinica Multi-usuario (FUTURO)
- Roles: owner, therapist, assistant, supervisor
- Permissoes por papel (criar sessao, ver relatorio, exportar PDF, etc.)
- Auditoria expandida (actor: human | ai, axis_version)
- Autoria formal nos relatorios
- NAO IMPLEMENTAR AGORA

### v3.x — IA Assistiva Supervisionada (FUTURO DISTANTE)
- NAO PLANEJAR AGORA

---

## 2. PLANOS E PRECOS (Hotmart)

### Free
- 1 paciente
- Motor CSO-TCC completo
- Registro estruturado
- Transcricao por audio
- Relatorio institucional
- Sem custo, sem cartao, sem prazo

### Profissional — R$59/mes
- Pacientes ilimitados
- Tudo do Free +
- Google Calendar sync
- Suporte

### Links Hotmart
- Produto TCC ID: 7299808 (no webhook)
- Checkout: https://pay.hotmart.com/J104687347A?off=sn8ebdqc
- Checkout com bid: https://pay.hotmart.com/J104687347A?off=sn8ebdqc&bid=1773253249076

---

## 3. PIPELINE CLINICO (IMUTAVEL)

```
Sessao
  → Transcricao (opcional, Whisper)
  → Eventos clinicos (registro humano)
  → CSO — Clinical State Object (append-only, deterministico)
  → Sugestao unica (IA, baseada em regras)
  → Decisao humana (aprovar | editar | ignorar)
```

Principio-chave: A IA so atua APOS o fechamento da sessao e NUNCA executa decisoes clinicas.

---

## 4. CSO ENGINE v3.0.0

### 4 Dimensoes (escala 0-1)
- activation_level — engajamento/ativacao do paciente
- emotional_load — carga emocional percebida
- task_adherence — adesao as tarefas entre sessoes
- cognitive_rigidity — rigidez cognitiva (confrontacoes vs esquivas)

### Faixas de interpretacao
- 0.85-1.00: Excelente
- 0.70-0.84: Bom
- 0.50-0.69: Atencao
- 0.00-0.49: Critico

### 9 Tipos de eventos
AVOIDANCE_OBSERVED, CONFRONTATION_OBSERVED, ADJUSTMENT_OBSERVED,
RECOVERY_OBSERVED, SESSION_START, SESSION_END, TASK_COMPLETED,
TASK_INCOMPLETE, MOOD_CHECK

### Regras
- Deterministico, sem IA na formula
- Append-only com SHA256
- Nunca recomputar historico
- engine_version em cada registro

---

## 5. SUGGESTION ENGINE v2.1

- Max 1 sugestao por ciclo
- Gate de silencio: se confianca < limiar, sistema NAO sugere nada
- 12 regras com prioridade 0-10
- Decisao humana obrigatoria: approved | edited | ignored

---

## 6. GOVERNANCA (3 CAMADAS)

### Camada 1 — Dados Objetivos (Sistema)
- Metricas calculadas automaticamente
- Eventos registrados
- Indicadores longitudinais
- Nenhuma inferencia diagnostica
- Identificacao visual: "Calculo automatico"

### Camada 2 — Texto Automatizado Deterministico
- Textos gerados por regras fixas
- Sem IA generativa no relatorio
- Linguagem impessoal e descritiva

### Camada 3 — Registro do Profissional
- Conteudo clinico informado manualmente
- Identificado como "Registro do Profissional"
- Nao misturado com dados automatizados

---

## 7. O QUE O AXIS TCC NAO FAZ

- NAO diagnostica
- NAO prescreve intervencoes
- NAO interpreta resultados automaticamente
- NAO compartilha dados sem autorizacao
- NAO gera laudos — gera relatorios estruturados
- NAO executa acoes automaticamente
- NAO substitui julgamento clinico

---

## 8. STACK TECNICA

- Framework: Next.js 16 (App Router)
- Auth: Clerk (Production Pro)
- Banco: PostgreSQL 14 (multi-tenant, append-only)
- Cache: Redis (5min TTL dashboard)
- IA: OpenAI (Whisper transcricao + GPT-4o-mini Chat Ana)
- Email: Resend
- Push: Firebase Admin (FCM)
- Billing: Hotmart webhook v2.1
- VPS: Contabo, Nginx reverse proxy
- Dominio: axisclinico.com

---

## 9. TERMINOLOGIA

| Conceito | Termo TCC |
|---|---|
| Sujeito | Paciente |
| Profissional | Psicologo |
| Encontro | Sessao |
| Motor | CSO-TCC v3.0.0 |
| Produto | AXIS TCC |
| Plano gratuito | Free (1 paciente) |
| Plano pago | Profissional (R$59/mes) |

---

## 10. LIMITACOES DELIBERADAS v1.0.0

- Nao possui controle de multiplos usuarios por tenant
- Nao possui niveis de permissao internos
- Nao possui diferenciacao formal entre papeis clinicos
- Nao possui supervisao hierarquica
- Essas funcionalidades virao na v2.x (clinica multi-usuario)

---

## 11. REGRAS DE MUDANCA (BASELINE v2.1)

- Verde: Feature nova (nao altera logica existente) — OK
- Amarelo: Extensao (novo modulo, mesmo pipeline) — OK com cuidado
- Vermelho: Breaking change — EXIGE nova versao

PROIBIDO:
- Refatorar CSO sem versionamento
- Automatizar decisao clinica
- Alterar eventos passados
- "Ajustar regra no feeling"

Frase de protecao: "Qualquer melhoria parte do baseline v2.1, sem reinterpretacao retroativa."

---

## 12. FAQ ETICA (resumo para referencia rapida)

- AXIS nao diagnostica — organiza dados funcionais
- IA nunca decide sozinha — gate de silencio + decisao humana
- Compativel com CFP — nao delega atos privativos do psicologo
- Transcricao gera texto bruto, sem interpretacao
- Sugestoes sao opcionais, nao obrigatorias
- Registros NAO sao laudos nem documentos periciais
- Sistema 100% auditavel (append-only, logs separados)

---

Referencia: Documento Mestre v2.1, Declaracao Arquitetural v1.0.0, Documento Mestre Clinica
