# Integração Google Calendar - AXIS TCC

## Visão Geral

O AXIS TCC possui integração bidirecional completa com o Google Calendar, permitindo:

- **Google → AXIS**: Eventos criados no Google Calendar são importados automaticamente como sessões
- **AXIS → Google**: Sessões criadas no AXIS são exportadas automaticamente para o Google Calendar
- **Sincronização em tempo real**: Via webhook (push notifications)
- **Google Meet**: Links de videoconferência são criados automaticamente
- **Resposta do paciente**: Status de confirmação (Sim/Não/Talvez) sincronizado

---

## Arquitetura
```
┌─────────────────┐     webhook      ┌─────────────────┐
│                 │ ───────────────> │                 │
│ Google Calendar │                  │    AXIS TCC     │
│                 │ <─────────────── │                 │
└─────────────────┘   API (create)   └─────────────────┘
        │                                    │
        │                                    │
        v                                    v
   Email convite                      Sessão criada
   para paciente                      com link Meet
```

---

## Configuração Inicial

### 1. Google Cloud Console

1. Acesse https://console.cloud.google.com
2. Crie um projeto ou selecione existente
3. Ative as APIs:
   - Google Calendar API
   - Google Meet API (opcional, para conferências)

### 2. Credenciais OAuth2

1. Em "Credenciais", crie um "ID do cliente OAuth 2.0"
2. Tipo: Aplicativo Web
3. URLs de redirecionamento autorizados:
   - `https://axistcc.com/api/google/callback`
4. Copie o Client ID e Client Secret

### 3. Variáveis de Ambiente

Adicione ao `.env`:
```env
GOOGLE_CLIENT_ID=seu_client_id
GOOGLE_CLIENT_SECRET=seu_client_secret
```

### 4. Tela de Consentimento OAuth

1. Configure a tela de consentimento
2. Adicione escopos:
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/calendar.events`
3. Adicione usuários de teste (enquanto em modo de teste)

---

## Fluxo de Conexão

### Conectar Google Calendar

1. Usuário acessa `/configuracoes`
2. Clica em "Conectar Google Calendar"
3. Redireciona para `/api/google` → Google OAuth
4. Após autorização, callback em `/api/google/callback`
5. Tokens salvos em `calendar_connections`
6. Webhook registrado automaticamente

### Endpoints Envolvidos

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/google` | GET | Inicia fluxo OAuth |
| `/api/google/callback` | GET | Recebe código de autorização |
| `/api/google/status` | GET | Retorna status da conexão |
| `/api/google/sync` | POST | Sincronização manual |
| `/api/google/watch` | POST | Registra webhook |
| `/api/google/webhook` | POST | Recebe notificações do Google |

---

## Sincronização Google → AXIS

### Webhook (Tempo Real)

Quando um evento é criado/alterado/deletado no Google Calendar:

1. Google envia POST para `/api/google/webhook`
2. AXIS busca eventos alterados via `syncToken`
3. Para cada evento com convidado que é paciente:
   - Cria/atualiza sessão no banco
   - Importa link do Meet
   - Importa resposta do paciente (responseStatus)

### Mapeamento de Campos

| Google Calendar | AXIS Sessions |
|-----------------|---------------|
| `event.id` | `google_event_id` |
| `event.etag` | `external_etag` |
| `event.start.dateTime` | `scheduled_at` |
| `event.hangoutLink` | `google_meet_link` |
| `attendee.responseStatus` | `patient_response` |
| `event.status = cancelled` | `status = cancelada` |

### Resposta do Paciente

| Google responseStatus | AXIS patient_response | UI Status |
|-----------------------|-----------------------|-----------|
| `needsAction` | `needsAction` | Agendada |
| `accepted` | `accepted` | Confirmada (verde) |
| `declined` | `declined` | Recusada (vermelho) |
| `tentative` | `tentative` | Pendente (amarelo) |

---

## Sincronização AXIS → Google

### Criar Sessão

Quando uma sessão é agendada no AXIS:

1. Busca conexão Google do tenant
2. Cria evento no Google Calendar com:
   - Título: "Sessao - Nome do Paciente"
   - Data/hora da sessão
   - Convidado: email do paciente
   - Google Meet automático
3. Google envia email de convite ao paciente
4. Salva `google_event_id` e `google_meet_link` na sessão

### Parâmetros da API Google
```
POST /calendar/v3/calendars/primary/events
  ?conferenceDataVersion=1  # Habilita criação de Meet
  &sendUpdates=all          # Envia email para convidados
```

---

## Banco de Dados

### Tabela: calendar_connections
```sql
CREATE TABLE calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'google',
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  calendar_id TEXT DEFAULT 'primary',
  sync_enabled BOOLEAN DEFAULT true,
  webhook_channel_id TEXT,
  webhook_resource_id TEXT,
  webhook_expiration TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabela: calendar_sync_state
```sql
CREATE TABLE calendar_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  sync_token TEXT,
  last_sync_at TIMESTAMPTZ,
  UNIQUE(tenant_id, user_id, provider, calendar_id)
);
```

### Campos em sessions
```sql
ALTER TABLE sessions ADD COLUMN google_event_id TEXT;
ALTER TABLE sessions ADD COLUMN google_calendar_id TEXT;
ALTER TABLE sessions ADD COLUMN calendar_source TEXT;
ALTER TABLE sessions ADD COLUMN external_etag TEXT;
ALTER TABLE sessions ADD COLUMN external_updated_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN google_meet_link TEXT;
ALTER TABLE sessions ADD COLUMN patient_response TEXT DEFAULT 'needsAction';
```

---

## Renovação do Webhook

O webhook do Google expira em 7 dias. O cron `/api/cron/renew-webhook` renova automaticamente:

1. Busca conexões com webhook expirando em < 24h
2. Para canal antigo (`channels/stop`)
3. Registra novo canal (`events/watch`)
4. Atualiza `webhook_expiration`

### Configurar Cron

Adicione ao cron do servidor (rodar diariamente):
```bash
curl -X GET "https://axistcc.com/api/cron/renew-webhook" \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## Arquivos Principais
```
app/api/google/
├── route.ts           # Inicia OAuth
├── callback/route.ts  # Recebe código OAuth
├── status/route.ts    # Status da conexão
├── sync/route.ts      # Sync manual
├── watch/route.ts     # Registra webhook
└── webhook/route.ts   # Recebe notificações

app/api/cron/
└── renew-webhook/route.ts  # Renova webhook

app/api/sessions/
└── create/route.ts    # Cria sessão + evento Google

app/configuracoes/
└── page.tsx           # UI de configuração

app/sessoes/
├── page.tsx           # Lista com status de resposta
└── [id]/page.tsx      # Detalhes com botão Meet
```

---

## Interface do Usuário

### Página de Configurações

- Status de conexão (Conectado/Não conectado)
- Última sincronização
- Status do webhook (ativo até data X)
- Botão "Sincronizar Agora"
- Botão "Ativar Sync Automático"

### Lista de Sessões

Coluna Status mostra:
- **Agendada** (amarelo) - sem resposta
- **Confirmada** (verde) - paciente confirmou
- **Recusada** (vermelho) - paciente recusou
- **Pendente** (amarelo) - paciente disse "talvez"
- **Em andamento** (azul) - sessão iniciada
- **Finalizada** (cinza) - sessão concluída

### Detalhes da Sessão

- Botão verde "Entrar no Meet" (se tiver link)
- Abre Google Meet em nova aba

---

## Troubleshooting

### Webhook não funciona

1. Verificar se URL é HTTPS
2. Verificar se rota está liberada no middleware
3. Verificar logs: `pm2 logs axis-tcc | grep WEBHOOK`

### Eventos não importam

1. Verificar se email do convidado = email do paciente
2. Verificar se syncToken está válido
3. Limpar syncToken: `DELETE FROM calendar_sync_state`

### Token expirado

1. O sistema renova automaticamente
2. Se falhar, reconectar Google Calendar

### Email não chega para paciente

1. Verificar se paciente tem email cadastrado
2. Verificar parâmetro `sendUpdates=all` na URL da API

---

## Segurança

- Tokens armazenados criptografados no banco
- Refresh token usado para renovar access token
- Webhook validado por `x-goog-channel-id`
- Rotas públicas apenas: `/api/google/callback`, `/api/google/webhook`

---

## Limitações

- Apenas calendário primário suportado
- Eventos de dia inteiro são ignorados (sem horário específico)
- Máximo 50 eventos por sync
- Webhook expira em 7 dias (renovação automática)

---

## Versão

- **Implementado em**: Fevereiro 2026
- **Versão**: 1.0.0
- **Autor**: AXIS TCC Team
