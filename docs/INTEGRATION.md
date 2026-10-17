# INTEGRATION — Touch Speaker ⇄ Groq

> Última atualização: 17/out/2026 · Mantenedor: Victor Alves

> **Status:** na Fase 1 a única integração é externa: o processo main → Groq Cloud. Não há integração interna entre sistemas (o IPC main ⇄ pílula é contrato interno do app, em [`API.md`](API.md#contratos)). Tudo o que está descrito aqui foi lido no código em 17/out/2026 (**FATO**); o que vem nas fases seguintes aparece como **PLANEJADO** no fim.

O Touch Speaker não transcreve sozinho: manda a gravação de cada ditado para o Whisper `large-v3-turbo` hospedado na Groq e usa o texto que volta. A chamada sai direto do app, com a chave do próprio usuário e sem servidor no meio ([ADR-06](DECISIONS.md#adr-06--sem-backend-na-fase-1)), levando o áudio inteiro de uma vez quando a fala termina ([ADR-04](DECISIONS.md#adr-04--groq-whisper-large-v3-turbo-áudio-inteiro-ao-soltar)). A Groq tem plano gratuito com folga para uso pessoal e transcreve muito rápido; o provedor fica atrás da interface `Transcriber`, então trocá-lo é escrever outro adapter, sem mexer no fluxo.

Este documento descreve a integração: papéis, fluxos, garantias e riscos. O contrato campo a campo (corpo, resposta, erros) está em [`API.md`](API.md#transcrição-groq).

## Papéis

| Lado | Componente | Papel |
| --- | --- | --- |
| **Cliente** (processo main) | `GroqTranscriber` (`src/main/transcribe/groq.ts`) | Monta o `multipart/form-data`, chama a Groq com timeout e uma nova tentativa em `5xx`, traduz o status HTTP num código interno e aplica os filtros anti-lixo (`src/main/transcribe/filters.ts`) |
| **Contrato** | `Transcriber` (`src/main/transcribe/transcriber.ts`) | Interface com `hasCredentials()` e `transcribe(audio, mimeType, { language })`, que é o que o `SessionController` enxerga. Trocar de provedor (OpenAI, whisper.cpp local) é escrever outra implementação dela |
| **Provedor** | Groq Cloud, modelo `whisper-large-v3-turbo` | Transcreve o áudio e devolve texto, duração e segmentos com `no_speech_prob` |

Os caminhos de arquivo deste documento são relativos a `frontend/`.

## Fluxo: transcrição de um ditado

1. A tecla de ditado é pressionada. Sem chave, a sessão nem começa: a pílula mostra `no_api_key` e nada é gravado (`SessionController.start`, `src/main/session.ts:86-90`).
2. Quando a fala termina, a pílula manda o áudio inteiro por `recorder:result` e o main valida o payload (`src/main/index.ts:67-74`).
3. Gravação com menos de 500 ms (`MIN_AUDIO_MS`) é descartada em silêncio, sem chamar a Groq (`session.ts:173-176`, BR-005).
4. O `GroqTranscriber` confere de novo a chave e o tamanho (até 25 MB) e manda **um** `POST` multipart para `https://api.groq.com/openai/v1/audio/transcriptions`, com `model` e `language` do `config.json` (`groq.ts:45-64`).
5. A Groq responde em `verbose_json`. O app lê `text`, `duration` e `segments[].no_speech_prob` (`groq.ts:69-77`).
6. Os filtros anti-lixo decidem se aquilo é fala de verdade (`isNoSpeech`, `filters.ts:41-54`, BR-006). Silêncio ou alucinação → descarte sem aviso (`session_empty` no log).
7. O texto, já com `trim()`, passa pelo `Refiner` — identidade na Fase 1 (`src/main/refine.ts`, ADR-05) — e vai para a inserção por clipboard + Ctrl+V (`src/main/insert/inserter.ts`).
8. O log registra só metadados: `transcribe_ms`, `audio_ms`, `audio_bytes`, `chars`, `total_ms` e o resultado da inserção (`dictation_done`, `session.ts:204-213`).

## Fluxo: falha e nova tentativa

1. Timeout de **20 s** por tentativa (`AbortSignal.timeout`, `groq.ts:36`, `:63`). Estourou, ou não há rede → `network_error`, sem nova tentativa.
2. Resposta `5xx` na primeira tentativa → espera **500 ms** e tenta **uma** vez mais (`groq.ts:80-83`). Se a segunda também falhar com `5xx` → `provider_error`.
3. Qualquer outro status de erro (`401`, `403`, `413`, `429`, outros `4xx`) → código interno na hora, **sem** nova tentativa (`groq.ts:84`). Em `429`, o cabeçalho `retry-after` não é lido.
4. Resposta `200` com corpo que não é JSON → `provider_error` (`groq.ts:71-75`).
5. Toda falha termina igual: a sessão volta a ociosa, a pílula mostra a mensagem do código por 4 s e o log guarda `transcribe_failed` com o código e `transcribe_ms` (`session.ts:185-189`). Nada é inserido; o usuário fala de novo.

## Contrato

### Autenticação

| Item | Regra | Onde |
| --- | --- | --- |
| Credencial | `Authorization: Bearer <GROQ_API_KEY>` em toda requisição | `src/main/transcribe/groq.ts:61` |
| Onde a chave vive (Fase 1) | `frontend/.env`, lido pelo main ao abrir; fora do git | `src/main/index.ts:34-38`, `.gitignore` |
| Quem enxerga a chave | só o processo main; nunca o renderer, o log ou o `config.json` | `index.ts:125` |
| Sem chave | o app abre; a sessão não começa (`no_api_key`) | `src/main/session.ts:86-90` |
| Chave recusada | `401` ou `403` → `invalid_api_key` | `groq.ts:24` |

Ciclo da chave:

1. **Criar:** console.groq.com → API Keys → Create API Key (o caminho também está no comentário de `frontend/.env.example`).
2. **Instalar:** `copy .env.example .env` dentro de `frontend/`, colar o valor depois de `GROQ_API_KEY=` e reabrir o app ([`ENVIRONMENT.md`](ENVIRONMENT.md#o-arquivo-env)).
3. **Revogar:** se a chave vazou (commit, print, upload), revogue no console da Groq na hora e gere outra.
4. **Por fase:** Fase 1 em `frontend/.env`; Fase 2 no `safeStorage` do Electron (DPAPI do Windows) — **PLANEJADO**; Fase 4 só no `backend/`, nunca dentro de app distribuído — **PLANEJADO** ([Security Guide §10](Security-Guide.md#10-segredos-e-configuração)).

### Campos enviados

Montados por `GroqTranscriber.transcribe` (`groq.ts:50-55`). Detalhe de cada campo em [`API.md`](API.md#transcrição-groq).

| Campo | Valor | De onde vem |
| --- | --- | --- |
| `file` | a gravação inteira, como `audio.webm` (`.ogg` ou `.wav` conforme o tipo) | `recorder:result` da pílula |
| `model` | `whisper-large-v3-turbo` (ou `whisper-large-v3`) | `config.json`, `transcription.model` |
| `language` | `pt` | `config.json`, `language` |
| `temperature` | `0` | fixo no código |
| `response_format` | `verbose_json` | fixo no código |
| `prompt` | não enviado | **PLANEJADO (Fase 2):** termos do dicionário pessoal (FR-VOCAB-01) |

Nada mais sai do app nessa chamada: nem texto de ditados anteriores, nem o nome do app em foco, nem dado do usuário além da voz.

### Mapa HTTP → código interno

`errorForStatus` (`groq.ts:23-28`) mais os `catch` do laço de tentativas (`groq.ts:58-75`):

| Resposta | Código interno | Nova tentativa |
| --- | --- | --- |
| `401` ou `403` | `invalid_api_key` | não |
| `413` | `audio_too_large` | não |
| `429` | `rate_limited` | não |
| `5xx` | `provider_error` | uma, após 500 ms |
| outro status de erro | `provider_error` | não |
| timeout (20 s) ou falha de rede | `network_error` | não |
| `200` com JSON inválido | `provider_error` | não |

Mensagens que a pílula mostra para cada código: [`API.md`](API.md#códigos-de-erro).

## Respostas

O app usa três campos da resposta `200` e ignora o resto (`groq.ts:69-77`):

| Campo | Uso |
| --- | --- |
| `text` | o texto ditado, com `trim()`; vazio conta como "sem fala" |
| `duration` | duração do áudio em segundos; o filtro de alucinação trata áudio com menos de 3 s como suspeito |
| `segments[].no_speech_prob` | probabilidade de silêncio por segmento: todos ≥ 0,6 → descarte; média ≥ 0,3 numa alucinação conhecida → descarte |

O que o usuário vê em cada situação:

| Situação | O que acontece |
| --- | --- |
| Fala reconhecida | o texto é colado no cursor do app em foco, o clipboard volta ao que era e a pílula some (`outcome: inserted` no log) |
| Fala reconhecida, mas o app em foco roda elevado ou a colagem foi recusada | o texto fica no clipboard e a pílula avisa "Texto copiado — cole com Ctrl+V" (`paste_blocked`, `outcome: copied`) |
| Silêncio ou alucinação (ex.: "Legendas pela comunidade Amara.org") | nada é inserido e nada é mostrado (`session_empty` no log) |
| Erro da Groq ou da rede | a pílula mostra a mensagem do código por 4 s; nada é inserido |

## Garantias e limites

| Garantia | O que significa na prática |
| --- | --- |
| **Timeout de 20 s por tentativa** | um ditado não fica "Transcrevendo…" para sempre por causa da rede; no pior caso (`5xx` lento seguido de nova tentativa lenta), cerca de 40 s até o erro |
| **Uma nova tentativa, só em `5xx`** | falha passageira da Groq é absorvida; erro de chave, tamanho ou limite volta na hora, sem repetir a chamada |
| **Uma requisição por ditado** | o áudio inteiro vai num `POST` só, quando a fala termina; não há streaming ([ADR-04](DECISIONS.md#adr-04--groq-whisper-large-v3-turbo-áudio-inteiro-ao-soltar)) |
| **Áudio só em memória** | a gravação vai da pílula ao main por IPC e do main à Groq; nunca é gravada em disco |
| **Até 25 MB por gravação** | conferido no IPC e antes do upload; 5 min de Opus a 32 kbps ficam em torno de 1,2 MB, longe do limite |
| **Até 5 min por gravação** | `maxRecordingMs` encerra a gravação, que é transcrita normalmente (BR-011) |
| **Limites do plano gratuito** | 20 requisições/min, 2.000/dia, 7.200 s de áudio/hora, 28.800 s/dia, mínimo de 10 s cobrados por requisição, por organização — números de terceiros, a confirmar ([`API.md`](API.md#rate-limit), PEND-004) |
| **Latência medida** | 17/out/2026: 0,66–0,88 s do fim da fala ao texto inserido, em falas de 4,6 s e 10,5 s. A meta NFR-01 (p50 ≤ 1,5 s, p95 ≤ 3 s) vale para falas ≤ 30 s e ainda não tem medição p50/p95 (PEND-001) |

## Riscos

Registrados no SDD ([§26](spec/spec-driven-development.md#26-riscos-e-mitigações)):

- **RISK-001 — Groq muda ou corta o plano gratuito:** o MVP para de transcrever. Mitigação: `Transcriber` atrás de interface; trocar por OpenAI ou whisper.cpp local é um adapter novo (ADR-04). Aberto.
- **RISK-002 — Whisper "alucina" frases em silêncio** ("Legendas pela comunidade Amara.org"): texto falso inserido no documento. Mitigado pelos filtros anti-lixo (FR-DICT-08, `src/main/transcribe/filters.ts`, 8 testes).
- **RISK-012 — Whisper erra termos técnicos:** o usuário corrige à mão. Mitigação na Fase 2: `prompt` com o dicionário pessoal (FR-VOCAB-01). Aberto.
- **RISK-014 — Latência cresce com falas longas** (upload do áudio inteiro ao soltar): NFR-01 só é garantido para falas ≤ 30 s. Aceito; streaming fica para a Fase 4, com o backend.

A voz sai da máquina para a Groq, e a política de dados da Groq se aplica a esse áudio: [Security Guide §13](Security-Guide.md#13-privacidade-lgpd).

## Variáveis

| Variável | Para que serve | Onde está descrita |
| --- | --- | --- |
| `GROQ_API_KEY` | chave da Groq; sem ela o app abre, mas não transcreve | [`ENVIRONMENT.md`](ENVIRONMENT.md#variáveis) |

A URL da Groq, o timeout, a nova tentativa e o limite de 25 MB são fixos no código (`groq.ts:6-7`, `:36-37`); modelo e idioma vêm do `config.json` ([`DATABASE.md`](DATABASE.md#configjson)).

## Integrações planejadas

| Integração | Fase | Estado |
| --- | --- | --- |
| Anthropic (Claude Haiku) — limpeza do texto por IA, atrás da interface `Refiner` (FR-CLEAN-01, ADR-05) | 2 | **PLANEJADO** — `[PRECISA ESCLARECER: a definir na spec da Fase 2]` |
| Backend próprio — contas, chaves dos provedores fora do app, cota por usuário, streaming de áudio | 4 | **PLANEJADO** — rascunho em [`API.md`](API.md#api-própria-fase-4--rascunho) |

Nenhuma outra integração existe na Fase 1: sem telemetria, sem atualização automática, sem serviço remoto de erros. A única saída de rede é `https://api.groq.com` ([Security Guide §4](Security-Guide.md#4-rotas-públicas-e-rede)).

---

Dados: [`DATABASE.md`](DATABASE.md) · API: [`API.md`](API.md) · Arquitetura: [`ARCHITECTURE.md`](ARCHITECTURE.md) · Referência (não normativa): [`referencia/estudo-typeless.md`](referencia/estudo-typeless.md)
