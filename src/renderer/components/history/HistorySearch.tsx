import React from 'react';
import { useHistoryStore } from '../../stores/history-store';

export const HistorySearch: React.FC = () => {
  const { searchQuery, setSearchQuery, showBookmarkedOnly, setShowBookmarkedOnly } =
    useHistoryStore();

  return (
    <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: '1px solid var(--sb-border-strong)' }}>
      <div className="input-3d flex-1 flex items-center gap-2 px-3 py-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--sb-text-secondary)" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search commands..."
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--sb-text-primary)' }}
        />
      </div>
      <button
        onClick={() => setShowBookmarkedOnly(!showBookmarkedOnly)}
        className={`btn-3d-icon-sm ${showBookmarkedOnly ? 'btn-3d-primary' : ''}`}
        style={showBookmarkedOnly ? { color: 'var(--sb-yellow)' } : {}}
        title="Show bookmarked only"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={showBookmarkedOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </button>
    </div>
  );
};
