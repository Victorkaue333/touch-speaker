# DATABASE — Touch Speaker

> Última atualização: 17/out/2026 · Mantenedor: Victor Alves

> **Status:** a Fase 1 **não tem banco de dados**. O app guarda em disco só três coisas: o `config.json` do usuário, o log em arquivo e, em desenvolvimento, a chave da Groq em `frontend/.env` (**FATO**, conferido no código em 17/out/2026). O SQLite local por usuário (`better-sqlite3`, migrations em `database/local/`) é **PLANEJADO (Fase 2)**; o banco do servidor (Postgres, migrations em `database/server/`) é **PLANEJADO (Fase 4)**.

Os caminhos de código deste documento são relativos a `frontend/`. `%APPDATA%\Touch Speaker\` é a pasta de dados do app: o main fixa o `userData` do Electron nela (`src/main/index.ts:28`).

Princípio que atravessa todas as fases: **áudio não é persistido** e **texto ditado só fica na máquina do usuário** (até existir sync opcional e explícito na Fase 4). Na Fase 1 o texto ditado nem chega ao disco: passa pelo clipboard e é inserido no app em foco.

## SGBD

| Item | Valor | Onde |
| --- | --- | --- |
| Fase 1 | **Nenhum.** Configuração em JSON e log em arquivo de texto | `src/main/config.ts`, `src/main/logger.ts` |
| Pasta de dados | `%APPDATA%\Touch Speaker\` (`userData` do Electron) | `src/main/index.ts:28` |
| Fase 2 | SQLite local por usuário (`better-sqlite3`) em `%APPDATA%\Touch Speaker\touch-speaker.db`, com `journal_mode=WAL` — **PLANEJADO** | `database/local/` (ainda não existe; hoje só há `database/README.md`) |
| Fase 4 | Banco do servidor (Postgres) — **PLANEJADO** | `database/server/` (ainda não existe) |

- **Sem banco, sem servidor de banco, sem porta.** Nada a instalar ou subir para rodar a Fase 1 ([`ENVIRONMENT.md`](ENVIRONMENT.md)).
- **O `config.json` não está no repositório.** Nasce na primeira execução, com os defaults (`loadConfig`, `src/main/config.ts:93-99`).
- **É lido uma vez, ao abrir o app** (`src/main/index.ts:88`). Editou o arquivo, reinicie o app.
- **O app só escreve o `config.json` quando ele não existe.** Um arquivo com campo inválido não é corrigido no disco: o default vale só em memória, e o aviso vai para o log a cada abertura.
- **Banco do servidor (Fase 4):** fora do escopo agora. Quando existir: usuários, cotas, dicionário sincronizado e uso agregado. **Sem** texto ditado no servidor por padrão.

```powershell
# A Fase 1 não tem banco nem "migrate". Para voltar a configuração aos defaults, com o app fechado:
Remove-Item "$env:APPDATA\Touch Speaker\config.json"
# o próximo "npm run dev" (ou "npm start"), de dentro de frontend/, recria o arquivo com os defaults

# abrir a pasta de dados (o menu da bandeja tem o mesmo atalho: "Abrir pasta de configuração")
explorer "$env:APPDATA\Touch Speaker"
```

> **Apagar o `config.json` só desfaz as suas configurações.** Não há outro dado de usuário a perder na Fase 1: o áudio nunca foi gravado e o texto ditado nunca foi guardado. O log fica em `logs\` e só tem diagnóstico.

## Identidade e autorização

Não se aplica na Fase 1: não há contas, usuários nem papéis — o app é de uma pessoa, na máquina dela, com a chave da Groq dela. Identidade e contas chegam com o backend da Fase 4 (FR-ACC-01, **PLANEJADO (Fase 4)**).

## Modelos

| Modelo | Onde | Descrição | Status |
| --- | --- | --- | --- |
| `config.json` | `%APPDATA%\Touch Speaker\config.json` | Preferências do usuário: tecla, limites de tempo, idioma, provedor e modelo, microfone, posição da pílula, sons | **FATO** |
| `.env` | `frontend/.env` | Chave da Groq, só em desenvolvimento | **FATO** |
| Log | `%APPDATA%\Touch Speaker\logs\main.log` (+ `main.1.log`, `main.2.log`) | Eventos do app, só metadados | **FATO** |
| `dictations` | SQLite local | Histórico dos ditados | **PLANEJADO (Fase 2)** |
| `dictionary_terms` | SQLite local | Dicionário pessoal | **PLANEJADO (Fase 2)** |
| `schema_migrations` | SQLite local | Registro das migrations aplicadas | **PLANEJADO (Fase 2)** |

### `config.json`

Local: `%APPDATA%\Touch Speaker\config.json`. Criado com os defaults na primeira execução (`src/main/config.ts:93-99`) e validado campo a campo por `normalizeConfig` (`config.ts:46-90`, BR-012). O tipo é `AppConfig` (`config.ts:7-17`); os defaults são `DEFAULT_CONFIG` (`config.ts:21-31`):

```json
{
  "version": 1,
  "hotkey": "RightCtrl",
  "holdThresholdMs": 500,
  "maxRecordingMs": 300000,
  "language": "pt",
  "transcription": {
    "provider": "groq",
    "model": "whisper-large-v3-turbo"
  },
  "microphoneDeviceId": null,
  "pill": { "position": "bottom-center" },
  "sounds": true
}
```

| Campo | Tipo | Default | Regra (`src/main/config.ts`) |
| --- | --- | --- | --- |
| `version` | int | `1` | Versão do formato, para migração de config quando ele mudar. O valor lido não é conferido hoje: `normalizeConfig` sempre devolve `version: 1` |
| `hotkey` | string | `"RightCtrl"` | Uma de `RightCtrl`, `RightAlt`, `RightShift`, `CapsLock`, `F13`–`F24` (`HOTKEY_CODES`, `src/main/keys.ts:6-23`) |
| `holdThresholdMs` | int | `500` | Inteiro de 200 a 1500 (`config.ts:60`). Soltar antes disso = toque (mãos livres); depois = segurar para falar |
| `maxRecordingMs` | int | `300000` | Inteiro de 10 000 a 300 000 (`config.ts:61`; 5 min, FR-DICT-11). O aviso aparece 30 s antes do fim |
| `language` | string | `"pt"` | Duas letras minúsculas (`^[a-z]{2}$`, `config.ts:64`): o código ISO-639-1 enviado ao Whisper |
| `transcription.provider` | enum | `"groq"` | Só `groq` na Fase 1 |
| `transcription.model` | string | `"whisper-large-v3-turbo"` | `whisper-large-v3-turbo` ou `whisper-large-v3` (`config.ts:33`) |
| `microphoneDeviceId` | string \| null | `null` | `null` = microfone padrão do Windows; uma string é passada ao `getUserMedia` como `deviceId` exato |
| `pill.position` | enum | `"bottom-center"` | `bottom-center` \| `top-center` |
| `sounds` | bool | `true` | Bipe curto ao iniciar e ao terminar a gravação, e no erro |

Como a validação trata cada caso (`normalizeConfig` e `loadConfig`; testes em `src/test/config.test.ts`, TEST-004):

| Caso | Resultado | Aviso no log (`config_invalid_field`) |
| --- | --- | --- |
| Arquivo não existe | criado com os defaults | — |
| Conteúdo que não é JSON | todos os defaults | `field: "json"` |
| JSON cuja raiz não é um objeto | todos os defaults | `field: "root"` |
| Campo conhecido com valor inválido | default naquele campo; os outros valem | `field` com o nome do campo; `transcription` e `pill` são conferidos como objeto inteiro |
| Campo ausente | default, sem aviso | — |
| Campo desconhecido | ignorado, sem aviso | — |

O app nunca deixa de abrir por causa de config.

### `.env`

Só em desenvolvimento: `frontend/.env`, com uma linha `GROQ_API_KEY=<sua chave>`, criado a partir de `frontend/.env.example` (que só tem o nome da variável). Fica fora do git (`.gitignore`: `.env`, `.env.*`, `!.env.example`). O main o lê ao abrir (`process.loadEnvFile`, `src/main/index.ts:34-38`); sem o arquivo, o app abre e a pílula mostra `no_api_key`. Na Fase 2 a chave passa para o `safeStorage` do Electron (DPAPI do Windows) — **PLANEJADO (Fase 2)**; ver [Security Guide §10](Security-Guide.md#10-segredos-e-configuração). Detalhes da variável: [`ENVIRONMENT.md`](ENVIRONMENT.md#o-arquivo-env).

### Log

`%APPDATA%\Touch Speaker\logs\main.log`, escrito pelo `Logger` (`src/main/logger.ts`).

- **Formato:** uma linha JSON por evento, com `t` (horário ISO-8601 em UTC), `level` (`info`, `warn` ou `error`), `event` (nome em snake_case) e campos extras. Os campos extras só aceitam valores primitivos — `string`, `number`, `boolean` ou `null` —, restrição imposta pelo tipo `LogFields` (`logger.ts:6-7`).
- **Rotação:** antes de cada escrita, se `main.log` passou de 5 MB, `main.1.log` vira `main.2.log` e `main.log` vira `main.1.log` (`logger.ts:42-55`). No máximo três arquivos, cerca de 15 MB.
- **Grava:** início e fim de sessão, modo, duração e tamanho do áudio, latência de cada etapa, quantidade de caracteres inseridos, resultado da inserção, códigos de erro, versão do app. A sessão aparece só pelos 8 primeiros caracteres do `sessionId` (`src/main/session.ts:49`). Lista de eventos: [`ENVIRONMENT.md`](ENVIRONMENT.md#log).
- **Não grava:** texto transcrito, áudio, conteúdo do clipboard, teclas, título de janela nem a chave ([Security Guide §12](Security-Guide.md#12-logs-e-observabilidade)).
- **Nunca derruba o ditado:** falha ao escrever é engolida em silêncio (`logger.ts:34-39`).

### `dictations` (Fase 2 — planejado)

**PLANEJADO (Fase 2).** Uma linha por ditado. `text_raw` = saída do Whisper; `text_final` = depois do `Refiner` (igual a `text_raw` enquanto não houver limpeza). O `id` reaproveita o `sessionId`.

```sql
-- database/local/0001_init.sql
CREATE TABLE dictations (
  id          TEXT PRIMARY KEY,                -- UUID v4 (sessionId)
  created_at  TEXT NOT NULL,                   -- ISO-8601 UTC
  mode        TEXT NOT NULL CHECK (mode IN ('hold', 'handsfree')),
  status      TEXT NOT NULL CHECK (status IN ('inserted', 'copied', 'empty', 'cancelled', 'failed')),
  text_raw    TEXT,
  text_final  TEXT,
  audio_ms    INTEGER NOT NULL,
  latency_ms  INTEGER,                         -- soltar tecla → texto inserido
  provider    TEXT NOT NULL,
  model       TEXT NOT NULL,
  error_code  TEXT                             -- códigos de docs/API.md, "Códigos de erro"
);
```

Índices:

```sql
CREATE INDEX idx_dictations_created_at ON dictations (created_at DESC);  -- lista do histórico
CREATE INDEX idx_dictations_status ON dictations (status);               -- métricas de falha
```

### `dictionary_terms` (Fase 2 — planejado)

**PLANEJADO (Fase 2).** Termos do dicionário pessoal (FR-VOCAB-01), enviados no `prompt` do Whisper e na limpeza.

```sql
CREATE TABLE dictionary_terms (
  id          TEXT PRIMARY KEY,
  term        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  source      TEXT NOT NULL CHECK (source IN ('manual', 'learned')),
  created_at  TEXT NOT NULL,
  use_count   INTEGER NOT NULL DEFAULT 0
);
```

### `schema_migrations` (Fase 2 — planejado)

**PLANEJADO (Fase 2).** Uma linha por migration aplicada ([Migrations](#migrations)).

```sql
CREATE TABLE schema_migrations (
  version     INTEGER PRIMARY KEY,
  applied_at  TEXT NOT NULL
);
```

### Diagrama

A Fase 1 não tem tabelas. O diagrama abaixo é o do SQLite da Fase 2 — **PLANEJADO**:

```text
┌──────────────────────────┐        ┌──────────────────────────┐
│ dictations               │        │ dictionary_terms         │
├──────────────────────────┤        ├──────────────────────────┤
│ id            TEXT PK    │        │ id          TEXT PK      │
│ created_at    TEXT       │        │ term        TEXT UNIQUE  │
│ mode          TEXT       │        │ source      TEXT         │
│ status        TEXT       │        │ created_at  TEXT         │
│ text_raw      TEXT       │        │ use_count   INTEGER      │
│ text_final    TEXT       │        └──────────────────────────┘
│ audio_ms      INTEGER    │
│ latency_ms    INTEGER    │        ┌──────────────────────────┐
│ provider      TEXT       │        │ schema_migrations        │
│ model         TEXT       │        ├──────────────────────────┤
│ error_code    TEXT       │        │ version     INTEGER PK   │
└──────────────────────────┘        │ applied_at  TEXT         │
                                    └──────────────────────────┘
```

Sem relação entre as tabelas na Fase 2.

## Regras encarnadas no schema

**Fase 1 — `config.json` (FATO):**

- **Config inválida nunca derruba o app** — cada campo inválido cai no default com aviso no log (BR-012, `src/main/config.ts:46-90`).
- **Faixas e vocabulários fechados** conferidos no código: `hotkey` só entre as 16 teclas de `HOTKEY_CODES`; `holdThresholdMs` e `maxRecordingMs` inteiros dentro da faixa; `language` com duas letras; `transcription.provider` só `groq` e `transcription.model` entre os dois modelos aceitos; `pill.position` entre as duas posições; `sounds` booleano.
- **`version: 1`** grava a versão do formato para uma migração futura (ver [Migrations](#migrations)).
- É um documento só: não há unicidade nem relação a garantir.

**Fase 2 — SQLite (PLANEJADO):**

- `CHECK` fecha os vocabulários: `dictations.mode` (`hold`, `handsfree`), `dictations.status` (`inserted`, `copied`, `empty`, `cancelled`, `failed`) e `dictionary_terms.source` (`manual`, `learned`).
- `dictionary_terms.term` é `UNIQUE COLLATE NOCASE`: o mesmo termo com outra caixa não entra duas vezes.
- `NOT NULL` em tudo o que todo ditado tem (`created_at`, `mode`, `status`, `audio_ms`, `provider`, `model`); `use_count` começa em `0`.
- Índices `idx_dictations_created_at` (lista do histórico) e `idx_dictations_status` (métricas de falha).

## Campos de auditoria e retenção

| Onde | O que registra | Status |
| --- | --- | --- |
| Log | Tempos (`recorded_ms`, `latency_ms`, `transcribe_ms`, `total_ms`), tamanhos (`audio_ms`, `audio_bytes`, `chars`), resultado da inserção (`outcome`: `inserted` ou `copied`), códigos de erro, versão do app e do Electron (`src/main/session.ts:136-140`, `:157`, `:204-213`; `src/main/index.ts:198-205`) | **FATO** |
| `dictations` | `created_at`, `mode`, `status`, `audio_ms`, `latency_ms`, `provider`, `model`, `error_code` | **PLANEJADO (Fase 2)** |

**Retenção na Fase 1 (FATO):** o log só tem a rotação por tamanho (três arquivos de até 5 MB); não há expiração por data. O `config.json` vive até o usuário apagá-lo.

**Retenção e privacidade na Fase 2 (PLANEJADO):**

- Histórico com retenção configurável (padrão 30 dias; "nunca guardar" é uma opção). Limpeza ao iniciar o app.
- "Apagar histórico" na tela de configurações apaga as linhas e roda `VACUUM`.
- O banco é do usuário: nunca sai da máquina na Fase 2.

## Migrations

**Fase 1:** nenhuma — não há banco. Mudança no formato do `config.json` = subir `version`, escrever a spec da migração a partir de [`templates/TEMPLATE-spec-migracao.md`](templates/TEMPLATE-spec-migracao.md) e atualizar este documento no mesmo trabalho. Como hoje `normalizeConfig` não confere `version`, a spec dessa primeira migração precisa dizer como o app reconhece o formato antigo.

**Fase 2 (PLANEJADO):**

- Arquivos SQL numerados em `database/local/NNNN_descricao.sql`, só para frente (sem "down").
- O app aplica as pendentes ao iniciar, em transação, e registra em `schema_migrations`.
- Banco em `%APPDATA%\Touch Speaker\touch-speaker.db`, com `journal_mode=WAL`.

**Fase 4 (PLANEJADO):** migrations do banco do servidor em `database/server/`; fora do escopo agora.

## Seed

Não se aplica: não há dado de exemplo. O `config.json` nasce com os defaults na primeira execução e o log nasce vazio.

## Pendências conhecidas

Nenhuma pendência de dados registrada em 17/out/2026. Pendências do projeto: [SDD, Apêndice B](spec/spec-driven-development.md#apêndice-b--pendências).

---

Arquitetura: [`ARCHITECTURE.md`](ARCHITECTURE.md) · Integração: [`INTEGRATION.md`](INTEGRATION.md) · API: [`API.md`](API.md) · Ambiente: [`ENVIRONMENT.md`](ENVIRONMENT.md) · Pendências e riscos: [`spec/spec-driven-development.md`](spec/spec-driven-development.md)
