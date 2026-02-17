# LumeShell

macOS terminal emulator + AI chat. Electron 40 + React 19 + xterm.js + node-pty + Tailwind v3 + Zustand + Vite 5.

## Run
```bash
cd /Users/varma/ShellBuddy && npm start
```

## Constraints
- `forge.config.ts` is template-generated — DO NOT modify
- Vite must be v5, Tailwind must be v3 (ESM compat)
- `electron-store` replaced with custom `JsonStore` (ESM issue) at `src/main/store/json-store.ts`
- `node-pty` externalised in `vite.main.config.ts`
- Preload is flat at `src/preload.ts`, outputs `preload.js` same dir as `main.js`
- Shell detection uses `dscl` not `$SHELL` (see `src/main/terminal/shell-detector.ts`)

## Source Map

### Main Process
- `src/main.ts` — BrowserWindow, IPC registration after `app.whenReady()`
- `src/main/terminal/pty-manager.ts` — PTY spawn/write/resize/kill/sendSignal per tab ID; `isDestroyed()` guards
- `src/main/ai/ai-service.ts` — routes to provider, streams chunks via `webContents.send`
- `src/main/ai/prompts.ts` — system prompts (chat + explain)
- `src/main/ai/providers/` — ollama, gemini; raw `fetch` + SSE
- `src/main/store/settings-store.ts` — defaults: ollama `qwen2.5-coder:1.5b` + gemini `gemini-2.0-flash`, appearance with theme fields
- `src/main/store/history-store.ts` — command history persistence
- `src/main/file-explorer.ts` — listDirectory, delete, rename, create, getPermissions, setPermissions
- `src/main/ipc-handlers.ts` — all IPC registrations
- `src/main/menu.ts` — macOS menu + shortcuts

### Preload
- `src/preload.ts` — `window.lumeshell` API: terminal, ai, history, settings, files, onMenuEvent

### Renderer
- `src/renderer/App.tsx` — title bar + Sidebar + MainContent + ChatPanel
- `src/renderer/components/layout/Sidebar.tsx` — Terminal, Explorer, History, Settings icons + AI Chat toggle
- `src/renderer/components/layout/MainContent.tsx` — routes activeView to TerminalManager / FileExplorer / HistoryPanel / SettingsPage
- `src/renderer/components/terminal/TerminalManager.tsx` — auto-creates first tab, PTY exit listener, menu shortcuts
- `src/renderer/components/terminal/TerminalTabs.tsx` — tab bar + new tab + stop button (Ctrl+C)
- `src/renderer/components/terminal/TerminalPane.tsx` — xterm.js mount, auto-focus
- `src/renderer/components/chat/` — ChatPanel, ChatMessage, ChatInput, CommandCard
- `src/renderer/components/explorer/FileExplorer.tsx` — flat file list, breadcrumb, context menu, permissions modal
- `src/renderer/components/settings/AppearanceSettings.tsx` — font, theme presets, custom color pickers
- `src/renderer/stores/terminal-store.ts` — tabs[], activeTabId
- `src/renderer/stores/ui-store.ts` — activeView (terminal|explorer|history|settings), chatPanelOpen, chatPanelWidth
- `src/renderer/stores/file-store.ts` — currentPath, entries[], navigateTo, CRUD actions
- `src/renderer/stores/settings-store.ts` — loadSettings, updateSettings
- `src/renderer/hooks/useTerminal.ts` — xterm + FitAddon + theme from settings + live theme updates
- `src/renderer/lib/terminal-theme.ts` — 6 preset ITheme objects + buildCustomTheme helper
- `src/renderer/types/ipc.ts` — LumeShellAPI interface
- `src/renderer/types/settings.ts` — AppSettings with appearance.themeName/terminalBackground/terminalForeground/terminalCursor
- `src/renderer/types/terminal.ts` — TerminalTab { id, title, pid?, shell?, isAlive }
- `src/shared/constants.ts` — all IPC channel names

### IPC Patterns
- `invoke`/`handle`: terminal:create, ai:*, settings:get-all, file:*
- `send`/`on`: terminal:write, terminal:resize, terminal:send-signal, settings:set
- `webContents.send`: terminal:data, ai:chat-chunk, ai:chat-done, ai:chat-error

### Colors
Background: `#0d1117` `#161b22` `#010409` | Borders: `#21262d` `#30363d` | Text: `#e6edf3` `#8b949e` `#6e7681` | Blue: `#388bfd` | Green: `#238636` | Yellow: `#d29922` | Red: `#f85149`

---

## Improvement Roadmap

### Phase 1: Performance (Priority: High) ✅ COMPLETE
| Task | Files | Status |
|------|-------|--------|
| **P1.1** PTY pool for warm spawning | `pty-manager.ts` — 2 pre-warmed PTYs | ✅ Done |
| **P1.2** Lazy-load addons | Skipped — Vite already optimizes | ✅ N/A |
| **P1.3** Debounce terminal resize | `useTerminal.ts` — 100ms debounce | ✅ Done |
| **P1.4** Virtualize file list | `FileExplorer.tsx` — react-window for 100+ entries | ✅ Done |

### Phase 2: Startup Time (Priority: High) ✅ COMPLETE
| Task | Files | Status |
|------|-------|--------|
| **P2.1** Defer AI provider init | `ai-service.ts` — lazy init via `getProvider()` | ✅ Done |
| **P2.2** Code split settings views | `SettingsPage.tsx` — React.lazy() + Suspense | ✅ Done |
| **P2.3** Preload critical CSS only | `index.css` — split 3D styles to separate chunk | Removed |

### Phase 3: Memory Optimization (Priority: Medium) ✅ COMPLETE
| Task | Files | Status |
|------|-------|--------|
| **P3.1** Limit terminal scrollback | `useTerminal.ts` — capped at 5000 lines | ✅ Done |
| **P3.2** Dispose closed tab xterm | Already handled — `useTerminal` cleanup runs `term.dispose()` on unmount | ✅ Done |
| **P3.3** Clear chat on 100+ messages | `chat-store.ts` — auto-trim in `addUserMessage` + `finishStreaming` | ✅ Done |

### Phase 4: New Features (Priority: Medium)
| Task | Files | Status |
|------|-------|--------|
| **P4.1** Split pane terminal | `TerminalManager.tsx` — horizontal/vertical split | Pending |
| **P4.2** Terminal search (Cmd+F) | `TerminalSearchBar.tsx` — SearchAddon integration | ✅ Done |
| **P4.3** Tab rename (double-click) | `TerminalTabs.tsx` — inline edit on double-click | ✅ Done |
| **P4.4** Drag terminal tabs reorder | `TerminalTabs.tsx` + `terminal-store.ts` — drag handlers + `reorderTabs` | ✅ Done |
| **P4.5** SSH connection manager | New `SSHManager.tsx` — save hosts, quick connect | Pending |
| **P4.6** Snippet library | New `SnippetPanel.tsx` — save/run common commands | Pending |

### Phase 5: AI Enhancements (Priority: Low) ✅ COMPLETE
| Task | Files | Status |
|------|-------|--------|
| **P5.1** Context-aware prompts | `prompts.ts` + `useAIChat.ts` — CWD + recent commands injected into system prompt | ✅ Done |
| **P5.2** Command autocomplete | `ChatInput.tsx` — history-based suggestions with keyboard nav | ✅ Done |
| **P5.3** Multi-turn conversations | `chat-store.ts` — thread support | Pending |

---

## Completed Features ✓
- [x] Explorer syncs with terminal CWD
- [x] Built-in file editor
- [x] Show/hide dotfiles toggle (fixed blank screen bug)
- [x] Copy path from context menu
- [x] Drag file to terminal
- [x] 3D premium UI design system
- [x] Tab rename (double-click)
- [x] Drag-to-reorder terminal tabs
- [x] Context-aware AI prompts
- [x] Chat autocomplete from history

---

## Build & Package
```bash
npm run make  # unsigned .dmg — users right-click → Open on first launch
```
