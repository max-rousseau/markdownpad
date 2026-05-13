import { describe, it, expect } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import { rehypeTaskOffsets } from './rehype-task-offsets'

interface HastNode {
  type?: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

function transform(source: string): HastNode {
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeTaskOffsets)
  const parsed = processor.parse(source)
  return processor.runSync(parsed) as unknown as HastNode
}

function collectCheckboxInputs(tree: HastNode): HastNode[] {
  const out: HastNode[] = []
  const walk = (n: HastNode) => {
    if (
      n.type === 'element' &&
      n.tagName === 'input' &&
      n.properties?.type === 'checkbox'
    ) {
      out.push(n)
    }
    if (n.children) for (const c of n.children) walk(c)
  }
  walk(tree)
  return out
}

describe('rehypeTaskOffsets', () => {
  it('attaches dataTaskOffset to every task-list checkbox', () => {
    const src = '- [x] one\n- [ ] two\n- [ ] three\n'
    const inputs = collectCheckboxInputs(transform(src))
    expect(inputs).toHaveLength(3)
    for (const input of inputs) {
      expect(typeof input.properties?.dataTaskOffset).toBe('number')
    }
  })

  it('points each offset at the bullet so the next [ ]/[x] on that line is the right checkbox', () => {
    const src = '- [x] alpha\n- [ ] beta\n- [ ] gamma\n'
    const inputs = collectCheckboxInputs(transform(src))
    const expected = ['x', ' ', ' ']
    inputs.forEach((input, i) => {
      const offset = input.properties?.dataTaskOffset as number
      const lineEnd = src.indexOf('\n', offset)
      const window = src.slice(offset, lineEnd === -1 ? undefined : lineEnd)
      const m = /\[([ xX])\]/.exec(window)
      expect(m, `input #${i} window had no checkbox: ${window}`).not.toBeNull()
      expect(m![1]).toBe(expected[i])
    })
  })

  it('does not attach offsets to inputs inside fenced code blocks (which never become real tasks)', () => {
    const src = [
      '- [x] real one',
      '',
      '```md',
      '- [ ] not a task — inside a code fence',
      '- [x] also not',
      '```',
      '',
      '- [ ] real two',
    ].join('\n')
    const inputs = collectCheckboxInputs(transform(src))
    // Only the two real task items should produce input elements.
    expect(inputs).toHaveLength(2)
    expect(typeof inputs[0].properties?.dataTaskOffset).toBe('number')
    expect(typeof inputs[1].properties?.dataTaskOffset).toBe('number')
  })

  it('handles nested task items — offset lands on the bullet, not line start', () => {
    const src = '- top\n  - [ ] nested\n'
    const inputs = collectCheckboxInputs(transform(src))
    expect(inputs).toHaveLength(1)
    const offset = inputs[0].properties?.dataTaskOffset as number
    // mdast returns the offset of the `-` character itself for indented items.
    // toggleTaskAt only needs to find a `[ ]`/`[x]` later on the same line, so
    // pointing at the bullet (rather than line start) is sufficient and correct.
    const lineEnd = src.indexOf('\n', offset)
    expect(src.slice(offset, lineEnd)).toBe('- [ ] nested')
  })
})
