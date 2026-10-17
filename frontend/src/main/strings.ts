// Every user-facing text lives here (pt-BR), ready for i18n later.
import type { ErrorCode } from './errors';

export const strings = {
  listening: 'Ouvindo…',
  handsFreeHint: 'toque de novo para terminar',
  endsIn: (seconds: number) => `Termina em 0:${String(seconds).padStart(2, '0')}`,
  transcribing: 'Transcrevendo…',
  trayReady: 'Touch Speaker — pronto',
  trayRecording: 'Touch Speaker — ouvindo',
  trayNoKey: 'Touch Speaker — falta a chave da Groq',
  trayMicDefault: 'Microfone: padrão do Windows',
  trayMicCustom: 'Microfone: definido no config.json',
  trayOpenConfig: 'Abrir pasta de configuração',
  trayQuit: 'Sair',
} as const;

const errorMessages: Record<ErrorCode, string> = {
  no_api_key: 'Falta a chave da Groq — veja o README',
  invalid_api_key: 'Chave da Groq inválida',
  rate_limited: 'Limite gratuito da Groq atingido — tente em instantes',
  network_error: 'Sem conexão — tente de novo',
  provider_error: 'A Groq falhou — tente de novo',
  audio_too_large: 'Gravação longa demais',
  mic_denied: 'Sem permissão para usar o microfone',
  mic_unavailable: 'Microfone indisponível ou em uso',
  recorder_failed: 'Falha ao gravar',
  no_speech: '',
  paste_blocked: 'Texto copiado — cole com Ctrl+V',
  session_timeout: '',
};

export function errorMessage(code: ErrorCode): string {
  return errorMessages[code];
}
