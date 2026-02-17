import React from 'react';
import { useUIStore } from '../../stores/ui-store';
import { TerminalManager } from '../terminal/TerminalManager';
import { HistoryPanel } from '../history/HistoryPanel';
import { SettingsPage } from '../settings/SettingsPage';
import { FileExplorer } from '../explorer/FileExplorer';

export const MainContent: React.FC = () => {
  const activeView = useUIStore((s) => s.activeView);

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className={activeView === 'terminal' ? 'flex-1 flex flex-col' : 'hidden'}>
        <TerminalManager />
      </div>
      {activeView === 'explorer' && <FileExplorer />}
      {activeView === 'history' && <HistoryPanel />}
      {activeView === 'settings' && <SettingsPage />}
    </div>
  );
};
