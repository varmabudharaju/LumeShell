import { describe, it, expect, beforeEach, vi } from 'vitest';

// Must mock document BEFORE importing the store (which calls applyTheme at module level)
const mockDataset: Record<string, string> = {};
(globalThis as any).document = {
  documentElement: {
    dataset: mockDataset,
  },
};

// Now safe to import
const { useUIStore } = await import('../../../../src/renderer/stores/ui-store');

describe('UI Store', () => {
  beforeEach(() => {
    useUIStore.setState({
      activeView: 'terminal',
      chatPanelOpen: true,
      chatPanelWidth: 380,
      themeMode: 'dark',
      toast: null,
    });
  });

  it('default state is terminal view, chat open, dark mode', () => {
    const state = useUIStore.getState();
    expect(state.activeView).toBe('terminal');
    expect(state.chatPanelOpen).toBe(true);
    expect(state.themeMode).toBe('dark');
  });

  it('setActiveView changes activeView', () => {
    useUIStore.getState().setActiveView('settings');
    expect(useUIStore.getState().activeView).toBe('settings');
  });

  it('toggleChatPanel flips chatPanelOpen', () => {
    expect(useUIStore.getState().chatPanelOpen).toBe(true);
    useUIStore.getState().toggleChatPanel();
    expect(useUIStore.getState().chatPanelOpen).toBe(false);
    useUIStore.getState().toggleChatPanel();
    expect(useUIStore.getState().chatPanelOpen).toBe(true);
  });

  it('setChatPanelWidth clamps between 280 and 600', () => {
    useUIStore.getState().setChatPanelWidth(100);
    expect(useUIStore.getState().chatPanelWidth).toBe(280);

    useUIStore.getState().setChatPanelWidth(800);
    expect(useUIStore.getState().chatPanelWidth).toBe(600);

    useUIStore.getState().setChatPanelWidth(400);
    expect(useUIStore.getState().chatPanelWidth).toBe(400);
  });

  it('setThemeMode sets mode and updates document dataset', () => {
    useUIStore.getState().setThemeMode('light');
    expect(useUIStore.getState().themeMode).toBe('light');
    expect(mockDataset.theme).toBe('light');
  });

  it('toggleThemeMode switches dark ↔ light', () => {
    expect(useUIStore.getState().themeMode).toBe('dark');
    useUIStore.getState().toggleThemeMode();
    expect(useUIStore.getState().themeMode).toBe('light');
    useUIStore.getState().toggleThemeMode();
    expect(useUIStore.getState().themeMode).toBe('dark');
  });
});
