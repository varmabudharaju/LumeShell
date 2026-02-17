import React, { useRef, useEffect, useState } from 'react';

interface TerminalSearchBarProps {
  onFindNext: (query: string) => void;
  onFindPrevious: (query: string) => void;
  onClose: () => void;
}

export const TerminalSearchBar: React.FC<TerminalSearchBarProps> = ({ onFindNext, onFindPrevious, onClose }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (query.length > 0) {
      onFindNext(query);
    }
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        onFindPrevious(query);
      } else {
        onFindNext(query);
      }
    }
  };

  return (
    <div
      className="absolute top-2 right-6 z-40 flex items-center gap-1.5 px-2 py-1.5 rounded-lg glass"
      style={{
        background: 'var(--sb-bg-overlay)',
        border: '1px solid var(--sb-border-strong)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find..."
        className="w-[180px] px-2 py-1 text-xs rounded outline-none"
        style={{
          background: 'var(--sb-bg-input)',
          border: '1px solid var(--sb-border)',
          color: 'var(--sb-text-primary)',
        }}
      />
      <button
        onClick={() => onFindPrevious(query)}
        className="w-6 h-6 flex items-center justify-center rounded transition-colors"
        style={{ color: 'var(--sb-text-secondary)' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--sb-text-primary)'; e.currentTarget.style.background = 'var(--sb-bg-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--sb-text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
        title="Previous match (Shift+Enter)"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
      <button
        onClick={() => onFindNext(query)}
        className="w-6 h-6 flex items-center justify-center rounded transition-colors"
        style={{ color: 'var(--sb-text-secondary)' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--sb-text-primary)'; e.currentTarget.style.background = 'var(--sb-bg-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--sb-text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
        title="Next match (Enter)"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <button
        onClick={onClose}
        className="w-6 h-6 flex items-center justify-center rounded transition-colors"
        style={{ color: 'var(--sb-text-secondary)' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--sb-text-primary)'; e.currentTarget.style.background = 'var(--sb-bg-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--sb-text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
        title="Close (Esc)"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
};
