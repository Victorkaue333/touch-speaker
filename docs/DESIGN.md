# DESIGN.md — Touch Speaker

Guia de interface para quem escreve tela (gente e agente de IA). Diz **o que existe**, **o que não fazer** e
**o que ainda não está decidido**. Não há design system nem biblioteca de componentes: na Fase 1 a interface
é uma janela flutuante — a **pílula** (`pill.html`, `pill.css` e `pill.ts`, sem framework) — e o **ícone da
bandeja** com o seu menu, desenhados e montados em código. Este arquivo descreve o que esse conjunto faz
hoje, extraído do código.

> Última atualização: 17/out/2026 · Mantenedor: Victor Alves
> Ordem de precedência: [`DECISIONS.md`](DECISIONS.md) → [SDD](spec/spec-driven-development.md) →
> [`CLAUDE.md`](../CLAUDE.md) → este arquivo. Em qualquer divergência com o código, **o código é a fonte de
> fato** sobre o que existe (`frontend/src/renderer/`, `frontend/src/main/`). O
> [estudo de referência](referencia/estudo-typeless.md) não é normativo e é fonte proibida de cor, ícone, som
> e texto ([ADR-07](DECISIONS.md#adr-07--sala-limpa-em-relação-ao-typeless)).

**Estado atual — Fase 1: a interface é a pílula e o ícone da bandeja.** As âncoras foram conferidas em
17/out/2026 sobre o commit `ed0a1f5`, com a Fase 1 implementada (T1–T8) e funcionando de ponta a ponta no PC do
Victor (V2). O roteiro manual que confere a pílula e a bandeja (V7, V12 e os demais) está pendente
(PEND-001). Tela de configurações e histórico são da Fase 2 (PLANEJADO) e não existem.

**Âncoras.** Todo caminho é relativo a `frontend/`. A interface mora em `src/renderer/` (`pill.html`,
`pill.css`, `pill.ts`, `global.d.ts`); a janela, em `src/main/pill-window.ts`; o ícone e o menu da bandeja, em
`src/main/icon.ts` e `src/main/tray.ts`; todos os textos, em `src/main/strings.ts`; os estados, em
`src/shared/ipc.ts`. Não há §15: a seção de painel administrativo do modelo destes guias não se aplica a um
app de bandeja.

---

## 1. Princípios

1. **Invisível até ser útil.** Nada na tela enquanto a pessoa não está ditando.
2. **Nunca roubar o foco.** O texto vai para o app em que a pessoa está; a interface do Touch Speaker
   não recebe foco, clique nem teclado.
3. **Estado sempre legível de relance.** Ouvindo, transcrevendo, erro: cor + forma + 1–4 palavras.
4. **Feedback imediato.** A pílula aparece em ≤ 150 ms depois da tecla; o som confirma sem precisar olhar.
5. **Identidade própria.** Inspiração de comportamento em produtos do mercado, mas cores, ícones,
   sons e textos são do Touch Speaker ([ADR-07](DECISIONS.md#adr-07--sala-limpa-em-relação-ao-typeless)).

## 2. Fontes da verdade

| O quê | Onde |
| --- | --- |
| Tokens de cor | `src/renderer/pill.css`, variáveis CSS em `:root` (linhas 2–11) |
| Textos da interface | `src/main/strings.ts` — um lugar só, pronto para i18n; o renderer não tem strings próprias |
| Estados da pílula | `src/shared/ipc.ts` (`PillStateName`, `PillState`), espelhados em `src/renderer/global.d.ts` |
| Marcação e comportamento da pílula | `src/renderer/pill.html`, `src/renderer/pill.ts` |
| Janela da pílula (tamanho, posição, foco) | `src/main/pill-window.ts` |
| Ícone e menu da bandeja | `src/main/icon.ts` (glifo desenhado em código), `src/main/tray.ts` |
| Sons | `src/renderer/pill.ts` (gerados com Web Audio) |
| Quando cada estado aparece | `src/main/session.ts` (`SessionController`, dono único do estado) |
| Preferências que mudam a interface | `config.json`: `pill.position`, `sounds` ([`DATABASE.md`](DATABASE.md#configjson)) |
| Marca | `docs/assets/logo.svg` (§14) |

Tocam a interface a ADR-07 (sala limpa) e os princípios C1 (privacidade por padrão), C2 (nunca roubar o foco)
e C3 (nunca digitar lixo) da Constituição
([SDD §1.5](spec/spec-driven-development.md#15-princípios-do-produto--constituição-c1c8)). Este documento
descreve; o código é a referência final.

## 3. Cor

Tema escuro único na Fase 1 (a pílula flutua sobre qualquer fundo; escuro com borda clara contrasta
em fundos claros e escuros). Há **uma paleta**, a de `pill.css`; o ícone da bandeja repete dois valores dela
como constantes em código, porque é desenhado pixel a pixel (`src/main/icon.ts:4-5`).

### 3.1 Paleta (`pill.css`)

| Token | Valor | Uso | Linha |
| --- | --- | --- | --- |
| `--ts-surface` | `rgba(18, 18, 22, 0.92)` | Fundo da pílula | `pill.css:3` |
| `--ts-border` | `rgba(255, 255, 255, 0.14)` | Borda 1 px | `:4` |
| `--ts-text` | `#F4F4F5` | Texto principal | `:5` |
| `--ts-text-muted` | `#A1A1AA` | Dica secundária ("toque de novo para terminar") e cronômetro | `:6` |
| `--ts-listening` | `#13A89E` | Cor da marca: barras do microfone, ponto de "ouvindo", glifo do ícone da bandeja e logo | `:7` |
| `--ts-working` | `#D4D4D8` | Animação de "transcrevendo" (neutra de propósito, para não competir com a cor da marca) | `:8` |
| `--ts-error` | `#F87171` | Erro; também o ponto de "gravando" do ícone da bandeja | `:9` |
| `--ts-notice` | `#FBBF24` | Aviso (ex.: "Texto copiado — cole com Ctrl+V") e cronômetro nos últimos 30 s | `:10` |

Contraste do texto sobre `--ts-surface` ≥ 4,5:1.

### 3.2 Cor de estado

| Estado | Cor | Forma | Onde |
| --- | --- | --- | --- |
| Ouvindo (`listening`) | `--ts-listening` | Ponto de 8 px + 7 barras do microfone | `pill.css:99-117`, `:165-168` |
| Últimos 30 s da gravação | `--ts-notice` no cronômetro | Igual ao "ouvindo" | `pill.css:80-82` |
| Transcrevendo (`transcribing`) | `--ts-working` | 3 pontos pulsando | `pill.css:119-148`, `:170-172` |
| Erro (`error`) | `--ts-error` no glifo e no texto | Triângulo de alerta | `pill.css:155-157`, `:174-181` |
| Aviso (`notice`) | `--ts-notice` no glifo | Prancheta (clipboard) em contorno | `pill.css:159-163`, `:174-177` |
| Bandeja gravando | `#F87171` (= `--ts-error`) no ponto | Ponto sobre o glifo de microfone | `src/main/icon.ts:5`, `:38-44` |

Cor nunca é o único sinal: todo estado tem forma e texto próprios (§13).

## 4. Tipografia

- Fonte: `"Segoe UI Variable", "Segoe UI", system-ui, sans-serif` (nativa do Windows 11/10;
  `pill.css:20`). Nenhuma fonte é baixada ou embutida.
- Pílula: 13 px, peso 500 (`pill.css:43-44`). Dica secundária: 12 px, peso 400 (`:65-67`).
- Números (cronômetro): 12 px com `font-variant-numeric: tabular-nums` (`pill.css:74-78`).
- Não há escala tipográfica além dessas três medidas.

## 5. Forma, espaço, sombra e movimento

| Elemento | Especificação | Onde |
| --- | --- | --- |
| Pílula | Altura 40 px, raio 20 px, padding 0 14 px, largura automática (mín. 120, máx. 360 px), 10 px entre os elementos | `pill.css:29-51` |
| Sombra | `0 8px 24px rgba(0,0,0,0.35)` (a janela não tem sombra própria: `hasShadow: false`) | `pill.css:41`, `src/main/pill-window.ts:28` |
| Entrada | Fade + escala 0,96→1 em 120 ms, `ease-out` | `pill.css:46-50` |
| Saída | Fade em 160 ms; a janela se esconde 200 ms depois | `pill.css:53-57`, `src/main/pill-window.ts:72-76` |
| Barras do microfone | 7 barras de 3 px, altura 4–20 px seguindo o nível RMS, atualização a 30 fps (a cada 33 ms) | `pill.css:106-117`, `src/renderer/pill.ts:22-23`, `:80-96` |
| Transcrevendo | 3 pontos de 6 px pulsando em sequência, ciclo de 900 ms (atraso de 150 ms entre eles) | `pill.css:119-148` |

**Camadas.** A pílula fica acima de tudo, no nível `screen-saver` do `alwaysOnTop`
(`src/main/pill-window.ts:49`). Não há outras janelas.

**Movimento.** `prefers-reduced-motion`: sem escala nem pulso; troca de estado instantânea
(`pill.css:187-198`).

## 6. Componentes

Não há biblioteca de componentes: cada peça é marcação de `pill.html` com estilo em `pill.css`, ou objeto
nativo do Electron (`Tray`, `Menu`).

| Precisa de | O que existe | Onde |
| --- | --- | --- |
| Mostrar o estado do ditado | A pílula (§6.1) | `src/renderer/pill.html:14-27`, `src/main/pill-window.ts` |
| Mostrar que o app está rodando e gravando | Ícone da bandeja (§6.2) | `src/main/icon.ts`, `src/main/tray.ts` |
| Ações do usuário | Menu da bandeja (§6.3) | `src/main/tray.ts:26-34` |
| Confirmação não visual | Sons (§6.4) | `src/renderer/pill.ts:28-53` |

### 6.1 Pílula

**Janela.**

- `BrowserWindow` de 420 × 72 px sem moldura, transparente (`backgroundColor: '#00000000'`), sem
  redimensionar nem mover, `skipTaskbar`, `focusable: false`, `alwaysOnTop` nível `screen-saver`,
  `setIgnoreMouseEvents(true)`, exibida com `showInactive()` (`src/main/pill-window.ts:7-8`, `:21-51`,
  `:78-81`). A pílula fica centralizada dentro da janela.
- Posição: centralizada horizontalmente na tela onde está o cursor do mouse, 24 px acima da borda inferior
  da área de trabalho (respeita a barra de tarefas). Com `pill.position: "top-center"` no `config.json`, fica
  24 px abaixo da borda superior (`src/main/pill-window.ts:84-90`). A posição é calculada quando a janela
  aparece; durante a sessão ela não muda de tela.
- Criada escondida quando o app inicia, com o renderer já carregado, para aparecer rápido
  (`src/main/index.ts:97`, `:115`).

**Anatomia** (`src/renderer/pill.html:14-27`), da esquerda para a direita:

| Parte | O que é | Quando aparece |
| --- | --- | --- |
| Ponto | Círculo de 8 px em `--ts-listening` | `listening` |
| Barras | 7 barras de 3 px em `--ts-listening`, altura pelo nível do microfone | `listening` |
| Três pontos | Círculos de 6 px em `--ts-working`, pulsando | `transcribing` |
| Glifo de erro | Triângulo de alerta preenchido, 16 px, em `--ts-error` (SVG inline) | `error` |
| Glifo de aviso | Prancheta em contorno, 16 px, traço `--ts-notice` (SVG inline) | `notice` |
| Rótulo | Texto principal (`message`), cortado com reticências | Todo estado visível |
| Dica | Texto secundário (`hint`), some quando vazio | Mãos livres; últimos 30 s |
| Cronômetro | `m:ss`, em `--ts-text-muted` (em `--ts-notice` nos últimos 30 s) | Só em `listening` |

- O conjunto de ícones fica num `span` com `aria-hidden="true"`; a pílula tem `role="status"` e
  `aria-live="polite"` (`src/renderer/pill.html:14-15`).
- Estados e textos de cada estado: §7.2.

### 6.2 Ícone da bandeja

- Glifo próprio de microfone, desenhado pixel a pixel em código, sem arquivo de imagem
  (`src/main/icon.ts:14-55`), na cor da marca `#13A89E` (`--ts-listening`, `src/main/icon.ts:4`).
- Gerado em 16 px e nas escalas 1,5× e 2×, isto é, 16/24/32 px; o Windows escolhe pela escala da tela
  (`src/main/icon.ts:57-63`).
- Variante "gravando": o mesmo glifo com um ponto **vermelho** `#F87171` (o valor de `--ts-error`) no canto
  superior direito (`src/main/icon.ts:5`, `:38-44`). Troca enquanto a sessão grava e volta ao normal ao
  parar, cancelar ou falhar (`src/main/tray.ts:22-23`, `src/main/session.ts:98`, `:132`, `:148`, `:164`).
- A dica (tooltip) do ícone é o mesmo texto de estado da primeira linha do menu (`src/main/tray.ts:24-25`).

### 6.3 Menu da bandeja

Menu nativo do Windows (`Menu.buildFromTemplate`), refeito a cada mudança de estado
(`src/main/tray.ts:26-34`). Textos exatos de `src/main/strings.ts:9-15`:

| Item | Texto | Comportamento |
| --- | --- | --- |
| Estado (desabilitado) | "Touch Speaker — pronto" · "Touch Speaker — ouvindo" · "Touch Speaker — falta a chave da Groq" | Sem chave vale "falta a chave"; senão "ouvindo" enquanto grava; senão "pronto" (`src/main/tray.ts:24`) |
| Microfone (desabilitado) | "Microfone: padrão do Windows" · "Microfone: definido no config.json" | O segundo quando `microphoneDeviceId` não é `null` (`src/main/tray.ts:29`) |
| — | separador | — |
| Abrir pasta | "Abrir pasta de configuração" | Abre `%APPDATA%\Touch Speaker` (`shell.openPath`, `src/main/tray.ts:31`) |
| Sair | "Sair" | Cancela a sessão em andamento, encerra o hook de teclado e fecha o app (`src/main/index.ts:172-180`) |

### 6.4 Sons

Gerados em tempo real com Web Audio (sem arquivos de áudio de terceiros), volume baixo (ganho 0,08,
`src/renderer/pill.ts:40`):

| Evento | Som | Quando toca |
| --- | --- | --- |
| Início da gravação | Senoide 880 Hz, 60 ms, fade-out | Ao receber `recorder:start` (`src/renderer/pill.ts:128`) |
| Fim da gravação | Senoide 660 Hz, 60 ms, fade-out | Na passagem de `listening` para `transcribing` (`src/renderer/pill.ts:222`) |
| Erro | Duas notas 440→330 Hz, 80 ms cada | Ao entrar em `error` (`src/renderer/pill.ts:223`) |

- Cancelar (`Esc` ou atalho) e o aviso `notice` não tocam som.
- Desligáveis com `"sounds": false` no `config.json`.

## 7. Estados de tela

### 7.1 Hoje: Fase 1

Uma janela só, a pílula, **nunca focável**, mais o ícone e o menu da bandeja. Não há tela de configurações,
histórico, onboarding nem janela principal: a configuração é o `config.json`, aberto pelo menu
"Abrir pasta de configuração". Quem decide o estado é o `SessionController` (`src/main/session.ts`); a
pílula só mostra o que recebe por `pill:state` ([`API.md`](API.md#pillstate)).

### 7.2 Estados das telas

| Estado | Visual | Texto | Saída |
| --- | --- | --- | --- |
| `listening` (segurando) | Ponto `--ts-listening` + barras do microfone + cronômetro | "Ouvindo…" | Ao soltar → `transcribing` |
| `listening` (mãos livres) | Igual + linha muted | "Ouvindo…" / "toque de novo para terminar" | No próximo toque → `transcribing` |
| `listening` (últimos 30 s) | Cronômetro em `--ts-notice` | "Ouvindo…" / "Termina em 0:30" (texto fixo, sem contagem regressiva) | Aos 5:00 (ou no `maxRecordingMs` do `config.json`) → `transcribing` |
| `transcribing` | 3 pontos `--ts-working` | "Transcrevendo…" | Texto inserido → `hidden`; sem fala → `hidden`; falha → `error`; texto só copiado (app elevado ou colagem recusada) → `notice` |
| `notice` | Glifo de clipboard em `--ts-notice` | "Texto copiado — cole com Ctrl+V" | Some após 4 s |
| `error` | Glifo de alerta e texto em `--ts-error` | Mensagem de [`API.md`](API.md#códigos-de-erro) (tabela abaixo) | Some após 4 s |
| `hidden` | — | — | — |

Fontes: `src/main/session.ts:245-269` (texto e dica de cada estado), `:46` e `:254-261` (4 s), `:47` e
`:107-117` (aviso de 30 s e limite); `src/renderer/pill.ts:214-226` (aplicação na tela).

Mensagens de erro e aviso na pílula (`src/main/strings.ts:18-31`):

| Código | Texto |
| --- | --- |
| `no_api_key` | "Falta a chave da Groq — veja o README" |
| `invalid_api_key` | "Chave da Groq inválida" |
| `rate_limited` | "Limite gratuito da Groq atingido — tente em instantes" |
| `network_error` | "Sem conexão — tente de novo" |
| `provider_error` | "A Groq falhou — tente de novo" |
| `audio_too_large` | "Gravação longa demais" |
| `mic_denied` | "Sem permissão para usar o microfone" |
| `mic_unavailable` | "Microfone indisponível ou em uso" |
| `recorder_failed` | "Falha ao gravar" |
| `paste_blocked` | "Texto copiado — cole com Ctrl+V" (estado `notice`, não erro) |
| `no_speech`, `session_timeout` | Sem texto: silêncio é descartado sem aviso; o limite de tempo encerra e transcreve normalmente |

Cancelar com `Esc` ou com um atalho (Ctrl direito + C) leva direto a `hidden`, sem som e sem mensagem.

## 8. Layout e responsividade

A pílula só cresce na horizontal, entre 120 e 360 px, dentro de uma janela fixa de 420 × 72 px
(`pill.css:34-35`, `src/main/pill-window.ts:7-8`). Funciona com escala de tela de 100% a 200% (o Electron
entrega pixels lógicos); textos longos de erro quebram com reticências em 360 px (`pill.css:59-62`). Com duas
telas, aparece na tela onde está o mouse (§6.1). Não há breakpoints: não existe outra largura a atender.

## 9. Navegação e rotas

Não se aplica: não há navegação nem rotas. A pílula não recebe clique nem teclado; a única interação do
usuário com a interface é o menu da bandeja.

### Por papel

Não se aplica: há um único usuário, sem papéis, até a Fase 4 (contas — FR-ACC-01, PLANEJADO).

### Menus

Um só, o menu da bandeja (§6.3): estado, microfone, separador, "Abrir pasta de configuração", "Sair".

## 10. Idioma, número e data

- O texto da interface é **pt-BR**, centralizado em `src/main/strings.ts`; a pílula declara
  `<html lang="pt-BR">` (`src/renderer/pill.html:2`). Não há camada de tradução; `strings.ts` está pronto
  para recebê-la.
- Cronômetro em `m:ss`, a partir de `0:00`, atualizado a cada 250 ms, com `tabular-nums`
  (`src/renderer/pill.ts:193-210`, `pill.css:77`).
- Aviso de fim: "Termina em 0:30" (`src/main/strings.ts:7`).
- Nenhuma data e nenhum outro número aparecem na interface.

### Escrita (voz da interface)

- pt-BR, curto, verbo no gerúndio para estados ("Ouvindo…", "Transcrevendo…").
- Erro diz o que aconteceu e, quando houver, o que fazer ("Sem conexão — tente de novo").
- Nunca culpar a pessoa; nunca mostrar código técnico na interface.

## 11. Ícones

| Fonte | Como carrega | Onde aparece |
| --- | --- | --- |
| SVG inline próprio | Dois glifos de 16 px escritos em `src/renderer/pill.html:21-22` (triângulo de alerta; prancheta) | Pílula, estados `error` e `notice` |
| Desenho em código | Glifo de microfone calculado pixel a pixel (`src/main/icon.ts`) | Ícone da bandeja |

Nenhuma biblioteca de ícones, nenhuma fonte de ícones, nenhum arquivo de imagem além do logo (§14), nenhum
emoji na interface. Ícone novo é desenhado do zero (§18).

## 12. Tema

Tema escuro único na Fase 1: a pílula flutua sobre qualquer fundo, e escuro com borda clara contrasta em
fundos claros e escuros. Não há tema claro nem troca de tema; `prefers-color-scheme` não é usado.

## 13. Acessibilidade

Meta: contraste mínimo 4,5:1 e cor nunca como único sinal. Estado conferido no código em 17/out/2026:

| Tema | Estado | Evidência |
| --- | --- | --- |
| Cor não é o único sinal | Todo estado tem ícone + texto | `src/renderer/pill.html:15-26` |
| Contraste | Mínimo 4,5:1 para o texto sobre `--ts-surface` | §3.1 |
| Confirmação não visual | Sons de início, fim e erro (desligáveis) | §6.4 |
| Movimento | `prefers-reduced-motion` respeitado: sem escala nem pulso | `pill.css:187-198` |
| Anúncio | A pílula é `role="status"` com `aria-live="polite"`; ícones com `aria-hidden="true"`. O anúncio por leitor de tela numa janela que nunca recebe foco não foi verificado | `src/renderer/pill.html:14-15` |
| Idioma | `lang="pt-BR"` | `src/renderer/pill.html:2` |
| Foco e teclado | A pílula nunca recebe foco nem clique, por princípio (C2); o comando é a tecla de ditado, e o menu da bandeja é o menu nativo do Windows | `src/main/pill-window.ts:35`, `:50` |
| Escala de tela | 100% a 200% | §8 |

## 14. Marca e assets

| Arquivo | O que é | Usado em |
| --- | --- | --- |
| `docs/assets/logo.svg` (720 × 200) | Quadrado arredondado `#13A89E` com microfone branco e duas barras; "Touch" em `#13A89E` e "Speaker" em `#8B8B95`; slogan "fale · solte · está escrito" | Topo do `README.md` |

- Cor da marca: `#13A89E` — a mesma do token `--ts-listening` e do glifo da bandeja.
- Nome: "Touch Speaker" — nome do app (`app.setName`, `src/main/index.ts:27`), `productName` do
  `package.json`, `<title>` da pílula (`src/renderer/pill.html:9`) e pasta de dados `%APPDATA%\Touch Speaker`
  (`src/main/index.ts:28`).
- Não há arquivo de ícone do app (`.ico`): a pílula não aparece na barra de tarefas e o ícone da bandeja é
  desenhado em código (§6.2). Ícone de instalador é da distribuição (Fase 4, PLANEJADO).

## 16. Herança: código órfão e morto

Nenhum registrado em 17/out/2026.

## 17. Tela nova sem quebrar

Checklist para um estado novo da pílula. Não há teste automatizado de interface: a conferência é manual
(roteiro V da spec, app aberto por `npm run dev`). Tela nova de verdade (configurações, histórico) é da
Fase 2 e começa por spec ([`docs/templates/README.md`](templates/README.md)).

1. **Estado novo** em `PillStateName` em `src/shared/ipc.ts` **e** em `src/renderer/global.d.ts` (o
   renderer é script clássico e não importa o arquivo compartilhado).
2. **Texto** em `src/main/strings.ts`; o renderer recebe `message` e `hint` prontos e nunca tem string
   própria.
3. **Estilo** em `pill.css`, por `.pill[data-state='…']`, só com os tokens do §3; versão sem movimento em
   `prefers-reduced-motion`.
4. **Quem dispara** é o `SessionController`, pelo canal `pill:state` já existente; nenhum canal IPC novo para
   isso.
5. **Nunca focável:** nada de `focus()`, `show()` ou clique; a janela continua `focusable: false` e
   `showInactive()`.
6. **Atualize** a tabela do §7.2 e o contrato de `pill:state` em [`API.md`](API.md#pillstate) no mesmo PR.

## 18. Nunca faça

- Dar foco à pílula ou abrir janela durante o ditado.
- Usar ícone, cor, som ou texto copiado de outro produto.
- Mostrar o texto transcrito na pílula na Fase 1 (o texto aparece no app de destino; mostrar em dois
  lugares confunde).
- Animação que atrase a inserção do texto.

## 19. Divergências conhecidas

Corrigidas nesta revisão: textos do menu da bandeja (o item de microfone não mostra o nome do dispositivo —
§6.3); cor do ponto de gravação do ícone da bandeja (vermelho `#F87171`, não `--ts-listening` — §6.2); tamanhos
do ícone da bandeja (16/24/32 px, não 16/20/24/32 — §6.2). Nenhuma aberta.
