import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

let nextId = 0

interface MermaidBlockProps {
  source: string
}

export function MermaidBlock({ source }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const idRef = useRef(`mermaid-${++nextId}`)

  useEffect(() => {
    let cancelled = false
    const trimmed = source.trim()
    if (!trimmed) {
      setError(null)
      if (containerRef.current) containerRef.current.innerHTML = ''
      return
    }

    mermaid
      .render(idRef.current, trimmed)
      .then(({ svg, bindFunctions }) => {
        if (cancelled || !containerRef.current) return
        containerRef.current.innerHTML = svg
        if (bindFunctions) bindFunctions(containerRef.current)
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
      })

    return () => {
      cancelled = true
    }
  }, [source])

  if (error) {
    return (
      <div className="mermaid-block">
        <pre className="mermaid-error">Mermaid render error:{'\n'}{error}</pre>
      </div>
    )
  }

  return <div ref={containerRef} className="mermaid-block" />
}
