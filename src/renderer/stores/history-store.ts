import { create } from 'zustand';

export interface HistoryEntry {
  id: string;
  command: string;
  timestamp: number;
  bookmarked: boolean;
  tabId: string;
}

interface HistoryState {
  entries: HistoryEntry[];
  searchQuery: string;
  showBookmarkedOnly: boolean;
  loadHistory: () => Promise<void>;
  addEntry: (command: string, tabId: string) => Promise<void>;
  toggleBookmark: (id: string) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setShowBookmarkedOnly: (show: boolean) => void;
  filteredEntries: () => HistoryEntry[];
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  entries: [],
  searchQuery: '',
  showBookmarkedOnly: false,

  loadHistory: async () => {
    const entries = await window.lumeshell.history.getAll();
    set({ entries });
  },

  addEntry: async (command: string, tabId: string) => {
    const entry = await window.lumeshell.history.add(command, tabId);
    set((state) => ({ entries: [entry, ...state.entries] }));
  },

  toggleBookmark: async (id: string) => {
    const updated = await window.lumeshell.history.toggleBookmark(id);
    if (updated) {
      set((state) => ({
        entries: state.entries.map((e) => (e.id === id ? updated : e)),
      }));
    }
  },

  deleteEntry: async (id: string) => {
    await window.lumeshell.history.delete(id);
    set((state) => ({ entries: state.entries.filter((e) => e.id !== id) }));
  },

  clearHistory: async () => {
    await window.lumeshell.history.clear();
    set({ entries: [] });
  },

  setSearchQuery: (query: string) => set({ searchQuery: query }),
  setShowBookmarkedOnly: (show: boolean) => set({ showBookmarkedOnly: show }),

  // BUG-L14: Still a method for API compat, but consumers should use the
  // useFilteredHistory() hook below for memoized access.
  filteredEntries: () => {
    const { entries, searchQuery, showBookmarkedOnly } = get();
    let filtered = entries;
    if (showBookmarkedOnly) {
      filtered = filtered.filter((e) => e.bookmarked);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((e) => e.command.toLowerCase().includes(q));
    }
    return filtered;
  },
}));

// BUG-L14: Memoized selector — only recomputes when entries/query/bookmark filter change
export function useFilteredHistory(): HistoryEntry[] {
  return useHistoryStore((state) => {
    let filtered = state.entries;
    if (state.showBookmarkedOnly) {
      filtered = filtered.filter((e) => e.bookmarked);
    }
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      filtered = filtered.filter((e) => e.command.toLowerCase().includes(q));
    }
    return filtered;
  });
}
