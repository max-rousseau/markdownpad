// @vitest-environment node
// Contract and logic coverage with a fake fs.watch: which path is watched, the
// basename filter, debouncing, and baseline de-duplication. The companion
// watcher.test.ts exercises the same module against the real filesystem, but
// FSEvents (and therefore any directory watch) is unavailable inside a sandbox,
// so this suite is the one that always runs.
import { describe, expect, it, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FileChangeCallback } from './watcher.js'

const listeners: Array<{ dir: string; cb: (e: string, f: string | null) => void }> = []
const closed: string[] = []

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
  return {
    ...actual,
    watch: (dir: string, _opts: unknown, cb: (e: string, f: string | null) => void) => {
      listeners.push({ dir, cb })
      return { close: () => closed.push(dir), on: () => {} }
    },
  }
})

// Lets a single test swap in a controllable readFile (e.g. one that stays
// pending until the test resolves it) to simulate a race with the read
// watcher.ts's fire() performs, without disturbing the writeFile/mkdtemp/rm
// helpers this suite uses for real filesystem setup.
//
// vi.mock's factory runs when 'node:fs/promises' is first imported, which
// happens as early as this file's own top-level import below — so the holder
// it closes over must be created via vi.hoisted, not a plain top-level const.
type ReadFile = typeof import('node:fs/promises').readFile
const fsPromisesMock = vi.hoisted<{ readFile: ReadFile }>(() => ({}) as { readFile: ReadFile })

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  fsPromisesMock.readFile = actual.readFile
  return {
    ...actual,
    readFile: ((...args: Parameters<ReadFile>) => fsPromisesMock.readFile(...args)) as ReadFile,
  }
})

const { noteSelfWrite, stopForWindow, watchForWindow } = await import('./watcher.js')
const actualReadFile = (await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises'))
  .readFile

function emit(name: string | null): void {
  for (const l of listeners) l.cb('change', name)
}
const tick = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('watcher logic (faked fs.watch)', () => {
  let dir: string
  let file: string
  let onChange: Mock<FileChangeCallback>

  beforeEach(async () => {
    listeners.length = 0
    closed.length = 0
    dir = await mkdtemp(join(tmpdir(), 'mp-mock-'))
    file = join(dir, 'note.md')
    await writeFile(file, 'base\n', 'utf8')
    onChange = vi.fn<FileChangeCallback>()
  })

  afterEach(async () => {
    stopForWindow(1)
    fsPromisesMock.readFile = actualReadFile
    await rm(dir, { recursive: true, force: true })
  })

  it('watches the containing directory, not the file', () => {
    watchForWindow(1, file, onChange)
    expect(listeners[0].dir).toBe(dir)
  })

  it('ignores events for other files in the directory', async () => {
    watchForWindow(1, file, onChange)
    await writeFile(file, 'changed\n', 'utf8')
    emit('other.md')
    await tick(300)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('reports new content once for a burst of events', async () => {
    watchForWindow(1, file, onChange)
    await writeFile(file, 'changed\n', 'utf8')
    emit('note.md')
    emit('note.md')
    emit(null)
    await tick(400)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(file, 'changed\n')
  })

  it('drops an event whose content matches the baseline', async () => {
    watchForWindow(1, file, onChange)
    emit('note.md')
    await tick(300)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('drops a write the app made itself via noteSelfWrite', async () => {
    watchForWindow(1, file, onChange)
    await writeFile(file, 'ours\n', 'utf8')
    noteSelfWrite(1, file, 'ours\n')
    emit('note.md')
    await tick(300)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('closes the old watcher on a path switch and is a no-op for the same path', async () => {
    watchForWindow(1, file, onChange)
    watchForWindow(1, file, onChange)
    expect(listeners).toHaveLength(1)

    const other = join(dir, 'other.md')
    await writeFile(other, 'other\n', 'utf8')
    watchForWindow(1, other, onChange)
    expect(closed).toEqual([dir])
    expect(listeners).toHaveLength(2)
  })

  it('ignores a deleted file and reports the recreation', async () => {
    watchForWindow(1, file, onChange)
    await rm(file)
    emit('note.md')
    await tick(300)
    expect(onChange).not.toHaveBeenCalled()

    await writeFile(file, 'reborn\n', 'utf8')
    emit('note.md')
    await tick(300)
    expect(onChange).toHaveBeenCalledWith(file, 'reborn\n')
  })

  it('re-arms instead of publishing when a self-write lands mid-read, then delivers the true content', async () => {
    watchForWindow(1, file, onChange)
    await writeFile(file, 'external\n', 'utf8')

    // Stall the in-flight read so we can land a self-write while it's pending.
    let resolveRead!: (content: string) => void
    const pendingRead = new Promise<string>((resolve) => {
      resolveRead = resolve
    })
    fsPromisesMock.readFile = (() => pendingRead) as unknown as ReadFile

    emit('note.md')
    await tick(150) // debounce fires; fire() is now awaiting the stalled read

    // A self-write lands (and, in the real timeline, another external edit
    // follows it) while the read above is still in flight.
    noteSelfWrite(1, file, 'ours\n')
    await writeFile(file, 'ours-plus-external\n', 'utf8')

    // The stalled read resolves with content that predates the self-write.
    // Give fire() just enough time to resume and re-arm, but not enough for
    // the re-armed DEBOUNCE_MS timer to fire too — otherwise it would still
    // hit the same stalled-and-now-resolved readFile stub and "confirm" the
    // stale content instead of exercising a fresh read.
    resolveRead('external\n')
    await tick(30)
    expect(onChange).not.toHaveBeenCalled()

    // Restore the real readFile before the re-armed timer's read fires, so it
    // finds disk has moved on past what noteSelfWrite recorded.
    fsPromisesMock.readFile = actualReadFile
    await tick(300)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(file, 'ours-plus-external\n')
  })

  it('stops reporting after stopForWindow', async () => {
    watchForWindow(1, file, onChange)
    const captured = listeners[0]
    await writeFile(file, 'later\n', 'utf8')
    stopForWindow(1)
    captured.cb('change', 'note.md')
    await tick(300)
    expect(onChange).not.toHaveBeenCalled()
  })
})
