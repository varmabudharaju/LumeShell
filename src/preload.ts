// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IPC } from './shared/constants';

type Callback = (...args: any[]) => void;

contextBridge.exposeInMainWorld('lumeshell', {
  // Terminal
  terminal: {
    create: (id: string, cols?: number, rows?: number) => ipcRenderer.invoke(IPC.TERMINAL_CREATE, id, cols, rows),
    write: (id: string, data: string) => ipcRenderer.send(IPC.TERMINAL_WRITE, id, data),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.send(IPC.TERMINAL_RESIZE, id, cols, rows),
    kill: (id: string) => ipcRenderer.send(IPC.TERMINAL_KILL, id),
    onData: (callback: (id: string, data: string) => void) => {
      const handler = (_event: IpcRendererEvent, id: string, data: string) => callback(id, data);
      ipcRenderer.on(IPC.TERMINAL_DATA, handler);
      return () => ipcRenderer.removeListener(IPC.TERMINAL_DATA, handler);
    },
    onExit: (callback: (id: string, exitCode: number) => void) => {
      const handler = (_event: IpcRendererEvent, id: string, exitCode: number) =>
        callback(id, exitCode);
      ipcRenderer.on(IPC.TERMINAL_EXIT, handler);
      return () => ipcRenderer.removeListener(IPC.TERMINAL_EXIT, handler);
    },
    onCommandEntered: (callback: (id: string, command: string) => void) => {
      const handler = (_event: IpcRendererEvent, id: string, command: string) =>
        callback(id, command);
      ipcRenderer.on(IPC.TERMINAL_COMMAND_ENTERED, handler);
      return () => ipcRenderer.removeListener(IPC.TERMINAL_COMMAND_ENTERED, handler);
    },
    runCommand: (tabId: string, command: string) =>
      ipcRenderer.send(IPC.TERMINAL_RUN_COMMAND, tabId, command),
    onInputBuffer: (callback: (id: string, buffer: string) => void) => {
      const handler = (_event: IpcRendererEvent, id: string, buffer: string) => callback(id, buffer);
      ipcRenderer.on(IPC.TERMINAL_INPUT_BUFFER, handler);
      return () => ipcRenderer.removeListener(IPC.TERMINAL_INPUT_BUFFER, handler);
    },
    sendSignal: (id: string, signal: string) =>
      ipcRenderer.send(IPC.TERMINAL_SEND_SIGNAL, id, signal),
    getCwd: (id: string) => ipcRenderer.invoke(IPC.TERMINAL_GET_CWD, id),
  },

  // AI
  ai: {
    chat: (providerName: string, messages: any[], requestId: string, context?: any) =>
      ipcRenderer.invoke(IPC.AI_CHAT, providerName, messages, requestId, context),
    cancel: (requestId: string) =>
      ipcRenderer.send(IPC.AI_CANCEL, requestId),
    onChatChunk: (callback: (requestId: string, text: string) => void) => {
      const handler = (_event: IpcRendererEvent, requestId: string, text: string) =>
        callback(requestId, text);
      ipcRenderer.on(IPC.AI_CHAT_CHUNK, handler);
      return () => ipcRenderer.removeListener(IPC.AI_CHAT_CHUNK, handler);
    },
    onChatDone: (callback: (requestId: string) => void) => {
      const handler = (_event: IpcRendererEvent, requestId: string) => callback(requestId);
      ipcRenderer.on(IPC.AI_CHAT_DONE, handler);
      return () => ipcRenderer.removeListener(IPC.AI_CHAT_DONE, handler);
    },
    onChatError: (callback: (requestId: string, error: string) => void) => {
      const handler = (_event: IpcRendererEvent, requestId: string, error: string) =>
        callback(requestId, error);
      ipcRenderer.on(IPC.AI_CHAT_ERROR, handler);
      return () => ipcRenderer.removeListener(IPC.AI_CHAT_ERROR, handler);
    },
    explainCommand: (providerName: string, command: string) =>
      ipcRenderer.invoke(IPC.AI_EXPLAIN, providerName, command),
    testConnection: (providerName: string) =>
      ipcRenderer.invoke(IPC.AI_TEST_CONNECTION, providerName),
  },

  // History
  history: {
    getAll: () => ipcRenderer.invoke(IPC.HISTORY_GET_ALL),
    add: (command: string, tabId: string) => ipcRenderer.invoke(IPC.HISTORY_ADD, command, tabId),
    toggleBookmark: (id: string) => ipcRenderer.invoke(IPC.HISTORY_TOGGLE_BOOKMARK, id),
    delete: (id: string) => ipcRenderer.invoke(IPC.HISTORY_DELETE, id),
    clear: () => ipcRenderer.invoke(IPC.HISTORY_CLEAR),
  },

  // Settings (changed set from send to invoke for error reporting)
  settings: {
    getAll: () => ipcRenderer.invoke(IPC.SETTINGS_GET_ALL),
    get: (key: string) => ipcRenderer.invoke(IPC.SETTINGS_GET, key),
    set: (key: string, value: any) => ipcRenderer.invoke(IPC.SETTINGS_SET, key, value),
  },

  // File Explorer
  files: {
    getHome: () => ipcRenderer.invoke(IPC.FILE_GET_HOME),
    list: (dirPath: string, showHidden?: boolean) => ipcRenderer.invoke(IPC.FILE_LIST, dirPath, showHidden),
    delete: (targetPath: string) => ipcRenderer.invoke(IPC.FILE_DELETE, targetPath),
    rename: (oldPath: string, newName: string) => ipcRenderer.invoke(IPC.FILE_RENAME, oldPath, newName),
    create: (parentPath: string, name: string, isDirectory: boolean) => ipcRenderer.invoke(IPC.FILE_CREATE, parentPath, name, isDirectory),
    getPermissions: (targetPath: string) => ipcRenderer.invoke(IPC.FILE_GET_PERMISSIONS, targetPath),
    setPermissions: (targetPath: string, mode: number) => ipcRenderer.invoke(IPC.FILE_SET_PERMISSIONS, targetPath, mode),
    read: (filePath: string) => ipcRenderer.invoke(IPC.FILE_READ, filePath),
    write: (filePath: string, content: string) => ipcRenderer.invoke(IPC.FILE_WRITE, filePath, content),
  },

  // Shell
  openExternal: (url: string) => ipcRenderer.invoke(IPC.SHELL_OPEN_EXTERNAL, url),

  // Google Auth
  google: {
    signIn: () => ipcRenderer.invoke(IPC.GOOGLE_AUTH_SIGN_IN),
    signOut: () => ipcRenderer.invoke(IPC.GOOGLE_AUTH_SIGN_OUT),
    getAuthStatus: () => ipcRenderer.invoke(IPC.GOOGLE_AUTH_STATUS),
  },

  // Menu events — BUG-S01: whitelist allowed channels
  onMenuEvent: (event: string, callback: Callback) => {
    const ALLOWED_MENU_EVENTS = [
      'menu:new-tab', 'menu:close-tab', 'menu:next-tab', 'menu:prev-tab',
      'menu:clear-terminal', 'menu:toggle-chat', 'menu:settings',
    ];
    if (!ALLOWED_MENU_EVENTS.includes(event)) {
      console.warn(`[preload] Blocked menu event registration for: ${event}`);
      return () => {};
    }
    const handler = () => callback();
    ipcRenderer.on(event, handler);
    return () => ipcRenderer.removeListener(event, handler);
  },
});
