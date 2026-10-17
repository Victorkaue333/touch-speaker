# Security Guide — Touch Speaker

> **Versão:** 0.1 · **Data:** 17/out/2026

Um app que ouve o microfone, observa o teclado e mexe no clipboard tem acesso a muita coisa
sensível. Este guia diz o que o Touch Speaker pode e não pode fazer com cada uma delas.

## 1. O que protegemos

| Ativo | Por que é sensível |
| --- | --- |
| Voz do usuário | Dado pessoal; pode conter informação de terceiros |
| Texto ditado | Mensagens, e-mails, código, dados de clientes |
| Clipboard | Pode conter senhas, tokens, dados copiados de outros apps |
| Teclado | Um hook global é tecnicamente capaz de capturar tudo o que se digita |
| Chave da Groq (e da Anthropic na Fase 2) | Uso indevido gera custo e bloqueio da conta |

## 2. Modelo de ameaça (Fase 1)

- **Uso pessoal, máquina do próprio usuário.** Não há servidor nem outros usuários.
- O renderer **não carrega conteúdo remoto**: só arquivos locais do app. Mesmo assim é tratado como
  não confiável (defesa em profundidade).
- Ameaças consideradas: dependência npm comprometida, vazamento de chave por commit ou log, texto
  sensível parando em log, input sintético indo para a janela errada.

## 3. Microfone

- Aberto **só** entre `recorder:start` e `recorder:stop`/`cancel`. Todas as trilhas do
  `MediaStream` são paradas no fim; o indicador de microfone do Windows tem de apagar.
- Áudio fica em memória, vai para a Groq e é descartado. **Nunca gravado em disco.**
- Permissão de mídia concedida pelo main **só** para a janela da pílula e **só** para áudio
  (`session.setPermissionRequestHandler`); qualquer outro pedido é negado.

## 4. Teclado global

- O `HotkeyController` compara cada evento com a tecla configurada e o `Esc`, e **descarta** o resto
  na hora. A única informação tirada de outras teclas é um booleano "outra tecla foi pressionada
  enquanto a de ditado estava segurada", usado para não confundir atalho (Ctrl direito + C) com ditado.
- Proibido: guardar, logar, enviar ou acumular teclas ou seus códigos. O estado guardado é só "tecla
  de ditado pressionada: sim/não", o horário do último keydown dela e o booleano acima.
- O hook é encerrado (`uIOhook.stop()`) ao sair do app.
- Code review rejeita qualquer mudança que identifique teclas além da configurada e do `Esc`.

## 5. Segredos e chaves

| Fase | Onde fica a chave | Regra |
| --- | --- | --- |
| 1 (dev) | `frontend/.env` | No `.gitignore`. Nunca commitar. Nunca no renderer |
| 2 | `safeStorage` do Electron (DPAPI do Windows), digitada na tela de configurações | O `.env` deixa de ser lido no app empacotado |
| 4 | Só no `backend/`; o app autentica o usuário e o backend chama os provedores | **Nenhuma chave de provedor dentro de app distribuído** |

- **Não distribuir** o app com a chave de alguém embutida. Quem distribuir antes da Fase 4 entrega a
  própria conta da Groq a qualquer pessoa que abrir o `.asar`.
- A chave só existe no processo main e só sai dele no header `Authorization` para `api.groq.com`.
- Chave vazou? Revogar no console da Groq na hora e gerar outra.

## 6. Clipboard

- Backup e restauração ficam **em memória**, pelo menor tempo possível (~250 ms).
- Conteúdo do clipboard **nunca** vai para log, disco ou rede.
- Se a restauração falhar, o log registra só "restore_failed" e quantos formatos havia.
- Limitação aceita: gerenciadores de histórico (Win + V) registram o texto ditado. Documentado para
  o usuário no README.

## 7. Inserção de texto

- O Ctrl+V sintético vai para a janela que está em foco **no momento da inserção**. Se a pessoa
  trocou de janela durante a transcrição, o texto vai para a nova janela. Aceito na Fase 1 (é o
  comportamento esperado de "digitar onde está o cursor").
- Apps com privilégio de administrador bloqueiam input de processo comum (UIPI). O app **não** pede
  elevação para contornar isso: cai no fallback "texto copiado" (FR-DICT-10).
- Campos de senha não são detectados na Fase 1. Ditar num campo de senha equivale a digitar nele;
  nada extra vaza. A Fase 3 (UI Automation) passa a pular campos `IsPassword`.

## 8. Electron — endurecimento

Obrigatório para toda janela:

- [ ] `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`
- [ ] Preload expõe só a API listada em [API.md §3](API.md#3-contrato-ipc-main--pílula)
- [ ] CSP: `default-src 'self'; script-src 'self'; connect-src 'none'; img-src 'self' data:; media-src 'self' blob:`
- [ ] `setWindowOpenHandler(() => ({ action: 'deny' }))` e navegação bloqueada (`will-navigate`)
- [ ] Main valida tipo, tamanho e `sessionId` de toda mensagem IPC vinda do renderer
- [ ] Nenhum `remote`, nenhum `shell.openExternal` com URL vinda do renderer

## 9. Rede

- Única saída de rede na Fase 1: `https://api.groq.com` a partir do processo main.
- TLS obrigatório; sem desligar verificação de certificado em nenhum ambiente.
- **Sem telemetria** na Fase 1. Se um dia houver, será opt-in e sem conteúdo ditado.

## 10. Logs

- Podem conter: horários, durações, tamanhos, latências, códigos de erro, versão do app.
- **Não podem** conter: texto transcrito, áudio, clipboard, chave, teclas, título de janela.
- Logs ficam só na máquina (`%APPDATA%\Touch Speaker\logs`).

## 11. Sala limpa (engenharia reversa)

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

## 12. Privacidade (LGPD)

- A voz é enviada à Groq para transcrição. A política de dados da Groq se aplica a esse áudio. Na
  Fase 1 o único titular é o próprio usuário, que escolheu o provedor.
- Antes de distribuir (Fase 4): termo de uso e política de privacidade dizendo quais provedores
  recebem a voz, retenção de cada um, e opção de provedor local (whisper.cpp) para quem não quer
  enviar áudio para fora.
- Histórico (Fase 2) fica só na máquina, com retenção configurável e "apagar tudo".

## 13. Dependências

- Versões fixadas no `package-lock.json`; atualização de Electron/`uiohook-napi`/`koffi` só com teste
  manual do fluxo completo.
- `npm audit` antes de cada versão.
- Scripts de instalação de pacotes nativos ficam bloqueados por padrão; liberar só os necessários,
  por nome. Hoje `koffi` e `uiohook-napi` estão negados no `allowScripts` do `package.json`: os dois
  já trazem binários prontos para win32-x64 e não precisam compilar nada.
- O binário do Electron é baixado com verificação pelo `checksums.json` do próprio pacote.

## 14. Distribuição (Fase 4)

Assinatura de código do instalador, auto-update assinado, Electron Fuses (desligar
`RunAsNode`, `EnableNodeCliInspectArguments`, ligar integridade do ASAR).

## 15. Checklist de segurança do PR

- [ ] Nenhum segredo no diff (`.env`, chaves, tokens)
- [ ] Nada novo indo para log que esteja na lista proibida (§10)
- [ ] Nova mensagem IPC validada no main
- [ ] Nenhuma tecla além da configurada e do `Esc` é identificada (outras viram só um booleano)
- [ ] Microfone fecha em todos os caminhos (sucesso, cancelamento, erro)
- [ ] Nada copiado do Typeless nem do material bruto do estudo; nenhum binário de terceiro no diff

## 16. Riscos conhecidos em aberto

| Risco | Situação |
| --- | --- |
| Texto pode ir para a janela errada se o foco mudar durante a transcrição | Aceito na Fase 1 |
| Ditado em campo de senha | Sem detecção até a Fase 3 |
| Histórico do clipboard do Windows guarda o texto ditado | Aceito; documentado |
| Chave em `.env` em texto puro | Aceito só em dev; sai na Fase 2 |
