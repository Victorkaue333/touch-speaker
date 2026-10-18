# ENVIRONMENT — Touch Speaker

> Última atualização: 18/out/2026 · Mantenedor: Victor Alves

Como montar o ambiente local e o que cada variável de ambiente faz de fato. Os caminhos e as linhas citados são de `frontend/`, conferidos em 18/out/2026 com a Fase 1 implementada (T1–T8) e as specs [`design-system`](spec/features/design-system.md), [`janela-principal`](spec/features/janela-principal.md) (com o tema claro/escuro, FR-UI-39…42), [`historico`](spec/features/historico.md) e [`historico-dados-v1`](spec/features/historico-dados-v1.md) implementadas no código, ainda não commitadas.

O Touch Speaker roda no **Windows 10 ou 11, 64 bits**, e no **macOS 13 (Ventura) ou mais novo, em Mac com Apple Silicon** ([ADR-11](DECISIONS.md#adr-11--macos-como-plataforma-suportada-e-distribuição-restrita-antes-da-fase-4); o porte está no código desde 18/out/2026 e ainda não foi verificado num Mac — [Linux e macOS](#linux-e-macos)). Quem só quer usar o app baixa o instalador ([`README.md` — Download](../README.md#download)); esta página é para quem desenvolve. O único serviço externo é a Groq, que faz a transcrição com a chave do próprio usuário; não há servidor de banco, porta, fila nem servidor para subir — o histórico é um arquivo SQLite que o próprio app cria e abre em `%LOCALAPPDATA%\Touch Speaker\` ([Caminhos e arquivos](#caminhos-e-arquivos)). Todos os comandos rodam **de dentro de `frontend/`**, e o app abre sempre por `npm run dev` ou `npm start`, que passam por `scripts/start.mjs` (ver [`ELECTRON_RUN_AS_NODE`](#variáveis)).

**Windows (PowerShell)**

```powershell
git clone https://github.com/Victorkaue333/touch-speaker.git
cd touch-speaker\frontend
npm install                 # avisa que os scripts de koffi e uiohook-napi não rodaram: é esperado
copy .env.example .env      # opcional: cole a sua chave da Groq depois de GROQ_API_KEY= no .env
npm run dev                 # compila e abre o app na bandeja

npm start                   # abre sem recompilar
npm test                    # compila e roda os testes (node:test)
npm run typecheck           # checagem de tipos dos três programas do tsc (main, pílula, janela principal), sem gerar arquivos
npm run build               # só compila, para dist/
npm run dist:win            # limpa, compila e gera o instalador do Windows em release/ (electron-builder)
npm run verify:package      # confere de novo o pacote em release/ (o dist:win já confere antes de gerar o .exe)
```

Na primeira vez, o `npm install` baixa o binário do Electron. Com o app aberto, o ícone de microfone aparece na bandeja (talvez escondido na setinha `^`); o primeiro ditado é segurar o Ctrl direito no Bloco de Notas, falar e soltar.

A chave da Groq entra de dois jeitos: pela **janela principal** (bandeja → "Abrir Touch Speaker" → Configurações → "Salvar chave"), que a guarda cifrada em `groq-key.bin`, ou pelo `frontend/.env`, que só vale em desenvolvimento e só quando não há chave salva ([O arquivo .env](#o-arquivo-env)). Na **primeira execução** — o `config.json` ainda não existia — sem chave salva no app, a janela principal abre sozinha em Configurações, com o foco no campo da chave; isso acontece mesmo com o `.env` preenchido, porque o estado da chave é `env`, não `stored`. Pode salvar a chave ali ou só fechar a janela: o app segue na bandeja e o `.env` continua valendo.

| Serviço | Porta local | Onde está definido |
| --- | --- | --- |
| Nenhum | — | O app não escuta porta nenhuma; a única saída de rede é `https://api.groq.com`, a partir do processo main (`src/main/transcribe/groq.ts:6`) |

## Linux e macOS

- **macOS 13+ em Apple Silicon** é plataforma suportada desde a M2 ([ADR-11](DECISIONS.md#adr-11--macos-como-plataforma-suportada-e-distribuição-restrita-antes-da-fase-4)). O que muda por sistema fica atrás de interface e é escolhido na abertura por `src/main/platform.ts`: colagem por ⌘V com `CGEventPost` (`src/main/insert/darwin.ts`, CoreGraphics via `koffi`) no lugar do `SendInput`, hook de teclado só depois da permissão de **Acessibilidade**, microfone pelo pedido do macOS, app só na barra de menus, Command direito como tecla padrão. **Ainda não rodou num Mac:** o Victor não tem Mac; o comportamento é provado pelo roteiro VDM, com o amigo dele (spec [`distribuicao-windows-macos`](spec/features/distribuicao-windows-macos.md) §14).
- **Desenvolver num Mac:** os mesmos comandos (`npm install`, `npm run dev`, `npm test`), num terminal. O `npm install` no Mac instala `@koromix/koffi-darwin-arm64`, que não existe no Windows. Em `npm run dev` quem pede as permissões é o `Electron.app` de `frontend/node_modules/electron/dist/`: conceda **Acessibilidade** a ele (Ajustes do Sistema → Privacidade e Segurança → Acessibilidade) e permita o **Microfone** quando o macOS perguntar; depois, na barra de menus, **Tentar de novo**. O `.dmg` só é gerado em macOS (`npm run dist:mac`): na prática, pelo GitHub Actions ([Empacotar e publicar](#empacotar-e-publicar)).
- **Linux:** planejado para depois, sem data (ADR-11). Num sistema que não é Windows nem macOS o app para na abertura com `UnsupportedPlatformError` (`selectPlatform`).

## Node.js e Electron

- **Node.js 24 LTS** (conferido com 24.20.0) e o **npm** que vem com ele (conferido com 11.21). O Node do sistema serve para `npm install`, para o `tsc` e para os testes (`node --test`); o app em si roda dentro do Electron.
- **Electron 44.9.0**, versão exata em `devDependencies` (`package.json`). O `npm install` baixa o binário (~100 MB) e o confere pelo `checksums.json` do próprio pacote.
- **TypeScript 7.0.2** e **`@types/node` 24.19.2**, também em `devDependencies`. Não há bundler: `build` e `typecheck` rodam **três programas** do `tsc` (`package.json:12`, `:15`) — `tsconfig.main.json` (main, os dois preloads, shared e testes → `dist/` em CommonJS), `tsconfig.renderer.json` (a pílula → `dist/renderer/`; exclui `src/renderer/main-window`) e `tsconfig.main-window.json` (a janela principal → `dist/renderer/main-window/`). Os dois renderers são scripts clássicos e ficam em programas separados para não dividirem o escopo global. `scripts/copy-static.mjs` copia os `.html`, `.css` e `.txt` (licenças) do topo de `src/renderer` (`pill.html`, `tokens.css`, `pill.css`), os de `src/renderer/main-window/` (`index.html`, `main-window.css`, `LICENSE-lucide.txt`) e a pasta `fonts/` (`scripts/copy-static.mjs:13-24`), e as migrations do histórico, `database/local/*.sql` da raiz do repositório, para `dist/database/local/` (`copy-static.mjs:26-33`), de onde o main as lê.
- **SQLite:** o histórico usa o módulo `node:sqlite` do próprio Node do Electron — Node 24.22.0 no Electron 44.9.0, com SQLite 3.53.4 ([ADR-09](DECISIONS.md#adr-09--sqlite-local-pelo-nodesqlite-embutido-para-o-histórico-de-ditados)). Não há pacote nem binário a instalar. Os testes do banco (TEST-015) rodam no Node do sistema, que traz o mesmo SQLite 3.53.4 no 24.20. Na documentação do Node 24 o módulo é "Stability: 1.2 — Release candidate": uma atualização do Electron pode mudar a API, e os testes do banco quebram nela (RISK-032).
- **`koffi` 3.3.3** e **`uiohook-napi` 1.5.5**, as duas únicas `dependencies`, trazem binários prontos para win32-x64 e darwin-arm64 (`koffi` pelos pacotes opcionais `@koromix/koffi-win32-x64` e `@koromix/koffi-darwin-arm64`, que o npm só instala no sistema certo; `uiohook-napi` em `prebuilds/<sistema>-<arquitetura>`). Os scripts de instalação dos dois — e o do `electron-winstaller`, que vem com o `electron-builder` e não é usado — ficam negados em `allowScripts` (`package.json`): o aviso do npm sobre eles é esperado, porque não há nada a compilar.
- **`electron-builder` 26.15.3**, em `devDependencies` ([ADR-10](DECISIONS.md#adr-10--empacotamento-com-electron-builder-sem-bundler-módulos-nativos-sem-recompilar)): gera o instalador e o app do macOS a partir do `dist/` ([Empacotar e publicar](#empacotar-e-publicar)). Na primeira execução baixa, para o cache do usuário (`%LOCALAPPDATA%\electron-builder\Cache`), o zip do Electron e o NSIS.
- Todas as versões são exatas, sem `^`, e `frontend/package-lock.json` é versionado. Atualizar Electron, `koffi` ou `uiohook-napi` só com teste manual do fluxo completo (RISK-004, [Security Guide §15.1](Security-Guide.md#151-dependências)).

## Empacotar e publicar

Spec [`distribuicao-windows-macos`](spec/features/distribuicao-windows-macos.md), [ADR-10](DECISIONS.md#adr-10--empacotamento-com-electron-builder-sem-bundler-módulos-nativos-sem-recompilar). Configuração em `frontend/electron-builder.yml`; recursos em `frontend/build/` (`icon.ico`, `icon.png`, `installer.nsh`, `entitlements.mac.plist`); saída em `frontend/release/` (fora do git).

| Comando (em `frontend/`) | O que faz |
| --- | --- |
| `npm run dist:win` | Apaga `dist/` e `release/`, compila e gera `release/Touch-Speaker-Setup-win-x64.exe` (NSIS, x64; nome fixo, sem versão — FR-PKG-16). Só no Windows. Primeiro build de 18/out/2026: 107,2 MB |
| `npm run dist:mac` | O mesmo para o macOS: `release/Touch-Speaker-mac-arm64.dmg` e `Touch-Speaker-mac-arm64.zip` (nome fixo), com assinatura ad-hoc. **Só roda num Mac** (o binário `koffi` do macOS só se instala lá; `codesign` e o `.dmg` são do macOS) — na prática, no GitHub Actions |
| `npm run verify:package` | Confere de novo cada `app.asar` em `release/` (o `dist:*` já confere no `afterPack`, antes de escrever o instalador) |
| `node scripts/make-icons.mjs` | Redesenha `build/icon.png` e `build/icon.ico` a partir da geometria do logo (provisório até a arte final da spec `design-system`) |

- **O pacote** leva só `package.json`, `dist/main`, `dist/preload`, `dist/shared`, `dist/renderer`, `dist/database` (as migrations do histórico) e as dependências de produção — sem `dist/test`, `*.map`, `.env*`, logs, fontes C dos módulos nativos nem binários de outro sistema. Os `.node` ficam fora do `app.asar` (`app.asar.unpacked`); nada é recompilado (`npmRebuild: false`).
- **Verificação** (`scripts/verify-package.mjs`, regras puras em `scripts/package-rules.mjs`, testadas no `npm test`): falha o build se o pacote tiver `.env`, log, `config.json`, banco (`.db`), `dist/test`, `.map`, `src/`, `scripts/`, `docs/`, devDependency, binário de outro sistema ou arquitetura, um `.node` dentro do `app.asar`, ou qualquer arquivo com o prefixo das chaves da Groq; e se faltar o ponto de entrada, as páginas, as migrations ou os binários de `koffi` e `uiohook-napi`. Escreve a lista de arquivos em `release/package-files-<sistema>-<arquitetura>.txt`, para comparar dois builds do mesmo commit.
- **Electron Fuses** gravados no executável: `RunAsNode`, `EnableNodeOptionsEnvironmentVariable` e `EnableNodeCliInspectArguments` desligados; `EnableEmbeddedAsarIntegrityValidation` e `OnlyLoadAppFromAsar` ligados. Conferir sem abrir o app: `npx @electron/fuses read --app "release/win-unpacked/Touch Speaker.exe"`.
- **Instalador do Windows:** assistido, só para o usuário atual (sem a página "para todos / só para mim" e sem UAC — o manifesto pede `asInvoker`), em `%LOCALAPPDATA%\Programs\Touch Speaker`; atalho no Menu Iniciar; página de opções com o atalho na área de trabalho (marcado) e "Iniciar o Touch Speaker com o Windows" (desmarcado), que grava `com.victoralves.touchspeaker` = `"<pasta>\Touch Speaker.exe"` em `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, o valor do `app.setLoginItemSettings`; última página com "abrir agora". Desinstalar apaga esse valor e mantém `%APPDATA%\Touch Speaker` e `%LOCALAPPDATA%\Touch Speaker`. **Sem assinatura** (D1): o SmartScreen avisa.
- **App do macOS:** `LSUIElement` (só barra de menus) e `NSMicrophoneUsageDescription` em pt-BR no `Info.plist`, macOS 13 no mínimo, só arm64, assinatura ad-hoc (`identity: "-"`), sem *hardened runtime* nem notarização (D2): o Gatekeeper bloqueia a primeira abertura de cada versão.
- **Release no GitHub:** `.github/workflows/release.yml`. Uma tag `v*` (igual à `version` do `package.json`) dispara o build no `windows-latest` e no `macos-14`, com `npm ci`, `npm run typecheck`, `npm test`, `dist:*` e `verify:package`, e publica `.exe`, `.dmg`, `.zip` e `SHA256SUMS.txt` num Release. Rodado à mão (Actions → Release → Run workflow), faz o mesmo sem publicar. Passo a passo para publicar: [`README.md`](../README.md#-como-publicar-uma-versão).
- **Variáveis de build:** nenhuma. Sem certificado (D1) nem Developer ID (D2), o workflow usa só o `GITHUB_TOKEN` da própria execução. Se um dia entrarem, `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_API_KEY`, `APPLE_API_KEY_ID` e `APPLE_API_ISSUER` vão para os segredos do GitHub, nunca para o repositório nem para o `.env`.

## Variáveis

O app lê **duas** variáveis de ambiente — uma do `.env`, outra do próprio Windows —, e o script de início remove uma terceira. A tabela traz só os nomes; nenhum valor de chave entra na documentação.

| Variável | Para que serve | Lida por | Observação |
| --- | --- | --- | --- |
| `GROQ_API_KEY` | Chave da Groq de **reserva de desenvolvimento** ([ADR-08](DECISIONS.md#adr-08--chave-da-groq-no-safestorage-do-electron-com-o-env-só-como-reserva-de-desenvolvimento)) | `src/main/index.ts:205` (`process.env`, passada ao `CredentialStore` como `envKey`), carregada de `<appPath>/.env` por `process.loadEnvFile` só com o app não empacotado (`index.ts:63-69`); o `CredentialStore` também a ignora com o app empacotado (`src/main/credentials.ts:61`) | Em desenvolvimento, `app.getAppPath()` é `frontend/`, então o arquivo é `frontend/.env`. Só vale quando não há `groq-key.bin`: a chave salva na janela vem primeiro, e um `groq-key.bin` ilegível deixa o app sem chave em vez de cair no `.env` (BR-016). Só o processo main a enxerga; nunca vai para o renderer nem para o log. Sem chave nenhuma o app abre, a pílula mostra "Falta a chave da Groq — abra o Touch Speaker pela bandeja" e o menu da bandeja diz "Touch Speaker — falta a chave da Groq" |
| `LOCALAPPDATA` | Pasta Local do usuário no Windows, onde fica o banco do histórico: `%LOCALAPPDATA%\Touch Speaker\touch-speaker.db` (spec [`historico`](spec/features/historico.md) §9, ADR-09) | `historyLocation` (`src/main/history/paths.ts`), chamada pelo `index.ts` com o `process.env` ao abrir o histórico | **Vem do Windows, não do `.env`**: é o Windows que a define, para cada usuário, e nada entra no `.env.example`. É lida porque o `app.getPath` do Electron 44 não tem nome para a pasta Local (o `appData` é a Roaming). Ausente, vazia ou com caminho relativo → histórico indisponível (`history_unavailable`, `name: no_localappdata`), **sem** cair na pasta Roaming; o app abre e dita igual |
| `ELECTRON_RUN_AS_NODE` | Nunca definir | Removida por `scripts/start.mjs:11-12` antes de abrir o Electron | O host de extensões do VS Code (e o que é lançado a partir dele) exporta `ELECTRON_RUN_AS_NODE=1`; com ela, o `electron.exe` roda como Node puro e sai na hora, sem erro. Por isso o app abre sempre por `npm run dev` ou `npm start`. O mesmo efeito serve de propósito para conferir o Node do Electron sem abrir o app: foi assim (`ELECTRON_RUN_AS_NODE=1 npx electron`, sem janela, sem app, sem hook) que o spike T1 da spec `historico` testou o `node:sqlite` (ADR-09) |

### Lidas pelo código e ausentes do `.env`

`LOCALAPPDATA`, que o Windows define e o app só lê ([Variáveis](#variáveis)). Não vai para o `.env` nem para o `.env.example`: `GROQ_API_KEY` continua a única variável do `.env.example`.

### Fuso e idioma

- **Idioma da interface:** pt-BR, fixo. Todos os textos ficam em `src/main/strings.ts`; a pílula e a janela principal declaram `lang="pt-BR"` (`src/renderer/pill.html`, `src/renderer/main-window/index.html:2`).
- **Idioma da transcrição:** o campo `language` do `config.json` (padrão `pt`), enviado ao Whisper a cada ditado ([`DATABASE.md`](DATABASE.md#configjson)). Não há variável de ambiente para ele.
- **Fuso:** os horários gravados ficam em UTC — o campo `t` do log (`new Date().toISOString()`, `src/main/logger.ts:33`) e o `created_at` de cada entrada do histórico, ISO-8601 com milissegundos. O que a pessoa vê é no **fuso do sistema**: os grupos "Hoje", "Ontem" e "1 de outubro" do Histórico, a hora "14:32" de cada entrada e o "hoje" do card "Seu uso" no Início saem do dia local, montados com `Intl` em pt-BR pelo `HistoryFormatter` (`src/main/history/format.ts`). Não há variável de ambiente nem campo de config para o fuso.

## O arquivo .env

- **Caminho:** `frontend/.env`, criado com `copy .env.example .env` dentro de `frontend/`. Conteúdo: uma linha, `GROQ_API_KEY=` seguida da chave.
- **Fora do git:** o `.gitignore` da raiz ignora `.env` e `.env.*`, com exceção de `!.env.example`. Só o `.env.example` é versionado, com o nome da variável, um comentário dizendo onde criar a chave e nenhum valor.
- **Lido uma vez**, ao abrir o app, e **só com o app não empacotado** (`if (!app.isPackaged)`, `src/main/index.ts:59-65`): o app instalado nunca lê o `.env`. Mudou a chave no `.env`, reabra o app. Já a chave salva pela janela vale a partir do próximo ditado, sem reiniciar.
- **Precedência:** `groq-key.bin` decifrado → senão, só sem empacotar, o `GROQ_API_KEY` do `.env` → senão, nenhuma (ADR-08, BR-016; `src/main/credentials.ts:68-83`). Quem já desenvolve com o `.env` segue igual até salvar uma chave pela tela (D1 da spec); a partir daí vale a salva, e "Remover chave" volta ao `.env`. O Início mostra de onde vem a chave em uso: "Salva no app", "Vinda do .env de desenvolvimento", "Falta a chave da Groq" ou "A chave salva não pôde ser lida — salve de novo".
- **Nunca** faça commit do `.env`, nem cole a chave em issue, print ou log.
- **Chave vazou?** Revogue no console da Groq (console.groq.com → API Keys) na hora e gere outra ([Security Guide §10](Security-Guide.md#10-segredos-e-configuração)). Se ela estava salva no app, remova-a em Configurações ("Remover chave") e salve a nova.
- **Rollback da spec `janela-principal`:** voltar à versão anterior deixa o `groq-key.bin` órfão em `%APPDATA%\Touch Speaker\`; a versão anterior o ignora e volta a ler o `.env`. Pode ser apagado à mão, com o app fechado: `Remove-Item "$env:APPDATA\Touch Speaker\groq-key.bin"`.

## Testar a janela principal à mão

Para o roteiro VJ1–VJ24 da spec [`janela-principal`](spec/features/janela-principal.md#14-critérios-de-aceite), com o app aberto por `npm run dev`:

- **DevTools da janela:** **F12** com a janela principal em foco abre e fecha o DevTools dela. Só em desenvolvimento (`devTools: !app.isPackaged`); só essa tecla é olhada, e nada vai para o log (`src/main/main-window.ts:116-122`). No console, a ponte é `window.touchSpeakerApp` — por exemplo, `window.touchSpeakerApp.setGroqKey(42)` é recusado pelo main (`ipc_rejected`) e `window.touchSpeakerApp.saveSettings({...})` testa a validação dos campos.
- **"Reiniciar agora"** (faixa de reinício pendente em Configurações): o app reaberto por `app.relaunch()` não fica preso ao terminal do `npm run dev`, porque o `scripts/start.mjs` termina junto com o processo antigo.
- **"Iniciar com o Windows"** fica **desabilitado** em `npm run dev`, com o aviso "Disponível no app instalado", e o canal `login-item:set` responde `unavailable` sem tocar no registro: o item de login apontaria para o `electron.exe` sem o app (RISK-029). Ligar e desligar de verdade só no app empacotado da spec [`distribuicao-windows-macos`](spec/features/distribuicao-windows-macos.md) (VJ22).
- **Hook de teclado indisponível (VJ19):** com o app fechado, renomeie `frontend/node_modules/uiohook-napi/prebuilds/win32-x64/uiohook-napi.node` (por exemplo, para `uiohook-napi.node.bak`), abra o app e veja o Início ("A tecla de ditado não está funcionando — reinicie o app"); feche o app e desfaça o nome. Funciona porque o módulo nativo só é carregado dentro de `startKeyboardHook` (`src/main/keyboard.ts:11-13`): binário ausente cai no `try` do `index.ts` (`keyboard_hook_unavailable`, `src/main/index.ts:264-270`) e o app abre sem a tecla.
- **Primeira execução de novo (VJ20):** com o app fechado, renomeie o `config.json` (e o `groq-key.bin`, se houver) em `%APPDATA%\Touch Speaker\` e abra o app. O histórico fica em outra pasta e não é afetado; a retenção volta ao padrão de 30 dias, e a abertura purga o que for mais antigo que isso.
- **Histórico e tema pelo console:** no DevTools da janela, `window.touchSpeakerApp.history` traz `list`, `copy`, `delete`, `clear`, `getRetention`, `setRetention`, `stats` e `onChanged`, e `window.touchSpeakerApp.setTheme` troca o tema. O main confere cada payload: `window.touchSpeakerApp.history.clear(false)` e `window.touchSpeakerApp.setTheme('auto')` são recusados (`ipc_rejected`) sem tocar no banco nem no `config.json`.
- **Começar o histórico do zero:** com o app fechado, apague os três arquivos do banco ([Caminhos e arquivos](#caminhos-e-arquivos)); a próxima abertura cria um banco vazio.

## Log

`%APPDATA%\Touch Speaker\logs\main.log`, uma linha JSON por evento (`t`, `level`, `event` e campos primitivos), com rotação a 5 MB × 3 arquivos (`main.log` → `main.1.log` → `main.2.log`). Formato completo em [`DATABASE.md`](DATABASE.md#log). É o primeiro lugar a olhar quando algo não funciona: o `app_ready` diz se o hook de teclado carregou e de onde vem a chave (`groq_key`), e o `history_ready` ou o `history_unavailable`, logo antes, diz se o histórico abriu.

```powershell
explorer "$env:APPDATA\Touch Speaker\logs"
```

| Evento | Nível | Quando | Campos |
| --- | --- | --- | --- |
| `app_ready` | info | o app terminou de abrir | `version`, `electron`, `platform` (`win32` ou `darwin`), `arch`, `packaged` (`true` no app instalado), `hotkey`, `has_api_key`, `groq_key` (`stored`, `env`, `none` ou `unreadable`), `keyboard_hook`, `self_elevated` e, só no macOS, `accessibility` (booleano) (`src/main/index.ts:525-539`) |
| `accessibility_missing` | warn | macOS: o app não é cliente confiável de Acessibilidade — na abertura o hook não inicia; na colagem o texto fica no clipboard | `at` (`startup` ou `paste`) (`index.ts:311`, `:265`) |
| `hook_retry` | info | "Tentar de novo" no menu, ou o app voltou a ficar ativo no macOS, com o hook parado | `ok`, `trigger` (`retry` ou `activate`) (`index.ts:322`) |
| `secure_input_active` | info | macOS: a entrada segura do sistema estava ligada na hora de colar; o texto ficou no clipboard | — (`index.ts:264`) |
| `paste_driver_unavailable` | error | macOS: o driver de colagem não carregou (no Windows o mesmo caso é o `win32_unavailable`) | `name` (`index.ts:191`) |
| `config_invalid_field` | warn | campo do `config.json` inválido, trocado pelo default | `field` — o nome do campo, `history` e `theme` inclusive, ou `json`/`root` (`index.ts:125`) |
| `groq_key_unreadable` | warn | o `groq-key.bin` existe mas não decifrou na abertura (ou a cifra estava indisponível, ou o conteúdo não é uma chave): o app abre sem chave em uso | `reason` (código do erro, `encryption_unavailable` ou `invalid_content`) (`index.ts:209`) |
| `session_rejected` | warn | tecla de ditado pressionada sem chave | `code` (`no_api_key`) (`src/main/session.ts:95`) |
| `session_start` | info | a gravação começou | `session` (`session.ts:126`) |
| `recorder_started` | info | o microfone abriu | `session`, `latency_ms` (`session.ts:165`) |
| `session_stop` | info | fim da fala | `session`, `mode`, `recorded_ms` (`session.ts:144-148`) |
| `session_timeout` | info | a gravação chegou a `maxRecordingMs` | `session` (`session.ts:122`) |
| `session_cancel` | info | `Esc`, atalho detectado ou saída do app | `session`, `reason` (`escape` ou `shortcut`) (`session.ts:158`) |
| `session_empty` | info | gravação curta ou sem fala, descartada | `session`, `code` (`no_speech`) (`session.ts:264`) |
| `transcribe_failed` | warn | a transcrição devolveu erro | `session`, `code`, `transcribe_ms` (`session.ts:199`) |
| `session_error` | warn | a sessão terminou com erro | `session`, `code` (`session.ts:270`) |
| `session_exception` | error | exceção inesperada durante o ditado | `session`, `name` (`session.ts:233`) |
| `dictation_done` | info | texto inserido ou deixado no clipboard | `session`, `mode`, `audio_ms`, `audio_bytes`, `transcribe_ms`, `total_ms`, `chars`, `outcome` (`session.ts:218-227`) |
| `history_ready` | info | o banco do histórico abriu, migrou e purgou, na abertura | `schema_version`, `entries`, `purged`, `open_ms` (`openHistory`, `src/main/history/service.ts`) |
| `history_unavailable` | warn | o histórico não abriu; o app abre e dita igual (FR-HIST-16) | `name`: `no_localappdata`, `unsupported_platform`, `schema_too_new`, `migrations_missing`, `migration_duplicated`, `SQLITE_<código>` para erro do SQLite (`SQLITE_26` = o arquivo não é um banco) ou o código errno (`ENOENT`, `EPERM`…) (`openHistory`, `historyErrorName`) |
| `history_saved` | info | um ditado foi gravado no histórico, depois do `dictation_done` | `session`, `write_ms` (`HistoryService.save`) |
| `history_purged` | info | a gravação de um ditado também apagou entradas vencidas | `count` (`HistoryService.save`) |
| `history_purge_failed` | warn | a purga da abertura ou da mudança de retenção falhou; o app segue | `name` |
| `history_write_failed` | warn | gravar um ditado, apagar uma entrada ou "Apagar tudo" falhou; o ditado não muda | `session` (`null` ao apagar), `name` |
| `history_read_failed` | warn | a lista, o "Copiar" ou o resumo do Início não conseguiu ler o banco | `name` |
| `history_copied` | info | "Copiar" de uma entrada: o main pôs o texto no clipboard | — |
| `history_deleted` | info | uma entrada foi apagada | — |
| `history_cleared` | info | "Apagar tudo" | `count` |
| `history_retention_changed` | info | "Guardar histórico" mudou e o `config.json` foi gravado | `retention_days` (número ou `null`), `purged` (`HistoryService.setRetention`) |
| `config_write_failed` | error | a retenção nova não pôde ser gravada no `config.json`; a de antes continua em uso | `name` (código errno, ou `invalid_json`) (`HistoryService.setRetention`) |
| `theme_changed` | info | o tema mudou e o `config.json` foi gravado | `theme` (`system`, `light` ou `dark`) (`ThemeSetting.set`, `src/main/theme-setting.ts`) |
| `theme_write_failed` | error | o tema não pôde ser gravado no `config.json`; o de antes continua em uso | `name` (`ThemeSetting.set`) |
| `ipc_rejected` | warn | `recorder:result` inválido vindo da pílula (`index.ts:293`), ou mensagem recusada num canal da janela principal (`app:*`, `settings:*`, `groq-key:*`, `login-item:set`, `history:*`, `theme:set`) — remetente que não é a janela aberta ou payload fora do contrato (`index.ts:353-356`, `:470-473`) | `channel` |
| `pill_console` | warn | erro ou aviso no console da pílula | `level`, `message` (até 300 caracteres), `line` (`index.ts:148-152`) |
| `pill_renderer_gone` | error | o processo da pílula caiu | `reason` (`index.ts:153`) |
| `win32_unavailable` | error | `koffi` não carregou as funções do Windows; todo ditado termina no clipboard | `name` (`index.ts:191`) |
| `keyboard_hook_unavailable` | error | o hook de teclado não carregou; a bandeja mostra "Touch Speaker — teclado indisponível" com "Tentar de novo" (FR-PKG-15) | `name` (`index.ts:317`) |
| `main_window_opened` | info | a janela principal foi pedida (criada ou trazida para a frente) | `trigger`: `tray_menu`, `tray_double_click`, `second_instance` ou `first_run` (`src/main/main-window.ts:61`) |
| `main_window_ready` | info | a janela criada ficou pronta e apareceu | `ready_ms` (`main-window.ts:108`) |
| `main_window_closed` | info | a janela principal foi fechada (o app segue na bandeja) | — (`main-window.ts:130`) |
| `main_window_renderer_gone` | error | o processo da janela caiu; a janela é destruída | `reason` (`main-window.ts:124`) |
| `main_window_console` | warn | erro ou aviso no console da janela principal | `level`, `line` — **sem** a mensagem, porque a janela manipula a chave (`main-window.ts:113`) |
| `main_window_load_failed` | error | o `index.html` da janela não carregou | `name` (`main-window.ts:135`) |
| `second_instance_focus` | info | alguém abriu o app de novo com ele já aberto: a segunda instância sai e a primeira mostra a janela | — (`index.ts:513`) |
| `groq_key_saved` | info | chave salva em Configurações | — (`index.ts:405`) |
| `groq_key_removed` | info | chave removida em Configurações | `state` (`env` ou `none`) (`index.ts:417`) |
| `groq_key_rejected` | warn | salvar ou remover a chave falhou | `reason` (`invalid_format`, `encryption_unavailable` ou `write_failed`); `name` (código do erro ou `null`), menos no `invalid_format` (`index.ts:397`, `:402`, `:414`) |
| `settings_saved` | info | preferências gravadas no `config.json` | `fields` (nomes dos campos alterados, separados por vírgula) (`index.ts:387`) |
| `settings_rejected` | warn | "Salvar preferências" com um campo fora do permitido; nada gravado | `field` (`index.ts:388`) |
| `settings_write_failed` | error | o `config.json` não pôde ser gravado | `name` (código errno, ou `invalid_json` quando o arquivo não é objeto JSON) (`index.ts:389`) |
| `login_item_changed` | info | "Iniciar com o Windows" mudou e o sistema confirmou | `enabled` (`index.ts:426`) |
| `login_item_failed` | error | o item de login não pôde ser gravado ou não ficou como pedido | `name` (`index.ts:427`) |
| `app_relaunch` | info | "Reiniciar agora", ou "Reabrir o Touch Speaker" no menu do macOS: o app fecha e abre de novo | — (`index.ts:475`, `:497`) |

`session` é só o começo do `sessionId` (8 caracteres); erros entram pelo `name` da exceção ou pelo código errno, nunca pela mensagem. **Nunca entram no log:** texto transcrito (que vai só para o banco do histórico), áudio, conteúdo do clipboard, teclas, título de janela, a chave, o valor de um campo das preferências (o `settings_saved` leva só os nomes), o termo de busca do histórico nem as mensagens do console da janela principal ([Security Guide §12](Security-Guide.md#12-logs-e-observabilidade)). A retenção e o tema entram com o valor escolhido (`history_retention_changed`, `theme_changed`). O evento `second_instance_ignored` deixou de existir em 18/out/2026: virou `second_instance_focus`.

## Caminhos e arquivos

| Caminho | O que é | Quem cria |
| --- | --- | --- |
| `%APPDATA%\Touch Speaker\` | Pasta de dados do app: o main fixa o `userData` do Electron nela (`src/main/index.ts:56`). O menu da bandeja abre essa pasta ("Abrir pasta de configuração") | o app, na primeira execução |
| `%APPDATA%\Touch Speaker\config.json` | Configuração do usuário, com a retenção do histórico e o tema ([`DATABASE.md`](DATABASE.md#configjson)) | o app, com os defaults, quando não existe; regravado pela fila única, sempre via `config.json.tmp`: os sete campos de "Salvar preferências", só `history.retentionDays` em "Guardar histórico" e só `theme` ao trocar o tema |
| `%APPDATA%\Touch Speaker\groq-key.bin` | Chave da Groq cifrada pelo `safeStorage` ([`DATABASE.md`](DATABASE.md#groq-keybin)) | o app, em "Salvar chave" (via `groq-key.bin.tmp`); apagado por "Remover chave" |
| `%APPDATA%\Touch Speaker\logs\` | `main.log`, `main.1.log`, `main.2.log` | o `Logger` |
| `%LOCALAPPDATA%\Touch Speaker\` | Pasta **Local** do histórico, que não acompanha perfil móvel do Windows; vem da variável `LOCALAPPDATA` ([Variáveis](#variáveis)) | o app, ao abrir o histórico pela primeira vez |
| `%LOCALAPPDATA%\Touch Speaker\touch-speaker.db` (+ `touch-speaker.db-wal`, `touch-speaker.db-shm`) | O banco SQLite do histórico, com o **texto ditado** — sem criptografia além da conta do Windows (RISK-030) ([`DATABASE.md`](DATABASE.md#touch-speakerdb)) | o app, na primeira abertura, com a migration `0001` |
| `~/Library/Application Support/Touch Speaker/` | **macOS:** a mesma pasta de dados (`app.getPath('appData')` + `Touch Speaker`), com `config.json`, `groq-key.bin`, `logs/` e também o banco do histórico, `touch-speaker.db` (`historyLocation`) — no Mac não há pasta Local separada | o app, na primeira execução |
| `%LOCALAPPDATA%\Programs\Touch Speaker\` | O app instalado pelo instalador do Windows (por usuário) | o instalador; o desinstalador apaga |
| `frontend/.env` | Chave da Groq em desenvolvimento ([O arquivo .env](#o-arquivo-env)) | você, a partir do `.env.example` |
| `frontend/release/` | Saída do `electron-builder`: instalador, `win-unpacked/` (ou `mac-arm64/`), a lista `package-files-*.txt`; fora do git | `npm run dist:win` / `dist:mac` |
| `frontend/dist/` | Saída do build: `tsc` + `scripts/copy-static.mjs`; fora do git. Inclui `dist/database/local/`, a cópia das migrations de `database/local/` que o main aplica | `npm run build` (e `npm run dev`, `npm test`) |
| `frontend/node_modules/` | Dependências, com o binário do Electron; fora do git | `npm install` |

**Apagar o histórico à mão:** com o app **fechado** (pelo menu da bandeja, "Sair"), apague os três arquivos — `touch-speaker.db`, `touch-speaker.db-wal` e `touch-speaker.db-shm` — de `%LOCALAPPDATA%\Touch Speaker\`. Com o app aberto o banco está em uso, e o `-wal` também pode guardar texto ditado. A próxima abertura cria um banco vazio. Sem fechar o app, o mesmo efeito vem de "Apagar tudo" (tela Histórico) ou de "Nunca guardar" (Configurações).

```powershell
explorer "$env:LOCALAPPDATA\Touch Speaker"
Remove-Item "$env:LOCALAPPDATA\Touch Speaker\touch-speaker.db*"   # com o app fechado
```

## Problemas comuns

| Sintoma | Causa e solução |
| --- | --- |
| O app abre e fecha na hora, sem erro | Variável `ELECTRON_RUN_AS_NODE` herdada do VS Code. Abra sempre por `npm run dev` ou `npm start`, que a removem |
| Pílula "Falta a chave da Groq — abra o Touch Speaker pela bandeja" | Não há chave salva no app nem `GROQ_API_KEY` no `.env` (ou o app está empacotado, e aí o `.env` nem é lido). Abra a janela pela bandeja ("Abrir Touch Speaker" ou duplo clique no ícone) e salve a chave em Configurações; em desenvolvimento, também serve criar o `.env` a partir do `.env.example` ([O arquivo .env](#o-arquivo-env)) |
| Início ou Configurações: "A chave salva não pôde ser lida — salve de novo" | O `groq-key.bin` existe mas não decifra: troca de máquina ou de perfil do Windows, ou a pasta de dados do Chromium foi apagada (RISK-022). O `main.log` tem `groq_key_unreadable`. Salve a chave de novo em Configurações; até lá o app fica sem chave, mesmo com `.env` |
| A janela principal abriu sozinha ao abrir o app | O `config.json` não existia nesta abertura (primeira execução, ou você o apagou para voltar aos padrões) e não há chave salva no app (RISK-028). É esperado e acontece uma vez; com chave salva, nada abre |
| "Iniciar com o Windows" desabilitado, com "Disponível no app instalado" | Esperado em `npm run dev`: o item de login só é gravado pelo app empacotado ([Testar a janela principal à mão](#testar-a-janela-principal-à-mão)) |
| Pílula "Texto copiado — cole com Ctrl+V" | O app em foco roda como administrador e o Windows bloqueia a colagem simulada; o texto ficou no clipboard |
| Dois apps reagem ao atalho | Feche o Typeless ou outro app de ditado com atalho parecido |
| Nada acontece ao segurar a tecla | Abra o Início da janela principal: "A tecla de ditado não está funcionando — reinicie o app" quer dizer que o hook não carregou. No `main.log`, `keyboard_hook` deve estar `true` no `app_ready` |
| Histórico ou Início: "Histórico indisponível — o ditado continua funcionando" | O banco não abriu; o `main.log` tem `history_unavailable` com o `name`. **`no_localappdata`:** o app foi aberto num ambiente sem a variável `LOCALAPPDATA` (ou com caminho relativo) — abra-o de uma sessão normal do Windows. **`SQLITE_26`:** o arquivo está corrompido ou não é um banco; o app não o repara nem o apaga (RISK-035) — com o app fechado, apague os três arquivos ([Apagar o histórico à mão](#caminhos-e-arquivos)) e perca o histórico, ou guarde-os antes. Outro **`SQLITE_<código>`** é o código de resultado do SQLite, como veio. **`schema_too_new`:** o banco foi criado por uma versão mais nova do app; o arquivo fica intacto — volte à versão mais nova ou, perdendo o histórico, apague os três arquivos. **`ENOENT` ou `migrations_missing`:** `dist/database/local/` ausente ou sem `.sql` — rode `npm run dev` ou `npm run build`, que copiam as migrations. **`EPERM`, `EACCES`…:** sem permissão na pasta |
| Histórico: "1 ditado não foi guardado no histórico desde que o app abriu" (ou "N ditados…") | Gravar no banco falhou (`history_write_failed` no `main.log`, com o `name`); o ditado em si não mudou. A contagem vive só na memória e zera ao reabrir o app |
| "Não foi possível salvar o tema", e o tema volta ao anterior | O `config.json` não pôde ser gravado (`theme_write_failed` no `main.log`): arquivo somente leitura, pasta sem permissão ou um `config.json` que não é objeto JSON — que o app nunca sobrescreve. Corrija ou apague o arquivo com o app fechado. Em "Guardar histórico", o mesmo caso aparece como "Não foi possível salvar — o config.json não pôde ser lido ou gravado" (`config_write_failed`) |
| Windows: "O Windows protegeu o computador" ao abrir o instalador | Esperado: o instalador não é assinado (D1). **Mais informações → Executar assim mesmo**. Se não houver "Executar assim mesmo", o Controle Inteligente de Aplicativos (Smart App Control) está ligado e bloqueia app sem assinatura (RISK-novo-1, aceito) |
| Bandeja: "Touch Speaker — teclado indisponível" | O hook de teclado não iniciou (`keyboard_hook_unavailable` no `main.log`). **Tentar de novo** no menu; se continuar, feche outro app de ditado que segure o teclado e reabra o Touch Speaker |
| macOS: "não é possível abrir porque a Apple não pode verificar…" | Esperado: assinatura ad-hoc, sem notarização (D2). macOS 13–14: botão direito no app em Aplicativos → **Abrir**. macOS 15+: Ajustes do Sistema → Privacidade e Segurança → **Abrir Mesmo Assim**. Vale de novo a cada versão |
| macOS: barra de menus "Touch Speaker — falta permissão de Acessibilidade" | Ajustes do Sistema → Privacidade e Segurança → **Acessibilidade** → ligue o Touch Speaker (no menu: **Abrir Ajustes de Acessibilidade…**) e depois **Tentar de novo**; se continuar, **Reabrir o Touch Speaker**. Depois de instalar uma versão nova, a permissão pode aparecer ligada e não valer: remova o Touch Speaker da lista (−), adicione de novo e tente de novo (RISK-novo-2) |
| macOS: "Texto copiado — cole com ⌘V" num campo de senha ou no Terminal | A entrada segura do macOS está ligada (`secure_input_active` no `main.log`): o sistema esconde as teclas de outros apps, a tecla de ditado pode não responder e a colagem simulada não vai. Cole com ⌘V |
| macOS: "Sem permissão para usar o microfone…" | O microfone foi negado: Ajustes do Sistema → Privacidade e Segurança → **Microfone** → ligue o Touch Speaker (no menu: **Abrir Ajustes de Microfone…**) |
| A bandeja não muda de cor com o tema do app | Esperado: o ícone da bandeja segue o modo do Windows (barra de tarefas), não o tema escolhido na janela (FR-UI-39) |

**Encerrar o app aberto por um agente de IA** (fechar a janela principal não encerra o app: ele segue na bandeja): `Stop-Process` nos `electron.exe` cujo caminho contém `touch-speaker`.

```powershell
Get-Process electron -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*touch-speaker*' } | Stop-Process
```

Uma pessoa encerra pelo menu da bandeja, em "Sair".

---

Decisões: [`DECISIONS.md`](DECISIONS.md) · Segurança: [`Security-Guide.md`](Security-Guide.md) · Dados: [`DATABASE.md`](DATABASE.md)
