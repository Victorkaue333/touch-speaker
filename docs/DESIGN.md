# DESIGN.md — Touch Speaker

> **Versão:** 0.1 · **Data:** 17/out/2026 · Fase 1: a interface é a **pílula** e o **ícone da bandeja**.

## 1. Princípios

1. **Invisível até ser útil.** Nada na tela enquanto a pessoa não está ditando.
2. **Nunca roubar o foco.** O texto vai para o app em que a pessoa está; a interface do Touch Speaker
   não recebe foco, clique nem teclado.
3. **Estado sempre legível de relance.** Ouvindo, transcrevendo, erro: cor + forma + 1–4 palavras.
4. **Feedback imediato.** A pílula aparece em ≤ 150 ms depois da tecla; o som confirma sem precisar olhar.
5. **Identidade própria.** Inspiração de comportamento em produtos do mercado, mas cores, ícones,
   sons e textos são do Touch Speaker ([ADR-07](ARCHITECTURE.md#adr-07--sala-limpa-em-relação-ao-typeless)).

## 2. Fontes da verdade

- Tokens em `frontend/src/renderer/pill.css` (variáveis CSS em `:root`).
- Textos da interface em `frontend/src/main/strings.ts` (um lugar só, pronto para i18n).
- Este documento descreve; o código é a referência final.

## 3. Cor

Tema escuro único na Fase 1 (a pílula flutua sobre qualquer fundo; escuro com borda clara contrasta
em fundos claros e escuros).

| Token | Valor | Uso |
| --- | --- | --- |
| `--ts-surface` | `rgba(18, 18, 22, 0.92)` | Fundo da pílula |
| `--ts-border` | `rgba(255, 255, 255, 0.14)` | Borda 1 px |
| `--ts-text` | `#F4F4F5` | Texto principal |
| `--ts-text-muted` | `#A1A1AA` | Dica secundária ("toque de novo para terminar") |
| `--ts-listening` | `#13A89E` | Cor da marca: barras do microfone, ponto de "gravando", ícone da bandeja e logo |
| `--ts-working` | `#D4D4D8` | Animação de "transcrevendo" (neutra de propósito, para não competir com a cor da marca) |
| `--ts-error` | `#F87171` | Erro |
| `--ts-notice` | `#FBBF24` | Aviso (ex.: "Texto copiado — cole com Ctrl+V") |

Contraste do texto sobre `--ts-surface` ≥ 4,5:1.

## 4. Tipografia

- Fonte: `"Segoe UI Variable", "Segoe UI", system-ui, sans-serif` (nativa do Windows 11/10).
- Pílula: 13 px, peso 500. Dica secundária: 12 px, peso 400.
- Números (cronômetro): `font-variant-numeric: tabular-nums`.

## 5. Forma, sombra e motion

| Elemento | Especificação |
| --- | --- |
| Pílula | Altura 40 px, raio 20 px, padding 0 14 px, largura automática (mín. 120, máx. 360 px) |
| Sombra | `0 8px 24px rgba(0,0,0,0.35)` |
| Entrada | Fade + escala 0,96→1 em 120 ms, `ease-out` |
| Saída | Fade em 160 ms |
| Barras do microfone | 7 barras de 3 px, altura 4–20 px seguindo o nível RMS, atualização a 30 fps |
| Transcrevendo | 3 pontos pulsando em sequência, ciclo de 900 ms |

`prefers-reduced-motion`: sem escala nem pulso; troca de estado instantânea.

## 6. Componentes

### Pílula — estados

| Estado | Visual | Texto | Saída |
| --- | --- | --- | --- |
| `listening` (segurando) | Ponto `--ts-listening` + barras do microfone + cronômetro | "Ouvindo…" | Ao soltar → `transcribing` |
| `listening` (mãos livres) | Igual + linha muted | "Ouvindo…" / "toque de novo para terminar" | No próximo toque → `transcribing` |
| `listening` (últimos 30 s) | Cronômetro em `--ts-notice` | "Termina em 0:30" | Aos 5:00 → `transcribing` |
| `transcribing` | 3 pontos `--ts-working` | "Transcrevendo…" | Texto inserido → `hidden` |
| `notice` | Ícone de clipboard em `--ts-notice` | "Texto copiado — cole com Ctrl+V" | Some após 4 s |
| `error` | Ícone de alerta em `--ts-error` | Mensagem de [API.md §4](API.md#4-códigos-de-erro) | Some após 4 s |
| `hidden` | — | — | — |

### Pílula — janela

- `BrowserWindow` sem moldura, transparente, `alwaysOnTop` nível `screen-saver`, `skipTaskbar`,
  `focusable: false`, `setIgnoreMouseEvents(true)`, exibida com `showInactive()`.
- Posição: centralizada horizontalmente na tela onde está o cursor do mouse, 24 px acima da borda
  inferior da área de trabalho (respeita a barra de tarefas).

### Ícone da bandeja

- Glifo próprio de microfone, monocromático, em 16/20/24/32 px (escala do Windows).
- Variante "gravando": mesmo glifo com ponto `--ts-listening`.
- Menu: "Touch Speaker — pronto" (desabilitado, mostra estado) · "Microfone: {nome do dispositivo}" (desabilitado) ·
  separador · "Abrir pasta de configuração" · "Sair".

### Sons

Gerados em tempo real com Web Audio (sem arquivos de áudio de terceiros), volume baixo:

| Evento | Som |
| --- | --- |
| Início da gravação | Senoide 880 Hz, 60 ms, fade-out |
| Fim da gravação | Senoide 660 Hz, 60 ms, fade-out |
| Erro | Duas notas 440→330 Hz, 80 ms cada |

Desligáveis com `"sounds": false` no `config.json`.

## 7. Layout e responsividade

A pílula só cresce na horizontal. Funciona com escala de tela de 100% a 200% (o Electron entrega
pixels lógicos); textos longos de erro quebram com reticências em 360 px.

## 8. Escrita (voz da interface)

- pt-BR, curto, verbo no gerúndio para estados ("Ouvindo…", "Transcrevendo…").
- Erro diz o que aconteceu e, quando houver, o que fazer ("Sem conexão — tente de novo").
- Nunca culpar a pessoa; nunca mostrar código técnico na interface.

## 9. Acessibilidade

- Cor nunca é o único sinal: todo estado tem ícone + texto.
- Contraste mínimo 4,5:1.
- Sons como confirmação não visual (desligáveis).
- `prefers-reduced-motion` respeitado.

## 10. Nunca faça

- Dar foco à pílula ou abrir janela durante o ditado.
- Usar ícone, cor, som ou texto copiado de outro produto.
- Mostrar o texto transcrito na pílula na Fase 1 (o texto aparece no app de destino; mostrar em dois
  lugares confunde).
- Animação que atrase a inserção do texto.
