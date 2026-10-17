# Ditado por voz — spec

> **Status:** aprovada (17/out/2026) · em implementação · **Fase:** 1 · **Data:** 17/out/2026
> **Requisitos:** FR-DICT-01 … FR-DICT-13, NFR-01 … NFR-07

> Spec anterior ao template atual (seções §0–§15 do SDD 1.0). Specs novas usam docs/templates/TEMPLATE-spec-feature.md.

## 0. Constituição (gate)

| Princípio | Como esta spec respeita |
| --- | --- |
| C1 Privacidade | Áudio só em memória; log sem texto/clipboard/teclas (§8, §11) |
| C2 Foco | Pílula `focusable: false`, `showInactive()`, ignora mouse (§6) |
| C3 Sem lixo | Filtro de duração + `no_speech_prob` + lista de alucinações (§4.4) |
| C4 Falha visível | Todo código de erro tem mensagem (API.md §4) |
| C5 Trocável | `Transcriber` e `Refiner` são interfaces (§7) |
| C6 Segredo | Chave só em `.env`, só no main (§8) |
| C7 Sala limpa | Implementação a partir de docs públicos da Microsoft/Electron/Groq |
| C8 Escopo | Sem limpeza por IA, histórico ou contexto (§2) |

**Violação:** nenhuma.

## 1. Problema

O Victor dita o dia inteiro em VS Code, terminal, navegador e mensageiros. Hoje depende do Typeless
(pago, fechado). Precisa do mesmo gesto, "segura, fala, solta, aparece escrito", num app próprio.

## 2. Objetivo e não-objetivos

**Objetivo:** segurar (ou tocar) uma tecla, falar em pt-BR e ter o texto colado no cursor do app em
foco em ~1,5 s, sem perder o clipboard e sem nunca digitar lixo.

**Não-objetivos:** limpeza por IA, dicionário, histórico, tela de configurações, contexto do app,
tradução, comandos por voz, streaming, instalador, outras plataformas.

## 3. Rastreabilidade

| FR | Componente | Contrato | Dado | Verificação |
| --- | --- | --- | --- | --- |
| FR-DICT-01/02 | `HotkeyController`, `SessionController` | uiohook events | `config.hotkey`, `holdThresholdMs` | Teste unitário (§12.1) + V1, V2 |
| FR-DICT-03 | `HotkeyController` | `recorder:cancel` | — | V3 |
| FR-DICT-04 | `GroqTranscriber` | API.md §2 | `config.transcription` | Teste com fixture + V4 |
| FR-DICT-05/06/10 | `TextInserter`, `win32.ts` | `SendInput` | — | V5, V6, V10 |
| FR-DICT-07 | Pílula (renderer) | `pill:state` | — | V7 |
| FR-DICT-08 | `GroqTranscriber` (filtros) | — | — | Teste unitário + V8 |
| FR-DICT-09 | `SessionController` | API.md §4 | — | V9 |
| FR-DICT-11 | `SessionController` | `maxMs` | `maxRecordingMs` | V11 |
| FR-DICT-12 | `Tray` | — | — | V12 |
| FR-DICT-13 | `Config` | — | `config.json` | V13 |

## 4. Requisitos funcionais

### 4.1 Tecla de ditado (FR-DICT-01, 02, 03)

Estado do `HotkeyController`: `down: boolean`, `downAt: number`, `otherKeyWhileDown: boolean`.

| Evento | Condição | Ação |
| --- | --- | --- |
| keydown da tecla | `down == true` | Ignora (auto-repetição) |
| keydown da tecla | sessão `idle` | `down = true`, `downAt = agora`, **start** (modo provisório `hold`) |
| keydown da tecla | sessão `recording` em `handsfree` | **stop** (encerra mãos livres) |
| keydown da tecla | sessão `transcribing`/`inserting` | Ignora |
| keyup da tecla | gravação iniciada por este keydown, `agora - downAt ≥ holdThresholdMs` | **stop** (modo `hold`) |
| keyup da tecla | gravação iniciada por este keydown, `agora - downAt < holdThresholdMs` | Muda modo para `handsfree`; continua gravando |
| keydown de **outra** tecla | tecla de ditado pressionada e gravação < 1 s | **cancel** silencioso: era um atalho (ex.: Ctrl direito + C), não um ditado |
| keydown `Esc` | sessão `recording` | **cancel** |
| qualquer evento | `inserting == true` | Ignora (Ctrl+V sintético) |

Sobre "outra tecla": o controller registra **só o fato** de que outra tecla foi pressionada, nunca qual
([Security Guide §7](../../Security-Guide.md#7-entrada-teclado-global-e-ipc)).

### 4.2 Gravação (FR-DICT-07, 11)

- A pílula é criada escondida no início do app (renderer já carregado → início rápido).
- `start`: `getUserMedia({ audio: { deviceId, channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } })`
  → `MediaRecorder` com `audio/webm;codecs=opus`, `audioBitsPerSecond: 32000`, `timeslice` de 1 s.
- Nível do microfone por `AnalyserNode` (RMS) para as barras da pílula.
- `stop`: junta os chunks num `Blob`, envia `recorder:result` com o `ArrayBuffer`, para todas as trilhas.
- `cancel`: descarta os chunks, para as trilhas, nada é enviado.
- Limite: aos `maxRecordingMs - 30 s` a pílula avisa; aos `maxRecordingMs` o main manda `stop`.

### 4.3 Transcrição (FR-DICT-04)

Requisição conforme [API.md, "Transcrição (Groq)"](../../API.md#transcrição-groq). Timeout de 20 s.
Uma nova tentativa só em 5xx, após 500 ms. 429 não tenta de novo.

### 4.4 Filtros anti-lixo (FR-DICT-08)

Na ordem:

1. `durationMs < 500` → descarta **antes** de enviar (não gasta cota).
2. `text.trim()` vazio → descarta.
3. Todos os segmentos com `no_speech_prob ≥ 0.6` → descarta.
4. Texto normalizado (minúsculas, sem acento, sem pontuação) é uma alucinação conhecida **e**
   (`duration < 3 s` **ou** média de `no_speech_prob ≥ 0.3`) → descarta.
   Igualdade exata: "obrigado", "obrigada", "tchau", "inscrevase no canal",
   "legendas pela comunidade amaraorg". Prefixo (créditos seguidos de nome): "legendas pela comunidade",
   "legendado por".

Descarte = estado `hidden`, sem mensagem, log `no_speech`.

### 4.5 Inserção (FR-DICT-05, 06, 10)

1. Espera a tecla de ditado estar solta (até 2 s), para o Ctrl sintético não se misturar com o físico.
2. `inserting = true`.
3. Verifica se a janela em foco pertence a processo **elevado** e o Touch Speaker não é. Se sim →
   pula para o passo 8 (fallback).
4. Backup do clipboard: `text`, `html`, `rtf`, `image` (só os que não estão vazios).
5. `clipboard.writeText(texto)`.
6. Espera 20 ms. Envia **um** `SendInput` com 4 eventos: Ctrl↓, V↓, V↑, Ctrl↑ (`VK_CONTROL`,
   `0x56`). Retorno ≠ 4 → passo 8.
7. Após 250 ms: se o clipboard ainda contém o texto ditado, restaura o backup; se a pessoa copiou
   outra coisa nesse meio-tempo, não mexe. `inserting = false` 100 ms depois do `SendInput`.
8. **Fallback:** deixa o texto no clipboard (sem restaurar), estado `notice` "Texto copiado — cole com Ctrl+V".

O texto inserido é exatamente `text.trim()` da Groq (passando pelo `Refiner` identidade).

### 4.6 Bandeja e config (FR-DICT-12, 13)

Conforme [DESIGN.md §6](../../DESIGN.md#62-ícone-da-bandeja) e [DATABASE.md](../../DATABASE.md#configjson).
"Sair" chama `uIOhook.stop()`, cancela a sessão ativa e encerra o app.

## 5. Requisitos não-funcionais

| NFR | Meta nesta feature | Como medir |
| --- | --- | --- |
| NFR-01 | p50 ≤ 1,5 s / p95 ≤ 3 s, soltar → texto | Log: `t_release`, `t_upload_done`, `t_inserted`; 30 ditados de 3–30 s |
| NFR-02 | Gravação ativa ≤ 300 ms após a tecla | Log: `t_keydown` → `recorder:started` |
| NFR-03 | ≤ 220 MB de memória privada em repouso (medido: 205 MB) | Soma dos processos `electron.exe` após 10 min parado |
| NFR-04 | Indicador de microfone do Windows apaga ao fim de toda sessão | V3, V8, V9 |

## 6. Interface e estados

Estados da pílula e textos em [DESIGN.md §6](../../DESIGN.md#6-componentes). Máquina de estados da sessão:

```text
idle ──start──► recording ──stop──► transcribing ──texto ok──► inserting ──► idle
  ▲                │   │                 │                         │
  │             cancel │ erro            ├─ sem fala ──────────────┼──► idle (silencioso)
  │                │   ▼                 └─ erro ──► error ──4 s──►│
  └────────────────┴── idle                                        └─ bloqueado ─► notice ─4 s─► idle
```

## 7. Arquitetura

Componentes e pastas em [ARCHITECTURE.md](../../ARCHITECTURE.md#diagrama-de-componentes). Pontos desta
feature:

- `SessionController` é o **único** dono do estado; os outros componentes recebem comandos e
  devolvem eventos.
- `win32.ts` declara via `koffi`: `SendInput` (`user32`), `GetForegroundWindow`,
  `GetWindowThreadProcessId` (`user32`), `OpenProcess`, `CloseHandle` (`kernel32`),
  `OpenProcessToken`, `GetTokenInformation` (`advapi32`) para checar `TokenElevation`.
  `INPUT` montado como buffer de 40 bytes por evento (layout x64 da documentação da Microsoft).
- Interfaces:

```ts
interface Transcriber {
  transcribe(audio: ArrayBuffer, mimeType: string, opts: { language: string }): Promise<TranscriptionResult>;
}
type TranscriptionResult =
  | { kind: 'text'; text: string; audioSeconds: number }
  | { kind: 'no_speech' }
  | { kind: 'error'; code: ErrorCode };

interface Refiner {
  refine(text: string): Promise<string>; // Fase 1: identidade
}
```

## 8. Dados

- `config.json` conforme [DATABASE.md](../../DATABASE.md#configjson).
- `frontend/.env`: `GROQ_API_KEY`.
- Sem banco. Sem arquivo de áudio.

## 9. Contrato

IPC e erros em [API.md, "Contratos" e "Códigos de erro"](../../API.md#contratos). Nada quebra: é a primeira versão.

## 10. Fluxo ponta a ponta

1. App inicia → lê config → cria pílula escondida → inicia `uiohook` → ícone na bandeja.
2. Victor segura Ctrl direito no VS Code → `start` → pílula "Ouvindo…" + bipe → microfone abre.
3. Fala 8 s → solta → `stop` → bipe → pílula "Transcrevendo…" → áudio chega ao main.
4. `GroqTranscriber` envia, recebe texto, filtros passam.
5. `Refiner` (identidade) → `TextInserter` cola no VS Code → clipboard restaurado.
6. Pílula some. Log: tempos e tamanhos, sem o texto.

## 11. Casos de borda

| Caso | Comportamento |
| --- | --- |
| Tecla tocada sem querer (< 500 ms, sem fala) | Vira mãos livres; ao tocar de novo, filtro descarta o silêncio. Se nunca tocar de novo, encerra aos 5 min e descarta |
| Ctrl direito + C (atalho) | Cancelado em silêncio (§4.1) |
| Pessoa troca de janela enquanto transcreve | Texto vai para a janela em foco na hora da inserção (aceito) |
| App de destino como administrador | Fallback "Texto copiado" |
| Clipboard com imagem | Backup e restauração da imagem |
| Pessoa copia algo nos 250 ms após a colagem | Não restaura (não sobrescreve a cópia nova) |
| Sem microfone / microfone em uso exclusivo | `mic_unavailable` |
| Sem chave no `.env` | `no_api_key` ao tentar ditar; app abre normalmente |
| Sem internet | `network_error`; nada inserido |
| Limite gratuito da Groq | `rate_limited` |
| Duas telas | Pílula na tela onde está o mouse |
| Texto começa colado na palavra anterior | Aceito na Fase 1 (sem contexto do campo); Fase 3 resolve espaçamento |
| Tecla solta com janela de administrador em foco (o keyup não chega ao hook) | A próxima inserção pode esperar até 2 s pela "soltura"; o próximo toque na tecla normaliza. Aceito |

## 12. Plano de verificação

### 12.1 Testes automatizados (`node:test`, sem dependência extra)

- `HotkeyController`: auto-repetição, segurar ≥ limite, toque < limite, segundo toque, outra tecla,
  `Esc`, eventos durante `inserting` — com relógio injetado.
- Filtros anti-lixo: cada regra da §4.4 com respostas `verbose_json` de exemplo.
- `GroqTranscriber`: 200, 401, 413, 429, 5xx + nova tentativa, timeout — com `fetch` simulado.

### 12.2 Verificação manual

- [ ] V1 Segurar 3 s falando "teste de ditado" no Bloco de Notas → texto aparece
- [x] V2 Toque, fala, toque → texto aparece (17/out: 2 ditados de 4,6 s e 10,5 s no Bloco de Notas, inseridos em 0,88 s e 0,66 s; microfone abriu em 270 ms e 75 ms)
- [ ] V3 `Esc` durante gravação → nada aparece, indicador de microfone apaga
- [ ] V4 "Vou fazer o deploy no Docker e abrir um pull request" → termos em inglês corretos
- [ ] V5 Lista de apps do [PRD](../../PRD.md#critérios-de-aceite)
- [ ] V6 Copiar "ABC", ditar, Ctrl+V manual → "ABC"
- [ ] V7 Pílula aparece rápido, não rouba foco (cursor continua piscando no app)
- [ ] V8 Toque acidental + 3 s de silêncio + toque → nada inserido
- [ ] V9 Desligar Wi-Fi e ditar → "Sem conexão"; chave errada → "Chave da Groq inválida"
- [ ] V10 Prompt de Comando como administrador → "Texto copiado — cole com Ctrl+V"
- [ ] V11 `maxRecordingMs` reduzido para 40 s no config → aviso aos 10 s, encerra aos 40 s
- [ ] V12 "Sair" na bandeja → processo some do Gerenciador de Tarefas
- [ ] V13 Trocar `hotkey` para `RightAlt` → nova tecla funciona após reiniciar
- [ ] Latência: 30 ditados, p50/p95 calculados do log

## 13. Tarefas

**Status em 17/out/2026:** T1–T8 implementadas; build estrito limpo; 30/30 testes automatizados
passando; app sobe no Electron 44 com hook de teclado e `koffi` carregados. **T9 depende do Victor**
(chave da Groq + roteiro V1–V13). T10 parcial (docs atualizados; spec vira `implementada` após o T9).

1. **T1 — Esqueleto:** `frontend/` com `package.json` (Electron 44, TypeScript, `koffi`, `uiohook-napi`),
   `tsconfig` estrito CommonJS, `npm run dev`, app de bandeja que abre e fecha.
2. **T2 — Win32:** `win32.ts` com `SendInput` e checagem de elevação; script manual que cola "teste" após 3 s.
3. **T3 — Tecla:** `HotkeyController` + testes unitários.
4. **T4 — Pílula e gravação:** janela, preload mínimo, `Recorder`, medidor de nível, IPC.
5. **T5 — Transcrição:** `GroqTranscriber` + filtros + testes.
6. **T6 — Inserção:** `TextInserter` com backup/restauração/fallback.
7. **T7 — Sessão:** `SessionController` ligando tudo, erros, limite de 5 min, sons.
8. **T8 — Config e log:** `config.json` com defaults e validação; log rotativo sem conteúdo sensível.
9. **T9 — Verificação:** rodar §12, medir latência, corrigir.
10. **T10 — Docs:** README com "como rodar"; atualizar docs que mudaram; spec → `implementada`.

## 14. Riscos

| Risco | Mitigação |
| --- | --- |
| `uiohook-napi` não carregar no Electron 44 | Testar no T1 antes de tudo; alternativa: hook próprio com `koffi` + thread dedicada |
| Primeiras sílabas cortadas | Pílula pré-carregada; se incomodar, manter o stream aberto por 30 s após cada uso |
| Whisper errar termos técnicos | Fase 2: `prompt` com dicionário pessoal |

## 15. Decisões tomadas nesta spec

- Tecla padrão **Ctrl direito**: sozinha não faz nada em nenhum app, existe em teclado ABNT2 e não
  conflita com o atalho do Typeless instalado na mesma máquina.
- **Um limite de 500 ms** separa segurar de tocar, sem detecção de duplo toque: mais simples e mais
  tolerante que um temporizador de 400 ms.
- **Limite de 5 min** por gravação: ditados reais são curtos; protege a cota gratuita.
