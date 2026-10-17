// Win32 calls through koffi. Written from the Microsoft documentation for SendInput, INPUT/KEYBDINPUT,
// GetForegroundWindow, OpenProcess, OpenProcessToken and GetTokenInformation(TokenElevation).
import * as koffi from 'koffi';

const INPUT_KEYBOARD = 1;
const KEYEVENTF_KEYUP = 0x0002;
const VK_CONTROL = 0x11;
const VK_V = 0x56;
/** sizeof(INPUT) on x64: DWORD type + 4 bytes padding + 32-byte union (MOUSEINPUT is the largest member). */
const INPUT_SIZE = 40;

const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
const TOKEN_QUERY = 0x0008;
const TOKEN_ELEVATION_CLASS = 20;

type Pointer = bigint | null;

interface Bindings {
  SendInput: (count: number, inputs: Buffer, size: number) => number;
  GetForegroundWindow: () => Pointer;
  GetWindowThreadProcessId: (hwnd: Pointer, pid: number[]) => number;
  OpenProcess: (access: number, inherit: number, pid: number) => Pointer;
  GetCurrentProcess: () => Pointer;
  CloseHandle: (handle: Pointer) => number;
  OpenProcessToken: (process: Pointer, access: number, token: Pointer[]) => number;
  GetTokenInformation: (token: Pointer, infoClass: number, info: number[], length: number, returned: number[]) => number;
}

let bindings: Bindings | undefined;

function load(): Bindings {
  if (bindings) return bindings;
  const user32 = koffi.load('user32.dll');
  const kernel32 = koffi.load('kernel32.dll');
  const advapi32 = koffi.load('advapi32.dll');
  const HANDLE = koffi.pointer('HANDLE', koffi.opaque());
  koffi.alias('HWND', HANDLE);

  bindings = {
    SendInput: user32.func('uint32_t __stdcall SendInput(uint32_t cInputs, void *pInputs, int cbSize)'),
    GetForegroundWindow: user32.func('HWND __stdcall GetForegroundWindow()'),
    GetWindowThreadProcessId: user32.func('uint32_t __stdcall GetWindowThreadProcessId(HWND hWnd, _Out_ uint32_t *lpdwProcessId)'),
    OpenProcess: kernel32.func('HANDLE __stdcall OpenProcess(uint32_t dwDesiredAccess, int bInheritHandle, uint32_t dwProcessId)'),
    GetCurrentProcess: kernel32.func('HANDLE __stdcall GetCurrentProcess()'),
    CloseHandle: kernel32.func('int __stdcall CloseHandle(HANDLE hObject)'),
    OpenProcessToken: advapi32.func('int __stdcall OpenProcessToken(HANDLE ProcessHandle, uint32_t DesiredAccess, _Out_ HANDLE *TokenHandle)'),
    GetTokenInformation: advapi32.func(
      'int __stdcall GetTokenInformation(HANDLE TokenHandle, int TokenInformationClass, _Out_ uint32_t *TokenInformation, uint32_t TokenInformationLength, _Out_ uint32_t *ReturnLength)',
    ),
  };
  return bindings;
}

/** Loads the Win32 bindings; throws if koffi cannot load. Call once at startup to fail early. */
export function initWin32(): void {
  load();
}

function writeKey(buffer: Buffer, index: number, vk: number, keyUp: boolean): void {
  const offset = index * INPUT_SIZE;
  buffer.writeUInt32LE(INPUT_KEYBOARD, offset);
  buffer.writeUInt16LE(vk, offset + 8); // wVk
  buffer.writeUInt16LE(0, offset + 10); // wScan
  buffer.writeUInt32LE(keyUp ? KEYEVENTF_KEYUP : 0, offset + 12); // dwFlags
  buffer.writeUInt32LE(0, offset + 16); // time
  buffer.writeBigUInt64LE(0n, offset + 24); // dwExtraInfo
}

/** Sends Ctrl+V as one atomic batch. Returns false when Windows did not accept all four events. */
export function sendPasteShortcut(): boolean {
  const { SendInput } = load();
  const inputs = Buffer.alloc(INPUT_SIZE * 4);
  writeKey(inputs, 0, VK_CONTROL, false);
  writeKey(inputs, 1, VK_V, false);
  writeKey(inputs, 2, VK_V, true);
  writeKey(inputs, 3, VK_CONTROL, true);
  return SendInput(4, inputs, INPUT_SIZE) === 4;
}

function isNullPointer(p: Pointer): boolean {
  return p === null || p === 0n;
}

/** null when the token of the process could not be queried. */
function tokenIsElevated(process: Pointer): boolean | null {
  const b = load();
  const token: Pointer[] = [null];
  if (!b.OpenProcessToken(process, TOKEN_QUERY, token) || isNullPointer(token[0] ?? null)) return null;
  try {
    const elevation = [0];
    const returned = [0];
    if (!b.GetTokenInformation(token[0] ?? null, TOKEN_ELEVATION_CLASS, elevation, 4, returned)) return null;
    return elevation[0] !== 0;
  } finally {
    b.CloseHandle(token[0] ?? null);
  }
}

export function isSelfElevated(): boolean {
  return tokenIsElevated(load().GetCurrentProcess()) === true;
}

/**
 * True when the focused window belongs to an elevated process (or one whose token we may not read,
 * which in practice means elevated). Windows UIPI drops synthetic input sent to such windows.
 */
export function isForegroundWindowElevated(): boolean {
  const b = load();
  const hwnd = b.GetForegroundWindow();
  if (isNullPointer(hwnd)) return false;
  const pid = [0];
  if (!b.GetWindowThreadProcessId(hwnd, pid) || !pid[0]) return false;
  const process = b.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid[0]);
  if (isNullPointer(process)) return false;
  try {
    return tokenIsElevated(process) !== false;
  } finally {
    b.CloseHandle(process);
  }
}
