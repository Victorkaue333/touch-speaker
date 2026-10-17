# Estudo de referência — como o Typeless funciona

> **Data:** 17/out/2026 · **Versão estudada:** Typeless 2.8.2 para Windows
> **Para que serve:** registrar o que aprendemos sobre o produto de referência e como isso orienta o
> Touch Speaker, fase a fase.

## Aviso: o que este documento é e o que não é

- É uma descrição, com palavras nossas, de **comportamento e arquitetura** observados na versão
  instalada no computador do Victor, para entender um produto de mercado e projetar o nosso.
- **Não contém** código do Typeless (nem decompilado), constantes, strings, endereços da API deles,
  chaves, nem detalhes de autenticação, assinatura de requisições ou controle de plano.
- Nada aqui é para ser copiado. O código do Touch Speaker é escrito do zero a partir da documentação
  pública da Microsoft, do Electron, do Chromium e da Groq ([ADR-07](../DECISIONS.md#adr-07--sala-limpa-em-relação-ao-typeless),
  [Security Guide §11](../Security-Guide.md#153-sala-limpa-engenharia-reversa)).
- O material bruto do estudo fica **fora do repositório**.

Legenda: **[observado]** visto no artefato instalado · **[inferido]** conclusão nossa a partir do observado.

## 1. Visão geral

- **[observado]** App Electron com interface em React. Janelas separadas: principal (início,
  histórico, dicionário), pílula flutuante de status, cartão de resposta do "Ask Anything",
  login e onboarding.
- **[observado]** O código JavaScript é ofuscado.
- **[observado]** Seis bibliotecas nativas próprias, chamadas via FFI: teclado global, inserção de
  texto, contexto do app em foco, utilidades do sistema (microfone, volume, WMI) e duas de compressão
  de áudio Opus.
- **[observado]** Histórico local em SQLite; configurações em arquivos JSON; telemetria de erros.
- **[observado]** O processamento de voz (transcrição e reescrita do texto) acontece no servidor deles.

## 2. Atalhos e modos de uso

- **[observado]** Três modos com atalhos próprios: **ditado**, **tradução** e **Ask Anything**
  (comando por voz sobre texto selecionado), além de "colar a última transcrição".
- **[observado]** Gestos: **segurar** para falar (soltar termina), **tocar** uma vez para começar e
  outra para terminar, **toque duplo** para mãos livres. Segurar por mais de ~0,6 s conta como
  "segurar"; dois toques dentro de ~0,4 s contam como toque duplo.
- **[observado]** Regras para atalhos personalizados: até 3 teclas, não só letras/números, sem atalhos
  reservados do sistema, botões do mouse permitidos.
- **[observado]** A biblioteca nativa de teclado só informa **quais teclas estão pressionadas agora**;
  a decisão de "isso é o atalho" é tomada no JavaScript. Ela roda num **processo separado**, para que
  um processo principal ocupado não atrase o hook de teclado.
- **[observado]** Limite de **9 minutos** por sessão, com aviso no último minuto.

## 3. Captura de áudio

- **[observado]** Áudio gravado na janela da pílula e comprimido em **Opus, 16 kHz, mono, ~32 kbps**.
- **[observado]** A compressão acontece **durante a fala**, em pedaços de ~3 s, num worker separado —
  quando a pessoa termina de falar, quase todo o áudio já foi enviado.
- **[observado]** Gravações ficam salvas localmente (arquivos `.ogg`), associadas ao histórico.
- **[observado]** Opção de silenciar o áudio do sistema enquanto a pessoa dita; detecção de
  "microfone melhor disponível".

## 4. Envio e processamento

- **[observado]** Caminho principal: uma **conexão WebSocket** aberta enquanto a pessoa está logada.
  Mensagens de início, pedaços de áudio (com confirmação de recebimento pelo servidor), atualização
  do contexto e fim.
- **[observado]** Caminho reserva: se a rede está fraca (pedaços sem confirmação), o app envia a
  gravação inteira num único **POST multipart** HTTP.
- **[observado]** O **contexto** é enviado em duas etapas: um contexto leve no início (para não
  atrasar) e um contexto completo logo depois, coletado em paralelo enquanto a pessoa fala.
- **[observado]** Tempos-limite de ~20 s para ditado e ~30 s para Ask Anything.
- **[inferido]** A transcrição e a "limpeza" do texto (tirar vícios de fala, corrigir autocorreções,
  formatar listas, ajustar o tom ao app) são feitas pelo servidor com modelos de linguagem.

## 5. Contexto coletado sobre o app em foco

- **[observado]** Para cada ditado: nome e caminho do app, título da janela, se é navegador (com
  título, domínio e URL da página), posição do campo na tela, papel de acessibilidade do campo, se é
  editável, texto antes e depois do cursor, texto selecionado e texto visível na tela.
- **[observado]** Tudo isso vem da **UI Automation** do Windows, numa thread dedicada, com tempos-limite
  curtos (centenas de ms) e cache.
- **[observado]** Para que apps baseados em Chromium (Chrome, Edge, VS Code, Slack, WhatsApp Desktop…)
  exponham o texto, o app usa um **protocolo público do Chromium para detectar tecnologia assistiva**:
  com isso o Chromium ativa a árvore de acessibilidade completa da janela. Sem esse passo, a UI
  Automation enxerga pouco ou nada dentro dessas janelas.
- **[observado]** "Campo editável?" é decidido por uma heurística em etapas: tipo do controle, foco,
  se o campo aceita valor e não é somente leitura, e atributos de somente leitura no texto.
- **[observado]** Listas de bloqueio e liberação por app e por URL, vindas do servidor, decidem onde
  o contexto pode ser lido.

## 6. Inserção do texto

- **[observado]** O texto é inserido pelo **clipboard + Ctrl+V**, enviado como um único lote atômico de
  4 eventos de teclado (Ctrl↓ V↓ V↑ Ctrl↑). Os eventos sintéticos são marcados para que o próprio hook
  de teclado do app os ignore.
- **[observado]** Antes de colar, o app salva **todos os formatos** do clipboard (pulando alguns formatos
  de imagem legados) e restaura depois, numa thread separada, tentando de novo se o clipboard estiver
  ocupado.
- **[observado]** Para texto rico, o clipboard recebe HTML, RTF, um formato "Markdown" e texto puro ao
  mesmo tempo; o app de destino escolhe o que entende.
- **[observado]** Se o campo não é editável ou a colagem não é possível, o texto fica disponível para
  copiar ("copiar a última transcrição").

## 7. Aprendizado com as correções do usuário

- **[observado]** Depois de inserir, o app **observa o campo por até ~15 s** (lendo o conteúdo por
  acessibilidade e reagindo às teclas). Termina ao apertar Enter, trocar de campo, apagar tudo ou dar
  o tempo.
- **[observado]** Se a pessoa corrigiu o texto, o app envia o original e a versão editada ao servidor,
  que pode responder com uma **palavra nova para o dicionário pessoal** — o app mostra um aviso
  ("palavra adicionada ao dicionário").
- **[inferido]** É assim que o dicionário "aprende sozinho" nomes e termos.

## 8. Dados locais e privacidade

- **[observado]** Histórico local com texto final, modo, duração, microfone, app em foco e estado de
  sincronização; sincronização com a nuvem é opcional e vem desligada.
- **[observado]** O contexto salvo no histórico fica **criptografado** com uma chave do próprio usuário.
- **[observado]** O dicionário pessoal fica no servidor, não no banco local.

## 9. O que isso significa para o Touch Speaker

| Aprendizado | Decisão no Touch Speaker | Fase |
| --- | --- | --- |
| Gesto segurar / tocar | Adotado, simplificado: um limite de 500 ms separa segurar de tocar, sem toque duplo | 1 ✅ |
| Hook de teclado só informa teclas; decisão em JS | Adotado (`uiohook-napi` + `HotkeyController` testável) | 1 ✅ |
| Hook isolado do processo principal | Atendido de outra forma: o `uiohook` já roda numa thread própria | 1 ✅ |
| Inserção por clipboard + Ctrl+V atômico, com backup/restauração | Adotado, escrito do zero ([ADR-03](../DECISIONS.md#adr-03--inserção-por-clipboard--ctrlv-via-sendinput)) | 1 ✅ |
| Colagem bloqueada em janela de administrador | Detecção de elevação + aviso "Texto copiado" | 1 ✅ |
| Filtrar silêncio e lixo da transcrição | Adotado com regras próprias para alucinações do Whisper em pt-BR | 1 ✅ |
| Opus 16 kHz mono, ~32 kbps | Adotado (WebM/Opus no navegador do Electron) | 1 ✅ |
| Streaming por WebSocket durante a fala | Adiado: precisa de servidor próprio. Upload inteiro ao soltar já entrega < 1 s | 4 |
| Limpeza do texto por LLM no servidor | Fase 2 com Claude Haiku, atrás da interface `Refiner` | 2 |
| Dicionário pessoal | Fase 2 local (prompt do Whisper + limpeza); aprendizado por edição na Fase 3 | 2 / 3 |
| Histórico local em SQLite | Fase 2, sem guardar áudio | 2 |
| Contexto do app via UI Automation + ativação de acessibilidade do Chromium | Fase 3, implementado a partir da documentação da Microsoft e do Chromium | 3 |
| Ask Anything e tradução | Fase 3 | 3 |
| Contexto criptografado com chave do usuário | A considerar quando houver histórico com contexto | 3 |
| Telemetria de erros | Não na Fase 1; se vier, opt-in e sem conteúdo | — |
