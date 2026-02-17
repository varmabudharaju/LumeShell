import { create } from 'zustand';

type ActiveView = 'terminal' | 'explorer' | 'history' | 'settings';
type ThemeMode = 'dark' | 'light';

function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
}

interface UIState {
  activeView: ActiveView;
  chatPanelOpen: boolean;
  chatPanelMinimized: boolean;
  chatPanelWidth: number;
  explorerMinimized: boolean;
  themeMode: ThemeMode;
  toast: string | null;
  setActiveView: (view: ActiveView) => void;
  toggleChatPanel: () => void;
  setChatPanelOpen: (open: boolean) => void;
  setChatPanelMinimized: (minimized: boolean) => void;
  toggleChatPanelMinimized: () => void;
  setChatPanelWidth: (width: number) => void;
  setExplorerMinimized: (minimized: boolean) => void;
  toggleExplorerMinimized: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  toggleThemeMode: () => void;
  showToast: (message: string, duration?: number) => void;
}

// Apply dark theme immediately so CSS vars are available before React renders
applyTheme('dark');

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useUIStore = create<UIState>((set) => ({
  activeView: 'terminal',
  chatPanelOpen: true,
  chatPanelMinimized: false,
  chatPanelWidth: 380,
  explorerMinimized: false,
  themeMode: 'dark',
  toast: null,

  setActiveView: (view) => set({ activeView: view }),
  toggleChatPanel: () => set((state) => ({ chatPanelOpen: !state.chatPanelOpen, chatPanelMinimized: false })),
  setChatPanelOpen: (open) => set({ chatPanelOpen: open, chatPanelMinimized: false }),
  setChatPanelMinimized: (minimized) => set({ chatPanelMinimized: minimized }),
  toggleChatPanelMinimized: () => set((state) => ({ chatPanelMinimized: !state.chatPanelMinimized })),
  setChatPanelWidth: (width) => set({ chatPanelWidth: Math.max(280, Math.min(600, width)) }),
  setExplorerMinimized: (minimized) => set({ explorerMinimized: minimized }),
  toggleExplorerMinimized: () => set((state) => ({ explorerMinimized: !state.explorerMinimized })),

  setThemeMode: (mode) => {
    applyTheme(mode);
    set({ themeMode: mode });
  },
  toggleThemeMode: () =>
    set((state) => {
      const next = state.themeMode === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return { themeMode: next };
    }),

  showToast: (message, duration = 2000) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: message });
    toastTimer = setTimeout(() => {
      set({ toast: null });
      toastTimer = null;
    }, duration);
  },
}));
