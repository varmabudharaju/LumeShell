import { JsonStore } from './json-store';

export interface HistoryEntry {
  id: string;
  command: string;
  timestamp: number;
  bookmarked: boolean;
  tabId: string;
}

interface HistoryData {
  entries: HistoryEntry[];
}

let store: JsonStore<HistoryData>;

function getStore(): JsonStore<HistoryData> {
  if (!store) {
    store = new JsonStore<HistoryData>('history', { entries: [] });
  }
  return store;
}

export function getAllHistory(): HistoryEntry[] {
  return getStore().get('entries');
}

export function addHistoryEntry(command: string, tabId: string): HistoryEntry {
  const entry: HistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    command,
    timestamp: Date.now(),
    bookmarked: false,
    tabId,
  };

  const entries = getStore().get('entries');
  entries.unshift(entry);

  // Keep max 1000 entries
  if (entries.length > 1000) entries.length = 1000;
  getStore().set('entries', entries);

  return entry;
}

export function toggleBookmark(id: string): HistoryEntry | null {
  const entries = getStore().get('entries');
  const entry = entries.find((e) => e.id === id);
  if (!entry) return null;
  entry.bookmarked = !entry.bookmarked;
  getStore().set('entries', entries);
  return entry;
}

export function deleteHistoryEntry(id: string): void {
  const entries = getStore().get('entries').filter((e) => e.id !== id);
  getStore().set('entries', entries);
}

export function clearHistory(): void {
  getStore().set('entries', []);
}
