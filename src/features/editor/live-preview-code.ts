import type { EditorState, Line, Range } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { t } from "../i18n/i18n";
import { noteSize } from "./editor-theme";
import {
  characterCount,
  codeKind,
  parseCodeInfo,
  readCodeLine,
  summarizeCode,
  type CodeInfo,
  type CodeKind,
  type CodeSummary,
  type LineMark,
} from "./code-block";

/**
 * Code blocks in live preview (ARCHITECTURE.md, section 8): the opening
 * fence becomes a header with the extension, the file and the language,
 * the lines get numbers and their marks (highlighted, added, removed), the
 * closing fence becomes a footer with line and character counts. What the fence
 * can say is in `code-block.ts`.
 *
 * While the cursor is in the block, its fences, diff marks and
 * `[!code ...]` notes show as written; the numbers and the colors of the
 * lines stay, so the block does not jump.
 */

/** Shown in place of the opening fence: the extension, the file and the language. */
class CodeHeaderWidget extends WidgetType {
  constructor(
    private readonly kind: CodeKind,
    private readonly file: string,
  ) {
    super();
  }

  eq(other: CodeHeaderWidget): boolean {
    return (
      other.kind.ext === this.kind.ext &&
      other.kind.name === this.kind.name &&
      other.file === this.file
    );
  }

  toDOM(): HTMLElement {
    const header = document.createElement("span");
    header.className = "cm-code-header";

    const badge = document.createElement("span");
    badge.className = "cm-code-badge";
    badge.textContent = `.${this.kind.ext}`;
    header.append(badge);

    const file = document.createElement("span");
    file.className = "cm-code-file";
    if (this.file !== "") {
      file.title = this.file;
      const slash = this.file.lastIndexOf("/");
      const folder = document.createElement("span");
      folder.className = "cm-code-folder";
      folder.textContent = this.file.slice(0, slash + 1);
      const name = document.createElement("span");
      name.className = "cm-code-name";
      name.textContent = this.file.slice(slash + 1);
      file.append(folder, name);
    }
    header.append(file);

    const language = document.createElement("span");
    language.className = "cm-code-language";
    language.textContent = this.kind.name;
    header.append(language);

    return header;
  }
}

/** Shown in place of the closing fence: how long and how large it is. */
class CodeFooterWidget extends WidgetType {
  constructor(
    private readonly summary: CodeSummary,
    private readonly diff: boolean,
  ) {
    super();
  }

  eq(other: CodeFooterWidget): boolean {
    const [a, b] = [other.summary, this.summary];
    return (
      other.diff === this.diff &&
      a.code === b.code &&
      a.lines === b.lines &&
      a.added === b.added &&
      a.removed === b.removed
    );
  }

  toDOM(): HTMLElement {
    const { code, lines, added, removed } = this.summary;
    const footer = document.createElement("span");
    footer.className = "cm-code-footer";

    const stat = (...content: (string | Node)[]) => {
      const item = document.createElement("span");
      item.className = "cm-code-stat";
      item.append(...content);
      footer.append(item);
    };
    stat(t("stats.lines", { count: lines }));
    stat(t("stats.characters", { count: characterCount(code) }));
    if (this.diff) {
      const plus = document.createElement("span");
      plus.className = "cm-code-count-added";
      plus.textContent = `+${added}`;
      const minus = document.createElement("span");
      minus.className = "cm-code-count-removed";
      minus.textContent = `−${removed}`;
      stat(plus, " ", minus);
    }
    return footer;
  }
}

const hide = Decoration.replace({});

const MARK_CLASS: Record<Exclude<LineMark, null>, string> = {
  added: " cm-code-added",
  removed: " cm-code-removed",
  highlight: " cm-code-highlight",
  meta: " cm-code-meta",
};
const MARK_SIGN: Record<Exclude<LineMark, null>, string> = {
  added: "+",
  removed: "−",
  highlight: "",
  meta: "",
};

/**
 * Decorates a `FencedCode` node, its lines in view only: `eachLineInView`
 * visits them, `editing` tells whether the cursor is in a range.
 */
export function decorateCodeBlock(
  state: EditorState,
  block: SyntaxNode,
  ranges: Range<Decoration>[],
  editing: (from: number, to: number) => boolean,
  eachLineInView: (visit: (line: Line) => void) => void,
): void {
  const marks = block.getChildren("CodeMark");
  const opening = marks[0];
  const first = state.doc.lineAt(block.from);
  const end = state.doc.lineAt(block.to);
  // A block that is still being typed has no closing fence yet.
  const closing = marks.length > 1 ? marks[marks.length - 1] : undefined;
  const closed = closing !== undefined && closing.to === block.to;
  const infoNode = block.getChild("CodeInfo");
  const info: CodeInfo = parseCodeInfo(
    infoNode === null ? "" : state.sliceDoc(infoNode.from, infoNode.to),
  );
  const raw = editing(block.from, block.to);
  // The fence can be indented, inside a list: so are its lines.
  const indent = opening === undefined ? 0 : opening.from - first.from;
  const lastCode = closed ? end.number - 1 : end.number;
  const count = Math.max(0, lastCode - first.number);
  const gutter = `--cb-code-gutter: ${String(Math.max(count, 1)).length}ch`;

  const textOf = (line: Line) => {
    const lead = /^ */.exec(line.text)?.[0].length ?? 0;
    return line.text.slice(Math.min(lead, indent));
  };
  let summary: CodeSummary | undefined;
  const summarize = () => {
    if (summary !== undefined) return summary;
    const lines: string[] = [];
    for (let n = first.number + 1; n <= lastCode; n++) {
      lines.push(textOf(state.doc.line(n)));
    }
    return (summary = summarizeCode(lines, info));
  };
  const isDiff = () => {
    const { added, removed } = summarize();
    return info.diff || added + removed > 0;
  };

  eachLineInView((line) => {
    if (line.number === first.number) {
      const edge = line.number === end.number ? " cm-code-last" : "";
      if (raw || opening === undefined) {
        ranges.push(
          Decoration.line({ class: `cm-code cm-code-first${edge}` }).range(
            line.from,
          ),
        );
        return;
      }
      ranges.push(
        Decoration.line({
          class: `cm-code cm-code-first cm-code-head${edge}`,
        }).range(line.from),
        Decoration.replace({
          widget: new CodeHeaderWidget(codeKind(info), info.file),
        }).range(opening.from, line.to),
      );
      return;
    }
    if (closed && line.number === end.number) {
      if (raw) {
        ranges.push(
          Decoration.line({ class: "cm-code cm-code-last" }).range(line.from),
        );
        return;
      }
      ranges.push(
        Decoration.line({ class: "cm-code cm-code-last cm-code-foot" }).range(
          line.from,
        ),
        Decoration.replace({
          widget: new CodeFooterWidget(summarize(), isDiff()),
        }).range(closing.from, closing.to),
      );
      return;
    }
    const number = line.number - first.number;
    const text = textOf(line);
    const start = line.from + (line.text.length - text.length);
    const read = readCodeLine(text, number, info);
    const diff = isDiff();
    const edge = line.number === end.number ? " cm-code-last" : "";
    ranges.push(
      Decoration.line({
        class:
          "cm-code cm-code-line" +
          (diff ? " cm-code-diff" : "") +
          (read.mark === null ? "" : MARK_CLASS[read.mark]) +
          edge,
        attributes: {
          "data-line": String(number),
          "data-mark": read.mark === null ? "" : MARK_SIGN[read.mark],
          style: gutter,
        },
      }).range(line.from),
    );
    if (raw) return;
    if (read.prefix > 0) {
      ranges.push(hide.range(start, start + read.prefix));
    }
    if (read.noteFrom !== null && start + read.noteFrom < line.to) {
      ranges.push(hide.range(start + read.noteFrom, line.to));
    }
  });
}

/** The look of code blocks; the box itself is drawn in `live-preview.ts`. */
export const codeBlockTheme = EditorView.baseTheme({
  // The first and the last line: a bar of the color of the panels.
  ".cm-line.cm-code.cm-code-head": {
    padding: "4px 6px 4px 12px",
    borderBottom: "1px solid var(--cb-line)",
    backgroundColor: "var(--cb-panel)",
  },
  // No padding above and below: the lines between the counts reach the edges.
  ".cm-line.cm-code.cm-code-foot": {
    padding: "0 12px",
    borderTop: "1px solid var(--cb-line)",
    backgroundColor: "var(--cb-panel)",
  },
  ".cm-code-header, .cm-code-footer": {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    width: "100%",
    verticalAlign: "top",
    fontFamily: "var(--font-sans)",
    fontSize: noteSize(12),
    lineHeight: "1.4",
    color: "var(--cb-faint)",
    userSelect: "none",
  },
  // The counts sit at the right, a full-height line before each one, the
  // first too.
  ".cm-code-footer": {
    alignItems: "stretch",
    justifyContent: "flex-end",
    gap: "0",
    fontSize: noteSize(11),
  },
  ".cm-code-stat": {
    padding: "3px 8px",
    borderLeft: "1px solid var(--cb-line)",
    fontVariantNumeric: "tabular-nums",
  },
  ".cm-code-stat:last-child": { paddingRight: "0" },
  ".cm-code-badge": {
    flex: "none",
    padding: "0 5px",
    border: "1px solid var(--cb-line-strong)",
    borderRadius: "4px",
    backgroundColor: "var(--cb-raise)",
    color: "var(--cb-muted)",
    fontFamily: "var(--cb-mono-font)",
    fontSize: noteSize(11),
    fontWeight: "600",
  },
  ".cm-code-file": {
    display: "flex",
    flex: "1",
    minWidth: "0",
    overflow: "hidden",
    whiteSpace: "nowrap",
    fontFamily: "var(--cb-mono-font)",
  },
  // A long path gives way first: the name of the file stays readable.
  ".cm-code-folder": {
    flex: "0 1 auto",
    minWidth: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  ".cm-code-name": {
    flex: "none",
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    color: "var(--cb-fg)",
    fontWeight: "600",
  },
  ".cm-code-language": { flex: "none" },
  ".cm-code-count-added": { color: "var(--cb-callout-green)" },
  ".cm-code-count-removed": { color: "var(--cb-callout-red)" },
  // Numbers in a gutter of their own, drawn, so they are never copied.
  ".cm-line.cm-code.cm-code-line": {
    position: "relative",
    paddingLeft: "calc(var(--cb-code-gutter) + 30px)",
  },
  ".cm-line.cm-code.cm-code-line.cm-code-diff": {
    paddingLeft: "calc(var(--cb-code-gutter) + 30px + 2ch)",
  },
  ".cm-line.cm-code-line::before": {
    content: "attr(data-line)",
    position: "absolute",
    left: "12px",
    width: "var(--cb-code-gutter)",
    textAlign: "right",
    color: "var(--cb-faint)",
    opacity: "0.75",
    userSelect: "none",
  },
  ".cm-line.cm-code-diff::after": {
    content: "attr(data-mark)",
    position: "absolute",
    top: "0",
    left: "calc(var(--cb-code-gutter) + 24px)",
    width: "2ch",
    textAlign: "center",
    userSelect: "none",
  },
  // Highlighted, added and removed lines: a tint across the box and a
  // bar on its left, so the mark does not rest on color alone.
  ".cm-line.cm-code.cm-code-highlight": {
    backgroundColor: "var(--cb-selected)",
    boxShadow: "inset 2px 0 var(--cb-link)",
  },
  ".cm-line.cm-code.cm-code-added": {
    backgroundColor:
      "color-mix(in srgb, var(--cb-callout-green) var(--cb-callout-tint), var(--cb-code))",
    boxShadow: "inset 2px 0 var(--cb-callout-green)",
  },
  ".cm-line.cm-code.cm-code-removed": {
    backgroundColor:
      "color-mix(in srgb, var(--cb-callout-red) var(--cb-callout-tint), var(--cb-code))",
    boxShadow: "inset 2px 0 var(--cb-callout-red)",
  },
  ".cm-line.cm-code-added::before, .cm-line.cm-code-added::after": {
    color: "var(--cb-callout-green)",
    opacity: "1",
  },
  ".cm-line.cm-code-removed::before, .cm-line.cm-code-removed::after": {
    color: "var(--cb-callout-red)",
    opacity: "1",
  },
  ".cm-line.cm-code-meta": { color: "var(--cb-faint)" },
});
