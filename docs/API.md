# API — Touch Speaker

> **Versão:** 0.1 · **Data:** 17/out/2026

## 1. Visão geral

Na Fase 1 o Touch Speaker **não expõe API HTTP**. Há três contratos:

| # | Contrato | Entre | Seção |
| --- | --- | --- | --- |
| 1 | API externa de transcrição | `frontend` (main) → Groq | [§2](#2-api-externa-groq-transcription) |
| 2 | IPC interno | main ⇄ janela da pílula (renderer) | [§3](#3-contrato-ipc-main--pílula) |
| 3 | Códigos de erro e mensagens | todo o app | [§4](#4-códigos-de-erro) |

A API própria do `backend/` só existe na Fase 4 ([§5](#5-api-própria-fase-4--rascunho)).

## 2. API externa: Groq transcription

**Endpoint:** `POST https://api.groq.com/openai/v1/audio/transcriptions` (compatível com a API da OpenAI)

**Autenticação:** `Authorization: Bearer <GROQ_API_KEY>`. A chave sai do console da Groq
(console.groq.com → API Keys). Nunca vai para log nem para o renderer.

**Corpo:** `multipart/form-data`

| Campo | Valor na Fase 1 | Observação |
| --- | --- | --- |
| `file` | áudio `webm/opus` gravado pela pílula, nome `audio.webm` | Limite de 25 MB no plano gratuito; 5 min de opus ficam muito abaixo |
| `model` | `whisper-large-v3-turbo` | Configurável em `config.json` |
| `language` | `pt` | ISO-639-1. Fixar o idioma melhora precisão e latência |
| `temperature` | `0` | Saída determinística |
| `response_format` | `verbose_json` | Necessário para ler `segments[].no_speech_prob` |
| `prompt` | *(vazio na Fase 1)* | Fase 2: termos do dicionário pessoal |

**Resposta usada (200):**

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

O app usa `text` (com `trim()`), `duration` e, por segmento, `no_speech_prob`. Os demais campos são
ignorados.

**Erros tratados:**

| HTTP | Significado | Código interno (§4) |
| --- | --- | --- |
| 401 | Chave inválida ou revogada | `invalid_api_key` |
| 413 | Arquivo grande demais | `audio_too_large` |
| 429 | Limite de requisições ou de segundos de áudio | `rate_limited` (respeita `retry-after` se vier) |
| 5xx | Falha da Groq | `provider_error` (1 nova tentativa após 500 ms) |
| — | Timeout (20 s) ou sem rede | `network_error` |

**Limites do plano gratuito** (números de terceiros, set/2026 — o console da Groq é a fonte oficial):
20 requisições/min, 2.000/dia, 7.200 s de áudio/hora, 28.800 s/dia, cobrança mínima de 10 s por
requisição. Limites valem por organização, não por chave.

## 3. Contrato IPC (main ⇄ pílula)

A pílula é a única janela com renderer na Fase 1. Ela grava o áudio porque `getUserMedia` só existe
no renderer.

**Regras:**

- O preload expõe **só** as funções abaixo via `contextBridge`, em `window.touchSpeaker`.
  Nada de `ipcRenderer` genérico exposto.
- Todo evento carrega `sessionId` (UUID gerado no main). O main descarta mensagens de sessão que
  não é a atual.
- O main valida tipos e tamanhos de tudo que chega do renderer (áudio ≤ 25 MB).

### main → pílula

| Canal | Payload | Quando |
| --- | --- | --- |
| `recorder:start` | `{ sessionId: string, deviceId: string \| null, maxMs: number, sounds: boolean }` | Tecla pressionada (início de sessão) |
| `recorder:stop` | `{ sessionId: string }` | Fim da fala (soltou ou segundo toque) |
| `recorder:cancel` | `{ sessionId: string }` | `Esc`, atalho detectado ou erro antes de terminar |
| `pill:state` | `{ state: 'listening' \| 'transcribing' \| 'error' \| 'notice' \| 'hidden', mode: 'hold' \| 'handsfree', message?: string, hint?: string, warn?: boolean, sounds: boolean }` | Toda mudança de estado da sessão. Os textos (`message`, `hint`) vêm prontos do main; o renderer não tem strings próprias |

### pílula → main

| Canal | Payload | Quando |
| --- | --- | --- |
| `recorder:started` | `{ sessionId: string, startedAt: number }` | Microfone aberto e `MediaRecorder` rodando |
| `recorder:result` | `{ sessionId: string, audio: ArrayBuffer, mimeType: string, durationMs: number }` | Depois do `stop`, com o áudio completo |
| `recorder:error` | `{ sessionId: string, code: 'mic_denied' \| 'mic_unavailable' \| 'recorder_failed', detail?: string }` | Falha ao abrir ou gravar |

Fonte no código: `frontend/src/shared/ipc.ts` (main) e cópia dos nomes de canal em
`frontend/src/preload/pill.ts` (o preload em sandbox não pode importar arquivos locais).

### API do preload (`window.touchSpeaker`)

```ts
interface TouchSpeakerPillApi {
  onStart(cb: (p: { sessionId: string; deviceId: string | null; maxMs: number; sounds: boolean }) => void): void;
  onStop(cb: (p: { sessionId: string }) => void): void;
  onCancel(cb: (p: { sessionId: string }) => void): void;
  onState(cb: (p: PillState) => void): void;
  started(p: { sessionId: string; startedAt: number }): void;
  result(p: { sessionId: string; audio: ArrayBuffer; mimeType: string; durationMs: number }): void;
  error(p: { sessionId: string; code: RecorderErrorCode; detail?: string }): void;
}
```

## 4. Códigos de erro

Um código interno por falha; a pílula mostra a mensagem em pt-BR. O log guarda só o código.

| Código | Origem | Mensagem na pílula |
| --- | --- | --- |
| `no_api_key` | Config | "Falta a chave da Groq — veja o README" |
| `invalid_api_key` | Groq 401 | "Chave da Groq inválida" |
| `rate_limited` | Groq 429 | "Limite gratuito da Groq atingido — tente em instantes" |
| `network_error` | Rede/timeout | "Sem conexão — tente de novo" |
| `provider_error` | Groq 5xx | "A Groq falhou — tente de novo" |
| `audio_too_large` | Groq 413 / validação local | "Gravação longa demais" |
| `mic_denied` | Recorder | "Sem permissão para usar o microfone" |
| `mic_unavailable` | Recorder | "Microfone indisponível ou em uso" |
| `recorder_failed` | Recorder | "Falha ao gravar" |
| `no_speech` | Filtro anti-lixo | *(nada — silêncio é descartado sem aviso)* |
| `paste_blocked` | Inserter | "Texto copiado — cole com Ctrl+V" (aviso, não erro) |
| `session_timeout` | Session | *(gravação encerrada aos 5 min e transcrita normalmente)* |

## 5. API própria (Fase 4 — rascunho)

Quando houver distribuição para outras pessoas, as chaves dos provedores saem do app e passam a
viver no `backend/`. Esboço, sujeito à spec da Fase 4:

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/v1/auth/*` | Login e sessão do app desktop |
| `POST` | `/v1/dictations` | Recebe áudio + metadados, transcreve, (opcional) limpa, devolve texto |
| `GET` | `/v1/me/usage` | Consumo e cota do usuário |
| `GET/PUT` | `/v1/me/dictionary` | Dicionário pessoal |
| `WS` | `/v1/dictations/stream` | Streaming de áudio durante a fala (reduz latência) |
