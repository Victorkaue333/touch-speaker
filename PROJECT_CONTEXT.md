# PROJECT_CONTEXT — Touch Speaker

> Última atualização: 17/out/2026 · Mantenedor: Victor Alves
> **Dono:** Victor Alves · **Criado em:** 17/out/2026 · **Status:** Fase 1 (MVP) implementada (T1–T8), em verificação (T9)
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

- **Fase 1 — MVP:** substituir o Typeless no uso diário do Victor no fluxo básico de ditado.
- **Fase 2 — Qualidade:** texto sai "pronto": sem vícios de fala, com o vocabulário da pessoa.
- **Fase 3 — Contexto:** o texto se adapta ao app em que está sendo escrito; comandos por voz sobre texto
  selecionado.
- **Fase 4 — Produto:** distribuir para outras pessoas com conta, backend próprio e instalador assinado.

## Métricas de sucesso

| Métrica | Meta | Estado em 17/out/2026 |
| --- | --- | --- |
| Fase 1 concluída | O Victor passar 5 dias úteis seguidos usando só o Touch Speaker, sem abrir o Typeless | A medir — depende do fim do T9 (PEND-001) |
| Latência (NFR-01) | p50 ≤ 1,5 s e p95 ≤ 3 s do soltar da tecla até o texto inserido, para falas de até 30 s | Dois ditados medidos no V2 (0,88 s e 0,66 s); p50/p95 sem medição (PEND-001) |
| Confiabilidade | ≥ 95% das gravações terminam com texto inserido (o resto com erro claro, nunca em silêncio) | A medir no uso real |
| Zero lixo | Toque acidental na tecla não pode digitar nada | Filtros implementados (BR-005, BR-006; TEST-002); verificação manual V8 pendente |

### Hipóteses a validar

| # | Hipótese | Como validar |
| --- | --- | --- |
| H1 | Whisper `large-v3-turbo` via Groq é bom o bastante em pt-BR para uso diário sem pós-edição pesada | Uso real por 1 semana; anotar quantas transcrições precisam de correção |
| H2 | Latência de ~1–1,5 s entre soltar a tecla e o texto aparecer é aceitável, mesmo sem streaming | Medir p50/p95 nos logs locais; percepção do usuário |
| H3 | O plano gratuito da Groq cobre o uso de uma pessoa | Contar requisições e segundos de áudio por dia contra o limite do console |
| H4 | Colar via clipboard + Ctrl+V funciona nos apps que o Victor usa | Checklist de apps ([critérios de aceite do PRD](docs/PRD.md#critérios-de-aceite)) |

Nenhuma das quatro está validada ainda (PEND-003).

## Escopo

**Dentro do escopo (Fase 1, implementado no código — T1–T8; verificação manual em PEND-001):**

- Atalho global: segurar para falar, toque para mãos livres e `Esc` para cancelar (FR-DICT-01…03)
- Gravação do microfone na pílula e transcrição via Groq (FR-DICT-04)
- Inserção do texto no app em foco, com o clipboard preservado e fallback de colagem (FR-DICT-05, 06, 10)
- Pílula flutuante de status, filtros anti-lixo e erros visíveis (FR-DICT-07, 08, 09)
- Limite de 5 min por gravação, ícone na bandeja e config em arquivo (FR-DICT-11, 12, 13)

**Fora de escopo (por enquanto):**

- Limpeza de texto por IA, dicionário pessoal, histórico (Fase 2)
- Tradução, comandos por voz ("Ask Anything"), contexto do app (Fase 3)
- Contas, backend (Fase 4)
- macOS/Linux/mobile

A ordem de entrada está no roadmap do [PRD](docs/PRD.md#roadmap).

## Riscos e dependências

- **Groq muda ou corta o plano gratuito** (RISK-001) — o MVP para de transcrever. Mitigação: transcrição
  atrás de interface (`Transcriber`); trocar por OpenAI ou whisper.cpp local é um adapter novo.
- **Whisper "alucina" frases em silêncio** ("Legendas pela comunidade Amara.org") (RISK-002) — texto
  falso inserido no documento do usuário. Mitigação: filtro de duração mínima + `no_speech_prob`
  (FR-DICT-08).
- **App de destino rodando como administrador** (RISK-003) — o Windows bloqueia o Ctrl+V simulado
  (UIPI). Mitigação: detectar a elevação, deixar o texto no clipboard e avisar na pílula (FR-DICT-10);
  verificação manual V10 pendente.
- **Módulos nativos (`uiohook-napi`, `koffi`) quebram numa versão nova do Electron** (RISK-004) — o app
  não abre. Mitigação: versões fixadas; atualizar o Electron só com teste manual.
- **Copiar código ou assets do Typeless por engano** (RISK-005) — risco jurídico. Mitigação: regra de
  sala limpa: o estudo do Typeless é só referência e o material bruto fica fora do repositório
  ([Security Guide §15.3](docs/Security-Guide.md#153-sala-limpa-engenharia-reversa)).

O registro completo (RISK-001…014) está no [SDD §26](docs/spec/spec-driven-development.md#26-riscos-e-mitigações).

**Dependências externas:** Groq Cloud (transcrição), Windows 10+ x64, microfone.

---

Requisitos: [`docs/PRD.md`](docs/PRD.md) · Contrato de engenharia: [`docs/spec/spec-driven-development.md`](docs/spec/spec-driven-development.md) · Decisões: [`docs/DECISIONS.md`](docs/DECISIONS.md)
