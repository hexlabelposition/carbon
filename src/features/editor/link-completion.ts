import {
  autocompletion,
  pickedCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { Facet } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { Link, NotePath } from "@carbon/core";
import type { LinkPreview, PreviewedLink } from "./link-preview";
import { headingsOf, type Heading } from "./outline";

/** What the editor needs to suggest notes to link to, and to follow links. */
export interface LinkHost {
  /** Every note of the vault. */
  notes(): Promise<readonly NotePath[]>;
  /** The note being edited: it is not suggested. */
  current: NotePath;
  /**
   * The headings of the note `[[target]]` points to, from the note being
   * edited. Empty if it points to none.
   */
  headings(target: string): Promise<readonly Heading[]>;
  /**
   * Of the targets of wiki links of the current note, as written, the
   * ones that find no note.
   */
  missing(targets: readonly string[]): Promise<ReadonlySet<string>>;
  /**
   * Calls `listener` whenever the notes that links find may have changed.
   * Returns a function that stops it.
   */
  onIndexChange(listener: () => void): () => void;
  /** What a hover over a link of the current note shows. */
  preview(link: PreviewedLink): Promise<LinkPreview>;
  /** Opens the note a link of the current note points to. */
  follow(
    link: Pick<Link, "kind" | "target">,
    options: { newTab: boolean },
  ): void;
}

/**
 * The link host of an editor. Without one, nothing is suggested and no
 * link is followed.
 */
export const linkHost = Facet.define<LinkHost, LinkHost | null>({
  combine: (hosts) => hosts[0] ?? null,
});

/**
 * Suggests notes after "[[", and their headings after "[[Note#" (the
 * headings of this note after "[[#"): the list narrows while the user
 * types, and picking one writes it and closes the link with "]]". Typing
 * on goes on as usual; Escape closes the list.
 */
export const linkCompletion = [
  autocompletion({ override: [suggestNotes, suggestHeadings], icons: false }),
  EditorView.baseTheme({
    ".cm-tooltip.cm-tooltip-autocomplete": {
      border: "1px solid var(--cb-line-strong)",
      borderRadius: "6px",
      backgroundColor: "var(--cb-panel)",
      overflow: "hidden",
    },
    ".cm-tooltip.cm-tooltip-autocomplete > ul": {
      fontFamily: "var(--font-sans)",
      fontSize: "14px",
      maxHeight: "16em",
    },
    ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
      padding: "3px 10px",
      color: "var(--cb-fg)",
    },
    ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "var(--cb-selected)",
      color: "var(--cb-fg)",
    },
    ".cm-completionMatchedText": {
      textDecoration: "none",
      fontWeight: "600",
    },
    ".cm-completionDetail": {
      marginLeft: "12px",
      fontStyle: "normal",
      color: "var(--cb-faint)",
    },
  }),
];

/** Characters that end the note name of a wiki link. */
const NAME_END = /[[\]|#\n]/;

async function suggestNotes(
  context: CompletionContext,
): Promise<CompletionResult | null> {
  const { state, pos } = context;
  const typed = context.matchBefore(/\[\[[^[\]|#\n]*/);
  const host = state.facet(linkHost);
  if (typed === null || host === null) return null;

  const from = typed.from + 2;
  const { to, closed } = partEnd(state, pos, NAME_END, /^(\]\]|[|#])/);

  const notes = (await host.notes()).filter((path) => path !== host.current);
  if (context.aborted) return null;
  const titleCount = new Map<string, number>();
  for (const path of notes) {
    const key = titleOf(path).toLowerCase();
    titleCount.set(key, (titleCount.get(key) ?? 0) + 1);
  }

  const options = notes.map((path): Completion => {
    const title = titleOf(path);
    // Two notes of one name: the path tells which one is meant.
    const unique = titleCount.get(title.toLowerCase()) === 1;
    const name = unique ? title : path.replace(/\.md$/i, "");
    const folder = path.includes("/")
      ? path.slice(0, path.lastIndexOf("/"))
      : undefined;
    return {
      label: title,
      detail: folder,
      apply: (view, completion, start, end) => {
        const insert = closed ? name : `${name}]]`;
        view.dispatch({
          changes: { from: start, to: end, insert },
          selection: { anchor: start + insert.length },
          userEvent: "input.complete",
          annotations: pickedCompletion.of(completion),
        });
      },
    };
  });
  return { from, to, options, validFor: /^[^[\]|#\n]*$/ };
}

/**
 * A heading as it can be written after "#" in a wiki link: the characters
 * that end the link or its parts are left out.
 */
export function asFragment(heading: string): string {
  return heading
    .replace(/[[\]|#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Characters that end the heading of a wiki link. */
const HEADING_END = /[[\]|\n]/;

async function suggestHeadings(
  context: CompletionContext,
): Promise<CompletionResult | null> {
  const { state, pos } = context;
  const typed = context.matchBefore(/\[\[[^[\]|#\n]*#[^[\]|#\n]*/);
  const host = state.facet(linkHost);
  if (typed === null || host === null) return null;

  const written = state.sliceDoc(typed.from + 2, typed.to);
  const hash = written.indexOf("#");
  const target = written.slice(0, hash).trim();
  const from = typed.from + 2 + hash + 1;
  const { to, closed } = partEnd(state, pos, HEADING_END, /^(\]\]|\|)/);

  // "[[#": a heading of this note, as it is now, saved or not.
  const headings =
    target === "" ? headingsOf(state) : await host.headings(target);
  if (context.aborted) return null;

  const seen = new Set<string>();
  const options: Completion[] = [];
  for (const { level, text } of headings) {
    const name = asFragment(text);
    if (name === "" || seen.has(name)) continue;
    seen.add(name);
    options.push({
      label: name,
      detail: "#".repeat(level),
      apply: (view, completion, start, end) => {
        const insert = closed ? name : `${name}]]`;
        view.dispatch({
          changes: { from: start, to: end, insert },
          selection: { anchor: start + insert.length },
          userEvent: "input.complete",
          annotations: pickedCompletion.of(completion),
        });
      },
    });
  }
  return { from, to, options, validFor: /^[^[\]|#\n]*$/ };
}

/**
 * Where the part of a link the cursor is in ends. If `closing` follows,
 * the link is already closed and the rest of the part is replaced too; in
 * a link not closed yet, the text after the cursor is not part of it.
 */
function partEnd(
  state: CompletionContext["state"],
  pos: number,
  partEnds: RegExp,
  closing: RegExp,
): { to: number; closed: boolean } {
  const line = state.doc.lineAt(pos);
  let end = pos;
  while (end < line.to && !partEnds.test(state.sliceDoc(end, end + 1))) end++;
  const closed = closing.test(state.sliceDoc(end, end + 2));
  return { to: closed ? end : pos, closed };
}

function titleOf(path: NotePath): string {
  return path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
}
