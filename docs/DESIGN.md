# DESIGN.md — Touch Speaker

Guia de interface para quem escreve tela (gente e agente de IA). Diz **o que existe**, **o que não fazer** e
**o que ainda não está decidido**. A interface segue o design system **Sálvia** (spec
[`design-system`](spec/features/design-system.md), 18/out/2026): uma paleta de seis cores de baixa saturação,
tokens semânticos em CSS com tema claro e escuro — o do sistema por padrão, ou o escolhido no botão da janela
principal (D4 revista em 18/out/2026, §12) —, a fonte Inter embutida e uma
regra de contraste travada por teste. Não há biblioteca de componentes: hoje a interface tem duas janelas — a
**pílula** flutuante (`pill.html`, `tokens.css`, `pill.css` e `pill.ts`, sem framework) e a **janela
principal** (`main-window/index.html`, `main-window.css` e `main-window.ts`, sobre o mesmo `tokens.css`) — e o
**ícone da bandeja** com o seu menu, desenhados e montados em código. Este arquivo descreve o que esse
conjunto faz, extraído do código.

> Última atualização: 18/out/2026 · Mantenedor: Victor Alves
> Ordem de precedência: [`DECISIONS.md`](DECISIONS.md) → [SDD](spec/spec-driven-development.md) →
> [`CLAUDE.md`](../CLAUDE.md) → este arquivo. Em qualquer divergência com o código, **o código é a fonte de
> fato** sobre o que existe (`frontend/src/renderer/`, `frontend/src/main/`). O
> [estudo de referência](referencia/estudo-typeless.md) não é normativo e é fonte proibida de cor, ícone, som
> e texto ([ADR-07](DECISIONS.md#adr-07--sala-limpa-em-relação-ao-typeless)).

**Estado atual — a interface é a pílula, a janela principal e o ícone da bandeja, sobre a Sálvia.** As âncoras
foram conferidas em 18/out/2026 sobre o código das specs `design-system` e
[`janela-principal`](spec/features/janela-principal.md), ainda não commitado (base `0c0aa5b`), com a Fase 1
implementada (T1–T8) e funcionando de ponta a ponta no PC do Victor (V2). O roteiro manual que confere a
pílula, a bandeja e a janela (V7, V12 e os demais da Fase 1 — PEND-001 —, o V-DS-1…6 da spec `design-system` —
PEND-006 — e o VJ1–VJ24 da spec `janela-principal` — PEND-007) está pendente. O histórico (spec
[`historico`](spec/features/historico.md)) entrou no código em 18/out/2026, ainda não commitado: a seção
Histórico tem o conteúdo real, Configurações tem "Guardar histórico" e o Início tem os cards do histórico
(roteiro VH1–VH13 pendente — PEND-009). No mesmo dia entraram, a pedido do Victor, o botão de tema claro/escuro
com revelação circular e as listas suspensas, caixas de seleção e campos numéricos no estilo da janela (roteiro
VJ25–VJ27 pendente — PEND-010).

**Âncoras.** Todo caminho é relativo a `frontend/`. A pílula mora em `src/renderer/` (`pill.html`,
`tokens.css`, `pill.css`, `pill.ts`, `global.d.ts`, `fonts/`) e a janela dela em `src/main/pill-window.ts`; a
janela principal, em `src/renderer/main-window/` (`index.html`, `main-window.css`, `main-window.ts`,
`global.d.ts`) e `src/main/main-window.ts`; o ícone e o menu da bandeja, em `src/main/icon-bitmap.ts`,
`src/main/icon.ts` e `src/main/tray.ts`; as cores que o main precisa, em `src/shared/palette.ts`; todos os
textos, em `src/main/strings.ts`; os estados, em `src/shared/ipc.ts`. Não há §15: a seção de painel
administrativo do modelo destes guias não se aplica a um app de bandeja.

---

## 1. Princípios

1. **Invisível até ser útil.** Nada na tela enquanto a pessoa não está ditando, a não ser a janela principal
   quando ela a abre — e, sozinha, uma única vez: na primeira execução sem chave salva.
2. **Nunca roubar o foco.** O texto vai para o app em que a pessoa está; a pílula e tudo o que aparece
   durante o ditado não recebem foco, clique nem teclado. A janela principal é uma janela comum, que recebe
   foco só porque a pessoa a pediu; nenhum erro, aviso ou sessão de ditado a abre (FR-UI-06).
3. **Estado sempre legível de relance.** Ouvindo, transcrevendo, erro: cor + forma + 1–4 palavras.
4. **Feedback imediato.** A pílula aparece em ≤ 150 ms depois da tecla; o som confirma sem precisar olhar.
5. **Identidade própria.** Inspiração de comportamento em produtos do mercado, mas cores, ícones,
   sons e textos são do Touch Speaker ([ADR-07](DECISIONS.md#adr-07--sala-limpa-em-relação-ao-typeless)).

## 2. Fontes da verdade

| O quê | Onde |
| --- | --- |
| Tokens (cor, fonte, tamanho, peso, espaço, raio, sombra, duração, foco) | `src/renderer/tokens.css` — primitivos da paleta, base não-cor e tokens semânticos do tema claro (`:root`) e do escuro (`@media (prefers-color-scheme: dark)`) |
| Cores que o processo main desenha (ícone da bandeja e fundo da janela principal antes de a página pintar) | `src/shared/palette.ts` — repete os hex de `tokens.css`; o `tokens.test.ts` falha se os dois divergirem |
| Regra de contraste | `src/shared/contrast.ts` (razão do WCAG 2.x) e os pares de `src/test/tokens.test.ts` (§13) |
| Fonte | `src/renderer/fonts/InterVariable.woff2`, com `OFL.txt` ao lado ([ADR-12](DECISIONS.md#adr-12--fonte-inter-embutida-no-app)) |
| Textos da interface | `src/main/strings.ts` — um lugar só, pronto para i18n; nenhum renderer tem strings próprias. Os da janela principal saem de `mainWindowStrings()` (`strings.ts:57-123`) e chegam por `app:get-strings` |
| Estados da pílula | `src/shared/ipc.ts` (`PillStateName`, `PillState`), espelhados em `src/renderer/global.d.ts` |
| Estados da janela principal | `src/shared/ipc.ts` (`AppStatus`, `SettingsView` e os resultados de salvar), espelhados em `src/renderer/main-window/global.d.ts` |
| Marcação e comportamento da pílula | `src/renderer/pill.html`, `src/renderer/pill.ts` |
| Marcação, estilo e comportamento da janela principal | `src/renderer/main-window/index.html`, `main-window.css`, `main-window.ts` |
| Janela da pílula (tamanho, posição, foco) | `src/main/pill-window.ts` |
| Janela principal (tamanho, posição, fundo, ícone, quando abre) | `src/main/main-window.ts`; abertura em `src/main/index.ts` e `src/main/tray.ts` |
| Ícone e menu da bandeja | `src/main/icon-bitmap.ts` (glifo desenhado em código), `src/main/icon.ts`, `src/main/tray.ts` |
| Sons | `src/renderer/pill.ts` (gerados com Web Audio) |
| Quando cada estado aparece | `src/main/session.ts` (`SessionController`, dono único do estado do ditado); o estado do Início é montado no main (`AppStatus`, `src/main/index.ts:207-220`) |
| Preferências que mudam a interface | `config.json`: `pill.position`, `sounds` ([`DATABASE.md`](DATABASE.md#configjson)), editáveis também em Configurações. O tema **não** é configurável: vem sempre do sistema (§12) |
| Ícones da janela principal | Lucide 1.52.0, inline em `src/renderer/main-window/index.html`, com a licença ISC em `src/renderer/main-window/LICENSE-lucide.txt` (§11) |
| Marca | `docs/assets/logo.svg` (§14); na janela principal, a marca inline nas cores do README (`#13A89E` e branco), iguais nos dois temas (§6.5) |

Tocam a interface a ADR-07 (sala limpa), a ADR-12 (fonte Inter embutida) e os princípios C1 (privacidade por
padrão), C2 (nunca roubar o foco) e C3 (nunca digitar lixo) da Constituição
([SDD §1.5](spec/spec-driven-development.md#15-princípios-do-produto--constituição-c1c8)). Este documento
descreve; o código é a referência final.

## 3. Cor

Paleta **Sálvia**: seis cores de baixa saturação, neutras, de gosto pastel. Origem: post público no Instagram de
**@suraj.dsgn**, "Best Luxury Color Palettes for Premium Designs", de 22 de setembro (sem link disponível),
escolhido pelo Victor em 18/out/2026 — nada vem do estudo do Typeless. Há **dois temas**, claro e escuro, com o
mesmo conjunto de tokens semânticos; o tema do sistema escolhe (§12). Toda cor das janelas sai de
`src/renderer/tokens.css`; o CSS de cada janela só usa `var(--ts-…)` e não tem cor literal (FR-DS-01, conferido
pelo `tokens.test.ts`, para o `pill.css` e o `main-window.css`). O ícone da bandeja, desenhado pixel a pixel
pelo main, e o fundo da janela principal antes de a página pintar (`backgroundColor`) tiram as cores de
`src/shared/palette.ts`, que repete os mesmos hex.

### 3.1 Primitivos — a paleta (`tokens.css:24-31`)

| Primitivo | Token | Hex | Papel |
| --- | --- | --- | --- |
| Alabaster | `--ts-palette-alabaster` | `#F4F1EB` | texto no escuro (desde 18/out/2026, não pinta mais o tema claro) |
| Candle | `--ts-palette-candle` | `#EFE9D7` | "transcrevendo" no escuro (desde 18/out/2026, não pinta mais o tema claro) |
| Black Hole | `--ts-palette-black-hole` | `#222222` | texto no claro; fundo escuro |
| Slate Green | `--ts-palette-slate-green` | `#2D5A4A` | destaque secundário no escuro (acento do claro até 18/out/2026) |
| Moss Green | `--ts-palette-moss-green` | `#7AA05A` | aviso no escuro; destaque secundário no claro (acento do escuro até 18/out/2026) |
| Apricot | `--ts-palette-apricot` | `#D78B30` | ponto de gravação da bandeja (a pílula grava em verde-azulado desde 18/out/2026) |
| Verde-azulado da marca | `--ts-palette-teal` | `#13A89E` | **cor da marca** (o do `docs/assets/logo.svg`, Victor, 18/out/2026): acento, foco e gravação no escuro; glifo da bandeja na barra escura; no claro, escurecido para contraste |

### 3.2 Tokens semânticos por tema (`tokens.css:67-88` claro, `:91-114` escuro; `:122-166` repetem os dois para o tema escolhido na janela)

**P** = valor da paleta. **D** = derivado, aprovado pelo Victor em 18/out/2026 (spec `design-system`, D6–D8):
no escuro, mantém o matiz do primitivo de origem ou mistura Black Hole com Alabaster. **Tema claro branco
neutro** (Victor, 18/out/2026, depois de ver o tema claro creme): página e cards brancos, barra lateral cinza
neutro bem claro, cinzas neutros no texto secundário e nas bordas, sem o tom de Alabaster/Candle. **Cor da marca** (Victor, 18/out/2026, D12 da spec): o verde-azulado do logo
`#13A89E` é o acento, o foco e a gravação no escuro; no claro, o mesmo matiz escurecido — `#0D7A72` no acento, no
foco e no botão principal (texto branco), `#0F8A81` na gravação — porque `#13A89E` fica em 2,95:1 sobre branco. O
Slate Green e o Moss Green deixam de ser acento. Os fundos do escuro não mudaram.

| Token | Papel | Tema claro | Tema escuro |
| --- | --- | --- | --- |
| `--ts-bg` | fundo da janela (página); hover dos itens da barra lateral | `#FFFFFF` (D: branco) | Black Hole `#222222` (P) |
| `--ts-surface` | barra lateral, superfície da pílula ao lado | `#F7F7F8` (D: cinza neutro) | `#2D2C2C` (D) |
| `--ts-card` | card, entrada do Histórico, popup das listas (desde 18/out/2026) | `#FFFFFF` (D: branco, com borda `--ts-border`) | `= --ts-surface` `#2D2C2C` (D) |
| `--ts-hover` | hover de botão e de opção sobre card (desde 18/out/2026) | `#F4F4F5` (D: cinza neutro) | `= --ts-bg` `#222222` (P) |
| `--ts-text` | texto principal | Black Hole `#222222` (P) | Alabaster (P) |
| `--ts-text-muted` | texto secundário, dica, cronômetro | `#65656D` (D: cinza neutro) | `#ABA9A5` (D) |
| `--ts-accent` | texto, ícone e link no tom da marca | `#0D7A72` (D: verde-azulado escurecido; 5,19:1 sobre branco) | Verde-azulado `#13A89E` (P; 5,40:1 sobre Black Hole) |
| `--ts-accent-fill` | fundo da ação principal | `#0D7A72` (D; texto branco 5,19:1) | `#13A89E` (P; texto Black Hole 5,40:1) |
| `--ts-on-accent` | texto sobre `--ts-accent-fill` | `#FFFFFF` (D: branco) | Black Hole (P) |
| `--ts-secondary-fill` | fundo de destaque secundário | Moss Green (P) | Slate Green (P) |
| `--ts-on-secondary` | texto sobre `--ts-secondary-fill` | Black Hole (P) | Alabaster (P) |
| `--ts-border` | divisória e borda de card (sem limiar de contraste) | `#E4E4E7` (D: cinza neutro) | `#424140` (D) |
| `--ts-border-strong` | limite de campo e de controle | `#817F7C` (D) | `#817F7C` (D) |
| `--ts-focus` | anel de foco | `#0D7A72` (D: = acento) | `#13A89E` (P) |
| `--ts-recording` | gravando na pílula: ponto e barras | `#0F8A81` (D: verde-azulado escurecido — só gráfico, nunca texto; 3,94:1 no pior fundo) | `#13A89E` (P) |
| `--ts-working` | transcrevendo (neutro de propósito, para não competir com a gravação) | `#65656D` (D: = muted) | Candle (P) |
| `--ts-notice` | aviso e cronômetro nos últimos 30 s | `#567140` (D: Moss escurecido) | Moss Green (P) |
| `--ts-error` | erro | `#A84A3A` (D: terracota) | `#E08A7A` (D: terracota clara) |
| `--ts-pill-surface` | fundo da pílula, **opaco** | `= --ts-bg` (branco) | `= --ts-bg` (Black Hole) |
| `--ts-pill-border` | borda de 1 px da pílula | `= --ts-border` | `= --ts-border` |

Regras de uso, que evitam derivado novo: Moss Green, Apricot e o verde-azulado `#13A89E` **nunca como texto
sobre fundo claro** (ficam abaixo de 3:1); no tema claro, o verde-azulado só aparece escurecido (`#0D7A72`,
`#0F8A81`) e o Apricot só no ponto escurecido da bandeja (`#BB7624`). A exceção é o quadrado do logo na barra
lateral, decorativo (§6.5). O limite de um botão vem do texto ou de `--ts-border-strong`, nunca só do preenchimento. Cor
nova entra só como token em `tokens.css`, com o par de contraste no `tokens.test.ts` (§17).

### 3.3 Cor de estado

| Estado | Cor | Forma | Onde |
| --- | --- | --- | --- |
| Ouvindo (`listening`) | `--ts-recording` | Ponto de 8 px + 7 barras do microfone | `pill.css:90-108`, `:156-159` |
| Últimos 30 s da gravação | `--ts-notice` no cronômetro | Igual ao "ouvindo" | `pill.css:71-73` |
| Transcrevendo (`transcribing`) | `--ts-working` | 3 pontos pulsando | `pill.css:110-139`, `:161-163` |
| Erro (`error`) | `--ts-error` no glifo e no texto | Triângulo de alerta | `pill.css:146-148`, `:165-172` |
| Aviso (`notice`) | `--ts-notice` no glifo | Prancheta (clipboard) em contorno | `pill.css:150-154`, `:165-168` |
| Bandeja gravando | cor de gravação da variante do tema da barra (§6.2) | Ponto sobre o glifo de microfone | `src/main/icon-bitmap.ts:42-48`, `src/shared/palette.ts:32-36` |
| Janela principal — aviso (falta a chave, chave ilegível) | `--ts-notice` na borda do card, no glifo e no texto do estado | Triângulo de alerta, 16 px | `main-window.css:151-154`, `:176-183` |
| Janela principal — erro (tecla de ditado indisponível) | `--ts-error` na borda do card, no glifo e no texto do estado | Triângulo de alerta, 16 px | `main-window.css:156-158`, `:185-192` |

"Gravando" (verde-azulado na pílula, Apricot no ponto da bandeja) e erro (terracota) têm cores diferentes: até
17/out/2026 o ponto da bandeja usava o vermelho do erro. Cor nunca é o único sinal: todo estado tem forma e texto
próprios (§13) — para esta paleta a regra é obrigatória, porque o verde-azulado, o Moss Green do aviso, o Apricot
e a terracota podem se confundir para quem não distingue vermelho e verde.

## 4. Tipografia

- Fonte: **Inter 4.1**, arquivo variável embutido no app (`src/renderer/fonts/InterVariable.woff2`, licença SIL
  OFL 1.1 em `OFL.txt` ao lado — [ADR-12](DECISIONS.md#adr-12--fonte-inter-embutida-no-app)). `@font-face` em
  `tokens.css:13-19`, com `src` relativo e `font-display: swap`; nenhuma requisição de rede (a CSP continua
  `'self'`).
- Família: `--ts-font-sans` = `'Inter', 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif`
  (`tokens.css:33`). Se o arquivo não carregar, o texto sai na pilha de reserva, sem aviso e sem afetar o
  ditado (FR-DS-12).
- Pré-carga: a pílula pede a Inter ao abrir, ainda escondida (`document.fonts.load`, `src/renderer/pill.ts:228-230`),
  para o primeiro ditado já mostrar a fonte certa (FR-DS-13).
- Escala (`tokens.css:34-41`): `--ts-font-size-xs` 12 px · `-sm` 13 px · `-md` 15 px · `-lg` 18 px · `-xl` 24 px;
  pesos `--ts-font-weight-regular` 400 · `-medium` 500 · `-semibold` 600. A pílula usa 13 px / 500
  (`pill.css:34-35`) e, na dica e no cronômetro, 12 px / 400 (`:55-59`, `:65-69`). A janela principal usa o
  resto da escala: corpo e itens da barra lateral em 15 px / 400 (`main-window.css:33-40`), título de seção em
  24 px / 600, título de card e nome do app em 15 px / 600, rótulos e botões em 13 px / 500, dicas e campos em
  13 px, o selo "em breve" em 12 px (§6.5).
- Números (cronômetro): 12 px com `font-variant-numeric: tabular-nums` (`pill.css:65-69`).

## 5. Forma, espaço, sombra e movimento

| Elemento | Especificação | Onde |
| --- | --- | --- |
| Pílula | Altura 40 px, raio 20 px (`--ts-radius-pill`), padding 0 14 px, largura automática (mín. 120, máx. 360 px), 10 px entre os elementos | `pill.css:20-42` |
| Sombra | `--ts-shadow-float` = `0 8px 24px rgba(0,0,0,0.35)` (a janela não tem sombra própria: `hasShadow: false`) | `pill.css:32`, `tokens.css:51`, `src/main/pill-window.ts:29` |
| Entrada | Fade + escala 0,96→1 em 120 ms (`--ts-duration-enter`), `ease-out` | `pill.css:37-41` |
| Saída | Fade em 160 ms (`--ts-duration-exit`); a janela se esconde 200 ms depois | `pill.css:44-48`, `src/main/pill-window.ts:73-77` |
| Barras do microfone | 7 barras de 3 px, altura 4–20 px seguindo o nível RMS, atualização a 30 fps (a cada 33 ms) | `pill.css:97-108`, `src/renderer/pill.ts:22-23`, `:80-96` |
| Transcrevendo | 3 pontos de 6 px pulsando em sequência, ciclo de 900 ms (`--ts-duration-pulse`), atraso de 150 ms entre eles (`--ts-duration-pulse-stagger`) | `pill.css:110-139` |

A pílula mantém as suas medidas próprias (altura, padding e os espaços de 10/6/4/2 px); as escalas de
`tokens.css:32-60` são as que a janela principal usa (§6.5):

| Token | Valor |
| --- | --- |
| `--ts-space-1` … `--ts-space-6` | 4 / 8 / 12 / 16 / 24 / 32 px |
| `--ts-radius-sm` / `-md` / `-pill` | 6 / 10 / 20 px |
| `--ts-shadow-float` | `0 8px 24px rgba(0, 0, 0, 0.35)` |
| `--ts-duration-enter` / `-exit` | 120 / 160 ms |
| `--ts-focus-ring` / `--ts-focus-ring-offset` | 2 px sólido em `--ts-focus` / afastado 2 px |

**Camadas.** A pílula fica acima de tudo, no nível `screen-saver` do `alwaysOnTop`
(`src/main/pill-window.ts:50`). A janela principal é uma janela comum, no nível normal: quando as duas aparecem
juntas, a pílula fica por cima. A moldura da janela principal é a nativa do Windows.

**Movimento.** `prefers-reduced-motion`: sem escala nem pulso; troca de estado instantânea
(`pill.css:178-189`). Na janela principal, as transições são curtas (`--ts-duration-enter`): fundo e cor do
item da barra lateral, fundo e borda dos botões e borda dos campos (`main-window.css:109-128`, `:308-329`,
`:379-391`); ao ser pressionado, o botão desce 1 px (`:331-333`). Com `prefers-reduced-motion`, nenhuma
transição e nenhum deslocamento (`main-window.css:514-525`).

## 6. Componentes

Não há biblioteca de componentes: cada peça é marcação de `pill.html` ou de `main-window/index.html` com
estilo em `pill.css` ou `main-window.css` sobre os tokens de `tokens.css`, ou objeto nativo do Electron
(`Tray`, `Menu`, a moldura da `BrowserWindow`).

| Precisa de | O que existe | Onde |
| --- | --- | --- |
| Mostrar o estado do ditado | A pílula (§6.1) | `src/renderer/pill.html:15-28`, `src/main/pill-window.ts` |
| Mostrar que o app está rodando e gravando | Ícone da bandeja (§6.2) | `src/main/icon-bitmap.ts`, `src/main/icon.ts`, `src/main/tray.ts` |
| Ações do usuário na bandeja | Menu da bandeja (§6.3) | `src/main/tray.ts:58-67` |
| Confirmação não visual | Sons (§6.4) | `src/renderer/pill.ts:28-53` |
| Ver como ditar e o estado do app; configurar chave, preferências e início com o sistema | Janela principal (§6.5) | `src/renderer/main-window/`, `src/main/main-window.ts` |

### 6.1 Pílula

**Janela.**

- `BrowserWindow` de 420 × 72 px sem moldura, transparente (`backgroundColor: '#00000000'`), sem
  redimensionar nem mover, `skipTaskbar`, `focusable: false`, `alwaysOnTop` nível `screen-saver`,
  `setIgnoreMouseEvents(true)`, exibida com `showInactive()` (`src/main/pill-window.ts:8-9`, `:22-52`,
  `:79-82`). A pílula fica centralizada dentro da janela; a janela é transparente, mas a **superfície da pílula
  é opaca**, na cor `--ts-bg` do tema (Black Hole no escuro, branco no claro).
- Tema: o do sistema (no Windows, o modo de aplicativo), pela media query de `tokens.css`; a pílula troca
  sozinha se o tema muda, inclusive visível, sem reiniciar o app (§12).
- Posição: centralizada horizontalmente na tela onde está o cursor do mouse, 24 px acima da borda inferior
  da área de trabalho (respeita a barra de tarefas). Com `pill.position: "top-center"` no `config.json`, fica
  24 px abaixo da borda superior (`src/main/pill-window.ts:85-91`). A posição é calculada quando a janela
  aparece; durante a sessão ela não muda de tela.
- Criada escondida quando o app inicia, com o renderer já carregado, para aparecer rápido
  (`src/main/index.ts:136`, `:154`).
- `pill.html` carrega `tokens.css` antes de `pill.css` (`src/renderer/pill.html:10-11`).

**Anatomia** (`src/renderer/pill.html:15-28`), da esquerda para a direita:

| Parte | O que é | Quando aparece |
| --- | --- | --- |
| Ponto | Círculo de 8 px em `--ts-recording` | `listening` |
| Barras | 7 barras de 3 px em `--ts-recording`, altura pelo nível do microfone | `listening` |
| Três pontos | Círculos de 6 px em `--ts-working`, pulsando | `transcribing` |
| Glifo de erro | Triângulo de alerta preenchido, 16 px, em `--ts-error` (SVG inline) | `error` |
| Glifo de aviso | Prancheta em contorno, 16 px, traço `--ts-notice` (SVG inline) | `notice` |
| Rótulo | Texto principal (`message`), em `--ts-text` (em `--ts-error` no erro), cortado com reticências | Todo estado visível |
| Dica | Texto secundário (`hint`), em `--ts-text-muted`, some quando vazio | Mãos livres; últimos 30 s |
| Cronômetro | `m:ss`, em `--ts-text-muted` (em `--ts-notice` nos últimos 30 s) | Só em `listening` |

- O conjunto de ícones fica num `span` com `aria-hidden="true"`; a pílula tem `role="status"` e
  `aria-live="polite"` (`src/renderer/pill.html:15-16`).
- Estados e textos de cada estado: §7.2.

### 6.2 Ícone da bandeja

- Glifo próprio de microfone, desenhado pixel a pixel em código, sem arquivo de imagem
  (`src/main/icon-bitmap.ts:13-60`, módulo sem `electron`, testado em `src/test/icon.test.ts`).
- **Cor por tema da barra de tarefas** (spec `design-system`, D5): o glifo segue o **modo do Windows** — o da
  barra de tarefas e da bandeja, que o Windows deixa separado do modo de aplicativo que as janelas seguem. O
  main lê esse modo por `nativeTheme.shouldUseDarkColorsForSystemIntegratedUI` (`src/main/icon.ts:12-16`) e as
  cores vêm de `TRAY_COLORS` (`src/shared/palette.ts:32-36`):

  | Variante | Barra escura | Barra clara | Sem leitura do tema (reserva) |
  | --- | --- | --- | --- |
  | Parado | glifo verde-azulado `#13A89E` (7,12:1 contra preto) | glifo `#0D7A72` (5,19:1 contra branco) | glifo `#817F7C` (3,99:1 contra branco, 5,26:1 contra preto) |
  | Gravando | glifo + ponto Apricot `#D78B30` (7,63:1 contra preto) | glifo + ponto `#BB7624` (3,67:1 contra branco) | glifo `#817F7C` + ponto `#BB7624` |

  Contraste medido contra os extremos (preto e branco); a cor real da barra se mede no roteiro V-DS-2. Desde
  18/out/2026 (D12) o glifo é a cor da marca; o ponto de gravação **continua Apricot** de propósito: num ícone
  de 16 px, um ponto verde-azulado sobre um microfone verde-azulado não se distingue.
- Gerado em 16 px e nas escalas 1,5× e 2×, isto é, 16/24/32 px; o Windows escolhe pela escala da tela
  (`src/main/icon.ts:18-33`).
- O mesmo glifo, sem o ponto e com base de 32 px, é o ícone da janela principal na barra de título e na barra
  de tarefas (`windowIcon`, `src/main/icon.ts:35-41`; `src/main/main-window.ts:87`), até a spec
  [`distribuicao-windows-macos`](spec/features/distribuicao-windows-macos.md) trazer o `.ico` do app.
- Variante "gravando": o mesmo glifo com um ponto na cor de gravação no canto superior direito
  (`src/main/icon-bitmap.ts:42-48`). Troca enquanto a sessão grava e volta ao normal ao parar, cancelar ou
  falhar (`src/main/tray.ts:37-40`, `src/main/session.ts:106`, `:140`, `:156`, `:172`).
- Troca de tema com o app aberto: o `AppTray` escuta o evento `updated` do `nativeTheme` e redesenha os dois
  ícones na nova variante, mantendo "gravando" se a gravação está em andamento (`src/main/tray.ts:19-26`,
  `:34`, `:70-77`). Sem polling.
- A dica (tooltip) do ícone é o mesmo texto de estado da primeira linha do menu (`src/main/tray.ts:56-57`).
- **Duplo clique** no ícone abre a janela principal, como o item "Abrir Touch Speaker"; o clique simples não
  faz nada (`src/main/tray.ts:31-32`).
- macOS (quando o porte da spec [`distribuicao-windows-macos`](spec/features/distribuicao-windows-macos.md)
  existir): o ícone da barra de menus será *template image* — monocromático, pintado pelo próprio sistema —, e
  as cores desta tabela não se aplicam (decisão do Victor de 18/out/2026). O desenho é daquela spec.

### 6.3 Menu da bandeja

Menu nativo do Windows (`Menu.buildFromTemplate`), refeito a cada mudança de estado
(`src/main/tray.ts:53-68`). Menu e tooltip são nativos e não aceitam cor nem fonte do app. Textos exatos de
`src/main/strings.ts:12-19`:

| Item | Texto | Comportamento |
| --- | --- | --- |
| Estado (desabilitado) | "Touch Speaker — pronto" · "Touch Speaker — ouvindo" · "Touch Speaker — falta a chave da Groq" | Sem chave vale "falta a chave"; senão "ouvindo" enquanto grava; senão "pronto" (`src/main/tray.ts:56`). Muda na hora quando a chave é salva ou removida na janela, sem reiniciar (`setGroqKeyState`, `src/main/tray.ts:43-46`) |
| Microfone (desabilitado) | "Microfone: padrão do Windows" · "Microfone: definido no config.json" | O segundo quando `microphoneDeviceId` não é `null` (`src/main/tray.ts:61`) |
| — | separador | — |
| Abrir a janela | "Abrir Touch Speaker" | Mostra a janela principal com foco: cria se não existe, restaura se está minimizada, traz para a frente se está atrás de outras (`src/main/tray.ts:63`; `src/main/main-window.ts:59-70`) |
| Abrir pasta | "Abrir pasta de configuração" | Abre `%APPDATA%\Touch Speaker` (`shell.openPath`, `src/main/tray.ts:64`) |
| Sair | "Sair" | Cancela a sessão em andamento, encerra o hook de teclado e fecha o app, com a janela principal junto (`src/main/index.ts:273-281`) |

O status do menu não olha o hook de teclado: com o hook indisponível, a bandeja continua dizendo "pronto", e só o
Início da janela principal avisa (§19).

### 6.4 Sons

Gerados em tempo real com Web Audio (sem arquivos de áudio de terceiros), volume baixo (ganho 0,08,
`src/renderer/pill.ts:40`):

| Evento | Som | Quando toca |
| --- | --- | --- |
| Início da gravação | Senoide 880 Hz, 60 ms, fade-out | Ao receber `recorder:start` (`src/renderer/pill.ts:128`) |
| Fim da gravação | Senoide 660 Hz, 60 ms, fade-out | Na passagem de `listening` para `transcribing` (`src/renderer/pill.ts:222`) |
| Erro | Duas notas 440→330 Hz, 80 ms cada | Ao entrar em `error` (`src/renderer/pill.ts:223`) |

- Cancelar (`Esc` ou atalho) e o aviso `notice` não tocam som.
- Desligáveis com `"sounds": false` no `config.json` (ou em Configurações, valendo depois de reiniciar).
- A janela principal não toca som.

### 6.5 Janela principal

Spec [`janela-principal`](spec/features/janela-principal.md) (SCREEN-003), implementada no código em
18/out/2026; o roteiro VJ1–VJ24 que a confere na tela está pendente (PEND-007).

**Janela** (`src/main/main-window.ts`).

- Janela comum do Windows, com a **moldura nativa** (barra de título do sistema, que segue o tema em vigor — o do
  sistema ou o escolhido no botão de tema, pelo `nativeTheme.themeSource`, §12) e sem
  menu (`setMenu(null)`): 960 × 640 px lógicos ao abrir, mínimo de 760 × 520, centralizada na tela onde está o
  mouse — a mesma regra da pílula (`src/main/main-window.ts:18-21`, `:79-100`, `:139-145`). `pill.position` não
  a afeta.
- Fica escondida até `ready-to-show` e então aparece com foco (`src/main/main-window.ts:104-109`). O `backgroundColor`
  é o `--ts-bg` do tema em vigor — Black Hole no escuro, branco (`DERIVED.bgLight`) no claro, de `src/shared/palette.ts` —, para
  a janela não piscar branco; quando o tema muda, ele é trocado (`src/main/main-window.ts:86`, `:147-154`).
- Aparece na barra de tarefas enquanto aberta, com o ícone do microfone (§6.2). Minimizar vai para a barra de
  tarefas; fechar (X ou Alt+F4) **destrói** a janela, e o app, o hook e uma gravação em andamento seguem na
  bandeja. "Sair" continua só na bandeja.
- **Quando abre:** pelo menu "Abrir Touch Speaker" ou pelo duplo clique no ícone (§6.3); ao abrir o app de
  novo com ele rodando (a segunda instância sai e a primeira mostra a janela); e, sozinha, **uma única vez**: na
  primeira execução sem chave salva, já em Configurações com o foco no campo da chave (`#settings`,
  `src/main/main-window.ts:134`; `src/renderer/main-window/main-window.ts:387-390`). Se ela já existe, é
  restaurada e ganha foco, sem criar outra (`src/main/main-window.ts:59-70`). Nenhum erro, aviso ou sessão de ditado abre a janela.
- **Interação:** recebe foco, mouse e teclado quando a pessoa a abre, como qualquer janela. A pílula continua
  sem foco nem clique. Ditar com a janela em foco cola o texto no campo dela, como em qualquer app (RISK-024).
- `index.html` carrega `../tokens.css` antes de `main-window.css` (`src/renderer/main-window/index.html:10-11`)
  e não tem nenhum texto: tudo chega por `app:get-strings` e entra por `textContent`.

**Layout e estilo** (`src/renderer/main-window/main-window.css`). Desde 18/out/2026 a janela segue o estilo do
**shadcn/ui**, refeito em CSS puro sobre os tokens da Sálvia — sem React, sem biblioteca, sem dependência npm e
sem biblioteca de componentes. Foi pedido do Victor depois de ver a janela pela primeira vez: logo no topo da barra lateral,
item atual sem a barra verde, ícone em todo item e cards, botões e campos no estilo shadcn. Ficou assim: cards
planos com borda de 1 px e sem sombra, controles de 36 px e o item atual da barra lateral como um retângulo
preenchido. **Fundos** (desde 18/out/2026, com o tema claro branco neutro): a página é `--ts-bg`, a barra
lateral é `--ts-surface` e os cards, as entradas e o popup das listas são `--ts-card`. **Hover:** na barra
lateral, o item e o botão de tema enchem com `--ts-bg`; sobre card, botão de contorno, botão fantasma e opção de
lista enchem com `--ts-hover`. No claro isso dá página e cards brancos, barra lateral `#F7F7F8` e hover
`#F4F4F5`; no escuro, `--ts-card` = `--ts-surface` e `--ts-hover` = `--ts-bg`, e nada mudou na tela. Texto, texto
secundário e acento passam de 4,5:1 sobre todos esses fundos nos dois temas (pares travados no
`tokens.test.ts`).

- Duas colunas: **barra lateral de 232 px** e conteúdo flexível (`main-window.css:42-46`). Eram 216 px; os
  16 px a mais fazem caber ícone, "Dicionário" e o selo "em breve" numa linha.
- **Barra lateral** (`nav`, rotulada pelo nome do app): fundo `--ts-surface`, borda direita `--ts-border`
  (`main-window.css:49-57`).
  - **Topo — logo:** a marca do logo (§14) em 28 px ao lado de "Touch Speaker" em 15 px / 600
    (`src/renderer/main-window/index.html:18-35`, `main-window.css:92-104`). A marca é o quadrado do
    `docs/assets/logo.svg`, sem os textos, em SVG inline com `aria-hidden="true"` e **nas cores do README**
    (Victor, 18/out/2026): quadrado `#13A89E`, microfone e barras brancos (as barras a 55%), iguais nos dois
    temas. As cores ficam como atributos `fill`/`stroke` do SVG, sem mexer na CSP nem no `main-window.css`. O
    quadrado passa de 3:1 contra o fundo escuro (5,40:1 sobre `#222222`, 4,72:1 sobre `#2D2C2C`), mas não contra
    o claro (2,95:1 sobre branco, 2,75:1 sobre `#F7F7F8`), e o branco sobre o verde-azulado fica em 2,95:1 —
    abaixo dos 3:1 de gráfico. Aceito: a marca é decorativa (`aria-hidden`), o nome ao lado é o rótulo, e as cores
    são as do README por decisão do Victor. Antes (até 18/out/2026) a marca era repintada pelos tokens, em Slate
    Green/Moss Green. O nome vem de `strings.ts`, por `data-text`.
  - **Botão de tema** (18/out/2026, FR-UI-39…41): ao lado de Configurações, no rodapé da barra lateral, um botão
    quadrado de 36 px, fantasma (sem fundo nem borda; hover `--ts-bg`), com o **sol** da Lucide no tema claro e a
    **lua** no escuro, em `--ts-text-muted` (`--ts-text` no hover); o nome acessível e a dica dizem o que o clique
    faz: "Mudar para tema escuro" / "Mudar para tema claro". Foco: o anel `--ts-focus-ring`. O clique revela o
    outro tema num círculo que cresce a partir do botão (§12).
  - **Itens:** Início, Histórico e Dicionário; embaixo, depois de uma divisória, Configurações
    (`main-window.css:94-162`). Cada item tem à esquerda um **ícone Lucide** de 16 px em `currentColor` (§11),
    com o rótulo ao lado. O Dicionário leva o selo "em breve": contorno de 1 px `--ts-border`, raio
    `--ts-radius-sm`, 12 px em `--ts-text-muted`. Se não couber, o selo desce para a linha de baixo (escala de
    texto grande).
  - **Estados do item:** em repouso, texto `--ts-text-muted` sem fundo. Ao passar o mouse, fundo `--ts-bg` e
    texto `--ts-text`. O **item atual** (`aria-current="page"`) tem fundo `--ts-bg` e texto `--ts-text` em
    500, num retângulo de raio `--ts-radius-sm` com 36 px de altura mínima (`main-window.css:109-140`). A
    **barra verde de 3 px à esquerda saiu** (pedido do Victor, 18/out/2026). O fundo é sutil de propósito,
    como no shadcn: contra a barra lateral fica em 1,07:1 no claro (branco sobre `#F7F7F8`) e 1,14:1 no escuro. Por isso o item atual
    também muda a cor do texto (de secundário para principal) e o peso — cor nunca é o único sinal (§13). Foco
    pelo teclado: o anel `--ts-focus-ring`.
- **Conteúdo:** padding `--ts-space-6`, seção com até 880 px de largura e título da seção em 24 px / 600, com
  `letter-spacing: -0.01em`. As descrições (`.muted`) ficam em 13 px, em `--ts-text-muted`
  (`main-window.css:165-184`, `:259-263`).
- **Cards:** fundo `--ts-card` (branco no claro), borda de 1 px `--ts-border`, raio `--ts-radius-md` (10 px), **sem sombra**,
  padding `--ts-space-5`, título em 15 px / 600. No Início, uma grade de cards com no mínimo 240 px, e "Como
  ditar" ocupa a linha inteira (`main-window.css:186-213`). Desde 18/out/2026 (pedido do Victor), o Início tem
  nesta ordem: **"Como ditar" compacto** (padding menor; à esquerda o título, "Tecla de ditado" e a tecla num
  `<kbd>` — borda `--ts-border-strong` com a de baixo de 3 px, fundo `--ts-bg`, 15 px / 600 —; à direita as três
  linhas em 13 px `--ts-text-muted`; abaixo de 860 px, uma coluna), **"Estado"** e **"Chave da Groq"**, **"Seu
  uso"** e **"Ditados recentes"** (os dois de largura inteira, descritos no bloco "Histórico e Início" abaixo).
- **Botões:** altura mínima de 36 px (cresce com escala de texto grande), raio `--ts-radius-sm` (6 px),
  13 px / 500, padding horizontal de 16 px (`main-window.css:308-376`), em quatro variantes:

  | Variante | Em repouso | Ao passar o mouse | Onde |
  | --- | --- | --- | --- |
  | Primário (`.button-primary`) | fundo `--ts-accent-fill`, texto `--ts-on-accent` | o fundo recebe 15% de `--ts-text` (`color-mix`, só com tokens): escurece no claro, clareia no escuro. O fundo se afasta do texto, então o contraste só sobe — 6,17:1 no claro, 6,20:1 no escuro (calculado; o teste trava o par em repouso) | "Salvar chave", "Salvar preferências", "Configurar chave" |
  | Secundário / contorno (`.button-outline`) | sem fundo, borda `--ts-border-strong` (≥ 3:1) | fundo `--ts-hover` | "Reiniciar agora" |
  | Fantasma (`.button-ghost`) | sem fundo nem borda: o texto é o limite | fundo `--ts-hover` | "Cancelar" (na confirmação de remover a chave) |
  | Destrutivo (`.button-destructive`) | fundo `--ts-error`, texto `--ts-on-accent` — 5,67:1 no claro (branco), 6,13:1 no escuro, par travado no `tokens.test.ts` | 15% de `--ts-text`, como o primário (6,69:1 / 6,99:1) | "Remover chave", "Confirmar remoção" |

  Pressionado (`:active`), o botão desce 1 px. Desabilitado: opacidade 0,5, cursor `not-allowed` e sem hover
  (o WCAG isenta controle desabilitado de contraste). Foco pelo teclado: o anel `--ts-focus-ring`.
- **Campos e listas:** altura mínima de 36 px, borda de 1 px `--ts-border-strong`, raio `--ts-radius-sm`,
  fundo `--ts-bg`, 13 px. No foco, a borda passa a `--ts-focus` e o anel aparece. O placeholder fica em
  `--ts-text-muted`, mas hoje nenhum campo tem placeholder (FR-UI-10). Desabilitado: opacidade 0,5. Inválido:
  borda reforçada em `--ts-error`. Rótulos em 13 px / 500. Os controles nativos que sobram (barras de rolagem)
  seguem o tema por `color-scheme` — `light dark` sem escolha, `light` ou `dark` com `data-theme` (§12).
  No hover (fora do foco), a borda de campos e listas passa a `--ts-text-muted`. **Desde 18/out/2026 (pedido do
  Victor), nada mais tem o visual padrão do sistema:**
  - **Listas suspensas** ("Tecla de ditado", "Modelo de transcrição", "Posição da pílula") são o `select`
    **personalizável** do Chromium 152 do Electron 44.9.0 (`appearance: base-select` no `select` e no
    `::picker(select)`), que mantém o teclado (setas, Home/End, letra, Enter, Esc) e o leitor de tela nativos e
    abre o popup dentro da janela. **Gatilho:** 36 px, borda 1 px `--ts-border-strong`, raio `--ts-radius-sm`,
    fundo `--ts-bg`, o texto da opção escolhida (`<selectedcontent>`) e o `chevron-down` da Lucide em
    `--ts-text-muted`, que gira 180° com a lista aberta; aberta, a borda fica `--ts-focus`. **Popup:** fundo
    `--ts-card`, borda 1 px `--ts-border`, raio 8 px (`--ts-radius-sm` + 2), a sombra `--ts-shadow-float`,
    padding 4 px, no mínimo a largura do gatilho e no máximo 280 px de altura, com rolagem. **Opções:** linhas de
    32 px, raio `--ts-radius-sm`, 13 px; sob o mouse ou o teclado, fundo `--ts-hover`; a escolhida em 500, com o
    `check` da Lucide em `--ts-accent` (as outras guardam o espaço dele). A seta e o visto padrão do sistema ficam
    escondidos.
  - **Caixa de seleção** ("Sons"): 18 px, borda `--ts-border-strong`, raio 4 px, fundo `--ts-bg`; marcada, fundo e
    borda `--ts-accent-fill` com o visto desenhado em `--ts-on-accent` (≥ 4,5:1, par travado).
  - **Interruptor** ("Iniciar com o Windows", `role="switch"`): trilho de 36 × 20 px, raio `--ts-radius-pill`,
    bolinha de 16 px em `--ts-border-strong`; ligado, trilho `--ts-accent-fill` e bolinha `--ts-on-accent`, que
    desliza para a direita.
  - **Opções de rádio** ("Guardar histórico"): círculo de 18 px com a mesma borda; marcada, borda e ponto de 8 px
    em `--ts-accent-fill`.
  - **Campos numéricos** sem as setinhas nativas (as setas do teclado continuam somando e subtraindo).
  - Tudo com transição `--ts-duration-enter` e sem animação com "reduzir movimento".
- **Campos de Configurações** em duas colunas, rótulo (160 a 260 px) e controle; com a janela abaixo de
  860 px de largura — janela estreita ou escala de texto grande —, o rótulo vai para cima do campo, sem rolagem
  horizontal (`main-window.css:434-458`, `:491-512`).
- **Faixa de reinício:** borda `--ts-notice`, raio `--ts-radius-md`, o texto e o botão "Reiniciar agora"
  (`main-window.css:460-473`).
- **Destaque nunca só por cor:** card em aviso ou em erro ganha a **borda**, o **glifo** — o triângulo de
  alerta, a mesma forma do erro da pílula, em SVG inline (`src/renderer/main-window/index.html:84`, `:92`) — e
  o **texto** do estado na cor do destaque: `--ts-notice` no aviso, `--ts-error` no erro
  (`main-window.css:216-256`).

**Histórico e Início** (spec [`historico`](spec/features/historico.md) §7, FR-HIST-22…26; 18/out/2026). O texto
ditado entra sempre por `textContent`, nunca `innerHTML` (ele pode conter qualquer coisa).

- **Entrada** (`.entry`): bloco de fundo `--ts-card` (no Início, `--ts-bg`, dentro do card), borda 1 px
  `--ts-border`, raio `--ts-radius-md`. Em cima, a linha de metadados em 13 px `--ts-text-muted` com algarismos
  tabulares — no Histórico, hora e duração ("14:32", "0:12"); no Início, dia e hora ("Hoje", "14:32") — e, quando
  a colagem não aconteceu, o aviso com o triângulo de alerta e o texto: "Não colado — o texto ficou no clipboard"
  em `--ts-notice` ou "A colagem falhou" em `--ts-error` (forma + texto, nunca só cor). À direita, botões
  fantasma pequenos (32 px) com ícone Lucide e rótulo: **"Copiar"** (`copy`) e, no Histórico, **"Apagar"**
  (`trash`); o nome acessível inclui o dia e a hora ("Copiar ditado — Hoje, 14:32"). Embaixo, o texto inteiro
  (Histórico) ou as duas primeiras linhas (Início), quebrando palavras longas.
- **"Copiado":** o botão troca por alguns segundos para o `check` e "Copiado", em `--ts-accent`, e a região
  `aria-live` da janela anuncia "Copiado". "Apagar" de uma entrada não pede confirmação (D6); anuncia "Ditado
  apagado".
- **Tela Histórico:** faixa de aviso no topo (borda e texto `--ts-notice`, triângulo) quando houve gravação que
  falhou desde que o app abriu ("1 ditado não foi guardado no histórico desde que o app abriu"); barra com a
  **busca** (campo com a lupa da Lucide dentro, à esquerda; rótulo e dica "Buscar no histórico") e **"Apagar
  tudo"** (contorno, com `trash`); os grupos por dia, com o rótulo ("Hoje", "Ontem", "1 de outubro", "30 de
  dezembro de 2025") em 13 px / 600 `--ts-text-muted`; "Carregar mais" (contorno, centralizado) quando há próxima
  página; no rodapé, a retenção ("Guardando os ditados dos últimos 30 dias"). **"Apagar tudo"** pede confirmação
  na própria tela, em dois passos como "Remover chave": aparece a faixa de borda `--ts-error` com "Apagar todo o
  histórico? Isso não pode ser desfeito.", "Cancelar" (fantasma, com o foco) e "Apagar tudo" (destrutivo); `Esc`
  desfaz.
- **Estados sem lista** (frase em `--ts-text-muted`, centralizada, num quadro de borda tracejada
  `--ts-border-strong`): "Nenhum ditado guardado ainda" (sem busca nem "Apagar tudo"), "Nenhum ditado com esse
  termo" (a busca continua), "O histórico está desligado — nada é guardado. Ligue em Configurações" (com o botão
  "Abrir Configurações") e "Histórico indisponível — o ditado continua funcionando".
- **Início · "Seu uso":** quatro blocos (`.stat`, fundo `--ts-bg`, borda `--ts-border`, raio `--ts-radius-md`,
  no mínimo 150 px cada): **Palavras** (`whole-word`), **Ditados** (`mic`), **Tempo falando** (`clock`) — cada um
  com o valor de **Hoje**, em `--ts-accent`, e o de **Todo o histórico**, em `--ts-text`, 18 px / 600 tabulares,
  com o rótulo em 12 px embaixo — e **Média de palavras por minuto** (`gauge`), um valor só, em `--ts-accent`
  ("—" sem dado). Embaixo, a retenção em uso. Só números: nenhum texto ditado.
- **Início · "Ditados recentes":** título e, à direita, "Ver todos" (fantasma, com `arrow-right`), que abre o
  Histórico; os 3 ditados mais recentes como entradas compactas, só com "Copiar". É o **único lugar fora do
  Histórico que mostra texto ditado** — pedido do Victor de 18/out/2026 (§18).
- **Desligado ou indisponível no Início:** "Seu uso" mostra "O histórico está desligado — os ditados recentes e os
  números aparecem quando ele estiver ligado em Configurações" (ou "Histórico indisponível — o ditado continua
  funcionando") no lugar dos blocos, e "Ditados recentes" mostra o aviso da tela Histórico com "Abrir
  Configurações". Com a janela aberta, os dois cards se atualizam a cada ditado (`history:changed`).
- **Configurações · "Histórico":** "Guardar histórico" com três opções de rádio — "Nunca guardar", "Por [N] dias"
  (campo de 96 px, "1 a 3650 dias" ao lado; digitar no campo marca a opção) e "Para sempre" —, a frase "Vale na
  hora, sem reiniciar. Os ditados ficam só neste computador, sem o áudio." e o botão próprio **"Salvar"**
  (primário), fora de "Salvar preferências" e sem a faixa de reinício. Respostas: "Salvo", "Salvo · 12 ditados mais
  antigos foram apagados" ou "Não foi possível salvar — o config.json não pôde ser lido ou gravado"; número fora
  da faixa → "Escolha de 1 a 3650 dias" embaixo, sem enviar.
- **Configurações · "Aparência"** (FR-UI-42): "Tema: Seguindo o sistema / Claro / Escuro" e o botão "Seguir o
  sistema" (contorno; desabilitado quando já segue); falha ao gravar → "Não foi possível salvar o tema".

**Seções e estados** (como implementados em 18/out/2026; textos de `mainWindowStrings()`,
`src/main/strings.ts:57-123`, e de `strings.homeHold`/`homeTap`/`homeEsc`, `:20-23`):

| Seção | Estado | O que aparece |
| --- | --- | --- |
| Início | pronto | Card **"Como ditar"**: "Tecla de ditado" com o nome em pt-BR da tecla em uso (ex.: "Ctrl direito") e três linhas — "Segure {tecla} por {ms} ms ou mais, fale e solte: o texto aparece no cursor.", "Toque rápido em {tecla}: grava com as mãos livres até o próximo toque." e "Esc cancela a gravação." Card **"Estado"**: "Pronto" e a linha do microfone ("Microfone: padrão do Windows" ou "Microfone: definido no config.json"). Card **"Chave da Groq"**: "Salva no app" ou "Vinda do .env de desenvolvimento" |
| Início | ouvindo | O card "Estado" passa a "Ouvindo…" enquanto a sessão grava e volta sozinho, sem reabrir a janela |
| Início | sem chave | Card "Estado" em aviso: "Falta a chave da Groq". Card "Chave da Groq" em aviso: "Falta a chave da Groq" e o botão **"Configurar chave"**, que abre Configurações com o foco no campo da chave |
| Início | chave ilegível | Como "sem chave", com "A chave salva não pôde ser lida — salve de novo" no card da chave |
| Início | tecla indisponível | Card "Estado" em erro: "A tecla de ditado não está funcionando — reinicie o app". O card "Estado" segue a precedência tecla indisponível → ouvindo → falta a chave → pronto (`src/renderer/main-window/main-window.ts:142-156`) |
| Início | com histórico | Cards **"Seu uso"** (palavras, ditados e tempo falando de hoje e de todo o histórico; média de palavras por minuto) e **"Ditados recentes"** (3 mais recentes com "Copiar" e "Ver todos") — FR-UI-15, FR-HIST-22…26 |
| Início | sem ditados guardados | "Seu uso" com zeros e "—" na média; "Ditados recentes": "Nenhum ditado guardado ainda", sem "Ver todos" |
| Início | histórico desligado · indisponível | Os dois cards com o aviso no lugar dos números e da lista; "Abrir Configurações" no de recentes quando desligado |
| Histórico | lista | Busca, "Apagar tudo", grupos por dia, "Copiar"/"Apagar" por entrada, "Carregar mais", retenção no rodapé |
| Histórico | vazio · sem resultado · desligado · indisponível | As frases do bloco acima, nunca uma lista vazia sem explicação (FR-HIST-11) |
| Histórico | confirmar "Apagar tudo" · falhas de gravação | Faixa de confirmação em dois passos; faixa de aviso com o número de ditados não guardados |
| Dicionário | em breve | Item com a marca "em breve"; seção com o título e "O dicionário pessoal chega numa próxima versão.", sem ação (FR-UI-17) |
| Configurações · chave | `stored` · `env` · `none` · `unreadable` | Card "Chave da Groq": "Estado: …" com o mesmo texto do Início; campo de senha "Chave da Groq", sem preenchimento automático nem corretor; "Salvar chave"; a ajuda "A chave fica cifrada neste computador e só é usada para falar com a Groq."; "Remover chave" só quando o estado é `stored` |
| Configurações · chave | salvando · salvo · erro | Campo e botão desabilitados enquanto salva; depois, "Chave salva" ou a mensagem do erro — "Chave em formato inválido — confira se colou a chave inteira", "Este computador não permite guardar a chave com segurança" ou "Não foi possível salvar a chave" —, em `role="status"`. O campo é limpo depois de toda resposta, sucesso ou erro (`src/renderer/main-window/main-window.ts:188-206`) |
| Configurações · chave | confirmar remoção | "Remover chave" vira "Confirmar remoção" + "Cancelar", na própria tela, sem diálogo nativo; o foco vai para "Cancelar"; `Esc` desfaz a confirmação; depois, "Chave removida" (`src/renderer/main-window/main-window.ts:208-251`) |
| Configurações · preferências | sem mudanças | Card "Preferências" com os sete campos e os valores do disco: "Tecla de ditado" (lista das 16 teclas pelo nome), "Tempo para segurar (ms)" (dica "200 a 1500"), "Duração máxima da gravação (s)" (dica "10 a 300"), "Idioma (código de duas letras)", "Modelo de transcrição", "Posição da pílula" ("Embaixo, no centro" · "Em cima, no centro") e "Sons"; o microfone em uso só para leitura, com o texto da bandeja; "Salvar preferências" |
| Configurações · preferências | campo inválido | O campo apontado pelo main fica marcado (`aria-invalid`), com "Valor fora do permitido" embaixo e o foco nele; nada gravado |
| Configurações · preferências | salvo · reinício pendente | "Preferências salvas"; enquanto o disco difere do que o app usa, a faixa "As mudanças valem depois de reiniciar o app" com "Reiniciar agora" |
| Configurações · preferências | falha ao gravar | "Não foi possível salvar as configurações"; o arquivo anterior fica intacto |
| Configurações · início com o sistema | ligado · desligado · falha | Card "Início com o sistema" com o interruptor "Iniciar com o Windows" no estado real do sistema; vale na hora, sem a faixa de reinício; falha → "Não foi possível mudar o início automático" e o interruptor volta ao estado real |
| Configurações · início com o sistema | em desenvolvimento | Interruptor desabilitado, com "Disponível no app instalado" |
| Configurações · histórico | salvo · salvando · falha · inválido | Card "Histórico" com "Guardar histórico" (FR-UI-38): as três opções, "Salvar" próprio, vale na hora |
| Configurações · aparência | seguindo o sistema · claro · escuro · falha | Card "Aparência" com o tema em uso e "Seguir o sistema" (FR-UI-42) |
| qualquer | tema claro ou escuro | O do sistema por padrão, trocando sozinho com a janela aberta; ou o escolhido no botão de tema, que fica até "Seguir o sistema" (§12) |

As mensagens de salvar ficam em regiões `role="status"` com `aria-live="polite"`
(`src/renderer/main-window/index.html:143`, `:194`, `:207`), uma por card; em erro, o texto sai em
`--ts-error` (`main-window.css:480-488`).

## 7. Estados de tela

### 7.1 Hoje: Fase 1 e o que a M2 já trouxe

Duas janelas — a pílula, **nunca focável**, e a **janela principal**, aberta pela bandeja (§6.5) — mais o ícone
e o menu da bandeja. Não há onboarding: na primeira execução sem chave salva, a janela principal abre sozinha,
uma vez, em Configurações. A configuração tem duas portas: Configurações (a chave da Groq, sete campos do
`config.json` e o início com o Windows) e o próprio `config.json`, aberto pelo menu "Abrir pasta de
configuração". Desde 18/out/2026 o Histórico tem o conteúdo real (§6.5); o Dicionário aparece como "em breve".
Quem decide o estado do ditado é o
`SessionController` (`src/main/session.ts`); a pílula só mostra o que recebe por `pill:state`
([`API.md`](API.md#pillstate)), e a janela principal só observa, pelo `app:status`
([`API.md`](API.md#contratos)).

### 7.2 Estados das telas

Os estados da pílula estão abaixo; os da janela principal, no §6.5.

| Estado | Visual | Texto | Saída |
| --- | --- | --- | --- |
| `listening` (segurando) | Ponto `--ts-recording` + barras do microfone + cronômetro | "Ouvindo…" | Ao soltar → `transcribing` |
| `listening` (mãos livres) | Igual + linha muted | "Ouvindo…" / "toque de novo para terminar" | No próximo toque → `transcribing` |
| `listening` (últimos 30 s) | Cronômetro em `--ts-notice` | "Ouvindo…" / "Termina em 0:30" (texto fixo, sem contagem regressiva) | Aos 5:00 (ou no `maxRecordingMs` do `config.json`) → `transcribing` |
| `transcribing` | 3 pontos `--ts-working` | "Transcrevendo…" | Texto inserido → `hidden`; sem fala → `hidden`; falha → `error`; texto só copiado (app elevado ou colagem recusada) → `notice` |
| `notice` | Glifo de clipboard em `--ts-notice` | "Texto copiado — cole com Ctrl+V" | Some após 4 s |
| `error` | Glifo de alerta e texto em `--ts-error` | Mensagem de [`API.md`](API.md#códigos-de-erro) (tabela abaixo) | Some após 4 s |
| `hidden` | — | — | — |

Valores de cada estado por tema:

| Estado | Tema escuro | Tema claro |
| --- | --- | --- |
| `listening` | ponto e barras no verde-azulado `#13A89E`; "Ouvindo…" em Alabaster; cronômetro e dica em `#ABA9A5`; últimos 30 s: cronômetro em Moss Green `#7AA05A` | ponto e barras em `#0F8A81`; "Ouvindo…" em Black Hole; cronômetro e dica em `#65656D`; últimos 30 s: cronômetro em `#567140` |
| `transcribing` | três pontos em Candle `#EFE9D7` | três pontos em `#65656D` |
| `notice` | glifo em Moss Green, texto em Alabaster | glifo em `#567140`, texto em Black Hole |
| `error` | glifo e texto em `#E08A7A` | glifo e texto em `#A84A3A` |

Fontes: `src/main/session.ts:274-298` (texto e dica de cada estado), `:54` e `:283-290` (4 s), `:55` e
`:115-125` (aviso de 30 s e limite); `src/renderer/pill.ts:214-226` (aplicação na tela).

Mensagens de erro e aviso na pílula (`src/main/strings.ts:125-138`):

| Código | Texto |
| --- | --- |
| `no_api_key` | "Falta a chave da Groq — abra o Touch Speaker pela bandeja" (desde 18/out/2026; antes, "… — veja o README"). A pílula continua sem clique: o texto aponta o caminho, não é um link |
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
(`pill.css:25-26`, `src/main/pill-window.ts:8-9`). Funciona com escala de tela de 100% a 200% (o Electron
entrega pixels lógicos); textos longos de erro quebram com reticências em 360 px (`pill.css:50-53`). Com duas
telas, aparece na tela onde está o mouse (§6.1). A pílula não tem breakpoint.

A janela principal abre com 960 × 640 px lógicos e não fica menor que 760 × 520 (`src/main/main-window.ts:18-21`).
A barra lateral tem largura fixa de 216 px; o conteúdo rola na vertical (`main-window.css:105-109`). Um único
breakpoint, em 860 px de largura, põe os rótulos de Configurações acima dos campos e reduz o padding
(`main-window.css:358-380`). Com duas telas, abre na tela onde está o mouse; o layout é o mesmo. Escala de 100%
a 200% no tamanho mínimo, sem rolagem horizontal nem texto cortado na barra lateral, é a meta da spec,
conferida no roteiro (VJ18).

## 9. Navegação e rotas

A navegação existe só na **janela principal**: a barra lateral com Início, Histórico, Dicionário (marcado
"em breve") e, separado embaixo, Configurações. Escolher um item, com mouse ou teclado, troca a seção **na
mesma página** — a URL não muda — e marca o item atual com `aria-current="page"`
(`src/renderer/main-window/main-window.ts:110-118`). A janela abre em Início, ou em Configurações na primeira
execução. Histórico mostra a lista da spec [`historico`](spec/features/historico.md) (desde 18/out/2026);
Dicionário mostra "O dicionário pessoal chega numa próxima versão.", sem ação. No Início, "Configurar chave" leva
a Configurações, "Ver todos" leva ao Histórico e o aviso de histórico desligado tem "Abrir Configurações"; no
Histórico, o estado desligado também. O botão de tema, ao lado de Configurações, não navega: troca o tema. Não há rotas: navegar para outro endereço e abrir janela nova
são negados em todo `webContents` (`src/main/index.ts:131-134`).

A pílula não recebe clique nem teclado; fora da janela principal, a única interação com a interface é o menu
da bandeja.

### Por papel

Não se aplica: há um único usuário, sem papéis, até a Fase 4 (contas — FR-ACC-01, PLANEJADO).

### Menus

Um só, o menu da bandeja (§6.3): estado, microfone, separador, "Abrir Touch Speaker", "Abrir pasta de
configuração", "Sair". A janela principal não tem menu (`setMenu(null)`, `src/main/main-window.ts:100`).

## 10. Idioma, número e data

- O texto da interface é **pt-BR**, centralizado em `src/main/strings.ts`; a pílula e a janela principal
  declaram `<html lang="pt-BR">` (`src/renderer/pill.html:2`, `src/renderer/main-window/index.html:2`). Não há
  camada de tradução; `strings.ts` está pronto para recebê-la.
- Cronômetro em `m:ss`, a partir de `0:00`, atualizado a cada 250 ms, com `tabular-nums`
  (`src/renderer/pill.ts:193-210`, `pill.css:68`).
- Aviso de fim: "Termina em 0:30" (`src/main/strings.ts:10`).
- Nenhuma data aparece na interface. Na janela principal, os números são o tempo de segurar em uso ("… por
  500 ms ou mais …"), as faixas dos campos ("200 a 1500", "10 a 300") e os próprios valores dos campos, sem
  separador de milhar; a duração máxima aparece em segundos, embora o `config.json` a guarde em ms.

### Escrita (voz da interface)

- pt-BR, curto, verbo no gerúndio para estados ("Ouvindo…", "Transcrevendo…").
- Erro diz o que aconteceu e, quando houver, o que fazer ("Sem conexão — tente de novo").
- Nunca culpar a pessoa; nunca mostrar código técnico na interface.

## 11. Ícones

| Fonte | Como carrega | Onde aparece |
| --- | --- | --- |
| SVG inline próprio | Dois glifos de 16 px escritos em `src/renderer/pill.html:22-23` (triângulo de alerta; prancheta) | Pílula, estados `error` e `notice` |
| SVG inline próprio | O triângulo de alerta de 16 px, escrito em `src/renderer/main-window/index.html:84` e `:92` | Janela principal, cards "Estado" e "Chave da Groq" em aviso ou erro |
| SVG inline próprio | A marca do logo (quadrado com microfone), de `docs/assets/logo.svg`, nas cores do README (`src/renderer/main-window/index.html:21-33`) | Topo da barra lateral da janela principal (§6.5, §14) |
| **Lucide 1.52.0** (licença ISC), SVG inline | Dezesseis ícones de 16 px em `src/renderer/main-window/index.html` — quatro na barra lateral e, desde 18/out/2026, os do botão de tema, do Histórico, do Início e das listas (tabela abaixo); os que o script clona ficam em `<template>` no mesmo arquivo | Barra lateral, Histórico, Início e Configurações da janela principal |
| Desenho em código | Glifo de microfone calculado pixel a pixel (`src/main/icon-bitmap.ts`) | Ícone da bandeja (16 px) e da janela principal (32 px) |

**Lucide.** É a biblioteca de ícones que o shadcn/ui usa, com licença ISC. Entrou em 18/out/2026, a pedido do
Victor, junto com o estilo shadcn da janela principal (§6.5). Os ícones estão **vendorizados**: copiados do
repositório oficial na tag [`1.52.0`](https://github.com/lucide-icons/lucide/tree/1.52.0/icons) (lançada em
04/out/2026), sem dependência npm, sem fonte de ícones e sem requisição de rede (a CSP continua `'self'`).

| Item | Ícone Lucide | Arquivo de origem na tag 1.52.0 (SHA-256) |
| --- | --- | --- |
| Início | `house` | `icons/house.svg` (`28216c479005731ef5e382e7d8627eda2b129b019eb1f3d9de9f5915576d448e`) |
| Histórico | `rotate-ccw-clock` — nessa tag, `history` é um alias obsoleto dele | `icons/rotate-ccw-clock.svg` (`a98ff758157910b9fc9d42d5d5dc80c2f4e037afa5f8ea4dee5f5649f03d438d`) |
| Dicionário | `book-open` | `icons/book-open.svg` (`9b9bed0ff057283d5c5c5a1c71f8d3e927db26a56639603a92fdf7b25961510e`) |
| Configurações | `settings` | `icons/settings.svg` (`0ae27fd0f81999229e3127ac96c5b32edfea448e291d509e76212b917551d66b`) |
| Botão de tema, claro (18/out/2026) | `sun` | `icons/sun.svg` (`a3955c8b0425fcc5c9ba12d2bdd77fe53b2cd5dd05e7742a56f342e996fb2ef8`) |
| Botão de tema, escuro | `moon` (F) | `icons/moon.svg` (`205b959e940d5841f0ce1d09c933153da9d9c94130a54d5cc0c68c2af1d403da`) |
| "Copiar" (Histórico e Início) | `copy` | `icons/copy.svg` (`ea80e566c7a12628a447cb53179b19aea4f60b9143e2becd0d0f20bf260e5718`) |
| "Apagar" e "Apagar tudo" | `trash` (F) — na 1.52.0 não existe mais `trash-2` | `icons/trash.svg` (`27299f69ad7c6272be64b1b8e2d48cbd6dcf0ef0d4f92827a1affa945c91700e`) |
| Busca do Histórico | `search` (F) | `icons/search.svg` (`283d371c2e433817bb9c0c8310caa6c77fa4177c0f4f1168d9c83b97af7389dc`) |
| "Copiado" e opção escolhida das listas | `check` (F) | `icons/check.svg` (`7f33acc9a77a61659531044525fc008edebe215bf4dcf1c789c8674ad3277db0`) |
| "Ver todos" | `arrow-right` (F) | `icons/arrow-right.svg` (`288397fdb73bb4f783cf9eabb726ff47357df1d4e3f1201dd748090579f108b9`) |
| "Seu uso": Palavras | `whole-word` | `icons/whole-word.svg` (`765a70faebbdb145e029040ec777d58e8ce7536fc2db395d91822421ce55ebe4`) |
| "Seu uso": Ditados | `mic` | `icons/mic.svg` (`9b940cd735d1ffa270ba670c4e677d9a09400f3fa81d6b3f405b12a3b67a59a8`) |
| "Seu uso": Tempo falando | `clock` (F) | `icons/clock.svg` (`e9d3e3acf4d1c280fcf8092293439dc0a4756a908ceb859de144b12451cd1cb9`) |
| "Seu uso": Média de palavras por minuto | `gauge` | `icons/gauge.svg` (`d7710543a5085c5a61d0bbac1da8b89ef28e541b38ed739357991dff33d475b5`) |
| Gatilho das listas suspensas | `chevron-down` (F) | `icons/chevron-down.svg` (`66ea878e72ed3488bb3b464c39dfdccee8d1f78e560dccea40e5e12da0e87e87`) |

(F) = na lista dos ícones derivados do Feather, cobertos pela parte MIT do mesmo `LICENSE` (abaixo).

- Os `path` e o `viewBox` 24 × 24 são os do arquivo, sem modificação, e `stroke="currentColor"`,
  `stroke-width="2"`, `fill="none"` e as pontas arredondadas também. Só mudaram `width`/`height` (16) e entraram
  `class`, `aria-hidden="true"` e `focusable="false"`. A cor é a do texto do item (§6.5).
- Licença: o `LICENSE` da mesma tag, sem modificação (SHA-256
  `b495047bd93a9b06913511076f504daba17d5bbeb3e0650f3bb53a4220329c57`), em
  `src/renderer/main-window/LICENSE-lucide.txt`. O `copy-static.mjs` leva o arquivo para `dist/` ao lado da
  página, e o `tokens.test.ts` confere que ele está lá. Os quatro ícones da barra lateral não estão na lista dos
  derivados do Feather; dos que entraram em 18/out/2026, os marcados (F) estão, e a parte MIT (aviso de copyright
  de Cole Bemis e permissão) já vem no mesmo arquivo, sem nada a acrescentar.
- Ícone novo da janela principal sai da Lucide, de uma tag fixa e sem mexer nos `path`, com a versão e a origem
  registradas nesta tabela; fora da janela principal, ícone novo continua desenhado do zero (§18). Nunca ícone do
  Typeless ([ADR-07](DECISIONS.md#adr-07--sala-limpa-em-relação-ao-typeless)).
- Arte de terceiros embutida no app, como a Inter (ADR-12): decisão em
  [ADR-13](DECISIONS.md#adr-13--ícones-lucide-embutidos) (proposta, aguardando aval do Victor).

Nenhum emoji na interface e nenhum arquivo de imagem além do logo (§14). A única fonte embutida é a Inter, de
texto (§4).

## 12. Tema

Dois temas, **claro e escuro**, com o mesmo conjunto de tokens semânticos (`tokens.css`; o `tokens.test.ts`
confere a paridade). **O tema do sistema escolhe por padrão.** A decisão D4 de 18/out/2026 ("sem escolha manual")
foi **revista pelo Victor no mesmo dia**: há um botão claro/escuro na janela principal, e a escolha fica no
`config.json` (`theme`: `"system"`, o padrão, `"light"` ou `"dark"`; spec `janela-principal` FR-UI-39…42).

- **Como a escolha vale em tudo:** o main aplica `nativeTheme.themeSource` com o valor do `config.json` ao abrir
  o app, antes de criar qualquer janela, e de novo a cada troca gravada (`src/main/theme-setting.ts`). Com isso o
  `prefers-color-scheme` de **todas** as janelas — a pílula incluída — e a moldura nativa do Windows passam a
  seguir a escolha; a janela principal abre já no tema certo, sem piscar o outro.
- **Troca pelo botão** (janela principal): o script põe `data-theme="light"` ou `"dark"` no `<html>` de forma
  síncrona — os blocos `:root[data-theme='…']` no fim do `tokens.css`, mais específicos que o `:root` e que a
  media query, repetem os valores de cada tema (o TEST-018 confere que não divergem), e o `main-window.css` fixa o
  `color-scheme` do mesmo jeito —, e só depois pede ao main, por `theme:set`, para gravar e aplicar. A revelação:
  `document.startViewTransition`, com a troca do `data-theme` **dentro** do callback, e um círculo que cresce a
  partir do centro do botão até cobrir a janela (`clip-path` no `::view-transition-new(root)`, 500 ms,
  `cubic-bezier(0.4, 0, 0.2, 1)`); a animação padrão de cruzamento fica desligada, as transições de cor dos
  controles ficam desligadas durante a troca (`data-theme-switching`), e cliques no botão são ignorados até a
  revelação acabar. Com "reduzir movimento" ou sem a API, a troca é direta. Se a gravação falhar, a janela volta
  ao tema em uso e o card "Aparência" mostra a falha.
- **"Seguir o sistema"** (Configurações · Aparência) tira o `data-theme` e grava `"system"`: a janela volta a
  acompanhar o modo do Windows sozinha, e o ícone do botão acompanha (sol no claro, lua no escuro).

- **Janelas e pílula** seguem o **modo de aplicativo** do Windows (Configurações > Personalização > Cores), que
  o Chromium expõe como `prefers-color-scheme`: tema claro no `:root` de `tokens.css`, escuro na media query.
  Quando o modo muda com o app aberto, a pílula — mesmo visível — e as janelas trocam sozinhas, sem reiniciar
  (FR-DS-03, FR-DS-04). No macOS (porte futuro), a aparência do sistema chega pela mesma media query.
- **Janela principal**, seguindo o sistema (decisão Q2 da spec
  [`janela-principal`](spec/features/janela-principal.md), revista em 18/out/2026 com a D4): o
  conteúdo troca pela media query de `tokens.css`; os controles nativos, por `color-scheme: light dark`
  (`main-window.css:12-15`); a moldura nativa do Windows troca sozinha; e o `backgroundColor` da janela é trocado
  no evento `updated` do `nativeTheme` (`src/main/main-window.ts:102`, `:151-154`), tudo sem reabrir a janela e
  sem perder o que a pessoa digitou. A conferência na tela é o VJ21.
- **Ícone da bandeja** segue o **modo do Windows** (barra de tarefas), que pode ser diferente do modo de
  aplicativo no modo "Personalizado" (§6.2) — e **não** segue a escolha do botão de tema: no Windows, o
  `shouldUseDarkColorsForSystemIntegratedUI` lê o sistema e ignora o `themeSource` (no macOS ele é igual ao
  `shouldUseDarkColors`; nota para a spec `distribuicao-windows-macos`, onde o ícone é *template image*). O ícone da janela principal (`windowIcon`) é desenhado, ao criar a
  janela, na variante desse mesmo modo (`src/main/main-window.ts:87`).
- A pílula segue o tema do sistema como as janelas (D2) e é opaca (D3). No tema claro, a pílula branca pode
  encostar em janelas claras: o contorno vem da borda `--ts-pill-border` e da sombra (RISK-novo-6 da spec; se
  não bastar no roteiro, a borda passa a `--ts-border-strong`, valor já aprovado).
- Alto contraste do Windows (`forced-colors`): o Chromium troca as cores do CSS pelas do sistema; a pílula
  segue legível porque todo estado tem glifo e texto. Fora do escopo da Sálvia; o resultado se anota no roteiro
  V-DS-6.

## 13. Acessibilidade

Meta: texto ≥ 4,5:1 (WCAG 1.4.3), gráfico e limite de componente ≥ 3:1 (WCAG 1.4.11), nos dois temas e na
pílula, e cor nunca como único sinal. Estado conferido no código em 18/out/2026:

| Tema | Estado | Evidência |
| --- | --- | --- |
| Cor não é o único sinal | Todo estado da pílula tem ícone + texto. Na janela principal, aviso e erro têm **borda + glifo + texto**, e o item atual da barra lateral tem fundo, peso 500 e o texto que passa de secundário a principal, além do `aria-current` | `src/renderer/pill.html:16-27`; `main-window.css:136-140`, `:216-256` |
| Contraste | **Medido e travado por teste**: o `npm test` falha se um par texto/fundo cair abaixo de 4,5:1 ou um par gráfico/fundo (ponto, barras, pontos, anel de foco, limite de campo) abaixo de 3:1, nos dois temas e contra a superfície da pílula. Desde 18/out/2026, também o texto do botão destrutivo da janela principal (`--ts-on-accent` sobre `--ts-error`: 5,67:1 no claro, 6,13:1 no escuro) e, também desde 18/out/2026, os pares sobre `--ts-card` e `--ts-hover`. Menores margens no claro, depois do tema branco neutro e da cor da marca: `--ts-accent` sobre `--ts-hover` (4,72:1), `--ts-recording` sobre `--ts-surface` (3,94:1) e `--ts-notice` sobre `--ts-hover` (4,99:1); no escuro, `--ts-accent` sobre `--ts-card` (4,72:1). Os blocos `:root[data-theme]` também são conferidos: o teste falha se divergirem dos dois temas | `src/test/tokens.test.ts`, `src/shared/contrast.ts`; pares na spec `design-system` §9.4 B |
| Contraste da bandeja | Glifo e ponto ≥ 3:1 contra a barra da variante (preto ou branco); a reserva neutra passa nos dois | `src/test/icon.test.ts`; §6.2 |
| Confirmação não visual | Sons de início, fim e erro (desligáveis) | §6.4 |
| Contraste da janela principal | O `main-window.css` só usa tokens (o `tokens.test.ts` falha com cor literal ou token próprio). Hover e item atual usam `--ts-bg` na barra lateral e `--ts-hover` sobre os cards, cujos pares com texto, texto secundário e acento estão travados. O hover dos botões cheios mistura 15% de `--ts-text` no fundo (`color-mix`), o que só aumenta o contraste do texto — calculado (≥ 6,17:1), não travado por teste. A medição na tela, nos dois temas, é do roteiro da spec `janela-principal` (VJ17, VJ21) | `main-window.css`; `src/test/tokens.test.ts` |
| Movimento | `prefers-reduced-motion` respeitado: sem escala nem pulso na pílula; na janela, sem transição e sem o deslocamento de 1 px do botão pressionado | `pill.css:178-189`; `main-window.css:514-525` |
| Anúncio | A pílula é `role="status"` com `aria-live="polite"`; ícones com `aria-hidden="true"`. O anúncio por leitor de tela numa janela que nunca recebe foco não foi verificado. Na janela principal, as mensagens de salvar ficam em `role="status"` com `aria-live="polite"`, a barra lateral é um `nav` rotulado pelo nome do app, cada card é rotulado pelo seu título e todo campo tem `label` associado. O glifo, a marca do logo e os ícones da barra lateral são `aria-hidden` (o rótulo do item é o texto). O Narrador na janela se confere no VJ17 | `src/renderer/pill.html:15-16`; `src/renderer/main-window/index.html:17-64`, `:73-96`, `:143`, `:194`, `:207` |
| Idioma | `lang="pt-BR"` | `src/renderer/pill.html:2`; `src/renderer/main-window/index.html:2` |
| Foco e teclado | A pílula nunca recebe foco nem clique, por princípio (C2); o comando é a tecla de ditado, e o menu da bandeja é o menu nativo do Windows. Na janela principal, tudo se opera pelo teclado (Tab, Shift+Tab, Enter, Espaço), com **foco visível** pelo `--ts-focus-ring` em `:focus-visible`; campo inválido recebe o foco; na confirmação de remover a chave, o foco vai para "Cancelar", e `Esc` desfaz a confirmação — é a única coisa que o `Esc` faz na janela, porque ele também cancela um ditado em andamento (RISK-013) | `src/main/pill-window.ts:36`, `:51`; `main-window.css:429-432`; `src/renderer/main-window/main-window.ts:215-251`, `:270` |
| Escala de tela | 100% a 200%; a janela principal no tamanho mínimo, conferida no VJ18 | §8 |

## 14. Marca e assets

| Arquivo | O que é | Usado em |
| --- | --- | --- |
| `docs/assets/logo.svg` (720 × 200) | Quadrado arredondado `#13A89E` com microfone branco e duas barras; "Touch" em `#13A89E` e "Speaker" em `#8B8B95`; slogan "fale · solte · está escrito" | Topo do `README.md`; a marca (só o quadrado) no topo da barra lateral da janela principal, inline nas mesmas cores (§6.5) |
| `frontend/src/renderer/fonts/InterVariable.woff2` + `OFL.txt` | Inter 4.1, variável, sem modificação, sob SIL OFL 1.1 | Todo texto das janelas (§4) |
| `frontend/src/renderer/main-window/LICENSE-lucide.txt` | Licença ISC da Lucide 1.52.0, sem modificação | Ícones da barra lateral da janela principal (§11) |

- **O arquivo do logo fica como está** (decisão do Victor de 18/out/2026, D10). O verde-azulado dele, `#13A89E`,
  **voltou a ser a cor do app** no mesmo dia (D12): é o primitivo `--ts-palette-teal`, o acento e a gravação no
  escuro e, escurecido (`#0D7A72`, `#0F8A81`), no claro. O `tokens.test.ts` confere que o `logo.svg` e o primitivo
  têm o mesmo valor.
- **Logo na janela principal** (pedido do Victor de 18/out/2026: logo no topo da barra lateral, certo nos dois
  temas): a marca sai de `docs/assets/logo.svg` só com a geometria do quadrado — sem os textos, que o nome do app
  já traz de `strings.ts` — **nas cores do README** (Victor, 18/out/2026): quadrado `#13A89E`, microfone e barras
  brancos, iguais nos dois temas, como atributos do SVG inline (`src/renderer/main-window/index.html:21-33`), sem
  mudar a CSP. Até essa data ela era pintada pelos tokens (Slate Green/Moss Green). Contraste em §6.5: o quadrado
  passa de 3:1 no escuro e fica em 2,95:1 sobre branco. O arquivo `docs/assets/logo.svg` não mudou.
- Nome: "Touch Speaker" — nome do app (`app.setName`, `src/main/index.ts:51`), `productName` do
  `package.json`, `<title>` da pílula (`src/renderer/pill.html:9`) e da janela principal
  (`src/renderer/main-window/index.html:9`; título da `BrowserWindow`, `src/main/main-window.ts:84`), o topo da
  barra lateral e a pasta de dados `%APPDATA%\Touch Speaker` (`src/main/index.ts:52`).
- Não há arquivo de ícone do app (`.ico`): a pílula não aparece na barra de tarefas; a janela principal
  aparece, com o glifo do microfone a 32 px desenhado em código (`windowIcon`, §6.2); o ícone da bandeja é
  desenhado em código. Ícone de instalador e `.ico` são da spec
  [`distribuicao-windows-macos`](spec/features/distribuicao-windows-macos.md).

## 16. Herança: código órfão e morto

Nenhum registrado em 18/out/2026.

## 17. Tela nova sem quebrar

Checklist para um estado novo da pílula ou da janela principal (spec
[`janela-principal`](spec/features/janela-principal.md)), ou para uma tela nova. Não há teste automatizado de
interface: a conferência visual é manual (roteiro V da spec, app aberto por `npm run dev`); cor e contraste são
conferidos pelo `npm test`. Tela nova de verdade começa por spec ([`docs/templates/README.md`](templates/README.md)).

1. **Estado novo** no tipo de `src/shared/ipc.ts` **e** no `.d.ts` do renderer — `PillStateName` e
   `src/renderer/global.d.ts` na pílula; `AppStatus`, `SettingsView` ou o resultado do canal e
   `src/renderer/main-window/global.d.ts` na janela (o renderer é script clássico e não importa o arquivo
   compartilhado).
2. **Texto** em `src/main/strings.ts`; a pílula recebe `message` e `hint` prontos, a janela recebe os textos
   por `app:get-strings` (texto com valor chega pronto, como `AppStatus.howTo`), e nenhum renderer tem string
   própria — no HTML da janela, só `data-text`/`data-label`, aplicados por `textContent`.
3. **Estilo só com tokens:** a janela carrega `tokens.css` antes do seu CSS; o CSS da janela usa só
   `var(--ts-…)` — nenhuma cor literal, nenhuma paleta própria, nenhum `:root` com token novo. Cor nova entra
   como token semântico em `tokens.css`, **nos dois temas**, com o par de contraste no `tokens.test.ts`; se o
   main precisar dela, também em `src/shared/palette.ts`. Na pílula, por `.pill[data-state='…']`; na janela,
   por `data-tone` no card (`warning`, `error`), com borda, glifo e texto; sempre com versão sem movimento em
   `prefers-reduced-motion`.
4. **Quem dispara** na pílula é o `SessionController`, pelo canal `pill:state` já existente; na janela, o
   main, pelo `app:status` ou pela resposta do canal. Nenhum canal IPC novo só para isso.
5. **Foco:** a pílula nunca é focável — nada de `focus()`, `show()` ou clique; ela continua `focusable: false`
   e `showInactive()`. A janela principal recebe foco só quando a pessoa a abre; nenhum estado novo pode
   abri-la nem trazê-la para a frente sozinho (FR-UI-06).
6. **Atualize** a tabela do §7.2 (pílula) ou do §6.5 (janela) e o contrato em [`API.md`](API.md#contratos)
   no mesmo PR.

## 18. Nunca faça

- Dar foco à pílula ou abrir janela durante o ditado.
- Abrir a janela principal por erro, aviso, permissão faltando ou sessão de ditado: ela só abre quando a
  pessoa pede, e sozinha uma única vez, na primeira execução sem chave salva.
- Usar ícone, cor, som ou texto copiado de outro produto.
- Carregar fonte, ícone ou estilo de servidor externo (a CSP é `'self'`; a fonte é arquivo local — ADR-12).
- Pôr cor literal no CSS de uma janela, ou uma cor só para um tema.
- Pôr texto no HTML da janela principal ou usar `innerHTML`.
- Mostrar a chave da Groq na tela depois de salvar — nem inteira, nem em parte —, ou deixá-la no campo.
- Fazer o `Esc` disparar ação destrutiva na janela principal.
- Mostrar o texto transcrito na pílula na Fase 1, ou em qualquer seção da janela principal fora do Histórico
  (o texto aparece no app de destino; mostrar em dois lugares confunde). **Única exceção**, pedida pelo Victor em
  18/out/2026: o card "Ditados recentes" do Início, com o começo dos 3 ditados mais recentes (§6.5; spec
  `historico` FR-HIST-25).
- Animação que atrase a inserção do texto.

## 19. Divergências conhecidas

- **Logo × paleta do app** (fechada em 18/out/2026, D12): o acento, o foco, a gravação da pílula e o glifo da
  bandeja passaram ao verde-azulado do logo. Sobra uma diferença de propósito: no tema claro o acento é o
  verde-azulado escurecido (`#0D7A72`), não o `#13A89E` do quadrado do logo, porque este fica abaixo de 4,5:1 sobre
  branco. O ponto de gravação da bandeja segue Apricot (§6.2). As capturas de tela do README foram feitas antes
  dessa troca.
- **Bandeja "pronto" com o hook indisponível** (aberta, fora do escopo da spec `janela-principal`): o Início da
  janela mostra "A tecla de ditado não está funcionando — reinicie o app", mas o status e a dica da bandeja só
  olham a chave e a gravação (`src/main/tray.ts:56`). Corrigir a bandeja é trabalho separado (spec
  `janela-principal` §1.4, §2).

Corrigidas em 17/out/2026: textos do menu da bandeja (o item de microfone não mostra o nome do dispositivo —
§6.3); cor do ponto de gravação do ícone da bandeja (na época, vermelho `#F87171`, o valor de `--ts-error`; desde
a Sálvia, a cor de gravação da variante — §6.2); tamanhos do ícone da bandeja (16/24/32 px, não 16/20/24/32 —
§6.2).
