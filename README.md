# 🎙️ Touch Speaker — ditado por voz para Windows: fale e o texto aparece onde está o cursor

<p align="center">
  <img src="docs/assets/logo.svg" alt="Logo do Touch Speaker" width="360">
</p>

![Electron](https://img.shields.io/badge/Electron-44.9.0-47848F?style=flat&logo=electron&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-7.0.2-3178C6?style=flat&logo=typescript&logoColor=white)
![Node.js](<https://img.shields.io/badge/Node.js-24%20LTS-5FA04E?style=flat&logo=nodedotjs&logoColor=white>)
![Windows](<https://img.shields.io/badge/Windows-10%20%7C%2011%20x64-0078D4?style=flat>)
![Groq](<https://img.shields.io/badge/Groq-Whisper%20large--v3--turbo-F55036?style=flat>)
![Testes](<https://img.shields.io/badge/testes-30%20passando-brightgreen?style=flat>)
![Status](<https://img.shields.io/badge/status-fase%201%20%C2%B7%20em%20verifica%C3%A7%C3%A3o-orange?style=flat>)
![License](https://img.shields.io/badge/license-propriet%C3%A1ria-lightgrey?style=flat)

> 🗣️ O **Touch Speaker** é um app de bandeja para Windows que transforma fala em texto digitado no app em foco. Você **segura o Ctrl direito**, fala e solta — em menos de um segundo o texto aparece no cursor do VS Code, do navegador, do WhatsApp ou de qualquer outro app, como se tivesse sido digitado. A transcrição em português é feita pelo Whisper (via Groq, plano gratuito) e o que você tinha copiado no clipboard volta ao lugar depois.

Contexto de negócio (o "porquê"): [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) · Requisitos: [`docs/PRD.md`](docs/PRD.md) · Contrato de engenharia: [`docs/spec/spec-driven-development.md`](docs/spec/spec-driven-development.md) · Decisões: [`docs/DECISIONS.md`](docs/DECISIONS.md)

**📅 Estágio:** **Fase 1 (MVP) implementada e funcionando de ponta a ponta** no Windows do mantenedor desde 17/out/2026 (commit `bae6eba`). Medido nos primeiros ditados reais: **0,66–0,88 s** do fim da fala até o texto inserido e microfone aberto em 75–270 ms. Falta concluir o roteiro de verificação manual V1–V13 da [spec da feature](docs/spec/features/ditado-por-voz.md) (segurar, `Esc`, clipboard, outros apps, janela de administrador). Não há instalador: roda em modo de desenvolvimento, com a chave Groq do próprio usuário.

---

## 🧭 Visão geral

| Componente                                               | O que é                                                                                                             | Status                                                                     |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Atalho global** (`hotkey.ts`, `keyboard.ts`) | Hook de teclado (`uiohook-napi`); segurar ≥ 500 ms = falar segurando, toque curto = mãos livres, `Esc` cancela | ✅ Funciona — lógica coberta por 10 testes                               |
| **Pílula** (`pill-window.ts`, `renderer/`)    | Janela flutuante que não rouba foco; grava o microfone (WebM/Opus) e mostra ouvindo / transcrevendo / erro          | ✅ Funciona                                                                |
| **Transcrição** (`transcribe/`)                | `GroqTranscriber` com filtros contra alucinações do Whisper em silêncio                                         | ✅ Funciona — 17 testes (filtros 8 + `GroqTranscriber` 9)                |
| **Inserção** (`insert/`)                       | Clipboard + Ctrl+V via `SendInput` (`koffi`), restaura o clipboard, fallback para janelas de administrador       | ✅ Colagem comprovada; fallback de admin ainda não verificado manualmente |
| **Sessão** (`session.ts`)                       | Máquina de estados, dono único do estado do ditado                                                                 | ✅ Funciona                                                                |
| **Bandeja, config e log**                          | Ícone, `config.json`, log só com metadados                                                                       | ✅ Funciona                                                                |
| **Limpeza por IA** (`refine.ts`)                 | Interface `Refiner` — hoje devolve o texto como veio                                                              | 🟡 Encaixe pronto; implementação na Fase 2                               |
| **`database/`**                                  | Histórico e dicionário em SQLite local                                                                             | ⏳ Fase 2                                                                  |
| **`backend/`**                                   | API própria, contas, streaming                                                                                      | ⏳ Fase 4                                                                  |

**Fluxo do produto:** segura Ctrl direito → a pílula aparece "Ouvindo…" e o microfone abre → você fala → solta → "Transcrevendo…" → o áudio vai à Groq → o texto passa pelos filtros anti-lixo → é colado no cursor do app em foco → o clipboard volta ao que era → a pílula some. Em mãos livres, um toque começa e outro termina.

**Regras inegociáveis:**
🔒 **Privacidade por padrão** — microfone aberto só durante o ditado, áudio nunca vai para disco, texto ditado, clipboard e teclas nunca vão para log (C1). 🎯 **Nunca roubar o foco** — o texto vai para o app em que você está (C2). 🗑️ **Nunca digitar lixo** — toque acidental ou silêncio não inserem nada (C3). 🧼 **Sala limpa** — nada copiado de outro produto (C7). Princípios completos no [SDD §1.5](docs/spec/spec-driven-development.md#15-princípios-do-produto--constituição-c1c8).

---

## ✅ Pré-requisitos

| Ferramenta                 | Versão                                    | Para quê                             | Verificar                                               |
| -------------------------- | ------------------------------------------ | ------------------------------------- | ------------------------------------------------------- |
| 🪟 **Windows**       | 10 ou 11, 64 bits                          | Único sistema suportado na Fase 1    | `winver`                                              |
| 🟩 **Node.js**       | **24 LTS** (conferido com 24.20.0)   | Build e execução em desenvolvimento | `node --version`                                      |
| 📦 **npm**           | o que vem com o Node (conferido com 11.21) | Dependências                         | `npm --version`                                       |
| 🔧 **Git**           | atual                                      | Versionamento                         | `git --version`                                       |
| 🎤 **Microfone**     | qualquer                                   | Captura da voz                        | Configurações → Sistema → Som                       |
| 🔑 **Chave da Groq** | gratuita                                   | Transcrição                         | [Passo a passo logo abaixo](#-como-obter-sua-chave-da-groq-gratuita) |

> Não há banco, fila nem servidor para subir na Fase 1.

---

## 🔑 Como obter sua chave da Groq (gratuita)

<!-- Prints em docs/assets/groq/ (01 a 07), um por passo. Nos prints 04 e 05 a chave tem de estar borrada (ou use uma chave já revogada). -->

O Touch Speaker não tem servidor próprio: o áudio vai do seu computador direto para a Groq, autenticado com a **sua** chave. A Groq tem um **plano gratuito** que basta para o ditado de uma pessoa (veja os [limites](#limites-do-plano-gratuito) abaixo).

> ⚠️ **Groq não é Grok.** A **Groq** ([groq.com](https://groq.com)) é a empresa que roda o Whisper usado aqui. O **Grok** é o assistente de IA da xAI: outra empresa, outro produto. A chave do Grok não serve para o Touch Speaker.

### Passo 1 — Crie sua conta ou entre

Abra [console.groq.com](https://console.groq.com) e crie uma conta. Se já tiver uma, só entre.

![Página inicial do console da Groq, com as opções para criar conta e para entrar](docs/assets/groq/01-criar-conta.png)

### Passo 2 — Abra a página API Keys

No menu do console, abra **API Keys**. Se preferir, vá direto em [console.groq.com/keys](https://console.groq.com/keys).

![Console da Groq com a página API Keys aberta e o item API Keys destacado no menu](docs/assets/groq/02-api-keys.png)

### Passo 3 — Crie uma chave nova

Clique em **Create API Key** e dê à chave um nome que lembre para que ela serve, por exemplo `touch-speaker`. Confirme.

![Janela de criação de chave do console da Groq, com o nome touch-speaker preenchido](docs/assets/groq/03-nova-chave.png)

### Passo 4 — Copie a chave na hora

A chave aparece na tela (ela começa com `gsk_`). **Copie agora**: o console pode não mostrá-la de novo. Se você perder a chave, não tem problema: apague essa e crie outra (passo 3).

![Chave recém-criada no console da Groq, com o valor borrado e o botão de copiar em destaque](docs/assets/groq/04-copiar-chave.png)

### Passo 5 — Coloque a chave no Touch Speaker

Se ainda não baixou o projeto, faça antes os passos 1️⃣ (clone) e 2️⃣ (dependências) do **Setup local detalhado**, mais abaixo. Depois, dentro da pasta `frontend/`:

```powershell
copy .env.example .env
notepad .env
```

No Bloco de Notas, cole a chave logo depois do `=` na linha `GROQ_API_KEY=`, sem espaços e sem aspas, e salve. A linha fica `GROQ_API_KEY=` seguida da sua chave.

![Arquivo frontend/.env aberto no Bloco de Notas, com a linha GROQ_API_KEY preenchida e a chave borrada](docs/assets/groq/05-env.png)

### Passo 6 — Abra o app e confira

```powershell
npm run dev
```

Passe o mouse sobre o ícone do Touch Speaker na bandeja (talvez escondido na setinha `^`) ou clique nele com o botão direito. Deve aparecer **"Touch Speaker — pronto"**. Se aparecer **"Touch Speaker — falta a chave da Groq"**, o app não achou a chave: confira se o arquivo é `frontend/.env` e se a linha `GROQ_API_KEY=` está preenchida.

O app só lê o `.env` quando abre. Se trocar a chave com o app aberto, clique em **Sair** no menu da bandeja e rode `npm run dev` de novo.

![Menu do ícone do Touch Speaker na bandeja do Windows mostrando "Touch Speaker — pronto"](docs/assets/groq/06-app-na-bandeja.png)

### Cuidados com a chave

- A chave é pessoal, como uma senha: quem tiver a sua usa a sua cota.
- **Nunca** faça commit do `.env`. Ele já está no `.gitignore` (`.env` e `.env.*`; só o `.env.example`, sem chave, é versionado).
- Não cole a chave em issue, chat, e-mail ou print. Num print, borre a chave antes.
- **Vazou?** Na mesma página [API Keys](https://console.groq.com/keys), apague (revogue) a chave, crie outra e troque no `.env`.
- O app usa a chave só no processo principal e nunca a escreve no log. Detalhes em [`docs/Security-Guide.md` §10](docs/Security-Guide.md#10-segredos-e-configuração).

### Limites do plano gratuito

Para o modelo `whisper-large-v3-turbo`, em out/2026:

| Limite | Plano gratuito | No Touch Speaker |
| --- | --- | --- |
| Requisições por minuto | 20 | Cada ditado é uma requisição |
| Requisições por dia | 2.000 | — |
| Áudio por hora | 7.200 s (2 h) | Soma da duração dos ditados |
| Áudio por dia | 28.800 s (8 h) | Soma da duração dos ditados |
| Tamanho do arquivo | até 25 MB | O app grava no máximo 5 min por ditado, em Opus, bem abaixo disso |

Os limites valem por **organização** (a sua conta da Groq), não por chave: criar mais chaves não aumenta a cota. Se passar do limite, a pílula mostra "Limite gratuito da Groq atingido — tente em instantes" e aquele ditado não é inserido; é só esperar um pouco.

Esses números podem mudar. A fonte oficial é a página de limites da sua conta, [console.groq.com/settings/limits](https://console.groq.com/settings/limits) (documentação: [console.groq.com/docs/rate-limits](https://console.groq.com/docs/rate-limits)).

![Página de limites do console da Groq, com a linha do modelo whisper-large-v3-turbo](docs/assets/groq/07-limites.png)

### E se um dia precisar de mais?

O uso pago do `whisper-large-v3-turbo` custa **US$ 0,04 por hora de áudio**, com cobrança mínima de 10 s por requisição. Preços atualizados em [groq.com/pricing](https://groq.com/pricing).

---

## 🏗️ Arquitetura

Componentes, fluxo e fronteiras em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); as decisões (ADR-01…07) em [`docs/DECISIONS.md`](docs/DECISIONS.md). O resumo visual:

```text
Teclado ──► uiohook-napi (hook global, thread própria)
                │ só "tecla de ditado / Esc / outra" — nenhum código de tecla segue adiante
                ▼
Processo main (Electron 44 · Node)
├── HotkeyController   segurar vs. tocar, auto-repetição, atalho vs. ditado
├── SessionController  idle → recording → transcribing → inserting → idle
├── GroqTranscriber    POST multipart → Whisper large-v3-turbo (pt) + filtros anti-lixo
├── Refiner            identidade na Fase 1 (LLM na Fase 2)
├── TextInserter       backup do clipboard → texto → Ctrl+V (SendInput via koffi) → restaura
└── Tray · Config · Logger
                │ IPC mínimo via contextBridge (sandbox)
                ▼
Renderer "pílula" — getUserMedia + MediaRecorder (WebM/Opus 32 kbps) · medidor de nível · sons
```

**Um ditado, ponta a ponta:**

```mermaid
sequenceDiagram
    participant U as Você
    participant H as Hook de teclado
    participant M as Main (sessão)
    participant P as Pílula (renderer)
    participant G as Groq
    participant A as App em foco

    U->>H: segura Ctrl direito
    H->>M: start
    M->>P: recorder:start + estado "Ouvindo…"
    P->>P: abre o microfone e grava
    U->>H: solta (≥ 500 ms)
    H->>M: stop
    M->>P: recorder:stop + "Transcrevendo…"
    P->>M: recorder:result (áudio WebM/Opus)
    M->>G: POST /audio/transcriptions (language=pt)
    G-->>M: texto + segmentos (no_speech_prob)
    M->>M: filtros anti-lixo
    M->>A: clipboard ← texto, Ctrl+V (SendInput)
    M->>M: restaura o clipboard original
    M->>P: estado "hidden"
```

**Quem fala com quem:**

```mermaid
flowchart TD
    K["Teclado"] -->|"eventos globais"| HK["uiohook-napi"]
    HK --> MAIN["Processo main<br/>sessão · transcrição · inserção"]
    MAIN <-->|"IPC via contextBridge"| PILL["Pílula<br/>gravação + status"]
    MIC["Microfone"] --> PILL
    MAIN -->|"HTTPS + chave do usuário"| GROQ[("Groq<br/>Whisper large-v3-turbo")]
    MAIN -->|"clipboard + SendInput (koffi → user32)"| APP["App em foco"]
    MAIN --> FILES[("%APPDATA%\Touch Speaker<br/>config.json · logs/")]
```

A única integração externa é a Groq: visão da integração (fluxo, nova tentativa, limites, riscos) em [`docs/INTEGRATION.md`](docs/INTEGRATION.md) e contrato campo a campo em [`docs/API.md` — Transcrição (Groq)](docs/API.md#transcrição-groq).

---

## 🧱 Stack

- 🖥️ **App:** **Electron 44.9.0** · TypeScript 7.0.2 estrito · build com `tsc` (CommonJS no main, script clássico no renderer), sem bundler (ADR-01)
- ⌨️ **Teclado global:** `uiohook-napi` 1.5.5 — keydown/keyup globais, que o `globalShortcut` do Electron não oferece (ADR-02)
- 🧩 **Win32:** `koffi` 3.3.3 chamando `user32`/`kernel32`/`advapi32` — `SendInput`, detecção de janela elevada (ADR-03)
- 🎙️ **Áudio:** `getUserMedia` + `MediaRecorder` em WebM/Opus 32 kbps mono, com cancelamento de eco, supressão de ruído e ganho automático
- 🧠 **Transcrição:** Groq · `whisper-large-v3-turbo`, `language=pt`, `temperature=0`, `verbose_json` (ADR-04)
- 🔐 **Segurança:** `contextIsolation` + `sandbox`, CSP restrita, permissão de mídia só de áudio e só para a pílula, IPC validado no main
- 🧪 **Qualidade:** `node:test` (30 testes) · TypeScript com `strict` e `noUncheckedIndexedAccess`

`koffi` e `uiohook-napi` trazem binários prontos para win32-x64; os scripts de instalação deles ficam negados no `allowScripts` do `package.json`.

---

## 📂 Estrutura de pastas

```text
touch-speaker/
├── frontend/                       # o app desktop (Electron) — rode os comandos daqui
│   ├── package.json · package-lock.json
│   ├── tsconfig.main.json          # main + preload + shared + testes
│   ├── tsconfig.renderer.json      # renderer (script clássico, DOM)
│   ├── .env.example                # GROQ_API_KEY= (copie para .env)
│   ├── scripts/                    # start.mjs (abre o Electron) · copy-static.mjs
│   └── src/
│       ├── main/                   # sessão, atalho, transcrição, inserção, bandeja, config, log
│       ├── preload/pill.ts         # API mínima exposta à pílula
│       ├── renderer/               # pill.html · pill.css · pill.ts
│       ├── shared/ipc.ts           # contrato de IPC
│       └── test/                   # hotkey · filters · groq · config
├── backend/                        # API própria — Fase 4
├── database/                       # migrations SQLite — Fase 2
├── docs/                           # PRD, arquitetura, decisões, API, integração, dados, ambiente, design,
│                                   # segurança, estilo de código, changelog, specs, templates, referência
└── README.md · PROJECT_CONTEXT.md · CLAUDE.md · AGENTS.md · SECURITY.md · LICENSE.md
```

---

## ⚙️ Setup local detalhado

> Objetivo: do `git clone` ao primeiro ditado sem perguntar nada. Os comandos rodam **dentro de `frontend/`**.

### 1️⃣ Clone

```powershell
git clone https://github.com/Victorkaue333/touch-speaker.git
cd touch-speaker\frontend
```

### 2️⃣ Dependências

```powershell
npm install
```

O npm avisa que os scripts de instalação de `koffi` e `uiohook-napi` não rodaram — **é esperado**: os dois já trazem o binário pronto.

### 3️⃣ Chave da Groq

Ainda não tem a chave? Siga [Como obter sua chave da Groq](#-como-obter-sua-chave-da-groq-gratuita) (é gratuita). Com ela copiada:

```powershell
copy .env.example .env
notepad .env        # cole a chave logo depois de GROQ_API_KEY= e salve
```

O `.env` está no `.gitignore`. **Nunca** faça commit dele. Variáveis e o arquivo `.env` em detalhe: [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md#variáveis).

### 4️⃣ Abrir o app

```powershell
npm run dev
```

Compila e abre o app. Na primeira vez baixa o binário do Electron (~100 MB, verificado por checksum). O ícone de microfone verde-azulado aparece na bandeja (talvez escondido na setinha `^`).

### 5️⃣ Primeiro ditado

Abra o Bloco de Notas, clique dentro, **segure o Ctrl direito**, fale "teste de ditado" e solte. O texto aparece em menos de um segundo.

| Gesto                                    | Resultado                                         |
| ---------------------------------------- | ------------------------------------------------- |
| Segurar Ctrl direito ≥ 0,5 s e soltar   | Grava enquanto segura; solta → transcreve e cola |
| Toque rápido no Ctrl direito            | Mãos livres: grava até o próximo toque         |
| `Esc` durante a gravação             | Cancela, nada é inserido                         |
| Ctrl direito + outra tecla (ex.: Ctrl+C) | Tratado como atalho normal, não como ditado      |

### 6️⃣ Configuração (opcional)

`%APPDATA%\Touch Speaker\config.json`, criado na primeira execução. Dá para trocar a tecla (`RightCtrl`, `RightAlt`, `RightShift`, `CapsLock`, `F13`–`F24`), o microfone, o idioma, a posição da pílula e os sons. Campos e limites em [`docs/DATABASE.md`](docs/DATABASE.md#configjson). Reinicie o app depois de editar.

### 7️⃣ Verificação

```powershell
npm test            # compila e roda os 30 testes
npm run typecheck   # TypeScript estrito, sem emitir
```

---

## 🧪 Testes e verificação

| Item                      | Estado                                                                                                                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`              | ✅ 30/30 — `HotkeyController` (10), filtros anti-lixo (8), `GroqTranscriber` (9, com `fetch` simulado), config (3)                      |
| `npm run typecheck`     | ✅ Sem erros                                                                                                                                   |
| App sobe no Electron 44   | ✅ Hook de teclado e `koffi` carregados (`app_ready` no log)                                                                               |
| Colagem via `SendInput` | ✅ Comprovada isoladamente e em ditado real                                                                                                    |
| Roteiro manual V1–V13    | 🟡 Em andamento — V2 (mãos livres) aprovado; lista completa na [§12 da spec](docs/spec/features/ditado-por-voz.md#12-plano-de-verificação) |

Não há testes de interface automatizados: gravação, colagem e pílula são verificadas à mão pelo roteiro da spec.

---

## 📋 Comandos úteis

Todos de dentro de `frontend/`.

| Comando               | O que faz                            |
| --------------------- | ------------------------------------ |
| `npm run dev`       | Compila e abre o app                 |
| `npm start`         | Abre sem recompilar                  |
| `npm run build`     | Só compila (`dist/`)              |
| `npm test`          | Compila e roda os testes             |
| `npm run typecheck` | Checagem de tipos sem gerar arquivos |

---

## 🩺 Problemas comuns

| Sintoma                                    | Causa e solução                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| O app abre e fecha na hora, sem erro       | Variável `ELECTRON_RUN_AS_NODE` herdada do VS Code. Abra sempre por `npm run dev`/`npm start`, que a removem |
| Pílula "Falta a chave da Groq — veja o README" | `frontend/.env` ausente ou vazio — [Como obter sua chave da Groq](#-como-obter-sua-chave-da-groq-gratuita) e passo 3️⃣ |
| Pílula "Chave da Groq inválida"           | Chave incompleta, errada ou revogada — crie outra em [API Keys](https://console.groq.com/keys), troque no `.env` e reabra o app |
| Pílula "Limite gratuito da Groq atingido — tente em instantes" | Passou de um [limite do plano gratuito](#limites-do-plano-gratuito) — espere um pouco e dite de novo |
| Pílula "Texto copiado — cole com Ctrl+V" | O app em foco roda como administrador e o Windows bloqueia colagem simulada; o texto ficou no clipboard             |
| Dois apps reagem ao atalho                 | Feche o Typeless ou outro app de ditado com atalho parecido                                                         |
| Nada acontece ao segurar a tecla           | Veja `%APPDATA%\Touch Speaker\logs\main.log` — `keyboard_hook` deve estar `true` no `app_ready`            |

O log guarda só tempos, tamanhos e códigos de erro — nunca o que você ditou. Mais casos e o formato do log em [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md#problemas-comuns).

---

## 🔌 Contratos

O Touch Speaker não expõe API própria na Fase 1. Contratos completos em [`docs/API.md`](docs/API.md).

| Contrato                                                                         | Entre           | Resumo                                                                                                                                                                  |
| -------------------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST https://api.groq.com/openai/v1/audio/transcriptions`                     | main → Groq    | Multipart com `file`, `model`, `language=pt`, `temperature=0`, `response_format=verbose_json`; timeout 20 s; 401/403 → chave inválida, 413 → gravação longa demais, 429 → limite (sem nova tentativa), 5xx → 1 nova tentativa após 500 ms |
| `recorder:start` · `recorder:stop` · `recorder:cancel` · `pill:state` | main → pílula | Comandos de gravação e estado visual, sempre com `sessionId`                                                                                                        |
| `recorder:started` · `recorder:result` · `recorder:error`                | pílula → main | Confirmação, áudio (≤ 25 MB) e erros de microfone — validados no main                                                                                              |

Códigos de erro e mensagens da pílula: [`docs/API.md` — Códigos de erro](docs/API.md#códigos-de-erro). Visão da integração com a Groq: [`docs/INTEGRATION.md`](docs/INTEGRATION.md).

---

## 📖 Documentação

| Documento                                                                            | Conteúdo                                                |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md)                                          | Problema, público, fases e métricas                    |
| [`CLAUDE.md`](CLAUDE.md)                                                            | Regras para a IA atuar no repositório                   |
| [`AGENTS.md`](AGENTS.md)                                                            | Ponto de entrada para agentes de IA: projeto, docs canônicos e fonte normativa |
| [`docs/PRD.md`](docs/PRD.md)                                                        | Requisitos (FR-DICT-01…13, NFR-01…07) e roadmap        |
| [`docs/spec/spec-driven-development.md`](docs/spec/spec-driven-development.md)      | SDD — contrato de engenharia: princípios (C1–C8), requisitos, regras, riscos, pendências e roadmap |
| [`docs/DECISIONS.md`](docs/DECISIONS.md)                                            | ADR-01…07: contexto, decisão, consequências e implementação |
| [`docs/spec/features/ditado-por-voz.md`](docs/spec/features/ditado-por-voz.md)      | Spec da Fase 1, tarefas e roteiro de verificação (formato anterior ao template) |
| [`docs/templates/`](docs/templates/README.md)                                       | Como nasce uma feature (Spec → Gate → Execução) e os templates de spec, milestone e migração |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                                      | Componentes, fluxo, fronteiras e evolução por fase      |
| [`docs/API.md`](docs/API.md)                                                        | Contratos com a Groq, IPC e códigos de erro             |
| [`docs/INTEGRATION.md`](docs/INTEGRATION.md)                                        | Integração com a Groq: fluxo, nova tentativa, garantias, limites e riscos |
| [`docs/DATABASE.md`](docs/DATABASE.md)                                              | `config.json` e o SQLite planejado para a Fase 2       |
| [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md)                                        | Node.js e Electron, variáveis (`GROQ_API_KEY`), `.env`, log e problemas comuns |
| [`docs/DESIGN.md`](docs/DESIGN.md)                                                  | Pílula, cores, sons e bandeja                           |
| [`docs/Code-Style.md`](docs/Code-Style.md)                                          | Estilo de código TypeScript, testes e commits            |
| [`SECURITY.md`](SECURITY.md) · [`docs/Security-Guide.md`](docs/Security-Guide.md) | Política e guia de segurança                           |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md)                                            | O que mudou e por quê                                    |
| [`docs/referencia/estudo-typeless.md`](docs/referencia/estudo-typeless.md)          | Estudo do produto de referência e o que adotamos (não normativo) |

**Ordem de leitura sugerida:** `CLAUDE.md` (ou `AGENTS.md`) → `PROJECT_CONTEXT.md` → `docs/PRD.md` → SDD → `docs/DECISIONS.md` → spec da feature.

**Em conflito entre documentos**, vale a ordem da [política de prevalência do SDD](docs/spec/spec-driven-development.md#01-política-de-prevalência-documental): `docs/DECISIONS.md` → SDD → `CLAUDE.md`/`AGENTS.md` → docs específicos → spec da feature → READMEs. O código em `frontend/` é a fonte de fato sobre o que existe.

---

## 🗺️ Roadmap

| Fase        | Entrega                                                                                                | Status                            |
| ----------- | ------------------------------------------------------------------------------------------------------ | --------------------------------- |
| **1** | Ditado básico: atalho, gravação, Groq, colagem no app em foco                                       | 🟡 Implementada, em verificação |
| **2** | Limpeza do texto com IA (Claude Haiku), dicionário pessoal, histórico local, tela de configurações | ⏳ Próxima                       |
| **3** | Contexto do app em foco (UI Automation), Ask Anything, tradução, aprendizado com as correções      | ⏳                                |
| **4** | Backend próprio, contas, streaming de áudio, instalador assinado e atualização automática         | ⏳                                |

Detalhes no [PRD](docs/PRD.md#roadmap). Feature nova começa sempre por uma spec ([os três estágios](docs/templates/README.md#os-três-estágios)).

---

**Dúvida de escopo** → o PRD e a spec respondem. **Divergência** → alinhe com o Victor antes de implementar; não invente regra de negócio.

## 📄 Licença

Software **proprietário** — todos os direitos reservados. Veja [`LICENSE.md`](LICENSE.md). © 2026 Victor Alves.

<small>Última atualização: 17/out/2026 · Mantenedor: Victor Alves</small>
