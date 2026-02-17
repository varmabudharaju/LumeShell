import { ipcMain, shell } from 'electron';
import { IPC } from '../shared/constants';
import { ptyManager } from './terminal/pty-manager';
import { aiService } from './ai/ai-service';
import {
  getAllHistory,
  addHistoryEntry,
  toggleBookmark,
  deleteHistoryEntry,
  clearHistory,
} from './store/history-store';
import { getAllSettings, getSetting, setSetting } from './store/settings-store';
import {
  listDirectory,
  deleteFileOrDir,
  renameFileOrDir,
  createFileOrDir,
  getPermissions,
  setPermissions,
  getHomePath,
  readFile,
  writeFile,
} from './file-explorer';
import * as googleAuth from './auth/google-auth';

const VALID_PROVIDERS = ['ollama', 'gemini'];

function wrapError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function registerIpcHandlers(): void {
  // Terminal handlers
  ipcMain.handle(IPC.TERMINAL_CREATE, (_event, id: string, cols?: number, rows?: number) => {
    if (typeof id !== 'string' || !id) throw new Error('Invalid terminal id');
    return ptyManager.create(id, cols, rows);
  });

  ipcMain.on(IPC.TERMINAL_WRITE, (_event, id: string, data: string) => {
    if (typeof id !== 'string' || typeof data !== 'string') return;
    ptyManager.write(id, data);
  });

  ipcMain.on(IPC.TERMINAL_RESIZE, (_event, id: string, cols: number, rows: number) => {
    if (typeof id !== 'string') return;
    if (typeof cols !== 'number' || typeof rows !== 'number') return;
    ptyManager.resize(id, cols, rows);
  });

  ipcMain.on(IPC.TERMINAL_KILL, (_event, id: string) => {
    if (typeof id !== 'string') return;
    ptyManager.kill(id);
  });

  // AI handlers
  ipcMain.handle(
    IPC.AI_CHAT,
    async (_event, providerName: string, messages: any[], requestId: string, context?: any) => {
      if (typeof providerName !== 'string' || !VALID_PROVIDERS.includes(providerName)) {
        throw new Error(`Invalid provider: ${providerName}. Must be one of: ${VALID_PROVIDERS.join(', ')}`);
      }
      if (!Array.isArray(messages)) throw new Error('Invalid messages: must be an array');
      if (typeof requestId !== 'string') throw new Error('Invalid requestId');
      try {
        const settings = getAllSettings();
        const providerConfig = settings.providers[providerName] || {};
        await aiService.chat(providerName, providerConfig, messages, requestId, context);
      } catch (error) {
        throw new Error(wrapError(error));
      }
    }
  );

  ipcMain.handle(
    IPC.AI_EXPLAIN,
    async (_event, providerName: string, command: string) => {
      if (typeof providerName !== 'string' || !VALID_PROVIDERS.includes(providerName)) {
        throw new Error(`Invalid provider: ${providerName}`);
      }
      if (typeof command !== 'string') throw new Error('Invalid command');
      try {
        const settings = getAllSettings();
        const providerConfig = settings.providers[providerName] || {};
        return await aiService.explainCommand(providerName, providerConfig, command);
      } catch (error) {
        throw new Error(wrapError(error));
      }
    }
  );

  ipcMain.handle(
    IPC.AI_TEST_CONNECTION,
    async (_event, providerName: string) => {
      if (typeof providerName !== 'string' || !VALID_PROVIDERS.includes(providerName)) {
        return false;
      }
      try {
        const settings = getAllSettings();
        const providerConfig = settings.providers[providerName] || {};
        return await aiService.testConnection(providerName, providerConfig);
      } catch {
        return false;
      }
    }
  );

  // AI cancel
  ipcMain.on(IPC.AI_CANCEL, (_event, requestId: string) => {
    if (typeof requestId !== 'string') return;
    aiService.cancelChat(requestId);
  });

  // Run command in terminal (now using IPC constant)
  ipcMain.on(IPC.TERMINAL_RUN_COMMAND, (_event, tabId: string, command: string) => {
    if (typeof tabId !== 'string' || typeof command !== 'string') return;
    ptyManager.writeCommand(tabId, command);
  });

  // History handlers
  ipcMain.handle(IPC.HISTORY_GET_ALL, () => {
    return getAllHistory();
  });

  ipcMain.handle(IPC.HISTORY_ADD, (_event, command: string, tabId: string) => {
    if (typeof command !== 'string' || typeof tabId !== 'string') {
      throw new Error('Invalid history entry parameters');
    }
    return addHistoryEntry(command, tabId);
  });

  ipcMain.handle(IPC.HISTORY_TOGGLE_BOOKMARK, (_event, id: string) => {
    if (typeof id !== 'string') throw new Error('Invalid history id');
    return toggleBookmark(id);
  });

  ipcMain.handle(IPC.HISTORY_DELETE, (_event, id: string) => {
    if (typeof id !== 'string') throw new Error('Invalid history id');
    deleteHistoryEntry(id);
  });

  ipcMain.handle(IPC.HISTORY_CLEAR, () => {
    clearHistory();
  });

  // Settings handlers — BUG-S03: Strip sensitive fields before sending to renderer
  ipcMain.handle(IPC.SETTINGS_GET_ALL, () => {
    const settings = getAllSettings();
    const safe = JSON.parse(JSON.stringify(settings));
    if (safe.providers) {
      for (const p of Object.values(safe.providers) as any[]) {
        if (p.apiKey) p.apiKey = p.apiKey ? '••••••' : '';
      }
    }
    return safe;
  });

  ipcMain.handle(IPC.SETTINGS_GET, (_event, key: string) => {
    if (typeof key !== 'string') throw new Error('Invalid settings key');
    return getSetting(key as any);
  });

  // BUG-S04: Validate settings key against known schema
  const VALID_SETTINGS_KEYS = ['activeProvider', 'providers', 'appearance', 'notifications'];
  ipcMain.handle(IPC.SETTINGS_SET, (_event, key: string, value: any) => {
    if (typeof key !== 'string') throw new Error('Invalid settings key');
    if (!VALID_SETTINGS_KEYS.includes(key)) throw new Error(`Unknown settings key: ${key}`);
    try {
      setSetting(key as any, value);
    } catch (error) {
      throw new Error(wrapError(error));
    }
  });

  // Terminal signal (stop button)
  ipcMain.on(IPC.TERMINAL_SEND_SIGNAL, (_event, id: string, signal: string) => {
    if (typeof id !== 'string' || typeof signal !== 'string') return;
    ptyManager.sendSignal(id, signal);
  });

  // Terminal CWD (now async)
  ipcMain.handle(IPC.TERMINAL_GET_CWD, async (_event, id: string) => {
    if (typeof id !== 'string') throw new Error('Invalid terminal id');
    return ptyManager.getCwd(id);
  });

  // File Explorer handlers
  ipcMain.handle(IPC.FILE_GET_HOME, () => {
    return getHomePath();
  });

  ipcMain.handle(IPC.FILE_LIST, (_event, dirPath: string, showHidden?: boolean) => {
    if (typeof dirPath !== 'string') throw new Error('Invalid directory path');
    try {
      return listDirectory(dirPath, showHidden);
    } catch (error) {
      throw new Error(wrapError(error));
    }
  });

  ipcMain.handle(IPC.FILE_DELETE, (_event, targetPath: string) => {
    if (typeof targetPath !== 'string') throw new Error('Invalid path');
    try {
      deleteFileOrDir(targetPath);
    } catch (error) {
      throw new Error(wrapError(error));
    }
  });

  ipcMain.handle(IPC.FILE_RENAME, (_event, oldPath: string, newName: string) => {
    if (typeof oldPath !== 'string' || typeof newName !== 'string') {
      throw new Error('Invalid rename parameters');
    }
    try {
      return renameFileOrDir(oldPath, newName);
    } catch (error) {
      throw new Error(wrapError(error));
    }
  });

  ipcMain.handle(IPC.FILE_CREATE, (_event, parentPath: string, name: string, isDirectory: boolean) => {
    if (typeof parentPath !== 'string' || typeof name !== 'string') {
      throw new Error('Invalid create parameters');
    }
    try {
      return createFileOrDir(parentPath, name, isDirectory);
    } catch (error) {
      throw new Error(wrapError(error));
    }
  });

  ipcMain.handle(IPC.FILE_GET_PERMISSIONS, (_event, targetPath: string) => {
    if (typeof targetPath !== 'string') throw new Error('Invalid path');
    try {
      return getPermissions(targetPath);
    } catch (error) {
      throw new Error(wrapError(error));
    }
  });

  ipcMain.handle(IPC.FILE_SET_PERMISSIONS, (_event, targetPath: string, mode: number) => {
    if (typeof targetPath !== 'string') throw new Error('Invalid path');
    if (typeof mode !== 'number' || !Number.isFinite(mode) || mode < 0 || mode > 0o777) {
      throw new Error('Invalid mode: must be a number between 0 and 511 (0o777)');
    }
    try {
      setPermissions(targetPath, mode);
    } catch (error) {
      throw new Error(wrapError(error));
    }
  });

  // File read/write (editor)
  ipcMain.handle(IPC.FILE_READ, (_event, filePath: string) => {
    if (typeof filePath !== 'string') throw new Error('Invalid file path');
    try {
      return readFile(filePath);
    } catch (error) {
      throw new Error(wrapError(error));
    }
  });

  ipcMain.handle(IPC.FILE_WRITE, (_event, filePath: string, content: string) => {
    if (typeof filePath !== 'string' || typeof content !== 'string') {
      throw new Error('Invalid write parameters');
    }
    try {
      writeFile(filePath, content);
    } catch (error) {
      throw new Error(wrapError(error));
    }
  });

  // Shell: open external URL
  ipcMain.handle(IPC.SHELL_OPEN_EXTERNAL, (_event, url: string) => {
    if (typeof url !== 'string' || !url.startsWith('https://')) {
      throw new Error('Invalid URL: must start with https://');
    }
    return shell.openExternal(url);
  });

  // Google Auth handlers
  ipcMain.handle(IPC.GOOGLE_AUTH_SIGN_IN, async () => {
    return googleAuth.startAuth();
  });

  ipcMain.handle(IPC.GOOGLE_AUTH_SIGN_OUT, () => {
    googleAuth.signOut();
  });

  ipcMain.handle(IPC.GOOGLE_AUTH_STATUS, () => {
    return googleAuth.getAuthStatus();
  });
}
