# INTEGRATION — Touch Speaker ⇄ Groq

> Última atualização: 18/out/2026 · Mantenedor: Victor Alves

> **Status:** na Fase 1 a única integração é externa: o processo main → Groq Cloud. Não há integração interna entre sistemas (o IPC main ⇄ pílula e o IPC main ⇄ janela principal são contratos internos do app, em [`API.md`](API.md#contratos)). Tudo o que está descrito aqui foi lido no código em 17/out/2026 e, depois da [spec `janela-principal`](spec/features/janela-principal.md) (chave da Groq digitada em Configurações, guardada pelo `safeStorage`), reconferido em 18/out/2026 no código ainda não commitado (**FATO**); o que vem nas fases seguintes aparece como **PLANEJADO** no fim. A janela principal **não** trouxe chamada HTTP nova: mudou só de onde o main tira a chave.

O Touch Speaker não transcreve sozinho: manda a gravação de cada ditado para o Whisper `large-v3-turbo` hospedado na Groq e usa o texto que volta. A chamada sai direto do app, com a chave do próprio usuário e sem servidor no meio ([ADR-06](DECISIONS.md#adr-06--sem-backend-na-fase-1)), levando o áudio inteiro de uma vez quando a fala termina ([ADR-04](DECISIONS.md#adr-04--groq-whisper-large-v3-turbo-áudio-inteiro-ao-soltar)). A Groq tem plano gratuito com folga para uso pessoal e transcreve muito rápido; o provedor fica atrás da interface `Transcriber`, então trocá-lo é escrever outro adapter, sem mexer no fluxo.

Este documento descreve a integração: papéis, fluxos, garantias e riscos. O contrato campo a campo (corpo, resposta, erros) está em [`API.md`](API.md#transcrição-groq).

## Papéis

| Lado | Componente | Papel |
| --- | --- | --- |
| **Cliente** (processo main) | `GroqTranscriber` (`src/main/transcribe/groq.ts`) | Monta o `multipart/form-data`, chama a Groq com timeout e uma nova tentativa em `5xx`, traduz o status HTTP num código interno e aplica os filtros anti-lixo (`src/main/transcribe/filters.ts`) |
| **Contrato** | `Transcriber` (`src/main/transcribe/transcriber.ts`) | Interface com `hasCredentials()` e `transcribe(audio, mimeType, { language })`, que é o que o `SessionController` enxerga. Trocar de provedor (OpenAI, whisper.cpp local) é escrever outra implementação dela |
| **Credencial** (processo main) | `CredentialStore` (`src/main/credentials.ts`) | Guarda a chave da Groq em memória e a entrega ao `GroqTranscriber` por `current()`; carrega, salva (cifrada pelo `safeStorage`) e remove o `groq-key.bin` ([ADR-08](DECISIONS.md#adr-08--chave-da-groq-no-safestorage-do-electron-com-o-env-só-como-reserva-de-desenvolvimento)) |
| **Provedor** | Groq Cloud, modelo `whisper-large-v3-turbo` | Transcreve o áudio e devolve texto, duração e segmentos com `no_speech_prob` |

Os caminhos de arquivo deste documento são relativos a `frontend/`.

## Fluxo: transcrição de um ditado

1. A tecla de ditado é pressionada. Sem chave em uso, a sessão nem começa: a pílula mostra `no_api_key` ("Falta a chave da Groq — abra o Touch Speaker pela bandeja") e nada é gravado (`SessionController.start`, `src/main/session.ts:86-90`).
2. Quando a fala termina, a pílula manda o áudio inteiro por `recorder:result` e o main valida o payload (`src/main/index.ts:87-94`).
3. Gravação com menos de 500 ms (`MIN_AUDIO_MS`) é descartada em silêncio, sem chamar a Groq (`session.ts:173-176`, BR-005).
4. O `GroqTranscriber` lê a chave em uso agora (`getApiKey`), confere de novo se ela existe e o tamanho (até 25 MB) e manda **um** `POST` multipart para `https://api.groq.com/openai/v1/audio/transcriptions`, com `model` e `language` do `config.json` (`groq.ts:49-69`).
5. A Groq responde em `verbose_json`. O app lê `text`, `duration` e `segments[].no_speech_prob` (`groq.ts:74-82`).
6. Os filtros anti-lixo decidem se aquilo é fala de verdade (`isNoSpeech`, `filters.ts:41-54`, BR-006). Silêncio ou alucinação → descarte sem aviso (`session_empty` no log).
7. O texto, já com `trim()`, passa pelo `Refiner` — identidade na Fase 1 (`src/main/refine.ts`, ADR-05) — e vai para a inserção por clipboard + Ctrl+V (`src/main/insert/inserter.ts`).
8. O log registra só metadados: `transcribe_ms`, `audio_ms`, `audio_bytes`, `chars`, `total_ms` e o resultado da inserção (`dictation_done`, `session.ts:204-213`).

## Fluxo: falha e nova tentativa

1. Timeout de **20 s** por tentativa (`AbortSignal.timeout`, `groq.ts:40`, `:68`). Estourou, ou não há rede → `network_error`, sem nova tentativa.
2. Resposta `5xx` na primeira tentativa → espera **500 ms** e tenta **uma** vez mais (`groq.ts:85-88`). Se a segunda também falhar com `5xx` → `provider_error`.
3. Qualquer outro status de erro (`401`, `403`, `413`, `429`, outros `4xx`) → código interno na hora, **sem** nova tentativa (`groq.ts:89`). Em `429`, o cabeçalho `retry-after` não é lido.
4. Resposta `200` com corpo que não é JSON → `provider_error` (`groq.ts:76-80`).
5. Toda falha termina igual: a sessão volta a ociosa, a pílula mostra a mensagem do código por 4 s e o log guarda `transcribe_failed` com o código e `transcribe_ms` (`session.ts:185-189`). Nada é inserido; o usuário fala de novo.

## Contrato

### Autenticação

| Item | Regra | Onde |
| --- | --- | --- |
| Credencial | `Authorization: Bearer <chave em uso>` em toda requisição | `src/main/transcribe/groq.ts:66` |
| De onde vem a chave | do `CredentialStore`, lida a cada chamada por `getApiKey` — salvar ou trocar a chave vale a partir do próximo ditado, sem reiniciar | `src/main/index.ts:160`, `groq.ts:9-14`, `:49-51` |
| Onde a chave vive | em memória, só no main; em disco, `%APPDATA%\Touch Speaker\groq-key.bin`, cifrado pelo `safeStorage` (DPAPI do Windows); em desenvolvimento, quando não existe `groq-key.bin`, o `GROQ_API_KEY` de `frontend/.env` (fora do git), lido só com o app não empacotado | `src/main/credentials.ts:68-83`, `src/main/index.ts:50-58`, `.gitignore` |
| Quem enxerga a chave | só o processo main; nunca o renderer (nenhuma resposta de IPC tem campo para ela), o log ou o `config.json` | `src/main/credentials.ts:85-88`, `src/shared/ipc.ts:152-154` |
| Sem chave | o app abre; a sessão não começa (`no_api_key`) | `src/main/session.ts:86-90` |
| Chave salva ilegível | estado `unreadable`, nenhuma chave em uso (o `.env` não substitui); para o ditado, igual a "sem chave" | `src/main/credentials.ts:73-82` |
| Chave recusada | `401` ou `403` → `invalid_api_key` | `groq.ts:28` |

Ciclo da chave:

1. **Criar:** console.groq.com → API Keys → Create API Key (o caminho também está no comentário de `frontend/.env.example`).
2. **Digitar:** a pessoa cola a chave em Configurações, na janela principal (abre pela bandeja; na primeira execução sem chave salva, abre sozinha), e escolhe "Salvar chave". O renderer manda a chave ao main **uma vez**, pelo `groq-key:set` ([`API.md`](API.md#ipc-main--janela-principal)), e limpa o campo.
3. **Cifrar e gravar:** o main confere o formato (1 a 512 caracteres depois de aparar as pontas, sem espaço nem caractere de controle), cifra com `safeStorage.encryptString` e grava o `groq-key.bin` de forma atômica (`src/main/credentials.ts:95-114`). Sem `safeStorage` disponível, recusa (`encryption_unavailable`) e não grava nada — nunca em texto puro.
4. **Usar:** a chave fica na memória do main; o `GroqTranscriber` a lê a cada ditado e ela só sai do processo no `Authorization: Bearer` para `api.groq.com`. Salvar **não** chama a Groq: uma chave errada aparece no primeiro ditado como `invalid_api_key`.
5. **Abrir o app de novo:** depois do `ready`, o main carrega `groq-key.bin` decifrado; senão, só com o app não empacotado, o `GROQ_API_KEY` do `.env`; senão, nenhuma (`src/main/credentials.ts:68-83`). O `.env` continua servindo a quem desenvolve: `copy .env.example .env` dentro de `frontend/`, colar o valor depois de `GROQ_API_KEY=` e reabrir o app ([`ENVIRONMENT.md`](ENVIRONMENT.md#o-arquivo-env)); a chave salva em Configurações tem precedência.
6. **Remover:** "Remover chave" apaga o `groq-key.bin`; passa a valer o `.env` (só em desenvolvimento) ou nenhuma.
7. **Revogar:** se a chave vazou (commit, print, upload), revogue no console da Groq na hora, gere outra e salve-a em Configurações.
8. **Por fase:** hoje no `groq-key.bin` cifrado, com o `.env` só como reserva de desenvolvimento — **FATO** desde a spec `janela-principal` ([ADR-08](DECISIONS.md#adr-08--chave-da-groq-no-safestorage-do-electron-com-o-env-só-como-reserva-de-desenvolvimento)); Fase 4 só no `backend/`, nunca dentro de app distribuído — **PLANEJADO** ([Security Guide §10](Security-Guide.md#10-segredos-e-configuração)).

### Campos enviados

Montados por `GroqTranscriber.transcribe` (`groq.ts:55-60`). Detalhe de cada campo em [`API.md`](API.md#transcrição-groq).

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

`errorForStatus` (`groq.ts:27-32`) mais os `catch` do laço de tentativas (`groq.ts:62-80`):

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

O app usa três campos da resposta `200` e ignora o resto (`groq.ts:74-82`):

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
| **Chave lida a cada chamada** | salvar, trocar ou remover a chave em Configurações vale a partir do próximo ditado, sem reiniciar o app; a chave é lida no início de cada transcrição, e a nova tentativa em `5xx` usa a mesma (`groq.ts:50`) |
| **Nenhuma chamada para validar a chave** | salvar a chave não fala com a Groq; a única saída de rede continua sendo a transcrição |
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
- **RISK-021 — A DPAPI protege por usuário do Windows, não por app:** outro processo rodando na mesma conta consegue decifrar o `groq-key.bin`. Aceito; a chave é revogável no console da Groq ([Security Guide §10](Security-Guide.md#10-segredos-e-configuração)).
- **RISK-022 — O `groq-key.bin` não sobrevive a troca de máquina, de perfil do Windows ou à perda do dado de cifra do Chromium:** o ditado volta a `no_api_key`. Mitigação: estado `unreadable` visível no Início e em Configurações, com "salve de novo".

A voz sai da máquina para a Groq, e a política de dados da Groq se aplica a esse áudio: [Security Guide §13](Security-Guide.md#13-privacidade-lgpd).

## Variáveis

| Variável | Para que serve | Onde está descrita |
| --- | --- | --- |
| `GROQ_API_KEY` | chave da Groq de reserva, só em desenvolvimento: lida de `frontend/.env` só com o app não empacotado e usada só quando não existe `groq-key.bin` (chave salva em Configurações); sem nenhuma das duas, o app abre, mas não transcreve | [`ENVIRONMENT.md`](ENVIRONMENT.md#variáveis) |

A URL da Groq, o timeout, a nova tentativa e o limite de 25 MB são fixos no código (`groq.ts:6-7`, `:40-41`); modelo e idioma vêm do `config.json` ([`DATABASE.md`](DATABASE.md#configjson)). A chave salva não é variável de ambiente: vive no `groq-key.bin` ([Contrato](#contrato)).

## Integrações planejadas

| Integração | Fase | Estado |
| --- | --- | --- |
| Anthropic (Claude Haiku) — limpeza do texto por IA, atrás da interface `Refiner` (FR-CLEAN-01, ADR-05) | 2 | **PLANEJADO** — `[PRECISA ESCLARECER: a definir na spec da Fase 2]` |
| Backend próprio — contas, chaves dos provedores fora do app, cota por usuário, streaming de áudio | 4 | **PLANEJADO** — rascunho em [`API.md`](API.md#api-própria-fase-4--rascunho) |

Nenhuma outra integração existe na Fase 1: sem telemetria, sem atualização automática, sem serviço remoto de erros. A única saída de rede é `https://api.groq.com` ([Security Guide §4](Security-Guide.md#4-rotas-públicas-e-rede)).

---

Dados: [`DATABASE.md`](DATABASE.md) · API: [`API.md`](API.md) · Arquitetura: [`ARCHITECTURE.md`](ARCHITECTURE.md) · Referência (não normativa): [`referencia/estudo-typeless.md`](referencia/estudo-typeless.md)
