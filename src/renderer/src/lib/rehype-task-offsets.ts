// rehype plugin: copy each task-list <li>'s source offset onto its child
// <input type="checkbox"> as a `dataTaskOffset` property. The synthesized
// input from remark-gfm has no source position of its own, so without this
// the React layer can't tell which checkbox in the source it represents.

interface HastNode {
  type?: string
  tagName?: string
  position?: { start?: { offset?: number } }
  properties?: Record<string, unknown>
  children?: HastNode[]
}

export function rehypeTaskOffsets() {
  return (tree: HastNode): void => {
    walk(tree)
  }
}

function walk(node: HastNode): void {
  if (
    node.type === 'element' &&
    node.tagName === 'li' &&
    Array.isArray(node.properties?.className) &&
    (node.properties.className as unknown[]).includes('task-list-item') &&
    typeof node.position?.start?.offset === 'number'
  ) {
    const input = findFirstCheckbox(node)
    if (input) {
      input.properties = {
        ...(input.properties ?? {}),
        dataTaskOffset: node.position.start.offset,
      }
    }
  }
  if (node.children) {
    for (const child of node.children) walk(child)
  }
}

function findFirstCheckbox(node: HastNode): HastNode | null {
  if (
    node.type === 'element' &&
    node.tagName === 'input' &&
    node.properties?.type === 'checkbox'
  ) {
    return node
  }
  if (node.children) {
    for (const c of node.children) {
      const found = findFirstCheckbox(c)
      if (found) return found
    }
  }
  return null
}
