// IPC Channel Names
export const IPC = {
  // Terminal
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_WRITE: 'terminal:write',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_KILL: 'terminal:kill',
  TERMINAL_DATA: 'terminal:data',
  TERMINAL_EXIT: 'terminal:exit',
  TERMINAL_SEND_SIGNAL: 'terminal:send-signal',
  TERMINAL_GET_CWD: 'terminal:get-cwd',
  TERMINAL_COMMAND_ENTERED: 'terminal:command-entered',
  TERMINAL_RUN_COMMAND: 'terminal:run-command',
  TERMINAL_INPUT_BUFFER: 'terminal:input-buffer',

  // AI
  AI_CHAT: 'ai:chat',
  AI_CHAT_CHUNK: 'ai:chat-chunk',
  AI_CHAT_DONE: 'ai:chat-done',
  AI_CHAT_ERROR: 'ai:chat-error',
  AI_EXPLAIN: 'ai:explain-command',
  AI_TEST_CONNECTION: 'ai:test-connection',
  AI_CANCEL: 'ai:cancel',

  // History
  HISTORY_GET_ALL: 'history:get-all',
  HISTORY_ADD: 'history:add',
  HISTORY_TOGGLE_BOOKMARK: 'history:toggle-bookmark',
  HISTORY_DELETE: 'history:delete',
  HISTORY_CLEAR: 'history:clear',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_ALL: 'settings:get-all',

  // File Explorer
  FILE_LIST: 'file:list',
  FILE_DELETE: 'file:delete',
  FILE_RENAME: 'file:rename',
  FILE_CREATE: 'file:create',
  FILE_GET_PERMISSIONS: 'file:get-permissions',
  FILE_SET_PERMISSIONS: 'file:set-permissions',
  FILE_GET_HOME: 'file:get-home',
  FILE_READ: 'file:read',
  FILE_WRITE: 'file:write',

  // Shell
  SHELL_OPEN_EXTERNAL: 'shell:open-external',

  // Google Auth
  GOOGLE_AUTH_SIGN_IN: 'google:sign-in',
  GOOGLE_AUTH_SIGN_OUT: 'google:sign-out',
  GOOGLE_AUTH_STATUS: 'google:auth-status',
} as const;
