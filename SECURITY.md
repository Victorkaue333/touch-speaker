# Política de segurança

## Versões cobertas

| Versão | Suporte |
| --- | --- |
| 0.1.x (Fase 1, em desenvolvimento) | ✅ |

## Como reportar uma vulnerabilidade

**Não abra issue pública.** Use o reporte privado do GitHub: aba **Security** do repositório →
**Report a vulnerability**.

Inclua, se possível:

- o que acontece e qual o impacto (ex.: vazamento de texto ditado, do clipboard ou da chave de API);
- passos para reproduzir;
- versão do app, do Windows e o trecho do log (`%APPDATA%\Touch Speaker\logs\main.log`) — o log não
  contém texto ditado.

Resposta inicial em até 7 dias.

## Escopo

Temas especialmente relevantes para este projeto:

- microfone aberto fora de uma sessão de ditado;
- teclas, texto ditado, clipboard ou chave de API indo para log, disco ou rede;
- texto inserido numa janela diferente da esperada;
- falhas de isolamento do Electron (preload, IPC, permissões).

Regras internas e checklist: [docs/Security-Guide.md](docs/Security-Guide.md).

## Chave de API vazou?

Revogue no console da Groq (console.groq.com → API Keys) imediatamente e gere outra. Nunca faça
commit do arquivo `frontend/.env`.
