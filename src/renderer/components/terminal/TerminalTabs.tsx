import React, { useState, useRef, useCallback } from 'react';
import { useTerminalStore } from '../../stores/terminal-store';

interface TerminalTabsProps {
  onClearTab?: (tabId: string) => void;
}

export const TerminalTabs: React.FC<TerminalTabsProps> = ({ onClearTab }) => {
  const { tabs, activeTabId, setActiveTab, removeTab, addTab, updateTab, reorderTabs } = useTerminalStore();

  // P4.3: Inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameRef = useRef<HTMLInputElement>(null);

  const startRename = useCallback((tabId: string, currentTitle: string) => {
    setRenamingId(tabId);
    setRenameValue(currentTitle);
    setTimeout(() => renameRef.current?.select(), 0);
  }, []);

  const submitRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      updateTab(renamingId, { title: renameValue.trim() });
    }
    setRenamingId(null);
  }, [renamingId, renameValue, updateTab]);

  // P4.4: Drag reorder state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    // Make the drag image semi-transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = dragIndex;
    if (fromIndex !== null && fromIndex !== toIndex) {
      reorderTabs(fromIndex, toIndex);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }, [dragIndex, reorderTabs]);

  return (
    <div
      className="h-[44px] flex items-center px-3 gap-2 shrink-0 overflow-x-auto"
      style={{
        background: 'var(--sb-bg-base)',
        borderBottom: '1px solid var(--sb-border)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
      }}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTabId;
        const isRenaming = renamingId === tab.id;
        const isDragOver = dragOverIndex === index && dragIndex !== index;

        return (
          <div
            key={tab.id}
            draggable={!isRenaming}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onClick={() => { if (!isRenaming) setActiveTab(tab.id); }}
            onDoubleClick={() => startRename(tab.id, tab.title || `Terminal ${index + 1}`)}
            className={`group flex items-center gap-2 px-4 h-[32px] rounded-lg cursor-pointer transition-all duration-150 text-xs select-none ${isActive ? 'tab-3d-active' : 'tab-3d'}`}
            style={{
              borderLeft: isDragOver ? '2px solid var(--sb-accent)' : '2px solid transparent',
            }}
          >
            {/* Terminal icon */}
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2"
              style={{ opacity: isActive ? 1 : 0.5 }}
            >
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            {isRenaming ? (
              <input
                ref={renameRef}
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitRename();
                  if (e.key === 'Escape') setRenamingId(null);
                  e.stopPropagation();
                }}
                onBlur={submitRename}
                onClick={(e) => e.stopPropagation()}
                className="bg-transparent outline-none text-xs w-[80px]"
                style={{
                  color: 'var(--sb-text-primary)',
                  borderBottom: '1px solid var(--sb-accent)',
                  caretColor: 'var(--sb-accent)',
                }}
              />
            ) : (
              <span className="truncate max-w-[100px]">
                {tab.title || `Terminal ${index + 1}`}
              </span>
            )}
            {isActive && onClearTab && !isRenaming && (
              <button
                onClick={(e) => { e.stopPropagation(); onClearTab(tab.id); }}
                className="btn-3d-sm opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                style={{
                  padding: '2px 6px',
                  fontSize: '10px',
                  background: 'var(--sb-bg-hover)',
                }}
                title="Clear terminal"
              >
                Clear
              </button>
            )}
            {tabs.length > 1 && !isRenaming && (
              <button
                onClick={(e) => { e.stopPropagation(); removeTab(tab.id); }}
                className="opacity-0 group-hover:opacity-100 transition-all duration-150 w-5 h-5 flex items-center justify-center rounded-md"
                style={{ color: 'var(--sb-text-muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--sb-red)';
                  e.currentTarget.style.background = 'rgba(248, 81, 73, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--sb-text-muted)';
                  e.currentTarget.style.background = 'transparent';
                }}
                title="Close tab"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        );
      })}

      {/* New tab button */}
      <button
        onClick={addTab}
        className="btn-3d-icon-sm"
        style={{
          width: '32px',
          height: '32px',
          background: 'var(--sb-bg-surface)',
        }}
        title="New Tab (Cmd+T)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <div className="flex-1" />
    </div>
  );
};
