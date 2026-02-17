import React from 'react';
import { List } from 'react-window';
import { useHistoryStore, useFilteredHistory } from '../../stores/history-store';
import { HistorySearch } from './HistorySearch';
import { HistoryItem } from './HistoryItem';

import { HistoryEntry } from '../../stores/history-store';

interface HistoryRowProps {
  filtered: HistoryEntry[];
}

function HistoryRow({ index, style, filtered }: { index: number; style: React.CSSProperties } & HistoryRowProps): React.ReactElement {
  return (
    <div style={style}>
      <HistoryItem key={filtered[index].id} entry={filtered[index]} />
    </div>
  );
}

export const HistoryPanel: React.FC = () => {
  const { clearHistory, entries } = useHistoryStore();
  const filtered = useFilteredHistory(); // BUG-L14: memoized selector

  return (
    <div className="flex-1 flex flex-col" style={{ background: 'var(--sb-bg-body)' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 h-[44px]"
        style={{
          borderBottom: '1px solid var(--sb-border)',
          background: 'var(--sb-bg-base)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--sb-text-primary)' }}>
          Command History ({entries.length})
        </span>
        {entries.length > 0 && (
          <button onClick={clearHistory} title="Clear all command history" className="btn-3d-sm btn-3d-danger text-xs px-2 py-1">
            Clear All
          </button>
        )}
      </div>

      <HistorySearch />

      {/* List — BUG-P06: virtualized for large histories */}
      <div className="flex-1 overflow-hidden" style={{ position: 'relative' }}>
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm" style={{ color: 'var(--sb-text-secondary)' }}>
            {entries.length === 0 ? 'No commands recorded yet' : 'No matching commands'}
          </div>
        ) : (
          <List
            rowCount={filtered.length}
            rowHeight={56}
            rowComponent={HistoryRow as any}
            rowProps={{ filtered } as any}
            style={{ height: '100%' }}
          />
        )}
      </div>
    </div>
  );
};
