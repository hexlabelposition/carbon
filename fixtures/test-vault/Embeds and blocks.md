# Embeds and blocks

## Embeds

A whole note, drawn in place:

![[Deep note]]

The section of one heading, up to the next heading of its level:

![[Formatting#Tables]]

One block of this note, by its id:

![[#^definition]]

A note that does not exist, and a file that is not a note:

![[Not written yet]]

![[data.json]]

An embed of this note itself shows its own embeds as links, so it does not go on forever:

![[Embeds and blocks#Blocks]]

## Blocks

An API is a set of rules that lets one program use another without knowing how it works inside. ^definition

- A list item with an id names the item and the items under it ^list-item
  - nested one
  - nested two
- An item without an id

> A quote is named by an id on the line under it.
> It can be a callout too.
^quote

| Name | Kind  |
| ---- | ----- |
| API  | rules |
^table

```js
console.log("a code block, named the same way");
```

^code

Not ids: x^2^ is superscript, a ^word in the middle of a line is text, and so is word^caret.

## Links to blocks

- To a paragraph: [[#^definition]]
- To a list item: [[#^list-item]]
- To a quote: [[#^quote]]
- To a table: [[#^table]]
- To a code block: [[#^code]]
- To a block of another note: [[Long note#^last]]
- To an id no block has: [[#^missing]]

Type `[[Formatting#^` to pick a block of another note: one without an id gets one written into that note.
