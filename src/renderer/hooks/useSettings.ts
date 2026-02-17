import { useEffect } from 'react';
import { useSettingsStore } from '../stores/settings-store';
import { useUIStore } from '../stores/ui-store';

export function useSettings() {
  const { loadSettings, settings, loaded } = useSettingsStore();
  const setThemeMode = useUIStore((s) => s.setThemeMode);

  useEffect(() => {
    if (!loaded) {
      loadSettings();
    }
  }, [loaded, loadSettings]);

  // Sync persisted theme mode to UI store on load
  useEffect(() => {
    if (settings?.appearance?.mode) {
      setThemeMode(settings.appearance.mode);
    }
  }, [loaded, settings?.appearance?.mode, setThemeMode]);

  return { settings, loaded };
}
