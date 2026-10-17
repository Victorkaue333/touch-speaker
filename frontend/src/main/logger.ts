// Local log file with rotation. Only metadata goes in: never dictated text, audio, clipboard content,
// keys or the API key (docs/Security-Guide.md §12). Field values are restricted to primitives on purpose.
import * as fs from 'node:fs';
import * as path from 'node:path';

type FieldValue = string | number | boolean | null;
export type LogFields = Record<string, FieldValue>;

const MAX_BYTES = 5 * 1024 * 1024;
const KEEP_FILES = 3;

export class Logger {
  private readonly file: string;

  constructor(private readonly dir: string) {
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, 'main.log');
  }

  info(event: string, fields: LogFields = {}): void {
    this.write('info', event, fields);
  }

  warn(event: string, fields: LogFields = {}): void {
    this.write('warn', event, fields);
  }

  error(event: string, fields: LogFields = {}): void {
    this.write('error', event, fields);
  }

  private write(level: string, event: string, fields: LogFields): void {
    const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...fields }) + '\n';
    try {
      this.rotateIfNeeded();
      fs.appendFileSync(this.file, line, 'utf8');
    } catch {
      // Logging must never break dictation.
    }
  }

  private rotateIfNeeded(): void {
    let size = 0;
    try {
      size = fs.statSync(this.file).size;
    } catch {
      return;
    }
    if (size < MAX_BYTES) return;
    for (let i = KEEP_FILES - 1; i >= 1; i--) {
      const from = i === 1 ? this.file : path.join(this.dir, `main.${i - 1}.log`);
      const to = path.join(this.dir, `main.${i}.log`);
      if (fs.existsSync(from)) fs.renameSync(from, to);
    }
  }
}
