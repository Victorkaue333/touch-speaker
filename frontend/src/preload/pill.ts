// Sandboxed preload for the pill window. Exposes only the functions in docs/API.md, "Contratos" — never a
// generic ipcRenderer. Channel names are duplicated from src/shared/ipc.ts because a sandboxed
// preload cannot require local modules; keep both in sync.
import { contextBridge, ipcRenderer } from 'electron';

const CH = {
  start: 'recorder:start',
  stop: 'recorder:stop',
  cancel: 'recorder:cancel',
  state: 'pill:state',
  started: 'recorder:started',
  result: 'recorder:result',
  error: 'recorder:error',
} as const;

type Listener = (payload: unknown) => void;

const subscribe = (channel: string) => (callback: Listener) => {
  ipcRenderer.on(channel, (_event, payload: unknown) => callback(payload));
};

contextBridge.exposeInMainWorld('touchSpeaker', {
  onStart: subscribe(CH.start),
  onStop: subscribe(CH.stop),
  onCancel: subscribe(CH.cancel),
  onState: subscribe(CH.state),
  started: (payload: unknown) => ipcRenderer.send(CH.started, payload),
  result: (payload: unknown) => ipcRenderer.send(CH.result, payload),
  error: (payload: unknown) => ipcRenderer.send(CH.error, payload),
});
