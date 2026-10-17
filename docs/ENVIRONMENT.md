# ENVIRONMENT — Touch Speaker

> Última atualização: 17/out/2026 · Mantenedor: Victor Alves

Como montar o ambiente local e o que cada variável de ambiente faz de fato. Os caminhos e as linhas citados são de `frontend/` no commit `ed0a1f5`, a Fase 1 implementada (T1–T8).

O Touch Speaker roda só no **Windows 10 ou 11, 64 bits** (NFR-06). O único serviço externo é a Groq, que faz a transcrição com a chave do próprio usuário; não há banco, porta, fila nem servidor para subir. Todos os comandos rodam **de dentro de `frontend/`**, e o app abre sempre por `npm run dev` ou `npm start`, que passam por `scripts/start.mjs` (ver [`ELECTRON_RUN_AS_NODE`](#variáveis)).

**Windows (PowerShell)**

```powershell
git clone https://github.com/Victorkaue333/touch-speaker.git
cd touch-speaker\frontend
npm install                 # avisa que os scripts de koffi e uiohook-napi não rodaram: é esperado
copy .env.example .env      # depois cole a sua chave da Groq depois de GROQ_API_KEY= no .env
npm run dev                 # compila e abre o app na bandeja

npm start                   # abre sem recompilar
npm test                    # compila e roda os testes (node:test)
npm run typecheck           # checagem de tipos dos dois tsconfig, sem gerar arquivos
npm run build               # só compila, para dist/
```

Na primeira vez, o `npm install` baixa o binário do Electron. Com o app aberto, o ícone de microfone aparece na bandeja (talvez escondido na setinha `^`); o primeiro ditado é segurar o Ctrl direito no Bloco de Notas, falar e soltar.

**Linux e macOS**

Fora do escopo até a Fase 4 (NFR-06): o app depende de Win32 (`SendInput`, elevação de processo) e não roda em outro sistema.

| Serviço | Porta local | Onde está definido |
| --- | --- | --- |
| Nenhum | — | O app não escuta porta nenhuma; a única saída de rede é `https://api.groq.com`, a partir do processo main (`src/main/transcribe/groq.ts:6`) |

## Node.js e Electron

- **Node.js 24 LTS** (conferido com 24.20.0) e o **npm** que vem com ele (conferido com 11.21). O Node do sistema serve para `npm install`, para o `tsc` e para os testes (`node --test`); o app em si roda dentro do Electron.
- **Electron 44.9.0**, versão exata em `devDependencies` (`package.json`). O `npm install` baixa o binário (~100 MB) e o confere pelo `checksums.json` do próprio pacote.
- **TypeScript 7.0.2** e **`@types/node` 24.19.2**, também em `devDependencies`. Não há bundler: o `tsc` compila main, preload, shared e testes para `dist/` em CommonJS (`tsconfig.main.json`) e o renderer para `dist/renderer/` (`tsconfig.renderer.json`); `scripts/copy-static.mjs` copia `pill.html` e `pill.css` para lá.
- **`koffi` 3.3.3** e **`uiohook-napi` 1.5.5**, as duas únicas `dependencies`, trazem binários prontos para win32-x64 (`koffi` pelo pacote opcional `@koromix/koffi-win32-x64`; `uiohook-napi` em `prebuilds/win32-x64`). Os scripts de instalação dos dois ficam negados em `allowScripts` (`package.json`): o aviso do npm sobre eles é esperado, porque não há nada a compilar.
- Todas as versões são exatas, sem `^`, e `frontend/package-lock.json` é versionado. Atualizar Electron, `koffi` ou `uiohook-napi` só com teste manual do fluxo completo (RISK-004, [Security Guide §15.1](Security-Guide.md#151-dependências)).

## Variáveis

O app lê **uma** variável de ambiente, e o script de início remove outra. A tabela traz só os nomes; nenhum valor de chave entra na documentação.

| Variável | Para que serve | Lida por | Observação |
| --- | --- | --- | --- |
| `GROQ_API_KEY` | Chave da Groq usada na transcrição | `src/main/index.ts:125` (`process.env`), carregada de `<appPath>/.env` por `process.loadEnvFile` (`index.ts:34-38`) | Em desenvolvimento, `app.getAppPath()` é `frontend/`, então o arquivo é `frontend/.env`. Só o processo main a enxerga; nunca vai para o renderer nem para o log. Sem ela o app abre, a pílula mostra `no_api_key` e o menu da bandeja diz "Touch Speaker — falta a chave da Groq" |
| `ELECTRON_RUN_AS_NODE` | Nunca definir | Removida por `scripts/start.mjs:11-12` antes de abrir o Electron | O host de extensões do VS Code (e o que é lançado a partir dele) exporta `ELECTRON_RUN_AS_NODE=1`; com ela, o `electron.exe` roda como Node puro e sai na hora, sem erro. Por isso o app abre sempre por `npm run dev` ou `npm start` |

### Lidas pelo código e ausentes do `.env`

Nenhuma. `GROQ_API_KEY` é a única variável que o código do app lê, e ela é a única variável do `.env.example`.

### Fuso e idioma

- **Idioma da interface:** pt-BR, fixo. Todos os textos ficam em `src/main/strings.ts`; a pílula declara `lang="pt-BR"` (`src/renderer/pill.html`).
- **Idioma da transcrição:** o campo `language` do `config.json` (padrão `pt`), enviado ao Whisper a cada ditado ([`DATABASE.md`](DATABASE.md#configjson)). Não há variável de ambiente para ele.
- **Fuso:** o app não trabalha com data nem fuso. O único horário gravado é o campo `t` do log, em UTC (`new Date().toISOString()`, `src/main/logger.ts:33`).

## O arquivo .env

- **Caminho:** `frontend/.env`, criado com `copy .env.example .env` dentro de `frontend/`. Conteúdo: uma linha, `GROQ_API_KEY=` seguida da chave.
- **Fora do git:** o `.gitignore` da raiz ignora `.env` e `.env.*`, com exceção de `!.env.example`. Só o `.env.example` é versionado, com o nome da variável, um comentário dizendo onde criar a chave e nenhum valor.
- **Lido uma vez**, ao abrir o app (`src/main/index.ts:34-38`). Mudou a chave, reabra o app.
- **Nunca** faça commit do `.env`, nem cole a chave em issue, print ou log.
- **Chave vazou?** Revogue no console da Groq (console.groq.com → API Keys) na hora e gere outra ([Security Guide §10](Security-Guide.md#10-segredos-e-configuração)).
- **Fase 2 — PLANEJADO:** a chave passa para o `safeStorage` do Electron (DPAPI do Windows), digitada na tela de configurações, e o `.env` deixa de ser lido no app empacotado.

## Log

`%APPDATA%\Touch Speaker\logs\main.log`, uma linha JSON por evento (`t`, `level`, `event` e campos primitivos), com rotação a 5 MB × 3 arquivos (`main.log` → `main.1.log` → `main.2.log`). Formato completo em [`DATABASE.md`](DATABASE.md#log). É o primeiro lugar a olhar quando algo não funciona: o `app_ready` diz se o hook de teclado e a chave foram carregados.

```powershell
explorer "$env:APPDATA\Touch Speaker\logs"
```

| Evento | Nível | Quando | Campos |
| --- | --- | --- | --- |
| `app_ready` | info | o app terminou de abrir | `version`, `electron`, `hotkey`, `has_api_key`, `keyboard_hook`, `self_elevated` (`src/main/index.ts:198-205`) |
| `config_invalid_field` | warn | campo do `config.json` inválido, trocado pelo default | `field` (`index.ts:88`) |
| `session_rejected` | warn | tecla de ditado pressionada sem chave | `code` (`no_api_key`) (`src/main/session.ts:87`) |
| `session_start` | info | a gravação começou | `session` (`session.ts:118`) |
| `recorder_started` | info | o microfone abriu | `session`, `latency_ms` (`session.ts:157`) |
| `session_stop` | info | fim da fala | `session`, `mode`, `recorded_ms` (`session.ts:136-140`) |
| `session_timeout` | info | a gravação chegou a `maxRecordingMs` | `session` (`session.ts:114`) |
| `session_cancel` | info | `Esc`, atalho detectado ou saída do app | `session`, `reason` (`escape` ou `shortcut`) (`session.ts:150`) |
| `session_empty` | info | gravação curta ou sem fala, descartada | `session`, `code` (`no_speech`) (`session.ts:235`) |
| `transcribe_failed` | warn | a transcrição devolveu erro | `session`, `code`, `transcribe_ms` (`session.ts:186`) |
| `session_error` | warn | a sessão terminou com erro | `session`, `code` (`session.ts:241`) |
| `session_exception` | error | exceção inesperada durante o ditado | `session`, `name` (`session.ts:217`) |
| `dictation_done` | info | texto inserido ou deixado no clipboard | `session`, `mode`, `audio_ms`, `audio_bytes`, `transcribe_ms`, `total_ms`, `chars`, `outcome` (`session.ts:204-213`) |
| `ipc_rejected` | warn | `recorder:result` inválido vindo da pílula | `channel` (`index.ts:158`) |
| `pill_console` | warn | erro ou aviso no console da pílula | `level`, `message` (até 300 caracteres), `line` (`index.ts:99-103`) |
| `pill_renderer_gone` | error | o processo da pílula caiu | `reason` (`index.ts:104`) |
| `win32_unavailable` | error | `koffi` não carregou as funções do Windows | `name` (`index.ts:122`) |
| `keyboard_hook_unavailable` | error | o hook de teclado não carregou | `name` (`index.ts:169`) |
| `second_instance_ignored` | info | alguém abriu o app de novo com ele já aberto | — (`index.ts:189`) |

`session` é só o começo do `sessionId` (8 caracteres); erros entram pelo `name` da exceção, nunca pela mensagem. **Nunca entram no log:** texto transcrito, áudio, conteúdo do clipboard, teclas, título de janela, a chave ([Security Guide §12](Security-Guide.md#12-logs-e-observabilidade)).

## Caminhos e arquivos

| Caminho | O que é | Quem cria |
| --- | --- | --- |
| `%APPDATA%\Touch Speaker\` | Pasta de dados do app: o main fixa o `userData` do Electron nela (`src/main/index.ts:28`). O menu da bandeja abre essa pasta ("Abrir pasta de configuração") | o app, na primeira execução |
| `%APPDATA%\Touch Speaker\config.json` | Configuração do usuário ([`DATABASE.md`](DATABASE.md#configjson)) | o app, com os defaults, quando não existe |
| `%APPDATA%\Touch Speaker\logs\` | `main.log`, `main.1.log`, `main.2.log` | o `Logger` |
| `frontend/.env` | Chave da Groq em desenvolvimento ([O arquivo .env](#o-arquivo-env)) | você, a partir do `.env.example` |
| `frontend/dist/` | Saída do build: `tsc` + `scripts/copy-static.mjs`; fora do git | `npm run build` (e `npm run dev`, `npm test`) |
| `frontend/node_modules/` | Dependências, com o binário do Electron; fora do git | `npm install` |

## Problemas comuns

| Sintoma | Causa e solução |
| --- | --- |
| O app abre e fecha na hora, sem erro | Variável `ELECTRON_RUN_AS_NODE` herdada do VS Code. Abra sempre por `npm run dev` ou `npm start`, que a removem |
| Pílula "Falta a chave da Groq — veja o README" | `frontend/.env` ausente ou vazio — crie a partir do `.env.example` ([O arquivo .env](#o-arquivo-env)) |
| Pílula "Texto copiado — cole com Ctrl+V" | O app em foco roda como administrador e o Windows bloqueia a colagem simulada; o texto ficou no clipboard |
| Dois apps reagem ao atalho | Feche o Typeless ou outro app de ditado com atalho parecido |
| Nada acontece ao segurar a tecla | Veja o `main.log`: `keyboard_hook` deve estar `true` no `app_ready` |

**Encerrar o app aberto por um agente de IA** (ele não tem janela para fechar): `Stop-Process` nos `electron.exe` cujo caminho contém `touch-speaker`.

```powershell
Get-Process electron -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*touch-speaker*' } | Stop-Process
```

Uma pessoa encerra pelo menu da bandeja, em "Sair".

---

Decisões: [`DECISIONS.md`](DECISIONS.md) · Segurança: [`Security-Guide.md`](Security-Guide.md) · Dados: [`DATABASE.md`](DATABASE.md)
