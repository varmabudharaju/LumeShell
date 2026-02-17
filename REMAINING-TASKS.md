# LumeShell — Remaining Tasks for Next Session

## What Was Completed

All 37 bugs from BUG-REPORT.md have been addressed. Here's what was done:

### CRITICAL (2/2 fixed)
- **C01** — OAuth client secret removed from binary. Token exchange now goes through Cloudflare Worker (`/v1/auth/token` and `/v1/auth/refresh`). Worker deployed at `https://shellbuddy-api.sairam-varma.workers.dev`. Secret set via `wrangler secret put GOOGLE_CLIENT_SECRET`.
- **C02** — Added `process.on('uncaughtException')` and `process.on('unhandledRejection')` handlers in `src/main.ts`.

### HIGH (1/1 fixed)
- **H01** — AI streaming now auto-aborts after 60 seconds via `setTimeout` in `ai-service.ts`. Timeout is cleared on completion.

### MEDIUM Security (6/6 fixed)
- **S01** — `onMenuEvent` in `preload.ts` now whitelists 7 allowed channel names. Unknown channels are blocked.
- **S02** — `sandbox: app.isPackaged` added to BrowserWindow webPreferences. Active in production only (dev needs unsandboxed preload).
- **S03** — `getAllSettings` IPC handler now masks `apiKey` fields as `'••••••'` before sending to renderer.
- **S04** — `settings.set` IPC validates key against `VALID_SETTINGS_KEYS` array. Unknown keys rejected.
- **S05** — `toggleDevTools` menu item gated behind `!app.isPackaged`.
- **S06** — `safeStorage` fallback now throws instead of storing base64. `decryptToken` returns empty string when encryption unavailable.

### MEDIUM Performance (6/7 fixed, 1 intentionally skipped)
- **P01** — SKIPPED (O(n) broadcast with n<20 tabs is negligible). A linter/user later fixed this with a centralized `pty-dispatcher` — already applied.
- **P02** — Chat store `appendChunk` now buffers and flushes at 32ms intervals (~30fps).
- **P03** — `ChatMessage` wrapped in `React.memo`.
- **P04** — `TerminalPane` wrapped in `React.memo`.
- **P05** — `TerminalManager` uses `controlsRef` + selective state updates (only re-renders on buffer mode/editor type change).
- **P06** — `HistoryPanel` now uses `react-window` `FixedSizeList` for virtualization.
- **P07** — Chat resize handler throttled with `requestAnimationFrame`.

### MEDIUM Crash/Stability (6/6 fixed)
- **CS01** — `lsof` in `getCwd` now has `timeout: 5000` ms.
- **CS02** — `clipboard.readText()` now has `.catch()`.
- **CS03** — `deleteEntry`, `renameEntry`, `createEntry` wrapped in try-catch, set `error` state.
- **CS04** — `saveFile` wrapped in try-catch, keeps `dirty: true` on failure.
- **CS05** — PTY count capped at 20 via `PtyManager.MAX_PTY_COUNT`.
- **CS06** — `ptyManager.killAll()` called in `mainWindow.on('closed')`.

### LOW (13/15 fixed, 2 deferred)
- **L01** — `readFile` now uses `validatePath` (blocks `.ssh`, `.gnupg`, etc.) instead of `validatePathAllowHome`.
- **L02** — `readFile` checks `stat.size` against 10MB limit before reading.
- **L03** — `writeCommand` strips `\r` and `\n` from command strings.
- **L04** — CSP header set via `session.defaultSession.webRequest.onHeadersReceived` (production only).
- **L05** — DEFERRED: TypeScript 5.x upgrade needs dedicated testing session.
- **L06** — Removed `termRef.current` from useEffect dependency array in TerminalPane.
- **L07** — `commandMarkers` capped at 500 entries.
- **L08** — `openFile` now sets `error` state instead of silently swallowing.
- **L09** — Covered by H01 (60s global AI timeout applies to explain too).
- **L10** — `JsonStore.flush()` method added; called from `flushSettings()` in `before-quit`.
- **L11** — `render-process-gone` handler added, auto-reloads on crash.
- **L12** — Fixed by CS06 (`killAll` clears pool interval, and is now called on window close).
- **L13** — A linter/user already fixed this with `navRequestId` counter in `file-store.ts`.
- **L14** — DEFERRED: `filteredEntries` as computed selector would need store refactor.
- **L15** — Partially mitigated by L13 race condition fix.

---

## What Still Needs Doing

### 1. Test Google OAuth Sign-In (MUST DO FIRST)
The worker is deployed with the new `/v1/auth/token` and `/v1/auth/refresh` endpoints. Run `npm start`, go to Settings, click "Sign in with Google" and verify it works end-to-end. If it still fails:
- Check the worker logs: `cd shellbuddy-api && npx wrangler tail`
- The `GOOGLE_CLIENT_SECRET` secret is set on `shellbuddy-api` worker
- The `GEMINI_API_KEY` secret was already on the old worker and should still be there

### 2. Update BUG-REPORT.md with Fix Status
Add a "Status" column to each bug showing FIXED/DEFERRED.

### 3. Deferred Bugs
- **L05**: Upgrade TypeScript from 4.x to 5.x — run `npm install typescript@~5.7` then fix any type errors
- **L14**: Convert `filteredEntries()` method to a Zustand computed selector using `useMemo` in components

### 4. Delete the Empty lumeshell-api Worker
A stub `lumeshell-api` worker was accidentally created on Cloudflare. Delete it:
```bash
cd shellbuddy-api && npx wrangler delete --name lumeshell-api
```

### 5. Build & Package Test
```bash
npm run make
```
Verify the `.dmg` works with sandbox + CSP active.

---

## Key Files Modified (for reference)

### Main Process
- `src/main.ts` — crash handlers, sandbox, CSP, render-process-gone, PTY cleanup, flush
- `src/main/ai/ai-service.ts` — 60s auto-timeout on streaming
- `src/main/auth/google-auth.ts` — token exchange via worker, removed client secret, safeStorage hardened
- `src/main/ipc-handlers.ts` — settings key validation, API key masking
- `src/main/menu.ts` — devtools gated behind !app.isPackaged
- `src/main/terminal/pty-manager.ts` — lsof timeout, max PTY limit, writeCommand sanitization
- `src/main/file-explorer.ts` — readFile uses strict path validation + size limit
- `src/main/store/json-store.ts` — added flush() method
- `src/main/store/settings-store.ts` — added flushSettings() export

### Preload
- `src/preload.ts` — onMenuEvent channel whitelist

### Renderer
- `src/renderer/App.tsx` — rAF throttled resize
- `src/renderer/stores/chat-store.ts` — debounced chunk buffer
- `src/renderer/stores/file-store.ts` — error handling on delete/rename/create/save/open
- `src/renderer/components/chat/ChatMessage.tsx` — React.memo
- `src/renderer/components/terminal/TerminalPane.tsx` — React.memo, clipboard catch, useEffect fix
- `src/renderer/components/terminal/TerminalManager.tsx` — controlsRef to reduce re-renders
- `src/renderer/components/history/HistoryPanel.tsx` — react-window virtualization
- `src/renderer/hooks/useTerminal.ts` — commandMarkers cap

### Worker
- `shellbuddy-api/src/index.ts` — added `/v1/auth/token` and `/v1/auth/refresh` endpoints
- `shellbuddy-api/wrangler.toml` — name kept as `shellbuddy-api` (backend, not user-facing)

### Config
- `vite.main.config.ts` — removed GOOGLE_CLIENT_SECRET from define block
