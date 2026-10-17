# Security Guide — Touch Speaker

Como escrever código seguro neste repositório: os controles que já existem, onde ficam, as regras para
não furá-los e os riscos que continuam abertos. Um app que ouve o microfone, observa o teclado e mexe no
clipboard tem acesso a muita coisa sensível; este guia diz o que o Touch Speaker pode e não pode fazer com
cada uma delas. Para **reportar** uma vulnerabilidade, veja [`SECURITY.md`](../SECURITY.md).

> Última atualização: 17/out/2026 · Mantenedor: Victor Alves
> Relacionados: [`Code-Style.md`](Code-Style.md) · [`ENVIRONMENT.md`](ENVIRONMENT.md) ·
> [`API.md`](API.md) · [`DATABASE.md`](DATABASE.md) · [`INTEGRATION.md`](INTEGRATION.md) ·
> [`DECISIONS.md`](DECISIONS.md) · [`DESIGN.md`](DESIGN.md) ·
> [SDD](spec/spec-driven-development.md) (requisitos, regras, riscos no §26, ADRs no §27 e pendências no Apêndice B)

**Como ler:** afirmação com âncora `arquivo.ts:linha` é **FATO**, conferido no código em 17/out/2026 sobre o
commit `ed0a1f5`. Caminhos que começam por `src/`, `scripts/` ou `package.json` ficam dentro de `frontend/`;
o resto parte da raiz do repositório. **PLANEJADO (Fase N)** é o que só entra numa fase seguinte;
**PROPOSTA** é recomendação deste guia ou do SDD, ainda não aceita nem implementada. `PEND-NNN` e `RISK-NNN`
vêm dos registros do SDD ([Apêndice B](spec/spec-driven-development.md#apêndice-b--pendências) e
[§26](spec/spec-driven-development.md#26-riscos-e-mitigações)). O código diz o que existe; o SDD e a spec
dizem o que deve existir. Divergência entre este guia e o código é defeito e segue a regra do
[SDD §0.1](spec/spec-driven-development.md#01-política-de-prevalência-documental).

> **Estado atual — Fase 1.** A Fase 1 (MVP — ditado básico) está implementada em `frontend/` (T1–T8,
> 17/out/2026), com 30/30 testes passando, e funciona de ponta a ponta no PC do Victor (V2). É uso pessoal
> em modo de desenvolvimento: sem instalador, sem servidor próprio, sem contas, com a chave da Groq do
> próprio usuário em `frontend/.env`. Os controles descritos aqui são **FATO** salvo marcação; parte deles
> só é verificada pelo roteiro manual V1–V13 da spec, ainda pendente (PEND-001).

---

## 1. O que protegemos

O Touch Speaker não guarda dado de ninguém além do próprio usuário, mas, enquanto roda, passa pelas mãos
dele o que de mais sensível existe numa máquina pessoal. Em ordem de gravidade:

| Dado / Ativo | Onde vive | Por que é crítico |
| --- | --- | --- |
| Voz do usuário | Só em memória: `MediaStream` e `Blob[]` no renderer da pílula (`src/renderer/pill.ts:155-157`), depois `ArrayBuffer` no main até o upload para a Groq | Dado pessoal; pode conter informação de terceiros |
| Texto ditado | Memória do main e, durante a colagem, o clipboard do Windows (`src/main/insert/inserter.ts:90`) | Mensagens, e-mails, código, dados de clientes |
| Clipboard | Cópia de segurança em memória, pelo tempo de uma inserção (`src/main/insert/inserter.ts:30-44`) | Pode conter senhas, tokens, dados copiados de outros apps |
| Teclado | Hook global `uiohook-napi` no main (`src/main/keyboard.ts:11-13`) | Um hook global é tecnicamente capaz de capturar tudo o que se digita |
| Chave da Groq (e da Anthropic na Fase 2) | `GROQ_API_KEY`, lida de `frontend/.env` só pelo main (`src/main/index.ts:34-38`) e usada só no header `Authorization` (`src/main/transcribe/groq.ts:61`) | Uso indevido gera custo e bloqueio da conta |

Regra prática: **o que entra pelo microfone, pelo teclado e pelo clipboard sai só para o lugar a que se
destina — a Groq (áudio) e o app em foco (texto) — e nunca para log, disco ou outro endereço.** Toda mudança
que toca gravação, hook de teclado, inserção, log ou rede é mudança de segurança.

## 2. Superfícies e modelo de ameaça

Modelo de ameaça da Fase 1:

- **Uso pessoal, máquina do próprio usuário.** Não há servidor nem outros usuários.
- O renderer **não carrega conteúdo remoto**: só arquivos locais do app (`src/main/pill-window.ts:54-56`).
  Mesmo assim é tratado como não confiável (defesa em profundidade, §7 e §14).
- Ameaças consideradas: dependência npm comprometida, vazamento de chave por commit ou log, texto sensível
  parando em log, input sintético indo para a janela errada.

| Superfície | Quem chama | Autenticação | Ameaça principal | Defesa hoje |
| --- | --- | --- | --- | --- |
| Microfone | Renderer da pílula (`getUserMedia`) | Permissão de mídia concedida pelo main | Microfone aberto fora de uma sessão de ditado | Permissão só para a pílula e só para áudio; trilhas paradas no fim (§5, §14) |
| Hook de teclado global | `uiohook-napi` no main | Nenhuma (é o próprio app) | Keylogging: guardar ou enviar o que se digita | Cada evento vira `hotkey`, `escape` ou `other` antes de sair do hook (§7) |
| Clipboard | `TextInserter` no main | Nenhuma | Conteúdo copiado pelo usuário vazar ou se perder | Cópia só em memória, restauração condicional, nada em log (§6) |
| `SendInput` (Ctrl+V sintético) | `TextInserter` → `user32` via `koffi` | Nenhuma | Texto na janela errada; tentativa de contornar UIPI | Cola na janela em foco no momento; app elevado → fallback, nunca elevação (§5, §6) |
| Rede (Groq) | `GroqTranscriber` no main | `Authorization: Bearer <GROQ_API_KEY>` | Vazamento da chave ou do áudio | Única saída de rede, TLS, chave só no main (§3, §4) |
| IPC vindo do renderer | Renderer da pílula, via preload | Remetente conferido (`event.sender`) | Renderer comprometido mandando payload forjado | Preload mínimo; main valida remetente, tipos, tamanho e `sessionId` (§7) |
| `config.json` | Usuário editando o arquivo; main lendo | Permissões do Windows na pasta do usuário | Arquivo inválido derrubar o app | Campo inválido cai no default com aviso no log (BR-012, §10) |
| `frontend/.env` | Desenvolvedor | Permissões do Windows | Chave commitada ou enviada por upload | `.gitignore`; Fase 2 troca por `safeStorage` (§10) |

O Touch Speaker não expõe porta, rota nem webhook (§4). Detalhe da integração com a Groq em
[`INTEGRATION.md`](INTEGRATION.md).

## 3. Autenticação e chave da Groq

### Usuário

**Não há login de usuário até a Fase 4** (FR-ACC-01, PLANEJADO). Na Fase 1 o app é de uma pessoa só, na
própria máquina; quem abre o Windows usa o app.

### Chave da Groq

- A chave fica em `GROQ_API_KEY`, carregada de `frontend/.env` por `process.loadEnvFile`
  (`src/main/index.ts:34-38`). Sem o arquivo, o app abre normalmente e o ditado mostra `no_api_key`.
- A chave só existe no processo main e só sai dele no header `Authorization` para `api.groq.com`
  (`src/main/transcribe/groq.ts:59-64`). Nunca vai para o renderer, para o log nem para o `config.json`; o
  `app_ready` registra só o booleano `has_api_key` (`src/main/index.ts:198-205`).
- Sem chave, a sessão nem começa: a pílula mostra "Falta a chave da Groq — veja o README" e o log grava
  `session_rejected` com o código (`src/main/session.ts:86-90`, BR-013). Groq respondendo 401 ou 403 vira
  `invalid_api_key` (`src/main/transcribe/groq.ts:24`).
- Onde a chave vive em cada fase: tabela do §10.
- **Chave vazou?** Revogar no console da Groq na hora e gerar outra (§17).

### MFA

Não se aplica na Fase 1: não há conta de usuário. A conta da Groq é do próprio usuário e segue as regras do
console da Groq.

## 4. Rotas públicas e rede

**O app não expõe rota nem porta**: não há servidor local, nada escuta conexão. A única saída de rede na
Fase 1 é esta, a partir do processo main:

| Destino | O que vai | Onde |
| --- | --- | --- |
| `POST https://api.groq.com/openai/v1/audio/transcriptions` | Áudio da gravação (`audio.webm`) + `model`, `language`, `temperature`, `response_format`; header `Authorization` | `src/main/transcribe/groq.ts:6`, `:49-64` |

- TLS obrigatório; sem desligar verificação de certificado em nenhum ambiente.
- **Sem telemetria** na Fase 1. Se um dia houver, será opt-in e sem conteúdo ditado.
- O renderer não fala com a rede: a CSP da pílula tem `connect-src 'none'` (`src/renderer/pill.html:7`, §9).

**Regras**

- Saída de rede nova (outro provedor, outro host) exige ADR em [`DECISIONS.md`](DECISIONS.md) e entra nesta
  tabela no mesmo PR. A Anthropic (Fase 2) e o backend próprio (Fase 4) são **PLANEJADO**
  ([`INTEGRATION.md`](INTEGRATION.md#integrações-planejadas)).
- Chamada de rede só no main; o renderer continua com `connect-src 'none'`.

## 5. Autorização e permissões

Não há papéis de usuário. A pergunta de toda mudança aqui é "**este processo precisa desta capacidade?**".

| Ferramenta | Uso | Onde |
| --- | --- | --- |
| `session.setPermissionRequestHandler` | Concede `media` **só** à janela da pílula e **só** para áudio; qualquer outro pedido é negado | `src/main/index.ts:107-112` |
| `session.setPermissionCheckHandler` | Responde "sim" só para `media` vindo da pílula | `src/main/index.ts:113` |
| `fromPill` | IPC só é aceito se o remetente for a pílula | `src/main/index.ts:150` |
| `isSelfElevated` | Descobre, ao iniciar, se o próprio Touch Speaker roda como administrador | `src/main/insert/win32.ts:99-101`, `src/main/index.ts:117-123` |
| `isForegroundWindowElevated` | Antes de colar, confere se a janela em foco pertence a processo elevado; token ilegível conta como elevado | `src/main/insert/win32.ts:103-120` |

**UIPI (apps rodando como administrador).** O Windows descarta input sintético de processo comum para
janela de processo elevado. O app **não** pede elevação para contornar isso: quando a janela em foco é
elevada e o Touch Speaker não é, o texto vai só para o clipboard e a pílula avisa "Texto copiado — cole com
Ctrl+V" (`paste_blocked`; `src/main/insert/inserter.ts:77-80`, FR-DICT-10, BR-009). Se o próprio Touch
Speaker já estiver elevado, a checagem é pulada, porque a UIPI não o bloqueia.

**Regras**

- **Nunca** pedir elevação de administrador para contornar a UIPI (guardrail do [`CLAUDE.md`](../CLAUDE.md)).
- Permissão nova (câmera, notificações, tela) para qualquer janela é decisão registrada em ADR; o padrão é
  negar.
- Janela nova não herda a permissão de mídia: o handler compara `contents === pill.webContents`.

## 6. Integridade do ditado e do clipboard

O que garante que o texto certo chega ao lugar certo, uma vez, e que o clipboard do usuário volta ao que era.

### Nunca digitar lixo (C3)

- Gravação com menos de 500 ms (`MIN_AUDIO_MS`) é descartada antes do upload
  (`src/main/session.ts:173-176`, `src/main/transcribe/filters.ts:5`, BR-005).
- Transcrição descartada quando o texto vem vazio, quando todos os segmentos têm `no_speech_prob ≥ 0,6`, ou
  quando é uma alucinação conhecida do Whisper com áudio < 3 s ou média de `no_speech_prob ≥ 0,3`
  (`src/main/transcribe/filters.ts:41-54`, BR-006). O descarte é silencioso: nada é inserido nem mostrado.
- Uma sessão por vez: todo evento carrega `sessionId` (UUID do main, `src/main/session.ts:93`) e o main
  descarta o que não é da sessão atual (`src/main/session.ts:156`, `:161`, `:169`; BR-014).

### Inserção na janela em foco

- O Ctrl+V sintético vai para a janela que está em foco **no momento da inserção**. Se a pessoa trocou de
  janela durante a transcrição, o texto vai para a nova janela. Aceito na Fase 1 (é o comportamento
  esperado de "digitar onde está o cursor"; RISK-006).
- A inserção espera a tecla física de ditado estar solta, por até 2 s (`src/main/insert/inserter.ts:75`);
  durante o Ctrl+V sintético o hook ignora eventos (`inserting`, `src/main/hotkey.ts:51`; BR-008).
- O Ctrl+V é um lote único de quatro eventos por `SendInput` (`src/main/insert/win32.ts:69-78`). Se o
  Windows não aceitar os quatro, o texto fica no clipboard para um Ctrl+V manual
  (`src/main/insert/inserter.ts:93`).
- Campos de senha não são detectados na Fase 1. Ditar num campo de senha equivale a digitar nele; nada
  extra vaza. A Fase 3 (UI Automation) passa a pular campos `IsPassword` (PLANEJADO, RISK-007).

### Clipboard

- Backup e restauração ficam **em memória**, pelo menor tempo possível: a cópia é tirada antes de escrever o
  texto e devolvida 250 ms depois da colagem (`src/main/insert/inserter.ts:18-21`, `:85-105`).
- A restauração só acontece **se o clipboard ainda contiver o texto ditado**: se a pessoa copiou outra coisa
  nesse meio tempo, a cópia nova é preservada (`src/main/insert/inserter.ts:99-102`, BR-010).
- Se o backup falhar (clipboard ocupado), o texto é inserido do mesmo jeito, só sem restauração
  (`src/main/insert/inserter.ts:85-89`). Se a restauração falhar, a falha é engolida em silêncio e nada vai
  para o log (`src/main/insert/inserter.ts:100-103`).
- Conteúdo do clipboard **nunca** vai para log, disco ou rede.
- Limitação aceita (RISK-008): gerenciadores de histórico do clipboard (Win + V) registram o texto ditado.
  Deve constar do aviso ao usuário.

**Regras**

- Mudança na inserção mantém a restauração condicional e a cópia só em memória.
- Nada do texto ditado nem do clipboard em log, nem em mensagem de erro, nem em campo de diagnóstico.
- Filtro anti-lixo novo vem com caso em `src/test/filters.test.ts` (TEST-002).

## 7. Entrada: teclado global e IPC

### Teclado global

- O hook reduz cada evento a três tipos — a tecla configurada (`hotkey`), o `Esc` (`escape`) e "outra
  tecla" (`other`) — **ali mesmo**, antes de chamar qualquer outra coisa (`src/main/keyboard.ts:8-12`,
  BR-007). O código da tecla não sai de `keyboard.ts`.
- O `HotkeyController` só conhece esses três tipos (`src/main/hotkey.ts:5`). O estado guardado é só: tecla
  de ditado pressionada (`down`), quando foi pressionada (`downAt`), quando chegou o último keydown dela
  (`lastDownEventAt`) e se a sessão começou neste aperto (`startedByThisPress`) (`src/main/hotkey.ts:36-39`).
  "Outra tecla" nunca é guardada: se chega com a tecla de ditado ainda pressionada e até 1 s depois dela
  (`shortcutWindowMs`), cancela a sessão na hora, porque era um atalho (Ctrl direito + C), não ditado
  (`src/main/hotkey.ts:80-88`, BR-003).
- Proibido: guardar, logar, enviar ou acumular teclas ou seus códigos.
- O hook é encerrado (`uIOhook.stop()`) ao sair do app (`src/main/keyboard.ts:15-21`,
  `src/main/index.ts:172-180`).
- Code review rejeita qualquer mudança que identifique teclas além da configurada e do `Esc`.

### IPC vindo do renderer

O renderer é tratado como não confiável. O main confere tudo o que chega da pílula
(`src/main/index.ts:49-80`, `:150-163`):

| Canal | O que o main exige | Se falhar |
| --- | --- | --- |
| `recorder:started` | Remetente = pílula; `sessionId` string; `startedAt` número | Ignorado |
| `recorder:result` | Remetente = pílula; `sessionId` string; `mimeType` começando por `audio/`; `durationMs` finito ≥ 0; áudio `ArrayBuffer` (ou view) de até 25 MB | Ignorado, com `ipc_rejected` no log (`src/main/index.ts:158`) |
| `recorder:error` | Remetente = pílula; `sessionId` string; `code` ∈ `mic_denied`, `mic_unavailable`, `recorder_failed` | Ignorado; o campo `detail` é descartado |

- Depois da validação, o `SessionController` ainda descarta o que não é da sessão atual (§6).
- O preload expõe **só** `window.touchSpeaker`, com sete funções, e nunca um `ipcRenderer` genérico
  (`src/preload/pill.ts:22-30`; contrato em [`API.md`](API.md#api-do-preload-windowtouchspeaker)).

**Regras**

- Canal IPC novo entra em `src/shared/ipc.ts`, `src/preload/pill.ts` e `src/renderer/global.d.ts` ao mesmo
  tempo, com validação no main e contrato em [`API.md`](API.md#contratos) antes do código.
- Validação de payload vive no main, nunca no renderer.

## 8. Rate limit e abuso

- **Limites da Groq** (plano gratuito): 20 requisições/min, 2.000/dia, 7.200 s de áudio/hora, 28.800 s/dia,
  cobrança mínima de 10 s por requisição, por organização — números de terceiros, a confirmar no console
  (PEND-004; detalhe em [`API.md`](API.md#rate-limit)).
- **Limites locais:** áudio de até 25 MB, conferido no main (`src/main/index.ts:24`, `:72`) e de novo antes do
  upload (`src/main/transcribe/groq.ts:7`, `:47`); gravação de até 5 min (`maxRecordingMs`, BR-011); uma
  sessão por vez (BR-014); uma requisição por ditado.
- **Sem nova tentativa em 429:** a resposta vira `rate_limited` e a pílula avisa. Só 5xx ganha **uma** nova
  tentativa, após 500 ms (`src/main/transcribe/groq.ts:80-84`).
- Não há como um terceiro abusar do app pela rede: ele não escuta porta (§4).

## 9. Cabeçalhos, transporte e endurecimento do Electron

Obrigatório para toda janela (hoje só existe a pílula):

- [x] `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`
      (`src/main/pill-window.ts:39-42`)
- [x] Preload expõe só a API listada em [`API.md`](API.md#api-do-preload-windowtouchspeaker)
      (`src/preload/pill.ts:22-30`)
- [x] CSP real da pílula: `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none';
      img-src 'self' data:; media-src 'self' blob: mediastream:` (`src/renderer/pill.html:5-8`)
- [x] `setWindowOpenHandler(() => ({ action: 'deny' }))` e navegação bloqueada (`will-navigate`) em todo
      `webContents` criado (`src/main/index.ts:91-95`)
- [x] Main valida remetente, tipo, tamanho e `sessionId` de toda mensagem IPC vinda do renderer (§7)
- [x] Nenhum `remote`, nenhum `shell.openExternal` com URL vinda do renderer. O único `shell` em uso é o
      `openPath` da pasta de configuração, com caminho fixo do main (`src/main/tray.ts:31`)

Outros pontos:

- DevTools só fora do app empacotado (`devTools: !app.isPackaged`; `src/main/index.ts:97`,
  `src/main/pill-window.ts:46`). Sem menu de aplicação (`src/main/index.ts:85`, `src/main/pill-window.ts:51`).
- Uma instância por vez (`requestSingleInstanceLock`, `src/main/index.ts:40-47`); a segunda é ignorada e
  registrada como `second_instance_ignored`.
- **Transporte:** a única conexão é HTTPS para `api.groq.com` (§4).
- `ELECTRON_RUN_AS_NODE`: o host de extensões do VS Code exporta essa variável, que faz o `electron.exe`
  rodar como Node puro; `scripts/start.mjs` a remove. Desligar `RunAsNode` de vez é dos Electron Fuses
  (PLANEJADO, Fase 4, §15.1).

## 10. Segredos e configuração

| Fase | Onde fica a chave | Regra |
| --- | --- | --- |
| 1 (dev) | `frontend/.env` | No `.gitignore`. Nunca commitar. Nunca no renderer |
| 2 | `safeStorage` do Electron (DPAPI do Windows), digitada na tela de configurações (PLANEJADO) | O `.env` deixa de ser lido no app empacotado |
| 4 | Só no `backend/`; o app autentica o usuário e o backend chama os provedores (PLANEJADO) | **Nenhuma chave de provedor dentro de app distribuído** |

- **Não distribuir** o app com a chave de alguém embutida. Quem distribuir antes da Fase 4 entrega a própria
  conta da Groq a qualquer pessoa que abrir o `.asar` (ADR-06).
- O `.gitignore` bloqueia `.env` e `.env.*`, liberando só o `.env.example` (`.gitignore:11-13`). O
  `frontend/.env.example` traz só o nome da variável, com valor vazio.
- O `config.json` (`%APPDATA%\Touch Speaker\config.json`) guarda só preferências — tecla, tempos, idioma,
  modelo, microfone, posição da pílula, sons — e nenhum segredo (`src/main/config.ts:7-17`). Campo inválido
  cai no default com `config_invalid_field` no log; JSON inválido vira config padrão inteira; o app nunca
  deixa de abrir por causa dele (`src/main/config.ts:46-106`, BR-012).
- **Vazou um segredo?** Revogue a chave no console da Groq primeiro; limpar o histórico vem depois. Remover o
  arquivo num commit novo não apaga o valor do histórico.

## 11. Dados em disco

| Dado | Onde | Regra |
| --- | --- | --- |
| Áudio | **Nunca em disco.** Memória do renderer e do main até o upload; descartado depois | Guardrail do [`CLAUDE.md`](../CLAUDE.md) e NFR-04 |
| Texto ditado | Nunca em disco na Fase 1 (só o clipboard do Windows, durante a colagem) | Histórico local é PLANEJADO (Fase 2) |
| `config.json` | `%APPDATA%\Touch Speaker\config.json`, criado com defaults no primeiro uso (`src/main/config.ts:93-99`) | Só preferências; nenhum segredo (§10) |
| Log | `%APPDATA%\Touch Speaker\logs\main.log`, rotação 5 MB × 3 arquivos (`src/main/logger.ts:9-10`) | Só metadados (§12) |
| `.env` | `frontend/.env` (só em desenvolvimento) | Fora do git (§10) |
| Histórico e dicionário | SQLite local `%APPDATA%\Touch Speaker\touch-speaker.db` (PLANEJADO, Fase 2) | Retenção configurável (padrão 30 dias; "nunca guardar" é uma opção), limpeza ao iniciar o app, "Apagar histórico" com `VACUUM`; o banco nunca sai da máquina ([`DATABASE.md`](DATABASE.md)) |

## 12. Logs e observabilidade

- O log é um arquivo local: `%APPDATA%\Touch Speaker\logs\main.log`, uma linha JSON por evento com `t`,
  `level`, `event` e campos (`src/main/logger.ts:33`). Rotação a 5 MB, guardando `main.log`, `main.1.log` e
  `main.2.log` (`src/main/logger.ts:42-55`). Falha ao gravar o log nunca derruba o ditado (`:34-39`).
- Os valores de campo só podem ser primitivos (`string`, `number`, `boolean`, `null`) — de propósito, para
  ninguém despejar um objeto inteiro no log (`src/main/logger.ts:6-7`).
- **Podem conter:** horários, durações, tamanhos, latências, códigos de erro, versão do app, nome da tecla
  configurada, os 8 primeiros caracteres do `sessionId` (`src/main/session.ts:49`).
- **Não podem conter:** texto transcrito, áudio, clipboard, chave, teclas, título de janela.
- Logs ficam só na máquina; nada é enviado.
- Eventos que existem: `app_ready` (`version`, `electron`, `hotkey`, `has_api_key`, `keyboard_hook`,
  `self_elevated`), `session_start`, `session_stop`, `session_cancel`, `session_rejected`, `session_timeout`,
  `recorder_started` (`latency_ms`), `session_empty`, `session_error`, `session_exception`,
  `transcribe_failed`, `dictation_done` (`audio_ms`, `audio_bytes`, `transcribe_ms`, `total_ms`, `chars`,
  `outcome`), `config_invalid_field`, `pill_console`, `pill_renderer_gone`, `win32_unavailable`,
  `keyboard_hook_unavailable`, `ipc_rejected`, `second_instance_ignored` (`src/main/index.ts`,
  `src/main/session.ts`).
- `pill_console` é o único campo com texto livre: avisos e erros do console da pílula, cortados em 300
  caracteres (`src/main/index.ts:99-103`). É aceitável porque o renderer não tem conteúdo do usuário — o
  áudio não passa por `console` e os textos da pílula vêm prontos do main.
- Não há métricas remotas, error tracking nem alertas.

**Regras**

- Campo novo de log passa pela lista acima: se puder carregar conteúdo do usuário, não entra.
- Nunca logar `err.message` de erro que possa conter dado do usuário; o padrão do código é logar só
  `err.name` (`src/main/index.ts:122`, `src/main/session.ts:217`).

## 13. Privacidade (LGPD)

| Tema | Estado |
| --- | --- |
| Dados pessoais tratados | Voz (áudio da gravação), texto ditado e, por instantes, o conteúdo do clipboard. Nada disso é persistido pelo app na Fase 1 (§11) |
| Terceiros | A voz é enviada à Groq para transcrição; a política de dados da Groq se aplica a esse áudio |
| Titular | Na Fase 1 o único titular é o próprio usuário, que escolheu o provedor e usa a própria chave |
| Retenção local | Nenhuma na Fase 1. Histórico (Fase 2, PLANEJADO) fica só na máquina, com retenção configurável e "apagar tudo" |
| Distribuição | PLANEJADO (Fase 4): antes de distribuir, termo de uso e política de privacidade dizendo quais provedores recebem a voz e a retenção de cada um, e opção de provedor local (whisper.cpp) para quem não quer enviar áudio para fora |

**Regras**

- Dado pessoal novo (o que o app passa a guardar, enviar ou mostrar) entra nesta tabela e no
  [SDD §18](spec/spec-driven-development.md) no mesmo PR.
- Provedor novo que receba voz ou texto exige ADR e atualização desta tabela.

## 14. Renderer (pílula)

- A pílula é a única janela com renderer; ela grava o áudio porque `getUserMedia` só existe num renderer
  (`src/main/pill-window.ts:1-2`). Carrega só arquivos locais, nunca conteúdo remoto, e mesmo assim é tratada
  como não confiável (§7).
- Microfone aberto **só** entre `recorder:start` e `recorder:stop`/`recorder:cancel`. Todas as trilhas do
  `MediaStream` são paradas no fim, em todos os caminhos — sucesso, cancelamento e erro
  (`src/renderer/pill.ts:69-78`, `:98-110`, `:141-151`, `:182-189`); o indicador de microfone do Windows tem
  de apagar (V3 da spec, pendente — PEND-001).
- O áudio fica em memória (`Blob` → `ArrayBuffer`), vai para o main por `recorder:result` e é descartado.
  **Nunca gravado em disco.**
- O renderer não tem strings próprias: `message` e `hint` chegam prontos do main por `pill:state` e entram
  na tela por `textContent`, nunca por `innerHTML` (`src/renderer/pill.ts:214-219`).

**Regras**

- Nada de `innerHTML`, `eval` ou script remoto na pílula; a CSP (§9) não abre exceção para isso.
- Mudança na gravação precisa manter "microfone fecha em todos os caminhos" (checklist do §16).

## 15. Dependências, CI e sala limpa

### 15.1 Dependências

- Versões exatas no `package.json` (`electron` 44.9.0, `typescript` 7.0.2, `@types/node` 24.19.2, `koffi`
  3.3.3, `uiohook-napi` 1.5.5) e fixadas no `package-lock.json`. Atualização de Electron, `uiohook-napi` ou
  `koffi` só com teste manual do fluxo completo (RISK-004).
- `npm audit` antes de cada versão.
- Scripts de instalação de pacotes nativos ficam bloqueados por padrão; liberar só os necessários, por nome.
  Hoje `koffi` e `uiohook-napi` estão negados no `allowScripts` do `package.json`: os dois já trazem
  binários prontos para win32-x64 e não precisam compilar nada.
- O binário do Electron é baixado com verificação pelo `checksums.json` do próprio pacote.
- Dependência nova exige ADR em [`DECISIONS.md`](DECISIONS.md).
- **Distribuição (Fase 4 — PLANEJADO):** assinatura de código do instalador, auto-update assinado,
  Electron Fuses (desligar `RunAsNode`, `EnableNodeCliInspectArguments`, ligar integridade do ASAR).

### 15.2 CI

Não há pipeline: o repositório não tem `.github/`. Os portões são manuais, rodados em `frontend/` antes do
PR: `npm run typecheck` e `npm test` ([`Code-Style.md`](Code-Style.md)). Não há `npm audit` automático,
Dependabot nem varredura de segredos. **PROPOSTA:** quando houver CI, incluir `npm audit` e varredura de
segredos.

### 15.3 Sala limpa (engenharia reversa)

O desenho do Touch Speaker foi informado por engenharia reversa do Typeless 2.8.2, feita para
entender arquitetura e comportamento. A parte publicável é o
[estudo de referência](referencia/estudo-typeless.md).

Regras:

- O material bruto do estudo (binários do Typeless, código decompilado, anotações e o snapshot de
  dados pessoais) fica **fora da pasta do repositório**, não só fora do git — assim nem um upload
  manual pelo site do GitHub consegue levá-lo junto. O `.gitignore` mantém as pastas antigas
  bloqueadas como segunda trava.
- Do estudo saem ideias e comportamentos documentados com palavras próprias. **Nunca** código,
  pseudocódigo decompilado, strings, constantes mágicas, nomes de canais IPC, ícones, sons, cores ou
  textos do Typeless.
- **Nunca** chamar a API do Typeless, reaproveitar tokens, mexer em assinatura de requisição ou em
  gating de plano/trial deles.
- Na dúvida se algo é "ideia" ou "cópia": escrever do zero a partir da documentação pública da
  Microsoft/Electron/Groq, sem abrir o material bruto do estudo.

A decisão está na [ADR-07](DECISIONS.md#adr-07--sala-limpa-em-relação-ao-typeless). As pastas bloqueadas
como segunda trava são `targets/`, `analysis/` e `rea/` (`.gitignore:1-5`). O estudo é referência **não
normativa**: dele não sai requisito nem código.

## 16. Checklist de segurança do PR

- [ ] Nenhum segredo no diff (`.env`, chaves, tokens)
- [ ] Nada novo indo para log que esteja na lista proibida (§12)
- [ ] Nova mensagem IPC validada no main (§7)
- [ ] Nenhuma tecla além da configurada e do `Esc` é identificada (outras viram só um booleano)
- [ ] Microfone fecha em todos os caminhos (sucesso, cancelamento, erro)
- [ ] Nada copiado do Typeless nem do material bruto do estudo; nenhum binário de terceiro no diff (§15.3)
- [ ] Nenhuma dependência nova sem ADR em [`DECISIONS.md`](DECISIONS.md)
- [ ] `npm run typecheck` e `npm test` verdes em `frontend/`

## 17. Quando achar uma vulnerabilidade

1. **Não abra issue pública** nem descreva o furo em canal aberto. Siga o [`SECURITY.md`](../SECURITY.md).
2. Contenha primeiro, com as alavancas que existem hoje:
   - chave da Groq exposta: revogar no console da Groq e gerar outra; trocar o valor em `frontend/.env`;
   - comportamento suspeito do app (microfone, teclado, clipboard): fechar o app pelo "Sair" da bandeja, que
     encerra o hook de teclado e cancela a sessão em andamento (`src/main/index.ts:172-180`);
   - dependência comprometida: não rodar `npm install` de novo até fixar uma versão limpa no
     `package-lock.json`.
3. Corrija com um teste que reproduz o problema (`src/test/<módulo>.test.ts`) ou, quando não houver como
   testar em `node:test`, com um passo novo no roteiro manual V da spec.
4. Registre no [`CHANGELOG.md`](CHANGELOG.md) o que mudou e por quê, sem receita de exploração.

## 18. Riscos conhecidos em aberto

Do registro de riscos do [SDD §26](spec/spec-driven-development.md#26-riscos-e-mitigações), conferidos no
código em 17/out/2026. Estado: **aberto**, **mitigado** ou **aceito**.

- [ ] **RISK-001 — Groq muda ou corta o plano gratuito** · aberto. O MVP para de transcrever; mitigação:
  `Transcriber` atrás de interface, e trocar por OpenAI ou whisper.cpp local é um adapter novo (ADR-04).
- [ ] **RISK-002 — Whisper "alucina" frases em silêncio** ("Legendas pela comunidade Amara.org") · mitigado.
  Filtros anti-lixo FR-DICT-08 (`src/main/transcribe/filters.ts`, 8 testes; §6).
- [ ] **RISK-003 — App de destino rodando como administrador bloqueia o Ctrl+V sintético (UIPI)** ·
  mitigado; V10 pendente (PEND-001). Detecção de elevação + fallback "Texto copiado" (FR-DICT-10; §5).
- [ ] **RISK-004 — `uiohook-napi`/`koffi` quebram numa versão nova do Electron** · aberto (controlado).
  Versões exatas no `package.json`; atualizar Electron só com teste manual (§15.1).
- [ ] **RISK-005 — Copiar código ou assets do Typeless por engano** · aberto (permanente). Sala limpa
  (ADR-07, §15.3); material bruto fora do repositório; checklist do PR (§16).
- [ ] **RISK-006 — Texto vai para a janela errada se o foco mudar durante a transcrição** · aceito na Fase 1
  (é "digitar onde está o cursor"; §6).
- [ ] **RISK-007 — Ditado em campo de senha** · aceito. A senha é digitada no campo e nada vaza além disso;
  a Fase 3 (UI Automation) pula campos `IsPassword` (§6).
- [ ] **RISK-008 — Histórico do clipboard do Windows (Win + V) guarda o texto ditado** · aceito; a ser
  documentado para o usuário (§6).
- [ ] **RISK-009 — Chave da Groq em `frontend/.env` em texto puro** · aceito só em dev. Vazamento por commit
  ou upload; `.gitignore` hoje, `safeStorage` (DPAPI) na Fase 2 (§10).
- [ ] **RISK-010 — `uiohook-napi` não carregar no Electron 44** · mitigado. Verificado no T1
  (`keyboard_hook: true` no `app_ready`); alternativa: hook próprio com `koffi`.
- [ ] **RISK-011 — Primeiras sílabas cortadas** (a captura começa até 300 ms após a tecla) · aberto (NFR-02,
  conhecido). Pílula pré-carregada (medido 75–270 ms); se incomodar, manter o stream aberto 30 s após cada
  uso.
- [ ] **RISK-012 — Whisper erra termos técnicos** · aberto. Correção manual; Fase 2: `prompt` com dicionário
  pessoal (FR-VOCAB-01).
- [ ] **RISK-013 — `Esc` de cancelar também chega ao app em foco** · aceito na Fase 1 (consequência da
  ADR-02): o hook observa a tecla, não a consome.
- [ ] **RISK-014 — Latência cresce com falas longas** (upload do áudio inteiro ao soltar) · aceito. NFR-01 só
  é garantido para falas ≤ 30 s; streaming fica para a Fase 4, com o backend (ADR-04).

### Divergências doc × código

Enquanto não forem corrigidas, o código diz o que existe. As versões anteriores dos documentos estão em
`git show ed0a1f5:docs/<arquivo>`.

| Doc | Afirmava | O código faz | Estado |
| --- | --- | --- | --- |
| `DESIGN.md` anterior (§6, menu da bandeja) | Item "Microfone: {nome do dispositivo}" | Mostra "Microfone: padrão do Windows" ou "Microfone: definido no config.json" (`src/main/strings.ts:12-13`, `src/main/tray.ts:29`) | Corrigida nesta revisão ([`DESIGN.md`](DESIGN.md#63-menu-da-bandeja)) |
| `DESIGN.md` anterior (§6, ícone da bandeja) | Ponto da variante "gravando" em `--ts-listening` | Ponto vermelho `#F87171`, o valor de `--ts-error` (`src/main/icon.ts:5`) | Corrigida nesta revisão ([`DESIGN.md`](DESIGN.md#62-ícone-da-bandeja)) |
| `DESIGN.md` anterior (§6, ícone da bandeja) | Glifo em 16/20/24/32 px | Gera 16 px e as escalas 1,5× e 2× — 16/24/32 px (`src/main/icon.ts:57-63`) | Corrigida nesta revisão |
| Security Guide anterior (§6, clipboard) | Falha na restauração grava `restore_failed` e quantos formatos havia | A falha é engolida em silêncio; nenhum evento de log (`src/main/insert/inserter.ts:100-103`) | Corrigida nesta revisão (§6) |
| Security Guide anterior (§8, CSP) | `default-src 'self'; script-src 'self'; connect-src 'none'; img-src 'self' data:; media-src 'self' blob:` | Tem também `style-src 'self'` e `mediastream:` em `media-src` (`src/renderer/pill.html:7`) | Corrigida nesta revisão (§9) |
| Security Guide anterior (§4, teclado) | Estado guardado inclui um booleano "outra tecla foi pressionada" | "Outra tecla" não é guardada: cancela a sessão na hora, dentro de `shortcutWindowMs` (`src/main/hotkey.ts:36-39`, `:80-88`) | Corrigida nesta revisão (§7) |
