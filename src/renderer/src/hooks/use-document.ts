import { useCallback, useRef, useState } from 'react'

export interface DocumentState {
  path: string | null
  name: string
  content: string
  dirty: boolean
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

  const setContent = useCallback((next: string) => {
    setState((prev) => ({
      ...prev,
      content: next,
      dirty: next !== savedContentRef.current,
    }))
  }, [])

  const adoptOpened = useCallback(
    (file: { path: string; name: string; content: string }) => {
      savedContentRef.current = file.content
      setState({
        path: file.path,
        name: file.name,
        content: file.content,
        dirty: false,
      })
    },
    [],
  )

  const save = useCallback(async (): Promise<boolean> => {
    let succeeded = false
    // Snapshot inside the updater so we always act on the latest state, even
    // if multiple saves race or the caller invoked us right after a keystroke.
    const snapshot = await new Promise<DocumentState>((resolve) =>
      setState((prev) => {
        resolve(prev)
        return prev
      }),
    )

    if (snapshot.path) {
      await window.api.saveFile(snapshot.path, snapshot.content)
      savedContentRef.current = snapshot.content
      setState((prev) =>
        prev.content === snapshot.content ? { ...prev, dirty: false } : prev,
      )
      succeeded = true
    } else {
      const suggested = snapshot.name === UNTITLED_NAME ? 'Untitled.md' : snapshot.name
      const result = await window.api.saveFileAs(snapshot.content, suggested)
      if (result) {
        savedContentRef.current = result.content
        setState({
          path: result.path,
          name: result.name,
          content: result.content,
          dirty: false,
        })
        succeeded = true
      }
    }
    return succeeded
  }, [])

  const saveAs = useCallback(async (): Promise<boolean> => {
    const snapshot = await new Promise<DocumentState>((resolve) =>
      setState((prev) => {
        resolve(prev)
        return prev
      }),
    )
    const suggested = snapshot.name === UNTITLED_NAME ? 'Untitled.md' : snapshot.name
    const result = await window.api.saveFileAs(snapshot.content, suggested)
    if (!result) return false
    savedContentRef.current = result.content
    setState({
      path: result.path,
      name: result.name,
      content: result.content,
      dirty: false,
    })
    return true
  }, [])

  return {
    state,
    setContent,
    adoptOpened,
    save,
    saveAs,
  }
}
