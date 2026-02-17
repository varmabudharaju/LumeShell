import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTerminalStore } from '../../stores/terminal-store';
import { TerminalTabs } from './TerminalTabs';
import { TerminalPane, TerminalControls } from './TerminalPane';
import { EditorToolbar } from './EditorToolbar';

const ScrollTopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="18 15 12 9 6 15" />
    <line x1="6" y1="4" x2="18" y2="4" />
  </svg>
);

const ScrollBottomIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9" />
    <line x1="6" y1="20" x2="18" y2="20" />
  </svg>
);

const ClearIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4l16 16M20 4L4 20" />
  </svg>
);

const ToolbarButton: React.FC<{
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  color?: string;
}> = ({ onClick, title, children }) => (
  <button
    onClick={onClick}
    className="toolbar-btn-3d"
    title={title}
  >
    {children}
  </button>
);

export const TerminalManager: React.FC = () => {
  const { tabs, activeTabId, addTab, removeTab, updateTab, nextTab, prevTab } =
    useTerminalStore();
  // BUG-P05: Use ref + state split — ref for stable controls, state for volatile data
  const controlsRef = useRef<TerminalControls | null>(null);
  const [activeControls, setActiveControls] = useState<TerminalControls | null>(null);

  const handleControlsReady = useCallback((controls: TerminalControls) => {
    controlsRef.current = controls;
    // Only trigger re-render if the tab identity changed or buffer mode changed
    setActiveControls((prev) => {
      if (!prev || prev.isAlternateBuffer !== controls.isAlternateBuffer || prev.editorType !== controls.editorType) {
        return controls;
      }
      // Update ref but don't re-render for commandMarkers changes
      controlsRef.current = controls;
      return prev;
    });
  }, []);

  // Create first tab on mount
  useEffect(() => {
    if (tabs.length === 0) {
      addTab();
    }
  }, []);

  // Listen for terminal exit events
  useEffect(() => {
    const removeListener = window.lumeshell.terminal.onExit((id, _exitCode) => {
      updateTab(id, { isAlive: false, title: 'Exited' });
    });
    return removeListener;
  }, [updateTab]);

  // Menu keyboard shortcuts
  useEffect(() => {
    const removers = [
      window.lumeshell.onMenuEvent('menu:new-tab', addTab),
      window.lumeshell.onMenuEvent('menu:close-tab', () => {
        if (activeTabId) removeTab(activeTabId);
      }),
      window.lumeshell.onMenuEvent('menu:next-tab', nextTab),
      window.lumeshell.onMenuEvent('menu:prev-tab', prevTab),
      window.lumeshell.onMenuEvent('menu:clear-terminal', () => {
        activeControls?.clearTerminal();
      }),
    ];
    return () => removers.forEach((r) => r());
  }, [addTab, removeTab, activeTabId, nextTab, prevTab, activeControls]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TerminalTabs onClearTab={() => activeControls?.clearTerminal()} />

      {/* Navigation toolbar / Editor toolbar */}
      {activeTabId && (
        activeControls?.isAlternateBuffer && activeControls.editorType ? (
          <EditorToolbar editorType={activeControls.editorType} tabId={activeTabId} />
        ) : (
        <div
          className="h-[40px] flex items-center px-2 gap-1.5 shrink-0 glass"
          style={{ background: 'var(--sb-bg-base)', borderBottom: '1px solid var(--sb-border)' }}
        >
          <ToolbarButton
            onClick={() => activeControls?.scrollToTop()}
            title="Scroll to Top"
          >
            <ScrollTopIcon />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => activeControls?.scrollToBottom()}
            title="Scroll to Bottom"
          >
            <ScrollBottomIcon />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => activeControls?.clearTerminal()}
            title="Clear Terminal"
          >
            <ClearIcon />
          </ToolbarButton>
          <div className="flex-1" />
          {/* Stop button — sends Ctrl+C to active terminal */}
          <button
            onClick={() => window.lumeshell.terminal.sendSignal(activeTabId!, 'SIGINT')}
            className="flex items-center gap-1.5 px-2.5 h-[24px] rounded text-xs font-medium transition-all duration-150"
            style={{ color: 'var(--sb-red)', background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.2)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(248,81,73,0.2)';
              e.currentTarget.style.borderColor = 'rgba(248,81,73,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(248,81,73,0.1)';
              e.currentTarget.style.borderColor = 'rgba(248,81,73,0.2)';
            }}
            title="Stop running process (Ctrl+C)"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
            Stop
          </button>
        </div>
        )
      )}

      <div className="flex-1 relative">
        {tabs.map((tab) => (
          <TerminalPane
            key={tab.id}
            tabId={tab.id}
            isActive={tab.id === activeTabId}
            onControlsReady={handleControlsReady}
          />
        ))}
        {tabs.length === 0 && (
          <div className="flex items-center justify-center h-full" style={{ color: 'var(--sb-text-secondary)' }}>
            <button
              onClick={addTab}
              title="Open a new terminal tab"
              className="px-4 py-2 rounded-md transition-colors"
              style={{ background: 'var(--sb-bg-surface)', border: '1px solid var(--sb-border-strong)' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--sb-accent)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--sb-border-strong)'; }}
            >
              Open a new terminal tab
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
