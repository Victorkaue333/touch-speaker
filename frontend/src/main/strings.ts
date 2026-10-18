// Every user-facing text lives here (pt-BR), ready for i18n later. The renderers have no text of their
// own: the pill gets its texts in pill:state, the main window through app:get-strings (FR-UI-10).
import type { MainWindowStrings, PillPosition, TranscriptionModel } from '../shared/ipc';
import type { ErrorCode } from './errors';
import type { HotkeyName } from './keys';

// Texts that differ per system (spec distribuicao-windows-macos FR-MAC-10): on macOS nothing says "Windows" or
// "Ctrl+V", the paste shortcut is ⌘V, the tray is the menu bar and the keys have their Mac names.

/** The texts of the pill and of the tray / menu bar on `platform`. */
export function stringsFor(platform: NodeJS.Platform) {
  const mac = platform === 'darwin';
  return {
    listening: 'Ouvindo…',
    handsFreeHint: 'toque de novo para terminar',
    endsIn: (seconds: number) => `Termina em 0:${String(seconds).padStart(2, '0')}`,
    transcribing: 'Transcrevendo…',
    trayReady: 'Touch Speaker — pronto',
    trayRecording: 'Touch Speaker — ouvindo',
    trayNoKey: 'Touch Speaker — falta a chave da Groq',
    // FR-PKG-15 and FR-MAC-02: the hook is not running, so the status never says "pronto".
    trayHookDown: 'Touch Speaker — teclado indisponível',
    trayNoAccessibility: 'Touch Speaker — falta permissão de Acessibilidade',
    trayRetry: 'Tentar de novo',
    trayOpenAccessibility: 'Abrir Ajustes de Acessibilidade…',
    trayOpenMicrophone: 'Abrir Ajustes de Microfone…',
    trayRelaunch: 'Reabrir o Touch Speaker',
    trayMicDefault: mac ? 'Microfone: padrão do sistema' : 'Microfone: padrão do Windows',
    trayMicCustom: 'Microfone: definido no config.json',
    trayOpenWindow: 'Abrir Touch Speaker',
    trayOpenConfig: 'Abrir pasta de configuração',
    trayQuit: 'Sair',
    // Main window — "Como ditar" lines with the values in use (spec janela-principal §7, §10).
    homeHold: (key: string, ms: number) => `Segure ${key} por ${ms} ms ou mais, fale e solte: o texto aparece no cursor.`,
    homeTap: (key: string) => `Toque rápido em ${key}: grava com as mãos livres até o próximo toque.`,
    homeEsc: 'Esc cancela a gravação.',
  } as const;
}

/** The texts on the system the app runs on. */
export const strings = stringsFor(process.platform);

/** pt-BR names of the hotkeys of HOTKEY_CODES on `platform` (spec janela-principal §7; FR-MAC-10). */
export function hotkeyNamesFor(platform: NodeJS.Platform): Readonly<Record<HotkeyName, string>> {
  const mac = platform === 'darwin';
  return {
    RightCtrl: mac ? 'Control direito' : 'Ctrl direito',
    RightAlt: mac ? 'Option direita' : 'Alt direito',
    RightShift: 'Shift direito',
    CapsLock: 'Caps Lock',
    F13: 'F13',
    F14: 'F14',
    F15: 'F15',
    F16: 'F16',
    F17: 'F17',
    F18: 'F18',
    F19: 'F19',
    F20: 'F20',
    F21: 'F21',
    F22: 'F22',
    F23: 'F23',
    F24: 'F24',
    // Only offered on macOS (keys.ts); on a PC the same code is the right Windows key.
    RightMeta: mac ? 'Command direito' : 'Tecla Windows direita',
  };
}

/** The hotkey names on the system the app runs on. */
export const hotkeyNames: Readonly<Record<HotkeyName, string>> = hotkeyNamesFor(process.platform);

const pillPositions: Readonly<Record<PillPosition, string>> = {
  'bottom-center': 'Embaixo, no centro',
  'top-center': 'Em cima, no centro',
};

/** Model ids are shown as they are: they are the names the Groq console uses. */
const models: Readonly<Record<TranscriptionModel, string>> = {
  'whisper-large-v3-turbo': 'whisper-large-v3-turbo',
  'whisper-large-v3': 'whisper-large-v3',
};

/** The texts of the main window. `platform` picks the label of the login item (FR-UI-36). */
export function mainWindowStrings(platform: NodeJS.Platform = process.platform): MainWindowStrings {
  const texts = stringsFor(platform);
  return {
    appName: 'Touch Speaker',
    navHome: 'Início',
    navHistory: 'Histórico',
    navDictionary: 'Dicionário',
    navSettings: 'Configurações',
    navSoon: 'em breve',
    homeHowTo: 'Como ditar',
    homeHotkey: 'Tecla de ditado',
    homeState: 'Estado',
    homeKey: 'Chave da Groq',
    stateReady: 'Pronto',
    stateListening: 'Ouvindo…',
    stateNoKey: 'Falta a chave da Groq',
    stateHookDown: 'A tecla de ditado não está funcionando — reinicie o app',
    keyStored: 'Salva no app',
    keyEnv: 'Vinda do .env de desenvolvimento',
    keyNone: 'Falta a chave da Groq',
    keyUnreadable: 'A chave salva não pôde ser lida — salve de novo',
    keyStateLabel: 'Estado',
    keyField: 'Chave da Groq',
    keyConfigure: 'Configurar chave',
    keySave: 'Salvar chave',
    keyRemove: 'Remover chave',
    keyConfirmRemove: 'Confirmar remoção',
    keyCancel: 'Cancelar',
    keySaved: 'Chave salva',
    keyRemoved: 'Chave removida',
    keyHelp: 'A chave fica cifrada neste computador e só é usada para falar com a Groq.',
    settingsPreferences: 'Preferências',
    settingsSave: 'Salvar preferências',
    settingsSaved: 'Preferências salvas',
    settingsRestartPending: 'As mudanças valem depois de reiniciar o app',
    settingsRestartNow: 'Reiniciar agora',
    fieldLabels: {
      hotkey: 'Tecla de ditado',
      holdThresholdMs: 'Tempo para segurar (ms)',
      maxRecordingMs: 'Duração máxima da gravação (s)',
      language: 'Idioma (código de duas letras)',
      model: 'Modelo de transcrição',
      pillPosition: 'Posição da pílula',
      sounds: 'Sons',
    },
    holdThresholdRange: '200 a 1500',
    maxRecordingRange: '10 a 300',
    hotkeyNames: { ...hotkeyNamesFor(platform) },
    pillPositions: { ...pillPositions },
    models: { ...models },
    micDefault: texts.trayMicDefault,
    micCustom: texts.trayMicCustom,
    loginTitle: 'Início com o sistema',
    loginItem: platform === 'darwin' ? 'Abrir ao iniciar sessão' : 'Iniciar com o Windows',
    loginItemDevOnly: 'Disponível no app instalado',
    loginItemFailed: 'Não foi possível mudar o início automático',
    errors: {
      invalidFormat: 'Chave em formato inválido — confira se colou a chave inteira',
      encryptionUnavailable: 'Este computador não permite guardar a chave com segurança',
      keyWriteFailed: 'Não foi possível salvar a chave',
      invalidField: 'Valor fora do permitido',
      settingsWriteFailed: 'Não foi possível salvar as configurações',
    },
    dictionarySoon: 'O dicionário pessoal chega numa próxima versão.',
    // Histórico (spec historico §7).
    history: {
      search: 'Buscar no histórico',
      copy: 'Copiar',
      copied: 'Copiado',
      remove: 'Apagar',
      clear: 'Apagar tudo',
      confirmClear: 'Apagar todo o histórico? Isso não pode ser desfeito.',
      cancel: 'Cancelar',
      loadMore: 'Carregar mais',
      empty: 'Nenhum ditado guardado ainda',
      noResults: 'Nenhum ditado com esse termo',
      disabled: 'O histórico está desligado — nada é guardado. Ligue em Configurações',
      unavailable: 'Histórico indisponível — o ditado continua funcionando',
      openSettings: 'Abrir Configurações',
      deleted: 'Ditado apagado',
      cleared: 'Histórico apagado',
      failed: 'Não foi possível concluir — tente de novo',
    },
    // Configurações · "Guardar histórico" (FR-UI-38; spec historico §7).
    retention: {
      title: 'Histórico',
      label: 'Guardar histórico',
      never: 'Nunca guardar',
      forDays: 'Por',
      daysUnit: 'dias',
      daysField: 'Número de dias',
      forever: 'Para sempre',
      range: '1 a 3650 dias',
      hint: 'Vale na hora, sem reiniciar. Os ditados ficam só neste computador, sem o áudio.',
      save: 'Salvar',
      saved: 'Salvo',
      writeFailed: 'Não foi possível salvar — o config.json não pôde ser lido ou gravado',
      invalid: 'Escolha de 1 a 3650 dias',
    },
    // Início · cards do histórico (spec historico FR-HIST-22…26).
    home: {
      recentTitle: 'Ditados recentes',
      seeAll: 'Ver todos',
      usageTitle: 'Seu uso',
      today: 'Hoje',
      allTime: 'Todo o histórico',
      words: 'Palavras',
      dictations: 'Ditados',
      spoken: 'Tempo falando',
      wordsPerMinute: 'Média de palavras por minuto',
      off: 'O histórico está desligado — os ditados recentes e os números aparecem quando ele estiver ligado em Configurações',
    },
    // Tema claro / escuro (janela-principal FR-UI-39…42; decisão do Victor de 18/out/2026).
    theme: {
      toDark: 'Mudar para tema escuro',
      toLight: 'Mudar para tema claro',
      title: 'Aparência',
      current: 'Tema',
      system: 'Seguindo o sistema',
      light: 'Claro',
      dark: 'Escuro',
      followSystem: 'Seguir o sistema',
      writeFailed: 'Não foi possível salvar o tema',
    },
  };
}

// ---- History labels built in main (spec historico §7, §10): they carry values, so they arrive ready ----

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const historyStrings = {
  today: 'Hoje',
  yesterday: 'Ontem',
  statusCopied: 'Não colado — o texto ficou no clipboard',
  statusFailed: 'A colagem falhou',
  retentionOff: 'O histórico está desligado — nada é guardado',
  retentionForever: 'Guardando todos os ditados',
  retentionDays: (n: number) => plural(n, 'Guardando os ditados do último dia', `Guardando os ditados dos últimos ${n} dias`),
  unsaved: (n: number) =>
    plural(
      n,
      '1 ditado não foi guardado no histórico desde que o app abriu',
      `${n} ditados não foram guardados no histórico desde que o app abriu`,
    ),
  /** After "Salvar" of the retention: "Salvo", plus how many entries the new retention removed. */
  saved: (purged: number) =>
    purged === 0
      ? 'Salvo'
      : `Salvo · ${plural(purged, '1 ditado mais antigo foi apagado', `${purged} ditados mais antigos foram apagados`)}`,
  copyEntry: (day: string, time: string) => `Copiar ditado — ${day}, ${time}`,
  deleteEntry: (day: string, time: string) => `Apagar ditado — ${day}, ${time}`,
  seconds: (s: number) => `${s} s`,
  minutes: (m: number) => `${m} min`,
  hoursMinutes: (h: number, m: number) => `${h} h ${String(m).padStart(2, '0')} min`,
  noValue: '—',
} as const;

/** The pill's message for each error code on `platform` (docs/API.md, "Códigos de erro"). */
export function errorMessagesFor(platform: NodeJS.Platform): Readonly<Record<ErrorCode, string>> {
  const mac = platform === 'darwin';
  return {
    no_api_key: mac
      ? 'Falta a chave da Groq — abra o Touch Speaker pela barra de menus'
      : 'Falta a chave da Groq — abra o Touch Speaker pela bandeja',
    invalid_api_key: 'Chave da Groq inválida',
    rate_limited: 'Limite gratuito da Groq atingido — tente em instantes',
    network_error: 'Sem conexão — tente de novo',
    provider_error: 'A Groq falhou — tente de novo',
    audio_too_large: 'Gravação longa demais',
    // FR-MAC-05: on macOS the way out is a System Settings panel.
    mic_denied: mac
      ? 'Sem permissão para usar o microfone — veja Ajustes do Sistema → Privacidade e Segurança → Microfone'
      : 'Sem permissão para usar o microfone',
    mic_unavailable: 'Microfone indisponível ou em uso',
    recorder_failed: 'Falha ao gravar',
    no_speech: '',
    // FR-MAC-07 / BR-009: the text stayed in the clipboard; the shortcut is the system's.
    paste_blocked: mac ? 'Texto copiado — cole com ⌘V' : 'Texto copiado — cole com Ctrl+V',
    session_timeout: '',
  };
}

const errorMessages = errorMessagesFor(process.platform);

export function errorMessage(code: ErrorCode): string {
  return errorMessages[code];
}
