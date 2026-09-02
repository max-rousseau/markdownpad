import { readFileSync, watch, type FSWatcher } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, dirname } from 'node:path'

export type FileChangeCallback = (path: string, content: string) => void

// Editors and agents rewrite files in bursts (temp write, rename, chmod). Wait
// for the burst to settle before reading.
const DEBOUNCE_MS = 120

interface WatchEntry {
  path: string
  watcher: FSWatcher
  baseline: string
  timer: ReturnType<typeof setTimeout> | null
  // Bumped by noteSelfWrite. Lets fire() detect a self-write that landed
  // during its in-flight read, so it doesn't publish stale content.
  writeSeq: number
}

const registry = new Map<number, WatchEntry>()

function readOrEmpty(path: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return ''
  }
}

/**
 * Watch `path` on behalf of a window, replacing any previous watch for it.
 *
 * The watch is placed on the *containing directory*, not the file: an atomic
 * replace (write temp + rename), which is how most agents and editors save,
 * swaps the inode out from under a bare file watch and leaves it deaf. A
 * directory watch survives it.
 */
export function watchForWindow(
  windowId: number,
  path: string | null,
  onChange: FileChangeCallback,
): void {
  const existing = registry.get(windowId)
  if (existing && existing.path === path) return

  stopForWindow(windowId)
  if (!path) return

  const target = basename(path)
  const entry: WatchEntry = {
    path,
    baseline: readOrEmpty(path),
    timer: null,
    writeSeq: 0,
    watcher: watch(dirname(path), { persistent: false }, (_event, filename) => {
      if (filename !== null && basename(filename.toString()) !== target) return
      if (entry.timer) clearTimeout(entry.timer)
      entry.timer = setTimeout(fire, DEBOUNCE_MS)
    }),
  }

  async function fire(): Promise<void> {
    entry.timer = null
    const seqAtRead = entry.writeSeq
    let content: string
    try {
      content = await readFile(entry.path, 'utf8')
    } catch {
      // Mid-rename, or the file was deleted. Keep watching: the next event
      // (including a recreation) resolves it.
      return
    }
    if (entry.writeSeq !== seqAtRead) {
      // A self-write landed while this read was in flight: the content we
      // just read may already be stale relative to the new baseline. Re-arm
      // the debounce instead of publishing; the disk has settled by the time
      // it fires again.
      entry.timer = setTimeout(fire, DEBOUNCE_MS)
      return
    }
    // Identical content covers FSEvents duplicates, chmod-only touches, and the
    // app's own saves (see noteSelfWrite).
    if (content === entry.baseline) return
    if (registry.get(windowId) !== entry) return
    entry.baseline = content
    onChange(entry.path, content)
  }

  registry.set(windowId, entry)

  // An unhandled 'error' on an FSWatcher takes the main process down. If the
  // directory becomes unwatchable there is nothing to recover, so drop the
  // watch and leave the document as-is.
  entry.watcher.on('error', () => stopForWindow(windowId))
}

export function stopForWindow(windowId: number): void {
  const entry = registry.get(windowId)
  if (!entry) return
  if (entry.timer) clearTimeout(entry.timer)
  entry.watcher.close()
  registry.delete(windowId)
}

/** Record content this app just wrote, so the resulting event is not echoed back. */
export function noteSelfWrite(windowId: number, path: string, content: string): void {
  const entry = registry.get(windowId)
  if (!entry || entry.path !== path) return
  entry.baseline = content
  entry.writeSeq++
}
