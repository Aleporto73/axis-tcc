\# F3 â€” RUNBOOK DA JANELA DE ROTAÃ‡ÃƒO DE SEGREDOS



> \*\*AXIS ClÃ­nico Â· Auditoria de SeguranÃ§a Â· PendÃªncia F3\*\*

> Repo: `Aleporto73/axis-tcc` Â· VPS: `root@vmi2884668`

> PrÃ©-requisito: commit `68a62d7` (MAINTENANCE\_MODE + `scripts/jobs/rotate\_encryption\_key.sql`) jÃ¡ em prod via deploy da Fase B.



\---



\## âš ï¸ REGRA DE OURO â€” vale para o runbook inteiro



\*\*NUNCA imprimir, colar, logar, commitar ou documentar valor de segredo.\*\*



\- NÃ£o usar `cat` para exibir segredo no terminal.

\- NÃ£o colar segredo em chat (Claude/CC), print, issue ou commit.

\- Sempre carregar segredo em variÃ¡vel local de shell e dar `unset` depois.

\- Se um segredo vazar em qualquer canal, ele estÃ¡ comprometido: gerar outro.



\---



\## Mapa do ambiente (confirmado)



| Item | Valor |

|---|---|

| App PROD | `/root/axis-tcc` Â· PM2 `axis-tcc` Â· db `axis\_tcc` |

| App STAGING | `/root/axis-tcc-staging` Â· PM2 `axis-staging` Â· db `axis\_tcc\_staging` |

| Worker | PM2 `axis-worker-transcribe` |

| Banco | Docker container `axis-postgres`, user `axis` |

| `.env` | `/root/axis-tcc/.env` e `/root/axis-tcc-staging/.env` |

| Build | `npm run next:build` (\*\*NÃƒO existe `npm run build`\*\*) |

| SQL recifra | `/root/axis-tcc/scripts/jobs/rotate\_encryption\_key.sql` |



Fatos que governam a janela:



\- `DATABASE\_PASSWORD` Ã© \*\*igual\*\* em prod e staging â†’ trocar \*\*nos dois\*\* `.env`.

\- `AXIS\_ENCRYPTION\_KEY` existe \*\*sÃ³ em prod\*\* (hash `6e22fe5c`); staging estÃ¡ \*\*vazia\*\* (hash `e3b0c442` = string vazia).

\- Portanto: \*\*recifra roda SOMENTE no banco `axis\_tcc` (prod). NUNCA em `axis\_tcc\_staging`.\*\*

\- O SQL de rotaÃ§Ã£o usa `app.encryption\_key\_old` / `app.encryption\_key\_new` via `SET` / `current\_setting`.



\---



\## âœ… Blockers B1â€“B5 â€” RESOLVIDOS (recon confirmado em 12/06/2026)



| # | Item | ResoluÃ§Ã£o |

|---|---|---|

| B1 | DomÃ­nio prod | `https://axisclinico.com` |

| B2 | Rotas cron | `/api/cron/reminders`, `/api/cron/renew-webhook`, `/api/cron/scan-integrity` |

| B3 | Rota p/ validar 503 | `/api/aba/me` |

| B4 | Bypass middleware | \*\*NÃ£o existe\*\* â€” em maintenance sÃ³ passam `/api/health` e `/manutencao`. Smoke decrypt = validaÃ§Ã£o direta no banco (Passo 13.0) |

| B5 | Colunas cifradas | 7 colunas confirmadas (tabela no Passo 13.0); alvo preferencial `service\_sites.address\_encrypted` |



Nenhum placeholder pendente. Runbook pronto para execuÃ§Ã£o.



\---



\## VisÃ£o geral das fases



| Fase | O quÃª | Downtime |

|---|---|---|

| A | `CRON\_SECRET` + `INTERNAL\_API\_KEY` (rotaÃ§Ã£o a quente) | Zero |

| B | Backup â†’ MAINTENANCE\_MODE â†’ recifra `AXIS\_ENCRYPTION\_KEY` (sÃ³ prod) â†’ `DATABASE\_PASSWORD` â†’ smoke â†’ reabrir | 15â€“30 min |

| C | Limpeza: `CRON\_SECRET\_OLD`, default hardcoded, backup antigo | Zero |



\*\*Ponto crÃ­tico da janela:\*\* `recifra concluÃ­da + .env com chave nova + restart do app`. Antes de desligar a manutenÃ§Ã£o, a \*\*leitura real de dado cifrado em prod\*\* precisa estar verde.



\---



\# FASE A â€” RotaÃ§Ã£o a quente (sem downtime)



\## Passo 1 â€” Preflight read-only



Tudo neste passo Ã© sÃ³ leitura. Nada Ã© alterado.



```bash

cd /root/axis-tcc



echo "=== PROD GIT ==="

git status --short

git log -3 --oneline --decorate



echo "=== STAGING GIT ==="

cd /root/axis-tcc-staging

git status --short

git log -3 --oneline --decorate



echo "=== PM2 ==="

pm2 list



echo "=== DOCKER ==="

docker ps --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}"



echo "=== ENVS ==="

ls -la /root/axis-tcc/.env /root/axis-tcc-staging/.env



echo "=== ROTATION SQL ==="

ls -la /root/axis-tcc/scripts/jobs/rotate\_encryption\_key.sql

sed -n '1,120p' /root/axis-tcc/scripts/jobs/rotate\_encryption\_key.sql

```



\### ðŸ›‘ TRAVA 1 â€” nÃ£o prosseguir se qualquer item abaixo falhar



\- \[ ] `git status` limpo em prod \*\*e\*\* staging (working tree sem alteraÃ§Ãµes).

\- \[ ] Container `axis-postgres` rodando (`Status: Up`).

\- \[ ] Os dois `.env` existem.

\- \[ ] PM2 mostra os 3 processos: `axis-tcc`, `axis-staging`, `axis-worker-transcribe` (status `online`).

\- \[ ] `rotate\_encryption\_key.sql` existe e o cabeÃ§alho confere com o esperado (`app.encryption\_key\_old` / `app.encryption\_key\_new`).



Se algo falhar: \*\*parar aqui\*\*, investigar e sÃ³ voltar com tudo verde.



\---



\## Passo 2 â€” Gerar novos valores na VPS (CRON\_SECRET e INTERNAL\_API\_KEY)



Os segredos nascem \*\*dentro da VPS\*\*, em diretÃ³rio protegido, nunca no chat.



```bash

umask 077



ROT\_DIR="/root/axis-secret-rotation-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$ROT\_DIR"

chmod 700 "$ROT\_DIR"



\# === BACKUP DOS .env ANTES DE QUALQUER ALTERAÃ‡ÃƒO DE SEGREDO (ground truth do rollback F3) ===

cp -a /root/axis-tcc/.env "$ROT\_DIR/env.prod.before\_f3"

cp -a /root/axis-tcc-staging/.env "$ROT\_DIR/env.staging.before\_f3"

chmod 600 "$ROT\_DIR"/env.\*.before\_f3



openssl rand -hex 32 > "$ROT\_DIR/CRON\_SECRET.new"

openssl rand -hex 32 > "$ROT\_DIR/INTERNAL\_API\_KEY.new"



chmod 600 "$ROT\_DIR"/\*

ls -la "$ROT\_DIR"

```



âš ï¸ \*\*NÃ£o usar `cat` para "conferir" os valores.\*\* O `ls -la` confirma que existem e tÃªm tamanho > 0. Para usar um valor, carregar em variÃ¡vel:



```bash

ROT\_DIR="$(ls -td /root/axis-secret-rotation-\* | head -1)"

\# exemplo de uso pontual (nÃ£o imprimir):

\# NOVO="$(cat "$ROT\_DIR/CRON\_SECRET.new")"

```



\---



\## Passo 3 â€” Rotacionar `CRON\_SECRET` (modo graceful)



\### 3.1 Editar `.env` prod



Editar `/root/axis-tcc/.env`:



1\. Copiar o valor \*\*atual\*\* de `CRON\_SECRET` para uma nova linha `CRON\_SECRET\_OLD=` (o middleware graceful aceita o antigo durante a transiÃ§Ã£o).

2\. Substituir `CRON\_SECRET` pelo conteÃºdo de `$ROT\_DIR/CRON\_SECRET.new` (abrir o `.env` no editor e colar a partir do arquivo, sem ecoar no terminal â€” ex.: dentro do `nano`, ler com `Ctrl+R $ROT\_DIR/CRON\_SECRET.new`).



\### 3.2 Reiniciar app



```bash

pm2 restart axis-tcc --update-env

```



\### 3.3 Atualizar os callers do cron



Atualizar crontab / linhas com `Authorization: Bearer` para usar o secret novo:



```bash

crontab -l | grep -n -i "bearer\\|cron" || echo "nenhuma entrada com Bearer no crontab"

crontab -e   # editar manualmente, substituindo o secret antigo pelo novo

```



âš ï¸ Ao editar o crontab, o secret novo serÃ¡ gravado ali â€” isso Ã© esperado (o crontab Ã© o caller), mas \*\*nÃ£o colar o conteÃºdo do crontab em chat/print\*\*.



\### 3.4 Testar crons sem expor segredo



Rotas cron reais (confirmadas por recon no repo):



```bash

ROT\_DIR="$(ls -td /root/axis-secret-rotation-\* | head -1)"

CRON\_SECRET\_NEW="$(cat "$ROT\_DIR/CRON\_SECRET.new")"



curl -i -H "Authorization: Bearer ${CRON\_SECRET\_NEW}" "https://axisclinico.com/api/cron/reminders"

curl -i -H "Authorization: Bearer ${CRON\_SECRET\_NEW}" "https://axisclinico.com/api/cron/renew-webhook"

curl -i -H "Authorization: Bearer ${CRON\_SECRET\_NEW}" "https://axisclinico.com/api/cron/scan-integrity"



unset CRON\_SECRET\_NEW

```



Esperado: `200` (ou status normal da rota). `401/403` = secret nÃ£o bateu â†’ revisar `.env` e restart.



âš ï¸ Se o output do `curl` contiver qualquer header com segredo, \*\*nÃ£o colar em chat\*\*.



\### 3.5 Staging



\- Se staging tem cron com `CRON\_SECRET`: repetir 3.1â€“3.4 em `/root/axis-tcc-staging/.env` + `pm2 restart axis-staging --update-env`.

\- Se staging \*\*nÃ£o\*\* usa cron: registrar aqui como \*\*"nÃ£o aplicÃ¡vel"\*\* e seguir.



\### 3.6 Remover `CRON\_SECRET\_OLD`



â³ \*\*SÃ³ na FASE C (Passo 15), apÃ³s smoke completo verde.\*\* NÃ£o remover agora.



\---



\## Passo 4 â€” Rotacionar `INTERNAL\_API\_KEY`



1\. Editar `/root/axis-tcc/.env`: substituir `INTERNAL\_API\_KEY` pelo conteÃºdo de `$ROT\_DIR/INTERNAL\_API\_KEY.new` (mesma tÃ©cnica do Passo 3.1 â€” sem ecoar).

2\. Verificar se staging usa `INTERNAL\_API\_KEY`:



```bash

grep -c '^INTERNAL\_API\_KEY=' /root/axis-tcc-staging/.env || echo "staging nao usa INTERNAL\_API\_KEY"

```



3\. Se staging usa: trocar tambÃ©m em `/root/axis-tcc-staging/.env` (mesmo valor novo).

4\. Verificar se o worker usa a key:



```bash

pm2 env axis-worker-transcribe | grep -c INTERNAL\_API\_KEY || echo "worker nao usa INTERNAL\_API\_KEY"

```



5\. Reiniciar os afetados:



```bash

pm2 restart axis-tcc --update-env

pm2 restart axis-staging --update-env

\# somente se o worker usar a key:

pm2 restart axis-worker-transcribe --update-env

```



6\. Smoke rÃ¡pido: qualquer fluxo interno que use a key (ex.: chamada interna appâ†’worker) deve funcionar. Logs sem `401/403` interno:



```bash

pm2 logs axis-tcc --lines 60 --nostream

```



\### âœ… Fim da FASE A



`CRON\_SECRET` e `INTERNAL\_API\_KEY` rotacionados, app no ar, zero downtime. Pode pausar aqui e agendar a FASE B para a janela de manutenÃ§Ã£o.



\---



\# FASE B â€” Janela com MAINTENANCE\_MODE (downtime planejado 15â€“30 min)



> \*\*Escopo da recifra: SOMENTE o banco `axis\_tcc` (prod). NUNCA rodar a recifra em `axis\_tcc\_staging`.\*\*

> Staging tem `AXIS\_ENCRYPTION\_KEY` vazia e nÃ£o cifra dados.



\## Passo 5 â€” Backup obrigatÃ³rio (bloqueante)



```bash

ROT\_DIR="$(ls -td /root/axis-secret-rotation-\* | head -1)"



docker exec axis-postgres pg\_dump -U axis -d axis\_tcc -Fc > "$ROT\_DIR/axis\_tcc.before\_f3\_$(date +%Y%m%d-%H%M%S).dump"



ls -lh "$ROT\_DIR"/\*.dump

```



Recomendado (antes de mexer em `DATABASE\_PASSWORD`, que afeta os dois bancos):



```bash

docker exec axis-postgres pg\_dump -U axis -d axis\_tcc\_staging -Fc > "$ROT\_DIR/axis\_tcc\_staging.before\_f3\_$(date +%Y%m%d-%H%M%S).dump"



ls -lh "$ROT\_DIR"/\*.dump

```



\### ðŸ›‘ TRAVA 2 â€” nÃ£o prosseguir sem backup vÃ¡lido



\- \[ ] Arquivo `.dump` de `axis\_tcc` existe.

\- \[ ] Tamanho > 0 e \*\*plausÃ­vel\*\* para o volume do banco (nÃ£o pode ser alguns KB se o banco tem dados reais).

\- \[ ] Sem erro no `pg\_dump`.



\*\*Backup falhou = janela abortada.\*\* Sem dump nÃ£o existe rollback do CenÃ¡rio 3.



\---



\## Passo 6 â€” Deploy do cÃ³digo com MAINTENANCE\_MODE



```bash

cd /root/axis-tcc



echo "=== CONFIRMAR SCRIPT DE BUILD ==="

npm run | grep next:build



echo "=== GIT PULL ==="

git pull



echo "=== INSTALL ==="

npm install



echo "=== BUILD ==="

npm run next:build

```



âš ï¸ \*\*NÃƒO usar `npm run build`\*\* â€” esse script nÃ£o existe e trava a janela.



Depois, editar `/root/axis-tcc/.env` e setar:



```txt

MAINTENANCE\_MODE=true

```



Reiniciar:



```bash

pm2 restart axis-tcc --update-env

```



Validar manutenÃ§Ã£o ativa (usar \*\*rota real\*\* de API, nÃ£o wildcard `/api/\*`):



```bash

curl -i "https://axisclinico.com/manutencao"



\# rota real de API (deve retornar 503 com maintenance ativo):

curl -i "https://axisclinico.com/api/aba/me"

```



\### ðŸ›‘ TRAVA 3 â€” nÃ£o prosseguir se a manutenÃ§Ã£o nÃ£o estiver ativa



\- \[ ] `/manutencao` abre (200).

\- \[ ] Rota real de API retorna \*\*503\*\*.

\- \[ ] Build concluiu sem erro.



App ainda recebendo trÃ¡fego de escrita = recifra em banco vivo = risco de corrupÃ§Ã£o. \*\*NÃ£o seguir.\*\*



\---



\## Passo 7 â€” Gerar nova `AXIS\_ENCRYPTION\_KEY`



```bash

ROT\_DIR="$(ls -td /root/axis-secret-rotation-\* | head -1)"



openssl rand -hex 32 > "$ROT\_DIR/AXIS\_ENCRYPTION\_KEY.new"

chmod 600 "$ROT\_DIR/AXIS\_ENCRYPTION\_KEY.new"

ls -la "$ROT\_DIR/AXIS\_ENCRYPTION\_KEY.new"

```



âš ï¸ NÃ£o imprimir, nÃ£o colar em chat, nÃ£o commitar, nÃ£o salvar fora de `$ROT\_DIR`.



\---



\## Passo 8 â€” Validar o SQL antes de executar (bloqueante)



```bash

sed -n '1,220p' /root/axis-tcc/scripts/jobs/rotate\_encryption\_key.sql

```



\### ðŸ›‘ TRAVA 4 â€” checklist de leitura manual do SQL



Confirmar \*\*lendo o script\*\*, item a item:



\- \[ ] LÃª `app.encryption\_key\_old` via `current\_setting` (ou equivalente).

\- \[ ] LÃª `app.encryption\_key\_new` via `current\_setting` (ou equivalente).

\- \[ ] Tem preflight/dry-run ou contagem de linhas \*\*antes\*\* de alterar.

\- \[ ] Deixa explÃ­cito quais \*\*7 colunas BYTEA\*\* serÃ£o recifradas.

\- \[ ] Roda em transaÃ§Ã£o (`BEGIN`/`COMMIT`) ou tem comportamento seguro em erro (com `ON\_ERROR\_STOP=1` aborta sem commit parcial).

\- \[ ] Nada no script referencia `axis\_tcc\_staging` â€” alvo Ã© apenas `axis\_tcc`.



\*\*Qualquer dÃºvida em qualquer item = nÃ£o seguir.\*\* Parar e revisar com o Claude/CC antes.



\---



\## Passo 9 â€” Rodar a recifra (SOMENTE PROD)



> ðŸ”´ Banco alvo: `axis\_tcc`. \*\*Conferir o `-d axis\_tcc` no comando antes de dar Enter.\*\*



Forma preferida (injeta os `SET` antes do script, tudo via stdin, segredo sÃ³ em variÃ¡vel):



```bash

ROT\_DIR="$(ls -td /root/axis-secret-rotation-\* | head -1)"



OLD\_AXIS\_KEY="$(grep '^AXIS\_ENCRYPTION\_KEY=' /root/axis-tcc/.env | cut -d= -f2-)"

NEW\_AXIS\_KEY="$(cat "$ROT\_DIR/AXIS\_ENCRYPTION\_KEY.new")"



\# escape de aspas simples (mesma tÃ©cnica do Passo 11.3) â€” protege o SET contra quebra de sintaxe SQL

ESCAPED\_OLD\_AXIS\_KEY="$(printf "%s" "$OLD\_AXIS\_KEY" | sed "s/'/''/g")"

ESCAPED\_NEW\_AXIS\_KEY="$(printf "%s" "$NEW\_AXIS\_KEY" | sed "s/'/''/g")"



{

&#x20; printf "SET app.encryption\_key\_old = '%s';\\n" "$ESCAPED\_OLD\_AXIS\_KEY"

&#x20; printf "SET app.encryption\_key\_new = '%s';\\n" "$ESCAPED\_NEW\_AXIS\_KEY"

&#x20; cat /root/axis-tcc/scripts/jobs/rotate\_encryption\_key.sql

} | docker exec -i axis-postgres psql -U axis -d axis\_tcc -v ON\_ERROR\_STOP=1



unset OLD\_AXIS\_KEY

unset NEW\_AXIS\_KEY

unset ESCAPED\_OLD\_AXIS\_KEY

unset ESCAPED\_NEW\_AXIS\_KEY

```



âš ï¸ Se o cabeÃ§alho do script jÃ¡ fizer `SET` interno ou exigir outro formato de invocaÃ§Ã£o, ajustar conforme o prÃ³prio cabeÃ§alho (lido no Passo 8). Nota: `SET` Ã© por sessÃ£o â€” os dois `SET` e o script precisam ir na \*\*mesma\*\* chamada `psql`, como acima.



\### ðŸ›‘ TRAVA 5 â€” validar saÃ­da da recifra



Bloquear (e ir para Rollback) se:



\- \[ ] O psql retornou erro (qualquer linha `ERROR`).

\- \[ ] A contagem/dry-run do script indicou inconsistÃªncia (linhas esperadas â‰  processadas).

\- \[ ] Apareceu qualquer erro de decrypt/encrypt.

\- \[ ] O script tentou tocar staging.



Tudo verde â†’ seguir.



âš ï¸ NÃ£o colar o output completo em chat se contiver fragmentos de chave.



\---



\## Passo 10 â€” Trocar `AXIS\_ENCRYPTION\_KEY` no `.env` (SÃ“ PROD)



Editar \*\*somente\*\* `/root/axis-tcc/.env`:



```txt

AXIS\_ENCRYPTION\_KEY=<conteÃºdo de $ROT\_DIR/AXIS\_ENCRYPTION\_KEY.new>

```



(Colar a partir do arquivo dentro do editor, sem ecoar no terminal.)



ðŸ”´ \*\*NÃƒO trocar em staging.\*\* Motivo: staging tem chave vazia, nÃ£o cifra dados, e a recifra sÃ³ rodou em prod. Colocar a chave em staging criaria divergÃªncia sem dados correspondentes.



â³ O restart vem no Passo 12 (junto com a troca de senha do banco), para reiniciar uma vez sÃ³.



\---



\## Passo 11 â€” Trocar `DATABASE\_PASSWORD`



\### Ordem obrigatÃ³ria â€” por quÃª



1\. Gerar nova senha â†’ 2. `ALTER USER` no Postgres â†’ 3. Atualizar os \*\*dois\*\* `.env` â†’ 4. \*\*SÃ³ depois\*\* restart PM2.



\- Se trocar `.env` \*\*antes\*\* do `ALTER USER`: o app reconecta com senha que o banco ainda nÃ£o conhece â†’ falha.

\- Se trocar o banco e \*\*demorar\*\* a atualizar `.env`: o pool, ao renovar conexÃ£o, usa a senha velha â†’ app cai.

\- A janela entre `ALTER USER` e o restart Ã© tolerada porque o app estÃ¡ em MAINTENANCE\_MODE e as conexÃµes do pool jÃ¡ abertas continuam vÃ¡lidas.



\### 11.1 Gerar



```bash

ROT\_DIR="$(ls -td /root/axis-secret-rotation-\* | head -1)"



openssl rand -hex 32 > "$ROT\_DIR/DATABASE\_PASSWORD.new"

chmod 600 "$ROT\_DIR/DATABASE\_PASSWORD.new"

```



\### 11.2 Backup adicional dos `.env` (snapshot especÃ­fico da troca de senha)



> O \*\*ground truth\*\* do rollback F3 Ã© o backup feito no Passo 2 (`env.prod.before\_f3` / `env.staging.before\_f3`). Este snapshot extra captura o estado jÃ¡ com `CRON\_SECRET`/`INTERNAL\_API\_KEY`/`AXIS\_ENCRYPTION\_KEY` novos, Ãºtil para reverter \*\*sÃ³\*\* a troca de senha sem desfazer a Fase A/recifra.



```bash

cp -a /root/axis-tcc/.env "$ROT\_DIR/env.prod.before\_dbpass"

cp -a /root/axis-tcc-staging/.env "$ROT\_DIR/env.staging.before\_dbpass"

chmod 600 "$ROT\_DIR"/env.\*

```



\### 11.3 Aplicar no Postgres



```bash

ROT\_DIR="$(ls -td /root/axis-secret-rotation-\* | head -1)"



NEW\_DB\_PASS="$(cat "$ROT\_DIR/DATABASE\_PASSWORD.new")"

ESCAPED\_DB\_PASS="$(printf "%s" "$NEW\_DB\_PASS" | sed "s/'/''/g")"



docker exec -i axis-postgres psql -U axis -d postgres -v ON\_ERROR\_STOP=1 <<SQL

ALTER USER axis WITH PASSWORD '$ESCAPED\_DB\_PASS';

SQL



unset NEW\_DB\_PASS

unset ESCAPED\_DB\_PASS

```



\### 11.4 Atualizar os DOIS `.env` imediatamente



Editar `/root/axis-tcc/.env` \*\*e\*\* `/root/axis-tcc-staging/.env`:



```txt

DATABASE\_PASSWORD=<conteÃºdo de $ROT\_DIR/DATABASE\_PASSWORD.new>

```



(Mesmo valor nos dois â€” a senha Ã© do user `axis`, compartilhado.)



\---



\## Passo 12 â€” Reiniciar todos os processos



```bash

pm2 restart axis-tcc --update-env

pm2 restart axis-worker-transcribe --update-env

pm2 restart axis-staging --update-env

```



Logs:



```bash

pm2 logs axis-tcc --lines 120 --nostream

pm2 logs axis-worker-transcribe --lines 120 --nostream

pm2 logs axis-staging --lines 120 --nostream

pm2 list

```



\### ðŸ›‘ TRAVA 6 â€” bloquear (ir para Rollback) se houver



\- \[ ] Erro de conexÃ£o com banco (`password authentication failed`, `ECONNREFUSED`).

\- \[ ] Erro de decrypt em qualquer log.

\- \[ ] Erro de env ausente (validaÃ§Ã£o do `env.ts`).

\- \[ ] Crash loop no PM2 (restarts incrementando).



\---



\## Passo 13 â€” Smoke test obrigatÃ³rio



\### 13.0 ðŸ”´ OBRIGATÃ“RIO â€” validar leitura de dado cifrado COM maintenance ativo



A leitura real de dado cifrado precisa ser validada \*\*antes\*\* de desligar `MAINTENANCE\_MODE`. \*\*NÃ£o desligar a manutenÃ§Ã£o "sÃ³ para testar"\*\* â€” isso reabre escrita pÃºblica sobre um banco recÃ©m-recifrado.



\*\*Recon confirmado:\*\* o `middleware.ts` \*\*nÃ£o\*\* tem bypass seguro para `/api/\*` em manutenÃ§Ã£o. Em maintenance, o middleware permite apenas `/api/health` e `/manutencao`. Portanto o \*\*caminho oficial Ã© a validaÃ§Ã£o direta no banco\*\* (script temporÃ¡rio abaixo). Smoke de UI fica para depois da reabertura (ver nota ao final do 13.1).



\#### Script temporÃ¡rio de validaÃ§Ã£o local (NÃƒO commitar, NÃƒO criar no repo)



Criar como `$ROT\_DIR/validate\_decrypt.sql` (vive sÃ³ no diretÃ³rio protegido e morre com a limpeza). As 7 colunas cifradas reais sÃ£o:



| Tabela | Coluna |

|---|---|

| `service\_sites` | `address\_encrypted` â† \*\*validar esta primeiro, se houver row\*\* |

| `session\_presence\_proofs` | `latitude\_encrypted` |

| `session\_presence\_proofs` | `longitude\_encrypted` |

| `session\_presence\_proofs` | `ip\_address\_encrypted` |

| `session\_attestations` | `ip\_address\_encrypted` |

| `session\_attestations` | `canvas\_data\_encrypted` |

| `session\_attachments` | `extracted\_geo\_encrypted` |



Se a tabela escolhida nÃ£o tiver row cifrada (`LIMIT 1` vazio), testar a prÃ³xima da lista. Usar a \*\*mesma funÃ§Ã£o de decrypt\*\* do `rotate\_encryption\_key.sql` (ex.: `pgp\_sym\_decrypt` â€” conferir no cabeÃ§alho do script, Passo 8):



```sql

\-- validate\_decrypt.sql â€” valida 1 row real com a CHAVE NOVA

\-- Alvo preferencial: service\_sites.address\_encrypted.

\-- Sem rows? Trocar tabela/coluna pela prÃ³xima da lista acima.

SET app.encryption\_key\_new = :'newkey';



SELECT

&#x20; id,

&#x20; octet\_length(address\_encrypted) AS bytes\_cifrados,

&#x20; left(pgp\_sym\_decrypt(address\_encrypted, current\_setting('app.encryption\_key\_new')), 12) AS amostra\_decifrada

FROM service\_sites

WHERE address\_encrypted IS NOT NULL

LIMIT 1;

```



ExecuÃ§Ã£o (segredo sÃ³ em variÃ¡vel, nunca no comando):



```bash

ROT\_DIR="$(ls -td /root/axis-secret-rotation-\* | head -1)"

NEW\_AXIS\_KEY="$(cat "$ROT\_DIR/AXIS\_ENCRYPTION\_KEY.new")"



docker exec -i axis-postgres psql -U axis -d axis\_tcc -v ON\_ERROR\_STOP=1 \\

&#x20; -v newkey="$NEW\_AXIS\_KEY" < "$ROT\_DIR/validate\_decrypt.sql"



unset NEW\_AXIS\_KEY

```



Resultado esperado: `amostra\_decifrada` retorna texto legÃ­vel (12 chars do dado real â€” para `service\_sites.address\_encrypted`, inÃ­cio de um endereÃ§o). Erro `Wrong key or corrupt data` (ou equivalente) = recifra inconsistente â†’ \*\*Rollback CenÃ¡rio 3\*\*.



Recomendado: validar pelo menos \*\*2 colunas de tabelas diferentes\*\* (ex.: `service\_sites.address\_encrypted` + `session\_attestations.ip\_address\_encrypted`) antes de considerar o 13.0 verde.



âš ï¸ A amostra decifrada Ã© dado real (endereÃ§o/IP/geo) â€” nÃ£o colar o output em chat/print. Conferir no terminal e descartar.



\### 13.1 Prod â€” checklist (com maintenance ainda ativo)



\- \[ ] \*\*13.0 verde\*\* (leitura real de dado cifrado validada direto no banco). â† item mais importante da janela.

\- \[ ] Login funciona.

\- \[ ] Abrir um \*\*paciente existente\*\* â†’ dados aparecem corretamente.

\- \[ ] Criar uma sessÃ£o (fluxo que \*\*grava\*\* no banco) â†’ sucesso.

\- \[ ] Worker/transcriÃ§Ã£o: enviar/verificar um job, se aplicÃ¡vel.

\- \[ ] Crons internos respondem com o `CRON\_SECRET` novo (repetir teste do Passo 3.4 se necessÃ¡rio).

\- \[ ] `pm2 logs axis-tcc` sem erro de decrypt.

\- \[ ] `pm2 logs` sem erro de conexÃ£o com banco.



> Itens de UI (login/paciente/sessÃ£o): sem bypass no middleware (sÃ³ `/api/health` e `/manutencao` passam em maintenance), eles sÃ£o confirmados imediatamente apÃ³s o Passo 14, como primeira aÃ§Ã£o pÃ³s-reabertura, com rollback ainda disponÃ­vel. O critÃ©rio crÃ­tico de decrypt jÃ¡ foi garantido pelo 13.0 antes da reabertura. \*\*NÃ£o desligar maintenance temporariamente para antecipar o teste de UI.\*\*



\### Staging



\- \[ ] `axis-staging` sobe e fica `online` no PM2.

\- \[ ] ConexÃ£o com `axis\_tcc\_staging` funciona apÃ³s a troca de `DATABASE\_PASSWORD`.

\- \[ ] Logs sem erro crÃ­tico.



\### ðŸ”´ REGRA DE OURO DA JANELA



\*\*NÃ£o desligar a manutenÃ§Ã£o sem leitura real de dado cifrado em prod funcionando.\*\* Se a leitura cifrada falhar â†’ Rollback CenÃ¡rio 3, sem exceÃ§Ã£o.



\---



\## Passo 14 â€” Desligar manutenÃ§Ã£o



Somente com o Passo 13 inteiro verde.



Editar `/root/axis-tcc/.env`:



```txt

MAINTENANCE\_MODE=false

```



```bash

pm2 restart axis-tcc --update-env

```



Validar app pÃºblico:



```bash

curl -i "https://axisclinico.com/"

curl -i "https://axisclinico.com/manutencao"

```



Esperado: `/` responde normal; `/manutencao` continua acessÃ­vel como pÃ¡gina estÃ¡tica mas o app nÃ£o redireciona mais para ela.



\### âœ… Fim da FASE B â€” janela encerrada.



\---



\# FASE C â€” Limpeza pÃ³s-rotaÃ§Ã£o



\## Passo 15 â€” Remover `CRON\_SECRET\_OLD`



Remover a linha `CRON\_SECRET\_OLD=` de:



\- `/root/axis-tcc/.env`

\- `/root/axis-tcc-staging/.env` (se existir)



```bash

pm2 restart axis-tcc --update-env

pm2 restart axis-staging --update-env

```



Re-testar um cron com o secret novo (Passo 3.4) para confirmar que nada dependia do antigo.



\---



\## Passo 16 â€” Remover default hardcoded do cÃ³digo



> Este passo Ã© \*\*cÃ³digo + commit\*\*, feito localmente no Windows (nÃ£o na VPS), pelo fluxo normal Claude/CC â†’ AlÃª commita.



Arquivo: `src/lib/env.ts` (linha \~26).



Remover o fallback `'AxisTcc2026!'`. Regra da correÃ§Ã£o:



\- Segredo obrigatÃ³rio ausente deve \*\*falhar explicitamente\*\* no boot (throw na validaÃ§Ã£o de env).

\- Nenhum fallback de senha em produÃ§Ã£o.

\- Nenhum segredo real em cÃ³digo.



Commit sugerido:



```txt

fix(security): remove hardcoded database password fallback

```



Depois do merge: deploy normal na VPS (`git pull` + `npm run next:build` + `pm2 restart axis-tcc --update-env`) e confirmar que o app sobe (o `.env` jÃ¡ tem `DATABASE\_PASSWORD` vÃ¡lida, entÃ£o o boot nÃ£o pode falhar).



\---



\## Passo 17 â€” Remover backup antigo inseguro



Motivo: `/root/axis-tcc-backup-25fev` contÃ©m a senha velha legÃ­vel no bundle. ApÃ³s a rotaÃ§Ã£o ele nÃ£o protege nada e ainda expÃµe o segredo antigo.



```bash

rm -rf /root/axis-tcc-backup-25fev



ls -la /root | grep axis-tcc-backup-25fev || echo "backup antigo removido"

```



Opcional (recomendado depois de alguns dias de operaÃ§Ã£o estÃ¡vel): remover tambÃ©m os arquivos `\*.new` de `$ROT\_DIR`, mantendo apenas os dumps atÃ© a prÃ³xima rotina de backup.



\---



\# ROLLBACK â€” Fase B



> Em \*\*todos\*\* os cenÃ¡rios: primeira aÃ§Ã£o Ã© garantir `MAINTENANCE\_MODE=true`. Nunca fazer rollback com app aberto ao pÃºblico.



\## CenÃ¡rio 1 â€” Falha ANTES da recifra (build, deploy, maintenance, backup)



1\. Manter/ativar `MAINTENANCE\_MODE=true` em `/root/axis-tcc/.env`.

2\. Restaurar o `.env` anterior se algo jÃ¡ foi alterado â€” fonte principal: `$ROT\_DIR/env.prod.before\_f3` (e `$ROT\_DIR/env.staging.before\_f3` se staging foi tocado).

3\. `pm2 restart axis-tcc --update-env`.

4\. Validar que o app funciona com a configuraÃ§Ã£o antiga.

5\. Desligar maintenance \*\*apenas se\*\* o app estiver Ã­ntegro. Reagendar a janela.



\## CenÃ¡rio 2 â€” Falha DURANTE a recifra (SQL retornou erro)



1\. Manter `MAINTENANCE\_MODE=true`.

2\. \*\*NÃ£o trocar\*\* `AXIS\_ENCRYPTION\_KEY` no `.env` (a chave antiga continua sendo a correta).

3\. Revisar o erro do psql. Com `ON\_ERROR\_STOP=1` + transaÃ§Ã£o, a falha aborta sem commit parcial.

4\. Confirmar que nada foi alterado: rodar a contagem/preflight do script ou ler uma amostra cifrada com a chave antiga via app.

5\. Se nada mudou: corrigir a causa e repetir o Passo 9.

6\. Se houver \*\*qualquer suspeita\*\* de alteraÃ§Ã£o parcial: restaurar o dump (procedimento do CenÃ¡rio 3, itens 2â€“6).



\## CenÃ¡rio 3 â€” Recifra concluiu, mas o app NÃƒO lÃª dados cifrados



1\. Manter `MAINTENANCE\_MODE=true`.

2\. Restaurar o dump do banco prod:



```bash

ROT\_DIR="$(ls -td /root/axis-secret-rotation-\* | head -1)"

DUMP="$(ls -t "$ROT\_DIR"/axis\_tcc.before\_f3\_\*.dump | head -1)"



\# encerra conexÃµes e restaura por cima (--clean recria objetos)

docker exec -i axis-postgres psql -U axis -d postgres -c "SELECT pg\_terminate\_backend(pid) FROM pg\_stat\_activity WHERE datname='axis\_tcc' AND pid <> pg\_backend\_pid();"



docker exec -i axis-postgres pg\_restore -U axis -d axis\_tcc --clean --if-exists < "$DUMP"

```



3\. Restaurar a \*\*chave antiga\*\* no `.env` prod â€” fonte: `$ROT\_DIR/env.prod.before\_f3` (Ã© o Ãºnico backup garantido com a `AXIS\_ENCRYPTION\_KEY` antiga; \*\*nÃ£o\*\* usar `env.prod.before\_dbpass`, que jÃ¡ contÃ©m a chave nova). Restaurar o arquivo inteiro ou copiar sÃ³ a linha `AXIS\_ENCRYPTION\_KEY=` dele, conforme o ponto da janela.

4\. `pm2 restart axis-tcc --update-env`.

5\. Testar \*\*leitura real de dado cifrado\*\* com a chave antiga.

6\. SÃ³ desligar maintenance apÃ³s leitura normal. Investigar a causa antes de tentar de novo.



\## CenÃ¡rio 4 â€” Falha APÃ“S troca de `DATABASE\_PASSWORD`



1\. Verificar se o `ALTER USER` foi de fato aplicado (tentar conectar com a senha nova):



```bash

ROT\_DIR="$(ls -td /root/axis-secret-rotation-\* | head -1)"

PGPASSWORD="$(cat "$ROT\_DIR/DATABASE\_PASSWORD.new")" docker exec -i -e PGPASSWORD axis-postgres psql -U axis -d axis\_tcc -c "SELECT 1;"

```



2\. Validar `DATABASE\_PASSWORD` nos dois `.env` (prod e staging) â€” devem ser idÃªnticos e iguais ao `.new`.

3\. `pm2 restart` de todos com `--update-env`.

4\. Se necessÃ¡rio, restaurar temporariamente os `.env` do snapshot da troca de senha (`$ROT\_DIR/env.\*.before\_dbpass`); se o problema for anterior Ã  Fase B, o ground truth Ã© `$ROT\_DIR/env.\*.before\_f3`.

5\. Se for voltar Ã  senha anterior: aplicar novamente `ALTER USER axis WITH PASSWORD '<senha anterior>'` (senha extraÃ­da de `env.prod.before\_f3` ou `env.prod.before\_dbpass` â€” nos dois ela Ã© a antiga), depois `.env` â†’ restart, na mesma ordem do Passo 11.



\---



\# CHECKLIST FINAL â€” CritÃ©rio de conclusÃ£o F3



F3 sÃ³ pode ser marcado como concluÃ­do quando \*\*todos\*\* os itens estiverem âœ…:



\- \[ ] `CRON\_SECRET` rotacionado

\- \[ ] `CRON\_SECRET\_OLD` removido apÃ³s smoke

\- \[ ] `INTERNAL\_API\_KEY` rotacionada

\- \[ ] `AXIS\_ENCRYPTION\_KEY` recifrada \*\*somente em prod\*\* (`axis\_tcc`)

\- \[ ] Dados cifrados lidos corretamente em prod

\- \[ ] `DATABASE\_PASSWORD` trocada no Postgres (`ALTER USER`)

\- \[ ] `DATABASE\_PASSWORD` atualizada em prod \*\*e\*\* staging

\- \[ ] `axis-tcc` reiniciado com `--update-env`

\- \[ ] `axis-staging` reiniciado com `--update-env`

\- \[ ] `axis-worker-transcribe` reiniciado com `--update-env`

\- \[ ] `MAINTENANCE\_MODE=false`

\- \[ ] Smoke prod verde

\- \[ ] Smoke staging verde

\- \[ ] Default `AxisTcc2026!` removido de `src/lib/env.ts`

\- \[ ] `/root/axis-tcc-backup-25fev` removido

\- \[ ] \*\*Nenhum segredo novo apareceu em chat, commit, print, log ou documentaÃ§Ã£o\*\*



\---



\*Runbook F3 Â· AXIS ClÃ­nico Â· gerado em 12/06/2026 Â· executor: AlÃª (VPS root@vmi2884668)\*


