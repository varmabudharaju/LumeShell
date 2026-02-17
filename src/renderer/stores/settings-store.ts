import { create } from 'zustand';
import type { AppSettings } from '../types/settings';

interface SettingsState {
  settings: AppSettings | null;
  loaded: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  loaded: false,

  loadSettings: async () => {
    const settings = await window.lumeshell.settings.getAll();
    set({ settings, loaded: true });
  },

  updateSettings: (key, value) => {
    window.lumeshell.settings.set(key, value);
    set((state) => ({
      settings: state.settings ? { ...state.settings, [key]: value } : null,
    }));
  },
}));
