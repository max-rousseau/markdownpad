import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDocument } from './use-document'

const PATH = '/notes/note.md'
const BASE = ['# Notes', '', 'alpha', 'beta', 'gamma', ''].join('\n')

function openDocument() {
  const hook = renderHook(() => useDocument())
  act(() => {
    hook.result.current.adoptOpened({ path: PATH, name: 'note.md', content: BASE })
  })
  return hook
}

describe('useDocument external changes', () => {
  it('adopts disk content silently when the buffer is clean', () => {
    const { result } = openDocument()
    const disk = BASE + 'appended on disk\n'

    act(() => result.current.applyExternalChange(PATH, disk))

    expect(result.current.state.content).toBe(disk)
    expect(result.current.state.dirty).toBe(false)
    expect(result.current.externalChange?.kind).toBe('reloaded')
  })

  it('merges non-overlapping edits and keeps the buffer dirty', () => {
    const { result } = openDocument()
    act(() => {
      result.current.setContent(
        ['# Notes', '', 'alpha mine', 'beta', 'gamma', ''].join('\n'),
      )
    })
    const disk = ['# Notes', '', 'alpha', 'beta', 'gamma theirs', ''].join('\n')

    act(() => result.current.applyExternalChange(PATH, disk))

    expect(result.current.state.content).toBe(
      ['# Notes', '', 'alpha mine', 'beta', 'gamma theirs', ''].join('\n'),
    )
    expect(result.current.state.dirty).toBe(true)
    expect(result.current.externalChange?.kind).toBe('merged')
  })

  it('leaves the buffer untouched and flags a conflict on overlapping edits', () => {
    const { result } = openDocument()
    const mine = ['# Notes', '', 'alpha mine', 'beta', 'gamma', ''].join('\n')
    act(() => result.current.setContent(mine))
    const disk = ['# Notes', '', 'alpha theirs', 'beta', 'gamma', ''].join('\n')

    act(() => result.current.applyExternalChange(PATH, disk))

    expect(result.current.state.content).toBe(mine)
    expect(result.current.state.dirty).toBe(true)
    expect(result.current.externalChange?.kind).toBe('conflict')
  })

  it('resolves a conflict by taking the disk version', () => {
    const { result } = openDocument()
    act(() => result.current.setContent('mine only\n'))
    const disk = 'theirs only\n'
    act(() => result.current.applyExternalChange(PATH, disk))

    act(() => result.current.resolveConflict('theirs'))

    expect(result.current.state.content).toBe(disk)
    expect(result.current.state.dirty).toBe(false)
    expect(result.current.externalChange).toBeNull()
  })

  it('resolves a conflict by keeping the buffer', () => {
    const { result } = openDocument()
    act(() => result.current.setContent('mine only\n'))
    act(() => result.current.applyExternalChange(PATH, 'theirs only\n'))

    act(() => result.current.resolveConflict('mine'))

    expect(result.current.state.content).toBe('mine only\n')
    expect(result.current.state.dirty).toBe(true)
    expect(result.current.externalChange).toBeNull()
  })

  it('ignores a change for a file we no longer have open', () => {
    const { result } = openDocument()

    act(() => result.current.applyExternalChange('/notes/other.md', 'unrelated\n'))

    expect(result.current.state.content).toBe(BASE)
    expect(result.current.externalChange).toBeNull()
  })

  it('clears a pending conflict when the document is reopened', () => {
    const { result } = openDocument()
    act(() => result.current.setContent('mine only\n'))
    act(() => result.current.applyExternalChange(PATH, 'theirs only\n'))

    act(() => {
      result.current.adoptOpened({ path: PATH, name: 'note.md', content: 'fresh\n' })
    })

    expect(result.current.externalChange).toBeNull()
    expect(result.current.state.content).toBe('fresh\n')
  })
})
