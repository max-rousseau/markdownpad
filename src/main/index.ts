import { app, BrowserWindow, ipcMain, screen, shell } from 'electron'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { buildMenu } from './menu.js'
import { registerFileHandlers } from './files.js'
import {
  getAppTheme,
  getCodeTheme,
  getTheme,
  loadState,
  persistState,
  removeWindow,
  setAppTheme,
  setCodeTheme,
  setTheme,
  setWindowFile,
  updateWindowBounds,
  type AppTheme,
  type CodeTheme,
  type Theme,
} from './state.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// In dev (electron-vite), __dirname is <project>/out/main → ../../build/icon.png.
// In a packaged build the icon is baked into the .icns inside the .app bundle,
// so we only set it explicitly during dev (where the dock would otherwise show
// the generic Electron logo).
const iconPath = join(__dirname, '../../build/icon.png')

app.setName('markdownpad')
app.setAboutPanelOptions({
  applicationName: 'markdownpad',
  applicationVersion: app.getVersion(),
  copyright: '© 2026 Maxime Rousseau',
  credits: 'A focused, Notepad-inspired markdown editor.\nLicensed under the BSD-3-Clause License.',
  iconPath: app.isPackaged ? undefined : iconPath,
})

if (!app.isPackaged && app.dock && existsSync(iconPath)) {
  app.dock.setIcon(iconPath)
}

const windows = new Set<BrowserWindow>()
const pendingOpenPaths: string[] = []
const dirtyByWindow = new Map<number, boolean>()
const closeAllowedFor = new Set<number>()
let isQuitting = false

const CASCADE_OFFSET = 28

function cascadePosition(
  width: number,
  height: number,
): { x: number; y: number } | null {
  const ref = BrowserWindow.getFocusedWindow() ?? lastLiveWindow()
  if (!ref || ref.isDestroyed()) return null

  const refBounds = ref.getBounds()
  const display = screen.getDisplayMatching(refBounds).workArea
  const x = refBounds.x + CASCADE_OFFSET
  const y = refBounds.y + CASCADE_OFFSET

  // Bail and let macOS auto-position if the cascade would push the new
  // window off the same display (cleaner than wrapping awkwardly).
  if (x + width > display.x + display.width || y + height > display.y + display.height) {
    return null
  }
  return { x, y }
}

function lastLiveWindow(): BrowserWindow | null {
  let last: BrowserWindow | null = null
  for (const w of windows) {
    if (!w.isDestroyed()) last = w
  }
  return last
}

export function createWindow(initialFile?: string): BrowserWindow {
  const state = loadState()
  const workArea = screen.getPrimaryDisplay().workAreaSize
  const maxHeight = Math.floor(workArea.height * 0.75)
  const width = Math.min(state.window.width, workArea.width)
  const height = Math.min(state.window.height, maxHeight)
  const cascade = cascadePosition(width, height)

  const win = new BrowserWindow({
    width,
    height,
    x: cascade?.x,
    y: cascade?.y,
    minWidth: 480,
    minHeight: 320,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
    backgroundColor: '#0b0b0c',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  windows.add(win)

  win.on('ready-to-show', () => {
    win.show()
    if (initialFile && existsSync(initialFile)) {
      win.webContents.send('file:opened-externally', initialFile)
    }
  })

  win.on('close', (event) => {
    const id = win.webContents.id

    // Gate on unsaved changes. Renderer prompts the user, then signals back.
    if (!closeAllowedFor.has(id) && dirtyByWindow.get(id)) {
      event.preventDefault()
      win.webContents.send('window:close-requested')
      return
    }
    closeAllowedFor.delete(id)

    if (win.isDestroyed()) return
    const { width: w, height: h } = win.getBounds()
    updateWindowBounds({ width: w, height: h })
    if (!isQuitting) {
      removeWindow(id)
    }
    dirtyByWindow.delete(id)
    persistState()
  })

  win.on('closed', () => {
    windows.delete(win)
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.on('open-file', (event, path) => {
  event.preventDefault()
  if (!app.isReady()) {
    pendingOpenPaths.push(path)
    return
  }
  createWindow(path)
})

app.on('before-quit', () => {
  isQuitting = true
})

app.whenReady().then(() => {
  registerFileHandlers()
  ipcMain.on('state:set-current-file', (event, path: string | null) => {
    setWindowFile(event.sender.id, path)
  })
  ipcMain.on('state:set-dirty', (event, dirty: boolean) => {
    dirtyByWindow.set(event.sender.id, !!dirty)
  })
  ipcMain.on('window:allow-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || win.isDestroyed()) return
    closeAllowedFor.add(event.sender.id)
    win.close()
  })
  ipcMain.on('window:cancel-close', () => {
    // User aborted — if a quit was in flight, treat it as cancelled too.
    isQuitting = false
  })
  ipcMain.handle('theme:get', () => getTheme())
  ipcMain.handle('app-theme:get', () => getAppTheme())
  ipcMain.handle('code-theme:get', () => getCodeTheme())

  const rebuildMenu = () =>
    buildMenu({
      onNewWindow: () => createWindow(),
      currentTheme: getTheme(),
      onThemeChange: (theme) => applyTheme(theme),
      currentAppTheme: getAppTheme(),
      onAppThemeChange: (appTheme) => applyAppTheme(appTheme),
      currentCodeTheme: getCodeTheme(),
      onCodeThemeChange: (codeTheme) => applyCodeTheme(codeTheme),
    })
  rebuildMenu()

  function applyTheme(theme: Theme) {
    setTheme(theme)
    persistState()
    for (const w of windows) {
      if (!w.isDestroyed()) w.webContents.send('theme:changed', theme)
    }
    rebuildMenu()
  }

  function applyAppTheme(appTheme: AppTheme) {
    setAppTheme(appTheme)
    persistState()
    for (const w of windows) {
      if (!w.isDestroyed()) w.webContents.send('app-theme:changed', appTheme)
    }
    rebuildMenu()
  }

  function applyCodeTheme(codeTheme: CodeTheme) {
    setCodeTheme(codeTheme)
    persistState()
    for (const w of windows) {
      if (!w.isDestroyed()) w.webContents.send('code-theme:changed', codeTheme)
    }
    rebuildMenu()
  }

  // Restore: drain pending open-file events first, then persisted openFiles, then fall back to one blank window.
  if (pendingOpenPaths.length > 0) {
    for (const path of pendingOpenPaths) createWindow(path)
    pendingOpenPaths.length = 0
  } else {
    const state = loadState()
    for (const file of state.openFiles) {
      if (existsSync(file)) createWindow(file)
    }
  }
  if (windows.size === 0) createWindow()

  app.on('activate', () => {
    if (windows.size === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
