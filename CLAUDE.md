# CLAUDE.md — Touch Speaker

Instruções para ferramentas de IA (Claude Code, Cursor, Codex, ChatGPT) que trabalham neste repositório (`touch-speaker`). Leia primeiro em toda sessão.

O **SDD** (`docs/spec/spec-driven-development.md`) é o **contrato de engenharia** — em conflito, vale a ordem do SDD §0.1: `docs/DECISIONS.md` → SDD → este `CLAUDE.md` (e o `AGENTS.md`) → docs específicos → spec aprovada da feature → READMEs. O código em `frontend/` é a fonte de fato sobre **o que existe**; a spec aprovada e o SDD são o contrato sobre **o que deve existir**. Divergência é defeito: código errado → corrige-se o código; spec errada → **corrige-se a spec primeiro** e só depois o código, com aval do Victor sempre que o comportamento muda. `docs/referencia/estudo-typeless.md` é estudo de referência, **não normativo** e **fonte proibida de código** (ADR-07). Decisões fixas só mudam com aval do **Victor**.

> Última atualização: 17/out/2026 · Mantenedor: Victor Alves

## Identidade do projeto

- **O que é:** Touch Speaker é um app de bandeja para **Windows** que transforma fala em texto digitado no app em foco: segura uma tecla, fala, solta, o texto aparece no cursor. Dono: Victor Alves. Idioma do produto e da documentação: **pt-BR**.
- **Problema que resolve:** escrever no computador é lento (~40 palavras por minuto digitando, ~150 falando) e o ditado do Windows (`Win + H`) não dá conta de pt-BR com termos técnicos — resumo em [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md).
- **Relação com outros sistemas:** uma só integração externa — o processo main envia o áudio à API de transcrição da Groq (`whisper-large-v3-turbo`) com a chave do próprio usuário. Não há backend próprio, banco, telemetria nem outro serviço na Fase 1 — contrato em [`docs/INTEGRATION.md`](docs/INTEGRATION.md) e [`docs/API.md`](docs/API.md#transcrição-groq).
- **Estágio:** Fase 1 (MVP — ditado básico) com T1–T8 implementadas em `frontend/` em 17/out/2026; 30/30 testes passando; **funcionando de ponta a ponta no PC do Victor**, com 0,66–0,88 s do fim da fala ao texto. Faltam T9 (resto do roteiro V1–V13) e T10 (fechar a spec). Sem instalador: roda em modo de desenvolvimento.

| Componente | O que é | Status |
| --- | --- | --- |
| **Atalho global** (`hotkey.ts`, `keyboard.ts`) | Hook de teclado (`uiohook-napi`); segurar ≥ 500 ms = falar segurando, toque curto = mãos livres, `Esc` cancela | Funciona — lógica coberta por 10 testes (TEST-001) |
| **Pílula** (`pill-window.ts`, `renderer/`) | Janela flutuante que não rouba foco; grava o microfone (WebM/Opus) e mostra ouvindo / transcrevendo / erro | Funciona |
| **Transcrição** (`transcribe/`) | `GroqTranscriber` com filtros contra alucinações do Whisper em silêncio | Funciona — TEST-002 e TEST-003 |
| **Inserção** (`insert/`) | Clipboard + Ctrl+V via `SendInput` (`koffi`), restaura o clipboard, fallback para janelas de administrador | Colagem comprovada (V2); fallback de administrador ainda não verificado manualmente (V10, PEND-001) |
| **Sessão** (`session.ts`) | Máquina de estados, dono único do estado do ditado | Funciona |
| **Bandeja, config e log** (`tray.ts`, `config.ts`, `logger.ts`) | Ícone, `config.json`, log só com metadados | Funciona — validação da config coberta por TEST-004 |
| **Limpeza por IA** (`refine.ts`) | Interface `Refiner` — hoje devolve o texto como veio | Encaixe pronto; implementação na Fase 2 |
| **`database/`** | Histórico e dicionário em SQLite local | Planejado (Fase 2) |
| **`backend/`** | API própria, contas, streaming | Planejado (Fase 4) |

## Estado atual

- **Fase 1 (MVP — ditado básico):** T1–T8 implementadas em `frontend/` (17/out/2026); 30/30 testes
  passando. **Funcionando de ponta a ponta no PC do Victor** (17/out): ditado em mãos livres no
  Bloco de Notas, 0,66–0,88 s do fim da fala ao texto. **Falta T9:** resto do roteiro V1–V13
  (segurar, Esc, clipboard, outros apps, admin) e T10 (fechar a spec).
- Spec ativa: [docs/spec/features/ditado-por-voz.md](docs/spec/features/ditado-por-voz.md) — tarefas T1–T10 na §13.
- A arquitetura foi informada por engenharia reversa do Typeless 2.8.2
  ([docs/referencia/estudo-typeless.md](docs/referencia/estudo-typeless.md)). Isso é **referência**,
  não fonte de código. O material bruto do estudo fica fora do repositório.
- **Histórico (git):** três commits em 17/out/2026 — `331de81` (Initial commit), `bae6eba` (Fase 1, T1–T8, e a primeira documentação) e `ed0a1f5` (este arquivo: commits sem `Co-Authored-By` e orquestração de agentes).
- **Documentação reestruturada em 17/out/2026** (ainda não commitada): docs canônicos no padrão comum aos projetos do Victor, ADRs em [`docs/DECISIONS.md`](docs/DECISIONS.md) e o SDD como documento mestre, com os registros `BR-`, `RISK-`, `PEND-`, `TEST-`, `FLOW-`, `SCREEN-` e `AC-` — o porquê está em [`docs/CHANGELOG.md`](docs/CHANGELOG.md). Não há milestone aberta: `docs/milestones/` é criada quando a primeira abrir (M1 = Fase 1).
- **Pendências que mais pesam:** PEND-001 (T9 — roteiro manual V1 e V3–V13 e medição de latência; só o V2 foi feito) e PEND-002 (T10 — a spec passa a `implementada` depois do T9) — registro no [SDD, Apêndice B](docs/spec/spec-driven-development.md#apêndice-b--pendências).
- **Riscos que mais pesam:** RISK-005 (copiar código ou assets do Typeless por engano — sala limpa, permanente) e RISK-011 (primeiras sílabas cortadas: a captura começa até 300 ms depois da tecla) — registro no [SDD §26](docs/spec/spec-driven-development.md#26-riscos-e-mitigações).

## Stack

- **App:** Electron 44 (44.9.0) + TypeScript (7.0.2; estrito, CommonJS, `tsc`, sem bundler na Fase 1) (ADR-01).
- **Hook de teclado:** `uiohook-napi` (1.5.5) (ADR-02).
- **Win32 (SendInput, elevação):** `koffi` (3.3.3) chamando `user32` / `kernel32` / `advapi32` (ADR-03).
- **Gravação:** `getUserMedia` + `MediaRecorder` (`audio/webm;codecs=opus`) no renderer da pílula.
- **Transcrição:** Groq `whisper-large-v3-turbo` (plano gratuito), `language=pt` (ADR-04).
- **Testes:** `node:test`.
- **Runtime de dev:** Node.js 24 LTS.
- **Qualidade:** `npm run typecheck` e `npm test` (30/30 em 17/out/2026). Não há linter, formatador nem CI (`.github/` não existe) — detalhe em [`docs/Code-Style.md`](docs/Code-Style.md).

## Comandos essenciais

Da raiz do repositório (o app e o `package.json` ficam em `frontend/`):

```powershell
cd frontend
npm install
copy .env.example .env   # e preencher GROQ_API_KEY
npm run dev              # compila e abre o app na bandeja
npm start                # abre sem recompilar
npm test                 # compila e roda os testes (node:test)
npm run typecheck
```

- Sempre abrir o app por `npm run dev`/`npm start` (passam por `scripts/start.mjs`, que remove o `ELECTRON_RUN_AS_NODE` herdado do VS Code).
- Log em `%APPDATA%\Touch Speaker\logs\main.log` (só metadados; rotação em 5 MB, até `main.2.log`).
- Para encerrar um app aberto por agente: `Stop-Process` nos `electron.exe` cujo caminho contém `touch-speaker`.
- Sem `GROQ_API_KEY` o app abre normalmente; ao tentar ditar, a pílula avisa `no_api_key` (BR-013).
- `koffi` e `uiohook-napi` trazem binários prontos para win32-x64; os scripts de instalação deles ficam negados no `allowScripts` do `package.json`, e o aviso do npm sobre isso é esperado.

Setup completo em [`README.md`](README.md); variáveis em [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md).

## Estrutura

O app fica em `frontend/`. Nas citações `arquivo.ts:linha` dos docs, os caminhos partem da raiz do repositório (`frontend/src/main/session.ts`) ou, quando o contexto já é o app, de `frontend/` (`src/main/session.ts`).

- `frontend/` — app desktop Electron (main, preload, renderer) — Fase 1: `src/main/` (processo main: hook, sessão, transcrição, inserção, bandeja, config, log e os textos de interface em `strings.ts`), `src/preload/` (ponte mínima `window.touchSpeaker`), `src/renderer/` (pílula: gravação e interface), `src/shared/` (tipos do IPC), `src/test/` (testes `node:test`) e `scripts/` (`start.mjs`, `copy-static.mjs`).
- `backend/` — API própria — vazio até a Fase 4.
- `database/` — migrations: `local/` (SQLite, Fase 2) e `server/` (Fase 4).
- `docs/` — PRD, ARCHITECTURE, API, INTEGRATION, DATABASE, DESIGN, DECISIONS, ENVIRONMENT, CHANGELOG, Code-Style, Security-Guide · `spec/` (SDD e specs de feature) · `templates/` (processo e templates de feature, milestone e migração) · `referencia/` (estudo do Typeless, não normativo) · `assets/` (logo).
- Raiz — `README.md`, `PROJECT_CONTEXT.md`, este `CLAUDE.md`, `AGENTS.md`, `SECURITY.md`, `LICENSE.md` (software proprietário) e `.gitignore` (inclui a trava `targets/`, `analysis/`, `rea/` contra o material bruto do estudo).

## Decisões fixas (não rediscutir sem aval do Victor)

- Windows primeiro; nada de macOS/Linux/mobile antes da Fase 4.
- Electron + TypeScript ([ADR-01](docs/DECISIONS.md#adr-01--electron--typescript)).
- Hook global com `uiohook-napi`, não `globalShortcut` ([ADR-02](docs/DECISIONS.md#adr-02--hook-global-com-uiohook-napi-não-globalshortcut)).
- Inserção por clipboard + Ctrl+V via `SendInput` ([ADR-03](docs/DECISIONS.md#adr-03--inserção-por-clipboard--ctrlv-via-sendinput)).
- Groq Whisper, áudio inteiro ao soltar ([ADR-04](docs/DECISIONS.md#adr-04--groq-whisper-large-v3-turbo-áudio-inteiro-ao-soltar)).
- Sem limpeza por IA na Fase 1; `Refiner` identidade como encaixe ([ADR-05](docs/DECISIONS.md#adr-05--sem-limpeza-por-ia-na-fase-1-mas-com-o-encaixe-pronto)).
- Sem backend na Fase 1; app não é distribuído com chave ([ADR-06](docs/DECISIONS.md#adr-06--sem-backend-na-fase-1)).
- Sala limpa em relação ao Typeless ([ADR-07](docs/DECISIONS.md#adr-07--sala-limpa-em-relação-ao-typeless)).
- **ADRs propostas:** nenhuma em aberto (SDD §27).

Detalhe (contexto, decisão, consequências, implementação) em [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Convenções

- Código e identificadores em inglês; textos de interface, docs e mensagens de commit em pt-BR.
- Textos da interface centralizados em `frontend/src/main/strings.ts`.
- TypeScript estrito; `any` só com comentário justificando.
- Commits: Conventional Commits citando o requisito — `feat(dict): FR-DICT-01 segurar para falar`.
- Commits **sem** trailer `Co-Authored-By` (nem do Claude, nem de ninguém): o autor é só o Victor.
- Um único dono de estado da sessão: `SessionController`.
- Provedores (transcrição, limpeza) sempre atrás de interface.
- **Estilo de código:** [`docs/Code-Style.md`](docs/Code-Style.md).
- **Doc no mesmo trabalho** que muda comportamento, contrato, dado ou interface.

## Feature nova — comece SEMPRE por aqui

**Antes de escrever a primeira linha de código de uma feature nova, leia
[`docs/templates/README.md`](docs/templates/README.md) e use os templates de lá.** Não improvise formato
de documentação: ele já existe, é o padrão do projeto e vale para humano e para IA.

O caminho, resumido:

1. **Ler o SDD** — [docs/spec/spec-driven-development.md](docs/spec/spec-driven-development.md): Constituição
   (C1–C8), requisitos, regras, pendências e riscos.
2. **Spec** — criar `docs/spec/features/<slug>.md` a partir de
   [`TEMPLATE-spec-feature.md`](docs/templates/TEMPLATE-spec-feature.md) e pedir aprovação. É onde entram o
   problema, com âncora `frontend/src/…ts:linha`, objetivos **e não-objetivos**, a leitura de produto
   (persona, dor, qual elo do fluxo tecla → gravação → transcrição → inserção → pílula ela fortalece,
   hipótese, como se mede), requisitos em EARS (`QUANDO … O SISTEMA DEVE …`), NFR com limiar numérico,
   telas e estados, arquitetura, dados, contrato, alternativas rejeitadas, critérios de aceite e rollout.
   Feature com tela ou fluxo desenha os diagramas `mermaid` que o template pede; `N/A` só com motivo
   escrito. **Gate:** a spec só passa com o checklist de *Definition of Ready* do README dos templates
   fechado e o aval do Victor. Ponto sem origem no PRD, no SDD ou no código vira
   **`[PRECISA ESCLARECER: <pergunta>]`** no doc — **nunca** uma escolha sua. Spec com marcador aberto
   não passa.
3. **Execução** — só então implementar, tarefa por tarefa, verificando contra os critérios de aceite da
   spec (§14 no template; §12 na spec da Fase 1, que é anterior ao template). Doc-pai a partir de
   [`TEMPLATE-milestone.md`](docs/templates/TEMPLATE-milestone.md) em `docs/milestones/M<N>-<slug>.md`
   (`M<N>` = Fase N; a pasta é criada quando a primeira milestone abrir). Não há ferramenta de tarefas: as
   tarefas vivem na própria spec.
4. **Docs** — atualizar os docs afetados no mesmo trabalho.

**Verificação antes do PR:** `cd frontend` · `npm run typecheck` · `npm test` · roteiro manual da spec
(app aberto por `npm run dev`; ao fim, `Stop-Process` nos `electron.exe` do `touch-speaker`) ·
`docs/CHANGELOG.md` com o **porquê**, não só o quê. Diga no PR o que foi testado e como.

**Quando pular a spec:** só se as três valerem — não cria canal IPC, campo de `config.json` nem
dependência; não toca decisão fixa nem abre ADR; e cabe em uma sessão. Bug, ajuste visual e refatoração
local entram aqui. Na dúvida, escreva a spec.

## Documentação de referência

Leia sob demanda antes de agir. **Docs canônicos:** [`README.md`](README.md) · [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) · este `CLAUDE.md` · [`AGENTS.md`](AGENTS.md) · [`docs/PRD.md`](docs/PRD.md) · [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/API.md`](docs/API.md) · [`docs/INTEGRATION.md`](docs/INTEGRATION.md) · [`docs/DATABASE.md`](docs/DATABASE.md) · [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) · [`docs/DECISIONS.md`](docs/DECISIONS.md) · [`docs/CHANGELOG.md`](docs/CHANGELOG.md).

Contrato, planejamento e apoio (aprofundamento):

1. **`docs/spec/spec-driven-development.md` — SDD, contrato de engenharia** (requisitos, regras, pendências, riscos, ADRs no §27 e roadmap no §29).
2. `docs/CHANGELOG.md` — o que de fato entrou, com o porquê.
3. **`docs/templates/`** — processo e templates de feature, milestone e migração. **Ponto de partida obrigatório** de qualquer feature.
4. [`SECURITY.md`](SECURITY.md) e [`docs/Security-Guide.md`](docs/Security-Guide.md) — política e guia de segurança (inclui a sala limpa, §15.3).
5. [`docs/Code-Style.md`](docs/Code-Style.md) e [`docs/DESIGN.md`](docs/DESIGN.md) — estilo de código e design da pílula e da bandeja.
6. [`docs/spec/features/ditado-por-voz.md`](docs/spec/features/ditado-por-voz.md) — spec ativa da Fase 1 (T1–T10, V1–V13).
7. [`docs/referencia/estudo-typeless.md`](docs/referencia/estudo-typeless.md) — estudo de referência, **não normativo** e **fonte proibida de código** (ADR-07): dele saem ideias e comportamentos descritos com palavras próprias, nunca código, strings, constantes, nomes de canal, ícones, sons ou cores.

| Assunto | Documento |
| --- | --- |
| Por que existe, fases, métricas | [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) |
| Requisitos (FR/NFR) e roadmap | [docs/PRD.md](docs/PRD.md) |
| Regras, pendências, riscos, roadmap (contrato) | [docs/spec/spec-driven-development.md](docs/spec/spec-driven-development.md) |
| Componentes, fluxo, estrutura | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| ADR-01…07 | [docs/DECISIONS.md](docs/DECISIONS.md) |
| Groq, IPC, códigos de erro | [docs/API.md](docs/API.md) |
| Integração com a Groq: papéis, garantias, limites | [docs/INTEGRATION.md](docs/INTEGRATION.md) |
| `config.json`, log, SQLite (Fase 2) | [docs/DATABASE.md](docs/DATABASE.md) |
| Node, Electron, variáveis, `.env`, problemas comuns | [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) |
| Pílula, cores, sons | [docs/DESIGN.md](docs/DESIGN.md) |
| Estilo de código | [docs/Code-Style.md](docs/Code-Style.md) |
| Segurança e sala limpa | [docs/Security-Guide.md](docs/Security-Guide.md) · [SECURITY.md](SECURITY.md) |
| Processo e templates de feature | [docs/templates/README.md](docs/templates/README.md) |
| O que mudou e por quê | [docs/CHANGELOG.md](docs/CHANGELOG.md) |

## Orquestração de agentes (IA)

Nunca execute o trabalho por conta própria.
Sempre delegue a tarefa a um subagente.
Não use sempre o Fable.
Use o Opus 5.5 para tarefas mais simples.

### Distribuição de modelos

- **Fable 5.1:** arquitetura, bugs complexos e revisão de código.
- **Opus 5.5:** edições, testes, documentação e refatoração.
- **Haiku 4.5:** pesquisas e resumos.
- Especifique o modelo em cada chamada de agente.

### Delegação

- Um subagente por tarefa. Planeje antes de executar.
- Execute subagentes independentes em paralelo.
- Leia o relatório, nunca os arquivos.

## Nunca faça (guardrails)

- **Nunca** copiar código, pseudocódigo, strings, constantes, nomes de canais, ícones, sons ou cores do
  Typeless ou do material bruto do estudo. Escrever do zero a partir de documentação pública.
- **Nunca** trazer para o repositório binários de terceiros, código decompilado ou o material bruto
  do estudo; o que pode ser publicado já está em `docs/referencia/estudo-typeless.md`.
- **Nunca** chamar a API do Typeless, usar tokens dele ou mexer em assinatura/gating dele.
- **Nunca** commitar `.env`, chaves ou dados de usuário.
- **Nunca** logar texto ditado, áudio, conteúdo do clipboard, teclas ou a chave.
- **Nunca** gravar áudio em disco.
- **Nunca** dar foco à janela da pílula.
- **Nunca** identificar teclas além da configurada e do `Esc` (outras viram só um booleano).
- **Nunca** pedir elevação de administrador para contornar UIPI.
- **Nunca** puxar funcionalidade de fase seguinte para dentro da spec atual.
- **Não começar feature nova sem os templates** de [`docs/templates/`](docs/templates/README.md) — nem inventar estrutura de doc própria.
- **Zero invenção:** toda feature rastreia ao PRD, ao SDD ou ao código. Ponto sem origem vira `[PRECISA ESCLARECER: …]`, nunca escolha sua. O estudo de referência não conta como origem de fato.
- **Não introduzir dependência ou serviço sem registrar a decisão** numa ADR em [`docs/DECISIONS.md`](docs/DECISIONS.md).
- **Não alterar comportamento sem atualizar a documentação afetada** no mesmo trabalho.
- Em caso de dúvida ou conflito de regras, pergunte ao Victor antes de assumir — nunca invente.

## Ao terminar trabalho relevante

- Marcar as tarefas e verificações concluídas na spec.
- Atualizar `docs/` se contrato, dado, arquitetura ou interface mudaram.
- Atualizar a seção **Estado atual** deste arquivo.
- Registrar em `docs/CHANGELOG.md` o que entrou, com o porquê.
- Atualizar o SDD (pendências, riscos, requisitos) quando a mudança fechar ou abrir algum item; `docs/DECISIONS.md` e `docs/ENVIRONMENT.md` se a mudança mexeu neles.
- Atualizar o roadmap do `README.md` quando uma fase fechar, e **este arquivo** se alguma decisão fixa mudar ou uma fase fechar.
