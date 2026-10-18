// Sandboxed preload for the main window (spec janela-principal §10). Exposes only window.touchSpeakerApp,
// with the functions of docs/API.md, "API do preload (window.touchSpeakerApp)" — never a generic
// ipcRenderer, and nothing of the pill (recorder:*, pill:state). Channel names are duplicated from
// src/shared/ipc.ts because a sandboxed preload cannot require local modules; keep both in sync, with
// src/renderer/main-window/global.d.ts. `history` carries the functions of spec historico §10, plus `stats`
// for the cards of Início (FR-HIST-22).
import { contextBridge, ipcRenderer } from 'electron';

const CH = {
  getStrings: 'app:get-strings',
  getStatus: 'app:get-status',
  status: 'app:status',
  getSettings: 'settings:get',
  saveSettings: 'settings:save',
  setGroqKey: 'groq-key:set',
  removeGroqKey: 'groq-key:remove',
  setLoginItem: 'login-item:set',
  relaunch: 'app:relaunch',
  historyList: 'history:list',
  historyCopy: 'history:copy',
  historyDelete: 'history:delete',
  historyClear: 'history:clear',
  historyGetRetention: 'history:get-retention',
  historySetRetention: 'history:set-retention',
  historyStats: 'history:stats',
  historyChanged: 'history:changed',
  setTheme: 'theme:set',
} as const;

contextBridge.exposeInMainWorld('touchSpeakerApp', {
  getStrings: () => ipcRenderer.invoke(CH.getStrings),
  getStatus: () => ipcRenderer.invoke(CH.getStatus),
  // The callback gets the payload only; the IPC event stays here.
  onStatus: (callback: (status: unknown) => void) => {
    ipcRenderer.on(CH.status, (_event, status: unknown) => callback(status));
  },
  getSettings: () => ipcRenderer.invoke(CH.getSettings),
  saveSettings: (input: unknown) => ipcRenderer.invoke(CH.saveSettings, input),
  // The key goes to main once, on save, and never comes back (FR-UI-22).
  setGroqKey: (key: unknown) => ipcRenderer.invoke(CH.setGroqKey, { key }),
  removeGroqKey: () => ipcRenderer.invoke(CH.removeGroqKey),
  setLoginItem: (enabled: unknown) => ipcRenderer.invoke(CH.setLoginItem, { enabled }),
  relaunch: () => ipcRenderer.send(CH.relaunch),
  // The window changes its own theme first (data-theme, synchronously); this persists and applies it in main.
  setTheme: (theme: unknown) => ipcRenderer.invoke(CH.setTheme, { theme }),
  // Payloads are validated in main (src/main/history/ipc.ts); nothing here decides anything.
  history: {
    list: (input: unknown) => ipcRenderer.invoke(CH.historyList, input),
    copy: (id: unknown) => ipcRenderer.invoke(CH.historyCopy, { id }),
    delete: (id: unknown) => ipcRenderer.invoke(CH.historyDelete, { id }),
    // `confirmed` comes from the screen's own confirmation: the second lock of history:clear.
    clear: (confirmed: unknown) => ipcRenderer.invoke(CH.historyClear, { confirmed }),
    getRetention: () => ipcRenderer.invoke(CH.historyGetRetention),
    setRetention: (retentionDays: unknown) => ipcRenderer.invoke(CH.historySetRetention, { retentionDays }),
    stats: () => ipcRenderer.invoke(CH.historyStats),
    onChanged: (callback: (payload: unknown) => void) => {
      ipcRenderer.on(CH.historyChanged, (_event, payload: unknown) => callback(payload));
    },
  },
});
