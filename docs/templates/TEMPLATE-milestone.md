# M<N> — <título: o que mudou, dito como resultado, não como tarefa>

> Doc-pai da fase **M<N>**. **Status: em execução | implementada — não commitada | implementada.**
> Spec: `docs/spec/features/<slug>.md` — <ou "sem spec: <por quê>">
> Origem: <quem pediu, quando, com a frase original entre aspas>
> Relação com ADRs: <estende ADR-0N sem contrariá-la / abre ADR-0N / não abre ADR>

> **Número da milestone:** `M<N>` = Fase N do PRD (M1 = Fase 1 — ditado básico; M2 = Fase 2; M3 = Fase 3;
> M4 = Fase 4 — produto). Salve em `docs/milestones/M<N>-<slug>.md` (a pasta é criada na primeira
> milestone; a primeira candidata é `M1-ditado-basico.md`, ao fechar T9 e T10). Confira
> `docs/milestones/` e o SDD §29 antes de fixar o número. O `CLAUDE.md` fica defasado e não é fonte
> para isso.

---

## O problema, na tela

<O que estava errado, do ponto de vista de quem usa. Cite a saída real do produto quando houver —
texto da pílula, item do menu da bandeja, linha do `main.log` (que nunca traz texto ditado), o que
apareceu ou deixou de aparecer no app em foco. Enumere os problemas separados; misturar dois num
parágrafo esconde um deles.>

---

## O que a pesquisa diz (e o que dela entra)

> Seção opcional — só quando houve levantamento externo (documentação da Microsoft, do Electron, da
> Groq; o estudo de referência do Typeless só como ideia, nunca como fonte de código — ADR-07). Se
> houve, ela é obrigatória: pesquisa que não vira decisão é tempo perdido.

| Padrão observado | Onde aparece | O que entra na M<N> |
| --- | --- | --- |
| | | |
| | | **Fora desta fase** — <por quê>, fica declarado como pendência |

---

## A descoberta que barateou (ou encareceu) tudo

> Opcional. O achado de investigação que mudou o desenho — interface ou campo de config que já
> existia e serviu, comportamento do Windows ou do Electron que já estava quebrado antes, suposição
> que caiu. É a seção que evita alguém refazer a mesma investigação daqui a três meses.

---

## O que foi entregue

### 1. <parte>

<O quê, e a razão de ser assim. Tabela quando houver campos/opções.>

### 2. <parte>

<...>

---

## Decisões que não são detalhe

**1. <decisão>.** <O que foi escolhido, o que foi descartado, e o pior caso de cada lado.>

**2. <decisão>.** <...>

---

## O que muda, por arquivo

Caminhos relativos a `frontend/` (o app desktop).

### Main (src/main)

| Arquivo | O quê |
| --- | --- |
| `src/main/<arquivo>.ts` | <...> |
| `src/main/strings.ts` | <texto de interface novo ou alterado — todo texto da interface vive aqui> |
| `src/main/errors.ts` | <código de erro novo, se houver> — **novo** <ou: **sem mudança**> |

### Preload, shared e renderer

| Arquivo | O quê |
| --- | --- |
| `src/shared/ipc.ts` | <canal ou payload novo> |
| `src/preload/pill.ts` | <nome de canal repetido, em sincronia com `shared/ipc.ts`> |
| `src/renderer/<arquivo>` | <`pill.ts` / `pill.css` / `pill.html` / `global.d.ts`> |

### Testes (src/test)

| Arquivo | O quê |
| --- | --- |
| `src/test/<módulo>.test.ts` | <o que trava> — **novo** |

### Configuração e scripts

| Arquivo | O quê |
| --- | --- |
| `package.json` | <dependência nova (exige ADR) ou script> |
| `tsconfig.main.json` / `tsconfig.renderer.json` | <...> |
| `scripts/<arquivo>.mjs` | <...> |

### Documentação

`docs/CHANGELOG.md` · <`docs/API.md` / `docs/DATABASE.md` / SDD § / `DECISIONS.md` ADR-0N /
`ENVIRONMENT.md` / `CLAUDE.md`>

---

## Como verificar

| # | Critério de aceite | Onde se prova |
| --- | --- | --- |
| 1 | DADO <...> QUANDO <...> ENTÃO <...> | `src/test/<módulo>.test.ts` |
| 2 | | V<N> do roteiro manual da spec |

Comandos (de dentro de `frontend/`): `npm run typecheck` · `npm test` (compila e roda os testes de
`node:test`).
Manual: <o que só se vê com o app rodando — o roteiro V da spec, no app aberto por `npm run dev`
(nunca pelo `electron.exe` direto, por causa do `ELECTRON_RUN_AS_NODE`), em quais apps de destino,
com qual tecla e com ou sem chave da Groq. Ao terminar, encerre o app aberto por agente com
`Stop-Process` nos `electron.exe` cujo caminho contém `touch-speaker`>

---

## Pendências declaradas

> O que ficou de fora entra escrito. Pendência implícita vira bug de outro.

1. **<pendência>.** <por que ficou fora e o que custaria fazer — e o PEND-NNN, se já houver um no SDD>
2. **<limiar sem calibração>.** <o que medir primeiro>

---

## Fontes da pesquisa (<DD/mmm/AAAA>)

- [<título>](<url>)

---

## Anexo — task (ferramenta de tarefas: nenhuma — as tarefas vivem na §13/§18 da spec)

**M<N> — <título curto>**

*Objetivo:* <uma frase>

*Requisitos:* <lista corrida separada por ` · `>

*Resultados:* <o que existe depois que fecha>

Subtarefas:
1. T1 — <...> (FR-<ÁREA>-01)
2. T2 — <...> (FR-<ÁREA>-02)
3. T3 — <...>
4. T4 — Documentação afetada.
5. T5 — Testes + self-review.
