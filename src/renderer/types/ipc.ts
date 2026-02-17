export interface LumeShellAPI {
  terminal: {
    create: (id: string, cols?: number, rows?: number) => Promise<{ pid: number; shell: string }>;
    write: (id: string, data: string) => void;
    resize: (id: string, cols: number, rows: number) => void;
    kill: (id: string) => void;
    onData: (callback: (id: string, data: string) => void) => () => void;
    onExit: (callback: (id: string, exitCode: number) => void) => () => void;
    onCommandEntered: (callback: (id: string, command: string) => void) => () => void;
    runCommand: (tabId: string, command: string) => void;
    sendSignal: (id: string, signal: string) => void;
    getCwd: (id: string) => Promise<string>;
    onInputBuffer: (callback: (id: string, buffer: string) => void) => () => void;
  };
  ai: {
    chat: (providerName: string, messages: any[], requestId: string, context?: { cwd?: string; recentCommands?: string[] }) => Promise<void>;
    onChatChunk: (callback: (requestId: string, text: string) => void) => () => void;
    onChatDone: (callback: (requestId: string) => void) => () => void;
    onChatError: (callback: (requestId: string, error: string) => void) => () => void;
    explainCommand: (providerName: string, command: string) => Promise<any>;
    testConnection: (providerName: string) => Promise<boolean>;
  };
  history: {
    getAll: () => Promise<any[]>;
    add: (command: string, tabId: string) => Promise<any>;
    toggleBookmark: (id: string) => Promise<any>;
    delete: (id: string) => Promise<void>;
    clear: () => Promise<void>;
  };
  settings: {
    getAll: () => Promise<any>;
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => void;
  };
  files: {
    getHome: () => Promise<string>;
    list: (dirPath: string, showHidden?: boolean) => Promise<any[]>;
    delete: (targetPath: string) => Promise<void>;
    rename: (oldPath: string, newName: string) => Promise<string>;
    create: (parentPath: string, name: string, isDirectory: boolean) => Promise<string>;
    getPermissions: (targetPath: string) => Promise<{ mode: number; readable: string }>;
    setPermissions: (targetPath: string, mode: number) => Promise<void>;
    read: (filePath: string) => Promise<string>;
    write: (filePath: string, content: string) => Promise<void>;
  };
  google: {
    signIn: () => Promise<{ success: boolean; email?: string; error?: string }>;
    signOut: () => Promise<void>;
    getAuthStatus: () => Promise<{ signedIn: boolean; email?: string }>;
  };
  openExternal: (url: string) => Promise<void>;
  onMenuEvent: (event: string, callback: () => void) => () => void;
}

declare global {
  interface Window {
    lumeshell: LumeShellAPI;
  }
}
