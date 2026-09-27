# Publicação — receita única (produção e staging)

Última revisão: 27/09/2026. Substitui os passos de publicação que estavam em
`docs/CHECKLIST_RELEASE.md`, `docs/runbooks/F3_ROTACAO_RUNBOOK.md` (Passo 6)
e `docs/estado/HANDOFF_ABA.md`.

**Ordem de toda entrega:** notebook → staging → teste manual do Alê → produção → observar 24h.

| | Produção | Staging |
|---|---|---|
| Pasta | `/root/axis-tcc` | `/root/axis-tcc-staging` |
| PM2 | `axis-tcc` e `axis-worker-transcribe` | `axis-staging` |
| Postgres | contêiner `axis-postgres` | contêiner `axis-postgres-staging` (127.0.0.1:5433), config em `/root/axis-staging-db/` (fora do git) |
| Endereço | https://axisclinico.com | https://staging.axisclinico.com |

---

## 1. Notebook (PowerShell)

```powershell
cd C:\Users\Vaio\Projetos\axis-tcc; npx tsc --noEmit; npm run next:build; npx vitest run --exclude='e2e/**'
```

- Sem `.env` no notebook, o build e 5 testes do `env.test.ts` falham na validação de variáveis. Nesse caso, passe as variáveis falsas do CI (`.github/workflows/ci.yml`, job `build`) só no comando.
- No Windows, o teste `operadora-audit-logs-contract` falha sempre (caminho com `\`). É esperado.
- **Commit e push só com "vai" do Alê.**

---

## 2. Staging (bash, no servidor)

**Proibido no staging:**
- rodar o `ecosystem.config.cjs` da pasta do staging: ele é cópia do da produção e reinicia a **produção**;
- rodar `scripts/migrate.sh` contra o staging: o contêiner dele é fixo na **produção**.

### 2.1 Antes

```bash
cd /root/axis-tcc-staging
git status --short
pm2 ls
```

- O `git status --short` só pode mostrar `?? scripts/staging/`. Qualquer outra linha: pare.
- No `pm2 ls`, anote o número de reinícios (coluna ↺) do **axis-tcc**, que é a produção.

### 2.2 Atualizar e construir (pode levar 10–30 min)

```bash
git pull --ff-only && npm ci && npm run next:build; echo "codigo=$?"
```

Só siga se aparecer `codigo=0`.

### 2.3 Reiniciar

```bash
pm2 restart axis-staging
```

Só se o processo não existir:

```bash
pm2 start /root/axis-staging-db/staging.config.cjs && pm2 save
```

### 2.4 Migrations no staging (só quando a entrega tiver migration)

Nada de `migrate.sh` aqui. É manual, uma migration por vez.

**Anotar contagens (para comparar na volta):**

```bash
Q="select (select count(*) from pg_tables where schemaname='public')||' tabelas | '||(select count(*) from _migrations)||' migrations | '||(select count(*) from sessions)||' sessoes | app le: '||has_table_privilege('axis_app','public.sessions','SELECT')"
docker exec axis-postgres-staging psql -U axis -d axis_tcc_staging -Atc "$Q"
```

**Snapshot antes:**

```bash
SNAP=/root/axis-staging-db/snapshot_$(date +%Y%m%d_%H%M%S).dump
docker exec axis-postgres-staging pg_dump -U axis -d axis_tcc_staging -Fc > "$SNAP" && ls -lh "$SNAP"
```

**Aplicar uma migration** (troque `NNN_nome.sql`):

```bash
F=scripts/migrations/NNN_nome.sql
docker exec -i axis-postgres-staging psql -U axis -d axis_tcc_staging -v ON_ERROR_STOP=1 < "$F" && echo APLICADA
```

**Registrar em `_migrations`**, com o mesmo checksum `sha256sum` que o `migrate.sh` usa:

```bash
B=$(basename "$F"); V=${B%%_*}; N=${B#*_}; N=${N%.sql}; C=$(sha256sum "$F" | awk '{print $1}')
docker exec -i axis-postgres-staging psql -U axis -d axis_tcc_staging -v ON_ERROR_STOP=1 \
  -c "INSERT INTO _migrations (version, name, filename, checksum, applied_by) VALUES ('$V','$N','$B','$C','$USER')"
```

Repita os dois blocos para cada migration, em ordem numérica.

**Falhou → restaurar o snapshot** (banco recriado do zero, com o app parado) *(provado em 27/09/2026: 98 tabelas, 73 migrations, 57 sessões e permissões do axis_app iguais antes e depois; staging fora ~30 s; produção sem reinício)*:

```bash
pm2 stop axis-staging
docker exec axis-postgres-staging dropdb -U axis axis_tcc_staging
docker exec axis-postgres-staging createdb -U axis -O axis axis_tcc_staging
docker exec -i axis-postgres-staging pg_restore -U axis -d axis_tcc_staging --exit-on-error < "$SNAP" && echo RESTAURADO
pm2 restart axis-staging
```

Conferir: rodar o mesmo comando das contagens e comparar com o anotado (tem que ser igual), e o health do staging tem que responder ok.

```bash
docker exec axis-postgres-staging psql -U axis -d axis_tcc_staging -Atc "$Q"
```

### 2.5 Conferir

```bash
sleep 30; curl -fsS https://staging.axisclinico.com/api/health; echo; pm2 ls
```

- O health precisa responder ok.
- O número de reinícios (↺) do **axis-tcc** precisa ser **igual** ao anotado em 2.1. Se mudou, a produção foi reiniciada por engano: avise o Alê.

### 2.6 Teste manual do Alê

Só depois do "ok" do Alê no staging é que se publica na produção.

---

## 3. Produção (bash, no servidor)

### 3.1 Estado atual

```bash
cd /root/axis-tcc
git status --short
git log -1 --oneline
```

- O `git status --short` precisa vir **vazio**.
- **Anote o hash** do `git log`. Ele é a volta (3.6).

### 3.2 Backup

```bash
bash /root/axis-tcc/scripts/backup-postgres.sh
B=$(ls -t /backups/*.sql.gz | head -1); ls -lh "$B"; gzip -t "$B" && echo "backup_ok"
```

Confira que o arquivo é de agora e que apareceu `backup_ok`. Sem backup, não siga.

### 3.3 Atualizar e construir

```bash
set -o pipefail; git pull --ff-only && npm ci && npm run next:build; echo "codigo=$?"
```

Só siga se aparecer `codigo=0`.

### 3.4 Migrations na produção (só quando a entrega tiver migration)

Rodar de dentro de `/root/axis-tcc`, depois do 3.3 e **antes** do 3.5. O backup do 3.2 é obrigatório.

```bash
cd /root/axis-tcc
bash scripts/migrate.sh --status
```

O `--status` só lista, sem aplicar:
- `PENDENTE` = ainda não registrada em `_migrations`;
- `CONFLITO` = checksum diferente do registrado. Pare, porque arquivo aplicado não pode ser editado.

⚠️ Em 26/09/2026 as 067–074 e 079 foram registradas em `_migrations` sem reaplicar (applied_by `'backfill-2026-09-26'`). **Se o `--status` listar como PENDENTE qualquer migration que não faz parte desta entrega, PARE e investigue antes.**

Aplicar só as da entrega, parando na última:

```bash
bash scripts/migrate.sh --target NNN
```

Conferir:

```bash
bash scripts/migrate.sh --status
docker exec -i axis-postgres psql -U axis -d axis_tcc -c "SELECT version, applied_at, applied_by FROM _migrations ORDER BY version DESC LIMIT 5;"
```

O `migrate.sh` para na primeira falha. Cada arquivo roda na sua própria transação: a que falhou é desfeita, e as anteriores ficam aplicadas. Se precisar voltar tudo, use o backup do 3.2.

### 3.5 Reiniciar

```bash
pm2 restart axis-tcc axis-worker-transcribe
```

- **Sem `--update-env`.**
- **Nunca `pm2 restart all`**: isso reinicia o staging junto.

### 3.6 Conferir

```bash
sleep 30; curl -fsS https://axisclinico.com/api/health; echo; node -p "require('next/package.json').version"; git status --short; pm2 ls
```

Precisa ter: health ok, versão do Next esperada, `git status` limpo e os dois processos `online`.

### 3.7 Volta (se algo der errado)

```bash
git reset --hard <hash anotado no 3.1> && npm ci && npm run next:build && pm2 restart axis-tcc axis-worker-transcribe
```

Se a entrega teve migration, a volta do banco é pelo backup do 3.2.

### 3.8 Observar 24h

- Sentry
- `pm2 logs axis-tcc --lines 100 --nostream`
- `/admin/dashboard` (alertas do sistema)
