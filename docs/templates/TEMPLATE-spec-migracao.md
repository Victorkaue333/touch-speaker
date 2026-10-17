> **Sobre este template** (apague na cópia, junto com a seção "Como usar este template"; apague também os blocos "Como preencher" e deixe, sob cada título, a linha `> Como preencher: TEMPLATE-spec-migracao.md §<n>`)
> **Status do template:** v1 · Criado: 17/out/2026 · Mantenedor: Victor Alves — estrutura trazida do molde de outro projeto do Victor e adaptada à migração de dados e configuração do Touch Speaker.
> **Base:** `docs/DATABASE.md` (`config.json`, log, SQLite da Fase 2, "Migrations") · SDD §0.2 (marcas) e §9 (modelo de dados) · `docs/DECISIONS.md` (ADR-01…07) · guardrails do `CLAUDE.md`.
> **Irmão de** `TEMPLATE-spec-feature.md`, que continua valendo para feature. As regras de uso estão no [`README.md`](README.md) desta pasta (seção "Specs de migração de dados e configuração"); o gate em dois níveis e a *Definition of Done* da migração estão no fim deste arquivo.

## Como usar este template

| Regra | Conteúdo | Origem |
| --- | --- | --- |
| **Qual template** | Feature (comportamento novo ou alterado) usa `TEMPLATE-spec-feature.md`. Mudança de formato de dado persistido usa este: campo novo, renomeado ou removido no `config.json` (muda o `version`), migration SQL em `database/local/` (Fase 2) ou mudança no banco do servidor (Fase 4). Feature que também muda dado persistido tem as duas specs, e a de feature cita esta | `docs/templates/README.md`; `DATABASE.md` "Migrations" |
| **Onde salvar** | `docs/spec/features/<slug>.md`, com um slug que diga o dado e a versão de destino (`<dado>-v<N>`) | `docs/templates/README.md` |
| **Zero invenção** | Todo comportamento rastreia ao PRD, ao SDD, a uma ADR ou ao código. Ponto sem origem vira `[PRECISA ESCLARECER: …]` no §14, nunca escolha de quem escreve | `CLAUDE.md`; SDD §0.2 |
| **Evidência** | Formato atual por `frontend/src/<caminho>.ts:<linha>` conferida, ou pelo nome do símbolo (`normalizeConfig`, `DEFAULT_CONFIG`) quando a linha não foi conferida — nunca invente linha; formato documentado por seção de `docs/DATABASE.md` (`#configjson`, `#log`, `#migrations`). Commit e data da leitura no cabeçalho | SDD §0.2 |
| **Credenciais** | Nunca no texto, nem como exemplo: nenhum valor de `GROQ_API_KEY`, nenhum `config.json`, banco ou log real de usuário colado na spec. Cita-se o campo, nunca o valor | `CLAUDE.md`; Security-Guide §10 |
| **Marcas** | As do SDD §0.2: **FATO** (verificado no código, com âncora), **PLANEJADO (Fase N)**, **DECISÃO** (ADR aceita ou decisão datada do Victor), **PROPOSTA** (todo o destino, até o aval), **HIPÓTESE**, **PENDÊNCIA** (`PEND-NNN`), **FORA DO ESCOPO** | SDD §0.2 |
| **Preenchimento** | Cada seção tem um bloco "Como preencher". `N/A` é aceito sempre com o motivo escrito (`N/A — <motivo>`); `N/A` sozinho ou seção em branco, não | — |
| **Status e gate** | `proposta` → `revisada` (passou o gate de rascunho, DoR-R, com aval do Victor ao desenho) → `aprovada` (passou o gate de execução, DoR-E, antes de qualquer código) → `implementada` | `docs/templates/README.md` |
| **Modo** | **completo** (padrão) ou **leve**: leve quando a mudança não cria tabela nem muda o `version`. O modo leve encurta só as seções marcadas "(modo leve: …)"; o gate não muda entre os modos | — |

# <Dado ou schema> — spec da migração

> **ID / slug:** `<slug>` (igual ao nome do arquivo) · **Template:** `TEMPLATE-spec-migracao.md` v1
> **O que muda:** <`config.json` `version` <n> → <n+1> | migration `database/local/<NNNN>_<descricao>.sql` (Fase 2) | banco do servidor (Fase 4)>
> **Fase:** <N> · **Módulo dono do dado:** <`frontend/src/main/config.ts` | `database/local/` | `backend/`> · **Milestone:** `M<N>` (= Fase N; confira `docs/milestones/` e o SDD §29)
> **Status:** **proposta** | revisada | aprovada | implementada — todo o destino descrito aqui é PROPOSTA até o aval do Victor · **Modo:** completo | leve (motivo: <…>)
> **Criado:** <DD/mmm/AAAA> · **Autor:** <nome ou agente> · **Última revisão:** <DD/mmm/AAAA> · **Código conferido em:** <commit · DD/mmm/AAAA>
> **Origem:** <quem pediu, quando, com a frase original entre aspas; a feature ou o FR que exige a mudança> · **ADRs de que depende:** <ADR-0N · …> (§0, bloco D)

<Um parágrafo: o que muda no dado, para quem, e por quê. Se não couber em um parágrafo, a migração está grande demais para uma spec.>

## 0. Constituição (gate — preencher ANTES de desenhar, reconferir DEPOIS)

> **Como preencher.** Uma resposta por linha: `sim`, ou **`não`** com o item que fura e uma linha em F. Nenhuma linha em branco.
> (modo leve: os blocos C e E viram uma linha cada, "conferido, sem desvio", com as notas dos itens que a mudança toca entre parênteses.)

#### A. Decisões fixas (ADR-01…07) e Constituição (C1–C8)

| Itens | O que exigem desta spec | Respeita? | Nota |
| --- | --- | --- | --- |
| ADR-01 · ADR-06 | o dado é lido, validado e gravado no processo main, em TypeScript estrito, e fica só na máquina do usuário até a Fase 4 | sim / **não** | |
| C1 · ADR-03 · ADR-04 | áudio só em memória; conteúdo do clipboard nunca persistido; texto ditado, clipboard e teclas nunca no log | sim / **não** | |
| C6 | nenhuma chave no `config.json`, no banco ou em arquivo distribuído | sim / **não** | |
| ADR-02 | `hotkey` só entre os nomes de `main/keys.ts`; nenhuma outra tecla é identificada | sim / **não** | |
| C2 · C3 · C4 | a migração não abre janela focável; falha dela não muda o que o ditado insere e fica registrada — o que afetar o uso aparece para a pessoa | sim / **não** | |
| C5 · ADR-05 · C8 | campo de provedor segue atrás de `Transcriber`/`Refiner`; dado de limpeza por IA só a partir da Fase 2; nenhum campo de fase seguinte | sim / **não** | |
| C7 · ADR-07 | nenhum formato, nome de campo ou constante copiado do Typeless | sim / **não** | |

#### B. Princípios de dados

| # | Princípio | Respeita? | Nota |
| --- | --- | --- | --- |
| 1–2 | Áudio nunca é persistido — nem em arquivo, nem no banco, nem em backup; texto ditado só fica na máquina do usuário (Fase 2: histórico local; nada sai dela antes da Fase 4) | sim / **não** | |
| 3 | Migrations só para frente: arquivo numerado, aplicado ao iniciar, em transação; migration aplicada nunca é editada | sim / **não** | |
| 4 | Config inválida cai no default, com aviso no log, sem derrubar o app (BR-012) | sim / **não** | |
| 5 | Nenhuma chave em arquivo distribuído | sim / **não** | |

#### C. Regras mantidas

| Regra | Onde vive | Respeita? | Nota |
| --- | --- | --- | --- |
| BR-012 — campo inválido → default + `config_invalid_field`; JSON inválido → tudo default; o app sempre abre | `main/config.ts` (`normalizeConfig`, `loadConfig`) | sim / **não** | |
| Faixas: `hotkey` de `HOTKEY_CODES`; `holdThresholdMs` 200–1500; `maxRecordingMs` 10 000–300 000; `language` de duas letras; `transcription.model` ∈ {`whisper-large-v3-turbo`, `whisper-large-v3`}; `pill.position` ∈ {`bottom-center`, `top-center`}. Log só com metadados primitivos, rotação 5 MB × 3 | `main/config.ts`, `main/keys.ts`, `main/logger.ts`; `DATABASE.md#configjson`, `#log` | sim / **não** | |
| Fase 2 (PLANEJADO): `database/local/NNNN_descricao.sql`, pendentes aplicadas ao iniciar, em transação, registradas em `schema_migrations`; retenção padrão de 30 dias, "nunca guardar", "Apagar histórico" com `VACUUM` | `DATABASE.md#migrations` | sim / **não** | |

#### D. ADRs que esta spec assume

ADR-01 e ADR-06 (dado lido e validado no main; só local até a Fase 4) valem para toda spec de migração; acrescente as do dado. Para cada uma: o que a spec assume, as seções que dependem dela e o que muda se ela for substituída (em geral, a spec volta a `proposta`).

#### E. Guardrails do `CLAUDE.md`

| Guardrail | Respeita? | Nota |
| --- | --- | --- |
| Nunca commitar `.env`, chaves ou dados de usuário — nem o `config.json` ou o banco usados no ensaio | sim / **não** | |
| Nunca logar texto ditado, áudio, clipboard, teclas ou a chave — nem na mensagem de erro da migração | sim / **não** | |
| Nunca puxar funcionalidade de fase seguinte; nenhuma dependência ou serviço sem ADR; nenhum comportamento alterado sem a doc (`DATABASE.md` no mesmo trabalho) | sim / **não** | |

#### F. Violação exige justificativa

Uma linha por violação: o que fura · por que é necessário · alternativa rejeitada e por quê · aval (Victor, data). Sem linha em F sem aval, e com os marcadores do §14 no estado que cada gate pede, a spec pode ir ao gate.

### 0.1 Diagramas obrigatórios

Texto corrido não substitui o desenho; `N/A` sempre com motivo. O diagrama descreve o **destino** (PROPOSTA), e o formato atual fica no §1. Rótulos em ASCII, sem `<` nem `>` dentro dos nós.

| # | Diagrama | Seção | Formato | Responde |
| --- | --- | --- | --- | --- |
| 1 | **ER antes e depois** | §6.6 | `mermaid erDiagram` (SQLite) ou tabela de campos lado a lado (`config.json`) | o que nasce, muda de nome ou de tipo, ou some |
| 2 | **Sequência** | §6.8 | `mermaid sequenceDiagram` | boot → leitura → backup → migração → validação → gravação, e onde falha |
| 3 | **Fluxograma** | §6.8 | `mermaid flowchart TD` | versão atual, antiga ou desconhecida; arquivo ilegível; e as saídas |
| 4 | **Máquina de estados** | §6.2 | `mermaid stateDiagram-v2` | só com campo de status (ex.: `dictations.status`, Fase 2); senão `N/A — sem status` |

## 1. AS-IS — o formato de hoje

> **Como preencher.** Tudo aqui é FATO, com âncora no código ou seção de `docs/DATABASE.md`. Se o código diverge do `DATABASE.md`, vale o código, e a correção do doc entra no §13. O quadro abaixo foi conferido em 17/out/2026 (`ed0a1f5`); confira de novo na cópia.

**Código conferido:** <commit · DD/mmm/AAAA> · **Arquivos lidos:** <`main/config.ts`, `main/keys.ts`, …>

| Dado | Onde | Formato | Dono no código |
| --- | --- | --- | --- |
| `config.json` | `%APPDATA%\Touch Speaker\config.json` | JSON com `version: 1`, `hotkey`, `holdThresholdMs`, `maxRecordingMs`, `language`, `transcription` (`provider`, `model`), `microphoneDeviceId`, `pill.position`, `sounds` (`DATABASE.md#configjson`). Criado com os defaults no primeiro uso e nunca regravado depois; o `version` ainda não é lido (não há código de migração); campo desconhecido é ignorado | `main/config.ts` (`DEFAULT_CONFIG`, `normalizeConfig`, `loadConfig`) |
| Log | `%APPDATA%\Touch Speaker\logs\main.log` | uma linha JSON por evento (`t`, `level`, `event` + campos primitivos); rotação 5 MB × 3 | `main/logger.ts` |
| `.env` | `frontend/.env` (só desenvolvimento) | `GROQ_API_KEY`, fora do git; não é dado migrável | `main/index.ts` (`process.loadEnvFile`) |
| Banco | — | **sem banco** na Fase 1; SQLite local na Fase 2 (`database/local/`); banco do servidor na Fase 4 | — |

**O problema, por evidência:** <sintoma> — <`arquivo.ts:linha` · FR · PEND-NNN> (um por linha). **Fora desta spec:** <mudança de comportamento (vai na spec de feature) e dado de outra fase (C8); diga de quem é>.

## 2. Objetivo, não-objetivos e produto

**Objetivo:** <uma frase verificável; em geral, "o app lê o formato <n> e passa ao <n+1> sem perder nenhum valor que o usuário definiu">

**Não-objetivos herdados** (valem para toda spec de migração, não apague):

- Persistir áudio, levar texto ditado para fora da máquina do usuário ou guardar chave (C1, C6).
- Mudar o comportamento do ditado sob o pretexto da migração (isso é spec de feature) ou puxar dado de fase seguinte (C8).
- Editar migration já aplicada ou escrever migração "para trás".
- **Da mudança:** <…> — <por quê>

### 2.1 Produto — a quem serve e como se mede

| | |
| --- | --- |
| **Para quem** | <Dev multitarefa (Fases 1–3) · profissional que escreve muito (Fase 4)> |
| **Dor** | <a frase que a pessoa diria — não o campo que falta> |
| **Elo do fluxo que protege** | <tecla → gravação → transcrição → inserção → pílula: qual elo depende do dado> |
| **Como se mede** | <sinal observável, sem conteúdo de ditado: ex., nenhum `config_invalid_field` novo depois de migrar um `config.json` válido> |
| **Custo de não fazer** | <o que continua acontecendo, ou que feature fica bloqueada> |

## 3. Rastreabilidade

| Origem | Referência | Nota |
| --- | --- | --- |
| PRD (`docs/PRD.md`) e spec de feature | `FR-DICT-NN` · `FR-<ÁREA>-NN` · `NFR-NN` · `docs/spec/features/<slug>.md` | o requisito ou a feature que pede o dado |
| SDD e código | §9 · `BR-NNN` · `PEND-NNN` · `RISK-NNN` · `frontend/src/<caminho>.ts:<linha>` | contrato de engenharia; código como FATO, no commit do cabeçalho |
| Dados e ADRs | `docs/DATABASE.md` (`#configjson`, `#log`, `#diagrama`, `#migrations`) · `ADR-0N` | formato documentado; §0, bloco D |

## 4. Invariantes preservadas

> **Como preencher.** Uma linha por invariante que o formato de hoje garante e o novo não pode quebrar; as quatro primeiras valem para toda migração. Toda linha tem teste ou passo do ensaio. (modo leve: só as linhas que o dado toca.)

| Invariante | Como o novo formato garante | Teste |
| --- | --- | --- |
| O app abre com o arquivo ausente, vazio, com JSON inválido ou com campo inválido (BR-012) | <…> | `src/test/config.test.ts` — <caso> |
| Valor válido que o usuário definiu no formato antigo sobrevive à migração | <…> | <caso> |
| Nenhum texto ditado, áudio, clipboard, tecla ou chave vai para o arquivo, o banco ou o log | <…> | <caso ou revisão> |
| As faixas de `DATABASE.md#configjson` continuam valendo, ou mudam com spec e aval | <…> | <caso> |

## 5. Limitações corrigidas e mantidas

| Limitação no formato de hoje | Evidência | Corrigida / mantida | O que muda, ou por que fica | Verificação (§7) ou aval (Victor, data · PEND-NNN) |
| --- | --- | --- | --- | --- |
| | | | | |

## 6. TO-BE (PROPOSTA)

### 6.1 Quem lê e escreve o dado

| Ator | Lê | Escreve | Quando | Nota |
| --- | --- | --- | --- | --- |
| Processo main | <sim> | <sim> | no boot (`loadConfig`, `main/index.ts:88`), <…> | único dono do arquivo e do banco |
| Renderer (pílula) | não | não | — | recebe só o que o main manda (`recorder:start`, `pill:state`) |
| Usuário editando o arquivo | sim | sim | a qualquer hora | a config só é lida ao abrir o app: a edição vale no próximo boot. Tela de configurações só com a Fase 2 aberta (FR-SET-01) |

### 6.2 Requisitos funcionais (EARS)

> **Como preencher.** `QUANDO <evento> O SISTEMA DEVE <comportamento observável>` (também `ENQUANTO`, `SE … ENTÃO`). Um comportamento por linha, numerado `FR-<ÁREA>-NN` na área do requisito que pediu a mudança. Máquina de estados (diagrama 4) logo abaixo, se o dado tem campo de status.

| # | Requisito | Origem | Prioridade |
| --- | --- | --- | --- |
| FR-<ÁREA>-NN | QUANDO o app abrir com o dado no formato <n> O SISTEMA DEVE <…> | <FR · BR · ADR> | P1 |
| FR-<ÁREA>-NN | SE <o dado estiver ilegível> ENTÃO O SISTEMA DEVE <…> | BR-012 | P1 |

**Casos de borda** (responda cada um ou marque fora de escopo): **primeiro uso** — sem `config.json` (hoje criado com os defaults) ou sem banco · **versão desconhecida** — `version` maior que a do app (formato novo aberto por app antigo) ou ausente · **arquivo editado à mão** — campo desconhecido, tipo errado, JSON inválido · **falha no meio** — disco cheio, arquivo bloqueado por outro programa, app encerrado durante a gravação · **duas instâncias** — a segunda cópia sai antes de ler a config (`main/index.ts:40-47`), então a migração precisa continuar depois do lock · **dado real** — valor aceito no formato antigo que fica fora da faixa nova; `microphoneDeviceId` de um dispositivo que não existe mais.

### 6.3 Requisitos não-funcionais

| Categoria | Requisito (com limiar) | Origem | Como se verifica |
| --- | --- | --- | --- |
| Integridade | <zero valor válido perdido; como a escrita evita arquivo pela metade> | princípio 3; BR-012 | teste `node:test` |
| Boot | <quanto a migração pode atrasar a abertura do app> | NFR-03; <…> | <medição> |
| Privacidade e segurança | nenhum conteúdo de ditado, clipboard, tecla ou chave no dado nem no log | C1, C6; NFR-04 | revisão + teste |
| Degradação e observabilidade | <o que a pessoa vê se a migração falhar; evento de log só com versões e códigos, sem conteúdo> | BR-012; C4; SDD §23 | teste + revisão |
| i18n e fuso | i18n: N/A — produto em pt-BR, texto de interface só em `main/strings.ts`. Fuso: <`N/A — o dado não guarda instante` / ISO-8601 UTC, como `dictations.created_at` (Fase 2)> | `DATABASE.md` | teste |

### 6.4 Telas e estados

> **Como preencher.** Migração em geral não tem tela: `N/A — sem superfície de tela`. Se a pessoa precisar ver algo, o texto vai em `main/strings.ts` e o estado da pílula ou da bandeja segue o `docs/DESIGN.md`; a pílula nunca recebe foco (C2).

### 6.5 Arquitetura

| Camada | Onde | Dono | Nota |
| --- | --- | --- | --- |
| Leitura e validação | `frontend/src/main/config.ts` (`loadConfig`, `normalizeConfig`) | processo main | <onde a migração entra: antes ou depois da validação> |
| Banco (PLANEJADO) | Fase 2: `database/local/NNNN_descricao.sql` + o código que aplica as pendentes ao iniciar · Fase 4: `database/server/` | main · `backend/` | contrato no §6.7 |

**Ordem no boot:** <`requestSingleInstanceLock` → `whenReady` → `loadConfig` (`main/index.ts:88`) → … — onde a migração roda e o que espera por ela>

### 6.6 Modelo de dados

**Precisa de migration?** sim / **não** — <se não, por quê> · **Versão:** <`version` <n> → <n+1> · `database/local/<NNNN>_<descricao>.sql`>

| Campo ou coluna | Antes (tipo, default, regra) | Depois (tipo, default, regra) | Mudança |
| --- | --- | --- | --- |
| `<campo>` | <…> | <…> | novo / renomeado / tipo / removido / igual |

**ER — diagrama 1:** `mermaid erDiagram` com as tabelas antes e depois (SQLite), ou a tabela acima como diagrama (`config.json`). Embaixo, uma linha por **índice** e por **constraint** (`CHECK`, `UNIQUE`, `COLLATE NOCASE`) e a regra que cada um sustenta.

### 6.7 Contrato

> **Como preencher.** O formato fecha em `docs/DATABASE.md` **antes** do código. Se o dado cruza a IPC (algo que vai à pílula no `recorder:start`, por exemplo), o payload muda junto em `docs/API.md`, `src/shared/ipc.ts`, `src/preload/pill.ts` e `src/renderer/global.d.ts`.

**Formato novo:** <JSON com os defaults do formato novo, ou o `CREATE TABLE`>

**Compatibilidade:** <o app novo lê o formato antigo? o app antigo abre com o formato novo? Hoje `normalizeConfig` ignora campo desconhecido e troca o inválido pelo default (`main/config.ts:46-90`)>

### 6.8 Fluxo ponta a ponta

**Sequência — diagrama 2:** `mermaid sequenceDiagram` com `index.ts`, `config.ts` (ou o código que aplica as migrations), o arquivo ou o banco e o `Logger`: leitura, backup, migração, validação e gravação, com um `alt` para formato atual, formato antigo e arquivo ilegível ou versão desconhecida.

**Fluxograma — diagrama 3:** `mermaid flowchart TD`; todo losango com os dois ramos, todo ramo termina num estado do app. No mínimo: "existe o arquivo?" (não → cria com os defaults) · "legível e `version` conhecida?" (não → defaults + aviso no log, original intacto; atual → valida e segue; antiga → backup + migra) · "migrou?" (sim → valida e segue; não → defaults + aviso, backup preservado). Checklist: todo ramo tem FR (§6.2) e critério (§7); todo FR aparece em algum ramo.

## 7. Critérios de equivalência e de aceite

Numerados, observáveis, um por linha; cada FR do §6.2 e cada invariante do §4 aparecem em ao menos um, e um critério cobre a compatibilidade com a versão anterior do app (§6.7).

| # | Critério | Verifica |
| --- | --- | --- |
| 1 | DADO um `config.json` válido no formato <n> QUANDO o app abre ENTÃO <todo valor definido pelo usuário está no formato <n+1>> | FR-<ÁREA>-NN; §4 |
| 2 | DADO um `config.json` com JSON inválido QUANDO o app abre ENTÃO o app abre com os defaults e o log registra o aviso, sem conteúdo do arquivo | BR-012 |

## 8. Dados a importar

> **Como preencher.** Mapa campo antigo → campo novo; é a única tabela de mapeamento da spec, e o §6.6 remete a ela. (modo leve: `N/A — sem mudança de formato`, com o motivo.)

| Origem (campo antigo) | Destino (campo novo, ou "descartado") | Transformação | Default se ausente ou inválido |
| --- | --- | --- | --- |
| `<campo>` | `<campo>` | <…> | <…> |

**O que se descarta:** <campo e por quê; nunca valor que o usuário definiu, sem aval do Victor>. **Regras:** a migração lê o formato antigo e só grava o novo depois do backup; rodar duas vezes dá o mesmo resultado; valor inválido cai no default e nunca derruba o app (BR-012).

## 9. Riscos de migração

Tipo: dados / compatibilidade / privacidade / operação · Prob.: baixa / média / alta · Impacto: baixo / médio / alto · Ligação: §, C, `RISK-NNN` ou `PEND-NNN`. Acrescente os riscos do dado (modo leve: no mínimo três).

| # | Risco | Tipo | Prob. | Impacto | Mitigação | Ligação |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Perder valor que o usuário definiu | dados | <…> | <…> | backup + critério 1 do §7 | §4 |
| 2 | O app não abre depois da migração | operação | <…> | <…> | defaults + aviso (BR-012) | C4 |

## 10. Validação

| Camada | Onde | Runner | O que cobre |
| --- | --- | --- | --- |
| Unidade | `src/test/<módulo>.test.ts` (a config já tem `config.test.ts`, TEST-004) | `node:test` + `node:assert/strict`, por `npm test` | cada transformação do §8, cada invariante do §4, arquivo ausente e ilegível |
| Tipos | `npm run typecheck` | `tsc` | o tipo do formato novo (`AppConfig` ou equivalente) |
| Ensaio com dado real | máquina do Victor | manual | copiar o `config.json` (ou o banco) do uso real, abrir o app novo por `npm run dev`, conferir o §7 e o log; a cópia serve de rollback e nunca entra no repositório nem na spec |

**Regras:** cada teste cria os próprios dados e nunca lê nem grava a pasta real do usuário; relógio injetável quando houver tempo; espera por condição, nunca `sleep`.

## 11. Alternativas consideradas

Tabela `Alternativa | Por que foi rejeitada`, com ao menos: não migrar (deixar o campo antigo cair no default — o que a pessoa perde) e a mais simples (o que ela não resolve).

## 12. Rollout e rollback

1. **Ordem:** formato em `DATABASE.md` → testes do §10 → código da migração → ensaio com dado real → commit.
2. **Backup:** <onde fica a cópia do formato antigo, com que nome, e quando é apagada>.
3. **Ponto de não retorno e app antigo:** <a partir de quando voltar à versão anterior do app perde dado; o app antigo abre com o formato novo — campo a campo pelo default — ou não, e o que fazer>.
4. **Rollback:** <voltar ao commit anterior e restaurar o backup do item 2; no SQLite a migration só vai para frente: voltar = restaurar o arquivo do banco>. Não há instalador antes da Fase 4 (ADR-06): a migração roda na máquina de quem abre o app por `npm run dev` / `npm start`.

## 13. Impacto na documentação (mesmo trabalho)

- [ ] `docs/DATABASE.md` (formato novo, `version`, faixas, migrations) e `docs/CHANGELOG.md` (o quê **e o porquê**).
- [ ] SDD §9 e, se houver, `BR-NNN`, `RISK-NNN` e `PEND-NNN` novos ou fechados; divergência entre `DATABASE.md` e o código achada no §1, corrigida.
- [ ] `docs/API.md` se o dado cruza a IPC; `docs/ENVIRONMENT.md` se muda caminho, arquivo ou variável; `docs/DECISIONS.md` se entra dependência ou muda uma decisão fixa.

## 14. Decisões em aberto

| # | Pergunta | Bloqueia nesta spec | Default proposto | Decide |
| --- | --- | --- | --- | --- |
| 1 | `[PRECISA ESCLARECER: <pergunta>]` | rascunho / execução — <§, FR, critério> | <…> | Victor |

**`rascunho`** bloqueia o DoR-R (a resposta muda o desenho do §6 ou do §8); **`execução`** bloqueia só o DoR-E (o desenho fica, e a resposta é exigida antes do código). Pergunta de outra spec ou fase não bloqueia: uma linha abaixo da tabela, "referência — dono: <spec ou Fase N>".

## 15. Anexo — task (ferramenta de tarefas: nenhuma — as tarefas vivem nesta spec)

**<Dado> — migração <n> → <n+1>** · milestone `M<N>` · *Objetivo:* <uma frase> · *Requisitos:* <FR-<ÁREA>-NN · …> · *Resultados:* <o que existe quando fecha>

Subtarefas: T1 — formato novo em `docs/DATABASE.md` (§6.7) · T2 — testes do §10 · T3 — migração em `<módulo>` (FR-<ÁREA>-NN) · T4 — ensaio com dado real e rollback conferido (§10, §12) · T5 — documentação afetada (§13) · T6 — testes + self-review.

## Gate — Definition of Ready da migração

> Dois níveis, como no [`README.md`](README.md) desta pasta (seção "Specs de migração de dados e configuração"). A cópia não repete os itens: escreve "herdado do template, não repetir" e uma tabela "Estado real" (`Item | Passa / não passa | Motivo`), uma linha por item dos dois gates.

### Gate de rascunho (DoR-R) — de `proposta` a `revisada`

A spec vira `revisada` com **todos** os itens marcados e o aval do Victor ao desenho, com a data no cabeçalho.

- [ ] **1-R. Marcadores:** nenhum `[PRECISA ESCLARECER]` com `rascunho` aberto no §14; nenhum ponto sem origem decidido no texto.
- [ ] **2. Diagramas** (§6.6, §6.8 e, com status, §6.2) ou `N/A` com motivo; **fluxograma ↔ FR nos dois sentidos** (checklist do §6.8).
- [ ] **3. §2.1 preenchido**, e cada FR e cada invariante do §4 com ao menos um critério DADO/QUANDO/ENTÃO (§7); NFR aplicável com verificação, o resto `N/A` com motivo.
- [ ] **4. Formato fechado:** antes e depois no §6.6, mapa do §8 completo, default de todo campo novo; formato atual ancorado no código (§1).
- [ ] **5. Constituição conferida** (§0, blocos A a E); violação com linha em F e aval; dependência nova → ADR em `docs/DECISIONS.md`.
- [ ] **6. Rollback descrito** (§12), com o backup e o ponto de não retorno.

### Gate de execução (DoR-E) — de `revisada` a `aprovada`, antes do código

- [ ] **1-E. Nenhum marcador que bloqueie esta spec** (`rascunho` ou `execução` no §14).
- [ ] **7. `docs/DATABASE.md` com o formato novo** antes do código (§6.7), e os testes do §10 listados, cada um com o critério do §7 que prova.
- [ ] **8. ADRs de que a spec depende aceitas** (§0, bloco D).

## Definition of Done da migração

> A cópia escreve "herdada do template, não repetir" e lista só os itens próprios do dado, em uma linha.

- [ ] `npm run typecheck` e `npm test` verdes, de dentro de `frontend/`; critérios do §7 verdes, cada um com o teste ou o passo do ensaio que o prova.
- [ ] Ensaio manual com dado real feito (§10), com o app aberto por `npm run dev`, e rollback conferido (§12).
- [ ] `docs/DATABASE.md` e `docs/CHANGELOG.md` atualizados, com o porquê; o §13 cumprido.
- [ ] Nenhum segredo, `config.json` real, banco real ou trecho de log de usuário no diff; nada de texto ditado, áudio, clipboard, tecla ou chave no dado ou no log (C1).
- [ ] Commits em Conventional Commits, em pt-BR, citando o requisito, **sem** atribuição de IA (sem `Co-Authored-By`); pendências declaradas (`PEND-NNN` no SDD), nunca implícitas.
