# LumeShell — Comprehensive Test & Audit Plan

Run all tests from the project root:
```bash
cd /Users/varma/lumeshell
```

---

## Phase 0: Set Up Test Infrastructure

There are ZERO tests and ZERO test dependencies in this project. Set everything up first.

### 0.1 Install test dependencies
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @testing-library/user-event
```

### 0.2 Create `vitest.config.ts` in the project root
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/main.ts', 'src/preload.ts'],
    },
  },
});
```

### 0.3 Create `tests/setup.ts`
```ts
import '@testing-library/jest-dom';
```

### 0.4 Add test scripts to `package.json`
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

### 0.5 Create the test directory structure
```
tests/
├── setup.ts
├── unit/
│   ├── main/
│   │   ├── file-explorer.test.ts
│   │   ├── pty-manager.test.ts
│   │   ├── json-store.test.ts
│   │   ├── settings-store.test.ts
│   │   ├── history-store.test.ts
│   │   ├── shell-detector.test.ts
│   │   ├── ai-service.test.ts
│   │   └── ipc-handlers.test.ts
│   └── renderer/
│       ├── stores/
│       │   ├── ui-store.test.ts
│       │   ├── terminal-store.test.ts
│       │   ├── settings-store.test.ts
│       │   └── file-store.test.ts
│       ├── hooks/
│       │   └── useSettings.test.ts
│       └── lib/
│           └── terminal-theme.test.ts
├── security/
│   ├── file-explorer-security.test.ts
│   ├── ipc-validation.test.ts
│   ├── path-traversal.test.ts
│   └── api-key-exposure.test.ts
├── performance/
│   ├── pty-throughput.test.ts
│   ├── file-explorer-perf.test.ts
│   ├── ipc-overhead.test.ts
│   └── json-store-perf.test.ts
└── integration/
    ├── terminal-lifecycle.test.ts
    ├── ai-streaming.test.ts
    └── theme-switching.test.ts
```

---

## Phase 1: Security Audit (CRITICAL — Do This First)

### 1.1 File Explorer — Path Traversal & Dangerous Operations

**File:** `src/main/file-explorer.ts`

This is the highest-risk module. Every function takes raw paths from the renderer with ZERO validation.

**Tests to write in `tests/security/file-explorer-security.test.ts`:**

```
Test: deleteFileOrDir rejects paths outside $HOME
Test: deleteFileOrDir rejects "/" as input
Test: deleteFileOrDir rejects "/etc/passwd"
Test: deleteFileOrDir rejects symlinks that point outside $HOME
Test: renameFileOrDir rejects "../" in newName (path traversal)
Test: renameFileOrDir rejects absolute paths in newName
Test: createFileOrDir rejects paths outside $HOME
Test: writeFile rejects paths outside $HOME (e.g. /etc/cron.d/malicious)
Test: readFile rejects sensitive paths (~/.ssh/id_rsa, ~/.aws/credentials)
Test: setPermissions rejects chmod on files outside $HOME
Test: listDirectory rejects traversal (e.g. "../../etc")
Test: all functions handle null/undefined/empty string paths gracefully
Test: all functions handle paths with null bytes (\x00)
```

**After writing tests, implement the fix:** Add a `validatePath(targetPath)` function that:
1. Resolves the path with `path.resolve()`
2. Checks it starts with `os.homedir()`
3. Resolves symlinks with `fs.realpathSync()` and re-checks
4. Rejects null bytes, empty strings, paths to sensitive dirs (`~/.ssh`, `~/.gnupg`)
5. Apply it to every exported function

### 1.2 Path Traversal in Rename

**File:** `tests/security/path-traversal.test.ts`

```
Test: renameFileOrDir("~/test/file.txt", "../../etc/malicious") → should reject
Test: renameFileOrDir("~/test/file.txt", "/absolute/path") → should reject
Test: renameFileOrDir("~/test/file.txt", "normal-name.txt") → should succeed
```

### 1.3 IPC Input Validation

**File:** `tests/security/ipc-validation.test.ts`

Currently all IPC handlers pass arguments directly to backing functions with no validation.

```
Test: terminal:create with non-string id → should reject or sanitize
Test: terminal:write with non-string data → should reject
Test: terminal:send-signal with invalid signal name → should reject
Test: settings:set with invalid key → should reject
Test: settings:set with non-object value for 'providers' → should reject
Test: ai:chat with non-string providerName → should reject
Test: ai:chat with providerName not in ['ollama','openai','claude','gemini'] → should reject
Test: file:list with non-string dirPath → should reject
Test: file:write with non-string content → should reject
Test: file:set-permissions with non-number mode → should reject
Test: all handlers return proper error messages (not raw stack traces)
```

### 1.4 API Key Security

**File:** `tests/security/api-key-exposure.test.ts`

```
Test: Gemini provider puts API key in URL query param → flag as risk, verify HTTPS
Test: API keys are never logged to console
Test: API keys are not included in error messages sent to renderer
Test: settings JSON file has appropriate file permissions (0600)
Test: AI provider configs with empty API key fail gracefully (not crash)
Test: Claude provider sends key in header (x-api-key), not URL → verify
Test: OpenAI provider sends key in Authorization header → verify
```

### 1.5 Shell Injection in Shell Detector

**File:** `src/main/terminal/shell-detector.ts`

```
Test: detectDefaultShell with username containing shell metacharacters → should not execute injection
Test: verify it uses os.userInfo().username (not env var that user could set)
```

### 1.6 PTY Manager Security

```
Test: pty write with escape sequences that could break terminal (e.g. \x1b]0; title injection)
Test: getCwd with a killed/non-existent PID → should return homedir, not crash
Test: sendSignal with unknown signal name → should be no-op
Test: writeCommand properly escapes or handles commands with special chars
Test: terminal:create cannot spawn arbitrary binaries (only detected shell)
```

---

## Phase 2: Unit Tests

### 2.1 JsonStore (`tests/unit/main/json-store.test.ts`)

Mock `electron.app.getPath()` to return a temp directory.

```
Test: constructor creates file with defaults if no file exists
Test: constructor loads existing data and merges with defaults
Test: constructor handles corrupt JSON file → falls back to defaults
Test: get(key) returns the value for a valid key
Test: set(key, value) persists to disk
Test: set(key, value) updates in-memory store
Test: store getter returns a copy (not reference to internal state)
Test: save handles ENOENT directory → creates directory
Test: concurrent rapid set() calls don't corrupt the file
```

### 2.2 File Explorer (`tests/unit/main/file-explorer.test.ts`)

Use a temp directory for all tests. Clean up after.

```
Test: listDirectory returns files and directories with correct metadata
Test: listDirectory hides dotfiles when showHidden=false (default)
Test: listDirectory shows dotfiles when showHidden=true
Test: listDirectory sorts directories before files
Test: listDirectory returns [] for non-existent directory
Test: deleteFileOrDir removes a file
Test: deleteFileOrDir removes a directory recursively
Test: deleteFileOrDir throws for non-existent path
Test: renameFileOrDir renames and returns new path
Test: createFileOrDir creates an empty file
Test: createFileOrDir creates a directory (recursive)
Test: getPermissions returns correct mode and readable string
Test: setPermissions changes the mode
Test: readFile returns file content as UTF-8
Test: writeFile writes content and creates file
Test: readFile throws for non-existent file
Test: formatPermissions converts 0o755 → "rwxr-xr-x"
```

### 2.3 PTY Manager (`tests/unit/main/pty-manager.test.ts`)

Mock `node-pty` and `child_process.execSync`.

```
Test: create spawns a PTY and returns { pid, shell }
Test: create stores instance in the map
Test: write forwards data to PTY process
Test: write tracks command buffer — single chars accumulate
Test: write handles backspace (\x7f) in command buffer
Test: write submits command on \r and clears buffer
Test: write handles Ctrl+C (\x03) — clears buffer
Test: resize calls pty.resize with correct dimensions
Test: kill calls process.kill and removes instance from map
Test: killAll kills all instances
Test: sendSignal("SIGINT") writes \x03 to PTY
Test: sendSignal("SIGTSTP") writes \x1a to PTY
Test: sendSignal with unknown signal → no-op
Test: getCwd returns CWD from lsof output
Test: getCwd returns homedir on error
Test: getCwd returns homedir for unknown id
Test: writeCommand writes command + \r to PTY
Test: methods with unknown id → no-op (no crash)
```

### 2.4 History Store (`tests/unit/main/history-store.test.ts`)

```
Test: addHistoryEntry adds entry with correct fields
Test: addHistoryEntry truncates at 1000 entries
Test: toggleBookmark flips bookmarked field
Test: deleteHistoryEntry removes the entry
Test: clearHistory empties the array
Test: getAllHistory returns all entries
Test: entry id format is timestamp + random suffix
```

### 2.5 AI Service (`tests/unit/main/ai-service.test.ts`)

Mock fetch globally. Mock mainWindow.webContents.send.

```
Test: chat prepends CHAT_SYSTEM_PROMPT to messages
Test: chat sends chunks to renderer via webContents.send
Test: chat sends done event when stream completes
Test: chat sends error event when stream fails
Test: chat with unknown provider → sends error
Test: explainCommand returns parsed JSON
Test: explainCommand returns default object on JSON parse failure
Test: testConnection delegates to provider.testConnection
Test: testConnection returns false for unknown provider
```

### 2.6 AI Providers (one test file per provider)

For each of Ollama, OpenAI, Claude, Gemini:

```
Test: streamMessage sends correct request headers
Test: streamMessage sends correct request body format
Test: streamMessage parses SSE chunks correctly
Test: streamMessage calls onChunk for each content piece
Test: streamMessage calls onDone when stream ends
Test: streamMessage calls onError on network failure
Test: streamMessage calls onError on non-200 status
Test: testConnection returns true on success
Test: testConnection returns false on network error
```

### 2.7 Renderer Stores (`tests/unit/renderer/stores/`)

These are pure Zustand stores — test directly, no React needed.

**ui-store.test.ts:**
```
Test: default state is terminal view, chat open, dark mode
Test: setActiveView changes activeView
Test: toggleChatPanel flips chatPanelOpen
Test: setChatPanelWidth clamps between 280 and 600
Test: setThemeMode sets mode and updates document.documentElement.dataset.theme
Test: toggleThemeMode switches dark ↔ light
```

**terminal-store.test.ts:**
```
Test: addTab creates a new tab with unique id
Test: removeTab removes tab and activates next
Test: setActiveTab changes activeTabId
Test: updateTab merges partial into existing tab
Test: nextTab / prevTab cycle through tabs
```

### 2.8 Terminal Theme (`tests/unit/renderer/lib/terminal-theme.test.ts`)

```
Test: terminalTheme has all required ITheme fields
Test: terminalThemeLight has all required ITheme fields
Test: terminalThemeLight has light colors (background close to white)
Test: getThemeByName returns correct preset
Test: getThemeByName returns default for unknown name
Test: buildCustomTheme overrides background/foreground/cursor
Test: buildCustomTheme preserves non-overridden fields
Test: all 6 presets have valid name, label, background, foreground, cursor
```

---

## Phase 3: Performance Tests

### 3.1 PTY Throughput vs Native Terminal (`tests/performance/pty-throughput.test.ts`)

**Goal:** Ensure LumeShell terminal is within 2x of native Terminal.app latency.

```
Test: Measure time to write 10,000 lines through PTY
  - Spawn a PTY, run `seq 1 10000`
  - Measure time from first data event to last
  - Baseline: run same in Terminal.app via `time seq 1 10000` and record

Test: Measure time to write 1MB of data through PTY
  - Run `cat /dev/urandom | head -c 1048576 | base64`
  - Measure total data received and time

Test: Measure IPC message count for `seq 1 10000`
  - Count how many webContents.send('terminal:data') calls fire
  - Flag if > 10,000 (should be batched by PTY into fewer chunks)

Test: Measure keystroke-to-echo latency
  - Write a single char to PTY
  - Measure time until that char appears in onData callback
  - Should be < 10ms

Test: Measure getCwd latency
  - Call ptyManager.getCwd() 100 times
  - Average should be < 50ms
  - Flag: this is synchronous execSync — blocks main thread
  - Recommendation threshold: if > 20ms avg, suggest async alternative
```

### 3.2 File Explorer Performance (`tests/performance/file-explorer-perf.test.ts`)

```
Test: listDirectory on a directory with 100 files → should be < 50ms
Test: listDirectory on a directory with 1000 files → should be < 200ms
Test: listDirectory on a directory with 10,000 files → should be < 2s
  - Flag: uses readdirSync + statSync per entry → O(n) syscalls
  - Compare to `ls -la | wc -l` for baseline

Test: readFile on a 1MB file → should be < 100ms
Test: readFile on a 10MB file → should be < 500ms
  - Flag: synchronous fs, blocks main process

Test: writeFile on a 1MB file → should be < 100ms
```

### 3.3 IPC Overhead (`tests/performance/ipc-overhead.test.ts`)

```
Test: Measure round-trip time of ipcRenderer.invoke → ipcMain.handle → response
  - Use settings:get-all as the benchmark (lightweight handler)
  - Run 1000 round trips, measure average
  - Should be < 1ms per call

Test: Measure throughput of ipcMain.on → webContents.send (one-way)
  - Simulate PTY data flow: send 10,000 messages of 1KB each
  - Measure messages/second
  - Should handle > 5,000 msg/sec
```

### 3.4 JsonStore Write Performance (`tests/performance/json-store-perf.test.ts`)

```
Test: 100 rapid set() calls → should complete < 500ms
Test: 100 rapid set() calls → file should not be corrupt after
Test: Store with 1000 history entries → get() should be < 1ms
Test: Store with 1000 history entries → set() (full rewrite) should be < 50ms
```

### 3.5 Theme Switching Performance

```
Test: toggleThemeMode → measure time until all CSS vars update
  - Should be < 16ms (one frame)
  - Verify: document.documentElement.dataset.theme changes synchronously

Test: xterm theme live-update → should not cause visible flicker
  - Toggle theme 10 times rapidly
  - No errors thrown
```

---

## Phase 4: Integration Tests

### 4.1 Terminal Lifecycle (`tests/integration/terminal-lifecycle.test.ts`)

```
Test: Create tab → PTY spawns → write data → receive output → kill → cleanup
Test: Multiple tabs → each has independent PTY
Test: Close tab → PTY is killed → no orphan processes
Test: App quit → all PTYs killed (NOTE: currently NOT implemented — verify and flag)
Test: Terminal resize → PTY receives new dimensions
Test: Run command from chat → appears in terminal and executes
```

### 4.2 AI Streaming (`tests/integration/ai-streaming.test.ts`)

```
Test: Full chat flow → user message → system prompt prepended → provider called → chunks streamed → done sent
Test: Explain command flow → command sent → JSON response parsed → structured result returned
Test: Provider switch → changing activeProvider → next chat uses new provider
Test: Network error mid-stream → error event sent to renderer → UI shows error
Test: Empty API key → provider returns error → UI shows meaningful message
```

### 4.3 Theme Switching (`tests/integration/theme-switching.test.ts`)

```
Test: Toggle dark → light → all CSS vars change to light values
Test: Toggle light → dark → all CSS vars change to dark values
Test: Theme persists to settings → reload → same theme applied
Test: Terminal xterm theme updates when UI theme changes
Test: No hardcoded hex colors remain in rendered DOM (spot-check key elements)
```

### 4.4 Settings Persistence

```
Test: Change a setting → kill app → relaunch → setting persisted
Test: Change theme mode → persists to appearance.mode
Test: Change font size → terminal uses new size
Test: Change AI provider → next chat uses new provider
```

---

## Phase 5: Manual Testing Checklist

Run the app with `npm start` and verify each item:

### Terminal
- [ ] New tab creates a working shell
- [ ] Typing produces output with no noticeable lag
- [ ] Run `seq 1 50000` — scrolls smoothly, no freeze
- [ ] Run `cat /dev/urandom | head -c 5M | base64` — handles large output
- [ ] Multiple tabs work independently
- [ ] Close tab kills the process (check with `ps aux | grep pty`)
- [ ] Ctrl+C sends SIGINT and interrupts running process
- [ ] Stop button in toolbar sends SIGINT
- [ ] Tab title updates (shows shell name or "Exited")
- [ ] Command minimap shows markers at correct positions
- [ ] Scroll to top / scroll to bottom buttons work
- [ ] Clear terminal clears buffer and minimap

### AI Chat
- [ ] Ask "how to find large files" → get commands with short explanations + related commands
- [ ] Click Run on a command → it executes in the active terminal
- [ ] Click Explain → shows risk level, explanation, side effects
- [ ] Response is concise (no lengthy paragraphs)
- [ ] Streaming works — text appears incrementally
- [ ] Clear chat button works
- [ ] Provider badge shows current provider name

### File Explorer
- [ ] Shows files from terminal's CWD
- [ ] Double-click folder navigates into it
- [ ] Double-click file opens in editor
- [ ] Back button navigates up
- [ ] Breadcrumb navigation works
- [ ] Right-click shows context menu
- [ ] Rename works
- [ ] Delete works (with confirmation)
- [ ] New file / new folder works
- [ ] Show/hide dotfiles toggle works
- [ ] Copy Path copies to clipboard
- [ ] Drag file to terminal pastes path
- [ ] Permissions modal shows and saves correctly
- [ ] File editor saves with Cmd+S

### History
- [ ] Commands executed in terminal appear in history
- [ ] Search filters history
- [ ] Bookmark toggle works
- [ ] "Show bookmarked only" filter works
- [ ] Run button executes command in active terminal
- [ ] Delete button removes entry
- [ ] Clear All empties history

### Settings
- [ ] Font size slider updates terminal in real-time
- [ ] Font family selector changes terminal font
- [ ] Terminal theme presets apply immediately
- [ ] Custom color pickers update terminal
- [ ] Provider switching works
- [ ] API key input masks the value
- [ ] Test Connection shows success/failure
- [ ] All settings persist across app restart

### Theme / Liquid Glass
- [ ] Title bar toggle (sun/moon) switches dark ↔ light
- [ ] Settings page toggle switches dark ↔ light
- [ ] Dark mode: all panels have subtle translucent glass effect
- [ ] Light mode: all panels use light colors, text is readable
- [ ] Terminal switches to light theme (white bg, dark text) in light mode
- [ ] Terminal switches back to dark theme in dark mode
- [ ] No white flashes or unstyled moments during toggle
- [ ] Scrollbar colors match theme
- [ ] Context menus and modals have glass effect
- [ ] Theme persists across app restart
- [ ] All text is readable in both themes (contrast check)

### Performance (Subjective)
- [ ] App launches in < 3 seconds
- [ ] Typing latency feels instant (< 50ms perceived)
- [ ] Tab switching is instant
- [ ] View switching (terminal → explorer → history → settings) is instant
- [ ] Theme toggle is instant (no delay, no flicker)
- [ ] Scrolling long terminal output is smooth (60fps)
- [ ] No memory leaks after extended use (check Activity Monitor after 30 min)

---

## Phase 6: Benchmarks — LumeShell vs Terminal.app

Run these benchmarks to compare LumeShell against macOS Terminal.app. Record results in a table.

### Startup Time
```bash
# For Terminal.app: use Cmd+N and time with stopwatch
# For LumeShell: time npm start (measure until first prompt appears)
```

### Command Output Speed
```bash
# In both terminals, run:
time seq 1 100000
time find /usr -type f 2>/dev/null | wc -l
time cat /usr/share/dict/words
```

### Keystroke Latency
```bash
# Install a latency measurement tool:
# Or use slow-motion screen recording (120fps) to measure key-press to character-appear
```

### Memory Usage
```bash
# After launching and creating 3 tabs:
# Terminal.app: check Activity Monitor → Terminal process RSS
# LumeShell: check Activity Monitor → Electron Helper (Renderer) + main process RSS
# Record both. LumeShell will be higher due to Electron — document the overhead.
```

### CPU Idle Usage
```bash
# Both terminals open, no activity for 60 seconds
# Record CPU % from Activity Monitor
# LumeShell should be < 1% idle CPU
```

### Scrollback Stress
```bash
# In both terminals:
seq 1 100000
# Then scroll to top rapidly and back down
# Note any lag or dropped frames
```

### Expected Results Table
| Metric | Terminal.app | LumeShell | Acceptable Ratio |
|--------|-------------|------------|-------------------|
| Startup time | ~0.5s | < 3s | 6x |
| `seq 1 100000` | baseline | < 2x baseline | 2x |
| Keystroke latency | ~5ms | < 20ms | 4x |
| Memory (3 tabs) | ~30MB | < 300MB | 10x (Electron overhead) |
| CPU idle | ~0% | < 1% | — |
| Scrollback (100k lines) | smooth | smooth | no dropped frames |

---

## Phase 7: Known Issues to Fix

Found during audit — fix these regardless of test results:

1. **CRITICAL: No path validation in file-explorer.ts** — any IPC caller can read/write/delete any file on the system. Add `validatePath()` that restricts operations to `$HOME`.

2. **CRITICAL: `deleteFileOrDir` uses `recursive: true, force: true`** with no safeguards. At minimum, reject paths that are `$HOME` itself or system directories.

3. **HIGH: `getCwd` uses synchronous `execSync`** — blocks the main process. Replace with `execFile` (async) or `child_process.exec` with a callback.

4. **HIGH: No PTY cleanup on app quit** — `src/main.ts` does not call `ptyManager.killAll()` in `app.on('before-quit')`. Orphan shell processes may persist.

5. **MEDIUM: Gemini API key in URL query parameter** — visible in network logs. Consider proxying through a local endpoint or documenting the risk.

6. **MEDIUM: IPC channel constants inconsistency** — `terminal:command-entered` and `terminal:run-command` are hardcoded strings, not in `src/shared/constants.ts`. Add them.

7. **MEDIUM: No AI request cancellation** — once streaming starts, there's no way to abort. Add an `AbortController` per request.

8. **LOW: JsonStore uses synchronous I/O on every `set()`** — consider debouncing writes or using async I/O.

9. **LOW: `settings:set` uses `ipcMain.on` (fire-and-forget)** while all other mutating handlers use `ipcMain.handle`. No way for the renderer to know if a set failed.

10. **LOW: Shell detector `dscl` command with username** — extremely unlikely injection vector but worth sanitizing with `execFileSync` instead of `execSync`.

---

## Running the Full Suite

After implementing all tests:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run only security tests
npx vitest run tests/security/

# Run only performance tests
npx vitest run tests/performance/

# Run only unit tests
npx vitest run tests/unit/

# Watch mode during development
npm run test:watch
```

Target: **>80% code coverage** on `src/main/` and **>60%** on `src/renderer/` (renderer components are harder to test without a full Electron environment).
