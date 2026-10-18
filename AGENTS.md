# AGENTS.md — Touch Speaker

Instruções para agentes de IA (Claude Code, Cursor, Codex) que trabalham neste repositório.

> Última atualização: 18/out/2026 · Mantenedor: Victor Alves

## Projeto

- **Produto:** Touch Speaker — app de bandeja para Windows e macOS que transforma fala em texto digitado no app em foco: segura uma tecla, fala, solta, o texto aparece no cursor. Hoje roda no Windows; o suporte a macOS está aprovado (ADR-11, spec `distribuicao-windows-macos`) e em implementação na M2; Linux vem depois, sem data; mobile fora
- **Stack:** Electron 44 + TypeScript estrito (CommonJS, `tsc`, sem bundler) · hook de teclado com `uiohook-napi` · Win32 (`SendInput`, elevação) com `koffi` · transcrição pela Groq (`whisper-large-v3-turbo`, `language=pt`) · chave da Groq no `safeStorage` (ADR-08) · fonte Inter embutida (ADR-12) · testes com `node:test`
- **Estágio:** Fase 1 (MVP — ditado básico) com T1–T8 implementadas em `frontend/` em 17/out/2026 (funcionando de ponta a ponta no PC do Victor); pendentes T9 (roteiro manual V1–V13) e T10 (fechar a spec). Da M2, `design-system` e `janela-principal` implementadas no código em 18/out/2026 (roteiros manuais pendentes); 182/182 testes
- **Regras do agente:** leia [`CLAUDE.md`](CLAUDE.md) primeiro — comandos, decisões fixas, guardrails e a orquestração de agentes estão lá

## Skills disponíveis

Não há skills de agente neste repositório.

## Documentação canônica

| Tipo | Onde |
| --- | --- |
| Negócio | `PROJECT_CONTEXT.md`, `docs/PRD.md` |
| Técnica | `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/DATABASE.md` |
| Integração | `docs/INTEGRATION.md` (processo main ⇄ Groq) |
| Operação | `docs/ENVIRONMENT.md` (não há deploy: sem distribuição antes da Fase 4) |
| Decisões e histórico | `docs/DECISIONS.md`, `docs/CHANGELOG.md` |
| Contrato de engenharia | `docs/spec/spec-driven-development.md` (SDD) |
| Feature nova | `docs/templates/README.md` |
| Estilo | `docs/Code-Style.md`, `docs/DESIGN.md` |
| Segurança | `SECURITY.md`, `docs/Security-Guide.md` |
| Referência não normativa | `docs/referencia/estudo-typeless.md` (fonte proibida de código — ADR-07) |
| IA | `CLAUDE.md`, `AGENTS.md` |

## Fonte normativa

Valem, nesta ordem: `docs/DECISIONS.md` → SDD → `CLAUDE.md` (e este `AGENTS.md`) → docs específicos → spec aprovada da feature (`docs/spec/features/*.md`) → READMEs. O código em `frontend/` é a fonte de fato sobre **o que existe**; a spec aprovada e o SDD são o contrato sobre **o que deve existir**. Divergência é defeito: código errado → corrige-se o código; spec errada → **corrige-se a spec primeiro** e só depois o código, com aval do Victor sempre que o comportamento muda. O `docs/referencia/estudo-typeless.md` é estudo de referência, **não normativo** e **fonte proibida de código** (ADR-07): dele saem ideias e comportamentos descritos com palavras próprias, nunca código, strings, constantes, nomes de canal, ícones, sons ou cores.
