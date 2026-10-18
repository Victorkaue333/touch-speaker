# DATABASE — Touch Speaker

> Última atualização: 18/out/2026 · Mantenedor: Victor Alves

> **Status:** o app tem **um banco local**: o histórico de ditados num arquivo SQLite, `%LOCALAPPDATA%\Touch Speaker\touch-speaker.db`, aberto pelo `node:sqlite` embutido no Electron ([ADR-09](DECISIONS.md#adr-09--sqlite-local-pelo-nodesqlite-embutido-para-o-histórico-de-ditados)), com a migration `database/local/0001_init.sql` (specs [`historico`](spec/features/historico.md) e [`historico-dados-v1`](spec/features/historico-dados-v1.md)). Além dele, guarda em disco o `config.json` do usuário, a chave da Groq **cifrada** em `groq-key.bin` (quando a pessoa a salva na janela principal), o log em arquivo e, em desenvolvimento, a chave em `frontend/.env` (**FATO**, conferido no código em 18/out/2026, com as specs [`janela-principal`](spec/features/janela-principal.md), `historico` e `historico-dados-v1` implementadas e ainda não commitadas; o roteiro manual VH1–VH13 e o ensaio com dado real estão pendentes — PEND-009). O dicionário pessoal (`dictionary_terms`) continua **PLANEJADO (Fase 2)**; o banco do servidor (Postgres, migrations em `database/server/`) é **PLANEJADO (Fase 4)**.

Os caminhos de código deste documento são relativos a `frontend/`. `%APPDATA%\Touch Speaker\` é a pasta de dados do app: o main fixa o `userData` do Electron nela (`src/main/index.ts:52`). O banco **não** fica nela: fica na pasta Local, `%LOCALAPPDATA%\Touch Speaker\`, que não acompanha perfil móvel do Windows ([`touch-speaker.db`](#touch-speakerdb)).

Princípio que atravessa todas as fases: **áudio não é persistido** e **texto ditado só fica na máquina do usuário** (até existir sync opcional e explícito na Fase 4). Desde a spec `historico`, o texto de cada ditado que terminou com texto vai para o disco — só no banco local, sem criptografia além da proteção da conta do Windows na v1 (RISK-030, aceito pelo Victor) — e some pela retenção, por "Apagar" ou "Apagar tudo". O log continua sem texto ditado.

## SGBD

| Item | Valor | Onde |
| --- | --- | --- |
| Configuração, chave e log | JSON (`config.json`), a chave da Groq num arquivo cifrado (`groq-key.bin`) e log em arquivo de texto | `src/main/config.ts`, `src/main/credentials.ts`, `src/main/logger.ts` |
| Pasta de dados | `%APPDATA%\Touch Speaker\` (`userData` do Electron) | `src/main/index.ts:52` |
| Histórico (M2, Fase 2) | **SQLite local por usuário**, embutido no app: `node:sqlite` do Node 24.22.0 do Electron 44.9.0, SQLite 3.53.4 (ADR-09). Arquivo `%LOCALAPPDATA%\Touch Speaker\touch-speaker.db` (+ `-wal` e `-shm`), `journal_mode=WAL` e `secure_delete=ON` — **FATO** | `database/local/0001_init.sql`; `src/main/history/` (`store.ts`, `migrations.ts`, `paths.ts`, `service.ts`) |
| Dicionário (Fase 2) | Tabela `dictionary_terms` no mesmo SQLite — **PLANEJADO** | ainda sem migration |
| Fase 4 | Banco do servidor (Postgres) — **PLANEJADO** | `database/server/` (ainda não existe) |

- **Sem servidor de banco, sem porta.** O SQLite é um arquivo aberto pelo próprio processo main; nada a instalar nem subir ([`ENVIRONMENT.md`](ENVIRONMENT.md)). Nenhuma dependência nova no `package.json`: o driver é o módulo `node:sqlite` do Node que vem no Electron.
- **O `config.json` não está no repositório.** Nasce na primeira execução, com os defaults — que já trazem `"history": { "retentionDays": 30 }` e `"theme": "system"` (`loadConfig`, `src/main/config.ts:142-155`; `DEFAULT_CONFIG`, `config.ts:35-47`). O `loadConfig` diz se o criou nesta abertura (`created`, `LoadedConfig`, `config.ts:135-139`): é o **sinal de primeira execução**. Sem chave salva no app, é nessa abertura — e só nela — que a janela principal abre sozinha, em Configurações (FR-UI-35; `shouldOpenOnFirstRun`, `src/main/settings.ts:102-104`; `src/main/index.ts:449`). Nenhum outro dado é gravado para lembrar que a janela já abriu.
- **O que o app usa é lido uma vez, ao abrir** (`src/main/index.ts:115`). Editou o arquivo à mão ou salvou preferências na janela, reinicie o app — Configurações avisa "As mudanças valem depois de reiniciar o app" e oferece "Reiniciar agora" (FR-UI-31, FR-UI-32). Duas exceções valem na hora, sem reiniciar: a retenção do histórico (FR-HIST-20) e o tema (FR-UI-40), mudados pela janela.
- **O app escreve o `config.json` em quatro casos:** na abertura, só para criá-lo com os defaults quando ele não existe (`loadConfig`); e, pela fila única `ConfigWriter`, em "Salvar preferências", que regrava só os sete campos da tela (`mergeSettings`), ao mudar "Guardar histórico", que troca só `history.retentionDays` (`withRetention`), e ao mudar o tema, que troca só `theme` (`withTheme`) — [Gravação pela janela principal](#gravação-pela-janela-principal). Cada gravação da fila relê o arquivo e mexe só nos seus campos. Um arquivo que já existe nunca é regravado na abertura: com campo inválido, ele continua sem correção no disco, o default vale só em memória, e o aviso vai para o log a cada abertura.
- **Banco do servidor (Fase 4):** fora do escopo agora. Quando existir: usuários, cotas, dicionário sincronizado e uso agregado. **Sem** texto ditado no servidor por padrão.

```powershell
# Não há "migrate" a rodar: o app aplica as migrations do histórico sozinho, ao abrir.

# Voltar a configuração aos defaults, com o app fechado:
Remove-Item "$env:APPDATA\Touch Speaker\config.json"
# o próximo "npm run dev" (ou "npm start"), de dentro de frontend/, recria o arquivo com os defaults

# Apagar o histórico inteiro à mão, com o app fechado: touch-speaker.db, touch-speaker.db-wal e touch-speaker.db-shm
Remove-Item "$env:LOCALAPPDATA\Touch Speaker\touch-speaker.db*"
# o próximo início cria um banco vazio e aplica a 0001 de novo

# abrir a pasta de dados (o menu da bandeja tem o mesmo atalho: "Abrir pasta de configuração")
explorer "$env:APPDATA\Touch Speaker"
# abrir a pasta do banco
explorer "$env:LOCALAPPDATA\Touch Speaker"
```

> **Apagar o `config.json` só desfaz as suas configurações.** A chave salva fica em `groq-key.bin` e o histórico fica em `touch-speaker.db`, na outra pasta: nenhum dos dois é afetado — e a retenção volta ao padrão de 30 dias, que purga na próxima abertura o que for mais antigo que isso. O áudio nunca foi gravado. O log fica em `logs\` e só tem diagnóstico.
>
> **Apagar o histórico à mão** pede o app fechado e os três arquivos juntos (`touch-speaker.db`, `touch-speaker.db-wal` e `touch-speaker.db-shm`): com o app aberto, o banco está em uso, e o `-wal` também pode guardar texto ditado. Pela janela, sem fechar o app, o mesmo efeito vem de "Apagar tudo" (tela Histórico) ou de "Nunca guardar" (Configurações → card "Histórico").
>
> **Sem chave salva no app, apagar o `config.json` reabre a janela sozinha.** A abertura seguinte recria o arquivo e é tratada como primeira execução: se o estado da chave não é `stored` (só o `.env` de desenvolvimento, nenhuma chave ou chave ilegível), a janela principal abre sozinha em Configurações, uma vez (RISK-028, aceito: é o mesmo estado de quem acabou de instalar). Com chave salva, nada abre.

## Identidade e autorização

Não se aplica na Fase 1: não há contas, usuários nem papéis — o app é de uma pessoa, na máquina dela, com a chave da Groq dela. Identidade e contas chegam com o backend da Fase 4 (FR-ACC-01, **PLANEJADO (Fase 4)**).

## Modelos

| Modelo | Onde | Descrição | Status |
| --- | --- | --- | --- |
| `config.json` | `%APPDATA%\Touch Speaker\config.json` | Preferências do usuário: tecla, limites de tempo, idioma, provedor e modelo, microfone, posição da pílula, sons, retenção do histórico e tema. Editável à mão e, pela janela principal, em sete campos de preferências, na retenção e no tema | **FATO** |
| `groq-key.bin` | `%APPDATA%\Touch Speaker\groq-key.bin` | Chave da Groq digitada em Configurações, cifrada pelo `safeStorage` do Electron (DPAPI no Windows); nunca em texto puro | **FATO** (18/out/2026, [ADR-08](DECISIONS.md#adr-08--chave-da-groq-no-safestorage-do-electron-com-o-env-só-como-reserva-de-desenvolvimento)) |
| `.env` | `frontend/.env` | Chave da Groq, só em desenvolvimento e só com o app não empacotado; vale quando não há `groq-key.bin` | **FATO** |
| Log | `%APPDATA%\Touch Speaker\logs\main.log` (+ `main.1.log`, `main.2.log`) | Eventos do app, só metadados | **FATO** |
| `touch-speaker.db` | `%LOCALAPPDATA%\Touch Speaker\touch-speaker.db` (+ `-wal`, `-shm`) | O arquivo SQLite do histórico, aberto só pelo processo main | **FATO** (18/out/2026, [ADR-09](DECISIONS.md#adr-09--sqlite-local-pelo-nodesqlite-embutido-para-o-histórico-de-ditados)) |
| `dictations` | SQLite local | Histórico dos ditados: texto, duração e resultado de cada ditado que terminou com texto | **FATO** (18/out/2026, `0001_init.sql`) |
| `schema_migrations` | SQLite local | Registro das migrations aplicadas | **FATO** (18/out/2026, criada pelo aplicador) |
| `dictionary_terms` | SQLite local | Dicionário pessoal | **PLANEJADO (Fase 2)** |

**O item de login não é dado do app.** "Iniciar com o Windows", em Configurações, lê e grava o item de login do sistema — a chave `Run` do usuário no Windows — por `app.getLoginItemSettings` e `app.setLoginItemSettings` (`src/main/login-item.ts`). É estado do sistema: o app não o guarda em arquivo nem no `config.json`, e o lê de novo toda vez que Configurações aparece (FR-UI-36, FR-UI-37). Só funciona com o app empacotado; em `npm run dev` o interruptor fica desabilitado, porque o item apontaria para o `electron.exe` sem o app (RISK-029). O estado inicial vem do instalador da spec [`distribuicao-windows-macos`](spec/features/distribuicao-windows-macos.md).

### `config.json`

Local: `%APPDATA%\Touch Speaker\config.json`. Criado com os defaults na primeira execução (`loadConfig`, `src/main/config.ts:142-155`) e validado campo a campo por `normalizeConfig` (`config.ts:63-118`, BR-012). O tipo é `AppConfig` (`config.ts:11-31`); os defaults são `DEFAULT_CONFIG` (`config.ts:35-47`). É o arquivo de um primeiro uso:

```json
{
  "version": 1,
  "hotkey": "RightCtrl",
  "holdThresholdMs": 500,
  "maxRecordingMs": 300000,
  "language": "pt",
  "transcription": {
    "provider": "groq",
    "model": "whisper-large-v3-turbo"
  },
  "microphoneDeviceId": null,
  "pill": {
    "position": "bottom-center"
  },
  "sounds": true,
  "history": {
    "retentionDays": 30
  },
  "theme": "system"
}
```

| Campo | Tipo | Default | Regra (`src/main/config.ts`) |
| --- | --- | --- | --- |
| `version` | int | `1` | Versão do formato, para migração de config quando ele mudar. O valor lido não é conferido hoje: `normalizeConfig` sempre devolve `version: 1`. Campo **aditivo** com default (como `history` e `theme`) não sobe a versão ([Migrations](#migrations)) |
| `hotkey` | string | `"RightCtrl"` | Uma de `RightCtrl`, `RightAlt`, `RightShift`, `CapsLock`, `F13`–`F24` (`HOTKEY_CODES`, `src/main/keys.ts:6-23`) |
| `holdThresholdMs` | int | `500` | Inteiro de 200 a 1500 (`config.ts:77`). Soltar antes disso = toque (mãos livres); depois = segurar para falar |
| `maxRecordingMs` | int | `300000` | Inteiro de 10 000 a 300 000 (`config.ts:78`; 5 min, FR-DICT-11). O aviso aparece 30 s antes do fim. Sempre em ms no arquivo; a janela mostra e edita em segundos (10 a 300) e converte |
| `language` | string | `"pt"` | Duas letras minúsculas (`^[a-z]{2}$`, `config.ts:79-83`): o código ISO-639-1 enviado ao Whisper |
| `transcription.provider` | enum | `"groq"` | Só `groq` na Fase 1 |
| `transcription.model` | string | `"whisper-large-v3-turbo"` | `whisper-large-v3-turbo` ou `whisper-large-v3` (`TRANSCRIPTION_MODELS`, `config.ts:49`) |
| `microphoneDeviceId` | string \| null | `null` | `null` = microfone padrão do Windows; uma string é passada ao `getUserMedia` como `deviceId` exato |
| `pill.position` | enum | `"bottom-center"` | `bottom-center` \| `top-center` |
| `sounds` | bool | `true` | Bipe curto ao iniciar e ao terminar a gravação, e no erro |
| `history.retentionDays` | int \| null | `30` | Quanto tempo o histórico guarda cada ditado (spec `historico` FR-HIST-06, FR-HIST-07; `historico-dados-v1` FR-HIST-30): `0` = nunca guardar (não grava e apaga tudo), inteiro de `1` a `3650` = dias, `null` = para sempre (`isRetentionDays`, `src/main/history/retention.ts`; `config.ts:108-115`). Ausente (o `config.json` de antes) → 30, sem aviso. `history` é conferido como objeto inteiro; outras chaves dentro dele são preservadas na gravação. Gravado pela janela por `withRetention` ([Retenção](#campos-de-auditoria-e-retenção)) |
| `theme` | enum | `"system"` | `system` (segue o modo de aplicativo do Windows) \| `light` \| `dark` (`isThemePreference`, `src/shared/theme.ts`; `config.ts:90`). Aplicado na abertura, antes de qualquer janela, como `nativeTheme.themeSource` — janela principal, moldura e pílula seguem; a bandeja continua seguindo a barra de tarefas (spec `janela-principal` FR-UI-39…42). Gravado pela janela por `withTheme` |

Como a validação trata cada caso (`normalizeConfig` e `loadConfig`; testes em `src/test/config.test.ts`, TEST-004):

| Caso | Resultado | Aviso no log (`config_invalid_field`) |
| --- | --- | --- |
| Arquivo não existe | criado com os defaults | — |
| Conteúdo que não é JSON | todos os defaults | `field: "json"` |
| JSON cuja raiz não é um objeto | todos os defaults | `field: "root"` |
| Campo conhecido com valor inválido | default naquele campo; os outros valem | `field` com o nome do campo; `transcription`, `pill` e `history` são conferidos como objeto inteiro (`history.retentionDays` igual a `5000`, `-1`, `7.5` ou `"30"`, ou `history: 30` → 30 dias e `field: "history"`); `theme` fora dos três valores → `"system"` e `field: "theme"` |
| Campo ausente | default, sem aviso (um `config.json` de antes, sem `history` nem `theme`, vale como 30 dias e `"system"`) | — |
| Campo desconhecido | ignorado, sem aviso; preservado quando a janela grava | — |

O app nunca deixa de abrir por causa de config, e a abertura nunca regrava o arquivo (historico-dados-v1 §8).

#### Gravação pela janela principal

Desde a spec [`janela-principal`](spec/features/janela-principal.md) (18/out/2026), a janela principal lê e grava o `config.json`, sempre pela mesma fila. São três gravadores, e cada um troca só os seus campos: "Salvar preferências" (os sete campos, FR-UI-29), "Guardar histórico" (só `history.retentionDays`, spec [`historico`](spec/features/historico.md) FR-HIST-20, FR-HIST-21) e o tema (só `theme`, FR-UI-40). Os dois campos novos são aditivos, com default: `version` continua `1` (historico-dados-v1 §6.6).

- **Leitura para a tela:** toda vez que Configurações aparece, o arquivo é relido do disco e normalizado **sem** registrar `config_invalid_field` (o aviso é da abertura do app) — `readConfigQuietly`, `src/main/config.ts:180-183`. A tela mostra os valores **gravados**; o Início, os valores **em uso** (os da abertura).
- **Os sete campos editáveis** (FR-UI-26): `hotkey`, `holdThresholdMs`, `maxRecordingMs`, `language`, `transcription.model`, `pill.position` e `sounds`. O `microphoneDeviceId` aparece só para leitura e nunca é gravado pela tela (FR-UI-27).
- **Validação antes de gravar:** "Salvar preferências" confere os sete campos com as mesmas regras do `normalizeConfig`, sem duplicá-las (`validateSettings`, `src/main/settings.ts:50-67`). Um campo inválido recusa o salvamento inteiro (`invalid_field`, log `settings_rejected` com o `field`) e nada é gravado (FR-UI-28). A retenção e o tema são conferidos no IPC antes de chegar à fila (`asRetentionInput`, `src/main/history/ipc.ts`; `asThemeInput`, `src/main/main-window-ipc.ts`): fora do permitido, o main recusa (`ipc_rejected`) sem tocar no arquivo.
- **Mescla:** "Salvar preferências" troca só os sete campos; `version`, `transcription.provider`, `microphoneDeviceId`, `history` (com o `retentionDays`), `theme` e campos desconhecidos ficam como estavam (`mergeSettings`, `settings.ts:86-99`). `withRetention` troca só `history.retentionDays` — outras chaves dentro de `history`, os outros campos, os desconhecidos e `version` ficam (`config.ts:125-128`); `withTheme` troca só `theme` (`config.ts:131-133`).
- **Uma fila só:** toda gravação do `config.json` passa pelo `ConfigWriter` (`config.ts:194-222`), uma de cada vez, na ordem de chegada; cada uma relê o arquivo, aplica só a sua mudança e grava de forma atômica — `config.json.tmp` na mesma pasta e depois renomear por cima (`src/main/atomic-file.ts:26-39`) —, para uma gravação nunca apagar a outra (RISK-037).
- **O que vale em uso:** as sete preferências não mudam ao salvar — o app segue com os valores da abertura até reiniciar, e, quando o disco difere do que está em uso, Configurações mostra o reinício pendente (FR-UI-31). A retenção e o tema valem **na hora**, mas só depois da gravação ok: a retenção nova já purga o que passou do corte (FR-HIST-20), e o tema novo vira o `nativeTheme.themeSource` (FR-UI-40). Gravação que falha deixa em uso o valor de antes.

| Caso ao salvar | Resultado | Log |
| --- | --- | --- |
| Todos os campos válidos | Arquivo regravado com os sete campos da tela e o resto intacto | `settings_saved` (`fields`: nomes dos campos alterados, nunca valores) |
| Algum campo inválido | `invalid_field`; nada gravado | `settings_rejected` (`field`) |
| `config.json` ausente (apagado com o app aberto) | Recriado com os defaults e os valores da tela | `settings_saved` |
| `config.json` que não é um objeto JSON (JSON quebrado ou raiz que não é objeto) | `write_failed`; o arquivo **não** é sobrescrito — decisão de implementação, a mesma regra da FR-HIST-21 da spec `historico` (a spec `janela-principal` não cobria o caso) | `settings_write_failed` (`name: invalid_json`) |
| Falha ao gravar (somente leitura, disco cheio, pasta sem permissão) | `write_failed`; o arquivo anterior fica intacto (FR-UI-30) | `settings_write_failed` (`name`: código errno, nunca a mensagem) |

A retenção e o tema seguem a mesma tabela, com os seus resultados e eventos:

| Caso | "Guardar histórico" (`history:set-retention`) | Tema (`theme:set`) |
| --- | --- | --- |
| Gravação ok | `saved`, com a retenção nova em uso e quantos ditados a purga apagou; log `history_retention_changed` (`retention_days`, `purged`) | `{ ok: true, theme }`; o `themeSource` muda; log `theme_changed` (`theme`) |
| `config.json` ausente | Recriado com os defaults e o valor novo | Recriado com os defaults e o valor novo |
| `config.json` que não é objeto JSON, ou falha ao gravar | `write_failed`, arquivo intacto, a retenção de antes continua em uso (FR-HIST-21); log `config_write_failed` (`name`, nível `error`) | `{ ok: false, code: 'write_failed', theme }` com o tema que continua em uso; log `theme_write_failed` (`name`, nível `error`) |

Editar o `config.json` à mão com a janela aberta continua possível; um "Salvar preferências" depois disso regrava os sete campos com os valores da tela (RISK-025 — mitigado por Configurações reler o disco toda vez que aparece).

### `.env`

Só em desenvolvimento: `frontend/.env`, com uma linha `GROQ_API_KEY=<sua chave>`, criado a partir de `frontend/.env.example` (que só tem o nome da variável). Fica fora do git (`.gitignore`: `.env`, `.env.*`, `!.env.example`). O main o lê ao abrir **só com o app não empacotado** (`process.loadEnvFile` dentro de `if (!app.isPackaged)`, `src/main/index.ts:59-65`), e a chave dele só vale quando não há `groq-key.bin` ([`groq-key.bin`](#groq-keybin), ADR-08, BR-016). Sem chave nenhuma, o app abre e a pílula mostra `no_api_key`. Detalhes da variável: [`ENVIRONMENT.md`](ENVIRONMENT.md#o-arquivo-env).

### `groq-key.bin`

Local: `%APPDATA%\Touch Speaker\groq-key.bin` (`GROQ_KEY_FILE`, `src/main/credentials.ts:10`). É a chave da Groq que a pessoa digita em Configurações, cifrada pelo `safeStorage` do Electron — DPAPI no Windows, por usuário do Windows ([ADR-08](DECISIONS.md#adr-08--chave-da-groq-no-safestorage-do-electron-com-o-env-só-como-reserva-de-desenvolvimento)). Dono: `CredentialStore` (`src/main/credentials.ts`), só no processo main.

- **Conteúdo:** os bytes devolvidos por `safeStorage.encryptString(chave)`, e nada mais. Nunca texto puro.
- **Quando é escrito:** em "Salvar chave" (FR-UI-18). O main confere o formato (pontas aparadas; de 1 a 512 caracteres; sem espaço nem caractere de controle no meio — `normalizeGroqKey`, `credentials.ts:43-48`), confere se a cifra está disponível, cifra e grava de forma atômica: `groq-key.bin.tmp` na mesma pasta, depois renomear por cima, com `mode 0o600` (`credentials.ts:95-114`; `atomic-file.ts:26-39`). Cifra indisponível → `encryption_unavailable` e nada é gravado (FR-UI-20); falha ao cifrar ou ao gravar → `write_failed`, e o arquivo anterior e a chave em uso continuam.
- **Quando é apagado:** em "Remover chave", confirmado na própria tela (FR-UI-21, `credentials.ts:117-125`). Passa a valer a chave do `.env` (só em desenvolvimento) ou nenhuma.
- **Quando é lido:** uma vez, na abertura, depois do `ready` do app, porque o `safeStorage` só funciona a partir daí (`src/main/index.ts:164-177`; `credentials.ts:68-83`). A ordem é: `groq-key.bin` decifrado (estado `stored`); senão, só com o app não empacotado, a `GROQ_API_KEY` do `.env` (`env`); senão, nenhuma (`none`) — BR-016. A chave salva vale a partir do próximo ditado, sem reiniciar.
- **Arquivo que não decifra:** se o arquivo existe mas não decifra, se a cifra está indisponível na abertura ou se o conteúdo decifrado não passa no formato, o estado é `unreadable`: o app abre normalmente, registra `groq_key_unreadable` com o `reason` e fica **sem chave em uso** — o `.env` não substitui (FR-UI-23). O Início e Configurações mostram "A chave salva não pôde ser lida — salve de novo".
- **Não sobrevive a troca de máquina, de perfil do Windows nem à perda do dado de cifra do Chromium** na pasta de dados (RISK-022): o estado vira `unreadable` e basta salvar a chave de novo. A DPAPI protege por usuário do Windows, não por app: outro processo da mesma conta consegue decifrar o arquivo (RISK-021, aceito — melhor que o texto puro do `.env`; a chave é revogável no console da Groq).
- **Por que não no `config.json`:** o `config.json` guarda só preferências e nenhum segredo ([Security Guide §10](Security-Guide.md#10-segredos-e-configuração)), é editável à mão e reescrito pela tela.
- **A chave nunca sai do main:** vai do renderer ao main uma vez, ao salvar, e nunca volta; nunca entra no log, no `config.json` nem numa resposta de IPC, que levam só o estado (`stored`, `env`, `none`, `unreadable`) — FR-UI-22.
- **Rollback:** voltar à versão anterior do app deixa o `groq-key.bin` órfão na pasta de dados; a versão anterior o ignora e volta a ler o `.env`. Pode ser apagado à mão, com o app fechado: `Remove-Item "$env:APPDATA\Touch Speaker\groq-key.bin"`.

### Log

`%APPDATA%\Touch Speaker\logs\main.log`, escrito pelo `Logger` (`src/main/logger.ts`).

- **Formato:** uma linha JSON por evento, com `t` (horário ISO-8601 em UTC), `level` (`info`, `warn` ou `error`), `event` (nome em snake_case) e campos extras. Os campos extras só aceitam valores primitivos — `string`, `number`, `boolean` ou `null` —, restrição imposta pelo tipo `LogFields` (`logger.ts:6-7`).
- **Rotação:** antes de cada escrita, se `main.log` passou de 5 MB, `main.1.log` vira `main.2.log` e `main.log` vira `main.1.log` (`logger.ts:42-55`). No máximo três arquivos, cerca de 15 MB.
- **Grava:** início e fim de sessão, modo, duração e tamanho do áudio, latência de cada etapa, quantidade de caracteres inseridos, resultado da inserção, códigos de erro, versão do app. A sessão aparece só pelos 8 primeiros caracteres do `sessionId` (`src/main/session.ts:57`). Do histórico, só contagens, tempos e nomes de erro (`history_ready`, `history_saved`, `history_write_failed`…). Lista de eventos: [`ENVIRONMENT.md`](ENVIRONMENT.md#log).
- **Não grava:** texto transcrito, áudio, conteúdo do clipboard, teclas, título de janela, a chave, o valor de um campo das preferências nem o termo de busca do histórico — de "Salvar preferências" vão só os nomes dos campos alterados, e dos outros eventos da janela, estados e códigos de erro ([Security Guide §12](Security-Guide.md#12-logs-e-observabilidade)). A retenção e o tema entram com o valor escolhido (`history_retention_changed`, `theme_changed`). O texto ditado vai para o banco local, nunca para o log.
- **Nunca derruba o ditado:** falha ao escrever é engolida em silêncio (`logger.ts:34-39`).

### `touch-speaker.db`

**FATO (18/out/2026).** O arquivo SQLite do histórico ([ADR-09](DECISIONS.md#adr-09--sqlite-local-pelo-nodesqlite-embutido-para-o-histórico-de-ditados); spec [`historico`](spec/features/historico.md) §9).

- **Onde:** no Windows, `%LOCALAPPDATA%\Touch Speaker\touch-speaker.db`, com o `touch-speaker.db-wal` e o `touch-speaker.db-shm` do modo WAL ao lado. O caminho vem da variável de ambiente `LOCALAPPDATA` do Windows + `Touch Speaker` (`historyLocation`, `src/main/history/paths.ts`), porque o `app.getPath` do Electron 44 não tem nome para a pasta Local — o `appData` é a Roaming (ADR-09). Variável ausente, vazia ou relativa → histórico indisponível (`history_unavailable`, `name: no_localappdata`); **nunca** cai na pasta Roaming (spec `historico` D14). No macOS, só com a spec [`distribuicao-windows-macos`](spec/features/distribuicao-windows-macos.md): `app.getPath('appData')` + `Touch Speaker`. Em outra plataforma: `unsupported_platform`.
- **Quem abre:** só o processo main, por uma conexão única, aberta no `index.ts` depois do `loadConfig` e antes de montar a sessão (`openHistory`, `src/main/history/service.ts`). O driver é o `node:sqlite` do Node do Electron, carregado com `require('node:sqlite')` **dentro** de `openSqliteHistory` (`src/main/history/store.ts`), não na importação: um runtime sem ele deixa o histórico indisponível, e o app abre e dita como antes (FR-HIST-16). Só `store.ts` e `migrations.ts` tocam o driver. Fecha ao sair do app (`HistoryService.close`).
- **PRAGMAs a cada abertura:** `journal_mode = WAL` (fica gravado no arquivo) e `secure_delete = ON` (vale por conexão, por isso é ligado a cada abertura): o SQLite zera os bytes que uma exclusão libera. Depois de apagar uma entrada ou de uma purga que apagou algo, `PRAGMA wal_checkpoint(TRUNCATE)` tira as páginas antigas do `-wal`; "Apagar tudo" faz `DELETE` + checkpoint + `VACUUM` + checkpoint, para o texto apagado não ficar legível no arquivo (FR-HIST-14, RISK-034).
- **Gravação:** `INSERT … ON CONFLICT (id) DO NOTHING` e a purga da retenção **na mesma transação** (`BEGIN IMMEDIATE` … `COMMIT`; `HistoryStore.save`). Não é `INSERT OR IGNORE`, que também engole violação de `CHECK` em silêncio (achado do spike, ADR-09): só o `id` repetido é ignorado, e `CHECK` ou `NOT NULL` violado conta como gravação falha (FR-HIST-17).
- **Busca:** varredura das entradas com a função SQL `ts_normalize`, registrada na conexão (`db.function`) com o mesmo `normalizeForSearch` aplicado ao termo (`src/main/history/search.ts`: caixa, acento e pontuação viram espaço) — `instr(ts_normalize(text), :term) > 0`. Sem FTS5 nem índice de texto (spec `historico` D5).
- **Quando não abre** — sem `LOCALAPPDATA`, driver ausente, arquivo que não é banco (`SQLITE_26`), migration que falha, versão mais nova que a conhecida (`schema_too_new`), disco ou permissão: `history_unavailable` com só o `name`; nada é reparado, renomeado nem apagado (spec `historico` D7); o ditado segue igual e as telas mostram "Histórico indisponível — o ditado continua funcionando" (FR-HIST-16, RISK-035).

### `dictations`

**FATO (18/out/2026, `database/local/0001_init.sql`).** Uma linha por ditado que **terminou com texto**: colado (`inserted`), deixado no clipboard (`copied`) ou com a inserção quebrada depois de o texto existir (`failed`). Gravada pela `HistoryPort` da sessão **depois** da linha `dictation_done` (ou `session_exception`) do log, para a colagem e o `total_ms` nunca esperarem o banco (FR-HIST-01…04; `SessionController.record`, `src/main/session.ts:240-249`). Com a retenção em `0`, nada é gravado.

```sql
-- database/local/0001_init.sql (o arquivo, como está)
CREATE TABLE dictations (
  id          TEXT PRIMARY KEY,                                    -- sessionId (UUID v4)
  created_at  TEXT NOT NULL,                                       -- ISO-8601 UTC, with ms
  text        TEXT NOT NULL CHECK (length(text) > 0),
  audio_ms    INTEGER NOT NULL CHECK (audio_ms >= 0),
  status      TEXT NOT NULL CHECK (status IN ('inserted', 'copied', 'failed'))
);

CREATE INDEX idx_dictations_created_at ON dictations (created_at DESC, id DESC);
```

| Coluna | Tipo e regra | O que guarda |
| --- | --- | --- |
| `id` | `TEXT PRIMARY KEY` | O `sessionId` do ditado (UUID v4). Uma sessão gera no máximo uma entrada; repetido → ignorado (`ON CONFLICT (id) DO NOTHING`) |
| `created_at` | `TEXT NOT NULL` | ISO-8601 em UTC com milissegundos (`Date.toISOString()`), o instante em que a inserção terminou |
| `text` | `TEXT NOT NULL CHECK (length(text) > 0)` | Exatamente o texto entregue ao `TextInserter` |
| `audio_ms` | `INTEGER NOT NULL CHECK (audio_ms >= 0)` | Duração da gravação, o mesmo `audio_ms` do `dictation_done`, arredondada e nunca negativa (`HistoryService.save`) |
| `status` | `TEXT NOT NULL CHECK (status IN ('inserted', 'copied', 'failed'))` | Resultado da inserção (`InsertOutcome`) ou `failed` (FR-HIST-02) |

- **Índice** `idx_dictations_created_at (created_at DESC, id DESC)`: a lista paginada da mais nova para a mais antiga, com o `id` como desempate do cursor (`<createdAt>~<id>`, `src/main/history/ipc.ts`), o agrupamento por dia e a purga `created_at < corte` (FR-HIST-07…09).
- **Nunca gravados:** áudio, o conteúdo do clipboard da pessoa, nome do app ou executável em foco, título de janela, texto ao redor do cursor, segmentos e probabilidades do Whisper, termo de busca, a chave. Nenhuma coluna identifica o app em foco (spec `historico` §9).
- **Criptografia em repouso:** nenhuma além da proteção da conta do Windows na v1 (decisão do Victor de 18/out/2026, RISK-030).

**O que mudou em relação ao plano anterior deste documento** (spec `historico` §9, cada item com a sua decisão): o arquivo saiu de `%APPDATA%` (Roaming) para `%LOCALAPPDATA%` (Local, decisão M6); `text_raw` + `text_final` viraram uma coluna só, `text` (D1); `status` ficou só com `inserted`, `copied` e `failed` — saíram `empty` e `cancelled` — e o texto passou a `NOT NULL`, porque só ditado com texto vira entrada (D2); saíram `mode`, `latency_ms`, `provider`, `model` e `error_code`, que são métrica e já estão no log (D2); o índice ganhou o `id` como desempate e o `idx_dictations_status` saiu, porque nenhuma consulta filtra por status (D5).

### `dictionary_terms` (Fase 2 — planejado)

**PLANEJADO (Fase 2).** Termos do dicionário pessoal (FR-VOCAB-01), enviados no `prompt` do Whisper e na limpeza.

```sql
CREATE TABLE dictionary_terms (
  id          TEXT PRIMARY KEY,
  term        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  source      TEXT NOT NULL CHECK (source IN ('manual', 'learned')),
  created_at  TEXT NOT NULL,
  use_count   INTEGER NOT NULL DEFAULT 0
);
```

### `schema_migrations`

**FATO (18/out/2026).** Uma linha por migration aplicada ([Migrations](#migrations)), com `applied_at` em ISO-8601 UTC. Não está em nenhum `.sql`: o aplicador a cria antes da `0001`, se ela ainda não existir (`applyMigrations`, `src/main/history/migrations.ts`):

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)
```

### Diagrama

O SQLite local hoje — `dictations` e `schema_migrations` **FATO**, `dictionary_terms` **PLANEJADO (Fase 2)**:

```text
┌──────────────────────────┐        ┌──────────────────────────┐
│ dictations (FATO)        │        │ schema_migrations (FATO) │
├──────────────────────────┤        ├──────────────────────────┤
│ id          TEXT PK      │        │ version     INTEGER PK   │
│ created_at  TEXT         │        │ applied_at  TEXT         │
│ text        TEXT         │        └──────────────────────────┘
│ audio_ms    INTEGER      │
│ status      TEXT         │        ┌──────────────────────────┐
└──────────────────────────┘        │ dictionary_terms         │
                                    │ PLANEJADO (Fase 2)       │
                                    ├──────────────────────────┤
                                    │ id          TEXT PK      │
                                    │ term        TEXT UNIQUE  │
                                    │ source      TEXT         │
                                    │ created_at  TEXT         │
                                    │ use_count   INTEGER      │
                                    └──────────────────────────┘
```

Sem relação nem chave estrangeira entre as tabelas. Fora do banco, o `history.retentionDays` do `config.json` limita quanto tempo uma linha de `dictations` vive (spec `historico` §9.1).

## Regras encarnadas no schema

**`config.json` e `groq-key.bin` (FATO):**

- **Config inválida nunca derruba o app** — cada campo inválido cai no default com aviso no log (BR-012, `src/main/config.ts:63-118`).
- **Faixas e vocabulários fechados** conferidos no código: `hotkey` só entre as 16 teclas de `HOTKEY_CODES`; `holdThresholdMs` e `maxRecordingMs` inteiros dentro da faixa; `language` com duas letras; `transcription.provider` só `groq` e `transcription.model` entre os dois modelos aceitos; `pill.position` entre as duas posições; `sounds` booleano; `history.retentionDays` `0`, inteiro de 1 a 3650 ou `null`; `theme` entre `system`, `light` e `dark`. As mesmas regras valem para o que a janela grava (FR-UI-28, FR-HIST-19, FR-UI-40).
- **`version: 1`** grava a versão do formato para uma migração futura (ver [Migrations](#migrations)); os três gravadores a preservam, e os campos aditivos `history` e `theme` não a mudaram.
- **Gravação atômica:** `config.json` e `groq-key.bin` são escritos num arquivo temporário na mesma pasta (`.tmp`, com `flush`) e renomeados por cima; uma falha no meio deixa o arquivo anterior (`src/main/atomic-file.ts:15-39`).
- **Uma fila só para o `config.json`:** o `ConfigWriter` serializa as gravações e cada uma troca só os seus campos — as sete preferências, a retenção ou o tema (FR-UI-29, FR-HIST-20, FR-UI-40). Um `config.json` que não é objeto JSON nunca é sobrescrito pela janela.
- **Chave nunca em texto puro em disco** (BR-016): só cifrada, no `groq-key.bin`; sem cifra disponível, o salvamento é recusado.
- São dois arquivos de um documento cada: não há unicidade nem relação a garantir. Salvar as mesmas preferências, a mesma retenção, o mesmo tema ou a mesma chave duas vezes deixa o mesmo estado.

**Histórico — SQLite (FATO, `0001_init.sql`):**

- `CHECK` fecha o vocabulário de `dictations.status` (`inserted`, `copied`, `failed`) e as faixas: `length(text) > 0` e `audio_ms >= 0`. Só ditado com texto vira entrada (spec `historico` D2).
- `NOT NULL` nas cinco colunas; `id` é a chave primária e vale o `sessionId`: uma entrada por sessão, gravação idempotente no `id` (`ON CONFLICT (id) DO NOTHING`), sem engolir violação de `CHECK`.
- Índice `idx_dictations_created_at (created_at DESC, id DESC)` para a lista, o cursor e a purga.
- `schema_migrations.version` é chave primária: a mesma migration nunca fica registrada duas vezes.

**Dicionário (PLANEJADO, Fase 2):**

- `CHECK` fecha `dictionary_terms.source` (`manual`, `learned`); `dictionary_terms.term` é `UNIQUE COLLATE NOCASE`: o mesmo termo com outra caixa não entra duas vezes; `use_count` começa em `0`.

## Campos de auditoria e retenção

| Onde | O que registra | Status |
| --- | --- | --- |
| Log | Tempos (`recorded_ms`, `latency_ms`, `transcribe_ms`, `total_ms`), tamanhos (`audio_ms`, `audio_bytes`, `chars`), resultado da inserção (`outcome`: `inserted` ou `copied`), códigos de erro, versão do app e do Electron e a origem da chave em uso (`groq_key`: `stored`, `env`, `none` ou `unreadable`) (`src/main/session.ts:144-148`, `:165`, `:218-227`; `src/main/index.ts:437-445`); da janela principal, só nomes de campo alterados, estados e códigos; do histórico, só contagens, tempos e nomes de erro ([`ENVIRONMENT.md`](ENVIRONMENT.md#log)) | **FATO** |
| `dictations` | `created_at` (quando a inserção terminou), `audio_ms` e `status` (resultado da inserção), ao lado do `text` | **FATO** (18/out/2026) |

**Retenção do log, do `config.json` e da chave (FATO):** o log só tem a rotação por tamanho (três arquivos de até 5 MB); não há expiração por data. O `config.json` vive até o usuário apagá-lo. O `groq-key.bin` vive até "Remover chave" ou até a pasta de dados ser apagada; o que a desinstalação faz com ele — e com o banco — é da spec [`distribuicao-windows-macos`](spec/features/distribuicao-windows-macos.md).

**Retenção do histórico (FATO, 18/out/2026 — FR-HIST-06, FR-HIST-07, FR-HIST-20; `src/main/history/retention.ts`, `service.ts`):**

| `history.retentionDays` | O que acontece |
| --- | --- |
| `0` — "Nunca guardar" | Nenhum ditado é gravado, a purga apaga tudo, e as telas mostram o histórico desligado (`status: 'disabled'`) |
| `1` a `3650` — "Por N dias" (padrão `30`) | A purga apaga as entradas com `created_at` anterior a agora − N × 24 h (corte em UTC) |
| `null` — "Para sempre" | Nada é purgado; só "Apagar" e "Apagar tudo" removem |

- **Quando purga:** ao abrir o app, depois das migrations (o `history_ready` diz quantas foram, em `purged`); depois de cada gravação, na mesma transação do `INSERT`; e ao mudar a retenção pela janela, na hora, só depois de o `config.json` ser gravado (log `history_retention_changed` e, se apagou algo, aviso `history:changed` `purged` à janela). Falha na purga → `history_purge_failed` (`name`), e o app segue.
- **Apagar:** "Apagar" (uma entrada) faz `DELETE` + checkpoint do WAL; "Apagar tudo", confirmado em dois passos na própria tela e com `{ confirmed: true }` exato no IPC, faz `DELETE` + checkpoint + `VACUUM` + checkpoint. Com `secure_delete=ON`, o texto apagado não fica legível no `.db` nem no `-wal` (RISK-034). À mão: com o app fechado, apagar os três arquivos ([comandos](#sgbd)).
- **O que não é persistido:** a contagem de ditados que falharam ao gravar (`unsavedCount`) vive só na memória, desde que o app abriu (FR-HIST-17).
- **O banco é do usuário:** nunca sai da máquina (não há sync antes da Fase 4), e a pasta Local não acompanha perfil móvel (RISK-031).

## Migrations

**SQLite local (FATO, desde 18/out/2026 — spec de migração [`historico-dados-v1`](spec/features/historico-dados-v1.md), FR-HIST-27…29):**

- **Arquivos:** `database/local/NNNN_descricao.sql` (quatro dígitos, `_`, minúsculas, números e `_`), só para frente — sem "down". Hoje existe só a `0001_init.sql` (`dictations` e o índice). O build os copia para `frontend/dist/database/local/` (`scripts/copy-static.mjs`), de onde o main os lê (`readMigrations`, `src/main/history/migrations.ts`). Pasta sem nenhum `.sql` → `migrations_missing`; número repetido → `migration_duplicated`; nos dois casos, histórico indisponível.
- **Ao abrir o app** (`applyMigrations`): cria `schema_migrations` se faltar, lê a maior versão registrada e aplica, em ordem, cada migration de número maior — cada uma numa transação própria: `BEGIN IMMEDIATE`, o SQL, o `INSERT` em `schema_migrations` (`version`, `applied_at`) e `COMMIT`. Uma que falha leva `ROLLBACK`: nada dela fica, a versão dela não é registrada e o histórico fica indisponível (FR-HIST-29). Migration registrada não roda de novo (FR-HIST-27).
- **Banco de uma versão mais nova do app** (versão registrada maior que a última que este app conhece): `schema_too_new`, o arquivo fica intacto, o histórico fica indisponível e o ditado funciona (FR-HIST-28).
- **Nada a rodar à mão:** não há comando de "migrate"; `npm run dev` / `npm start` (e o app instalado, depois) aplicam sozinhos.
- **Mudança de schema** = arquivo novo, com o número seguinte; uma migration já aplicada nunca é editada. Escrever a spec da migração a partir de [`templates/TEMPLATE-spec-migracao.md`](templates/TEMPLATE-spec-migracao.md) e atualizar este documento no mesmo trabalho.
- **Rollback do código:** voltar ao commit anterior basta para abrir e ditar, mas o texto ditado continua no disco: com o app fechado, apagar `touch-speaker.db`, `touch-speaker.db-wal` e `touch-speaker.db-shm` de `%LOCALAPPDATA%\Touch Speaker\` (historico-dados-v1 §12). O campo `history` pode ficar no `config.json`: o app de antes o ignora.

**`config.json` (FATO):**

- **Campo aditivo com default não sobe a `version`.** É o caso de `history.retentionDays` e `theme` (18/out/2026): o formato de antes é lido com os defaults, sem transformar nada; o app de antes ignora o campo (desconhecido) e o preserva ao salvar preferências (`mergeSettings`). Por isso `version` continua `1` (historico-dados-v1 §6.6; o Victor confirma na validação — §14 #1).
- **"Subir `version`" vale para mudança que não é aditiva** — renomear, mudar o tipo ou remover um campo —, que é quando o app precisa reconhecer o formato antigo. Nesse caso: subir `version`, escrever a spec da migração a partir do template e atualizar este documento no mesmo trabalho. Como hoje `normalizeConfig` não confere `version`, a spec dessa primeira migração precisa dizer como o app reconhece o formato antigo.
- A abertura nunca regrava o arquivo: o campo novo só aparece no `config.json` de quem já usava depois da primeira mudança pela janela (a retenção ou o tema). O `groq-key.bin` é dado novo, não mudança de formato de um dado existente: nada a migrar.

**Fase 4 (PLANEJADO):** migrations do banco do servidor em `database/server/`; fora do escopo agora.

## Seed

Não se aplica: não há dado de exemplo. O `config.json` nasce com os defaults na primeira execução, o log nasce vazio, o `groq-key.bin` só passa a existir depois de "Salvar chave" e o `touch-speaker.db` nasce na primeira abertura com a `dictations` vazia (historico-dados-v1 §8: não há histórico antigo a importar). Os testes do banco (TEST-015) criam os próprios dados em pasta temporária e nunca tocam a pasta real.

## Pendências conhecidas

Em 18/out/2026:

- **historico-dados-v1 §14 #1** — o `config.json` continua em `version: 1` com os campos aditivos `history` e `theme`? Implementado assim; o Victor confirma (SDD, Apêndice B.2).
- **historico-dados-v1 §14 #2** — banco com versão maior que a conhecida fica indisponível sem tocar no arquivo (`schema_too_new`)? Implementado assim; o Victor confirma.
- **PEND-009** — roteiro VH1–VH13 da spec `historico` e o ensaio com dado real da `historico-dados-v1` (§10: cópia do `config.json` real, `history_ready` no log, arquivo em `%LOCALAPPDATA%\Touch Speaker\`), com o Victor.

Pendências do projeto: [SDD, Apêndice B](spec/spec-driven-development.md#apêndice-b--pendências).

---

Arquitetura: [`ARCHITECTURE.md`](ARCHITECTURE.md) · Integração: [`INTEGRATION.md`](INTEGRATION.md) · API: [`API.md`](API.md) · Ambiente: [`ENVIRONMENT.md`](ENVIRONMENT.md) · Pendências e riscos: [`spec/spec-driven-development.md`](spec/spec-driven-development.md)
