# API — Touch Speaker

> Última atualização: 17/out/2026 · Mantenedor: Victor Alves

> **Status:** na Fase 1 o Touch Speaker **não tem API HTTP própria** e não escuta porta nenhuma. Existem três contratos, todos implementados e descritos aqui a partir do código (**FATO**, conferido em 17/out/2026): a chamada **externa** à Groq para transcrever ([Transcrição (Groq)](#transcrição-groq)), o **IPC** entre o processo main e a janela da pílula ([Contratos](#contratos)) e os **códigos de erro** que atravessam o app ([Códigos de erro](#códigos-de-erro)). A API própria do `backend/` só existe na Fase 4 e aparece aqui como rascunho ([API própria (Fase 4 — rascunho)](#api-própria-fase-4--rascunho)).

Os caminhos de arquivo deste documento são relativos a `frontend/`.

## Visão geral

- **Base URL:** `https://api.groq.com` — a única saída de rede do app, chamada só pelo processo main (`src/main/transcribe/groq.ts:6`). Não há servidor local nem porta aberta.
- **Formato:** com a Groq, `multipart/form-data` na ida e JSON (`verbose_json`) na volta. No IPC, mensagens do Electron com payloads tipados em `src/shared/ipc.ts`. Não há versionamento, OpenAPI nem Swagger.
- **Auth:** `Authorization: Bearer <GROQ_API_KEY>` na chamada à Groq, montado só no main (`groq.ts:61`). O IPC não tem credencial: o main confere o **remetente** de cada mensagem (só a pílula é aceita) e valida o payload — ver [Contratos](#contratos).
- **Envelope:** a resposta da Groq é usada como vem (`text`, `duration`, `segments[]`). No IPC não há envelope comum; todo payload dos canais `recorder:*` traz o `sessionId` (UUID gerado no main, `src/main/session.ts:93`).
- **Erros:** cada falha vira **um** código interno (`src/main/errors.ts`); a pílula mostra a mensagem em pt-BR que corresponde ao código (`src/main/strings.ts`) e o log guarda só o código, nunca conteúdo ([Códigos de erro](#códigos-de-erro)).

Mapa no código: a chamada HTTP está em `src/main/transcribe/groq.ts`, atrás da interface `Transcriber` (`src/main/transcribe/transcriber.ts`); os canais e payloads do IPC em `src/shared/ipc.ts`, com cópia dos nomes em `src/preload/pill.ts` e dos tipos em `src/renderer/global.d.ts`; a validação do que chega do renderer em `src/main/index.ts:49-80`.

## Estado atual

A Fase 1 está implementada (tarefas T1–T8 da [spec `ditado-por-voz`](spec/features/ditado-por-voz.md), 17/out/2026) e os três contratos deste documento estão no código, conferidos em `ed0a1f5`. A chamada à Groq é coberta por testes com `fetch` simulado; o IPC e a pílula só têm verificação manual.

| Contrato | Entre | Onde no código | Verificação |
| --- | --- | --- | --- |
| Transcrição (Groq) | main → Groq | `src/main/transcribe/groq.ts` | TEST-003 (`src/test/groq.test.ts`, 9 casos); ditado real no V2 |
| IPC main ⇄ pílula | main ⇄ renderer | `src/shared/ipc.ts`, `src/preload/pill.ts`, `src/main/index.ts`, `src/renderer/pill.ts` | roteiro manual V1–V13 da spec; só o V2 feito |
| Códigos de erro | todo o app | `src/main/errors.ts`, `src/main/strings.ts` | TEST-003 cobre os códigos da Groq; os demais só no roteiro manual |

O que falta: o roteiro manual V1 e V3–V13 (entre eles os caminhos de erro — sem chave, sem rede, limite, microfone, colagem bloqueada) — **PENDÊNCIA PEND-001** — e o fechamento da spec — **PENDÊNCIA PEND-002** ([SDD, Apêndice B](spec/spec-driven-development.md#apêndice-b--pendências)).

## Autenticação

O único segredo da Fase 1 é a chave da Groq do próprio usuário. O main a lê de `frontend/.env` (`process.loadEnvFile`, `src/main/index.ts:34-38`), entrega ao `GroqTranscriber` (`index.ts:125`) e ela só sai do processo no cabeçalho `Authorization` da chamada à Groq (`groq.ts:61`). Nunca vai para o renderer, para o log nem para o `config.json`.

| Fase | Onde vive a chave | Quem chama o provedor | Estado |
| --- | --- | --- | --- |
| 1 (desenvolvimento) | `frontend/.env`, fora do git | o main, direto na Groq | **FATO** |
| 2 | `safeStorage` do Electron (DPAPI do Windows), digitada na tela de configurações | o main, direto na Groq | **PLANEJADO (Fase 2)** |
| 4 | só no `backend/`; o app autentica o usuário e o backend chama os provedores | o backend | **PLANEJADO (Fase 4)** |

- **Sem chave**, o app abre normalmente; a sessão nem começa e a pílula mostra `no_api_key` (BR-013, `src/main/session.ts:86-90`). O `GroqTranscriber` também recusa sem chamar a rede (`groq.ts:46`).
- **Chave inválida ou revogada:** a Groq responde `401` ou `403` e o app mostra `invalid_api_key`.
- **Chave vazou:** revogue no console da Groq (console.groq.com → API Keys) e gere outra. Ciclo completo da chave em [`INTEGRATION.md`](INTEGRATION.md#contrato); regras em [`Security-Guide.md`](Security-Guide.md#10-segredos-e-configuração).
- **Não distribuir** o app com chave embutida: quem precisa disso é o backend da Fase 4 ([ADR-06](DECISIONS.md#adr-06--sem-backend-na-fase-1)).

### Papéis

Não se aplica na Fase 1: é um app local de um único usuário, sem contas nem papéis. Contas chegam com o backend da Fase 4 (FR-ACC-01, **PLANEJADO (Fase 4)**). O que existe de controle de acesso é técnico: a checagem de remetente no IPC (só a janela da pílula fala com o main, `src/main/index.ts:150`) e a permissão de mídia restrita à pílula e a áudio (BR-015, `index.ts:107-113`).

### Rate limit

**Limites da Groq (plano gratuito).** Números de fonte de terceiros (set/2026); o console da Groq é a fonte oficial — **PENDÊNCIA PEND-004**.

| Limite | Valor |
| --- | --- |
| Requisições | 20 por minuto · 2.000 por dia |
| Segundos de áudio | 7.200 s por hora · 28.800 s por dia |
| Cobrança mínima | 10 s de áudio por requisição |
| Escopo | por organização, não por chave |

`[PRECISA ESCLARECER: confirmar no console da Groq os limites atuais do plano gratuito (PEND-004)]`

Ao bater no limite, a Groq responde `429` e o app mostra `rate_limited` **sem nova tentativa** (`groq.ts:26`, `:80-84`); o cabeçalho `retry-after` não é lido.

**Limites locais (FATO):**

- áudio de até **25 MB** por gravação, conferido duas vezes: na entrada do IPC (`MAX_AUDIO_BYTES`, `src/main/index.ts:24`, `:72`) e antes do upload (`MAX_UPLOAD_BYTES`, `groq.ts:7`, `:47`);
- gravação de até **5 min** (`maxRecordingMs`, padrão 300 000 ms), com aviso 30 s antes do fim (BR-011, `src/main/session.ts:107-117`);
- **uma sessão por vez**: com uma sessão em andamento, o `start` não abre outra (BR-014, `session.ts:84`);
- **uma requisição por ditado**, mais no máximo uma nova tentativa em `5xx`.

## Endpoints

Legenda de acesso: **main** = só o processo main · **pílula** = só a janela da pílula; o main confere o remetente (`event.sender === pill.webContents`, `src/main/index.ts:150`) e valida o payload antes de usar.

### Groq (externo)

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `POST` | `https://api.groq.com/openai/v1/audio/transcriptions` | main, `Authorization: Bearer` | Transcreve a gravação inteira de um ditado; API compatível com a da OpenAI — [contrato](#transcrição-groq) |

### IPC main → pílula

Enviados pelo main com `webContents.send` (`src/main/pill-window.ts:62-64`); a pílula escuta pelas funções `on*` do preload.

| Canal | Acesso | Quando | Contrato |
| --- | --- | --- | --- |
| `recorder:start` | main | início da sessão: tecla de ditado pressionada com o app ocioso e a chave presente | [`recorder:start`](#recorderstart) |
| `recorder:stop` | main | fim da fala: soltou a tecla depois de `holdThresholdMs`, segundo toque em mãos livres ou limite de `maxRecordingMs` | [`recorder:stop` e `recorder:cancel`](#recorderstop-e-recordercancel) |
| `recorder:cancel` | main | `Esc`, atalho detectado (outra tecla logo depois da de ditado) ou saída do app com gravação aberta | [`recorder:stop` e `recorder:cancel`](#recorderstop-e-recordercancel) |
| `pill:state` | main | toda mudança de estado visível da sessão | [`pill:state`](#pillstate) |

### IPC pílula → main

Enviados pela pílula com `ipcRenderer.send`, pelas funções do preload (`src/preload/pill.ts:27-29`); o main escuta com `ipcMain.on` (`src/main/index.ts:151-163`).

| Canal | Acesso | Quando | Contrato |
| --- | --- | --- | --- |
| `recorder:started` | pílula | microfone aberto e `MediaRecorder` gravando | [`recorder:started`](#recorderstarted) |
| `recorder:result` | pílula | depois do `stop`, com o áudio completo | [`recorder:result`](#recorderresult) |
| `recorder:error` | pílula | falha ao abrir o microfone ou ao gravar | [`recorder:error`](#recordererror) |

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

Dois tipos de contrato: o HTTP com a Groq (primeira subseção) e o IPC entre o main e a pílula (as demais). Regras do IPC, válidas para todos os canais abaixo:

- A pílula é a **única janela com renderer** na Fase 1. É ela que grava, porque `getUserMedia` só existe no renderer (`src/main/pill-window.ts:1-2`).
- O preload expõe **só** as sete funções de `window.touchSpeaker` por `contextBridge` (`src/preload/pill.ts:22-30`). Nada de `ipcRenderer` genérico exposto.
- Os nomes de canal vivem em `Channel` (`src/shared/ipc.ts:5-13`). O preload roda em sandbox, não pode importar arquivo local e mantém uma cópia própria (`src/preload/pill.ts:6-14`); os tipos que o renderer enxerga espelham `ipc.ts` em `src/renderer/global.d.ts`. Os três arquivos mudam juntos.
- Todo payload dos canais `recorder:*` carrega o `sessionId`. O main ignora mensagem de outra sessão (`src/main/session.ts:156`, `:161`, `:169`) e a pílula ignora `stop`/`cancel` de outra sessão (`src/renderer/pill.ts:177`, `:184`). `pill:state` não traz `sessionId`: vale sempre a última mensagem recebida.
- O renderer é tratado como **não confiável**: o main confere o remetente e valida tipo e tamanho de tudo o que chega (`asStarted`, `asResult`, `asError`, `src/main/index.ts:51-80`). Payload inválido é descartado; só o de `recorder:result` deixa rastro no log (`ipc_rejected`, `index.ts:158`).

### Transcrição (Groq)

`POST https://api.groq.com/openai/v1/audio/transcriptions` — `GroqTranscriber.transcribe` (`src/main/transcribe/groq.ts:45-87`), atrás da interface `Transcriber` (ADR-04). Uma requisição por ditado, com a gravação inteira, mandada quando a fala termina.

**Antes de chamar** (sem rede):

- sem chave → `no_api_key` (`groq.ts:46`);
- áudio com mais de 25 MB → `audio_too_large` (`groq.ts:47`);
- gravação com menos de 500 ms (`MIN_AUDIO_MS`) nem chega aqui: o `SessionController` a descarta em silêncio (BR-005, `src/main/session.ts:173-176`).

**Requisição:**

```http
POST /openai/v1/audio/transcriptions HTTP/1.1
Host: api.groq.com
Authorization: Bearer <GROQ_API_KEY>
Content-Type: multipart/form-data; boundary=…
```

| Campo | Valor na Fase 1 | Observação |
| --- | --- | --- |
| `file` | a gravação da pílula, com o tipo que ela informou (normalmente `audio/webm;codecs=opus`) | Nome `audio.webm`; `audio.ogg` ou `audio.wav` se o tipo contiver `ogg` ou `wav` (`groq.ts:17-21`). Limite de 25 MB; 5 min de Opus a 32 kbps ficam em torno de 1,2 MB |
| `model` | `whisper-large-v3-turbo` | Vem do `config.json` (`transcription.model`); `whisper-large-v3` também é aceito ([`DATABASE.md`](DATABASE.md#configjson)) |
| `language` | `pt` | Vem do `config.json` (`language`), ISO-639-1. Fixar o idioma melhora precisão e latência |
| `temperature` | `0` | Saída determinística |
| `response_format` | `verbose_json` | Necessário para ler `segments[].no_speech_prob` |
| `prompt` | *(não enviado na Fase 1)* | **PLANEJADO (Fase 2):** termos do dicionário pessoal (FR-VOCAB-01) |

Timeout de **20 s** por tentativa (`AbortSignal.timeout`, `groq.ts:36`, `:63`).

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

Fonte: `errorForStatus` (`groq.ts:23-28`) e o laço de tentativas (`groq.ts:49-86`); testes em `src/test/groq.test.ts` (TEST-003). Visão de integração (papéis, fluxo, garantias): [`INTEGRATION.md`](INTEGRATION.md).

### `recorder:start`

main → pílula. Mandado por `SessionController.start` (`src/main/session.ts:100-105`) quando a tecla de ditado é pressionada com o app ocioso e a chave presente.

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

main → pílula. Payload `{ sessionId: string }` (`SessionRef`, `src/shared/ipc.ts:36-38`).

- **`recorder:stop`** (`src/main/session.ts:133`): a pílula para o `MediaRecorder`, fecha o microfone e devolve o áudio por `recorder:result`. Se o `stop` chega antes de o gravador existir, ela termina assim que ele começar (`src/renderer/pill.ts:170`, `:178-179`). O main espera o áudio por até 5 s (`RESULT_TIMEOUT_MS`, `session.ts:45`, `:135`); passou disso, a sessão falha com `recorder_failed`.
- **`recorder:cancel`** (`session.ts:146`): `Esc`, atalho detectado ou saída do app. A pílula para tudo, fecha o microfone e **não** devolve áudio (`pill.ts:182-189`). Erros não mandam `cancel`: num `recorder:error` a pílula já liberou o microfone.

### `pill:state`

main → pílula. Mandado por `PillWindow.setState` (`src/main/pill-window.ts:66-82`), que também mostra a janela sem tirar o foco do app (`showInactive`) e a esconde 200 ms depois de `hidden`.

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

pílula → main. `{ sessionId: string, startedAt: number }`, com `startedAt` em ms desde a época (`Date.now()`, `src/renderer/pill.ts:169`). Mandado quando o microfone abriu e o `MediaRecorder` já está gravando. O main só registra no log a latência de abertura (`recorder_started` com `latency_ms`, `src/main/session.ts:155-158`) — medida em 17/out/2026: 75–270 ms (NFR-02). Validação: `sessionId` string e `startedAt` número (`asStarted`, `src/main/index.ts:55-59`).

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

Validação no main (`asResult`, `src/main/index.ts:67-74`): o remetente é a pílula; `sessionId` e `mimeType` são strings; `mimeType` começa com `audio/`; `durationMs` é número finito e ≥ 0; `audio` é um `ArrayBuffer` (uma view é copiada para um) de até 25 MB. Falhou em qualquer item → mensagem descartada e `ipc_rejected` no log; a sessão então expira em 5 s com `recorder_failed`. Passou → `SessionController.onRecorderResult` (`src/main/session.ts:168-220`): menos de 500 ms vira descarte silencioso; o resto segue para a [Transcrição (Groq)](#transcrição-groq). O áudio nunca é gravado em disco.

### `recorder:error`

pílula → main. `{ sessionId: string, code: 'mic_denied' | 'mic_unavailable' | 'recorder_failed', detail?: string }`.

| `code` | Quando (`src/renderer/pill.ts:62-67`, `:161-165`) |
| --- | --- |
| `mic_denied` | `getUserMedia` recusado (`NotAllowedError`, `SecurityError`) |
| `mic_unavailable` | sem microfone, microfone ocupado ou restrição impossível de atender (`NotFoundError`, `NotReadableError`, `OverconstrainedError`) |
| `recorder_failed` | qualquer outra falha ao abrir o microfone, ou o `MediaRecorder` não iniciou |

Validação (`asError`, `src/main/index.ts:76-80`): `sessionId` string e `code` na lista; fora disso a mensagem é ignorada. `detail` faz parte do tipo, mas a pílula não o envia e o main o descarta. Aceito → a sessão falha com o código e a pílula mostra a mensagem dele (`src/main/session.ts:160-166`).

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

## Códigos de erro

Um código interno por falha (`ErrorCode`, `src/main/errors.ts:2-14`). A mensagem em pt-BR sai de `errorMessage(code)` (`src/main/strings.ts:18-35`); como o mapa é um `Record<ErrorCode, string>`, todo código novo obriga a escrever a mensagem. O log guarda só o código.

| Código | Origem | Estado da pílula | Mensagem na pílula |
| --- | --- | --- | --- |
| `no_api_key` | `.env` sem `GROQ_API_KEY` (`session.ts:86-90`) | `error` | "Falta a chave da Groq — veja o README" |
| `invalid_api_key` | Groq `401` ou `403` | `error` | "Chave da Groq inválida" |
| `rate_limited` | Groq `429` | `error` | "Limite gratuito da Groq atingido — tente em instantes" |
| `network_error` | sem rede ou timeout de 20 s | `error` | "Sem conexão — tente de novo" |
| `provider_error` | Groq `5xx` depois da nova tentativa, outro status de erro, corpo inválido ou exceção inesperada na sessão (`session.ts:216-219`) | `error` | "A Groq falhou — tente de novo" |
| `audio_too_large` | Groq `413` ou validação local (> 25 MB antes do upload) | `error` | "Gravação longa demais" |
| `mic_denied` | pílula (`recorder:error`) | `error` | "Sem permissão para usar o microfone" |
| `mic_unavailable` | pílula (`recorder:error`) | `error` | "Microfone indisponível ou em uso" |
| `recorder_failed` | pílula (`recorder:error`) ou áudio que não chegou em 5 s depois do `stop` | `error` | "Falha ao gravar" |
| `no_speech` | filtro anti-lixo ou gravação < 500 ms | `hidden` | *(nada — silêncio é descartado sem aviso; log `session_empty`)* |
| `paste_blocked` | `TextInserter`: app em foco elevado ou `SendInput` recusado (`src/main/insert/inserter.ts:77-79`, `:93`) | `notice` | "Texto copiado — cole com Ctrl+V" (aviso, não erro) |
| `session_timeout` | `SessionController`: limite de `maxRecordingMs` | — | *(nada — a gravação é encerrada aos 5 min e transcrita normalmente; log `session_timeout`)* |

## Rotas quebradas

Nenhuma registrada na Fase 1.

---

Integração com a Groq: [`INTEGRATION.md`](INTEGRATION.md) · Dados: [`DATABASE.md`](DATABASE.md) · Arquitetura: [`ARCHITECTURE.md`](ARCHITECTURE.md) · Riscos de segurança: [`Security-Guide.md`](Security-Guide.md) · Decisões: [`DECISIONS.md`](DECISIONS.md)
