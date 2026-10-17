# Spec-Driven Development — Touch Speaker

> **Projeto:** Touch Speaker (ditado por voz para Windows) · **Dono:** Victor Alves
> **Versão deste SDD:** 1.0 · **Criado em:** 17/out/2026 · **Status:** vigente
> **Idioma:** pt-BR

Toda feature do Touch Speaker nasce como **spec escrita** antes de qualquer código. A spec é o
contrato: diz o problema, o que entra e o que fica de fora, como se verifica que ficou pronto. O
código implementa a spec; se a implementação descobrir que a spec estava errada, **a spec é corrigida
primeiro**.

**Documentos-base (referenciar, não duplicar):**

- [PROJECT_CONTEXT.md](../../PROJECT_CONTEXT.md) — problema, público, fases
- [PRD.md](../PRD.md) — requisitos com IDs (`FR-*`, `NFR-*`)
- [ARCHITECTURE.md](../ARCHITECTURE.md) — componentes e ADRs
- [API.md](../API.md) — contratos (Groq, IPC, erros)
- [DATABASE.md](../DATABASE.md) — config e dados
- [DESIGN.md](../DESIGN.md) — interface
- [Security-Guide.md](../Security-Guide.md) — regras de segurança e sala limpa

---

## 1. Constituição

Princípios que **toda** spec precisa respeitar. A seção 0 de cada spec diz quais toca e, se violar
algum, por quê.

| # | Princípio | O que significa na prática |
| --- | --- | --- |
| C1 | **Privacidade por padrão** | Áudio nunca vai para disco; texto ditado, clipboard e teclas nunca vão para log |
| C2 | **Nunca roubar o foco** | Nada do Touch Speaker recebe foco durante o ditado |
| C3 | **Nunca digitar lixo** | Na dúvida entre inserir algo errado e não inserir nada, não insere e avisa |
| C4 | **Falha visível** | Todo erro chega à pessoa com mensagem clara; nada falha em silêncio |
| C5 | **Provedores trocáveis** | Transcrição e limpeza ficam atrás de interfaces; trocar provedor = adapter novo |
| C6 | **Sem segredo em app distribuído** | Chaves de provedor só no `.env` (dev), `safeStorage` (uso pessoal) ou `backend/` (produto) |
| C7 | **Sala limpa** | Nada copiado do Typeless ou de outro produto ([Security Guide §11](../Security-Guide.md#11-sala-limpa-engenharia-reversa)) |
| C8 | **Escopo da fase** | Uma spec não puxa funcionalidade de fase seguinte "porque era fácil" |

## 2. Fluxo de trabalho

```text
ideia ─► spec (rascunho) ─► revisão ─► spec (aprovada) ─► tarefas ─► código ─► verificação ─► docs atualizados ─► pronto
            ▲                                                                       │
            └──────────────── spec errada? corrige a spec antes do código ◄─────────┘
```

1. **Spec:** criar `docs/spec/features/<slug>.md` a partir do template (§4).
2. **Revisão:** Victor aprova. Status muda de `rascunho` para `aprovada`.
3. **Tarefas:** lista na própria spec (§13 do template), cada uma pequena e verificável.
4. **Código:** uma tarefa por vez; commit cita o ID do requisito (`feat(dict): FR-DICT-01 segurar para falar`).
5. **Verificação:** rodar o plano de verificação da spec (§12 do template) e marcar cada item.
6. **Docs:** se a feature mudou contrato, schema, arquitetura ou interface, atualizar
   `API.md` / `DATABASE.md` / `ARCHITECTURE.md` / `DESIGN.md` no mesmo PR.
7. **Pronto:** status `implementada`, data e o que ficou de fora.

## 3. Rastreabilidade

Toda linha de requisito precisa responder: **FR ⇄ componente ⇄ contrato (IPC/HTTP) ⇄ dado ⇄ verificação**.

| ID | Formato | Onde nasce |
| --- | --- | --- |
| Requisito funcional | `FR-<ÁREA>-NN` (ex.: `FR-DICT-01`) | PRD |
| Requisito não-funcional | `NFR-NN` | PRD |
| Decisão de arquitetura | `ADR-NN` | ARCHITECTURE |
| Princípio | `C1`–`C8` | Este SDD |

Áreas em uso: `DICT` (ditado), `CLEAN` (limpeza por IA), `VOCAB` (dicionário), `HIST` (histórico),
`SET` (configurações), `CTX` (contexto do app), `ASK` (comandos por voz), `TRANS` (tradução),
`ACC` (contas).

## 4. Template de spec de feature

Copiar para `docs/spec/features/<slug>.md`:

```markdown
# <Nome da feature> — spec

> **Status:** rascunho | aprovada | implementada · **Fase:** N · **Data:** dd/mmm/aaaa
> **Requisitos:** FR-XXX-NN, …

## 0. Constituição (gate)
Princípios tocados (C1–C8) e como são respeitados. **Violação exige justificativa.**

## 1. Problema
O que dói hoje, com exemplo concreto.

## 2. Objetivo e não-objetivos
**Objetivo:** uma frase. **Não-objetivos:** lista do que fica de fora de propósito.

## 3. Rastreabilidade
Tabela FR ⇄ componente ⇄ contrato ⇄ dado ⇄ verificação.

## 4. Requisitos funcionais
Detalhe de cada FR, com regras e números.

## 5. Requisitos não-funcionais
Metas mensuráveis desta feature.

## 6. Interface e estados
Estados visíveis, textos, transições.

## 7. Arquitetura
Componentes novos/alterados, processo (main/renderer), síncrono ou assíncrono.

## 8. Dados
Config, tabelas, migrations. "Nenhum" é resposta válida.

## 9. Contrato
IPC, HTTP, códigos de erro. O que muda e se quebra algo.

## 10. Fluxo ponta a ponta
Passo a passo do caminho feliz.

## 11. Casos de borda
Lista com o comportamento esperado de cada um.

## 12. Plano de verificação
Checklist manual e/ou testes automatizados que provam cada FR.

## 13. Tarefas
Lista ordenada de tarefas pequenas.

## 14. Riscos
Risco, impacto, mitigação.

## 15. Decisões tomadas nesta spec
O que foi decidido e por quê (vira ADR se for estrutural).
```

## 5. Definição de pronto

Uma feature está pronta quando:

- [ ] Todos os itens do plano de verificação (§12 da spec) passaram
- [ ] Checklist de segurança do PR ([Security Guide §15](../Security-Guide.md#15-checklist-de-segurança-do-pr)) ok
- [ ] Docs afetados atualizados no mesmo PR
- [ ] TypeScript compila em modo estrito sem erros
- [ ] Spec marcada como `implementada`, com data

## 6. Índice de specs

| Spec | Fase | Status |
| --- | --- | --- |
| [Ditado por voz](features/ditado-por-voz.md) | 1 | aprovada · em implementação |
