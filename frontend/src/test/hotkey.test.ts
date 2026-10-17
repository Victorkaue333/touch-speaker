import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { DEFAULT_HOTKEY_TIMING, HotkeyController, type HotkeyHost, type SessionPhase } from '../main/hotkey';

class FakeHost implements HotkeyHost {
  phaseValue: SessionPhase = 'idle';
  inserting = false;
  calls: string[] = [];
  phase() {
    return this.phaseValue;
  }
  isInserting() {
    return this.inserting;
  }
  start() {
    this.calls.push('start');
    this.phaseValue = 'recording';
  }
  stop() {
    this.calls.push('stop');
    this.phaseValue = 'busy';
  }
  cancel(reason: 'escape' | 'shortcut') {
    this.calls.push(`cancel:${reason}`);
    this.phaseValue = 'idle';
  }
  switchToHandsFree() {
    this.calls.push('handsfree');
  }
}

describe('HotkeyController', () => {
  let clock = 0;
  let host: FakeHost;
  let hotkey: HotkeyController;

  beforeEach(() => {
    clock = 1_000_000;
    host = new FakeHost();
    hotkey = new HotkeyController(host, { holdThresholdMs: 500, ...DEFAULT_HOTKEY_TIMING, now: () => clock });
  });

  it('hold ≥ threshold starts on press and stops on release (FR-DICT-01)', () => {
    hotkey.onKeyDown('hotkey');
    clock += 1200;
    hotkey.onKeyUp('hotkey');
    assert.deepEqual(host.calls, ['start', 'stop']);
  });

  it('ignores keyboard auto-repeat while held', () => {
    hotkey.onKeyDown('hotkey');
    for (let i = 0; i < 20; i++) {
      clock += 33;
      hotkey.onKeyDown('hotkey');
    }
    clock += 400;
    hotkey.onKeyUp('hotkey');
    assert.deepEqual(host.calls, ['start', 'stop']);
  });

  it('short tap switches to hands-free; next tap stops (FR-DICT-02)', () => {
    hotkey.onKeyDown('hotkey');
    clock += 150;
    hotkey.onKeyUp('hotkey');
    assert.deepEqual(host.calls, ['start', 'handsfree']);

    clock += 15_000;
    hotkey.onKeyDown('hotkey');
    clock += 120;
    hotkey.onKeyUp('hotkey');
    assert.deepEqual(host.calls, ['start', 'handsfree', 'stop']);
  });

  it('Escape cancels a recording (FR-DICT-03)', () => {
    hotkey.onKeyDown('hotkey');
    clock += 150;
    hotkey.onKeyUp('hotkey');
    clock += 2000;
    hotkey.onKeyDown('escape');
    assert.deepEqual(host.calls, ['start', 'handsfree', 'cancel:escape']);
  });

  it('Escape does nothing when idle', () => {
    hotkey.onKeyDown('escape');
    assert.deepEqual(host.calls, []);
  });

  it('another key right after the dictation key means a shortcut: cancel silently', () => {
    hotkey.onKeyDown('hotkey');
    clock += 80;
    hotkey.onKeyDown('other');
    clock += 100;
    hotkey.onKeyUp('hotkey');
    assert.deepEqual(host.calls, ['start', 'cancel:shortcut']);
  });

  it('another key late in a long hold is ignored', () => {
    hotkey.onKeyDown('hotkey');
    clock += 3000;
    hotkey.onKeyDown('other');
    clock += 500;
    hotkey.onKeyUp('hotkey');
    assert.deepEqual(host.calls, ['start', 'stop']);
  });

  it('ignores every event while inserting (synthetic Ctrl+V)', () => {
    host.inserting = true;
    hotkey.onKeyDown('hotkey');
    hotkey.onKeyDown('other');
    hotkey.onKeyUp('hotkey');
    assert.deepEqual(host.calls, []);
  });

  it('ignores presses while transcribing', () => {
    host.phaseValue = 'busy';
    hotkey.onKeyDown('hotkey');
    clock += 800;
    hotkey.onKeyUp('hotkey');
    assert.deepEqual(host.calls, []);
  });

  it('a press long after a lost keyup is treated as a new press and stops the recording', () => {
    hotkey.onKeyDown('hotkey'); // keyup never arrives
    clock += 10_000;
    hotkey.onKeyDown('hotkey');
    assert.deepEqual(host.calls, ['start', 'stop']);
  });
});
