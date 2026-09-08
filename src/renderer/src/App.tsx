import { useCallback, useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { Editor } from './components/editor'
import { Preview } from './components/preview'
import { ReloadPill } from './components/reload-pill'
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

// Upper bound on how long a print waits for Mermaid diagrams to appear.
const MERMAID_RENDER_BUDGET_MS = 2000

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
  const [pendingPrint, setPendingPrint] = useState(false)
  // Whether to return to edit mode once the print dialog is done, when printing
  // was triggered from edit mode.
  const restoreModeRef = useRef(false)

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

  const restoreModeAfterPrint = useCallback(() => {
    const shouldRestore = restoreModeRef.current
    restoreModeRef.current = false
    if (shouldRestore) setMode('edit')
  }, [])

  // Printing renders the preview DOM, so the preview must be mounted. From edit
  // mode we flip to view, wait for the paint, print, then flip back.
  const handlePrint = useCallback(() => {
    if (mode === 'view') {
      window.print()
      return
    }
    restoreModeRef.current = true
    setMode('view')
    setPendingPrint(true)
  }, [mode])

  useEffect(() => {
    if (!pendingPrint || mode !== 'view') return
    let cancelled = false
    let frame = 0
    const deadline = Date.now() + MERMAID_RENDER_BUDGET_MS

    // Mermaid fills its (initially empty) containers from an async render, so a
    // frame or two is not always enough — wait for them, but never indefinitely.
    const diagramsPending = () =>
      Array.from(document.querySelectorAll('.mermaid-block')).some((el) => !el.firstChild)

    const printNow = () => {
      if (cancelled) return
      if (diagramsPending() && Date.now() < deadline) {
        frame = requestAnimationFrame(printNow)
        return
      }
      setPendingPrint(false)
      // Electron's print is blocking, so restoring the mode right after is safe.
      window.print()
      restoreModeAfterPrint()
    }

    // Two frames: one for React's commit, one for the browser to paint it.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(printNow)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [pendingPrint, mode, restoreModeAfterPrint])

  useEffect(() => {
    const offOpen = window.api.onMenuOpen(handleOpen)
    const offSave = window.api.onMenuSave(() => void doc.save())
    const offSaveAs = window.api.onMenuSaveAs(() => void doc.saveAs())
    const offTogglePreview = window.api.onMenuTogglePreview(toggleMode)
    const offPrint = window.api.onMenuPrint(handlePrint)
    const offExternal = window.api.onFileOpenedExternally(handleOpenExternal)
    const offChanged = window.api.onFileChangedExternally(({ path, content }) =>
      doc.applyExternalChange(path, content),
    )
    return () => {
      offChanged()
      offOpen()
      offSave()
      offSaveAs()
      offTogglePreview()
      offPrint()
      offExternal()
    }
  }, [doc, handleOpen, handleOpenExternal, handlePrint, toggleMode])

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
    <div className="relative flex h-full flex-col bg-background text-foreground">
      <TitleBar fileName={doc.state.path ? doc.state.name : null} dirty={doc.state.dirty} />
      <ReloadPill
        change={doc.externalChange}
        onDismiss={doc.dismissExternalChange}
        onResolve={doc.resolveConflict}
      />
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
