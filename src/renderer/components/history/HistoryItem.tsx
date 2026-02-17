import React from 'react';
import type { HistoryEntry } from '../../stores/history-store';
import { useHistoryStore } from '../../stores/history-store';
import { useTerminalStore } from '../../stores/terminal-store';
import { formatTimestamp } from '../../lib/utils';

interface HistoryItemProps {
  entry: HistoryEntry;
}

export const HistoryItem: React.FC<HistoryItemProps> = ({ entry }) => {
  const { toggleBookmark, deleteEntry } = useHistoryStore();
  const activeTabId = useTerminalStore((s) => s.activeTabId);

  const handleRun = () => {
    if (!activeTabId) return;
    window.lumeshell.terminal.runCommand(activeTabId, entry.command);
  };

  return (
    <div
      className="group flex items-center gap-2 px-4 py-2 transition-colors"
      style={{ borderBottom: '1px solid var(--sb-border)' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--sb-bg-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <button
        onClick={() => toggleBookmark(entry.id)}
        title={entry.bookmarked ? 'Remove bookmark' : 'Bookmark command'}
        className="flex-shrink-0 transition-colors"
        style={{ color: entry.bookmarked ? 'var(--sb-yellow)' : 'var(--sb-text-secondary)' }}
        onMouseEnter={(e) => { if (!entry.bookmarked) e.currentTarget.style.color = 'var(--sb-yellow)'; }}
        onMouseLeave={(e) => { if (!entry.bookmarked) e.currentTarget.style.color = 'var(--sb-text-secondary)'; }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill={entry.bookmarked ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </button>

      <code className="flex-1 text-sm font-mono truncate" style={{ color: 'var(--sb-text-primary)' }}>{entry.command}</code>

      <span className="text-xs flex-shrink-0" style={{ color: 'var(--sb-text-placeholder)' }}>{formatTimestamp(entry.timestamp)}</span>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={handleRun}
          disabled={!activeTabId}
          title="Run this command in terminal"
          className="btn-3d-sm btn-3d-success px-2 py-0.5 text-xs rounded disabled:opacity-50"
        >
          Run
        </button>
        <button onClick={() => deleteEntry(entry.id)} title="Delete from history" className="btn-3d-icon-sm p-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
};
