# CHECKLIST DE TESTE END-TO-END — AXIS TCC
## Para o Ale executar em 12/03/2026

> Testar em: https://axisclinico.com
> Navegador: Chrome (desktop + mobile)
> Tempo estimado: ~45 min

---

## 1. ACESSO E AUTENTICACAO (~5 min)

- [ ] 1.1 Acessar axisclinico.com — landing page carrega sem erro
- [ ] 1.2 Clicar "Entrar" — tela de login Clerk aparece
- [ ] 1.3 Fazer login com conta existente — redireciona para /hub
- [ ] 1.4 Na /hub, ver card AXIS TCC com badge "Ativo" (se tem licenca)
- [ ] 1.5 Clicar "Acessar" no card TCC — vai para /dashboard
- [ ] 1.6 Verificar que nao consegue acessar /aba/dashboard (se nao tem licenca ABA)

---

## 2. DASHBOARD (~5 min)

- [ ] 2.1 Dashboard carrega sem tela branca
- [ ] 2.2 Cards de KPIs aparecem (pacientes, sessoes hoje, sugestoes pendentes)
- [ ] 2.3 Se tem paciente com 3+ sessoes: selecionar no dropdown e ver graficos CSO
- [ ] 2.4 Se graficos CSO falham: deve mostrar caixa vermelha de erro (NAO tela branca)
- [ ] 2.5 Links do capsule nav funcionam (Hoje / Sessoes / Pacientes / Sugestoes)
- [ ] 2.6 Sidebar aparece e navega corretamente (desktop)
- [ ] 2.7 Cores rosa (#FC608F → tcc-accent) aparecem no nav ativo e nos links

---

## 3. PACIENTES (~10 min)

- [ ] 3.1 Pagina /pacientes carrega com lista (ou vazia se novo)
- [ ] 3.2 Clicar "Novo Paciente" — modal abre
- [ ] 3.3 Preencher nome + email + telefone → salvar
- [ ] 3.4 Toast verde "Paciente cadastrado com sucesso" aparece
- [ ] 3.5 Paciente aparece na lista
- [ ] 3.6 Se plano FREE e ja tem 1 paciente: tentar criar outro → deve mostrar erro 403 (limite atingido)
- [ ] 3.7 Clicar no paciente → pagina de detalhe carrega
- [ ] 3.8 Botao "Editar" funciona — alterar telefone → salvar → telefone atualizado
- [ ] 3.9 Botao "Lembretes" → gera link push (copiar, nao precisa testar push)
- [ ] 3.10 Se paciente novo: card "Registro Clinico Assistido" aparece

---

## 4. SESSOES (~10 min)

- [ ] 4.1 Pagina /sessoes carrega
- [ ] 4.2 Filtros funcionam (periodo, status, busca por nome)
- [ ] 4.3 Clicar "Nova Sessao" → modal abre
- [ ] 4.4 Selecionar paciente → "Iniciar Agora" → sessao criada, redireciona para /sessoes/[id]
- [ ] 4.5 Na sessao: botoes de micro-eventos aparecem (Evitou/Enfrentou/Ajustou/Recuperou)
- [ ] 4.6 Clicar "Evitou" → modal confirma → evento registrado
- [ ] 4.7 Clicar "Enfrentou" → modal confirma → evento registrado
- [ ] 4.8 Se tem microfone: testar gravacao (botao mic → gravar 5s → parar)
- [ ] 4.9 Clicar "Finalizar Sessao" → sessao muda para "finalizada"
- [ ] 4.10 Se pipeline warnings existirem: aparecem no feedback (amarelo)
- [ ] 4.11 Voltar para /sessoes → sessao aparece como "Finalizada" com bolinha cinza

### Agendar sessao:
- [ ] 4.12 "Nova Sessao" → selecionar "Agendar" → escolher data/hora futura → salvar
- [ ] 4.13 Sessao aparece como "Agendada" com bolinha amarela

---

## 5. SUGESTOES (~3 min)

- [ ] 5.1 Pagina /sugestoes carrega
- [ ] 5.2 Se tem sugestoes: cards aparecem com tipo, prioridade, raciocinio
- [ ] 5.3 Testar "Aprovar" em uma sugestao → some da lista
- [ ] 5.4 Se nao tem sugestoes: mensagem "Nenhuma sugestao pendente" aparece (normal)

---

## 6. RELATORIO DE EVOLUCAO (~5 min)

- [ ] 6.1 Ir para paciente com 3+ sessoes finalizadas
- [ ] 6.2 Botao "Evolucao" aparece no header
- [ ] 6.3 Clicar → componente EvolutionReport abre inline
- [ ] 6.4 Graficos de evolucao aparecem
- [ ] 6.5 Botao "Download PDF" → PDF gerado via jsPDF
- [ ] 6.6 Verificar que PDF tem: nome do paciente, graficos, hash SHA256 no rodape

---

## 7. CHAT ANA (~3 min)

- [ ] 7.1 Ir para /ajuda
- [ ] 7.2 Rolar ate o chat da Ana
- [ ] 7.3 Digitar "Como cadastrar um paciente?" → Ana responde (GPT-4o-mini)
- [ ] 7.4 Resposta aparece em balao com nome "Ana"
- [ ] 7.5 Testar 2a pergunta → historico mantido

---

## 8. TERMOS E PRIVACIDADE (~1 min)

- [ ] 8.1 /termos — carrega, menciona AXIS (nao AXIS ABA especificamente)
- [ ] 8.2 /privacidade — carrega, menciona ambos CSO-TCC e CSO-ABA
- [ ] 8.3 /obrigado — branding navy (nao coral)

---

## 9. MOBILE (~5 min)

> Testar no celular OU no Chrome DevTools (F12 → icone mobile)

- [ ] 9.1 /dashboard — layout responsivo, sidebar vira bottom nav
- [ ] 9.2 /sessoes — tabela com scroll horizontal funciona
- [ ] 9.3 /pacientes — modal de cadastro funciona em tela pequena
- [ ] 9.4 Sessao ativa — botoes de micro-eventos cabem na tela
- [ ] 9.5 /ajuda — chat Ana funciona no mobile

---

## 10. SEGURANCA BASICA (~3 min)

- [ ] 10.1 Fazer logout → tentar acessar /dashboard diretamente → redireciona para login
- [ ] 10.2 Apos login, abrir DevTools (F12) → Network → verificar que APIs retornam dados so do seu tenant
- [ ] 10.3 Tentar acessar /api/stats sem auth (copiar URL no browser deslogado) → deve retornar 401

---

## RESULTADO ESPERADO

Se todos os checks passarem: AXIS TCC esta pronto para beta comercial.
Se algum falhar: anotar o numero do check + o que aconteceu + screenshot se possivel.

---

## BUGS CONHECIDOS (nao testar)

- Google Calendar esta desabilitado (aguardando brand verification)
- Push notifications dependem de HTTPS + Firebase config na VPS
- PDF relatorio tem acentos faltando em algumas palavras (sera corrigido)
