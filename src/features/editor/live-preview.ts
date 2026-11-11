import { syntaxTree } from "@codemirror/language";
import type { EditorState, Range } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";

/**
 * Live preview (ARCHITECTURE.md, section 8): the marks of Markdown are
 * hidden and only the formatting shows, except in the element the cursor is
 * in, which shows its raw Markdown so it can be edited.
 *
 * Covers headings, bold, italic, strikethrough and inline code. The text of
 * the note is never changed: hiding is decoration only.
 */
export const livePreview = [
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = decorate(view);
      }

      update(update: ViewUpdate) {
        const changed =
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet ||
          update.focusChanged ||
          // Parsing a long note finishes in the background.
          syntaxTree(update.startState) !== syntaxTree(update.state);
        if (changed) this.decorations = decorate(update.view);
      }
    },
    { decorations: (plugin) => plugin.decorations },
  ),
  EditorView.baseTheme({
    ".cm-inline-code": {
      padding: "1px 4px",
      borderRadius: "4px",
      backgroundColor: "var(--cb-code)",
    },
  }),
];

const hide = Decoration.replace({});
const inlineCode = Decoration.mark({ class: "cm-inline-code" });

/** Inline elements and the name of the marks around their text. */
const INLINE_MARKS: Record<string, string> = {
  Emphasis: "EmphasisMark",
  StrongEmphasis: "EmphasisMark",
  Strikethrough: "StrikethroughMark",
  InlineCode: "CodeMark",
};

function decorate(view: EditorView): DecorationSet {
  const { state } = view;
  const ranges: Range<Decoration>[] = [];
  // Without the focus there is no cursor to edit at: everything is preview.
  const editing = (from: number, to: number) =>
    view.hasFocus &&
    state.selection.ranges.some(
      (range) => range.from <= to && range.to >= from,
    );

  // Where the previous visible range ended: an element that reaches into
  // the next one must not be decorated twice.
  let done = 0;
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter({ name, node }) {
        if (node.from < done) return;
        if (name === "InlineCode") {
          ranges.push(inlineCode.range(node.from, node.to));
        }
        if (/^ATXHeading[1-6]$/.test(name)) {
          // A heading is edited anywhere on its line, also before the "#".
          const line = state.doc.lineAt(node.from);
          if (!editing(line.from, line.to))
            hideHeadingMarks(state, node, ranges);
        } else if (name in INLINE_MARKS && !editing(node.from, node.to)) {
          for (const mark of node.getChildren(INLINE_MARKS[name])) {
            ranges.push(hide.range(mark.from, mark.to));
          }
        }
      },
    });
    done = to;
  }
  return Decoration.set(ranges, true);
}

/** Hides the "#" marks of a heading with the spaces that go with them. */
function hideHeadingMarks(
  state: EditorState,
  heading: SyntaxNode,
  ranges: Range<Decoration>[],
): void {
  for (const mark of heading.getChildren("HeaderMark")) {
    let { from, to } = mark;
    const isSpace = (at: number) => state.doc.sliceString(at, at + 1) === " ";
    if (from === heading.from) {
      // The opening marks: "## " before the text.
      while (to < heading.to && isSpace(to)) to++;
    } else {
      // Closing marks, as in "## Title ##".
      while (from > heading.from && isSpace(from - 1)) from--;
    }
    ranges.push(hide.range(from, to));
  }
}
