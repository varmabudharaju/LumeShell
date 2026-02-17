import React, { useEffect, useCallback, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { MainContent } from './components/layout/MainContent';
import { ChatPanel } from './components/chat/ChatPanel';
import { Sidebar } from './components/layout/Sidebar';
import { Toast } from './components/shared/Toast';
import { useUIStore } from './stores/ui-store';
import { useSettings } from './hooks/useSettings';
import { useCommandHistory } from './hooks/useCommandHistory';

/* ── Error Boundary ──────────────────────────────────────────── */

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            background: '#0d1117',
            color: '#e6edf3',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          }}
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f85149" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Something went wrong</h2>
          <p style={{ fontSize: 13, color: '#8b949e', maxWidth: 400, textAlign: 'center' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            title="Reload the application"
            style={{
              marginTop: 8,
              padding: '8px 20px',
              background: '#388bfd',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const SunIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
  </svg>
);

/* ── Chat panel resize handle ───────────────────────────────── */

const ResizeHandle: React.FC = () => {
  const setChatPanelWidth = useUIStore((s) => s.setChatPanelWidth);
  const dragging = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    let rafId: number | null = null;
    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      if (rafId) return; // BUG-P07: throttle to rAF
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const newWidth = window.innerWidth - ev.clientX;
        setChatPanelWidth(newWidth);
      });
    };
    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [setChatPanelWidth]);

  return (
    <div
      onMouseDown={onMouseDown}
      className="w-[4px] shrink-0 cursor-col-resize transition-colors duration-150 hover:bg-[var(--sb-accent)]"
      style={{ background: 'transparent' }}
      title="Drag to resize"
    />
  );
};

const App: React.FC = () => {
  const { chatPanelOpen, chatPanelMinimized, setChatPanelMinimized, toggleChatPanel, setActiveView, themeMode, toggleThemeMode } = useUIStore();
  useSettings();
  useCommandHistory();

  useEffect(() => {
    const removers = [
      window.lumeshell.onMenuEvent('menu:toggle-chat', toggleChatPanel),
      window.lumeshell.onMenuEvent('menu:settings', () => setActiveView('settings')),
    ];
    return () => removers.forEach((r) => r());
  }, [toggleChatPanel, setActiveView]);

  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--sb-bg-body)', color: 'var(--sb-text-primary)' }}>
        {/* Draggable title bar region */}
        <div
          className="h-[44px] flex items-center shrink-0 border-b glass"
          style={{ WebkitAppRegion: 'drag', borderColor: 'var(--sb-border)', background: 'var(--sb-bg-base)' } as React.CSSProperties}
        >
          <div className="w-[78px]" />
          <div className="flex-1 flex items-center justify-center">
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--sb-text-secondary)', letterSpacing: '0.15em' }}>
              LumeShell
            </span>
          </div>
          <div className="w-[78px] flex items-center justify-end pr-3">
            <button
              onClick={toggleThemeMode}
              className="w-7 h-7 flex items-center justify-center rounded-md transition-all duration-150"
              style={{ WebkitAppRegion: 'no-drag', color: 'var(--sb-text-secondary)' } as React.CSSProperties}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--sb-text-primary)'; e.currentTarget.style.background = 'var(--sb-bg-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--sb-text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
              title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {themeMode === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex min-h-0">
          <Sidebar />
          <MainContent />
          {chatPanelOpen && !chatPanelMinimized && (
            <>
              <ResizeHandle />
              <ChatPanel />
            </>
          )}
          {/* Minimized chat tab — slides out from right edge */}
          {chatPanelOpen && chatPanelMinimized && (
            <div
              className="chat-restore-tab"
              onClick={() => setChatPanelMinimized(false)}
              title="Restore AI Chat"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              <span className="chat-restore-label">AI Chat</span>
            </div>
          )}
        </div>

        <Toast />
      </div>
    </ErrorBoundary>
  );
};

export default App;
