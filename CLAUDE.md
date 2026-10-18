# CLAUDE.md — Touch Speaker

Instruções para ferramentas de IA (Claude Code, Cursor, Codex, ChatGPT) que trabalham neste repositório (`touch-speaker`). Leia primeiro em toda sessão.

O **SDD** (`docs/spec/spec-driven-development.md`) é o **contrato de engenharia** — em conflito, vale a ordem do SDD §0.1: `docs/DECISIONS.md` → SDD → este `CLAUDE.md` (e o `AGENTS.md`) → docs específicos → spec aprovada da feature → READMEs. O código em `frontend/` é a fonte de fato sobre **o que existe**; a spec aprovada e o SDD são o contrato sobre **o que deve existir**. Divergência é defeito: código errado → corrige-se o código; spec errada → **corrige-se a spec primeiro** e só depois o código, com aval do Victor sempre que o comportamento muda. `docs/referencia/estudo-typeless.md` é estudo de referência, **não normativo** e **fonte proibida de código** (ADR-07). Decisões fixas só mudam com aval do **Victor**.

> Última atualização: 18/out/2026 · Mantenedor: Victor Alves

## Identidade do projeto

- **O que é:** Touch Speaker é um app de bandeja para **Windows e macOS** que transforma fala em texto digitado no app em foco: segura uma tecla, fala, solta, o texto aparece no cursor. Hoje roda no Windows; o suporte a macOS está especificado e aprovado (spec `distribuicao-windows-macos`, ADR-11), mas ainda em implementação na M2. Linux vem depois, sem data; mobile fica fora. Dono: Victor Alves. Idioma do produto e da documentação: **pt-BR**.
- **Problema que resolve:** escrever no computador é lento (~40 palavras por minuto digitando, ~150 falando) e o ditado do Windows (`Win + H`) não dá conta de pt-BR com termos técnicos — resumo em [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md).
- **Relação com outros sistemas:** uma só integração externa — o processo main envia o áudio à API de transcrição da Groq (`whisper-large-v3-turbo`) com a chave do próprio usuário, digitada em Configurações e guardada cifrada pelo `safeStorage` (ADR-08). Não há backend próprio, banco, telemetria nem outro serviço na Fase 1 — contrato em [`docs/INTEGRATION.md`](docs/INTEGRATION.md) e [`docs/API.md`](docs/API.md#transcrição-groq).
- **Estágio:** Fase 1 (MVP — ditado básico) com T1–T8 implementadas em `frontend/` em 17/out/2026; **funcionando de ponta a ponta no PC do Victor**, com 0,66–0,88 s do fim da fala ao texto. Faltam T9 (resto do roteiro V1–V13) e T10 (fechar a spec). Da M2, as specs `design-system`, `janela-principal` e `historico` estão implementadas no código desde 18/out/2026 (não commitadas; roteiros manuais pendentes); 352/352 testes. Sem instalador: roda em modo de desenvolvimento.

| Componente | O que é | Status |
| --- | --- | --- |
| **Atalho global** (`hotkey.ts`, `keyboard.ts`) | Hook de teclado (`uiohook-napi`); segurar ≥ 500 ms = falar segurando, toque curto = mãos livres, `Esc` cancela | Funciona — lógica coberta por 10 testes (TEST-001) |
| **Pílula** (`pill-window.ts`, `renderer/`) | Janela flutuante que não rouba foco; grava o microfone (WebM/Opus) e mostra ouvindo / transcrevendo / erro | Funciona |
| **Transcrição** (`transcribe/`) | `GroqTranscriber` com filtros contra alucinações do Whisper em silêncio | Funciona — TEST-002 e TEST-003 |
| **Inserção** (`insert/`) | Clipboard + Ctrl+V via `SendInput` (`koffi`), restaura o clipboard, fallback para janelas de administrador | Colagem comprovada (V2); fallback de administrador ainda não verificado manualmente (V10, PEND-001) |
| **Sessão** (`session.ts`) | Máquina de estados, dono único do estado do ditado | Funciona |
| **Bandeja, config e log** (`tray.ts`, `config.ts`, `logger.ts`) | Ícone (por tema da barra), "Abrir Touch Speaker", `config.json` (agora escrito também pela tela, por fila única), log só com metadados | Funciona — TEST-004 e TEST-006; gravação do `config.json` em TEST-008 |
| **Janela principal** (`main-window.ts`, `renderer/main-window/`, `preload/main-window.ts`) | Aberta pela bandeja (ou sozinha na primeira execução sem chave salva): Início (tecla, como ditar, estado ao vivo, uso e ditados recentes), Histórico, Configurações (chave da Groq, sete preferências, retenção do histórico, aparência, "Iniciar com o Windows"), botão de tema claro/escuro; Dicionário "em breve" | No código desde 18/out/2026 — TEST-009, TEST-018, TEST-019; roteiros VJ1–VJ27 pendentes (PEND-007, PEND-010) |
| **Chave da Groq** (`credentials.ts`) | `CredentialStore`: `groq-key.bin` cifrado pelo `safeStorage` → `.env` só em dev → nenhuma; a chave só no main (ADR-08) | No código desde 18/out/2026 — TEST-007 |
| **Design system** (`renderer/tokens.css`, `shared/palette.ts`) | Paleta "Sálvia" em tokens, tema claro/escuro (do sistema por padrão ou escolhido na janela), Inter embutida (ADR-12) | No código desde 18/out/2026 — TEST-005 e TEST-006; roteiro V-DS-1…6 pendente (PEND-006) |
| **Limpeza por IA** (`refine.ts`) | Interface `Refiner` — hoje devolve o texto como veio | Encaixe pronto; implementação na Fase 2 |
| **Histórico** (`history/`, `database/local/0001_init.sql`) | Texto dos ditados em SQLite local (`%LOCALAPPDATA%\Touch Speaker\`, `node:sqlite`, ADR-09), tela Histórico, retenção, cards do Início | No código em 18/out/2026 (não commitado) — testes TEST-010…017; roteiro VH pendente (PEND-009). Dicionário: planejado |
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
- **Documentação reestruturada em 17/out/2026** (commitada no mesmo dia, commits `1ac8ee8`…`0c0aa5b`): docs canônicos no padrão comum aos projetos do Victor, ADRs em [`docs/DECISIONS.md`](docs/DECISIONS.md) e o SDD como documento mestre, com os registros `BR-`, `RISK-`, `PEND-`, `TEST-`, `FLOW-`, `SCREEN-` e `AC-` — o porquê está em [`docs/CHANGELOG.md`](docs/CHANGELOG.md). A primeira milestone aberta é a M2 (abaixo); a M1 (Fase 1) ganha doc em `docs/milestones/` quando a T9 e a T10 fecharem.
- **M2 (app com interface) em execução** desde 18/out/2026: [docs/milestones/M2-app-com-interface.md](docs/milestones/M2-app-com-interface.md) — quatro specs aprovadas pelo Victor em 18/out/2026 (design-system, janela-principal, historico, distribuicao-windows-macos), com a T9 e a T10 da Fase 1 abertas em paralelo; a reprioritização do roadmap do PRD aguarda o aval do Victor.
  - **`design-system`** — implementada no código em 18/out/2026 (não commitada); falta o roteiro manual V-DS-1…6 (PEND-006).
  - **`janela-principal`** — implementada no código em 18/out/2026 (não commitada): janela pela bandeja, chave da Groq em Configurações com `safeStorage` (ADR-08), `.env` só em desenvolvimento; falta o roteiro manual VJ1–VJ24 (PEND-007). No mesmo dia, a pedido do Victor: tema claro/escuro escolhido na janela (FR-UI-39…42, `config.json` `theme`, `theme:set`), "Como ditar" compacto e listas suspensas/caixas no estilo da janela; roteiro VJ25–VJ27 pendente (PEND-010).
  - **`historico`** — **implementada no código em 18/out/2026** (não commitada): banco SQLite em `%LOCALAPPDATA%\Touch Speaker\` pelo `node:sqlite` (ADR-09 aceita, spike T1), só texto e nunca áudio, tela Histórico (busca, copiar, apagar, apagar tudo), retenção em Configurações (30 dias por padrão), e — pedido do Victor — os cards "Seu uso" (`history:stats`) e "Ditados recentes" no Início. Spec de migração companheira [`historico-dados-v1`](docs/spec/features/historico-dados-v1.md) em `proposta` (implementação autorizada pelo Victor; a aprovação vem com a validação dele). Falta o roteiro VH1–VH13 (PEND-009).
  - **`distribuicao-windows-macos`** — aprovada, ainda não implementada; a ADR-11 (Windows e macOS, distribuição restrita antes da Fase 4) foi aceita pelo Victor em 18/out/2026. Linux fica planejado para depois, sem data.
- **Revisão de código da M2** (18/out/2026): o ícone do botão de tema nunca trocava (o código usava a propriedade `.hidden` num `<svg>`, que não existe nele) — corrigido com o atributo `hidden`; mais cinco correções menores (recarga do Histórico que encolhia a lista, foco depois de "Apagar", busca em qualquer escrita e termo vazio, troca de fuso com o app aberto, transições na volta a "Seguir o sistema"). Os ícones Lucide ganharam a ADR-13 (**proposta**, aguardando o aval do Victor). Detalhe no [`docs/CHANGELOG.md`](docs/CHANGELOG.md).
- **Tema claro branco neutro e logo do README** (18/out/2026, pedido do Victor; spec `design-system` D10 revista e D11): página e cards brancos, barra lateral `#F7F7F8`, cinzas neutros, tokens novos `--ts-card` e `--ts-hover` (escuro inalterado); a marca da barra lateral em `#13A89E` como no README.
- **Testes:** 352/352 em 18/out/2026 (`npm test`; 30 na Fase 1, +83 da `design-system`, +71 da `janela-principal`, +117 da `historico`, do tema e dos controles, +25 das correções da revisão de código, +26 do tema claro branco neutro); `npm run typecheck` limpo nos três programas do `tsc`.
- **Pendências que mais pesam:** PEND-001 (T9 — roteiro manual V1 e V3–V13 e medição de latência; só o V2 foi feito), PEND-002 (T10 — a spec passa a `implementada` depois do T9), PEND-006 (roteiro V-DS-1…6), PEND-007 (roteiro VJ1–VJ24), PEND-009 (roteiro VH1–VH13 do histórico) e PEND-010 (roteiro VJ25–VJ27 do tema e dos controles) — registro no [SDD, Apêndice B](docs/spec/spec-driven-development.md#apêndice-b--pendências).
- **Riscos que mais pesam:** RISK-005 (copiar código ou assets do Typeless por engano — sala limpa, permanente) e RISK-011 (primeiras sílabas cortadas: a captura começa até 300 ms depois da tecla) — registro no [SDD §26](docs/spec/spec-driven-development.md#26-riscos-e-mitigações).

## Stack

- **App:** Electron 44 (44.9.0) + TypeScript (7.0.2; estrito, CommonJS, `tsc`, sem bundler na Fase 1) (ADR-01).
- **Hook de teclado:** `uiohook-napi` (1.5.5) (ADR-02).
- **Win32 (SendInput, elevação):** `koffi` (3.3.3) chamando `user32` / `kernel32` / `advapi32` (ADR-03).
- **Gravação:** `getUserMedia` + `MediaRecorder` (`audio/webm;codecs=opus`) no renderer da pílula.
- **Transcrição:** Groq `whisper-large-v3-turbo` (plano gratuito), `language=pt` (ADR-04).
- **Chave da Groq:** `safeStorage` do Electron (DPAPI) em `%APPDATA%\Touch Speaker\groq-key.bin`; `frontend/.env` só como reserva de desenvolvimento (ADR-08).
- **Fonte:** Inter 4.1 embutida (ADR-12).
- **Interface:** HTML + CSS + TypeScript sem framework nem bundler; duas janelas (pílula e janela principal), cada uma com seu preload e seu programa do `tsc` (script clássico); cores, fonte e medidas só dos tokens de `renderer/tokens.css`.
- **Testes:** `node:test`.
- **Runtime de dev:** Node.js 24 LTS.
- **Banco local (M2):** SQLite pelo `node:sqlite` embutido no Electron 44 — sem dependência npm (ADR-09).
- **Ícones da janela principal:** Lucide 1.52.0 (ISC), SVG inline vendorizado, sem pacote npm (ADR-13, proposta).
- **Qualidade:** `npm run typecheck` e `npm test` (352/352 em 18/out/2026). Não há linter, formatador nem CI (`.github/` não existe) — detalhe em [`docs/Code-Style.md`](docs/Code-Style.md).

## Comandos essenciais

Da raiz do repositório (o app e o `package.json` ficam em `frontend/`):

```powershell
cd frontend
npm install
npm run dev              # compila e abre o app na bandeja; a chave da Groq vai em Configurações
npm start                # abre sem recompilar
npm test                 # compila e roda os testes (node:test)
npm run typecheck        # os três programas do tsc
copy .env.example .env   # opcional, só em desenvolvimento: GROQ_API_KEY como reserva
```

- Sempre abrir o app por `npm run dev`/`npm start` (passam por `scripts/start.mjs`, que remove o `ELECTRON_RUN_AS_NODE` herdado do VS Code).
- **Chave da Groq pela interface:** bandeja → "Abrir Touch Speaker" (ou duplo clique no ícone) → Configurações → colar a chave → "Salvar chave". Fica cifrada em `%APPDATA%\Touch Speaker\groq-key.bin` (`safeStorage`) e vale no próximo ditado, sem reiniciar. Na primeira execução sem chave salva, a janela abre sozinha em Configurações.
- O `frontend/.env` (`GROQ_API_KEY`) é só reserva de desenvolvimento: lido só com o app não empacotado e só quando não há chave salva no app (ADR-08).
- Log em `%APPDATA%\Touch Speaker\logs\main.log` (só metadados; rotação em 5 MB, até `main.2.log`).
- Para encerrar um app aberto por agente: `Stop-Process` nos `electron.exe` cujo caminho contém `touch-speaker`.
- Sem chave (nem salva nem no `.env`) o app abre normalmente; ao tentar ditar, a pílula avisa `no_api_key` — "Falta a chave da Groq — abra o Touch Speaker pela bandeja" (BR-013).
- Em `npm run dev`, F12 com a janela principal em foco abre o DevTools dela; "Iniciar com o Windows" fica desabilitado (só funciona no app instalado).
- `koffi` e `uiohook-napi` trazem binários prontos para win32-x64; os scripts de instalação deles ficam negados no `allowScripts` do `package.json`, e o aviso do npm sobre isso é esperado.

Setup completo em [`README.md`](README.md); variáveis em [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md).

## Estrutura

O app fica em `frontend/`. Nas citações `arquivo.ts:linha` dos docs, os caminhos partem da raiz do repositório (`frontend/src/main/session.ts`) ou, quando o contexto já é o app, de `frontend/` (`src/main/session.ts`).

- `frontend/` — app desktop Electron (main, preload, renderer): `src/main/` (processo main: hook, sessão, transcrição, inserção, bandeja, janela principal, chave da Groq em `credentials.ts`, preferências em `settings.ts`, item de login, config, log e os textos de interface em `strings.ts`), `src/preload/` (`pill.ts` → `window.touchSpeaker`; `main-window.ts` → `window.touchSpeakerApp`), `src/renderer/` (pílula, `tokens.css`, `fonts/` e `main-window/`, a janela principal), `src/shared/` (tipos do IPC, paleta e contraste), `src/test/` (testes `node:test`) e `scripts/` (`start.mjs`, `copy-static.mjs`). Três programas do `tsc`: `tsconfig.main.json`, `tsconfig.renderer.json` (pílula) e `tsconfig.main-window.json` (janela principal).
- `backend/` — API própria — vazio até a Fase 4.
- `database/` — migrations: `local/` (SQLite, Fase 2) e `server/` (Fase 4).
- `docs/` — PRD, ARCHITECTURE, API, INTEGRATION, DATABASE, DESIGN, DECISIONS, ENVIRONMENT, CHANGELOG, Code-Style, Security-Guide · `spec/` (SDD e specs de feature) · `templates/` (processo e templates de feature, milestone e migração) · `referencia/` (estudo do Typeless, não normativo) · `assets/` (logo).
- Raiz — `README.md`, `PROJECT_CONTEXT.md`, este `CLAUDE.md`, `AGENTS.md`, `SECURITY.md`, `LICENSE.md` (software proprietário) e `.gitignore` (inclui a trava `targets/`, `analysis/`, `rea/` contra o material bruto do estudo).

## Decisões fixas (não rediscutir sem aval do Victor)

- Windows e macOS ([ADR-11](docs/DECISIONS.md#adr-11--macos-como-plataforma-suportada-e-distribuição-restrita-antes-da-fase-4)); Linux planejado para depois; mobile fora. O macOS ainda está em implementação (spec `distribuicao-windows-macos`, M2).
- Electron + TypeScript ([ADR-01](docs/DECISIONS.md#adr-01--electron--typescript)).
- Hook global com `uiohook-napi`, não `globalShortcut` ([ADR-02](docs/DECISIONS.md#adr-02--hook-global-com-uiohook-napi-não-globalshortcut)).
- Inserção por clipboard + Ctrl+V via `SendInput` ([ADR-03](docs/DECISIONS.md#adr-03--inserção-por-clipboard--ctrlv-via-sendinput)).
- Groq Whisper, áudio inteiro ao soltar ([ADR-04](docs/DECISIONS.md#adr-04--groq-whisper-large-v3-turbo-áudio-inteiro-ao-soltar)).
- Sem limpeza por IA na Fase 1; `Refiner` identidade como encaixe ([ADR-05](docs/DECISIONS.md#adr-05--sem-limpeza-por-ia-na-fase-1-mas-com-o-encaixe-pronto)).
- Sem backend na Fase 1; app não é distribuído com chave ([ADR-06](docs/DECISIONS.md#adr-06--sem-backend-na-fase-1)).
- Sala limpa em relação ao Typeless ([ADR-07](docs/DECISIONS.md#adr-07--sala-limpa-em-relação-ao-typeless)).
- Chave da Groq no `safeStorage` do Electron, digitada em Configurações; `.env` só como reserva de desenvolvimento, nunca lido no app empacotado; a chave nunca volta ao renderer, nunca vai para log nem para o `config.json` e nunca é gravada em texto puro ([ADR-08](docs/DECISIONS.md#adr-08--chave-da-groq-no-safestorage-do-electron-com-o-env-só-como-reserva-de-desenvolvimento)).
- Fonte Inter embutida, arquivo oficial sem modificação, com a licença OFL ao lado — a única exceção ao guardrail de binários de terceiros ([ADR-12](docs/DECISIONS.md#adr-12--fonte-inter-embutida-no-app)).
- **ADRs propostas:** [ADR-13 — ícones Lucide embutidos](docs/DECISIONS.md#adr-13--ícones-lucide-embutidos), aguardando o aval do Victor (SDD §27). A ADR-10 segue reservada para a spec `distribuicao-windows-macos`; a ADR-11 foi aceita pelo Victor em 18/out/2026.

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
5. [`docs/Code-Style.md`](docs/Code-Style.md) e [`docs/DESIGN.md`](docs/DESIGN.md) — estilo de código e design da pílula, da janela principal e da bandeja.
6. [`docs/spec/features/ditado-por-voz.md`](docs/spec/features/ditado-por-voz.md) — spec ativa da Fase 1 (T1–T10, V1–V13); as specs da M2 em `docs/spec/features/` (`design-system`, `janela-principal`, `historico`, `distribuicao-windows-macos`) e o doc-pai em [`docs/milestones/M2-app-com-interface.md`](docs/milestones/M2-app-com-interface.md).
7. [`docs/referencia/estudo-typeless.md`](docs/referencia/estudo-typeless.md) — estudo de referência, **não normativo** e **fonte proibida de código** (ADR-07): dele saem ideias e comportamentos descritos com palavras próprias, nunca código, strings, constantes, nomes de canal, ícones, sons ou cores.

| Assunto | Documento |
| --- | --- |
| Por que existe, fases, métricas | [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) |
| Requisitos (FR/NFR) e roadmap | [docs/PRD.md](docs/PRD.md) |
| Regras, pendências, riscos, roadmap (contrato) | [docs/spec/spec-driven-development.md](docs/spec/spec-driven-development.md) |
| Componentes, fluxo, estrutura | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| ADR-01…09, ADR-12 e ADR-13 (proposta) | [docs/DECISIONS.md](docs/DECISIONS.md) |
| Groq, IPC, códigos de erro | [docs/API.md](docs/API.md) |
| Integração com a Groq: papéis, garantias, limites | [docs/INTEGRATION.md](docs/INTEGRATION.md) |
| `config.json`, log, SQLite (Fase 2) | [docs/DATABASE.md](docs/DATABASE.md) |
| Node, Electron, variáveis, `.env`, problemas comuns | [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) |
| Pílula, janela principal, cores, sons | [docs/DESIGN.md](docs/DESIGN.md) |
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
