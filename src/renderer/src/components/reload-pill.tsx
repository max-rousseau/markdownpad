import { useEffect } from 'react'
import type { ExternalChange } from '@/hooks/use-document'

// How long each transient notice stays up. A merge says more than a reload, so
// it gets longer to read.
const DISMISS_AFTER_MS: Record<'reloaded' | 'merged', number> = {
  reloaded: 2500,
  merged: 4000,
}

interface ReloadPillProps {
  change: ExternalChange | null
  onDismiss: () => void
  onResolve: (choice: 'mine' | 'theirs') => void
}

export function ReloadPill({ change, onDismiss, onResolve }: ReloadPillProps) {
  const transientDelay =
    change && change.kind !== 'conflict' ? DISMISS_AFTER_MS[change.kind] : null

  useEffect(() => {
    if (transientDelay === null) return
    const timer = setTimeout(onDismiss, transientDelay)
    return () => clearTimeout(timer)
    // change.seq re-arms the timer when the same kind fires again.
  }, [transientDelay, change?.seq, onDismiss])

  if (!change) return null

  if (change.kind === 'conflict') {
    return (
      <div className="reload-pill" role="status">
        <span>Changed on disk</span>
        <button type="button" className="reload-pill-action" onClick={() => onResolve('mine')}>
          Keep mine
        </button>
        <button type="button" className="reload-pill-action" onClick={() => onResolve('theirs')}>
          Take theirs
        </button>
      </div>
    )
  }

  return (
    // Keyed on seq so a repeat notice replays the fade instead of sitting still.
    <div
      key={change.seq}
      className="reload-pill reload-pill-transient"
      style={{ '--reload-pill-duration': `${transientDelay}ms` } as React.CSSProperties}
      role="status"
    >
      <span>
        {change.kind === 'reloaded' ? 'Updated from disk' : 'Merged changes from disk'}
      </span>
    </div>
  )
}
