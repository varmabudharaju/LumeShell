import React from 'react';
import { useUIStore } from '../../stores/ui-store';

export const Toast: React.FC = () => {
  const toast = useUIStore((s) => s.toast);

  if (!toast) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-full text-xs font-medium glass toast-fade-in"
      style={{
        background: 'var(--sb-bg-overlay)',
        border: '1px solid var(--sb-border-strong)',
        color: 'var(--sb-text-primary)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
      {toast}
    </div>
  );
};
