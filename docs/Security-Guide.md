# Security Guide — Touch Speaker

Como escrever código seguro neste repositório: os controles que já existem, onde ficam, as regras para
não furá-los e os riscos que continuam abertos. Um app que ouve o microfone, observa o teclado e mexe no
clipboard tem acesso a muita coisa sensível; este guia diz o que o Touch Speaker pode e não pode fazer com
cada uma delas. Para **reportar** uma vulnerabilidade, veja [`SECURITY.md`](../SECURITY.md).

> Última atualização: 18/out/2026 · Mantenedor: Victor Alves
> Relacionados: [`Code-Style.md`](Code-Style.md) · [`ENVIRONMENT.md`](ENVIRONMENT.md) ·
> [`API.md`](API.md) · [`DATABASE.md`](DATABASE.md) · [`INTEGRATION.md`](INTEGRATION.md) ·
> [`DECISIONS.md`](DECISIONS.md) · [`DESIGN.md`](DESIGN.md) ·
> [SDD](spec/spec-driven-development.md) (requisitos, regras, riscos no §26, ADRs no §27 e pendências no Apêndice B)

**Como ler:** afirmação com âncora `arquivo.ts:linha` é **FATO**, conferido no código em 17/out/2026 sobre o
commit `ed0a1f5` e, no que a spec [`janela-principal`](spec/features/janela-principal.md) tocou (janela principal,
chave da Groq, `config.json` gravado pela tela, item de login) e as specs [`historico`](spec/features/historico.md)
e [`historico-dados-v1`](spec/features/historico-dados-v1.md) e o tema da janela tocaram (banco local, canais
`history:*` e `theme:set`, campos `history.retentionDays` e `theme` do `config.json`), reconferido em 18/out/2026
no código ainda não commitado. Caminhos que começam por `src/`, `scripts/` ou `package.json` ficam dentro de `frontend/`;
o resto parte da raiz do repositório. **PLANEJADO (Fase N)** é o que só entra numa fase seguinte;
**PROPOSTA** é recomendação deste guia ou do SDD, ainda não aceita nem implementada. `PEND-NNN` e `RISK-NNN`
vêm dos registros do SDD ([Apêndice B](spec/spec-driven-development.md#apêndice-b--pendências) e
[§26](spec/spec-driven-development.md#26-riscos-e-mitigações)). O código diz o que existe; o SDD e a spec
dizem o que deve existir. Divergência entre este guia e o código é defeito e segue a regra do
[SDD §0.1](spec/spec-driven-development.md#01-política-de-prevalência-documental).

> **Estado atual — Fase 1 + janela principal + histórico.** A Fase 1 (MVP — ditado básico) está implementada em
> `frontend/` (T1–T8, 17/out/2026) e funciona de ponta a ponta no PC do Victor (V2). Em 18/out/2026 entrou no
> código, ainda não commitado, a spec `janela-principal`: uma segunda janela (Início, Histórico, Dicionário
> "em breve", Configurações) e a chave da Groq digitada em Configurações e guardada cifrada pelo `safeStorage`
> ([ADR-08](DECISIONS.md#adr-08--chave-da-groq-no-safestorage-do-electron-com-o-env-só-como-reserva-de-desenvolvimento));
> o `frontend/.env` passou a ser só reserva de desenvolvimento. No mesmo dia entraram a spec `historico` — o
> **texto** de cada ditado passa a ficar num SQLite local, em `%LOCALAPPDATA%`, sem áudio
> ([ADR-09](DECISIONS.md#adr-09--sqlite-local-pelo-nodesqlite-embutido-para-o-histórico-de-ditados)) — e o tema
> claro/escuro escolhido na janela. `npm test`: 326/326. Continua uso pessoal, em modo de desenvolvimento: sem
> instalador, sem servidor próprio, sem contas, com a chave do próprio usuário. Os controles descritos aqui são
> **FATO** salvo marcação; parte deles só é verificada pelos roteiros manuais, ainda pendentes: V1–V13 da spec
> `ditado-por-voz` (PEND-001), VJ1–VJ24 da spec `janela-principal` (PEND-007), VH1–VH13 da spec `historico` com o
> ensaio da `historico-dados-v1` (PEND-009) e VJ25–VJ27, do tema e dos controles (PEND-010).

---

## 1. O que protegemos

O Touch Speaker não guarda dado de ninguém além do próprio usuário, mas, enquanto roda, passa pelas mãos
dele o que de mais sensível existe numa máquina pessoal. Em ordem de gravidade:

| Dado / Ativo | Onde vive | Por que é crítico |
| --- | --- | --- |
| Voz do usuário | Só em memória: `MediaStream` e `Blob[]` no renderer da pílula (`src/renderer/pill.ts:155-157`), depois `ArrayBuffer` no main até o upload para a Groq | Dado pessoal; pode conter informação de terceiros |
| Texto ditado | Memória do main e, durante a colagem, o clipboard do Windows (`src/main/insert/inserter.ts:90`); depois de cada ditado que termina com texto, o banco local do histórico (linha abaixo) | Mensagens, e-mails, código, dados de clientes — e senhas, se ditadas num campo de senha (RISK-007) |
| Histórico de ditados | `%LOCALAPPDATA%\Touch Speaker\touch-speaker.db`, com `-wal` e `-shm` ao lado (`src/main/history/paths.ts:23-35`): o texto de cada ditado guardado, com horário, duração e resultado da inserção — nunca áudio, nunca o app em foco. Lido e escrito só pelo main; o texto aparece só nas telas Histórico e Início da janela principal (§11, §13) | Todos os ditados da retenção (padrão 30 dias) num arquivo só, **sem criptografia além da conta do Windows** na v1 (RISK-030) |
| Clipboard | Cópia de segurança em memória, pelo tempo de uma inserção (`src/main/insert/inserter.ts:30-44`) | Pode conter senhas, tokens, dados copiados de outros apps |
| Teclado | Hook global `uiohook-napi` no main (`src/main/keyboard.ts:11-19`) — inclusive enquanto a pessoa digita na janela principal | Um hook global é tecnicamente capaz de capturar tudo o que se digita |
| Chave da Groq (e da Anthropic na Fase 2) | Em memória só no main, no `CredentialStore` (`src/main/credentials.ts:50-137`), carregada do `groq-key.bin` ou, só com o app não empacotado, do `GROQ_API_KEY` de `frontend/.env` (`src/main/index.ts:59-65`, `:166-177`); usada só no header `Authorization` (`src/main/transcribe/groq.ts:66`). No renderer da janela principal, só entre a digitação e o "Salvar chave" | Uso indevido gera custo e bloqueio da conta |
| Arquivo da chave (`groq-key.bin`) | `%APPDATA%\Touch Speaker\groq-key.bin`: os bytes de `safeStorage.encryptString` (DPAPI do Windows), gravados de forma atômica (`src/main/credentials.ts:10`, `:95-114`) | Quem roda como o mesmo usuário do Windows consegue decifrá-lo (RISK-021) |

Regra prática: **o que entra pelo microfone, pelo teclado e pelo clipboard sai só para o lugar a que se
destina — a Groq (áudio) e o app em foco (texto) — e nunca para log, disco ou outro endereço. A chave da Groq
sai do main só no header `Authorization` para a Groq, e em disco só cifrada.** Toda mudança que toca gravação,
hook de teclado, inserção, chave, histórico, log ou rede é mudança de segurança.

**Exceção, desde a spec `historico` (18/out/2026):** o **texto** ditado — e só ele — também vai para o disco, mas
**só** para o banco local do histórico: nunca para o log, nunca para fora da máquina (sem rede nem
sincronização), nunca com o áudio. Na v1 o banco não tem criptografia além da proteção da conta do Windows —
decisão do Victor de 18/out/2026, aceita como RISK-030. A pessoa controla quanto fica (retenção, "Nunca
guardar") e apaga um ditado ou tudo (§11).

## 2. Superfícies e modelo de ameaça

Modelo de ameaça da Fase 1:

- **Uso pessoal, máquina do próprio usuário.** Não há servidor nem outros usuários.
- Há dois renderers — a pílula e a janela principal — e nenhum **carrega conteúdo remoto**: só arquivos locais
  do app (`src/main/pill-window.ts:55-57`, `src/main/main-window.ts:134`). Mesmo assim os dois são tratados como
  não confiáveis (defesa em profundidade, §7 e §14).
- Ameaças consideradas: dependência npm comprometida, vazamento de chave por commit, log ou resposta de IPC,
  texto sensível parando em log, input sintético indo para a janela errada, renderer da janela principal
  comprometido tentando ler a chave ou mandar payload forjado (RISK-026). Desde o histórico, também: o banco
  com o texto ditado lido por outro programa da mesma conta ou por quem lê o disco (RISK-030), o banco saindo da
  máquina com o perfil (RISK-031), texto apagado que continua legível no arquivo (RISK-034) e texto ditado com
  cara de HTML virando injeção na tela que o mostra (RISK-036).

| Superfície | Quem chama | Autenticação | Ameaça principal | Defesa hoje |
| --- | --- | --- | --- | --- |
| Microfone | Renderer da pílula (`getUserMedia`) | Permissão de mídia concedida pelo main | Microfone aberto fora de uma sessão de ditado | Permissão só para a pílula e só para áudio; trilhas paradas no fim (§5, §14) |
| Hook de teclado global | `uiohook-napi` no main | Nenhuma (é o próprio app) | Keylogging: guardar ou enviar o que se digita | Cada evento vira `hotkey`, `escape` ou `other` antes de sair do hook (§7) |
| Clipboard | `TextInserter` no main | Nenhuma | Conteúdo copiado pelo usuário vazar ou se perder | Cópia só em memória, restauração condicional, nada em log (§6) |
| `SendInput` (Ctrl+V sintético) | `TextInserter` → `user32` via `koffi` | Nenhuma | Texto na janela errada; tentativa de contornar UIPI | Cola na janela em foco no momento; app elevado → fallback, nunca elevação (§5, §6) |
| Rede (Groq) | `GroqTranscriber` no main | `Authorization: Bearer <chave em uso>` | Vazamento da chave ou do áudio | Única saída de rede, TLS, chave só no main (§3, §4) |
| IPC vindo da pílula | Renderer da pílula, via preload `window.touchSpeaker` | Remetente conferido (`event.sender`) | Renderer comprometido mandando payload forjado | Preload mínimo; main valida remetente, tipos, tamanho e `sessionId` (§7) |
| Renderer da janela principal | A pessoa, pela bandeja ou abrindo o app de novo; sozinha só na primeira execução sem chave salva | Nenhuma (é o próprio app) | Segredo digitado (a chave) exposto; renderer comprometido chegando a Node, à rede ou ao microfone | `contextIsolation`, `sandbox`, sem Node, CSP sem rede, sem permissão de mídia, nada guardado no navegador, campo da chave limpo depois de toda resposta (§9, §14) |
| IPC vindo da janela principal | Renderer da janela, via preload `window.touchSpeakerApp` — inclusive `history:*` (lista, cópia, exclusão, limpeza, retenção, uso) e `theme:set` | Remetente conferido: `webContents` da janela aberta agora, quadro principal, `index.html` do app | Payload forjado trocando a chave, as preferências, a retenção ou o tema, apagando o histórico ou lendo o texto dos ditados; tentativa de ler a chave ou de usar canal da pílula | A chave nunca volta ao renderer; formato exato de cada payload; `history:clear` só com `confirmed: true`; preloads separados — a pílula não tem nenhum `history:*`; recusa sem tocar banco, clipboard nem `config.json`; `ipc_rejected` no log (§7) |
| Banco do histórico (`touch-speaker.db`, `-wal`, `-shm`) | Só o main, pelo `node:sqlite` (`src/main/history/store.ts`) | Permissões do Windows na pasta local do usuário (`%LOCALAPPDATA%`) | Texto ditado lido por outro processo da mesma conta, por backup do perfil ou por quem lê o disco sem BitLocker; o arquivo sair da máquina com perfil móvel; texto apagado que continua no arquivo | Pasta Local, nunca a Roaming — sem `LOCALAPPDATA`, histórico indisponível; sem rede; retenção (padrão 30 dias) e "Nunca guardar"; `secure_delete` + checkpoint ao apagar, `VACUUM` no "Apagar tudo"; **sem criptografia na v1** (§11; RISK-030, RISK-031, RISK-034) |
| `groq-key.bin` | Main, via `safeStorage` | DPAPI do usuário do Windows | Outro processo da mesma conta decifrar; arquivo que deixa de decifrar | Nunca texto puro; estado `unreadable` visível; chave revogável no console da Groq (§3, §10; RISK-021, RISK-022) |
| Item de login do sistema ("Iniciar com o Windows") | Main, por `app.setLoginItemSettings` | Permissões do usuário (chave `Run` do usuário no Windows) | Registrar o `electron.exe` sem o app quando roda por `npm run dev` | Só com o app empacotado; sem empacotar, `login-item:set` responde `unavailable` sem tocar no sistema (§5; RISK-029) |
| `config.json` | Usuário editando o arquivo; main lendo e, desde a janela principal, regravando campo a campo: os sete de Configurações, `history.retentionDays` ("Guardar histórico") e `theme` (botão de tema) | Permissões do Windows na pasta do usuário | Arquivo inválido derrubar o app; uma tela apagar campos que não são dela; escrita pela metade | Campo inválido cai no default com aviso no log (BR-012); fila única `ConfigWriter`: cada gravação relê o arquivo, troca só os próprios campos e grava atômico; nunca sobrescreve um arquivo que não é objeto JSON (§10; RISK-037) |
| `frontend/.env` | Desenvolvedor | Permissões do Windows | Chave commitada ou enviada por upload | `.gitignore`; só lido com o app não empacotado, e só usado quando não existe `groq-key.bin` (§10) |

O Touch Speaker não expõe porta, rota nem webhook (§4). Detalhe da integração com a Groq em
[`INTEGRATION.md`](INTEGRATION.md).

## 3. Autenticação e chave da Groq

### Usuário

**Não há login de usuário até a Fase 4** (FR-ACC-01, PLANEJADO). Na Fase 1 o app é de uma pessoa só, na
própria máquina; quem abre o Windows usa o app.

### Chave da Groq

A regra é a [ADR-08](DECISIONS.md#adr-08--chave-da-groq-no-safestorage-do-electron-com-o-env-só-como-reserva-de-desenvolvimento)
(BR-016): a chave é digitada pela pessoa em Configurações, guardada cifrada pelo `safeStorage` do Electron
(DPAPI no Windows) e vive em memória só no processo main, no `CredentialStore` (`src/main/credentials.ts`).

- **Ordem na abertura**, depois do `ready` do app (o `safeStorage` só funciona a partir dele):
  `groq-key.bin` decifrado (estado `stored`); senão, **só com o app não empacotado**, o `GROQ_API_KEY` de
  `frontend/.env` (estado `env`); senão, nenhuma (`none`) (`src/main/credentials.ts:68-83`,
  `src/main/index.ts:164-177`). O `.env` só é lido com `!app.isPackaged` (`src/main/index.ts:57-65`); no app
  empacotado ele nem é aberto.
- **Arquivo que não decifra** — cifra indisponível na abertura, `decryptString` que falha ou conteúdo fora do
  formato — vira o estado `unreadable`: o app abre normalmente, **nenhuma chave fica em uso** (o `.env` não
  substitui) e o log grava `groq_key_unreadable` com o `reason` (`src/main/credentials.ts:73-82`, `:132-136`,
  `src/main/index.ts:177`). O Início e Configurações mostram "A chave salva não pôde ser lida — salve de novo".
- **Salvar** (`groq-key:set`): o main confere o formato — apara as pontas; 1 a 512 caracteres; sem espaço nem
  caractere de controle no meio (`src/main/credentials.ts:43-48`) —, confere se a cifra está disponível
  (`safeStorage.isEncryptionAvailable()`; senão `encryption_unavailable` e nada é gravado), cifra com
  `safeStorage.encryptString` (se lançar, `write_failed`) e grava `groq-key.bin.tmp` + renomear
  (`src/main/credentials.ts:95-114`, `src/main/atomic-file.ts:26-39`). **Nunca** grava a chave em texto puro
  como alternativa (FR-UI-20). Salvar não testa a chave na Groq: uma chave errada aparece no primeiro ditado como
  `invalid_api_key` (D5 da spec).
- **Remover** (`groq-key:remove`, com confirmação na própria tela): apaga o `groq-key.bin`; passa a valer o
  `.env` (só em desenvolvimento) ou nenhuma (`src/main/credentials.ts:117-125`).
- **Sem reiniciar:** o `GroqTranscriber` lê a chave por `getApiKey` a cada chamada
  (`src/main/transcribe/groq.ts:49-51`, `src/main/index.ts:179`); salvar ou remover atualiza a bandeja e o Início
  na hora (`src/main/index.ts:297-300`).
- **Só no main:** a chave sai do processo só no header `Authorization` para `api.groq.com`
  (`src/main/transcribe/groq.ts:64-69`). Vai do renderer ao main **uma vez**, ao salvar
  (`src/preload/main-window.ts:31`), e nunca volta, nem em parte: nenhum tipo de resposta de IPC tem campo para
  ela (`src/shared/ipc.ts:152-154`) e o renderer recebe só o estado (`stored`, `env`, `none`, `unreadable`). O
  campo da tela é limpo depois de toda resposta, sucesso ou erro (`src/renderer/main-window/main-window.ts:200-205`).
  Nunca vai para o log nem para o `config.json`; o `app_ready` registra só o booleano `has_api_key` e o estado
  `groq_key` (`src/main/index.ts:437-445`).
- **Sem chave**, a sessão nem começa: a pílula mostra "Falta a chave da Groq — abra o Touch Speaker pela bandeja"
  (`src/main/strings.ts:126`) e o log grava `session_rejected` com o código (`src/main/session.ts:94-98`,
  BR-013). Groq respondendo 401 ou 403 vira `invalid_api_key` (`src/main/transcribe/groq.ts:28`).
- **Limites aceitos:** a DPAPI protege por **usuário do Windows**, não por app — outro processo rodando na mesma
  conta consegue decifrar o `groq-key.bin` (RISK-021); e o arquivo não sobrevive a troca de máquina, de perfil do
  Windows ou à perda do dado de cifra do Chromium na pasta de dados — a pessoa salva a chave de novo (RISK-022).
- Onde a chave vive em cada fase: tabela do §10.
- **Chave vazou?** Revogar no console da Groq na hora, gerar outra e salvá-la em Configurações (§17).

### MFA

Não se aplica na Fase 1: não há conta de usuário. A conta da Groq é do próprio usuário e segue as regras do
console da Groq.

## 4. Rotas públicas e rede

**O app não expõe rota nem porta**: não há servidor local, nada escuta conexão. A única saída de rede na
Fase 1 é esta, a partir do processo main:

| Destino | O que vai | Onde |
| --- | --- | --- |
| `POST https://api.groq.com/openai/v1/audio/transcriptions` | Áudio da gravação (`audio.webm`) + `model`, `language`, `temperature`, `response_format`; header `Authorization` | `src/main/transcribe/groq.ts:6`, `:54-69` |

- TLS obrigatório; sem desligar verificação de certificado em nenhum ambiente.
- **Sem telemetria** na Fase 1. Se um dia houver, será opt-in e sem conteúdo ditado.
- A janela principal não trouxe saída de rede nova: salvar a chave não chama a Groq (D5 da spec
  `janela-principal`), e muda só de onde o main tira a chave.
- Nenhum renderer fala com a rede: a CSP da pílula e a da janela principal têm `connect-src 'none'`
  (`src/renderer/pill.html:7`, `src/renderer/main-window/index.html:7`, §9).

**Regras**

- Saída de rede nova (outro provedor, outro host) exige ADR em [`DECISIONS.md`](DECISIONS.md) e entra nesta
  tabela no mesmo PR. A Anthropic (Fase 2) e o backend próprio (Fase 4) são **PLANEJADO**
  ([`INTEGRATION.md`](INTEGRATION.md#integrações-planejadas)).
- Chamada de rede só no main; os dois renderers continuam com `connect-src 'none'`.

## 5. Autorização e permissões

Não há papéis de usuário. A pergunta de toda mudança aqui é "**este processo precisa desta capacidade?**".

| Ferramenta | Uso | Onde |
| --- | --- | --- |
| `session.setPermissionRequestHandler` | Concede `media` **só** à janela da pílula e **só** para áudio; qualquer outro pedido — inclusive da janela principal — é negado | `src/main/index.ts:147-151` |
| `session.setPermissionCheckHandler` | Responde "sim" só para `media` vindo da pílula | `src/main/index.ts:152` |
| `fromPill` | IPC dos canais da pílula só é aceito se o remetente for a pílula | `src/main/index.ts:249` |
| `MainWindow.isSender` | IPC dos canais da janela principal só é aceito do `webContents` da janela aberta agora, do quadro principal, com o `index.html` do app (§7) | `src/main/main-window.ts:53-57`, `src/main/main-window-ipc.ts:114-129`, `src/main/index.ts:292-296`, `:406` |
| `LoginItem` (`app.isPackaged`) | O item de login do sistema só é lido e gravado com o app empacotado; sem empacotar, `login-item:set` responde `unavailable` sem tocar no registro (RISK-029) | `src/main/login-item.ts:28-30`, `:43-44` |
| `isSelfElevated` | Descobre, ao iniciar, se o próprio Touch Speaker roda como administrador | `src/main/insert/win32.ts:99-101`, `src/main/index.ts:156-162` |
| `isForegroundWindowElevated` | Antes de colar, confere se a janela em foco pertence a processo elevado; token ilegível conta como elevado | `src/main/insert/win32.ts:103-120` |

**UIPI (apps rodando como administrador).** O Windows descarta input sintético de processo comum para
janela de processo elevado. O app **não** pede elevação para contornar isso: quando a janela em foco é
elevada e o Touch Speaker não é, o texto vai só para o clipboard e a pílula avisa "Texto copiado — cole com
Ctrl+V" (`paste_blocked`; `src/main/insert/inserter.ts:77-80`, FR-DICT-10, BR-009). Se o próprio Touch
Speaker já estiver elevado, a checagem é pulada, porque a UIPI não o bloqueia.

**Regras**

- **Nunca** pedir elevação de administrador para contornar a UIPI (guardrail do [`CLAUDE.md`](../CLAUDE.md)).
- Permissão nova (câmera, notificações, tela) para qualquer janela é decisão registrada em ADR; o padrão é
  negar.
- Janela nova não herda a permissão de mídia: o handler compara `contents === pill.webContents`. A janela
  principal é o caso concreto — não tem permissão de mídia (`src/main/main-window.ts:4-5`,
  `src/main/index.ts:147-152`) e a CSP dela tem `media-src 'none'`; um `getUserMedia` dela é negado (VJ16,
  pendente — PEND-007).

## 6. Integridade do ditado e do clipboard

O que garante que o texto certo chega ao lugar certo, uma vez, e que o clipboard do usuário volta ao que era.

### Nunca digitar lixo (C3)

- Gravação com menos de 500 ms (`MIN_AUDIO_MS`) é descartada antes do upload
  (`src/main/session.ts:181-184`, `src/main/transcribe/filters.ts:5`, BR-005).
- Transcrição descartada quando o texto vem vazio, quando todos os segmentos têm `no_speech_prob ≥ 0,6`, ou
  quando é uma alucinação conhecida do Whisper com áudio < 3 s ou média de `no_speech_prob ≥ 0,3`
  (`src/main/transcribe/filters.ts:41-54`, BR-006). O descarte é silencioso: nada é inserido nem mostrado.
- Uma sessão por vez: todo evento carrega `sessionId` (UUID do main, `src/main/session.ts:101`) e o main
  descarta o que não é da sessão atual (`src/main/session.ts:164`, `:169`, `:177`; BR-014).

### Inserção na janela em foco

- O Ctrl+V sintético vai para a janela que está em foco **no momento da inserção**. Se a pessoa trocou de
  janela durante a transcrição, o texto vai para a nova janela. Aceito na Fase 1 (é o comportamento
  esperado de "digitar onde está o cursor"; RISK-006).
- A janela principal é uma dessas janelas: ditar com ela em foco cola o texto no campo dela — até no da chave,
  se for ele o campo em foco (RISK-024, aceito como o RISK-006). A pessoa vê o campo, e nada é salvo sem uma ação
  dela.
- A inserção espera a tecla física de ditado estar solta, por até 2 s (`src/main/insert/inserter.ts:75`);
  durante o Ctrl+V sintético o hook ignora eventos (`inserting`, `src/main/hotkey.ts:51`; BR-008).
- O Ctrl+V é um lote único de quatro eventos por `SendInput` (`src/main/insert/win32.ts:69-78`). Se o
  Windows não aceitar os quatro, o texto fica no clipboard para um Ctrl+V manual
  (`src/main/insert/inserter.ts:93`).
- Campos de senha não são detectados na Fase 1. Ditar num campo de senha equivale a digitar nele; nada
  extra vaza. A Fase 3 (UI Automation) passa a pular campos `IsPassword` (PLANEJADO, RISK-007).

### Clipboard

- Backup e restauração ficam **em memória**, pelo menor tempo possível: a cópia é tirada antes de escrever o
  texto e devolvida 250 ms depois da colagem (`src/main/insert/inserter.ts:18-21`, `:85-105`).
- A restauração só acontece **se o clipboard ainda contiver o texto ditado**: se a pessoa copiou outra coisa
  nesse meio tempo, a cópia nova é preservada (`src/main/insert/inserter.ts:99-102`, BR-010).
- Se o backup falhar (clipboard ocupado), o texto é inserido do mesmo jeito, só sem restauração
  (`src/main/insert/inserter.ts:85-89`). Se a restauração falhar, a falha é engolida em silêncio e nada vai
  para o log (`src/main/insert/inserter.ts:100-103`).
- Conteúdo do clipboard **nunca** vai para log, disco ou rede.
- Limitação aceita (RISK-008): gerenciadores de histórico do clipboard (Win + V) registram o texto ditado.
  Deve constar do aviso ao usuário.

**Regras**

- Mudança na inserção mantém a restauração condicional e a cópia só em memória.
- Nada do texto ditado nem do clipboard em log, nem em mensagem de erro, nem em campo de diagnóstico.
- Filtro anti-lixo novo vem com caso em `src/test/filters.test.ts` (TEST-002).

## 7. Entrada: teclado global e IPC

### Teclado global

- O hook reduz cada evento a três tipos — a tecla configurada (`hotkey`), o `Esc` (`escape`) e "outra
  tecla" (`other`) — **ali mesmo**, antes de chamar qualquer outra coisa (`src/main/keyboard.ts:14-18`,
  BR-007). O código da tecla não sai de `keyboard.ts`. Vale também enquanto a pessoa digita na janela principal
  (inclusive a chave): o hook não distingue o que se digita ali.
- O módulo nativo é carregado dentro de `startKeyboardHook` (`src/main/keyboard.ts:11-13`): binário ausente ou
  quebrado cai no `try` do main, que registra `keyboard_hook_unavailable` e abre o app sem a tecla
  (`src/main/index.ts:264-270`); o Início da janela mostra "A tecla de ditado não está funcionando — reinicie o
  app".
- O `HotkeyController` só conhece esses três tipos (`src/main/hotkey.ts:5`). O estado guardado é só: tecla
  de ditado pressionada (`down`), quando foi pressionada (`downAt`), quando chegou o último keydown dela
  (`lastDownEventAt`) e se a sessão começou neste aperto (`startedByThisPress`) (`src/main/hotkey.ts:36-39`).
  "Outra tecla" nunca é guardada: se chega com a tecla de ditado ainda pressionada e até 1 s depois dela
  (`shortcutWindowMs`), cancela a sessão na hora, porque era um atalho (Ctrl direito + C), não ditado
  (`src/main/hotkey.ts:80-88`, BR-003).
- Proibido: guardar, logar, enviar ou acumular teclas ou seus códigos.
- O hook é encerrado (`uIOhook.stop()`) ao sair do app (`src/main/keyboard.ts:21-27`,
  `src/main/index.ts:273-281`, `:431-435`) — inclusive por "Reiniciar agora", que segue o mesmo caminho do "Sair"
  (`src/main/index.ts:405-413`).
- Na janela principal, o `F12` que abre o DevTools só existe com o app não empacotado e é um evento de entrada
  da própria janela (`before-input-event`), não do hook global: só essa tecla é olhada e nada vai para o log
  (`src/main/main-window.ts:116-122`).
- Code review rejeita qualquer mudança que identifique teclas além da configurada e do `Esc`.

### IPC vindo da pílula

O renderer é tratado como não confiável. O main confere tudo o que chega da pílula
(`src/main/index.ts:76-107`, `:249-262`):

| Canal | O que o main exige | Se falhar |
| --- | --- | --- |
| `recorder:started` | Remetente = pílula; `sessionId` string; `startedAt` número | Ignorado |
| `recorder:result` | Remetente = pílula; `sessionId` string; `mimeType` começando por `audio/`; `durationMs` finito ≥ 0; áudio `ArrayBuffer` (ou view) de até 25 MB | Ignorado, com `ipc_rejected` no log (`src/main/index.ts:257`) |
| `recorder:error` | Remetente = pílula; `sessionId` string; `code` ∈ `mic_denied`, `mic_unavailable`, `recorder_failed` | Ignorado; o campo `detail` é descartado |

- Depois da validação, o `SessionController` ainda descarta o que não é da sessão atual (§6).
- O preload expõe **só** `window.touchSpeaker`, com sete funções, e nunca um `ipcRenderer` genérico
  (`src/preload/pill.ts:22-30`; contrato em [`API.md`](API.md#api-do-preload-windowtouchspeaker)).

### IPC vindo da janela principal

O renderer da janela também é tratado como não confiável, e é ele que recebe a chave digitada (RISK-026) e o
texto dos ditados guardados (RISK-036). Os handlers são registrados uma vez, na abertura do app
(`src/main/index.ts:283-413`), e toda mensagem — inclusive as `history:*` (FR-HIST-19) e a `theme:set` — passa por
duas conferências (FR-UI-33):

1. **Remetente** (`src/main/main-window.ts:53-57`, `src/main/main-window-ipc.ts:77-129`): `event.sender` tem de
   ser o `webContents` da janela principal **aberta agora** — lido a cada mensagem, porque a janela é recriada a
   cada abertura —; `event.senderFrame` tem de existir e ser o quadro principal (sem `parent`); a URL dele tem de
   ser `file:`, sem query nem host, com o caminho do `dist/renderer/main-window/index.html` do app (comparação sem
   diferenciar maiúsculas no Windows; o hash `#settings` da primeira execução é aceito). Janela fechada → tudo
   recusado.
2. **Payload exato** (`src/main/main-window-ipc.ts:13-75`; histórico em `src/main/history/ipc.ts:48-99`): canal
   sem payload aceita **nenhum** argumento; canal com payload aceita um argumento só, um objeto simples (protótipo
   `Object` ou `null`, não array) com **exatamente** as chaves do contrato — exceto o `history:list`, cujas três
   chaves são opcionais: qualquer subconjunto delas, e nada além.

| Canal | O que o main exige | Se falhar |
| --- | --- | --- |
| `app:get-strings`, `app:get-status`, `settings:get`, `groq-key:remove`, `history:get-retention`, `history:stats` (`invoke`) | Remetente; nenhum argumento | `ipc_rejected` no log e o `invoke` rejeita |
| `settings:save` (`invoke`) | Remetente; exatamente as 7 chaves de Configurações; `hotkey`, `language`, `model` e `pillPosition` strings de até 64 caracteres; `holdThresholdMs` e `maxRecordingMs` números; `sounds` booleano | `ipc_rejected` e o `invoke` rejeita — inclusive qualquer tentativa de mandar a retenção do histórico por aqui. Valor fora da faixa → resposta `invalid_field` e nada gravado (log `settings_rejected`) |
| `groq-key:set` (`invoke`) | Remetente; só `key`, string; depois, o formato do §3 | `ipc_rejected` e o `invoke` rejeita; formato → resposta `invalid_format` (log `groq_key_rejected`, nunca a chave) |
| `login-item:set` (`invoke`) | Remetente; só `enabled`, booleano | `ipc_rejected` e o `invoke` rejeita; app não empacotado → resposta `unavailable`, sem tocar no sistema |
| `app:relaunch` (`send`) | Remetente; nenhum argumento | `ipc_rejected`; mensagem ignorada (`src/main/index.ts:405-409`) |
| `theme:set` (`invoke`) | Remetente; só `theme`, um de `system`, `light`, `dark` (`asThemeInput`, `src/main/main-window-ipc.ts:63-68`) | `ipc_rejected` e o `invoke` rejeita, sem tocar no `config.json`; falha ao gravar → resposta `write_failed` com o tema em uso |
| `history:list` (`invoke`) | Remetente; só `query`, `cursor` e `limit`, todos opcionais; `query` string de até 200 caracteres depois do `trim`; `cursor` string de até 128, no formato que o próprio main gera (`<createdAt ISO>~<UUID v4>`); `limit` inteiro de 1 a 100 (`src/main/history/ipc.ts:52-78`) | `ipc_rejected` e o `invoke` rejeita, sem tocar no banco. O termo de busca nunca vai para o log |
| `history:copy`, `history:delete` (`invoke`) | Remetente; só `id`, UUID v4 (`src/main/history/ipc.ts:80-85`) | `ipc_rejected` e o `invoke` rejeita, sem tocar no banco nem no clipboard. Entrada que não existe → resposta `not_found`, clipboard intacto |
| `history:clear` (`invoke`) | Remetente; só `confirmed`, exatamente `true` — segunda trava, além da confirmação em dois passos na tela (`src/main/history/ipc.ts:87-91`) | `ipc_rejected` e o `invoke` rejeita; nada é apagado |
| `history:set-retention` (`invoke`) | Remetente; só `retentionDays`, inteiro de 0 a 3650 ou `null` (`src/main/history/ipc.ts:93-99`) | `ipc_rejected` e o `invoke` rejeita, sem tocar no `config.json` nem no banco; falha ao gravar → resposta `write_failed` e a retenção em uso continua |

- A recusa registra `ipc_rejected` só com o `channel` e lança um erro genérico, sem dado do payload
  (`src/main/index.ts:288-291`): a promessa do `invoke` é rejeitada e nada toca o banco, o clipboard nem o
  `config.json`.
- Só o main escreve no clipboard pelo histórico ("Copiar"), e só por ação explícita da pessoa — sem Ctrl+V
  sintético; o texto escrito também passa pelo histórico do clipboard do Windows, se ligado (RISK-008).
- O preload da janela expõe **só** `window.touchSpeakerApp`, com dez funções e o objeto `history`, com mais oito,
  e nunca um `ipcRenderer` genérico (`src/preload/main-window.ts:30-60`; contrato em
  [`API.md`](API.md#api-do-preload-windowtouchspeakerapp)). Ele não expõe `recorder:*` nem `pill:state`, e o da
  pílula não expõe nada da janela — nem `history:*`; o TEST-009 confere os nomes de canal dos dois preloads contra
  `src/shared/ipc.ts`, inclusive os `history:*` e o `theme:set` (`src/test/main-window-ipc.test.ts:206-212`).
- Os canais da pílula continuam aceitando só a pílula (`fromPill`), e os da janela, só a janela.

**Regras**

- Canal IPC novo entra no trio do renderer a que pertence, ao mesmo tempo: pílula (`src/shared/ipc.ts`,
  `src/preload/pill.ts`, `src/renderer/global.d.ts`) ou janela principal (`src/shared/ipc.ts`,
  `src/preload/main-window.ts`, `src/renderer/main-window/global.d.ts`), com validação no main e contrato em
  [`API.md`](API.md#contratos) antes do código. Cada contrato fica escrito em três lugares, e agora são dois
  conjuntos para manter em dia (RISK-027).
- Canal novo da janela passa por `MainWindow.isSender` e confere o formato exato do payload; resposta nova nunca
  ganha campo para a chave.
- Validação de payload vive no main, nunca no renderer.

## 8. Rate limit e abuso

- **Limites da Groq** (plano gratuito): 20 requisições/min, 2.000/dia, 7.200 s de áudio/hora, 28.800 s/dia,
  cobrança mínima de 10 s por requisição, por organização — números de terceiros, a confirmar no console
  (PEND-004; detalhe em [`API.md`](API.md#rate-limit)).
- **Limites locais:** áudio de até 25 MB, conferido no main (`src/main/index.ts:48`, `:99`) e de novo antes do
  upload (`src/main/transcribe/groq.ts:7`, `:52`); gravação de até 5 min (`maxRecordingMs`, BR-011); uma
  sessão por vez (BR-014); uma requisição por ditado.
- **Sem nova tentativa em 429:** a resposta vira `rate_limited` e a pílula avisa. Só 5xx ganha **uma** nova
  tentativa, após 500 ms (`src/main/transcribe/groq.ts:85-89`).
- Não há como um terceiro abusar do app pela rede: ele não escuta porta (§4).

## 9. Cabeçalhos, transporte e endurecimento do Electron

Obrigatório para toda janela (hoje são duas: a pílula e a janela principal):

- [x] `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true` — pílula
      (`src/main/pill-window.ts:40-43`) e janela principal (`src/main/main-window.ts:90-98`)
- [x] Preload próprio de cada janela, que expõe só a API listada em [`API.md`](API.md#contratos): pílula
      (`window.touchSpeaker`, `src/preload/pill.ts:22-30`) e janela principal (`window.touchSpeakerApp`,
      `src/preload/main-window.ts:21-35`); nenhum expõe `ipcRenderer` genérico nem os canais do outro
- [x] CSP real da pílula: `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none';
      img-src 'self' data:; media-src 'self' blob: mediastream:` (`src/renderer/pill.html:5-8`) — intacta
- [x] CSP real da janela principal, sem `'unsafe-inline'`: `default-src 'none'; script-src 'self';
      style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'none'; media-src 'none';
      object-src 'none'; base-uri 'none'; form-action 'none'` (`src/renderer/main-window/index.html:5-8`),
      conferida pelo `src/test/tokens.test.ts` (TEST-005)
- [x] `setWindowOpenHandler(() => ({ action: 'deny' }))` e navegação bloqueada (`will-navigate`) em todo
      `webContents` criado, inclusive o da janela principal (`src/main/index.ts:130-134`)
- [x] Main valida remetente, tipo, tamanho e `sessionId` de toda mensagem IPC vinda da pílula, e remetente e
      formato exato de toda mensagem vinda da janela principal (§7)
- [x] Nenhum `remote`, nenhum `shell.openExternal` com URL vinda do renderer. O único `shell` em uso é o
      `openPath` da pasta de configuração, com caminho fixo do main (`src/main/tray.ts:64`)
- [x] Janela principal sem permissão de mídia (§5) e sem menu (`src/main/main-window.ts:100`)

Outros pontos:

- DevTools só fora do app empacotado (`devTools: !app.isPackaged`; `src/main/index.ts:136`, `:181`,
  `src/main/pill-window.ts:47`, `src/main/main-window.ts:97`). Como a janela principal não tem menu, o DevTools
  dela abre pelo `F12`, também só sem empacotar (`src/main/main-window.ts:116-122`). Sem menu de aplicação
  (`src/main/index.ts:112`, `src/main/pill-window.ts:52`, `src/main/main-window.ts:100`).
- Renderer da janela principal que cai → log `main_window_renderer_gone` e janela destruída; o ditado não é
  afetado (`src/main/main-window.ts:123-126`).
- Uma instância por vez (`requestSingleInstanceLock`, `src/main/index.ts:67-74`); a segunda sai e a primeira
  mostra a janela principal, registrando `second_instance_focus` (`src/main/index.ts:424-427`).
- **Transporte:** a única conexão é HTTPS para `api.groq.com` (§4).
- `ELECTRON_RUN_AS_NODE`: o host de extensões do VS Code exporta essa variável, que faz o `electron.exe`
  rodar como Node puro; `scripts/start.mjs` a remove. Desligar `RunAsNode` de vez é dos Electron Fuses
  (PLANEJADO, Fase 4, §15.1).

## 10. Segredos e configuração

| Contexto | Onde fica a chave | Regra | Estado |
| --- | --- | --- | --- |
| Uso pessoal (app empacotado ou não) | `%APPDATA%\Touch Speaker\groq-key.bin`, cifrado pelo `safeStorage` do Electron (DPAPI do Windows); a chave é digitada em Configurações | Nunca texto puro; `safeStorage` indisponível → o app recusa salvar (`encryption_unavailable`) e não grava nada; a chave nunca volta ao renderer (§3; ADR-08, BR-016) | **FATO** (spec `janela-principal`, 18/out/2026, não commitado) |
| Desenvolvimento (app não empacotado) | `frontend/.env` (`GROQ_API_KEY`), só como reserva: vale quando não existe `groq-key.bin` | No `.gitignore`. Nunca commitar. Nunca no renderer. O app empacotado nem lê o `.env` (`src/main/index.ts:57-65`) | **FATO** |
| Produto distribuído (Fase 4) | Só no `backend/`; o app autentica o usuário e o backend chama os provedores | **Nenhuma chave de provedor dentro de app distribuído** | **PLANEJADO (Fase 4)** |

- **Não distribuir** o app com a chave de alguém embutida. Quem distribuir antes da Fase 4 entrega a própria
  conta da Groq a qualquer pessoa que abrir o `.asar` (ADR-06). A ADR-08 não muda isso: a chave do
  `groq-key.bin` é do próprio usuário, digitada por ele.
- **A DPAPI protege por usuário do Windows, não por app** (RISK-021, aceito): outro processo que rode na mesma
  conta consegue decifrar o `groq-key.bin`. É melhor que o texto puro do `.env` (RISK-009) e é o mesmo modelo de
  qualquer app pessoal; a chave é revogável no console da Groq.
- **O `groq-key.bin` não sobrevive** a troca de máquina, de perfil do Windows ou à perda do dado de cifra do
  Chromium na pasta de dados (RISK-022): o estado vira `unreadable`, a tela diz "A chave salva não pôde ser lida —
  salve de novo" e a pessoa salva a chave outra vez em Configurações.
- **Rollback:** uma versão anterior do app ignora o `groq-key.bin` e volta ao `.env`; o arquivo fica órfão na
  pasta de dados e pode ser apagado à mão.
- O `.gitignore` bloqueia `.env` e `.env.*`, liberando só o `.env.example` (`.gitignore:11-13`). O
  `frontend/.env.example` traz só o nome da variável, com valor vazio.
- O `config.json` (`%APPDATA%\Touch Speaker\config.json`) guarda só preferências — tecla, tempos, idioma,
  modelo, microfone, posição da pílula, sons e, desde 18/out/2026, a retenção do histórico
  (`history.retentionDays`) e o tema (`theme`) — e nenhum segredo nem texto ditado (`src/main/config.ts:11-31`).
  Campo inválido cai no default com `config_invalid_field` no log (`field: "history"` e `field: "theme"` para os
  dois novos); JSON inválido vira config padrão inteira; o app nunca deixa de abrir por causa dele
  (`src/main/config.ts:62-118`, `:141-155`, BR-012). Os dois campos novos são aditivos: o `version` continua `1`.
- Desde a janela principal, o main também **grava** o `config.json` — sempre **campo a campo**, pela fila única
  `ConfigWriter` (`src/main/config.ts:187-222`): cada gravação espera a anterior, relê o arquivo, troca só os
  próprios campos e grava de forma atômica (temporário + renomeação); um `config.json` ausente é recriado com os
  padrões. São três escritores, e nenhum apaga o campo do outro:
  - "Salvar preferências" (`settings:save`): valida os sete campos de Configurações com o mesmo `normalizeConfig`
    (campo inválido → nada gravado) e troca só esses sete, preservando `version`, `transcription.provider`,
    `microphoneDeviceId`, `history.retentionDays`, `theme` e campos desconhecidos (`mergeSettings`,
    `src/main/settings.ts:81-99`);
  - "Guardar histórico" (`history:set-retention`): troca só `history.retentionDays` — as outras chaves de `history`
    ficam (`withRetention`, `src/main/config.ts:120-128`);
  - o botão de tema e "Seguir o sistema" (`theme:set`): troca só `theme` (`withTheme`, `src/main/config.ts:130-133`).

  Um `config.json` que não é objeto JSON **nunca é sobrescrito**: a tela recebe `write_failed` (log
  `settings_write_failed`, `config_write_failed` ou `theme_write_failed`, só com o nome do erro). Uma edição manual
  feita com a janela aberta perde os campos conhecidos no próximo "Salvar preferências" (RISK-025); a retenção e o
  tema, que trocam um campo só, preservam o resto da edição (RISK-037).
- **Vazou um segredo?** Revogue a chave no console da Groq primeiro; limpar o histórico vem depois. Remover o
  arquivo num commit novo não apaga o valor do histórico.

## 11. Dados em disco

| Dado | Onde | Regra |
| --- | --- | --- |
| Áudio | **Nunca em disco.** Memória do renderer e do main até o upload; descartado depois | Guardrail do [`CLAUDE.md`](../CLAUDE.md) e NFR-04 |
| Texto ditado | Só no banco do histórico (linha "Histórico de ditados") e, durante a colagem, no clipboard do Windows | A exceção do §1: nunca no log, nunca fora da máquina; "Nunca guardar" desliga a gravação |
| `config.json` | `%APPDATA%\Touch Speaker\config.json`, criado com defaults no primeiro uso — já com `"history": { "retentionDays": 30 }` e `"theme": "system"` (`src/main/config.ts:35-47`, `:141-155`) — e regravado campo a campo pelas telas (§10) | Só preferências; nenhum segredo nem texto ditado; gravação atômica pela fila única, cada tela só com os próprios campos (§10) |
| Chave da Groq cifrada | `%APPDATA%\Touch Speaker\groq-key.bin`, gravado como `groq-key.bin.tmp` e renomeado (`src/main/credentials.ts:95-114`, `src/main/atomic-file.ts:26-39`) | Só os bytes do `safeStorage`; nunca a chave em texto puro; apagado por "Remover chave" (§3, §10) |
| Log | `%APPDATA%\Touch Speaker\logs\main.log`, rotação 5 MB × 3 arquivos (`src/main/logger.ts:9-10`) | Só metadados (§12) |
| `.env` | `frontend/.env` (só em desenvolvimento; o app empacotado não o lê) | Fora do git (§10) |
| Item de login | Registro do Windows (chave `Run` do usuário), escrito por `app.setLoginItemSettings` — estado do sistema, não do app | Só com o app empacotado (`src/main/login-item.ts:43-44`; RISK-029) |
| Histórico de ditados | SQLite local `%LOCALAPPDATA%\Touch Speaker\touch-speaker.db`, com `touch-speaker.db-wal` e `touch-speaker.db-shm` ao lado — a pasta **Local**, que não acompanha perfil móvel; sem a variável `LOCALAPPDATA`, o histórico fica indisponível e nunca cai na Roaming (`src/main/history/paths.ts:23-35`). Criado pela migration `database/local/0001_init.sql` na primeira abertura. O `config.json` e os logs continuam em `%APPDATA%\Touch Speaker\` | Só o texto, o horário UTC, a duração e o resultado da inserção — nunca áudio, nome do app, executável nem título de janela. **Sem criptografia na v1** além da proteção da conta do Windows (decisão do Victor, RISK-030). `journal_mode=WAL` e `secure_delete=ON` (`src/main/history/store.ts:222-223`). Retenção `history.retentionDays` — padrão 30 dias, `0` = nunca guardar, `null` = para sempre —, com purga ao abrir, a cada gravação e ao mudar a retenção. Apagar um = `DELETE` + `wal_checkpoint(TRUNCATE)`; "Apagar tudo" = `DELETE` + checkpoint + `VACUUM` + checkpoint (`src/main/history/store.ts:148-161`). Nunca sai da máquina ([`DATABASE.md`](DATABASE.md)) |
| Dicionário pessoal | PLANEJADO (Fase 2): ainda sem tabela; a migration dele vem depois da `0001` | — |

**Como apagar o histórico.** Pela janela: "Apagar" numa entrada, "Apagar tudo" na tela Histórico (com
confirmação em dois passos) ou, em Configurações → "Guardar histórico", **Nunca guardar**, que apaga tudo na hora
e para de gravar. À mão, com o app fechado: apagar `touch-speaker.db`, `touch-speaker.db-wal` e
`touch-speaker.db-shm` de `%LOCALAPPDATA%\Touch Speaker\` — também o caminho para um banco corrompido, que o app não
repara sozinho (RISK-035).

## 12. Logs e observabilidade

- O log é um arquivo local: `%APPDATA%\Touch Speaker\logs\main.log`, uma linha JSON por evento com `t`,
  `level`, `event` e campos (`src/main/logger.ts:33`). Rotação a 5 MB, guardando `main.log`, `main.1.log` e
  `main.2.log` (`src/main/logger.ts:42-55`). Falha ao gravar o log nunca derruba o ditado (`:34-39`).
- Os valores de campo só podem ser primitivos (`string`, `number`, `boolean`, `null`) — de propósito, para
  ninguém despejar um objeto inteiro no log (`src/main/logger.ts:6-7`).
- **Podem conter:** horários, durações, tamanhos, latências, códigos de erro, versão do app, nome da tecla
  configurada, os 8 primeiros caracteres do `sessionId` (`src/main/session.ts:57`), o estado da chave da Groq
  (`stored`, `env`, `none`, `unreadable`), nomes de campos do `config.json`, o gatilho que abriu a janela
  principal e o nome do canal IPC recusado; do histórico, só contagens (`entries`, `purged`, `count`), tempos
  (`write_ms`, `open_ms`), a versão do schema, a retenção em dias (`retention_days`) e o nome do erro —
  `SQLITE_<código>` para erro do SQLite, o errno (`ENOENT`, `EPERM`…) ou um nome fixo (`no_localappdata`,
  `unsupported_platform`, `schema_too_new`, `migrations_missing`); do tema, a escolha (`system`, `light`, `dark`).
- **Não podem conter:** texto transcrito ou ditado — **nem o do histórico** —, o termo de busca do histórico,
  áudio, clipboard, chave (nem parte dela), valor dos campos de "Salvar preferências", teclas, título de janela,
  nome do app em foco.
- Logs ficam só na máquina; nada é enviado.
- Eventos que existem (`src/main/index.ts`, `src/main/session.ts`, `src/main/main-window.ts`,
  `src/main/history/service.ts`, `src/main/theme-setting.ts`):
  - **app e ditado:** `app_ready` (`version`, `electron`, `hotkey`, `has_api_key`, `groq_key`, `keyboard_hook`,
    `self_elevated` — `src/main/index.ts:437-445`), `session_start`, `session_stop`, `session_cancel`,
    `session_rejected`, `session_timeout`, `recorder_started` (`latency_ms`), `session_empty`, `session_error`,
    `session_exception`, `transcribe_failed`, `dictation_done` (`audio_ms`, `audio_bytes`, `transcribe_ms`,
    `total_ms`, `chars`, `outcome`), `config_invalid_field`, `pill_console`, `pill_renderer_gone`,
    `win32_unavailable`, `keyboard_hook_unavailable`, `ipc_rejected` (`channel` — dos canais da pílula e da
    janela), `second_instance_focus`, `app_relaunch`;
  - **janela principal:** `main_window_opened` (`trigger`: `tray_menu`, `tray_double_click`, `second_instance`,
    `first_run`), `main_window_ready` (`ready_ms`), `main_window_closed`, `main_window_renderer_gone` (`reason`),
    `main_window_console` (`level`, `line`), `main_window_load_failed` (`name`);
  - **chave da Groq:** `groq_key_saved`, `groq_key_removed` (`state`), `groq_key_rejected` (`reason`:
    `invalid_format`, `encryption_unavailable` ou `write_failed`; nas falhas de cifra e de gravação, também
    `name`), `groq_key_unreadable` (`reason`);
  - **preferências e item de login:** `settings_saved` (`fields`: nomes dos campos alterados, separados por
    vírgula), `settings_rejected` (`field`), `settings_write_failed` (`name`: código errno, ou `invalid_json`),
    `login_item_changed` (`enabled`), `login_item_failed` (`name`);
  - **histórico** (18/out/2026, `src/main/history/service.ts`): `history_ready` (`schema_version`, `entries`,
    `purged`, `open_ms`), `history_unavailable` (`name`), `history_saved` (`session` — 8 caracteres —, `write_ms`),
    `history_write_failed` (`session` ou `null`, `name`), `history_purged` (`count`), `history_purge_failed`
    (`name`), `history_read_failed` (`name`), `history_copied` e `history_deleted` (sem campo nenhum — nem id, nem
    texto), `history_cleared` (`count`), `history_retention_changed` (`retention_days`, `purged`),
    `config_write_failed` (`name`, nível `error`);
  - **tema** (18/out/2026, `src/main/theme-setting.ts:33-43`): `theme_changed` (`theme`), `theme_write_failed`
    (`name`).
- `second_instance_ignored` deixou de existir: abrir o app de novo mostra a janela principal da instância que já
  roda e registra `second_instance_focus` (`src/main/index.ts:424-427`).
- `pill_console` é o único campo com texto livre: avisos e erros do console da pílula, cortados em 300
  caracteres (`src/main/index.ts:138-142`). É aceitável porque o renderer da pílula não tem conteúdo do usuário
  — o áudio não passa por `console` e os textos da pílula vêm prontos do main.
- `main_window_console` **não** leva a mensagem, só `level` e `line` (`src/main/main-window.ts:110-115`): a janela
  principal manipula a chave da Groq, e uma mensagem de console poderia carregá-la.
- Não há métricas remotas, error tracking nem alertas.

**Regras**

- Campo novo de log passa pela lista acima: se puder carregar conteúdo do usuário ou a chave, não entra.
- **Nada do histórico no log:** nem texto ditado, nem termo de busca, nem o `id` inteiro de uma entrada — só
  contagens, tempos e nomes de erro. O texto que o banco guarda não volta pelo log em caminho nenhum, inclusive
  nas falhas.
- Nunca logar `err.message` de erro que possa conter dado do usuário; o padrão do código é logar só
  `err.name` (`src/main/index.ts:161`, `:268`, `src/main/session.ts:233`) ou, nos erros de arquivo, só o código
  errno (`errorName`, `src/main/atomic-file.ts:41-48`).
- Nada do console da janela principal vai para o log além de `level` e `line`.

## 13. Privacidade (LGPD)

| Tema | Estado |
| --- | --- |
| Dados pessoais tratados | Voz (áudio da gravação), texto ditado e, por instantes, o conteúdo do clipboard. Áudio e clipboard nunca são persistidos. Desde a spec `historico` (18/out/2026), o **texto ditado** é guardado no histórico local — com horário, duração e resultado da inserção —, sem criptografia além da conta do Windows na v1 (§11; RISK-030) |
| O que o histórico explicitamente **não** guarda | Áudio, o nome do app em foco, o executável, o título da janela, o texto ao redor do cursor, o conteúdo do clipboard da pessoa, a resposta bruta do Whisper, o termo de busca, a chave — decisão do Victor de 18/out/2026 (FR-HIST-05) |
| Onde o texto guardado aparece | Só na janela principal: na tela Histórico, completo, e — pedido do Victor de 18/out/2026, exceção registrada à regra "texto ditado só na tela Histórico" — no Início, o começo dos **3 ditados mais recentes**, que some com "Nunca guardar" (RISK-039). Entra na tela por `textContent`, nunca como HTML (§14). Nunca na pílula, na bandeja nem no log |
| Terceiros | A voz é enviada à Groq para transcrição; a política de dados da Groq se aplica a esse áudio. O histórico não é enviado a ninguém |
| Titular | Na Fase 1 o único titular é o próprio usuário, que escolheu o provedor e usa a própria chave |
| Retenção local | Histórico só na máquina, na pasta Local (`%LOCALAPPDATA%`): `history.retentionDays`, padrão 30 dias, "Nunca guardar" (`0`) ou "Para sempre" (`null`), ajustada em Configurações e válida na hora; apagar um, "Apagar tudo" e o apagamento à mão estão no §11 |
| Distribuição | PLANEJADO (Fase 4): antes de distribuir, termo de uso e política de privacidade dizendo quais provedores recebem a voz e a retenção de cada um, e opção de provedor local (whisper.cpp) para quem não quer enviar áudio para fora |

**Regras**

- Dado pessoal novo (o que o app passa a guardar, enviar ou mostrar) entra nesta tabela e no
  [SDD §18](spec/spec-driven-development.md) no mesmo PR.
- Provedor novo que receba voz ou texto exige ADR e atualização desta tabela.

## 14. Renderers (pílula e janela principal)

Há dois renderers. A pílula é a **única que grava**: `getUserMedia` só existe num renderer e a permissão de
mídia é só dela (`src/main/pill-window.ts:1-3`, §5). A janela principal não grava nem tem acesso ao microfone.
Os dois carregam só arquivos locais, nunca conteúdo remoto, e mesmo assim são tratados como não confiáveis (§7).

### Pílula

- Microfone aberto **só** entre `recorder:start` e `recorder:stop`/`recorder:cancel`. Todas as trilhas do
  `MediaStream` são paradas no fim, em todos os caminhos — sucesso, cancelamento e erro
  (`src/renderer/pill.ts:69-78`, `:98-110`, `:141-151`, `:182-189`); o indicador de microfone do Windows tem
  de apagar (V3 da spec, pendente — PEND-001).
- O áudio fica em memória (`Blob` → `ArrayBuffer`), vai para o main por `recorder:result` e é descartado.
  **Nunca gravado em disco.**
- O renderer não tem strings próprias: `message` e `hint` chegam prontos do main por `pill:state` e entram
  na tela por `textContent`, nunca por `innerHTML` (`src/renderer/pill.ts:214-219`).

### Janela principal

- Criada sob demanda, quando a pessoa a pede (menu ou duplo clique na bandeja, abrir o app de novo) e, sozinha,
  só uma vez: na primeira execução sem chave salva (`src/main/index.ts:449`). Fechar **destrói** a janela; o app,
  o hook e uma gravação em andamento seguem (`src/main/main-window.ts:127-131`). Nenhum erro, aviso ou sessão de
  ditado a abre.
- É o renderer que recebe a chave digitada (RISK-026). A chave fica nele só entre a digitação e o "Salvar
  chave": o campo é do tipo senha, sem preenchimento automático nem corretor
  (`src/renderer/main-window/index.html:96-104`), e é limpo depois de toda resposta, sucesso ou erro
  (`src/renderer/main-window/main-window.ts:200-205`). O main nunca a devolve (§3).
- O HTML não tem texto: só `id`s e `data-text`/`data-label`. Os textos chegam do main por `app:get-strings` e
  entram por `textContent`, nunca por `innerHTML`; nada é guardado no navegador (sem `localStorage` nem
  IndexedDB) (`src/renderer/main-window/main-window.ts:1-5`). Formulários com `novalidate`: quem valida é o main.
- Desde a spec `historico`, é também o renderer que mostra **texto ditado** — completo na tela Histórico e, no
  Início, o começo dos 3 mais recentes. O texto chega só pela resposta do `history:list` e entra por
  `textContent`, como todo o resto (`src/renderer/main-window/main-window.ts:460`); nenhum `innerHTML` existe no
  renderer, e com a CSP sem rede (`connect-src 'none'`) um texto ditado com cara de HTML ou de link não executa nem
  carrega nada (RISK-036). O `history:stats` do Início leva só números.
- Navegação dentro da mesma página: a URL não muda, e qualquer `will-navigate` ou `window.open` é negado (§9).
- Sem permissão de mídia e com `media-src 'none'` (§5, §9).
- `Esc` na janela só desfaz uma confirmação — a de "Remover chave" ou a de "Apagar tudo" do histórico —, nunca
  confirma nada destrutivo, porque o `Esc` que cancela um ditado também chega à janela em foco (RISK-013;
  `src/renderer/main-window/main-window.ts:292-298`).

**Regras**

- Nada de `innerHTML`, `eval` ou script remoto em nenhum dos dois renderers; as CSPs (§9) não abrem exceção para
  isso, e a da janela não tem `'unsafe-inline'`.
- Mudança na gravação precisa manter "microfone fecha em todos os caminhos" (checklist do §16).
- A janela principal não guarda nada no navegador e não ganha permissão de mídia; resposta de IPC para ela nunca
  leva a chave.

## 15. Dependências, CI e sala limpa

### 15.1 Dependências

- Versões exatas no `package.json` (`electron` 44.9.0, `typescript` 7.0.2, `@types/node` 24.19.2, `koffi`
  3.3.3, `uiohook-napi` 1.5.5) e fixadas no `package-lock.json`. Atualização de Electron, `uiohook-napi` ou
  `koffi` só com teste manual do fluxo completo (RISK-004).
- `npm audit` antes de cada versão.
- Scripts de instalação de pacotes nativos ficam bloqueados por padrão; liberar só os necessários, por nome.
  Hoje `koffi` e `uiohook-napi` estão negados no `allowScripts` do `package.json`: os dois já trazem
  binários prontos para win32-x64 e não precisam compilar nada.
- O binário do Electron é baixado com verificação pelo `checksums.json` do próprio pacote.
- Dependência nova exige ADR em [`DECISIONS.md`](DECISIONS.md).
- **O histórico não trouxe dependência nova**
  ([ADR-09](DECISIONS.md#adr-09--sqlite-local-pelo-nodesqlite-embutido-para-o-histórico-de-ditados)): o driver é
  o `node:sqlite` embutido no Node 24.22.0 do Electron 44.9.0 (SQLite 3.53.4), carregado por `require` só dentro
  de `openSqliteHistory` (`src/main/history/store.ts:214-218`). Nenhum pacote entrou no `package.json`, nenhum
  módulo nativo novo, nenhum script de instalação a liberar. Sem o módulo, o histórico fica indisponível e o app
  abre igual. O `node:sqlite` é "release candidate" (estabilidade 1.2) no Node 24: uma atualização do Electron
  pode mudar a API dele — Electron em versão exata e o TEST-015 rodando o SQLite real no `npm test` (RISK-032).
- **Ícones Lucide** (licença ISC; os derivados do Feather, também MIT): SVG inline — texto, não binário — em
  `src/renderer/main-window/index.html`, copiados da tag 1.52.0 sem mexer nos `path`, com o `LICENSE` da mesma
  tag em `src/renderer/main-window/LICENSE-lucide.txt`. Sem pacote npm, sem fonte de ícones, sem requisição de
  rede (a CSP da janela continua `'self'`). Em 18/out/2026 entraram os do botão de tema, do Histórico, do Início e
  das listas suspensas; a lista com o SHA-256 de cada arquivo de origem está no
  [`DESIGN.md` §11](DESIGN.md#11-ícones), onde também fica em aberto se a Lucide precisa de ADR própria, como a
  Inter.
- **Ativo de terceiro com licença — a fonte Inter** ([ADR-12](DECISIONS.md#adr-12--fonte-inter-embutida-no-app)):
  `frontend/src/renderer/fonts/InterVariable.woff2` (Inter 4.1, release oficial do projeto Inter, sem
  modificação, SHA-256 registrado na ADR) com o `OFL.txt` (SIL Open Font License 1.1) ao lado, copiados juntos
  para `dist/renderer/fonts/` e conferidos pelo `frontend/src/test/tokens.test.ts`. Carregada por `@font-face` local: a CSP
  da pílula **não mudou** (`'self'`, sem `font-src` nem origem remota) e nenhuma requisição de rede nova existe.
  É a **única** exceção ao guardrail "nunca trazer binários de terceiros para o repositório": vale só para
  arquivo de fonte de origem pública, com licença que permite redistribuição e com a licença no repositório.
  Trocar a versão da fonte = baixar da mesma origem, sem modificar, e atualizar versão, tamanho e SHA-256 na
  ADR-12. Nenhuma fonte, cor ou ícone vem do estudo do Typeless (§15.3).
- **Distribuição (Fase 4 — PLANEJADO):** assinatura de código do instalador, auto-update assinado,
  Electron Fuses (desligar `RunAsNode`, `EnableNodeCliInspectArguments`, ligar integridade do ASAR).

### 15.2 CI

Não há pipeline: o repositório não tem `.github/`. Os portões são manuais, rodados em `frontend/` antes do
PR: `npm run typecheck` e `npm test` ([`Code-Style.md`](Code-Style.md)). Não há `npm audit` automático,
Dependabot nem varredura de segredos. **PROPOSTA:** quando houver CI, incluir `npm audit` e varredura de
segredos.

### 15.3 Sala limpa (engenharia reversa)

O desenho do Touch Speaker foi informado por engenharia reversa do Typeless 2.8.2, feita para
entender arquitetura e comportamento. A parte publicável é o
[estudo de referência](referencia/estudo-typeless.md).

Regras:

- O material bruto do estudo (binários do Typeless, código decompilado, anotações e o snapshot de
  dados pessoais) fica **fora da pasta do repositório**, não só fora do git — assim nem um upload
  manual pelo site do GitHub consegue levá-lo junto. O `.gitignore` mantém as pastas antigas
  bloqueadas como segunda trava.
- Do estudo saem ideias e comportamentos documentados com palavras próprias. **Nunca** código,
  pseudocódigo decompilado, strings, constantes mágicas, nomes de canais IPC, ícones, sons, cores ou
  textos do Typeless.
- **Nunca** chamar a API do Typeless, reaproveitar tokens, mexer em assinatura de requisição ou em
  gating de plano/trial deles.
- Na dúvida se algo é "ideia" ou "cópia": escrever do zero a partir da documentação pública da
  Microsoft/Electron/Groq, sem abrir o material bruto do estudo.

A decisão está na [ADR-07](DECISIONS.md#adr-07--sala-limpa-em-relação-ao-typeless). As pastas bloqueadas
como segunda trava são `targets/`, `analysis/` e `rea/` (`.gitignore:1-5`). O estudo é referência **não
normativa**: dele não sai requisito nem código.

## 16. Checklist de segurança do PR

- [ ] Nenhum segredo no diff (`.env`, `groq-key.bin`, chaves, tokens)
- [ ] Nada novo indo para log que esteja na lista proibida (§12); o console da janela principal continua indo
      para o log sem a mensagem
- [ ] **Nada do histórico no log:** nem texto ditado, nem termo de busca — só contagens, tempos e nomes de erro
      (§12)
- [ ] Histórico: nada além das colunas de hoje vai para o banco (nunca áudio, nome do app ou título de janela),
      o banco continua na pasta Local, apagar continua com `secure_delete` + checkpoint, e o texto ditado entra
      na tela só por `textContent` (§11, §13, §14)
- [ ] `config.json` regravado só pela fila `ConfigWriter`, trocando só os campos da própria tela (§10)
- [ ] Nova mensagem IPC validada no main (§7): da pílula, por `fromPill`; da janela principal, por
      `MainWindow.isSender` e com o formato exato do payload — e exposta só no preload do renderer a que pertence
- [ ] A chave da Groq continua só no main: nenhuma resposta de IPC ganhou campo para ela, nada a grava em texto
      puro (log, `config.json`, outro arquivo) e, sem `safeStorage`, o app recusa salvar (§3, §10)
- [ ] Janela nova ou mudada: `contextIsolation`, `sandbox`, sem `nodeIntegration`, `webSecurity`, DevTools só sem
      empacotar, sem menu, sem permissão de mídia, navegação e `window.open` negados, CSP sem rede e sem
      `'unsafe-inline'` (§9)
- [ ] Renderer da janela principal sem `innerHTML` e sem nada guardado no navegador (§14)
- [ ] Nenhuma tecla além da configurada e do `Esc` é identificada (outras viram só um booleano)
- [ ] Microfone fecha em todos os caminhos (sucesso, cancelamento, erro)
- [ ] Nada copiado do Typeless nem do material bruto do estudo; nenhum binário de terceiro no diff (§15.3) —
      a única exceção é arquivo de fonte pública com a licença ao lado, pela ADR-12 (§15.1)
- [ ] Nenhuma dependência nova sem ADR em [`DECISIONS.md`](DECISIONS.md)
- [ ] `npm run typecheck` e `npm test` verdes em `frontend/`

## 17. Quando achar uma vulnerabilidade

1. **Não abra issue pública** nem descreva o furo em canal aberto. Siga o [`SECURITY.md`](../SECURITY.md).
2. Contenha primeiro, com as alavancas que existem hoje:
   - chave da Groq exposta: revogar no console da Groq e gerar outra; salvar a nova em Configurações, que
     substitui o `groq-key.bin` (em desenvolvimento sem chave salva, trocar o valor em `frontend/.env`); para só
     tirar a chave da máquina, "Remover chave";
   - comportamento suspeito do app (microfone, teclado, clipboard): fechar o app pelo "Sair" da bandeja, que
     encerra o hook de teclado e cancela a sessão em andamento (`src/main/index.ts:273-281`);
   - dependência comprometida: não rodar `npm install` de novo até fixar uma versão limpa no
     `package-lock.json`.
3. Corrija com um teste que reproduz o problema (`src/test/<módulo>.test.ts`) ou, quando não houver como
   testar em `node:test`, com um passo novo no roteiro manual V da spec.
4. Registre no [`CHANGELOG.md`](CHANGELOG.md) o que mudou e por quê, sem receita de exploração.

## 18. Riscos conhecidos em aberto

Do registro de riscos do [SDD §26](spec/spec-driven-development.md#26-riscos-e-mitigações), conferidos no
código em 17/out/2026; os da spec `janela-principal` (RISK-021 em diante) e a mudança do RISK-009, em
18/out/2026; os das specs `historico` e `historico-dados-v1` e do tema (RISK-030 em diante) e o efeito do histórico
nos RISK-003, RISK-004, RISK-006, RISK-007 e RISK-008, também em 18/out/2026. Estado: **aberto**, **mitigado** ou
**aceito**.

- [ ] **RISK-001 — Groq muda ou corta o plano gratuito** · aberto. O MVP para de transcrever; mitigação:
  `Transcriber` atrás de interface, e trocar por OpenAI ou whisper.cpp local é um adapter novo (ADR-04).
- [ ] **RISK-002 — Whisper "alucina" frases em silêncio** ("Legendas pela comunidade Amara.org") · mitigado.
  Filtros anti-lixo FR-DICT-08 (`src/main/transcribe/filters.ts`, 8 testes; §6).
- [ ] **RISK-003 — App de destino rodando como administrador bloqueia o Ctrl+V sintético (UIPI)** ·
  mitigado; V10 pendente (PEND-001). Detecção de elevação + fallback "Texto copiado" (FR-DICT-10; §5). **Melhora**
  com o histórico: a entrada `copied` continua lá depois que a pessoa copiar outra coisa.
- [ ] **RISK-004 — `uiohook-napi`/`koffi` quebram numa versão nova do Electron** · aberto (controlado).
  Versões exatas no `package.json`; atualizar Electron só com teste manual (§15.1). **Igual** com o histórico: o
  `node:sqlite` vem dentro do Electron, não é módulo nativo novo (o risco de API dele é o RISK-032).
- [ ] **RISK-005 — Copiar código ou assets do Typeless por engano** · aberto (permanente). Sala limpa
  (ADR-07, §15.3); material bruto fora do repositório; checklist do PR (§16).
- [ ] **RISK-006 — Texto vai para a janela errada se o foco mudar durante a transcrição** · aceito na Fase 1
  (é "digitar onde está o cursor"; §6). **Melhora** com o histórico: o texto passa a ser recuperável na tela
  Histórico, com "Copiar".
- [ ] **RISK-007 — Ditado em campo de senha** · aceito. A senha é digitada no campo; a Fase 3 (UI Automation) pula
  campos `IsPassword` (§6). **Piora** com o histórico: a senha ditada também vai para o banco local, sem
  criptografia na v1 (RISK-030) — a pessoa apaga a entrada.
- [ ] **RISK-008 — Histórico do clipboard do Windows (Win + V) guarda o texto ditado** · aceito; a ser
  documentado para o usuário (§6). **Igual** com o histórico: o "Copiar" dele também passa pelo clipboard.
- [ ] **RISK-009 — Chave da Groq em `frontend/.env` em texto puro** · aceito só em dev, e **melhorou**: no app
  empacotado o `.env` nem é lido, e a chave digitada em Configurações fica cifrada pelo `safeStorage`
  (ADR-08, §3, §10). Em desenvolvimento o `.env` continua aceito como reserva; vazamento por commit ou upload
  segue barrado pelo `.gitignore`.
- [ ] **RISK-010 — `uiohook-napi` não carregar no Electron 44** · mitigado. Verificado no T1
  (`keyboard_hook: true` no `app_ready`); alternativa: hook próprio com `koffi`.
- [ ] **RISK-011 — Primeiras sílabas cortadas** (a captura começa até 300 ms após a tecla) · aberto (NFR-02,
  conhecido). Pílula pré-carregada (medido 75–270 ms); se incomodar, manter o stream aberto 30 s após cada
  uso.
- [ ] **RISK-012 — Whisper erra termos técnicos** · aberto. Correção manual; Fase 2: `prompt` com dicionário
  pessoal (FR-VOCAB-01).
- [ ] **RISK-013 — `Esc` de cancelar também chega ao app em foco** · aceito na Fase 1 (consequência da
  ADR-02): o hook observa a tecla, não a consome.
- [ ] **RISK-014 — Latência cresce com falas longas** (upload do áudio inteiro ao soltar) · aceito. NFR-01 só
  é garantido para falas ≤ 30 s; streaming fica para a Fase 4, com o backend (ADR-04).

Da spec [`janela-principal`](spec/features/janela-principal.md#13-riscos) (18/out/2026), os que tocam
segurança; a verificação manual é o roteiro VJ1–VJ24, pendente (PEND-007):

- [ ] **RISK-021 — A DPAPI protege por usuário do Windows, não por app** · aceito. Outro processo rodando na
  mesma conta consegue decifrar o `groq-key.bin`. Melhor que o texto puro do `.env` e o mesmo modelo de qualquer
  app pessoal; a chave é revogável no console da Groq (§3, §10).
- [ ] **RISK-022 — O `groq-key.bin` não sobrevive a troca de máquina, de perfil ou à perda do dado de cifra do
  Chromium** · mitigado no código. O estado vira `unreadable`, visível no Início e em Configurações com "salve de
  novo"; o app abre normalmente, sem chave em uso (§3; VJ11).
- [ ] **RISK-024 — Ditado com a janela principal em foco cola o texto num campo dela, até no da chave** ·
  aceito, como o RISK-006: é "digitar onde está o cursor"; a pessoa vê o campo e nada é salvo sem uma ação dela
  (§6).
- [ ] **RISK-026 — Um segundo renderer, que manipula a chave, aumenta a superfície de ataque** · mitigado no
  código. Sandbox, CSP sem rede, preload mínimo, remetente e payload validados no main, a chave nunca volta ao
  renderer, console no log sem a mensagem (§7, §9, §12, §14; VJ12, VJ14, VJ16).
- [ ] **RISK-027 — O contrato de IPC passa a existir em dois trios** (`shared/`, preload e `.d.ts`, para a
  pílula e para a janela) · mitigado. Os três arquivos de cada trio mudam juntos; o TEST-009 confere os nomes de
  canal dos dois preloads e os validadores (§7).
- [ ] **RISK-029 — Gravar o item de login rodando por `npm run dev` registraria o `electron.exe` sem o app** ·
  mitigado no código. Sem `app.isPackaged`, o interruptor fica desabilitado e o `login-item:set` responde
  `unavailable` sem tocar no sistema (§5; VJ23).

Os outros riscos da mesma spec não são de segurança e estão só no SDD §26: RISK-023 (janela fechada ocupando
memória), RISK-025 ("Salvar preferências" sobrescreve uma edição manual do `config.json` feita com a janela
aberta; §10) e RISK-028 (apagar o `config.json` sem chave salva reabre a janela sozinha na abertura seguinte).

Das specs [`historico`](spec/features/historico.md#13-riscos) e
[`historico-dados-v1`](spec/features/historico-dados-v1.md) e do tema da `janela-principal` (18/out/2026), os que
tocam segurança; a verificação manual é o roteiro VH1–VH13 com o ensaio da migração (PEND-009) e o VJ25–VJ27
(PEND-010):

- [ ] **RISK-030 — Texto ditado em disco sem criptografia na v1** · aceito pelo Victor em 18/out/2026. O banco é
  legível por quem tem a conta do Windows aberta, por programa rodando como a pessoa, por backup do perfil ou por
  quem lê o disco sem criptografia de disco (BitLocker). Mitigação: retenção de 30 dias por padrão, "Nunca
  guardar", apagar um e apagar tudo, `secure_delete`, nada sai pela rede. Melhoria possível depois: cifrar cada
  texto com `safeStorage`/DPAPI, ou o banco inteiro (§1, §11).
- [ ] **RISK-031 — A pasta Roaming levaria o banco para fora da máquina com perfil móvel** · mitigado. Banco em
  `%LOCALAPPDATA%`; sem a variável, histórico indisponível, nunca a pasta Roaming (§11; VH12).
- [ ] **RISK-032 — O driver não carrega, ou muda de API numa atualização do Electron** · aberto (controlado). O
  `node:sqlite` é "release candidate" no Node 24; sem ele, histórico indisponível e ditado igual. Electron em
  versão exata e o TEST-015 com o SQLite real no `npm test` (§15.1; ADR-09).
- [ ] **RISK-034 — Texto apagado continua legível no arquivo** (páginas livres, WAL) · mitigado no código.
  `secure_delete=ON`, `wal_checkpoint(TRUNCATE)` depois de apagar, `VACUUM` no "Apagar tudo" (§11); a conferência
  nos arquivos é o VH6, pendente.
- [ ] **RISK-035 — Banco corrompido** · aberto, sem reparo automático. O histórico fica indisponível
  (`history_unavailable`) e o ditado continua; o arquivo com texto fica no disco, fora do alcance da retenção, até a
  pessoa apagá-lo à mão (§11).
- [ ] **RISK-036 — Texto ditado com cara de HTML vira injeção na tela que o mostra** · mitigado no código.
  `textContent`, nenhum `innerHTML`, CSP sem rede (§14).
- [ ] **RISK-037 — O main passa a regravar o `config.json`** (escrita pela metade, ou que derruba uma edição à
  mão) · mitigado. Fila única `ConfigWriter`, que relê o arquivo e troca só os campos da própria tela; temporário +
  renomeação; arquivo que não é objeto JSON não é sobrescrito (§10).
- [ ] **RISK-039 — O Início passa a mostrar o começo de texto ditado** · aceito (pedido do Victor de 18/out/2026).
  Mais uma superfície visível na tela; mitigação: só o começo, só 3 entradas, e some com "Nunca guardar" (§13;
  VH13).

Os outros riscos dessas specs não são de segurança e estão só no SDD §26: RISK-033 (os testes rodam no Node do
sistema e o app no do Electron — resolvido pelo spike: o mesmo SQLite 3.53.4 nos dois), RISK-038 (a falha ao
gravar uma entrada só aparece na tela Histórico — aceito pelo Victor) e RISK-040 (o select personalizável e as
View Transitions são recursos recentes do Chromium, e uma atualização do Electron pode mudar o visual — Electron em
versão exata, TEST-019 e roteiro VJ27).

### Divergências doc × código

Enquanto não forem corrigidas, o código diz o que existe. As versões anteriores dos documentos estão em
`git show ed0a1f5:docs/<arquivo>`.

| Doc | Afirmava | O código faz | Estado |
| --- | --- | --- | --- |
| `DESIGN.md` anterior (§6, menu da bandeja) | Item "Microfone: {nome do dispositivo}" | Mostra "Microfone: padrão do Windows" ou "Microfone: definido no config.json" (`src/main/strings.ts:15-16`, `src/main/tray.ts:61`) | Corrigida nesta revisão ([`DESIGN.md`](DESIGN.md#63-menu-da-bandeja)) |
| `DESIGN.md` anterior (§6, ícone da bandeja) | Ponto da variante "gravando" em `--ts-listening` | Ponto vermelho `#F87171`, o valor de `--ts-error` (`src/main/icon.ts:5` em `ed0a1f5`). Desde a spec `design-system` (18/out/2026), o ponto está na cor de gravação da variante do tema da barra (`src/shared/palette.ts:32-36`) | Corrigida nesta revisão ([`DESIGN.md`](DESIGN.md#62-ícone-da-bandeja)) |
| `DESIGN.md` anterior (§6, ícone da bandeja) | Glifo em 16/20/24/32 px | Gera 16 px e as escalas 1,5× e 2× — 16/24/32 px (`src/main/icon.ts:18-29`) | Corrigida nesta revisão |
| Security Guide anterior (§6, clipboard) | Falha na restauração grava `restore_failed` e quantos formatos havia | A falha é engolida em silêncio; nenhum evento de log (`src/main/insert/inserter.ts:100-103`) | Corrigida nesta revisão (§6) |
| Security Guide anterior (§8, CSP) | `default-src 'self'; script-src 'self'; connect-src 'none'; img-src 'self' data:; media-src 'self' blob:` | Tem também `style-src 'self'` e `mediastream:` em `media-src` (`src/renderer/pill.html:7`) | Corrigida nesta revisão (§9) |
| Security Guide anterior (§4, teclado) | Estado guardado inclui um booleano "outra tecla foi pressionada" | "Outra tecla" não é guardada: cancela a sessão na hora, dentro de `shortcutWindowMs` (`src/main/hotkey.ts:36-39`, `:80-88`) | Corrigida nesta revisão (§7) |
