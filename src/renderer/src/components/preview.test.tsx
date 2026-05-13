import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Preview } from './preview'

// MermaidBlock lazily imports/initializes a heavy WASM-using library.
// Stub it for tests — preview tests don't exercise diagram rendering.
vi.mock('./mermaid-block', () => ({
  MermaidBlock: ({ source }: { source: string }) => <pre data-testid="mermaid-stub">{source}</pre>,
}))

describe('<Preview />', () => {
  it('renders one checkbox per task-list item, in document order', () => {
    const content = '- [x] one\n- [x] two\n- [ ] three\n- [ ] four\n'
    render(<Preview content={content} onToggleTaskAt={() => {}} />)
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(4)
    expect((boxes[0] as HTMLInputElement).checked).toBe(true)
    expect((boxes[1] as HTMLInputElement).checked).toBe(true)
    expect((boxes[2] as HTMLInputElement).checked).toBe(false)
    expect((boxes[3] as HTMLInputElement).checked).toBe(false)
  })

  it('clicking the Nth checkbox calls onToggleTaskAt with the offset of the Nth task in source', async () => {
    const user = userEvent.setup()
    const content = '- [x] one\n- [x] two\n- [ ] three\n- [ ] four\n'
    const onToggle = vi.fn()

    render(<Preview content={content} onToggleTaskAt={onToggle} />)
    const boxes = screen.getAllByRole('checkbox')

    // Click the third checkbox — the previous off-by-one bug toggled the wrong one.
    await user.click(boxes[2])
    expect(onToggle).toHaveBeenCalledTimes(1)

    const offset = onToggle.mock.calls[0][0] as number
    const lineEnd = content.indexOf('\n', offset)
    expect(content.slice(offset, lineEnd)).toBe('- [ ] three')
  })

  it('does not generate a checkbox for [ ] sequences inside fenced code blocks', () => {
    const content = [
      '- [x] real',
      '',
      '```md',
      '- [ ] not a task',
      '```',
      '',
      '- [ ] also real',
    ].join('\n')
    render(<Preview content={content} onToggleTaskAt={() => {}} />)
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
  })

  it('clicking each of N task checkboxes invokes the toggler with N distinct offsets matching source order', async () => {
    const user = userEvent.setup()
    const content = '- [x] alpha\n- [x] beta\n- [ ] gamma\n- [ ] delta\n'
    const onToggle = vi.fn()
    render(<Preview content={content} onToggleTaskAt={onToggle} />)

    const boxes = screen.getAllByRole('checkbox')
    for (const box of boxes) await user.click(box)

    expect(onToggle).toHaveBeenCalledTimes(4)
    const offsets = onToggle.mock.calls.map((call) => call[0] as number)
    // Offsets must be strictly increasing (one per source task in source order).
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b))
    expect(new Set(offsets).size).toBe(offsets.length)

    // And each offset's line should contain the matching task label.
    const labels = ['alpha', 'beta', 'gamma', 'delta']
    offsets.forEach((offset, i) => {
      const lineEnd = content.indexOf('\n', offset)
      expect(content.slice(offset, lineEnd)).toContain(labels[i])
    })
  })
})
