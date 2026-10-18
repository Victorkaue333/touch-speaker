// Main window renderer (spec janela-principal §7): sidebar, Início, Histórico (spec historico §7), Dicionário
// ("em breve"), Configurações. Classic script (no imports): loaded by index.html with `defer`; types in
// global.d.ts. No text of its own — every text comes from main through app:get-strings (or ready in an answer)
// and goes in with textContent, never innerHTML (FR-UI-10; spec historico RISK-novo-7: a dictated text can
// contain anything). Nothing is kept in the browser (no localStorage, no IndexedDB). The Groq key lives here
// only between typing and "Salvar chave": the field is cleared after the answer (FR-UI-22). Dictated text
// lives here only while a list is on screen.

type SectionName = 'home' | 'history' | 'dictionary' | 'settings';
type Tone = 'normal' | 'warning' | 'error';

const SECTIONS: readonly SectionName[] = ['home', 'history', 'dictionary', 'settings'];
const FIELD_IDS: Readonly<Record<keyof EditableSettings, string>> = {
  hotkey: 'f-hotkey',
  holdThresholdMs: 'f-hold',
  maxRecordingMs: 'f-max',
  language: 'f-language',
  model: 'f-model',
  pillPosition: 'f-pill',
  sounds: 'f-sounds',
};

const bridge = window.touchSpeakerApp;
let texts: MainWindowStrings | null = null;
let currentStatus: AppStatus | null = null;
let settingsView: SettingsView | null = null;
let settingsRequest = 0;
let currentSection: SectionName = 'home';

/**
 * An HTML element by id. The HTMLElement base is checked at run time: an inline <svg> is an SVGSVGElement, which
 * has no `hidden` property, so it never passes as one (svgById looks those up). `T` narrows to the tag in
 * index.html (an <input>, a <template>…).
 */
function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!(found instanceof HTMLElement)) throw new Error(`missing #${id}`);
  return found as T;
}

/** An inline <svg> by id. It has no `hidden` property: show and hide it with the attribute (toggleAttribute). */
function svgById(id: string): SVGSVGElement {
  const found = document.getElementById(id);
  if (!(found instanceof SVGSVGElement)) throw new Error(`missing svg#${id}`);
  return found;
}

const navButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.nav-item[data-section]'));
const panels = Array.from(document.querySelectorAll<HTMLElement>('[data-panel]'));
const keyInput = byId<HTMLInputElement>('key-input');
const keySave = byId<HTMLButtonElement>('key-save');
const keyRemove = byId<HTMLButtonElement>('key-remove');
const keyConfirm = byId<HTMLButtonElement>('key-confirm');
const keyCancel = byId<HTMLButtonElement>('key-cancel');
const keyStatus = byId<HTMLParagraphElement>('key-status');
const prefsSave = byId<HTMLButtonElement>('prefs-save');
const prefsStatus = byId<HTMLParagraphElement>('prefs-status');
const restartBanner = byId<HTMLDivElement>('restart-banner');
const loginSwitch = byId<HTMLInputElement>('login-switch');
const loginNote = byId<HTMLParagraphElement>('login-note');
const loginStatus = byId<HTMLParagraphElement>('login-status');
const hotkeySelect = byId<HTMLSelectElement>(FIELD_IDS.hotkey);
const holdInput = byId<HTMLInputElement>(FIELD_IDS.holdThresholdMs);
const maxInput = byId<HTMLInputElement>(FIELD_IDS.maxRecordingMs);
const languageInput = byId<HTMLInputElement>(FIELD_IDS.language);
const modelSelect = byId<HTMLSelectElement>(FIELD_IDS.model);
const pillSelect = byId<HTMLSelectElement>(FIELD_IDS.pillPosition);
const soundsInput = byId<HTMLInputElement>(FIELD_IDS.sounds);
// Histórico, Início and the retention control (spec historico §7).
const live = byId<HTMLParagraphElement>('live');
const historySearch = byId<HTMLInputElement>('history-search');
const historyClearButton = byId<HTMLButtonElement>('history-clear');
const historyConfirm = byId<HTMLDivElement>('history-confirm');
const historyConfirmOk = byId<HTMLButtonElement>('history-confirm-ok');
const historyConfirmCancel = byId<HTMLButtonElement>('history-confirm-cancel');
const historyMore = byId<HTMLButtonElement>('history-more');
const retentionDaysInput = byId<HTMLInputElement>('retention-days-input');
const retentionSave = byId<HTMLButtonElement>('retention-save');
const retentionStatus = byId<HTMLParagraphElement>('retention-status');
const retentionError = byId<HTMLSpanElement>('retention-error');
const ICONS = {
  copy: byId<HTMLTemplateElement>('icon-copy'),
  trash: byId<HTMLTemplateElement>('icon-trash'),
  check: byId<HTMLTemplateElement>('icon-check'),
  alert: byId<HTMLTemplateElement>('icon-alert'),
};

function isSection(value: string | undefined): value is SectionName {
  return SECTIONS.some((s) => s === value);
}

// ---- Texts ----------------------------------------------------------------------------------------

/** A text of MainWindowStrings by key, dotted for the nested groups ("history.copy"). */
function textAt(s: MainWindowStrings, key: string): string | null {
  let value: unknown = s;
  for (const part of key.split('.')) {
    value = typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[part] : undefined;
  }
  return typeof value === 'string' ? value : null;
}

function applyTexts(s: MainWindowStrings): void {
  for (const node of document.querySelectorAll<HTMLElement>('[data-text]')) {
    const value = textAt(s, node.dataset.text ?? '');
    if (value !== null) node.textContent = value;
  }
  for (const node of document.querySelectorAll<HTMLElement>('[data-label]')) {
    const key = node.dataset.label as keyof EditableSettings;
    const value = s.fieldLabels[key];
    if (typeof value === 'string') node.textContent = value;
  }
}

/**
 * The options of a customizable select (docs/DESIGN.md §6.5): the Lucide check (shown only on the chosen one,
 * by CSS) and the label. The trigger <button> of index.html stays as the first child.
 */
function fillOptions(select: HTMLSelectElement, entries: [string, string][]): void {
  for (const old of Array.from(select.querySelectorAll('option'))) old.remove();
  const check = byId<HTMLTemplateElement>('icon-option-check');
  select.append(
    ...entries.map(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      const text = document.createElement('span');
      text.textContent = label;
      option.append(check.content.firstElementChild?.cloneNode(true) ?? document.createTextNode(''), text);
      return option;
    }),
  );
}

function setMessage(target: HTMLElement, text: string, tone: Tone = 'normal'): void {
  target.textContent = text;
  if (tone === 'error') target.dataset.tone = 'error';
  else delete target.dataset.tone;
}

function setTone(card: HTMLElement, tone: Tone): void {
  if (tone === 'normal') delete card.dataset.tone;
  else card.dataset.tone = tone;
}

function keyText(s: MainWindowStrings, state: GroqKeyState): string {
  switch (state) {
    case 'stored':
      return s.keyStored;
    case 'env':
      return s.keyEnv;
    case 'unreadable':
      return s.keyUnreadable;
    case 'none':
      return s.keyNone;
  }
}

// ---- Navigation (FR-UI-08, FR-UI-09): same page, the URL never changes ------------------------------

function showSection(name: SectionName): void {
  currentSection = name;
  for (const button of navButtons) {
    if (button.dataset.section === name) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  for (const panel of panels) panel.hidden = panel.dataset.panel !== name;
  cancelRemove();
  cancelClear();
  pendingDeleteFocus = null;
  if (name === 'settings') {
    void loadSettings();
    void loadRetention();
  } else if (name === 'home') {
    void loadHome();
  } else if (name === 'history') {
    void loadHistory('fresh');
  }
}

for (const button of navButtons) {
  button.addEventListener('click', () => {
    const name = button.dataset.section;
    if (isSection(name)) showSection(name);
  });
}

// ---- Início (FR-UI-11…14) -------------------------------------------------------------------------

function renderStatus(): void {
  const s = texts;
  const status = currentStatus;
  if (!s || !status) return;
  byId('home-hotkey').textContent = s.hotkeyNames[status.hotkey];
  byId('home-howto').replaceChildren(
    ...status.howTo.map((line) => {
      const item = document.createElement('li');
      item.textContent = line;
      return item;
    }),
  );

  const noKey = status.groqKey === 'none' || status.groqKey === 'unreadable';
  const stateCard = byId('home-state-card');
  if (!status.keyboardHook) {
    setTone(stateCard, 'error');
    byId('home-state').textContent = s.stateHookDown;
  } else if (status.recording) {
    setTone(stateCard, 'normal');
    byId('home-state').textContent = s.stateListening;
  } else if (noKey) {
    setTone(stateCard, 'warning');
    byId('home-state').textContent = s.stateNoKey;
  } else {
    setTone(stateCard, 'normal');
    byId('home-state').textContent = s.stateReady;
  }
  byId('home-mic').textContent = status.microphone === 'custom' ? s.micCustom : s.micDefault;

  setTone(byId('home-key-card'), noKey ? 'warning' : 'normal');
  byId('home-key').textContent = keyText(s, status.groqKey);
  byId('home-configure').hidden = !noKey;

  // Configurações · chave
  byId('settings-key-state').textContent = keyText(s, status.groqKey);
  const canRemove = status.groqKey === 'stored';
  byId('key-remove-row').hidden = !canRemove;
  if (!canRemove) cancelRemove();
}

byId('home-configure').addEventListener('click', () => {
  showSection('settings');
  keyInput.focus();
});

// ---- Configurações · chave da Groq (FR-UI-18…22) ---------------------------------------------------

function keyErrorText(s: MainWindowStrings, code: 'invalid_format' | 'encryption_unavailable' | 'write_failed'): string {
  if (code === 'invalid_format') return s.errors.invalidFormat;
  if (code === 'encryption_unavailable') return s.errors.encryptionUnavailable;
  return s.errors.keyWriteFailed;
}

byId<HTMLFormElement>('key-form').addEventListener('submit', (event) => {
  event.preventDefault();
  void saveKey();
});

async function saveKey(): Promise<void> {
  const s = texts;
  if (!s) return;
  keySave.disabled = true;
  keyInput.disabled = true;
  setMessage(keyStatus, '');
  try {
    const result = await bridge.setGroqKey(keyInput.value);
    if (result.ok) setMessage(keyStatus, s.keySaved);
    else setMessage(keyStatus, keyErrorText(s, result.code), 'error');
  } catch {
    setMessage(keyStatus, s.errors.keyWriteFailed, 'error');
  } finally {
    // Cleared whatever the answer: the key never stays on screen (FR-UI-18, FR-UI-22).
    keyInput.value = '';
    keyInput.disabled = false;
    keySave.disabled = false;
  }
}

// "Remover chave" asks for confirmation on the screen itself, in two steps (D7).
function cancelRemove(): void {
  keyConfirm.hidden = true;
  keyCancel.hidden = true;
  keyRemove.hidden = false;
}

keyRemove.addEventListener('click', () => {
  keyRemove.hidden = true;
  keyConfirm.hidden = false;
  keyCancel.hidden = false;
  keyCancel.focus();
});

keyCancel.addEventListener('click', () => {
  cancelRemove();
  keyRemove.focus();
});

keyConfirm.addEventListener('click', () => void removeKey());

async function removeKey(): Promise<void> {
  const s = texts;
  if (!s) return;
  keyConfirm.disabled = true;
  try {
    const result = await bridge.removeGroqKey();
    if (result.ok) setMessage(keyStatus, s.keyRemoved);
    else setMessage(keyStatus, keyErrorText(s, result.code), 'error');
  } catch {
    setMessage(keyStatus, s.errors.keyWriteFailed, 'error');
  } finally {
    keyConfirm.disabled = false;
    cancelRemove();
  }
}

// Esc never triggers anything destructive here; at most it undoes a confirmation (RISK-013).
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!keyConfirm.hidden) {
    cancelRemove();
    keyRemove.focus();
  } else if (!historyConfirm.hidden) {
    cancelClear();
    historyClearButton.focus();
  }
});

// ---- Configurações · preferências (FR-UI-26…32) ----------------------------------------------------

function clearFieldErrors(): void {
  for (const [field, id] of Object.entries(FIELD_IDS)) {
    byId(id).removeAttribute('aria-invalid');
    const error = byId(`e-${field}`);
    error.hidden = true;
    error.textContent = '';
  }
}

function markInvalid(s: MainWindowStrings, field: keyof EditableSettings): void {
  const control = byId(FIELD_IDS[field]);
  control.setAttribute('aria-invalid', 'true');
  const error = byId(`e-${field}`);
  error.textContent = s.errors.invalidField;
  error.hidden = false;
  control.focus();
}

function fillSettings(s: MainWindowStrings, view: SettingsView): void {
  fillOptions(hotkeySelect, view.hotkeys.map((key) => [key, s.hotkeyNames[key]]));
  fillOptions(modelSelect, Object.entries(s.models));
  fillOptions(pillSelect, Object.entries(s.pillPositions));
  hotkeySelect.value = view.values.hotkey;
  holdInput.value = String(view.values.holdThresholdMs);
  // The screen shows seconds; the contract and config.json are in ms.
  maxInput.value = String(view.values.maxRecordingMs / 1000);
  languageInput.value = view.values.language;
  modelSelect.value = view.values.model;
  pillSelect.value = view.values.pillPosition;
  soundsInput.checked = view.values.sounds;
  byId('prefs-mic').textContent = view.microphone === 'custom' ? s.micCustom : s.micDefault;
  restartBanner.hidden = !view.restartPending;
  clearFieldErrors();
  setMessage(prefsStatus, '');

  loginSwitch.checked = view.loginItem.enabled;
  loginSwitch.disabled = !view.loginItem.available;
  loginNote.textContent = view.loginItem.available ? '' : s.loginItemDevOnly;
  loginNote.hidden = view.loginItem.available;
  setMessage(loginStatus, '');
}

/** Configurações re-reads config.json every time it shows (FR-UI-26). */
async function loadSettings(): Promise<void> {
  const s = texts;
  if (!s) return;
  const request = ++settingsRequest;
  try {
    const view = await bridge.getSettings();
    if (request !== settingsRequest) return;
    settingsView = view;
    fillSettings(s, view);
  } catch {
    console.error('settings_get_failed');
  }
}

byId<HTMLFormElement>('prefs-form').addEventListener('submit', (event) => {
  event.preventDefault();
  void savePreferences();
});

async function savePreferences(): Promise<void> {
  const s = texts;
  if (!s) return;
  clearFieldErrors();
  setMessage(prefsStatus, '');
  const input: EditableSettings = {
    hotkey: hotkeySelect.value as HotkeyName,
    holdThresholdMs: holdInput.valueAsNumber,
    maxRecordingMs: Math.round(maxInput.valueAsNumber * 1000),
    language: languageInput.value,
    model: modelSelect.value as TranscriptionModel,
    pillPosition: pillSelect.value as PillPosition,
    sounds: soundsInput.checked,
  };
  prefsSave.disabled = true;
  try {
    const result = await bridge.saveSettings(input);
    if (result.ok) {
      setMessage(prefsStatus, s.settingsSaved);
      restartBanner.hidden = !result.restartPending;
    } else if (result.code === 'invalid_field') {
      markInvalid(s, result.field);
      setMessage(prefsStatus, s.errors.invalidField, 'error');
    } else {
      setMessage(prefsStatus, s.errors.settingsWriteFailed, 'error');
    }
  } catch {
    setMessage(prefsStatus, s.errors.settingsWriteFailed, 'error');
  } finally {
    prefsSave.disabled = false;
  }
}

byId('restart-now').addEventListener('click', () => bridge.relaunch());

// ---- Configurações · iniciar com o sistema (FR-UI-36, FR-UI-37) ------------------------------------

loginSwitch.addEventListener('change', () => void setLoginItem(loginSwitch.checked));

async function setLoginItem(wanted: boolean): Promise<void> {
  const s = texts;
  if (!s) return;
  loginSwitch.disabled = true;
  setMessage(loginStatus, '');
  try {
    const result = await bridge.setLoginItem(wanted);
    loginSwitch.checked = result.enabled; // always the real state, re-read by main
    if (!result.ok) {
      setMessage(loginStatus, result.code === 'unavailable' ? s.loginItemDevOnly : s.loginItemFailed, 'error');
    }
  } catch {
    loginSwitch.checked = !wanted;
    setMessage(loginStatus, s.loginItemFailed, 'error');
  } finally {
    loginSwitch.disabled = !(settingsView?.loginItem.available ?? false);
  }
}

// ---- History pieces shared by Início and Histórico (spec historico §7) ------------------------------

const PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const RECENT_COUNT = 3;
const COPIED_VISIBLE_MS = 2000;
const SEARCH_DELAY_MS = 250;
const DEFAULT_RETENTION_DAYS = 30;
const MAX_RETENTION_DAYS = 3650;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function iconFrom(template: HTMLTemplateElement): Node {
  return template.content.firstElementChild?.cloneNode(true) ?? document.createTextNode('');
}

/** A button with a Lucide icon and a visible label (the accessible name may be longer, with day and time). */
function setButtonContent(button: HTMLButtonElement, icon: HTMLTemplateElement, label: string): void {
  button.replaceChildren(iconFrom(icon), element('span', undefined, label));
}

/** Polite announcement for screen readers ("Copiado", "Ditado apagado"…). */
function announce(text: string): void {
  live.textContent = '';
  window.setTimeout(() => {
    live.textContent = text;
  }, 50);
}

/** One entry: meta line (day or time, duration, result notice), actions, and the text by textContent. */
function entryItem(s: MainWindowStrings, entry: HistoryEntry, compact: boolean): HTMLLIElement {
  const item = element('li', 'entry');
  const head = element('div', 'entry-head');
  const meta = element('p', 'entry-meta');
  if (compact) meta.append(element('span', undefined, entry.dayLabel));
  meta.append(element('span', undefined, entry.timeLabel));
  if (!compact) meta.append(element('span', undefined, entry.durationLabel));
  if (entry.statusLabel) {
    const notice = element('span', 'entry-status');
    notice.dataset.status = entry.status;
    notice.append(iconFrom(ICONS.alert), element('span', undefined, entry.statusLabel));
    meta.append(notice);
  }

  const actions = element('div', 'entry-actions');
  const copy = element('button', 'button button-ghost button-sm');
  copy.type = 'button';
  copy.setAttribute('aria-label', entry.copyLabel);
  setButtonContent(copy, ICONS.copy, s.history.copy);
  copy.addEventListener('click', () => void copyEntry(s, entry.id, copy));
  actions.append(copy);
  if (!compact) {
    const remove = element('button', 'button button-ghost button-sm');
    remove.type = 'button';
    remove.setAttribute('aria-label', entry.deleteLabel);
    remove.dataset.entryId = entry.id; // where the focus goes after another delete (focusAfterDelete)
    setButtonContent(remove, ICONS.trash, s.history.remove);
    remove.addEventListener('click', () => void deleteEntry(s, entry.id, remove));
    actions.append(remove);
  }
  head.append(meta, actions);
  item.append(head, element('p', 'entry-text', entry.text));
  return item;
}

/** FR-HIST-12, FR-HIST-13: main writes the clipboard; the button says "Copiado" for a moment. */
async function copyEntry(s: MainWindowStrings, id: string, button: HTMLButtonElement): Promise<void> {
  try {
    const { result } = await bridge.history.copy(id);
    if (result === 'copied') {
      setButtonContent(button, ICONS.check, s.history.copied);
      button.dataset.copied = 'true';
      announce(s.history.copied);
      window.setTimeout(() => {
        if (!button.isConnected) return;
        setButtonContent(button, ICONS.copy, s.history.copy);
        delete button.dataset.copied;
      }, COPIED_VISIBLE_MS);
    } else {
      // Gone (deleted or expired) or unavailable: the list reloads and says why (FR-HIST-13).
      reloadVisible();
    }
  } catch {
    announce(s.history.failed);
  }
}

async function deleteEntry(s: MainWindowStrings, id: string, button: HTMLButtonElement): Promise<void> {
  button.disabled = true;
  // The order on screen at the click, to find the entry that takes this one's place.
  const before = historyEntries.map((entry) => entry.id);
  try {
    const { result } = await bridge.history.delete(id);
    if (result === 'deleted') announce(s.history.deleted);
    // The list reloads here whatever the answer (history:changed may already have reloaded it, or may come
    // later); the focus moves once a list fetched after this answer is drawn: reloadVisible's loadHistory takes
    // the next request number.
    if (currentSection === 'history') pendingDeleteFocus = { before, deletedId: id, fromRequest: historyRequest + 1 };
    reloadVisible();
  } catch {
    button.disabled = false;
    announce(s.history.failed);
  }
}

/**
 * After a delete, the id whose "Apagar" gets the focus: the entry now in the deleted one's place (right after the
 * last entry that was above it), else the one above it, else null (the section title). Works on ids only, so an
 * entry pulled in from the next page, a new dictation on top or another entry gone meanwhile are all handled.
 */
function focusTargetAfterDelete(before: readonly string[], deletedId: string, after: readonly string[]): string | null {
  const at = before.indexOf(deletedId);
  const above = new Set(at < 0 ? [] : before.slice(0, at));
  let last = -1;
  after.forEach((id, index) => {
    if (above.has(id)) last = index;
  });
  return after[last + 1] ?? after[last] ?? null;
}

/** Moves the focus only when it went away with the deleted entry (it is on <body>); a focus moved meanwhile stays. */
function focusAfterDelete(id: string | null): void {
  const active = document.activeElement;
  if (active && active !== document.body) return;
  const buttons = Array.from(byId('history-list').querySelectorAll<HTMLButtonElement>('button[data-entry-id]'));
  const target = id === null ? undefined : buttons.find((button) => button.dataset.entryId === id);
  (target ?? byId('history-title')).focus();
}

/** history:changed — only the section on screen reloads; the others reload when shown (FR-HIST-18). */
function reloadVisible(): void {
  if (currentSection === 'history') void loadHistory('keep');
  else if (currentSection === 'home') void loadHome();
}

// ---- Histórico (spec historico §7, §7.1; FR-UI-16) --------------------------------------------------

let historyQuery = '';
let historyCursor: string | null = null;
let historyShown = 0;
let historyRequest = 0;
let historyEntries: HistoryEntry[] = [];
let searchTimer: number | undefined;
/** Set by a delete; the first list drawn from request `fromRequest` on moves the focus (focusAfterDelete). */
let pendingDeleteFocus: { before: string[]; deletedId: string; fromRequest: number } | null = null;

/** `fresh`: first page; `keep`: the same amount already on screen (after a change); `more`: next page. */
async function loadHistory(mode: 'fresh' | 'keep' | 'more'): Promise<void> {
  const s = texts;
  if (!s) return;
  const request = ++historyRequest;
  if (mode === 'fresh') pendingDeleteFocus = null;
  const query = historyQuery;
  const current = () => request === historyRequest;
  const page = (cursor: string | null, limit: number) => bridge.history.list({ query, cursor, limit });
  let last: HistoryListResult;
  let entries: HistoryEntry[];
  try {
    if (mode === 'more') {
      last = await page(historyCursor, PAGE_SIZE);
      entries = [...historyEntries, ...last.entries];
    } else {
      // `keep` walks page by page up to the amount on screen, so a list longer than MAX_PAGE_SIZE never shrinks.
      const wanted = mode === 'keep' ? Math.max(PAGE_SIZE, historyShown) : PAGE_SIZE;
      ({ last, entries } = await collectHistoryPages(page, wanted, current));
    }
  } catch {
    if (current()) {
      pendingDeleteFocus = null;
      announce(s.history.failed);
    }
    return;
  }
  if (!current()) return;
  historyEntries = entries;
  historyCursor = last.nextCursor;
  historyShown = historyEntries.length;
  renderHistory(s, last);
  const focus = pendingDeleteFocus;
  if (focus && request >= focus.fromRequest) {
    pendingDeleteFocus = null;
    focusAfterDelete(focusTargetAfterDelete(focus.before, focus.deletedId, historyEntries.map((entry) => entry.id)));
  }
}

/**
 * history:list page after page from the top, until `wanted` entries or the end of the list. One answer holds at
 * most MAX_PAGE_SIZE (main refuses more), so a longer list is walked, never cut. Stops early when a newer request
 * took over (`current` false); a page that is not ok ends the walk with that answer and no entries.
 */
async function collectHistoryPages(
  page: (cursor: string | null, limit: number) => Promise<HistoryListResult>,
  wanted: number,
  current: () => boolean,
): Promise<{ last: HistoryListResult; entries: HistoryEntry[] }> {
  const entries: HistoryEntry[] = [];
  let cursor: string | null = null;
  for (;;) {
    const last: HistoryListResult = await page(cursor, Math.min(MAX_PAGE_SIZE, wanted - entries.length));
    if (last.status !== 'ok') return { last, entries: [] };
    entries.push(...last.entries);
    cursor = last.nextCursor;
    if (cursor === null || last.entries.length === 0 || entries.length >= wanted || !current()) return { last, entries };
  }
}

function renderHistory(s: MainWindowStrings, result: HistoryListResult): void {
  const unsaved = byId('history-unsaved');
  unsaved.hidden = result.unsavedLabel === null;
  byId('history-unsaved-text').textContent = result.unsavedLabel ?? '';

  const toolbar = byId('history-toolbar');
  const state = byId('history-state');
  const openSettings = byId('history-open-settings');
  const list = byId('history-list');
  let stateText: string | null = null;
  if (result.status === 'unavailable') stateText = s.history.unavailable;
  else if (result.status === 'disabled') stateText = s.history.disabled;
  else if (historyEntries.length === 0) stateText = historyQuery ? s.history.noResults : s.history.empty;

  // Without entries and without a search there is nothing to search or clear (wireframe §7.1).
  toolbar.hidden = result.status !== 'ok' || (historyEntries.length === 0 && !historyQuery);
  if (toolbar.hidden) cancelClear();
  state.hidden = stateText === null;
  state.textContent = stateText ?? '';
  openSettings.hidden = result.status !== 'disabled';
  historyMore.hidden = result.status !== 'ok' || result.nextCursor === null;
  byId('history-retention').textContent = result.status === 'ok' ? result.retentionLabel : '';
  list.replaceChildren(...dayGroups(s, historyEntries));
}

/** Entries grouped by local day, newest first, each group with its ready label (FR-HIST-09). */
function dayGroups(s: MainWindowStrings, entries: HistoryEntry[]): HTMLElement[] {
  const groups: HTMLElement[] = [];
  let currentKey = '';
  let currentList: HTMLUListElement | null = null;
  for (const entry of entries) {
    if (!currentList || entry.dayKey !== currentKey) {
      currentKey = entry.dayKey;
      const group = element('section', 'history-day');
      const title = element('h2', 'history-day-title', entry.dayLabel);
      title.id = `day-${entry.dayKey}`;
      group.setAttribute('aria-labelledby', title.id);
      currentList = element('ul', 'entries');
      group.append(title, currentList);
      groups.push(group);
    }
    currentList.append(entryItem(s, entry, false));
  }
  return groups;
}

historySearch.addEventListener('input', () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    historyQuery = historySearch.value.trim();
    void loadHistory('fresh');
  }, SEARCH_DELAY_MS);
});

historyMore.addEventListener('click', () => void loadHistory('more'));

byId('history-open-settings').addEventListener('click', () => showSection('settings'));

// "Apagar tudo" → confirmation on the screen itself (D6); Esc or "Cancelar" undo it.
function cancelClear(): void {
  historyConfirm.hidden = true;
  historyClearButton.hidden = false;
}

historyClearButton.addEventListener('click', () => {
  historyClearButton.hidden = true;
  historyConfirm.hidden = false;
  historyConfirmCancel.focus();
});

historyConfirmCancel.addEventListener('click', () => {
  cancelClear();
  historyClearButton.focus();
});

historyConfirmOk.addEventListener('click', () => void clearHistory());

async function clearHistory(): Promise<void> {
  const s = texts;
  if (!s) return;
  historyConfirmOk.disabled = true;
  try {
    const { result } = await bridge.history.clear(true);
    if (result === 'cleared') announce(s.history.cleared);
    else void loadHistory('fresh');
  } catch {
    announce(s.history.failed);
  } finally {
    historyConfirmOk.disabled = false;
    cancelClear();
  }
}

// ---- Início · Seu uso and Ditados recentes (spec historico FR-HIST-22…26; janela-principal FR-UI-15) -------

let homeRequest = 0;

async function loadHome(): Promise<void> {
  const s = texts;
  if (!s) return;
  const request = ++homeRequest;
  let stats: HistoryStatsView;
  let recent: HistoryListResult;
  try {
    [stats, recent] = await Promise.all([bridge.history.stats(), bridge.history.list({ limit: RECENT_COUNT })]);
  } catch {
    return;
  }
  if (request !== homeRequest) return;
  renderUsage(s, stats);
  renderRecent(s, recent);
}

function renderUsage(s: MainWindowStrings, stats: HistoryStatsView): void {
  const off = byId('usage-off');
  const ok = stats.status === 'ok';
  byId('usage-stats').hidden = !ok;
  off.hidden = ok;
  off.textContent = stats.status === 'disabled' ? s.home.off : stats.status === 'unavailable' ? s.history.unavailable : '';
  byId('usage-retention').textContent = ok ? stats.retentionLabel : '';
  byId('stat-words-today').textContent = stats.today.wordsLabel;
  byId('stat-words-all').textContent = stats.allTime.wordsLabel;
  byId('stat-dictations-today').textContent = stats.today.dictationsLabel;
  byId('stat-dictations-all').textContent = stats.allTime.dictationsLabel;
  byId('stat-spoken-today').textContent = stats.today.spokenLabel;
  byId('stat-spoken-all').textContent = stats.allTime.spokenLabel;
  byId('stat-wpm').textContent = stats.wordsPerMinuteLabel;
}

function renderRecent(s: MainWindowStrings, recent: HistoryListResult): void {
  const state = byId('recent-state');
  let stateText: string | null = null;
  if (recent.status === 'unavailable') stateText = s.history.unavailable;
  else if (recent.status === 'disabled') stateText = s.history.disabled;
  else if (recent.entries.length === 0) stateText = s.history.empty;
  state.hidden = stateText === null;
  state.textContent = stateText ?? '';
  byId('recent-open-settings').hidden = recent.status !== 'disabled';
  byId('recent-see-all').hidden = recent.status !== 'ok' || recent.entries.length === 0;
  byId('recent-list').replaceChildren(...recent.entries.map((entry) => entryItem(s, entry, true)));
}

byId('recent-see-all').addEventListener('click', () => showSection('history'));
byId('recent-open-settings').addEventListener('click', () => showSection('settings'));

// ---- Configurações · Guardar histórico (FR-UI-38; spec historico FR-HIST-20, FR-HIST-21) ------------

function retentionRadio(value: 'never' | 'days' | 'forever'): HTMLInputElement {
  return byId<HTMLInputElement>(`retention-${value}`);
}

function clearRetentionError(): void {
  retentionDaysInput.removeAttribute('aria-invalid');
  retentionError.hidden = true;
  retentionError.textContent = '';
}

function fillRetention(days: RetentionDays): void {
  if (days === 0) retentionRadio('never').checked = true;
  else if (days === null) retentionRadio('forever').checked = true;
  else retentionRadio('days').checked = true;
  // The number keeps a sensible value even when "never" or "forever" is chosen.
  retentionDaysInput.value = String(days !== null && days > 0 ? days : DEFAULT_RETENTION_DAYS);
  clearRetentionError();
}

async function loadRetention(): Promise<void> {
  const s = texts;
  if (!s) return;
  retentionDaysInput.setAttribute('aria-label', s.retention.daysField);
  setMessage(retentionStatus, '');
  try {
    fillRetention((await bridge.history.getRetention()).retentionDays);
  } catch {
    console.error('retention_get_failed');
  }
}

retentionDaysInput.addEventListener('input', () => {
  retentionRadio('days').checked = true;
});

byId<HTMLFormElement>('retention-form').addEventListener('submit', (event) => {
  event.preventDefault();
  void saveRetention();
});

async function saveRetention(): Promise<void> {
  const s = texts;
  if (!s) return;
  clearRetentionError();
  setMessage(retentionStatus, '');
  let wanted: RetentionDays;
  if (retentionRadio('never').checked) wanted = 0;
  else if (retentionRadio('forever').checked) wanted = null;
  else {
    const days = retentionDaysInput.valueAsNumber;
    if (!Number.isInteger(days) || days < 1 || days > MAX_RETENTION_DAYS) {
      retentionDaysInput.setAttribute('aria-invalid', 'true');
      retentionError.textContent = s.retention.invalid;
      retentionError.hidden = false;
      retentionDaysInput.focus();
      return;
    }
    wanted = days;
  }
  retentionSave.disabled = true;
  try {
    const result = await bridge.history.setRetention(wanted);
    if (result.result === 'saved') {
      setMessage(retentionStatus, result.savedLabel ?? s.retention.saved);
    } else {
      setMessage(retentionStatus, s.retention.writeFailed, 'error');
    }
    fillRetention(result.retentionDays);
  } catch {
    setMessage(retentionStatus, s.retention.writeFailed, 'error');
  } finally {
    retentionSave.disabled = false;
  }
}

// ---- Tema claro / escuro (janela-principal FR-UI-39…42; Victor, 18/out/2026) -------------------------
// Default "system" (no data-theme: prefers-color-scheme decides). The toggle flips what is on screen, light ↔
// dark: data-theme changes synchronously inside the View Transition callback, so the snapshot has the new
// theme; theme:set (async) only persists it and applies it in main (nativeTheme.themeSource → the pill too).

const THEME_REVEAL_MS = 500; // Victor's snippet; the window's CSS durations stay in --ts-duration-*
/** "Seguir o sistema": longest wait for main's themeSource to reach prefers-color-scheme (after theme:set). */
const SYSTEM_THEME_WAIT_MS = 300;
const themeToggle = byId<HTMLButtonElement>('theme-toggle');
const themeIconSun = svgById('theme-icon-sun');
const themeIconMoon = svgById('theme-icon-moon');
const themeStatus = byId<HTMLParagraphElement>('theme-status');
const themeFollowSystem = byId<HTMLButtonElement>('theme-follow-system');
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
let themePreference: ThemePreference = 'system';

/** Mirrors resolveTheme of src/shared/theme.ts (TEST-018). */
function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemDark ? 'dark' : 'light';
  return preference;
}

function screenTheme(): ResolvedTheme {
  return resolveTheme(themePreference, darkQuery.matches);
}

/** Sun on a light screen, moon on a dark one; the label says what a click does. */
function renderThemeControls(): void {
  const s = texts;
  if (!s) return;
  const current = screenTheme();
  // <svg> has no `hidden` property (setting it only adds an expando): the attribute is what [hidden] hides.
  themeIconSun.toggleAttribute('hidden', current === 'dark');
  themeIconMoon.toggleAttribute('hidden', current !== 'dark');
  const label = current === 'dark' ? s.theme.toLight : s.theme.toDark;
  themeToggle.setAttribute('aria-label', label);
  themeToggle.title = label;
  byId('theme-current').textContent =
    themePreference === 'system' ? s.theme.system : themePreference === 'dark' ? s.theme.dark : s.theme.light;
  themeFollowSystem.disabled = themePreference === 'system';
}

let themeSwitchToken = 0;
let themeSwitchTimer: number | undefined;

/**
 * While the colours swap, CSS transitions are off (data-theme-switching), so no control fades on its own on top
 * of the reveal (FR-UI-41); they come back two frames later, when there is nothing left to animate. With
 * `waitForSystem` ("system" chosen) the colours swap only when main's themeSource reaches prefers-color-scheme,
 * after the theme:set round-trip: the hold lasts until that `change` (which calls this again) or, when the system
 * already shows the same theme and no change comes, SYSTEM_THEME_WAIT_MS. A newer call replaces an older hold.
 */
function holdTransitions(waitForSystem: boolean): void {
  const root = document.documentElement;
  root.dataset.themeSwitching = '';
  window.clearTimeout(themeSwitchTimer);
  const token = ++themeSwitchToken;
  const release = () =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (token === themeSwitchToken) delete root.dataset.themeSwitching;
      }),
    );
  if (waitForSystem) themeSwitchTimer = window.setTimeout(release, SYSTEM_THEME_WAIT_MS);
  else release();
}

/** Synchronous DOM change; "system" removes the override and lets the media query decide. */
function setDocumentTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  themePreference = preference;
  holdTransitions(preference === 'system');
  if (preference === 'system') delete root.dataset.theme;
  else root.dataset.theme = preference;
  renderThemeControls();
}

/** Changes the screen now, then persists in main; a failed write puts back the theme main kept (FR-UI-40). */
function applyTheme(next: ThemePreference): void {
  const previous = themePreference;
  setDocumentTheme(next);
  setMessage(themeStatus, '');
  void persistTheme(next, previous);
}

async function persistTheme(next: ThemePreference, previous: ThemePreference): Promise<void> {
  const s = texts;
  try {
    const result = await bridge.setTheme(next);
    if (!result.ok) {
      setDocumentTheme(result.theme);
      if (s) {
        setMessage(themeStatus, s.theme.writeFailed, 'error');
        announce(s.theme.writeFailed);
      }
    }
  } catch {
    setDocumentTheme(previous);
    if (s) {
      setMessage(themeStatus, s.theme.writeFailed, 'error');
      announce(s.theme.writeFailed);
    }
  }
}

/** True from the click until the reveal ends: further clicks are ignored (FR-UI-41). */
let themeTransitionRunning = false;

/** The circular reveal from the button (FR-UI-41). Reduced motion or no View Transitions API: no animation. */
function runThemeTransition(next: ResolvedTheme, buttonEl: HTMLElement | null): void {
  if (themeTransitionRunning) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => { ready: Promise<void>; finished: Promise<void> };
  };
  if (typeof doc.startViewTransition !== 'function' || reduce) {
    applyTheme(next);
    return;
  }
  themeTransitionRunning = true;
  const rect = buttonEl?.getBoundingClientRect();
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const y = rect ? rect.top + rect.height / 2 : 0;
  const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  // Called as a method of the document (a detached call throws "Illegal invocation"); the DOM changes inside.
  const transition = doc.startViewTransition(() => applyTheme(next));
  transition.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`] },
        { duration: THEME_REVEAL_MS, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    })
    .catch(() => {
      // A skipped transition already applied the theme in its callback; nothing else to do.
    });
  // `finished` settles when the reveal ends, or at once when the transition is skipped.
  transition.finished
    .catch(() => {})
    .finally(() => {
      themeTransitionRunning = false;
    });
}

themeToggle.addEventListener('click', () => {
  runThemeTransition(screenTheme() === 'dark' ? 'light' : 'dark', themeToggle);
});

themeFollowSystem.addEventListener('click', () => applyTheme('system'));

// Following the system, the colours swap under the window when the media query changes: main's themeSource after
// "Seguir o sistema", or the OS itself. `change` comes before the next style pass, so holding the transitions here
// keeps the swap in one step instead of a staggered fade. A forced theme does not move with the media query.
darkQuery.addEventListener('change', () => {
  if (themePreference === 'system') holdTransitions(false);
  renderThemeControls();
});

// ---- Start ----------------------------------------------------------------------------------------

async function init(): Promise<void> {
  bridge.onStatus((next) => {
    currentStatus = next;
    renderStatus();
  });
  bridge.history.onChanged(() => reloadVisible());
  texts = await bridge.getStrings();
  applyTexts(texts);
  historySearch.placeholder = texts.history.search;
  historySearch.setAttribute('aria-label', texts.history.search);
  currentStatus = await bridge.getStatus();
  // The saved theme goes on before the window shows, so it never paints in the other one (FR-UI-39).
  setDocumentTheme(currentStatus.theme);
  renderStatus();
  byId('app').hidden = false;
  // First run opens straight in Configurações, with the focus on the key field (FR-UI-35).
  const first: SectionName = location.hash === '#settings' ? 'settings' : 'home';
  showSection(first);
  if (first === 'settings') keyInput.focus();
}

void init().catch(() => console.error('init_failed'));
