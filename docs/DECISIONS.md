# DECISIONS — Touch Speaker

> Última atualização: 18/out/2026 · Mantenedor: Victor Alves

Registro das decisões de arquitetura (ADRs) do projeto. As sete foram aceitas pelo Victor em 17/out/2026, junto com a Fase 1 (commit `bae6eba`), e até a reestruturação da documentação viviam na seção "Decisões-chave" do [`ARCHITECTURE.md`](ARCHITECTURE.md), no formato curto Contexto/Decisão/Consequências; aqui o texto é o mesmo, só redistribuído nos blocos de cada entrada. Mudar uma decisão = ADR nova que substitui a anterior, com aval do Victor; a antiga fica no arquivo, marcada como substituída. Em conflito entre documentos, este arquivo vem primeiro (SDD [§0.1](spec/spec-driven-development.md#01-política-de-prevalência-documental)). O código em `frontend/` é a fonte de fato sobre **o que existe**; a spec aprovada e o SDD são o contrato sobre **o que deve existir**. Divergência é defeito: código errado → corrige-se o código; spec errada → **corrige-se a spec primeiro** e só depois o código, com aval do Victor sempre que o comportamento muda.

Os caminhos citados em **Implementação** são relativos a `frontend/`, e as linhas foram conferidas no código de `ed0a1f5`, HEAD de `main`, em 17/out/2026 (ADR-01 a ADR-07), no código da spec `design-system`, ainda não commitado, em 18/out/2026 (ADR-12), no código da spec `historico`, não commitado, em 18/out/2026 (ADR-09), e no código da spec `janela-principal`, também não commitado, em 18/out/2026 (ADR-08, e as linhas de `index.ts`, `keyboard.ts`, `groq.ts` e `copy-static.mjs` citadas nas outras ADRs, que mudaram de lugar). O estudo de referência do Typeless ([`referencia/estudo-typeless.md`](referencia/estudo-typeless.md)) informou parte destas decisões, mas não é normativo e é fonte proibida de código ([ADR-07](#adr-07--sala-limpa-em-relação-ao-typeless)).

## Índice

| # | Data | Decisão | Status |
| --- | --- | --- | --- |
| ADR-01 | 17/out/2026 | [Electron + TypeScript](#adr-01--electron--typescript) | Aceita — Victor Alves |
| ADR-02 | 17/out/2026 | [Hook global com `uiohook-napi`, não `globalShortcut`](#adr-02--hook-global-com-uiohook-napi-não-globalshortcut) | Aceita — Victor Alves |
| ADR-03 | 17/out/2026 | [Inserção por clipboard + Ctrl+V via `SendInput`](#adr-03--inserção-por-clipboard--ctrlv-via-sendinput) | Aceita — Victor Alves |
| ADR-04 | 17/out/2026 | [Groq Whisper `large-v3-turbo`, áudio inteiro ao soltar](#adr-04--groq-whisper-large-v3-turbo-áudio-inteiro-ao-soltar) | Aceita — Victor Alves |
| ADR-05 | 17/out/2026 | [Sem limpeza por IA na Fase 1, mas com o encaixe pronto](#adr-05--sem-limpeza-por-ia-na-fase-1-mas-com-o-encaixe-pronto) | Aceita — Victor Alves |
| ADR-06 | 17/out/2026 | [Sem backend na Fase 1](#adr-06--sem-backend-na-fase-1) | Aceita — Victor Alves |
| ADR-07 | 17/out/2026 | [Sala limpa em relação ao Typeless](#adr-07--sala-limpa-em-relação-ao-typeless) | Aceita — Victor Alves |
| ADR-08 | 18/out/2026 | [Chave da Groq no `safeStorage` do Electron, com o `.env` só como reserva de desenvolvimento](#adr-08--chave-da-groq-no-safestorage-do-electron-com-o-env-só-como-reserva-de-desenvolvimento) | Aceita — Victor Alves |
| ADR-09 | 18/out/2026 | [SQLite local pelo `node:sqlite` embutido para o histórico de ditados](#adr-09--sqlite-local-pelo-nodesqlite-embutido-para-o-histórico-de-ditados) | Aceita — Victor Alves |
| ADR-11 | 18/out/2026 | [macOS como plataforma suportada e distribuição restrita antes da Fase 4](#adr-11--macos-como-plataforma-suportada-e-distribuição-restrita-antes-da-fase-4) | Aceita — Victor Alves (implementação pendente) |
| ADR-12 | 18/out/2026 | [Fonte Inter embutida no app](#adr-12--fonte-inter-embutida-no-app) | Aceita — Victor Alves |
| ADR-13 | 18/out/2026 | [Ícones Lucide embutidos](#adr-13--ícones-lucide-embutidos) | **Proposta** — aguardando aval do Victor |

Uma ADR em proposta: a ADR-13, que registra os ícones Lucide já no código (SDD [§27](spec/spec-driven-development.md#27-adrs--decisões-arquiteturais)). Os números ADR-08 a ADR-11 foram reservados em 18/out/2026 pelas outras specs da M2 (`janela-principal`, `historico` e `distribuicao-windows-macos` — [doc-pai](milestones/M2-app-com-interface.md)) e entram aqui com a implementação de cada uma: a ADR-12 veio primeiro, com a spec `design-system`, a ADR-08 com a `janela-principal` e a ADR-09 com a `historico`. A ADR-11 (`distribuicao-windows-macos`) foi aceita pelo Victor em 18/out/2026, antes da implementação, porque muda uma decisão fixa de produto (as plataformas); a ADR-10, da mesma spec, segue reservada.

---

## ADR-01 — Electron + TypeScript

17/out/2026 (commit `bae6eba`) · Aceita — Victor Alves

**Contexto**

Victor trabalha com JS/React; o app precisa de UI flutuante, bandeja e acesso a Win32.

**Decisão**

- Electron 44 + TypeScript estrito.
- Build com `tsc` para CommonJS, sem bundler na Fase 1.

**Consequências**

- Positivas: velocidade de desenvolvimento e o mesmo modelo que produtos do mercado usam.
- Negativas: app grande (~150 MB) e ~100 MB de RAM. Tauri fica como opção se o tamanho virar problema. A memória em repouso medida em 17/out/2026 está no NFR-03 (SDD [§5](spec/spec-driven-development.md#5-requisitos-não-funcionais)).

**Implementação**

- `package.json` — `electron` 44.9.0, `typescript` 7.0.2, `koffi` 3.3.3, `uiohook-napi` 1.5.5, versões exatas; `"type": "commonjs"`; scripts `build`, `dev`, `start`, `typecheck` e `test`.
- `tsconfig.main.json` — main, preload, shared e testes; `module nodenext`, `strict`, `noUncheckedIndexedAccess`.
- `tsconfig.renderer.json` — renderer da pílula como script clássico, `lib` com DOM; desde a spec `janela-principal`, o renderer da janela principal tem programa próprio, também script clássico (`tsconfig.main-window.json`), sem bundler.
- `scripts/start.mjs` — abre o Electron sem o `ELECTRON_RUN_AS_NODE` herdado do VS Code; `scripts/copy-static.mjs` copia HTML e CSS do renderer para `dist/` (desde a ADR-12, também a pasta `fonts/`; desde a spec `janela-principal`, também `main-window/`).
- `src/main/index.ts:48` — `app.disableHardwareAcceleration()`, para economizar memória (NFR-03).

## ADR-02 — Hook global com `uiohook-napi`, não `globalShortcut`

17/out/2026 (commit `bae6eba`) · Aceita — Victor Alves

**Contexto**

`globalShortcut` do Electron só avisa quando o atalho é pressionado; não avisa quando a tecla é solta e não aceita uma tecla modificadora sozinha (Ctrl direito).

**Decisão**

- `uiohook-napi` (libuiohook, N-API, binários prontos) para keydown/keyup globais.

**Consequências**

- Positivas: keydown e keyup globais da tecla de ditado, inclusive de uma modificadora sozinha. Ctrl direito sozinho não faz nada nos apps, então não atrapalha.
- Negativas:
  - não dá para "engolir" a tecla;
  - o `Esc` de cancelar também chega ao app em foco (aceito na Fase 1 — RISK-013);
  - auto-repetição precisa ser filtrada (só o primeiro keydown conta — BR-002).

**Implementação**

- `src/main/keyboard.ts:11-19` — `startKeyboardHook`; `classify` reduz cada evento a `hotkey`, `escape` ou `other` antes de sair do hook (BR-007). Desde a spec `janela-principal`, o `uiohook-napi` é carregado dentro da função (`:13`), para um binário ausente cair no `try` do `index.ts` em vez de derrubar a abertura.
- `src/main/keys.ts:4`, `:6` — `ESCAPE_KEYCODE` e `HOTKEY_CODES` (códigos do libuiohook como números, para testar sem carregar o módulo nativo).
- `src/main/hotkey.ts:33` — `DEFAULT_HOTKEY_TIMING`: `shortcutWindowMs 1000`, `repeatGapMs 1500`; `:35-104` — `HotkeyController` (lógica pura, TEST-001).
- `src/main/index.ts:228-234` — se o hook não carregar, o app abre mesmo assim e registra `keyboard_hook_unavailable`; a janela principal mostra "A tecla de ditado não está funcionando" no Início (spec `janela-principal`, FR-UI-13).

## ADR-03 — Inserção por clipboard + Ctrl+V via `SendInput`

17/out/2026 (commit `bae6eba`) · Aceita — Victor Alves

**Contexto**

Digitar caractere por caractere (`SendInput` com `KEYEVENTF_UNICODE`) é lento em textos longos e quebra em apps com autocomplete. Colar é instantâneo e preserva acentos.

**Decisão**

- Salvar o clipboard, escrever o texto, mandar Ctrl+V com `SendInput` (via `koffi` chamando `user32.dll`), restaurar o clipboard ~250 ms depois.

**Consequências**

- Positivas: inserção instantânea, com acentos preservados, em textos de qualquer tamanho.
- Negativas:
  - apps rodando como administrador ignoram input de processo comum (UIPI) → fallback FR-DICT-10 (BR-009; RISK-003);
  - gerenciadores de clipboard (Win + V) veem o texto. Aceito (RISK-008);
  - o `uiohook` enxerga o Ctrl+V sintético; o `HotkeyController` ignora eventos enquanto `inserting = true`, e o Ctrl sintético é o esquerdo (`VK_CONTROL`), diferente do direito (BR-008).

**Implementação**

- `src/main/insert/inserter.ts:18-21` — `RELEASE_WAIT_MS 2000`, `BEFORE_PASTE_MS 20`, `AFTER_PASTE_MS 100`, `RESTORE_AFTER_MS 250`; `:73-110` — `TextInserter.insert`: espera a tecla física soltar, confere a elevação do app em foco, faz o backup, cola e restaura só se o clipboard ainda contiver o texto ditado (BR-010).
- `src/main/insert/win32.ts:7-10` — `VK_CONTROL 0x11`, `VK_V 0x56`, `INPUT_SIZE 40`; `:70-78` — `sendPasteShortcut` (quatro eventos num só `SendInput`); `:99-120` — `isSelfElevated` e `isForegroundWindowElevated`, por `GetTokenInformation(TokenElevation)`. Escrito a partir da documentação da Microsoft.
- `src/main/hotkey.ts:51` — `onKeyDown` ignora eventos durante a inserção.

## ADR-04 — Groq Whisper `large-v3-turbo`, áudio inteiro ao soltar

17/out/2026 (commit `bae6eba`) · Aceita — Victor Alves

**Contexto**

Groq tem plano gratuito com folga para uso pessoal e transcreve muito rápido. Streaming de áudio durante a fala exigiria um servidor próprio com WebSocket.

**Decisão**

- Gravar a fala inteira e mandar um único `POST` multipart ao soltar a tecla.

**Consequências**

- Positivas: uma requisição por ditado, sem servidor próprio. O provedor fica atrás da interface `Transcriber`: trocar de provedor é escrever outra implementação (RISK-001).
- Negativas: latência cresce um pouco com o tamanho da fala (upload). Para falas de até 30 s, fica dentro do NFR-01 (a medição p50/p95 é a PEND-001). Streaming fica para a Fase 4, junto com o backend (RISK-014).

**Implementação**

- `src/main/transcribe/transcriber.ts:9` — interface `Transcriber`.
- `src/main/transcribe/groq.ts:6-7` — endpoint `https://api.groq.com/openai/v1/audio/transcriptions` e limite de 25 MB; `:40-41` — timeout 20 s e espera de 500 ms antes da nova tentativa; `:49-92` — `GroqTranscriber.transcribe`: uma nova tentativa só em 5xx, `temperature=0`, `response_format=verbose_json`. Contrato completo em [`API.md`](API.md#transcrição-groq).
- `src/main/transcribe/filters.ts:5` — `MIN_AUDIO_MS 500`; `:41` — `isNoSpeech`, os filtros anti-lixo (BR-005, BR-006; TEST-002).

## ADR-05 — Sem limpeza por IA na Fase 1, mas com o encaixe pronto

17/out/2026 (commit `bae6eba`) · Aceita — Victor Alves

**Contexto**

A limpeza do texto por IA — remover "é…", "tipo" e repetições e aplicar a autocorreção falada ("não, quer dizer…") — é o FR-CLEAN-01, da Fase 2 (Claude Haiku), e está fora do escopo da Fase 1 ([`PRD.md`](PRD.md#fora-de-escopo)).

**Decisão**

- `Refiner` existe desde o início com implementação identidade.
- A Fase 2 troca a implementação sem mexer no fluxo.

**Consequências**

- Positivas: trocar `IdentityRefiner` por implementação com LLM sem mexer no fluxo.
- Negativas: nenhuma registrada.

**Implementação**

- `src/main/refine.ts:3-11` — interface `Refiner` e `IdentityRefiner`, que devolve o texto sem mudança.
- `src/main/session.ts:195` — `onRecorderResult` passa a transcrição pelo `Refiner` antes de inserir; `src/main/index.ts:191` — liga o `IdentityRefiner`.

## ADR-06 — Sem backend na Fase 1

17/out/2026 (commit `bae6eba`) · Aceita — Victor Alves

**Contexto**

Uso pessoal, chave do próprio usuário.

**Decisão**

- Chave da Groq em `frontend/.env` (dev).
- Nenhum servidor: o app chama a API da Groq direto.

**Consequências**

- Positivas: nada para hospedar nem manter na Fase 1.
- Negativas: **não distribuir o app** com chave embutida. Distribuição exige o backend da Fase 4 ([Security Guide §10](Security-Guide.md#10-segredos-e-configuração)). Até a Fase 2, a chave fica em texto puro no `.env` de desenvolvimento (RISK-009). Desde 18/out/2026 a [ADR-08](#adr-08--chave-da-groq-no-safestorage-do-electron-com-o-env-só-como-reserva-de-desenvolvimento) complementa esta: a chave do próprio usuário pode ser digitada no app e guardada cifrada, e o `.env` vira só reserva de desenvolvimento; o "não distribuir com chave embutida" continua valendo.

**Implementação**

- `src/main/index.ts:50-58` — `process.loadEnvFile` lê `<appPath>/.env`, desde a ADR-08 só com o app não empacotado; sem o arquivo (e sem chave salva), o app abre e o ditado mostra `no_api_key`.
- `src/main/session.ts:86-90` — sem chave, a sessão nem começa (BR-013).
- `.env.example` — só o nome `GROQ_API_KEY`, sem valor; `.gitignore` da raiz: `.env`, `.env.*`, `!.env.example`.

## ADR-07 — Sala limpa em relação ao Typeless

17/out/2026 (commit `bae6eba`) · Aceita — Victor Alves

**Contexto**

A arquitetura foi estudada por engenharia reversa do Typeless 2.8.2 ([`referencia/estudo-typeless.md`](referencia/estudo-typeless.md)).

**Decisão**

- Do estudo saem **ideias e comportamentos**, nunca código, strings, constantes, ícones, sons ou textos.
- Todo o código do Touch Speaker é escrito do zero.

**Consequências**

- Positivas: o código do Touch Speaker não depende do material do estudo; a parte publicável do estudo fica no repositório como referência não normativa.
- Negativas: na dúvida se algo é "ideia" ou "cópia", o trabalho é escrever do zero a partir da documentação pública da Microsoft/Electron/Groq, sem abrir o material bruto do estudo. O risco de cópia por engano é permanente (RISK-005).

**Implementação**

- `.gitignore` da raiz — `targets/`, `analysis/` e `rea/` bloqueados como segunda trava; o material bruto fica fora da pasta do repositório.
- `docs/referencia/estudo-typeless.md` — o estudo publicável.
- [`Security-Guide.md` §15.3](Security-Guide.md#153-sala-limpa-engenharia-reversa) — as regras da sala limpa.
- `src/main/insert/win32.ts:1-2` — exemplo do método: escrito a partir da documentação da Microsoft para `SendInput` e `GetTokenInformation`.

## ADR-08 — Chave da Groq no `safeStorage` do Electron, com o `.env` só como reserva de desenvolvimento

18/out/2026 (spec [`janela-principal`](spec/features/janela-principal.md), Anexo B; texto aceito na D10) · Aceita — Victor Alves

**Contexto**

- A chave da Groq do usuário vivia em `frontend/.env`, em texto puro, lida na abertura (`src/main/index.ts:33-38` em `0c0aa5b`) — aceito só em desenvolvimento (RISK-009, [ADR-06](#adr-06--sem-backend-na-fase-1)).
- A M2 traz um app instalado (spec [`distribuicao-windows-macos`](spec/features/distribuicao-windows-macos.md)), que não tem a pasta do código nem `.env`; sem outro lugar para a chave, o ditado sempre terminaria em `no_api_key`.
- O SDD já planejava a chave no `safeStorage` do Electron (DPAPI no Windows), digitada na tela de configurações (SDD §6.2, §22, §29 Fase 2), e o C6 aceita o `safeStorage` para uso pessoal.
- A ADR-06 proíbe distribuir o app com chave embutida; essa regra não muda.

**Decisão**

- A pessoa digita a chave na seção Configurações da janela principal. O renderer a manda ao main **uma vez**, pelo canal `groq-key:set`; ela nunca volta ao renderer, nem em parte.
- O main confere o formato (1 a 512 caracteres depois de aparar as pontas, sem espaço nem caractere de controle), cifra com `safeStorage.encryptString` e grava os bytes em `%APPDATA%\Touch Speaker\groq-key.bin`, de forma atômica (arquivo temporário na mesma pasta + renomear). "Remover chave" apaga o arquivo.
- Na abertura, depois do `ready`, o main carrega a chave nesta ordem: `groq-key.bin` decifrado; senão, **só com o app não empacotado** (`!app.isPackaged`), o `GROQ_API_KEY` do `.env`; senão, nenhuma. Arquivo que não decifra vira o estado `unreadable`, com o app abrindo normalmente.
- A chave fica em memória só no processo main, num `CredentialStore`; o `GroqTranscriber` a lê a cada chamada.
- Se `safeStorage.isEncryptionAvailable()` for falso, o app recusa salvar e mostra a mensagem; **nunca** grava a chave em texto puro como alternativa.
- A chave nunca vai para o log, para o `config.json` nem para resposta de IPC; o log registra só eventos e o estado (`stored`, `env`, `none`, `unreadable`).
- Nenhuma dependência nova: `safeStorage` é API do próprio Electron.

**Consequências**

- Positivas: o app instalado dita com a chave do próprio usuário; o RISK-009 deixa de valer para o app empacotado (o `.env` nem é lido); trocar ou remover a chave não exige reiniciar; o desenvolvimento com `.env` continua funcionando.
- Negativas:
  - a DPAPI protege por usuário do Windows, não por app: outro processo da mesma conta consegue decifrar (RISK-021). Aceito — é o mesmo modelo de qualquer app pessoal, e a chave é revogável no console da Groq;
  - o arquivo cifrado não sobrevive a troca de máquina, de perfil ou à perda do dado de cifra do Chromium na pasta de dados: a pessoa salva a chave de novo (RISK-022);
  - um segundo renderer passa a tocar um segredo (RISK-026), mitigado pelas regras do [Security Guide](Security-Guide.md) §7 e §9;
  - no macOS o `safeStorage` usa o Keychain; vale quando o porte da spec `distribuicao-windows-macos` for implementado ([ADR-11](#adr-11--macos-como-plataforma-suportada-e-distribuição-restrita-antes-da-fase-4), aceita em 18/out/2026);
  - não substitui a ADR-06: distribuir para outras pessoas com chave do produto continua exigindo o backend da Fase 4.

**Implementação** (código da spec `janela-principal`, não commitado, 18/out/2026)

- `src/main/credentials.ts:43-48` — `normalizeGroqKey` (formato do FR-UI-19); `:50-137` — `CredentialStore`: `load` (`:68`, ordem arquivo → `.env` só sem empacotar → nenhuma; `unreadable` sem exceção), `current` (`:86`), `save` (`:95`, recusa sem cifra; gravação atômica com `writeFileAtomic` em `:107`, `mode 0o600`), `remove` (`:117`). Cifra e sistema de arquivos entram por porta (`CipherPort`, `FilePort` de `src/main/atomic-file.ts`), para testar sem Electron (TEST-007).
- `src/main/index.ts:50-58` — `.env` só com `!app.isPackaged`; `:147-158` — o `CredentialStore` nasce depois do `ready`, com a API **síncrona** do `safeStorage` (`isEncryptionAvailable`, `encryptString`, `decryptString` — conferida nos tipos do Electron 44.9.0), e o `groq_key_unreadable` vai para o log; `:160` — `GroqTranscriber` com `getApiKey: () => credentials.current()`; `:291-318` — handlers de `groq-key:set` e `groq-key:remove` (remetente, formato, log sem a chave, bandeja e `app:status` atualizados); `app_ready` ganha `groq_key` (`:366`).
- `src/main/transcribe/groq.ts:14` — `GroqOptions.getApiKey` no lugar de `apiKey`; `:46` e `:50` — lida em `hasCredentials()` e a cada `transcribe` (TEST-003 ajustado).
- `src/main/tray.ts:43` — `setGroqKeyState`: status e dica da bandeja mudam sem reiniciar.
- `src/shared/ipc.ts:24-25`, `src/preload/main-window.ts:31-32`, `src/main/main-window-ipc.ts:39` — canais `groq-key:set` e `groq-key:remove`, a ponte `window.touchSpeakerApp` e a validação (`asGroqKeyInput`; TEST-009).
- `docs/Security-Guide.md` §10, `docs/ENVIRONMENT.md`, `docs/API.md` "Autenticação" — passaram de PLANEJADO a FATO.

## ADR-09 — SQLite local pelo `node:sqlite` embutido para o histórico de ditados

18/out/2026 (spec [`historico`](spec/features/historico.md) §19 e spike T1; spec de migração [`historico-dados-v1`](spec/features/historico-dados-v1.md)) · Aceita — Victor Alves (a proposta original, com o `better-sqlite3` 13.0.3, foi aprovada com a spec; a troca para o `node:sqlite` estava autorizada pelo Victor caso o spike mostrasse que ele funciona — decisão de 18/out/2026)

**Contexto**

- O histórico (FR-HIST-01…26) precisa guardar texto na máquina da pessoa com paginação, purga por data, busca, exclusão que não deixa resto legível e transação contra fechamento abrupto. O `docs/DATABASE.md` e o `docs/ARCHITECTURE.md` planejavam SQLite em `database/local/`, sem ADR.
- A spec propôs o `better-sqlite3` 13.0.3 (Node-API, binários prontos) e deixou o `node:sqlite` — o módulo SQLite embutido no Node — para o spike T1 comparar.
- **Resultado do spike T1 (18/out/2026)**, rodando o Electron como Node puro (`ELECTRON_RUN_AS_NODE=1 npx electron`, sem janela, sem app, sem hook de teclado) e o Node do sistema:
  - Electron 44.9.0 → Node 24.22.0, `node:sqlite` com **SQLite 3.53.4**; Node do sistema (o dos testes) 24.20.0, também SQLite 3.53.4. Nenhum aviso de módulo experimental.
  - Funcionaram nos dois: arquivo em disco, `journal_mode=WAL`, `secure_delete=ON`, transação (`BEGIN`/`COMMIT`/`ROLLBACK`), `INSERT … ON CONFLICT`, `PRAGMA wal_checkpoint(TRUNCATE)`, `VACUUM`, função registrada (`db.function`, usada na busca normalizada) e, depois de apagar e compactar, o texto apagado não aparece nos bytes do `.db` nem do `-wal`.
  - Arquivo corrompido (bytes aleatórios) dá erro limpo (`ERR_SQLITE_ERROR`, código 26 — "file is not a database"), que o app transforma em histórico indisponível.
  - Achado lateral: `INSERT OR IGNORE` também engole violação de `CHECK` em silêncio; a gravação usa `ON CONFLICT (id) DO NOTHING`.
  - Os tipos do `@types/node` 24.19.2 já trazem `node:sqlite` (`DatabaseSync`, `StatementSync`, `isOpen`, `function`).
  - O `app.getPath` do Electron 44.9.0 aceita `home`, `appData`, `assets`, `userData`, `sessionData`, `temp`, `exe`, `module`, `desktop`, `documents`, `downloads`, `music`, `pictures`, `videos`, `recent`, `logs`, `crashDumps` — **nenhum nome para a pasta Local** do Windows (`appData` é a Roaming); o caminho do banco sai da variável `LOCALAPPDATA` (spec `historico` D14).
- Estabilidade: a documentação do Node 24.22.0 marca o `node:sqlite` como **"Stability: 1.2 — Release candidate"** (desde o v24.15.0; antes, experimental).

**Decisão**

- Um arquivo SQLite na pasta **local** da pessoa — Windows: `%LOCALAPPDATA%\Touch Speaker\touch-speaker.db` (com `-wal` e `-shm`); macOS, se a distribuição for aprovada: `app.getPath('appData')` + `Touch Speaker` —, aberto **só pelo processo main**, por uma conexão única, com `journal_mode=WAL` e `secure_delete=ON`. Sem `LOCALAPPDATA`, o histórico fica indisponível; nunca cai na pasta Roaming.
- Driver: o módulo **`node:sqlite` embutido** no Node do Electron (API síncrona `DatabaseSync`). **Nenhuma dependência nova** no `package.json`, nenhum módulo nativo de terceiro, nada a mudar no `allowScripts`.
- O driver é carregado com `require('node:sqlite')` **dentro** da função que abre o banco, não na importação: um runtime sem ele deixa o histórico indisponível e o app abre e dita como antes (FR-HIST-16).
- Migrations numeradas em `database/local/NNNN_descricao.sql`, só para frente, aplicadas ao abrir, cada uma numa transação, registradas em `schema_migrations`, copiadas para `dist/database/local/` no build.
- Só `main/history/store.ts` e `main/history/migrations.ts` tocam o driver.

**Consequências**

- Positivas:
  - nenhuma dependência de terceiro nem binário nativo novo: nada a confiar além do próprio Electron, que já está em versão exata; o RISK-004 (módulos nativos e versão do Electron) não piora;
  - o mesmo SQLite nos testes e no app: o `npm test` roda o banco real (TEST-015), e não há rebuild por ABI;
  - o empacotamento não leva prebuilds nem tira nada do `asar` — só as migrations vão no pacote;
  - consultas indexadas, transação, exclusão segura e compactação pelo próprio SQLite; trocar de driver mexe em dois arquivos.
- Negativas:
  - o `node:sqlite` é "release candidate", não "stable": uma atualização do Electron (que traz outro Node) pode mudar a API — mitigado pela versão exata do Electron e pelos testes do banco no `npm test`, que quebram na atualização (RISK-032);
  - a versão do SQLite é a que o Electron traz: atualizar o SQLite é atualizar o Electron;
  - a mesma ressalva da proposta: se a melhoria futura de criptografia escolher banco cifrado inteiro, o driver muda e esta ADR é substituída.

**Alternativas**

- `better-sqlite3` 13.0.3 — a proposta original: Node-API, binários prontos para oito plataformas, sem script de instalação. Rejeitado porque o `node:sqlite` atende sem dependência nem binário de terceiro (~27 MB descompactado) e sem item de empacotamento.
- `sql.js`, arquivo JSON/JSONL, IndexedDB no renderer — rejeitados na spec `historico` §12.

**Implementação** (código da spec `historico`, não commitado, 18/out/2026)

- `database/local/0001_init.sql` — `dictations` (cinco colunas, `CHECK`s) e `idx_dictations_created_at`.
- `src/main/history/store.ts` — `openSqliteHistory` (carrega o driver, cria a pasta, WAL, `secure_delete`, migrations, função `ts_normalize`) e `HistoryStore` (`save` com purga na mesma transação e `ON CONFLICT (id) DO NOTHING`, `list` paginada por `created_at` + `id`, `get`, `remove` e `purge` com `wal_checkpoint(TRUNCATE)`, `clear` com checkpoint + `VACUUM`, `scan`).
- `src/main/history/migrations.ts` — `readMigrations`, `applyMigrations` (uma transação por migration; `schema_too_new` sem tocar no arquivo).
- `src/main/history/paths.ts` — `historyLocation` (`LOCALAPPDATA` no Windows, `appData` no macOS).
- `src/main/history/service.ts` — `openHistory` (abre, migra, purga, `history_ready`/`history_unavailable`).
- `scripts/copy-static.mjs` — copia `database/local/*.sql` para `dist/database/local/`.
- `docs/DATABASE.md`, `docs/ENVIRONMENT.md`, `docs/Security-Guide.md` §15.1.

## ADR-11 — macOS como plataforma suportada e distribuição restrita antes da Fase 4

18/out/2026 (spec [`distribuicao-windows-macos`](spec/features/distribuicao-windows-macos.md), §17.2) · Aceita — Victor Alves (spec aprovada e ADR confirmada em 18/out/2026) · **implementação pendente**

Substitui a decisão fixa "Windows primeiro; nada de macOS/Linux/mobile antes da Fase 4" do `CLAUDE.md` e, em parte, a frase de consequência da [ADR-06](#adr-06--sem-backend-na-fase-1) "Distribuição exige o backend da Fase 4"; o resto da ADR-06 continua aceito.

**Contexto**

- Decisão fixa do `CLAUDE.md`, NFR-06 e SDD §2.2/§2.4: só Windows até a Fase 4.
- ADR-06: o app não é distribuído com chave; "Distribuição exige o backend da Fase 4".
- Victor, 18/out/2026: app baixável sem terminal, Windows e macOS; "um amigo meu usa Mac, a gente tem que enfatizar isso".
- A [ADR-08](#adr-08--chave-da-groq-no-safestorage-do-electron-com-o-env-só-como-reserva-de-desenvolvimento) guarda a chave de cada pessoa no `safeStorage` do próprio computador — o "uso pessoal" do C6.

**Decisão**

1. A partir da M2, o macOS 13 (Ventura) ou mais novo — o mínimo do Electron 44 — é plataforma suportada, ao lado do Windows 10/11 x64, em Mac com Apple Silicon (arm64 — D4 da spec). Mac Intel, mobile e Windows arm64 continuam fora até a Fase 4.
2. **Linux:** planejado para depois, sem data (Victor, 18/out/2026). Entra por spec própria; até lá nada no código ou nos docs promete Linux.
3. Antes da Fase 4, a distribuição é **restrita a pessoas convidadas pelo Victor**, sob o `LICENSE.md`, sem termo extra (D7), entregue por Release do GitHub (D6; ver D19), e **sem chave**: cada pessoa usa a própria chave da Groq, digitada no app e guardada no `safeStorage` (BYOK). Chave embutida continua proibida (ADR-06). Distribuição como produto (pública, com contas) continua exigindo o backend da Fase 4.
4. As diferenças de sistema ficam atrás de interface (`PasteDriver`, `PermissionsPort`), escolhidas na inicialização:
   - hook: `uiohook-napi` nos dois sistemas (a ADR-02 vale); no macOS, só inicia com a permissão de Acessibilidade, conferida antes;
   - colagem: no Windows, a ADR-03; no macOS, clipboard + Cmd+V por `CGEventPost` (CoreGraphics via `koffi`), com o mesmo backup e a mesma restauração;
   - elevação/UIPI: só no Windows; no macOS, o análogo é a falta de Acessibilidade e a entrada segura, que caem no mesmo fallback "texto copiado".
5. As regras de negócio BR-001…015 valem nos dois sistemas; muda só o texto que cita atalho ou sistema.

**Consequências**

- Positivas: o amigo do Victor usa o app; o código ganha uma fronteira de plataforma testável; o próprio Victor deixa o modo de desenvolvimento.
- Negativas: roteiro manual em dois sistemas a cada versão; o Victor não tem Mac (teste depende do amigo ou do CI — RISK-novo-7 da spec); sem assinatura paga por ora (D1, D2), o que deixa avisos do SmartScreen e do Gatekeeper e permissões do macOS possivelmente pedidas de novo a cada versão; NFR-06, o SDD (§2.2, §2.4, §29), o PRD e o `CLAUDE.md` mudam.

**Implementação** — pendente: a spec está aprovada, mas o porte para macOS ainda não está no código (18/out/2026); hoje o app roda só no Windows. Previsto: `frontend/src/main/platform.ts`, `insert/darwin.ts`, o `PasteDriver` no `TextInserter`, `PermissionsPort`, `stringsFor`, `defaultConfig`, `keys.ts` (`RightMeta`), menu e Dock no `index.ts`, ícone modelo no `icon.ts`. Esta seção passa a citar arquivo e linha quando o código entrar.

## ADR-12 — Fonte Inter embutida no app

18/out/2026 (spec [`design-system`](spec/features/design-system.md), §17) · Aceita — Victor Alves

**Contexto**

- A interface usava a fonte do sistema, `Segoe UI Variable` (`src/renderer/pill.css:20` em `0c0aa5b`); nenhuma fonte era embutida.
- Em 18/out/2026 o Victor escolheu a **Inter** — fonte pública, distribuída pelo Google Fonts e pelo projeto Inter, sob a SIL Open Font License 1.1 —, embutida no app.
- A CSP da pílula só aceita arquivos do próprio app (`default-src 'self'`, `connect-src 'none'` — `src/renderer/pill.html:7`), e a única integração externa é a Groq ([`INTEGRATION.md`](INTEGRATION.md)).
- O porte para macOS (spec [`distribuicao-windows-macos`](spec/features/distribuicao-windows-macos.md)) não tem Segoe UI.

**Decisão**

- O arquivo **variável** da Inter (eixo `wght` de 100 a 900 num arquivo só — o app usa 400, 500 e 600 —, mais o eixo `opsz` de 14 a 32), como publicado pela origem, **sem modificar** (sem recorte nem conversão), em `frontend/src/renderer/fonts/`, com o texto da licença (`OFL.txt`) ao lado.
- `@font-face` em `tokens.css`, `src` relativo, `font-display: swap`; família com a pilha de reserva da Fase 1 (`'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif`).
- `scripts/copy-static.mjs` copia `fonts/` para `dist/renderer/fonts/`.
- **Sem pacote npm** (nenhuma dependência nova no `package.json`).
- **Exceção explícita** ao guardrail "Nunca trazer para o repositório binários de terceiros" (`CLAUDE.md`, "Nunca faça"): a regra mira o material bruto do estudo do Typeless; esta ADR libera **só** arquivo de fonte de origem pública, com licença que permite redistribuição, e com a licença no repositório. Nenhum outro binário de terceiro entra por ela.
- Nenhuma fonte, arquivo ou nome de fonte vem do estudo de referência ([ADR-07](#adr-07--sala-limpa-em-relação-ao-typeless)).

**Consequências**

- Positivas: a mesma fonte no Windows e no macOS; nenhuma requisição de rede; a versão da fonte fica sob controle do repositório.
- Negativas: um arquivo binário de terceiro no repositório (352 240 bytes); bytes a mais no app; a memória em repouso precisa ser medida de novo (NFR-03, roteiro V-DS-5 da spec); o instalador precisa levar a licença (spec `distribuicao-windows-macos`).
- Alternativas rejeitadas: fonte do sistema; Google Fonts em tempo de execução (fura a CSP e abre uma segunda integração externa); pacote npm (dependência nova só para copiar um arquivo) — spec `design-system` §12.

**Implementação**

- Origem: release oficial **Inter 4.1** do projeto Inter (`rsms/inter`, tag `v4.1`, publicada em 16/nov/2024), arquivo `Inter-4.1.zip` (33 707 794 bytes, SHA-256 `9883fdd4a49d4fb66bd8177ba6625ef9a64aa45899767dde3d36aa425756b11e`), baixado de `https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip` em 18/out/2026.
- `src/renderer/fonts/InterVariable.woff2` — o `web/InterVariable.woff2` do zip, sem modificação: 352 240 bytes, SHA-256 `693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3`. Só o estilo normal; o itálico não é usado e não entrou.
- `src/renderer/fonts/OFL.txt` — o `LICENSE.txt` do mesmo zip (SIL OFL 1.1, "Copyright (c) 2016 The Inter Project Authors"), com o conteúdo inalterado e o nome trocado: 4 380 bytes, SHA-256 `262481e844521b326f5ecd053e59b98c8b2da78c8ee1bdbb6e8174305e54935a` (com fim de linha LF, como veio).
- `src/renderer/tokens.css:13-19` — `@font-face`; `:33` — `--ts-font-sans`.
- `src/renderer/pill.ts:228-230` — a pílula pede a Inter ao abrir, ainda escondida (`document.fonts.load`), para o primeiro ditado já sair em Inter (FR-DS-13).
- `scripts/copy-static.mjs:21-22` — copia `fonts/` para `dist/renderer/fonts/`.
- `src/test/tokens.test.ts` — confere o `@font-face` local com `font-display: swap`, o arquivo e o `OFL.txt` em `src/` e em `dist/` (RISK-novo-3 da spec).

## ADR-13 — Ícones Lucide embutidos

18/out/2026 (spec [`janela-principal`](spec/features/janela-principal.md), estilo da janela; [`DESIGN.md`](DESIGN.md) §11) · **Proposta** — aguardando aval do Victor

**Contexto**

- Em 18/out/2026, a pedido do Victor, a janela principal ganhou o estilo shadcn ([`DESIGN.md`](DESIGN.md) §6.5), com os ícones da biblioteca que o shadcn/ui usa: a **Lucide**, publicada sob a licença ISC (os ícones derivados do Feather, sob a parte MIT do mesmo arquivo de licença).
- Os ícones já estão no código: dezesseis glifos de 16 px em `src/renderer/main-window/index.html` (barra lateral, botão de tema, Histórico, Início, listas suspensas — tabela no `DESIGN.md` §11).
- É arte de terceiros embutida no app, como a Inter, que tem a [ADR-12](#adr-12--fonte-inter-embutida-no-app); o `DESIGN.md` §11 tinha um `[PRECISA ESCLARECER]` perguntando se ela precisava de ADR própria.
- A CSP da janela só aceita arquivos do próprio app (`default-src 'none'`, `script-src`/`style-src`/`font-src 'self'`, `connect-src 'none'` — `src/renderer/main-window/index.html:7`), e a única integração externa é a Groq ([`INTEGRATION.md`](INTEGRATION.md)).

**Decisão**

- Ícones da **Lucide 1.52.0** (tag `1.52.0` do repositório oficial, lançada em 04/out/2026), copiados como **SVG inline** — vendorizados — em `src/renderer/main-window/index.html`, com os `path` e o `viewBox` sem modificação; só mudam `width`/`height` (16) e entram `class`, `aria-hidden="true"` e `focusable="false"`.
- **Sem pacote npm** (nenhuma dependência nova no `package.json`), sem fonte de ícones e sem requisição de rede.
- A licença da mesma tag, **sem modificação**, vai junto: `src/renderer/main-window/LICENSE-lucide.txt`, copiada para `dist/` ao lado da página.
- Ícone novo da janela principal sai da Lucide, de uma tag fixa e sem mexer nos `path`, com a versão, o arquivo de origem e o SHA-256 registrados no `DESIGN.md` §11. Fora da janela principal, ícone novo continua desenhado do zero.
- Nenhum ícone, nome ou desenho vem do estudo de referência ([ADR-07](#adr-07--sala-limpa-em-relação-ao-typeless)).

**Consequências**

- Positivas: ícones consistentes e conhecidos, no mesmo traço; nenhuma requisição de rede; a versão fica sob controle do repositório; trocar ou acrescentar um ícone é copiar um `path` de uma tag fixa.
- Negativas: arte de terceiro dentro do HTML da janela; a licença precisa viajar com o app (o instalador da spec `distribuicao-windows-macos` tem de levar o `LICENSE-lucide.txt`); atualizar a tag exige reconferir cada `path` e os SHA-256 da tabela.
- Alternativas rejeitadas: ícones desenhados do zero (custo alto para dezesseis glifos e traço menos consistente); pacote npm `lucide` ou `lucide-static` (dependência nova só para copiar SVG, e a janela não tem bundler); fonte de ícones ou CDN (fura a CSP e abre uma segunda integração externa).

**Implementação**

- Origem: repositório oficial da Lucide, tag `1.52.0`, pasta `icons/`; arquivo de cada ícone e SHA-256 na tabela do `DESIGN.md` §11.
- `src/renderer/main-window/index.html` — os SVG inline (os que o script clona ficam em `<template>`; comentário de origem em `:36-37`).
- `src/renderer/main-window/LICENSE-lucide.txt` — o `LICENSE` da tag, sem modificação: 3 208 bytes, SHA-256 `b495047bd93a9b06913511076f504daba17d5bbeb3e0650f3bb53a4220329c57`.
- `scripts/copy-static.mjs:13-19`, `:22` — `copyPages` copia os `.txt` (licenças) de `src/renderer/main-window/` para `dist/renderer/main-window/`.
- `src/test/tokens.test.ts:284-289` — confere que o `LICENSE-lucide.txt` está em `dist/` ao lado da página e começa por `ISC License`.
