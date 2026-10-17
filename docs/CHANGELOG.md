# Changelog — Touch Speaker

> Última atualização: 17/out/2026 · Mantenedor: Victor Alves

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), e cada entrada diz **por que** a mudança entrou, não só o que mudou. O projeto ainda não tem versão publicada: `frontend/package.json` está em `0.1.0`, sem tag nem instalador. O que veio antes desta reestruturação está em [Histórico anterior](#histórico-anterior-sem-versão), resumido a partir do `git log`. Bugs e pendências encontrados no código não entram aqui — ficam no Apêndice B do [SDD](spec/spec-driven-development.md#apêndice-b--pendências) e no [`Security-Guide.md`](Security-Guide.md#18-riscos-conhecidos-em-aberto) §18.

## [Não publicado]

### Adicionado

- **`AGENTS.md`** — ponto de entrada curto para agentes de IA: produto, stack, estágio e onde está cada documento canônico, com a ordem de precedência. As regras do agente continuam no `CLAUDE.md`; sem este arquivo, uma ferramenta que procura `AGENTS.md` não achava nada no repositório
- **`docs/DECISIONS.md`** — as ADR-01 a ADR-07, antes na seção "Decisões-chave" do `ARCHITECTURE.md`, com o mesmo texto redistribuído em Contexto, Decisão, Consequências e Implementação (caminhos e linhas em `frontend/`). Um registro só, que vem primeiro em conflito de documentação, deixa claro o que não se rediscute sem aval do Victor
- **`docs/CHANGELOG.md`** — este arquivo. O histórico só existia no `git log`, sem o porquê de cada mudança
- **`docs/Code-Style.md`** — as convenções de TypeScript, do processo main, do renderer, dos testes e do Git que o código já segue, escritas a partir do código. Elas estavam implícitas em `frontend/` e espalhadas pelo `CLAUDE.md`
- **`docs/ENVIRONMENT.md`** — Node, Electron, variáveis (`GROQ_API_KEY`, `ELECTRON_RUN_AS_NODE`), o arquivo `.env`, o log e os problemas comuns num lugar só. Antes, quem montava o ambiente juntava essas peças do README, do `CLAUDE.md` e do Security-Guide
- **`docs/INTEGRATION.md`** — a integração Touch Speaker ⇄ Groq: papéis, fluxo de um ditado, falha e nova tentativa, garantias, limites e riscos. O contrato campo a campo segue no `API.md`; faltava a visão da integração como um todo
- **`docs/templates/README.md`** — como nasce uma feature: spec → gate (aval do Victor) → execução, com a Definition of Ready, a Definition of Done e o índice de specs, que antes ficavam no SDD
- **`docs/templates/TEMPLATE-spec-feature.md`** — o template de spec de feature, extraído do SDD e ampliado (constituição, diagramas, rastreabilidade, critérios de aceite), para a próxima feature começar pelo critério de aceite e não pelo código
- **`docs/templates/TEMPLATE-milestone.md`** — o doc-pai de uma milestone (`M<N>` = Fase N), para registrar o que cada fase entregou, as decisões e o que ficou pendente quando ela fechar
- **`docs/templates/TEMPLATE-spec-migracao.md`** — o template de spec para mudança de formato de dado persistido: `version` do `config.json`, migrations de `database/local/` (Fase 2) e banco do servidor (Fase 4). Mudança de dado tem riscos próprios (perder a config do usuário, app que não abre) que o template de feature não cobre

### Alterado

- **Documentação reestruturada** (17/out/2026, ainda não commitada) — a estrutura de docs canônicos foi trazida do molde de outro projeto do Victor e reescrita com o conteúdo do Touch Speaker: nenhum fato do Touch Speaker se perdeu, e nada do outro projeto ficou. As ADRs passaram para o `docs/DECISIONS.md`, e o `ARCHITECTURE.md` só as lista. O SDD virou o documento mestre (v1.1, §0–§31 e apêndices), com os registros `BR-` (regras implementadas), `RISK-`, `PEND-`, `TEST-`, `FLOW-`, `SCREEN-` e `AC-`; o fluxo de trabalho, a definição de pronto e o template de spec saíram dele para `docs/templates/`. Entraram os arquivos novos listados em "Adicionado". Motivo: um padrão de documentação para todos os projetos do Victor, com ordem de precedência explícita (`DECISIONS.md` → SDD → `CLAUDE.md` → docs específicos → spec aprovada → READMEs) e a regra de que o código em `frontend/` é a fonte de fato sobre o que existe, enquanto a spec e o SDD são o contrato sobre o que deve existir
- **Spec `ditado-por-voz` mantida no formato original** — `docs/spec/features/ditado-por-voz.md` continua com as seções §0–§15 do SDD 1.0, anterior ao template novo, com uma nota no topo dizendo isso; só os links para seções renumeradas de outros docs foram atualizados. A spec está em implementação, e reescrevê-la no template novo no meio da Fase 1 misturaria mudança de forma com o fechamento do T9
- **Âncoras e referências a seções renumeradas** — links internos entre os docs e os comentários de `frontend/src` que citavam seções do `API.md` e do `Security-Guide.md` passaram a apontar para as seções novas; nenhuma linha de código mudou. Sem isso, os links levariam ao topo do arquivo e os comentários citariam seções que não existem mais
- **Divergências doc × código corrigidas no `DESIGN.md`** — os textos do menu da bandeja e a cor do ponto do ícone "gravando" passaram a descrever o que o código faz (`main/strings.ts`, `main/icon.ts`); a documentação anterior descrevia o menu e a cor de outro jeito
- **Caminho do `Stop-Process` no `CLAUDE.md`** — o filtro para encerrar o app aberto por agente passou a citar a pasta real, `touch-speaker`; o texto anterior tinha um erro de digitação e não casaria com o caminho do `electron.exe`

## Histórico anterior (sem versão)

3 commits na `main`, todos em 17/out/2026, de Victorkaue333. Os resumos dizem o que cada commit trouxe; os hashes servem para quem quiser ler o diff.

### out/2026

- **`ed0a1f5` — "Update CLAUDE.md"** (14:53) — o `CLAUDE.md` ganhou a regra de commits **sem** trailer `Co-Authored-By` (o autor é só o Victor) e a seção "Orquestração de agentes (IA)", com a distribuição de modelos e as regras de delegação
- **`bae6eba` — "feat: project touch-speaker"** (14:48, 53 arquivos) — a Fase 1 (T1–T8) em `frontend/`: atalho global com `uiohook-napi` (segurar, mãos livres, `Esc`), pílula de status, gravação WebM/Opus no renderer, `GroqTranscriber` com filtros anti-lixo, inserção por clipboard + Ctrl+V com restauração e fallback para app elevado, `SessionController`, bandeja, `config.json` com validação e log rotativo sem conteúdo; 30/30 testes em `node:test`. Junto vieram `PROJECT_CONTEXT.md`, `CLAUDE.md`, `SECURITY.md`, `LICENSE.md`, o README completo, `backend/README.md`, `database/README.md`, o `.gitignore`, a documentação (PRD, ARCHITECTURE com as ADRs, API, DATABASE, DESIGN, Security-Guide, SDD 1.0, a spec `ditado-por-voz` e o estudo de referência do Typeless) e o logo em `docs/assets/`. No PC do Victor, o app funcionou de ponta a ponta: ditado em mãos livres no Bloco de Notas, com 0,66–0,88 s do fim da fala ao texto (V2)
- **`331de81` — "Initial commit"** (14:43) — só o `README.md`, com uma linha
