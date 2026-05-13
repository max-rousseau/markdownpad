import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import {
  APP_THEMES,
  CODE_THEMES,
  type AppTheme,
  type CodeTheme,
  type Theme,
} from './state.js'

interface BuildMenuOptions {
  onNewWindow: () => void
  currentTheme: Theme
  onThemeChange: (theme: Theme) => void
  currentAppTheme: AppTheme
  onAppThemeChange: (theme: AppTheme) => void
  currentCodeTheme: CodeTheme
  onCodeThemeChange: (theme: CodeTheme) => void
}

const APP_THEME_LABELS: Record<AppTheme, string> = {
  classic: 'Classic',
  dim: 'Dim',
  solarized: 'Solarized',
  nord: 'Nord',
  rose: 'Rose',
}

const CODE_THEME_LABELS: Record<CodeTheme, string> = {
  github: 'GitHub',
  'atom-one': 'Atom One',
  'tokyo-night': 'Tokyo Night',
  nord: 'Nord',
  monokai: 'Monokai',
}

export function buildMenu({
  onNewWindow,
  currentTheme,
  onThemeChange,
  currentAppTheme,
  onAppThemeChange,
  currentCodeTheme,
  onCodeThemeChange,
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

  const appThemeItem = (value: AppTheme): MenuItemConstructorOptions => ({
    label: APP_THEME_LABELS[value],
    type: 'radio',
    checked: currentAppTheme === value,
    click: () => onAppThemeChange(value),
  })

  const codeThemeItem = (value: CodeTheme): MenuItemConstructorOptions => ({
    label: CODE_THEME_LABELS[value],
    type: 'radio',
    checked: currentCodeTheme === value,
    click: () => onCodeThemeChange(value),
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
          label: 'App Theme',
          submenu: APP_THEMES.map(appThemeItem),
        },
        {
          label: 'Code Theme',
          submenu: CODE_THEMES.map(codeThemeItem),
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
