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
import { isMissing, missingChanged } from "./missing-links";
import { t } from "../i18n/i18n";
import { noteSize } from "./editor-theme";
import { frontmatterEnd } from "./frontmatter-range";
import {
  CALLOUT_COLORS,
  CalloutHeaderWidget,
  type CalloutHeader,
  calloutColor,
  defaultCalloutTitle,
  parseCalloutHeader,
} from "./live-preview-callout";
import { codeBlockTheme, decorateCodeBlock } from "./live-preview-code";

/**
 * Live preview (ARCHITECTURE.md, section 8): the marks of Markdown are
 * hidden and only the formatting shows, except in the element the cursor is
 * in, which shows its raw Markdown so it can be edited.
 *
 * Covers headings, bold, italic, strikethrough, inline code, wiki links,
 * lists, task checkboxes, quotes, callouts, horizontal rules and code
 * blocks (`live-preview-code.ts`). Hiding is decoration only: the text of the note changes only
 * when the user types or ticks a task.
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
          missingChanged(update) ||
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
      fontSize: noteSize(13),
    },
    // A code block is drawn line by line: every line carries the sides of
    // the box, the first and the last one close it.
    ".cm-line.cm-code": {
      padding: "0 16px",
      borderLeft: "1px solid var(--cb-line)",
      borderRight: "1px solid var(--cb-line)",
      backgroundColor: "var(--cb-code)",
      fontFamily: "var(--cb-mono-font)",
      fontSize: noteSize(13),
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
    ".cm-bullet": { color: "var(--cb-faint)" },
    // As links are drawn in `styles/markdown.css`: a quiet line below,
    // dashed for a note that does not exist yet, so not by color alone.
    ".cm-wiki-link": {
      color: "var(--cb-link)",
      borderBottom: "1px solid var(--cb-line-strong)",
    },
    ".cm-wiki-link.cm-wiki-link-missing": { borderBottomStyle: "dashed" },
    // The colors reach the text inside too: the highlighting draws a link
    // in a span of its own, in the link color, inside or around this one.
    ".cm-wiki-link-missing, .cm-wiki-link-missing *": {
      color: "var(--cb-faint)",
    },
    ".cm-wiki-link:hover, .cm-wiki-link:hover *": { color: "var(--cb-fg)" },
    ".cm-wiki-link-separator": { color: "var(--cb-faint)" },
    // Drawn, not the box of the system: that one sits low and draws its
    // own coarse tick. One drawing for the box and the tick, so the tick
    // is in the middle at any zoom; whole sizes, nothing nudged, so it
    // sits the same on every line.
    ".cm-task": {
      display: "inline-block",
      width: "1em",
      height: "1em",
      lineHeight: "0",
      // Its middle on the middle of the lower-case letters.
      verticalAlign: "-0.15em",
      cursor: "pointer",
    },
    ".cm-task svg": { display: "block", width: "100%", height: "100%" },
    ".cm-task rect": {
      fill: "none",
      stroke: "var(--cb-faint)",
      strokeWidth: "1.5",
    },
    ".cm-task:hover rect": { stroke: "var(--cb-muted)" },
    ".cm-task-checked rect, .cm-task-checked:hover rect": {
      fill: "var(--cb-solid)",
      stroke: "var(--cb-solid)",
    },
    ".cm-task path": {
      fill: "none",
      stroke: "var(--cb-on-solid)",
      strokeWidth: "1.75",
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    ".cm-task-done": {
      color: "var(--cb-faint)",
      textDecoration: "line-through",
    },
    ".cm-line.cm-quote": {
      paddingLeft: "16px",
      borderLeft: "2px solid var(--cb-line-strong)",
      color: "var(--cb-muted)",
    },
    // A callout is drawn line by line too, as a rounded box tinted with
    // its color; the color comes from the class of its type.
    ".cm-line.cm-callout": {
      padding: "0 16px",
      backgroundColor:
        "color-mix(in srgb, var(--cb-callout) var(--cb-callout-tint), transparent)",
    },
    ".cm-line.cm-callout-first": {
      paddingTop: "8px",
      borderRadius: "8px 8px 0 0",
    },
    ".cm-line.cm-callout-last": {
      paddingBottom: "8px",
      borderRadius: "0 0 8px 8px",
    },
    ".cm-line.cm-callout-first.cm-callout-last": { borderRadius: "8px" },
    // Some room between the title and the body.
    ".cm-line.cm-callout-first:not(.cm-callout-last)": {
      paddingBottom: "6px",
    },
    ".cm-callout-title": { color: "var(--cb-callout)", fontWeight: "600" },
    // The icon of the type, centered on the line: its box is as tall as
    // the line and sits at its top, the drawing is in the middle of it.
    ".cm-callout-icon": {
      display: "inline-flex",
      alignItems: "center",
      height: "calc(var(--cb-note-line-height) * 1em)",
      verticalAlign: "top",
      marginRight: "0.45em",
      color: "var(--cb-callout)",
    },
    ".cm-callout-icon svg": {
      display: "block",
      width: "1.1em",
      height: "1.1em",
    },
    ...Object.fromEntries(
      CALLOUT_COLORS.map((color) => [
        `.cm-callout-${color}`,
        { "--cb-callout": `var(--cb-callout-${color})` },
      ]),
    ),
    ".cm-rule": {
      display: "inline-block",
      width: "100%",
      borderTop: "1px solid var(--cb-line-strong)",
      verticalAlign: "middle",
    },
  }),
  codeBlockTheme,
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
    const box = document.createElement("span");
    box.className = this.checked ? "cm-task cm-task-checked" : "cm-task";
    box.setAttribute("role", "checkbox");
    box.setAttribute("aria-checked", String(this.checked));
    box.setAttribute("aria-label", t("editor.taskDone"));
    // A 16 by 16 square; the tick is drawn around its middle, (8, 8).
    box.innerHTML =
      '<svg viewBox="0 0 16 16" aria-hidden="true">' +
      '<rect x="1" y="1" width="14" height="14" rx="3.5"/>' +
      (this.checked ? '<path d="M4.6 8.3l2.3 2.3 4.5-4.9"/>' : "") +
      "</svg>";
    // On press, not on click: the press would otherwise move the cursor
    // next to the box first, which turns it back into "[ ]". It works in
    // reading mode too: ticking a task is the one edit made while reading.
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

/** The " > " shown in place of the "#" between a note and its heading. */
class SeparatorWidget extends WidgetType {
  toDOM(): HTMLElement {
    const separator = document.createElement("span");
    separator.className = "cm-wiki-link-separator";
    separator.textContent = " > ";
    return separator;
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
const wikiLinkText = Decoration.mark({ class: "cm-wiki-link" });
const missingLinkText = Decoration.mark({
  class: "cm-wiki-link cm-wiki-link-missing",
});
const headingSeparator = Decoration.replace({ widget: new SeparatorWidget() });
const bullet = Decoration.replace({ widget: new BulletWidget() });
const rule = Decoration.replace({ widget: new RuleWidget() });
const taskDone = Decoration.mark({ class: "cm-task-done" });
const quoteLine = Decoration.line({ class: "cm-quote" });
const calloutTitle = Decoration.mark({ class: "cm-callout-title" });
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
      // From the first letter: the space after the box is not struck out.
      const after = state.sliceDoc(marker.to, text.to);
      const from = marker.to + (after.length - after.trimStart().length);
      if (from < text.to) ranges.push(taskDone.range(from, text.to));
    }
  }

  /**
   * The first line of a callout: "[!type]" becomes the icon of the type,
   * followed by the title, or by the type if there is no title.
   */
  function decorateCalloutHeader(
    line: Line,
    start: number,
    header: CalloutHeader,
  ) {
    const titleFrom = start + header.titleFrom;
    const titleTo = titleFrom + header.title.length;
    if (header.title !== "") {
      ranges.push(calloutTitle.range(titleFrom, titleTo));
    }
    if (editing(line.from, line.to)) return;
    const markerFrom = start + header.markerFrom;
    const titled = header.title !== "";
    const widget = new CalloutHeaderWidget(
      header.type,
      titled ? null : defaultCalloutTitle(header.type),
    );
    ranges.push(
      Decoration.replace({ widget }).range(
        markerFrom,
        titled ? titleFrom : line.to,
      ),
    );
  }

  // The frontmatter is YAML, not Markdown: `frontmatterPreview` draws it.
  const frontmatter = frontmatterEnd(state) ?? -1;
  // Where the previous visible range ended: an element that reaches into
  // the next one must not be decorated twice.
  let done = 0;
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter({ name, node }) {
        if (node.to <= frontmatter) return false;
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
          const first = state.doc.lineAt(node.from);
          const header = parseCalloutHeader(
            state.sliceDoc(node.from, first.to),
          );
          if (header === null) {
            eachLineInView((line) => ranges.push(quoteLine.range(line.from)));
            return;
          }
          const end = state.doc.lineAt(node.to);
          const box = `cm-callout cm-callout-${calloutColor(header.type)}`;
          eachLineInView((line) => {
            const edge =
              (line.number === first.number ? " cm-callout-first" : "") +
              (line.number === end.number ? " cm-callout-last" : "");
            ranges.push(
              Decoration.line({ class: box + edge }).range(line.from),
            );
            if (line.number === first.number) {
              decorateCalloutHeader(line, node.from, header);
            }
          });
          return;
        }
        if (name === "FencedCode") {
          decorateCodeBlock(state, node, ranges, editing, eachLineInView);
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
        } else if (name === "WikiLink") {
          if (!editing(node.from, node.to)) {
            decorateWikiLink(state, node, ranges);
          }
          return false;
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

/**
 * A wiki link shows what it reads as, like `wikiLinkLabel`: its alias, or
 * its note and heading as "Note > Heading". The rest of its Markdown is
 * hidden; the text that stays is the text of the note, so the cursor
 * moves through it as through any other word.
 */
function decorateWikiLink(
  state: EditorState,
  link: SyntaxNode,
  ranges: Range<Decoration>[],
): void {
  const target = link.getChild("WikiLinkTarget");
  const missing =
    target !== null &&
    isMissing(state, state.sliceDoc(target.from, target.to).trim());
  const text = missing ? missingLinkText : wikiLinkText;
  const alias = link.getChild("WikiLinkAlias");
  if (alias !== null && state.sliceDoc(alias.from, alias.to).trim() !== "") {
    ranges.push(
      hide.range(link.from, alias.from),
      text.range(alias.from, alias.to),
      hide.range(alias.to, link.to),
    );
    return;
  }
  const fragment = link.getChild("WikiLinkFragment");
  for (const part of [target, fragment]) {
    if (part !== null) ranges.push(text.range(part.from, part.to));
  }
  for (const mark of link.getChildren("WikiLinkMark")) {
    const between =
      target !== null &&
      fragment !== null &&
      mark.from === target.to &&
      mark.to === fragment.from;
    ranges.push((between ? headingSeparator : hide).range(mark.from, mark.to));
  }
  // A blank alias after "|": nothing to show.
  if (alias !== null) ranges.push(hide.range(alias.from, alias.to));
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
