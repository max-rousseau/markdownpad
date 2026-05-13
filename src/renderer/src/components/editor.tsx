import { useMemo, useRef } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'

interface EditorProps {
  value: string
  onChange: (next: string) => void
  theme: 'light' | 'dark'
}

export function Editor({ value, onChange, theme }: EditorProps) {
  const ref = useRef<ReactCodeMirrorRef>(null)

  const extensions = useMemo(
    () => [
      markdown({ base: markdownLanguage, codeLanguages: [] }),
      EditorView.lineWrapping,
      EditorView.theme(
        {
          '&': { color: 'var(--color-foreground)' },
          '.cm-gutters': {
            backgroundColor: 'transparent',
            color: 'var(--color-muted-foreground)',
            border: 'none',
          },
          '.cm-activeLine': { backgroundColor: 'transparent' },
          '.cm-activeLineGutter': { backgroundColor: 'transparent' },
          '.cm-selectionBackground, .cm-content ::selection': {
            backgroundColor: 'var(--color-accent) !important',
          },
        },
        { dark: theme === 'dark' },
      ),
    ],
    [theme],
  )

  return (
    <CodeMirror
      ref={ref}
      value={value}
      onChange={onChange}
      extensions={extensions}
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
      }}
      theme={theme}
      className="h-full w-full"
    />
  )
}
