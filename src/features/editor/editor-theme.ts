import { HighlightStyle } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

/**
 * A size of the note text, given as it is at the default text size of
 * 15 pixels: it grows and shrinks with the size the settings set. Each is
 * worked out from the text size, not from its parent, so code inside a
 * heading or a table is not scaled twice.
 */
export function noteSize(pixels: number): string {
  return `calc(var(--cb-note-size) * ${+(pixels / 15).toFixed(4)})`;
}

/**
 * How the editor looks. Colors and fonts are the design tokens of
 * `styles/tokens.css`, read as CSS variables, so the editor follows the
 * theme without knowing which one is on. Sizes match `styles/markdown.css`.
 */
export const editorTheme = EditorView.theme({
  // The editor grows with its text; the element around it scrolls, so
  // the note name above the text scrolls with it. A short note still
  // fills the space, so a click below its text goes into it.
  "&": {
    flexGrow: "1",
    fontSize: "var(--cb-note-size)",
    color: "var(--cb-fg)",
    backgroundColor: "transparent",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "var(--cb-note-font)",
    lineHeight: "var(--cb-note-line-height)",
    overflow: "visible",
    flexGrow: "1",
    // Inter raises a bracket that follows a tall character such as "!".
    // The editor draws "![" and "]" as separate pieces, so only one of the
    // two brackets was raised and the pair looked crooked. Markdown is
    // shown as it is typed: no contextual alternates.
    fontVariantLigatures: "no-contextual",
  },
  // A readable column in the middle, under the note name; the space below
  // lets the last line be scrolled up from the bottom edge.
  ".cm-content": {
    boxSizing: "border-box",
    maxWidth: "var(--cb-note-width)",
    margin: "0 auto",
    padding: "12px 32px 40vh",
    caretColor: "var(--cb-fg)",
  },
  ".cm-line": { padding: "0" },
  ".cm-content ::selection": { backgroundColor: "var(--cb-selection)" },
});

/** Markdown highlighting: the text is styled, its marks are made quiet. */
export const markdownHighlight = HighlightStyle.define([
  {
    tag: tags.heading1,
    fontSize: noteSize(30),
    fontWeight: "600",
    lineHeight: "1.2",
    letterSpacing: "-0.02em",
  },
  {
    tag: tags.heading2,
    fontSize: noteSize(20),
    fontWeight: "600",
    lineHeight: "1.3",
    letterSpacing: "-0.01em",
  },
  { tag: tags.heading3, fontSize: noteSize(16), fontWeight: "600" },
  {
    tag: [tags.heading4, tags.heading5, tags.heading6],
    fontWeight: "600",
  },
  { tag: tags.strong, fontWeight: "600" },
  { tag: tags.emphasis, fontStyle: "italic" },
  {
    tag: tags.strikethrough,
    textDecoration: "line-through",
    color: "var(--cb-faint)",
  },
  { tag: tags.link, color: "var(--cb-link)" },
  // Tags, "#" included: a quiet chip.
  {
    tag: tags.special(tags.labelName),
    color: "var(--cb-link)",
    backgroundColor: "var(--cb-raise)",
    borderRadius: "4px",
    padding: "0 2px",
  },
  { tag: tags.url, color: "var(--cb-faint)" },
  // Inline code and code blocks; their size is set where they are drawn.
  { tag: tags.monospace, fontFamily: "var(--cb-mono-font)" },
  // The marks themselves: #, *, >, -, ``` and the like.
  {
    tag: [
      tags.processingInstruction,
      tags.meta,
      tags.contentSeparator,
      tags.labelName,
    ],
    color: "var(--cb-faint)",
  },
  // Code inside a block. Syntax highlighting stays monochrome, as in
  // `styles/markdown.css`: three greys and the link color.
  { tag: tags.comment, color: "var(--cb-faint)" },
  { tag: tags.keyword, color: "var(--cb-muted)" },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--cb-link)" },
]);

/**
 * Source mode only: the text of a quote is quiet. Live preview colors
 * quotes by their lines instead, so a callout, which is a quote too, keeps
 * the color of the text.
 */
export const sourceHighlight = HighlightStyle.define([
  { tag: tags.quote, color: "var(--cb-muted)" },
]);
