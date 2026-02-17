import React from 'react';
import { useSettingsStore } from '../../stores/settings-store';
import { useUIStore } from '../../stores/ui-store';
import { themePresets } from '../../lib/terminal-theme';

const ColorInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ label, value, onChange }) => (
  <div className="flex items-center gap-2">
    <label className="text-xs w-24" style={{ color: 'var(--sb-text-secondary)' }}>{label}</label>
    <div className="flex items-center gap-2 flex-1">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 rounded-lg cursor-pointer"
        style={{ boxShadow: 'var(--sb-btn-shadow)', border: 'none' }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-3d flex-1 px-2 py-1 text-xs font-mono"
      />
    </div>
  </div>
);

export const AppearanceSettings: React.FC = () => {
  const { settings, updateSettings } = useSettingsStore();
  const { themeMode, setThemeMode } = useUIStore();

  if (!settings) return null;

  const update = (partial: Partial<typeof settings.appearance>) => {
    updateSettings('appearance', { ...settings.appearance, ...partial });
  };

  const handleThemeChange = (themeName: string) => {
    const preset = themePresets.find((t) => t.name === themeName);
    if (preset) {
      update({
        themeName,
        terminalBackground: preset.background,
        terminalForeground: preset.foreground,
        terminalCursor: preset.cursor,
      });
    }
  };

  const handleModeToggle = (mode: 'dark' | 'light') => {
    setThemeMode(mode);
    update({ mode });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium" style={{ color: 'var(--sb-text-primary)' }}>Appearance</h2>

      {/* UI Mode toggle */}
      <div className="card-3d space-y-3 p-4">
        <label className="block text-xs mb-2" style={{ color: 'var(--sb-text-secondary)' }}>UI Mode</label>
        <div className="flex gap-2">
          {(['dark', 'light'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => handleModeToggle(mode)}
              title={`Switch to ${mode} mode`}
              className={`btn-3d flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium ${themeMode === mode ? 'btn-3d-primary' : ''}`}
            >
              {mode === 'dark' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
              )}
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="card-3d space-y-3 p-4">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--sb-text-secondary)' }}>
            Font Size: {settings.appearance.fontSize}px
          </label>
          <input
            type="range"
            min="10"
            max="24"
            value={settings.appearance.fontSize}
            onChange={(e) => update({ fontSize: Number(e.target.value) })}
            className="slider-3d w-full"
          />
        </div>

        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--sb-text-secondary)' }}>Font Family</label>
          <select
            value={settings.appearance.fontFamily}
            onChange={(e) => update({ fontFamily: e.target.value })}
            className="dropdown-3d w-full px-3 py-2 text-sm rounded-lg"
          >
            <option value='Menlo, Monaco, "Courier New", monospace'>Menlo</option>
            <option value='Monaco, Menlo, "Courier New", monospace'>Monaco</option>
            <option value='"SF Mono", Menlo, Monaco, monospace'>SF Mono</option>
            <option value='"Fira Code", Menlo, monospace'>Fira Code</option>
            <option value='"JetBrains Mono", Menlo, monospace'>JetBrains Mono</option>
            <option value='"Source Code Pro", Menlo, monospace'>Source Code Pro</option>
          </select>
        </div>
      </div>

      <h2 className="text-sm font-medium" style={{ color: 'var(--sb-text-primary)' }}>Terminal Theme</h2>

      <div className="card-3d space-y-3 p-4">
        {/* Theme presets */}
        <div>
          <label className="block text-xs mb-2" style={{ color: 'var(--sb-text-secondary)' }}>Theme Preset</label>
          <div className="grid grid-cols-3 gap-2">
            {themePresets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handleThemeChange(preset.name)}
                title={`Apply ${preset.label} theme`}
                className={`btn-3d flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${settings.appearance.themeName === preset.name ? 'btn-3d-primary' : ''}`}
              >
                <div
                  className="w-4 h-4 rounded-sm"
                  style={{ background: preset.background, border: '1px solid var(--sb-border-strong)' }}
                />
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom colors */}
        <div className="pt-2 space-y-2" style={{ borderTop: '1px solid var(--sb-border)' }}>
          <label className="block text-xs mb-1" style={{ color: 'var(--sb-text-secondary)' }}>Custom Colors</label>
          <ColorInput
            label="Background"
            value={settings.appearance.terminalBackground || '#0d1117'}
            onChange={(v) => update({ terminalBackground: v })}
          />
          <ColorInput
            label="Foreground"
            value={settings.appearance.terminalForeground || '#e6edf3'}
            onChange={(v) => update({ terminalForeground: v })}
          />
          <ColorInput
            label="Cursor"
            value={settings.appearance.terminalCursor || '#388bfd'}
            onChange={(v) => update({ terminalCursor: v })}
          />
        </div>

        {/* Preview */}
        <div className="pt-2" style={{ borderTop: '1px solid var(--sb-border)' }}>
          <label className="block text-xs mb-2" style={{ color: 'var(--sb-text-secondary)' }}>Preview</label>
          <div
            className="rounded-md p-3 font-mono text-xs leading-relaxed"
            style={{
              background: settings.appearance.terminalBackground || '#0d1117',
              color: settings.appearance.terminalForeground || '#e6edf3',
            }}
          >
            <div>$ ls -la</div>
            <div style={{ color: '#58a6ff' }}>drwxr-xr-x  5 user staff  160 Jan 10 14:30 .</div>
            <div style={{ color: '#3fb950' }}>-rw-r--r--  1 user staff  420 Jan 10 14:30 README.md</div>
            <div>$ echo "Hello from LumeShell"</div>
            <div>Hello from LumeShell</div>
            <div>
              <span>$ </span>
              <span
                className="inline-block w-2 h-3.5 rounded-sm animate-pulse"
                style={{ background: settings.appearance.terminalCursor || '#388bfd' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
