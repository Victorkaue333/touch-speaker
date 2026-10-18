# API — Touch Speaker

> Última atualização: 18/out/2026 · Mantenedor: Victor Alves

> **Status:** na Fase 1 o Touch Speaker **não tem API HTTP própria** e não escuta porta nenhuma. Existem quatro contratos, todos implementados e descritos aqui a partir do código (**FATO**, conferido em 17/out/2026; o IPC da janela principal, a autenticação e as âncoras de código, reconferidos em 18/out/2026 no código ainda não commitado — inclusive os canais `history:*` do histórico e o `theme:set` do tema): a chamada **externa** à Groq para transcrever ([Transcrição (Groq)](#transcrição-groq)), o **IPC** entre o processo main e a janela da pílula ([Contratos](#contratos)), o **IPC** entre o main e a janela principal ([IPC main ⇄ janela principal](#ipc-main--janela-principal), com o [histórico](#histórico-history) e o [tema](#tema-themeset)) e os **códigos de erro** que atravessam o app ([Códigos de erro](#códigos-de-erro) e [Códigos da janela principal](#códigos-da-janela-principal)). A API própria do `backend/` só existe na Fase 4 e aparece aqui como rascunho ([API própria (Fase 4 — rascunho)](#api-própria-fase-4--rascunho)).

Os caminhos de arquivo deste documento são relativos a `frontend/`.

## Visão geral

- **Base URL:** `https://api.groq.com` — a única saída de rede do app, chamada só pelo processo main (`src/main/transcribe/groq.ts:6`). Não há servidor local nem porta aberta.
- **Formato:** com a Groq, `multipart/form-data` na ida e JSON (`verbose_json`) na volta. No IPC, mensagens do Electron com payloads tipados em `src/shared/ipc.ts`. Não há versionamento, OpenAPI nem Swagger.
- **Auth:** `Authorization: Bearer <chave>` na chamada à Groq, montado só no main (`groq.ts:66`), com a chave salva em Configurações ou, só em desenvolvimento, a do `.env` ([Autenticação](#autenticação)). O IPC não tem credencial: o main confere o **remetente** de cada mensagem (nos canais da pílula, só a pílula; nos da janela principal, só a janela principal aberta) e valida o payload — ver [Contratos](#contratos).
- **Envelope:** a resposta da Groq é usada como vem (`text`, `duration`, `segments[]`). No IPC não há envelope comum; todo payload dos canais `recorder:*` traz o `sessionId` (UUID gerado no main, `src/main/session.ts:101`); os canais da janela principal não pertencem a uma sessão de ditado e não têm `sessionId`.
- **Erros:** cada falha do ditado vira **um** código interno (`src/main/errors.ts`); a pílula mostra a mensagem em pt-BR que corresponde ao código (`src/main/strings.ts`) e o log guarda só o código, nunca conteúdo ([Códigos de erro](#códigos-de-erro)). A janela principal tem códigos próprios, que nunca chegam à pílula ([Códigos da janela principal](#códigos-da-janela-principal)).

Mapa no código: a chamada HTTP está em `src/main/transcribe/groq.ts`, atrás da interface `Transcriber` (`src/main/transcribe/transcriber.ts`); os canais e payloads do IPC em `src/shared/ipc.ts`, com cópia dos nomes em `src/preload/pill.ts` e `src/preload/main-window.ts` e dos tipos em `src/renderer/global.d.ts` e `src/renderer/main-window/global.d.ts`; a validação do que chega da pílula em `src/main/index.ts:76-107`, e do que chega da janela principal em `src/main/main-window-ipc.ts` (canais `app:*`, `settings:*`, `groq-key:*`, `login-item:set`, `theme:set` e a checagem de remetente) e em `src/main/history/ipc.ts` (canais `history:*`).

## Estado atual

A Fase 1 está implementada (tarefas T1–T8 da [spec `ditado-por-voz`](spec/features/ditado-por-voz.md), 17/out/2026), conferida em `ed0a1f5`. Em 18/out/2026 entrou no código, ainda não commitado, a [spec `janela-principal`](spec/features/janela-principal.md): o IPC da janela principal e a chave da Groq digitada em Configurações. No mesmo dia entraram, também sem commit, a [spec `historico`](spec/features/historico.md) com a de migração [`historico-dados-v1`](spec/features/historico-dados-v1.md) — os canais `history:*` — e o tema claro/escuro escolhido na janela (FR-UI-39…42 da `janela-principal`) — o canal `theme:set`. A chamada à Groq é coberta por testes com `fetch` simulado; os validadores e a checagem de remetente da janela principal, por TEST-009; os do histórico, por TEST-013; o IPC da pílula só tem verificação manual. `npm test`: 326/326.

| Contrato | Entre | Onde no código | Verificação |
| --- | --- | --- | --- |
| Transcrição (Groq) | main → Groq | `src/main/transcribe/groq.ts` | TEST-003 (`src/test/groq.test.ts`, 10 casos — inclui a chave lida a cada chamada); ditado real no V2 |
| IPC main ⇄ pílula | main ⇄ renderer da pílula | `src/shared/ipc.ts`, `src/preload/pill.ts`, `src/main/index.ts`, `src/renderer/pill.ts` | roteiro manual V1–V13 da spec `ditado-por-voz`; só o V2 feito |
| IPC main ⇄ janela principal | main ⇄ renderer da janela | `src/shared/ipc.ts`, `src/preload/main-window.ts`, `src/main/main-window-ipc.ts`, `src/main/main-window.ts`, `src/main/index.ts`, `src/renderer/main-window/main-window.ts`; histórico em `src/main/history/ipc.ts` e `src/main/history/service.ts`; tema em `src/main/theme-setting.ts` | TEST-009 (`src/test/main-window-ipc.test.ts` — validadores, remetente e nomes de canal dos dois preloads); TEST-007 (`credentials.test.ts`) e TEST-008 (`settings.test.ts`) cobrem a chave e as preferências por trás dos canais; TEST-013 (`history-ipc.test.ts`) e TEST-017 (`history-service.test.ts`), os validadores e as respostas do histórico; TEST-018 (`theme.test.ts`), o payload e o `ThemeSetting`; roteiros VJ1–VJ27 e VH1–VH13 pendentes |
| Códigos de erro | todo o app | `src/main/errors.ts`, `src/main/strings.ts`; os da janela em `src/shared/ipc.ts` (`MainWindowErrorCode` e os `result`/`status` das respostas do histórico) | TEST-003 cobre os códigos da Groq; TEST-007 a TEST-009, TEST-017 e TEST-018, os da janela; os demais só no roteiro manual |

O que falta: o roteiro manual V1 e V3–V13 (entre eles os caminhos de erro — sem chave, sem rede, limite, microfone, colagem bloqueada) — **PENDÊNCIA PEND-001** —, o fechamento da spec `ditado-por-voz` — **PENDÊNCIA PEND-002** —, o roteiro VJ1–VJ24 da spec `janela-principal` — **PENDÊNCIA PEND-007** —, o roteiro VH1–VH13 da spec `historico` com o ensaio da `historico-dados-v1` — **PENDÊNCIA PEND-009** — e o roteiro VJ25–VJ27 (tema e controles) — **PENDÊNCIA PEND-010** ([SDD, Apêndice B](spec/spec-driven-development.md#apêndice-b--pendências)).

## Autenticação

O único segredo é a chave da Groq do próprio usuário ([ADR-08](DECISIONS.md#adr-08--chave-da-groq-no-safestorage-do-electron-com-o-env-só-como-reserva-de-desenvolvimento), BR-016). A pessoa a digita em Configurações, na janela principal; o main a recebe pelo canal [`groq-key:set`](#ipc-main--janela-principal), cifra com o `safeStorage` do Electron (DPAPI do Windows) e grava os bytes em `%APPDATA%\Touch Speaker\groq-key.bin`. Na abertura, depois do `ready`, o main carrega a chave nesta ordem: `groq-key.bin` decifrado; senão, **só com o app não empacotado**, o `GROQ_API_KEY` de `frontend/.env` (o `.env` nem é lido no app empacotado — `src/main/index.ts:59-65`); senão, nenhuma (`src/main/credentials.ts:68-83`, `src/main/index.ts:164-177`). A chave fica em memória só no main, no `CredentialStore`; o `GroqTranscriber` a lê por `getApiKey` a cada chamada (`index.ts:179`, `groq.ts:49-51`) e ela só sai do processo no cabeçalho `Authorization` da chamada à Groq (`groq.ts:66`). Nunca vai para o renderer — nenhuma resposta de IPC tem campo para ela —, para o log nem para o `config.json`.

| Contexto | Onde vive a chave | Quem chama o provedor | Estado |
| --- | --- | --- | --- |
| Uso pessoal (app empacotado ou não) | `groq-key.bin`, cifrado pelo `safeStorage` (DPAPI do Windows); digitada em Configurações | o main, direto na Groq | **FATO** (spec `janela-principal`, 18/out/2026, não commitado) |
| Desenvolvimento (app não empacotado) | `frontend/.env`, fora do git — só reserva: vale quando não existe `groq-key.bin` | o main, direto na Groq | **FATO** |
| Produto distribuído (Fase 4) | só no `backend/`; o app autentica o usuário e o backend chama os provedores | o backend | **PLANEJADO (Fase 4)** |

- **Sem chave em uso** (nenhuma salva em Configurações e, em desenvolvimento, nenhum `GROQ_API_KEY` no `.env`), o app abre normalmente; a sessão nem começa e a pílula mostra `no_api_key` — "Falta a chave da Groq — abra o Touch Speaker pela bandeja" (BR-013, `src/main/session.ts:94-98`). O `GroqTranscriber` também recusa sem chamar a rede (`groq.ts:51`). Na primeira execução sem chave salva, a janela principal abre sozinha em Configurações (`src/main/index.ts:449`).
- **Chave salva que não decifra** (troca de máquina ou de perfil do Windows, cifra indisponível, arquivo corrompido): estado `unreadable`, nenhuma chave em uso — o `.env` não substitui —, log `groq_key_unreadable`; para o ditado, é o mesmo que estar sem chave. A tela pede para salvar de novo.
- **Chave inválida ou revogada:** a Groq responde `401` ou `403` e o app mostra `invalid_api_key`. Salvar a chave **não** a testa na Groq (nenhuma chamada HTTP nova): uma chave errada aparece no primeiro ditado.
- **Trocar ou remover** a chave vale a partir do próximo ditado, sem reiniciar.
- **Chave vazou:** revogue no console da Groq (console.groq.com → API Keys), gere outra e salve-a em Configurações. Ciclo completo da chave em [`INTEGRATION.md`](INTEGRATION.md#contrato); regras em [`Security-Guide.md`](Security-Guide.md#10-segredos-e-configuração).
- **Não distribuir** o app com chave embutida: quem precisa disso é o backend da Fase 4 ([ADR-06](DECISIONS.md#adr-06--sem-backend-na-fase-1)).

### Papéis

Não se aplica na Fase 1: é um app local de um único usuário, sem contas nem papéis. Contas chegam com o backend da Fase 4 (FR-ACC-01, **PLANEJADO (Fase 4)**). O que existe de controle de acesso é técnico: a checagem de remetente no IPC — os canais da pílula só aceitam a pílula (`src/main/index.ts:249`) e os da janela principal só aceitam a janela principal aberta agora, do quadro principal e com o `index.html` do app (`src/main/main-window.ts:53-57`, `src/main/main-window-ipc.ts:106-121`) — e a permissão de mídia restrita à pílula e a áudio (BR-015, `index.ts:145-152`); a janela principal não tem permissão de mídia.

### Rate limit

**Limites da Groq (plano gratuito).** Números de fonte de terceiros (set/2026); o console da Groq é a fonte oficial — **PENDÊNCIA PEND-004**.

| Limite | Valor |
| --- | --- |
| Requisições | 20 por minuto · 2.000 por dia |
| Segundos de áudio | 7.200 s por hora · 28.800 s por dia |
| Cobrança mínima | 10 s de áudio por requisição |
| Escopo | por organização, não por chave |

`[PRECISA ESCLARECER: confirmar no console da Groq os limites atuais do plano gratuito (PEND-004)]`

Ao bater no limite, a Groq responde `429` e o app mostra `rate_limited` **sem nova tentativa** (`groq.ts:30`, `:85-89`); o cabeçalho `retry-after` não é lido.

**Limites locais (FATO):**

- áudio de até **25 MB** por gravação, conferido duas vezes: na entrada do IPC (`MAX_AUDIO_BYTES`, `src/main/index.ts:48`, `:99`) e antes do upload (`MAX_UPLOAD_BYTES`, `groq.ts:7`, `:52`);
- gravação de até **5 min** (`maxRecordingMs`, padrão 300 000 ms), com aviso 30 s antes do fim (BR-011, `src/main/session.ts:115-125`);
- **uma sessão por vez**: com uma sessão em andamento, o `start` não abre outra (BR-014, `session.ts:92`);
- **uma requisição por ditado**, mais no máximo uma nova tentativa em `5xx`.

## Endpoints

Legenda de acesso: **main** = só o processo main · **pílula** = só a janela da pílula; o main confere o remetente (`event.sender === pill.webContents`, `src/main/index.ts:249`) e valida o payload antes de usar · **janela** = só a janela principal aberta; o main confere o remetente (`MainWindow.isSender`) e o formato exato do payload ([IPC main ⇄ janela principal](#ipc-main--janela-principal)).

### Groq (externo)

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `POST` | `https://api.groq.com/openai/v1/audio/transcriptions` | main, `Authorization: Bearer` | Transcreve a gravação inteira de um ditado; API compatível com a da OpenAI — [contrato](#transcrição-groq) |

### IPC main → pílula

Enviados pelo main com `webContents.send` (`src/main/pill-window.ts:63-65`); a pílula escuta pelas funções `on*` do preload.

| Canal | Acesso | Quando | Contrato |
| --- | --- | --- | --- |
| `recorder:start` | main | início da sessão: tecla de ditado pressionada com o app ocioso e a chave presente | [`recorder:start`](#recorderstart) |
| `recorder:stop` | main | fim da fala: soltou a tecla depois de `holdThresholdMs`, segundo toque em mãos livres ou limite de `maxRecordingMs` | [`recorder:stop` e `recorder:cancel`](#recorderstop-e-recordercancel) |
| `recorder:cancel` | main | `Esc`, atalho detectado (outra tecla logo depois da de ditado) ou saída do app com gravação aberta | [`recorder:stop` e `recorder:cancel`](#recorderstop-e-recordercancel) |
| `pill:state` | main | toda mudança de estado visível da sessão | [`pill:state`](#pillstate) |

### IPC pílula → main

Enviados pela pílula com `ipcRenderer.send`, pelas funções do preload (`src/preload/pill.ts:27-29`); o main escuta com `ipcMain.on` (`src/main/index.ts:250-262`).

| Canal | Acesso | Quando | Contrato |
| --- | --- | --- | --- |
| `recorder:started` | pílula | microfone aberto e `MediaRecorder` gravando | [`recorder:started`](#recorderstarted) |
| `recorder:result` | pílula | depois do `stop`, com o áudio completo | [`recorder:result`](#recorderresult) |
| `recorder:error` | pílula | falha ao abrir o microfone ou ao gravar | [`recorder:error`](#recordererror) |

### IPC main ⇄ janela principal

Canais da [spec `janela-principal`](spec/features/janela-principal.md#10-contrato) (FR-UI-33) e, desde 18/out/2026, da [spec `historico`](spec/features/historico.md#10-contrato) (`history:*`, FR-HIST-19) e do tema (`theme:set`, FR-UI-40), nomes em `Channel` (`src/shared/ipc.ts:19-39`). A janela os usa pelas funções de [`window.touchSpeakerApp`](#api-do-preload-windowtouchspeakerapp); o main os atende com `ipcMain.handle` (`invoke`) ou `ipcMain.on` (`send`), registrados **uma vez**, na abertura do app, e não a cada janela criada (`src/main/index.ts:283-413`). Remetente, tipos e efeitos: [Janela principal — remetente, tipos e efeitos](#janela-principal--remetente-tipos-e-efeitos).

| Canal | Direção | Payload → resposta | Validação no main |
| --- | --- | --- | --- |
| `app:get-strings` | janela → main (`invoke`) | nenhum → `MainWindowStrings` | janela; nenhum argumento |
| `app:get-status` | janela → main (`invoke`) | nenhum → `AppStatus` | janela; nenhum argumento |
| `app:status` | main → janela (`send`) | `AppStatus` | só o main envia: quando a chave muda (salvar ou remover) e quando a gravação começa ou termina; só se a janela existir (`src/main/index.ts:221`, `:236-240`, `:297-300`; `src/main/main-window.ts:73-75`). Trocar o tema não reenvia o `app:status`: a janela que pediu já está no tema novo |
| `settings:get` | janela → main (`invoke`) | nenhum → `SettingsView` | janela; nenhum argumento |
| `settings:save` | janela → main (`invoke`) | `EditableSettings` → `SettingsResult` | janela; objeto simples com **exatamente** as 7 chaves, nos tipos certos, strings de até 64 caracteres (senão `ipc_rejected`); valor fora da faixa → `invalid_field` |
| `groq-key:set` | janela → main (`invoke`) | `{ key: string }` → `GroqKeyResult` | janela; só `key`, string (senão `ipc_rejected`); depois de aparar as pontas, 1 a 512 caracteres, sem espaço (`\s`) nem caractere de controle (`\p{Cc}`) no meio (senão `invalid_format`) |
| `groq-key:remove` | janela → main (`invoke`) | nenhum → `GroqKeyResult` | janela; nenhum argumento |
| `login-item:set` | janela → main (`invoke`) | `{ enabled: boolean }` → `LoginItemResult` | janela; só `enabled`, booleano (senão `ipc_rejected`); app não empacotado → `unavailable` sem tocar no sistema |
| `app:relaunch` | janela → main (`send`) | nenhum | janela; nenhum argumento |
| `theme:set` | janela → main (`invoke`) | `{ theme: 'system' \| 'light' \| 'dark' }` → `ThemeResult` | janela; só `theme`, um dos três valores (senão `ipc_rejected`) — [Tema](#tema-themeset) |
| `history:list` | janela → main (`invoke`) | `{ query?, cursor?, limit? }` → `HistoryListResult` | janela; só chaves dessas três, todas opcionais; `query` até 200 caracteres depois do `trim`; `cursor` no formato do main, até 128; `limit` inteiro de 1 a 100 (senão `ipc_rejected`) — [Histórico](#histórico-history) |
| `history:copy` | janela → main (`invoke`) | `{ id: string }` → `HistoryCopyResult` | janela; só `id`, UUID v4 (senão `ipc_rejected`) |
| `history:delete` | janela → main (`invoke`) | `{ id: string }` → `HistoryDeleteResult` | janela; só `id`, UUID v4 (senão `ipc_rejected`) |
| `history:clear` | janela → main (`invoke`) | `{ confirmed: true }` → `HistoryClearResult` | janela; só `confirmed`, exatamente `true` (senão `ipc_rejected`) |
| `history:get-retention` | janela → main (`invoke`) | nenhum → `HistoryRetentionView` | janela; nenhum argumento |
| `history:set-retention` | janela → main (`invoke`) | `{ retentionDays: number \| null }` → `HistorySetRetentionResult` | janela; só `retentionDays`, inteiro de 0 a 3650 ou `null` (senão `ipc_rejected`) |
| `history:stats` | janela → main (`invoke`) | nenhum → `HistoryStatsView` | janela; nenhum argumento |
| `history:changed` | main → janela (`send`) | `{ reason: 'saved' \| 'deleted' \| 'cleared' \| 'purged' }` | só o main envia, e só se a janela existir (`src/main/index.ts:197`, `src/main/main-window.ts:73-75`); sem conteúdo |

Os canais `history:*` passam pela mesma checagem de remetente dos outros (`handleWindow`, `src/main/index.ts:292-296`) e só então pelos validadores de `src/main/history/ipc.ts:52-99`; o `theme:set`, pelo `asThemeInput` (`src/main/main-window-ipc.ts:63-68`). A pílula não tem nenhum deles: o preload dela não os expõe e o main recusa o remetente.

### API própria (Fase 4 — rascunho)

**PLANEJADO (Fase 4).** Quando houver distribuição para outras pessoas, as chaves dos provedores saem do app e passam a viver no `backend/` (hoje vazio — [`backend/README.md`](../backend/README.md)). Esboço, sujeito à spec da Fase 4:

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/v1/auth/*` | Login e sessão do app desktop |
| `POST` | `/v1/dictations` | Recebe áudio + metadados, transcreve, (opcional) limpa, devolve texto |
| `GET` | `/v1/me/usage` | Consumo e cota do usuário |
| `GET/PUT` | `/v1/me/dictionary` | Dicionário pessoal |
| `WS` | `/v1/dictations/stream` | Streaming de áudio durante a fala (reduz latência) |

## Contratos

Três tipos de contrato: o HTTP com a Groq (primeira subseção), o IPC entre o main e a pílula (de [`recorder:start`](#recorderstart) à [API do preload da pílula](#api-do-preload-windowtouchspeaker)) e o IPC entre o main e a janela principal (de [Janela principal — remetente, tipos e efeitos](#janela-principal--remetente-tipos-e-efeitos) à [API do preload da janela](#api-do-preload-windowtouchspeakerapp), com o [histórico](#histórico-history) e o [tema](#tema-themeset) no meio). Há dois renderers: a pílula e, desde a spec `janela-principal`, a janela principal. A pílula continua a **única que grava**, porque `getUserMedia` só existe no renderer e a permissão de mídia é só dela (`src/main/pill-window.ts:1-3`). Regras do IPC da pílula, válidas para os canais `recorder:*` e `pill:state`:

- O preload expõe **só** as sete funções de `window.touchSpeaker` por `contextBridge` (`src/preload/pill.ts:22-30`). Nada de `ipcRenderer` genérico exposto, nem os canais da janela principal.
- Os nomes de canal vivem em `Channel` (`src/shared/ipc.ts:10-40`; os da pílula em `:11-18`). O preload roda em sandbox, não pode importar arquivo local e mantém uma cópia própria (`src/preload/pill.ts:6-14`); os tipos que o renderer enxerga espelham `ipc.ts` em `src/renderer/global.d.ts`. Os três arquivos mudam juntos.
- Todo payload dos canais `recorder:*` carrega o `sessionId`. O main ignora mensagem de outra sessão (`src/main/session.ts:164`, `:169`, `:177`) e a pílula ignora `stop`/`cancel` de outra sessão (`src/renderer/pill.ts:177`, `:184`). `pill:state` não traz `sessionId`: vale sempre a última mensagem recebida.
- O renderer é tratado como **não confiável**: o main confere o remetente e valida tipo e tamanho de tudo o que chega (`asStarted`, `asResult`, `asError`, `src/main/index.ts:76-107`). Payload inválido é descartado; só o de `recorder:result` deixa rastro no log (`ipc_rejected`, `index.ts:257`).

### Transcrição (Groq)

`POST https://api.groq.com/openai/v1/audio/transcriptions` — `GroqTranscriber.transcribe` (`src/main/transcribe/groq.ts:49-92`), atrás da interface `Transcriber` (ADR-04). Uma requisição por ditado, com a gravação inteira, mandada quando a fala termina.

**Antes de chamar** (sem rede):

- a chave em uso é lida agora, por `getApiKey` (`groq.ts:50`): uma chave salva ou removida em Configurações vale a partir deste ditado, sem reiniciar;
- sem chave → `no_api_key` (`groq.ts:51`);
- áudio com mais de 25 MB → `audio_too_large` (`groq.ts:52`);
- gravação com menos de 500 ms (`MIN_AUDIO_MS`) nem chega aqui: o `SessionController` a descarta em silêncio (BR-005, `src/main/session.ts:181-184`).

**Requisição:**

```http
POST /openai/v1/audio/transcriptions HTTP/1.1
Host: api.groq.com
Authorization: Bearer <chave em uso>
Content-Type: multipart/form-data; boundary=…
```

| Campo | Valor na Fase 1 | Observação |
| --- | --- | --- |
| `file` | a gravação da pílula, com o tipo que ela informou (normalmente `audio/webm;codecs=opus`) | Nome `audio.webm`; `audio.ogg` ou `audio.wav` se o tipo contiver `ogg` ou `wav` (`groq.ts:21-25`). Limite de 25 MB; 5 min de Opus a 32 kbps ficam em torno de 1,2 MB |
| `model` | `whisper-large-v3-turbo` | Vem do `config.json` (`transcription.model`); `whisper-large-v3` também é aceito ([`DATABASE.md`](DATABASE.md#configjson)) |
| `language` | `pt` | Vem do `config.json` (`language`), ISO-639-1. Fixar o idioma melhora precisão e latência |
| `temperature` | `0` | Saída determinística |
| `response_format` | `verbose_json` | Necessário para ler `segments[].no_speech_prob` |
| `prompt` | *(não enviado na Fase 1)* | **PLANEJADO (Fase 2):** termos do dicionário pessoal (FR-VOCAB-01) |

Timeout de **20 s** por tentativa (`AbortSignal.timeout`, `groq.ts:40`, `:68`).

**Resposta usada (`200`):**

```json
{
  "text": " Fazer o deploy no Docker amanhã cedo.",
  "language": "portuguese",
  "duration": 2.84,
  "segments": [
    { "id": 0, "start": 0.0, "end": 2.84, "text": " Fazer o deploy no Docker amanhã cedo.",
      "avg_logprob": -0.21, "no_speech_prob": 0.01, "compression_ratio": 0.9 }
  ]
}
```

O app usa `text` (com `trim()`), `duration` e, por segmento, `no_speech_prob`; os demais campos são ignorados. Antes de virar texto, a resposta passa pelos filtros anti-lixo (`isNoSpeech`, `src/main/transcribe/filters.ts:41-54`, BR-006): texto vazio; todos os segmentos com `no_speech_prob ≥ 0,6`; ou alucinação conhecida em áudio com menos de 3 s ou com média de `no_speech_prob ≥ 0,3`. Nesses casos o resultado é `no_speech`, descartado sem aviso.

**Erros tratados:**

| Situação | Código interno ([Códigos de erro](#códigos-de-erro)) | Nova tentativa |
| --- | --- | --- |
| `401` ou `403` — chave inválida ou revogada | `invalid_api_key` | não |
| `413` — arquivo grande demais | `audio_too_large` | não |
| `429` — limite de requisições ou de segundos de áudio | `rate_limited` | não; o `retry-after` não é lido |
| `5xx` — falha da Groq | `provider_error` | **uma**, 500 ms depois; se falhar de novo, `provider_error` |
| outro status de erro (ex.: `400`) | `provider_error` | não |
| `200` com corpo que não é JSON | `provider_error` | não |
| timeout (20 s) ou falha de rede | `network_error` | não |

Fonte: `errorForStatus` (`groq.ts:27-32`) e o laço de tentativas (`groq.ts:54-90`); testes em `src/test/groq.test.ts` (TEST-003). Visão de integração (papéis, fluxo, garantias): [`INTEGRATION.md`](INTEGRATION.md).

### `recorder:start`

main → pílula. Mandado por `SessionController.start` (`src/main/session.ts:108-113`) quando a tecla de ditado é pressionada com o app ocioso e uma chave em uso.

```ts
interface RecorderStartPayload {
  sessionId: string;        // UUID da sessão
  deviceId: string | null;  // config.json microphoneDeviceId; null = microfone padrão do Windows
  maxMs: number;            // config.json maxRecordingMs
  sounds: boolean;          // config.json sounds: bipe ao começar
}
```

A pílula abre o microfone com `getUserMedia` (mono, cancelamento de eco, supressão de ruído e ganho automático) e grava com `MediaRecorder` em `audio/webm;codecs=opus` a 32 kbps, ou `audio/webm` se o Opus não estiver disponível (`src/renderer/pill.ts:112-171`). Um `start` com outra gravação ainda aberta cancela a anterior (`pill.ts:113-116`). `maxMs` é enviado, mas a pílula não o usa: quem encerra a gravação no limite é o main (BR-011).

### `recorder:stop` e `recorder:cancel`

main → pílula. Payload `{ sessionId: string }` (`SessionRef`, `src/shared/ipc.ts:51-53`).

- **`recorder:stop`** (`src/main/session.ts:141`): a pílula para o `MediaRecorder`, fecha o microfone e devolve o áudio por `recorder:result`. Se o `stop` chega antes de o gravador existir, ela termina assim que ele começar (`src/renderer/pill.ts:170`, `:178-179`). O main espera o áudio por até 5 s (`RESULT_TIMEOUT_MS`, `session.ts:53`, `:143`); passou disso, a sessão falha com `recorder_failed`.
- **`recorder:cancel`** (`session.ts:154`): `Esc`, atalho detectado ou saída do app. A pílula para tudo, fecha o microfone e **não** devolve áudio (`pill.ts:182-189`). Erros não mandam `cancel`: num `recorder:error` a pílula já liberou o microfone.

### `pill:state`

main → pílula. Mandado por `PillWindow.setState` (`src/main/pill-window.ts:67-83`), que também mostra a janela sem tirar o foco do app (`showInactive`) e a esconde 200 ms depois de `hidden`.

```ts
interface PillState {
  state: 'listening' | 'transcribing' | 'error' | 'notice' | 'hidden';
  mode: 'hold' | 'handsfree';
  message?: string;   // texto pronto, vindo de src/main/strings.ts
  hint?: string;      // linha secundária
  warn?: boolean;     // gravação perto do limite
  sounds: boolean;    // tocar os bipes de fim e de erro
}
```

Os textos (`message`, `hint`) vêm prontos do main; o renderer não tem strings próprias. Aparência de cada estado: [`DESIGN.md`](DESIGN.md#72-estados-das-telas).

| `state` | Quando (`src/main/session.ts`) | `message` e `hint` |
| --- | --- | --- |
| `listening` | gravando (`:245-252`) | "Ouvindo…"; `hint` "toque de novo para terminar" em mãos livres, "Termina em 0:30" nos últimos 30 s (com `warn: true`) |
| `transcribing` | depois do `stop` (`:134`) | "Transcrevendo…" |
| `error` | falha com código (`:238-243`) | a mensagem do código ([Códigos de erro](#códigos-de-erro)); some depois de 4 s |
| `notice` | `paste_blocked` (`:214`) | "Texto copiado — cole com Ctrl+V"; some depois de 4 s |
| `hidden` | fim, cancelamento ou descarte (`:263-265`) | — |

### `recorder:started`

pílula → main. `{ sessionId: string, startedAt: number }`, com `startedAt` em ms desde a época (`Date.now()`, `src/renderer/pill.ts:169`). Mandado quando o microfone abriu e o `MediaRecorder` já está gravando. O main só registra no log a latência de abertura (`recorder_started` com `latency_ms`, `src/main/session.ts:163-166`) — medida em 17/out/2026: 75–270 ms (NFR-02). Validação: `sessionId` string e `startedAt` número (`asStarted`, `src/main/index.ts:82-86`).

### `recorder:result`

pílula → main. Depois do `stop`, com o áudio completo.

```ts
interface RecorderResultPayload {
  sessionId: string;
  audio: ArrayBuffer;   // a gravação inteira, só em memória
  mimeType: string;     // o tipo do MediaRecorder, ex.: "audio/webm;codecs=opus"
  durationMs: number;   // duração medida na pílula
}
```

Validação no main (`asResult`, `src/main/index.ts:94-101`): o remetente é a pílula; `sessionId` e `mimeType` são strings; `mimeType` começa com `audio/`; `durationMs` é número finito e ≥ 0; `audio` é um `ArrayBuffer` (uma view é copiada para um) de até 25 MB. Falhou em qualquer item → mensagem descartada e `ipc_rejected` no log; a sessão então expira em 5 s com `recorder_failed`. Passou → `SessionController.onRecorderResult` (`src/main/session.ts:176-238`): menos de 500 ms vira descarte silencioso; o resto segue para a [Transcrição (Groq)](#transcrição-groq). O áudio nunca é gravado em disco.

### `recorder:error`

pílula → main. `{ sessionId: string, code: 'mic_denied' | 'mic_unavailable' | 'recorder_failed', detail?: string }`.

| `code` | Quando (`src/renderer/pill.ts:62-67`, `:161-165`) |
| --- | --- |
| `mic_denied` | `getUserMedia` recusado (`NotAllowedError`, `SecurityError`) |
| `mic_unavailable` | sem microfone, microfone ocupado ou restrição impossível de atender (`NotFoundError`, `NotReadableError`, `OverconstrainedError`) |
| `recorder_failed` | qualquer outra falha ao abrir o microfone, ou o `MediaRecorder` não iniciou |

Validação (`asError`, `src/main/index.ts:103-107`): `sessionId` string e `code` na lista; fora disso a mensagem é ignorada. `detail` faz parte do tipo, mas a pílula não o envia e o main o descarta. Aceito → a sessão falha com o código e a pílula mostra a mensagem dele (`src/main/session.ts:168-174`).

### API do preload (`window.touchSpeaker`)

O preload (`src/preload/pill.ts`) expõe só isto, por `contextBridge.exposeInMainWorld('touchSpeaker', …)`. O formato que o renderer enxerga está em `src/renderer/global.d.ts:23-31`:

```ts
interface TouchSpeakerPillApi {
  onStart(callback: (payload: RecorderStartPayload) => void): void;
  onStop(callback: (payload: { sessionId: string }) => void): void;
  onCancel(callback: (payload: { sessionId: string }) => void): void;
  onState(callback: (payload: PillState) => void): void;
  started(payload: { sessionId: string; startedAt: number }): void;
  result(payload: { sessionId: string; audio: ArrayBuffer; mimeType: string; durationMs: number }): void;
  error(payload: { sessionId: string; code: RecorderErrorCode; detail?: string }): void;
}
```

As funções `on*` assinam um canal main → pílula; `started`, `result` e `error` enviam para o main. O preload repassa o payload sem validar (tipo `unknown`, `src/preload/pill.ts:16-29`): quem valida é o main.

### Janela principal — remetente, tipos e efeitos

Contrato dos canais da [tabela IPC main ⇄ janela principal](#ipc-main--janela-principal) (spec `janela-principal` §10, FR-UI-33; para os `history:*`, spec `historico` §10, FR-HIST-19). Regras válidas para todos eles:

- **Remetente** (`src/main/main-window.ts:53-57`, `src/main/main-window-ipc.ts:77-129`): `event.sender` tem de ser o `webContents` da janela principal **aberta agora** — o getter é lido a cada mensagem, porque a janela é recriada a cada abertura —; `event.senderFrame` tem de existir e não ter `parent` (quadro principal); a URL dele tem de ser `file:`, sem query nem host, com o caminho do `dist/renderer/main-window/index.html` do app (comparação sem diferenciar maiúsculas no Windows; o hash `#settings`, que abre Configurações na primeira execução, é aceito). Janela fechada → tudo recusado.
- **Payload exato** (`src/main/main-window-ipc.ts:13-75`, `src/main/history/ipc.ts:48-99`): canal sem payload aceita **nenhum** argumento (`isEmptyPayload`) — inclusive `history:get-retention` e `history:stats`; canal com payload aceita um argumento só, um objeto simples (protótipo `Object` ou `null`, não array) com **exatamente** as chaves do contrato e os tipos certos. A exceção é o `history:list`: as três chaves são opcionais, então ele aceita qualquer subconjunto de `query`, `cursor` e `limit`, e nada além delas (`onlyKeys`, `src/main/history/ipc.ts:48-78`).
- **Recusa — payload recusado → promessa rejeitada + `ipc_rejected`:** log `ipc_rejected` só com o `channel` e o `invoke` rejeita com um erro genérico, sem dado do payload (`src/main/index.ts:288-296`); nada toca o banco, o clipboard nem o `config.json` (FR-HIST-19). Um `app:relaunch` recusado só é ignorado, com o mesmo log (`index.ts:405-409`). O renderer trata a rejeição como falha: no `groq-key:set` e no `groq-key:remove`, mostra "Não foi possível salvar a chave"; nas ações do histórico, anuncia "Não foi possível concluir — tente de novo" (`src/renderer/main-window/main-window.ts:512-513`, `:525-527`, `:652-653`); no `history:set-retention`, o aviso de falha da retenção (`:782-783`); no `theme:set`, volta ao tema anterior e mostra "Não foi possível salvar o tema" (`:860-865`).
- **Sem `sessionId`:** os canais não pertencem a uma sessão de ditado.
- **Preloads separados:** o da janela não expõe `recorder:*` nem `pill:state`, e o da pílula não expõe nada da janela; o TEST-009 confere os nomes de canal dos dois preloads contra `src/shared/ipc.ts`. Os canais da pílula continuam aceitando só a pílula (`fromPill`).
- **A chave nunca volta:** nenhum tipo de resposta tem campo para ela; o renderer recebe só o estado.

Tipos (`src/shared/ipc.ts:87-183`, espelhados em `src/renderer/main-window/global.d.ts`); os do histórico estão em [Histórico](#histórico-history):

```ts
type GroqKeyState = 'stored' | 'env' | 'none' | 'unreadable';
type ThemePreference = 'system' | 'light' | 'dark';   // src/shared/theme.ts

interface AppStatus {
  groqKey: GroqKeyState;
  encryptionAvailable: boolean;   // safeStorage.isEncryptionAvailable()
  keyboardHook: boolean;          // startKeyboardHook carregou
  recording: boolean;             // de SessionController.onRecordingChange
  hotkey: HotkeyName;             // em uso (lida na abertura)
  holdThresholdMs: number;        // em uso (lido na abertura)
  howTo: string[];                // linhas de "Como ditar", já montadas no main
  microphone: 'default' | 'custom';
  theme: ThemePreference;         // a escolha em uso (config.json theme); o renderer resolve "system" sozinho
}

type ThemeResult =
  | { ok: true; theme: ThemePreference }
  | { ok: false; code: 'write_failed'; theme: ThemePreference };  // theme = o que continua em uso

interface EditableSettings {
  hotkey: HotkeyName;
  holdThresholdMs: number;        // inteiro, 200 a 1500
  maxRecordingMs: number;         // inteiro, 10000 a 300000, em ms (a tela mostra segundos e converte)
  language: string;               // ^[a-z]{2}$
  model: 'whisper-large-v3-turbo' | 'whisper-large-v3';
  pillPosition: 'bottom-center' | 'top-center';
  sounds: boolean;
}

interface SettingsView {
  values: EditableSettings;       // do config.json no disco, normalizados
  restartPending: boolean;        // disco diferente do que está em uso
  hotkeys: HotkeyName[];          // as 16 de HOTKEY_CODES
  microphone: 'default' | 'custom';                    // só leitura
  loginItem: { available: boolean; enabled: boolean }; // available = app empacotado
}

type SettingsResult =
  | { ok: true; restartPending: boolean }
  | { ok: false; code: 'invalid_field'; field: keyof EditableSettings }
  | { ok: false; code: 'write_failed' };

type LoginItemResult =
  | { ok: true; enabled: boolean }
  | { ok: false; code: 'unavailable' | 'login_item_failed'; enabled: boolean };

type GroqKeyResult =
  | { ok: true; state: GroqKeyState }
  | { ok: false; code: 'invalid_format' | 'encryption_unavailable' | 'write_failed' };
```

`MainWindowStrings` (`src/shared/ipc.ts:185-311`) é o subconjunto de `strings.ts` da janela, só com texto fixo — desde 18/out/2026 também os grupos `history`, `retention`, `home` e `theme` —: função não atravessa o IPC (o Electron serializa por clone estruturado). Os textos com valor chegam prontos: em `AppStatus.howTo`, montados no main com a tecla e o `holdThresholdMs` em uso (`src/main/index.ts:207-220`), e, no histórico, nos rótulos das próprias respostas (`dayLabel`, `retentionLabel`, `savedLabel`…).

**`app:get-strings`, `app:get-status` e `app:status`** — os textos (`mainWindowStrings()`) e o estado que o Início mostra, inclusive o `theme` em uso, lido pela janela ao abrir, antes de mostrar o conteúdo. O `app:status` é empurrado pelo main quando a chave é salva ou removida e quando a gravação começa ou termina, só se a janela existir (`src/main/index.ts:221`, `:236-240`, `:297-300`).

**`settings:get` e `settings:save`** — `settings:get` relê o `config.json` do disco a cada chamada, normalizado e sem registrar `config_invalid_field` (`src/main/settings.ts:134-138`), e relê o item de login do sistema (`src/main/login-item.ts:32-40`). `settings:save` valida os sete campos com o mesmo `normalizeConfig` da abertura — campo inválido → `{ ok: false, code: 'invalid_field', field }` e nada gravado —; senão grava pela fila única `ConfigWriter`, de forma atômica, trocando só os sete campos e preservando `version`, `transcription.provider`, `microphoneDeviceId`, `history.retentionDays`, `theme` e campos desconhecidos (`mergeSettings`, `src/main/settings.ts:81-99`; `ConfigWriter`, `src/main/config.ts`). `config.json` ausente → recriado com os padrões mais os valores da tela; `config.json` que não é objeto JSON → `write_failed`, e o arquivo **não** é sobrescrito. Os valores só valem depois de reiniciar: `restartPending: true` quando o disco fica diferente do que está em uso. A retenção do histórico não passa por este canal (é da spec `historico`); mandá-la aqui é chave a mais → `ipc_rejected`.

**`groq-key:set` e `groq-key:remove`** — `groq-key:set` confere o formato (`invalid_format`), a cifra (`encryption_unavailable`, nada gravado), cifra com `safeStorage.encryptString` e grava `groq-key.bin` de forma atômica (`write_failed` se a cifra lançar ou a gravação falhar); sucesso → `{ ok: true, state: 'stored' }`, e a bandeja e o `app:status` se atualizam (`src/main/index.ts:328-343`, `src/main/credentials.ts:95-114`). Não chama a Groq. `groq-key:remove` apaga o `groq-key.bin` e responde o estado que passa a valer — `env` (desenvolvimento com `.env`) ou `none`; falha ao apagar → `write_failed` (`src/main/index.ts:345-355`, `src/main/credentials.ts:117-125`). A chave vale a partir do próximo ditado, sem reiniciar.

**`login-item:set`** — "Iniciar com o Windows" (`src/main/login-item.ts`). Com o app não empacotado responde `{ ok: false, code: 'unavailable', enabled: false }` sem tocar no sistema, porque o item apontaria para o `electron.exe` sem o app (RISK-029). Empacotado: `app.setLoginItemSettings({ openAtLogin })`, relê o estado real — no Windows, `executableWillLaunchAtLogin`, que reflete a desativação feita no Gerenciador de Tarefas; nos outros sistemas, `openAtLogin` — e responde `{ ok: true, enabled }`; erro ou estado diferente do pedido → `login_item_failed` com o estado real (`src/main/login-item.ts:43-72`). Vale na hora, sem reiniciar e sem tocar no `config.json`.

**`app:relaunch`** — "Reiniciar agora": log `app_relaunch`, `app.relaunch()` e o mesmo caminho do "Sair" da bandeja, que cancela a sessão em andamento e para o hook (`src/main/index.ts:404-413`).

### Tema (`theme:set`)

Spec `janela-principal` FR-UI-39…42 (pedido do Victor de 18/out/2026). O `config.json` guarda a escolha em `theme`: `"system"` (padrão, segue o Windows), `"light"` ou `"dark"` ([`DATABASE.md`](DATABASE.md#configjson)).

- **Na abertura**, antes de criar qualquer janela, o main aplica a escolha com `nativeTheme.themeSource` (`ThemeSetting`, `src/main/theme-setting.ts:21-31`; `src/main/index.ts:117-128`): janela principal, moldura nativa e pílula seguem o tema escolhido. O ícone da bandeja continua seguindo o tema da barra de tarefas.
- **Pelo botão** de sol/lua da barra lateral (ou por "Seguir o sistema", em Configurações), a janela troca o próprio tema na hora (atributo `data-theme`) e chama `setTheme`. O main valida `{ theme }` (`asThemeInput`, `src/main/main-window-ipc.ts:63-68`; senão `ipc_rejected`), grava **só** o campo `theme` do `config.json` pela fila única `ConfigWriter` (`withTheme`, `src/main/config.ts:130-133`) e, só depois de gravar, aplica o `themeSource` (`src/main/theme-setting.ts:33-43`, `src/main/index.ts:369-372`).
- **Resposta:** `{ ok: true, theme }` com log `theme_changed` (`theme`); gravação que falha → `{ ok: false, code: 'write_failed', theme }`, com o `theme` que continua em uso, log `theme_write_failed` (`name`), e a janela volta a ele e mostra "Não foi possível salvar o tema".
- O `config.json` ganhou o campo sem mudar o `version` (continua `1`); valor inválido no arquivo → `"system"` com `config_invalid_field` `field: "theme"`.

### Histórico (`history:*`)

Spec [`historico`](spec/features/historico.md#10-contrato) §10 (FR-HIST-08…26) e spec de migração [`historico-dados-v1`](spec/features/historico-dados-v1.md) (banco e `history.retentionDays`). Os canais servem a tela Histórico, o controle "Guardar histórico" de Configurações e os cards "Ditados recentes" e "Seu uso" do Início. Quem responde é o `HistoryService` (`src/main/history/service.ts:129-378`); o banco é o SQLite local de [`DATABASE.md`](DATABASE.md). Sem rede: o histórico nunca sai da máquina.

```ts
type HistoryEntryStatus = 'inserted' | 'copied' | 'failed';   // como a inserção terminou
type RetentionDays = number | null;                           // 0 = nunca guardar, 1–3650 dias, null = para sempre
type HistoryAvailability = 'ok' | 'disabled' | 'unavailable'; // disabled = retenção 0; unavailable = banco não abriu

interface HistoryEntry {
  id: string;                 // sessionId (UUID v4) do ditado que a criou
  text: string;               // "…" — o texto completo do ditado
  createdAt: string;          // ISO-8601 UTC com milissegundos
  dayKey: string;             // AAAA-MM-DD no fuso local, para agrupar por dia
  dayLabel: string;           // "Hoje", "Ontem", "1 de outubro", "30 de dezembro de 2025"
  timeLabel: string;          // "14:32"
  durationLabel: string;      // "0:12"
  status: HistoryEntryStatus;
  statusLabel: string | null; // aviso de strings.ts; null para 'inserted'
  copyLabel: string;          // nome acessível do "Copiar", com dia e hora
  deleteLabel: string;        // nome acessível do "Apagar", com dia e hora
}

interface HistoryListInput { query?: string; cursor?: string | null; limit?: number }

interface HistoryListResult {
  status: HistoryAvailability;
  entries: HistoryEntry[];      // vazio quando status ≠ 'ok'
  nextCursor: string | null;    // opaco; null = não há próxima página
  retentionLabel: string;       // "Guardando os ditados dos últimos 30 dias"…
  unsavedCount: number;         // falhas de gravação desde que o app abriu (só em memória)
  unsavedLabel: string | null;  // o texto da faixa; null quando unsavedCount = 0
}

interface HistoryCopyResult   { result: 'copied' | 'not_found' | 'unavailable' }
interface HistoryDeleteResult { result: 'deleted' | 'not_found' | 'unavailable' }
interface HistoryClearResult  { result: 'cleared' | 'unavailable'; count: number }
interface HistoryRetentionView { retentionDays: RetentionDays; retentionLabel: string }

interface HistorySetRetentionResult {
  result: 'saved' | 'write_failed';
  retentionDays: RetentionDays; // a que fica em uso (a anterior, no write_failed)
  purged: number;               // entradas apagadas pela retenção nova
  savedLabel: string | null;    // "Salvo" ou "Salvo · N ditados mais antigos foram apagados"; null no write_failed
}

interface HistoryTotals {
  words: number; dictations: number; spokenMs: number;
  wordsLabel: string; dictationsLabel: string; spokenLabel: string;  // spokenLabel: "45 s", "12 min", "1 h 05 min"
}

interface HistoryStatsView {
  status: HistoryAvailability;
  today: HistoryTotals;          // dia local do sistema
  allTime: HistoryTotals;        // todo o histórico guardado
  wordsPerMinute: number | null; // null sem nenhuma entrada com duração
  wordsPerMinuteLabel: string;   // "—" sem dado
  retentionLabel: string;
}

interface HistoryChangedPayload { reason: 'saved' | 'deleted' | 'cleared' | 'purged' }
```

Fonte: `src/shared/ipc.ts:313-419`, espelhado em `src/renderer/main-window/global.d.ts`.

**`history:list`** — `{ query?, cursor?, limit? }`: `query` até 200 caracteres depois do `trim` (`''` = sem busca); `cursor` é o `nextCursor` de uma resposta anterior, opaco para a tela, até 128 caracteres e no formato que o próprio main gera; `limit` inteiro de 1 a 100, 50 por padrão (`asHistoryListInput`, `src/main/history/ipc.ts:52-78`). Devolve as entradas da mais nova para a mais antiga; com `query`, só as que contêm o termo, sem diferenciar maiúsculas, acentos e pontuação. Retenção `0` → `status: 'disabled'`; banco que não abriu ou leitura que falha → `status: 'unavailable'` (log `history_read_failed` só com o nome do erro); nos dois, `entries` vazio (`src/main/history/service.ts:176-197`). O Início usa o mesmo canal com `limit: 3` para os ditados recentes. O termo de busca nunca vai para o log.

**`history:copy`** — `{ id }`, um UUID v4 (`asHistoryIdInput`, `src/main/history/ipc.ts:80-85`). Achou a entrada → o **main** escreve o texto no clipboard (`clipboard.writeText`), log `history_copied` sem id nem texto, `{ result: 'copied' }`. Entrada que não existe mais (apagada ou vencida) → `not_found`, sem tocar no clipboard; banco indisponível → `unavailable` (`src/main/history/service.ts:199-213`). Nos dois casos a tela recarrega a lista (FR-HIST-13): a entrada some, ou aparece o estado "Histórico indisponível".

**`history:delete`** — `{ id }`, UUID v4. Apaga a entrada de modo que o texto não fique legível no arquivo nem no WAL (`secure_delete` + checkpoint), log `history_deleted`, `history:changed` com `reason: 'deleted'` e `{ result: 'deleted' }`; `not_found` e `unavailable` como no `history:copy` (`src/main/history/service.ts:215-229`).

**`history:clear`** — `{ confirmed: true }`, exatamente `true`: a segunda trava, além da confirmação em dois passos na própria tela (`asHistoryClearInput`, `src/main/history/ipc.ts:87-91`). Apaga todas as entradas, esvazia o WAL e compacta o arquivo (`VACUUM`); log `history_cleared` (`count`), `history:changed` com `reason: 'cleared'` e `{ result: 'cleared', count }`; banco indisponível ou falha → `{ result: 'unavailable', count: 0 }` (`src/main/history/service.ts:231-244`).

**`history:get-retention`** — nenhum argumento. `{ retentionDays, retentionLabel }` com a retenção **em uso** (`src/main/history/service.ts:246-248`).

**`history:set-retention`** — `{ retentionDays }`, inteiro de 0 a 3650 ou `null` (`asRetentionInput`, `src/main/history/ipc.ts:93-99`). O main regrava **só** `history.retentionDays` no `config.json` pela fila única `ConfigWriter` (`withRetention`, `src/main/config.ts:120-128`): as outras chaves de `history`, os outros campos, os desconhecidos e o `version` ficam como estavam; arquivo temporário + renomeação; `config.json` que não é objeto JSON não é sobrescrito. Gravou → a retenção nova vale na hora, sem reiniciar, com a purga das entradas mais antigas (log `history_retention_changed` com `retention_days` e `purged`; `history:changed` com `reason: 'purged'` se apagou alguma) e `{ result: 'saved', retentionDays, purged, savedLabel }`. Não gravou → log `config_write_failed` (`name`, nível `error`) e `{ result: 'write_failed', retentionDays: <a em uso>, purged: 0, savedLabel: null }` (`src/main/history/service.ts:255-273`).

**`history:stats`** — nenhum argumento. Agregado calculado no main, **sem nenhum texto ditado**: para hoje (dia local) e para todo o histórico, as palavras (tokens separados por espaço), o número de ditados e o tempo falado (soma das durações), e a média de palavras por minuto só sobre as entradas com duração maior que zero, arredondada (`null` e `"—"` sem nenhuma). Mesmo `status` do `history:list`; fora de `ok`, os totais vêm zerados e a tela mostra o estado, nunca os zeros (`src/main/history/service.ts:279-324`).

**`history:changed`** — main → janela (`send`), `{ reason }` sem conteúdo, mandado só se a janela existir (`src/main/index.ts:197`, `src/main/main-window.ts:73-75`): `saved` depois de cada entrada gravada, `deleted`, `cleared` e `purged` (retenção nova que apagou entradas). A tela à vista — Histórico ou Início — recarrega; as outras recarregam quando aparecem.

**Gravação** — a entrada não chega por IPC: o `SessionController` a entrega à porta `HistoryPort` (`save`, que nunca lança) depois do log `dictation_done` (ou `session_exception`, com `status: 'failed'`, se o texto já existia) (`src/main/session.ts:215-249`). Com retenção `0` nada é gravado. Falha ao gravar não muda o ditado: log `history_write_failed` e +1 no `unsavedCount` da tela Histórico (`src/main/history/service.ts:152-172`).

### API do preload (`window.touchSpeakerApp`)

O preload da janela (`src/preload/main-window.ts`) expõe só isto, por `contextBridge.exposeInMainWorld('touchSpeakerApp', …)` (`src/preload/main-window.ts:30-60`). O formato que o renderer enxerga está em `src/renderer/main-window/global.d.ts:283-307`:

```ts
interface TouchSpeakerAppApi {
  getStrings(): Promise<MainWindowStrings>;                       // invoke app:get-strings
  getStatus(): Promise<AppStatus>;                                // invoke app:get-status
  onStatus(callback: (status: AppStatus) => void): void;          // on app:status
  getSettings(): Promise<SettingsView>;                           // invoke settings:get
  saveSettings(input: EditableSettings): Promise<SettingsResult>; // invoke settings:save
  setGroqKey(key: string): Promise<GroqKeyResult>;                // invoke groq-key:set, com { key }
  removeGroqKey(): Promise<GroqKeyResult>;                        // invoke groq-key:remove
  setLoginItem(enabled: boolean): Promise<LoginItemResult>;       // invoke login-item:set, com { enabled }
  relaunch(): void;                                               // send app:relaunch
  setTheme(theme: ThemePreference): Promise<ThemeResult>;         // invoke theme:set, com { theme }
  history: HistoryApi;
}

interface HistoryApi {
  list(input: HistoryListInput): Promise<HistoryListResult>;                          // invoke history:list, o objeto como veio
  copy(id: string): Promise<HistoryCopyResult>;                                       // invoke history:copy, com { id }
  delete(id: string): Promise<HistoryDeleteResult>;                                   // invoke history:delete, com { id }
  clear(confirmed: true): Promise<HistoryClearResult>;                                // invoke history:clear, com { confirmed }
  getRetention(): Promise<HistoryRetentionView>;                                      // invoke history:get-retention
  setRetention(retentionDays: RetentionDays): Promise<HistorySetRetentionResult>;     // invoke history:set-retention, com { retentionDays }
  stats(): Promise<HistoryStatsView>;                                                 // invoke history:stats
  onChanged(callback: (payload: HistoryChangedPayload) => void): void;                // on history:changed
}
```

- `onStatus` e `history.onChanged` entregam ao callback só o payload; o evento do IPC fica no preload.
- `setGroqKey`, `setLoginItem`, `setTheme`, `history.copy`, `history.delete`, `history.clear` e `history.setRetention` embrulham o argumento em `{ key }`, `{ enabled }`, `{ theme }`, `{ id }`, `{ id }`, `{ confirmed }` e `{ retentionDays }`; `history.list` repassa o objeto como veio. O preload não valida nada (tipo `unknown`): quem valida é o main.
- A chave vai ao main uma vez, em `setGroqKey`, e nenhuma função a devolve. O texto dos ditados vem só nas respostas do `history.list`, nunca no `history.stats`.
- O preload da pílula não tem nenhuma destas funções.

## Códigos de erro

Um código interno por falha do ditado (`ErrorCode`, `src/main/errors.ts:2-14`). A mensagem em pt-BR sai de `errorMessage(code)` (`src/main/strings.ts:125-142`); como o mapa é um `Record<ErrorCode, string>`, todo código novo obriga a escrever a mensagem. O log guarda só o código. A união `ErrorCode` não mudou com a janela principal; os códigos dela estão em [Códigos da janela principal](#códigos-da-janela-principal).

| Código | Origem | Estado da pílula | Mensagem na pílula |
| --- | --- | --- | --- |
| `no_api_key` | nenhuma chave em uso: nada salvo em Configurações (ou a chave salva não pôde ser lida) e, em desenvolvimento, nenhum `GROQ_API_KEY` no `.env` (`session.ts:94-98`, `groq.ts:51`) | `error` | "Falta a chave da Groq — abra o Touch Speaker pela bandeja" (a pílula continua sem clique) |
| `invalid_api_key` | Groq `401` ou `403` | `error` | "Chave da Groq inválida" |
| `rate_limited` | Groq `429` | `error` | "Limite gratuito da Groq atingido — tente em instantes" |
| `network_error` | sem rede ou timeout de 20 s | `error` | "Sem conexão — tente de novo" |
| `provider_error` | Groq `5xx` depois da nova tentativa, outro status de erro, corpo inválido ou exceção inesperada na sessão (`session.ts:232-237`) | `error` | "A Groq falhou — tente de novo" |
| `audio_too_large` | Groq `413` ou validação local (> 25 MB antes do upload) | `error` | "Gravação longa demais" |
| `mic_denied` | pílula (`recorder:error`) | `error` | "Sem permissão para usar o microfone" |
| `mic_unavailable` | pílula (`recorder:error`) | `error` | "Microfone indisponível ou em uso" |
| `recorder_failed` | pílula (`recorder:error`) ou áudio que não chegou em 5 s depois do `stop` | `error` | "Falha ao gravar" |
| `no_speech` | filtro anti-lixo ou gravação < 500 ms | `hidden` | *(nada — silêncio é descartado sem aviso; log `session_empty`)* |
| `paste_blocked` | `TextInserter`: app em foco elevado ou `SendInput` recusado (`src/main/insert/inserter.ts:77-79`, `:93`) | `notice` | "Texto copiado — cole com Ctrl+V" (aviso, não erro) |
| `session_timeout` | `SessionController`: limite de `maxRecordingMs` | — | *(nada — a gravação é encerrada aos 5 min e transcrita normalmente; log `session_timeout`)* |

### Códigos da janela principal

Os códigos que os canais da janela principal devolvem nunca chegam à pílula e por isso ficam **fora** da união `ErrorCode`: os de `app:*`, `settings:*`, `groq-key:*` e `login-item:set` no tipo `MainWindowErrorCode` (`src/shared/ipc.ts:173-183`), o `write_failed` do `theme:set` no `ThemeResult.code`; os do histórico (`not_found`, `unavailable`, `disabled`, `write_failed`) **não** entram em `MainWindowErrorCode`: são os valores de `result` e `status` das próprias respostas (`HistoryCopyResult`, `HistoryDeleteResult`, `HistoryClearResult`, `HistoryAvailability`, `HistorySetRetentionResult` — [Histórico](#histórico-history)). Mensagens em `mainWindowStrings()` (`src/main/strings.ts:111-180`). Aparecem na própria tela — na região de mensagens (`role="status"`) ou, no histórico, no lugar da lista e dos cards do Início; o log guarda só o código ou o nome do erro, nunca a chave, valor de campo, texto ditado nem termo de busca. Um `invoke` recusado (`ipc_rejected`) não tem código: a tela mostra a falha genérica da ação ([Janela principal — remetente, tipos e efeitos](#janela-principal--remetente-tipos-e-efeitos)).

| Código | Canal | Quando | Mensagem na janela |
| --- | --- | --- | --- |
| `invalid_format` | `groq-key:set` | chave vazia depois de aparar as pontas, com espaço ou caractere de controle no meio, ou com mais de 512 caracteres | "Chave em formato inválido — confira se colou a chave inteira" |
| `encryption_unavailable` | `groq-key:set` | `safeStorage.isEncryptionAvailable()` falso; nada é gravado | "Este computador não permite guardar a chave com segurança" |
| `write_failed` | `groq-key:set`, `groq-key:remove` | a cifra lançou erro, ou gravar ou apagar o `groq-key.bin` falhou | "Não foi possível salvar a chave" |
| `invalid_field` | `settings:save` | um dos sete campos fora da regra do `normalizeConfig`; a resposta traz o `field` e a tela marca o campo | "Valor fora do permitido" |
| `write_failed` | `settings:save` | gravar o `config.json` falhou, ou o arquivo no disco não é objeto JSON (não é sobrescrito) | "Não foi possível salvar as configurações" |
| `unavailable` | `login-item:set` | app não empacotado (`npm run dev`); o sistema não é tocado | "Disponível no app instalado" |
| `login_item_failed` | `login-item:set` | `setLoginItemSettings` falhou ou o estado relido não é o pedido; a resposta traz o estado real | "Não foi possível mudar o início automático" |
| `write_failed` | `theme:set` | gravar o `config.json` falhou, ou o arquivo não é objeto JSON; a resposta traz o `theme` que continua em uso e a janela volta a ele | "Não foi possível salvar o tema" |
| `write_failed` | `history:set-retention` (`result`) | o `config.json` não pôde ser lido como objeto JSON ou a gravação falhou; o arquivo não é sobrescrito e a retenção em uso continua | "Não foi possível salvar — o config.json não pôde ser lido ou gravado" |
| `not_found` | `history:copy`, `history:delete` (`result`) | a entrada não existe mais (apagada ou vencida pela retenção); o clipboard não é tocado | *(nenhuma — a tela recarrega a lista)* |
| `unavailable` | `history:copy`, `history:delete`, `history:clear` (`result`); `history:list`, `history:stats` (`status`) | o banco não abriu na abertura do app, ou a leitura ou a gravação falhou agora | "Histórico indisponível — o ditado continua funcionando" (na tela Histórico e nos cards do Início) |
| `disabled` | `history:list`, `history:stats` (`status`) | retenção `0` ("Nunca guardar"): nada é guardado e a lista vem vazia | "O histórico está desligado — nada é guardado. Ligue em Configurações" (Histórico) · "O histórico está desligado — os ditados recentes e os números aparecem quando ele estiver ligado em Configurações" (Início) |

## Rotas quebradas

Nenhuma registrada na Fase 1.

---

Integração com a Groq: [`INTEGRATION.md`](INTEGRATION.md) · Dados: [`DATABASE.md`](DATABASE.md) · Arquitetura: [`ARCHITECTURE.md`](ARCHITECTURE.md) · Riscos de segurança: [`Security-Guide.md`](Security-Guide.md) · Decisões: [`DECISIONS.md`](DECISIONS.md)
