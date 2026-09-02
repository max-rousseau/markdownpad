import { describe, expect, it } from 'vitest'
import { mergeThreeWay } from './merge'

const base = ['# Title', '', 'alpha', 'beta', 'gamma', ''].join('\n')

describe('mergeThreeWay', () => {
  it('combines edits that touch different lines', () => {
    const ours = ['# Title', '', 'alpha edited by me', 'beta', 'gamma', ''].join('\n')
    const theirs = ['# Title', '', 'alpha', 'beta', 'gamma edited on disk', ''].join('\n')

    const outcome = mergeThreeWay(base, ours, theirs)

    expect(outcome.conflict).toBe(false)
    expect(outcome.merged).toBe(
      ['# Title', '', 'alpha edited by me', 'beta', 'gamma edited on disk', ''].join('\n'),
    )
  })

  it('keeps a line only one side removed', () => {
    const ours = ['# Title', '', 'alpha', 'beta', 'gamma', 'delta', ''].join('\n')
    const theirs = ['# Title', '', 'alpha', 'gamma', ''].join('\n')

    const outcome = mergeThreeWay(base, ours, theirs)

    expect(outcome.conflict).toBe(false)
    expect(outcome.merged).toBe(['# Title', '', 'alpha', 'gamma', 'delta', ''].join('\n'))
  })

  it('reports a conflict when both sides rewrite the same line', () => {
    const ours = ['# Title', '', 'alpha mine', 'beta', 'gamma', ''].join('\n')
    const theirs = ['# Title', '', 'alpha theirs', 'beta', 'gamma', ''].join('\n')

    const outcome = mergeThreeWay(base, ours, theirs)

    expect(outcome.conflict).toBe(true)
    // The buffer is handed back untouched — nothing is guessed or spliced in.
    expect(outcome.merged).toBe(ours)
  })

  it('treats an identical edit on both sides as agreement', () => {
    const same = ['# Title', '', 'alpha agreed', 'beta', 'gamma', ''].join('\n')

    const outcome = mergeThreeWay(base, same, same)

    expect(outcome.conflict).toBe(false)
    expect(outcome.merged).toBe(same)
  })

  it('preserves a trailing newline', () => {
    const outcome = mergeThreeWay('a\n', 'a\nb\n', 'a\n')
    expect(outcome.merged).toBe('a\nb\n')
  })
})
