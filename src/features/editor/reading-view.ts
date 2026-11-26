import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { blockId, hashtag, wikiLink } from "@carbon/core";
import { codeLanguage } from "./code-languages";
import { editorTheme, markdownHighlight } from "./editor-theme";
import { listHangingIndent } from "./list-hanging-indent";
import { livePreview } from "./live-preview";
import { imageHost, imagePreview, type ImageHost } from "./live-preview-image";
import { tablePreview } from "./live-preview-table";
import { webLinkStyle } from "./web-link";

/**
 * An editor that shows a piece of another note as reading mode draws it:
 * the same grammar and live preview as a tab, nothing typed, for a link
 * preview and an embed. It has no link host, so its links are neither
 * followed nor previewed, and its own embeds are left as links: a note
 * that embeds itself does not go on forever.
 */
export function readingView(
  parent: HTMLElement,
  text: string,
  images: ImageHost | null,
): EditorView {
  return new EditorView({
    parent,
    state: EditorState.create({
      doc: text,
      extensions: [
        EditorView.lineWrapping,
        markdown({
          base: markdownLanguage,
          codeLanguages: codeLanguage,
          extensions: [wikiLink, hashtag, blockId],
        }),
        syntaxHighlighting(markdownHighlight),
        livePreview,
        webLinkStyle,
        tablePreview,
        imagePreview,
        images === null ? [] : imageHost.of(images),
        listHangingIndent,
        editorTheme,
        readingTheme,
        EditorView.editorAttributes.of({ class: "cm-reading-view" }),
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
      ],
    }),
  });
}

/** Shows `text` in a view made by `readingView`, if it is new. */
export function setReadingText(view: EditorView, text: string): void {
  if (view.state.doc.toString() === text) return;
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
  });
}

/**
 * The editor theme is made for a tab, with a column in the middle and room
 * below the text; inside a box the text fills it. More specific than
 * `editorTheme`, which these rules override.
 */
const readingTheme = EditorView.baseTheme({
  "&.cm-reading-view": { flexGrow: "0", flexShrink: "0" },
  ".cm-reading-view .cm-content": {
    maxWidth: "none",
    margin: "0",
    padding: "0",
  },
});
