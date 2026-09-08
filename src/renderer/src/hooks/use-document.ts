import { useCallback, useRef, useState } from 'react'
import { mergeThreeWay } from '@/lib/merge'

export interface DocumentState {
  path: string | null
  name: string
  content: string
  dirty: boolean
}

/** What happened the last time the file changed underneath us. */
export type ExternalChangeKind = 'reloaded' | 'merged' | 'conflict'

export interface ExternalChange {
  kind: ExternalChangeKind
  /** Bumped on every signal so repeats of the same kind re-trigger the notice. */
  seq: number
}

const UNTITLED_NAME = 'Untitled'

const initialState: DocumentState = {
  path: null,
  name: UNTITLED_NAME,
  content: '',
  dirty: false,
}

export function useDocument() {
  const [state, setState] = useState<DocumentState>(initialState)
  const savedContentRef = useRef<string>('')
  const [externalChange, setExternalChange] = useState<ExternalChange | null>(null)
  // Disk content held back while a conflict is unresolved.
  const pendingDiskRef = useRef<string | null>(null)
  const seqRef = useRef(0)

  // Mirror of the rendered state. Callbacks read it instead of closing over
  // `state`, so none of them are rebuilt on every keystroke, and an async
  // handler always acts on the latest document rather than a stale capture.
  const stateRef = useRef<DocumentState>(initialState)
  const commit = useCallback(
    (next: DocumentState | ((prev: DocumentState) => DocumentState)) => {
      const value = typeof next === 'function' ? next(stateRef.current) : next
      stateRef.current = value
      setState(value)
    },
    [],
  )

  const signalExternalChange = useCallback((kind: ExternalChangeKind) => {
    seqRef.current += 1
    setExternalChange({ kind, seq: seqRef.current })
  }, [])

  const clearExternalChange = useCallback(() => {
    pendingDiskRef.current = null
    setExternalChange(null)
  }, [])

  const setContent = useCallback(
    (next: string) => {
      commit((prev) => ({
        ...prev,
        content: next,
        dirty: next !== savedContentRef.current,
      }))
    },
    [commit],
  )

  const adoptOpened = useCallback(
    (file: { path: string; name: string; content: string }) => {
      clearExternalChange()
      savedContentRef.current = file.content
      commit({
        path: file.path,
        name: file.name,
        content: file.content,
        dirty: false,
      })
    },
    [clearExternalChange, commit],
  )

  const save = useCallback(async (): Promise<boolean> => {
    let succeeded = false
    const snapshot = stateRef.current
    clearExternalChange()

    if (snapshot.path) {
      await window.api.saveFile(snapshot.path, snapshot.content)
      savedContentRef.current = snapshot.content
      // The user may have typed while the write was in flight; only the
      // untouched buffer becomes clean.
      commit((prev) => (prev.content === snapshot.content ? { ...prev, dirty: false } : prev))
      succeeded = true
    } else {
      const suggested = snapshot.name === UNTITLED_NAME ? 'Untitled.md' : snapshot.name
      const result = await window.api.saveFileAs(snapshot.content, suggested)
      if (result) {
        savedContentRef.current = result.content
        commit({
          path: result.path,
          name: result.name,
          content: result.content,
          dirty: false,
        })
        succeeded = true
      }
    }
    return succeeded
  }, [clearExternalChange, commit])

  const saveAs = useCallback(async (): Promise<boolean> => {
    const snapshot = stateRef.current
    const suggested = snapshot.name === UNTITLED_NAME ? 'Untitled.md' : snapshot.name
    const result = await window.api.saveFileAs(snapshot.content, suggested)
    if (!result) return false
    clearExternalChange()
    savedContentRef.current = result.content
    commit({
      path: result.path,
      name: result.name,
      content: result.content,
      dirty: false,
    })
    return true
  }, [clearExternalChange, commit])

  /**
   * Reconcile a change another process made to the file we have open.
   *
   * A clean buffer simply adopts the new content. A dirty buffer is merged
   * against it three ways, and is left strictly alone if that merge conflicts —
   * the user then chooses which side wins.
   */
  const applyExternalChange = useCallback(
    (path: string, content: string) => {
      const snapshot = stateRef.current
      // A stale event for a file we have since navigated away from.
      if (snapshot.path !== path) return

      if (!snapshot.dirty) {
        savedContentRef.current = content
        commit((prev) => ({ ...prev, content, dirty: false }))
        signalExternalChange('reloaded')
        return
      }

      const outcome = mergeThreeWay(savedContentRef.current, snapshot.content, content)
      if (outcome.conflict) {
        pendingDiskRef.current = content
        signalExternalChange('conflict')
        return
      }

      savedContentRef.current = content
      commit((prev) => ({
        ...prev,
        content: outcome.merged,
        dirty: outcome.merged !== content,
      }))
      signalExternalChange('merged')
    },
    [commit, signalExternalChange],
  )

  const resolveConflict = useCallback(
    (choice: 'mine' | 'theirs') => {
      const pending = pendingDiskRef.current
      clearExternalChange()
      // 'mine' just dismisses: the buffer already holds our version, and the
      // next save overwrites the file as it always has.
      if (choice !== 'theirs' || pending === null) return
      savedContentRef.current = pending
      commit((prev) => ({ ...prev, content: pending, dirty: false }))
    },
    [clearExternalChange, commit],
  )

  return {
    state,
    externalChange,
    setContent,
    adoptOpened,
    save,
    saveAs,
    applyExternalChange,
    resolveConflict,
    dismissExternalChange: clearExternalChange,
  }
}
