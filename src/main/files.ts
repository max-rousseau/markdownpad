import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'

const MARKDOWN_FILTERS = [
  { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
]

export interface OpenedFile {
  path: string
  name: string
  content: string
}

async function readMarkdownFile(path: string): Promise<OpenedFile> {
  const content = await readFile(path, 'utf8')
  return { path, name: basename(path), content }
}

export function registerFileHandlers(): void {
  ipcMain.handle('file:open', async (event): Promise<OpenedFile | null> => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const result = await dialog.showOpenDialog(win!, {
      title: 'Open Markdown File',
      properties: ['openFile'],
      filters: MARKDOWN_FILTERS,
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const file = await readMarkdownFile(result.filePaths[0])
    app.addRecentDocument(file.path)
    return file
  })

  ipcMain.handle('file:read', async (_event, path: string): Promise<OpenedFile> => {
    const file = await readMarkdownFile(path)
    app.addRecentDocument(path)
    return file
  })

  ipcMain.handle(
    'file:save',
    async (_event, path: string, content: string): Promise<void> => {
      await writeFile(path, content, 'utf8')
      app.addRecentDocument(path)
    },
  )

  ipcMain.handle(
    'file:save-as',
    async (event, content: string, suggestedName: string): Promise<OpenedFile | null> => {
      const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
      const result = await dialog.showSaveDialog(win!, {
        title: 'Save Markdown File',
        defaultPath: suggestedName,
        filters: MARKDOWN_FILTERS,
      })
      if (result.canceled || !result.filePath) return null
      await writeFile(result.filePath, content, 'utf8')
      app.addRecentDocument(result.filePath)
      return {
        path: result.filePath,
        name: basename(result.filePath),
        content,
      }
    },
  )

  ipcMain.handle(
    'dialog:confirm-discard',
    async (event, fileName: string): Promise<'save' | 'discard' | 'cancel'> => {
      const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
      const result = await dialog.showMessageBox(win!, {
        type: 'warning',
        message: `Save changes to "${fileName}"?`,
        detail: 'Your changes will be lost if you do not save them.',
        buttons: ['Save', 'Discard', 'Cancel'],
        defaultId: 0,
        cancelId: 2,
      })
      if (result.response === 0) return 'save'
      if (result.response === 1) return 'discard'
      return 'cancel'
    },
  )
}
