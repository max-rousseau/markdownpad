import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import App from './App'

// The editor (CodeMirror) and preview (react-markdown + mermaid) are heavy and
// irrelevant here — printing only cares about which pane is mounted.
vi.mock('./components/editor', () => ({
  Editor: () => <div data-testid="editor" />,
}))
vi.mock('./components/preview', () => ({
  Preview: () => <div data-testid="preview" className="markdown-preview" />,
}))
vi.mock('mermaid', () => ({ default: { initialize: vi.fn() } }))

type Listener = () => void

function stubApi() {
  const listeners = new Map<string, Listener>()
  const on = (channel: string) => (cb: Listener) => {
    listeners.set(channel, cb)
    return () => listeners.delete(channel)
  }

  const api = {
    getTheme: vi.fn(),
    getThemePack: vi.fn(),
    setCurrentFile: vi.fn(),
    setDirty: vi.fn(),
    onThemeChanged: vi.fn(() => () => {}),
    onThemePackChanged: vi.fn(() => () => {}),
    onCloseRequested: vi.fn(() => () => {}),
    onFileOpenedExternally: vi.fn(() => () => {}),
    onMenuOpen: vi.fn(on('menu:open')),
    onMenuSave: vi.fn(on('menu:save')),
    onMenuSaveAs: vi.fn(on('menu:save-as')),
    onMenuTogglePreview: vi.fn(on('menu:toggle-preview')),
    onMenuPrint: vi.fn(on('menu:print')),
  }

  vi.stubGlobal('api', api)
  return { api, emit: (channel: string) => listeners.get(channel)?.() }
}

describe('<App /> printing', () => {
  let print: ReturnType<typeof vi.fn>

  beforeEach(() => {
    print = vi.fn()
    vi.stubGlobal('print', print)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('subscribes to the Print menu command', () => {
    const { api } = stubApi()
    render(<App initialTheme="light" initialThemePack="plain" />)
    expect(api.onMenuPrint).toHaveBeenCalledTimes(1)
  })

  it('from edit mode, mounts the preview and prints it, then returns to edit mode', async () => {
    const { emit } = stubApi()
    const { queryByTestId } = render(<App initialTheme="light" initialThemePack="plain" />)
    expect(queryByTestId('editor')).not.toBeNull()

    let previewMountedAtPrint: boolean | null = null
    print.mockImplementation(() => {
      previewMountedAtPrint = document.querySelector('[data-testid="preview"]') !== null
    })

    act(() => emit('menu:print'))

    await waitFor(() => expect(print).toHaveBeenCalledTimes(1))
    expect(previewMountedAtPrint).toBe(true)
    // window.print() is synchronous, so the previous mode is restored by the
    // time it returns.
    await waitFor(() => expect(queryByTestId('editor')).not.toBeNull())
  })

  it('prints immediately when already in view mode', async () => {
    const { emit } = stubApi()
    const { queryByTestId } = render(<App initialTheme="light" initialThemePack="plain" />)

    act(() => emit('menu:toggle-preview'))
    await waitFor(() => expect(queryByTestId('preview')).not.toBeNull())

    act(() => emit('menu:print'))
    expect(print).toHaveBeenCalledTimes(1)
    expect(queryByTestId('preview')).not.toBeNull()
  })
})
