import { app, BrowserWindow, dialog, session } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { registerIpcHandlers } from './main/ipc-handlers';
import { ptyManager } from './main/terminal/pty-manager';
import { aiService } from './main/ai/ai-service';
import { buildMenu } from './main/menu';
import { flushSettings } from './main/store/settings-store';

// BUG-C02: Global crash handlers — prevent silent crashes
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
  dialog.showErrorBox('LumeShell Error', `An unexpected error occurred:\n\n${err.message}\n\nThe app will try to continue, but you may want to restart.`);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);
});

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 16 },
    backgroundColor: '#010409',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: app.isPackaged, // BUG-S02: sandbox in production (dev preload needs Node APIs)
    },
  });

  ptyManager.setMainWindow(mainWindow);
  aiService.setMainWindow(mainWindow);
  buildMenu(mainWindow);

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    ptyManager.killAll(); // BUG-CS06: Clean up PTYs on window close (macOS keeps app alive)
    mainWindow = null;
  });

  // BUG-L11: Handle renderer process crashes
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[main] Renderer process gone:', details.reason);
    if (details.reason !== 'clean-exit') {
      mainWindow?.reload();
    }
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open DevTools only in dev with keyboard shortcut (Cmd+Option+I)
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  // BUG-L04: Set Content Security Policy (production only — Vite dev server needs looser policy)
  if (app.isPackaged) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:* https://shellbuddy-api.sairam-varma.workers.dev; img-src 'self' data:; font-src 'self' data:",
          ],
        },
      });
    });
  }

  registerIpcHandlers();
  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  flushSettings(); // BUG-L10: flush debounced writes before exit
  ptyManager.killAll();
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
