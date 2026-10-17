import { Menu, Tray, shell } from 'electron';
import { trayIcon } from './icon';
import { strings } from './strings';

export interface TrayOptions {
  configDir: string;
  hasApiKey: boolean;
  customMicrophone: boolean;
  onQuit: () => void;
}

export class AppTray {
  private readonly tray: Tray;
  private readonly idleIcon = trayIcon(false);
  private readonly recordingIcon = trayIcon(true);

  constructor(private readonly opts: TrayOptions) {
    this.tray = new Tray(this.idleIcon);
    this.setRecording(false);
  }

  setRecording(recording: boolean): void {
    this.tray.setImage(recording ? this.recordingIcon : this.idleIcon);
    const status = !this.opts.hasApiKey ? strings.trayNoKey : recording ? strings.trayRecording : strings.trayReady;
    this.tray.setToolTip(status);
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: status, enabled: false },
        { label: this.opts.customMicrophone ? strings.trayMicCustom : strings.trayMicDefault, enabled: false },
        { type: 'separator' },
        { label: strings.trayOpenConfig, click: () => void shell.openPath(this.opts.configDir) },
        { label: strings.trayQuit, click: this.opts.onQuit },
      ]),
    );
  }

  destroy(): void {
    this.tray.destroy();
  }
}
