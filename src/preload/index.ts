import { contextBridge, ipcRenderer } from 'electron'

export interface OpenedFile {
  path: string
  name: string
  content: string
}

export type DiscardChoice = 'save' | 'discard' | 'cancel'
export type Theme = 'light' | 'dark' | 'system'
export type ThemePack = 'plain' | 'forest' | 'midnight' | 'solarflare' | 'cherry'

const api = {
  openFile: (): Promise<OpenedFile | null> => ipcRenderer.invoke('file:open'),
  readFile: (path: string): Promise<OpenedFile> => ipcRenderer.invoke('file:read', path),
  saveFile: (path: string, content: string): Promise<void> =>
    ipcRenderer.invoke('file:save', path, content),
  saveFileAs: (content: string, suggestedName: string): Promise<OpenedFile | null> =>
    ipcRenderer.invoke('file:save-as', content, suggestedName),
  confirmDiscard: (fileName: string): Promise<DiscardChoice> =>
    ipcRenderer.invoke('dialog:confirm-discard', fileName),
  setCurrentFile: (path: string | null): void => {
    ipcRenderer.send('state:set-current-file', path)
  },
  setDirty: (dirty: boolean): void => {
    ipcRenderer.send('state:set-dirty', dirty)
  },
  allowClose: (): void => {
    ipcRenderer.send('window:allow-close')
  },
  cancelClose: (): void => {
    ipcRenderer.send('window:cancel-close')
  },
  onCloseRequested: (cb: () => void) => subscribe('window:close-requested', cb),

  getTheme: (): Promise<Theme> => ipcRenderer.invoke('theme:get'),
  onThemeChanged: (cb: (theme: Theme) => void): (() => void) => {
    const handler = (_e: unknown, theme: Theme) => cb(theme)
    ipcRenderer.on('theme:changed', handler)
    return () => {
      ipcRenderer.off('theme:changed', handler)
    }
  },
  getThemePack: (): Promise<ThemePack> => ipcRenderer.invoke('theme-pack:get'),
  onThemePackChanged: (cb: (pack: ThemePack) => void): (() => void) => {
    const handler = (_e: unknown, pack: ThemePack) => cb(pack)
    ipcRenderer.on('theme-pack:changed', handler)
    return () => {
      ipcRenderer.off('theme-pack:changed', handler)
    }
  },

  onMenuOpen: (cb: () => void) => subscribe('menu:open', cb),
  onMenuSave: (cb: () => void) => subscribe('menu:save', cb),
  onMenuSaveAs: (cb: () => void) => subscribe('menu:save-as', cb),
  onMenuTogglePreview: (cb: () => void) => subscribe('menu:toggle-preview', cb),
  onMenuPrint: (cb: () => void) => subscribe('menu:print', cb),
  onFileOpenedExternally: (cb: (path: string) => void): (() => void) => {
    const handler = (_e: unknown, path: string) => cb(path)
    ipcRenderer.on('file:opened-externally', handler)
    return () => {
      ipcRenderer.off('file:opened-externally', handler)
    }
  },
  onFileChangedExternally: (
    cb: (payload: { path: string; content: string }) => void,
  ): (() => void) => {
    const handler = (_e: unknown, payload: { path: string; content: string }) => cb(payload)
    ipcRenderer.on('file:changed-externally', handler)
    return () => {
      ipcRenderer.off('file:changed-externally', handler)
    }
  },
}

function subscribe(channel: string, cb: () => void): () => void {
  const handler = () => cb()
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.off(channel, handler)
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
