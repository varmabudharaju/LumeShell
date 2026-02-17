import { describe, it, expect } from 'vitest';
import {
  terminalTheme,
  terminalThemeLight,
  themePresets,
  getThemeByName,
  buildCustomTheme,
} from '../../../../src/renderer/lib/terminal-theme';

const REQUIRED_THEME_FIELDS = [
  'background', 'foreground', 'cursor', 'cursorAccent',
  'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
  'brightBlack', 'brightRed', 'brightGreen', 'brightYellow',
  'brightBlue', 'brightMagenta', 'brightCyan', 'brightWhite',
];

describe('Terminal Theme', () => {
  it('terminalTheme has all required ITheme fields', () => {
    for (const field of REQUIRED_THEME_FIELDS) {
      expect(terminalTheme).toHaveProperty(field);
      expect(typeof (terminalTheme as any)[field]).toBe('string');
    }
  });

  it('terminalThemeLight has all required ITheme fields', () => {
    for (const field of REQUIRED_THEME_FIELDS) {
      expect(terminalThemeLight).toHaveProperty(field);
    }
  });

  it('terminalThemeLight has light background', () => {
    expect(terminalThemeLight.background).toBe('#ffffff');
  });

  it('there are exactly 6 theme presets', () => {
    expect(themePresets.length).toBe(6);
  });

  it('all presets have valid name, label, background, foreground, cursor', () => {
    for (const preset of themePresets) {
      expect(preset.name).toBeTruthy();
      expect(preset.label).toBeTruthy();
      expect(preset.background).toMatch(/^#[0-9a-f]{6}$/i);
      expect(preset.foreground).toMatch(/^#[0-9a-f]{6}$/i);
      expect(preset.cursor).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('all preset themes have required fields', () => {
    for (const preset of themePresets) {
      for (const field of REQUIRED_THEME_FIELDS) {
        expect(preset.theme).toHaveProperty(field);
      }
    }
  });

  it('getThemeByName returns correct preset', () => {
    const dracula = getThemeByName('dracula');
    expect(dracula.background).toBe('#282a36');
  });

  it('getThemeByName returns default for unknown name', () => {
    const theme = getThemeByName('nonexistent');
    expect(theme).toEqual(terminalTheme);
  });

  it('buildCustomTheme overrides background/foreground/cursor', () => {
    const custom = buildCustomTheme('github-dark', {
      background: '#111111',
      foreground: '#eeeeee',
      cursor: '#ff0000',
    });
    expect(custom.background).toBe('#111111');
    expect(custom.foreground).toBe('#eeeeee');
    expect(custom.cursor).toBe('#ff0000');
  });

  it('buildCustomTheme preserves non-overridden fields', () => {
    const custom = buildCustomTheme('github-dark', { background: '#111111' });
    expect(custom.foreground).toBe(terminalTheme.foreground);
    expect(custom.cursor).toBe(terminalTheme.cursor);
    expect(custom.red).toBe(terminalTheme.red);
  });
});
