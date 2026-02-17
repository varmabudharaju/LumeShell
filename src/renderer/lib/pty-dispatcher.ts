/**
 * BUG-P01: Single PTY data dispatcher.
 *
 * Instead of every TerminalPane registering its own global `terminal.onData`
 * listener (O(n) per chunk), we register ONE global listener that routes data
 * to the correct tab via a Map lookup (O(1)).
 */

type DataCallback = (data: string) => void;
type CommandCallback = (command: string) => void;

const dataHandlers = new Map<string, DataCallback>();
const commandHandlers = new Map<string, CommandCallback>();

let dataCleanup: (() => void) | null = null;
let commandCleanup: (() => void) | null = null;

function ensureDataListener() {
  if (dataCleanup) return;
  dataCleanup = window.lumeshell.terminal.onData((id, data) => {
    const handler = dataHandlers.get(id);
    if (handler) handler(data);
  });
}

function ensureCommandListener() {
  if (commandCleanup) return;
  commandCleanup = window.lumeshell.terminal.onCommandEntered((id, command) => {
    const handler = commandHandlers.get(id);
    if (handler) handler(command);
  });
}

export function registerDataHandler(tabId: string, cb: DataCallback): () => void {
  ensureDataListener();
  dataHandlers.set(tabId, cb);
  return () => {
    dataHandlers.delete(tabId);
    if (dataHandlers.size === 0 && dataCleanup) {
      dataCleanup();
      dataCleanup = null;
    }
  };
}

export function registerCommandHandler(tabId: string, cb: CommandCallback): () => void {
  ensureCommandListener();
  commandHandlers.set(tabId, cb);
  return () => {
    commandHandlers.delete(tabId);
    if (commandHandlers.size === 0 && commandCleanup) {
      commandCleanup();
      commandCleanup = null;
    }
  };
}
