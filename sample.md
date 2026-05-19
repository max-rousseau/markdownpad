# sample.md

A test document for **markdownpad**. Right-click the pane to switch between edit and view modes.

## Inline formatting

This paragraph mixes *italic*, **bold**, ***bold italic***, `inline code`, ~~strikethrough~~, and a [link to anthropic](https://www.anthropic.com). Here's a footnote-style reference for keyboard shortcuts: try `⇧⌘P`.

Hard line break below this line.
And a soft wrap continues this sentence on the next visual row when the window is narrow enough — markdown joins it into one paragraph.

---

## Headings

# H1 — Largest
## H2 — Section
### H3 — Subsection
#### H4 — Sub-subsection
##### H5
###### H6

## Lists

Unordered:

- First item
- Second item
  - Nested child
  - Another nested child
    - Deeper still
- Third item

Ordered:

1. Wake up
2. Open markdownpad
3. Write something
4. Save with `⌘S`

Task list (GFM):

- [x] Wire up CodeMirror
- [x] Render mermaid diagrams
- [ ] Add syntax highlighting to code blocks
- [ ] Add a settings pane

## Blockquotes

> A quote on its own line.
>
> > Nested quotes are a thing.
> > They cascade visually.
>
> Back to the outer quote.

## Tables

| Shortcut | Action          | Notes                                |
| -------- | --------------- | ------------------------------------ |
| `⌘N`     | New file        | Discards current with confirmation   |
| `⌘O`     | Open…           | `.md` and `.markdown` filters        |
| `⌘S`     | Save            | Falls back to Save As if untitled    |
| `⇧⌘S`    | Save As…        | Always prompts for path              |
| `⇧⌘P`    | Toggle view     | Same as right-click on the pane      |

Alignment:

| Left  | Center | Right |
| :---- | :----: | ----: |
| a     |   b    |     c |
| 1     |   22   |   333 |

## Code blocks

Plain (no language):

```
echo "no language tag — plain block"
```

Bash:

```bash
#!/usr/bin/env bash
set -euo pipefail
for f in *.md; do
  printf "found: %s\n" "$f"
done
```

TypeScript:

```ts
type Mode = 'edit' | 'view'

function toggle(m: Mode): Mode {
  return m === 'edit' ? 'view' : 'edit'
}
```

Python:

```python
def fib(n: int) -> int:
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a

print([fib(i) for i in range(10)])
```

JSON:

```json
{
  "name": "markdownpad",
  "version": "0.1.0",
  "license": "BSD-3-Clause"
}
```

## Mermaid diagrams

### Flowchart

```mermaid
flowchart LR
    A[Open file] --> B{Edit?}
    B -- Yes --> C[Modify content]
    B -- No --> D[View only]
    C --> E{Save?}
    E -- ⌘S --> F[Write to disk]
    E -- Discard --> A
    F --> G([Saved])
```

### Sequence diagram

```mermaid
sequenceDiagram
    actor User
    participant App as Renderer
    participant Main as Main Process
    participant FS as Filesystem

    User->>App: ⌘O
    App->>Main: ipc "file:open"
    Main->>User: Open dialog
    User-->>Main: picks file.md
    Main->>FS: readFile(path)
    FS-->>Main: contents
    Main-->>App: { path, name, content }
    App->>User: editor populated
```

### Class diagram

```mermaid
classDiagram
    class Document {
        +string? path
        +string name
        +string content
        +bool dirty
        +setContent(next)
        +save()
        +saveAs()
    }
    class Editor {
        +value: string
        +onChange(next)
    }
    class Preview {
        +content: string
        +renderMermaid()
    }
    class App {
        +mode: 'edit' | 'view'
        +toggleMode()
    }
    App --> Document : owns
    App --> Editor : when mode=edit
    App --> Preview : when mode=view
```

### State diagram

```mermaid
stateDiagram-v2
    [*] --> Edit
    Edit --> View : right-click / ⇧⌘P
    View --> Edit : right-click / ⇧⌘P
    Edit --> Edit : type
    Edit --> Saving : ⌘S
    Saving --> Edit : success
    Saving --> Edit : cancelled
```

### Pie chart

```mermaid
pie showData
    title Time spent in markdownpad
    "Editing" : 70
    "Previewing" : 20
    "Staring at the cursor" : 10
```

### Entity-relationship diagram

```mermaid
erDiagram
    DOCUMENT ||--o{ REVISION : has
    DOCUMENT {
        string path PK
        string name
        datetime modified
    }
    REVISION {
        int id PK
        string content
        datetime created_at
    }
```

### Gantt

```mermaid
gantt
    title markdownpad — milestones
    dateFormat YYYY-MM-DD
    section Core
    Scaffold project       :done,    a1, 2026-05-09, 1d
    Editor + preview       :done,    a2, 2026-05-09, 1d
    Mermaid integration    :done,    a3, 2026-05-09, 1d
    section Polish
    Settings pane          :         b1, 2026-05-15, 3d
    App icon               :         b2, after b1, 2d
    Code signing           :         b3, after b2, 1d
```

## Images

Relative path (resolves against the markdown file's directory):

![Edit mode screenshot](docs/screenshots/edit.png)

External HTTPS URL (requires network):

![Hosted on GitHub Pages](https://max-rousseau.github.io/markdownpad/screenshots/edit.png)

Missing image (broken-image fallback):

![Image that does not exist](does-not-exist.png)

Inline image in a sentence: here is a small icon ![icon](docs/screenshots/edit.png) sitting in flow.

## Edge cases

Empty heading anchor target:

###

A paragraph with **bold _and italic_ inside** plus a `code span containing | a pipe` and an inline image emoji-like marker (no actual image to keep the test self-contained).

A line with just text, immediately followed by a list:

- continues
- without a blank line — most renderers tolerate this

Escaped characters: \* not italic \*, \`not code\`, \\ literal backslash.

---

End of sample.
