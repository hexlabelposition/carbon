import { HighlightStyle } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

/**
 * How the editor looks. Colors and fonts are the design tokens of
 * `styles/tokens.css`, read as CSS variables, so the editor follows the
 * theme without knowing which one is on. Sizes match `styles/markdown.css`.
 */
export const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "15px",
    color: "var(--cb-fg)",
    backgroundColor: "transparent",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "var(--font-sans)",
    lineHeight: "1.65",
    overflow: "auto",
  },
  // A readable column in the middle; the space below lets the last line
  // be scrolled up from the bottom edge.
  ".cm-content": {
    boxSizing: "border-box",
    maxWidth: "784px",
    margin: "0 auto",
    padding: "32px 32px 40vh",
    caretColor: "var(--cb-fg)",
  },
  ".cm-line": { padding: "0" },
  ".cm-content ::selection": { backgroundColor: "var(--cb-highlight)" },
});

/** Markdown highlighting: the text is styled, its marks are made quiet. */
export const markdownHighlight = HighlightStyle.define([
  {
    tag: tags.heading1,
    fontSize: "30px",
    fontWeight: "600",
    lineHeight: "1.2",
    letterSpacing: "-0.02em",
  },
  {
    tag: tags.heading2,
    fontSize: "20px",
    fontWeight: "600",
    lineHeight: "1.3",
    letterSpacing: "-0.01em",
  },
  { tag: tags.heading3, fontSize: "16px", fontWeight: "600" },
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
  { tag: tags.url, color: "var(--cb-faint)" },
  // Inline code and code blocks; their size is set where they are drawn.
  { tag: tags.monospace, fontFamily: "var(--font-mono)" },
  { tag: tags.quote, color: "var(--cb-muted)" },
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
