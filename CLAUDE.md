# CLAUDE.md — Touch Speaker

## Identidade do projeto

Touch Speaker é um app de bandeja para **Windows** que transforma fala em texto digitado no app em
foco: segura uma tecla, fala, solta, o texto aparece no cursor. Dono: Victor Alves. Idioma do
produto e da documentação: **pt-BR**.

## Estado atual

- **Fase 1 (MVP — ditado básico):** T1–T8 implementadas em `frontend/` (17/out/2026); 30/30 testes
  passando. **Funcionando de ponta a ponta no PC do Victor** (17/out): ditado em mãos livres no
  Bloco de Notas, 0,66–0,88 s do fim da fala ao texto. **Falta T9:** resto do roteiro V1–V13
  (segurar, Esc, clipboard, outros apps, admin) e T10 (fechar a spec).
- Spec ativa: [docs/spec/features/ditado-por-voz.md](docs/spec/features/ditado-por-voz.md) — tarefas T1–T10 na §13.
- A arquitetura foi informada por engenharia reversa do Typeless 2.8.2
  ([docs/referencia/estudo-typeless.md](docs/referencia/estudo-typeless.md)). Isso é **referência**,
  não fonte de código. O material bruto do estudo fica fora do repositório.

## Stack

| Camada | Escolha |
| --- | --- |
| App | Electron 44 + TypeScript (estrito, CommonJS, `tsc`, sem bundler na Fase 1) |
| Hook de teclado | `uiohook-napi` |
| Win32 (SendInput, elevação) | `koffi` chamando `user32` / `kernel32` / `advapi32` |
| Gravação | `getUserMedia` + `MediaRecorder` (`audio/webm;codecs=opus`) no renderer da pílula |
| Transcrição | Groq `whisper-large-v3-turbo` (plano gratuito), `language=pt` |
| Testes | `node:test` |
| Runtime de dev | Node.js 24 LTS |

## Comandos essenciais

```powershell
cd frontend
npm install
copy .env.example .env   # e preencher GROQ_API_KEY
npm run dev              # compila e abre o app na bandeja
npm start                # abre sem recompilar
npm test                 # compila e roda os testes (node:test)
npm run typecheck
```

Sempre abrir o app por `npm run dev`/`npm start` (passam por `scripts/start.mjs`, que remove o
`ELECTRON_RUN_AS_NODE` herdado do VS Code). Log em `%APPDATA%\Touch Speaker\logs\main.log`.
Para encerrar um app aberto por agente: `Stop-Process` nos `electron.exe` cujo caminho contém `touch-speacker`.

## Estrutura

```text
frontend/    app desktop Electron (main, preload, renderer) — Fase 1
backend/     API própria — vazio até a Fase 4
database/    migrations: local/ (SQLite, Fase 2) e server/ (Fase 4)
docs/        PRD, ARCHITECTURE, API, DATABASE, DESIGN, Security-Guide, spec/, referencia/
```

## Decisões fixas (não rediscutir sem aval do Victor)

- Windows primeiro; nada de macOS/Linux/mobile antes da Fase 4.
- Electron + TypeScript ([ADR-01](docs/ARCHITECTURE.md#adr-01--electron--typescript)).
- Inserção por clipboard + Ctrl+V via `SendInput` ([ADR-03](docs/ARCHITECTURE.md#adr-03--inserção-por-clipboard--ctrlv-via-sendinput)).
- Groq Whisper, áudio inteiro ao soltar ([ADR-04](docs/ARCHITECTURE.md#adr-04--groq-whisper-large-v3-turbo-áudio-inteiro-ao-soltar)).
- Sem limpeza por IA na Fase 1; `Refiner` identidade como encaixe ([ADR-05](docs/ARCHITECTURE.md#adr-05--sem-limpeza-por-ia-na-fase-1-mas-com-o-encaixe-pronto)).
- Sem backend na Fase 1; app não é distribuído com chave ([ADR-06](docs/ARCHITECTURE.md#adr-06--sem-backend-na-fase-1)).
- Sala limpa em relação ao Typeless ([ADR-07](docs/ARCHITECTURE.md#adr-07--sala-limpa-em-relação-ao-typeless)).

## Convenções

- Código e identificadores em inglês; textos de interface, docs e mensagens de commit em pt-BR.
- Textos da interface centralizados em `frontend/src/main/strings.ts`.
- TypeScript estrito; `any` só com comentário justificando.
- Commits: Conventional Commits citando o requisito — `feat(dict): FR-DICT-01 segurar para falar`.
- Commits **sem** trailer `Co-Authored-By` (nem do Claude, nem de ninguém): o autor é só o Victor.
- Um único dono de estado da sessão: `SessionController`.
- Provedores (transcrição, limpeza) sempre atrás de interface.

## Orquestração de agentes (IA)

Nunca execute o trabalho por conta própria.
Sempre delegue a tarefa a um subagente.
Não use sempre o Fable.
Use o Opus 5.5 para tarefas mais simples.

### Distribuição de modelos

- **Fable 5.1:** arquitetura, bugs complexos e revisão de código.
- **Opus 5.5:** edições, testes, documentação e refatoração.
- **Haiku 4.5:** pesquisas e resumos.
- Especifique o modelo em cada chamada de agente.

### Delegação

- Um subagente por tarefa. Planeje antes de executar.
- Execute subagentes independentes em paralelo.
- Leia o relatório, nunca os arquivos.

## Feature nova — comece SEMPRE por aqui

1. Ler [docs/spec/spec-driven-development.md](docs/spec/spec-driven-development.md).
2. Criar `docs/spec/features/<slug>.md` a partir do template (§4 do SDD) e pedir aprovação.
3. Só então implementar, tarefa por tarefa, verificando contra a §12 da spec.
4. Atualizar os docs afetados no mesmo trabalho.

## Documentação de referência

| Assunto | Documento |
| --- | --- |
| Por que existe, fases, métricas | [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) |
| Requisitos (FR/NFR) e roadmap | [docs/PRD.md](docs/PRD.md) |
| Componentes, fluxo, ADRs | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Groq, IPC, códigos de erro | [docs/API.md](docs/API.md) |
| `config.json`, SQLite (Fase 2) | [docs/DATABASE.md](docs/DATABASE.md) |
| Pílula, cores, sons | [docs/DESIGN.md](docs/DESIGN.md) |
| Segurança e sala limpa | [docs/Security-Guide.md](docs/Security-Guide.md) |

## Nunca faça (guardrails)

- **Nunca** copiar código, pseudocódigo, strings, constantes, nomes de canais, ícones, sons ou cores do
  Typeless ou do material bruto do estudo. Escrever do zero a partir de documentação pública.
- **Nunca** trazer para o repositório binários de terceiros, código decompilado ou o material bruto
  do estudo; o que pode ser publicado já está em `docs/referencia/estudo-typeless.md`.
- **Nunca** chamar a API do Typeless, usar tokens dele ou mexer em assinatura/gating dele.
- **Nunca** commitar `.env`, chaves ou dados de usuário.
- **Nunca** logar texto ditado, áudio, conteúdo do clipboard, teclas ou a chave.
- **Nunca** gravar áudio em disco.
- **Nunca** dar foco à janela da pílula.
- **Nunca** identificar teclas além da configurada e do `Esc` (outras viram só um booleano).
- **Nunca** pedir elevação de administrador para contornar UIPI.
- **Nunca** puxar funcionalidade de fase seguinte para dentro da spec atual.

## Ao terminar trabalho relevante

- Marcar as tarefas e verificações concluídas na spec.
- Atualizar `docs/` se contrato, dado, arquitetura ou interface mudaram.
- Atualizar a seção **Estado atual** deste arquivo.
