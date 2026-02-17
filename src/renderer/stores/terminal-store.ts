import { create } from 'zustand';
import type { TerminalTab } from '../types/terminal';
import { generateId } from '../lib/utils';

interface TerminalState {
  tabs: TerminalTab[];
  activeTabId: string | null;
  addTab: () => TerminalTab;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<TerminalTab>) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  nextTab: () => void;
  prevTab: () => void;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  addTab: () => {
    const tab: TerminalTab = {
      id: generateId(),
      title: 'Terminal',
      isAlive: true,
    };
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
    }));
    return tab;
  },

  removeTab: (id: string) => {
    const state = get();
    const index = state.tabs.findIndex((t) => t.id === id);
    const newTabs = state.tabs.filter((t) => t.id !== id);

    let newActiveId = state.activeTabId;
    if (state.activeTabId === id) {
      if (newTabs.length > 0) {
        const newIndex = Math.min(index, newTabs.length - 1);
        newActiveId = newTabs[newIndex].id;
      } else {
        newActiveId = null;
      }
    }

    set({ tabs: newTabs, activeTabId: newActiveId });
    window.lumeshell.terminal.kill(id);
  },

  setActiveTab: (id: string) => {
    set({ activeTabId: id });
  },

  updateTab: (id: string, updates: Partial<TerminalTab>) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  },

  reorderTabs: (fromIndex: number, toIndex: number) => {
    set((state) => {
      const newTabs = [...state.tabs];
      const [moved] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, moved);
      return { tabs: newTabs };
    });
  },

  nextTab: () => {
    const { tabs, activeTabId } = get();
    if (tabs.length <= 1) return;
    const index = tabs.findIndex((t) => t.id === activeTabId);
    const nextIndex = (index + 1) % tabs.length;
    set({ activeTabId: tabs[nextIndex].id });
  },

  prevTab: () => {
    const { tabs, activeTabId } = get();
    if (tabs.length <= 1) return;
    const index = tabs.findIndex((t) => t.id === activeTabId);
    const prevIndex = (index - 1 + tabs.length) % tabs.length;
    set({ activeTabId: tabs[prevIndex].id });
  },
}));
