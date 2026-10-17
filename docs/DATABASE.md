# DATABASE — Touch Speaker

> **Versão:** 0.1 · **Data:** 17/out/2026

## Visão geral

| Fase | Onde os dados vivem |
| --- | --- |
| **1** | **Sem banco.** Só `config.json`, `.env` (dev) e log em arquivo |
| 2 | SQLite local por usuário (`better-sqlite3`), migrations em `database/local/` |
| 4 | Banco do servidor (Postgres), migrations em `database/server/` |

Princípio que atravessa todas as fases: **áudio não é persistido** e **texto ditado só fica na máquina
do usuário** (até existir sync opcional e explícito na Fase 4).

## Armazenamento da Fase 1

### `config.json`

Local: `%APPDATA%\Touch Speaker\config.json`. Criado com os defaults na primeira execução. Campo
desconhecido ou inválido → log de aviso e default no lugar (o app não deixa de abrir por causa de
config).

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

| Campo | Tipo | Default | Regra |
| --- | --- | --- | --- |
| `version` | int | `1` | Versão do formato; migração de config quando mudar |
| `hotkey` | string | `"RightCtrl"` | Tecla única do conjunto suportado (`RightCtrl`, `RightAlt`, `F13`–`F24`, `CapsLock`…) |
| `holdThresholdMs` | int | `500` | 200–1500. Abaixo = toque (mãos livres); acima = segurar |
| `maxRecordingMs` | int | `300000` | ≤ 300000 (5 min, FR-DICT-11) |
| `language` | string | `"pt"` | ISO-639-1 enviado ao Whisper |
| `transcription.provider` | enum | `"groq"` | Só `groq` na Fase 1 |
| `transcription.model` | string | `"whisper-large-v3-turbo"` | `whisper-large-v3` também aceito |
| `microphoneDeviceId` | string \| null | `null` | `null` = microfone padrão do Windows |
| `pill.position` | enum | `"bottom-center"` | `bottom-center` \| `top-center` |
| `sounds` | bool | `true` | Bipe curto ao iniciar/terminar gravação |

### `.env` (só em desenvolvimento)

`frontend/.env` com `GROQ_API_KEY=...`. Fora do git. Na Fase 2 a chave passa para o `safeStorage`
do Electron (DPAPI do Windows) — ver [Security Guide §5](Security-Guide.md#5-segredos-e-chaves).

### Log

`%APPDATA%\Touch Speaker\logs\main.log`, rotação a 5 MB × 3 arquivos. Grava: início/fim de sessão,
duração do áudio, tamanho, latência de cada etapa, código de erro. **Não grava** texto transcrito,
áudio, conteúdo do clipboard nem a chave.

## Diagrama entidade-relacionamento (Fase 2 — planejado)

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

Sem relação entre as tabelas na Fase 2. `text_raw` = saída do Whisper; `text_final` = depois do
`Refiner` (igual a `text_raw` enquanto não houver limpeza).

## Tabelas (Fase 2 — planejado)

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
  error_code  TEXT                             -- códigos de docs/API.md §4
);

CREATE TABLE dictionary_terms (
  id          TEXT PRIMARY KEY,
  term        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  source      TEXT NOT NULL CHECK (source IN ('manual', 'learned')),
  created_at  TEXT NOT NULL,
  use_count   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE schema_migrations (
  version     INTEGER PRIMARY KEY,
  applied_at  TEXT NOT NULL
);
```

## Índices

```sql
CREATE INDEX idx_dictations_created_at ON dictations (created_at DESC);  -- lista do histórico
CREATE INDEX idx_dictations_status ON dictations (status);               -- métricas de falha
```

## Migrações

- Arquivos SQL numerados em `database/local/NNNN_descricao.sql`, só para frente (sem "down").
- O app aplica as pendentes ao iniciar, em transação, e registra em `schema_migrations`.
- Banco em `%APPDATA%\Touch Speaker\touch-speaker.db`, com `journal_mode=WAL`.

## Retenção e privacidade

- Histórico com retenção configurável (padrão 30 dias; "nunca guardar" é uma opção). Limpeza ao
  iniciar o app.
- "Apagar histórico" na tela de configurações apaga as linhas e roda `VACUUM`.
- O banco é do usuário: nunca sai da máquina na Fase 2.

## Banco do servidor (Fase 4)

Fora do escopo agora. Quando existir: usuários, cotas, dicionário sincronizado e uso agregado.
**Sem** texto ditado no servidor por padrão.
