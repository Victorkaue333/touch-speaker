# Code Style — Touch Speaker

Como o código deste repositório é escrito. Vale para gente e para agente de IA. Descreve o que o
código **faz hoje**, com âncora `arquivo:linha`; o que é convenção nova, a valer daqui para frente, vem
marcado como **Recomendação** — orientação até o Victor decidir outra coisa. Quando uma regra daqui bate
com algo executável (`tsconfig.main.json`, `tsconfig.renderer.json`, `npm run typecheck`, `npm test`),
**o executável manda** e este arquivo é que está errado. Entre documentos vale a ordem do SDD §0.1:
`DECISIONS.md` → SDD → `CLAUDE.md` → docs específicos (este) → spec aprovada da feature → READMEs.

> Última atualização: 17/out/2026 · Mantenedor: Victor Alves
> Relacionados: [`CLAUDE.md`](../CLAUDE.md) (decisões fixas e guardrails) · [`DESIGN.md`](DESIGN.md) (interface) ·
> [`Security-Guide.md`](Security-Guide.md) (segurança) · [`API.md`](API.md) (contratos de IPC e da Groq) ·
> [`DATABASE.md`](DATABASE.md) (`config.json` e dados) · [`templates/README.md`](templates/README.md)
> (processo de feature) · [SDD](spec/spec-driven-development.md)

As âncoras foram conferidas em 17/out/2026 no commit `ed0a1f5`, com a Fase 1 implementada (T1–T8).
Caminhos que começam por `src/` ou `scripts/`, e os arquivos `package.json`, `tsconfig.main.json`,
`tsconfig.renderer.json` e `.env.example`, ficam dentro de `frontend/`; o resto parte da raiz do
repositório.

---

## 1. Regra de ouro

**Escreva como o código ao redor.** Antes de criar um arquivo, abra um vizinho do mesmo tipo (outro
módulo de `src/main/`, outro teste de `src/test/`) e siga nomes, estrutura e idioma. Não há formatador
nem linter: quem mantém o estilo é o vizinho e o review. O código de hoje é pequeno e consistente; as
poucas divergências estão marcadas como **Inconsistência**. Não reformate o que você não mudou.

Quatro regras que atravessam o repositório inteiro:

1. **TypeScript estrito, sem `any`.** `strict` e `noUncheckedIndexedAccess` nos dois `tsconfig`, alvo
   `es2023`; não há nenhum `any` no código hoje (NFR-07). `any` só com comentário justificando.
2. **Inglês no código, pt-BR no produto.** Identificadores e comentários em inglês; todo texto que o
   usuário vê, em pt-BR, só em `src/main/strings.ts`; documentação e commits em pt-BR (§4.1).
3. **Privacidade e segurança antes de estilo.** Nada de texto ditado, áudio, clipboard, teclas ou chave
   em log, disco ou rede; renderer tratado como não confiável. As regras completas estão no
   [`Security-Guide.md`](Security-Guide.md#16-checklist-de-segurança-do-pr) §16.
4. **Zero invenção.** Código novo rastreia ao PRD, ao SDD, a um ADR ou à spec aprovada. Dúvida vai para
   o Victor antes de virar escolha silenciosa no código.

## 2. Portões

Todos rodam de dentro de `frontend/`.

| Comando | O que garante | Roda no CI |
| --- | --- | :---: |
| `npm run typecheck` | `tsc --noEmit` nos dois projetos (`tsconfig.main.json` e `tsconfig.renderer.json`): o código compila no modo estrito | ❌ — não há CI |
| `npm test` | `npm run build` (os dois `tsc` + `scripts/copy-static.mjs`) e depois `node --test "dist/test/**/*.test.js"`: os 30 testes de `src/test/`. Erro de tipo também reprova aqui, porque o build vem antes | ❌ — não há CI |
| `npm run build` | Gera `dist/` sem rodar nada | ❌ — não há CI |
| lint / format | **não existem** (§10) | — |

- **Não há CI:** a pasta `.github/` não existe. Os portões são rodados à mão.
- **Estado em 17/out/2026:** `npm test` passa 30/30 e `npm run typecheck` não acusa erro.
- **Antes do PR:** `npm run typecheck`, `npm test`, o fluxo afetado testado à mão com o app aberto por
  `npm run dev` (roteiro V da spec da feature) e nenhum segredo no diff. App aberto por agente de IA se
  encerra com `Stop-Process` nos `electron.exe` cujo caminho contém `touch-speaker`
  ([`ENVIRONMENT.md`](ENVIRONMENT.md#problemas-comuns)).

> Falha de ambiente (`ELECTRON_RUN_AS_NODE` herdada do VS Code, binário do Electron não baixado, Node
> fora da versão 24) não se resolve mexendo no código. Separe as duas coisas no relato.

## 3. TypeScript e build

- **Dois projetos, sem bundler** (ADR-01). `tsconfig.main.json` compila main, preload, shared e testes
  (`src/main`, `src/preload`, `src/shared`, `src/test`) para `dist/`; `tsconfig.renderer.json` compila
  `src/renderer` para `dist/renderer/`. O `scripts/copy-static.mjs` copia `pill.html` e `pill.css` ao
  lado do JS.
- **Main, preload e testes** (`tsconfig.main.json:2-17`): `target` e `lib` `es2023`, `module` e
  `moduleResolution` `nodenext`, `types: ["node"]`, `strict`, `noUncheckedIndexedAccess`,
  `noImplicitOverride`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`, `skipLibCheck` e
  `sourceMap`. Com `"type": "commonjs"` no `package.json`, a saída é **CommonJS**; os imports locais vão
  sem extensão (`from './config'`).
- **Renderer** (`tsconfig.renderer.json:2-13`): `target` `es2023`, `lib` com `dom` e `dom.iterable`,
  `module` `es2022`, `moduleResolution` `bundler`, `types: []`, `strict`, `noUncheckedIndexedAccess` e
  `skipLibCheck`. **Não** tem `noImplicitOverride`, `noFallthroughCasesInSwitch`,
  `forceConsistentCasingInFileNames` nem `sourceMap`. O `pill.ts` é **script clássico**, sem `import` nem
  `export`; os tipos de `window.touchSpeaker` vêm de declarações globais em `src/renderer/global.d.ts`
  (§5.1).
- **`noUncheckedIndexedAccess` muda o jeito de indexar:** todo acesso por índice trata o `undefined`
  (`token[0] ?? null`, `src/main/insert/win32.ts:88`; `BAR_SHAPE[i] ?? 1`, `src/renderer/pill.ts:92`).
- **Uniões de literais, não `enum`.** Não há `enum` no código: valores fechados são uniões de strings
  (`ErrorCode`, `src/main/errors.ts:2-14`; `PillStateName`, `src/shared/ipc.ts:17`; `KeyKind`,
  `src/main/hotkey.ts:5`) ou objetos `as const` (`Channel`, `ipc.ts:5-13`; `HOTKEY_CODES`,
  `src/main/keys.ts:6-23`; `DEFAULT_HOTKEY_TIMING`, `hotkey.ts:33`; `strings`, `src/main/strings.ts:4-16`).
- **Resultado como união discriminada** quando a operação tem mais de um desfecho esperado:
  `TranscriptionResult` com `kind: 'text' | 'no_speech' | 'error'` (`src/main/transcribe/transcriber.ts:3-6`).
- **Imports só de tipo** com `import type` (`src/main/session.ts:12-20`) ou `type` dentro da chave
  (`import { isNoSpeech, type VerboseTranscription }`, `src/main/transcribe/groq.ts:3`).
- **Guardas de tipo** em vez de `as` para dado de fora: `isRecord` (`src/main/index.ts:51-53`,
  `src/main/config.ts:37-39`), `isHotkeyName` (`keys.ts:27-29`), predicados `(p): p is number`
  (`src/main/transcribe/filters.ts:45`). `as` aparece só em fronteiras controladas: elementos do DOM
  (`pill.ts:16-19`), o JSON da Groq com campos opcionais (`groq.ts:72`) e os fakes dos testes.
- **Tipo de retorno explícito** em funções nomeadas e métodos (`normalizeConfig(...): AppConfig`,
  `config.ts:46`; `isNoSpeech(...): boolean`, `filters.ts:41`); arrow functions curtas o deixam inferido
  (`delay`, `src/main/insert/inserter.ts:23`).
- **Separador numérico** em número grande: `20_000`, `30_000`, `32_000` (`groq.ts:36`, `session.ts:47`,
  `pill.ts:154`).

## 4. Idioma e nomes

### 4.1 Idioma

| O quê | Forma hoje | Exemplo |
| --- | --- | --- |
| Identificador (variável, função, classe, tipo, arquivo) | inglês | `SessionController`, `normalizeConfig`, `pill-window.ts` |
| Comentário e JSDoc | inglês | `// Logging must never break dictation.` (`src/main/logger.ts:38`) |
| Texto de interface | pt-BR, só em `src/main/strings.ts` | `'Ouvindo…'`, `'Texto copiado — cole com Ctrl+V'` (`strings.ts:5`, `:29`) |
| Nome de teste | inglês; o `describe` cita o requisito entre parênteses | `describe('GroqTranscriber (FR-DICT-04)', …)` (`src/test/groq.test.ts:24`) |
| Evento e campo de log | inglês, snake_case | `dictation_done`, `transcribe_ms` (`src/main/session.ts:204-213`) |
| Canal IPC | `<área>:<ação>`, minúsculo | `recorder:start`, `pill:state` (`src/shared/ipc.ts:5-13`) |
| Código de erro | inglês, snake_case | `no_api_key`, `paste_blocked` (`src/main/errors.ts`) |
| Chave do `config.json` | inglês, camelCase | `holdThresholdMs`, `microphoneDeviceId` (`src/main/config.ts:7-17`) |
| Valor fechado em string | inglês, minúsculo ou kebab-case; nomes de tecla em PascalCase | `'handsfree'`, `'bottom-center'`, `'listening'`; `'RightCtrl'`, `'F13'` |
| Mensagem de diagnóstico no console | inglês | `'Touch Speaker failed to start'` (`src/main/index.ts:44`) |
| Documentação, spec, commit | pt-BR | — |

O renderer não tem texto de interface: `message` e `hint` chegam prontos do main pelo `pill:state`
(`src/renderer/pill.ts:217-218`). A única string que ele monta é o cronômetro `m:ss`
(`pill.ts:193-196`). Texto novo de interface vai para `strings.ts`, nunca para o renderer nem para o
meio de um módulo.

### 4.2 Nomes

| Coisa | Convenção observada | Exemplo |
| --- | --- | --- |
| Arquivo | minúsculo, kebab-case quando composto; um módulo por responsabilidade | `pill-window.ts`, `inserter.ts`, `win32.ts` |
| Pasta de módulo | substantivo da etapa do fluxo | `src/main/transcribe/`, `src/main/insert/` |
| Classe | PascalCase, substantivo + papel | `SessionController`, `HotkeyController`, `GroqTranscriber`, `TextInserter`, `PillWindow`, `AppTray`, `IdentityRefiner` |
| Interface de porta | PascalCase, sem prefixo `I`; sufixo `Port` ou `Host` para o lado que o componente consome | `Transcriber`, `Refiner`, `HotkeyHost`, `PillPort`, `InserterPort` |
| Objeto de dependências ou opções | `<Componente>Deps` ou `<Componente>Options` | `SessionDeps`, `TextInserterDeps`, `GroqOptions`, `HotkeyOptions`, `TrayOptions` |
| Payload de IPC | `<Canal>Payload` | `RecorderStartPayload`, `RecorderResultPayload`, `RecorderErrorPayload` |
| Tipo união de literais | PascalCase | `ErrorCode`, `PillStateName`, `KeyKind`, `SessionMode`, `InsertOutcome` |
| Constante de módulo | UPPER_SNAKE, com a unidade no fim | `RESULT_TIMEOUT_MS`, `MAX_UPLOAD_BYTES`, `MIN_AUDIO_MS`, `HIDE_AFTER_FADE_MS` |
| Objeto constante exportado | PascalCase ou UPPER_SNAKE, com `as const` | `Channel`, `HOTKEY_CODES`, `DEFAULT_HOTKEY_TIMING`; `DEFAULT_CONFIG` (tipado como `AppConfig`) |
| Função | camelCase, verbo | `normalizeConfig`, `loadConfig`, `sendPasteShortcut`, `startKeyboardHook` |
| Predicado e guarda | `is*`, `has*`; conversor que valida, `as*` | `isNoSpeech`, `isHotkeyName`, `hasCredentials`, `isSelfElevated`, `asResult` |
| Teste | `src/test/<módulo>.test.ts` | `hotkey.test.ts`, `groq.test.ts` |

**Inconsistência:** o mesmo canal tem nome de chave diferente em cada cópia — `Channel.RecorderStart`
em `src/shared/ipc.ts:6` e `CH.start` em `src/preload/pill.ts:7`. O valor (`'recorder:start'`) é o mesmo;
é ele que precisa bater (§6.4). E o objeto de textos se chama `strings`, em minúsculo
(`src/main/strings.ts:4`), fora do padrão dos outros objetos constantes.

## 5. Renderer (pílula)

A única janela com renderer na Fase 1 é a pílula. Ela grava o microfone (o `getUserMedia` só existe no
renderer) e mostra o estado da sessão. Regras visuais em [`DESIGN.md`](DESIGN.md).

### 5.1 Estrutura

```text
src/renderer/
  pill.html     a janela: marcação, CSP e <script src="pill.js" defer>
  pill.css      tokens de cor em :root e estilos por data-state
  pill.ts       gravação, medidor de nível, sons e atualização da tela (script clássico)
  global.d.ts   tipos de window.touchSpeaker, espelho de src/shared/ipc.ts
```

- **Script clássico, sem módulos:** o `pill.ts` não tem `import` nem `export` e é carregado com `defer`
  (`src/renderer/pill.html:11`). Os tipos que ele usa (`PillState`, `RecorderStartPayload`,
  `RecorderErrorCode`) são declarações globais de `global.d.ts`, que **espelham** `src/shared/ipc.ts`
  à mão (`global.d.ts:1`).
- **CSP no próprio HTML** (`pill.html:6-7`): `default-src 'self'; script-src 'self'; style-src 'self';
  connect-src 'none'; img-src 'self' data:; media-src 'self' blob: mediastream:`. O renderer não faz
  requisição de rede nem carrega conteúdo remoto.
- **Estilo por atributo:** o `pill.ts` só troca `data-state` e `data-warn` (`pill.ts:215-216`); a cor e a
  forma de cada estado ficam no `pill.css`, sobre os tokens de `:root` (`src/renderer/pill.css:2-11`).
- **Um arquivo, em seções** marcadas por `// ---- Nome ----`: sons, gravação e tela (`pill.ts:28`, `:55`,
  `:191`). Os elementos do DOM são buscados uma vez, no topo (`pill.ts:16-20`).

### 5.2 Dados e chamadas

- **Tudo passa por `window.touchSpeaker`** (`pill.ts:15`), a API do preload
  ([`API.md`](API.md#api-do-preload-windowtouchspeaker)). Nada de `require`, `fetch` ou acesso a Node.
- **Texto entra no DOM por `textContent`** (`pill.ts:217-218`), nunca por `innerHTML` — não há
  `innerHTML` no código.
- **Cada gravação é um objeto** `Recording` (`pill.ts:4-13`) guardado em `current`; `stop` e `cancel`
  de outra sessão são ignorados (`pill.ts:177`, `:184`), e um `start` novo cancela a gravação anterior
  (`pill.ts:113-116`).
- **O microfone fecha em todo caminho.** `releaseRecording` para todas as trilhas e fecha o
  `AudioContext` do medidor (`pill.ts:69-78`) e é chamado no fim normal, no cancelamento e no erro.
- **Promessa disparada sem esperar leva `void`** (`void beginRecording(payload)`, `pill.ts:173`;
  `void ctx.close()`, `:46`).
- **Sons gerados em código** com Web Audio (`tone`, `pill.ts:30-53`), sem arquivo de áudio.

## 6. Processo main

### 6.1 Módulos

| Módulo (`src/main/`) | Responsabilidade hoje | Depende de Electron ou módulo nativo |
| --- | --- | --- |
| `index.ts` | Ponto de entrada: ciclo de vida do app, permissões de mídia, validação de IPC, montagem de todos os componentes | `electron` |
| `session.ts` | `SessionController`, dono único do estado do ditado | não (`node:crypto`) |
| `hotkey.ts` | `HotkeyController`: segurar × tocar, auto-repetição, atalho × ditado | não |
| `keyboard.ts` | Ponte do hook global para o `HotkeyController`; reduz cada tecla a `hotkey`/`escape`/`other` | `uiohook-napi` |
| `keys.ts` | Códigos de tecla do libuiohook | não |
| `config.ts` | `config.json` com defaults e validação | não (`node:fs`, `node:path`) |
| `logger.ts` | Log rotativo só com metadados | não (`node:fs`, `node:path`) |
| `strings.ts` · `errors.ts` | Textos da interface (pt-BR) · códigos de erro | não |
| `refine.ts` | `Refiner` (identidade na Fase 1) | não |
| `transcribe/` | `transcriber.ts` (interface) · `groq.ts` · `filters.ts` (anti-lixo) | não (usa o `fetch` global) |
| `insert/inserter.ts` | Clipboard + Ctrl+V + restauração | `electron` (`clipboard`) |
| `insert/win32.ts` | `SendInput` e detecção de elevação | `koffi` |
| `pill-window.ts` · `tray.ts` · `icon.ts` | Janela da pílula · bandeja · ícone desenhado em código | `electron` |

- **Lógica pura fica longe do Electron**, e é por isso que pode ser testada no Node: `hotkey.ts`,
  `filters.ts`, `config.ts` e `groq.ts` têm testes; `session.ts` também não importa `electron`, mas ainda
  não tem teste.
- **Módulo nativo isolado num arquivo só:** `uiohook-napi` só em `keyboard.ts`, `koffi` só em `win32.ts`.
- **Só o `index.ts` conhece todo mundo.** Ele cria os componentes concretos e os injeta
  (`src/main/index.ts:125-148`); os outros módulos dependem de interfaces e importam tipos com
  `import type`.

### 6.2 Config e estado

- **Um único dono do estado da sessão: o `SessionController`** (`state`, `sessionId`, `mode`,
  `inserting` e os timers, `src/main/session.ts:52-61`). Os outros componentes perguntam pela porta:
  o `HotkeyController` só enxerga `phase()` — `idle`, `recording` ou `busy` (`session.ts:70-73`).
- **O `HotkeyController` guarda o mínimo:** tecla pressionada ou não, o horário do último keydown dela e
  se esta pressão abriu a sessão (`src/main/hotkey.ts:36-39`). Nada sobre as outras teclas.
- **A config é lida uma vez**, ao abrir (`src/main/index.ts:88`), e passada adiante como objeto;
  ninguém a escreve de volta. Fora isso, o único estado de módulo no main é o cache das funções do
  Windows (`bindings`, `src/main/insert/win32.ts:29`).

### 6.3 Componentes e portas

- **Componente com estado é classe; dependência entra por objeto no construtor**, como parameter
  property `private readonly`: `constructor(private readonly deps: SessionDeps)` (`session.ts:64`),
  `TextInserter` (`src/main/insert/inserter.ts:71`), `GroqTranscriber` (`src/main/transcribe/groq.ts:35`).
- **Tempo e rede são injetáveis:** `now?: () => number` (`session.ts:38`; obrigatório em
  `HotkeyOptions`, `hotkey.ts:30`), `fetchImpl?: typeof fetch`, `timeoutMs` e `retryDelayMs`
  (`groq.ts:9-15`). Os testes usam exatamente esses pontos.
- **A porta é declarada por quem a consome:** `PillPort` e `InserterPort` em `session.ts:22-29`;
  `HotkeyHost` em `hotkey.ts:10-17`.
- **Provedor sempre atrás de interface:** `Transcriber` (`src/main/transcribe/transcriber.ts:9-12`) e
  `Refiner` (`src/main/refine.ts:3-5`). Trocar a Groq ou ligar a limpeza por IA é escrever outra
  implementação, sem mexer no fluxo (ADR-04, ADR-05).
- **Funções do Windows carregadas sob demanda** (`load()`, `win32.ts:31-52`) e uma vez ao abrir o app
  (`initWin32`, `win32.ts:55-57`), para falhar cedo e não no meio de um ditado.

### 6.4 Canais IPC

- **Nome `<área>:<ação>`**, declarado em `Channel` (`src/shared/ipc.ts:5-13`), com os tipos de payload
  ao lado.
- **Três cópias que andam juntas:** `src/shared/ipc.ts` (main), a cópia dos nomes em
  `src/preload/pill.ts:6-14` (o preload em sandbox não importa arquivo local) e o espelho dos tipos em
  `src/renderer/global.d.ts`. Mudou um, muda os três — e o [`API.md`](API.md#contratos) **antes** do
  código.
- **Só `send`/`on`:** não há `invoke`/`handle` na Fase 1. O main fala com a pílula só por
  `PillWindow.send` e `setState` (`src/main/pill-window.ts:62-82`), que conferem se a janela ainda existe;
  a pílula fala com o main só pelos três `ipcMain.on` de `src/main/index.ts:151-163`.
- **O preload expõe funções, nunca o `ipcRenderer`** (`src/preload/pill.ts:22-30`).
- **Recomendação** para canal novo: payload com `sessionId` quando for de uma gravação; validador `as*`
  no `index.ts`; teste se a regra tiver lógica.

### 6.5 Validação de entrada

- **Tudo o que vem de fora do main é `unknown` até passar por uma guarda:** payloads de IPC
  (`asStarted`, `asResult`, `asError`, `src/main/index.ts:51-80`), o `config.json`
  (`normalizeConfig`, `src/main/config.ts:46-90`), a resposta da Groq (tipo com campos opcionais e
  `??` nos defaults, `src/main/transcribe/filters.ts:14-22`, `:42-50`).
- **Remetente antes de conteúdo:** só a janela da pílula é ouvida (`fromPill`, `index.ts:150`).
- **Tamanho antes de uso:** áudio de até 25 MB, conferido no IPC (`index.ts:72`) e antes do upload
  (`groq.ts:47`).
- **O teclado é reduzido na fonte:** cada evento vira `hotkey`, `escape` ou `other` em
  `src/main/keyboard.ts:8-9`; código de tecla não passa dali. Code review recusa qualquer mudança que
  identifique outra tecla ([Security Guide §7](Security-Guide.md#7-entrada-teclado-global-e-ipc)).

### 6.6 Concorrência e timers

- **Uma sessão por vez:** `start` só sai de `idle` (`src/main/session.ts:84`), e cada método confere o
  estado antes de agir (`stop`, `:128`; `cancel`, `:144`; `onRecorderResult`, `:169`).
- **Resposta assíncrona confere a sessão ao chegar:** evento com `sessionId` de outra sessão é ignorado
  (`session.ts:156`, `:161`, `:169`).
- **Todo timer fica num campo e é limpo em toda saída:** `sessionTimers`, `resultTimer`, `messageTimer`
  (`session.ts:59-61`), limpos por `clear*` (`:271-284`) e por `shutdown` (`:223-228`).
- **Promessa disparada sem esperar leva `void`** (`void session.onRecorderResult(p)`,
  `src/main/index.ts:157`; `void shell.openPath(...)`, `src/main/tray.ts:31`; `void clipboard...`,
  `src/main/insert/inserter.ts:100`).
- **Espera por condição, com prazo:** `waitUntil` consulta a cada 20 ms até 2 s (`inserter.ts:25-28`,
  `:75`). Espera fixa só onde o Windows precisa de tempo, como constante nomeada (`BEFORE_PASTE_MS`,
  `AFTER_PASTE_MS`, `inserter.ts:19-20`).
- **Sinalizador com `try/finally`:** o `inserting` liga antes do Ctrl+V sintético e desliga no `finally`
  (`inserter.ts:82-109`), para o hook não tratar as teclas sintéticas como do usuário.
- **Timeout de rede por `AbortSignal.timeout`** (`groq.ts:63`).

### 6.7 Erros e códigos

- **Um código por falha:** `ErrorCode` é uma união de literais (`src/main/errors.ts:2-14`); a mensagem
  sai de `errorMessage(code)` (`src/main/strings.ts:33-35`). O mapa é `Record<ErrorCode, string>`
  (`strings.ts:18`): código novo sem mensagem não compila. Tabela completa em
  [`API.md`](API.md#códigos-de-erro).
- **Desfecho esperado volta como valor, não como exceção:** `TranscriptionResult`
  (`src/main/transcribe/transcriber.ts:3-6`), `InsertOutcome` (`src/main/insert/inserter.ts:6`).
- **`catch` sem variável.** Quando o bloco fica vazio de propósito, leva um comentário dizendo por quê
  (`src/main/index.ts:36-38`, `inserter.ts:37-39`, `:87-89`, `src/main/logger.ts:37-39`). Quando devolve
  um valor de recuperação, o próprio retorno explica e não há comentário (`groq.ts:65-67`,
  `inserter.ts:57-59`).
- **Exceção inesperada vai para o log só pelo `name`** (`index.ts:122`, `:169`;
  `src/main/session.ts:217`), nunca pela mensagem ou pela pilha, que podem carregar conteúdo.

Como cada falha aparece:

| Saída | Quando | Âncora |
| --- | --- | --- |
| Pílula em `error`, com a mensagem do código | falha que encerra o ditado | `src/main/session.ts:238-243` |
| Pílula em `notice` | `paste_blocked`: o texto ficou no clipboard | `session.ts:214` |
| Pílula some, sem aviso | `no_speech`, cancelamento por `Esc` ou atalho | `session.ts:143-151`, `:232-236` |
| Só log | problema que não interrompe o ditado: config inválida, IPC rejeitado, console da pílula | `src/main/index.ts:88`, `:99-103`, `:158` |
| App abre sem a parte que falhou | `koffi` ou hook de teclado não carregou (`win32_unavailable`, `keyboard_hook_unavailable`) | `index.ts:117-123`, `:165-170` |
| App não abre | exceção ao iniciar: `console.error` e `app.exit(1)` | `index.ts:43-46` |

### 6.8 Configuração

- **Uma variável de ambiente**, `GROQ_API_KEY`, carregada pelo `process.loadEnvFile` nativo
  (`src/main/index.ts:34-38`) — sem pacote de `.env`. Usar uma biblioteca para isso é dependência nova e
  exige ADR. Detalhes em [`ENVIRONMENT.md`](ENVIRONMENT.md#variáveis).
- **Preferência do usuário vai no `config.json`**, não em variável de ambiente. **Recomendação** para
  campo novo: tipo em `AppConfig`, default em `DEFAULT_CONFIG`, regra em `normalizeConfig`
  (`src/main/config.ts:7-90`), caso em `src/test/config.test.ts` e [`DATABASE.md`](DATABASE.md#configjson)
  no mesmo trabalho — e `version` sobe se o formato mudar (§7).
- **Constante que não é preferência fica no código**, como `UPPER_SNAKE` no topo do módulo (limites,
  timeouts, `src/main/transcribe/groq.ts:6-7`, `src/main/session.ts:45-47`).
- **Configuração do Electron antes do `ready`, no topo do `index.ts`:** nome do app, `userData`,
  `AppUserModelId`, aceleração de hardware desligada e instância única (`index.ts:27-47`).

### 6.9 Scripts

- `scripts/start.mjs` e `scripts/copy-static.mjs` são **ES modules** (`.mjs`), só com módulos `node:`, e
  resolvem caminhos a partir de `import.meta.url`, sem depender da pasta atual
  (`scripts/start.mjs:8`, `scripts/copy-static.mjs:6`).
- Os comandos do dia a dia são os `scripts` do `package.json:11-17` (`build`, `dev`, `start`,
  `typecheck`, `test`).
- **Recomendação:** script novo segue o mesmo molde — `.mjs`, sem dependência, sem caminho absoluto de
  máquina — e entra no `package.json` se for de uso frequente.

## 7. Config e dados

- **Não há banco na Fase 1.** O app persiste só o `config.json` e o log; o `.env` é do desenvolvedor
  ([`DATABASE.md`](DATABASE.md)).
- **Áudio nunca vai para disco.** A gravação vive em memória, da pílula ao main e do main à Groq.
- **Texto ditado, clipboard e teclas nunca vão para disco nem para log.** O tipo `LogFields`
  (`src/main/logger.ts:6-7`) só aceita primitivos, mas não impede uma string com conteúdo: isso fica com
  o review.
- **Config inválida nunca derruba o app** (BR-012): cada campo inválido cai no default com aviso
  (`src/main/config.ts:46-90`).

**Regras daqui para frente**

- Mudou o formato do `config.json`: sobe `version`, spec de migração a partir de
  [`templates/TEMPLATE-spec-migracao.md`](templates/TEMPLATE-spec-migracao.md) e
  [`DATABASE.md`](DATABASE.md) no mesmo trabalho.
- **PLANEJADO (Fase 2):** migrations SQL numeradas em `database/local/`, só para frente, aplicadas ao
  iniciar, em transação ([`DATABASE.md`](DATABASE.md#migrations)).

## 8. Testes

| Suíte | Ferramenta | Onde | Cobre | CI |
| --- | --- | --- | --- | :---: |
| `HotkeyController` | `node:test` + `node:assert/strict` | `src/test/hotkey.test.ts` | 10 casos: segurar, auto-repetição, toque e segundo toque, `Esc`, atalho, eventos durante `inserting` e durante a transcrição, keyup perdido (TEST-001) | ❌ |
| Filtros anti-lixo | idem | `src/test/filters.test.ts` | 8 casos de `normalizeForMatch` e `isNoSpeech` (TEST-002) | ❌ |
| `GroqTranscriber` | idem, com `fetch` simulado | `src/test/groq.test.ts` | 9 casos: `200`, silêncio, sem chave, `401`, `413`, `429`, `5xx` com nova tentativa, dois `5xx`, falha de rede (TEST-003) | ❌ |
| `normalizeConfig` | idem | `src/test/config.test.ts` | 3 casos: defaults, valores válidos, campos inválidos (TEST-004) | ❌ |
| Roteiro manual | pessoa + app aberto por `npm run dev` | §12.2 da [spec `ditado-por-voz`](spec/features/ditado-por-voz.md) | V1–V13; só o V2 feito (PEND-001) | — |

Total: **30 testes**, todos passando no `npm test` de 17/out/2026. Os testes são compilados com o resto
para `dist/test/` e rodados por `node --test`. Não há teste de interface, de ponta a ponta nem piso de
cobertura; `session.ts`, `inserter.ts`, `win32.ts`, a bandeja e a pílula só têm o roteiro manual.

**Como os testes são escritos (FATO)**

- `describe`/`it` de `node:test` e `assert` de `node:assert/strict`, nessa ordem de import, seguidos do
  módulo testado (`src/test/groq.test.ts:1-3`).
- **Fake implementa a porta:** `class FakeHost implements HotkeyHost`, que registra as chamadas
  (`src/test/hotkey.test.ts:5-30`).
- **Relógio injetado e avançado à mão:** `now: () => clock` e `clock += 1200` (`hotkey.test.ts:40`,
  `:45`). Nada de espera real.
- **Rede simulada:** `fetchImpl` que devolve `Response` de verdade e guarda as requisições, com
  `retryDelayMs: 1` (`groq.test.ts:12-22`).
- **Casos em tabela:** `for (const [status, code] of [...] as const)` gera um `it` por status
  (`groq.test.ts:56-66`).

**O que se espera de teste novo (Recomendação)**

- Lógica nova fica fora do Electron para poder ser testada no Node, como `hotkey.ts` e `filters.ts`.
- Regra nova (`BR-NNN`) ou bug corrigido ganha teste que falharia sem a mudança.
- Nunca rede, relógio ou microfone reais: injete `now` e `fetchImpl`.
- O `describe` cita o requisito (`FR-DICT-NN`).
- Comece por `session.ts`, que já não depende do Electron e concentra as regras BR-005, BR-011, BR-013 e
  BR-014.

## 9. Comentários

Comentário é **curto e sobre o código, não sobre o trabalho**. Uma ou duas linhas, em inglês. Comente só
o que o código não diz sozinho: regra não óbvia, motivo de um contorno, invariante, unidade ou formato.

```ts
// ✅ Diz a regra ou a premissa que a linha não mostra
// The user's physical Ctrl must be up before we press a synthetic one.            — src/main/insert/inserter.ts:74
// Only restore if the clipboard still holds our text: the user may have copied … — src/main/insert/inserter.ts:99
/** sizeof(INPUT) on x64: DWORD type + 4 bytes padding + 32-byte union … */        — src/main/insert/win32.ts:9
// A 40 px pill does not need the GPU; software compositing saves memory (NFR-03). — src/main/index.ts:30
```

Não há contraexemplo no código hoje. Fica de fora: narrar o trabalho ("novo", "corrigido", "antes era
assim"), repetir em prosa o que a linha faz e deixar código comentado — o histórico vai no commit, no PR
ou no [`CHANGELOG.md`](CHANGELOG.md), nunca no arquivo.

- **Cabeçalho do arquivo:** a maioria dos módulos abre com um comentário `//` que diz a responsabilidade
  e o documento ou a seção que o governa (`src/main/config.ts:1-2`, `src/main/hotkey.ts:1-3`,
  `src/main/pill-window.ts:1-2`, `src/main/session.ts:1-2`). Exceções hoje: `src/main/tray.ts` e
  `src/main/transcribe/transcriber.ts` abrem direto no código; `src/main/index.ts:1` e
  `src/main/strings.ts:1` têm cabeçalho sem citar documento; os quatro arquivos de `src/test/` não têm
  cabeçalho. **Recomendação:** arquivo novo de `src/main`, `src/preload`, `src/renderer` ou `src/shared`
  abre com esse cabeçalho; quando a seção citada mudar de número, o comentário muda junto.
- **JSDoc `/** … */`** em exportação ou campo cujo sentido não é óbvio pelo nome (`MIN_AUDIO_MS`,
  `src/main/transcribe/filters.ts:4`; `repeatGapMs`, `hotkey.ts:24-29`; `isForegroundWindowElevated`,
  `src/main/insert/win32.ts:103-106`).
- **Separador de seção** `// ---- Nome ----` só em arquivo longo (`src/main/index.ts:49`, `:82`;
  `session.ts:68`, `:153`, `:230`; `src/renderer/pill.ts:28`, `:55`, `:191`).
- **Comentário de linha no fim da instrução** para dar nome a um campo binário
  (`// wVk`, `// dwFlags`, `win32.ts:62-66`) ou o token de cor que um valor repete
  (`// --ts-listening`, `src/main/icon.ts:4`).
- **Nunca** ponha chave, texto ditado ou conteúdo do usuário em comentário. O `.env.example` só tem o
  nome da variável e onde criar a chave.

**Recomendação:** comentário novo segue a regra; comentário velho se corrige quando o trabalho já mexe
naquele trecho.

## 10. Formatação

- **Não há** formatador, linter, `.editorconfig`, `.gitattributes`, ordenação automática de import nem
  hook de pre-commit: a busca por configuração de Prettier, ESLint, EditorConfig, commitlint e husky na
  raiz e em `frontend/` não encontra nada. **Siga a formatação do arquivo.**
- O que o código faz de forma consistente:
  - 2 espaços de indentação;
  - aspas simples; aspas duplas só dentro de uma string (`'"Obrigado." spoken clearly …'`,
    `src/test/filters.test.ts:38`) e nos arquivos JSON;
  - ponto e vírgula no fim da instrução;
  - vírgula final em lista e objeto quebrados em várias linhas (`src/main/index.ts:4-10`);
  - template literal para interpolar (`` `Bearer ${this.opts.apiKey}` ``, `src/main/transcribe/groq.ts:61`);
  - imports no topo: pacotes (`electron`) e módulos `node:` primeiro, depois os locais em ordem
    alfabética do caminho (`src/main/index.ts:2-22`, `src/main/session.ts:3-20`); módulos do Node sempre
    com o prefixo `node:` (`node:fs`, `node:path`, `node:crypto`).
- **Largura de linha:** em geral até ~120 colunas, sem limite rígido. Hoje 14 linhas passam disso; a
  maior tem 186, uma assinatura de função C (`src/main/insert/win32.ts:48`).
- **Fim de linha:** LF no índice e na cópia de trabalho (`git ls-files --eol` mostra `i/lf w/lf`), sem
  `.gitattributes` fixando isso. Arquivo em UTF-8; nome de arquivo sem acento e sem espaço.
- Não reformate arquivo inteiro num trabalho de feature: o diff precisa mostrar só a mudança.

## 11. Git

### Commits

**Conventional Commits citando o requisito**, com a descrição **em pt-BR** — a convenção do
[`CLAUDE.md`](../CLAUDE.md). O tipo segue o padrão Conventional Commits (`feat`, `fix`, `docs`,
`refactor`, `test`, `chore`…).

```text
feat(dict): FR-DICT-01 segurar para falar
```

- **Recomendação:** o escopo é a área afetada, em minúsculas (`dict` para o ditado; `docs`, `deps`,
  `build` para o que não é código do produto); a descrição no presente, dizendo o comportamento que passa
  a valer.
- Um commit, uma mudança coesa.
- **Sem atribuição de IA:** commit e PR não levam trailer `Co-Authored-By` (nem do Claude, nem de
  ninguém) nem linha do tipo "Generated with …" — o autor é só o Victor.

**Divergência:** o histórico ainda não segue o padrão. Dos 3 commits, só `bae6eba`
(`feat: project touch-speaker`) está no formato, sem escopo, sem requisito e em inglês; `331de81`
(`Initial commit`) e `ed0a1f5` (`Update CLAUDE.md`) estão fora dele.

### Branches

- Só existe `main` (local e `origin/main`). Não há branch de integração nem convenção de nome para
  branch de trabalho.

### PR

- Não há template de PR (a pasta `.github/` não existe). O que o PR precisa ter: os portões do §2, o
  [checklist de segurança](Security-Guide.md#16-checklist-de-segurança-do-pr) e a documentação afetada
  no mesmo trabalho (`API.md` se um contrato mudou, `DATABASE.md` se o `config.json` mudou, o SDD e a
  spec quando uma regra ou tarefa muda).
- [`CHANGELOG.md`](CHANGELOG.md) com o **porquê**, não só o quê.
- Dependência nova entra com ADR em [`DECISIONS.md`](DECISIONS.md) no mesmo trabalho.
- Feature nova começa pelos templates de [`templates/README.md`](templates/README.md).

## 12. Regras escritas que nenhuma ferramenta verifica

Hoje estas regras dependem de review. Automatizar cada uma é trabalho em aberto:

- [ ] TODO: sem formatador, linter, `.editorconfig`, `.gitattributes` nem hook de pre-commit (§10).
- [ ] TODO: sem CI — `npm run typecheck` e `npm test` só rodam à mão (§2).
- [ ] TODO: a sincronia entre `src/shared/ipc.ts`, `src/preload/pill.ts` e `src/renderer/global.d.ts`
  (nomes de canal e tipos) só é conferida no review (§6.4).
- [ ] TODO: "nenhuma tecla além da configurada e do `Esc` é identificada" só é conferido no review
  (§6.5, [Security Guide §16](Security-Guide.md#16-checklist-de-segurança-do-pr)).
- [ ] TODO: o tipo `LogFields` garante só primitivos no log; que nenhum primitivo seja texto ditado,
  clipboard, tecla ou chave depende do review (§7).
- [ ] TODO: "texto de interface só em `strings.ts`" e "renderer sem strings próprias" sem verificação
  automática (§4.1).
- [ ] TODO: sem teste de interface: gravação, colagem, pílula e bandeja só pelo roteiro manual V1–V13
  (§8).
- [ ] TODO: "o microfone fecha em todo caminho" só verificado à mão, olhando o indicador do Windows (§5.2).
- [ ] TODO: nada barra segredo no diff: não há varredura de segredos.
- [ ] TODO: convenção de commit sem commitlint (§11).
- [ ] TODO: `npm audit` antes de cada versão é passo manual
  ([Security Guide §15.1](Security-Guide.md#151-dependências)).
