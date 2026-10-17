# ARCHITECTURE — Touch Speaker

> **Versão:** 0.1 · **Data:** 17/out/2026 · Cobre a Fase 1 em detalhe e marca o que é planejado.

## Visão geral

Touch Speaker é um app **Electron** que roda na bandeja do Windows. Na Fase 1 não existe servidor
próprio: o app chama a API da Groq direto com a chave do próprio usuário.

```text
┌────────────────────────── Windows ───────────────────────────┐
│                                                              │
│  Teclado ──► uiohook-napi (hook global) ──┐                  │
│                                           ▼                  │
│  ┌──────────── Processo main (Node) ─────────────────────┐   │
│  │ HotkeyController ─► SessionController ─► Transcriber ─┼───┼──► Groq API
│  │                          │      ▲          (fetch)    │   │   (whisper-large-v3-turbo)
│  │                          │      │ áudio (IPC)         │   │
│  │                          ▼      │                     │   │
│  │                    TextInserter ─► clipboard + SendInput (koffi → user32.dll)
│  │                          │                            │   │
│  │                  Tray · Config · Logger               │   │
│  └──────────────────────────┼────────────────────────────┘   │
│                             │ IPC (contextBridge)            │
│  ┌──────── Renderer: janela "pílula" ───────┐                │
│  │ Recorder (getUserMedia + MediaRecorder)  │ ◄── microfone  │
│  │ UI de status (ouvindo / transcrevendo /  │                │
│  │ erro) + medidor de nível                 │                │
│  └──────────────────────────────────────────┘                │
│                                                              │
│  App em foco (VS Code, Chrome, WhatsApp…) ◄── Ctrl+V         │
└──────────────────────────────────────────────────────────────┘
```

## Diagrama de componentes

| Componente | Processo | Responsabilidade |
| --- | --- | --- |
| `HotkeyController` | main | Recebe eventos do `uiohook-napi`, filtra auto-repetição, decide segurar vs. toque (limite 500 ms) e emite `start` / `stop` / `cancel` |
| `SessionController` | main | Máquina de estados da sessão de ditado (`idle → recording → transcribing → inserting → idle`, com `error`). Um único dono do estado |
| `Recorder` | renderer (pílula) | Abre o microfone no `start`, grava `audio/webm;codecs=opus`, mede nível, fecha o microfone no `stop` e devolve o áudio por IPC |
| `Transcriber` | main | Interface com um adapter por provedor. Fase 1: `GroqTranscriber`. Aplica os filtros anti-lixo (FR-DICT-08) |
| `Refiner` | main | Interface com implementação "identidade" na Fase 1 (`refine(text) => text`). Ponto de entrada da limpeza por IA na Fase 2 |
| `TextInserter` | main | Backup do clipboard → escreve texto → Ctrl+V via `SendInput` → restaura clipboard. Detecta falha e aciona o fallback (FR-DICT-10) |
| `Tray` | main | Ícone, menu, sair |
| `Config` | main | Lê/valida `config.json` em `%APPDATA%\Touch Speaker\` com defaults |
| `Logger` | main | Log local em arquivo, **sem** texto ditado nem áudio (só tempos, tamanhos e códigos de erro) |

## Camadas e responsabilidades

Estrutura do repositório:

| Pasta | O que vive ali | Fase |
| --- | --- | --- |
| `frontend/` | O app desktop inteiro (Electron: main, preload, renderer). É o "cliente" do produto | 1 |
| `backend/` | API própria (contas, proxy das chaves de IA, cotas, sync). **Vazia até a Fase 4** | 4 |
| `database/` | Migrations: `database/local/` (SQLite do histórico, Fase 2) e `database/server/` (Fase 4) | 2 / 4 |
| `docs/` | Esta documentação, specs e o estudo de referência (`docs/referencia/`) | — |

Estrutura de `frontend/` (implementada em 17/out/2026):

```text
frontend/
  package.json            Electron 44.9, TypeScript 7.0, koffi 3.3, uiohook-napi 1.5 (versões exatas)
  tsconfig.main.json      main + preload + shared + testes → CommonJS, strict
  tsconfig.renderer.json  renderer → script clássico (sem módulos), lib DOM
  .env / .env.example     GROQ_API_KEY (.env fora do git)
  scripts/
    copy-static.mjs       copia HTML/CSS do renderer para dist/
    start.mjs             abre o Electron sem ELECTRON_RUN_AS_NODE (ver abaixo)
  src/
    shared/ipc.ts         canais e payloads do IPC (docs/API.md §3)
    main/
      index.ts            bootstrap, ciclo de vida, permissões de mídia, validação de IPC
      config.ts           config.json com defaults e validação
      logger.ts           log rotativo só com metadados
      strings.ts          todos os textos da interface (pt-BR)
      errors.ts           códigos de erro
      keys.ts             códigos de tecla do libuiohook
      hotkey.ts           HotkeyController (lógica pura, testada)
      keyboard.ts         ponte uiohook-napi → HotkeyController
      session.ts          SessionController (dono único do estado)
      pill-window.ts      janela da pílula
      tray.ts · icon.ts   bandeja e ícone desenhado em código
      refine.ts           Refiner (identidade na Fase 1)
      transcribe/         transcriber.ts (interface) · groq.ts · filters.ts (anti-lixo)
      insert/             inserter.ts (clipboard + Ctrl+V + restauração) · win32.ts (koffi)
    preload/pill.ts       contextBridge com a API mínima da pílula
    renderer/             pill.html · pill.css · pill.ts (gravação, medidor, sons) · global.d.ts
    test/                 hotkey · filters · groq · config (node:test)
```

**Notas de implementação:**

- O host de extensões do VS Code exporta `ELECTRON_RUN_AS_NODE=1`, que faz o `electron.exe` rodar
  como Node puro e sair na hora. `npm run dev` / `npm start` passam por `scripts/start.mjs`, que
  remove essa variável.
- `app.disableHardwareAcceleration()`: a pílula não precisa de GPU; economiza memória (NFR-03).
- Clipboard do Electron 44 é assíncrono e baseado em `ClipboardItem` (modelo W3C): o backup lê
  todos os tipos de cada item e a restauração grava de volta numa chamada atômica.
- `koffi` 3 traz o binário pelo pacote opcional `@koromix/koffi-win32-x64` e `uiohook-napi` traz
  `prebuilds/win32-x64`. Os scripts de instalação dos dois ficam negados (`allowScripts: false`).

## Fluxo de um ditado (sequência)

```text
Usuário        uiohook     Hotkey      Session      Pílula/Recorder     Groq        Inserter
  │ segura RCtrl │           │            │                 │             │             │
  │────────────►│ keydown   │            │                 │             │             │
  │             │──────────►│ 1º down    │                 │             │             │
  │             │           │──start────►│ recording       │             │             │
  │             │           │            │──show + start──►│ getUserMedia│             │
  │  fala…      │           │            │                 │ grava webm  │             │
  │ solta RCtrl │ keyup     │            │                 │             │             │
  │────────────►│──────────►│ ≥500ms     │                 │             │             │
  │             │           │──stop─────►│ transcribing    │             │             │
  │             │           │            │──stop──────────►│ fecha mic   │             │
  │             │           │            │◄──áudio (IPC)───│             │             │
  │             │           │            │──POST multipart──────────────►│             │
  │             │           │            │◄──texto + segments────────────│             │
  │             │           │            │ filtros anti-lixo             │             │
  │             │           │            │──insert(texto)───────────────────────────►│
  │             │           │            │                 │             │ backup clip │
  │             │           │            │                 │             │ writeText   │
  │             │           │            │                 │             │ SendInput   │
  │             │           │            │                 │             │ Ctrl+V      │
  │             │           │            │◄──ok / falha──────────────────────────────│
  │             │           │            │ idle            │ esconde     │ restaura    │
```

## Integrações externas

| Serviço | Uso | Contrato |
| --- | --- | --- |
| **Groq Cloud** | Transcrição (`whisper-large-v3-turbo`) | [API.md §2](API.md#2-api-externa-groq-transcription) |
| **Anthropic** (Fase 2) | Limpeza do texto (Claude Haiku) | A definir na spec da Fase 2 |

## Decisões-chave

Formato curto de ADR. Mudar uma decisão = novo ADR que substitui o anterior.

### ADR-01 — Electron + TypeScript

**Contexto:** Victor trabalha com JS/React; o app precisa de UI flutuante, bandeja e acesso a Win32.
**Decisão:** Electron 44 + TypeScript estrito, build com `tsc` para CommonJS, sem bundler na Fase 1.
**Consequências:** app grande (~150 MB) e ~100 MB de RAM; em troca, velocidade de desenvolvimento e
o mesmo modelo que produtos do mercado usam. Tauri fica como opção se o tamanho virar problema.

### ADR-02 — Hook global com `uiohook-napi`, não `globalShortcut`

**Contexto:** `globalShortcut` do Electron só avisa quando o atalho é pressionado; não avisa quando
a tecla é solta e não aceita uma tecla modificadora sozinha (Ctrl direito).
**Decisão:** `uiohook-napi` (libuiohook, N-API, binários prontos) para keydown/keyup globais.
**Consequências:** não dá para "engolir" a tecla. Ctrl direito sozinho não faz nada nos apps, então
não atrapalha. O `Esc` de cancelar também chega ao app em foco (aceito na Fase 1).
Auto-repetição precisa ser filtrada (só o primeiro keydown conta).

### ADR-03 — Inserção por clipboard + Ctrl+V via `SendInput`

**Contexto:** digitar caractere por caractere (`SendInput` com `KEYEVENTF_UNICODE`) é lento em textos
longos e quebra em apps com autocomplete. Colar é instantâneo e preserva acentos.
**Decisão:** salvar o clipboard, escrever o texto, mandar Ctrl+V com `SendInput` (via `koffi`
chamando `user32.dll`), restaurar o clipboard ~250 ms depois.
**Consequências:**

- Apps rodando como administrador ignoram input de processo comum (UIPI) → fallback FR-DICT-10.
- Gerenciadores de clipboard (Win + V) veem o texto. Aceito.
- O `uiohook` enxerga o Ctrl+V sintético; o `HotkeyController` ignora eventos enquanto
  `inserting = true`, e o Ctrl sintético é o esquerdo (`VK_CONTROL`), diferente do direito.

### ADR-04 — Groq Whisper `large-v3-turbo`, áudio inteiro ao soltar

**Contexto:** Groq tem plano gratuito com folga para uso pessoal e transcreve muito rápido. Streaming
de áudio durante a fala exigiria um servidor próprio com WebSocket.
**Decisão:** gravar a fala inteira e mandar um único `POST` multipart ao soltar a tecla.
**Consequências:** latência cresce um pouco com o tamanho da fala (upload). Para falas de até 30 s,
fica dentro do NFR-01. Streaming fica para a Fase 4, junto com o backend.

### ADR-05 — Sem limpeza por IA na Fase 1, mas com o encaixe pronto

**Decisão:** `Refiner` existe desde o início com implementação identidade. A Fase 2 troca a
implementação sem mexer no fluxo.

### ADR-06 — Sem backend na Fase 1

**Contexto:** uso pessoal, chave do próprio usuário.
**Decisão:** chave da Groq em `frontend/.env` (dev). Nenhum servidor.
**Consequências:** **não distribuir o app** com chave embutida. Distribuição exige o backend da
Fase 4 ([Security Guide §5](Security-Guide.md#5-segredos-e-chaves)).

### ADR-07 — Sala limpa em relação ao Typeless

**Contexto:** a arquitetura foi estudada por engenharia reversa do Typeless 2.8.2
([referencia/estudo-typeless.md](referencia/estudo-typeless.md)).
**Decisão:** do estudo saem **ideias e comportamentos**, nunca código, strings, constantes, ícones,
sons ou textos. Todo o código do Touch Speaker é escrito do zero.

## Estratégia de evolução

| Fase | Mudança na arquitetura |
| --- | --- |
| 2 | `Refiner` com Claude Haiku; `database/local` (SQLite via `better-sqlite3`) para histórico; janela de configurações; chave em `safeStorage` (DPAPI) em vez de `.env` |
| 3 | Helper nativo de contexto (UI Automation) para app/campo em foco e texto ao redor do cursor; comandos por voz |
| 4 | `backend/` com contas e proxy das chaves; streaming de áudio por WebSocket; instalador assinado e auto-update |
