import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import App from './App'

// The editor (CodeMirror) and preview (react-markdown + mermaid) are heavy and
// irrelevant here — a textarea is enough to mount a pane and to type into it.
vi.mock('./components/editor', () => ({
  Editor: ({ value, onChange }: { value: string; onChange: (next: string) => void }) => (
    <textarea
      data-testid="editor"
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  ),
}))
vi.mock('./components/preview', () => ({
  Preview: () => <div data-testid="preview" className="markdown-preview" />,
}))
vi.mock('mermaid', () => ({ default: { initialize: vi.fn() } }))

type Listener = (payload?: unknown) => void

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
    readFile: vi.fn(),
    saveFile: vi.fn(),
    confirmDiscard: vi.fn(),
    onThemeChanged: vi.fn(() => () => {}),
    onThemePackChanged: vi.fn(() => () => {}),
    onCloseRequested: vi.fn(() => () => {}),
    onFileOpenedExternally: vi.fn(on('file:opened-externally')),
    onFileChangedExternally: vi.fn(on('file:changed-externally')),
    onMenuOpen: vi.fn(on('menu:open')),
    onMenuSave: vi.fn(on('menu:save')),
    onMenuSaveAs: vi.fn(on('menu:save-as')),
    onMenuTogglePreview: vi.fn(on('menu:toggle-preview')),
    onMenuPrint: vi.fn(on('menu:print')),
  }

  vi.stubGlobal('api', api)
  return {
    api,
    emit: (channel: string, payload?: unknown) => listeners.get(channel)?.(payload),
  }
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

const PATH = '/notes/note.md'
const BASE = ['# Notes', '', 'alpha', 'beta', 'gamma', ''].join('\n')

describe('<App /> live reload', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function openBase() {
    const stub = stubApi()
    stub.api.readFile.mockResolvedValue({ path: PATH, name: 'note.md', content: BASE })
    const view = render(<App initialTheme="light" initialThemePack="plain" />)
    await act(async () => {
      stub.emit('file:opened-externally', PATH)
    })
    return { ...stub, ...view }
  }

  async function typeInEditor(
    view: Awaited<ReturnType<typeof openBase>>,
    next: string,
  ): Promise<void> {
    act(() => view.emit('menu:toggle-preview'))
    const editor = await view.findByTestId('editor')
    fireEvent.change(editor, { target: { value: next } })
  }

  it('shows a transient notice when a clean buffer reloads from disk', async () => {
    const view = await openBase()

    act(() => view.emit('file:changed-externally', { path: PATH, content: 'rewritten\n' }))

    expect(view.getByText('Updated from disk')).toBeInTheDocument()
  })

  it('shows a merge notice when a dirty buffer absorbs a non-overlapping change', async () => {
    const view = await openBase()
    await typeInEditor(view, ['# Notes', '', 'alpha mine', 'beta', 'gamma', ''].join('\n'))

    act(() =>
      view.emit('file:changed-externally', {
        path: PATH,
        content: ['# Notes', '', 'alpha', 'beta', 'gamma theirs', ''].join('\n'),
      }),
    )

    expect(view.getByText('Merged changes from disk')).toBeInTheDocument()
    expect(view.getByTestId('editor')).toHaveValue(
      ['# Notes', '', 'alpha mine', 'beta', 'gamma theirs', ''].join('\n'),
    )
  })

  it('offers both resolutions on a conflict and takes the disk version', async () => {
    const view = await openBase()
    const mine = ['# Notes', '', 'alpha mine', 'beta', 'gamma', ''].join('\n')
    const theirs = ['# Notes', '', 'alpha theirs', 'beta', 'gamma', ''].join('\n')
    await typeInEditor(view, mine)

    act(() => view.emit('file:changed-externally', { path: PATH, content: theirs }))

    expect(view.getByText('Changed on disk')).toBeInTheDocument()
    // The buffer is left alone until the user decides.
    expect(view.getByTestId('editor')).toHaveValue(mine)

    fireEvent.click(view.getByRole('button', { name: 'Take theirs' }))

    expect(view.queryByText('Changed on disk')).toBeNull()
    expect(view.getByTestId('editor')).toHaveValue(theirs)
  })

  it('keeps the buffer when the user chooses their own version', async () => {
    const view = await openBase()
    const mine = ['# Notes', '', 'alpha mine', 'beta', 'gamma', ''].join('\n')
    await typeInEditor(view, mine)

    act(() =>
      view.emit('file:changed-externally', {
        path: PATH,
        content: ['# Notes', '', 'alpha theirs', 'beta', 'gamma', ''].join('\n'),
      }),
    )
    fireEvent.click(view.getByRole('button', { name: 'Keep mine' }))

    expect(view.queryByText('Changed on disk')).toBeNull()
    expect(view.getByTestId('editor')).toHaveValue(mine)
  })

  it('shows nothing for a change to a file that is not open', async () => {
    const view = await openBase()

    act(() =>
      view.emit('file:changed-externally', { path: '/notes/other.md', content: 'nope\n' }),
    )

    expect(view.queryByText('Updated from disk')).toBeNull()
    expect(view.queryByText('Changed on disk')).toBeNull()
  })
})
