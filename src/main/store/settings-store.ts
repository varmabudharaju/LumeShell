import { JsonStore } from './json-store';

interface ProviderSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface AppSettings {
  activeProvider: string;
  providers: Record<string, ProviderSettings>;
  appearance: {
    fontSize: number;
    fontFamily: string;
    themeName: string;
    terminalBackground: string;
    terminalForeground: string;
    terminalCursor: string;
    mode: 'dark' | 'light';
  };
  notifications: {
    soundEnabled: boolean;
    minCommandDuration: number;
    volume: number;
  };
}

const defaults: AppSettings = {
  activeProvider: 'ollama',
  providers: {
    ollama: { apiKey: '', baseUrl: 'http://localhost:11434', model: 'qwen2.5-coder:1.5b' },
    gemini: { apiKey: '', baseUrl: '', model: 'gemini-2.0-flash' },
  },
  appearance: {
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    themeName: 'github-dark',
    terminalBackground: '#0d1117',
    terminalForeground: '#e6edf3',
    terminalCursor: '#388bfd',
    mode: 'dark',
  },
  notifications: {
    soundEnabled: true,
    minCommandDuration: 0,
    volume: 0.5,
  },
};

let store: JsonStore<AppSettings>;

function getStore(): JsonStore<AppSettings> {
  if (!store) {
    store = new JsonStore<AppSettings>('settings', defaults);
  }
  return store;
}

export function getSettings(): AppSettings {
  return getStore().store;
}

export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  return getStore().get(key);
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  getStore().set(key, value);
}

export function getAllSettings(): AppSettings {
  return getStore().store;
}

/** Flush pending writes immediately — call on app quit */
export function flushSettings(): void {
  if (store) store.flush();
}
