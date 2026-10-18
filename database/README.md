# database

Migrations SQL, numeradas e só para frente.

| Pasta | Banco | Fase | Status |
| --- | --- | --- | --- |
| `local/` | SQLite no computador do usuário (histórico; dicionário depois) | 2 | `0001_init.sql` existe (18/out/2026): cria `dictations` e o índice `idx_dictations_created_at` — specs [`historico`](../docs/spec/features/historico.md) e [`historico-dados-v1`](../docs/spec/features/historico-dados-v1.md). O `dictionary_terms` continua planejado |
| `server/` | Banco do backend próprio | 4 | Planejado; a pasta ainda não existe |

- **Quem aplica:** o processo main, ao abrir o app (`frontend/src/main/history/migrations.ts`, `applyMigrations`): cria `schema_migrations` se faltar, aplica cada `NNNN_descricao.sql` pendente numa transação própria e registra a versão. Um arquivo já aplicado nunca é editado: mudança de schema é um arquivo novo, com o número seguinte ([ADR-09](../docs/DECISIONS.md#adr-09--sqlite-local-pelo-nodesqlite-embutido-para-o-histórico-de-ditados)).
- **Como chega ao app:** o build copia `local/*.sql` para `frontend/dist/database/local/` (`frontend/scripts/copy-static.mjs`), de onde o main os lê.
- **Onde fica o banco:** `%LOCALAPPDATA%\Touch Speaker\touch-speaker.db` (com `-wal` e `-shm`), no computador de quem usa — nunca no repositório.

Schema, PRAGMAs, retenção e como apagar o histórico à mão em [docs/DATABASE.md](../docs/DATABASE.md).
