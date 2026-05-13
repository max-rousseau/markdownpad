/**
 * Toggle the `[ ]`/`[x]` checkbox at or just after the given source offset.
 *
 * The offset is expected to point at the start of a list-item (the bullet
 * character). The checkbox always sits on that same line, immediately after
 * the bullet, so we look only within that line.
 *
 * Returns the new content. If no checkbox is found on that line, returns
 * the input unchanged.
 */
export function toggleTaskAt(content: string, offset: number): string {
  const lineEnd = content.indexOf('\n', offset)
  const window = content.slice(offset, lineEnd === -1 ? undefined : lineEnd)
  const match = /\[([ xX])\]/.exec(window)
  if (!match) return content
  const at = offset + match.index
  const flipped = match[1] === ' ' ? 'x' : ' '
  return `${content.slice(0, at + 1)}${flipped}${content.slice(at + 2)}`
}
