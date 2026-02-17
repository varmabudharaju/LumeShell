import { app, Menu, BrowserWindow, MenuItemConstructorOptions } from 'electron';

export function buildMenu(mainWindow: BrowserWindow): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Settings...',
          accelerator: 'Cmd+,',
          click: () => mainWindow.webContents.send('menu:settings'),
        },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Terminal',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'Cmd+T',
          click: () => mainWindow.webContents.send('menu:new-tab'),
        },
        {
          label: 'Close Tab',
          accelerator: 'Cmd+W',
          click: () => mainWindow.webContents.send('menu:close-tab'),
        },
        { type: 'separator' },
        {
          label: 'Next Tab',
          accelerator: 'Cmd+Shift+]',
          click: () => mainWindow.webContents.send('menu:next-tab'),
        },
        {
          label: 'Previous Tab',
          accelerator: 'Cmd+Shift+[',
          click: () => mainWindow.webContents.send('menu:prev-tab'),
        },
        { type: 'separator' },
        {
          label: 'Clear Terminal',
          accelerator: 'Cmd+K',
          click: () => mainWindow.webContents.send('menu:clear-terminal'),
        },
      ],
    },
    {
      label: 'AI',
      submenu: [
        {
          label: 'Toggle Chat Panel',
          accelerator: 'Cmd+J',
          click: () => mainWindow.webContents.send('menu:toggle-chat'),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        // BUG-S05: Only show DevTools in development
        ...(!app.isPackaged ? [{ role: 'toggleDevTools' as const }] : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
