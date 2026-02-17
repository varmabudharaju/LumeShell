import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import path from 'path';

describe('IPC Input Validation (Post-Fix)', () => {
  const ipcHandlersSrc = fs.readFileSync(
    path.join(__dirname, '../../src/main/ipc-handlers.ts'),
    'utf-8'
  );

  it('has input type validation on IPC handlers', () => {
    const hasTypeChecks = ipcHandlersSrc.includes("typeof ");
    expect(hasTypeChecks).toBe(true);
  });

  it('validates terminal:create id', () => {
    expect(ipcHandlersSrc).toContain("typeof id !== 'string'");
  });

  it('settings:set uses ipcMain.handle (not fire-and-forget)', () => {
    expect(ipcHandlersSrc).toContain('ipcMain.handle(IPC.SETTINGS_SET');
    expect(ipcHandlersSrc).not.toContain('ipcMain.on(IPC.SETTINGS_SET');
  });

  it('uses IPC.TERMINAL_RUN_COMMAND constant (not hardcoded string)', () => {
    expect(ipcHandlersSrc).toContain('IPC.TERMINAL_RUN_COMMAND');
    expect(ipcHandlersSrc).not.toContain("'terminal:run-command'");
  });

  it('validates providerName against whitelist', () => {
    expect(ipcHandlersSrc).toContain('VALID_PROVIDERS.includes(providerName)');
  });

  it('validates file:set-permissions mode is a valid number', () => {
    expect(ipcHandlersSrc).toContain('Number.isFinite(mode)');
    expect(ipcHandlersSrc).toContain('mode > 0o777');
  });

  it('wraps handler errors to prevent stack trace leaks', () => {
    expect(ipcHandlersSrc).toContain('wrapError');
    const wrapCount = (ipcHandlersSrc.match(/wrapError/g) || []).length;
    expect(wrapCount).toBeGreaterThan(5);
  });

  it('uses IPC constants for command-entered in pty-manager', () => {
    const ptyManagerSrc = fs.readFileSync(
      path.join(__dirname, '../../src/main/terminal/pty-manager.ts'),
      'utf-8'
    );
    expect(ptyManagerSrc).toContain('IPC.TERMINAL_COMMAND_ENTERED');
    expect(ptyManagerSrc).not.toContain("'terminal:command-entered'");
  });
});
