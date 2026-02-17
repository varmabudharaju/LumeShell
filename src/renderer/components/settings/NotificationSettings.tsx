import React from 'react';
import { useSettingsStore } from '../../stores/settings-store';
import { playNotificationSound } from '../../lib/sound';

export const NotificationSettings: React.FC = () => {
  const { settings, updateSettings } = useSettingsStore();

  if (!settings) return null;

  const notif = settings.notifications ?? { soundEnabled: true, minCommandDuration: 0, volume: 0.5 };

  const update = (partial: Partial<typeof notif>) => {
    updateSettings('notifications', { ...notif, ...partial });
  };

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold" style={{ color: 'var(--sb-text-primary)' }}>
        Notifications
      </h2>

      {/* Sound toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={notif.soundEnabled}
          onChange={(e) => update({ soundEnabled: e.target.checked })}
          className="w-4 h-4 rounded accent-[#388bfd]"
        />
        <span className="text-sm" style={{ color: 'var(--sb-text-primary)' }}>
          Play sound when command completes
        </span>
      </label>

      {/* Min command duration */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs" style={{ color: 'var(--sb-text-secondary)' }}>
            Minimum command duration
          </label>
          <span className="text-xs font-mono" style={{ color: 'var(--sb-text-secondary)' }}>
            {notif.minCommandDuration}s
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={30}
          step={1}
          value={notif.minCommandDuration}
          onChange={(e) => update({ minCommandDuration: Number(e.target.value) })}
          className="w-full accent-[#388bfd]"
        />
        <div className="flex justify-between text-[10px]" style={{ color: 'var(--sb-text-muted)' }}>
          <span>0s (always)</span>
          <span>30s</span>
        </div>
      </div>

      {/* Volume */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs" style={{ color: 'var(--sb-text-secondary)' }}>
            Volume
          </label>
          <span className="text-xs font-mono" style={{ color: 'var(--sb-text-secondary)' }}>
            {Math.round(notif.volume * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(notif.volume * 100)}
          onChange={(e) => update({ volume: Number(e.target.value) / 100 })}
          className="w-full accent-[#388bfd]"
        />
        <div className="flex justify-between text-[10px]" style={{ color: 'var(--sb-text-muted)' }}>
          <span>0%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Test button */}
      <button
        onClick={() => playNotificationSound(notif.volume)}
        title="Play a test notification sound"
        className="px-3 py-1.5 text-xs rounded transition-colors"
        style={{
          background: 'var(--sb-bg-input)',
          border: '1px solid var(--sb-border-strong)',
          color: 'var(--sb-text-primary)',
        }}
      >
        Test Sound
      </button>
    </section>
  );
};
