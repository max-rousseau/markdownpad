// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { watch } from 'node:fs'
import { mkdtemp, rm, rename, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  noteSelfWrite,
  stopForWindow,
  watchForWindow,
  type FileChangeCallback,
} from './watcher.js'

const WINDOW_ID = 1
const OTHER_WINDOW_ID = 2

/**
 * Directory watching goes through FSEvents on macOS, which a seatbelt sandbox
 * denies (it surfaces as EMFILE). The app and CI both run unsandboxed; probe so
 * a restricted local shell skips loudly instead of passing vacuously.
 */
async function directoryWatchWorks(): Promise<boolean> {
  const probeDir = await mkdtemp(join(tmpdir(), 'markdownpad-probe-'))
  const probeFile = join(probeDir, 'probe.md')
  await writeFile(probeFile, 'probe\n', 'utf8')
  try {
    return await new Promise<boolean>((resolve) => {
      const watcher = watch(probeDir, { persistent: false }, () => finish(true))
      watcher.on('error', () => finish(false))
      const timer = setTimeout(() => finish(false), 1500)
      let settled = false
      function finish(ok: boolean): void {
        if (settled) return
        settled = true
        clearTimeout(timer)
        watcher.close()
        resolve(ok)
      }
      void writeFile(probeFile, 'probe touched\n', 'utf8')
    })
  } finally {
    await rm(probeDir, { recursive: true, force: true })
  }
}

const canWatchDirectories = await directoryWatchWorks()

// Watch events are inherently asynchronous (FSEvents latency + the 120ms
// debounce), so assertions poll rather than sleep a fixed amount.
async function waitFor(predicate: () => boolean, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('timed out waiting for condition')
}

async function settle(ms = 600): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

describe.skipIf(!canWatchDirectories)('watcher', () => {
  let dir: string
  let file: string
  let onChange: Mock<FileChangeCallback>

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'markdownpad-watch-'))
    file = join(dir, 'note.md')
    await writeFile(file, 'base\n', 'utf8')
    onChange = vi.fn<FileChangeCallback>()
  })

  afterEach(async () => {
    stopForWindow(WINDOW_ID)
    stopForWindow(OTHER_WINDOW_ID)
    await rm(dir, { recursive: true, force: true })
  })

  it('reports an in-place append with the new content', async () => {
    watchForWindow(WINDOW_ID, file, onChange)
    await writeFile(file, 'base\nappended\n', 'utf8')

    await waitFor(() => onChange.mock.calls.length > 0)
    expect(onChange).toHaveBeenLastCalledWith(file, 'base\nappended\n')
  })

  it('reports an atomic replace (write temp + rename), which a bare file watch misses', async () => {
    watchForWindow(WINDOW_ID, file, onChange)
    const temp = join(dir, '.note.md.tmp')
    await writeFile(temp, 'rewritten by an agent\n', 'utf8')
    await rename(temp, file)

    await waitFor(() => onChange.mock.calls.length > 0)
    expect(onChange).toHaveBeenLastCalledWith(file, 'rewritten by an agent\n')
  })

  it('does not report a write the app itself made', async () => {
    watchForWindow(WINDOW_ID, file, onChange)
    const own = 'saved by markdownpad\n'
    await writeFile(file, own, 'utf8')
    noteSelfWrite(WINDOW_ID, file, own)

    await settle()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('stops watching the previous file after a path switch', async () => {
    const other = join(dir, 'other.md')
    await writeFile(other, 'other\n', 'utf8')

    watchForWindow(WINDOW_ID, file, onChange)
    watchForWindow(WINDOW_ID, other, onChange)

    await writeFile(file, 'changed behind our back\n', 'utf8')
    await settle()
    expect(onChange).not.toHaveBeenCalled()

    await writeFile(other, 'other changed\n', 'utf8')
    await waitFor(() => onChange.mock.calls.length > 0)
    expect(onChange).toHaveBeenLastCalledWith(other, 'other changed\n')
  })

  it('stops reporting after stopForWindow', async () => {
    watchForWindow(WINDOW_ID, file, onChange)
    stopForWindow(WINDOW_ID)

    await writeFile(file, 'ignored\n', 'utf8')
    await settle()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('keeps watching after the file is deleted and recreated', async () => {
    watchForWindow(WINDOW_ID, file, onChange)
    await rm(file)
    await settle(300)
    await writeFile(file, 'reborn\n', 'utf8')

    await waitFor(() => onChange.mock.calls.length > 0)
    expect(onChange).toHaveBeenLastCalledWith(file, 'reborn\n')
  })
})
