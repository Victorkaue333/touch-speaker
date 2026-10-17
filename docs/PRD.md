# PRD — Touch Speaker

> **Versão:** 0.1 · **Data:** 17/out/2026 · **Fase coberta em detalhe:** 1 (MVP — ditado básico)
> Contexto de negócio em [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md). Spec executável da Fase 1 em
> [spec/features/ditado-por-voz.md](spec/features/ditado-por-voz.md).

## Visão

Um app de bandeja para Windows que transforma fala em texto digitado no app em foco. A pessoa segura
uma tecla, fala, solta, e o texto aparece onde está o cursor (VS Code, navegador, WhatsApp, Slack,
Word, Claude Code), como se tivesse sido digitado.

## Personas

| Persona | Descrição | Fase |
| --- | --- | --- |
| **Dev multitarefa** (Victor) | Escreve o dia todo em pt-BR misturado com termos técnicos em inglês; alterna entre editor, terminal, navegador e mensageiros | 1 |
| **Profissional que escreve muito** | Advogado, médico, gestor, criador de conteúdo; quer texto limpo sem revisar | 4 |

## Requisitos funcionais

IDs estáveis; a spec da feature e os testes citam estes IDs.

### Fase 1 — Ditado básico (`DICT`)

| ID | Requisito | Critério de aceite |
| --- | --- | --- |
| FR-DICT-01 | **Segurar para falar.** Segurar a tecla de ditado (padrão: **Ctrl direito**) inicia a gravação; soltar encerra e dispara a transcrição | Segurar ≥ 500 ms e soltar → texto inserido. Auto-repetição da tecla não abre gravações extras |
| FR-DICT-02 | **Mãos livres.** Toque curto (< 500 ms) inicia a gravação sem precisar segurar; o próximo toque encerra | Toque, fala de 20 s sem segurar, toque → texto inserido |
| FR-DICT-03 | **Cancelar.** `Esc` durante a gravação descarta o áudio sem transcrever | Nada é enviado à Groq e nada é inserido. Limitação conhecida: o `Esc` também chega ao app em foco |
| FR-DICT-04 | **Transcrição em pt-BR** via Groq Whisper `whisper-large-v3-turbo` com `language=pt` | Fala com termos em inglês ("fazer o deploy no Docker") sai com os termos corretos na maioria dos casos (H1) |
| FR-DICT-05 | **Inserir no app em foco.** O texto é colado no cursor do app que estava em foco ao terminar a fala | Funciona nos apps da lista de aceite (abaixo). O foco nunca vai para a janela do Touch Speaker |
| FR-DICT-06 | **Clipboard preservado.** O conteúdo que a pessoa tinha no clipboard volta depois da inserção | Copiar "ABC", ditar "teste", Ctrl+V manual → cola "ABC" |
| FR-DICT-07 | **Pílula de status** flutuante mostra: gravando (com nível do microfone), transcrevendo, erro | Pílula aparece ≤ 150 ms após a tecla; não rouba foco nem clique |
| FR-DICT-08 | **Sem lixo.** Gravações < 0,5 s são descartadas; transcrições que o Whisper marca como sem fala (`no_speech_prob` alto) não são inseridas | Toque acidental ou silêncio de 3 s → nada é digitado |
| FR-DICT-09 | **Erros visíveis.** Sem chave, sem internet, limite da Groq, microfone ocupado, app de destino bloqueando colagem → mensagem na pílula | Cada cenário mostra texto claro em pt-BR; o app nunca fecha nem falha em silêncio |
| FR-DICT-10 | **Fallback de colagem.** Se o Ctrl+V simulado falhar (ex.: app rodando como administrador), o texto fica no clipboard e a pílula avisa "Texto copiado — cole com Ctrl+V" | Ditar no Prompt de Comando aberto como administrador → aviso + texto no clipboard |
| FR-DICT-11 | **Limite de sessão** de 5 min por gravação, com aviso aos 4:30 | Aos 5:00 a gravação encerra e transcreve sozinha |
| FR-DICT-12 | **Bandeja.** Ícone na bandeja com: status, microfone em uso, "Sair" | Fechar pela bandeja encerra o hook de teclado e o processo |
| FR-DICT-13 | **Config em arquivo** (`config.json`): tecla, idioma, microfone | Trocar a tecla no arquivo e reiniciar → nova tecla vale |

### Fases seguintes (resumo — viram spec própria quando entrarem)

| ID | Requisito | Fase |
| --- | --- | --- |
| FR-CLEAN-01 | Limpeza por IA (Claude Haiku): remove "é…", "tipo", repetições; aplica autocorreção falada ("não, quer dizer…") | 2 |
| FR-VOCAB-01 | Dicionário pessoal: termos enviados no `prompt` do Whisper e na limpeza | 2 |
| FR-HIST-01 | Histórico local dos ditados (texto, app, duração), com "copiar de novo" | 2 |
| FR-SET-01 | Tela de configurações (tecla, microfone, idioma, iniciar com o Windows) | 2 |
| FR-CTX-01 | Contexto do app em foco (nome, título, texto ao redor do cursor) para ajustar o tom | 3 |
| FR-ASK-01 | "Ask Anything": comando por voz sobre texto selecionado (reescrever, resumir, responder) | 3 |
| FR-TRANS-01 | Ditado com tradução para outro idioma | 3 |
| FR-ACC-01 | Contas, backend próprio guardando as chaves dos provedores, cota por usuário | 4 |

## Requisitos não-funcionais

| ID | Requisito | Meta |
| --- | --- | --- |
| NFR-01 | Latência soltar→texto | p50 ≤ 1,5 s, p95 ≤ 3 s para falas ≤ 30 s |
| NFR-02 | Início da gravação | Captura começa ≤ 300 ms após a tecla (as primeiras sílabas podem ser cortadas no MVP — conhecido) |
| NFR-03 | Consumo em repouso | ≤ 220 MB de memória privada (somando os processos do Electron) e ~0% de CPU com o app parado na bandeja. Medido em 17/out/2026: 205 MB com aceleração de hardware desligada. A meta original de 150 MB fica abaixo do piso do Electron com uma janela; se virar problema, o caminho é Tauri ([ADR-01](ARCHITECTURE.md#adr-01--electron--typescript)) |
| NFR-04 | Privacidade | Microfone só aberto durante a gravação; áudio não é salvo em disco; texto ditado nunca vai para log |
| NFR-05 | Segurança Electron | `contextIsolation`, `sandbox`, sem `nodeIntegration`, preload com API mínima, CSP restrita ([Security Guide](Security-Guide.md)) |
| NFR-06 | Plataforma | Windows 10/11 x64. Outras plataformas fora do escopo |
| NFR-07 | Qualidade de código | TypeScript estrito, sem `any` sem justificativa |

## Fluxos principais

### Segurar para falar (caminho feliz)

1. Pessoa está num campo de texto em qualquer app.
2. Segura **Ctrl direito** → pílula aparece "Ouvindo…" com barras do nível do microfone.
3. Fala. Solta a tecla → pílula "Transcrevendo…".
4. Texto aparece no cursor. Pílula some. Clipboard volta ao que era.

### Mãos livres

1. Toque rápido no **Ctrl direito** → pílula "Ouvindo… (toque de novo para terminar)".
2. Fala com as mãos livres.
3. Novo toque → mesmo fim do fluxo anterior.

### Erro

1. Algo falha (sem rede, limite, chave inválida).
2. Pílula fica vermelha com a mensagem por ~4 s.
3. Nada é inserido. Se a transcrição já existia e só a colagem falhou, o texto fica no clipboard (FR-DICT-10).

## Critérios de aceite da Fase 1

A Fase 1 está pronta quando **todos** os FR-DICT passam e a colagem funciona nestes apps:

- [ ] VS Code (editor e chat do Claude Code)
- [ ] Windows Terminal / PowerShell (com Claude Code CLI aberto)
- [ ] Chrome: Gmail, campo de busca, Google Docs
- [ ] WhatsApp Desktop
- [ ] Slack ou Discord
- [ ] Bloco de Notas e Word
- [ ] Prompt de Comando como administrador → cai no fallback (FR-DICT-10)

## Fora de escopo

Fase 1 não tem: limpeza por IA, dicionário, histórico, tela de configurações, tradução, comandos por
voz, contexto do app, contas, backend, instalador assinado, auto-update, macOS/Linux/mobile,
streaming de áudio durante a fala.

## Roadmap

| Fase | Entrega | Depende de |
| --- | --- | --- |
| 1 | Ditado básico (este documento) | Chave Groq gratuita |
| 2 | Limpeza por IA, dicionário, histórico local, tela de configurações | Chave Anthropic; `database/` local |
| 3 | Contexto do app (UI Automation), Ask Anything, tradução, aprendizado por edição | Fase 2 |
| 4 | Backend próprio, contas, cotas, instalador assinado, auto-update | Decisão de produto |
