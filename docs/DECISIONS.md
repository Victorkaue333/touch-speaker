# DECISIONS — Touch Speaker

> Última atualização: 17/out/2026 · Mantenedor: Victor Alves

Registro das decisões de arquitetura (ADRs) do projeto. As sete foram aceitas pelo Victor em 17/out/2026, junto com a Fase 1 (commit `bae6eba`), e até a reestruturação da documentação viviam na seção "Decisões-chave" do [`ARCHITECTURE.md`](ARCHITECTURE.md), no formato curto Contexto/Decisão/Consequências; aqui o texto é o mesmo, só redistribuído nos blocos de cada entrada. Mudar uma decisão = ADR nova que substitui a anterior, com aval do Victor; a antiga fica no arquivo, marcada como substituída. Em conflito entre documentos, este arquivo vem primeiro (SDD [§0.1](spec/spec-driven-development.md#01-política-de-prevalência-documental)). O código em `frontend/` é a fonte de fato sobre **o que existe**; a spec aprovada e o SDD são o contrato sobre **o que deve existir**. Divergência é defeito: código errado → corrige-se o código; spec errada → **corrige-se a spec primeiro** e só depois o código, com aval do Victor sempre que o comportamento muda.

Os caminhos citados em **Implementação** são relativos a `frontend/`, e as linhas foram conferidas no código de `ed0a1f5`, HEAD de `main`, em 17/out/2026. O estudo de referência do Typeless ([`referencia/estudo-typeless.md`](referencia/estudo-typeless.md)) informou parte destas decisões, mas não é normativo e é fonte proibida de código ([ADR-07](#adr-07--sala-limpa-em-relação-ao-typeless)).

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

Nenhuma ADR em proposta (SDD [§27](spec/spec-driven-development.md#27-adrs--decisões-arquiteturais)).

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
- `tsconfig.renderer.json` — renderer como script clássico, `lib` com DOM.
- `scripts/start.mjs` — abre o Electron sem o `ELECTRON_RUN_AS_NODE` herdado do VS Code; `scripts/copy-static.mjs` copia HTML e CSS do renderer para `dist/`.
- `src/main/index.ts:31` — `app.disableHardwareAcceleration()`, para economizar memória (NFR-03).

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

- `src/main/keyboard.ts:7-13` — `startKeyboardHook`; `classify` reduz cada evento a `hotkey`, `escape` ou `other` antes de sair do hook (BR-007).
- `src/main/keys.ts:4`, `:6` — `ESCAPE_KEYCODE` e `HOTKEY_CODES` (códigos do libuiohook como números, para testar sem carregar o módulo nativo).
- `src/main/hotkey.ts:33` — `DEFAULT_HOTKEY_TIMING`: `shortcutWindowMs 1000`, `repeatGapMs 1500`; `:35-104` — `HotkeyController` (lógica pura, TEST-001).
- `src/main/index.ts:165-170` — se o hook não carregar, o app abre mesmo assim e registra `keyboard_hook_unavailable`.

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
- `src/main/transcribe/groq.ts:6-7` — endpoint `https://api.groq.com/openai/v1/audio/transcriptions` e limite de 25 MB; `:36-37` — timeout 20 s e espera de 500 ms antes da nova tentativa; `:45-87` — `GroqTranscriber.transcribe`: uma nova tentativa só em 5xx, `temperature=0`, `response_format=verbose_json`. Contrato completo em [`API.md`](API.md#transcrição-groq).
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
- `src/main/session.ts:195` — `onRecorderResult` passa a transcrição pelo `Refiner` antes de inserir; `src/main/index.ts:133` — liga o `IdentityRefiner`.

## ADR-06 — Sem backend na Fase 1

17/out/2026 (commit `bae6eba`) · Aceita — Victor Alves

**Contexto**

Uso pessoal, chave do próprio usuário.

**Decisão**

- Chave da Groq em `frontend/.env` (dev).
- Nenhum servidor: o app chama a API da Groq direto.

**Consequências**

- Positivas: nada para hospedar nem manter na Fase 1.
- Negativas: **não distribuir o app** com chave embutida. Distribuição exige o backend da Fase 4 ([Security Guide §10](Security-Guide.md#10-segredos-e-configuração)). Até a Fase 2, a chave fica em texto puro no `.env` de desenvolvimento (RISK-009).

**Implementação**

- `src/main/index.ts:33-38` — `process.loadEnvFile` lê `<appPath>/.env`; sem o arquivo, o app abre e o ditado mostra `no_api_key`.
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
