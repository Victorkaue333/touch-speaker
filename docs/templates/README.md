# Como nasce uma feature no Touch Speaker

> Última atualização: 18/out/2026 · Mantenedor: Victor Alves · Status: **vigente**
> Contrato: [SDD](../spec/spec-driven-development.md) · Guardrails: [CLAUDE.md](../../CLAUDE.md) ·
> Decisões: [DECISIONS.md](../DECISIONS.md)

Toda feature do Touch Speaker nasce como **spec escrita** antes de qualquer código. A spec é o
contrato: diz o problema, o que entra e o que fica de fora, como se verifica que ficou pronto. O
código implementa a spec; se a implementação descobrir que a spec estava errada, **a spec é corrigida
primeiro**.

Este diretório tem o **processo** e os **três templates**: o de spec de feature, o de milestone e o de
spec de migração de dados e configuração (ver "Specs de migração de dados e configuração"). Vale para
humano e para agente de IA — o template é escrito para ser preenchido pelos dois.

---

## A base: engenharia de software + desenvolvimento de produto

Não é um formulário burocrático. Toda seção da spec existe porque uma das disciplinas abaixo exige, e
**todas valem sempre** — feature bem construída que ninguém usa no dia a dia é desperdício caro;
feature desejada e mal construída vira dívida que trava as próximas.

| Disciplina | O que ela cobra | Onde entra |
| --- | --- | --- |
| **Engenharia de software** | requisito verificável antes do código (EARS), NFR com número, modelo de dados fechado, contrato antes do código que o consome, alternativa rejeitada, teste que prova o critério, rollout com rollback | §5, §6, §9, §10, §12, §14, §15 |
| **Desenvolvimento de produto** | para quem, qual dor, qual hipótese, como se mede, custo de não fazer, alcance × esforço, o que fica **fora** | §2, §2.1, §13 |
| **Design de sistema** | os quatro diagramas — o desenho revela a lacuna que o texto esconde | §7.1, §8.1, §9.1, §11.1 |
| **Contexto deste projeto** | app de bandeja em Electron, só Windows; privacidade por padrão (C1); nunca roubar o foco (C2); nunca digitar lixo (C3); provedores trocáveis atrás de interface (C5); sala limpa em relação ao Typeless (C7); escopo da fase (C8); produto em pt-BR; código em `frontend/` como fonte de fato | §0 Constituição, §2.1, §4, §9 |

A quarta linha da tabela é o ponto que mais se ignora e o que mais custa: **teoria genérica não
serve sozinha**. "Boa prática" que pede streaming de áudio durante a fala fura a ADR-04 (áudio inteiro
ao soltar) e puxa a Fase 4 para a Fase 1; janela de status que recebe foco fura o C2; biblioteca que
entrega o código de toda tecla fura o C1 e o guardrail de só identificar a tecla configurada e o `Esc`;
reproduzir um comportamento do Typeless a partir do material bruto do estudo fura a sala limpa
(ADR-07). Toda referência externa passa pelo filtro do §0 da spec antes de virar decisão — o que sobra é
o que serve **a este** produto.

Quando engenharia e produto discordam (o certo custa três semanas, o desejado cabe em três dias), a
spec **declara o conflito** no §17 e o Victor decide. Escolher em silêncio é a única saída proibida
(regra de zero invenção do [CLAUDE.md](../../CLAUDE.md)).

---

## Os três estágios

| Estágio | Artefato | Onde vive | Status |
| --- | --- | --- | --- |
| **1. Spec** | o que a feature é, por quê, e como fica na arquitetura | `docs/spec/features/<slug>.md` | `proposta` |
| **2. Gate** | aval do Victor (inclusive quando toca decisão fixa) | — | vira `aprovada` |
| **3. Execução** | doc-pai da milestone + tarefas da spec + PR | `docs/milestones/M<N>-<slug>.md` | `implementada` |

O mesmo caminho, de ponta a ponta:

```text
ideia ─► spec (proposta) ─► revisão ─► spec (aprovada) ─► tarefas ─► código ─► verificação ─► docs atualizados ─► pronto
            ▲                                                                       │
            └──────────────── spec errada? corrige a spec antes do código ◄─────────┘
```

1. **Spec:** criar `docs/spec/features/<slug>.md` a partir do
   [`TEMPLATE-spec-feature.md`](TEMPLATE-spec-feature.md).
2. **Revisão:** Victor aprova. Status muda de `proposta` (o `rascunho` do SDD 1.0) para `aprovada`.
3. **Tarefas:** lista na própria spec (§18 do template), cada uma pequena e verificável.
4. **Código:** uma tarefa por vez; commit cita o ID do requisito (`feat(dict): FR-DICT-01 segurar para falar`).
5. **Verificação:** rodar o plano de verificação da spec (critérios de aceite, §14 do template) e marcar
   cada item.
6. **Docs:** se a feature mudou contrato, schema, arquitetura ou interface, atualizar
   `API.md` / `DATABASE.md` / `ARCHITECTURE.md` / `DESIGN.md` no mesmo PR.
7. **Pronto:** status `implementada`, data e o que ficou de fora.

A pasta `docs/spec/features/` já existe, com a spec da Fase 1
([`ditado-por-voz.md`](../spec/features/ditado-por-voz.md), anterior a este template) e as da M2 (índice no
fim desta página). A `docs/milestones/` existe desde 18/out/2026, com o doc-pai da M2
([`M2-app-com-interface.md`](../milestones/M2-app-com-interface.md)), aberto por decisão do Victor antes do gate;
a M1 (`M1-ditado-basico.md`) é criada ao fechar T9/T10. A regra `M<N>` = Fase N não vale para a M2, e
ajustá-la é a PEND-novo-1 do doc-pai.

A spec do estágio 1 **não morre** quando a milestone abre: ela continua sendo a resposta para *"por
que isso é assim?"*. O doc de milestone responde *"o que de fato entrou"*. Gêneros diferentes, os
dois ficam.

### Estágio 1 — Spec

Copie [`TEMPLATE-spec-feature.md`](TEMPLATE-spec-feature.md) para `docs/spec/features/<slug>.md`.

Regras que não são estilo:

- **Não inventar.** Toda feature rastreia ao [PRD](../PRD.md), ao [SDD](../spec/spec-driven-development.md)
  ou ao código atual. O [estudo do Typeless](../referencia/estudo-typeless.md) não é normativo e é fonte
  proibida de código (ADR-07): serve como origem de ideia ou de pendência, descrita com palavras
  próprias, nunca como prova de que algo existe. Se um ponto não tem origem, escreva
  `[PRECISA ESCLARECER: <a pergunta>]` — **não escolha por conta própria**. O marcador é literal, é
  procurável (`grep -rn "PRECISA ESCLARECER" docs/`), e spec com marcador aberto **não passa no gate**.
- **Não decidir stack nova sozinho.** Dependência nova no `frontend/package.json`, provedor novo ou
  serviço novo = ADR em [`docs/DECISIONS.md`](../DECISIONS.md), no mesmo PR. A spec propõe; o ADR decide.
- **IDs estáveis.** Requisito funcional `FR-<ÁREA>-NN`, não-funcional `NFR-NN`, decisão `ADR-NN`, princípio
  `C1`–`C8`. Áreas em uso: `DICT` (ditado), `CLEAN` (limpeza por IA), `VOCAB` (dicionário), `HIST`
  (histórico), `SET` (configurações), `CTX` (contexto do app), `ASK` (comandos por voz), `TRANS`
  (tradução), `ACC` (contas), `DS` (design system: tokens, tema, fonte e cores da pílula e da bandeja), `UI`
  (janela principal: abrir e fechar, navegação, Início, Configurações, chave da Groq na tela). Regras, riscos e pendências citam os registros do SDD (`BR-`, `RISK-`, `PEND-`).
- **Evidência com `frontend/src/<caminho>.ts:linha`.** Afirmação sobre o código atual sem âncora é
  opinião. Exemplo do formato: "só a tecla configurada e o `Esc` são identificados; qualquer outra vira
  `other` antes de sair do hook (`frontend/src/main/keyboard.ts:14-15`)". Sem a linha conferida, cite o
  arquivo e o símbolo (`SessionController.start`), nunca uma linha inventada.
- **Objetivos E não-objetivos.** O "fora de escopo" é o que impede a feature de crescer no meio do PR.
- **Os quatro diagramas** (§0.1 do template), quando a feature tem tela ou fluxo: **wireframe**
  (§7.1), **UML de sequência** (§8.1), **ER** (§9.1) e **fluxograma** do usuário (§11.1) — em
  `mermaid`, que renderiza no GitHub e vive no diff como texto. `N/A` com motivo é aceito; em branco
  não é. É no desenho que aparece o ramo sem saída e o estado sem tela — no texto corrido, não.
- **Produto junto com engenharia** (§2.1): para quem, qual dor, qual elo do fluxo do ditado a feature
  fortalece (tecla → gravação → transcrição → inserção → pílula), como se mede, custo de não fazer. Spec
  que só responde *como fazer* não responde *se vale fazer*.

### Estágio 2 — Gate (Definition of Ready)

A spec só vira milestone quando **todas** as linhas abaixo são verdade:

- [ ] Zero `[PRECISA ESCLARECER]` aberto.
- [ ] **Os quatro diagramas presentes** — wireframe (§7.1), sequência (§8.1), ER (§9.1) e fluxograma
      (§11.1) — ou `N/A` **com o motivo escrito**. Feature sem tela não tem wireframe; feature que não
      muda dado ainda desenha o ER do `config.json` (ou das tabelas SQLite, a partir da Fase 2) que ela
      lê, porque é o desenho que prova o reuso.
- [ ] **Fluxograma bate com os FR nos dois sentidos:** todo ramo tem FR, todo FR aparece em ramo.
      Ramo órfão = requisito faltando; FR sem ramo = requisito fantasma.
- [ ] §2.1 preenchido — persona, dor, elo do fluxo, hipótese, medida e alcance × esforço. "Não dá
      para medir ainda" passa; campo vazio não.
- [ ] Cada FR tem ao menos um critério de aceite DADO/QUANDO/ENTÃO que o verifica.
- [ ] Cada NFR marcado como aplicável tem **limiar numérico** e um teste ou medida que o cobre.
      NFR sem verificação é só documentação.
- [ ] Dados fechados em [`docs/DATABASE.md`](../DATABASE.md): campo novo do `config.json` (tipo, default,
      faixa válida, o que acontece quando é inválido) ou, a partir da Fase 2, tabela SQLite com índice e
      unicidade — e a resposta de **por que não dá para reusar campo existente**. Mudança de formato de
      dado persistido vai pelo template de migração.
- [ ] Contrato fechado: canal IPC (nome, direção, payload com `sessionId`), chamada HTTP ou código de
      erro registrado em [`docs/API.md`](../API.md) (e em [`docs/INTEGRATION.md`](../INTEGRATION.md),
      quando é provedor externo) **antes** do código que o consome entrar em execução.
- [ ] Constituição conferida — a seção §0 do template (ADR-01…07, C1–C8, Windows primeiro, pt-BR com
      textos só em `strings.ts`, sem segredo). Violação exige linha na tabela de justificativa **ou**
      aval do Victor.
- [ ] Dependência, provedor ou serviço novo → ADR aberta.
- [ ] Número da milestone conferido em `docs/milestones/` (quando existir) e no SDD §29 — **não** no
      `CLAUDE.md`, que fica defasado.

### Estágio 3 — Execução

1. Doc-pai a partir de [`TEMPLATE-milestone.md`](TEMPLATE-milestone.md), em
   `docs/milestones/M<N>-<slug>.md`.
2. Tarefas: não há ferramenta de tarefas — elas vivem na própria spec (§18 do template; §13 na spec da
   Fase 1) e no anexo do doc-pai, no formato Objetivo / Requisitos / Resultados + ~5 subtarefas, a última
   sempre **Testes + self-review**.
3. **Cada subtarefa aponta para os FR que fecha.** Rastreabilidade nos dois sentidos: FR → tarefa, tarefa
   → FR. É o que permite responder "isso ficou pronto?" sem reler o PR.
4. PR: código + testes + documentação afetada, **no mesmo PR**, contra `main` (a única branch). Commits em
   Conventional Commits, em pt-BR, citando o requisito (`feat(dict): FR-DICT-01 segurar para falar`), e
   **sem atribuição de IA**: nada de trailer `Co-Authored-By` nem "Generated with" no commit ou no PR.

### Definition of Done

- [ ] Todos os itens do plano de verificação passaram — os critérios de aceite (§14 do template; §12 na
      spec da Fase 1), cada um com o teste ou o passo de roteiro que o prova.
- [ ] Checklist de segurança do PR ([Security Guide §16](../Security-Guide.md#16-checklist-de-segurança-do-pr)) ok.
- [ ] Docs afetados atualizados no mesmo PR.
- [ ] TypeScript compila em modo estrito sem erros. De dentro de `frontend/`:
      - `npm run typecheck`
      - `npm test`
- [ ] Teste novo é teste de verdade: `node:test` + `node:assert/strict` em `src/test/<módulo>.test.ts`, sem
      dependência extra, com relógio e `fetch` injetados quando há tempo ou rede.
- [ ] Roteiro manual da spec feito com o app aberto por `npm run dev` (nunca o `electron.exe` direto — o
      `scripts/start.mjs` remove o `ELECTRON_RUN_AS_NODE`); app aberto por agente encerrado com
      `Stop-Process` nos `electron.exe` cujo caminho contém `touch-speaker`.
- [ ] Texto de interface em pt-BR, só em `frontend/src/main/strings.ts`.
- [ ] Nenhum segredo no diff (`GROQ_API_KEY`, conteúdo de `.env`); nada de texto ditado, áudio, clipboard,
      teclas ou a chave em log.
- [ ] `docs/CHANGELOG.md` atualizado com o **porquê**, não só o quê.
- [ ] `docs/API.md` se canal, chamada HTTP ou código de erro mudou · `docs/DATABASE.md` se `config.json` ou
      dado mudou · SDD / `DECISIONS.md` / `ENVIRONMENT.md` / `CLAUDE.md` **se** a feature mexeu neles.
- [ ] Pendências declaradas no doc-pai — o que ficou de fora entra escrito, nunca implícito.
- [ ] Spec marcada como `implementada`, com data.

---

## Quando pular o estágio 1

Spec completa custa caro e nem tudo merece. Pule direto para milestone quando **as três** valem:

- não cria canal IPC, campo de `config.json` nem dependência;
- não toca decisão fixa nem abre ADR;
- cabe em uma sessão de trabalho.

Correção de bug, ajuste visual e refactor local entram aqui. Na dúvida, escreva a spec: ela é barata
comparada a descobrir o buraco no meio da implementação.

---

## Specs de migração de dados e configuração

### Qual template usar

| Mudança em | Template | Gate e *Definition of Done* |
| --- | --- | --- |
| Comportamento, tela, canal IPC, provedor — feature nova ou mudança de feature | [`TEMPLATE-spec-feature.md`](TEMPLATE-spec-feature.md) | os desta página: "Os três estágios", "Estágio 2" e "Definition of Done" |
| Formato de dado persistido — `version` do `config.json`; migrations SQL de `database/local/` (Fase 2); banco do servidor (Fase 4) | [`TEMPLATE-spec-migracao.md`](TEMPLATE-spec-migracao.md) | os do apêndice do template de migração |
| Entrega de uma fase (o que de fato entrou) | [`TEMPLATE-milestone.md`](TEMPLATE-milestone.md) | o estágio 3 desta página |

**Onde ficam:** `docs/spec/features/<slug>.md`, para os dois tipos de spec. A primeira spec de migração é a
[`historico-dados-v1`](../spec/features/historico-dados-v1.md) (18/out/2026): o primeiro banco do app (migration
`database/local/0001_init.sql`) e o campo `history.retentionDays` do `config.json`, que continua na
`version: 1` porque o campo é aditivo.

### Gate em dois níveis

O ciclo de status da spec de migração é `proposta` → `revisada` → `aprovada` → `implementada`. O ciclo
das specs de feature (tabela "Os três estágios") não muda.

- **DoR-R — gate de rascunho, de `proposta` a `revisada`:** o desenho está completo e rastreado (formato
  antigo, formato novo, mapa de campos, invariantes preservadas), e o Victor dá o aval ao desenho, com a
  data no cabeçalho da spec.
- **DoR-E — gate de execução, de `revisada` a `aprovada`, antes da milestone:** nenhum
  `[PRECISA ESCLARECER]` aberto, NFR com número, formato fechado em `docs/DATABASE.md`, rollback descrito
  (backup do arquivo, ponto de não retorno), com o aval do Victor.

Os itens dos dois gates e a *Definition of Done* da migração não se repetem aqui: estão no apêndice do
[template de migração](TEMPLATE-spec-migracao.md).

---

## Índice de specs

| Spec | Fase | Status |
| --- | --- | --- |
| [Ditado por voz](../spec/features/ditado-por-voz.md) | 1 | aprovada · em implementação |
| [Design system "Sálvia"](../spec/features/design-system.md) | M2 | aprovada (18/out/2026) · implementada no código, roteiro V-DS pendente (PEND-006) |
| [Janela principal](../spec/features/janela-principal.md) | M2 | aprovada (18/out/2026) · implementada no código (18/out/2026), roteiro VJ1–VJ24 pendente (PEND-007); tema e controles (FR-UI-39…42, pedido do Victor de 18/out/2026) no código, roteiro VJ25–VJ27 pendente (PEND-010) |
| [Histórico de ditados](../spec/features/historico.md) | M2 | aprovada (18/out/2026) · implementada no código (18/out/2026), roteiro VH1–VH13 pendente (PEND-009) |
| [Histórico local — migração `0001` e `history.retentionDays`](../spec/features/historico-dados-v1.md) (spec de migração) | M2 | proposta · implementação autorizada pelo Victor antes da aprovação (18/out/2026), já no código; aprova junto com o roteiro VH, com o ensaio da migração (PEND-009) |
| [Distribuição para Windows e macOS](../spec/features/distribuicao-windows-macos.md) | M2 | aprovada (18/out/2026) |

### Specs anteriores a este template

A spec da Fase 1 segue o formato do SDD 1.0, com cabeçalho `> **Status:** rascunho | aprovada | implementada
· **Fase:** N · **Data:** dd/mmm/aaaa` e `> **Requisitos:** FR-XXX-NN, …`, e as seções §0 Constituição
(gate) · §1 Problema · §2 Objetivo e não-objetivos · §3 Rastreabilidade · §4 Requisitos funcionais · §5
Requisitos não-funcionais · §6 Interface e estados · §7 Arquitetura · §8 Dados · §9 Contrato · §10 Fluxo
ponta a ponta · §11 Casos de borda · §12 Plano de verificação · §13 Tarefas · §14 Riscos · §15 Decisões
tomadas nesta spec. Ela mantém esse formato; no template atual, o plano de verificação é o §14, as
tarefas são o §18, os casos de borda entram no §5 e os riscos no §13. Specs novas usam o template atual.

---

## Por que este formato

O que se repete nos processos que funcionam (fontes ao fim):

| Padrão | Onde aparece | O que entra aqui |
| --- | --- | --- |
| Contexto · Objetivos **e não-objetivos** · Design · **Alternativas** · Segurança · Testes & rollout | Google, Uber, Stripe, Sourcegraph, Fuchsia | esqueleto da spec (§1–§13) |
| UI & UX, interações de rede, analytics, **acessibilidade** como seção própria | Uber (design doc de mobile) | §7 (telas e estados) e §6 (NFR) |
| **`[NEEDS CLARIFICATION]`** — agente sinaliza falta em vez de inventar | GitHub Spec Kit | `[PRECISA ESCLARECER]`, gate bloqueante — versão mecânica da regra de zero invenção |
| **Constitution check**: gate antes do design e de novo depois | GitHub Spec Kit | §0 Constituição, contra as decisões fixas de `docs/DECISIONS.md` e o C1–C8 do SDD |
| **EARS** — `QUANDO <evento> O SISTEMA DEVE <comportamento>` | AWS Kiro | forma dos FR (§5) |
| Cada task **mapeia de volta** a um requisito | AWS Kiro | anexo de tarefas (§18) e Definition of Done |
| NFR com **limiar numérico** e lugar no plano de teste | checklist de 14 categorias | §6, com as categorias que este produto de fato tem |
| Critério de aceite DADO/QUANDO/ENTÃO, numerado e testável | BDD / Gherkin | §14 |
| DoR (posso começar?) ≠ AC (terminei?) | Scrum.org | estágio 2 e "Definition of Done" |
| **Diagrama junto do texto** — sequência para a chamada, ER para o dado, fluxograma para a decisão | UML / C4 / design doc do Google | §8.1, §9.1, §11.1, em `mermaid` (texto no diff, não imagem morta) |
| Wireframe de baixa fidelidade **antes** do pixel | prática de design de produto | §7.1 — layout e estado na spec; cor e espaçamento em [`docs/DESIGN.md`](../DESIGN.md) |
| Hipótese + métrica + alcance × esforço antes de construir | desenvolvimento de produto (RICE / oportunidade-solução) | §2.1 |

Os quatro diagramas são obrigatórios por um motivo prático: texto corrido descreve o caminho feliz sem
esforço nenhum — o ramo de erro, o estado da pílula que ninguém desenhou e o campo de config sem default
só aparecem quando alguém tenta **desenhar**. O custo é meia hora por spec; o que ele evita é descobrir a
lacuna com o código já pronto.

O que **não** foi copiado: separar spec, plano e tasks em três arquivos (Spec Kit, Kiro). Três
arquivos por feature viram três arquivos desatualizados. Um doc por estágio, dois estágios com doc.

### Fontes

- [Software Engineering RFC and Design Doc Examples and Templates — Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/software-engineering-rfc-and-design)
- [Spec-driven development with AI: a new open source toolkit — GitHub Blog](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/)
- [`github/spec-kit` — spec-template.md e plan-template.md](https://github.com/github/spec-kit/tree/main/templates)
- [Feature Specs — Kiro Docs (EARS)](https://kiro.dev/docs/specs/feature-specs/)
- [RFC best practices — Fuchsia](https://fuchsia.dev/fuchsia-src/contribute/governance/rfcs/best_practices)
- [Non-Functional Requirements Checklist: 14 Categories (2026)](https://www.forasoft.com/blog/article/non-functional-requirements-checklist-2026)
- [Acceptance Criteria: Purposes, Formats and Best Practices — AltexSoft](https://www.altexsoft.com/blog/acceptance-criteria-purposes-formats-and-best-practices/)
- [Definition of Ready vs Acceptance Criteria — Premier Agile](https://premieragile.com/definition-of-ready-vs-acceptance-criteria/)
