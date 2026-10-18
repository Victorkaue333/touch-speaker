# Política de Segurança — Touch Speaker

O Touch Speaker ouve o **microfone**, observa o **teclado** de todo o Windows (hook global), escreve no
**clipboard**, simula **Ctrl+V** no app em foco e usa a **chave de API da Groq** do usuário. Uma falha aqui
pode **abrir o microfone fora de um ditado**, **vazar o que a pessoa fala, copia ou digita** (texto
ditado, clipboard, teclas) ou a chave para log, disco ou rede, **inserir texto na janela errada** ou
**furar o isolamento do Electron** (a pílula ou a janela principal chegando a Node ou a canais que não são
dela). Por isso todo relato é tratado com prioridade.

Este arquivo diz **como reportar** uma vulnerabilidade. Como escrevemos código seguro, os controles que
existem e os riscos já conhecidos estão em [`docs/Security-Guide.md`](docs/Security-Guide.md); o contrato
do sistema está no SDD ([`docs/spec/spec-driven-development.md`](docs/spec/spec-driven-development.md)).

> Última atualização: 18/out/2026 · Mantenedor: Victor Alves

## Versões e ambientes cobertos

O projeto **não tem release publicada**: nenhuma tag, nenhum instalador, nenhuma distribuição antes da
Fase 4 (ADR-06). O app roda em modo de desenvolvimento (`npm run dev`, a partir de `frontend/`), no
Windows de quem o compila, com a chave da Groq da própria pessoa. A versão do app é a do
`frontend/package.json` (`0.1.0`).

| Versão / branch | Estado | Coberto |
| --- | --- | :---: |
| `0.1.x` (Fase 1, em desenvolvimento) — branch `main` | Fase 1 implementada (T1–T8) e em verificação (T9); funcionando de ponta a ponta no PC do mantenedor desde 17/out/2026. A janela principal e a chave no `safeStorage` (spec `janela-principal`) entraram no código em 18/out/2026, ainda sem commit e com o roteiro manual pendente | ✅ |
| Outras branches | Não existem hoje | ❌ |

Diga no relato em qual commit de `main` você confirmou o problema.

**No escopo:** o que está neste repositório — o app em `frontend/` (processo main, preloads, pílula, janela
principal, scripts e dependências declaradas no `package.json`) e os docs que orientam como ele trata dados.
Temas especialmente relevantes para este projeto:

- microfone aberto fora de uma sessão de ditado;
- teclas, texto ditado, clipboard ou chave de API indo para log, disco ou rede — inclusive a chave voltando
  da janela principal para o renderer ou parando em disco em texto puro;
- texto inserido numa janela diferente da esperada;
- falhas de isolamento do Electron (preload, IPC, permissões).

As superfícies (microfone, hook de teclado, clipboard, `SendInput`, rede, IPC da pílula, renderer e IPC da
janela principal, `groq-key.bin`, item de login do sistema, `config.json`, `.env`) e a defesa de cada uma
estão no [Security Guide §2](docs/Security-Guide.md#2-superfícies-e-modelo-de-ameaça). Regras internas e checklist:
[`docs/Security-Guide.md`](docs/Security-Guide.md).

## Como reportar

**Não abra issue pública**, PR ou discussão sobre uma vulnerabilidade, nem a comente em grupo ou canal
aberto.

- **Canal:** o reporte privado do GitHub — aba **Security** do repositório → **Report a
  vulnerability**. Ele mantém o relato e a correção fora da vista pública até a divulgação.

Inclua, se possível:

1. O que acontece e qual o impacto (ex.: vazamento de texto ditado, do clipboard ou da chave de API).
   Diga em especial se o furo **abre o microfone fora de um ditado**, **leva conteúdo para log, disco ou
   rede**, **insere texto em outra janela** ou **dá à pílula ou à janela principal acesso que ela não
   deveria ter**.
2. Os passos para reproduzir.
3. A versão do app, o commit, a versão do Windows e o trecho do log
   (`%APPDATA%\Touch Speaker\logs\main.log`) — o log não contém texto ditado.
4. Uma sugestão de correção, se tiver.

**Nunca cole a chave da Groq** (sua ou de alguém) no relato, nem o conteúdo de um `.env` ou do
`groq-key.bin`: diga onde a encontrou, no formato `arquivo:linha`. Se o achado tiver relação com um risco já
registrado (`RISK-001` a `RISK-029`, no registro do
[SDD §26](docs/spec/spec-driven-development.md#26-riscos-e-mitigações); os de segurança estão descritos no
[Security Guide §18](docs/Security-Guide.md#18-riscos-conhecidos-em-aberto)), cite o número e diga o que ele
acrescenta.

### Chave de API vazou?

Revogue no console da Groq (console.groq.com → API Keys) imediatamente e gere outra. Salve a nova em
Configurações, na janela principal (abra o Touch Speaker pela bandeja), ou use "Remover chave" para só tirar a
antiga da máquina. Nunca faça commit do arquivo `frontend/.env`.

## O que acontece depois

| Etapa | Prazo |
| --- | --- |
| Resposta inicial | em até 7 dias |
| Avaliação inicial e severidade | a definir |
| Correção de severidade crítica ou alta | a definir |
| Aviso de que foi corrigido | quando a correção chegar a `main` |

### Divulgação coordenada

- Enquanto a correção não chegar a `main`, pedimos sigilo sobre a vulnerabilidade. Combinamos com
  você quando e como o caso pode ser divulgado.
- O Touch Speaker é **software proprietário** — todos os direitos reservados ([`LICENSE.md`](LICENSE.md)).
  Reportar não concede permissão de uso, cópia ou distribuição do código; reproduzir trechos dele numa
  divulgação pública depende de autorização prévia e por escrito do titular.
- Parte dos riscos já é pública, porque está escrita em [`docs/Security-Guide.md`](docs/Security-Guide.md).
  Isso não muda o pedido: o caminho de exploração de um risco conhecido também se reporta em privado.

## Regras para testar

Pedimos que você:

- Teste **só na sua máquina**, com o app aberto por `npm run dev` a partir de `frontend/` (passo a passo
  no [`README.md`](README.md)), e **com a sua própria chave** da Groq.
- **Não use chave de terceiros.** Se esbarrar numa chave que não é sua, não a use: reporte onde a encontrou.
- **Não faça negação de serviço** nem teste de carga contra a Groq; ela é serviço de terceiro, sob os
  termos de uso dela.
- **Não capture fala, texto ditado, clipboard ou teclas de outra pessoa.** Se esbarrar em dado de
  terceiro, pare, não guarde cópia e conte no relato.
- Não use uma falha encontrada para ganhar acesso além do necessário para demonstrá-la.

## Fora do escopo

- Serviços de terceiros (a Groq, o GitHub) e as bibliotecas de que o projeto depende (Electron, `koffi`,
  `uiohook-napi`). Reporte ao fornecedor e avise a gente se o problema afetar o Touch Speaker.
- O histórico do clipboard do Windows (`Win + V`) guardando o texto ditado: risco aceito e documentado
  (RISK-008).
- A chave em texto puro no `frontend/.env` durante o desenvolvimento: risco aceito só em dev (RISK-009). O
  `.env` continua aceito como reserva só com o app não empacotado; a chave digitada em Configurações fica
  cifrada pelo `safeStorage` do Electron no `groq-key.bin`, e o app empacotado nem lê o `.env` (ADR-08).
- Outro processo rodando como o mesmo usuário do Windows conseguir decifrar o `groq-key.bin`: a DPAPI protege
  por usuário, não por app — risco aceito (RISK-021).
- O conteúdo de [`docs/referencia/estudo-typeless.md`](docs/referencia/estudo-typeless.md): é estudo de
  referência, não normativo, e não descreve o Touch Speaker.
- Achados de scanner automático sem prova de impacto.
- Ataques que exigem a máquina da vítima já comprometida.

## Recompensa

Não há bug bounty nem recompensa financeira. O Touch Speaker é software proprietário
([`LICENSE.md`](LICENSE.md)).
