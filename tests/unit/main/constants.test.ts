import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { IPC } from '../../../src/shared/constants';

describe('IPC Constants (Post-Fix)', () => {
  it('all IPC channel names are defined', () => {
    expect(IPC.TERMINAL_CREATE).toBe('terminal:create');
    expect(IPC.TERMINAL_WRITE).toBe('terminal:write');
    expect(IPC.TERMINAL_RESIZE).toBe('terminal:resize');
    expect(IPC.TERMINAL_KILL).toBe('terminal:kill');
    expect(IPC.TERMINAL_DATA).toBe('terminal:data');
    expect(IPC.TERMINAL_EXIT).toBe('terminal:exit');
    expect(IPC.TERMINAL_SEND_SIGNAL).toBe('terminal:send-signal');
    expect(IPC.TERMINAL_GET_CWD).toBe('terminal:get-cwd');
    expect(IPC.AI_CHAT).toBe('ai:chat');
    expect(IPC.AI_CHAT_CHUNK).toBe('ai:chat-chunk');
    expect(IPC.AI_CHAT_DONE).toBe('ai:chat-done');
    expect(IPC.AI_CHAT_ERROR).toBe('ai:chat-error');
    expect(IPC.FILE_LIST).toBe('file:list');
    expect(IPC.FILE_DELETE).toBe('file:delete');
    expect(IPC.FILE_READ).toBe('file:read');
    expect(IPC.FILE_WRITE).toBe('file:write');
  });

  it('TERMINAL_COMMAND_ENTERED is now in IPC constants', () => {
    expect(IPC.TERMINAL_COMMAND_ENTERED).toBe('terminal:command-entered');
  });

  it('TERMINAL_RUN_COMMAND is now in IPC constants', () => {
    expect(IPC.TERMINAL_RUN_COMMAND).toBe('terminal:run-command');
  });

  it('AI_CANCEL is now in IPC constants', () => {
    expect(IPC.AI_CANCEL).toBe('ai:cancel');
  });

  it('no hardcoded IPC strings in source files', () => {
    const ptyManagerSrc = fs.readFileSync(
      path.join(__dirname, '../../../src/main/terminal/pty-manager.ts'),
      'utf-8'
    );
    const ipcHandlersSrc = fs.readFileSync(
      path.join(__dirname, '../../../src/main/ipc-handlers.ts'),
      'utf-8'
    );
    const preloadSrc = fs.readFileSync(
      path.join(__dirname, '../../../src/preload.ts'),
      'utf-8'
    );

    // These should NOT contain hardcoded strings anymore
    expect(ptyManagerSrc).not.toContain("'terminal:command-entered'");
    expect(ipcHandlersSrc).not.toContain("'terminal:run-command'");
    expect(preloadSrc).not.toContain("'terminal:command-entered'");
    expect(preloadSrc).not.toContain("'terminal:run-command'");
  });
});
