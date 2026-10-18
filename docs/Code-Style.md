# Code Style — Touch Speaker

Como o código deste repositório é escrito. Vale para gente e para agente de IA. Descreve o que o
código **faz hoje**, com âncora `arquivo:linha`; o que é convenção nova, a valer daqui para frente, vem
marcado como **Recomendação** — orientação até o Victor decidir outra coisa. Quando uma regra daqui bate
com algo executável (`tsconfig.main.json`, `tsconfig.renderer.json`, `tsconfig.main-window.json`,
`npm run typecheck`, `npm test`),
**o executável manda** e este arquivo é que está errado. Entre documentos vale a ordem do SDD §0.1:
`DECISIONS.md` → SDD → `CLAUDE.md` → docs específicos (este) → spec aprovada da feature → READMEs.

> Última atualização: 18/out/2026 · Mantenedor: Victor Alves
> Relacionados: [`CLAUDE.md`](../CLAUDE.md) (decisões fixas e guardrails) · [`DESIGN.md`](DESIGN.md) (interface) ·
> [`Security-Guide.md`](Security-Guide.md) (segurança) · [`API.md`](API.md) (contratos de IPC e da Groq) ·
> [`DATABASE.md`](DATABASE.md) (`config.json` e dados) · [`templates/README.md`](templates/README.md)
> (processo de feature) · [SDD](spec/spec-driven-development.md)

As âncoras foram conferidas em 17/out/2026 no commit `ed0a1f5`, com a Fase 1 implementada (T1–T8); as que
apontam para arquivos criados ou mudados pela spec [`janela-principal`](spec/features/janela-principal.md)
(`src/main/index.ts`, `config.ts`, `strings.ts`, `tray.ts`, `keyboard.ts`, `pill-window.ts`,
`transcribe/groq.ts`, `src/shared/ipc.ts`, os módulos novos e os testes novos) foram reconferidas em
18/out/2026 sobre o código ainda não commitado. Caminhos que começam por `src/` ou `scripts/`, e os arquivos
`package.json`, `tsconfig.main.json`, `tsconfig.renderer.json`, `tsconfig.main-window.json` e `.env.example`,
ficam dentro de `frontend/`; o resto parte da raiz do repositório.

---

## 1. Regra de ouro

**Escreva como o código ao redor.** Antes de criar um arquivo, abra um vizinho do mesmo tipo (outro
módulo de `src/main/`, outro teste de `src/test/`) e siga nomes, estrutura e idioma. Não há formatador
nem linter: quem mantém o estilo é o vizinho e o review. O código de hoje é pequeno e consistente; as
poucas divergências estão marcadas como **Inconsistência**. Não reformate o que você não mudou.

Quatro regras que atravessam o repositório inteiro:

1. **TypeScript estrito, sem `any`.** `strict` e `noUncheckedIndexedAccess` nos três `tsconfig`, alvo
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
| `npm run typecheck` | `tsc --noEmit` nos três programas (`tsconfig.main.json`, `tsconfig.renderer.json` e `tsconfig.main-window.json`, `package.json:15`): o código compila no modo estrito | ❌ — não há CI |
| `npm test` | `npm run build` (os três `tsc` + `scripts/copy-static.mjs`, `package.json:12`) e depois `node --test "dist/test/**/*.test.js"`: os 182 testes de `src/test/` (18/out/2026). Erro de tipo também reprova aqui, porque o build vem antes | ❌ — não há CI |
| `npm run build` | Gera `dist/` sem rodar nada | ❌ — não há CI |
| lint / format | **não existem** (§10) | — |

- **Não há CI:** a pasta `.github/` não existe. Os portões são rodados à mão.
- **Estado em 18/out/2026:** `npm test` passa 182/182 (30 até 17/out/2026; 113 com a spec `design-system`;
  +69 com a spec `janela-principal`) e `npm run typecheck` não acusa erro nos três programas.
- **Antes do PR:** `npm run typecheck`, `npm test`, o fluxo afetado testado à mão com o app aberto por
  `npm run dev` (roteiro V da spec da feature) e nenhum segredo no diff. App aberto por agente de IA se
  encerra com `Stop-Process` nos `electron.exe` cujo caminho contém `touch-speaker`
  ([`ENVIRONMENT.md`](ENVIRONMENT.md#problemas-comuns)).

> Falha de ambiente (`ELECTRON_RUN_AS_NODE` herdada do VS Code, binário do Electron não baixado, Node
> fora da versão 24) não se resolve mexendo no código. Separe as duas coisas no relato.

## 3. TypeScript e build

- **Três programas do `tsc`, sem bundler** (ADR-01). `tsconfig.main.json` compila main, os dois preloads,
  shared e testes (`src/main`, `src/preload`, `src/shared`, `src/test`) para `dist/`; `tsconfig.renderer.json`
  compila o renderer da pílula (`src/renderer`, menos `src/renderer/main-window`, `tsconfig.renderer.json:15`)
  para `dist/renderer/`; `tsconfig.main-window.json` compila o renderer da janela principal
  (`rootDir: src/renderer/main-window`, `outDir: dist/renderer/main-window`, `tsconfig.main-window.json:7-8`).
  O terceiro programa existe porque os dois renderers são scripts clássicos: num programa só, eles dividiriam
  o escopo global do compilador, e as declarações globais de um (`Window.touchSpeaker`) se mesclariam com as
  do outro (`Window.touchSpeakerApp`). O `scripts/copy-static.mjs` copia os `.html` e `.css` do topo de
  `src/renderer` (`pill.html`, `tokens.css`, `pill.css`), os de `src/renderer/main-window/` (`index.html`,
  `main-window.css`) e a pasta `fonts/` (Inter + `OFL.txt`, ADR-12) ao lado do JS
  (`scripts/copy-static.mjs:12-22`).
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
- **Janela principal** (`tsconfig.main-window.json:2-13`): as mesmas opções do renderer da pílula, só com
  `rootDir` e `outDir` próprios. O `main-window.ts` também é script clássico; os tipos de
  `window.touchSpeakerApp` vêm de `src/renderer/main-window/global.d.ts` (§5.3).
- **`noUncheckedIndexedAccess` muda o jeito de indexar:** todo acesso por índice trata o `undefined`
  (`token[0] ?? null`, `src/main/insert/win32.ts:88`; `BAR_SHAPE[i] ?? 1`, `src/renderer/pill.ts:92`).
- **Uniões de literais, não `enum`.** Não há `enum` no código: valores fechados são uniões de strings
  (`ErrorCode`, `src/main/errors.ts:2-14`; `PillStateName`, `src/shared/ipc.ts:32`; `GroqKeyState`,
  `ipc.ts:78`; `KeyKind`, `src/main/hotkey.ts:5`) ou objetos `as const` (`Channel`, `ipc.ts:9-28`;
  `EDITABLE_SETTINGS_KEYS`, `ipc.ts:114-122`; `HOTKEY_CODES`, `src/main/keys.ts:6-23`;
  `DEFAULT_HOTKEY_TIMING`, `hotkey.ts:33`; `strings`, `src/main/strings.ts:7-24`).
- **Resultado como união discriminada** quando a operação tem mais de um desfecho esperado:
  `TranscriptionResult` com `kind: 'text' | 'no_speech' | 'error'` (`src/main/transcribe/transcriber.ts:3-6`);
  as respostas da janela principal com `ok: true | false` e `code` (`SettingsResult`, `LoginItemResult`,
  `GroqKeyResult`, `src/shared/ipc.ts:143-154`); a leitura crua do `config.json` com
  `kind: 'missing' | 'invalid' | 'ok'` (`RawConfigRead`, `src/main/config.ts:165`).
- **Imports só de tipo** com `import type` (`src/main/session.ts:13-19`) ou `type` dentro da chave
  (`import { isNoSpeech, type VerboseTranscription }`, `src/main/transcribe/groq.ts:3`).
- **Guardas de tipo** em vez de `as` para dado de fora: `isRecord` (`src/main/index.ts:78-80`,
  `src/main/config.ts:54-56`), `isPlainRecord` (`src/main/main-window-ipc.ts:15-19`), `isHotkeyName`
  (`keys.ts:27-29`), predicados `(p): p is number` (`src/main/transcribe/filters.ts:45`). `as` aparece só em
  fronteiras controladas: elementos do DOM (`pill.ts:16-19`; `byId`, `src/renderer/main-window/main-window.ts:27-31`),
  o JSON da Groq com campos opcionais (`groq.ts:77`) e os fakes dos testes.
- **Tipo de retorno explícito** em funções nomeadas e métodos (`normalizeConfig(...): AppConfig`,
  `config.ts:63`; `isNoSpeech(...): boolean`, `filters.ts:41`); arrow functions curtas o deixam inferido
  (`delay`, `src/main/insert/inserter.ts:23`).
- **Separador numérico** em número grande: `20_000`, `30_000`, `32_000` (`groq.ts:40`, `session.ts:55`,
  `pill.ts:154`).

## 4. Idioma e nomes

### 4.1 Idioma

| O quê | Forma hoje | Exemplo |
| --- | --- | --- |
| Identificador (variável, função, classe, tipo, arquivo) | inglês | `SessionController`, `normalizeConfig`, `pill-window.ts` |
| Comentário e JSDoc | inglês | `// Logging must never break dictation.` (`src/main/logger.ts:38`) |
| Texto de interface | pt-BR, só em `src/main/strings.ts` | `'Ouvindo…'`, `'Texto copiado — cole com Ctrl+V'` (`strings.ts:8`, `:136`) |
| Nome de teste | inglês; o `describe` cita o requisito entre parênteses | `describe('GroqTranscriber (FR-DICT-04)', …)` (`src/test/groq.test.ts:29`) |
| Evento e campo de log | inglês, snake_case | `dictation_done`, `transcribe_ms` (`src/main/session.ts:218-227`); `main_window_opened`, `ready_ms` (`src/main/main-window.ts:61`, `:108`) |
| Canal IPC | `<área>:<ação>`, minúsculo, kebab-case dentro de cada parte | `recorder:start`, `pill:state` (`src/shared/ipc.ts:11-17`); `groq-key:set`, `login-item:set` (`ipc.ts:19-27`) |
| Código de erro | inglês, snake_case | `no_api_key`, `paste_blocked` (`src/main/errors.ts`); `invalid_format`, `login_item_failed` (`MainWindowErrorCode`, `src/shared/ipc.ts:160-166`) |
| Chave do `config.json` | inglês, camelCase | `holdThresholdMs`, `microphoneDeviceId` (`src/main/config.ts:11-31`) |
| Valor fechado em string | inglês, minúsculo ou kebab-case; nomes de tecla em PascalCase | `'handsfree'`, `'bottom-center'`, `'listening'`, `'unreadable'`; `'RightCtrl'`, `'F13'` |
| Mensagem de diagnóstico no console | inglês | `'Touch Speaker failed to start'` (`src/main/index.ts:71`) |
| Documentação, spec, commit | pt-BR | — |

Os renderers não têm texto de interface. Na pílula, `message` e `hint` chegam prontos do main pelo
`pill:state` (`src/renderer/pill.ts:217-218`); a única string que ela monta é o cronômetro `m:ss`
(`pill.ts:193-196`). Na janela principal, o `index.html` não tem texto — só `data-text` e `data-label` —, e o
`main-window.ts` aplica por `textContent` os textos que pede ao main por `app:get-strings`
(`src/renderer/main-window/main-window.ts:61-71`); as linhas com valores (tecla e tempo em uso) chegam prontas
em `AppStatus.howTo`, porque funções não atravessam o IPC (`src/shared/ipc.ts:168-171`). Texto novo de
interface vai para `strings.ts`, nunca para o renderer nem para o meio de um módulo.

### 4.2 Nomes

| Coisa | Convenção observada | Exemplo |
| --- | --- | --- |
| Arquivo | minúsculo, kebab-case quando composto; um módulo por responsabilidade | `pill-window.ts`, `inserter.ts`, `win32.ts` |
| Pasta de módulo | substantivo da etapa do fluxo | `src/main/transcribe/`, `src/main/insert/` |
| Classe | PascalCase, substantivo + papel | `SessionController`, `HotkeyController`, `GroqTranscriber`, `TextInserter`, `PillWindow`, `MainWindow`, `AppTray`, `IdentityRefiner`, `CredentialStore`, `SettingsStore`, `ConfigWriter`, `LoginItem` |
| Interface de porta | PascalCase, sem prefixo `I`; sufixo `Port` ou `Host` para o lado que o componente consome | `Transcriber`, `Refiner`, `HotkeyHost`, `PillPort`, `InserterPort`, `CipherPort`, `FilePort`. **Inconsistência:** a porta do `app` do `LoginItem` se chama `LoginItemApp`, sem sufixo (`src/main/login-item.ts:14`) |
| Objeto de dependências ou opções | `<Componente>Deps` ou `<Componente>Options` | `SessionDeps`, `TextInserterDeps`, `GroqOptions`, `HotkeyOptions`, `TrayOptions`, `MainWindowOptions`, `CredentialStoreOptions`, `SettingsStoreOptions` |
| Payload de IPC | `<Canal>Payload` na pílula; na janela, o nome do dado (`<Coisa>View`, `<Coisa>Result`) | `RecorderStartPayload`, `RecorderResultPayload`, `RecorderErrorPayload`; `SettingsView`, `SettingsResult`, `GroqKeyResult`, `AppStatus` |
| Tipo união de literais | PascalCase | `ErrorCode`, `PillStateName`, `KeyKind`, `SessionMode`, `InsertOutcome` |
| Constante de módulo | UPPER_SNAKE, com a unidade no fim | `RESULT_TIMEOUT_MS`, `MAX_UPLOAD_BYTES`, `MIN_AUDIO_MS`, `HIDE_AFTER_FADE_MS` |
| Objeto constante exportado | PascalCase ou UPPER_SNAKE, com `as const` | `Channel`, `HOTKEY_CODES`, `DEFAULT_HOTKEY_TIMING`; `DEFAULT_CONFIG` (tipado como `AppConfig`) |
| Função | camelCase, verbo | `normalizeConfig`, `loadConfig`, `sendPasteShortcut`, `startKeyboardHook` |
| Predicado e guarda | `is*`, `has*`; conversor que valida, `as*` | `isNoSpeech`, `isHotkeyName`, `hasCredentials`, `isSelfElevated`, `isMainWindowSender`, `asResult`, `asGroqKeyInput`, `asSettingsInput` |
| Teste | `src/test/<módulo>.test.ts` | `hotkey.test.ts`, `groq.test.ts`, `main-window-ipc.test.ts` |

**Inconsistência:** o mesmo canal tem nome de chave diferente em cada cópia — `Channel.RecorderStart`
em `src/shared/ipc.ts:11` e `CH.start` em `src/preload/pill.ts:7`; na janela, `Channel.GroqKeySet` e
`CH.setGroqKey` (`src/preload/main-window.ts:15`). O valor (`'recorder:start'`, `'groq-key:set'`) é o mesmo;
é ele que precisa bater (§6.4). E o objeto de textos se chama `strings`, em minúsculo
(`src/main/strings.ts:7`), fora do padrão dos outros objetos constantes.

## 5. Renderers (pílula e janela principal)

Há dois renderers. A **pílula** continua a única janela que grava o microfone (o `getUserMedia` só existe no
renderer, e a permissão de mídia é só dela — `src/main/pill-window.ts:1-3`) e mostra o estado da sessão. A
**janela principal** (spec [`janela-principal`](spec/features/janela-principal.md)) mostra Início,
Histórico, Dicionário e Configurações, sem microfone e sem rede. O §5.1 e o §5.2 descrevem a pílula; o §5.3, o
que a janela tem de próprio. Regras visuais em [`DESIGN.md`](DESIGN.md).

### 5.1 Estrutura

```text
src/renderer/
  pill.html     a janela: marcação, CSP, tokens.css antes de pill.css e <script src="pill.js" defer>
  tokens.css    design system Sálvia: primitivos, tema claro (:root), escuro (prefers-color-scheme), base
  pill.css      estilos por data-state, só com var(--ts-…)
  pill.ts       gravação, medidor de nível, sons, atualização da tela e pré-carga da fonte (script clássico)
  global.d.ts   tipos de window.touchSpeaker, espelho de src/shared/ipc.ts
  fonts/        InterVariable.woff2 + OFL.txt (ADR-12)
  main-window/  a janela principal, com programa do tsc próprio (§3, §5.3)
```

- **Script clássico, sem módulos:** o `pill.ts` não tem `import` nem `export` e é carregado com `defer`
  (`src/renderer/pill.html:12`). Os tipos que ele usa (`PillState`, `RecorderStartPayload`,
  `RecorderErrorCode`) são declarações globais de `global.d.ts`, que **espelham** `src/shared/ipc.ts`
  à mão (`global.d.ts:1`).
- **CSP no próprio HTML** (`pill.html:6-7`): `default-src 'self'; script-src 'self'; style-src 'self';
  connect-src 'none'; img-src 'self' data:; media-src 'self' blob: mediastream:`. O renderer não faz
  requisição de rede nem carrega conteúdo remoto.
- **Estilo por atributo:** o `pill.ts` só troca `data-state` e `data-warn` (`pill.ts:215-216`); a cor e a
  forma de cada estado ficam no `pill.css`, sobre os tokens de `src/renderer/tokens.css`.
- **CSS só com tokens** (spec `design-system`, FR-DS-01): o CSS de uma janela usa `var(--ts-…)` para cor,
  família de fonte, tamanho, peso, raio, sombra e duração — nenhuma cor literal, nenhum `:root` próprio,
  nenhuma paleta por janela. Token novo entra em `tokens.css`, nos dois temas, com o par de contraste em
  `src/test/tokens.test.ts`; se o main precisar dele, também em `src/shared/palette.ts`. O `npm test` falha
  se o `pill.css` ganhar cor literal ou se os dois arquivos divergirem ([`DESIGN.md`](DESIGN.md) §3, §17).
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

### 5.3 Janela principal

Nesta seção, `main-window.ts` sem caminho é o script do renderer, `src/renderer/main-window/main-window.ts`;
o módulo do processo main de mesmo nome é sempre citado como `src/main/main-window.ts`.

```text
src/renderer/main-window/
  index.html        marcação sem nenhum texto (só ids, data-text e data-label), CSP, ../tokens.css antes do CSS próprio
  main-window.css   layout da janela, só com var(--ts-…)
  main-window.ts    barra lateral, seções e formulários (script clássico)
  global.d.ts       tipos de window.touchSpeakerApp, espelho de src/shared/ipc.ts
```

- **Mesmas regras da pílula:** script clássico carregado com `defer` (`index.html:12`), tipos por declaração
  global, CSS só com tokens (o `tokens.test.ts` confere o `main-window.css` como confere o `pill.css`), texto
  só por `textContent`, nunca `innerHTML` (`src/renderer/main-window/main-window.ts:61-71`).
- **O `.d.ts` se chama `global.d.ts`, não `main-window.d.ts`:** com o nome do script, o `tsc` o tomaria pela
  saída de declaração de `main-window.ts` e o ignoraria (`src/renderer/main-window/global.d.ts:1-4`).
- **CSP própria, sem rede e sem `'unsafe-inline'`** (`index.html:5-8`): `default-src 'none'; script-src 'self';
  style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'none'; media-src 'none';
  object-src 'none'; base-uri 'none'; form-action 'none'`. O `tokens.test.ts` falha se ela mudar.
- **Tudo passa por `window.touchSpeakerApp`** (`main-window.ts:21`), a ponte do preload
  `src/preload/main-window.ts` ([`API.md`](API.md#contratos)). Nada guardado no navegador: sem
  `localStorage` nem IndexedDB.
- **A validação é do main:** os formulários têm `novalidate` (`index.html:93`, `:119`) e o renderer só mostra
  o campo que o main apontou (`markInvalid`, `main-window.ts:264-271`).
- **A chave da Groq só passa pelo renderer entre a digitação e o "Salvar chave":** o campo é limpo depois de
  toda resposta, sucesso ou erro (`main-window.ts:200-205`).
- **Resposta velha é descartada:** Configurações relê o disco a cada vez que aparece e ignora a resposta de
  um `settings:get` anterior (`settingsRequest`, `main-window.ts:298-310`).
- **`Esc` não faz nada destrutivo:** na janela, ele só desfaz a confirmação de "Remover chave"
  (`main-window.ts:245-251`), porque o `Esc` da tecla de ditado também chega ao app em foco (RISK-013).
- **Navegação na mesma página:** trocar de seção só mostra e esconde painéis e marca `aria-current="page"`;
  a URL não muda (`showSection`, `main-window.ts:110-118`).

## 6. Processo main

### 6.1 Módulos

| Módulo (`src/main/`) | Responsabilidade hoje | Depende de Electron ou módulo nativo |
| --- | --- | --- |
| `index.ts` | Ponto de entrada: ciclo de vida do app, permissões de mídia, handlers e validação do IPC da pílula e da janela, montagem de todos os componentes | `electron` |
| `session.ts` | `SessionController`, dono único do estado do ditado | não (`node:crypto`) |
| `hotkey.ts` | `HotkeyController`: segurar × tocar, auto-repetição, atalho × ditado | não |
| `keyboard.ts` | Ponte do hook global para o `HotkeyController`; reduz cada tecla a `hotkey`/`escape`/`other`. Carrega o `uiohook-napi` só dentro de `startKeyboardHook` (`keyboard.ts:11-13`), para um binário quebrado cair no `try` do `index.ts` | `uiohook-napi` |
| `keys.ts` | Códigos de tecla do libuiohook | não |
| `config.ts` | `config.json` com defaults e validação; `ConfigWriter`, a fila única de gravação | não (`node:fs`, `node:path`) |
| `credentials.ts` | `CredentialStore`: a chave da Groq (`groq-key.bin` cifrado, `.env` em desenvolvimento) | não — a cifra entra pela porta `CipherPort` |
| `settings.ts` | `SettingsStore`: as preferências de Configurações | não |
| `atomic-file.ts` | Gravação atômica, a porta `FilePort` e `errorName` | não (`node:fs`) |
| `login-item.ts` | `LoginItem`: "Iniciar com o Windows" | não — o `app` entra pela porta `LoginItemApp` |
| `main-window-ipc.ts` | Validadores do IPC da janela e checagem de remetente | não (`node:path`, `node:url`) |
| `logger.ts` | Log rotativo só com metadados | não (`node:fs`, `node:path`) |
| `strings.ts` · `errors.ts` | Textos da interface (pt-BR) · códigos de erro | não |
| `refine.ts` | `Refiner` (identidade na Fase 1) | não |
| `transcribe/` | `transcriber.ts` (interface) · `groq.ts` · `filters.ts` (anti-lixo) | não (usa o `fetch` global) |
| `insert/inserter.ts` | Clipboard + Ctrl+V + restauração | `electron` (`clipboard`) |
| `insert/win32.ts` | `SendInput` e detecção de elevação | `koffi` |
| `pill-window.ts` · `main-window.ts` · `tray.ts` · `icon.ts` | Janela da pílula · janela principal · bandeja · ícones desenhados em código | `electron` |

- **Lógica pura fica longe do Electron**, e é por isso que pode ser testada no Node: `hotkey.ts`,
  `filters.ts`, `config.ts`, `groq.ts`, `icon-bitmap.ts`, `credentials.ts`, `settings.ts`,
  `main-window-ipc.ts` e `login-item.ts` têm testes; `session.ts` também não importa `electron`, mas ainda
  não tem teste.
- **Portas injetadas para testar sem Electron** (padrão seguido pela janela principal): o que toca o sistema
  entra no construtor como interface pequena, com a implementação real ligada no `index.ts`. São a cifra
  (`CipherPort`, `src/main/credentials.ts:14-18`; real: o `safeStorage`, `src/main/index.ts:168-172`), o
  disco (`FilePort`, `src/main/atomic-file.ts:6-13`; real e padrão: `nodeFilePort`, `:15-23`) e o `app`
  (`LoginItemApp`, `src/main/login-item.ts:14-18`; real: o `app` do Electron, `index.ts:183`). Os testes
  passam uma cifra falsa (`src/test/credentials.test.ts:12-27`), uma pasta temporária, um disco que falha no
  meio da gravação e um `app` que não está empacotado.
- **Módulo nativo isolado num arquivo só:** `uiohook-napi` só em `keyboard.ts`, `koffi` só em `win32.ts`.
- **Só o `index.ts` conhece todo mundo.** Ele cria os componentes concretos e os injeta
  (`src/main/index.ts:164-247`); os outros módulos dependem de interfaces e importam tipos com
  `import type`.

### 6.2 Config e estado

- **Um único dono do estado da sessão: o `SessionController`** (`state`, `sessionId`, `mode`,
  `inserting` e os timers, `src/main/session.ts:60-69`). Os outros componentes perguntam pela porta:
  o `HotkeyController` só enxerga `phase()` — `idle`, `recording` ou `busy` (`session.ts:78-81`).
- **O `HotkeyController` guarda o mínimo:** tecla pressionada ou não, o horário do último keydown dela e
  se esta pressão abriu a sessão (`src/main/hotkey.ts:36-39`). Nada sobre as outras teclas.
- **A config em uso é lida uma vez**, ao abrir (`src/main/index.ts:115`), e passada adiante como objeto,
  que não muda até reiniciar. Quem escreve o `config.json` no disco é só a fila `ConfigWriter`
  (`src/main/config.ts:194-222`), usada hoje pelo `SettingsStore`: cada gravação relê o arquivo, troca só os
  seus campos e grava de forma atômica (`src/main/atomic-file.ts:26-39`). Fora isso, o único estado de
  módulo no main é o cache das funções do Windows (`bindings`, `src/main/insert/win32.ts:29`).
- **A chave da Groq em memória tem um dono só:** o `CredentialStore`. O `current()` existe só para o
  `GroqTranscriber`; o resto do app (bandeja, janela, log) só enxerga o estado — `stored`, `env`, `none` ou
  `unreadable` (`src/main/credentials.ts:85-92`).

### 6.3 Componentes e portas

- **Componente com estado é classe; dependência entra por objeto no construtor**, como parameter
  property `private readonly`: `constructor(private readonly deps: SessionDeps)` (`session.ts:72`),
  `TextInserter` (`src/main/insert/inserter.ts:71`), `GroqTranscriber` (`src/main/transcribe/groq.ts:39`),
  `CredentialStore` (`src/main/credentials.ts:57`), `SettingsStore` (`src/main/settings.ts:129`).
- **Tempo, rede e chave são injetáveis:** `now?: () => number` (`session.ts:40`; obrigatório em
  `HotkeyOptions`, `hotkey.ts:30`), `fetchImpl?: typeof fetch`, `timeoutMs`, `retryDelayMs` e
  `getApiKey: () => string | undefined`, lida a cada chamada (`groq.ts:9-19`). Os testes usam exatamente
  esses pontos; cifra, disco e `app` entram pelas portas do §6.1.
- **A porta é declarada por quem a consome:** `PillPort` e `InserterPort` em `session.ts:24-31`;
  `HotkeyHost` em `hotkey.ts:10-17`.
- **Provedor sempre atrás de interface:** `Transcriber` (`src/main/transcribe/transcriber.ts:9-12`) e
  `Refiner` (`src/main/refine.ts:3-5`). Trocar a Groq ou ligar a limpeza por IA é escrever outra
  implementação, sem mexer no fluxo (ADR-04, ADR-05).
- **Funções do Windows carregadas sob demanda** (`load()`, `win32.ts:31-52`) e uma vez ao abrir o app
  (`initWin32`, `win32.ts:55-57`), para falhar cedo e não no meio de um ditado.

### 6.4 Canais IPC

- **Nome `<área>:<ação>`**, declarado em `Channel` (`src/shared/ipc.ts:9-28`), com os tipos de payload
  ao lado.
- **Dois conjuntos de três arquivos que andam juntos** — um por renderer, porque o preload em sandbox não
  importa arquivo local e o renderer é script clássico:

  | Renderer | Main (nomes e tipos) | Cópia dos nomes no preload | Espelho dos tipos no renderer |
  | --- | --- | --- | --- |
  | Pílula | `src/shared/ipc.ts` | `src/preload/pill.ts:6-14` | `src/renderer/global.d.ts` |
  | Janela principal | `src/shared/ipc.ts` | `src/preload/main-window.ts:9-19` | `src/renderer/main-window/global.d.ts` |

  Mudou um, mudam os três do mesmo conjunto — e o [`API.md`](API.md#contratos) **antes** do código. O
  espelho da janela se chama `global.d.ts`, não `main-window.d.ts`, porque o `tsc` tomaria um `.d.ts` com o
  nome do script pela saída de declaração dele e o ignoraria (§5.3). O TEST-009 confere que o preload da
  janela usa exatamente os canais da janela de `shared/ipc.ts` e que o da pílula não expõe nenhum deles
  (`src/test/main-window-ipc.test.ts:206-215`); os tipos continuam conferidos só no review (RISK-027).
- **Pílula: só `send`/`on`.** O main fala com a pílula só por `PillWindow.send` e `setState`
  (`src/main/pill-window.ts:63-83`), que conferem se a janela ainda existe; a pílula fala com o main só pelos
  três `ipcMain.on` de `src/main/index.ts:250-262`.
- **Janela principal: `invoke`/`handle`.** Os canais de pedido e resposta passam por `handleWindow`
  (`src/main/index.ts:292-296`), que confere o remetente a cada mensagem e rejeita o `invoke` com
  `ipc_rejected`. Só dois canais são de mão única: `app:status`, do main para a janela (`MainWindow.send`,
  `src/main/main-window.ts:73-75`, descartado com a janela fechada), e `app:relaunch`, da janela para o main
  (`index.ts:405-413`).
- **O preload expõe funções, nunca o `ipcRenderer`** (`src/preload/pill.ts:22-30`;
  `src/preload/main-window.ts:21-35`). Nenhum preload expõe canal do outro renderer.
- **Recomendação** para canal novo: na pílula, payload com `sessionId` quando for de uma gravação e
  validador `as*` no `index.ts`; na janela, sem `sessionId` — o canal não é de uma sessão, e o remetente é
  conferido pela identidade do `webContents` —, validador `as*` em `src/main/main-window-ipc.ts` e caso no
  TEST-009; teste sempre que a regra tiver lógica.

### 6.5 Validação de entrada

- **Tudo o que vem de fora do main é `unknown` até passar por uma guarda:** payloads de IPC da pílula
  (`asStarted`, `asResult`, `asError`, `src/main/index.ts:82-107`) e da janela (`asGroqKeyInput`,
  `asSettingsInput`, `asLoginItemInput`, `isEmptyPayload`, `src/main/main-window-ipc.ts:29-67` — objeto
  simples, com exatamente as chaves do contrato, tipos certos e strings de até 64 caracteres), o
  `config.json` (`normalizeConfig`, `src/main/config.ts:63-118`), a resposta da Groq (tipo com campos
  opcionais e `??` nos defaults, `src/main/transcribe/filters.ts:14-22`, `:42-50`).
- **Remetente antes de conteúdo:** nos canais da pílula, só a pílula é ouvida (`fromPill`, `index.ts:249`);
  nos da janela, só o `webContents` da janela principal aberta agora, no quadro principal, mostrando o
  `index.html` do app (`isMainWindowSender`, `src/main/main-window-ipc.ts:111-121`).
- **Tamanho antes de uso:** áudio de até 25 MB, conferido no IPC (`index.ts:99`) e antes do upload
  (`groq.ts:52`); chave da Groq de 1 a 512 caracteres, sem espaço nem caractere de controle no meio
  (`normalizeGroqKey`, `src/main/credentials.ts:43-48`).
- **O teclado é reduzido na fonte:** cada evento vira `hotkey`, `escape` ou `other` em
  `src/main/keyboard.ts:14-15`; código de tecla não passa dali. Na janela principal, o código só reage a
  duas teclas: F12, que abre o DevTools só em desenvolvimento (`src/main/main-window.ts:116-122`), e `Esc`
  dentro da página (`src/renderer/main-window/main-window.ts:245-251`); nenhuma das duas vai para o log. Code review recusa qualquer mudança que
  identifique outra tecla ([Security Guide §7](Security-Guide.md#7-entrada-teclado-global-e-ipc)).

### 6.6 Concorrência e timers

- **Uma sessão por vez:** `start` só sai de `idle` (`src/main/session.ts:92`), e cada método confere o
  estado antes de agir (`stop`, `:136`; `cancel`, `:152`; `onRecorderResult`, `:177`).
- **Resposta assíncrona confere a sessão ao chegar:** evento com `sessionId` de outra sessão é ignorado
  (`session.ts:164`, `:169`, `:177`).
- **Todo timer fica num campo e é limpo em toda saída:** `sessionTimers`, `resultTimer`, `messageTimer`
  (`session.ts:67-69`), limpos por `clear*` (`:300-313`) e por `shutdown` (`:252-257`).
- **Promessa disparada sem esperar leva `void`** (`void session.onRecorderResult(p)`,
  `src/main/index.ts:256`; `void shell.openPath(...)`, `src/main/tray.ts:64`; `void clipboard...`,
  `src/main/insert/inserter.ts:100`; `void saveKey()`, `src/renderer/main-window/main-window.ts:185`).
- **Gravação em disco em fila:** o `ConfigWriter` encadeia cada `update` na promessa da gravação anterior
  (`src/main/config.ts:202-207`), para duas gravações do `config.json` nunca correrem juntas nem apagarem uma
  a mudança da outra.
- **Espera por condição, com prazo:** `waitUntil` consulta a cada 20 ms até 2 s (`inserter.ts:25-28`,
  `:75`). Espera fixa só onde o Windows precisa de tempo, como constante nomeada (`BEFORE_PASTE_MS`,
  `AFTER_PASTE_MS`, `inserter.ts:19-20`).
- **Sinalizador com `try/finally`:** o `inserting` liga antes do Ctrl+V sintético e desliga no `finally`
  (`inserter.ts:82-109`), para o hook não tratar as teclas sintéticas como do usuário.
- **Timeout de rede por `AbortSignal.timeout`** (`groq.ts:63`).

### 6.7 Erros e códigos

- **Um código por falha:** `ErrorCode` é uma união de literais (`src/main/errors.ts:2-14`); a mensagem
  sai de `errorMessage(code)` (`src/main/strings.ts:140-142`). O mapa é `Record<ErrorCode, string>`
  (`strings.ts:125`): código novo sem mensagem não compila. Tabela completa em
  [`API.md`](API.md#códigos-de-erro). Os códigos da janela principal (`MainWindowErrorCode`,
  `src/shared/ipc.ts:160-166`) ficam **fora** do `ErrorCode`, porque nunca chegam à pílula; as mensagens deles
  estão em `mainWindowStrings().errors` (`strings.ts:113-119`).
- **Desfecho esperado volta como valor, não como exceção:** `TranscriptionResult`
  (`src/main/transcribe/transcriber.ts:3-6`), `InsertOutcome` (`src/main/insert/inserter.ts:6`),
  `KeySaveResult` e `KeyRemoveResult` (`src/main/credentials.ts:30-34`), `ConfigUpdateResult`
  (`src/main/config.ts:185`), `SettingsSaveOutcome` (`src/main/settings.ts:112-115`).
- **`catch` sem variável.** Quando o bloco fica vazio de propósito, leva um comentário dizendo por quê
  (`src/main/index.ts:62-64`, `inserter.ts:37-39`, `:87-89`, `src/main/logger.ts:37-39`,
  `src/main/atomic-file.ts:34-36`). Quando devolve um valor de recuperação, o próprio retorno explica e não
  há comentário (`groq.ts:70-72`, `inserter.ts:57-59`, `src/main/config.ts:174-176`).
- **Exceção inesperada vai para o log só pelo `name`** (`index.ts:161`, `:268`;
  `src/main/session.ts:233`) ou pelo código errno (`errorName`, `src/main/atomic-file.ts:42-48`), nunca pela
  mensagem ou pela pilha, que podem carregar conteúdo.

Como cada falha aparece:

| Saída | Quando | Âncora |
| --- | --- | --- |
| Pílula em `error`, com a mensagem do código | falha que encerra o ditado | `src/main/session.ts:267-272` |
| Pílula em `notice` | `paste_blocked`: o texto ficou no clipboard | `session.ts:230` |
| Pílula some, sem aviso | `no_speech`, cancelamento por `Esc` ou atalho | `session.ts:151-159`, `:261-265` |
| Só log | problema que não interrompe o ditado: config inválida, IPC rejeitado, console da pílula ou da janela | `src/main/index.ts:115`, `:138-142`, `:257`, `:288-291`; `src/main/main-window.ts:111-115` |
| App abre sem a parte que falhou | `koffi` ou hook de teclado não carregou (`win32_unavailable`, `keyboard_hook_unavailable`); `groq-key.bin` ilegível (`groq_key_unreadable`) | `index.ts:156-162`, `:264-270`, `:176-177` |
| Início da janela principal, com borda, glifo e texto | hook de teclado indisponível (erro); chave ausente ou ilegível (aviso) | `src/renderer/main-window/main-window.ts:129-168` |
| Mensagem na janela principal, em `role="status"` | falha ao salvar ou remover a chave, ao salvar preferências ou ao mudar o início com o sistema | `src/renderer/main-window/main-window.ts:188-206`, `:229-243`, `:317-348`, `:356-373` |
| Janela destruída, app segue | o renderer da janela caiu (`main_window_renderer_gone`) | `src/main/main-window.ts:123-126` |
| App não abre | exceção ao iniciar: `console.error` e `app.exit(1)` | `index.ts:70-73` |

### 6.8 Configuração

- **Uma variável de ambiente**, `GROQ_API_KEY`, carregada pelo `process.loadEnvFile` nativo só com o app
  não empacotado (`src/main/index.ts:59-65`) — sem pacote de `.env`. Usar uma biblioteca para isso é
  dependência nova e exige ADR. Detalhes em [`ENVIRONMENT.md`](ENVIRONMENT.md#variáveis).
- **Segredo não é config:** a chave da Groq não vai no `config.json` nem, no app instalado, em variável de
  ambiente; fica no `groq-key.bin`, cifrada, sob o `CredentialStore` (ADR-08, BR-016).
- **Preferência do usuário vai no `config.json`**, não em variável de ambiente. **Recomendação** para
  campo novo: tipo em `AppConfig`, default em `DEFAULT_CONFIG`, regra em `normalizeConfig`
  (`src/main/config.ts:11-118`), caso em `src/test/config.test.ts` e [`DATABASE.md`](DATABASE.md#configjson)
  no mesmo trabalho — e `version` sobe se o formato mudar (§7). Se uma tela o grava, a gravação passa pelo
  `ConfigWriter.update`, trocando só os campos daquela feature (FR-UI-29).
- **Constante que não é preferência fica no código**, como `UPPER_SNAKE` no topo do módulo (limites,
  timeouts, `src/main/transcribe/groq.ts:6-7`, `src/main/session.ts:53-55`).
- **Configuração do Electron antes do `ready`, no topo do `index.ts`:** nome do app, `userData`,
  `AppUserModelId`, aceleração de hardware desligada, o `.env` de desenvolvimento e instância única
  (`index.ts:51-74`). O que depende do `ready` — como o `safeStorage` do `CredentialStore` — é montado dentro
  de `main()` (`index.ts:164-176`).

### 6.9 Scripts

- `scripts/start.mjs` e `scripts/copy-static.mjs` são **ES modules** (`.mjs`), só com módulos `node:`, e
  resolvem caminhos a partir de `import.meta.url`, sem depender da pasta atual
  (`scripts/start.mjs:8`, `scripts/copy-static.mjs:7`).
- Os comandos do dia a dia são os `scripts` do `package.json:11-17` (`build`, `dev`, `start`,
  `typecheck`, `test`).
- **Recomendação:** script novo segue o mesmo molde — `.mjs`, sem dependência, sem caminho absoluto de
  máquina — e entra no `package.json` se for de uso frequente.

## 7. Config e dados

- **Não há banco na Fase 1.** O app persiste só o `config.json`, o `groq-key.bin` (a chave cifrada, depois
  de "Salvar chave") e o log; o `.env` é do desenvolvedor ([`DATABASE.md`](DATABASE.md)).
- **Áudio nunca vai para disco.** A gravação vive em memória, da pílula ao main e do main à Groq.
- **Texto ditado, clipboard e teclas nunca vão para disco nem para log; a chave, só cifrada.** O tipo
  `LogFields` (`src/main/logger.ts:6-7`) só aceita primitivos, mas não impede uma string com conteúdo: isso
  fica com o review.
- **Gravação de arquivo é atômica:** temporário `.tmp` na mesma pasta e renomear por cima, por
  `writeFileAtomic` (`src/main/atomic-file.ts:26-39`); falha no meio deixa o arquivo anterior.
- **Config inválida nunca derruba o app** (BR-012): cada campo inválido cai no default com aviso
  (`src/main/config.ts:63-118`).

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
| `GroqTranscriber` | idem, com `fetch` simulado | `src/test/groq.test.ts` | 10 casos: `200`, silêncio, sem chave, a chave lida a cada chamada (trocar a chave entre duas chamadas muda o `Authorization`), `401`, `413`, `429`, `5xx` com nova tentativa, dois `5xx`, falha de rede (TEST-003) | ❌ |
| `normalizeConfig` | idem | `src/test/config.test.ts` | 3 casos: defaults, valores válidos, campos inválidos (TEST-004) | ❌ |
| Tokens e contraste | idem, lendo os arquivos de `src/renderer/` | `src/test/tokens.test.ts` | 74 casos: paridade dos temas, superfície da pílula = `--ts-bg`, base da janela principal, fonte local com `OFL.txt` (em `src/` e `dist/`), `pill.css` e `main-window.css` sem cor literal, token próprio, duração literal nem rede, `pill.html` com `tokens.css` antes e CSP inalterada, `main-window/index.html` com `../tokens.css` antes do CSS próprio, a CSP exata e nenhum texto de interface, todo `id` que o script da janela procura existe no HTML, `copy-static` põe a página em `dist/renderer/main-window/`, pares de contraste dos dois temas, `shared/palette.ts` = CSS (TEST-005) | ❌ |
| Ícone da bandeja | idem, sobre o buffer de `icon-bitmap.ts` | `src/test/icon.test.ts` | 14 casos: pixel do glifo e do ponto por variante e tamanho, sem o vermelho antigo, contraste contra a barra (TEST-006) | ❌ |
| `CredentialStore` | idem, com cifra simulada, pasta temporária e disco que falha | `src/test/credentials.test.ts` | 14 casos: formato da chave; ordem `groq-key.bin` → `.env` → nenhuma; `.env` ignorado no app empacotado; salvar, trocar e remover; formato inválido e cifra indisponível não gravam nada; falha no meio da gravação mantém o arquivo anterior; arquivo que não decifra vira `unreadable` sem cair no `.env`; nenhum estado ou resultado carrega a chave (TEST-007) | ❌ |
| `SettingsStore` e a fila do `config.json` | idem, com pasta temporária | `src/test/settings.test.ts` | 27 casos: cada campo fora da faixa vira `invalid_field` com o nome certo, pelas regras do `normalizeConfig`; a mescla troca só os sete campos e preserva desconhecidos, `microphoneDeviceId`, `history.retentionDays` e `version`; `maxRecordingMs` em ms; `restartPending`; leitura sem aviso; falha de escrita, JSON inválido e arquivo apagado; preferências e retenção pela mesma fila; `loadConfig` com `created`; `shouldOpenOnFirstRun` (TEST-008) | ❌ |
| IPC da janela principal | idem, com remetentes e `app` simulados | `src/test/main-window-ipc.test.ts` | 22 casos: `asGroqKeyInput`, `asSettingsInput`, `asLoginItemInput` e payload vazio; remetente (janela aberta, quadro principal, só a página do app, caminho sem diferenciar maiúsculas só no Windows); `LoginItem` (não empacotado → `unavailable` sem tocar no sistema; desativação no Gerenciador de Tarefas conta como desligado; falha devolve o estado real); canais do preload da janela = os de `shared/ipc.ts` e o da pílula sem nada da janela; textos da janela e `data-text` do HTML; rótulo do item de login por plataforma; `no_api_key` aponta para a janela (TEST-009) | ❌ |
| Roteiro manual | pessoa + app aberto por `npm run dev` | §12.2 da [spec `ditado-por-voz`](spec/features/ditado-por-voz.md); §14 da [spec `design-system`](spec/features/design-system.md); §14 da [spec `janela-principal`](spec/features/janela-principal.md) | V1–V13, só o V2 feito (PEND-001); V-DS-1…6 (PEND-006); VJ1–VJ24 (PEND-007) | — |

Total: **182 testes**, todos passando no `npm test` de 18/out/2026 (30 até 17/out/2026; 113 com a spec
`design-system`). Os testes são compilados com o resto para `dist/test/` e rodados por `node --test`. Não há
teste de interface, de ponta a ponta nem piso de cobertura; `session.ts`, `inserter.ts`, `win32.ts`,
`main-window.ts`, o `safeStorage` real, a bandeja, a pílula e a janela principal na tela só têm o roteiro
manual (cor e contraste, os pixels do ícone, a lógica da chave, das preferências e do IPC da janela têm teste).

**Como os testes são escritos (FATO)**

- `describe`/`it` de `node:test` e `assert` de `node:assert/strict`, nessa ordem de import, seguidos do
  módulo testado (`src/test/groq.test.ts:1-3`).
- **Fake implementa a porta:** `class FakeHost implements HotkeyHost`, que registra as chamadas
  (`src/test/hotkey.test.ts:5-30`).
- **Relógio injetado e avançado à mão:** `now: () => clock` e `clock += 1200` (`hotkey.test.ts:40`,
  `:45`). Nada de espera real.
- **Rede simulada:** `fetchImpl` que devolve `Response` de verdade e guarda as requisições, com
  `retryDelayMs: 1` (`groq.test.ts:12-24`).
- **Casos em tabela:** `for (const [status, code] of [...] as const)` gera um `it` por status
  (`groq.test.ts:80-90`).
- **Cifra e disco simulados:** uma cifra falsa que implementa `CipherPort`
  (`src/test/credentials.test.ts:12-27`) e uma pasta temporária por teste, criada no `beforeEach` e apagada no
  `afterEach` (`credentials.test.ts:55-61`). Nunca o `safeStorage` real nem uma chave de verdade: as chaves
  dos testes são falsas.

**O que se espera de teste novo (Recomendação)**

- Lógica nova fica fora do Electron para poder ser testada no Node, como `hotkey.ts` e `filters.ts`.
- Regra nova (`BR-NNN`) ou bug corrigido ganha teste que falharia sem a mudança.
- Nunca rede, relógio, microfone, cifra ou disco reais do usuário: injete `now`, `fetchImpl`, `CipherPort`,
  `FilePort` ou uma pasta temporária.
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
// A 40 px pill does not need the GPU; software compositing saves memory (NFR-03). — src/main/index.ts:54
```

Não há contraexemplo no código hoje. Fica de fora: narrar o trabalho ("novo", "corrigido", "antes era
assim"), repetir em prosa o que a linha faz e deixar código comentado — o histórico vai no commit, no PR
ou no [`CHANGELOG.md`](CHANGELOG.md), nunca no arquivo.

- **Cabeçalho do arquivo:** a maioria dos módulos abre com um comentário `//` que diz a responsabilidade
  e o documento ou a seção que o governa (`src/main/config.ts:1-2`, `src/main/hotkey.ts:1-3`,
  `src/main/pill-window.ts:1-3`, `src/main/session.ts:1-2`, `src/main/main-window.ts:1-5`,
  `src/main/credentials.ts:1-5`). Exceções hoje: `src/main/tray.ts` e `src/main/transcribe/transcriber.ts`
  abrem direto no código; `src/main/index.ts:1` tem cabeçalho sem citar documento, e `src/main/strings.ts:1-2`
  cita só um requisito (FR-UI-10); os testes não têm cabeçalho no topo — os três da janela principal trazem,
  logo depois dos imports, a linha que cita o TEST e a spec (`src/test/credentials.test.ts:9-10`).
  **Recomendação:** arquivo novo de `src/main`, `src/preload`, `src/renderer` ou `src/shared` abre com esse
  cabeçalho; quando a seção citada mudar de número, o comentário muda junto.
- **JSDoc `/** … */`** em exportação ou campo cujo sentido não é óbvio pelo nome (`MIN_AUDIO_MS`,
  `src/main/transcribe/filters.ts:4`; `repeatGapMs`, `hotkey.ts:24-29`; `isForegroundWindowElevated`,
  `src/main/insert/win32.ts:103-106`).
- **Separador de seção** `// ---- Nome ----` só em arquivo longo (`src/main/index.ts:76`, `:109`, `:283`;
  `session.ts:76`, `:161`, `:259`; `src/renderer/pill.ts:28`, `:55`, `:191`; `src/main/config.ts:161`).
- **Comentário de linha no fim da instrução** para dar nome a um campo binário
  (`// wVk`, `// dwFlags`, `win32.ts:62-66`) ou a origem de um valor derivado
  (`/* D: Black Hole + 30% Alabaster */`, `src/renderer/tokens.css:67`).
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
  - vírgula final em lista e objeto quebrados em várias linhas (`src/main/index.ts:2-12`);
  - template literal para interpolar (`` `Bearer ${apiKey}` ``, `src/main/transcribe/groq.ts:66`);
  - imports no topo: pacotes (`electron`) e módulos `node:` primeiro, depois os locais em ordem
    alfabética do caminho (`src/main/index.ts:2-46`, `src/main/session.ts:3-22`); módulos do Node sempre
    com o prefixo `node:` (`node:fs`, `node:path`, `node:crypto`).
- **Largura de linha:** em geral até ~120 colunas, sem limite rígido. Em 18/out/2026, 42 linhas dos `.ts` e
  `.mjs` de `src/` e `scripts/` passam disso (eram 14 no commit `ed0a1f5`); a maior tem 209, num teste
  (`src/test/tokens.test.ts:259`), e a maior do código do app tem 186, uma assinatura de função C
  (`src/main/insert/win32.ts:48`).
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
- [ ] TODO: a sincronia dos dois conjuntos de três arquivos (§6.4) é só em parte automática: o TEST-009
  confere os nomes de canal dos dois preloads contra `src/shared/ipc.ts`, mas os tipos de
  `src/renderer/global.d.ts` e `src/renderer/main-window/global.d.ts` contra `shared/ipc.ts` só são conferidos
  no review (RISK-027).
- [ ] TODO: "nenhuma tecla além da configurada e do `Esc` é identificada" só é conferido no review
  (§6.5, [Security Guide §16](Security-Guide.md#16-checklist-de-segurança-do-pr)).
- [ ] TODO: o tipo `LogFields` garante só primitivos no log; que nenhum primitivo seja texto ditado,
  clipboard, tecla ou chave depende do review (§7).
- [ ] TODO: "texto de interface só em `strings.ts`" e "renderer sem strings próprias" sem verificação
  automática (§4.1).
- [ ] TODO: sem teste de interface: gravação, colagem, pílula e bandeja só pelo roteiro manual V1–V13; a
  janela principal, o `safeStorage` real e o item de login, só pelo VJ1–VJ24 (§8).
- [ ] TODO: "o microfone fecha em todo caminho" só verificado à mão, olhando o indicador do Windows (§5.2).
- [ ] TODO: nada barra segredo no diff: não há varredura de segredos.
- [ ] TODO: convenção de commit sem commitlint (§11).
- [ ] TODO: `npm audit` antes de cada versão é passo manual
  ([Security Guide §15.1](Security-Guide.md#151-dependências)).
