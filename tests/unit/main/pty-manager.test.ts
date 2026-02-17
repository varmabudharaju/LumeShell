import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('PTY Manager (Post-Fix)', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../../../src/main/terminal/pty-manager.ts'),
    'utf-8'
  );

  it('getCwd uses async execFile (not sync execSync)', () => {
    expect(src).toContain("execFile('lsof'");
    expect(src).not.toContain('execSync(');
  });

  it('getCwd uses argument array (no command injection)', () => {
    expect(src).toContain("execFile('lsof', ['-p', String(instance.process.pid)]");
  });

  it('uses IPC.TERMINAL_COMMAND_ENTERED constant', () => {
    expect(src).toContain('IPC.TERMINAL_COMMAND_ENTERED');
    expect(src).not.toContain("'terminal:command-entered'");
  });

  it('handles both single keystrokes and pasted multi-char text', () => {
    expect(src).toContain('for (const char of data)');
    expect(src).not.toContain('data.length === 1');
  });

  it('command buffer handles backspace correctly', () => {
    expect(src).toContain("data === '\\x7f'");
    expect(src).toContain('commandBuffer.slice(0, -1)');
  });

  it('command buffer handles Ctrl+C correctly', () => {
    expect(src).toContain("data === '\\x03'");
    expect(src).toContain("instance.commandBuffer = ''");
  });

  it('has killAll method for cleanup', () => {
    expect(src).toContain('killAll()');
  });
});
