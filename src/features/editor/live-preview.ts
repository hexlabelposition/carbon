import { syntaxTree } from "@codemirror/language";
import type { EditorState, Line, Range } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";

/**
 * Live preview (ARCHITECTURE.md, section 8): the marks of Markdown are
 * hidden and only the formatting shows, except in the element the cursor is
 * in, which shows its raw Markdown so it can be edited.
 *
 * Covers headings, bold, italic, strikethrough, inline code, lists, task
 * checkboxes, quotes, horizontal rules and code blocks. Hiding is decoration only: the
 * text of the note changes only when the user types or ticks a task.
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
      padding: "1px 5px",
      border: "1px solid var(--cb-line)",
      borderRadius: "4px",
      backgroundColor: "var(--cb-code)",
      fontSize: "13px",
    },
    // A code block is drawn line by line: every line carries the sides of
    // the box, the first and the last one close it.
    ".cm-line.cm-code": {
      padding: "0 16px",
      borderLeft: "1px solid var(--cb-line)",
      borderRight: "1px solid var(--cb-line)",
      backgroundColor: "var(--cb-code)",
      fontFamily: "var(--font-mono)",
      fontSize: "13px",
      lineHeight: "1.6",
    },
    ".cm-line.cm-code-first": {
      borderTop: "1px solid var(--cb-line)",
      borderRadius: "6px 6px 0 0",
    },
    ".cm-line.cm-code-last": {
      borderBottom: "1px solid var(--cb-line)",
      borderRadius: "0 0 6px 6px",
    },
    ".cm-line.cm-code-first.cm-code-last": { borderRadius: "6px" },
    ".cm-code-language": {
      float: "right",
      fontFamily: "var(--font-sans)",
      fontSize: "11px",
      color: "var(--cb-faint)",
      userSelect: "none",
    },
    ".cm-bullet": { color: "var(--cb-faint)" },
    ".cm-task": {
      width: "14px",
      height: "14px",
      margin: "0",
      verticalAlign: "-2px",
      accentColor: "var(--cb-fg)",
      cursor: "pointer",
    },
    ".cm-task-done": {
      color: "var(--cb-faint)",
      textDecoration: "line-through",
    },
    ".cm-line.cm-quote": {
      paddingLeft: "16px",
      borderLeft: "2px solid var(--cb-line-strong)",
    },
    ".cm-rule": {
      display: "inline-block",
      width: "100%",
      borderTop: "1px solid var(--cb-line-strong)",
      verticalAlign: "middle",
    },
  }),
];

/** The dot shown in place of the "-", "*" or "+" of a list item. */
class BulletWidget extends WidgetType {
  toDOM(): HTMLElement {
    const bullet = document.createElement("span");
    bullet.className = "cm-bullet";
    bullet.textContent = "•";
    return bullet;
  }
}

/** The checkbox shown in place of the "[ ]" of a task. A click ticks it. */
class TaskWidget extends WidgetType {
  constructor(private readonly checked: boolean) {
    super();
  }

  eq(other: TaskWidget): boolean {
    return other.checked === this.checked;
  }

  toDOM(view: EditorView): HTMLElement {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.className = "cm-task";
    box.checked = this.checked;
    box.setAttribute("aria-label", "Task done");
    // On press, not on click: the press would otherwise move the cursor
    // next to the box first, which turns it back into "[ ]".
    box.addEventListener("mousedown", (event) => {
      event.preventDefault();
      const from = view.posAtDOM(box);
      const marker = view.state.sliceDoc(from, from + 3);
      if (!/^\[[ xX]\]$/.test(marker)) return;
      view.dispatch({
        changes: {
          from,
          to: from + 3,
          insert: marker === "[ ]" ? "[x]" : "[ ]",
        },
      });
    });
    return box;
  }
}

/** The name of the language, shown in place of the opening "```ts". */
class LanguageWidget extends WidgetType {
  constructor(private readonly language: string) {
    super();
  }

  eq(other: LanguageWidget): boolean {
    return other.language === this.language;
  }

  toDOM(): HTMLElement {
    const label = document.createElement("span");
    label.className = "cm-code-language";
    label.textContent = this.language;
    return label;
  }
}

/** The line shown in place of "---". */
class RuleWidget extends WidgetType {
  toDOM(): HTMLElement {
    const rule = document.createElement("span");
    rule.className = "cm-rule";
    return rule;
  }
}

const hide = Decoration.replace({});
const inlineCode = Decoration.mark({ class: "cm-inline-code" });
const bullet = Decoration.replace({ widget: new BulletWidget() });
const rule = Decoration.replace({ widget: new RuleWidget() });
const taskDone = Decoration.mark({ class: "cm-task-done" });
const quoteLine = Decoration.line({ class: "cm-quote" });
const language = (name: string) =>
  Decoration.replace({ widget: new LanguageWidget(name) });
const task = (checked: boolean) =>
  Decoration.replace({ widget: new TaskWidget(checked) });

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

  /** `at`, or one further if a space follows: the space after a mark. */
  const withSpace = (at: number) =>
    state.sliceDoc(at, at + 1) === " " ? at + 1 : at;

  /** A list item: a dot for "-", a checkbox for "- [ ]". */
  function decorateListMark(mark: SyntaxNode) {
    const item = mark.parent;
    const marker = item?.getChild("Task")?.getChild("TaskMarker");
    const bulleted = item?.parent?.name === "BulletList";
    if (!marker) {
      // The number of an ordered item is kept: it carries meaning.
      if (bulleted && !editing(mark.from, mark.to)) {
        ranges.push(bullet.range(mark.from, mark.to));
      }
      return;
    }
    const checked = state.sliceDoc(marker.from, marker.to) !== "[ ]";
    // A task is raw while the cursor is in its "- [ ]".
    if (!editing(mark.from, marker.to)) {
      if (bulleted) ranges.push(hide.range(mark.from, marker.from));
      ranges.push(task(checked).range(marker.from, marker.to));
    }
    const text = item?.getChild("Task");
    if (checked && text && marker.to < text.to) {
      ranges.push(taskDone.range(marker.to, text.to));
    }
  }

  // Where the previous visible range ended: an element that reaches into
  // the next one must not be decorated twice.
  let done = 0;
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter({ name, node }) {
        // Quotes and code blocks can be long: they are drawn line by line,
        // and only their lines in view are visited.
        const eachLineInView = (visit: (line: Line) => void) => {
          const last = Math.min(node.to, to);
          let line = state.doc.lineAt(Math.max(node.from, from, done));
          for (;;) {
            visit(line);
            if (line.to >= last) break;
            line = state.doc.line(line.number + 1);
          }
        };
        if (name === "Blockquote") {
          // Every line of the quote gets the bar on its left. A quote
          // inside a quote adds nothing, the outer one covers its lines.
          if (node.parent?.name === "Blockquote") return;
          eachLineInView((line) => ranges.push(quoteLine.range(line.from)));
          return;
        }
        if (name === "FencedCode") {
          const first = state.doc.lineAt(node.from);
          const end = state.doc.lineAt(node.to);
          eachLineInView((line) => {
            const edge =
              (line.number === first.number ? " cm-code-first" : "") +
              (line.number === end.number ? " cm-code-last" : "");
            ranges.push(
              Decoration.line({ class: `cm-code${edge}` }).range(line.from),
            );
          });
          if (node.from >= done && !editing(node.from, node.to)) {
            hideFences(state, node, ranges);
          }
          // Go on into the block: its code is highlighted by its language.
          return;
        }
        if (node.from < done) return;
        const onLine = () => {
          const line = state.doc.lineAt(node.from);
          return editing(line.from, line.to);
        };
        if (name === "QuoteMark") {
          if (!onLine()) ranges.push(hide.range(node.from, withSpace(node.to)));
        } else if (name === "HorizontalRule") {
          if (!onLine()) ranges.push(rule.range(node.from, node.to));
        } else if (name === "ListMark") {
          decorateListMark(node);
        }
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

/**
 * Hides the fences of a code block: the opening one shows the name of the
 * language instead, the closing one becomes the empty bottom of the box.
 */
function hideFences(
  state: EditorState,
  block: SyntaxNode,
  ranges: Range<Decoration>[],
): void {
  const marks = block.getChildren("CodeMark");
  const opening = marks[0];
  if (opening === undefined) return;
  const info = block.getChild("CodeInfo");
  const name = info === null ? "" : state.sliceDoc(info.from, info.to);
  // Up to the end of the line: the fence, the language and what follows.
  ranges.push(
    language(name).range(opening.from, state.doc.lineAt(opening.from).to),
  );
  // A block that is still being typed has no closing fence yet.
  const closing = marks[marks.length - 1];
  if (marks.length > 1 && closing.to === block.to) {
    ranges.push(hide.range(closing.from, closing.to));
  }
}
