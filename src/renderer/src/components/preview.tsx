import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { rehypeTaskOffsets } from '@/lib/rehype-task-offsets'
import { MermaidBlock } from './mermaid-block'

interface PreviewProps {
  content: string
  docPath: string | null
  onToggleTaskAt: (offset: number) => void
}

function dirname(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx <= 0 ? '/' : path.slice(0, idx)
}

// Rewrite relative <img src> values against the open document's directory so
// `images/foo.png` resolves to `file:///abs/path/to/dir/images/foo.png`. Leaves
// URLs that already have a scheme untouched.
function resolveImageSrc(src: string, docDir: string | null): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return src
  if (!docDir) return src
  try {
    const base = `file://${docDir.endsWith('/') ? docDir : docDir + '/'}`
    return new URL(src, base).toString()
  } catch {
    return src
  }
}

export function Preview({ content, docPath, onToggleTaskAt }: PreviewProps) {
  const docDir = docPath ? dirname(docPath) : null

  const urlTransform = (url: string, key: string): string | undefined => {
    if (key === 'src') return resolveImageSrc(url, docDir)
    return defaultUrlTransform(url)
  }

  const components: Components = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className ?? '')
      const lang = match?.[1]
      const source = String(children ?? '').replace(/\n$/, '')

      if (lang === 'mermaid') {
        return <MermaidBlock source={source} />
      }

      return (
        <code className={className} {...props}>
          {children}
        </code>
      )
    },
    a({ href, children, ...props }) {
      return (
        <a href={href} target="_blank" rel="noreferrer noopener" {...props}>
          {children}
        </a>
      )
    },
    input({ type, checked, node, ...props }) {
      if (type === 'checkbox') {
        const raw = (node?.properties as Record<string, unknown> | undefined)?.dataTaskOffset
        const offset = typeof raw === 'number' ? raw : Number(raw)
        return (
          <input
            type="checkbox"
            checked={!!checked}
            onChange={() => {
              if (Number.isFinite(offset)) onToggleTaskAt(offset)
            }}
          />
        )
      }
      return <input type={type} checked={checked} {...props} />
    },
  }

  return (
    <div className="markdown-preview h-full w-full overflow-auto">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeTaskOffsets,
          [rehypeHighlight, { detect: true, ignoreMissing: true }],
        ]}
        urlTransform={urlTransform}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
