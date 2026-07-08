# HANDOFF — AXIS ABA
## Leia este arquivo ANTES de tocar em qualquer coisa

**Data:** 08/07/2026
**Para:** o próximo chat / a próxima LLM / o Alê daqui a duas semanas
**De:** a sessão de 07-08/07/2026 (incêndio + 7 auditorias + 7 decisões)

---

## 1. EM UMA PÁGINA: o que aconteceu e onde estamos

Uma cliente clicou no botão errado e travou um protocolo em "Dominado" sem volta. Ao investigar, descobrimos que o problema era estrutural. Ao investigar o problema estrutural, descobrimos dois problemas maiores:

1. **O motor clínico (CSO) está desligado desde 24/03/2026.** O profissional não vê a curva de evolução de nenhum aprendiz há mais de 3 meses. Causa: commit `0d44a0e` (24/03, 20:35) removeu a chamada `close_session_aba(...)` e trocou por `UPDATE` direto. Foi um "conserto P0 às pressas" — o dev fez o bypass porque a função não existia em staging (nunca virou migration), e sem perceber desligou o CSO **também em produção**, onde a função existia e funcionava.

2. **O alerta de regressão nunca disparou.** Por **dois canais paralelos**, ambos mortos. Uma criança pode estar piorando; o supervisor nunca é avisado.

3. **A tela do aprendiz mostra o CSO de março rotulado como "CSO atual".** Sem data, sem aviso. (Achado da 7ª auditoria — seis auditorias não viram.)

**O plano de correção está em `docs/estado/PLANO_CORRECAO_ABA_V9.md`.** Ele passou por **7 auditorias adversariais**, tem cada achado ancorado em `arquivo:linha` ou query de banco, e as **7 decisões de negócio já foram tomadas**. Está pronto para execução.

**LEIA O V9. Ele é a fonte da verdade. Este handoff só cobre o que NÃO está lá.**

---

## 2. ESTADO REAL DE PRODUÇÃO (verificado, não presumido)

### ✅ No ar e funcionando
- **P0** — modal de confirmação (`window.confirm`) antes de marcar "Dominado". Commit `bc52001`, buildado, deployado, **testado em produção**. Impede o clique errado que originou tudo.
- **Incêndio da cliente resolvido** — protocolo `c7759184-ae0f-4e8a-a0d6-cd5fc95b863e` (Maria Fernanda, "Foco e Atenção") revertido `mastered` → `active` via UPDATE manual no psql, com trigger desabilitado dentro de transação. `COMMIT` confirmado. Estado atual: `status=active`, `mastered_at=NULL`, `activated_at=2026-07-07 13:06:24`.

### 🟡 Congelado no working tree (NÃO commitado, NÃO no ar)
- **P1 (reverter `mastered→active` pela UI)** — alterações em:
  - `app/aba/aprendizes/[id]/page.tsx`
  - `app/api/aba/protocols/[id]/route.ts`
  - `scripts/migrations/075_aba_allow_mastered_to_active.sql` (untracked)

**Por que está congelado:** a Fase A do plano reescreve o trigger inteiro (remove `regression`, adiciona `mastered→active`) numa **migration única**. Fazer o P1 separado criaria duas migrations sobre a mesma função — a segunda apagaria a primeira.

### 🚨 ARMADILHA DO GIT — leia antes de qualquer `git add`
O blob **staged** da migration 075 termina em `$$;` — é a versão **QUEBRADA** (o validador do Husky exige `COMMIT;` como última linha). O fix (`BEGIN;`/`COMMIT;`) está **só no working tree**.

- Um `git commit` cru comitaria a versão quebrada. O Husky lê o disco (passa), mas o git comita o índice.
- **E o PowerShell do Alê não tem `bash`**, então o hook pode nem rodar.
- **Estado atual (pós-`git reset`): a 075 está untracked (`??`), fora do índice. Seguro.**
- `SELECT * FROM _migrations WHERE version='075'` → 0 rows. `git log --all -- 075` → vazio. **Nunca commitada, nunca aplicada.**
- **Recomendação:** a Fase A reescreve a 075 do zero. Pode deletar a atual.

### Ambiente
- **VPS:** `147.93.191.64` (Contabo, `vmi2884668`). SSH direto como root.
- **DB:** container `axis-postgres`, database `axis_tcc`, user **`axis`** (não `postgres` — esse role não existe).
  - Conectar: `docker exec -it axis-postgres psql -U axis -d axis_tcc`
  - ⚠️ O user `axis` é **superuser com `rolbypassrls`**. RLS não protege nada quando se usa psql direto.
- **Deploy:** `cd /root/axis-tcc && git pull && rm -rf .next && npm run next:build && pm2 restart all`
- **Local:** `C:\Users\evera\Documents\axis-tcc` (NÃO `Projetos\`).
- **PowerShell:** use `;` nunca `&&`. **Não tem `bash`.** Validações de hook via `Get-Content`.
- **Build local não funciona** — `npm run next:build` falha por env vars ausentes. `npm run dev` roda um script de backend, não o Next. **Buildar só no VPS.**

---

## 3. NÚMEROS DE PRODUÇÃO (medidos em 07-08/07/2026)

| Métrica | Valor | Significado |
|---|---|---|
| Sessões `completed` | 49 | |
| Com `session_snapshots` | 29 | Todas até 12/03 |
| **Órfãs (sem snapshot)** | **20** | Todas de 17/04 em diante. Bug vivo. |
| Tenants com órfãs | 3 | `123e4567…` (3), `377c9cd4…` (14), `9ae1ea81…` (3) |
| Logs `PROTOCOL_STATUS_CHANGE` | 99 | |
| Com autor real | **0** | Todos `'system'` |
| Sessões `completed` editadas pós-fim | 15 | |
| Com `duration_minutes_override` | 13 | Interseção zero ⇒ **28 sessões afetadas** |
| Sondas de manutenção | 30 | **Todas `pending`.** Nenhuma completed, nenhuma reprovada. |
| Protocolos em `regression` | **0** | Estado inalcançável (será removido — Decisão 1) |
| Tenants com atestação | 18 | **Todos `plan_tier = founders`** |
| Evidence bundles | **0** | Feature gate, não bug (Decisão 6 corrige) |
| Motor ativo | `CSO-ABA 2.6.1` | `is_current = true` ✅ |
| `calculate_cso_aba(NULL,60,70,NULL)` | **100.00** | ⚠️ Dimensão nula ⇒ nota máxima. Nunca passe NULL. |

---

## 4. AS 7 DECISÕES (tomadas — não reabrir sem motivo forte)

| # | Decisão | Resumo |
|---|---|---|
| 0 | Remediação histórica | **Não remediar. Comunicar.** Base pequena; o Alê manda mensagem. |
| 1 | `regression` | **Remover** do enum/trigger/UI. O alerta avisa; o protocolo segue ativo. |
| 2 | Meta PEI | **Mostrar a data que já existe** (`mastered_at`). Sem coluna nova. |
| 3 | Limiar da sonda | **É o critério do protocolo.** O 70 fixo sai. Abaixo do critério ⇒ avisa. |
| 4 | `detect_regression` | **Não ligar.** Dispararia sobre aprendizado normal. Dívida documentada. |
| 5 | CSO retroativo | **Não backfillar.** Documentar a lacuna. *(Sobreviveu a 4 falsificações.)* |
| 6 | Evidence bundles | **Para todos.** Padrão único. 1 linha em `operadora-gate.ts:76`. |

**O princípio do Alê que resolveu todas:**
> *"O que quero é o certo daqui pra frente. O passado tudo bem não ter ajudado — tem poucas pessoas usando, mando mensagem e OK. Quero algo simples e eficaz, que o sistema não quebre porque colocamos um luxo."*

---

## 5. COMO O ALÊ TRABALHA (respeite isto — não é preferência, é como ele produz)

- **Excelência > agilidade.** Nunca entregue meia-boca. Ele vai perceber e vai (com razão) recusar.
- **Um comando por vez.** Comando + 1-2 linhas de contexto. Ele cola o resultado, você segue.
- **Nada de ruído.** Ele é AuDHD. Muito texto = confusão, não clareza. Se ele disser "muito ruído", corte pela metade.
- **Ele decide quando parar.** Não sugira pausa, não diga "você deve estar cansado". Ele cuida disso.
- **Verificar > presumir.** Se um achado não foi confirmado contra o banco ou contra `arquivo:linha`, **diga que não foi.** Ele exige isso, e está certo.
- **Ele não é programador.** Explique o que o comando faz, não como funciona por dentro.
- **Smoke test é sempre manual, feito por ele.** Nunca peça ao CC para rodar Chrome MCP, screenshots ou cliques automatizados.
- **Prompts para o CC:** sempre em bloco markdown pronto para copiar, no chat.

### Códigos dele
- **555** — Validação Inteligente: custo real, gargalo operacional, risco humano + bônus "ROI emocional".
- **777** — Protocolo SINAL vs RUÍDO (mapa completo).
- **666** — SOS AuDHD: até 5 bullets curtos, sem emoji, foco na próxima ação.
- **"e aí DR?"** — responder como médico falando com familiares: 2-3 linhas, sem jargão.

---

## 6. LIÇÕES DO PROCESSO (por que este plano é confiável)

**7 auditorias adversariais. ~45 furos corrigidos. Cinco deles eram erros meus** — e nenhum teria sido pego sem o processo:

1. v3 afirmava "P1 commitado no GitHub" — **falso** (staged, nunca commitado).
2. v4 acusava RLS pelos 0 bundles — **falso** (feature gate `founders`).
3. v5 arquivava `completeness_pct=0` sob `regression_count` — **falso** (depende de snapshot ou do gate).
4. v6 dizia "ninguém é avisado" e "FG-1 > motor, provado" — **impreciso nos dois pontos**.
5. v7 descartou `cso-history` como "lacuna honesta" — **o endpoint é honesto; a página mente**. Parei no endpoint e não segui o dado até a tela.

**O que funcionou:**
- **Prompts que mandam *provar / simular / quebrar* cavam fundo.** Prompts que mandam *revisar* concordam.
- **Auditar a incorporação** das críticas (não só o plano) — ninguém faz isso, e é onde plano bom vira ruim.
- **Um auditor externo, sem histórico, na rodada final.** Ele não tem lealdade às conclusões anteriores.
- **Verificar tudo contra o banco vivo.** Uma auditoria afirmou "motor totalmente morto". O banco mostrou 29 snapshots. Era "quebrou em 24/03" — correção completamente diferente.

**Onde mora o ponto cego de documentos muito auditados:** não nas afirmações (todos checam), mas nas **junções** — o dado entre o endpoint e a tela; a ordem entre duas fases individualmente corretas.

---

## 7. O QUE FAZER AGORA

1. **Ler `docs/estado/PLANO_CORRECAO_ABA_V9.md`.** Inteiro. Especialmente a seção 7 (ordem) e a tabela de armadilhas.
2. **Rodar o primeiro comando seguro** (read-only, reproduz o furo do convênio) — está no V9.
3. **Escrever o primeiro código: FG-2a + FG-2b.** Staleness no dashboard e na tela do aprendiz. Zero dependências. Faz o profissional parar de ver um número errado.
4. **Um bloco = um commit.** Nada de commit misto — foi um commit misto (`0d44a0e`) que desligou o motor e ninguém notou por 4 meses.
5. **Smoke manual do Alê a cada bloco**, antes de seguir.

---

## 8. PENDÊNCIAS FORA DO PLANO

- **Modal bonito** (A8) — trocar a caixa preta nativa do `window.confirm` por modal no CSS do projeto. Serve P0 e P1. Cosmético, mas real.
- **1 protocolo com `mastery_criteria_trials = 1`** — investigar se é erro de cadastro.
- **Fragilidade estrutural:** o índice único de `engine_versions.is_current` é **global** (1 linha na tabela inteira) e `close_session_aba:563` não filtra por `engine_name`. Hoje inócuo (CSO-ABA é o current). Se alguém ativar outro motor, os snapshots ABA carimbam engine errada.
- **`detect_regression`** — função morta, decisão consciente de não ligar (Decisão 4). Não é esquecimento.
- **`/api/aba/clinical-state`** — rota morta e quebrada (consulta coluna `cso_score` que não existe). Cosmético.

---

## 9. DOCUMENTOS NO REPO

| Arquivo | O que é |
|---|---|
| `docs/estado/PLANO_CORRECAO_ABA_V9.md` | **A fonte da verdade.** Plano completo, decidido, auditado 7×. |
| `docs/estado/PLANO_CORRECAO_ABA_V8.md` | Versão anterior (antes das decisões). Útil para ver as opções que foram descartadas. |
| `docs/estado/PLANO_CORRECAO_ABA_V2..V7.md` | Histórico. Cada uma mostra o que a auditoria seguinte derrubou. |
| `docs/estado/AUDITORIA_ABA_INTEGRIDADE_MAQUINA_ESTADOS.md` | A auditoria original (Fable 5). **Cuidado:** ela afirma "motor totalmente morto" — foi refutado. |
| `docs/estado/HANDOFF_ABA.md` | Este arquivo. |

**Commits relevantes:** `bc52001` (P0 no ar) · `34cbed0` · `1c24be3` · `ccd4a13` · `bf84538` · `7e57b09` (V9).

---

*A seguradora foi o canário. O canário cantou.*
