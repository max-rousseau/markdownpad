import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { rehypeTaskOffsets } from '@/lib/rehype-task-offsets'
import { MermaidBlock } from './mermaid-block'

interface PreviewProps {
  content: string
  onToggleTaskAt: (offset: number) => void
}

export function Preview({ content, onToggleTaskAt }: PreviewProps) {
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
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
