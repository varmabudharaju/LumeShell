import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Main Process (Post-Fix)', () => {
  const mainSrc = fs.readFileSync(
    path.join(__dirname, '../../../src/main.ts'),
    'utf-8'
  );

  it('has PTY cleanup on app quit', () => {
    expect(mainSrc).toContain('before-quit');
    expect(mainSrc).toContain('ptyManager.killAll()');
  });

  it('has correct security settings: nodeIntegration=false, contextIsolation=true', () => {
    expect(mainSrc).toContain('nodeIntegration: false');
    expect(mainSrc).toContain('contextIsolation: true');
  });

  it('registers IPC handlers before window creation', () => {
    const ipcIndex = mainSrc.indexOf('registerIpcHandlers()');
    const windowIndex = mainSrc.indexOf('createWindow()');
    expect(ipcIndex).toBeLessThan(windowIndex);
  });

  it('uses preload script for IPC bridge', () => {
    expect(mainSrc).toContain("preload: path.join(__dirname, 'preload.js')");
  });
});
