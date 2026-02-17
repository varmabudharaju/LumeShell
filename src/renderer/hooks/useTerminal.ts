import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { terminalTheme, terminalThemeLight, buildCustomTheme } from '../lib/terminal-theme';
import { useSettingsStore } from '../stores/settings-store';
import { useUIStore } from '../stores/ui-store';
import { useHistoryStore } from '../stores/history-store';
import { playNotificationSound, warmUpAudio } from '../lib/sound';
import { registerDataHandler, registerCommandHandler } from '../lib/pty-dispatcher';

export interface CommandMarker {
  command: string;
  line: number;
}

interface UseTerminalOptions {
  tabId: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function resolveTheme(settings: any, themeMode: 'dark' | 'light') {
  if (settings?.appearance?.terminalBackground) {
    return buildCustomTheme(
      settings.appearance.themeName || 'github-dark',
      {
        background: settings.appearance.terminalBackground,
        foreground: settings.appearance.terminalForeground,
        cursor: settings.appearance.terminalCursor,
      }
    );
  }
  return themeMode === 'light' ? terminalThemeLight : terminalTheme;
}

export function useTerminal({ tabId, containerRef }: UseTerminalOptions) {
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);
  const initializedRef = useRef(false);
  const settings = useSettingsStore((s) => s.settings);
  const themeMode = useUIStore((s) => s.themeMode);
  const [commandMarkers, setCommandMarkers] = useState<CommandMarker[]>([]);
  const [hasSelection, setHasSelection] = useState(false);

  // Terminal autocomplete state
  const [ghostText, setGhostText] = useState<string | null>(null);
  const [inputBuffer, setInputBuffer] = useState('');
  const ghostRef = useRef<string | null>(null); // non-reactive for key handler

  const fit = useCallback(() => {
    if (fitRef.current && containerRef.current) {
      try {
        fitRef.current.fit();
        const term = termRef.current;
        if (term) {
          window.lumeshell.terminal.resize(tabId, term.cols, term.rows);
        }
      } catch {
        // ignore fit errors during transitions
      }
    }
  }, [tabId, containerRef]);

  const scrollToTop = useCallback(() => {
    termRef.current?.scrollToTop();
  }, []);

  const scrollToBottom = useCallback(() => {
    termRef.current?.scrollToBottom();
  }, []);

  const clearTerminal = useCallback(() => {
    termRef.current?.clear();
    setCommandMarkers([]);
  }, []);

  const scrollToLine = useCallback((line: number) => {
    termRef.current?.scrollToLine(line);
  }, []);

  const getTotalRows = useCallback(() => {
    const term = termRef.current;
    if (!term) return 0;
    return term.buffer.active.length;
  }, []);

  const getViewportRows = useCallback(() => {
    return termRef.current?.rows ?? 0;
  }, []);

  const getSelection = useCallback(() => {
    return termRef.current?.getSelection() ?? '';
  }, []);

  const selectAll = useCallback(() => {
    termRef.current?.selectAll();
  }, []);

  const findNext = useCallback((query: string, opts?: { caseSensitive?: boolean; regex?: boolean; wholeWord?: boolean }) => {
    searchRef.current?.findNext(query, opts);
  }, []);

  const findPrevious = useCallback((query: string, opts?: { caseSensitive?: boolean; regex?: boolean; wholeWord?: boolean }) => {
    searchRef.current?.findPrevious(query, opts);
  }, []);

  const clearSearch = useCallback(() => {
    searchRef.current?.clearDecorations();
  }, []);

  const focus = useCallback(() => {
    termRef.current?.focus();
  }, []);

  const acceptGhost = useCallback(() => {
    const ghost = ghostRef.current;
    if (ghost && termRef.current) {
      // Type the remaining text into the terminal
      window.lumeshell.terminal.write(tabId, ghost);
      setGhostText(null);
      ghostRef.current = null;
    }
  }, [tabId]);

  // Listen for input buffer from main process and compute suggestions
  useEffect(() => {
    const removeBufferListener = window.lumeshell.terminal.onInputBuffer((id, buffer) => {
      if (id !== tabId) return;
      setInputBuffer(buffer);

      if (buffer.length < 2) {
        setGhostText(null);
        ghostRef.current = null;
        return;
      }

      const lower = buffer.toLowerCase();
      const entries = useHistoryStore.getState().entries;
      for (const entry of entries) {
        const cmd = entry.command;
        if (cmd.toLowerCase().startsWith(lower) && cmd.length > buffer.length) {
          const remainder = cmd.slice(buffer.length);
          setGhostText(remainder);
          ghostRef.current = remainder;
          return;
        }
      }
      setGhostText(null);
      ghostRef.current = null;
    });
    return removeBufferListener;
  }, [tabId]);

  // Live-update theme when settings or UI mode change
  useEffect(() => {
    if (!termRef.current || !settings?.appearance) return;
    termRef.current.options.theme = resolveTheme(settings, themeMode);
  }, [
    settings?.appearance?.themeName,
    settings?.appearance?.terminalBackground,
    settings?.appearance?.terminalForeground,
    settings?.appearance?.terminalCursor,
    themeMode,
  ]);

  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const fontSize = settings?.appearance?.fontSize || 14;
    const fontFamily = settings?.appearance?.fontFamily || 'Menlo, Monaco, "Courier New", monospace';
    const theme = resolveTheme(settings, themeMode);

    const term = new Terminal({
      theme,
      fontSize,
      fontFamily,
      cursorBlink: true,
      cursorStyle: 'bar',
      allowProposedApi: true,
      scrollback: 5000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(searchAddon);

    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitRef.current = fitAddon;
    searchRef.current = searchAddon;

    // Intercept Right arrow to accept ghost text autocomplete
    term.attachCustomKeyEventHandler((e) => {
      if (e.type === 'keydown' && e.key === 'ArrowRight' && ghostRef.current) {
        e.preventDefault();
        acceptGhost();
        return false; // prevent xterm from processing
      }
      return true;
    });

    // Track text selection for copy tooltip
    term.onSelectionChange(() => {
      const sel = term.getSelection();
      setHasSelection(!!sel && sel.length >= 2);
    });

    // Intercept Cmd+F to prevent xterm from consuming it
    term.attachCustomKeyEventHandler((e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        return false; // let it bubble up to TerminalPane
      }
      return true;
    });

    // --- Notification sound state ---
    let commandStartTime = 0;
    let commandRunning = false;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const getNotifSettings = () => {
      const notif = useSettingsStore.getState().settings?.notifications;
      return {
        soundEnabled: notif?.soundEnabled ?? true,
        minCommandDuration: notif?.minCommandDuration ?? 0,
        volume: notif?.volume ?? 0.5,
      };
    };

    // Wire input to PTY + reset notification on Ctrl+C
    term.onData((data) => {
      warmUpAudio(); // Unlock AudioContext on first user keypress
      if (data === '\x03') {
        // Ctrl+C cancels the running command — don't chime for it
        commandRunning = false;
        if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
      }
      window.lumeshell.terminal.write(tabId, data);
    });

    // Create PTY with the correct dimensions from fitAddon so the shell
    // starts at the right size — no resize needed, no escape sequence artifacts.
    fitAddon.fit();
    window.lumeshell.terminal.create(tabId, term.cols, term.rows);

    // BUG-P01: Use centralized dispatcher — O(1) routing instead of O(n) broadcast
    const removeDataListener = registerDataHandler(tabId, (data) => {
      term.write(data);
      // Idle detection for notification sound
      if (!commandRunning) return;
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!commandRunning) return;
        const elapsed = (Date.now() - commandStartTime) / 1000;
        const { minCommandDuration, volume, soundEnabled } = getNotifSettings();
        if (elapsed >= minCommandDuration) {
          commandRunning = false;
          if (soundEnabled) {
            playNotificationSound(volume);
          }
        }
      }, 500);
    });

    // BUG-P01: Use centralized dispatcher for command events too
    const removeCommandListener = registerCommandHandler(tabId, (command) => {
      const line = term.buffer.active.baseY + term.buffer.active.cursorY;
      setCommandMarkers((prev) => {
        const next = [...prev, { command, line }];
        return next.length > 500 ? next.slice(-500) : next; // BUG-L07: cap at 500
      });
      commandRunning = true;
      commandStartTime = Date.now();
    });

    const bellDisposable = term.onBell(() => {
      const { soundEnabled, volume } = getNotifSettings();
      if (soundEnabled) {
        playNotificationSound(volume);
      }
    });

    // Debounced resize observer - reduces IPC calls during window resize
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        requestAnimationFrame(() => {
          try {
            fitAddon.fit();
            window.lumeshell.terminal.resize(tabId, term.cols, term.rows);
          } catch {
            // ignore
          }
        });
      }, 100); // 100ms debounce
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      removeDataListener();
      removeCommandListener();
      bellDisposable.dispose();
      if (idleTimer) clearTimeout(idleTimer);
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      initializedRef.current = false;
    };
  }, [tabId, containerRef]);

  return {
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
  };
}
