import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import { THEME_PACKS, type Theme, type ThemePack } from './state.js'

interface BuildMenuOptions {
  onNewWindow: () => void
  currentTheme: Theme
  onThemeChange: (theme: Theme) => void
  currentThemePack: ThemePack
  onThemePackChange: (pack: ThemePack) => void
  onCycleThemePack: () => void
}

const THEME_PACK_LABELS: Record<ThemePack, string> = {
  plain: 'Plain',
  forest: 'Forest',
  midnight: 'Midnight',
  solarflare: 'Solar Flare',
  cherry: 'Cherry',
}

export function buildMenu({
  onNewWindow,
  currentTheme,
  onThemeChange,
  currentThemePack,
  onThemePackChange,
  onCycleThemePack,
}: BuildMenuOptions): void {
  const sendToFocused = (channel: string) => {
    const win = BrowserWindow.getFocusedWindow()
    if (win && !win.isDestroyed()) win.webContents.send(channel)
  }

  const isMac = process.platform === 'darwin'

  const themeItem = (label: string, value: Theme): MenuItemConstructorOptions => ({
    label,
    type: 'radio',
    checked: currentTheme === value,
    click: () => onThemeChange(value),
  })

  const packItem = (value: ThemePack): MenuItemConstructorOptions => ({
    label: THEME_PACK_LABELS[value],
    type: 'radio',
    checked: currentThemePack === value,
    click: () => onThemePackChange(value),
  })

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ] as MenuItemConstructorOptions[])
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          click: () => onNewWindow(),
        },
        {
          label: 'Open…',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendToFocused('menu:open'),
        },
        {
          label: 'Open Recent',
          role: 'recentDocuments',
          submenu: [
            { label: 'Clear Menu', role: 'clearRecentDocuments' },
          ],
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendToFocused('menu:save'),
        },
        {
          label: 'Save As…',
          accelerator: 'Shift+CmdOrCtrl+S',
          click: () => sendToFocused('menu:save-as'),
        },
        { type: 'separator' },
        { role: 'close' },
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
      label: 'View',
      submenu: [
        {
          label: 'Toggle View',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => sendToFocused('menu:toggle-preview'),
        },
        { type: 'separator' },
        {
          label: 'Appearance',
          submenu: [
            themeItem('Light', 'light'),
            themeItem('Dark', 'dark'),
            themeItem('System', 'system'),
          ],
        },
        {
          label: 'Theme',
          submenu: THEME_PACKS.map(packItem),
        },
        {
          label: 'Cycle Theme',
          accelerator: 'CmdOrCtrl+T',
          click: () => onCycleThemePack(),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom', accelerator: 'CmdOrCtrl+0' },
        { role: 'zoomIn', accelerator: 'CmdOrCtrl+Shift+=' },
        { role: 'zoomOut', accelerator: 'CmdOrCtrl+Shift+-' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? ([
              { type: 'separator' },
              { role: 'front' },
            ] as MenuItemConstructorOptions[])
          : []),
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
