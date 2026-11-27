# Writing

Carbon writes plain Markdown. In live preview the marks hide once the cursor leaves them: put the cursor on a line to see what it is made of.

## Text

**Bold**, _italic_, ~~struck through~~, `inline code` and [a link to the web](https://commonmark.org).

The keyboard button above the note opens the formatting bar: select some text and press a button to mark it.

## Lists and tasks

- A list item
- Another one
  - Tab nests an item, Shift+Tab takes it back
- Enter on an empty item ends the list

1. Numbered lists
2. count themselves

- [x] Read the welcome note
- [ ] Click a checkbox to tick it
- [ ] Write a note of your own

## Quotes and callouts

> A quote is a line that starts with `>`.

> [!note]
> A callout is a quote with a type in brackets on its first line.

> [!warning] Mind the title
> It may have a title of its own, and any text inside.

## Code

```ts
function greet(name: string): string {
  return `Hello, ${name}!`;
}
```

## Tables

| Shortcut | What it does  |
| -------- | ------------- |
| Ctrl+O   | Open a note   |
| Ctrl+P   | Every command |
| Ctrl+E   | Reading mode  |

---

Next: [[Linking notes]].
