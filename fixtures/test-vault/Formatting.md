# Heading 1

## Heading 2

### Heading 3

#### Heading 4

##### Heading 5

###### Heading 6

Plain text, **bold**, *italic*, ***bold italic***, ~~struck through~~, `inline code`, and ==not a highlight in GFM==.

A line with a hard break at its end  
continues here. A very long line goes on and on so that it has to wrap at the edge of the column of text, which is where soft wrapping shows whether the indent and the cursor stay right.

## Lists

- An item
- An item with **bold** in it
  - A nested item
    - Nested once more
- Back at the top

1. First
2. Second
   1. Second, first
   2. Second, second
3. Third

## Tasks

- [ ] Not done yet
- [x] Done
- [ ] A task with a [[Links|link]] and `code`
  - [ ] A nested task

## Quotes

> A quote on one line.

> A quote that goes on for long enough to wrap onto a second line, with **bold** and *italic* inside it.
>
> And a second paragraph in the same quote.

## Code

```ts
// TypeScript
interface Note {
  path: string;
  title: string;
}

export function titleOf(note: Note): string {
  return note.title || note.path.replace(/\.md$/, "");
}
```

```python
def fib(n: int) -> int:
    return n if n < 2 else fib(n - 1) + fib(n - 2)
```

```
A block with no language.
    Indented by four spaces inside.
```

## Tables

| Left | Center | Right |
| :--- | :----: | ----: |
| a | b | c |
| a longer cell | **bold** | `code` |
| [[Links]] | ~~old~~ | 12.50 |

| A table with one column |
| --- |
| only |

---

Text after a rule.
