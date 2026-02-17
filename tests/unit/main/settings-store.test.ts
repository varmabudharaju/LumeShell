import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import os from 'os';

const TEST_DIR = path.join(os.tmpdir(), 'lumeshell-settings-test');

vi.mock('electron', () => ({
  app: { getPath: () => TEST_DIR },
}));

import { getAllSettings, getSetting, setSetting } from '../../../src/main/store/settings-store';

describe('Settings Store', () => {
  it('returns default settings', () => {
    const settings = getAllSettings();
    expect(settings.activeProvider).toBe('ollama');
    expect(settings.appearance.fontSize).toBe(14);
    expect(settings.appearance.mode).toBe('dark');
    expect(settings.appearance.themeName).toBe('github-dark');
  });

  it('has correct default provider configs', () => {
    const settings = getAllSettings();
    expect(settings.providers.ollama.model).toBe('qwen2.5-coder:1.5b');
    expect(settings.providers.openai.model).toBe('gpt-4o-mini');
    expect(settings.providers.claude.model).toBe('claude-sonnet-4-5-20250929');
    expect(settings.providers.gemini.model).toBe('gemini-2.0-flash');
  });

  it('getSetting returns a specific key', () => {
    const provider = getSetting('activeProvider');
    expect(provider).toBe('ollama');
  });

  it('setSetting updates and persists', () => {
    setSetting('activeProvider', 'openai');
    expect(getSetting('activeProvider')).toBe('openai');
    // Reset
    setSetting('activeProvider', 'ollama');
  });

  it('has notification defaults', () => {
    const settings = getAllSettings();
    expect(settings.notifications.soundEnabled).toBe(true);
    expect(settings.notifications.minCommandDuration).toBe(0);
    expect(settings.notifications.volume).toBe(0.5);
  });
});
