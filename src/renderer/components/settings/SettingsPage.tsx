import React, { Suspense } from 'react';

// P2.2: Lazy-load settings views for faster startup
const ProviderConfig = React.lazy(() => import('./ProviderConfig').then(m => ({ default: m.ProviderConfig })));
const AppearanceSettings = React.lazy(() => import('./AppearanceSettings').then(m => ({ default: m.AppearanceSettings })));
const NotificationSettings = React.lazy(() => import('./NotificationSettings').then(m => ({ default: m.NotificationSettings })));

const SettingsLoader = () => (
  <div className="flex items-center justify-center py-8">
    <div className="text-xs" style={{ color: 'var(--sb-text-secondary)' }}>Loading...</div>
  </div>
);

export const SettingsPage: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--sb-bg-body)' }}>
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--sb-text-primary)' }}>Settings</h1>
        <Suspense fallback={<SettingsLoader />}>
          <ProviderConfig />
          <AppearanceSettings />
          <NotificationSettings />
        </Suspense>
      </div>
    </div>
  );
};
