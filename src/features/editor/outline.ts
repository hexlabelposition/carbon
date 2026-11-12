import { syntaxTree } from "@codemirror/language";
import { Facet, type EditorState } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";

/** A heading of the note, as the outline shows it. */
export interface Heading {
  /** 1 for "#", up to 6 for "######". */
  level: number;
  /** The text without the Markdown marks. */
  text: string;
}

/** Where the outline of an editor goes, and how it reaches back. */
export interface OutlineHost {
  /** The headings of the note; sent again whenever one of them changes. */
  headings(list: readonly Heading[]): void;
  /** The heading the cursor is under: its index, -1 above the first one. */
  current(index: number): void;
}

/** What the editor of a note is given to show its outline elsewhere. */
export interface OutlineLink extends OutlineHost {
  /**
   * The editor hands over how to go to a heading, by its index. Returns a
   * function that takes it back, for when the editor goes away.
   */
  connect(reveal: (index: number) => void): () => void;
}

/** The outline host of an editor. Without one, no outline is kept. */
export const outlineHost = Facet.define<OutlineHost, OutlineHost | null>({
  combine: (hosts) => hosts[0] ?? null,
});

interface Found extends Heading {
  from: number;
}

/**
 * Keeps the outline host up to date while the user types and moves the
 * cursor. The host hears only real changes: typing in a paragraph moves
 * the headings in the text but does not change the outline.
 */
export const outlineTracker = ViewPlugin.fromClass(
  class {
    found: Found[] = [];
    current = -1;

    constructor(readonly view: EditorView) {
      this.found = headingsIn(view.state);
      this.host(view)?.headings(this.found.map(withoutPlace));
      this.sendCurrent(view);
    }

    update(update: ViewUpdate) {
      const reparsed =
        update.docChanged ||
        // Parsing a long note finishes in the background.
        syntaxTree(update.startState) !== syntaxTree(update.state);
      if (reparsed) {
        const before = this.found;
        this.found = headingsIn(update.state);
        if (!sameOutline(before, this.found)) {
          this.host(update.view)?.headings(this.found.map(withoutPlace));
        }
      }
      if (reparsed || update.selectionSet) this.sendCurrent(update.view);
    }

    destroy() {
      // The editor goes away with its note: nothing is outlined any more.
      const host = this.host(this.view);
      host?.headings([]);
      host?.current(-1);
    }

    host(view: EditorView): OutlineHost | null {
      return view.state.facet(outlineHost);
    }

    sendCurrent(view: EditorView) {
      const head = view.state.selection.main.head;
      let index = -1;
      while (
        index + 1 < this.found.length &&
        this.found[index + 1].from <= head
      ) {
        index++;
      }
      if (index === this.current) return;
      this.current = index;
      this.host(view)?.current(index);
    }
  },
);

/**
 * Puts the cursor on a heading, by its index in the outline, and scrolls it
 * to the top of the editor.
 */
export function revealHeading(view: EditorView, index: number): void {
  const heading = headingsIn(view.state)[index];
  if (heading === undefined) return;
  const line = view.state.doc.lineAt(heading.from);
  view.dispatch({
    selection: { anchor: line.to },
    effects: EditorView.scrollIntoView(line.from, { y: "start", yMargin: 24 }),
  });
  view.focus();
}

/** Blocks that hold no headings: the walk does not go into them. */
const NO_HEADINGS = new Set([
  "Paragraph",
  "FencedCode",
  "CodeBlock",
  "Table",
  "HTMLBlock",
  "CommentBlock",
  "LinkReference",
  "HorizontalRule",
]);

const HEADING = /^(?:ATX|Setext)Heading([1-6])$/;

/** The headings in the parsed part of the note, in order. */
function headingsIn(state: EditorState): Found[] {
  const found: Found[] = [];
  syntaxTree(state).iterate({
    enter({ name, node }) {
      const level = HEADING.exec(name)?.[1];
      if (level !== undefined) {
        found.push({
          level: Number(level),
          text: headingText(state, node),
          from: node.from,
        });
        return false;
      }
      return !NO_HEADINGS.has(name);
    },
  });
  return found;
}

/** Parts of a heading that are Markdown, not text. */
const MARKS = new Set([
  "HeaderMark",
  "EmphasisMark",
  "CodeMark",
  "StrikethroughMark",
  "LinkMark",
  "URL",
  "LinkTitle",
  "LinkLabel",
  "Image",
]);

/** "## Some *text* [link](x.md) ##" becomes "Some text link". */
function headingText(state: EditorState, heading: SyntaxNode): string {
  let text = "";
  let at = heading.from;
  const walk = (node: SyntaxNode) => {
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (MARKS.has(child.name)) {
        text += state.sliceDoc(at, child.from);
        at = child.to;
      } else {
        walk(child);
      }
    }
  };
  walk(heading);
  text += state.sliceDoc(at, heading.to);
  return text.replace(/\s+/g, " ").trim();
}

function withoutPlace({ level, text }: Found): Heading {
  return { level, text };
}

function sameOutline(a: readonly Found[], b: readonly Found[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (heading, i) =>
        heading.level === b[i].level && heading.text === b[i].text,
    )
  );
}
