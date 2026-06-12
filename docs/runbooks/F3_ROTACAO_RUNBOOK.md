\# F3 — RUNBOOK DA JANELA DE ROTAÇÃO DE SEGREDOS



> \*\*AXIS Clínico · Auditoria de Segurança · Pendência F3\*\*

> Repo: `Aleporto73/axis-tcc` · VPS: `root@vmi2884668`

> Pré-requisito: commit `68a62d7` (MAINTENANCE\_MODE + `scripts/jobs/rotate\_encryption\_key.sql`) já em prod via deploy da Fase B.



\---



\## ⚠️ REGRA DE OURO — vale para o runbook inteiro



\*\*NUNCA imprimir, colar, logar, commitar ou documentar valor de segredo.\*\*



\- Não usar `cat` para exibir segredo no terminal.

\- Não colar segredo em chat (Claude/CC), print, issue ou commit.

\- Sempre carregar segredo em variável local de shell e dar `unset` depois.

\- Se um segredo vazar em qualquer canal, ele está comprometido: gerar outro.



\---



\## Mapa do ambiente (confirmado)



| Item | Valor |

|---|---|

| App PROD | `/root/axis-tcc` · PM2 `axis-tcc` · db `axis\_tcc` |

| App STAGING | `/root/axis-tcc-staging` · PM2 `axis-staging` · db `axis\_tcc\_staging` |

| Worker | PM2 `axis-worker-transcription` |

| Banco | Docker container `axis-postgres`, user `axis` |

| `.env` | `/root/axis-tcc/.env` e `/root/axis-tcc-staging/.env` |

| Build | `npm run next:build` (\*\*NÃO existe `npm run build`\*\*) |

| SQL recifra | `/root/axis-tcc/scripts/jobs/rotate\_encryption\_key.sql` |



Fatos que governam a janela:



\- `DATABASE\_PASSWORD` é \*\*igual\*\* em prod e staging → trocar \*\*nos dois\*\* `.env`.

\- `AXIS\_ENCRYPTION\_KEY` existe \*\*só em prod\*\* (hash `6e22fe5c`); staging está \*\*vazia\*\* (hash `e3b0c442` = string vazia).

\- Portanto: \*\*recifra roda SOMENTE no banco `axis\_tcc` (prod). NUNCA em `axis\_tcc\_staging`.\*\*

\- O SQL de rotação usa `app.encryption\_key\_old` / `app.encryption\_key\_new` via `SET` / `current\_setting`.



\---



\## 🔴 BLOCKERS — resolver ANTES de executar a janela



Este runbook foi gerado sem acesso ao repo/VPS. Itens abaixo são placeholders que \*\*bloqueiam\*\* a execução até serem substituídos:



| # | Placeholder | Onde resolver |

|---|---|---|

| B1 | `DOMINIO\_PROD\_CONFIRMAR` (domínio prod) | Recon do Passo 3.4: `grep -E '^(NEXT\_PUBLIC\_APP\_URL\\|GOOGLE\_REDIRECT\_URI)=' /root/axis-tcc/.env` (só essas duas chaves) |

| B2 | `ROTA\_REAL\_CRON\_\*` (rotas cron) | Recon do Passo 3.4: `ls -R .../app/api/cron` |

| B3 | `ROTA\_REAL` (rota de API p/ validar 503) | Qualquer rota real de API do AXIS (Passo 6) |

| B4 | Bypass do middleware em manutenção (existe ou não?) | Recon do Passo 13.0 — define Caminho A ou B do smoke decrypt |

| B5 | `TABELA\_CIFRADA` / `COLUNA\_CIFRADA` do script de validação | Cabeçalho de `rotate\_encryption\_key.sql` (Passo 13.0-B) |



\---



\## Visão geral das fases



| Fase | O quê | Downtime |

|---|---|---|

| A | `CRON\_SECRET` + `INTERNAL\_API\_KEY` (rotação a quente) | Zero |

| B | Backup → MAINTENANCE\_MODE → recifra `AXIS\_ENCRYPTION\_KEY` (só prod) → `DATABASE\_PASSWORD` → smoke → reabrir | 15–30 min |

| C | Limpeza: `CRON\_SECRET\_OLD`, default hardcoded, backup antigo | Zero |



\*\*Ponto crítico da janela:\*\* `recifra concluída + .env com chave nova + restart do app`. Antes de desligar a manutenção, a \*\*leitura real de dado cifrado em prod\*\* precisa estar verde.



\---



\# FASE A — Rotação a quente (sem downtime)



\## Passo 1 — Preflight read-only



Tudo neste passo é só leitura. Nada é alterado.



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



\### 🛑 TRAVA 1 — não prosseguir se qualquer item abaixo falhar



\- \[ ] `git status` limpo em prod \*\*e\*\* staging (working tree sem alterações).

\- \[ ] Container `axis-postgres` rodando (`Status: Up`).

\- \[ ] Os dois `.env` existem.

\- \[ ] PM2 mostra os 3 processos: `axis-tcc`, `axis-staging`, `axis-worker-transcription` (status `online`).

\- \[ ] `rotate\_encryption\_key.sql` existe e o cabeçalho confere com o esperado (`app.encryption\_key\_old` / `app.encryption\_key\_new`).



Se algo falhar: \*\*parar aqui\*\*, investigar e só voltar com tudo verde.



\---



\## Passo 2 — Gerar novos valores na VPS (CRON\_SECRET e INTERNAL\_API\_KEY)



Os segredos nascem \*\*dentro da VPS\*\*, em diretório protegido, nunca no chat.



```bash

umask 077



ROT\_DIR="/root/axis-secret-rotation-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$ROT\_DIR"

chmod 700 "$ROT\_DIR"



\# === BACKUP DOS .env ANTES DE QUALQUER ALTERAÇÃO DE SEGREDO (ground truth do rollback F3) ===

cp -a /root/axis-tcc/.env "$ROT\_DIR/env.prod.before\_f3"

cp -a /root/axis-tcc-staging/.env "$ROT\_DIR/env.staging.before\_f3"

chmod 600 "$ROT\_DIR"/env.\*.before\_f3



openssl rand -hex 32 > "$ROT\_DIR/CRON\_SECRET.new"

openssl rand -hex 32 > "$ROT\_DIR/INTERNAL\_API\_KEY.new"



chmod 600 "$ROT\_DIR"/\*

ls -la "$ROT\_DIR"

```



⚠️ \*\*Não usar `cat` para "conferir" os valores.\*\* O `ls -la` confirma que existem e têm tamanho > 0. Para usar um valor, carregar em variável:



```bash

ROT\_DIR="$(ls -td /root/axis-secret-rotation-\* | head -1)"

\# exemplo de uso pontual (não imprimir):

\# NOVO="$(cat "$ROT\_DIR/CRON\_SECRET.new")"

```



\---



\## Passo 3 — Rotacionar `CRON\_SECRET` (modo graceful)



\### 3.1 Editar `.env` prod



Editar `/root/axis-tcc/.env`:



1\. Copiar o valor \*\*atual\*\* de `CRON\_SECRET` para uma nova linha `CRON\_SECRET\_OLD=` (o middleware graceful aceita o antigo durante a transição).

2\. Substituir `CRON\_SECRET` pelo conteúdo de `$ROT\_DIR/CRON\_SECRET.new` (abrir o `.env` no editor e colar a partir do arquivo, sem ecoar no terminal — ex.: dentro do `nano`, ler com `Ctrl+R $ROT\_DIR/CRON\_SECRET.new`).



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



⚠️ Ao editar o crontab, o secret novo será gravado ali — isso é esperado (o crontab é o caller), mas \*\*não colar o conteúdo do crontab em chat/print\*\*.



\### 3.4 Testar crons sem expor segredo



\*\*Recon prévio (obrigatório — resolve os placeholders abaixo):\*\*



```bash

\# rotas cron reais do projeto:

ls -R /root/axis-tcc/src/app/api/cron 2>/dev/null || ls -R /root/axis-tcc/app/api/cron 2>/dev/null



\# domínio prod — ler SOMENTE chaves públicas, nunca o .env inteiro:

grep -E '^(NEXT\_PUBLIC\_APP\_URL|GOOGLE\_REDIRECT\_URI)=' /root/axis-tcc/.env

```



⚠️ O grep acima é restrito a duas chaves públicas — \*\*não\*\* rodar `cat /root/axis-tcc/.env` nem grep aberto. Anotar o domínio e as rotas e substituir `DOMINIO\_PROD\_CONFIRMAR` / `ROTA\_REAL\_CRON\_\*` em todo o runbook.



```bash

ROT\_DIR="$(ls -td /root/axis-secret-rotation-\* | head -1)"

CRON\_SECRET\_NEW="$(cat "$ROT\_DIR/CRON\_SECRET.new")"



\# SUBSTITUIR pelas rotas encontradas no recon acima (uma linha por rota cron existente):

curl -i -H "Authorization: Bearer ${CRON\_SECRET\_NEW}" "https://DOMINIO\_PROD\_CONFIRMAR/ROTA\_REAL\_CRON\_1"

curl -i -H "Authorization: Bearer ${CRON\_SECRET\_NEW}" "https://DOMINIO\_PROD\_CONFIRMAR/ROTA\_REAL\_CRON\_2"

curl -i -H "Authorization: Bearer ${CRON\_SECRET\_NEW}" "https://DOMINIO\_PROD\_CONFIRMAR/ROTA\_REAL\_CRON\_3"



unset CRON\_SECRET\_NEW

```



Esperado: `200` (ou status normal da rota). `401/403` = secret não bateu → revisar `.env` e restart.



⚠️ Se o output do `curl` contiver qualquer header com segredo, \*\*não colar em chat\*\*.



\### 3.5 Staging



\- Se staging tem cron com `CRON\_SECRET`: repetir 3.1–3.4 em `/root/axis-tcc-staging/.env` + `pm2 restart axis-staging --update-env`.

\- Se staging \*\*não\*\* usa cron: registrar aqui como \*\*"não aplicável"\*\* e seguir.



\### 3.6 Remover `CRON\_SECRET\_OLD`



⏳ \*\*Só na FASE C (Passo 15), após smoke completo verde.\*\* Não remover agora.



\---



\## Passo 4 — Rotacionar `INTERNAL\_API\_KEY`



1\. Editar `/root/axis-tcc/.env`: substituir `INTERNAL\_API\_KEY` pelo conteúdo de `$ROT\_DIR/INTERNAL\_API\_KEY.new` (mesma técnica do Passo 3.1 — sem ecoar).

2\. Verificar se staging usa `INTERNAL\_API\_KEY`:



```bash

grep -c '^INTERNAL\_API\_KEY=' /root/axis-tcc-staging/.env || echo "staging nao usa INTERNAL\_API\_KEY"

```



3\. Se staging usa: trocar também em `/root/axis-tcc-staging/.env` (mesmo valor novo).

4\. Verificar se o worker usa a key:



```bash

pm2 env axis-worker-transcription | grep -c INTERNAL\_API\_KEY || echo "worker nao usa INTERNAL\_API\_KEY"

```



5\. Reiniciar os afetados:



```bash

pm2 restart axis-tcc --update-env

pm2 restart axis-staging --update-env

\# somente se o worker usar a key:

pm2 restart axis-worker-transcription --update-env

```



6\. Smoke rápido: qualquer fluxo interno que use a key (ex.: chamada interna app→worker) deve funcionar. Logs sem `401/403` interno:



```bash

pm2 logs axis-tcc --lines 60 --nostream

```



\### ✅ Fim da FASE A



`CRON\_SECRET` e `INTERNAL\_API\_KEY` rotacionados, app no ar, zero downtime. Pode pausar aqui e agendar a FASE B para a janela de manutenção.



\---



\# FASE B — Janela com MAINTENANCE\_MODE (downtime planejado 15–30 min)



> \*\*Escopo da recifra: SOMENTE o banco `axis\_tcc` (prod). NUNCA rodar a recifra em `axis\_tcc\_staging`.\*\*

> Staging tem `AXIS\_ENCRYPTION\_KEY` vazia e não cifra dados.



\## Passo 5 — Backup obrigatório (bloqueante)



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



\### 🛑 TRAVA 2 — não prosseguir sem backup válido



\- \[ ] Arquivo `.dump` de `axis\_tcc` existe.

\- \[ ] Tamanho > 0 e \*\*plausível\*\* para o volume do banco (não pode ser alguns KB se o banco tem dados reais).

\- \[ ] Sem erro no `pg\_dump`.



\*\*Backup falhou = janela abortada.\*\* Sem dump não existe rollback do Cenário 3.



\---



\## Passo 6 — Deploy do código com MAINTENANCE\_MODE



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



⚠️ \*\*NÃO usar `npm run build`\*\* — esse script não existe e trava a janela.



Depois, editar `/root/axis-tcc/.env` e setar:



```txt

MAINTENANCE\_MODE=true

```



Reiniciar:



```bash

pm2 restart axis-tcc --update-env

```



Validar manutenção ativa (usar \*\*rota real\*\* de API, não wildcard `/api/\*`):



```bash

curl -i "https://DOMINIO\_PROD\_CONFIRMAR/manutencao"



\# SUBSTITUIR por uma rota real de API existente do AXIS:

curl -i "https://DOMINIO\_PROD\_CONFIRMAR/api/ROTA\_REAL"

```



\### 🛑 TRAVA 3 — não prosseguir se a manutenção não estiver ativa



\- \[ ] `/manutencao` abre (200).

\- \[ ] Rota real de API retorna \*\*503\*\*.

\- \[ ] Build concluiu sem erro.



App ainda recebendo tráfego de escrita = recifra em banco vivo = risco de corrupção. \*\*Não seguir.\*\*



\---



\## Passo 7 — Gerar nova `AXIS\_ENCRYPTION\_KEY`



```bash

ROT\_DIR="$(ls -td /root/axis-secret-rotation-\* | head -1)"



openssl rand -hex 32 > "$ROT\_DIR/AXIS\_ENCRYPTION\_KEY.new"

chmod 600 "$ROT\_DIR/AXIS\_ENCRYPTION\_KEY.new"

ls -la "$ROT\_DIR/AXIS\_ENCRYPTION\_KEY.new"

```



⚠️ Não imprimir, não colar em chat, não commitar, não salvar fora de `$ROT\_DIR`.



\---



\## Passo 8 — Validar o SQL antes de executar (bloqueante)



```bash

sed -n '1,220p' /root/axis-tcc/scripts/jobs/rotate\_encryption\_key.sql

```



\### 🛑 TRAVA 4 — checklist de leitura manual do SQL



Confirmar \*\*lendo o script\*\*, item a item:



\- \[ ] Lê `app.encryption\_key\_old` via `current\_setting` (ou equivalente).

\- \[ ] Lê `app.encryption\_key\_new` via `current\_setting` (ou equivalente).

\- \[ ] Tem preflight/dry-run ou contagem de linhas \*\*antes\*\* de alterar.

\- \[ ] Deixa explícito quais \*\*7 colunas BYTEA\*\* serão recifradas.

\- \[ ] Roda em transação (`BEGIN`/`COMMIT`) ou tem comportamento seguro em erro (com `ON\_ERROR\_STOP=1` aborta sem commit parcial).

\- \[ ] Nada no script referencia `axis\_tcc\_staging` — alvo é apenas `axis\_tcc`.



\*\*Qualquer dúvida em qualquer item = não seguir.\*\* Parar e revisar com o Claude/CC antes.



\---



\## Passo 9 — Rodar a recifra (SOMENTE PROD)



> 🔴 Banco alvo: `axis\_tcc`. \*\*Conferir o `-d axis\_tcc` no comando antes de dar Enter.\*\*



Forma preferida (injeta os `SET` antes do script, tudo via stdin, segredo só em variável):



```bash

ROT\_DIR="$(ls -td /root/axis-secret-rotation-\* | head -1)"



OLD\_AXIS\_KEY="$(grep '^AXIS\_ENCRYPTION\_KEY=' /root/axis-tcc/.env | cut -d= -f2-)"

NEW\_AXIS\_KEY="$(cat "$ROT\_DIR/AXIS\_ENCRYPTION\_KEY.new")"



\# escape de aspas simples (mesma técnica do Passo 11.3) — protege o SET contra quebra de sintaxe SQL

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



⚠️ Se o cabeçalho do script já fizer `SET` interno ou exigir outro formato de invocação, ajustar conforme o próprio cabeçalho (lido no Passo 8). Nota: `SET` é por sessão — os dois `SET` e o script precisam ir na \*\*mesma\*\* chamada `psql`, como acima.



\### 🛑 TRAVA 5 — validar saída da recifra



Bloquear (e ir para Rollback) se:



\- \[ ] O psql retornou erro (qualquer linha `ERROR`).

\- \[ ] A contagem/dry-run do script indicou inconsistência (linhas esperadas ≠ processadas).

\- \[ ] Apareceu qualquer erro de decrypt/encrypt.

\- \[ ] O script tentou tocar staging.



Tudo verde → seguir.



⚠️ Não colar o output completo em chat se contiver fragmentos de chave.



\---



\## Passo 10 — Trocar `AXIS\_ENCRYPTION\_KEY` no `.env` (SÓ PROD)



Editar \*\*somente\*\* `/root/axis-tcc/.env`:



```txt

AXIS\_ENCRYPTION\_KEY=<conteúdo de $ROT\_DIR/AXIS\_ENCRYPTION\_KEY.new>

```



(Colar a partir do arquivo dentro do editor, sem ecoar no terminal.)



🔴 \*\*NÃO trocar em staging.\*\* Motivo: staging tem chave vazia, não cifra dados, e a recifra só rodou em prod. Colocar a chave em staging criaria divergência sem dados correspondentes.



⏳ O restart vem no Passo 12 (junto com a troca de senha do banco), para reiniciar uma vez só.



\---



\## Passo 11 — Trocar `DATABASE\_PASSWORD`



\### Ordem obrigatória — por quê



1\. Gerar nova senha → 2. `ALTER USER` no Postgres → 3. Atualizar os \*\*dois\*\* `.env` → 4. \*\*Só depois\*\* restart PM2.



\- Se trocar `.env` \*\*antes\*\* do `ALTER USER`: o app reconecta com senha que o banco ainda não conhece → falha.

\- Se trocar o banco e \*\*demorar\*\* a atualizar `.env`: o pool, ao renovar conexão, usa a senha velha → app cai.

\- A janela entre `ALTER USER` e o restart é tolerada porque o app está em MAINTENANCE\_MODE e as conexões do pool já abertas continuam válidas.



\### 11.1 Gerar



```bash

ROT\_DIR="$(ls -td /root/axis-secret-rotation-\* | head -1)"



openssl rand -hex 32 > "$ROT\_DIR/DATABASE\_PASSWORD.new"

chmod 600 "$ROT\_DIR/DATABASE\_PASSWORD.new"

```



\### 11.2 Backup adicional dos `.env` (snapshot específico da troca de senha)



> O \*\*ground truth\*\* do rollback F3 é o backup feito no Passo 2 (`env.prod.before\_f3` / `env.staging.before\_f3`). Este snapshot extra captura o estado já com `CRON\_SECRET`/`INTERNAL\_API\_KEY`/`AXIS\_ENCRYPTION\_KEY` novos, útil para reverter \*\*só\*\* a troca de senha sem desfazer a Fase A/recifra.



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

DATABASE\_PASSWORD=<conteúdo de $ROT\_DIR/DATABASE\_PASSWORD.new>

```



(Mesmo valor nos dois — a senha é do user `axis`, compartilhado.)



\---



\## Passo 12 — Reiniciar todos os processos



```bash

pm2 restart axis-tcc --update-env

pm2 restart axis-worker-transcription --update-env

pm2 restart axis-staging --update-env

```



Logs:



```bash

pm2 logs axis-tcc --lines 120 --nostream

pm2 logs axis-worker-transcription --lines 120 --nostream

pm2 logs axis-staging --lines 120 --nostream

pm2 list

```



\### 🛑 TRAVA 6 — bloquear (ir para Rollback) se houver



\- \[ ] Erro de conexão com banco (`password authentication failed`, `ECONNREFUSED`).

\- \[ ] Erro de decrypt em qualquer log.

\- \[ ] Erro de env ausente (validação do `env.ts`).

\- \[ ] Crash loop no PM2 (restarts incrementando).



\---



\## Passo 13 — Smoke test obrigatório



\### 13.0 🔴 BLOCKER OPERACIONAL — validar leitura de dado cifrado COM maintenance ativo



A leitura real de dado cifrado precisa ser validada \*\*antes\*\* de desligar `MAINTENANCE\_MODE`. \*\*Não desligar a manutenção "só para testar"\*\* — isso reabre escrita pública sobre um banco recém-recifrado.



\*\*Recon (fazer agora, na VPS):\*\* verificar se o `middleware.ts` já tem bypass seguro para `/api/\*` em manutenção (header interno, IP allowlist ou similar):



```bash

grep -n -i "maintenance\\|bypass\\|allowlist\\|x-internal\\|x-maintenance" /root/axis-tcc/src/middleware.ts /root/axis-tcc/middleware.ts 2>/dev/null

```



\*\*Caminho A — existe bypass implementado:\*\* usar o mecanismo encontrado para chamar uma rota real que \*\*leia dado cifrado\*\* (ex.: detalhe de paciente). Estrutura (ajustar header/rota conforme o que o grep revelou):



```bash

\# exemplo estrutural — substituir HEADER\_BYPASS e rota conforme o middleware real

curl -i -H "x-HEADER\_BYPASS: VALOR\_DO\_ENV" "https://DOMINIO\_PROD\_CONFIRMAR/api/ROTA\_QUE\_LE\_DADO\_CIFRADO"

```



⚠️ Se o bypass usa segredo do `.env`, carregar em variável local (técnica do Passo 3.4) — nunca digitar o valor no comando nem colar output com o header em chat.



\*\*Caminho B — NÃO existe bypass:\*\* não inventar bypass nem editar o middleware durante a janela. Validar \*\*direto no banco\*\*, localmente na VPS, com o script temporário abaixo.



\#### Script temporário sugerido para validação local (NÃO commitar, NÃO criar no repo)



Criar como `$ROT\_DIR/validate\_decrypt.sql` (vive só no diretório protegido e morre com a limpeza). Pegar `TABELA\_CIFRADA` / `COLUNA\_CIFRADA` reais no cabeçalho de `rotate\_encryption\_key.sql` (lá estão as 7 colunas) e usar a \*\*mesma função de decrypt\*\* que o script de rotação usa (ex.: `pgp\_sym\_decrypt`):



```sql

\-- validate\_decrypt.sql — valida 1 row real com a CHAVE NOVA

\-- Substituir TABELA\_CIFRADA e COLUNA\_CIFRADA pelos nomes reais do cabeçalho do rotate\_encryption\_key.sql

SET app.encryption\_key\_new = :'newkey';



SELECT

&#x20; id,

&#x20; octet\_length(COLUNA\_CIFRADA) AS bytes\_cifrados,

&#x20; left(pgp\_sym\_decrypt(COLUNA\_CIFRADA, current\_setting('app.encryption\_key\_new')), 12) AS amostra\_decifrada

FROM TABELA\_CIFRADA

WHERE COLUNA\_CIFRADA IS NOT NULL

LIMIT 1;

```



Execução (segredo só em variável, nunca no comando):



```bash

ROT\_DIR="$(ls -td /root/axis-secret-rotation-\* | head -1)"

NEW\_AXIS\_KEY="$(cat "$ROT\_DIR/AXIS\_ENCRYPTION\_KEY.new")"



docker exec -i axis-postgres psql -U axis -d axis\_tcc -v ON\_ERROR\_STOP=1 \\

&#x20; -v newkey="$NEW\_AXIS\_KEY" < "$ROT\_DIR/validate\_decrypt.sql"



unset NEW\_AXIS\_KEY

```



Resultado esperado: `amostra\_decifrada` retorna texto legível (12 chars do dado real). Erro `Wrong key or corrupt data` (ou equivalente) = recifra inconsistente → \*\*Rollback Cenário 3\*\*.



⚠️ A amostra decifrada é dado clínico real — não colar o output em chat/print. Conferir no terminal e descartar.



\### 13.1 Prod — checklist (com maintenance ainda ativo)



\- \[ ] \*\*13.0 verde\*\* (leitura real de dado cifrado validada via Caminho A ou B). ← item mais importante da janela.

\- \[ ] Login funciona.

\- \[ ] Abrir um \*\*paciente existente\*\* → dados aparecem corretamente.

\- \[ ] Criar uma sessão (fluxo que \*\*grava\*\* no banco) → sucesso.

\- \[ ] Worker/transcrição: enviar/verificar um job, se aplicável.

\- \[ ] Crons internos respondem com o `CRON\_SECRET` novo (repetir teste do Passo 3.4 se necessário).

\- \[ ] `pm2 logs axis-tcc` sem erro de decrypt.

\- \[ ] `pm2 logs` sem erro de conexão com banco.



> Itens de UI (login/paciente/sessão) que dependam de acesso pelo navegador: se o middleware tiver bypass (Caminho A), usar; se não tiver, o 13.0-B já garante o critério crítico de decrypt — os itens de UI são confirmados imediatamente após o Passo 14, como primeira ação pós-reabertura, com rollback ainda disponível.



\### Staging



\- \[ ] `axis-staging` sobe e fica `online` no PM2.

\- \[ ] Conexão com `axis\_tcc\_staging` funciona após a troca de `DATABASE\_PASSWORD`.

\- \[ ] Logs sem erro crítico.



\### 🔴 REGRA DE OURO DA JANELA



\*\*Não desligar a manutenção sem leitura real de dado cifrado em prod funcionando.\*\* Se a leitura cifrada falhar → Rollback Cenário 3, sem exceção.



\---



\## Passo 14 — Desligar manutenção



Somente com o Passo 13 inteiro verde.



Editar `/root/axis-tcc/.env`:



```txt

MAINTENANCE\_MODE=false

```



```bash

pm2 restart axis-tcc --update-env

```



Validar app público:



```bash

curl -i "https://DOMINIO\_PROD\_CONFIRMAR/"

curl -i "https://DOMINIO\_PROD\_CONFIRMAR/manutencao"

```



Esperado: `/` responde normal; `/manutencao` continua acessível como página estática mas o app não redireciona mais para ela.



\### ✅ Fim da FASE B — janela encerrada.



\---



\# FASE C — Limpeza pós-rotação



\## Passo 15 — Remover `CRON\_SECRET\_OLD`



Remover a linha `CRON\_SECRET\_OLD=` de:



\- `/root/axis-tcc/.env`

\- `/root/axis-tcc-staging/.env` (se existir)



```bash

pm2 restart axis-tcc --update-env

pm2 restart axis-staging --update-env

```



Re-testar um cron com o secret novo (Passo 3.4) para confirmar que nada dependia do antigo.



\---



\## Passo 16 — Remover default hardcoded do código



> Este passo é \*\*código + commit\*\*, feito localmente no Windows (não na VPS), pelo fluxo normal Claude/CC → Alê commita.



Arquivo: `src/lib/env.ts` (linha \~26).



Remover o fallback `'AxisTcc2026!'`. Regra da correção:



\- Segredo obrigatório ausente deve \*\*falhar explicitamente\*\* no boot (throw na validação de env).

\- Nenhum fallback de senha em produção.

\- Nenhum segredo real em código.



Commit sugerido:



```txt

fix(security): remove hardcoded database password fallback

```



Depois do merge: deploy normal na VPS (`git pull` + `npm run next:build` + `pm2 restart axis-tcc --update-env`) e confirmar que o app sobe (o `.env` já tem `DATABASE\_PASSWORD` válida, então o boot não pode falhar).



\---



\## Passo 17 — Remover backup antigo inseguro



Motivo: `/root/axis-tcc-backup-25fev` contém a senha velha legível no bundle. Após a rotação ele não protege nada e ainda expõe o segredo antigo.



```bash

rm -rf /root/axis-tcc-backup-25fev



ls -la /root | grep axis-tcc-backup-25fev || echo "backup antigo removido"

```



Opcional (recomendado depois de alguns dias de operação estável): remover também os arquivos `\*.new` de `$ROT\_DIR`, mantendo apenas os dumps até a próxima rotina de backup.



\---



\# ROLLBACK — Fase B



> Em \*\*todos\*\* os cenários: primeira ação é garantir `MAINTENANCE\_MODE=true`. Nunca fazer rollback com app aberto ao público.



\## Cenário 1 — Falha ANTES da recifra (build, deploy, maintenance, backup)



1\. Manter/ativar `MAINTENANCE\_MODE=true` em `/root/axis-tcc/.env`.

2\. Restaurar o `.env` anterior se algo já foi alterado — fonte principal: `$ROT\_DIR/env.prod.before\_f3` (e `$ROT\_DIR/env.staging.before\_f3` se staging foi tocado).

3\. `pm2 restart axis-tcc --update-env`.

4\. Validar que o app funciona com a configuração antiga.

5\. Desligar maintenance \*\*apenas se\*\* o app estiver íntegro. Reagendar a janela.



\## Cenário 2 — Falha DURANTE a recifra (SQL retornou erro)



1\. Manter `MAINTENANCE\_MODE=true`.

2\. \*\*Não trocar\*\* `AXIS\_ENCRYPTION\_KEY` no `.env` (a chave antiga continua sendo a correta).

3\. Revisar o erro do psql. Com `ON\_ERROR\_STOP=1` + transação, a falha aborta sem commit parcial.

4\. Confirmar que nada foi alterado: rodar a contagem/preflight do script ou ler uma amostra cifrada com a chave antiga via app.

5\. Se nada mudou: corrigir a causa e repetir o Passo 9.

6\. Se houver \*\*qualquer suspeita\*\* de alteração parcial: restaurar o dump (procedimento do Cenário 3, itens 2–6).



\## Cenário 3 — Recifra concluiu, mas o app NÃO lê dados cifrados



1\. Manter `MAINTENANCE\_MODE=true`.

2\. Restaurar o dump do banco prod:



```bash

ROT\_DIR="$(ls -td /root/axis-secret-rotation-\* | head -1)"

DUMP="$(ls -t "$ROT\_DIR"/axis\_tcc.before\_f3\_\*.dump | head -1)"



\# encerra conexões e restaura por cima (--clean recria objetos)

docker exec -i axis-postgres psql -U axis -d postgres -c "SELECT pg\_terminate\_backend(pid) FROM pg\_stat\_activity WHERE datname='axis\_tcc' AND pid <> pg\_backend\_pid();"



docker exec -i axis-postgres pg\_restore -U axis -d axis\_tcc --clean --if-exists < "$DUMP"

```



3\. Restaurar a \*\*chave antiga\*\* no `.env` prod — fonte: `$ROT\_DIR/env.prod.before\_f3` (é o único backup garantido com a `AXIS\_ENCRYPTION\_KEY` antiga; \*\*não\*\* usar `env.prod.before\_dbpass`, que já contém a chave nova). Restaurar o arquivo inteiro ou copiar só a linha `AXIS\_ENCRYPTION\_KEY=` dele, conforme o ponto da janela.

4\. `pm2 restart axis-tcc --update-env`.

5\. Testar \*\*leitura real de dado cifrado\*\* com a chave antiga.

6\. Só desligar maintenance após leitura normal. Investigar a causa antes de tentar de novo.



\## Cenário 4 — Falha APÓS troca de `DATABASE\_PASSWORD`



1\. Verificar se o `ALTER USER` foi de fato aplicado (tentar conectar com a senha nova):



```bash

ROT\_DIR="$(ls -td /root/axis-secret-rotation-\* | head -1)"

PGPASSWORD="$(cat "$ROT\_DIR/DATABASE\_PASSWORD.new")" docker exec -i -e PGPASSWORD axis-postgres psql -U axis -d axis\_tcc -c "SELECT 1;"

```



2\. Validar `DATABASE\_PASSWORD` nos dois `.env` (prod e staging) — devem ser idênticos e iguais ao `.new`.

3\. `pm2 restart` de todos com `--update-env`.

4\. Se necessário, restaurar temporariamente os `.env` do snapshot da troca de senha (`$ROT\_DIR/env.\*.before\_dbpass`); se o problema for anterior à Fase B, o ground truth é `$ROT\_DIR/env.\*.before\_f3`.

5\. Se for voltar à senha anterior: aplicar novamente `ALTER USER axis WITH PASSWORD '<senha anterior>'` (senha extraída de `env.prod.before\_f3` ou `env.prod.before\_dbpass` — nos dois ela é a antiga), depois `.env` → restart, na mesma ordem do Passo 11.



\---



\# CHECKLIST FINAL — Critério de conclusão F3



F3 só pode ser marcado como concluído quando \*\*todos\*\* os itens estiverem ✅:



\- \[ ] `CRON\_SECRET` rotacionado

\- \[ ] `CRON\_SECRET\_OLD` removido após smoke

\- \[ ] `INTERNAL\_API\_KEY` rotacionada

\- \[ ] `AXIS\_ENCRYPTION\_KEY` recifrada \*\*somente em prod\*\* (`axis\_tcc`)

\- \[ ] Dados cifrados lidos corretamente em prod

\- \[ ] `DATABASE\_PASSWORD` trocada no Postgres (`ALTER USER`)

\- \[ ] `DATABASE\_PASSWORD` atualizada em prod \*\*e\*\* staging

\- \[ ] `axis-tcc` reiniciado com `--update-env`

\- \[ ] `axis-staging` reiniciado com `--update-env`

\- \[ ] `axis-worker-transcription` reiniciado com `--update-env`

\- \[ ] `MAINTENANCE\_MODE=false`

\- \[ ] Smoke prod verde

\- \[ ] Smoke staging verde

\- \[ ] Default `AxisTcc2026!` removido de `src/lib/env.ts`

\- \[ ] `/root/axis-tcc-backup-25fev` removido

\- \[ ] \*\*Nenhum segredo novo apareceu em chat, commit, print, log ou documentação\*\*



\---



\*Runbook F3 · AXIS Clínico · gerado em 12/06/2026 · executor: Alê (VPS root@vmi2884668)\*

