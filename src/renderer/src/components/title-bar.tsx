import { cn } from '@/lib/utils'

interface TitleBarProps {
  fileName: string | null
  dirty: boolean
}

export function TitleBar({ fileName, dirty }: TitleBarProps) {
  return (
    <div
      className={cn(
        'app-drag relative flex h-9 shrink-0 items-center border-b border-border bg-background',
        'select-none',
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 flex justify-center">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate">{fileName ?? 'Untitled'}</span>
          {dirty && (
            <span aria-label="Unsaved changes" className="text-foreground">
              •
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
