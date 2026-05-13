import { describe, it, expect } from 'vitest'
import { toggleTaskAt } from './markdown'

describe('toggleTaskAt', () => {
  it('flips an unchecked box to checked at the given list-item offset', () => {
    const src = '- [ ] hello\n- [ ] world\n'
    // offset of the second list item starts at the second `-`
    const offset = src.indexOf('- [ ] world')
    expect(toggleTaskAt(src, offset)).toBe('- [ ] hello\n- [x] world\n')
  })

  it('flips a checked box back to unchecked', () => {
    const src = '- [x] done\n'
    expect(toggleTaskAt(src, 0)).toBe('- [ ] done\n')
  })

  it('handles uppercase X by normalizing to lowercase space', () => {
    const src = '- [X] done\n'
    expect(toggleTaskAt(src, 0)).toBe('- [ ] done\n')
  })

  it('only mutates the line at offset — content above and below is untouched', () => {
    const src = [
      'header',
      '',
      '- [ ] one',
      '- [ ] two',
      '- [ ] three',
      '',
      'footer',
    ].join('\n')
    const offset = src.indexOf('- [ ] two')
    const next = toggleTaskAt(src, offset)
    expect(next).toBe(
      [
        'header',
        '',
        '- [ ] one',
        '- [x] two',
        '- [ ] three',
        '',
        'footer',
      ].join('\n'),
    )
  })

  it('returns the input unchanged when there is no checkbox on the line at offset', () => {
    const src = 'plain paragraph\n- [ ] real task\n'
    expect(toggleTaskAt(src, 0)).toBe(src)
  })

  it('handles the last line (no trailing newline)', () => {
    const src = '- [ ] last'
    expect(toggleTaskAt(src, 0)).toBe('- [x] last')
  })

  it('handles indented (nested) task items', () => {
    const src = '- top\n  - [ ] nested\n'
    const offset = src.indexOf('- [ ] nested')
    expect(toggleTaskAt(src, offset)).toBe('- top\n  - [x] nested\n')
  })
})
