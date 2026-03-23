## Playbook de Incidente — AXIS Clínico

### 1. Classificação de Severidade

| Severidade | Descrição | Tempo de Resposta |
|------------|-----------|-------------------|
| CRITICAL | Sistema fora do ar, perda de dados, segurança comprometida | Imediato |
| WARNING | Funcionalidade degradada, erros frequentes | Até 4 horas |
| INFO | Anomalia detectada, sem impacto direto | Próximo dia útil |

### 2. Contatos

| Papel | Nome | Contato |
|-------|------|---------|
| Dev/Owner | Alê | (preencher) |

### 3. Checklist de Resposta Imediata

#### Sistema Fora do Ar

1. Verificar VPS: `ssh root@vmi2884668.contaboserver.net`
2. Verificar PM2: `pm2 status`
3. Verificar logs: `pm2 logs axis-tcc --lines 100`
4. Verificar banco: `docker exec -i axis-postgres psql -U axis -d axis_tcc -c "SELECT 1"`
5. Reiniciar se necessário: `pm2 restart all`
6. Verificar health: `curl https://axisclinico.com/api/health`

#### Erro de Webhook Hotmart

1. Verificar painel admin: `/admin` → WebhookLogs
2. Verificar logs: `pm2 logs axis-tcc --lines 100 | grep -i hotmart`
3. Reprocessar manualmente se necessário

#### Erro de Autenticação em Massa

1. Verificar Clerk Dashboard
2. Verificar system_alerts: `SELECT * FROM system_alerts WHERE code LIKE 'AUTH%' ORDER BY created_at DESC LIMIT 10;`
3. Verificar se há bloqueio de IP

#### Suspeita de Vazamento/Segurança

1. NÃO comunicar publicamente antes de investigar
2. Verificar audit logs: `SELECT * FROM axis_audit_logs ORDER BY created_at DESC LIMIT 50;`
3. Verificar system_alerts para tenant_mismatch
4. Se confirmado: rotacionar chaves, isolar tenant afetado

### 4. Comunicação

- Incidente confirmado → registrar em system_alerts
- Resolução → marcar alerta como resolved
- Post-mortem → documentar causa raiz e ação corretiva

### 5. Pós-Incidente

- [ ] Causa raiz identificada
- [ ] Correção implementada
- [ ] Alerta marcado como resolvido
- [ ] Documentação atualizada (se necessário)
