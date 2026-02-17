import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { useTerminal, CommandMarker } from '../../hooks/useTerminal';
import { useUIStore } from '../../stores/ui-store';
import { TerminalSearchBar } from './TerminalSearchBar';

interface TerminalPaneProps {
  tabId: string;
  isActive: boolean;
  onControlsReady?: (controls: TerminalControls) => void;
}

/* ── Ghost text autocomplete overlay ───────────────────────── */

const GhostTextOverlay: React.FC<{
  ghostText: string;
  termRef: React.RefObject<Terminal | null>;
}> = ({ ghostText, termRef }) => {
  const term = termRef.current;
  if (!term) return null;

  // Get cursor position and cell dimensions
  const cursorY = term.buffer.active.cursorY;
  const cursorX = term.buffer.active.cursorX;

  // Measure cell dimensions from the xterm DOM
  const xtermCore = (term as any)._core;
  const cellWidth = xtermCore?._renderService?.dimensions?.css?.cell?.width;
  const cellHeight = xtermCore?._renderService?.dimensions?.css?.cell?.height;

  if (!cellWidth || !cellHeight) return null;

  const left = cursorX * cellWidth;
  const top = cursorY * cellHeight;

  return (
    <div
      className="absolute pointer-events-none z-30 font-mono whitespace-pre"
      style={{
        left,
        top,
        fontSize: term.options.fontSize,
        fontFamily: term.options.fontFamily,
        lineHeight: `${cellHeight}px`,
        color: 'var(--sb-text-placeholder)',
        opacity: 0.5,
      }}
    >
      {ghostText}
    </div>
  );
};

export interface TerminalControls {
  scrollToTop: () => void;
  scrollToBottom: () => void;
  clearTerminal: () => void;
  scrollToLine: (line: number) => void;
  commandMarkers: CommandMarker[];
  getTotalRows: () => number;
  getViewportRows: () => number;
  isAlternateBuffer: boolean;
  editorType: 'vim' | 'nano' | 'other' | null;
}

const CommandMinimap: React.FC<{
  markers: CommandMarker[];
  getTotalRows: () => number;
  getViewportRows: () => number;
  scrollToLine: (line: number) => void;
}> = ({ markers, getTotalRows, scrollToLine }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (markers.length === 0) return null;

  const totalRows = getTotalRows();
  const maxLine = totalRows > 0 ? totalRows : 1;

  return (
    <div
      className="w-[18px] shrink-0 relative"
      style={{ background: 'var(--sb-bg-base)', borderLeft: '1px solid var(--sb-border)' }}
    >
      {markers.map((marker, idx) => {
        const top = Math.min((marker.line / maxLine) * 100, 98);
        return (
          <div
            key={idx}
            className="absolute cursor-pointer group"
            style={{
              top: `${top}%`,
              left: 3,
              right: 3,
            }}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            onClick={() => scrollToLine(Math.max(0, marker.line - 2))}
          >
            <div
              className="h-[4px] rounded-sm transition-all"
              style={{
                background: hoveredIdx === idx ? 'var(--sb-accent-blue)' : 'var(--sb-accent)',
                opacity: hoveredIdx === idx ? 1 : 0.6,
              }}
            />
            {hoveredIdx === idx && (
              <div
                className="absolute right-[22px] top-[-8px] px-2 py-1 rounded text-xs whitespace-nowrap z-50 glass"
                style={{
                  background: 'var(--sb-bg-overlay)',
                  border: '1px solid var(--sb-border-strong)',
                  color: 'var(--sb-text-primary)',
                  maxWidth: 280,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                <span style={{ color: 'var(--sb-text-secondary)' }}>cmd:</span>{' '}
                <span className="font-mono">{marker.command}</span>
                <div className="text-[10px] mt-0.5" style={{ color: 'var(--sb-text-muted)' }}>Click to jump</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ── Context menu item ──────────────────────────────────────── */

const CtxMenuItem: React.FC<{
  label: string;
  onClick: () => void;
  shortcut?: string;
  danger?: boolean;
}> = ({ label, onClick, shortcut, danger }) => (
  <button
    onClick={onClick}
    title={label}
    className="w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors"
    style={{ color: danger ? 'var(--sb-red)' : 'var(--sb-text-primary)' }}
    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--sb-bg-hover)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
  >
    <span>{label}</span>
    {shortcut && <span className="ml-4" style={{ color: 'var(--sb-text-muted)', fontSize: 10 }}>{shortcut}</span>}
  </button>
);

/* ── TerminalPane ───────────────────────────────────────────── */

export const TerminalPane: React.FC<TerminalPaneProps> = React.memo(({ tabId, isActive, onControlsReady }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const showToast = useUIStore((s) => s.showToast);

  const {
    termRef,
    fit,
    scrollToTop,
    scrollToBottom,
    clearTerminal,
    scrollToLine,
    commandMarkers,
    getTotalRows,
    getViewportRows,
    hasSelection,
    getSelection,
    selectAll,
    findNext,
    findPrevious,
    clearSearch,
    focus,
    ghostText,
    inputBuffer,
    acceptGhost,
  } = useTerminal({ tabId, containerRef });

  // ── Copy pill state ────────────────────────────────────────
  const [copyPillPos, setCopyPillPos] = useState<{ x: number; y: number } | null>(null);

  // Track mouseup position for copy pill placement
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMouseUp = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      mousePos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    el.addEventListener('mouseup', onMouseUp);
    return () => el.removeEventListener('mouseup', onMouseUp);
  }, []);

  // Show/hide copy pill when selection changes
  useEffect(() => {
    if (hasSelection) {
      setCopyPillPos({ x: mousePos.current.x, y: mousePos.current.y - 32 });
    } else {
      setCopyPillPos(null);
    }
  }, [hasSelection]);

  const handleCopySelection = useCallback(() => {
    const text = getSelection();
    if (text) {
      navigator.clipboard.writeText(text);
      showToast('Copied!');
    }
    setCopyPillPos(null);
  }, [getSelection, showToast]);

  // Dismiss copy pill on Cmd+C
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && hasSelection) {
        // Browser already copies; just show toast and hide pill
        setTimeout(() => {
          showToast('Copied!');
          setCopyPillPos(null);
        }, 50);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasSelection, showToast]);

  // ── Context menu state ─────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current?.querySelector('.xterm') as HTMLElement | null;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      // Position relative to container parent so it appears at mouse
      setCtxMenu({ x: e.clientX, y: e.clientY });
    };
    el.addEventListener('contextmenu', handler);
    return () => el.removeEventListener('contextmenu', handler);
  }, []);

  // Dismiss context menu on any click or keypress
  useEffect(() => {
    if (!ctxMenu) return;
    const dismiss = () => setCtxMenu(null);
    window.addEventListener('click', dismiss);
    window.addEventListener('keydown', dismiss);
    return () => {
      window.removeEventListener('click', dismiss);
      window.removeEventListener('keydown', dismiss);
    };
  }, [ctxMenu]);

  // ── Alternate buffer detection ─────────────────────────────
  const [isAlternateBuffer, setIsAlternateBuffer] = useState(false);
  const [editorType, setEditorType] = useState<'vim' | 'nano' | 'other' | null>(null);
  const termTitleRef = useRef<string>('');

  // Track terminal title changes for editor detection
  // BUG-L06: removed termRef.current from deps — refs aren't reactive
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    const disposable = term.onTitleChange((title) => {
      termTitleRef.current = title;
    });
    return () => disposable.dispose();
  }, []);

  // Poll alternate buffer status every 500ms
  useEffect(() => {
    const interval = setInterval(() => {
      const term = termRef.current;
      if (!term) return;
      const isAlt = term.buffer.active.type === 'alternate';
      setIsAlternateBuffer(isAlt);
      if (isAlt) {
        const title = termTitleRef.current.toLowerCase();
        if (title.includes('vim') || title.includes('nvim')) {
          setEditorType('vim');
        } else if (title.includes('nano')) {
          setEditorType('nano');
        } else {
          setEditorType('other');
        }
      } else {
        setEditorType(null);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // ── Search bar state ───────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false);

  // Cmd+F opens search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && isActive) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isActive]);

  const handleCloseSearch = useCallback(() => {
    setSearchOpen(false);
    clearSearch();
    focus();
  }, [clearSearch, focus]);

  // Expose controls to parent
  useEffect(() => {
    if (isActive && onControlsReady) {
      onControlsReady({
        scrollToTop,
        scrollToBottom,
        clearTerminal,
        scrollToLine,
        commandMarkers,
        getTotalRows,
        getViewportRows,
        isAlternateBuffer,
        editorType,
      });
    }
  }, [isActive, onControlsReady, scrollToTop, scrollToBottom, clearTerminal, scrollToLine, commandMarkers, getTotalRows, getViewportRows, isAlternateBuffer, editorType]);

  // Focus terminal when tab becomes active or when clicked
  useEffect(() => {
    if (isActive && termRef.current) {
      setTimeout(() => {
        termRef.current?.focus();
        fit();
      }, 50);
    }
  }, [isActive, termRef, fit]);

  const handleClick = () => {
    if (!ctxMenu) {
      termRef.current?.focus();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const path = e.dataTransfer.getData('text/plain');
    if (path) {
      window.lumeshell.terminal.write(tabId, path);
      termRef.current?.focus();
    }
  };

  return (
    <div
      className="absolute inset-0 flex"
      style={{ display: isActive ? 'flex' : 'none' }}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div ref={containerRef} className="flex-1 min-w-0 h-full overflow-hidden relative" style={{ background: 'var(--sb-bg-body)' }}>
        {/* Copy pill */}
        {copyPillPos && (
          <button
            onClick={(e) => { e.stopPropagation(); handleCopySelection(); }}
            title="Copy selected text"
            className="absolute z-40 px-3 py-1 rounded-full text-[11px] font-medium transition-all toast-fade-in cursor-pointer"
            style={{
              left: Math.max(8, Math.min(copyPillPos.x - 24, (containerRef.current?.offsetWidth ?? 300) - 72)),
              top: Math.max(4, copyPillPos.y),
              background: 'var(--sb-accent)',
              color: '#fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            Copy
          </button>
        )}

        {/* Ghost text autocomplete overlay */}
        {ghostText && isActive && (
          <GhostTextOverlay
            ghostText={ghostText}
            termRef={termRef}
          />
        )}

        {/* Search bar */}
        {searchOpen && (
          <TerminalSearchBar
            onFindNext={(q) => findNext(q)}
            onFindPrevious={(q) => findPrevious(q)}
            onClose={handleCloseSearch}
          />
        )}
      </div>

      <CommandMinimap
        markers={commandMarkers}
        getTotalRows={getTotalRows}
        getViewportRows={getViewportRows}
        scrollToLine={scrollToLine}
      />

      {/* Right-click context menu */}
      {ctxMenu && (
        <div
          className="fixed z-50 rounded-lg border shadow-lg py-1 min-w-[180px] glass"
          style={{
            left: ctxMenu.x,
            top: ctxMenu.y,
            background: 'var(--sb-bg-overlay)',
            borderColor: 'var(--sb-border-strong)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {hasSelection && (
            <CtxMenuItem
              label="Copy"
              shortcut="Cmd+C"
              onClick={() => {
                const text = getSelection();
                if (text) {
                  navigator.clipboard.writeText(text);
                  showToast('Copied!');
                }
                setCtxMenu(null);
              }}
            />
          )}
          <CtxMenuItem
            label="Paste"
            shortcut="Cmd+V"
            onClick={() => {
              navigator.clipboard.readText().then((text) => {
                if (text) window.lumeshell.terminal.write(tabId, text);
              }).catch(() => { /* clipboard permission denied or unavailable */ });
              setCtxMenu(null);
              focus();
            }}
          />
          <CtxMenuItem
            label="Select All"
            onClick={() => { selectAll(); setCtxMenu(null); }}
          />
          <div style={{ borderTop: '1px solid var(--sb-border)' }} className="my-1" />
          <CtxMenuItem
            label="Clear"
            shortcut="Cmd+K"
            onClick={() => { clearTerminal(); setCtxMenu(null); focus(); }}
          />
          <CtxMenuItem
            label="Find..."
            shortcut="Cmd+F"
            onClick={() => { setSearchOpen(true); setCtxMenu(null); }}
          />
        </div>
      )}
    </div>
  );
});
