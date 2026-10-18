# PRD — Touch Speaker

> Última atualização: 18/out/2026 · Mantenedor: Victor Alves
> **Versão:** 0.1 · **Data:** 17/out/2026 · **Fase coberta em detalhe:** 1 (MVP — ditado básico)
> Contexto de negócio em [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md). Spec executável da Fase 1 em
> [spec/features/ditado-por-voz.md](spec/features/ditado-por-voz.md).

## Visão

Um app de bandeja para Windows e macOS que transforma fala em texto digitado no app em foco. A pessoa segura
uma tecla, fala, solta, e o texto aparece onde está o cursor (VS Code, navegador, WhatsApp, Slack,
Word, Claude Code), como se tivesse sido digitado.

Hoje o app roda no Windows. O macOS entra na M2 ([ADR-11](DECISIONS.md#adr-11--macos-como-plataforma-suportada-e-distribuição-restrita-antes-da-fase-4),
aceita em 18/out/2026; spec [`distribuicao-windows-macos`](spec/features/distribuicao-windows-macos.md) aprovada,
ainda não implementada). Linux vem depois, sem data; mobile fica fora.

O que fica de fora em cada fase está em [Fora de escopo](#fora-de-escopo) e no SDD
([`spec/spec-driven-development.md`](spec/spec-driven-development.md)).

## Estado atual

A **Fase 1 está implementada**: as tarefas T1–T8 da spec entraram em `frontend/` em 17/out/2026, com
30/30 testes automatizados passando (`npm test`; TEST-001…004 no SDD §20.1). O app funciona de ponta a
ponta no PC do Victor: no V2 do roteiro manual, dois ditados em mãos livres no Bloco de Notas (falas de
4,6 s e 10,5 s) foram inseridos em 0,88 s e 0,66 s depois do fim da fala, e o microfone abriu em 270 ms e
75 ms. O consumo em repouso foi medido em 205 MB de memória privada (NFR-03).

Falta fechar a Fase 1: o resto do roteiro manual (V1 e V3–V13) e a medição de latência com 30 ditados
são a PEND-001 (T9); a spec passar a `implementada` é a PEND-002 (T10). Até lá, só o FR-DICT-02 tem
verificação manual feita; os demais estão implementados com a verificação manual pendente.

Em paralelo, a milestone M2 ([doc-pai](milestones/M2-app-com-interface.md), aberta pelo Victor em 18/out/2026)
adiantou itens das fases seguintes. No código desde 18/out/2026, ainda não commitado e com os roteiros manuais
pendentes: a janela principal com a chave da Groq em Configurações, o **histórico local** (FR-HIST-01, agora
implementado no código), o Início com os dados do histórico e o tema claro/escuro escolhido na janela — ver
[Adiantado pela M2](#adiantado-pela-m2-18out2026).

### Jornada do usuário

**Segurar para falar (caminho feliz)**

1. Pessoa está num campo de texto em qualquer app.
2. Segura **Ctrl direito** → pílula aparece "Ouvindo…" com barras do nível do microfone.
3. Fala. Solta a tecla → pílula "Transcrevendo…".
4. Texto aparece no cursor. Pílula some. Clipboard volta ao que era.

**Mãos livres**

1. Toque rápido no **Ctrl direito** → pílula "Ouvindo… (toque de novo para terminar)".
2. Fala com as mãos livres.
3. Novo toque → mesmo fim do fluxo anterior.

**Erro**

1. Algo falha (sem rede, limite, chave inválida).
2. Pílula mostra o glifo de alerta e a mensagem na cor de erro por ~4 s.
3. Nada é inserido. Se a transcrição já existia e só a colagem falhou, o texto fica no clipboard (FR-DICT-10).

## Personas

| Persona | Necessidade | Fase |
| --- | --- | --- |
| **Dev multitarefa** (Victor) | Escreve o dia todo em pt-BR misturado com termos técnicos em inglês; alterna entre editor, terminal, navegador e mensageiros | 1 |
| **Profissional que escreve muito** | Advogado, médico, gestor, criador de conteúdo; quer texto limpo sem revisar | 4 |

## Requisitos funcionais

IDs estáveis; a spec da feature e os testes citam estes IDs. Os requisitos das fases seguintes estão em
resumo e viram spec própria quando entrarem.

| ID | Requisito | Prioridade | Status | Fase |
| --- | --- | --- | --- | --- |
| FR-DICT-01 | **Segurar para falar.** Segurar a tecla de ditado (padrão: **Ctrl direito**) inicia a gravação; soltar encerra e dispara a transcrição | Deve | Implementado (TEST-001); verificação manual pendente (PEND-001) | 1 |
| FR-DICT-02 | **Mãos livres.** Toque curto (< 500 ms) inicia a gravação sem precisar segurar; o próximo toque encerra | Deve | Implementado — verificado (V2, 17/out/2026; TEST-001) | 1 |
| FR-DICT-03 | **Cancelar.** `Esc` durante a gravação descarta o áudio sem transcrever | Deve | Implementado (TEST-001); verificação manual pendente (PEND-001) | 1 |
| FR-DICT-04 | **Transcrição em pt-BR** via Groq Whisper `whisper-large-v3-turbo` com `language=pt` | Deve | Implementado (TEST-003); verificação manual pendente (PEND-001) | 1 |
| FR-DICT-05 | **Inserir no app em foco.** O texto é colado no cursor do app que estava em foco ao terminar a fala | Deve | Implementado; verificação manual pendente (PEND-001) | 1 |
| FR-DICT-06 | **Clipboard preservado.** O conteúdo que a pessoa tinha no clipboard volta depois da inserção | Deve | Implementado; verificação manual pendente (PEND-001) | 1 |
| FR-DICT-07 | **Pílula de status** flutuante mostra: gravando (com nível do microfone), transcrevendo, erro | Deve | Implementado; verificação manual pendente (PEND-001) | 1 |
| FR-DICT-08 | **Sem lixo.** Gravações < 0,5 s são descartadas; transcrições que o Whisper marca como sem fala (`no_speech_prob` alto) não são inseridas | Deve | Implementado (TEST-002); verificação manual pendente (PEND-001) | 1 |
| FR-DICT-09 | **Erros visíveis.** Sem chave, sem internet, limite da Groq, microfone ocupado, app de destino bloqueando colagem → mensagem na pílula | Deve | Implementado (TEST-003); verificação manual pendente (PEND-001) | 1 |
| FR-DICT-10 | **Fallback de colagem.** Se o Ctrl+V simulado falhar (ex.: app rodando como administrador), o texto fica no clipboard e a pílula avisa "Texto copiado — cole com Ctrl+V" | Deve | Implementado; verificação manual pendente (PEND-001) | 1 |
| FR-DICT-11 | **Limite de sessão** de 5 min por gravação, com aviso aos 4:30 | Deve | Implementado; verificação manual pendente (PEND-001) | 1 |
| FR-DICT-12 | **Bandeja.** Ícone na bandeja com: status, microfone em uso, "Sair" | Deve | Implementado; verificação manual pendente (PEND-001) | 1 |
| FR-DICT-13 | **Config em arquivo** (`config.json`): tecla, idioma, microfone | Deve | Implementado (TEST-004); verificação manual pendente (PEND-001) | 1 |
| FR-CLEAN-01 | Limpeza por IA (Claude Haiku): remove "é…", "tipo", repetições; aplica autocorreção falada ("não, quer dizer…") | — | Planejado (Fase 2) | 2 |
| FR-VOCAB-01 | Dicionário pessoal: termos enviados no `prompt` do Whisper e na limpeza | — | Planejado (Fase 2) | 2 |
| FR-HIST-01 | Histórico local dos ditados (texto, duração), com "copiar de novo" — sem o app em foco, por decisão do Victor de 18/out/2026 | — | Implementado no código (18/out/2026, adiantado pela M2; TEST-010…017); verificação manual pendente (PEND-009) | 2 |
| FR-SET-01 | Tela de configurações (tecla, microfone, idioma, iniciar com o Windows) | — | Implementado no código, em parte (18/out/2026, adiantado pela M2 — spec [`janela-principal`](spec/features/janela-principal.md) FR-UI-26…38): tecla, idioma, modelo, limiares, posição da pílula, sons, retenção do histórico, tema e a chave da Groq editáveis na janela principal; o microfone só aparece para leitura (FR-UI-27 — a escolha do dispositivo fica para depois); "Iniciar com o Windows" só funciona com o app empacotado (FR-UI-36, 37 — spec `distribuicao-windows-macos`); verificação manual pendente (PEND-007) | 2 |
| FR-CTX-01 | Contexto do app em foco (nome, título, texto ao redor do cursor) para ajustar o tom | — | Planejado (Fase 3) | 3 |
| FR-ASK-01 | "Ask Anything": comando por voz sobre texto selecionado (reescrever, resumir, responder) | — | Planejado (Fase 3) | 3 |
| FR-TRANS-01 | Ditado com tradução para outro idioma | — | Planejado (Fase 3) | 3 |
| FR-ACC-01 | Contas, backend próprio guardando as chaves dos provedores, cota por usuário | — | Planejado (Fase 4) | 4 |

As regras de negócio que esses requisitos aplicam (BR-001…015), a forma EARS de cada requisito e os
critérios DADO/QUANDO/ENTÃO (AC-001…013) estão no SDD
([§4](spec/spec-driven-development.md#4-requisitos-funcionais),
[§6](spec/spec-driven-development.md#6-regras-de-negócio) e
[Apêndice C](spec/spec-driven-development.md#apêndice-c--critérios-de-aceite)). A prioridade das fases 2–4
é definida na spec de cada fase.

### Adiantado pela M2 (18/out/2026)

A M2 ([doc-pai](milestones/M2-app-com-interface.md)) traz para agora itens que o roadmap abaixo põe na Fase 2.
Registrar essa troca de ordem no roadmap e no SDD §29 é a PEND-novo-1 do doc-pai, para aval do Victor; até lá a
tabela de fases não muda. O que já está no código (18/out/2026, não commitado):

| Item | Requisitos | Origem | Estado |
| --- | --- | --- | --- |
| **Histórico local** — cada ditado que termina com texto fica guardado, só como texto, num SQLite na pasta local do Windows; tela Histórico com busca, "Copiar" de novo, apagar um e apagar tudo; retenção em Configurações (padrão 30 dias, "Nunca guardar", "Para sempre") | FR-HIST-01, decomposto em FR-HIST-01…26 na spec [`historico`](spec/features/historico.md) e FR-HIST-27…31 na spec de migração [`historico-dados-v1`](spec/features/historico-dados-v1.md) (banco `0001` e `history.retentionDays`) | este PRD (FR-HIST-01). O "app" saiu do requisito por decisão do Victor de 18/out/2026: nada do app em foco é guardado (FR-HIST-05); contexto do app continua sendo o FR-CTX-01, da Fase 3 | implementado no código; roteiro VH1–VH13 e ensaio da migração pendentes (PEND-009) |
| **Início com os dados do histórico** — os 3 ditados mais recentes, com "Copiar" e "Ver todos", e o card "Seu uso": palavras, ditados e tempo falando, hoje e em todo o histórico, e a média de palavras por minuto | FR-HIST-22…26 (spec `historico`), na tela da [`janela-principal`](spec/features/janela-principal.md) (FR-UI-15) | pedido do Victor de 18/out/2026 | implementado no código; roteiro VH13 pendente (PEND-009) |
| **Tema claro/escuro escolhido na janela** — botão de sol/lua na barra lateral, card "Aparência" em Configurações com "Seguir o sistema"; campo `theme` no `config.json` (padrão `"system"`) | FR-UI-39…42 (spec `janela-principal`) | pedido do Victor de 18/out/2026 — não consta deste PRD | implementado no código; roteiro VJ25–VJ27 pendente (PEND-010) |

As regras e os critérios desses itens estão no SDD: BR-017 e BR-018 (histórico) e BR-019 (tema); AC-076…AC-111
(histórico e migração) e AC-112…AC-115 (tema).

## Requisitos não-funcionais

| ID | Requisito | Meta |
| --- | --- | --- |
| NFR-01 | Latência soltar→texto | p50 ≤ 1,5 s, p95 ≤ 3 s para falas ≤ 30 s |
| NFR-02 | Início da gravação | Captura começa ≤ 300 ms após a tecla (as primeiras sílabas podem ser cortadas no MVP — conhecido) |
| NFR-03 | Consumo em repouso | ≤ 220 MB de memória privada (somando os processos do Electron) e ~0% de CPU com o app parado na bandeja. Medido em 17/out/2026: 205 MB com aceleração de hardware desligada. A meta original de 150 MB fica abaixo do piso do Electron com uma janela; se virar problema, o caminho é Tauri ([ADR-01](DECISIONS.md#adr-01--electron--typescript)) |
| NFR-04 | Privacidade | Microfone só aberto durante a gravação; áudio não é salvo em disco; texto ditado nunca vai para log |
| NFR-05 | Segurança Electron | `contextIsolation`, `sandbox`, sem `nodeIntegration`, preload com API mínima, CSP restrita ([Security Guide](Security-Guide.md)) |
| NFR-06 | Plataforma | Windows 10/11 x64 (Fase 1, implementado) e macOS 13+ em Apple Silicon (M2, ADR-11 — especificado e aprovado, em implementação). Linux planejado para depois, sem data; mobile, Mac Intel e Windows arm64 fora do escopo |
| NFR-07 | Qualidade de código | TypeScript estrito, sem `any` sem justificativa |

Verificação e status de cada NFR: [SDD §5](spec/spec-driven-development.md#5-requisitos-não-funcionais).
NFR-01 ainda não tem medição p50/p95 (PEND-001); o corte das primeiras sílabas do NFR-02 é o RISK-011.

## Critérios de aceite

Marcado `[x]` só o que foi **verificado manualmente** até 17/out/2026. Cada item traz o critério e o que
o verifica: `V<N>` é o passo do roteiro manual da spec da Fase 1 (§12.2) e `TEST-NNN`, a suíte automatizada
do SDD §20.1. O mesmo critério no formato DADO/QUANDO/ENTÃO está no SDD, Apêndice C (AC-001…013).

**FR-DICT-01 — Segurar para falar**

- [ ] Segurar ≥ 500 ms e soltar → texto inserido (V1; TEST-001)
- [ ] Auto-repetição da tecla não abre gravações extras (TEST-001)

**FR-DICT-02 — Mãos livres**

- [x] Toque, fala de 20 s sem segurar, toque → texto inserido — verificado no V2 (17/out/2026) com falas de
  4,6 s e 10,5 s no Bloco de Notas, inseridas em 0,88 s e 0,66 s; TEST-001

**FR-DICT-03 — Cancelar**

- [ ] `Esc` durante a gravação → nada é enviado à Groq e nada é inserido; o indicador de microfone apaga
  (V3; TEST-001). Limitação conhecida: o `Esc` também chega ao app em foco (RISK-013)

**FR-DICT-04 — Transcrição em pt-BR**

- [ ] Fala com termos em inglês ("fazer o deploy no Docker") sai com os termos corretos na maioria dos
  casos (H1) (V4; TEST-003 cobre o cliente da Groq)

**FR-DICT-05 — Inserir no app em foco**

- [ ] Funciona nos apps da lista de aceite (abaixo) (V5)
- [ ] O foco nunca vai para a janela do Touch Speaker (V7)

**FR-DICT-06 — Clipboard preservado**

- [ ] Copiar "ABC", ditar "teste", Ctrl+V manual → cola "ABC" (V6)

**FR-DICT-07 — Pílula de status**

- [ ] Pílula aparece ≤ 150 ms após a tecla; não rouba foco nem clique (V7)

**FR-DICT-08 — Sem lixo**

- [ ] Toque acidental ou silêncio de 3 s → nada é digitado (V8; TEST-002)

**FR-DICT-09 — Erros visíveis**

- [ ] Cada cenário mostra texto claro em pt-BR; o app nunca fecha nem falha em silêncio (V9; TEST-003 cobre o
  mapa dos erros HTTP para os códigos internos)

**FR-DICT-10 — Fallback de colagem**

- [ ] Ditar no Prompt de Comando aberto como administrador → aviso + texto no clipboard (V10)

**FR-DICT-11 — Limite de sessão**

- [ ] Aos 5:00 a gravação encerra e transcreve sozinha (V11, com `maxRecordingMs` reduzido para 40 s no
  config: aviso aos 10 s, encerra aos 40 s)

**FR-DICT-12 — Bandeja**

- [ ] Fechar pela bandeja encerra o hook de teclado e o processo (V12)

**FR-DICT-13 — Config em arquivo**

- [ ] Trocar a tecla no arquivo e reiniciar → nova tecla vale (V13; TEST-004 cobre a validação do arquivo)

**Latência (NFR-01)**

- [ ] 30 ditados, p50/p95 calculados do log (PEND-001)

**Apps de aceite (FR-DICT-05)**

A Fase 1 está pronta quando **todos** os FR-DICT passam e a colagem funciona nestes apps:

- [ ] VS Code (editor e chat do Claude Code)
- [ ] Windows Terminal / PowerShell (com Claude Code CLI aberto)
- [ ] Chrome: Gmail, campo de busca, Google Docs
- [ ] WhatsApp Desktop
- [ ] Slack ou Discord
- [ ] Bloco de Notas e Word — o Bloco de Notas foi usado no V2, mas não é marcado até o roteiro completo
- [ ] Prompt de Comando como administrador → cai no fallback (FR-DICT-10)

## Fora de escopo

Fase 1 não tem: limpeza por IA, dicionário, histórico, tela de configurações, tradução, comandos por
voz, contexto do app, contas, backend, instalador assinado, auto-update, macOS/Linux/mobile,
streaming de áudio durante a fala. (O macOS deixou de esperar a Fase 4: entra na M2 pela ADR-11; Linux fica
para depois, sem data; mobile continua fora.)

Nada disso entra na Fase 1 "porque era fácil" (C8): cada item volta pela spec da fase em que está no
roadmap abaixo.

### Roadmap

| Fase | Entrega | Depende de | Estado |
| --- | --- | --- | --- |
| 1 | Ditado básico (este documento) | Chave Groq gratuita | Implementada (T1–T8); em verificação (PEND-001, PEND-002) |
| 2 | Limpeza por IA, dicionário, histórico local, tela de configurações | Chave Anthropic; `database/` local | Planejada; o histórico local e a tela de configurações foram adiantados pela M2 — no código desde 18/out/2026, em verificação ([Adiantado pela M2](#adiantado-pela-m2-18out2026)) |
| 3 | Contexto do app (UI Automation), Ask Anything, tradução, aprendizado por edição | Fase 2 | Planejada |
| 4 | Backend próprio, contas, cotas, instalador assinado, auto-update | Decisão de produto [PRECISA ESCLARECER: qual decisão de produto abre a Fase 4 — quando e com que critério o app passa a ser distribuído para outras pessoas?] | Planejada |

**Plataformas** (fora da tabela de fases — [ADR-11](DECISIONS.md#adr-11--macos-como-plataforma-suportada-e-distribuição-restrita-antes-da-fase-4)):

| Plataforma | Estado |
| --- | --- |
| Windows 10/11 x64 | Suportado — o app roda hoje (modo de desenvolvimento) |
| macOS 13+ (Apple Silicon) | Planejado na M2 — spec `distribuicao-windows-macos` aprovada, ainda não implementada |
| Linux | Planejado para depois, sem data; entra por spec própria |
| Mobile | Fora |

Fases com o que cada uma fecha (pendências e riscos): [SDD §29](spec/spec-driven-development.md#29-roadmap-e-fases).

---

Contexto: [`PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md) · Contrato de engenharia: [`spec/spec-driven-development.md`](spec/spec-driven-development.md) · Arquitetura: [`ARCHITECTURE.md`](ARCHITECTURE.md) · API: [`API.md`](API.md) · Decisões: [`DECISIONS.md`](DECISIONS.md) · Spec da Fase 1: [`spec/features/ditado-por-voz.md`](spec/features/ditado-por-voz.md) · Referência (não normativa): [`referencia/estudo-typeless.md`](referencia/estudo-typeless.md)
