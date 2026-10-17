# PROJECT_CONTEXT — Touch Speaker

> **Dono:** Victor Alves · **Criado em:** 17/out/2026 · **Status:** Fase 1 (MVP) em especificação
> **Idioma do produto:** pt-BR primeiro

## Problema

Escrever no computador é lento. Uma pessoa digita em média ~40 palavras por minuto e fala ~150.
Quem escreve muito ao longo do dia (mensagens, e-mails, documentos, prompts para IA) perde horas
digitando o que já tem pronto na cabeça.

O ditado que vem no Windows (`Win + H`) não resolve:

- funciona mal em português com termos técnicos e nomes próprios;
- não pontua bem e deixa o texto com cara de transcrição;
- não é rápido de acionar nem de encerrar.

Ferramentas como o Typeless provam que o "falo → aparece escrito em qualquer app" muda o jeito de
trabalhar. Mas são produtos fechados, pagos por assinatura e com dados passando pelo servidor deles.

## Para quem

1. **Primeiro usuário: o próprio Victor**, desenvolvedor no Windows, que escreve o dia inteiro em
   VS Code, Claude Code, navegador, WhatsApp e Slack, em pt-BR com termos técnicos em inglês.
2. **Depois (Fase 4):** profissionais brasileiros que escrevem muito no computador e querem ditado de
   qualidade em português.

## Proposta de valor

**Segure uma tecla, fale e o texto aparece onde o cursor está, em qualquer app do Windows.**
Sem trocar de janela, sem copiar e colar, sem configurar nada por app.

## Objetivos de negócio

| Fase | Objetivo |
| --- | --- |
| 1 — MVP | Substituir o Typeless no uso diário do Victor no fluxo básico de ditado |
| 2 — Qualidade | Texto sai "pronto": sem vícios de fala, com o vocabulário da pessoa |
| 3 — Contexto | O texto se adapta ao app em que está sendo escrito; comandos por voz sobre texto selecionado |
| 4 — Produto | Distribuir para outras pessoas com conta, backend próprio e instalador assinado |

## Hipóteses a validar

| # | Hipótese | Como validar |
| --- | --- | --- |
| H1 | Whisper `large-v3-turbo` via Groq é bom o bastante em pt-BR para uso diário sem pós-edição pesada | Uso real por 1 semana; anotar quantas transcrições precisam de correção |
| H2 | Latência de ~1–1,5 s entre soltar a tecla e o texto aparecer é aceitável, mesmo sem streaming | Medir p50/p95 nos logs locais; percepção do usuário |
| H3 | O plano gratuito da Groq cobre o uso de uma pessoa | Contar requisições e segundos de áudio por dia contra o limite do console |
| H4 | Colar via clipboard + Ctrl+V funciona nos apps que o Victor usa | Checklist de apps (§ critérios de aceite do PRD) |

## Métricas de sucesso

- **Fase 1 concluída quando:** o Victor passar 5 dias úteis seguidos usando só o Touch Speaker, sem
  abrir o Typeless.
- **Latência:** p50 ≤ 1,5 s e p95 ≤ 3 s do soltar da tecla até o texto inserido, para falas de até 30 s.
- **Confiabilidade:** ≥ 95% das gravações terminam com texto inserido (o resto com erro claro, nunca em silêncio).
- **Zero lixo:** toque acidental na tecla não pode digitar nada.

## Escopo

**Dentro (Fase 1):** atalho global segurar-para-falar e toque-para-mãos-livres; gravação do microfone;
transcrição via Groq; inserção do texto no app em foco; pílula flutuante de status; ícone na bandeja;
config em arquivo.

**Fora (por enquanto):** limpeza de texto por IA, dicionário pessoal, histórico, tradução, comandos por
voz ("Ask Anything"), contexto do app, contas, backend, macOS/Linux/mobile. A ordem de entrada está
no roadmap do [PRD](docs/PRD.md#roadmap).

## Riscos e dependências

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Groq muda ou corta o plano gratuito | MVP para de transcrever | Transcrição atrás de interface (`Transcriber`); trocar por OpenAI ou whisper.cpp local é um adapter novo |
| Whisper "alucina" frases em silêncio ("Legendas pela comunidade Amara.org") | Texto falso inserido no documento do usuário | Filtro de duração mínima + `no_speech_prob` (FR-DICT-08) |
| App de destino rodando como administrador | Windows bloqueia o Ctrl+V simulado (UIPI) | Detectar falha, deixar o texto no clipboard e avisar na pílula |
| Módulos nativos (`uiohook-napi`, `koffi`) quebram numa versão nova do Electron | App não abre | Versões fixadas; atualizar Electron só com teste manual |
| Copiar código ou assets do Typeless por engano | Risco jurídico | Regra de sala limpa: o estudo do Typeless é só referência e o material bruto fica fora do repositório ([Security Guide §11](docs/Security-Guide.md#11-sala-limpa-engenharia-reversa)) |

**Dependências externas:** Groq Cloud (transcrição), Windows 10+ x64, microfone.
