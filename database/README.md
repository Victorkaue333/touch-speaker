# database

Migrations SQL, numeradas e só para frente.

| Pasta | Banco | Fase |
| --- | --- | --- |
| `local/` | SQLite no computador do usuário (histórico, dicionário) | 2 |
| `server/` | Banco do backend próprio | 4 |

A Fase 1 não tem banco: só `config.json`. Schema planejado em [docs/DATABASE.md](../docs/DATABASE.md).
