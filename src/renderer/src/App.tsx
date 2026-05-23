import { useCallback, useEffect, useState } from 'react'
import mermaid from 'mermaid'
import { Editor } from './components/editor'
import { Preview } from './components/preview'
import { TitleBar } from './components/title-bar'
import { useDocument } from './hooks/use-document'
import { toggleTaskAt as toggleTaskAtInSource } from './lib/markdown'
import {
  applyTheme,
  currentResolvedTheme,
  mermaidConfigFor,
  type ResolvedTheme,
  type Theme,
  type ThemePack,
} from './lib/theme'

type Mode = 'edit' | 'view'

interface AppProps {
  initialTheme: Theme
  initialThemePack: ThemePack
}

export default function App({ initialTheme, initialThemePack }: AppProps) {
  const doc = useDocument()
  const [mode, setMode] = useState<Mode>('edit')
  const [theme, setThemeState] = useState<Theme>(initialTheme)
  const [themePack, setThemePackState] = useState<ThemePack>(initialThemePack)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(currentResolvedTheme())

  useEffect(() => {
    applyTheme(theme, themePack, setResolvedTheme)
  }, [theme, themePack])

  useEffect(() => {
    const offTheme = window.api.onThemeChanged((next) => setThemeState(next))
    const offPack = window.api.onThemePackChanged((next) => setThemePackState(next))
    return () => {
      offTheme()
      offPack()
    }
  }, [])

  useEffect(() => {
    const cfg = mermaidConfigFor(themePack, resolvedTheme)
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      fontFamily: 'inherit',
      ...cfg,
    })
  }, [themePack, resolvedTheme])

  const toggleMode = useCallback(() => {
    setMode((m) => (m === 'edit' ? 'view' : 'edit'))
  }, [])

  const toggleTaskAt = useCallback(
    (offset: number) => {
      const next = toggleTaskAtInSource(doc.state.content, offset)
      if (next !== doc.state.content) doc.setContent(next)
    },
    [doc],
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      toggleMode()
    },
    [toggleMode],
  )

  const confirmCanProceed = useCallback(async (): Promise<boolean> => {
    if (!doc.state.dirty) return true
    const choice = await window.api.confirmDiscard(doc.state.name)
    if (choice === 'cancel') return false
    if (choice === 'discard') return true
    return doc.save()
  }, [doc])

  const handleOpen = useCallback(async () => {
    if (!(await confirmCanProceed())) return
    const file = await window.api.openFile()
    if (file) {
      doc.adoptOpened(file)
      setMode('view')
    }
  }, [doc, confirmCanProceed])

  const handleOpenExternal = useCallback(
    async (path: string) => {
      if (!(await confirmCanProceed())) return
      const file = await window.api.readFile(path)
      doc.adoptOpened(file)
      setMode('view')
    },
    [doc, confirmCanProceed],
  )

  useEffect(() => {
    const offOpen = window.api.onMenuOpen(handleOpen)
    const offSave = window.api.onMenuSave(() => void doc.save())
    const offSaveAs = window.api.onMenuSaveAs(() => void doc.saveAs())
    const offTogglePreview = window.api.onMenuTogglePreview(toggleMode)
    const offExternal = window.api.onFileOpenedExternally(handleOpenExternal)
    return () => {
      offOpen()
      offSave()
      offSaveAs()
      offTogglePreview()
      offExternal()
    }
  }, [doc, handleOpen, handleOpenExternal, toggleMode])

  useEffect(() => {
    document.title = doc.state.dirty
      ? `${doc.state.name} — markdownpad (modified)`
      : `${doc.state.name} — markdownpad`
  }, [doc.state.name, doc.state.dirty])

  useEffect(() => {
    window.api.setCurrentFile(doc.state.path)
  }, [doc.state.path])

  useEffect(() => {
    window.api.setDirty(doc.state.dirty)
  }, [doc.state.dirty])

  useEffect(() => {
    return window.api.onCloseRequested(async () => {
      const choice = await window.api.confirmDiscard(doc.state.name)
      if (choice === 'cancel') {
        window.api.cancelClose()
        return
      }
      if (choice === 'save') {
        const saved = await doc.save()
        if (!saved) {
          window.api.cancelClose()
          return
        }
      }
      window.api.allowClose()
    })
  }, [doc])

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <TitleBar fileName={doc.state.path ? doc.state.name : null} dirty={doc.state.dirty} />
      <div
        className="flex flex-1 min-h-0"
        onContextMenu={handleContextMenu}
      >
        {mode === 'edit' ? (
          <Editor value={doc.state.content} onChange={doc.setContent} theme={resolvedTheme} />
        ) : (
          <Preview
            key={`${themePack}-${resolvedTheme}`}
            content={doc.state.content}
            docPath={doc.state.path}
            onToggleTaskAt={toggleTaskAt}
          />
        )}
      </div>
    </div>
  )
}
